//! Chat event handler
//!
//! Processes chat commands from the WebSocket gateway and publishes chat events back.

use crate::app::chat::mongodb_chat::MongoChatClient;
use crate::app::chat::types::{Audience, ChatEvent, EventEnvelope, MessageType};
use crate::app::db_query::read::{friend, lobby, user};
use crate::app::db_query::mutations::lobby as lobby_mutations;
use crate::events::consumer::{EventHandler, EventHandlerError};
use crate::events::producer::EventProducer;
use crate::events::topics::topic;
use async_trait::async_trait;
use mongodb::Database;
use serde_json::Value;
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Handler for chat commands from WebSocket gateway
pub struct ChatCommandHandler {
    db: Arc<Mutex<Pool<Postgres>>>,
    mongodb: Option<Arc<Database>>,
    producer: Option<Arc<EventProducer>>,
}

impl ChatCommandHandler {
    pub fn new(
        db: Arc<Mutex<Pool<Postgres>>>,
        mongodb: Option<Arc<Database>>,
        producer: Option<Arc<EventProducer>>,
    ) -> Self {
        Self { db, mongodb, producer }
    }

    /// Send an event back to the WebSocket gateway via Kafka
    async fn publish_chat_event(&self, event: ChatEvent, audience: Audience) -> Result<(), EventHandlerError> {
        let Some(producer) = &self.producer else {
            warn!("No Kafka producer available for chat events");
            return Ok(());
        };

        let envelope = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: "chat.event".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            correlation_id: None,
            producer: "blazing_sun".to_string(),
            actor: crate::app::chat::types::Actor {
                user_id: 0, // System
                username: "system".to_string(),
                socket_id: String::new(),
                roles: vec![],
            },
            audience,
            payload: serde_json::to_value(&event).unwrap_or(Value::Null),
        };

        let bytes = serde_json::to_vec(&envelope)
            .map_err(|e| EventHandlerError::Fatal(format!("Failed to serialize chat event: {}", e)))?;

        producer
            .send_raw(topic::CHAT_EVENTS, None, &bytes)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to publish chat event: {}", e)))?;

        Ok(())
    }

    /// Handle send_message command (private message)
    async fn handle_send_message(
        &self,
        sender_id: i64,
        recipient_id: i64,
        content: &str,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        let db = self.db.lock().await;

        // Check if sender can message recipient (friends or admin)
        let can_message = friend::can_message_user(&db, sender_id, recipient_id).await;
        if !can_message {
            // Send error back to sender
            let error_event = ChatEvent::Error {
                code: "not_friends".to_string(),
                message: "You can only message friends or people who allow messages from everyone".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_chat_event(error_event, Audience::user(sender_id)).await?;
            return Ok(());
        }

        // Get sender info
        let sender = user::get_by_id(&db, sender_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to get sender: {}", e)))?;

        // Store message in MongoDB
        let Some(mongodb) = &self.mongodb else {
            return Err(EventHandlerError::Fatal("MongoDB not available for private messages".to_string()));
        };

        let chat_client = MongoChatClient::new(mongodb.clone());
        let message = chat_client
            .send_message(sender_id, recipient_id, content, MessageType::Text)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to store message: {}", e)))?;

        let message_id = message.id.map(|id| id.to_hex()).unwrap_or_default();

        // Send event to recipient
        let message_event = ChatEvent::MessageReceived {
            message_id: message_id.clone(),
            sender_id,
            sender_username: sender.first_name.clone(),
            sender_avatar_id: sender.avatar_id,
            recipient_id,
            content: content.to_string(),
            message_type: "text".to_string(),
            created_at: message.created_at.to_rfc3339(),
        };

        self.publish_chat_event(
            message_event.clone(),
            Audience::user(recipient_id),
        )
        .await?;

        // Also send confirmation back to sender
        self.publish_chat_event(
            message_event,
            Audience::user(sender_id),
        )
        .await?;

        info!(
            sender_id = %sender_id,
            recipient_id = %recipient_id,
            message_id = %message_id,
            "Private message sent"
        );

        Ok(())
    }

    /// Handle send_lobby_message command (public chat)
    async fn handle_send_lobby_message(
        &self,
        sender_id: i64,
        lobby_id: i64,
        content: &str,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        let db = self.db.lock().await;

        // Verify lobby exists
        if !lobby::exists(&db, lobby_id).await {
            let error_event = ChatEvent::Error {
                code: "lobby_not_found".to_string(),
                message: "The lobby does not exist".to_string(),
                socket_id: socket_id.to_string(),
            };
            self.publish_chat_event(error_event, Audience::user(sender_id)).await?;
            return Ok(());
        }

        // Get sender info
        let sender = user::get_by_id(&db, sender_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to get sender: {}", e)))?;

        // Store message in PostgreSQL
        let message = lobby_mutations::send_message(&db, lobby_id, sender_id, content, None)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to store lobby message: {}", e)))?;

        // Send event to all users in the lobby
        let message_event = ChatEvent::LobbyMessageReceived {
            message_id: message.id,
            lobby_id,
            sender_id,
            sender_username: sender.first_name.clone(),
            sender_avatar_id: sender.avatar_id,
            content: content.to_string(),
            message_type: message.message_type,
            created_at: message.created_at.to_rfc3339(),
        };

        self.publish_chat_event(
            message_event,
            Audience::room(lobby_id.to_string()),
        )
        .await?;

        info!(
            sender_id = %sender_id,
            lobby_id = %lobby_id,
            message_id = %message.id,
            "Lobby message sent"
        );

        Ok(())
    }

    /// Handle mark_read command
    async fn handle_mark_read(
        &self,
        user_id: i64,
        other_user_id: i64,
    ) -> Result<(), EventHandlerError> {
        let Some(mongodb) = &self.mongodb else {
            return Err(EventHandlerError::Fatal("MongoDB not available".to_string()));
        };

        let chat_client = MongoChatClient::new(mongodb.clone());
        let count = chat_client
            .mark_messages_read(user_id, other_user_id)
            .await
            .map_err(|e| EventHandlerError::Retryable(format!("Failed to mark messages read: {}", e)))?;

        if count > 0 {
            // Notify the sender that their messages were read
            let read_event = ChatEvent::MessageRead {
                reader_id: user_id,
                sender_id: other_user_id,
                read_at: chrono::Utc::now().to_rfc3339(),
            };

            self.publish_chat_event(
                read_event,
                Audience::user(other_user_id),
            )
            .await?;
        }

        info!(
            user_id = %user_id,
            other_user_id = %other_user_id,
            count = %count,
            "Messages marked as read"
        );

        Ok(())
    }

    /// Handle typing indicator
    async fn handle_typing(
        &self,
        sender_id: i64,
        recipient_id: i64,
        is_typing: bool,
    ) -> Result<(), EventHandlerError> {
        let typing_event = ChatEvent::TypingIndicator {
            sender_id,
            recipient_id,
            is_typing,
        };

        self.publish_chat_event(
            typing_event,
            Audience::user(recipient_id),
        )
        .await?;

        Ok(())
    }
}

#[async_trait]
impl EventHandler for ChatCommandHandler {
    fn name(&self) -> &'static str {
        "chat_command_handler"
    }

    fn topics(&self) -> Vec<&'static str> {
        vec![topic::CHAT_COMMANDS]
    }

    async fn handle(&self, event: &crate::events::types::DomainEvent) -> Result<(), EventHandlerError> {
        // The payload from ws_gateway is an EventEnvelope
        let envelope: EventEnvelope = serde_json::from_value(event.payload.clone())
            .map_err(|e| EventHandlerError::Fatal(format!("Invalid chat command envelope: {}", e)))?;

        // Extract the command type from the envelope's payload
        let command_type = envelope.payload.get("type")
            .and_then(|v| v.as_str())
            .ok_or_else(|| EventHandlerError::Fatal("Missing command type".to_string()))?;

        match command_type {
            "send_message" => {
                let sender_id = envelope.payload.get("sender_id")
                    .and_then(|v| v.as_i64())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing sender_id".to_string()))?;
                let recipient_id = envelope.payload.get("recipient_id")
                    .and_then(|v| v.as_i64())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing recipient_id".to_string()))?;
                let content = envelope.payload.get("content")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing content".to_string()))?;
                let socket_id = envelope.payload.get("socket_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                self.handle_send_message(sender_id, recipient_id, content, socket_id).await
            }
            "send_lobby_message" => {
                let sender_id = envelope.payload.get("sender_id")
                    .and_then(|v| v.as_i64())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing sender_id".to_string()))?;
                let lobby_id = envelope.payload.get("lobby_id")
                    .and_then(|v| v.as_i64())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing lobby_id".to_string()))?;
                let content = envelope.payload.get("content")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing content".to_string()))?;
                let socket_id = envelope.payload.get("socket_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                self.handle_send_lobby_message(sender_id, lobby_id, content, socket_id).await
            }
            "mark_read" => {
                let user_id = envelope.payload.get("user_id")
                    .and_then(|v| v.as_i64())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing user_id".to_string()))?;
                let other_user_id = envelope.payload.get("other_user_id")
                    .and_then(|v| v.as_i64())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing other_user_id".to_string()))?;

                self.handle_mark_read(user_id, other_user_id).await
            }
            "typing" => {
                let sender_id = envelope.payload.get("sender_id")
                    .and_then(|v| v.as_i64())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing sender_id".to_string()))?;
                let recipient_id = envelope.payload.get("recipient_id")
                    .and_then(|v| v.as_i64())
                    .ok_or_else(|| EventHandlerError::Fatal("Missing recipient_id".to_string()))?;
                let is_typing = envelope.payload.get("is_typing")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);

                self.handle_typing(sender_id, recipient_id, is_typing).await
            }
            other => {
                warn!(command_type = %other, "Unknown chat command type");
                Err(EventHandlerError::Skip)
            }
        }
    }
}
