//! MongoDB game history operations
//!
//! Stores game history for statistics and replay functionality.

use super::types::{GameHistory, GameHistoryPlayer, GameTurn, GameType};
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId, Document};
use mongodb::options::{FindOptions, IndexOptions};
use mongodb::{Collection, Database, IndexModel};
use std::sync::Arc;
use tracing::{error, info};

/// Collection name for game history
const COLLECTION_GAME_HISTORY: &str = "game_history";

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

        info!("MongoDB game history indexes initialized");
        Ok(())
    }

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
