# Bigger Dice Game Enhancement - Implementation Plan

## Document Information
- **Created**: 2026-01-10
- **Status**: Planning
- **Priority**: High
- **Estimated Total Effort**: 15-20 development days

---

## Executive Summary

This document outlines a comprehensive implementation plan for enhancing the Bigger Dice game with:
1. **Chat System** - MongoDB-persisted lobby/player/spectator chat with rate limiting
2. **Configurable Player Count** - 2-10 players with ready system and disconnect handling
3. **Spectator System** - Lobby-only joins, admin spectator role, max 10 spectators
4. **Role Management** - Role switching before game, admin powers, rejoin system
5. **Global Configuration** - `/games/chat-configuration` admin page

---

## Architecture Overview

```
                    ENHANCED BIGGER DICE ARCHITECTURE

    +------------------+     +------------------+     +------------------+
    |     Browser      | WS  |   ws_gateway     | Kafka|   blazing_sun    |
    |  (BiggerDice.js) |<--->|   :9998          |<--->|   (Backend)      |
    |                  |     |                  |     |                  |
    |  +------------+  |     |  Chat Commands   |     |  GameHandler     |
    |  | Chat Panel |  |     |  Game Commands   |     |  ChatHandler     |
    |  +------------+  |     |  Presence Events |     |                  |
    +------------------+     +------------------+     +------------------+
                                    |                        |
                              +-----+                   +----+----+
                              |                         |         |
                         +----v----+              +-----v---+ +---v-----+
                         |  Redis  |              |PostgreSQL| |MongoDB  |
                         | (rooms, |              | (rooms,  | |(chat,   |
                         | presence)|              | config)  | | history)|
                         +---------+              +----------+ +---------+
```

---

## Phase 1: Database Schema Changes

**Estimated Effort**: 2 days

### 1.1 PostgreSQL Migrations

#### Migration: `create_game_chat_config.sql`
```sql
-- Global chat configuration for all games
CREATE TABLE game_chat_config (
    id SERIAL PRIMARY KEY,
    rate_limit_messages INTEGER NOT NULL DEFAULT 20,      -- messages per minute
    rate_limit_window_seconds INTEGER NOT NULL DEFAULT 60,
    max_message_length INTEGER NOT NULL DEFAULT 512,
    profanity_filter_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    profanity_word_list TEXT[] NOT NULL DEFAULT '{}',     -- custom blocked words
    global_mute_enabled BOOLEAN NOT NULL DEFAULT FALSE,   -- emergency kill switch
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default config
INSERT INTO game_chat_config (rate_limit_messages, max_message_length, profanity_filter_enabled)
VALUES (20, 512, FALSE);
```

#### Migration: `alter_game_rooms_for_enhancements.sql`
```sql
-- Add player count and spectator settings to game_rooms
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS player_count INTEGER NOT NULL DEFAULT 2;
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS allow_spectators BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS max_spectators INTEGER NOT NULL DEFAULT 10;
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS admin_spectator_id BIGINT;
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS lobby_chat_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Constraints
ALTER TABLE game_rooms ADD CONSTRAINT valid_player_count
    CHECK (player_count >= 2 AND player_count <= 10);
ALTER TABLE game_rooms ADD CONSTRAINT valid_max_spectators
    CHECK (max_spectators >= 0 AND max_spectators <= 10);
```

#### Migration: `create_player_disconnect_tracking.sql`
```sql
-- Track player disconnections for auto-deselection
CREATE TABLE game_player_disconnects (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(36) NOT NULL REFERENCES game_rooms(room_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    disconnected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    deselected BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(room_id, user_id)
);

CREATE INDEX idx_player_disconnects_room ON game_player_disconnects(room_id);
CREATE INDEX idx_player_disconnects_timeout ON game_player_disconnects(disconnected_at);
```

#### Migration: `create_user_mutes.sql`
```sql
-- Per-user mute settings (local mutes, not visible to muted user)
CREATE TABLE game_user_mutes (
    id SERIAL PRIMARY KEY,
    muter_user_id BIGINT NOT NULL,
    muted_user_id BIGINT NOT NULL,
    room_id VARCHAR(36),  -- NULL = global mute, else room-specific
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(muter_user_id, muted_user_id, room_id)
);

CREATE INDEX idx_user_mutes_muter ON game_user_mutes(muter_user_id);
CREATE INDEX idx_user_mutes_muted ON game_user_mutes(muted_user_id);
```

### 1.2 MongoDB Collections

#### Collection: `game_chat_messages`
```javascript
{
  "_id": ObjectId,
  "room_id": "uuid-string",
  "sender_id": NumberLong(123),
  "sender_username": "Player1",
  "sender_avatar_id": NumberLong(456) | null,
  "chat_type": "lobby" | "player" | "spectator",
  "content": "Hello everyone!",
  "created_at": ISODate,
  "edited_at": ISODate | null,
  "deleted": false,
  "deleted_by": NumberLong | null,
  "metadata": {
    "client_message_id": "uuid",  // for deduplication
    "filtered_content": null | "***"  // if profanity filtered
  }
}
```

**Indexes**:
```javascript
db.game_chat_messages.createIndex({ "room_id": 1, "created_at": -1 });
db.game_chat_messages.createIndex({ "room_id": 1, "chat_type": 1, "created_at": -1 });
db.game_chat_messages.createIndex({ "sender_id": 1, "created_at": -1 });
```

---

## Phase 2: Backend Type Changes

**Estimated Effort**: 3 days

### 2.1 New Types in `types.rs`

```rust
// ============================================
// CHAT TYPES
// ============================================

/// Chat message types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ChatType {
    Lobby,      // Before game starts, visible to all in room
    Player,     // After game starts, only players see
    Spectator,  // After game starts, only spectators see
}

/// Chat message from client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub message_id: String,
    pub room_id: String,
    pub sender_id: i64,
    pub sender_username: String,
    pub sender_avatar_id: Option<i64>,
    pub chat_type: ChatType,
    pub content: String,
    pub created_at: DateTime<Utc>,
}

/// Chat configuration (from PostgreSQL)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatConfig {
    pub rate_limit_messages: i32,
    pub rate_limit_window_seconds: i32,
    pub max_message_length: i32,
    pub profanity_filter_enabled: bool,
    pub profanity_word_list: Vec<String>,
    pub global_mute_enabled: bool,
}

impl Default for ChatConfig {
    fn default() -> Self {
        Self {
            rate_limit_messages: 20,
            rate_limit_window_seconds: 60,
            max_message_length: 512,
            profanity_filter_enabled: false,
            profanity_word_list: Vec::new(),
            global_mute_enabled: false,
        }
    }
}

// ============================================
// ENHANCED GAME ROOM TYPES
// ============================================

/// Role in the game room
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RoomRole {
    Player,          // Selected to play
    Spectator,       // Watching the game
    LobbyMember,     // In lobby, not selected
    AdminSpectator,  // Designated admin spectator (can moderate)
}

/// Enhanced game player with role tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedGamePlayer {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub score: i32,
    pub is_ready: bool,
    pub role: RoomRole,
    pub joined_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub is_connected: bool,
    pub disconnect_timeout_at: Option<DateTime<Utc>>,
}

/// Enhanced game room with new features
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedGameRoom {
    // Existing fields...
    pub room_id: String,
    pub room_name: String,
    pub game_type: GameType,
    pub status: RoomStatus,
    pub host_id: i64,
    pub players: Vec<EnhancedGamePlayer>,
    pub lobby: Vec<EnhancedGamePlayer>,
    pub spectators: Vec<EnhancedGamePlayer>,
    pub banned_users: Vec<BannedPlayer>,
    pub current_turn: Option<i64>,
    pub turn_number: i32,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub winner_id: Option<i64>,
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,
    pub is_password_protected: bool,

    // NEW FIELDS
    pub player_count: i32,              // 2-10, set at creation
    pub allow_spectators: bool,         // Set at creation
    pub max_spectators: i32,            // 0-10
    pub admin_spectator_id: Option<i64>, // Designated moderator
    pub lobby_chat_enabled: bool,       // Disabled after game starts
}

/// Player disconnect tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerDisconnect {
    pub room_id: String,
    pub user_id: i64,
    pub disconnected_at: DateTime<Utc>,
    pub timeout_seconds: i32,
    pub deselected: bool,
}
```

### 2.2 New Commands in `GameCommand`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameCommand {
    // ... existing commands ...

    // ============================================
    // CHAT COMMANDS
    // ============================================

    /// Send chat message (lobby, player, or spectator based on context)
    #[serde(rename = "send_chat")]
    SendChat {
        user_id: i64,
        room_id: String,
        content: String,
        socket_id: String,
    },

    /// Mute a user locally (sender won't see muted user's messages)
    #[serde(rename = "mute_user")]
    MuteUser {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },

    /// Unmute a user
    #[serde(rename = "unmute_user")]
    UnmuteUser {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },

    /// Get chat history
    #[serde(rename = "get_chat_history")]
    GetChatHistory {
        user_id: i64,
        room_id: String,
        chat_type: ChatType,
        before: Option<DateTime<Utc>>,
        limit: Option<i32>,
        socket_id: String,
    },

    // ============================================
    // ENHANCED ROOM COMMANDS
    // ============================================

    /// Create room with enhanced options
    #[serde(rename = "create_room_enhanced")]
    CreateRoomEnhanced {
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        game_type: String,
        room_name: String,
        socket_id: String,
        password: Option<String>,
        player_count: i32,          // 2-10
        allow_spectators: bool,
    },

    /// Deselect a player (admin only, before game)
    #[serde(rename = "deselect_player")]
    DeselectPlayer {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },

    /// Designate admin spectator (when admin is playing)
    #[serde(rename = "designate_admin_spectator")]
    DesignateAdminSpectator {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },

    /// Kick spectator
    #[serde(rename = "kick_spectator")]
    KickSpectator {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },

    /// Ban spectator
    #[serde(rename = "ban_spectator")]
    BanSpectator {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },

    /// Player connection status update (heartbeat/disconnect)
    #[serde(rename = "player_connection_status")]
    PlayerConnectionStatus {
        user_id: i64,
        room_id: String,
        socket_id: String,
        is_connected: bool,
    },
}
```

### 2.3 New Events in `GameEvent`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameEvent {
    // ... existing events ...

    // ============================================
    // CHAT EVENTS
    // ============================================

    /// New chat message received
    #[serde(rename = "chat_message")]
    ChatMessage {
        room_id: String,
        message: ChatMessage,
    },

    /// Chat history response
    #[serde(rename = "chat_history")]
    ChatHistory {
        room_id: String,
        chat_type: ChatType,
        messages: Vec<ChatMessage>,
        has_more: bool,
        socket_id: String,
    },

    /// Chat rate limited
    #[serde(rename = "chat_rate_limited")]
    ChatRateLimited {
        room_id: String,
        retry_after_seconds: i32,
        socket_id: String,
    },

    /// Chat message rejected (profanity, length, etc.)
    #[serde(rename = "chat_rejected")]
    ChatRejected {
        room_id: String,
        reason: String,
        socket_id: String,
    },

    /// User muted confirmation
    #[serde(rename = "user_muted")]
    UserMuted {
        room_id: String,
        muted_user_id: i64,
        muted_username: String,
        socket_id: String,
    },

    /// User unmuted confirmation
    #[serde(rename = "user_unmuted")]
    UserUnmuted {
        room_id: String,
        unmuted_user_id: i64,
        unmuted_username: String,
        socket_id: String,
    },

    /// Lobby chat disabled (game starting)
    #[serde(rename = "lobby_chat_disabled")]
    LobbyChatDisabled {
        room_id: String,
    },

    // ============================================
    // ENHANCED ROOM EVENTS
    // ============================================

    /// Player deselected (moved back to lobby)
    #[serde(rename = "player_deselected")]
    PlayerDeselected {
        room_id: String,
        user_id: i64,
        username: String,
        reason: String, // "admin_action", "disconnect_timeout", "voluntary"
    },

    /// Admin spectator designated
    #[serde(rename = "admin_spectator_designated")]
    AdminSpectatorDesignated {
        room_id: String,
        user_id: i64,
        username: String,
    },

    /// Spectator kicked
    #[serde(rename = "spectator_kicked")]
    SpectatorKicked {
        room_id: String,
        user_id: i64,
        username: String,
    },

    /// Spectator banned
    #[serde(rename = "spectator_banned")]
    SpectatorBanned {
        room_id: String,
        user_id: i64,
        username: String,
    },

    /// Player disconnected (30s timeout started)
    #[serde(rename = "player_disconnected")]
    PlayerDisconnected {
        room_id: String,
        user_id: i64,
        username: String,
        timeout_at: DateTime<Utc>,
    },

    /// Player reconnected
    #[serde(rename = "player_reconnected")]
    PlayerReconnected {
        room_id: String,
        user_id: i64,
        username: String,
    },

    /// Unselected players removed (game starting)
    #[serde(rename = "unselected_removed")]
    UnselectedRemoved {
        room_id: String,
        removed_user_ids: Vec<i64>,
    },

    /// Rejoin result
    #[serde(rename = "rejoin_result")]
    RejoinResult {
        room_id: String,
        rejoin: bool,
        role: String, // "player", "spectator", "denied"
        reason: Option<String>,
        socket_id: String,
    },
}
```

---

## Phase 3: Backend Handler Changes

**Estimated Effort**: 4 days

### 3.1 New Chat Handler Module

Create `blazing_sun/src/bootstrap/events/handlers/chat.rs`:

```rust
//! Chat event handler for game rooms
//!
//! Handles chat messages, rate limiting, profanity filtering, and mutes.

use crate::app::games::types::{
    Audience, ChatConfig, ChatMessage, ChatType, EventEnvelope, GameEvent,
};
use crate::events::consumer::{EventHandler, EventHandlerError};
use crate::events::producer::EventProducer;
use crate::events::topics::topic;
use async_trait::async_trait;
use chrono::{Duration, Utc};
use mongodb::Database;
use sqlx::{Pool, Postgres};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Rate limit tracking per user
struct RateLimitEntry {
    message_count: i32,
    window_start: chrono::DateTime<Utc>,
}

pub struct ChatCommandHandler {
    db: Arc<Mutex<Pool<Postgres>>>,
    mongodb: Option<Arc<Database>>,
    producer: Option<Arc<EventProducer>>,
    rate_limits: Arc<Mutex<HashMap<(i64, String), RateLimitEntry>>>,
    config_cache: Arc<Mutex<Option<(ChatConfig, chrono::DateTime<Utc>)>>>,
}

impl ChatCommandHandler {
    pub fn new(
        db: Arc<Mutex<Pool<Postgres>>>,
        mongodb: Option<Arc<Database>>,
        producer: Option<Arc<EventProducer>>,
    ) -> Self {
        Self {
            db,
            mongodb,
            producer,
            rate_limits: Arc::new(Mutex::new(HashMap::new())),
            config_cache: Arc::new(Mutex::new(None)),
        }
    }

    /// Get chat config (cached for 5 minutes)
    async fn get_config(&self) -> ChatConfig {
        let mut cache = self.config_cache.lock().await;
        let now = Utc::now();

        if let Some((config, cached_at)) = cache.as_ref() {
            if now - *cached_at < Duration::minutes(5) {
                return config.clone();
            }
        }

        // Load from database
        let db = self.db.lock().await;
        // TODO: Implement get_chat_config stored procedure
        let config = ChatConfig::default();
        drop(db);

        *cache = Some((config.clone(), now));
        config
    }

    /// Check rate limit for user
    async fn check_rate_limit(&self, user_id: i64, room_id: &str) -> Result<(), i32> {
        let config = self.get_config().await;
        let mut limits = self.rate_limits.lock().await;
        let key = (user_id, room_id.to_string());
        let now = Utc::now();

        let entry = limits.entry(key).or_insert(RateLimitEntry {
            message_count: 0,
            window_start: now,
        });

        // Reset window if expired
        let window_duration = Duration::seconds(config.rate_limit_window_seconds as i64);
        if now - entry.window_start > window_duration {
            entry.message_count = 0;
            entry.window_start = now;
        }

        // Check limit
        if entry.message_count >= config.rate_limit_messages {
            let retry_after = (entry.window_start + window_duration - now).num_seconds();
            return Err(retry_after as i32);
        }

        entry.message_count += 1;
        Ok(())
    }

    /// Filter profanity from message
    fn filter_profanity(&self, content: &str, config: &ChatConfig) -> (String, bool) {
        if !config.profanity_filter_enabled {
            return (content.to_string(), false);
        }

        let mut filtered = content.to_string();
        let mut was_filtered = false;

        for word in &config.profanity_word_list {
            if filtered.to_lowercase().contains(&word.to_lowercase()) {
                let replacement = "*".repeat(word.len());
                filtered = filtered.replace(word, &replacement);
                was_filtered = true;
            }
        }

        (filtered, was_filtered)
    }

    /// Handle send_chat command
    async fn handle_send_chat(
        &self,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        room_id: &str,
        content: &str,
        socket_id: &str,
        room: &GameRoom,
    ) -> Result<(), EventHandlerError> {
        let config = self.get_config().await;

        // Check global mute
        if config.global_mute_enabled {
            let event = GameEvent::ChatRejected {
                room_id: room_id.to_string(),
                reason: "Chat is currently disabled".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_event(event, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Validate message length
        if content.len() > config.max_message_length as usize {
            let event = GameEvent::ChatRejected {
                room_id: room_id.to_string(),
                reason: format!("Message exceeds {} character limit", config.max_message_length),
                socket_id: socket_id.to_string(),
            };
            self.publish_event(event, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Check rate limit
        if let Err(retry_after) = self.check_rate_limit(user_id, room_id).await {
            let event = GameEvent::ChatRateLimited {
                room_id: room_id.to_string(),
                retry_after_seconds: retry_after,
                socket_id: socket_id.to_string(),
            };
            self.publish_event(event, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Determine chat type and audience based on game state and user role
        let (chat_type, audience) = self.determine_chat_routing(user_id, room);

        // Check if chat type is allowed
        if chat_type == ChatType::Lobby && !room.lobby_chat_enabled {
            let event = GameEvent::ChatRejected {
                room_id: room_id.to_string(),
                reason: "Lobby chat is disabled during gameplay".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_event(event, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Filter profanity
        let (filtered_content, was_filtered) = self.filter_profanity(content, &config);

        // Create message
        let message = ChatMessage {
            message_id: uuid::Uuid::new_v4().to_string(),
            room_id: room_id.to_string(),
            sender_id: user_id,
            sender_username: username.to_string(),
            sender_avatar_id: avatar_id,
            chat_type: chat_type.clone(),
            content: filtered_content,
            created_at: Utc::now(),
        };

        // Save to MongoDB
        if let Some(mongodb) = &self.mongodb {
            // TODO: Save message to game_chat_messages collection
        }

        // Publish to appropriate audience
        let event = GameEvent::ChatMessage {
            room_id: room_id.to_string(),
            message,
        };
        self.publish_event(event, audience).await?;

        Ok(())
    }

    /// Determine chat type and audience based on game state
    fn determine_chat_routing(&self, user_id: i64, room: &GameRoom) -> (ChatType, Audience) {
        match room.status {
            RoomStatus::Waiting => {
                // Lobby chat - everyone in room sees it
                (ChatType::Lobby, Audience::room(&room.room_id))
            }
            RoomStatus::InProgress | RoomStatus::Finished => {
                // Check if user is player or spectator
                if room.is_player(user_id) {
                    // Player chat - only players see it
                    (ChatType::Player, Audience::players(&room.room_id))
                } else if room.is_spectator(user_id) {
                    // Spectator chat - only spectators see it
                    (ChatType::Spectator, Audience::spectators(&room.room_id))
                } else {
                    // Unknown role, reject
                    (ChatType::Lobby, Audience::user(user_id))
                }
            }
            _ => (ChatType::Lobby, Audience::room(&room.room_id)),
        }
    }
}
```

### 3.2 Enhanced Game Handler Methods

Add to `games.rs`:

```rust
/// Handle deselect_player command (admin only, before game)
async fn handle_deselect_player(
    &self,
    user_id: i64,
    room_id: &str,
    target_user_id: i64,
    socket_id: &str,
) -> Result<(), EventHandlerError> {
    let mut room = self.get_room(room_id).await?.ok_or_else(|| {
        EventHandlerError::Fatal("Room not found".to_string())
    })?;

    // Verify admin
    if !room.is_admin(user_id) && room.admin_spectator_id != Some(user_id) {
        return self.send_error(user_id, "not_admin", "Only admin can deselect players", socket_id).await;
    }

    // Verify game not started
    if room.status != RoomStatus::Waiting {
        return self.send_error(user_id, "game_in_progress", "Cannot deselect during game", socket_id).await;
    }

    // Move player from players to lobby
    if let Some(idx) = room.players.iter().position(|p| p.user_id == target_user_id) {
        let mut player = room.players.remove(idx);
        player.is_ready = false; // Reset ready state
        let username = player.username.clone();
        room.lobby.push(player);

        // Update database
        let db = self.db.lock().await;
        game_room_mutations::deselect_player(&db, room_id, target_user_id).await?;
        drop(db);

        // Update cache
        self.update_room(&room).await?;

        // Notify room
        let event = GameEvent::PlayerDeselected {
            room_id: room_id.to_string(),
            user_id: target_user_id,
            username,
            reason: "admin_action".to_string(),
        };
        self.publish_game_event(event, Audience::room(room_id)).await?;
    }

    Ok(())
}

/// Handle disconnect timeout check (called by cron or timer)
async fn check_disconnect_timeouts(&self) -> Result<(), EventHandlerError> {
    let now = Utc::now();
    let timeout_duration = chrono::Duration::seconds(30);

    let rooms = self.rooms.lock().await;
    for (room_id, room) in rooms.iter() {
        // Only check waiting rooms (before game start)
        if room.status != RoomStatus::Waiting {
            continue;
        }

        for player in &room.players {
            if let Some(timeout_at) = player.disconnect_timeout_at {
                if now >= timeout_at {
                    // Auto-deselect player
                    drop(rooms);
                    self.handle_deselect_player(
                        room.host_id,
                        room_id,
                        player.user_id,
                        "",
                    ).await?;
                    // Re-acquire lock for next iteration
                    // (simplified - actual impl needs better handling)
                    break;
                }
            }
        }
    }

    Ok(())
}

/// Handle game start - remove unselected players and disable lobby chat
async fn start_game_enhanced(&self, room: &mut GameRoom) -> Vec<GameEvent> {
    let mut events = Vec::new();

    // Collect unselected players to remove
    let removed_ids: Vec<i64> = room.lobby.iter().map(|p| p.user_id).collect();

    // Clear lobby
    room.lobby.clear();

    // Disable lobby chat
    room.lobby_chat_enabled = false;

    // Emit unselected_removed event
    if !removed_ids.is_empty() {
        events.push(GameEvent::UnselectedRemoved {
            room_id: room.room_id.clone(),
            removed_user_ids: removed_ids,
        });
    }

    // Emit lobby_chat_disabled event
    events.push(GameEvent::LobbyChatDisabled {
        room_id: room.room_id.clone(),
    });

    // Continue with normal game start...
    events.extend(bigger_dice::start_game(room));

    events
}
```

---

## Phase 4: WebSocket Gateway Changes

**Estimated Effort**: 2 days

### 4.1 New Client Messages in `protocol.rs`

```rust
// Add to ClientMessage enum:

/// Send chat message
#[serde(rename = "games.command.send_chat")]
GameSendChat {
    room_id: String,
    content: String,
},

/// Mute user locally
#[serde(rename = "games.command.mute_user")]
GameMuteUser {
    room_id: String,
    target_user_id: String,
},

/// Unmute user
#[serde(rename = "games.command.unmute_user")]
GameUnmuteUser {
    room_id: String,
    target_user_id: String,
},

/// Get chat history
#[serde(rename = "games.command.get_chat_history")]
GameGetChatHistory {
    room_id: String,
    chat_type: String,
    #[serde(default)]
    before: Option<String>,
    #[serde(default)]
    limit: Option<i32>,
},

/// Create room with enhanced options
#[serde(rename = "games.command.create_room_enhanced")]
GameCreateRoomEnhanced {
    game_type: String,
    room_name: String,
    #[serde(default)]
    password: Option<String>,
    player_count: i32,
    allow_spectators: bool,
},

/// Deselect player (admin only)
#[serde(rename = "games.command.deselect_player")]
GameDeselectPlayer {
    room_id: String,
    target_user_id: String,
},

/// Designate admin spectator
#[serde(rename = "games.command.designate_admin_spectator")]
GameDesignateAdminSpectator {
    room_id: String,
    target_user_id: String,
},

/// Kick spectator
#[serde(rename = "games.command.kick_spectator")]
GameKickSpectator {
    room_id: String,
    target_user_id: String,
},

/// Ban spectator
#[serde(rename = "games.command.ban_spectator")]
GameBanSpectator {
    room_id: String,
    target_user_id: String,
},

/// Collapse chat toggle
#[serde(rename = "games.command.toggle_chat_collapse")]
GameToggleChatCollapse {
    room_id: String,
    collapsed: bool,
},
```

### 4.2 New Server Messages in `protocol.rs`

```rust
// Add to ServerMessage enum:

/// Chat message received
#[serde(rename = "games.event.chat_message")]
GameChatMessage {
    room_id: String,
    message_id: String,
    sender_id: String,
    sender_username: String,
    sender_avatar_id: Option<String>,
    chat_type: String,
    content: String,
    created_at: DateTime<Utc>,
},

/// Chat history response
#[serde(rename = "games.event.chat_history")]
GameChatHistory {
    room_id: String,
    chat_type: String,
    messages: Vec<ChatMessageInfo>,
    has_more: bool,
},

/// Chat rate limited
#[serde(rename = "games.event.chat_rate_limited")]
GameChatRateLimited {
    room_id: String,
    retry_after_seconds: i32,
},

/// Chat rejected
#[serde(rename = "games.event.chat_rejected")]
GameChatRejected {
    room_id: String,
    reason: String,
},

/// User muted
#[serde(rename = "games.event.user_muted")]
GameUserMuted {
    room_id: String,
    muted_user_id: String,
    muted_username: String,
},

/// User unmuted
#[serde(rename = "games.event.user_unmuted")]
GameUserUnmuted {
    room_id: String,
    unmuted_user_id: String,
    unmuted_username: String,
},

/// Lobby chat disabled
#[serde(rename = "games.event.lobby_chat_disabled")]
GameLobbyChatDisabled {
    room_id: String,
},

/// Player deselected
#[serde(rename = "games.event.player_deselected")]
GamePlayerDeselected {
    room_id: String,
    user_id: String,
    username: String,
    reason: String,
},

/// Admin spectator designated
#[serde(rename = "games.event.admin_spectator_designated")]
GameAdminSpectatorDesignated {
    room_id: String,
    user_id: String,
    username: String,
},

/// Spectator kicked
#[serde(rename = "games.event.spectator_kicked")]
GameSpectatorKicked {
    room_id: String,
    user_id: String,
    username: String,
},

/// Spectator banned
#[serde(rename = "games.event.spectator_banned")]
GameSpectatorBanned {
    room_id: String,
    user_id: String,
    username: String,
},

/// Player disconnected
#[serde(rename = "games.event.player_disconnected")]
GamePlayerDisconnected {
    room_id: String,
    user_id: String,
    username: String,
    timeout_at: DateTime<Utc>,
},

/// Player reconnected
#[serde(rename = "games.event.player_reconnected")]
GamePlayerReconnected {
    room_id: String,
    user_id: String,
    username: String,
},

/// Unselected players removed
#[serde(rename = "games.event.unselected_removed")]
GameUnselectedRemoved {
    room_id: String,
    removed_user_ids: Vec<String>,
},

/// Rejoin result
#[serde(rename = "games.event.rejoin_result")]
GameRejoinResult {
    room_id: String,
    rejoin: bool,
    role: String,
    reason: Option<String>,
},

// Supporting types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessageInfo {
    pub message_id: String,
    pub sender_id: String,
    pub sender_username: String,
    pub sender_avatar_id: Option<String>,
    pub chat_type: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
}
```

---

## Phase 5: Frontend Changes

**Estimated Effort**: 5 days

### 5.1 Chat Panel Component

Create `blazing_sun/src/frontend/games/BIGGER_DICE/src/components/ChatPanel.js`:

```javascript
/**
 * ChatPanel - Collapsible chat panel with lobby/player/spectator modes
 *
 * Features:
 * - Lobby chat (before game)
 * - Player chat (during game, players only)
 * - Spectator chat (during game, spectators only)
 * - Message history with lazy loading
 * - Rate limiting feedback
 * - User muting (local)
 * - Collapse/expand toggle
 */
export class ChatPanel {
    constructor(options) {
        this.roomId = options.roomId;
        this.userId = options.userId;
        this.username = options.username;
        this.ws = options.ws;
        this.role = options.role || 'lobby';
        this.gameStatus = options.gameStatus || 'waiting';
        this.isCollapsed = false;
        this.mutedUsers = new Set();
        this.messages = [];
        this.isLoading = false;
        this.hasMore = true;

        this.container = null;
        this.messageList = null;
        this.inputField = null;

        this.init();
    }

    init() {
        this.createDOM();
        this.bindEvents();
        this.loadChatHistory();
    }

    createDOM() {
        this.container = document.createElement('div');
        this.container.className = 'chat-panel';
        this.container.innerHTML = `
            <div class="chat-header">
                <span class="chat-title">${this.getChatTitle()}</span>
                <button class="chat-collapse-btn" aria-label="Toggle chat">
                    <svg class="collapse-icon" viewBox="0 0 24 24" width="16" height="16">
                        <path d="M19 13H5v-2h14v2z"/>
                    </svg>
                </button>
            </div>
            <div class="chat-body">
                <div class="chat-messages" role="log" aria-live="polite"></div>
                <div class="chat-input-area">
                    <input type="text"
                           class="chat-input"
                           placeholder="Type a message..."
                           maxlength="512"
                           aria-label="Chat message">
                    <button class="chat-send-btn" aria-label="Send message">
                        <svg viewBox="0 0 24 24" width="20" height="20">
                            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="chat-rate-limit-notice" style="display: none;">
                Rate limited. Wait <span class="rate-limit-seconds">0</span>s
            </div>
        `;

        this.messageList = this.container.querySelector('.chat-messages');
        this.inputField = this.container.querySelector('.chat-input');
    }

    bindEvents() {
        // Collapse toggle
        this.container.querySelector('.chat-collapse-btn').addEventListener('click', () => {
            this.toggleCollapse();
        });

        // Send message
        this.container.querySelector('.chat-send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        // Enter to send
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Scroll to load more
        this.messageList.addEventListener('scroll', () => {
            if (this.messageList.scrollTop === 0 && this.hasMore && !this.isLoading) {
                this.loadMoreMessages();
            }
        });
    }

    getChatTitle() {
        if (this.gameStatus === 'waiting') {
            return 'Lobby Chat';
        }
        return this.role === 'player' ? 'Player Chat' : 'Spectator Chat';
    }

    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        this.container.classList.toggle('collapsed', this.isCollapsed);

        // Notify server of preference
        this.ws.send(JSON.stringify({
            type: 'games.command.toggle_chat_collapse',
            room_id: this.roomId,
            collapsed: this.isCollapsed,
        }));
    }

    sendMessage() {
        const content = this.inputField.value.trim();
        if (!content) return;

        this.ws.send(JSON.stringify({
            type: 'games.command.send_chat',
            room_id: this.roomId,
            content: content,
        }));

        this.inputField.value = '';
    }

    loadChatHistory() {
        this.isLoading = true;
        this.ws.send(JSON.stringify({
            type: 'games.command.get_chat_history',
            room_id: this.roomId,
            chat_type: this.getChatType(),
            limit: 50,
        }));
    }

    loadMoreMessages() {
        if (this.messages.length === 0) return;

        this.isLoading = true;
        const oldestMessage = this.messages[0];

        this.ws.send(JSON.stringify({
            type: 'games.command.get_chat_history',
            room_id: this.roomId,
            chat_type: this.getChatType(),
            before: oldestMessage.created_at,
            limit: 50,
        }));
    }

    getChatType() {
        if (this.gameStatus === 'waiting') return 'lobby';
        return this.role === 'player' ? 'player' : 'spectator';
    }

    addMessage(message) {
        // Skip if user is muted
        if (this.mutedUsers.has(message.sender_id)) return;

        this.messages.push(message);
        this.renderMessage(message);
        this.scrollToBottom();
    }

    renderMessage(message) {
        const isOwnMessage = message.sender_id === this.userId.toString();
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${isOwnMessage ? 'own-message' : ''}`;
        messageEl.dataset.messageId = message.message_id;

        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${this.escapeHtml(message.sender_username)}</span>
                <span class="message-time">${this.formatTime(message.created_at)}</span>
                ${!isOwnMessage ? `
                    <button class="mute-user-btn" data-user-id="${message.sender_id}" aria-label="Mute user">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                        </svg>
                    </button>
                ` : ''}
            </div>
            <div class="message-content">${this.escapeHtml(message.content)}</div>
        `;

        // Bind mute button
        const muteBtn = messageEl.querySelector('.mute-user-btn');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                this.muteUser(message.sender_id, message.sender_username);
            });
        }

        this.messageList.appendChild(messageEl);
    }

    muteUser(userId, username) {
        this.mutedUsers.add(userId);

        this.ws.send(JSON.stringify({
            type: 'games.command.mute_user',
            room_id: this.roomId,
            target_user_id: userId,
        }));

        // Hide messages from muted user
        this.messageList.querySelectorAll(`[data-user-id="${userId}"]`).forEach(el => {
            el.closest('.chat-message').classList.add('muted');
        });

        this.showToast(`${username} has been muted`);
    }

    unmuteUser(userId) {
        this.mutedUsers.delete(userId);

        this.ws.send(JSON.stringify({
            type: 'games.command.unmute_user',
            room_id: this.roomId,
            target_user_id: userId,
        }));

        // Show messages from unmuted user
        this.messageList.querySelectorAll(`[data-user-id="${userId}"]`).forEach(el => {
            el.closest('.chat-message').classList.remove('muted');
        });
    }

    handleRateLimit(retryAfterSeconds) {
        const notice = this.container.querySelector('.chat-rate-limit-notice');
        const secondsSpan = notice.querySelector('.rate-limit-seconds');

        notice.style.display = 'block';
        this.inputField.disabled = true;

        let remaining = retryAfterSeconds;
        const interval = setInterval(() => {
            remaining--;
            secondsSpan.textContent = remaining;

            if (remaining <= 0) {
                clearInterval(interval);
                notice.style.display = 'none';
                this.inputField.disabled = false;
            }
        }, 1000);
    }

    handleChatDisabled() {
        this.inputField.disabled = true;
        this.inputField.placeholder = 'Chat disabled during game';
    }

    scrollToBottom() {
        this.messageList.scrollTop = this.messageList.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    showToast(message) {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.className = 'chat-toast';
        toast.textContent = message;
        this.container.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }

    updateRole(newRole) {
        this.role = newRole;
        this.container.querySelector('.chat-title').textContent = this.getChatTitle();
        this.messages = [];
        this.messageList.innerHTML = '';
        this.loadChatHistory();
    }

    updateGameStatus(status) {
        this.gameStatus = status;
        this.container.querySelector('.chat-title').textContent = this.getChatTitle();

        if (status !== 'waiting') {
            this.handleChatDisabled();
        }
    }

    getElement() {
        return this.container;
    }
}
```

### 5.2 Enhanced BiggerDice.js Changes

Add to `BiggerDice.js` class:

```javascript
// In constructor, add:
this.chatPanel = null;
this.playerCount = 2;
this.allowSpectators = true;

// New method for chat integration
initChatPanel() {
    this.chatPanel = new ChatPanel({
        roomId: this.roomId,
        userId: this.userId,
        username: this.username,
        ws: this.ws,
        role: this.isSpectator ? 'spectator' : 'player',
        gameStatus: this.gameState?.status || 'waiting',
    });

    const chatContainer = this.shadowRoot.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.appendChild(this.chatPanel.getElement());
    }
}

// Enhanced create room modal
renderCreateRoomModal() {
    return `
        <div class="modal-overlay" id="createRoomModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Create Game Room</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="form-group">
                    <label class="form-label">Room Name</label>
                    <input type="text" class="form-input" id="roomNameInput"
                           placeholder="Enter room name" maxlength="50">
                </div>
                <div class="form-group">
                    <label class="form-label">Number of Players</label>
                    <select class="form-input" id="playerCountSelect">
                        <option value="2">2 Players</option>
                        <option value="3">3 Players</option>
                        <option value="4">4 Players</option>
                        <option value="5">5 Players</option>
                        <option value="6">6 Players</option>
                        <option value="7">7 Players</option>
                        <option value="8">8 Players</option>
                        <option value="9">9 Players</option>
                        <option value="10">10 Players</option>
                    </select>
                    <span class="form-hint">Player count cannot be changed after room creation</span>
                </div>
                <div class="form-group">
                    <label class="form-label checkbox-label">
                        <input type="checkbox" id="allowSpectatorsCheck" checked>
                        Allow Spectators (max 10)
                    </label>
                </div>
                <div class="form-group">
                    <label class="form-label">
                        Password <span class="form-label__optional">(optional)</span>
                    </label>
                    <input type="password" class="form-input" id="roomPasswordInput"
                           placeholder="Leave empty for public room" maxlength="50">
                </div>
                <div class="modal-actions">
                    <button class="btn-secondary modal-cancel">Cancel</button>
                    <button class="btn-primary" id="createRoomSubmit">Create Room</button>
                </div>
            </div>
        </div>
    `;
}

// Handle create room with enhanced options
handleCreateRoomSubmit() {
    const roomName = this.shadowRoot.querySelector('#roomNameInput').value.trim();
    const playerCount = parseInt(this.shadowRoot.querySelector('#playerCountSelect').value);
    const allowSpectators = this.shadowRoot.querySelector('#allowSpectatorsCheck').checked;
    const password = this.shadowRoot.querySelector('#roomPasswordInput').value;

    if (!roomName) {
        this.showError('Please enter a room name');
        return;
    }

    this.ws.send(JSON.stringify({
        type: 'games.command.create_room_enhanced',
        game_type: 'bigger_dice',
        room_name: roomName,
        password: password || null,
        player_count: playerCount,
        allow_spectators: allowSpectators,
    }));

    this.closeCreateRoomModal();
}

// Handle new events
handleWebSocketMessage(event) {
    // ... existing handlers ...

    switch (message.type) {
        case 'games.event.chat_message':
            this.chatPanel?.addMessage(message);
            break;

        case 'games.event.chat_history':
            this.handleChatHistory(message);
            break;

        case 'games.event.chat_rate_limited':
            this.chatPanel?.handleRateLimit(message.retry_after_seconds);
            break;

        case 'games.event.chat_rejected':
            this.showError(message.reason);
            break;

        case 'games.event.lobby_chat_disabled':
            this.chatPanel?.handleChatDisabled();
            break;

        case 'games.event.player_deselected':
            this.handlePlayerDeselected(message);
            break;

        case 'games.event.player_disconnected':
            this.handlePlayerDisconnected(message);
            break;

        case 'games.event.player_reconnected':
            this.handlePlayerReconnected(message);
            break;

        case 'games.event.unselected_removed':
            this.handleUnselectedRemoved(message);
            break;

        case 'games.event.rejoin_result':
            this.handleRejoinResult(message);
            break;
    }
}

handlePlayerDeselected(message) {
    if (message.user_id === this.userId) {
        // We were deselected - show notification and update UI
        this.showNotification(`You were deselected: ${message.reason}`);
        this.isPlayer = false;
        this.updateRoleUI();
    }

    // Update player list
    this.updatePlayerList();
}

handlePlayerDisconnected(message) {
    // Show disconnect indicator for player
    const playerEl = this.shadowRoot.querySelector(`[data-user-id="${message.user_id}"]`);
    if (playerEl) {
        playerEl.classList.add('disconnected');

        // Show countdown
        const timeoutAt = new Date(message.timeout_at);
        this.startDisconnectCountdown(message.user_id, timeoutAt);
    }
}

handlePlayerReconnected(message) {
    // Remove disconnect indicator
    const playerEl = this.shadowRoot.querySelector(`[data-user-id="${message.user_id}"]`);
    if (playerEl) {
        playerEl.classList.remove('disconnected');
    }

    this.clearDisconnectCountdown(message.user_id);
}

handleRejoinResult(message) {
    if (message.rejoin) {
        this.showNotification(`Rejoined as ${message.role}`);
        this.currentRole = message.role;
        this.updateRoleUI();
    } else {
        this.showError(message.reason || 'Could not rejoin room');
    }
}
```

### 5.3 Chat Panel Styles

Add to `_chat.scss`:

```scss
// Chat Panel Styles
.chat-panel {
    display: flex;
    flex-direction: column;
    height: 300px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
    transition: height 0.3s ease;

    &.collapsed {
        height: 44px;

        .chat-body,
        .chat-rate-limit-notice {
            display: none;
        }

        .collapse-icon {
            transform: rotate(180deg);
        }
    }
}

.chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-color);
    border-bottom: 1px solid var(--border-color);
    flex-shrink: 0;
}

.chat-title {
    font-weight: 600;
    font-size: 0.875rem;
}

.chat-collapse-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        color: var(--text-color);
    }

    .collapse-icon {
        transition: transform 0.3s ease;
    }
}

.chat-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.chat-message {
    padding: 0.5rem 0.75rem;
    background: var(--bg-color);
    border-radius: 0.375rem;
    font-size: 0.8125rem;

    &.own-message {
        background: rgba(99, 102, 241, 0.15);
        margin-left: 1rem;
    }

    &.muted {
        display: none;
    }
}

.message-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
}

.message-sender {
    font-weight: 600;
    color: var(--primary-color);
}

.message-time {
    font-size: 0.75rem;
    color: var(--text-muted);
}

.mute-user-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.125rem;
    margin-left: auto;
    opacity: 0;
    transition: opacity 0.2s;

    .chat-message:hover & {
        opacity: 1;
    }

    &:hover {
        color: var(--danger-color);
    }
}

.message-content {
    color: var(--text-color);
    word-break: break-word;
}

.chat-input-area {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: 1px solid var(--border-color);
}

.chat-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid var(--border-color);
    border-radius: 0.375rem;
    background: var(--bg-color);
    color: var(--text-color);
    outline: none;

    &:focus {
        border-color: var(--primary-color);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}

.chat-send-btn {
    background: var(--primary-color);
    border: none;
    border-radius: 0.375rem;
    color: white;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        opacity: 0.9;
    }
}

.chat-rate-limit-notice {
    padding: 0.5rem;
    background: rgba(239, 68, 68, 0.15);
    color: var(--danger-color);
    font-size: 0.75rem;
    text-align: center;
}

.chat-toast {
    position: absolute;
    bottom: 4rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    animation: fadeInOut 3s ease;
}

@keyframes fadeInOut {
    0%, 100% { opacity: 0; }
    10%, 90% { opacity: 1; }
}

// Disconnect indicator
.player-card.disconnected {
    opacity: 0.5;

    &::after {
        content: 'Disconnected';
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        font-size: 0.625rem;
        padding: 0.125rem 0.375rem;
        background: var(--danger-color);
        color: white;
        border-radius: 0.25rem;
    }
}
```

---

## Phase 6: Admin Configuration Page

**Estimated Effort**: 2 days

### 6.1 Create Web Route

Add to `blazing_sun/src/routes/web.rs`:

```rust
cfg.route("/games/chat-configuration", web::get().to(pages::games_chat_config));
```

### 6.2 Controller Method

Add to `blazing_sun/src/app/http/web/controllers/pages.rs`:

```rust
pub async fn games_chat_config(
    state: web::Data<AppState>,
    req: HttpRequest,
    session: Session,
) -> Result<HttpResponse, actix_web::Error> {
    let user = get_authenticated_user(&session, &state).await;

    // Require admin permission (level 10+)
    if user.as_ref().map(|u| u.permission_level).unwrap_or(0) < 10 {
        return Ok(HttpResponse::Found()
            .append_header(("Location", "/"))
            .finish());
    }

    // Get current config from database
    let db = state.db.lock().await;
    let config = game_chat_config::get(&db).await.unwrap_or_default();
    drop(db);

    let mut context = tera::Context::new();
    context.insert("page_title", "Chat Configuration");
    context.insert("user", &user);
    context.insert("config", &config);
    context.insert("csrf_token", &get_csrf_token(&session));

    let html = state.tera.render("web/games_chat_config.html", &context)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    Ok(HttpResponse::Ok().content_type("text/html").body(html))
}
```

### 6.3 API Endpoints

Add to `blazing_sun/src/routes/api.rs`:

```rust
// Admin game chat configuration
cfg.route("/games/chat-config", web::get().to(api::game_chat::get_config))
   .route("/games/chat-config", web::put().to(api::game_chat::update_config));
```

### 6.4 Tera Template

Create `blazing_sun/src/resources/views/web/games_chat_config.html`:

```html
{% extends "base.html" %}

{% block title %}Chat Configuration - {{ page_title }}{% endblock %}

{% block content %}
<main class="admin-page">
    <div class="admin-container">
        <h1>Game Chat Configuration</h1>

        <form id="chatConfigForm" class="admin-form">
            <input type="hidden" name="csrf_token" value="{{ csrf_token }}">

            <div class="form-section">
                <h2>Rate Limiting</h2>

                <div class="form-group">
                    <label for="rateLimitMessages">Messages per minute</label>
                    <input type="number" id="rateLimitMessages" name="rate_limit_messages"
                           value="{{ config.rate_limit_messages }}" min="1" max="100">
                    <span class="form-hint">Number of messages a user can send per minute (default: 20)</span>
                </div>
            </div>

            <div class="form-section">
                <h2>Message Limits</h2>

                <div class="form-group">
                    <label for="maxMessageLength">Maximum message length</label>
                    <input type="number" id="maxMessageLength" name="max_message_length"
                           value="{{ config.max_message_length }}" min="50" max="2000">
                    <span class="form-hint">Maximum characters per message (default: 512)</span>
                </div>
            </div>

            <div class="form-section">
                <h2>Profanity Filter</h2>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="profanityFilterEnabled" name="profanity_filter_enabled"
                               {% if config.profanity_filter_enabled %}checked{% endif %}>
                        Enable profanity filter
                    </label>
                    <span class="form-hint">
                        Filter offensive words from chat messages.
                        <strong>Currently OFF by default.</strong>
                    </span>
                </div>

                <div class="form-group" id="profanityWordsGroup"
                     style="{% if not config.profanity_filter_enabled %}display: none;{% endif %}">
                    <label for="profanityWordList">Custom blocked words</label>
                    <textarea id="profanityWordList" name="profanity_word_list" rows="4"
                              placeholder="Enter words separated by commas">{{ config.profanity_word_list | join(", ") }}</textarea>
                    <span class="form-hint">Additional words to filter (comma-separated)</span>
                </div>
            </div>

            <div class="form-section">
                <h2>Emergency Controls</h2>

                <div class="form-group">
                    <label class="checkbox-label warning-label">
                        <input type="checkbox" id="globalMuteEnabled" name="global_mute_enabled"
                               {% if config.global_mute_enabled %}checked{% endif %}>
                        Global chat mute (emergency kill switch)
                    </label>
                    <span class="form-hint text-danger">
                        Disables ALL game chat. Use only in emergencies.
                    </span>
                </div>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save Configuration</button>
            </div>
        </form>
    </div>
</main>
{% endblock %}

{% block scripts %}
<script>
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('chatConfigForm');
    const profanityCheck = document.getElementById('profanityFilterEnabled');
    const profanityWords = document.getElementById('profanityWordsGroup');

    // Toggle profanity words visibility
    profanityCheck.addEventListener('change', () => {
        profanityWords.style.display = profanityCheck.checked ? 'block' : 'none';
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const data = {
            rate_limit_messages: parseInt(formData.get('rate_limit_messages')),
            max_message_length: parseInt(formData.get('max_message_length')),
            profanity_filter_enabled: formData.get('profanity_filter_enabled') === 'on',
            profanity_word_list: formData.get('profanity_word_list')
                .split(',')
                .map(w => w.trim())
                .filter(w => w.length > 0),
            global_mute_enabled: formData.get('global_mute_enabled') === 'on',
        };

        try {
            const response = await fetch('/api/games/chat-config', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': formData.get('csrf_token'),
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                alert('Configuration saved successfully');
            } else {
                const error = await response.json();
                alert('Error: ' + error.message);
            }
        } catch (err) {
            alert('Failed to save configuration');
            console.error(err);
        }
    });
});
</script>
{% endblock %}
```

---

## Phase 7: Testing Plan

**Estimated Effort**: 2 days

### 7.1 Unit Tests

```rust
// tests/games/chat_tests.rs

#[tokio::test]
async fn test_chat_rate_limiting() {
    // Test that rate limits are enforced
}

#[tokio::test]
async fn test_profanity_filter() {
    // Test profanity filtering
}

#[tokio::test]
async fn test_chat_routing_lobby() {
    // Test lobby chat reaches all room members
}

#[tokio::test]
async fn test_chat_routing_players() {
    // Test player chat only reaches players
}

#[tokio::test]
async fn test_chat_routing_spectators() {
    // Test spectator chat only reaches spectators
}

#[tokio::test]
async fn test_user_muting() {
    // Test local muting functionality
}
```

```rust
// tests/games/room_tests.rs

#[tokio::test]
async fn test_enhanced_room_creation() {
    // Test creating room with player count 2-10
}

#[tokio::test]
async fn test_player_deselection() {
    // Test admin can deselect players before game
}

#[tokio::test]
async fn test_disconnect_timeout() {
    // Test 30 second auto-deselect on disconnect
}

#[tokio::test]
async fn test_admin_spectator_designation() {
    // Test designating admin spectator
}

#[tokio::test]
async fn test_spectator_kick_ban() {
    // Test kicking and banning spectators
}

#[tokio::test]
async fn test_role_switching_blocked_after_start() {
    // Test that role switching is disabled after game starts
}

#[tokio::test]
async fn test_rejoin_as_player() {
    // Test rejoining returns correct role
}

#[tokio::test]
async fn test_rejoin_as_spectator() {
    // Test spectators rejoin as spectators
}

#[tokio::test]
async fn test_unselected_removed_on_start() {
    // Test lobby members are removed when game starts
}
```

### 7.2 Integration Tests

```javascript
// tests/integration/bigger_dice_enhanced.spec.js

describe('Bigger Dice Enhanced Features', () => {
    describe('Chat System', () => {
        it('should show lobby chat before game starts');
        it('should separate player and spectator chat after game starts');
        it('should enforce rate limits');
        it('should allow muting other users');
        it('should persist chat to MongoDB');
    });

    describe('Player Management', () => {
        it('should create room with configurable player count');
        it('should enforce ready requirement for all players');
        it('should auto-deselect on 30s disconnect');
        it('should allow admin to deselect players');
    });

    describe('Spectator System', () => {
        it('should respect allow_spectators flag');
        it('should enforce max 10 spectators');
        it('should block mid-game spectator joins');
        it('should allow admin spectator to moderate');
    });

    describe('Rejoin System', () => {
        it('should rejoin players as players');
        it('should rejoin spectators as spectators');
        it('should deny unselected player rejoin');
    });
});
```

---

## Implementation Checklist

### Phase 1: Database Schema (2 days)
- [ ] Create `game_chat_config` migration
- [ ] Create `alter_game_rooms_for_enhancements` migration
- [ ] Create `game_player_disconnects` migration
- [ ] Create `game_user_mutes` migration
- [ ] Create MongoDB `game_chat_messages` collection and indexes
- [ ] Create stored procedures for CRUD operations
- [ ] Run migrations and verify schema

### Phase 2: Backend Types (3 days)
- [ ] Add `ChatType`, `ChatMessage`, `ChatConfig` types
- [ ] Add `RoomRole`, `EnhancedGamePlayer` types
- [ ] Add `PlayerDisconnect` type
- [ ] Add new `GameCommand` variants
- [ ] Add new `GameEvent` variants
- [ ] Update `event_type_name()` method
- [ ] Build and verify types compile

### Phase 3: Backend Handlers (4 days)
- [ ] Create `ChatCommandHandler` in new `chat.rs` module
- [ ] Implement rate limiting logic
- [ ] Implement profanity filtering
- [ ] Implement chat routing (lobby/player/spectator)
- [ ] Add MongoDB chat persistence
- [ ] Add enhanced room creation handler
- [ ] Add deselect player handler
- [ ] Add disconnect timeout checker
- [ ] Add admin spectator designation handler
- [ ] Add spectator kick/ban handlers
- [ ] Update game start to remove unselected players
- [ ] Implement rejoin role determination
- [ ] Register new handlers in event consumer

### Phase 4: WebSocket Gateway (2 days)
- [ ] Add new `ClientMessage` variants
- [ ] Add new `ServerMessage` variants
- [ ] Add message routing in `server/mod.rs`
- [ ] Add event-to-message conversion for new events
- [ ] Test message round-trip
- [ ] Build ws_gateway and verify

### Phase 5: Frontend (5 days)
- [ ] Create `ChatPanel.js` component
- [ ] Add chat styles to SCSS
- [ ] Integrate chat panel into BiggerDice.js
- [ ] Update create room modal with new options
- [ ] Add player count display
- [ ] Add disconnect indicators
- [ ] Handle all new WebSocket events
- [ ] Add mute UI
- [ ] Add chat collapse functionality
- [ ] Test all chat features
- [ ] Test player management features

### Phase 6: Admin Page (2 days)
- [ ] Add web route for `/games/chat-configuration`
- [ ] Create controller method
- [ ] Add API endpoints for config CRUD
- [ ] Create Tera template
- [ ] Add admin page styles
- [ ] Test configuration updates

### Phase 7: Testing (2 days)
- [ ] Write unit tests for chat system
- [ ] Write unit tests for room management
- [ ] Write integration tests
- [ ] Manual testing with multiple browsers
- [ ] Performance testing with rate limits
- [ ] Fix any discovered issues

---

## Complexity Estimates

| Phase | Description | Complexity | Days |
|-------|-------------|------------|------|
| 1 | Database Schema | Medium | 2 |
| 2 | Backend Types | Medium | 3 |
| 3 | Backend Handlers | High | 4 |
| 4 | WebSocket Gateway | Medium | 2 |
| 5 | Frontend | High | 5 |
| 6 | Admin Page | Low | 2 |
| 7 | Testing | Medium | 2 |
| **Total** | | | **20** |

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| MongoDB connection issues | High | Low | Fallback to in-memory chat, graceful degradation |
| Rate limiting false positives | Medium | Medium | Tunable config, admin override |
| WebSocket message ordering | High | Low | Sequence numbers, client-side reordering |
| Disconnect detection latency | Medium | Medium | Heartbeat interval tuning, grace period |
| Chat history loading performance | Medium | Medium | Pagination, indexes, caching |

---

## Dependencies

### External Crates (if not already present)
- `rustrict` - Profanity filter library (optional, can use custom implementation)

### Internal Dependencies
- MongoDB connection must be configured
- PostgreSQL migrations must run in order
- ws_gateway must be redeployed after protocol changes

---

## Future Enhancements (Out of Scope)

1. **Chat Search** - Full-text search in chat history
2. **Chat Export** - Download chat history as JSON/CSV
3. **Emoji Reactions** - React to messages
4. **Message Editing** - Edit sent messages within time limit
5. **Direct Messages** - Private player-to-player chat
6. **Voice Chat** - WebRTC voice communication
7. **Chat Moderation Dashboard** - View flagged messages, ban history

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-10 | Game Developer Agent | Initial comprehensive plan |
