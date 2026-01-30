//! MongoDB multiplayer roulette operations
//!
//! Stores multiplayer roulette data:
//! - roulette_bets: Individual user bets for each spin
//! - roulette_spins: Spin results (winning number, totals)
//! - roulette_chat: Global chat messages

use super::roulette::RouletteBet;
use super::roulette_types::{
    RouletteBetRecord, RouletteChatRecord, RouletteSpinRecord, SpinResultSummary,
};
use chrono::Utc;
use futures::StreamExt;
use mongodb::bson::{doc, oid::ObjectId, Document};
use mongodb::options::{FindOptions, IndexOptions};
use mongodb::{Collection, Database, IndexModel};
use std::sync::Arc;
use tracing::{error, info};

// =============================================================================
// Collection Names
// =============================================================================

const COLLECTION_ROULETTE_BETS: &str = "roulette_multiplayer_bets";
const COLLECTION_ROULETTE_SPINS: &str = "roulette_multiplayer_spins";
const COLLECTION_ROULETTE_CHAT: &str = "roulette_multiplayer_chat";

// =============================================================================
// MongoDB Client
// =============================================================================

/// MongoDB client for multiplayer roulette operations
pub struct MongoRouletteMultiplayerClient {
    db: Arc<Database>,
}

impl MongoRouletteMultiplayerClient {
    /// Create a new MongoDB roulette multiplayer client
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Get the bets collection
    fn bets(&self) -> Collection<RouletteBetRecord> {
        self.db.collection(COLLECTION_ROULETTE_BETS)
    }

    /// Get the spins collection
    fn spins(&self) -> Collection<RouletteSpinRecord> {
        self.db.collection(COLLECTION_ROULETTE_SPINS)
    }

    /// Get the chat collection
    fn chat(&self) -> Collection<RouletteChatRecord> {
        self.db.collection(COLLECTION_ROULETTE_CHAT)
    }

    /// Get raw bets collection for aggregations
    fn bets_raw(&self) -> Collection<Document> {
        self.db.collection(COLLECTION_ROULETTE_BETS)
    }

    /// Initialize indexes for all collections
    pub async fn init_indexes(&self) -> Result<(), mongodb::error::Error> {
        // Bets collection indexes
        let bets = self.bets();

        // Index for querying bets by spin_id (primary query pattern)
        let spin_bets_idx = IndexModel::builder()
            .keys(doc! { "spin_id": 1, "user_id": 1 })
            .options(
                IndexOptions::builder()
                    .name("spin_user_bets_idx".to_string())
                    .build(),
            )
            .build();

        // Index for querying pending bets
        let pending_bets_idx = IndexModel::builder()
            .keys(doc! { "spin_id": 1, "processed": 1 })
            .options(
                IndexOptions::builder()
                    .name("pending_bets_idx".to_string())
                    .build(),
            )
            .build();

        // Index for user history
        let user_bets_idx = IndexModel::builder()
            .keys(doc! { "user_id": 1, "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("user_bets_history_idx".to_string())
                    .build(),
            )
            .build();

        bets.create_indexes([spin_bets_idx, pending_bets_idx, user_bets_idx])
            .await?;

        // Spins collection indexes
        let spins = self.spins();

        // Index for querying recent spins
        let recent_spins_idx = IndexModel::builder()
            .keys(doc! { "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("recent_spins_idx".to_string())
                    .build(),
            )
            .build();

        // Index for querying by spin_id
        let spin_id_idx = IndexModel::builder()
            .keys(doc! { "spin_id": 1 })
            .options(
                IndexOptions::builder()
                    .name("spin_id_idx".to_string())
                    .unique(true)
                    .build(),
            )
            .build();

        spins.create_indexes([recent_spins_idx, spin_id_idx]).await?;

        // Chat collection indexes
        let chat = self.chat();

        // Index for recent messages
        let recent_chat_idx = IndexModel::builder()
            .keys(doc! { "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("recent_chat_idx".to_string())
                    .build(),
            )
            .build();

        // TTL index to auto-delete old chat after 24 hours
        let chat_ttl_idx = IndexModel::builder()
            .keys(doc! { "created_at": 1 })
            .options(
                IndexOptions::builder()
                    .name("chat_ttl_idx".to_string())
                    .expire_after(std::time::Duration::from_secs(86400)) // 24 hours
                    .build(),
            )
            .build();

        chat.create_indexes([recent_chat_idx, chat_ttl_idx]).await?;

        info!("MongoDB multiplayer roulette indexes initialized");
        Ok(())
    }

    // =========================================================================
    // Bets Operations
    // =========================================================================

    /// Save a user's bet for a spin
    pub async fn save_bet(
        &self,
        user_id: i64,
        username: &str,
        spin_id: &str,
        bets: &[RouletteBet],
        total_amount: i64,
    ) -> Result<ObjectId, mongodb::error::Error> {
        let record = RouletteBetRecord {
            id: None,
            user_id,
            username: username.to_string(),
            spin_id: spin_id.to_string(),
            bets: bets.to_vec(),
            total_amount,
            created_at: Utc::now(),
            processed: false,
            payout: None,
        };

        let result = self.bets().insert_one(&record).await?;
        let id = result.inserted_id.as_object_id().unwrap();

        info!(
            bet_id = %id,
            user_id = %user_id,
            spin_id = %spin_id,
            amount = %total_amount,
            "Multiplayer roulette bet saved"
        );

        Ok(id)
    }

    /// Get all pending (unprocessed) bets for a spin
    pub async fn get_pending_bets_for_spin(
        &self,
        spin_id: &str,
    ) -> Result<Vec<RouletteBetRecord>, mongodb::error::Error> {
        let filter = doc! {
            "spin_id": spin_id,
            "processed": false
        };

        let mut cursor = self.bets().find(filter).await?;
        let mut bets = Vec::new();

        while let Some(record) = cursor.next().await {
            match record {
                Ok(b) => bets.push(b),
                Err(e) => error!("Error reading bet record: {}", e),
            }
        }

        Ok(bets)
    }

    /// Mark bets as processed and update payout
    pub async fn mark_bets_processed(
        &self,
        spin_id: &str,
        user_id: i64,
        payout: i64,
    ) -> Result<(), mongodb::error::Error> {
        let filter = doc! {
            "spin_id": spin_id,
            "user_id": user_id
        };

        let update = doc! {
            "$set": {
                "processed": true,
                "payout": payout
            }
        };

        self.bets().update_many(filter, update).await?;
        Ok(())
    }

    /// Get user's bet for a specific spin
    pub async fn get_user_bet_for_spin(
        &self,
        user_id: i64,
        spin_id: &str,
    ) -> Result<Option<RouletteBetRecord>, mongodb::error::Error> {
        let filter = doc! {
            "spin_id": spin_id,
            "user_id": user_id
        };

        self.bets().find_one(filter).await
    }

    /// Get user's recent bets
    pub async fn get_user_bets(
        &self,
        user_id: i64,
        limit: i64,
    ) -> Result<Vec<RouletteBetRecord>, mongodb::error::Error> {
        let filter = doc! { "user_id": user_id };
        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self.bets().find(filter).with_options(options).await?;
        let mut bets = Vec::new();

        while let Some(record) = cursor.next().await {
            match record {
                Ok(b) => bets.push(b),
                Err(e) => error!("Error reading user bet: {}", e),
            }
        }

        Ok(bets)
    }

    // =========================================================================
    // Spins Operations
    // =========================================================================

    /// Save a spin result
    pub async fn save_spin(
        &self,
        spin_id: &str,
        winning_number: &str,
        winning_color: &str,
        winning_parity: &str,
        total_bets_amount: i64,
        total_payouts: i64,
        bet_count: i32,
    ) -> Result<ObjectId, mongodb::error::Error> {
        let record = RouletteSpinRecord {
            id: None,
            spin_id: spin_id.to_string(),
            winning_number: winning_number.to_string(),
            winning_color: winning_color.to_string(),
            winning_parity: winning_parity.to_string(),
            total_bets_amount,
            total_payouts,
            bet_count,
            created_at: Utc::now(),
        };

        let result = self.spins().insert_one(&record).await?;
        let id = result.inserted_id.as_object_id().unwrap();

        info!(
            spin_record_id = %id,
            spin_id = %spin_id,
            winning = %winning_number,
            total_bets = %total_bets_amount,
            total_payouts = %total_payouts,
            "Multiplayer roulette spin saved"
        );

        Ok(id)
    }

    /// Get recent spins for history bar from roulette_multiplayer_spins collection
    pub async fn get_recent_spins(
        &self,
        limit: i64,
    ) -> Result<Vec<SpinResultSummary>, mongodb::error::Error> {
        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self.spins().find(doc! {}).with_options(options).await?;
        let mut spins = Vec::new();

        while let Some(record) = cursor.next().await {
            match record {
                Ok(s) => {
                    spins.push(SpinResultSummary {
                        spin_id: s.spin_id,
                        winning_number: s.winning_number,
                        winning_color: s.winning_color,
                        timestamp: s.created_at,
                    });
                }
                Err(e) => error!("Error reading spin record: {}", e),
            }
        }

        Ok(spins)
    }

    /// Get a specific spin by ID
    pub async fn get_spin(
        &self,
        spin_id: &str,
    ) -> Result<Option<RouletteSpinRecord>, mongodb::error::Error> {
        self.spins().find_one(doc! { "spin_id": spin_id }).await
    }

    // =========================================================================
    // Chat Operations
    // =========================================================================

    /// Save a chat message
    pub async fn save_chat_message(
        &self,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        content: &str,
        is_system: bool,
    ) -> Result<ObjectId, mongodb::error::Error> {
        let record = RouletteChatRecord {
            id: None,
            user_id,
            username: username.to_string(),
            avatar_id,
            content: content.to_string(),
            is_system,
            created_at: Utc::now(),
        };

        let result = self.chat().insert_one(&record).await?;
        let id = result.inserted_id.as_object_id().unwrap();

        Ok(id)
    }

    /// Get recent chat messages
    pub async fn get_recent_chat_messages(
        &self,
        limit: i64,
    ) -> Result<Vec<RouletteChatRecord>, mongodb::error::Error> {
        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self.chat().find(doc! {}).with_options(options).await?;
        let mut messages = Vec::new();

        while let Some(record) = cursor.next().await {
            match record {
                Ok(m) => messages.push(m),
                Err(e) => error!("Error reading chat message: {}", e),
            }
        }

        // Reverse to get chronological order
        messages.reverse();
        Ok(messages)
    }

    // =========================================================================
    // Statistics
    // =========================================================================

    /// Get spin statistics
    pub async fn get_spin_stats(&self) -> Result<SpinStats, mongodb::error::Error> {
        let pipeline = vec![doc! {
            "$group": {
                "_id": null,
                "total_spins": { "$sum": 1 },
                "total_bets_amount": { "$sum": "$total_bets_amount" },
                "total_payouts": { "$sum": "$total_payouts" }
            }
        }];

        let mut cursor = self.spins().aggregate(pipeline).await?;

        if let Some(Ok(doc)) = cursor.next().await {
            Ok(SpinStats {
                total_spins: doc.get_i64("total_spins").unwrap_or(0),
                total_bets_amount: doc.get_i64("total_bets_amount").unwrap_or(0),
                total_payouts: doc.get_i64("total_payouts").unwrap_or(0),
            })
        } else {
            Ok(SpinStats::default())
        }
    }

    /// Count bets for a spin
    pub async fn count_bets_for_spin(&self, spin_id: &str) -> Result<u64, mongodb::error::Error> {
        self.bets()
            .count_documents(doc! { "spin_id": spin_id })
            .await
    }

    /// Get total bet amount for a spin
    pub async fn get_total_bet_amount_for_spin(
        &self,
        spin_id: &str,
    ) -> Result<i64, mongodb::error::Error> {
        let pipeline = vec![
            doc! { "$match": { "spin_id": spin_id } },
            doc! {
                "$group": {
                    "_id": null,
                    "total": { "$sum": "$total_amount" }
                }
            },
        ];

        let mut cursor = self.bets_raw().aggregate(pipeline).await?;

        if let Some(Ok(doc)) = cursor.next().await {
            Ok(doc.get_i64("total").unwrap_or(0))
        } else {
            Ok(0)
        }
    }
}

/// Spin statistics
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct SpinStats {
    pub total_spins: i64,
    pub total_bets_amount: i64,
    pub total_payouts: i64,
}

#[cfg(test)]
mod tests {
    // Tests would require MongoDB connection
    // Add integration tests in a separate module
}
