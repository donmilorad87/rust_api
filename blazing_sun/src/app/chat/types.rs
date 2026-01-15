//! Chat types shared across modules

use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// Custom deserializer that accepts both i64 and string representations
fn deserialize_i64_from_string<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;

    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrInt {
        String(String),
        Int(i64),
    }

    match StringOrInt::deserialize(deserializer)? {
        StringOrInt::String(s) => s.parse::<i64>().map_err(D::Error::custom),
        StringOrInt::Int(i) => Ok(i),
    }
}

/// Custom serializer for i64 that outputs as a string
fn serialize_i64_as_string<S>(value: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

/// Private message structure (stored in MongoDB)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivateMessage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<mongodb::bson::oid::ObjectId>,
    pub sender_id: i64,
    pub recipient_id: i64,
    pub content: String,
    pub message_type: MessageType,
    pub read: bool,
    pub read_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_by_sender: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_by_recipient: Option<bool>,
}

/// Message type enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MessageType {
    Text,
    Image,
    System,
}

impl Default for MessageType {
    fn default() -> Self {
        MessageType::Text
    }
}

/// Conversation summary for listing chats
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationSummary {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub last_message: String,
    pub last_message_at: DateTime<Utc>,
    pub unread_count: i64,
}

/// Chat command from WebSocket gateway (received via Kafka)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatCommand {
    #[serde(rename = "send_message")]
    SendMessage {
        sender_id: i64,
        recipient_id: i64,
        content: String,
        socket_id: String,
    },
    #[serde(rename = "send_lobby_message")]
    SendLobbyMessage {
        sender_id: i64,
        lobby_id: i64,
        content: String,
        socket_id: String,
    },
    #[serde(rename = "mark_read")]
    MarkRead {
        user_id: i64,
        other_user_id: i64,
    },
    #[serde(rename = "typing")]
    Typing {
        sender_id: i64,
        recipient_id: i64,
        is_typing: bool,
    },
}

/// Chat event to send back to WebSocket gateway (published via Kafka)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ChatEvent {
    #[serde(rename = "message_received")]
    MessageReceived {
        message_id: String,
        sender_id: i64,
        sender_username: String,
        sender_avatar_id: Option<i64>,
        recipient_id: i64,
        content: String,
        message_type: String,
        created_at: String,
    },
    #[serde(rename = "lobby_message_received")]
    LobbyMessageReceived {
        message_id: i64,
        lobby_id: i64,
        sender_id: i64,
        sender_username: String,
        sender_avatar_id: Option<i64>,
        content: String,
        message_type: String,
        created_at: String,
    },
    #[serde(rename = "message_read")]
    MessageRead {
        reader_id: i64,
        sender_id: i64,
        read_at: String,
    },
    #[serde(rename = "typing_indicator")]
    TypingIndicator {
        sender_id: i64,
        recipient_id: i64,
        is_typing: bool,
    },
    #[serde(rename = "error")]
    Error {
        code: String,
        message: String,
        socket_id: String,
    },
}

/// Event envelope for Kafka messages (matches ws_gateway protocol)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub event_id: String,
    pub event_type: String,
    pub timestamp: String,
    #[serde(default)]
    pub correlation_id: Option<String>,
    #[serde(default = "default_producer")]
    pub producer: String,
    pub actor: Actor,
    pub audience: Audience,
    pub payload: serde_json::Value,
}

fn default_producer() -> String {
    "blazing_sun".to_string()
}

/// Actor who triggered the event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Actor {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string"
    )]
    pub user_id: i64,
    pub username: String,
    #[serde(default)]
    pub socket_id: String,
    #[serde(default)]
    pub roles: Vec<String>,
}

/// Audience type for routing events
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AudienceType {
    User,
    Users,
    Room,
    Broadcast,
    Spectators,
    Players,
}

/// Target audience for the event (matches ws_gateway format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Audience {
    #[serde(rename = "type")]
    pub audience_type: AudienceType,
    #[serde(default)]
    pub user_ids: Vec<String>,
    #[serde(default)]
    pub room_id: Option<String>,
    #[serde(default)]
    pub game_id: Option<String>,
}

impl Audience {
    /// Create an audience for a single user
    pub fn user(user_id: i64) -> Self {
        Self {
            audience_type: AudienceType::User,
            user_ids: vec![user_id.to_string()],
            room_id: None,
            game_id: None,
        }
    }

    /// Create an audience for multiple users
    pub fn users(user_ids: Vec<i64>) -> Self {
        Self {
            audience_type: AudienceType::Users,
            user_ids: user_ids.into_iter().map(|id| id.to_string()).collect(),
            room_id: None,
            game_id: None,
        }
    }

    /// Create an audience for a room (or lobby)
    pub fn room(room_id: impl Into<String>) -> Self {
        Self {
            audience_type: AudienceType::Room,
            user_ids: vec![],
            room_id: Some(room_id.into()),
            game_id: None,
        }
    }

    /// Create an audience for broadcast
    pub fn broadcast() -> Self {
        Self {
            audience_type: AudienceType::Broadcast,
            user_ids: vec![],
            room_id: None,
            game_id: None,
        }
    }
}
