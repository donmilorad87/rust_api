//! Games event handler
//!
//! Processes game commands from the WebSocket gateway and publishes game events back.
//! Active game rooms are stored in PostgreSQL for persistence across restarts.
//! Game history is stored in MongoDB after games complete.

use crate::app::db_query::mutations::game_room as game_room_mutations;
use crate::app::db_query::mutations::game_player_disconnects as disconnect_mutations;
use crate::app::db_query::read::game_room as game_room_read;
use crate::app::db_query::read::game_player_disconnects as disconnect_read;
use crate::app::db_query::read::user;
use crate::app::games::bigger_dice::{self, BiggerDiceRoundState};
use crate::app::games::mongodb_game_chat::{ChatChannel, MongoGameChatClient};
use crate::app::games::mongodb_games::MongoGameClient;
use crate::app::db_query::mutations::game_user_mutes as mute_mutations;
// game_user_mutes read operations available if needed for filtering
#[allow(unused_imports)]
use crate::app::db_query::read::game_user_mutes as mute_read;
use crate::app::games::types::{
    Audience, BannedPlayer, EventEnvelope, GameEvent, GameHistoryPlayer, GamePlayer, GameRoom,
    GameSpectator, GameType, RoomStatus,
};
use crate::events::consumer::{EventHandler, EventHandlerError};
use crate::events::producer::EventProducer;
use crate::events::topics::topic;
use async_trait::async_trait;
use chrono::{Duration, Utc};
use mongodb::Database;
use serde_json::Value;
use sqlx::{Pool, Postgres};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Handler for game commands from WebSocket gateway
pub struct GameCommandHandler {
    db: Arc<Mutex<Pool<Postgres>>>,
    mongodb: Option<Arc<Database>>,
    producer: Option<Arc<EventProducer>>,
    /// In-memory cache of active game rooms (synced with PostgreSQL)
    rooms: Arc<Mutex<HashMap<String, GameRoom>>>,
    /// Round states for Bigger Dice games (transient, not persisted)
    round_states: Arc<Mutex<HashMap<String, BiggerDiceRoundState>>>,
    /// Votes to auto-replace disconnected players (room_id -> user_id -> voters)
    disconnect_votes: Arc<Mutex<HashMap<String, HashMap<i64, HashSet<i64>>>>>,
}

impl GameCommandHandler {
    pub fn new(
        db: Arc<Mutex<Pool<Postgres>>>,
        mongodb: Option<Arc<Database>>,
        producer: Option<Arc<EventProducer>>,
    ) -> Self {
        Self {
            db,
            mongodb,
            producer,
            rooms: Arc::new(Mutex::new(HashMap::new())),
            round_states: Arc::new(Mutex::new(HashMap::new())),
            disconnect_votes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Parse user_id from JSON value (handles both string and integer formats)
    fn parse_user_id(value: Option<&serde_json::Value>) -> Option<i64> {
        value.and_then(|v| {
            v.as_i64().or_else(|| {
                v.as_str().and_then(|s| s.parse::<i64>().ok())
            })
        })
    }

    /// Parse optional i64 from JSON value (handles both string and integer formats)
    fn parse_optional_i64(value: Option<&serde_json::Value>) -> Option<i64> {
        value.and_then(|v| {
            v.as_i64().or_else(|| {
                v.as_str().and_then(|s| s.parse::<i64>().ok())
            })
        })
    }

    fn json_array_has_user_id(value: &serde_json::Value, user_id: i64) -> bool {
        value.as_array().is_some_and(|items| {
            items.iter().any(|item| Self::parse_user_id(item.get("user_id")) == Some(user_id))
        })
    }

    fn room_list_item_for_user(
        record: &game_room_read::GameRoomRecord,
        user_id: i64,
    ) -> Option<serde_json::Value> {
        let is_waiting = record.status == "waiting";
        let is_in_progress = record.status == "in_progress";

        if record.banned_users.contains(&user_id) {
            return None;
        }

        let user_in_room = record.host_id == user_id
            || record.recorded_players.contains(&user_id)
            || record.recorded_spectators.contains(&user_id)
            || record.spectators.contains(&user_id)
            || Self::json_array_has_user_id(&record.players, user_id)
            || Self::json_array_has_user_id(&record.lobby, user_id);

        if !is_waiting && !(is_in_progress && user_in_room) {
            return None;
        }

        let player_count = record.players.as_array().map(|a| a.len()).unwrap_or(0);
        let lobby_count = record.lobby.as_array().map(|a| a.len()).unwrap_or(0);
        let spectator_count = record.spectators.len();

        // Find host name from players or lobby array
        let host_id = record.host_id;
        let host_name = record
            .players
            .as_array()
            .and_then(|players| {
                players.iter().find(|p| {
                    p.get("user_id").and_then(|id| id.as_i64()) == Some(host_id)
                })
            })
            .and_then(|p| p.get("username").and_then(|n| n.as_str()))
            .or_else(|| {
                record.lobby.as_array().and_then(|lobby| {
                    lobby.iter().find(|p| {
                        p.get("user_id").and_then(|id| id.as_i64()) == Some(host_id)
                    })
                })
                .and_then(|p| p.get("username").and_then(|n| n.as_str()))
            })
            .unwrap_or("Unknown");

        let rejoin_role = if user_in_room {
            if record.recorded_players.contains(&user_id)
                || Self::json_array_has_user_id(&record.players, user_id)
            {
                Some("player")
            } else if record.recorded_spectators.contains(&user_id)
                || record.spectators.contains(&user_id)
            {
                Some("spectator")
            } else if Self::json_array_has_user_id(&record.lobby, user_id) {
                Some("lobby")
            } else if record.host_id == user_id {
                Some("host")
            } else {
                None
            }
        } else {
            None
        };

        Some(serde_json::json!({
            "room_id": record.room_id,
            "room_name": record.room_name,
            "game_type": record.game_type,
            "host_id": record.host_id,
            "host_name": host_name,
            "players": record.players, // Full player array for UI display
            "lobby": record.lobby,     // Full lobby array
            "player_count": player_count,
            "lobby_count": lobby_count,
            "spectator_count": spectator_count,
            "max_players": record.player_count, // Use actual player count from room
            "status": record.status,
            "is_password_protected": record.is_password_protected,
            "allow_spectators": record.allow_spectators,
            "created_at": record.created_at.to_rfc3339(),
            "can_rejoin": user_in_room,
            "rejoin_role": rejoin_role,
        }))
    }

    fn active_kick_voter_ids(
        room: &GameRoom,
        pending_disconnects: &HashSet<i64>,
        target_user_id: i64,
    ) -> Vec<i64> {
        room.players
            .iter()
            .map(|p| p.user_id)
            .filter(|user_id| {
                *user_id != target_user_id
                    && !pending_disconnects.contains(user_id)
                    && !room.is_auto_player(*user_id)
            })
            .collect()
    }

    async fn clear_disconnect_votes_for(&self, room_id: &str, user_id: i64) {
        let mut votes = self.disconnect_votes.lock().await;
        if let Some(room_votes) = votes.get_mut(room_id) {
            room_votes.remove(&user_id);
            if room_votes.is_empty() {
                votes.remove(room_id);
            }
        }
    }

    async fn clear_disconnect_votes_room(&self, room_id: &str) {
        let mut votes = self.disconnect_votes.lock().await;
        votes.remove(room_id);
    }

    /// Convert a database record to a GameRoom struct
    fn db_record_to_game_room(record: &game_room_read::GameRoomRecord) -> GameRoom {
        let players: Vec<GamePlayer> = serde_json::from_value(record.players.clone())
            .unwrap_or_default();
        let lobby: Vec<GamePlayer> = serde_json::from_value(record.lobby.clone())
            .unwrap_or_default();
        let game_type = GameType::from_str(&record.game_type).unwrap_or_default();
        let status = match record.status.as_str() {
            "waiting" => RoomStatus::Waiting,
            "in_progress" => RoomStatus::InProgress,
            "finished" => RoomStatus::Finished,
            "abandoned" => RoomStatus::Abandoned,
            _ => RoomStatus::Waiting,
        };

        // Convert banned user IDs to BannedPlayer objects
        // Note: usernames are placeholders since DB only stores IDs
        let banned_users: Vec<BannedPlayer> = record
            .banned_users
            .iter()
            .map(|&user_id| BannedPlayer {
                user_id,
                username: format!("User #{}", user_id),
            })
            .collect();

        // Parse spectators_data from JSONB
        let spectators_data: Vec<GameSpectator> = serde_json::from_value(
            record.spectators_data.clone()
        ).unwrap_or_default();

        GameRoom {
            room_id: record.room_id.clone(),
            room_name: record.room_name.clone(),
            game_type,
            status,
            host_id: record.host_id,
            players,
            lobby,
            banned_users,
            spectators: record.spectators.clone(),
            current_turn: record.current_turn,
            turn_number: record.turn_number,
            created_at: record.created_at,
            started_at: record.started_at,
            finished_at: record.finished_at,
            winner_id: record.winner_id,
            password_hash: record.password_hash.clone(),
            is_password_protected: record.is_password_protected,
            // Enhanced fields
            player_count: record.player_count,
            allow_spectators: record.allow_spectators,
            max_spectators: record.max_spectators,
            admin_spectator_id: record.admin_spectator_id,
            lobby_chat_enabled: record.lobby_chat_enabled,
            spectators_data,
            recorded_players: record.recorded_players.clone(),
            recorded_spectators: record.recorded_spectators.clone(),
            selected_players: record.selected_players.clone(),
            auto_players: Vec::new(),
        }
    }

    /// Get room from cache or database
    async fn get_room(&self, room_id: &str) -> Result<Option<GameRoom>, EventHandlerError> {
        // Check cache first
        {
            let rooms = self.rooms.lock().await;
            if let Some(room) = rooms.get(room_id) {
                return Ok(Some(room.clone()));
            }
        }

        // Fallback to database
        let db = self.db.lock().await;
        let record = game_room_read::get_by_room_id(&db, room_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Database error: {}", e)))?;

        if let Some(record) = record {
            let room = Self::db_record_to_game_room(&record);
            // Update cache
            let mut rooms = self.rooms.lock().await;
            rooms.insert(room_id.to_string(), room.clone());
            Ok(Some(room))
        } else {
            Ok(None)
        }
    }

    /// Get room by name from cache or database
    async fn get_room_by_name(&self, room_name: &str) -> Result<Option<GameRoom>, EventHandlerError> {
        // Check cache first
        {
            let rooms = self.rooms.lock().await;
            if let Some(room) = rooms.values().find(|r| r.room_name == room_name && r.status == RoomStatus::Waiting) {
                return Ok(Some(room.clone()));
            }
        }

        // Fallback to database
        let db = self.db.lock().await;
        let record = game_room_read::get_by_room_name(&db, room_name)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Database error: {}", e)))?;

        if let Some(record) = record {
            let room = Self::db_record_to_game_room(&record);
            // Update cache
            let mut rooms = self.rooms.lock().await;
            rooms.insert(room.room_id.clone(), room.clone());
            Ok(Some(room))
        } else {
            Ok(None)
        }
    }

    /// Update room in cache and database
    async fn update_room(&self, room: &GameRoom) -> Result<(), EventHandlerError> {
        // Update cache
        {
            let mut rooms = self.rooms.lock().await;
            rooms.insert(room.room_id.clone(), room.clone());
        }

        // Database sync is handled by specific mutations for each operation
        // This method just ensures cache consistency
        Ok(())
    }

    /// Remove room from cache
    async fn remove_room_from_cache(&self, room_id: &str) {
        let mut rooms = self.rooms.lock().await;
        rooms.remove(room_id);
    }

    /// Build a room state event that keeps the ready phase in a waiting UI state.
    fn room_state_event(room: &GameRoom) -> GameEvent {
        let mut room_state = room.clone();
        let selected_full = room_state.selected_players.len() as i32 == room_state.player_count;

        if room_state.status == RoomStatus::InProgress
            && room_state.players.is_empty()
            && selected_full
            && !room_state.lobby.is_empty()
        {
            // Ready phase: selected players are still in the lobby, keep UI in waiting mode.
            room_state.players = room_state.lobby.clone();
            room_state.status = RoomStatus::Waiting;
        }

        GameEvent::RoomState { room: room_state }
    }

    /// Send an event back to the WebSocket gateway via Kafka
    async fn publish_game_event(
        &self,
        event: GameEvent,
        audience: Audience,
    ) -> Result<(), EventHandlerError> {
        let Some(producer) = &self.producer else {
            warn!("No Kafka producer available for game events");
            return Ok(());
        };

        // Construct full event type like "games.event.room_created"
        let event_type = format!("games.event.{}", event.event_type_name());

        let envelope = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type,
            timestamp: Utc::now().to_rfc3339(),
            correlation_id: None,
            producer: "blazing_sun".to_string(),
            actor: crate::app::games::types::Actor {
                user_id: 0,
                username: "system".to_string(),
                socket_id: String::new(),
                roles: vec![],
            },
            audience,
            payload: serde_json::to_value(&event).unwrap_or(Value::Null),
        };

        let bytes = serde_json::to_vec(&envelope)
            .map_err(|e| EventHandlerError::Fatal(format!("Failed to serialize game event: {}", e)))?;

        producer
            .send_raw(topic::GAMES_EVENTS, None, &bytes)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to publish game event: {}", e)))?;

        Ok(())
    }

    /// Handle create_room command
    async fn handle_create_room(
        &self,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        game_type: &str,
        room_name: &str,
        socket_id: &str,
        password: Option<&str>,
        player_count: Option<i32>,
        allow_spectators: Option<bool>,
    ) -> Result<(), EventHandlerError> {
        let game_type_enum = GameType::from_str(game_type).ok_or_else(|| {
            EventHandlerError::Fatal(format!("Unknown game type: {}", game_type))
        })?;

        let room_id = Uuid::new_v4().to_string();

        // Hash password if provided
        let password_hash = password.and_then(|p| {
            if p.is_empty() {
                None
            } else {
                bcrypt::hash(p, bcrypt::DEFAULT_COST).ok()
            }
        });

        // Validate and clamp player_count (2-10)
        let player_count_val = player_count.unwrap_or(2).clamp(2, 10);
        let allow_spectators_val = allow_spectators.unwrap_or(true);

        // Create room in database using stored procedure
        let db = self.db.lock().await;
        let create_params = game_room_mutations::CreateRoomParams {
            room_id: room_id.clone(),
            room_name: room_name.to_string(),
            game_type: game_type.to_string(),
            host_id: user_id,
            password_hash: password_hash.clone(),
            player_count: Some(player_count_val),
            allow_spectators: Some(allow_spectators_val),
        };

        game_room_mutations::create(&db, &create_params)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to create room in database: {}", e)))?;

        drop(db);

        // Build room for cache and events
        let is_password_protected = password_hash.is_some();
        let mut room = GameRoom::new_with_settings(
            &room_id,
            room_name,
            game_type_enum.clone(),
            user_id,
            password,
            player_count_val,
            allow_spectators_val,
        );

        // Add host to lobby (they can be selected to play like any other player)
        room.lobby.push(GamePlayer {
            user_id,
            username: username.to_string(),
            avatar_id,
            score: 0,
            is_ready: false,
            joined_at: Utc::now(),
        });

        // Store room in cache
        {
            let mut rooms = self.rooms.lock().await;
            rooms.insert(room_id.clone(), room.clone());
        }

        // Emit room created event (broadcast so all lobby viewers see it)
        let event = GameEvent::RoomCreated {
            room_id: room_id.clone(),
            room_name: room_name.to_string(),
            game_type: game_type_enum.as_str().to_string(),
            host_id: user_id,
            host_username: username.to_string(),
            is_password_protected,
            player_count: room.player_count,
            allow_spectators: room.allow_spectators,
        };

        self.publish_game_event(event, Audience::broadcast()).await?;

        info!(
            room_id = %room_id,
            room_name = %room_name,
            host_id = %user_id,
            game_type = %game_type_enum.as_str(),
            is_password_protected = %is_password_protected,
            "Game room created and stored in database"
        );

        Ok(())
    }

    /// Handle join_room command - players go to lobby, not directly to game
    async fn handle_join_room(
        &self,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        room_name: &str,
        socket_id: &str,
        password: Option<&str>,
    ) -> Result<(), EventHandlerError> {
        // Get room from cache or database
        let room_opt = self.get_room_by_name(room_name).await?;

        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found or game already started".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Check if user is banned (check database for authoritative state)
        let db = self.db.lock().await;
        let is_banned = game_room_read::is_user_banned(&db, &room.room_id, user_id).await;
        drop(db);

        if is_banned {
            let error = GameEvent::Error {
                code: "user_banned".to_string(),
                message: "You are banned from this room".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Check password for protected rooms
        if room.is_password_protected {
            let provided_password = password.unwrap_or("");
            if !room.verify_password(provided_password) {
                let error = GameEvent::Error {
                    code: "wrong_password".to_string(),
                    message: "Incorrect room password".to_string(),
                    socket_id: socket_id.to_string(),
                };
                self.publish_game_event(error, Audience::user(user_id)).await?;
                return Ok(());
            }
        }

        // Check if already in room (player or lobby)
        if room.is_player(user_id) || room.is_in_lobby(user_id) {
            let error = GameEvent::Error {
                code: "already_in_room".to_string(),
                message: "You are already in this room".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Add player to lobby in database
        let db = self.db.lock().await;
        let added = game_room_mutations::add_to_lobby(&db, &room.room_id, user_id)
            .await
            .map_err(|e| {
                warn!(error = %e, "Failed to add player to lobby in database");
                EventHandlerError::Retryable(format!("Database error: {}", e))
            })?;
        drop(db);

        if !added {
            let error = GameEvent::Error {
                code: "join_failed".to_string(),
                message: "Failed to join room lobby".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Update cache with new lobby member
        let player = GamePlayer {
            user_id,
            username: username.to_string(),
            avatar_id,
            score: 0,
            is_ready: false,
            joined_at: Utc::now(),
        };

        room.lobby.push(player.clone());

        let room_id = room.room_id.clone();
        let room_name_str = room.room_name.clone();

        // Update cache
        self.update_room(&room).await?;

        // Notify the joining user with full room state
        let room_state = Self::room_state_event(&room);
        self.publish_game_event(room_state, Audience::user(user_id)).await?;

        // Notify room that someone joined lobby
        let event = GameEvent::LobbyJoined {
            room_id: room_id.clone(),
            room_name: room_name_str.clone(),
            player,
        };

        self.publish_game_event(event, Audience::room(room_id.clone())).await?;

        info!(
            room_id = %room_id,
            user_id = %user_id,
            "Player joined game room lobby (persisted to database)"
        );

        Ok(())
    }

    /// Handle leave_room command
    async fn handle_leave_room(
        &self,
        user_id: i64,
        room_id: &str,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            return Ok(());
        };

        if room.status == RoomStatus::InProgress && room.is_player(user_id) {
            self.handle_player_disconnected(user_id, room_id).await?;
            return Ok(());
        }

        // Find player info for event (check both players and lobby)
        let player = room.players.iter().find(|p| p.user_id == user_id)
            .or_else(|| room.lobby.iter().find(|p| p.user_id == user_id));
        let username = player.map(|p| p.username.clone()).unwrap_or_default();

        // Store room name for room_removed event
        let room_name = room.room_name.clone();

        // Remove player from both players and lobby lists
        room.players.retain(|p| p.user_id != user_id);
        room.lobby.retain(|p| p.user_id != user_id);

        // Remove from database
        let db = self.db.lock().await;
        if let Err(e) = game_room_mutations::remove_player(&db, room_id, user_id).await {
            warn!(error = %e, "Failed to remove player from database");
        }

        let event = GameEvent::PlayerLeft {
            room_id: room_id.to_string(),
            user_id,
            username,
        };

        // If room is empty or host left during waiting, deactivate room (soft delete)
        let should_deactivate = room.players.is_empty()
            || (room.status == RoomStatus::Waiting && room.host_id == user_id);

        if should_deactivate {
            // Deactivate room (soft delete) instead of hard delete
            if let Err(e) = game_room_mutations::deactivate(&db, room_id).await {
                warn!(error = %e, "Failed to deactivate room in database");
            }
            if let Err(e) = disconnect_mutations::delete_for_room(&db, room_id).await {
                warn!(error = %e, "Failed to clear disconnect records for room");
            }
            drop(db);
            self.remove_room_from_cache(room_id).await;
            self.clear_disconnect_votes_room(room_id).await;

            // Notify all clients that the room is removed (for lobby list update)
            let reason = if room.host_id == user_id {
                "host_left"
            } else {
                "abandoned"
            };
            let room_removed_event = GameEvent::RoomRemoved {
                room_id: room_id.to_string(),
                room_name,
                reason: reason.to_string(),
            };
            // Broadcast to all clients so they can remove the room from their lobby list
            self.publish_game_event(room_removed_event, Audience::broadcast()).await?;
        } else {
            drop(db);
            self.update_room(&room).await?;
        }

        self.publish_game_event(event, Audience::room(room_id.to_string())).await?;

        info!(
            room_id = %room_id,
            user_id = %user_id,
            "Player left game room"
        );

        Ok(())
    }

    /// Handle player disconnect (WebSocket closed)
    async fn handle_player_disconnected(
        &self,
        user_id: i64,
        room_id: &str,
    ) -> Result<(), EventHandlerError> {
        let room_opt = self.get_room(room_id).await?;
        let Some(room) = room_opt else {
            return Ok(());
        };

        if room.status != RoomStatus::InProgress {
            return Ok(());
        }

        if !room.is_player(user_id) || room.is_auto_player(user_id) {
            return Ok(());
        }

        let username = room
            .get_player(user_id)
            .map(|p| p.username.clone())
            .unwrap_or_else(|| "Unknown".to_string());

        let timeout_seconds = 30;
        let timeout_at = Utc::now() + Duration::seconds(timeout_seconds);

        let db = self.db.lock().await;
        if let Err(e) = disconnect_mutations::record_disconnect(&db, room_id, user_id, Some(timeout_seconds as i32)).await {
            warn!(error = %e, "Failed to record player disconnect");
            return Ok(());
        }
        drop(db);

        self.clear_disconnect_votes_for(room_id, user_id).await;

        let event = GameEvent::PlayerDisconnected {
            room_id: room_id.to_string(),
            user_id,
            username,
            timeout_at,
        };
        self.publish_game_event(event, Audience::room(room_id.to_string())).await?;

        Ok(())
    }

    /// Handle kick vote for a disconnected player (auto-replace after timeout)
    async fn handle_vote_kick_disconnected(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        let room_opt = self.get_room(room_id).await?;
        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        if room.status != RoomStatus::InProgress {
            let error = GameEvent::Error {
                code: "game_not_in_progress".to_string(),
                message: "Game is not in progress".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        if user_id == target_user_id {
            let error = GameEvent::Error {
                code: "cannot_kick_self".to_string(),
                message: "You cannot kick yourself".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        if !room.is_player(user_id) || !room.is_player(target_user_id) {
            let error = GameEvent::Error {
                code: "invalid_player".to_string(),
                message: "Player not found in room".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        if room.is_auto_player(target_user_id) {
            let error = GameEvent::Error {
                code: "player_already_auto".to_string(),
                message: "Player is already auto-controlled".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        let db = self.db.lock().await;
        let disconnect = disconnect_read::get_disconnect(&db, room_id, target_user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to read disconnect: {}", e)))?;

        let pending_disconnects = disconnect_read::get_pending_in_room(&db, room_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to read pending disconnects: {}", e)))?;
        drop(db);

        let Some((disconnect_id, disconnected_at, timeout_seconds, deselected, reconnected)) = disconnect else {
            let error = GameEvent::Error {
                code: "player_not_disconnected".to_string(),
                message: "Player is not marked as disconnected".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        if deselected || reconnected {
            let error = GameEvent::Error {
                code: "disconnect_already_handled".to_string(),
                message: "Disconnect already handled".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        let timeout_at = disconnected_at + Duration::seconds(timeout_seconds as i64);
        if Utc::now() < timeout_at {
            let error = GameEvent::Error {
                code: "disconnect_timeout_active".to_string(),
                message: "Disconnect timeout has not elapsed yet".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        let pending_disconnect_ids: HashSet<i64> = pending_disconnects
            .iter()
            .map(|(_, pending_user_id, _, _)| *pending_user_id)
            .collect();
        let active_voters = Self::active_kick_voter_ids(&room, &pending_disconnect_ids, target_user_id);

        if !active_voters.contains(&user_id) {
            let error = GameEvent::Error {
                code: "not_eligible_to_vote".to_string(),
                message: "You are not eligible to vote".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        let mut votes = self.disconnect_votes.lock().await;
        let room_votes = votes.entry(room_id.to_string()).or_insert_with(HashMap::new);
        let voter_set = room_votes.entry(target_user_id).or_insert_with(HashSet::new);
        voter_set.insert(user_id);
        let vote_count = voter_set.len();
        drop(votes);

        if active_voters.is_empty() {
            return Ok(());
        }

        if vote_count >= active_voters.len() {
            let username = room
                .get_player(target_user_id)
                .map(|p| p.username.clone())
                .unwrap_or_else(|| format!("User #{}", target_user_id));

            room.enable_auto_player(target_user_id);
            room.ban_user(target_user_id, &username);
            self.update_room(&room).await?;

            let db = self.db.lock().await;
            if let Err(e) = disconnect_mutations::mark_deselected(&db, disconnect_id).await {
                warn!(error = %e, "Failed to mark disconnect as deselected");
            }
            if let Err(e) = game_room_mutations::ban_player_system(&db, room_id, target_user_id).await {
                warn!(error = %e, "Failed to ban disconnected player");
            }
            drop(db);

            self.clear_disconnect_votes_for(room_id, target_user_id).await;

            let event = GameEvent::PlayerAutoEnabled {
                room_id: room_id.to_string(),
                user_id: target_user_id,
                username,
            };
            self.publish_game_event(event, Audience::room(room_id.to_string())).await?;

            self.auto_roll_until_human_turn(room_id).await?;
        }

        Ok(())
    }

    /// Handle rejoin_room command (for reconnection)
    async fn handle_rejoin_room(
        &self,
        user_id: i64,
        room_id: Option<&str>,
        room_name: Option<&str>,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        let db = self.db.lock().await;

        // Get user info
        let user = user::get_by_id(&db, user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to get user: {}", e)))?;

        drop(db);

        // Get room from cache or database - try room_id first, then room_name
        let room_opt = if let Some(id) = room_id {
            let by_id = self.get_room(id).await?;
            if by_id.is_some() {
                by_id
            } else if let Some(name) = room_name {
                // ID lookup failed, try by name
                self.get_room_by_name(name).await?
            } else {
                None
            }
        } else if let Some(name) = room_name {
            self.get_room_by_name(name).await?
        } else {
            None
        };

        let Some(room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room no longer exists".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Check if user was in this room (as player, spectator, in lobby, or is the host/admin)
        // Note: Banned users are also shown NotInRoom - ban check happens when they try to join
        let is_player = room.is_player(user_id);
        let is_spectator = room.is_spectator(user_id);
        let is_in_lobby = room.is_in_lobby(user_id);
        let is_banned = room.is_banned(user_id);
        let is_host = room.host_id == user_id;  // Room creator always has access

        // Host/admin always gets room state (even if they left and are rejoining)
        // Other users need to be in the room
        if is_banned {
            // Banned users see NotInRoom
            let not_in_room = GameEvent::NotInRoom {
                room_id: room.room_id.clone(),
                room_name: room.room_name.clone(),
                is_password_protected: room.is_password_protected,
                status: room.status.clone(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(not_in_room, Audience::user(user_id)).await?;
            return Ok(());
        }

        if !is_host && !is_player && !is_spectator && !is_in_lobby {
            // Non-host users who aren't in the room see NotInRoom
            let not_in_room = GameEvent::NotInRoom {
                room_id: room.room_id.clone(),
                room_name: room.room_name.clone(),
                is_password_protected: room.is_password_protected,
                status: room.status.clone(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(not_in_room, Audience::user(user_id)).await?;
            return Ok(());
        }

        let username = user.first_name.clone();
        let room_id_str = room.room_id.clone();

        // If host is rejoining but not currently in the room, add them back to lobby
        let mut room = room;
        if is_host && !is_player && !is_in_lobby && !is_spectator {
            // Add host back to lobby
            let host_player = GamePlayer {
                user_id,
                username: username.clone(),
                avatar_id: user.avatar_id,
                score: 0,
                is_ready: false,
                joined_at: Utc::now(),
            };
            room.lobby.push(host_player.clone());

            // Also add to database
            let db = self.db.lock().await;
            if let Err(e) = game_room_mutations::add_to_lobby(&db, &room_id_str, user_id).await {
                warn!(error = %e, "Failed to add host back to lobby in database");
            }
            drop(db);

            // Update cache
            self.update_room(&room).await?;

            info!(
                room_id = %room_id_str,
                user_id = %user_id,
                "Host rejoined and was added back to lobby"
            );
        }

        let was_auto = room.is_auto_player(user_id);
        if was_auto {
            room.disable_auto_player(user_id);
            self.update_room(&room).await?;
        }

        if is_player {
            let db = self.db.lock().await;
            if let Err(e) = disconnect_mutations::mark_reconnected(&db, &room_id_str, user_id).await {
                warn!(error = %e, "Failed to mark player reconnected");
            }
            drop(db);
            self.clear_disconnect_votes_for(&room_id_str, user_id).await;
        }

        // Send room state to rejoin user
        let room_state = Self::room_state_event(&room);
        
        // Send room state to the rejoining user
        self.publish_game_event(room_state, Audience::user(user_id)).await?;

        if room.game_type == GameType::BiggerDice && room.status == RoomStatus::InProgress {
            let round_state = {
                let round_states = self.round_states.lock().await;
                round_states.get(&room_id_str).cloned()
            };

            if let (Some(round_state), Some(player1), Some(player2)) =
                (round_state, room.players.get(0), room.players.get(1))
            {
                let event = GameEvent::BiggerDiceState {
                    room_id: room_id_str.clone(),
                    player1_id: player1.user_id,
                    player1_roll: round_state.last_player1_roll,
                    player2_id: player2.user_id,
                    player2_roll: round_state.last_player2_roll,
                };
                self.publish_game_event(event, Audience::user(user_id)).await?;
            }
        }

        if was_auto {
            let event = GameEvent::PlayerAutoDisabled {
                room_id: room_id_str.clone(),
                user_id,
                username: username.clone(),
            };
            self.publish_game_event(event, Audience::room(room_id_str.clone())).await?;
        }

        // Notify room that player has reconnected
        if is_player {
            let event = GameEvent::PlayerRejoined {
                room_id: room_id_str.clone(),
                user_id,
                username: username.clone(),
            };
            self.publish_game_event(event, Audience::room(room_id_str.clone())).await?;

            info!(
                room_id = %room_id_str,
                user_id = %user_id,
                "Player rejoined game room"
            );
        } else if is_in_lobby {
            info!(
                room_id = %room_id_str,
                user_id = %user_id,
                "Lobby user reconnected to game room"
            );
        }

        let db = self.db.lock().await;
        let pending_disconnects = disconnect_read::get_pending_in_room(&db, &room_id_str)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to read pending disconnects: {}", e)))?;
        drop(db);

        for (_, pending_user_id, disconnected_at, timeout_seconds) in pending_disconnects {
            let timeout_at = disconnected_at + Duration::seconds(timeout_seconds as i64);
            if let Some(player) = room.get_player(pending_user_id) {
                let event = GameEvent::PlayerDisconnected {
                    room_id: room_id_str.clone(),
                    user_id: pending_user_id,
                    username: player.username.clone(),
                    timeout_at,
                };
                self.publish_game_event(event, Audience::user(user_id)).await?;
            }
        }

        Ok(())
    }

    /// Handle ready command
    async fn handle_ready(
        &self,
        user_id: i64,
        room_id: &str,
        _socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            return Ok(());
        };

        // Player must be in lobby and selected to click ready
        let is_in_lobby = room.is_in_lobby(user_id);
        let is_selected = room.is_selected_player(user_id);
        
        if !is_in_lobby {
            warn!(user_id = %user_id, room_id = %room_id, "User not in lobby, cannot ready");
            return Ok(());
        }
        
        if !is_selected {
            warn!(user_id = %user_id, room_id = %room_id, "User not selected, cannot ready");
            return Ok(());
        }

        // Mark player as ready in lobby
        let username = if let Some(player) = room.lobby.iter_mut().find(|p| p.user_id == user_id) {
            player.is_ready = true;
            player.username.clone()
        } else {
            format!("User #{}", user_id)
        };

        // Update lobby in database
        let lobby_json = serde_json::to_value(&room.lobby).unwrap_or_default();
        let db = self.db.lock().await;
        if let Err(e) = game_room_mutations::update_lobby(&db, room_id, &lobby_json).await {
            warn!(error = %e, "Failed to update lobby ready state in database");
        }
        drop(db);

        let event = GameEvent::PlayerReady {
            room_id: room_id.to_string(),
            user_id,
            username,
        };

        self.publish_game_event(event, Audience::room(room_id.to_string())).await?;

        // Check if all selected players are ready and auto-start
        // Must have exactly player_count selected players, and all must be ready
        if room.selected_players.len() == room.player_count as usize && room.all_selected_ready() {
            info!(room_id = %room_id, player_count = %room.player_count, "All selected players ready - auto-starting game");
            
            // Move selected players from lobby to players
            room.move_selected_to_players();
            room.status = RoomStatus::InProgress;

            let events = bigger_dice::start_game(&mut room);

            // Update game start in database with full state
            let first_turn = room.players.first().map(|p| p.user_id);
            let players_json = serde_json::to_value(&room.players).unwrap_or_default();
            let lobby_json = serde_json::to_value(&room.lobby).unwrap_or_default();
            
            let db = self.db.lock().await;
            if let Err(e) = game_room_mutations::start_game_with_state(
                &db, 
                room_id, 
                first_turn,
                &players_json,
                &lobby_json,
            ).await {
                warn!(error = %e, "Failed to start game in database");
            }
            drop(db);

            // Initialize round state
            {
                let mut round_states = self.round_states.lock().await;
                round_states.insert(room_id.to_string(), BiggerDiceRoundState::default());
            }

            // Update cache with started game state
            self.update_room(&room).await?;

            for event in events {
                self.publish_game_event(event, Audience::room(room_id.to_string())).await?;
            }
        } else {
            // Update cache with ready state
            self.update_room(&room).await?;
        }

        Ok(())
    }

    /// Handle spectate command
    async fn handle_spectate(
        &self,
        user_id: i64,
        room_id: &str,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        let db = self.db.lock().await;

        // Get user info
        let user = user::get_by_id(&db, user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to get user: {}", e)))?;

        drop(db);

        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Check if room allows spectators
        if !room.allow_spectators {
            let error = GameEvent::Error {
                code: "spectators_not_allowed".to_string(),
                message: "This room does not allow spectators".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Add spectator to cache
        if !room.spectators.contains(&user_id) {
            room.spectators.push(user_id);
        }

        // Add spectator in database
        let db = self.db.lock().await;
        if let Err(e) = game_room_mutations::add_spectator(&db, room_id, user_id).await {
            warn!(error = %e, "Failed to add spectator in database");
        }
        drop(db);

        // Update cache
        self.update_room(&room).await?;

        let event = GameEvent::SpectatorJoined {
            room_id: room_id.to_string(),
            user_id,
            username: user.first_name.clone(),
        };

        // Send room state to spectator
        let room_state = Self::room_state_event(&room);

        self.publish_game_event(room_state, Audience::user(user_id)).await?;
        self.publish_game_event(event, Audience::room(room_id.to_string())).await?;

        info!(
            room_id = %room_id,
            user_id = %user_id,
            "Spectator joined game room"
        );

        Ok(())
    }

    /// Handle leave_spectate command
    async fn handle_leave_spectate(
        &self,
        user_id: i64,
        room_id: &str,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        let db = self.db.lock().await;

        // Get user info
        let user = user::get_by_id(&db, user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to get user: {}", e)))?;

        drop(db);

        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            return Ok(());
        };

        // Remove spectator from cache
        let was_spectator = room.spectators.contains(&user_id);
        room.spectators.retain(|&id| id != user_id);

        if was_spectator {
            // Remove spectator from database
            let db = self.db.lock().await;
            if let Err(e) = game_room_mutations::remove_spectator(&db, room_id, user_id).await {
                warn!(error = %e, "Failed to remove spectator from database");
            }
            drop(db);

            // Update cache
            self.update_room(&room).await?;

            let event = GameEvent::SpectatorLeft {
                room_id: room_id.to_string(),
                user_id,
                username: user.first_name.clone(),
            };

            self.publish_game_event(event, Audience::room(room_id.to_string())).await?;

            info!(
                room_id = %room_id,
                user_id = %user_id,
                "Spectator left game room"
            );
        }

        Ok(())
    }

    /// Handle select_player command - admin selects a player from lobby to play
    async fn handle_select_player(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Only admin can select players
        if !room.is_admin(user_id) {
            let error = GameEvent::Error {
                code: "not_admin".to_string(),
                message: "Only room admin can select players".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Check if game already in progress
        if room.status != RoomStatus::Waiting {
            let error = GameEvent::Error {
                code: "game_in_progress".to_string(),
                message: "Game is already in progress".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Select player for game in database (adds to selected_players, keeps in lobby)
        let db = self.db.lock().await;
        let success = game_room_mutations::select_player_for_game(&db, room_id, user_id, target_user_id)
            .await
            .map_err(|e| {
                warn!(error = %e, "Failed to select player for game in database");
                EventHandlerError::Retryable(format!("Database error: {}", e))
            })?;
        drop(db);

        if !success {
            let error = GameEvent::Error {
                code: "player_not_in_lobby".to_string(),
                message: "Player is not in the lobby or already selected".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Update cache: add to selected_players (keep in lobby)
        if !room.selected_players.contains(&target_user_id) {
            room.selected_players.push(target_user_id);
        }

        // Get player info for the event
        let player = room.lobby.iter().find(|p| p.user_id == target_user_id).cloned();

        let room_id_str = room_id.to_string();

        // Update cache
        self.update_room(&room).await?;

        // Notify room that player was selected
        if let Some(p) = player {
            let event = GameEvent::PlayerSelected {
                room_id: room_id_str.clone(),
                player: p,
            };
            self.publish_game_event(event, Audience::room(room_id_str.clone())).await?;
        }

        info!(
            room_id = %room_id_str,
            admin_id = %user_id,
            selected_player_id = %target_user_id,
            selected_count = room.selected_players.len(),
            player_count = room.player_count,
            "Admin selected player for game (persisted to database)"
        );

        // Check if we have enough players selected - auto-transition to ready phase
        if room.selected_players.len() as i32 == room.player_count {
            info!(
                room_id = %room_id_str,
                "All players selected, transitioning to ready phase"
            );

            // Get list of non-selected players to remove
            let non_selected: Vec<i64> = room.lobby.iter()
                .filter(|p| !room.selected_players.contains(&p.user_id))
                .map(|p| p.user_id)
                .collect();

            // Remove non-selected players from database
            let db = self.db.lock().await;
            let _ = game_room_mutations::remove_unselected_from_lobby(&db, room_id)
                .await
                .map_err(|e| warn!(error = %e, "Failed to remove unselected from lobby"));
            drop(db);

            // Update cache: keep only selected players in lobby
            room.lobby.retain(|p| room.selected_players.contains(&p.user_id));
            
            // Update room status to starting (ready phase)
            room.status = RoomStatus::InProgress;
            let db = self.db.lock().await;
            let _ = game_room_mutations::update_status(&db, room_id, "starting")
                .await
                .map_err(|e| warn!(error = %e, "Failed to update room status"));
            drop(db);

            self.update_room(&room).await?;

            // Notify non-selected players they've been removed
            for removed_user_id in &non_selected {
                let removed_event = GameEvent::RemovedFromGame {
                    room_id: room_id_str.clone(),
                    reason: "not_selected".to_string(),
                    message: "The game has started without you. You were not selected to play.".to_string(),
                };
                self.publish_game_event(removed_event, Audience::user(*removed_user_id)).await?;
            }

            // Notify selected players about game starting (ready phase)
            let starting_event = GameEvent::GameStarting {
                room_id: room_id_str.clone(),
                players: room.lobby.clone(),
            };
            
            // Send to all selected players
            for selected_id in &room.selected_players {
                self.publish_game_event(starting_event.clone(), Audience::user(*selected_id)).await?;
            }
            
            // Send to spectators too
            for spectator_id in &room.spectators {
                self.publish_game_event(starting_event.clone(), Audience::user(*spectator_id)).await?;
            }

            // Send updated room state to remaining players
            let room_state = Self::room_state_event(&room);
            for selected_id in &room.selected_players {
                self.publish_game_event(room_state.clone(), Audience::user(*selected_id)).await?;
            }
            for spectator_id in &room.spectators {
                self.publish_game_event(room_state.clone(), Audience::user(*spectator_id)).await?;
            }
        }

        Ok(())
    }

    /// Handle select_spectator command - admin selects a spectator to become a player
    async fn handle_select_spectator(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Only admin can select spectators
        if !room.is_admin(user_id) {
            let error = GameEvent::Error {
                code: "not_admin".to_string(),
                message: "Only room admin can select spectators".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Check if game already in progress
        if room.status != RoomStatus::Waiting {
            let error = GameEvent::Error {
                code: "game_in_progress".to_string(),
                message: "Game is already in progress".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Check if spectator exists
        let spectator = room.remove_spectator(target_user_id);
        if spectator.is_none() {
            let error = GameEvent::Error {
                code: "spectator_not_found".to_string(),
                message: "User is not a spectator in this room".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        let spectator = spectator.unwrap();

        // Convert spectator to player
        let player = GamePlayer {
            user_id: spectator.user_id,
            username: spectator.username.clone(),
            avatar_id: spectator.avatar_id,
            score: 0,
            is_ready: false,
            joined_at: spectator.joined_at,
        };

        // Add to players list
        room.players.push(player.clone());

        // Update database - remove from spectators and add to selected_players via select_player_for_game
        let db = self.db.lock().await;
        // First remove from spectators
        if let Err(e) = game_room_mutations::remove_spectator(&db, room_id, target_user_id).await {
            warn!(error = %e, "Failed to remove spectator from database");
        }
        // Then add to lobby and select them (select_player expects user in lobby first)
        if let Err(e) = game_room_mutations::add_to_lobby(&db, room_id, target_user_id).await {
            warn!(error = %e, "Failed to add to lobby in database");
        }
        // Now select the player
        if let Err(e) = game_room_mutations::select_player(&db, room_id, user_id, target_user_id).await {
            warn!(error = %e, "Failed to select player in database");
        }
        drop(db);

        let room_id_str = room_id.to_string();

        // Update cache
        self.update_room(&room).await?;

        // Notify room that spectator was promoted to player
        let event = GameEvent::PlayerSelected {
            room_id: room_id_str.clone(),
            player: player.clone(),
        };
        self.publish_game_event(event, Audience::room(room_id_str.clone())).await?;

        info!(
            room_id = %room_id_str,
            admin_id = %user_id,
            selected_spectator_id = %target_user_id,
            "Admin selected spectator to become player"
        );

        Ok(())
    }

    /// Handle kick_player command - admin kicks a player from lobby
    async fn handle_kick_player(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Only admin can kick players
        if !room.is_admin(user_id) {
            let error = GameEvent::Error {
                code: "not_admin".to_string(),
                message: "Only room admin can kick players".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Can't kick yourself
        if target_user_id == user_id {
            let error = GameEvent::Error {
                code: "cannot_kick_self".to_string(),
                message: "You cannot kick yourself".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Kick player in database using stored procedure
        let db = self.db.lock().await;
        let success = game_room_mutations::kick_player(&db, room_id, user_id, target_user_id)
            .await
            .map_err(|e| {
                warn!(error = %e, "Failed to kick player in database");
                EventHandlerError::Retryable(format!("Database error: {}", e))
            })?;
        drop(db);

        if !success {
            let error = GameEvent::Error {
                code: "player_not_in_lobby".to_string(),
                message: "Player is not in the lobby".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Update cache: remove from lobby
        let player = room.remove_from_lobby(target_user_id);
        let username = player.map(|p| p.username).unwrap_or_else(|| "Unknown".to_string());

        let room_id_str = room_id.to_string();

        // Update cache
        self.update_room(&room).await?;

        // Notify room that player was kicked
        let event = GameEvent::PlayerKicked {
            room_id: room_id_str.clone(),
            user_id: target_user_id,
            username: username.clone(),
        };

        self.publish_game_event(event, Audience::room(room_id_str.clone())).await?;

        info!(
            room_id = %room_id_str,
            admin_id = %user_id,
            kicked_user_id = %target_user_id,
            "Admin kicked player from lobby (persisted to database)"
        );

        Ok(())
    }

    /// Handle kick_spectator command - admin removes a spectator from room
    async fn handle_kick_spectator(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Only admin can kick spectators
        if !room.is_admin(user_id) {
            let error = GameEvent::Error {
                code: "not_admin".to_string(),
                message: "Only room admin can remove spectators".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Can't kick yourself
        if target_user_id == user_id {
            let error = GameEvent::Error {
                code: "cannot_kick_self".to_string(),
                message: "You cannot remove yourself".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Update cache first to check if spectator exists
        let spectator = room.remove_spectator(target_user_id);
        
        if spectator.is_none() {
            let error = GameEvent::Error {
                code: "spectator_not_found".to_string(),
                message: "User is not a spectator in this room".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Remove spectator from database
        let db = self.db.lock().await;
        if let Err(e) = game_room_mutations::remove_spectator(&db, room_id, target_user_id).await {
            warn!(error = %e, "Failed to remove spectator from database");
        }
        drop(db);
        let username = spectator.map(|s| s.username).unwrap_or_else(|| "Unknown".to_string());

        let room_id_str = room_id.to_string();

        // Update cache
        self.update_room(&room).await?;

        // Notify room that spectator was removed
        let event = GameEvent::SpectatorLeft {
            room_id: room_id_str.clone(),
            user_id: target_user_id,
            username: username.clone(),
        };

        self.publish_game_event(event, Audience::room(room_id_str.clone())).await?;

        // Notify the kicked spectator
        let kicked_event = GameEvent::Error {
            code: "kicked_from_room".to_string(),
            message: "You have been removed from this room by the admin".to_string(),
            socket_id: socket_id.to_string(),
        };
        self.publish_game_event(kicked_event, Audience::user(target_user_id)).await?;

        info!(
            room_id = %room_id_str,
            admin_id = %user_id,
            kicked_spectator_id = %target_user_id,
            "Admin removed spectator from room"
        );

        Ok(())
    }

    /// Handle ban_player command - admin bans a player from room
    async fn handle_ban_player(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Only admin can ban players
        if !room.is_admin(user_id) {
            let error = GameEvent::Error {
                code: "not_admin".to_string(),
                message: "Only room admin can ban players".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Can't ban yourself
        if target_user_id == user_id {
            let error = GameEvent::Error {
                code: "cannot_ban_self".to_string(),
                message: "You cannot ban yourself".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Ban player in database using stored procedure
        let db = self.db.lock().await;
        let _success = game_room_mutations::ban_player(&db, room_id, user_id, target_user_id)
            .await
            .map_err(|e| {
                warn!(error = %e, "Failed to ban player in database");
                EventHandlerError::Retryable(format!("Database error: {}", e))
            })?;
        drop(db);

        // Update cache: remove from lobby if present, add to banned list
        let player = room.remove_from_lobby(target_user_id);
        let username = player.map(|p| p.username).unwrap_or_else(|| "Unknown".to_string());
        room.ban_user(target_user_id, &username);

        let room_id_str = room_id.to_string();

        // Update cache
        self.update_room(&room).await?;

        // Create and publish banned event
        let event = GameEvent::PlayerBanned {
            room_id: room_id_str.clone(),
            user_id: target_user_id,
            username: username.clone(),
        };
        self.publish_game_event(event, Audience::room(room_id_str.clone())).await?;

        info!(
            room_id = %room_id_str,
            admin_id = %user_id,
            banned_user_id = %target_user_id,
            "Admin banned player from room (persisted to database)"
        );

        Ok(())
    }

    /// Handle unban_player command - admin unbans a player from room
    async fn handle_unban_player(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Only admin can unban players
        if !room.is_admin(user_id) {
            let error = GameEvent::Error {
                code: "not_admin".to_string(),
                message: "Only room admin can unban players".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Check if user is actually banned
        if !room.is_banned(target_user_id) {
            let error = GameEvent::Error {
                code: "not_banned".to_string(),
                message: "Player is not banned".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Unban player in database using stored procedure
        let db = self.db.lock().await;
        let success = game_room_mutations::unban_player(&db, room_id, user_id, target_user_id)
            .await
            .map_err(|e| {
                warn!(error = %e, "Failed to unban player in database");
                EventHandlerError::Retryable(format!("Database error: {}", e))
            })?;
        drop(db);

        if !success {
            let error = GameEvent::Error {
                code: "unban_failed".to_string(),
                message: "Failed to unban player".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Update cache: remove from banned list and get username
        let banned_player = room.unban_user(target_user_id);
        let username = banned_player
            .map(|p| p.username)
            .unwrap_or_else(|| "Unknown".to_string());

        let room_id_str = room_id.to_string();

        // Update cache
        self.update_room(&room).await?;

        // Notify room that player was unbanned
        let event = GameEvent::PlayerUnbanned {
            room_id: room_id_str.clone(),
            user_id: target_user_id,
            username: username.clone(),
        };
        self.publish_game_event(event, Audience::room(room_id_str.clone())).await?;

        info!(
            room_id = %room_id_str,
            admin_id = %user_id,
            unbanned_user_id = %target_user_id,
            "Admin unbanned player from room (persisted to database)"
        );

        Ok(())
    }

    /// Handle bigger_dice.roll command
    async fn handle_bigger_dice_roll(
        &self,
        user_id: i64,
        room_id: &str,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        self.perform_bigger_dice_roll(user_id, room_id, socket_id).await?;
        self.auto_roll_until_human_turn(room_id).await?;
        Ok(())
    }

    async fn auto_roll_until_human_turn(&self, room_id: &str) -> Result<(), EventHandlerError> {
        let mut roll_count = 0;
        loop {
            if roll_count >= 10 {
                warn!(room_id = %room_id, "Auto-roll loop guard triggered");
                break;
            }

            let room_opt = self.get_room(room_id).await?;
            let Some(room) = room_opt else {
                break;
            };

            if room.status != RoomStatus::InProgress {
                break;
            }

            let Some(current_turn) = room.current_turn else {
                break;
            };

            if !room.is_auto_player(current_turn) {
                break;
            }

            self.perform_bigger_dice_roll(current_turn, room_id, "auto").await?;
            roll_count += 1;
        }

        Ok(())
    }

    async fn perform_bigger_dice_roll(
        &self,
        user_id: i64,
        room_id: &str,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room from cache or database
        let room_opt = self.get_room(room_id).await?;

        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        if room.status != RoomStatus::InProgress {
            let error = GameEvent::Error {
                code: "game_not_in_progress".to_string(),
                message: "Game is not in progress".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        if room.current_turn != Some(user_id) {
            let error = GameEvent::Error {
                code: "not_your_turn".to_string(),
                message: "It's not your turn".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Get or create round state
        let mut round_states = self.round_states.lock().await;
        let round_state = round_states
            .entry(room_id.to_string())
            .or_insert_with(BiggerDiceRoundState::default);

        // Process the roll
        let (events, game_ended) = bigger_dice::process_roll(&mut room, round_state, user_id);

        let room_id_str = room_id.to_string();

        drop(round_states);

        // Publish events
        for event in events {
            self.publish_game_event(event, Audience::room(room_id_str.clone())).await?;
        }

        // If game ended, save to history and clean up
        if game_ended {
            // Save to MongoDB for history
            if let Some(mongodb) = &self.mongodb {
                let game_client = MongoGameClient::new(mongodb.clone());

                let history_players: Vec<GameHistoryPlayer> = room.players.iter().map(|p| {
                    GameHistoryPlayer {
                        user_id: p.user_id,
                        username: p.username.clone(),
                        final_score: p.score,
                        is_winner: Some(p.user_id) == room.winner_id,
                    }
                }).collect();

                if let Err(e) = game_client.save_game(
                    room_id,
                    &room.room_name,
                    room.game_type.clone(),
                    history_players,
                    room.winner_id,
                    Vec::new(), // TODO: collect turns during game
                    room.started_at.unwrap_or_else(Utc::now),
                ).await {
                    error!(error = %e, "Failed to save game history to MongoDB");
                }
            }

            // Update PostgreSQL: mark as finished then delete
            let db = self.db.lock().await;
            if let Err(e) = game_room_mutations::end_game(&db, room_id, room.winner_id).await {
                warn!(error = %e, "Failed to end game in database");
            }
            // Delete from active rooms table (game is archived in MongoDB)
            if let Err(e) = game_room_mutations::delete(&db, room_id).await {
                warn!(error = %e, "Failed to delete finished game from database");
            }
            if let Err(e) = disconnect_mutations::delete_for_room(&db, room_id).await {
                warn!(error = %e, "Failed to clear disconnect records for room");
            }
            drop(db);

            // Clean up cache
            {
                let mut round_states = self.round_states.lock().await;
                round_states.remove(&room_id_str);
            }
            self.remove_room_from_cache(&room_id_str).await;
            self.clear_disconnect_votes_room(&room_id_str).await;

            info!(
                room_id = %room_id_str,
                winner_id = ?room.winner_id,
                "Game ended and saved to history"
            );
        } else {
            // Update cache with new game state
            self.update_room(&room).await?;

            // Update turn in database
            let db = self.db.lock().await;
            if let Some(current_turn) = room.current_turn {
                if let Err(e) = game_room_mutations::update_turn(&db, room_id, current_turn, room.turn_number).await {
                    warn!(error = %e, "Failed to update turn in database");
                }
            }
            drop(db);
        }

        Ok(())
    }

    /// Handle list_rooms command - return list of available rooms for a game type
    async fn handle_list_rooms(
        &self,
        user_id: i64,
        game_type: &str,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        info!(
            user_id = %user_id,
            game_type = %game_type,
            "Listing rooms"
        );

        // Get active rooms from database (waiting + in-progress)
        let db = self.db.lock().await;
        let records = game_room_read::get_active_rooms(&db, game_type)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Database error: {}", e)))?;
        drop(db);

        // Convert to room list format expected by frontend
        let rooms: Vec<serde_json::Value> = records
            .iter()
            .filter_map(|record| Self::room_list_item_for_user(record, user_id))
            .collect();

        // Publish room list event to the requesting user
        let event = GameEvent::RoomList {
            rooms: rooms.clone(),
            socket_id: socket_id.to_string(),
        };
        self.publish_game_event(event, Audience::user(user_id)).await?;

        info!(
            user_id = %user_id,
            room_count = %rooms.len(),
            "Room list sent"
        );

        Ok(())
    }

    // ========== Enhanced Game Room Handlers ==========

    /// Get the MongoDB chat client
    fn get_chat_client(&self) -> Option<MongoGameChatClient> {
        self.mongodb.as_ref().map(|db| MongoGameChatClient::new(Arc::clone(db)))
    }

    /// Handle send_chat command - Send a chat message to a channel
    async fn handle_send_chat(
        &self,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        room_id: &str,
        channel_str: &str,
        content: &str,
        _socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Parse channel
        let channel: ChatChannel = channel_str.parse().map_err(|e: String| {
            EventHandlerError::Fatal(format!("Invalid channel: {}", e))
        })?;

        // Get room to validate permissions
        let room = self.get_room(room_id).await?
            .ok_or_else(|| EventHandlerError::Fatal("Room not found".to_string()))?;

        // Check if user can chat in this channel
        let types_channel = match channel {
            ChatChannel::Lobby => crate::app::games::types::ChatChannel::Lobby,
            ChatChannel::Players => crate::app::games::types::ChatChannel::Players,
            ChatChannel::Spectators => crate::app::games::types::ChatChannel::Spectators,
        };
        if !room.can_chat_in_channel(user_id, &types_channel) {
            return Err(EventHandlerError::Fatal("Cannot chat in this channel".to_string()));
        }

        // Save message to MongoDB
        if let Some(chat_client) = self.get_chat_client() {
            let _ = chat_client.save_message(
                room_id,
                channel.clone(),
                user_id,
                username,
                avatar_id,
                content,
                false, // not system
                false, // not moderated (TODO: add profanity filter)
            ).await;
        }

        // Determine audience based on channel
        let audience = match channel {
            ChatChannel::Lobby => Audience::room(room_id),
            ChatChannel::Players => Audience::players(room_id),
            ChatChannel::Spectators => Audience::spectators(room_id),
        };

        // Publish chat message event
        let event = GameEvent::ChatMessage {
            room_id: room_id.to_string(),
            channel: channel_str.to_string(),
            user_id,
            username: username.to_string(),
            avatar_id,
            content: content.to_string(),
            is_system: false,
            timestamp: Utc::now().to_rfc3339(),
        };

        self.publish_game_event(event, audience).await?;

        Ok(())
    }

    /// Handle mute_user command - Mute a user in your local chat view
    async fn handle_mute_user(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Save mute to database
        let db = self.db.lock().await;
        mute_mutations::mute_user(&db, user_id, target_user_id, Some(room_id))
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to mute user: {}", e)))?;
        drop(db);

        // Get target username for the event
        let db = self.db.lock().await;
        let target_username = user::get_by_id(&db, target_user_id)
            .await
            .ok()
            .map(|u| format!("{} {}", u.first_name, u.last_name))
            .unwrap_or_else(|| format!("User #{}", target_user_id));
        drop(db);

        // Send confirmation event to the user who muted
        let event = GameEvent::UserMuted {
            room_id: room_id.to_string(),
            target_user_id,
            target_username,
            socket_id: socket_id.to_string(),
        };

        self.publish_game_event(event, Audience::user(user_id)).await?;

        Ok(())
    }

    /// Handle unmute_user command - Unmute a previously muted user
    async fn handle_unmute_user(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Remove mute from database
        let db = self.db.lock().await;
        mute_mutations::unmute_user(&db, user_id, target_user_id, Some(room_id))
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to unmute user: {}", e)))?;
        drop(db);

        // Get target username for the event
        let db = self.db.lock().await;
        let target_username = user::get_by_id(&db, target_user_id)
            .await
            .ok()
            .map(|u| format!("{} {}", u.first_name, u.last_name))
            .unwrap_or_else(|| format!("User #{}", target_user_id));
        drop(db);

        // Send confirmation event to the user who unmuted
        let event = GameEvent::UserUnmuted {
            room_id: room_id.to_string(),
            target_user_id,
            target_username,
            socket_id: socket_id.to_string(),
        };

        self.publish_game_event(event, Audience::user(user_id)).await?;

        Ok(())
    }

    /// Handle deselect_player command - Admin deselects a player
    async fn handle_deselect_player(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        _socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room and verify admin
        let mut room = self.get_room(room_id).await?
            .ok_or_else(|| EventHandlerError::Fatal("Room not found".to_string()))?;

        if !room.is_admin(user_id) {
            return Err(EventHandlerError::Fatal("Only admin can deselect players".to_string()));
        }

        // Deselect the player
        if !room.deselect_player(target_user_id) {
            return Err(EventHandlerError::Fatal("Player not in selected list".to_string()));
        }

        // Update in database
        let db = self.db.lock().await;
        game_room_mutations::deselect_player(&db, room_id, user_id, target_user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to deselect player: {}", e)))?;
        drop(db);

        // Update cache
        {
            let mut rooms = self.rooms.lock().await;
            rooms.insert(room_id.to_string(), room.clone());
        }

        // Get target username
        let target_username = room.lobby.iter()
            .find(|p| p.user_id == target_user_id)
            .map(|p| p.username.clone())
            .unwrap_or_else(|| format!("User #{}", target_user_id));

        // Publish deselected event to room
        let event = GameEvent::PlayerDeselected {
            room_id: room_id.to_string(),
            user_id: target_user_id,
            username: target_username,
        };
        self.publish_game_event(event, Audience::room(room_id)).await?;

        // Publish updated selected players list
        let selected_event = GameEvent::SelectedPlayersUpdated {
            room_id: room_id.to_string(),
            selected_players: room.selected_players.clone(),
        };
        self.publish_game_event(selected_event, Audience::room(room_id)).await?;

        Ok(())
    }

    /// Handle designate_admin_spectator command - Host designates an admin spectator
    async fn handle_designate_admin_spectator(
        &self,
        user_id: i64,
        room_id: &str,
        target_user_id: i64,
        _socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room and verify host
        let mut room = self.get_room(room_id).await?
            .ok_or_else(|| EventHandlerError::Fatal("Room not found".to_string()))?;

        if room.host_id != user_id {
            return Err(EventHandlerError::Fatal("Only host can designate admin spectator".to_string()));
        }

        // Target must be a spectator
        if !room.is_spectator(target_user_id) {
            return Err(EventHandlerError::Fatal("Target must be a spectator".to_string()));
        }

        // Designate admin spectator
        room.admin_spectator_id = Some(target_user_id);

        // Update in database
        let db = self.db.lock().await;
        game_room_mutations::designate_admin_spectator(&db, room_id, user_id, target_user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to designate admin spectator: {}", e)))?;
        drop(db);

        // Update cache
        {
            let mut rooms = self.rooms.lock().await;
            rooms.insert(room_id.to_string(), room.clone());
        }

        // Get target username
        let target_username = room.spectators_data.iter()
            .find(|s| s.user_id == target_user_id)
            .map(|s| s.username.clone())
            .unwrap_or_else(|| format!("User #{}", target_user_id));

        // Publish event to room
        let event = GameEvent::AdminSpectatorDesignated {
            room_id: room_id.to_string(),
            user_id: target_user_id,
            username: target_username,
        };
        self.publish_game_event(event, Audience::room(room_id)).await?;

        Ok(())
    }

    /// Handle join_as_spectator command - Join room as a spectator
    async fn handle_join_as_spectator(
        &self,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        room_name: &str,
        socket_id: &str,
        password: Option<&str>,
    ) -> Result<(), EventHandlerError> {
        // Find room by name
        let db = self.db.lock().await;
        let record = game_room_read::get_by_room_name(&db, room_name)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Database error: {}", e)))?
            .ok_or_else(|| EventHandlerError::Fatal("Room not found".to_string()))?;
        drop(db);

        let room_id = &record.room_id;

        // Check if room allows spectators
        if !record.allow_spectators {
            let error_event = GameEvent::Error {
                code: "spectators_not_allowed".to_string(),
                message: "This room does not allow spectators".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error_event, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Check password if protected
        if record.is_password_protected {
            let provided_password = password.unwrap_or("");
            if let Some(hash) = &record.password_hash {
                if !bcrypt::verify(provided_password, hash).unwrap_or(false) {
                    let error_event = GameEvent::Error {
                        code: "wrong_password".to_string(),
                        message: "Incorrect room password".to_string(),
                        socket_id: socket_id.to_string(),
                    };
                    self.publish_game_event(error_event, Audience::user(user_id)).await?;
                    return Ok(());
                }
            }
        }

        // Check if user is banned
        if record.banned_users.contains(&user_id) {
            let error_event = GameEvent::UserBanned {
                room_id: room_id.to_string(),
                room_name: room_name.to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error_event, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Check spectator capacity
        let db = self.db.lock().await;
        let can_join = game_room_read::can_join_as_spectator(&db, room_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Database error: {}", e)))?;
        drop(db);

        if !can_join {
            let error_event = GameEvent::Error {
                code: "spectator_capacity_full".to_string(),
                message: "Spectator capacity is full".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error_event, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Add spectator to database
        let db = self.db.lock().await;
        game_room_mutations::add_spectator_with_data(&db, room_id, user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to add spectator: {}", e)))?;
        drop(db);

        // Update cache
        let mut room = self.get_room(room_id).await?
            .ok_or_else(|| EventHandlerError::Fatal("Room not found after adding spectator".to_string()))?;
        room.add_spectator(user_id, username, avatar_id);
        {
            let mut rooms = self.rooms.lock().await;
            rooms.insert(room_id.to_string(), room.clone());
        }

        // Create spectator object for event
        let spectator = GameSpectator {
            user_id,
            username: username.to_string(),
            avatar_id,
            joined_at: Utc::now(),
        };

        // Publish spectator joined event
        let event = GameEvent::SpectatorDataJoined {
            room_id: room_id.to_string(),
            spectator: spectator.clone(),
        };
        self.publish_game_event(event, Audience::room(room_id)).await?;

        // Send room state to the new spectator
        let state_event = Self::room_state_event(&room);
        self.publish_game_event(state_event, Audience::user(user_id)).await?;

        info!(
            room_id = %room_id,
            user_id = %user_id,
            username = %username,
            "Spectator joined room"
        );

        Ok(())
    }

    /// Handle become_spectator command - Admin/player moves themselves from lobby to spectators
    async fn handle_become_spectator(
        &self,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        room_id: &str,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room
        let room_opt = self.get_room(room_id).await?;
        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Check if spectators are allowed
        if !room.allow_spectators {
            let error = GameEvent::Error {
                code: "spectators_not_allowed".to_string(),
                message: "This room does not allow spectators".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Check if user is in lobby
        if !room.is_in_lobby(user_id) {
            let error = GameEvent::Error {
                code: "not_in_lobby".to_string(),
                message: "You must be in the lobby to become a spectator".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Remove from lobby (host can kick themselves) and add to spectators in database
        let db = self.db.lock().await;
        // Use kick_player since there's no remove_from_lobby - host removing themselves
        let _ = game_room_mutations::kick_player(&db, room_id, user_id, user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to remove from lobby: {}", e)))?;
        game_room_mutations::add_spectator_with_data(&db, room_id, user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to add spectator: {}", e)))?;
        drop(db);

        // Update cache
        room.lobby.retain(|p| p.user_id != user_id);
        room.add_spectator(user_id, username, avatar_id);
        self.update_room(&room).await?;

        // Create spectator object for event
        let spectator = GameSpectator {
            user_id,
            username: username.to_string(),
            avatar_id,
            joined_at: Utc::now(),
        };

        // Notify room about the change
        let left_event = GameEvent::PlayerLeft {
            room_id: room_id.to_string(),
            user_id,
            username: username.to_string(),
        };
        self.publish_game_event(left_event, Audience::room(room_id)).await?;

        let joined_event = GameEvent::SpectatorDataJoined {
            room_id: room_id.to_string(),
            spectator,
        };
        self.publish_game_event(joined_event, Audience::room(room_id)).await?;

        // Send updated room state to the user
        let state_event = Self::room_state_event(&room);
        self.publish_game_event(state_event, Audience::user(user_id)).await?;

        info!(
            room_id = %room_id,
            user_id = %user_id,
            "User moved from lobby to spectators"
        );

        Ok(())
    }

    /// Handle become_player command - Admin/spectator moves themselves from spectators to lobby
    async fn handle_become_player(
        &self,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        room_id: &str,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room
        let room_opt = self.get_room(room_id).await?;
        let Some(mut room) = room_opt else {
            let error = GameEvent::Error {
                code: "room_not_found".to_string(),
                message: "Room not found".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        };

        // Check if user is a spectator
        if !room.is_spectator(user_id) {
            let error = GameEvent::Error {
                code: "not_a_spectator".to_string(),
                message: "You must be a spectator to join as a player".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_game_event(error, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Remove from spectators and add to lobby in database
        let db = self.db.lock().await;
        game_room_mutations::remove_spectator(&db, room_id, user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to remove spectator: {}", e)))?;
        game_room_mutations::add_to_lobby(&db, room_id, user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to add to lobby: {}", e)))?;
        drop(db);

        // Update cache
        room.remove_spectator(user_id);
        room.lobby.push(GamePlayer {
            user_id,
            username: username.to_string(),
            avatar_id,
            score: 0,
            is_ready: false,
            joined_at: Utc::now(),
        });
        self.update_room(&room).await?;

        // Create player object for event
        let player = GamePlayer {
            user_id,
            username: username.to_string(),
            avatar_id,
            score: 0,
            is_ready: false,
            joined_at: Utc::now(),
        };

        // Notify room about the change
        let left_event = GameEvent::SpectatorLeft {
            room_id: room_id.to_string(),
            user_id,
            username: username.to_string(),
        };
        self.publish_game_event(left_event, Audience::room(room_id)).await?;

        let joined_event = GameEvent::LobbyJoined {
            room_id: room_id.to_string(),
            room_name: room.room_name.clone(),
            player: player.clone(),
        };
        self.publish_game_event(joined_event, Audience::room(room_id)).await?;

        // Send updated room state to the user
        let state_event = Self::room_state_event(&room);
        self.publish_game_event(state_event, Audience::user(user_id)).await?;

        info!(
            room_id = %room_id,
            user_id = %user_id,
            "User moved from spectators to lobby"
        );

        Ok(())
    }

    /// Handle set_ready command - Player sets ready status
    async fn handle_set_ready(
        &self,
        user_id: i64,
        room_id: &str,
        is_ready: bool,
        _socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room
        let mut room = self.get_room(room_id).await?
            .ok_or_else(|| EventHandlerError::Fatal("Room not found".to_string()))?;

        // User must be in lobby and selected
        if !room.is_in_lobby(user_id) {
            return Err(EventHandlerError::Fatal("User not in lobby".to_string()));
        }

        if !room.is_selected_player(user_id) {
            return Err(EventHandlerError::Fatal("User not selected".to_string()));
        }

        // Update ready status in lobby
        if let Some(player) = room.lobby.iter_mut().find(|p| p.user_id == user_id) {
            player.is_ready = is_ready;
        }

        // Update in database (update the lobby JSONB)
        let lobby_json = serde_json::to_value(&room.lobby).unwrap_or_default();
        let db = self.db.lock().await;
        game_room_mutations::update_lobby(&db, room_id, &lobby_json)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to update ready status: {}", e)))?;
        drop(db);

        // Update cache
        {
            let mut rooms = self.rooms.lock().await;
            rooms.insert(room_id.to_string(), room.clone());
        }

        // Get username
        let username = room.lobby.iter()
            .find(|p| p.user_id == user_id)
            .map(|p| p.username.clone())
            .unwrap_or_else(|| format!("User #{}", user_id));

        // Publish ready changed event
        let event = GameEvent::PlayerReadyChanged {
            room_id: room_id.to_string(),
            user_id,
            username,
            is_ready,
        };
        self.publish_game_event(event, Audience::room(room_id)).await?;

        // Check if all selected players are ready - auto-start the game
        // Only check if we have enough selected players
        if room.selected_players.len() == room.player_count as usize && room.all_selected_ready() {
            info!(
                room_id = %room_id,
                "All selected players ready - auto-starting game"
            );
            
            // Auto-start the game
            let mut room = room;
            room.move_selected_to_players();
            room.status = RoomStatus::InProgress;

            // Set first turn to player 1
            let first_turn = room.players.first().map(|p| p.user_id).unwrap_or(0);

            // Update database
            let db = self.db.lock().await;
            if let Err(e) = game_room_mutations::start_game(&db, room_id, first_turn).await {
                warn!(error = %e, "Failed to start game in database");
            }
            drop(db);

            // Update cache
            self.update_room(&room).await?;

            // Publish game started event
            let started_event = GameEvent::GameStarted {
                room_id: room_id.to_string(),
                players: room.players.clone(),
                first_turn,
            };
            self.publish_game_event(started_event, Audience::room(room_id)).await?;
        }

        Ok(())
    }

    /// Handle start_game command - Host starts the game when all selected players are ready
    async fn handle_start_game(
        &self,
        user_id: i64,
        room_id: &str,
        _socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Get room and verify host
        let mut room = self.get_room(room_id).await?
            .ok_or_else(|| EventHandlerError::Fatal("Room not found".to_string()))?;

        if room.host_id != user_id {
            return Err(EventHandlerError::Fatal("Only host can start the game".to_string()));
        }

        if room.status != RoomStatus::Waiting {
            return Err(EventHandlerError::Fatal("Game is not in waiting state".to_string()));
        }

        // Check if we have enough selected players
        if room.selected_players.len() != room.player_count as usize {
            return Err(EventHandlerError::Fatal(format!(
                "Need {} selected players, have {}",
                room.player_count,
                room.selected_players.len()
            )));
        }

        // Check if all selected players are ready
        if !room.all_selected_ready() {
            return Err(EventHandlerError::Fatal("Not all selected players are ready".to_string()));
        }

        // Move selected players from lobby to players
        room.move_selected_to_players();
        room.status = RoomStatus::InProgress;
        room.started_at = Some(Utc::now());
        room.disable_lobby_chat();

        // Record membership for rejoin support
        room.record_membership();

        // Set first turn
        if let Some(first_player) = room.players.first() {
            room.current_turn = Some(first_player.user_id);
        }
        room.turn_number = 1;

        // Update database
        let players_json = serde_json::to_value(&room.players).unwrap_or_default();
        let lobby_json = serde_json::to_value(&room.lobby).unwrap_or_default();
        let db = self.db.lock().await;
        game_room_mutations::record_game_membership(&db, room_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to record membership: {}", e)))?;
        game_room_mutations::disable_lobby_chat(&db, room_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to disable lobby chat: {}", e)))?;
        game_room_mutations::move_selected_to_players(&db, room_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to move selected to players: {}", e)))?;

        game_room_mutations::start_game_with_state(
            &db,
            room_id,
            room.current_turn,
            &players_json,
            &lobby_json,
        )
        .await
        .map_err(|e| EventHandlerError::Retryable(format!("Failed to start game: {}", e)))?;
        drop(db);

        // Update cache
        {
            let mut rooms = self.rooms.lock().await;
            rooms.insert(room_id.to_string(), room.clone());
        }

        // Publish game started event
        let event = GameEvent::GameStarted {
            room_id: room_id.to_string(),
            players: room.players.clone(),
            first_turn: room.current_turn.unwrap_or(0),
        };
        self.publish_game_event(event, Audience::room(room_id)).await?;

        info!(
            room_id = %room_id,
            player_count = %room.players.len(),
            "Game started"
        );

        Ok(())
    }

    /// Handle get_chat_history command - Get chat history for a channel
    async fn handle_get_chat_history(
        &self,
        user_id: i64,
        room_id: &str,
        channel_str: &str,
        limit: Option<i64>,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Parse channel
        let channel: ChatChannel = channel_str.parse().map_err(|e: String| {
            EventHandlerError::Fatal(format!("Invalid channel: {}", e))
        })?;

        // Get chat history from MongoDB
        let messages: Vec<serde_json::Value> = if let Some(chat_client) = self.get_chat_client() {
            let limit = limit.unwrap_or(50);
            chat_client.get_messages(room_id, channel, limit, None)
                .await
                .map_err(|e| EventHandlerError::Retryable(format!("Failed to get chat history: {}", e)))?
                .into_iter()
                .map(|m| serde_json::json!({
                    "user_id": m.user_id,
                    "username": m.username,
                    "avatar_id": m.avatar_id,
                    "content": m.content,
                    "is_system": m.is_system,
                    "timestamp": m.created_at.to_rfc3339()
                }))
                .collect()
        } else {
            vec![]
        };

        // Send chat history to user
        let event = GameEvent::ChatHistory {
            room_id: room_id.to_string(),
            channel: channel_str.to_string(),
            messages,
            socket_id: socket_id.to_string(),
        };
        self.publish_game_event(event, Audience::user(user_id)).await?;

        Ok(())
    }
}

#[async_trait]
impl EventHandler for GameCommandHandler {
    fn name(&self) -> &'static str {
        "game_command_handler"
    }

    fn topics(&self) -> Vec<&'static str> {
        vec![topic::GAMES_COMMANDS]
    }

    async fn handle(&self, event: &crate::events::types::DomainEvent) -> Result<(), EventHandlerError> {
        let envelope: EventEnvelope = serde_json::from_value(event.payload.clone())
            .map_err(|e| EventHandlerError::Fatal(format!("Invalid game command envelope: {}", e)))?;

        // Command type can come from:
        // 1. envelope.event_type (gateway format): "games.command.create_room" -> extract "create_room"
        // 2. envelope.payload.type (legacy format): "create_room"
        let command_type = if envelope.event_type.starts_with("games.command.") {
            // Gateway format: strip the prefix
            envelope.event_type.strip_prefix("games.command.").unwrap_or(&envelope.event_type)
        } else {
            // Try nested payload.type as fallback
            envelope.payload.get("type")
                .and_then(|v| v.as_str())
                .unwrap_or(&envelope.event_type)
        };

        info!(
            event_type = %envelope.event_type,
            command_type = %command_type,
            "Processing game command"
        );

        // Extract actor info (user_id, username, socket_id come from envelope.actor)
        let user_id = envelope.actor.user_id;
        let username = &envelope.actor.username;
        let socket_id = &envelope.actor.socket_id;

        match command_type {
            "create_room" => {
                let avatar_id = Self::parse_optional_i64(envelope.payload.get("avatar_id"));
                let game_type = envelope.payload.get("game_type").and_then(|v| v.as_str()).unwrap_or("bigger_dice");
                let room_name = envelope.payload.get("room_name").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_name".to_string()))?;
                let password = envelope.payload.get("password").and_then(|v| v.as_str());
                let player_count = envelope.payload.get("player_count").and_then(|v| v.as_i64()).map(|v| v as i32);
                let allow_spectators = envelope.payload.get("allow_spectators").and_then(|v| v.as_bool());

                self.handle_create_room(
                    user_id,
                    username,
                    avatar_id,
                    game_type,
                    room_name,
                    socket_id,
                    password,
                    player_count,
                    allow_spectators,
                ).await
            }
            "join_room" => {
                let avatar_id = Self::parse_optional_i64(envelope.payload.get("avatar_id"));
                let room_name = envelope.payload.get("room_name").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_name".to_string()))?;
                let password = envelope.payload.get("password").and_then(|v| v.as_str());

                self.handle_join_room(user_id, username, avatar_id, room_name, socket_id, password).await
            }
            "leave_room" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;

                self.handle_leave_room(user_id, room_id, socket_id).await
            }
            "player_disconnected" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;

                self.handle_player_disconnected(user_id, room_id).await
            }
            "vote_kick_disconnected" | "kick_disconnected" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_vote_kick_disconnected(user_id, room_id, target_user_id, socket_id).await
            }
            "rejoin_room" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str());
                let room_name = envelope.payload.get("room_name").and_then(|v| v.as_str());

                if room_id.is_none() && room_name.is_none() {
                    return Err(EventHandlerError::Fatal("Missing room_id or room_name".to_string()));
                }

                self.handle_rejoin_room(user_id, room_id, room_name, socket_id).await
            }
            "ready" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;

                self.handle_ready(user_id, room_id, socket_id).await
            }
            "spectate" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;

                self.handle_spectate(user_id, room_id, socket_id).await
            }
            "leave_spectate" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;

                self.handle_leave_spectate(user_id, room_id, socket_id).await
            }
            "select_player" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_select_player(user_id, room_id, target_user_id, socket_id).await
            }
            "select_spectator" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_select_spectator(user_id, room_id, target_user_id, socket_id).await
            }
            "kick_player" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_kick_player(user_id, room_id, target_user_id, socket_id).await
            }
            "kick_spectator" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_kick_spectator(user_id, room_id, target_user_id, socket_id).await
            }
            "ban_player" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_ban_player(user_id, room_id, target_user_id, socket_id).await
            }
            "unban_player" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_unban_player(user_id, room_id, target_user_id, socket_id).await
            }
            "bigger_dice.roll" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;

                self.handle_bigger_dice_roll(user_id, room_id, socket_id).await
            }
            "list_rooms" => {
                let game_type = envelope.payload.get("game_type").and_then(|v| v.as_str()).unwrap_or("bigger_dice");
                self.handle_list_rooms(user_id, game_type, socket_id).await
            }
            "send_chat" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let channel = envelope.payload.get("channel").and_then(|v| v.as_str()).unwrap_or("lobby");
                let content = envelope.payload.get("content").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing content".to_string()))?;
                let avatar_id = Self::parse_optional_i64(envelope.payload.get("avatar_id"));

                self.handle_send_chat(user_id, username, avatar_id, room_id, channel, content, socket_id).await
            }
            "mute_user" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_mute_user(user_id, room_id, target_user_id, socket_id).await
            }
            "unmute_user" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_unmute_user(user_id, room_id, target_user_id, socket_id).await
            }
            "deselect_player" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_deselect_player(user_id, room_id, target_user_id, socket_id).await
            }
            "designate_admin_spectator" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let target_user_id = Self::parse_user_id(envelope.payload.get("target_user_id"))
                    .ok_or_else(|| EventHandlerError::Fatal("Missing target_user_id".to_string()))?;

                self.handle_designate_admin_spectator(user_id, room_id, target_user_id, socket_id).await
            }
            "join_as_spectator" => {
                let room_name = envelope.payload.get("room_name").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_name".to_string()))?;
                let avatar_id = Self::parse_optional_i64(envelope.payload.get("avatar_id"));
                let password = envelope.payload.get("password").and_then(|v| v.as_str());

                self.handle_join_as_spectator(user_id, username, avatar_id, room_name, socket_id, password).await
            }
            "become_spectator" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let avatar_id = Self::parse_optional_i64(envelope.payload.get("avatar_id"));

                self.handle_become_spectator(user_id, username, avatar_id, room_id, socket_id).await
            }
            "become_player" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let avatar_id = Self::parse_optional_i64(envelope.payload.get("avatar_id"));

                self.handle_become_player(user_id, username, avatar_id, room_id, socket_id).await
            }
            "set_ready" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let ready = envelope.payload.get("ready").and_then(|v| v.as_bool()).unwrap_or(true);

                self.handle_set_ready(user_id, room_id, ready, socket_id).await
            }
            "start_game" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;

                self.handle_start_game(user_id, room_id, socket_id).await
            }
            "get_chat_history" => {
                let room_id = envelope.payload.get("room_id").and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
                let channel = envelope.payload.get("channel").and_then(|v| v.as_str()).unwrap_or("lobby");
                let limit = envelope.payload.get("limit").and_then(|v| v.as_i64());

                self.handle_get_chat_history(user_id, room_id, channel, limit, socket_id).await
            }
            other => {
                warn!(command_type = %other, "Unknown game command type");
                Err(EventHandlerError::Skip)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn player(user_id: i64, username: &str) -> GamePlayer {
        GamePlayer {
            user_id,
            username: username.to_string(),
            avatar_id: None,
            score: 0,
            is_ready: false,
            joined_at: Utc::now(),
        }
    }

    fn base_record(status: &str) -> game_room_read::GameRoomRecord {
        game_room_read::GameRoomRecord {
            id: 1,
            room_id: "room-1".to_string(),
            room_name: "Room 1".to_string(),
            game_type: "bigger_dice".to_string(),
            status: status.to_string(),
            host_id: 10,
            players: json!([]),
            lobby: json!([]),
            banned_users: vec![],
            spectators: vec![],
            current_turn: None,
            turn_number: 0,
            winner_id: None,
            is_password_protected: false,
            password_hash: None,
            is_active: true,
            created_at: Utc::now(),
            started_at: None,
            finished_at: None,
            updated_at: Utc::now(),
            player_count: 2,
            allow_spectators: true,
            max_spectators: 10,
            admin_spectator_id: None,
            lobby_chat_enabled: true,
            spectators_data: json!([]),
            recorded_players: vec![],
            recorded_spectators: vec![],
            selected_players: vec![],
        }
    }

    #[test]
    fn room_list_includes_waiting_rooms() {
        let record = base_record("waiting");
        let item = GameCommandHandler::room_list_item_for_user(&record, 42);

        let item = item.expect("waiting rooms should be listed");
        assert_eq!(item.get("can_rejoin").and_then(|v| v.as_bool()), Some(false));
    }

    #[test]
    fn room_list_marks_waiting_room_rejoin_for_lobby_user() {
        let mut record = base_record("waiting");
        record.lobby = json!([{
            "user_id": 42,
            "username": "Player",
            "avatar_id": null,
            "score": 0,
            "is_ready": false,
            "joined_at": "2026-01-13T00:00:00Z"
        }]);

        let item = GameCommandHandler::room_list_item_for_user(&record, 42)
            .expect("waiting rooms with membership should be listed");

        assert_eq!(item.get("can_rejoin").and_then(|v| v.as_bool()), Some(true));
        assert_eq!(item.get("rejoin_role").and_then(|v| v.as_str()), Some("lobby"));
    }

    #[test]
    fn room_list_includes_rejoinable_in_progress_room() {
        let mut record = base_record("in_progress");
        record.players = json!([{
            "user_id": 42,
            "username": "Player",
            "avatar_id": null,
            "score": 0,
            "is_ready": false,
            "joined_at": "2026-01-13T00:00:00Z"
        }]);

        let item = GameCommandHandler::room_list_item_for_user(&record, 42)
            .expect("rejoinable in-progress rooms should be listed");

        assert_eq!(item.get("can_rejoin").and_then(|v| v.as_bool()), Some(true));
    }

    #[test]
    fn room_list_excludes_banned_user() {
        let mut record = base_record("in_progress");
        record.recorded_players = vec![42];
        record.banned_users = vec![42];

        let item = GameCommandHandler::room_list_item_for_user(&record, 42);

        assert!(item.is_none());
    }

    #[test]
    fn room_list_skips_in_progress_room_without_membership() {
        let record = base_record("in_progress");
        let item = GameCommandHandler::room_list_item_for_user(&record, 42);

        assert!(item.is_none());
    }

    #[test]
    fn active_kick_voter_ids_excludes_disconnected_and_auto() {
        let mut room = GameRoom::new("room-1", "Room 1", GameType::BiggerDice, 1);
        room.players = vec![player(1, "Host"), player(2, "P2"), player(3, "P3")];
        room.enable_auto_player(3);

        let pending_disconnects: HashSet<i64> = vec![2].into_iter().collect();
        let voters = GameCommandHandler::active_kick_voter_ids(&room, &pending_disconnects, 2);

        assert_eq!(voters, vec![1]);
    }
}
