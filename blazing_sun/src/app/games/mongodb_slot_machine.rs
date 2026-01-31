//! MongoDB Slot Machine History Operations
//!
//! Stores slot machine game history for statistics and replay:
//! - Main spin history
//! - Mini-game history (linked to parent spin)

use chrono::{DateTime, Utc};
use futures::StreamExt;
use mongodb::bson::{doc, oid::ObjectId, Document};
use mongodb::options::{FindOptions, IndexOptions};
use mongodb::{Collection, Database, IndexModel};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};

use super::slot_machine_minigame::NumberResult;
use super::slot_machine_types::{SlotHistoryItem, SlotUserStats, WinLine};

// =============================================================================
// Constants
// =============================================================================

/// Collection name for slot machine history
const COLLECTION_SLOT_MACHINE_HISTORY: &str = "slot_machine_history";

/// Collection name for mini-game history
const COLLECTION_SLOT_MACHINE_MINIGAME_HISTORY: &str = "slot_machine_minigame_history";

// =============================================================================
// History Document Types
// =============================================================================

/// Slot machine spin history record (stored in MongoDB)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotMachineHistory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// User who played
    pub user_id: i64,
    /// Event type (always "spin")
    pub event_type: String,

    // Spin data
    /// The 5 reel symbols (1-6)
    pub reels: Vec<i32>,
    /// The full 15-position grid (multi-line mode only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grid: Option<Vec<String>>,
    /// Which lines were bet on
    pub active_lines: Vec<u8>,
    /// Bet amount per line
    pub bet_per_line: i64,
    /// Total bet (lines × bet + joker)
    pub total_bet: i64,

    // Joker
    /// Whether joker was enabled
    pub joker_enabled: bool,
    /// Joker position (1-15, or None)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub joker_position: Option<u8>,
    /// Joker cost
    pub joker_cost: i64,

    // Results
    /// Winning line details
    pub winning_lines: Vec<WinLine>,
    /// Total payout
    pub total_payout: i64,
    /// Net result (payout - bet)
    pub net_result: i64,
    /// Whether mini-game was triggered
    pub mini_game_triggered: bool,

    // Mode info
    /// Reward mode: "single" or "multi"
    pub reward_mode: String,
    /// Game mode: "numbers", "roman", "fruits", "animals", "emojis"
    pub game_mode: String,

    /// When the spin occurred
    pub created_at: DateTime<Utc>,
}

/// Slot machine mini-game history record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotMachineMiniGameHistory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// User who played
    pub user_id: i64,
    /// Parent spin ID (optional link)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_spin_id: Option<ObjectId>,

    /// Number bet details (new format: each number with its bet)
    pub number_bets: Vec<MiniGameNumberBetRecord>,
    /// The 12 drawn numbers
    pub drawn_numbers: Vec<i32>,
    /// Total bet amount
    pub total_bet: i64,
    /// Total payout
    pub total_payout: i64,
    /// Net result (payout - bet)
    pub net_result: i64,
    /// Number of matches
    pub matches_count: u8,

    /// When the mini-game occurred
    pub created_at: DateTime<Utc>,
}

/// Mini-game number bet record for storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniGameNumberBetRecord {
    /// The number that was bet on
    pub number: i32,
    /// Bet amount for this number
    pub bet: i64,
    /// Whether this number matched
    pub matched: bool,
    /// Payout for this number
    pub payout: i64,
}

impl From<&NumberResult> for MiniGameNumberBetRecord {
    fn from(nr: &NumberResult) -> Self {
        Self {
            number: nr.number,
            bet: nr.bet,
            matched: nr.matched,
            payout: nr.payout,
        }
    }
}

// =============================================================================
// MongoDB Client
// =============================================================================

/// MongoDB slot machine history client
pub struct MongoSlotMachineClient {
    db: Arc<Database>,
}

impl MongoSlotMachineClient {
    /// Create a new MongoDB slot machine client
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Get the spin history collection
    fn history(&self) -> Collection<SlotMachineHistory> {
        self.db.collection(COLLECTION_SLOT_MACHINE_HISTORY)
    }

    /// Get the raw collection for aggregations
    fn history_raw(&self) -> Collection<Document> {
        self.db.collection(COLLECTION_SLOT_MACHINE_HISTORY)
    }

    /// Get the mini-game history collection
    fn minigame_history(&self) -> Collection<SlotMachineMiniGameHistory> {
        self.db.collection(COLLECTION_SLOT_MACHINE_MINIGAME_HISTORY)
    }

    /// Initialize indexes for slot machine collections
    pub async fn init_indexes(&self) -> Result<(), mongodb::error::Error> {
        // Spin history indexes
        let history_collection = self.history();

        let user_index = IndexModel::builder()
            .keys(doc! { "user_id": 1, "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("user_history_idx".to_string())
                    .build(),
            )
            .build();

        let recent_index = IndexModel::builder()
            .keys(doc! { "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("recent_spins_idx".to_string())
                    .build(),
            )
            .build();

        history_collection
            .create_indexes([user_index, recent_index])
            .await?;

        // Mini-game history indexes
        let minigame_collection = self.minigame_history();

        let mg_user_index = IndexModel::builder()
            .keys(doc! { "user_id": 1, "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name("user_minigame_idx".to_string())
                    .build(),
            )
            .build();

        let mg_parent_index = IndexModel::builder()
            .keys(doc! { "parent_spin_id": 1 })
            .options(
                IndexOptions::builder()
                    .name("parent_spin_idx".to_string())
                    .build(),
            )
            .build();

        minigame_collection
            .create_indexes([mg_user_index, mg_parent_index])
            .await?;

        info!("MongoDB slot machine indexes initialized");
        Ok(())
    }

    // =========================================================================
    // Spin History Operations
    // =========================================================================

    /// Save a spin result to history
    pub async fn save_spin(
        &self,
        user_id: i64,
        reels: &[i32],
        grid: Option<Vec<String>>,
        active_lines: &[u8],
        bet_per_line: i64,
        total_bet: i64,
        joker_enabled: bool,
        joker_position: Option<u8>,
        joker_cost: i64,
        winning_lines: &[WinLine],
        total_payout: i64,
        mini_game_triggered: bool,
        reward_mode: &str,
        game_mode: &str,
    ) -> Result<ObjectId, mongodb::error::Error> {
        let history = SlotMachineHistory {
            id: None,
            user_id,
            event_type: "spin".to_string(),
            reels: reels.to_vec(),
            grid,
            active_lines: active_lines.to_vec(),
            bet_per_line,
            total_bet,
            joker_enabled,
            joker_position,
            joker_cost,
            winning_lines: winning_lines.to_vec(),
            total_payout,
            net_result: total_payout - total_bet,
            mini_game_triggered,
            reward_mode: reward_mode.to_string(),
            game_mode: game_mode.to_string(),
            created_at: Utc::now(),
        };

        let result = self.history().insert_one(&history).await?;
        let id = result.inserted_id.as_object_id().unwrap();

        info!(
            history_id = %id,
            user_id = %user_id,
            reels = ?reels,
            bet = %total_bet,
            payout = %total_payout,
            "Slot machine spin saved to history"
        );

        Ok(id)
    }

    /// Get user's spin history with pagination
    pub async fn get_user_history(
        &self,
        user_id: i64,
        limit: i64,
        skip: u64,
    ) -> Result<Vec<SlotMachineHistory>, mongodb::error::Error> {
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
                Err(e) => error!("Error reading slot machine history: {}", e),
            }
        }

        Ok(history)
    }

    /// Count user's total spins
    pub async fn count_user_history(&self, user_id: i64) -> Result<u64, mongodb::error::Error> {
        let filter = doc! { "user_id": user_id };
        self.history().count_documents(filter).await
    }

    /// Get user's slot machine statistics
    pub async fn get_user_stats(
        &self,
        user_id: i64,
    ) -> Result<SlotUserStats, mongodb::error::Error> {
        let pipeline = vec![
            doc! { "$match": { "user_id": user_id } },
            doc! {
                "$group": {
                    "_id": null,
                    "total_spins": { "$sum": 1 },
                    "total_wagered": { "$sum": "$total_bet" },
                    "total_won": { "$sum": "$total_payout" },
                    "total_net": { "$sum": "$net_result" },
                    "wins": {
                        "$sum": {
                            "$cond": [{ "$gt": ["$total_payout", 0] }, 1, 0]
                        }
                    },
                    "mini_games_triggered": {
                        "$sum": {
                            "$cond": ["$mini_game_triggered", 1, 0]
                        }
                    },
                    "biggest_win": { "$max": "$total_payout" },
                    "biggest_loss": { "$min": "$net_result" }
                }
            },
        ];

        let mut cursor = self.history_raw().aggregate(pipeline).await?;

        if let Some(Ok(doc)) = cursor.next().await {
            let total_spins = doc.get_i64("total_spins").unwrap_or(0);
            let wins = doc.get_i64("wins").unwrap_or(0);

            Ok(SlotUserStats {
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
                mini_games_triggered: doc.get_i64("mini_games_triggered").unwrap_or(0),
            })
        } else {
            Ok(SlotUserStats {
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
                mini_games_triggered: 0,
            })
        }
    }

    /// Get a specific spin by ID
    pub async fn get_spin(
        &self,
        spin_id: ObjectId,
    ) -> Result<Option<SlotMachineHistory>, mongodb::error::Error> {
        self.history().find_one(doc! { "_id": spin_id }).await
    }

    // =========================================================================
    // Mini-Game History Operations
    // =========================================================================

    /// Save a mini-game result to history
    pub async fn save_minigame(
        &self,
        user_id: i64,
        parent_spin_id: Option<ObjectId>,
        number_results: &[NumberResult],
        drawn_numbers: &[i32],
        total_bet: i64,
        total_payout: i64,
        matches_count: u8,
    ) -> Result<ObjectId, mongodb::error::Error> {
        let history = SlotMachineMiniGameHistory {
            id: None,
            user_id,
            parent_spin_id,
            number_bets: number_results.iter().map(MiniGameNumberBetRecord::from).collect(),
            drawn_numbers: drawn_numbers.to_vec(),
            total_bet,
            total_payout,
            net_result: total_payout - total_bet,
            matches_count,
            created_at: Utc::now(),
        };

        let result = self.minigame_history().insert_one(&history).await?;
        let id = result.inserted_id.as_object_id().unwrap();

        info!(
            minigame_id = %id,
            user_id = %user_id,
            total_bet = %total_bet,
            payout = %total_payout,
            matches = %matches_count,
            "Slot machine mini-game saved to history"
        );

        Ok(id)
    }

    /// Get mini-game history for a parent spin
    pub async fn get_minigame_by_parent(
        &self,
        parent_spin_id: ObjectId,
    ) -> Result<Option<SlotMachineMiniGameHistory>, mongodb::error::Error> {
        self.minigame_history()
            .find_one(doc! { "parent_spin_id": parent_spin_id })
            .await
    }

    /// Get user's mini-game history
    pub async fn get_user_minigame_history(
        &self,
        user_id: i64,
        limit: i64,
    ) -> Result<Vec<SlotMachineMiniGameHistory>, mongodb::error::Error> {
        let filter = doc! { "user_id": user_id };
        let options = FindOptions::builder()
            .sort(doc! { "created_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self
            .minigame_history()
            .find(filter)
            .with_options(options)
            .await?;
        let mut history = Vec::new();

        while let Some(record) = cursor.next().await {
            match record {
                Ok(h) => history.push(h),
                Err(e) => error!("Error reading slot machine mini-game history: {}", e),
            }
        }

        Ok(history)
    }
}

/// Convert SlotMachineHistory to API response format
impl From<SlotMachineHistory> for SlotHistoryItem {
    fn from(h: SlotMachineHistory) -> Self {
        Self {
            id: h.id.map(|id| id.to_hex()).unwrap_or_default(),
            reels: h.reels,
            active_lines: h.active_lines.iter().filter(|&&x| x == 1).count(),
            bet_per_line: h.bet_per_line,
            total_bet: h.total_bet,
            total_payout: h.total_payout,
            net_result: h.net_result,
            joker_enabled: h.joker_enabled,
            mini_game_triggered: h.mini_game_triggered,
            reward_mode: h.reward_mode,
            game_mode: h.game_mode,
            timestamp: h.created_at.to_rfc3339(),
        }
    }
}
