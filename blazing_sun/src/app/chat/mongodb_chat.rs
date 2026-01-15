//! MongoDB chat operations
//!
//! Handles private message storage and retrieval in MongoDB.
//! Private chats are stored indefinitely (unlike public lobby messages which are capped).

use super::types::{ConversationSummary, MessageType, PrivateMessage};
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId, Document};
use mongodb::options::{FindOptions, IndexOptions, UpdateOptions};
use mongodb::{Collection, Database, IndexModel};
use std::sync::Arc;
use tracing::{error, info};

/// Collection name for private messages
const COLLECTION_PRIVATE_MESSAGES: &str = "private_messages";

/// MongoDB chat client
pub struct MongoChatClient {
    db: Arc<Database>,
}

impl MongoChatClient {
    /// Create a new MongoDB chat client
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Get the private messages collection
    fn messages(&self) -> Collection<PrivateMessage> {
        self.db.collection(COLLECTION_PRIVATE_MESSAGES)
    }

    /// Get the raw messages collection for aggregations
    fn messages_raw(&self) -> Collection<Document> {
        self.db.collection(COLLECTION_PRIVATE_MESSAGES)
    }

    /// Initialize indexes for the private messages collection
    /// Call this on application startup
    pub async fn init_indexes(&self) -> Result<(), mongodb::error::Error> {
        let collection = self.messages();

        // Index for querying messages between two users
        let conversation_index = IndexModel::builder()
            .keys(doc! { "sender_id": 1, "recipient_id": 1, "created_at": -1 })
            .options(IndexOptions::builder().name("conversation_idx".to_string()).build())
            .build();

        // Index for querying a user's conversations
        let user_messages_index = IndexModel::builder()
            .keys(doc! { "recipient_id": 1, "read": 1 })
            .options(IndexOptions::builder().name("user_unread_idx".to_string()).build())
            .build();

        // Index for efficient conversation listing
        let created_at_index = IndexModel::builder()
            .keys(doc! { "created_at": -1 })
            .options(IndexOptions::builder().name("created_at_idx".to_string()).build())
            .build();

        collection
            .create_indexes([conversation_index, user_messages_index, created_at_index])
            .await?;

        info!("MongoDB chat indexes initialized");
        Ok(())
    }

    /// Send a private message
    pub async fn send_message(
        &self,
        sender_id: i64,
        recipient_id: i64,
        content: &str,
        message_type: MessageType,
    ) -> Result<PrivateMessage, mongodb::error::Error> {
        let message = PrivateMessage {
            id: None,
            sender_id,
            recipient_id,
            content: content.to_string(),
            message_type,
            read: false,
            read_at: None,
            created_at: Utc::now(),
            deleted_by_sender: None,
            deleted_by_recipient: None,
        };

        let result = self.messages().insert_one(&message).await?;
        let inserted_id = result.inserted_id.as_object_id().unwrap();

        Ok(PrivateMessage {
            id: Some(inserted_id),
            ..message
        })
    }

    /// Get messages between two users (conversation)
    pub async fn get_conversation(
        &self,
        user_id: i64,
        other_user_id: i64,
        limit: i64,
        before_id: Option<ObjectId>,
    ) -> Result<Vec<PrivateMessage>, mongodb::error::Error> {
        let mut filter = doc! {
            "$or": [
                { "sender_id": user_id, "recipient_id": other_user_id },
                { "sender_id": other_user_id, "recipient_id": user_id }
            ],
            "$and": [
                {
                    "$or": [
                        { "deleted_by_sender": { "$ne": true } },
                        { "sender_id": { "$ne": user_id } }
                    ]
                },
                {
                    "$or": [
                        { "deleted_by_recipient": { "$ne": true } },
                        { "recipient_id": { "$ne": user_id } }
                    ]
                }
            ]
        };

        if let Some(before) = before_id {
            filter.insert("_id", doc! { "$lt": before });
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
                Err(e) => error!("Error reading message: {}", e),
            }
        }

        Ok(messages)
    }

    /// Mark messages as read
    pub async fn mark_messages_read(
        &self,
        user_id: i64,
        sender_id: i64,
    ) -> Result<u64, mongodb::error::Error> {
        let filter = doc! {
            "sender_id": sender_id,
            "recipient_id": user_id,
            "read": false
        };

        let update = doc! {
            "$set": {
                "read": true,
                "read_at": Utc::now().to_rfc3339()
            }
        };

        let result = self.messages_raw().update_many(filter, update).await?;
        Ok(result.modified_count)
    }

    /// Count unread messages for a user
    pub async fn count_unread(&self, user_id: i64) -> Result<u64, mongodb::error::Error> {
        let filter = doc! {
            "recipient_id": user_id,
            "read": false
        };

        self.messages().count_documents(filter).await
    }

    /// Count unread messages from a specific sender
    pub async fn count_unread_from(
        &self,
        user_id: i64,
        sender_id: i64,
    ) -> Result<u64, mongodb::error::Error> {
        let filter = doc! {
            "recipient_id": user_id,
            "sender_id": sender_id,
            "read": false
        };

        self.messages().count_documents(filter).await
    }

    /// Get conversation list for a user (recent conversations with last message)
    pub async fn get_conversations(
        &self,
        user_id: i64,
        limit: i64,
    ) -> Result<Vec<Document>, mongodb::error::Error> {
        let pipeline = vec![
            // Match messages involving this user
            doc! {
                "$match": {
                    "$or": [
                        { "sender_id": user_id },
                        { "recipient_id": user_id }
                    ]
                }
            },
            // Sort by created_at descending
            doc! { "$sort": { "created_at": -1 } },
            // Group by conversation partner
            doc! {
                "$group": {
                    "_id": {
                        "$cond": {
                            "if": { "$eq": ["$sender_id", user_id] },
                            "then": "$recipient_id",
                            "else": "$sender_id"
                        }
                    },
                    "last_message": { "$first": "$content" },
                    "last_message_at": { "$first": "$created_at" },
                    "last_message_type": { "$first": "$message_type" },
                    "unread_count": {
                        "$sum": {
                            "$cond": {
                                "if": {
                                    "$and": [
                                        { "$eq": ["$recipient_id", user_id] },
                                        { "$eq": ["$read", false] }
                                    ]
                                },
                                "then": 1,
                                "else": 0
                            }
                        }
                    }
                }
            },
            // Sort by last message time
            doc! { "$sort": { "last_message_at": -1 } },
            // Limit results
            doc! { "$limit": limit },
        ];

        let mut cursor = self.messages_raw().aggregate(pipeline).await?;
        let mut conversations = Vec::new();

        use futures::StreamExt;
        while let Some(doc) = cursor.next().await {
            match doc {
                Ok(d) => conversations.push(d),
                Err(e) => error!("Error reading conversation: {}", e),
            }
        }

        Ok(conversations)
    }

    /// Delete a message (soft delete for the user)
    pub async fn delete_message(
        &self,
        message_id: ObjectId,
        user_id: i64,
    ) -> Result<bool, mongodb::error::Error> {
        // First, check if user is sender or recipient
        let filter = doc! { "_id": message_id };
        let msg = self.messages().find_one(filter.clone()).await?;

        let Some(message) = msg else {
            return Ok(false);
        };

        let update = if message.sender_id == user_id {
            doc! { "$set": { "deleted_by_sender": true } }
        } else if message.recipient_id == user_id {
            doc! { "$set": { "deleted_by_recipient": true } }
        } else {
            return Ok(false);
        };

        let result = self.messages_raw().update_one(filter, update).await?;
        Ok(result.modified_count > 0)
    }

    /// Get a single message by ID
    pub async fn get_message(
        &self,
        message_id: ObjectId,
    ) -> Result<Option<PrivateMessage>, mongodb::error::Error> {
        let filter = doc! { "_id": message_id };
        self.messages().find_one(filter).await
    }

    /// Check if user can access a message (is sender or recipient)
    pub async fn can_access_message(
        &self,
        message_id: ObjectId,
        user_id: i64,
    ) -> Result<bool, mongodb::error::Error> {
        let filter = doc! {
            "_id": message_id,
            "$or": [
                { "sender_id": user_id },
                { "recipient_id": user_id }
            ]
        };

        let count = self.messages().count_documents(filter).await?;
        Ok(count > 0)
    }
}
