//! Roulette AJAX Controller
//!
//! WordPress-style single endpoint for roulette game.
//! Handles all roulette actions via a single POST endpoint.
//!
//! POST /api/games/roulette
//! - action=roulette_place_bet: Validate bets and check balance
//! - action=roulette_spin: Execute spin, update balance, save history
//! - action=roulette_history: Get paginated game history

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use crate::app::db_query::mutations::user as user_mutations;
use crate::app::db_query::read::user as user_read;
use crate::app::games::mongodb_roulette::MongoRouletteClient;
use crate::app::games::roulette::{
    calculate_total_stake, execute_spin, validate_bet, RouletteBet,
};
use crate::bootstrap::database::AppState;

/// Roulette AJAX Controller
pub struct RouletteAjaxController;

// ============================================
// Request Types
// ============================================

#[derive(Debug, Deserialize)]
pub struct RouletteAjaxRequest {
    pub action: String,
    #[serde(default)]
    pub nonce: Option<String>,
    // Bet placement fields
    #[serde(default)]
    pub bets: Option<String>,
    #[serde(default)]
    pub total_stake: Option<i64>,
    // History pagination
    #[serde(default)]
    pub page: Option<i64>,
}

// ============================================
// Response Types
// ============================================

#[derive(Debug, Serialize)]
pub struct AjaxResponse<T: Serialize> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

impl<T: Serialize> AjaxResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
        }
    }

    pub fn error(message: impl Into<String>) -> AjaxResponse<()> {
        AjaxResponse {
            success: false,
            data: None,
            message: Some(message.into()),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct PlaceBetData {
    pub valid: bool,
    pub total_stake: i64,
    pub credits: i64,
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
    pub number: String,
    pub color: String,
    pub parity: String,
    pub stake: i64,
    pub payout: i64,
    pub net: i64,
    pub timestamp: String,
}

/// Helper to get user_id from request extensions (set by JWT middleware)
fn get_user_id(req: &HttpRequest) -> Option<i64> {
    req.extensions().get::<i64>().copied()
}

/// Parse bets from JSON string
fn parse_bets(bets_json: &str) -> Result<Vec<RouletteBet>, String> {
    serde_json::from_str(bets_json).map_err(|e| format!("Invalid bets format: {}", e))
}

impl RouletteAjaxController {
    /// POST /api/games/roulette
    ///
    /// Single AJAX endpoint that routes to different handlers based on action.
    pub async fn handle(
        state: web::Data<AppState>,
        req: HttpRequest,
        form: web::Form<RouletteAjaxRequest>,
    ) -> HttpResponse {
        // Authenticate user
        let user_id = match get_user_id(&req) {
            Some(id) => id,
            None => {
                return HttpResponse::Unauthorized().json(AjaxResponse::<()>::error("Unauthorized"));
            }
        };

        // Route based on action
        match form.action.as_str() {
            "roulette_place_bet" => Self::place_bet(state, user_id, &form).await,
            "roulette_spin" => Self::spin(state, user_id, &form).await,
            "roulette_history" => Self::history(state, user_id, &form).await,
            _ => HttpResponse::BadRequest().json(AjaxResponse::<()>::error("Invalid action")),
        }
    }

    /// Handle place_bet action
    async fn place_bet(
        state: web::Data<AppState>,
        user_id: i64,
        form: &RouletteAjaxRequest,
    ) -> HttpResponse {
        // Parse bets from JSON string
        let bets_json = match &form.bets {
            Some(b) => b,
            None => {
                return HttpResponse::BadRequest()
                    .json(AjaxResponse::<()>::error("No bets provided"));
            }
        };

        let bets = match parse_bets(bets_json) {
            Ok(b) => b,
            Err(e) => {
                return HttpResponse::BadRequest().json(AjaxResponse::<()>::error(e));
            }
        };

        // Validate each bet
        for bet in &bets {
            if let Err(e) = validate_bet(bet) {
                return HttpResponse::BadRequest()
                    .json(AjaxResponse::<()>::error(format!("Invalid bet: {}", e)));
            }
        }

        // Calculate total stake
        let total_stake = calculate_total_stake(&bets);

        // Get user balance
        let db = state.db.lock().await;
        let user = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u,
            Err(e) => {
                error!("Failed to get user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(AjaxResponse::<()>::error("Failed to get user"));
            }
        };

        // Check if balance is sufficient
        let valid = user.balance >= total_stake;

        HttpResponse::Ok().json(AjaxResponse::success(PlaceBetData {
            valid,
            total_stake,
            credits: user.balance,
        }))
    }

    /// Handle spin action
    async fn spin(
        state: web::Data<AppState>,
        user_id: i64,
        form: &RouletteAjaxRequest,
    ) -> HttpResponse {
        // Parse bets from JSON string
        let bets_json = match &form.bets {
            Some(b) => b,
            None => {
                return HttpResponse::BadRequest()
                    .json(AjaxResponse::<()>::error("No bets provided"));
            }
        };

        let bets = match parse_bets(bets_json) {
            Ok(b) => b,
            Err(e) => {
                return HttpResponse::BadRequest().json(AjaxResponse::<()>::error(e));
            }
        };

        // Validate each bet
        for bet in &bets {
            if let Err(e) = validate_bet(bet) {
                return HttpResponse::BadRequest()
                    .json(AjaxResponse::<()>::error(format!("Invalid bet: {}", e)));
            }
        }

        // Calculate total stake
        let total_stake = calculate_total_stake(&bets);

        // Deduct balance atomically
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
                    .json(AjaxResponse::<()>::error("Insufficient balance"));
            }
            Err(user_mutations::DeductBalanceError::UserNotFound) => {
                return HttpResponse::NotFound().json(AjaxResponse::<()>::error("User not found"));
            }
            Err(e) => {
                error!("Failed to deduct balance for user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(AjaxResponse::<()>::error("Failed to process bet"));
            }
        }

        // Execute spin
        let result = execute_spin(&bets);

        // Add winnings to balance if any
        if result.payout > 0 {
            if let Err(e) = user_mutations::add_balance(&db, user_id, result.payout).await {
                error!(
                    "Failed to add winnings to user {}: {}. Payout: {}",
                    user_id, e, result.payout
                );
            }
        }

        // Save to history (MongoDB)
        if let Some(mongodb) = state.mongo() {
            let roulette_client = MongoRouletteClient::new(mongodb.clone());
            if let Err(e) = roulette_client
                .save_spin(
                    user_id,
                    &result.result_number,
                    &result.result_color,
                    &result.result_parity,
                    total_stake,
                    result.payout,
                    &bets,
                    &result.bet_results,
                )
                .await
            {
                warn!("Failed to save roulette history: {}", e);
            }
        }

        // Get updated balance
        let new_balance = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u.balance,
            Err(_) => 0,
        };

        info!(
            user_id = %user_id,
            result = %result.result_number,
            stake = %total_stake,
            payout = %result.payout,
            "Roulette spin completed"
        );

        // Convert bet results to response format
        let bet_results: Vec<BetResultData> = result
            .bet_results
            .into_iter()
            .map(|r| BetResultData {
                bet_type: r.bet_type,
                numbers: r.numbers,
                amount: r.amount,
                won: r.won,
                payout: r.payout,
            })
            .collect();

        HttpResponse::Ok().json(AjaxResponse::success(SpinData {
            number: result.result_number,
            color: result.result_color,
            parity: result.result_parity,
            winnings: result.payout,
            credits: new_balance,
            bet_results,
        }))
    }

    /// Handle history action
    async fn history(
        state: web::Data<AppState>,
        user_id: i64,
        form: &RouletteAjaxRequest,
    ) -> HttpResponse {
        let page = form.page.unwrap_or(1).max(1);
        let limit: i64 = 16;
        let skip = ((page - 1) * limit) as u64;

        // Get MongoDB client
        let mongodb = match state.mongo() {
            Some(db) => db,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(AjaxResponse::<()>::error("Database unavailable"));
            }
        };

        let roulette_client = MongoRouletteClient::new(mongodb.clone());

        // Get total count
        let total = match roulette_client.count_user_history(user_id).await {
            Ok(c) => c,
            Err(e) => {
                error!("Failed to count history for user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(AjaxResponse::<()>::error("Failed to get history"));
            }
        };

        // Get history
        let history = match roulette_client.get_user_history(user_id, limit, skip).await {
            Ok(h) => h,
            Err(e) => {
                error!("Failed to get history for user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(AjaxResponse::<()>::error("Failed to get history"));
            }
        };

        // Map to response format
        let items: Vec<HistoryItem> = history
            .into_iter()
            .map(|h| HistoryItem {
                id: h.id.map(|id| id.to_hex()).unwrap_or_default(),
                number: h.result_number,
                color: h.result_color,
                parity: h.result_parity,
                stake: h.total_stake,
                payout: h.payout,
                net: h.net_result,
                timestamp: h.created_at.to_rfc3339(),
            })
            .collect();

        let total_pages = ((total as f64) / (limit as f64)).ceil() as i64;

        HttpResponse::Ok().json(AjaxResponse::success(HistoryData {
            history: items,
            page,
            total_pages,
            has_more: page < total_pages,
        }))
    }
}
