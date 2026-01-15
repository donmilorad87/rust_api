//! MongoDB game chat operations
//!
//! Stores chat messages for game rooms with channel separation.

use chrono::{DateTime, Utc};
use mongodb::bson::{doc, oid::ObjectId, DateTime as BsonDateTime, Document};
use mongodb::options::{FindOptions, IndexOptions};
use mongodb::{Collection, Database, IndexModel};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};

/// Collection name for game chat messages
const COLLECTION_GAME_CHAT: &str = "game_chat_messages";

/// Chat channel types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChatChannel {
    /// Lobby chat (pre-game, everyone can see)
    Lobby,
    /// Players-only chat (in-game)
    Players,
    /// Spectators-only chat (in-game)
    Spectators,
}

impl std::fmt::Display for ChatChannel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChatChannel::Lobby => write!(f, "lobby"),
            ChatChannel::Players => write!(f, "players"),
            ChatChannel::Spectators => write!(f, "spectators"),
        }
    }
}

impl std::str::FromStr for ChatChannel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "lobby" => Ok(ChatChannel::Lobby),
            "players" => Ok(ChatChannel::Players),
            "spectators" => Ok(ChatChannel::Spectators),
            _ => Err(format!("Unknown chat channel: {}", s)),
        }
    }
}

/// A chat message in a game room
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameChatMessage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub room_id: String,
    pub channel: ChatChannel,
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub content: String,
    pub is_system: bool,           // System messages (join/leave notifications)
    pub is_moderated: bool,        // Was filtered by profanity filter
    pub created_at: DateTime<Utc>,
}

/// MongoDB game chat client
pub struct MongoGameChatClient {
    db: Arc<Database>,
}

impl MongoGameChatClient {
    /// Create a new MongoDB game chat client
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Get the chat messages collection
    fn messages(&self) -> Collection<GameChatMessage> {
        self.db.collection(COLLECTION_GAME_CHAT)
    }

    /// Get the raw collection for aggregations
    fn messages_raw(&self) -> Collection<Document> {
        self.db.collection(COLLECTION_GAME_CHAT)
    }

    /// Initialize indexes for the game chat collection
    pub async fn init_indexes(&self) -> Result<(), mongodb::error::Error> {
        let collection = self.messages();

        // Index for querying messages by room and channel
        let room_channel_index = IndexModel::builder()
            .keys(doc! { "room_id": 1, "channel": 1, "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("room_channel_idx".to_string())
                    .build(),
            )
            .build();

        // Index for querying messages by room only
        let room_index = IndexModel::builder()
            .keys(doc! { "room_id": 1, "created_at": -1 })
            .options(IndexOptions::builder().name("room_messages_idx".to_string()).build())
            .build();

        // Index for querying messages by user (for moderation)
        let user_index = IndexModel::builder()
            .keys(doc! { "user_id": 1, "created_at": -1 })
            .options(IndexOptions::builder().name("user_messages_idx".to_string()).build())
            .build();

        // TTL index to auto-delete old messages (7 days)
        let ttl_index = IndexModel::builder()
            .keys(doc! { "created_at": 1 })
            .options(
                IndexOptions::builder()
                    .name("ttl_idx".to_string())
                    .expire_after(std::time::Duration::from_secs(7 * 24 * 60 * 60))
                    .build(),
            )
            .build();

        collection
            .create_indexes([room_channel_index, room_index, user_index, ttl_index])
            .await?;

        info!("MongoDB game chat indexes initialized");
        Ok(())
    }

    /// Save a chat message
    pub async fn save_message(
        &self,
        room_id: &str,
        channel: ChatChannel,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        content: &str,
        is_system: bool,
        is_moderated: bool,
    ) -> Result<ObjectId, mongodb::error::Error> {
        let message = GameChatMessage {
            id: None,
            room_id: room_id.to_string(),
            channel,
            user_id,
            username: username.to_string(),
            avatar_id,
            content: content.to_string(),
            is_system,
            is_moderated,
            created_at: Utc::now(),
        };

        let result = self.messages().insert_one(&message).await?;
        let id = result.inserted_id.as_object_id().unwrap();

        Ok(id)
    }

    /// Save a system message (join/leave notifications, etc.)
    pub async fn save_system_message(
        &self,
        room_id: &str,
        channel: ChatChannel,
        content: &str,
    ) -> Result<ObjectId, mongodb::error::Error> {
        self.save_message(room_id, channel, 0, "System", None, content, true, false)
            .await
    }

    /// Get recent messages for a room and channel
    pub async fn get_messages(
        &self,
        room_id: &str,
        channel: ChatChannel,
        limit: i64,
        before: Option<DateTime<Utc>>,
    ) -> Result<Vec<GameChatMessage>, mongodb::error::Error> {
        let mut filter = doc! {
            "room_id": room_id,
            "channel": channel.to_string()
        };

        if let Some(before_time) = before {
            let bson_time = BsonDateTime::from_millis(before_time.timestamp_millis());
            filter.insert("created_at", doc! { "$lt": bson_time });
        }

        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self.messages().find(filter).with_options(options).await?;
        let mut messages = Vec::new();

        use futures::StreamExt;
        while let Some(msg) = cursor.next().await {
            match msg {
                Ok(m) => messages.push(m),
                Err(e) => error!("Error reading chat message: {}", e),
            }
        }

        // Reverse to get chronological order
        messages.reverse();
        Ok(messages)
    }

    /// Get all messages for a room (all channels)
    pub async fn get_all_room_messages(
        &self,
        room_id: &str,
        limit: i64,
    ) -> Result<Vec<GameChatMessage>, mongodb::error::Error> {
        let filter = doc! { "room_id": room_id };
        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self.messages().find(filter).with_options(options).await?;
        let mut messages = Vec::new();

        use futures::StreamExt;
        while let Some(msg) = cursor.next().await {
            match msg {
                Ok(m) => messages.push(m),
                Err(e) => error!("Error reading chat message: {}", e),
            }
        }

        messages.reverse();
        Ok(messages)
    }

    /// Delete all messages for a room
    pub async fn delete_room_messages(
        &self,
        room_id: &str,
    ) -> Result<u64, mongodb::error::Error> {
        let result = self
            .messages()
            .delete_many(doc! { "room_id": room_id })
            .await?;
        Ok(result.deleted_count)
    }

    /// Get message count for a room
    pub async fn get_message_count(
        &self,
        room_id: &str,
        channel: Option<ChatChannel>,
    ) -> Result<u64, mongodb::error::Error> {
        let mut filter = doc! { "room_id": room_id };
        if let Some(ch) = channel {
            filter.insert("channel", ch.to_string());
        }

        self.messages().count_documents(filter).await
    }

    /// Get user's recent messages (for rate limiting check)
    pub async fn get_user_recent_message_count(
        &self,
        room_id: &str,
        user_id: i64,
        since: DateTime<Utc>,
    ) -> Result<u64, mongodb::error::Error> {
        let bson_since = BsonDateTime::from_millis(since.timestamp_millis());
        let filter = doc! {
            "room_id": room_id,
            "user_id": user_id,
            "created_at": { "$gte": bson_since },
            "is_system": false
        };

        self.messages().count_documents(filter).await
    }

    /// Get messages from a user (for moderation review)
    pub async fn get_user_messages(
        &self,
        user_id: i64,
        limit: i64,
    ) -> Result<Vec<GameChatMessage>, mongodb::error::Error> {
        let filter = doc! { "user_id": user_id };
        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self.messages().find(filter).with_options(options).await?;
        let mut messages = Vec::new();

        use futures::StreamExt;
        while let Some(msg) = cursor.next().await {
            match msg {
                Ok(m) => messages.push(m),
                Err(e) => error!("Error reading user message: {}", e),
            }
        }

        Ok(messages)
    }

    /// Get moderated messages for review
    pub async fn get_moderated_messages(
        &self,
        limit: i64,
    ) -> Result<Vec<GameChatMessage>, mongodb::error::Error> {
        let filter = doc! { "is_moderated": true };
        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self.messages().find(filter).with_options(options).await?;
        let mut messages = Vec::new();

        use futures::StreamExt;
        while let Some(msg) = cursor.next().await {
            match msg {
                Ok(m) => messages.push(m),
                Err(e) => error!("Error reading moderated message: {}", e),
            }
        }

        Ok(messages)
    }
}
