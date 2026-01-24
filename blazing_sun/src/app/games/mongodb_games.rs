//! MongoDB game history operations
//!
//! Stores game history for statistics and replay functionality.

use super::types::{BiggerDicePlayerRoll, BiggerDiceRoundResult, GameHistory, GameHistoryPlayer, GameTurn, GameType};
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId, Document};
use mongodb::options::{FindOptions, IndexOptions};
use mongodb::{Collection, Database, IndexModel};
use std::sync::Arc;
use tracing::{error, info};

/// Collection name for game history
const COLLECTION_GAME_HISTORY: &str = "game_history";

/// Collection name for in-progress round results (for rejoining players)
const COLLECTION_ROUND_RESULTS: &str = "game_round_results";

/// MongoDB game history client
pub struct MongoGameClient {
    db: Arc<Database>,
}

impl MongoGameClient {
    /// Create a new MongoDB game client
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// Get the game history collection
    fn history(&self) -> Collection<GameHistory> {
        self.db.collection(COLLECTION_GAME_HISTORY)
    }

    /// Get the raw collection for aggregations
    fn history_raw(&self) -> Collection<Document> {
        self.db.collection(COLLECTION_GAME_HISTORY)
    }

    /// Get the round results collection (for in-progress games)
    fn round_results(&self) -> Collection<BiggerDiceRoundResult> {
        self.db.collection(COLLECTION_ROUND_RESULTS)
    }

    /// Initialize indexes for the game history collection
    pub async fn init_indexes(&self) -> Result<(), mongodb::error::Error> {
        let collection = self.history();

        // Index for querying games by player
        let player_index = IndexModel::builder()
            .keys(doc! { "players.user_id": 1, "finished_at": -1 })
            .options(IndexOptions::builder().name("player_games_idx".to_string()).build())
            .build();

        // Index for querying games by type
        let type_index = IndexModel::builder()
            .keys(doc! { "game_type": 1, "finished_at": -1 })
            .options(IndexOptions::builder().name("game_type_idx".to_string()).build())
            .build();

        // Index for recent games
        let recent_index = IndexModel::builder()
            .keys(doc! { "finished_at": -1 })
            .options(IndexOptions::builder().name("recent_games_idx".to_string()).build())
            .build();

        collection
            .create_indexes([player_index, type_index, recent_index])
            .await?;

        // Initialize round results indexes
        let round_results_collection = self.round_results();

        // Index for querying rounds by room_id (primary query pattern)
        let room_index = IndexModel::builder()
            .keys(doc! { "room_id": 1, "round_number": 1 })
            .options(IndexOptions::builder().name("room_rounds_idx".to_string()).build())
            .build();

        // TTL index to auto-delete old round results after 24 hours
        // (cleanup for abandoned games)
        let ttl_index = IndexModel::builder()
            .keys(doc! { "completed_at": 1 })
            .options(
                IndexOptions::builder()
                    .name("round_results_ttl_idx".to_string())
                    .expire_after(std::time::Duration::from_secs(86400)) // 24 hours
                    .build(),
            )
            .build();

        round_results_collection
            .create_indexes([room_index, ttl_index])
            .await?;

        info!("MongoDB game history and round results indexes initialized");
        Ok(())
    }

    // =========================================================================
    // Round Results Methods (for in-progress games)
    // =========================================================================

    /// Save a round result during gameplay
    /// This allows rejoining players to see the full round history
    pub async fn save_round_result(
        &self,
        room_id: &str,
        round_number: i32,
        rolls: Vec<BiggerDicePlayerRoll>,
        winner_id: Option<i64>,
        winner_username: Option<String>,
        is_tiebreaker: bool,
    ) -> Result<ObjectId, mongodb::error::Error> {
        let result = BiggerDiceRoundResult {
            id: None,
            room_id: room_id.to_string(),
            round_number,
            rolls,
            winner_id,
            winner_username,
            is_tiebreaker,
            completed_at: Utc::now(),
        };

        let insert_result = self.round_results().insert_one(&result).await?;
        let id = insert_result.inserted_id.as_object_id().unwrap();

        info!(
            room_id = %room_id,
            round = %round_number,
            winner_id = ?winner_id,
            "Round result saved to MongoDB"
        );

        Ok(id)
    }

    /// Get all round results for a room (for rejoining players)
    pub async fn get_room_round_results(
        &self,
        room_id: &str,
    ) -> Result<Vec<BiggerDiceRoundResult>, mongodb::error::Error> {
        let filter = doc! { "room_id": room_id };
        let options = FindOptions::builder()
            .sort(doc! { "round_number": 1 })
            .build();

        let mut cursor = self.round_results().find(filter).with_options(options).await?;
        let mut results = Vec::new();

        use futures::StreamExt;
        while let Some(result) = cursor.next().await {
            match result {
                Ok(r) => results.push(r),
                Err(e) => error!("Error reading round result: {}", e),
            }
        }

        Ok(results)
    }

    /// Clear round results for a room (called when game ends)
    /// This is optional since TTL index will auto-delete after 24 hours
    pub async fn clear_room_round_results(
        &self,
        room_id: &str,
    ) -> Result<u64, mongodb::error::Error> {
        let filter = doc! { "room_id": room_id };
        let result = self.round_results().delete_many(filter).await?;

        info!(
            room_id = %room_id,
            deleted = %result.deleted_count,
            "Cleared round results for room"
        );

        Ok(result.deleted_count)
    }

    // =========================================================================
    // Game History Methods (for completed games)
    // =========================================================================

    /// Save a completed game to history
    pub async fn save_game(
        &self,
        room_id: &str,
        room_name: &str,
        game_type: GameType,
        players: Vec<GameHistoryPlayer>,
        winner_id: Option<i64>,
        turns: Vec<GameTurn>,
        started_at: chrono::DateTime<Utc>,
    ) -> Result<ObjectId, mongodb::error::Error> {
        let now = Utc::now();
        let duration = (now - started_at).num_seconds();

        let history = GameHistory {
            id: None,
            room_id: room_id.to_string(),
            room_name: room_name.to_string(),
            game_type,
            players,
            winner_id,
            duration_seconds: duration,
            turns,
            started_at,
            finished_at: now,
        };

        let result = self.history().insert_one(&history).await?;
        let id = result.inserted_id.as_object_id().unwrap();

        info!(
            game_id = %id,
            room_id = %room_id,
            duration = %duration,
            "Game history saved"
        );

        Ok(id)
    }

    /// Get game history for a user
    pub async fn get_user_games(
        &self,
        user_id: i64,
        limit: i64,
        skip: u64,
    ) -> Result<Vec<GameHistory>, mongodb::error::Error> {
        let filter = doc! { "players.user_id": user_id };
        let options = FindOptions::builder()
            .sort(doc! { "finished_at": -1 })
            .limit(limit)
            .skip(skip)
            .build();

        let mut cursor = self.history().find(filter).with_options(options).await?;
        let mut games = Vec::new();

        use futures::StreamExt;
        while let Some(game) = cursor.next().await {
            match game {
                Ok(g) => games.push(g),
                Err(e) => error!("Error reading game history: {}", e),
            }
        }

        Ok(games)
    }

    /// Get user's statistics
    pub async fn get_user_stats(
        &self,
        user_id: i64,
    ) -> Result<UserGameStats, mongodb::error::Error> {
        let pipeline = vec![
            doc! { "$match": { "players.user_id": user_id } },
            doc! {
                "$group": {
                    "_id": null,
                    "total_games": { "$sum": 1 },
                    "wins": {
                        "$sum": {
                            "$cond": [{ "$eq": ["$winner_id", user_id] }, 1, 0]
                        }
                    },
                    "total_duration": { "$sum": "$duration_seconds" }
                }
            },
        ];

        let mut cursor = self.history_raw().aggregate(pipeline).await?;

        use futures::StreamExt;
        if let Some(Ok(doc)) = cursor.next().await {
            let total_games = doc.get_i64("total_games").unwrap_or(0);
            let wins = doc.get_i64("wins").unwrap_or(0);
            let total_duration = doc.get_i64("total_duration").unwrap_or(0);

            Ok(UserGameStats {
                user_id,
                total_games,
                wins,
                losses: total_games - wins,
                win_rate: if total_games > 0 {
                    (wins as f64 / total_games as f64) * 100.0
                } else {
                    0.0
                },
                total_play_time_seconds: total_duration,
            })
        } else {
            Ok(UserGameStats {
                user_id,
                total_games: 0,
                wins: 0,
                losses: 0,
                win_rate: 0.0,
                total_play_time_seconds: 0,
            })
        }
    }

    /// Get a specific game by ID
    pub async fn get_game(
        &self,
        game_id: ObjectId,
    ) -> Result<Option<GameHistory>, mongodb::error::Error> {
        self.history().find_one(doc! { "_id": game_id }).await
    }

    /// Get recent games (for leaderboard/activity feed)
    pub async fn get_recent_games(
        &self,
        limit: i64,
    ) -> Result<Vec<GameHistory>, mongodb::error::Error> {
        let options = FindOptions::builder()
            .sort(doc! { "finished_at": -1 })
            .limit(limit)
            .build();

        let mut cursor = self.history().find(doc! {}).with_options(options).await?;
        let mut games = Vec::new();

        use futures::StreamExt;
        while let Some(game) = cursor.next().await {
            match game {
                Ok(g) => games.push(g),
                Err(e) => error!("Error reading game: {}", e),
            }
        }

        Ok(games)
    }
}

/// User game statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserGameStats {
    pub user_id: i64,
    pub total_games: i64,
    pub wins: i64,
    pub losses: i64,
    pub win_rate: f64,
    pub total_play_time_seconds: i64,
}
