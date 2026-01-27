//! MongoDB roulette history operations
//!
//! Stores roulette game history for statistics and replay functionality.

use super::roulette::{BetResult, RouletteBet};
use chrono::{DateTime, Utc};
use futures::StreamExt;
use mongodb::bson::{doc, oid::ObjectId, Document};
use mongodb::options::{FindOptions, IndexOptions};
use mongodb::{Collection, Database, IndexModel};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};

/// Collection name for roulette history
const COLLECTION_ROULETTE_HISTORY: &str = "roulette_history";

/// Roulette history record (stored in MongoDB)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteHistory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// User who played
    pub user_id: i64,
    /// Event type (always "game" for normal spins)
    pub event_type: String,
    /// The winning number (0, 00, or 1-36)
    pub result_number: String,
    /// Color: red, black, or green
    pub result_color: String,
    /// Parity: odd, even, or none
    pub result_parity: String,
    /// Total stake in cents
    pub total_stake: i64,
    /// Total payout in cents
    pub payout: i64,
    /// Net result (payout - stake) in cents
    pub net_result: i64,
    /// JSON representation of all bets
    pub bets_json: Vec<RouletteBet>,
    /// Individual bet results
    pub bet_results: Vec<BetResult>,
    /// When the spin occurred
    pub created_at: DateTime<Utc>,
}

/// MongoDB roulette history client
pub struct MongoRouletteClient {
    db: Arc<Database>,
}

impl MongoRouletteClient {
    /// Create a new MongoDB roulette client
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Get the roulette history collection
    fn history(&self) -> Collection<RouletteHistory> {
        self.db.collection(COLLECTION_ROULETTE_HISTORY)
    }

    /// Get the raw collection for aggregations
    fn history_raw(&self) -> Collection<Document> {
        self.db.collection(COLLECTION_ROULETTE_HISTORY)
    }

    /// Initialize indexes for the roulette history collection
    pub async fn init_indexes(&self) -> Result<(), mongodb::error::Error> {
        let collection = self.history();

        // Index for querying history by user
        let user_index = IndexModel::builder()
            .keys(doc! { "user_id": 1, "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("user_history_idx".to_string())
                    .build(),
            )
            .build();

        // Index for recent spins
        let recent_index = IndexModel::builder()
            .keys(doc! { "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("recent_spins_idx".to_string())
                    .build(),
            )
            .build();

        // Index for result analysis
        let result_index = IndexModel::builder()
            .keys(doc! { "result_number": 1, "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("result_analysis_idx".to_string())
                    .build(),
            )
            .build();

        collection
            .create_indexes([user_index, recent_index, result_index])
            .await?;

        info!("MongoDB roulette history indexes initialized");
        Ok(())
    }

    /// Save a spin result to history
    pub async fn save_spin(
        &self,
        user_id: i64,
        result_number: &str,
        result_color: &str,
        result_parity: &str,
        total_stake: i64,
        payout: i64,
        bets: &[RouletteBet],
        bet_results: &[BetResult],
    ) -> Result<ObjectId, mongodb::error::Error> {
        let history = RouletteHistory {
            id: None,
            user_id,
            event_type: "game".to_string(),
            result_number: result_number.to_string(),
            result_color: result_color.to_string(),
            result_parity: result_parity.to_string(),
            total_stake,
            payout,
            net_result: payout - total_stake,
            bets_json: bets.to_vec(),
            bet_results: bet_results.to_vec(),
            created_at: Utc::now(),
        };

        let result = self.history().insert_one(&history).await?;
        let id = result.inserted_id.as_object_id().unwrap();

        info!(
            history_id = %id,
            user_id = %user_id,
            result = %result_number,
            stake = %total_stake,
            payout = %payout,
            "Roulette spin saved to history"
        );

        Ok(id)
    }

    /// Get user's roulette history with pagination
    pub async fn get_user_history(
        &self,
        user_id: i64,
        limit: i64,
        skip: u64,
    ) -> Result<Vec<RouletteHistory>, mongodb::error::Error> {
        let filter = doc! { "user_id": user_id };
        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .skip(skip)
            .build();

        let mut cursor = self.history().find(filter).with_options(options).await?;
        let mut history = Vec::new();

        while let Some(record) = cursor.next().await {
            match record {
                Ok(h) => history.push(h),
                Err(e) => error!("Error reading roulette history: {}", e),
            }
        }

        Ok(history)
    }

    /// Count user's total spins
    pub async fn count_user_history(&self, user_id: i64) -> Result<u64, mongodb::error::Error> {
        let filter = doc! { "user_id": user_id };
        self.history().count_documents(filter).await
    }

    /// Get user's roulette statistics
    pub async fn get_user_stats(
        &self,
        user_id: i64,
    ) -> Result<RouletteUserStats, mongodb::error::Error> {
        let pipeline = vec![
            doc! { "$match": { "user_id": user_id } },
            doc! {
                "$group": {
                    "_id": null,
                    "total_spins": { "$sum": 1 },
                    "total_wagered": { "$sum": "$total_stake" },
                    "total_won": { "$sum": "$payout" },
                    "total_net": { "$sum": "$net_result" },
                    "wins": {
                        "$sum": {
                            "$cond": [{ "$gt": ["$payout", 0] }, 1, 0]
                        }
                    },
                    "biggest_win": { "$max": "$payout" },
                    "biggest_loss": { "$min": "$net_result" }
                }
            },
        ];

        let mut cursor = self.history_raw().aggregate(pipeline).await?;

        if let Some(Ok(doc)) = cursor.next().await {
            let total_spins = doc.get_i64("total_spins").unwrap_or(0);
            let wins = doc.get_i64("wins").unwrap_or(0);

            Ok(RouletteUserStats {
                user_id,
                total_spins,
                total_wagered: doc.get_i64("total_wagered").unwrap_or(0),
                total_won: doc.get_i64("total_won").unwrap_or(0),
                total_net: doc.get_i64("total_net").unwrap_or(0),
                wins,
                losses: total_spins - wins,
                win_rate: if total_spins > 0 {
                    (wins as f64 / total_spins as f64) * 100.0
                } else {
                    0.0
                },
                biggest_win: doc.get_i64("biggest_win").unwrap_or(0),
                biggest_loss: doc.get_i64("biggest_loss").unwrap_or(0),
            })
        } else {
            Ok(RouletteUserStats {
                user_id,
                total_spins: 0,
                total_wagered: 0,
                total_won: 0,
                total_net: 0,
                wins: 0,
                losses: 0,
                win_rate: 0.0,
                biggest_win: 0,
                biggest_loss: 0,
            })
        }
    }

    /// Get a specific spin by ID
    pub async fn get_spin(
        &self,
        spin_id: ObjectId,
    ) -> Result<Option<RouletteHistory>, mongodb::error::Error> {
        self.history().find_one(doc! { "_id": spin_id }).await
    }

    /// Get recent spins (for leaderboard/activity feed)
    pub async fn get_recent_spins(
        &self,
        limit: i64,
    ) -> Result<Vec<RouletteHistory>, mongodb::error::Error> {
        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self.history().find(doc! {}).with_options(options).await?;
        let mut spins = Vec::new();

        while let Some(record) = cursor.next().await {
            match record {
                Ok(h) => spins.push(h),
                Err(e) => error!("Error reading roulette spin: {}", e),
            }
        }

        Ok(spins)
    }
}

/// User roulette statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteUserStats {
    pub user_id: i64,
    pub total_spins: i64,
    pub total_wagered: i64,
    pub total_won: i64,
    pub total_net: i64,
    pub wins: i64,
    pub losses: i64,
    pub win_rate: f64,
    pub biggest_win: i64,
    pub biggest_loss: i64,
}
