//! Redis client for session and presence management
//!
//! Handles all ephemeral state storage in Redis.

use redis::{aio::ConnectionManager, AsyncCommands, Client};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use chrono::{DateTime, Utc};
use tracing::{debug, error, info};

use crate::error::{GatewayError, GatewayResult};

/// Redis key prefixes
pub mod keys {
    pub const SOCKET: &str = "socket:";
    pub const USER_SOCKETS: &str = "user:sockets:";
    pub const USER_PRESENCE: &str = "user:presence:";
    pub const PRESENCE_ONLINE: &str = "presence:online";
    pub const ROOM_INFO: &str = "room:info:";
    pub const ROOM_USERS: &str = "room:users:";
    pub const ROOM_SOCKETS: &str = "room:sockets:";
    pub const GAME_STATE: &str = "game:state:";
    pub const GAME_PLAYERS: &str = "game:players:";
    pub const GAME_SPECTATORS: &str = "game:spectators:";
    pub const GAME_TURN: &str = "game:turn:";
    pub const RECONNECT: &str = "reconnect:";
}

/// TTL values in seconds
pub mod ttl {
    pub const SOCKET: u64 = 86400;           // 24 hours
    pub const PRESENCE: u64 = 120;            // 2 minutes (refreshed by heartbeat)
    pub const ROOM_INFO: u64 = 86400;         // 24 hours
    pub const GAME_STATE: u64 = 86400;        // 24 hours
    pub const RECONNECT: u64 = 300;           // 5 minutes
}

/// Socket session data
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SocketSession {
    pub user_id: String,
    pub username: String,
    pub connected_at: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub roles: Vec<String>,
}

/// User presence data
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserPresence {
    pub status: PresenceStatus,
    pub last_seen: DateTime<Utc>,
    pub current_room: Option<String>,
    pub current_game: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PresenceStatus {
    Online,
    Away,
    InGame,
    Offline,
}

/// Room information
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoomInfo {
    pub room_type: RoomType,
    pub name: String,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub game_type: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RoomType {
    Lobby,
    Game,
    Chat,
}

/// Redis manager for WebSocket Gateway
pub struct RedisManager {
    conn: ConnectionManager,
}

impl RedisManager {
    /// Create a new Redis manager
    pub async fn new(redis_url: &str) -> GatewayResult<Self> {
        info!("Connecting to Redis...");

        let client = Client::open(redis_url)
            .map_err(|e| GatewayError::Internal(format!("Failed to create Redis client: {}", e)))?;

        let conn = ConnectionManager::new(client)
            .await
            .map_err(|e| GatewayError::Internal(format!("Failed to connect to Redis: {}", e)))?;

        info!("Connected to Redis");
        Ok(Self { conn })
    }

    // ========================================================================
    // Socket Session Management
    // ========================================================================

    /// Register a new socket connection
    pub async fn register_socket(
        &self,
        socket_id: &str,
        user_id: &str,
        username: &str,
        roles: Vec<String>,
    ) -> GatewayResult<()> {
        let mut conn = self.conn.clone();
        let now = Utc::now();

        let session = SocketSession {
            user_id: user_id.to_string(),
            username: username.to_string(),
            connected_at: now,
            last_seen: now,
            roles,
        };

        let session_json = serde_json::to_string(&session)?;
        let socket_key = format!("{}{}", keys::SOCKET, socket_id);
        let user_sockets_key = format!("{}{}", keys::USER_SOCKETS, user_id);

        // Store socket session
        conn.set_ex::<_, _, ()>(&socket_key, &session_json, ttl::SOCKET).await?;

        // Add socket to user's socket set
        conn.sadd::<_, _, ()>(&user_sockets_key, socket_id).await?;

        // Add user to online set
        conn.sadd::<_, _, ()>(keys::PRESENCE_ONLINE, user_id).await?;

        debug!("Registered socket {} for user {}", socket_id, user_id);
        Ok(())
    }

    /// Unregister a socket connection
    pub async fn unregister_socket(&self, socket_id: &str) -> GatewayResult<Option<String>> {
        let mut conn = self.conn.clone();
        let socket_key = format!("{}{}", keys::SOCKET, socket_id);

        // Get session to find user_id
        let session_json: Option<String> = conn.get(&socket_key).await?;

        if let Some(json) = session_json {
            let session: SocketSession = serde_json::from_str(&json)?;
            let user_id = session.user_id.clone();
            let user_sockets_key = format!("{}{}", keys::USER_SOCKETS, user_id);

            // Remove socket from user's set
            conn.srem::<_, _, ()>(&user_sockets_key, socket_id).await?;

            // Delete socket session
            conn.del::<_, ()>(&socket_key).await?;

            // Check if user has other sockets
            let remaining: i64 = conn.scard(&user_sockets_key).await?;
            if remaining == 0 {
                // Remove from online set
                conn.srem::<_, _, ()>(keys::PRESENCE_ONLINE, &user_id).await?;
            }

            debug!("Unregistered socket {} for user {}", socket_id, user_id);
            return Ok(Some(user_id));
        }

        Ok(None)
    }

    /// Get socket session
    pub async fn get_socket_session(&self, socket_id: &str) -> GatewayResult<Option<SocketSession>> {
        let mut conn = self.conn.clone();
        let socket_key = format!("{}{}", keys::SOCKET, socket_id);

        let session_json: Option<String> = conn.get(&socket_key).await?;

        if let Some(json) = session_json {
            let session: SocketSession = serde_json::from_str(&json)?;
            return Ok(Some(session));
        }

        Ok(None)
    }

    /// Update last seen for a socket (heartbeat)
    pub async fn update_heartbeat(&self, socket_id: &str) -> GatewayResult<()> {
        let mut conn = self.conn.clone();
        let socket_key = format!("{}{}", keys::SOCKET, socket_id);

        // Get current session
        let session_json: Option<String> = conn.get(&socket_key).await?;

        if let Some(json) = session_json {
            let mut session: SocketSession = serde_json::from_str(&json)?;
            session.last_seen = Utc::now();
            let updated_json = serde_json::to_string(&session)?;

            // Update with new TTL
            conn.set_ex::<_, _, ()>(&socket_key, &updated_json, ttl::SOCKET).await?;

            // Update user presence
            let presence_key = format!("{}{}", keys::USER_PRESENCE, session.user_id);
            let presence = UserPresence {
                status: PresenceStatus::Online,
                last_seen: session.last_seen,
                current_room: None,
                current_game: None,
            };
            let presence_json = serde_json::to_string(&presence)?;
            conn.set_ex::<_, _, ()>(&presence_key, &presence_json, ttl::PRESENCE).await?;
        }

        Ok(())
    }

    // ========================================================================
    // User Socket Lookup
    // ========================================================================

    /// Get all socket IDs for a user
    pub async fn get_user_sockets(&self, user_id: &str) -> GatewayResult<HashSet<String>> {
        let mut conn = self.conn.clone();
        let user_sockets_key = format!("{}{}", keys::USER_SOCKETS, user_id);

        let sockets: HashSet<String> = conn.smembers(&user_sockets_key).await?;
        Ok(sockets)
    }

    /// Check if user is online
    pub async fn is_user_online(&self, user_id: &str) -> GatewayResult<bool> {
        let mut conn = self.conn.clone();
        let is_online: bool = conn.sismember(keys::PRESENCE_ONLINE, user_id).await?;
        Ok(is_online)
    }

    /// Get all online users
    pub async fn get_online_users(&self) -> GatewayResult<HashSet<String>> {
        let mut conn = self.conn.clone();
        let users: HashSet<String> = conn.smembers(keys::PRESENCE_ONLINE).await?;
        Ok(users)
    }

    // ========================================================================
    // Room Management
    // ========================================================================

    /// Create a room
    pub async fn create_room(
        &self,
        room_id: &str,
        room_type: RoomType,
        name: &str,
        created_by: &str,
        game_type: Option<String>,
    ) -> GatewayResult<()> {
        let mut conn = self.conn.clone();

        let room_info = RoomInfo {
            room_type,
            name: name.to_string(),
            created_by: created_by.to_string(),
            created_at: Utc::now(),
            game_type,
            status: Some("waiting".to_string()),
        };

        let room_key = format!("{}{}", keys::ROOM_INFO, room_id);
        let room_json = serde_json::to_string(&room_info)?;
        conn.set_ex::<_, _, ()>(&room_key, &room_json, ttl::ROOM_INFO).await?;

        debug!("Created room {}: {}", room_id, name);
        Ok(())
    }

    /// Add user to room
    pub async fn join_room(&self, room_id: &str, user_id: &str, socket_id: &str) -> GatewayResult<()> {
        let mut conn = self.conn.clone();

        let room_users_key = format!("{}{}", keys::ROOM_USERS, room_id);
        let room_sockets_key = format!("{}{}", keys::ROOM_SOCKETS, room_id);

        conn.sadd::<_, _, ()>(&room_users_key, user_id).await?;
        conn.sadd::<_, _, ()>(&room_sockets_key, socket_id).await?;

        debug!("User {} joined room {}", user_id, room_id);
        Ok(())
    }

    /// Remove user from room
    pub async fn leave_room(&self, room_id: &str, user_id: &str, socket_id: &str) -> GatewayResult<()> {
        let mut conn = self.conn.clone();

        let room_users_key = format!("{}{}", keys::ROOM_USERS, room_id);
        let room_sockets_key = format!("{}{}", keys::ROOM_SOCKETS, room_id);

        conn.srem::<_, _, ()>(&room_users_key, user_id).await?;
        conn.srem::<_, _, ()>(&room_sockets_key, socket_id).await?;

        debug!("User {} left room {}", user_id, room_id);
        Ok(())
    }

    /// Get all sockets in a room
    pub async fn get_room_sockets(&self, room_id: &str) -> GatewayResult<HashSet<String>> {
        let mut conn = self.conn.clone();
        let room_sockets_key = format!("{}{}", keys::ROOM_SOCKETS, room_id);
        let sockets: HashSet<String> = conn.smembers(&room_sockets_key).await?;
        Ok(sockets)
    }

    /// Get all users in a room
    pub async fn get_room_users(&self, room_id: &str) -> GatewayResult<HashSet<String>> {
        let mut conn = self.conn.clone();
        let room_users_key = format!("{}{}", keys::ROOM_USERS, room_id);
        let users: HashSet<String> = conn.smembers(&room_users_key).await?;
        Ok(users)
    }

    /// Get room info
    pub async fn get_room_info(&self, room_id: &str) -> GatewayResult<Option<RoomInfo>> {
        let mut conn = self.conn.clone();
        let room_key = format!("{}{}", keys::ROOM_INFO, room_id);

        let room_json: Option<String> = conn.get(&room_key).await?;
        if let Some(json) = room_json {
            let info: RoomInfo = serde_json::from_str(&json)?;
            return Ok(Some(info));
        }

        Ok(None)
    }

    // ========================================================================
    // Game-Specific Operations
    // ========================================================================

    /// Add player to game
    pub async fn add_game_player(&self, game_id: &str, user_id: &str) -> GatewayResult<()> {
        let mut conn = self.conn.clone();
        let game_players_key = format!("{}{}", keys::GAME_PLAYERS, game_id);
        conn.rpush::<_, _, ()>(&game_players_key, user_id).await?;
        Ok(())
    }

    /// Get game players (ordered)
    pub async fn get_game_players(&self, game_id: &str) -> GatewayResult<Vec<String>> {
        let mut conn = self.conn.clone();
        let game_players_key = format!("{}{}", keys::GAME_PLAYERS, game_id);
        let players: Vec<String> = conn.lrange(&game_players_key, 0, -1).await?;
        Ok(players)
    }

    /// Add spectator to game
    pub async fn add_game_spectator(&self, game_id: &str, user_id: &str, socket_id: &str) -> GatewayResult<()> {
        let mut conn = self.conn.clone();
        let spectators_key = format!("{}{}", keys::GAME_SPECTATORS, game_id);
        conn.sadd::<_, _, ()>(&spectators_key, format!("{}:{}", user_id, socket_id)).await?;
        Ok(())
    }

    /// Remove spectator from game
    pub async fn remove_game_spectator(&self, game_id: &str, user_id: &str, socket_id: &str) -> GatewayResult<()> {
        let mut conn = self.conn.clone();
        let spectators_key = format!("{}{}", keys::GAME_SPECTATORS, game_id);
        conn.srem::<_, _, ()>(&spectators_key, format!("{}:{}", user_id, socket_id)).await?;
        Ok(())
    }

    /// Get spectator count for game
    pub async fn get_spectator_count(&self, game_id: &str) -> GatewayResult<u32> {
        let mut conn = self.conn.clone();
        let spectators_key = format!("{}{}", keys::GAME_SPECTATORS, game_id);
        let count: u32 = conn.scard(&spectators_key).await?;
        Ok(count)
    }

    /// Set current turn for a game
    pub async fn set_game_turn(&self, game_id: &str, user_id: &str) -> GatewayResult<()> {
        let mut conn = self.conn.clone();
        let turn_key = format!("{}{}", keys::GAME_TURN, game_id);
        conn.set_ex::<_, _, ()>(&turn_key, user_id, ttl::GAME_STATE).await?;
        Ok(())
    }

    /// Get current turn for a game
    pub async fn get_game_turn(&self, game_id: &str) -> GatewayResult<Option<String>> {
        let mut conn = self.conn.clone();
        let turn_key = format!("{}{}", keys::GAME_TURN, game_id);
        let turn: Option<String> = conn.get(&turn_key).await?;
        Ok(turn)
    }

    // ========================================================================
    // Reconnection Support
    // ========================================================================

    /// Store reconnection data
    pub async fn store_reconnection_data(
        &self,
        user_id: &str,
        game_id: &str,
        state: &serde_json::Value,
    ) -> GatewayResult<()> {
        let mut conn = self.conn.clone();
        let reconnect_key = format!("{}{}:{}", keys::RECONNECT, user_id, game_id);
        let state_json = serde_json::to_string(state)?;
        conn.set_ex::<_, _, ()>(&reconnect_key, &state_json, ttl::RECONNECT).await?;
        Ok(())
    }

    /// Get reconnection data
    pub async fn get_reconnection_data(
        &self,
        user_id: &str,
        game_id: &str,
    ) -> GatewayResult<Option<serde_json::Value>> {
        let mut conn = self.conn.clone();
        let reconnect_key = format!("{}{}:{}", keys::RECONNECT, user_id, game_id);
        let state_json: Option<String> = conn.get(&reconnect_key).await?;

        if let Some(json) = state_json {
            let state: serde_json::Value = serde_json::from_str(&json)?;
            return Ok(Some(state));
        }

        Ok(None)
    }

    /// Clear reconnection data
    pub async fn clear_reconnection_data(&self, user_id: &str, game_id: &str) -> GatewayResult<()> {
        let mut conn = self.conn.clone();
        let reconnect_key = format!("{}{}:{}", keys::RECONNECT, user_id, game_id);
        conn.del::<_, ()>(&reconnect_key).await?;
        Ok(())
    }
}

/// Shared Redis manager
pub type SharedRedisManager = Arc<RedisManager>;
