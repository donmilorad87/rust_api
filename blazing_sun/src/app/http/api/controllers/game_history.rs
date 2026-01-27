//!
//! Game History Controller
//!
//! Endpoints for retrieving player game history.
//! GET /api/v1/games/{game_type}/history: Get paginated game history for current user
//! GET /api/v1/games/{game_type}/history/{game_id}: Get specific game details
//!

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

use crate::app::games::mongodb_games::MongoGameClient;
use crate::app::games::types::{GameHistory, GameType};
use crate::bootstrap::database::AppState;

/// Helper to get user_id from request extensions (set by JWT middleware)
fn get_user_id(req: &HttpRequest) -> Option<i64> {
    req.extensions().get::<i64>().copied()
}

/// Query parameters for game history list
#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_page() -> u64 {
    1
}

fn default_limit() -> i64 {
    16
}

/// Pagination info in response
#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    pub page: u64,
    pub limit: i64,
    pub total: u64,
    pub total_pages: u64,
    pub has_next: bool,
    pub has_prev: bool,
}

/// Game history list response
#[derive(Debug, Serialize)]
pub struct HistoryListResponse {
    pub games: Vec<GameHistoryItem>,
    pub pagination: PaginationInfo,
}

/// Single game history item for list view
#[derive(Debug, Serialize)]
pub struct GameHistoryItem {
    pub game_id: String,
    pub room_name: String,
    pub game_type: String,
    pub played_at: String,
    pub duration_seconds: i64,
    pub players: Vec<PlayerInfo>,
    pub winner_id: Option<i64>,
}

/// Player info for history item
#[derive(Debug, Serialize)]
pub struct PlayerInfo {
    pub user_id: i64,
    pub username: String,
    pub final_score: i32,
    pub is_winner: bool,
}

/// Game details response (includes rounds)
#[derive(Debug, Serialize)]
pub struct GameDetailsResponse {
    pub game: GameHistoryDetail,
}

/// Detailed game history with rounds
#[derive(Debug, Serialize)]
pub struct GameHistoryDetail {
    pub game_id: String,
    pub room_id: String,
    pub room_name: String,
    pub game_type: String,
    pub players: Vec<PlayerInfo>,
    pub winner_id: Option<i64>,
    pub duration_seconds: i64,
    pub started_at: String,
    pub finished_at: String,
    pub rounds: Vec<RoundInfo>,
}

/// Round info for game details
#[derive(Debug, Serialize)]
pub struct RoundInfo {
    pub round_number: i32,
    pub rolls: std::collections::HashMap<String, i32>,
    pub winner_id: Option<i64>,
    pub is_tiebreaker: bool,
}

/// Get game history for current user
///
/// GET /api/v1/games/{game_type}/history
pub async fn get_history(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
    query: web::Query<HistoryQuery>,
) -> HttpResponse {
    // Extract user from JWT (set by auth middleware)
    let user_id = match get_user_id(&req) {
        Some(id) => id,
        None => {
            tracing::warn!("Game history request without authentication");
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Authentication required"
            }));
        }
    };

    let game_type_str = path.into_inner();
    tracing::info!(
        user_id = %user_id,
        game_type = %game_type_str,
        page = %query.page,
        limit = %query.limit,
        "Game history request"
    );

    // Validate game type
    let _game_type = match game_type_str.as_str() {
        "bigger_dice" => GameType::BiggerDice,
        "tic_tac_toe" => GameType::TicTacToe,
        _ => {
            tracing::warn!(game_type = %game_type_str, "Invalid game type requested");
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid game type"
            }));
        }
    };

    // Limit validation
    let limit = query.limit.min(50).max(1);
    let page = query.page.max(1);
    let skip = (page - 1) * (limit as u64);

    // Get MongoDB client
    let mongodb = match state.mongo() {
        Some(db) => db,
        None => {
            tracing::error!("MongoDB not available for game history");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Game history service unavailable"
            }));
        }
    };
    let mongo_client = MongoGameClient::new(mongodb.clone());

    // Get total count first for proper pagination
    let total = match mongo_client.count_user_games_by_type(user_id, &game_type_str).await {
        Ok(count) => count,
        Err(e) => {
            tracing::error!("Failed to count game history: {}", e);
            0
        }
    };

    // Get games for user filtered by game type
    let games = match mongo_client.get_user_games_by_type(user_id, &game_type_str, limit + 1, skip).await {
        Ok(g) => g,
        Err(e) => {
            tracing::error!("Failed to fetch game history: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch game history"
            }));
        }
    };

    let has_next = games.len() > limit as usize;
    let games_to_return: Vec<_> = games.into_iter().take(limit as usize).collect();

    tracing::info!(
        games_found = %games_to_return.len(),
        total = %total,
        has_next = %has_next,
        "Returning game history"
    );

    // Convert to response format
    let items: Vec<GameHistoryItem> = games_to_return
        .into_iter()
        .map(|g| GameHistoryItem {
            game_id: g.id.map(|id| id.to_hex()).unwrap_or_default(),
            room_name: g.room_name,
            game_type: g.game_type.as_str().to_string(),
            played_at: g.finished_at.to_rfc3339(),
            duration_seconds: g.duration_seconds,
            players: g
                .players
                .into_iter()
                .map(|p| PlayerInfo {
                    user_id: p.user_id,
                    username: p.username,
                    final_score: p.final_score,
                    is_winner: p.is_winner,
                })
                .collect(),
            winner_id: g.winner_id,
        })
        .collect();

    let total_pages = if total > 0 {
        ((total as f64) / (limit as f64)).ceil() as u64
    } else {
        0
    };

    HttpResponse::Ok().json(HistoryListResponse {
        games: items,
        pagination: PaginationInfo {
            page,
            limit,
            total,
            total_pages,
            has_next,
            has_prev: page > 1,
        },
    })
}

/// Get specific game details
///
/// GET /api/v1/games/{game_type}/history/{game_id}
pub async fn get_game_details(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
) -> HttpResponse {
    // Extract user from JWT (set by auth middleware)
    let user_id = match get_user_id(&req) {
        Some(id) => id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Authentication required"
            }));
        }
    };

    let (game_type_str, game_id_str) = path.into_inner();

    // Validate game type
    let _game_type = match game_type_str.as_str() {
        "bigger_dice" => GameType::BiggerDice,
        "tic_tac_toe" => GameType::TicTacToe,
        _ => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid game type"
            }));
        }
    };

    // Parse game ID
    let game_id = match ObjectId::parse_str(&game_id_str) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid game ID"
            }));
        }
    };

    // Get MongoDB client
    let mongodb = match state.mongo() {
        Some(db) => db,
        None => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Game history service unavailable"
            }));
        }
    };
    let mongo_client = MongoGameClient::new(mongodb.clone());

    // Get game
    let game = match mongo_client.get_game(game_id).await {
        Ok(Some(g)) => g,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Game not found"
            }));
        }
        Err(e) => {
            tracing::error!("Failed to fetch game: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch game"
            }));
        }
    };

    // Verify user was a player in this game
    let was_player = game.players.iter().any(|p| p.user_id == user_id);
    if !was_player {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You were not a player in this game"
        }));
    }

    // Convert turns to rounds (for BiggerDice, turns contain roll data)
    let rounds: Vec<RoundInfo> = extract_rounds_from_game(&game);

    HttpResponse::Ok().json(GameDetailsResponse {
        game: GameHistoryDetail {
            game_id: game.id.map(|id| id.to_hex()).unwrap_or_default(),
            room_id: game.room_id,
            room_name: game.room_name,
            game_type: game.game_type.as_str().to_string(),
            players: game
                .players
                .into_iter()
                .map(|p| PlayerInfo {
                    user_id: p.user_id,
                    username: p.username,
                    final_score: p.final_score,
                    is_winner: p.is_winner,
                })
                .collect(),
            winner_id: game.winner_id,
            duration_seconds: game.duration_seconds,
            started_at: game.started_at.to_rfc3339(),
            finished_at: game.finished_at.to_rfc3339(),
            rounds,
        },
    })
}

/// Extract i64 from JSON value, handling both plain integers and BSON Long format
/// BSON Long format: {"low": X, "high": Y, "unsigned": bool}
fn extract_i64(value: &serde_json::Value) -> Option<i64> {
    // Try plain integer first
    if let Some(n) = value.as_i64() {
        return Some(n);
    }

    // Try BSON Long format: {"low": X, "high": Y, "unsigned": bool}
    if let Some(obj) = value.as_object() {
        if let (Some(low), Some(high)) = (obj.get("low"), obj.get("high")) {
            let low_val = low.as_i64().or_else(|| low.as_u64().map(|v| v as i64))?;
            let high_val = high.as_i64().or_else(|| high.as_u64().map(|v| v as i64))?;
            // Combine low and high parts (BSON Int64)
            return Some(low_val | (high_val << 32));
        }
    }

    None
}

/// Extract rounds from game turns
fn extract_rounds_from_game(game: &GameHistory) -> Vec<RoundInfo> {
    // Group turns by round number and extract roll data
    use std::collections::HashMap;

    let mut rounds_map: HashMap<i32, RoundInfo> = HashMap::new();

    for turn in &game.turns {
        // Try to extract round info from turn action
        if let Some(action_obj) = turn.action.as_object() {
            let round_number = action_obj
                .get("round_number")
                .and_then(extract_i64)
                .unwrap_or(turn.turn_number as i64) as i32;

            let roll = action_obj
                .get("roll")
                .and_then(extract_i64)
                .unwrap_or(0) as i32;

            let is_tiebreaker = action_obj
                .get("is_tiebreaker")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            let entry = rounds_map.entry(round_number).or_insert_with(|| RoundInfo {
                round_number,
                rolls: HashMap::new(),
                winner_id: None,
                is_tiebreaker,
            });

            entry.rolls.insert(turn.player_id.to_string(), roll);

            // Check if this turn indicates a winner
            if let Some(winner) = action_obj.get("winner_id").and_then(extract_i64) {
                entry.winner_id = Some(winner);
            }
        }
    }

    let mut rounds: Vec<_> = rounds_map.into_values().collect();
    rounds.sort_by_key(|r| r.round_number);
    rounds
}
