//! Roulette Controller
//!
//! Handles roulette game API endpoints:
//! - POST /api/v1/roulette/place-bet - Validate bets and check balance
//! - POST /api/v1/roulette/spin - Execute spin, calculate winnings, update balance
//! - GET /api/v1/roulette/history - Get paginated game history
//! - GET /api/v1/roulette/stats - Get user statistics

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use crate::app::db_query::mutations::user as user_mutations;
use crate::app::db_query::read::user as user_read;
use crate::app::games::mongodb_roulette::{MongoRouletteClient, RouletteUserStats};
use crate::app::games::roulette::{
    calculate_total_stake, execute_spin, validate_bet, RouletteBet,
};
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::bootstrap::database::AppState;

/// Roulette Controller
pub struct RouletteController;

// ============================================
// Request/Response Types
// ============================================

#[derive(Debug, Deserialize)]
pub struct PlaceBetRequest {
    pub bets: Vec<RouletteBet>,
}

#[derive(Debug, Serialize)]
pub struct PlaceBetResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub total_stake: i64,
    pub current_balance: i64,
    pub valid: bool,
}

#[derive(Debug, Deserialize)]
pub struct SpinRequest {
    pub bets: Vec<RouletteBet>,
    #[serde(default = "default_bet_multiplier")]
    pub bet_multiplier: i64,
}

fn default_bet_multiplier() -> i64 {
    1
}

/// Response wrapper matching frontend expectations
#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
        }
    }

    pub fn error(message: impl Into<String>) -> ApiResponse<()> {
        ApiResponse {
            success: false,
            data: None,
            message: Some(message.into()),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct SpinData {
    pub number: String,
    pub color: String,
    pub parity: String,
    pub winnings: i64,
    pub credits: i64,
    pub bet_results: Vec<BetResultData>,
}

#[derive(Debug, Serialize)]
pub struct BetResultData {
    pub bet_type: String,
    pub numbers: Vec<String>,
    pub amount: i64,
    pub won: bool,
    pub payout: i64,
}

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct HistoryData {
    pub history: Vec<HistoryItem>,
    pub page: i64,
    pub total_pages: i64,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct HistoryItem {
    pub id: String,
    pub result_number: String,
    pub result_color: String,
    pub result_parity: String,
    pub total_stake: i64,
    pub payout: i64,
    pub net_result: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub stats: RouletteUserStats,
}

#[derive(Debug, Serialize)]
pub struct BalanceResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub balance: i64,
}

/// Helper to get user_id from request extensions (set by JWT middleware)
fn get_user_id(req: &HttpRequest) -> Option<i64> {
    req.extensions().get::<i64>().copied()
}

impl RouletteController {
    /// POST /api/v1/roulette/place-bet
    ///
    /// Validates bets and checks if user has sufficient balance.
    /// Does NOT deduct balance - that happens on spin.
    pub async fn place_bet(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<PlaceBetRequest>,
    ) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match get_user_id(&req) {
            Some(id) => id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        let bets = &body.bets;

        // 2. Validate bets are not empty
        if bets.is_empty() {
            return HttpResponse::BadRequest().json(BaseResponse::error("No bets provided"));
        }

        // 3. Validate each bet
        for bet in bets {
            if let Err(e) = validate_bet(bet) {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "status": "error",
                    "message": format!("Invalid bet: {}", e)
                }));
            }
        }

        // 4. Calculate total stake
        let total_stake = calculate_total_stake(bets);

        // 5. Get user balance
        let db = state.db.lock().await;
        let user = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u,
            Err(e) => {
                error!("Failed to get user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get user"));
            }
        };

        // 6. Check if balance is sufficient
        let valid = user.balance >= total_stake;

        HttpResponse::Ok().json(PlaceBetResponse {
            base: if valid {
                BaseResponse::success("Bets validated")
            } else {
                BaseResponse::error("Insufficient balance")
            },
            total_stake,
            current_balance: user.balance,
            valid,
        })
    }

    /// POST /api/v1/roulette/spin
    ///
    /// Executes the spin, deducts stake, adds winnings, and saves to history.
    pub async fn spin(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<SpinRequest>,
    ) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match get_user_id(&req) {
            Some(id) => id,
            None => {
                return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized"));
            }
        };

        let bets = &body.bets;

        // 2. Validate bets are not empty
        if bets.is_empty() {
            return HttpResponse::BadRequest().json(ApiResponse::<()>::error("No bets provided"));
        }

        // 3. Validate each bet
        for bet in bets {
            if let Err(e) = validate_bet(bet) {
                return HttpResponse::BadRequest()
                    .json(ApiResponse::<()>::error(format!("Invalid bet: {}", e)));
            }
        }

        // 4. Calculate total stake (apply bet_multiplier)
        let bet_multiplier = body.bet_multiplier.max(1).min(5); // Clamp to valid range
        let base_stake = calculate_total_stake(bets);
        let total_stake = base_stake * bet_multiplier;

        // 5. Deduct balance atomically (check and deduct in one operation)
        let db = state.db.lock().await;
        match user_mutations::deduct_balance_if_sufficient(&db, user_id, total_stake).await {
            Ok(_) => {}
            Err(user_mutations::DeductBalanceError::InsufficientBalance { current, required }) => {
                warn!(
                    user_id = %user_id,
                    current = %current,
                    required = %required,
                    "Insufficient balance for roulette spin"
                );
                return HttpResponse::BadRequest()
                    .json(ApiResponse::<()>::error("Insufficient balance"));
            }
            Err(user_mutations::DeductBalanceError::UserNotFound) => {
                return HttpResponse::NotFound().json(ApiResponse::<()>::error("User not found"));
            }
            Err(e) => {
                error!("Failed to deduct balance for user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::error("Failed to process bet"));
            }
        }

        // 6. Execute spin
        let result = execute_spin(bets);

        // Apply bet_multiplier to winnings
        let final_payout = result.payout * bet_multiplier;

        // 7. Add winnings to balance if any
        if final_payout > 0 {
            if let Err(e) = user_mutations::add_balance(&db, user_id, final_payout).await {
                error!(
                    "Failed to add winnings to user {}: {}. Payout: {}",
                    user_id, e, final_payout
                );
            }
        }

        // 8. Save to history (MongoDB)
        if let Some(mongodb) = state.mongo() {
            let roulette_client = MongoRouletteClient::new(mongodb.clone());
            if let Err(e) = roulette_client
                .save_spin(
                    user_id,
                    &result.result_number,
                    &result.result_color,
                    &result.result_parity,
                    total_stake,
                    final_payout,
                    bets,
                    &result.bet_results,
                )
                .await
            {
                warn!("Failed to save roulette history: {}", e);
            }
        }

        // 9. Get updated balance
        let new_balance = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u.balance,
            Err(_) => 0,
        };

        info!(
            user_id = %user_id,
            result = %result.result_number,
            stake = %total_stake,
            payout = %final_payout,
            "Roulette spin completed"
        );

        // Convert bet results to response format (apply bet_multiplier to individual payouts)
        let bet_results: Vec<BetResultData> = result
            .bet_results
            .iter()
            .map(|r| BetResultData {
                bet_type: r.bet_type.clone(),
                numbers: r.numbers.clone(),
                amount: r.amount * bet_multiplier,
                won: r.won,
                payout: r.payout * bet_multiplier,
            })
            .collect();

        HttpResponse::Ok().json(ApiResponse::success(SpinData {
            number: result.result_number,
            color: result.result_color,
            parity: result.result_parity,
            winnings: final_payout,
            credits: new_balance,
            bet_results,
        }))
    }

    /// GET /api/v1/roulette/history
    ///
    /// Returns paginated game history for the authenticated user.
    pub async fn history(
        state: web::Data<AppState>,
        req: HttpRequest,
        query: web::Query<HistoryQuery>,
    ) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match get_user_id(&req) {
            Some(id) => id,
            None => {
                return HttpResponse::Unauthorized().json(ApiResponse::<()>::error("Unauthorized"));
            }
        };

        // 2. Parse pagination
        let page = query.page.unwrap_or(1).max(1);
        let limit = query.limit.unwrap_or(16).clamp(1, 100);
        let skip = ((page - 1) * limit) as u64;

        // 3. Get MongoDB client
        let mongodb = match state.mongo() {
            Some(db) => db,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(ApiResponse::<()>::error("Database unavailable"));
            }
        };

        let roulette_client = MongoRouletteClient::new(mongodb.clone());

        // 4. Get total count
        let total = match roulette_client.count_user_history(user_id).await {
            Ok(c) => c,
            Err(e) => {
                error!("Failed to count history for user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::error("Failed to get history"));
            }
        };

        // 5. Get history
        let history = match roulette_client.get_user_history(user_id, limit, skip).await {
            Ok(h) => h,
            Err(e) => {
                error!("Failed to get history for user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(ApiResponse::<()>::error("Failed to get history"));
            }
        };

        // 6. Map to response format
        let items: Vec<HistoryItem> = history
            .into_iter()
            .map(|h| HistoryItem {
                id: h.id.map(|id| id.to_hex()).unwrap_or_default(),
                result_number: h.result_number,
                result_color: h.result_color,
                result_parity: h.result_parity,
                total_stake: h.total_stake,
                payout: h.payout,
                net_result: h.net_result,
                created_at: h.created_at.to_rfc3339(),
            })
            .collect();

        let total_pages = ((total as f64) / (limit as f64)).ceil() as i64;

        HttpResponse::Ok().json(ApiResponse::success(HistoryData {
            history: items,
            page,
            total_pages,
            has_more: page < total_pages,
        }))
    }

    /// GET /api/v1/roulette/stats
    ///
    /// Returns user's roulette statistics.
    pub async fn stats(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match get_user_id(&req) {
            Some(id) => id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        // 2. Get MongoDB client
        let mongodb = match state.mongo() {
            Some(db) => db,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Database unavailable"));
            }
        };

        let roulette_client = MongoRouletteClient::new(mongodb.clone());

        // 3. Get stats
        let stats = match roulette_client.get_user_stats(user_id).await {
            Ok(s) => s,
            Err(e) => {
                error!("Failed to get stats for user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get stats"));
            }
        };

        HttpResponse::Ok().json(StatsResponse {
            base: BaseResponse::success("Stats retrieved"),
            stats,
        })
    }

    /// GET /api/v1/roulette/balance
    ///
    /// Returns user's current balance.
    pub async fn balance(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match get_user_id(&req) {
            Some(id) => id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        // 2. Get user balance
        let db = state.db.lock().await;
        let user = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u,
            Err(e) => {
                error!("Failed to get user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get balance"));
            }
        };

        HttpResponse::Ok().json(BalanceResponse {
            base: BaseResponse::success("Balance retrieved"),
            balance: user.balance,
        })
    }
}
