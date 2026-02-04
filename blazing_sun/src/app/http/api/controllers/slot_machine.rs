//! Slot Machine AJAX Controller
//!
//! WordPress-style single endpoint for slot machine game.
//! Handles all slot machine actions via a single POST endpoint.
//!
//! POST /api/games/slot-machine
//! - action=slot_spin: Execute spin, deduct balance, return results
//! - action=slot_minigame: Play triggered mini-game
//! - action=slot_history: Get paginated game history
//! - action=slot_stats: Get user's aggregate statistics

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use crate::app::db_query::mutations::user as user_mutations;
use crate::app::db_query::read::user as user_read;
use crate::app::games::mongodb_slot_machine::MongoSlotMachineClient;
use crate::app::games::slot_machine::execute_spin;
use crate::app::games::slot_machine_minigame::{
    execute_minigame, execute_ticket_minigame, MiniGameRequest, TicketMiniGameRequest,
};
use crate::app::games::slot_machine_types::{
    AjaxResponse, SlotHistoryItem, SlotHistoryResponse, SlotSpinRequest, SlotUserStats,
    BALANCE_TO_COIN_RATIO,
};
use crate::bootstrap::database::AppState;

/// Slot Machine AJAX Controller
pub struct SlotMachineController;

// ============================================
// Request Types
// ============================================

#[derive(Debug, Deserialize)]
pub struct SlotMachineAjaxRequest {
    pub action: String,
    #[serde(flatten)]
    pub data: serde_json::Value,
}

// ============================================
// Response Types
// ============================================

#[derive(Debug, Serialize)]
pub struct SpinResponseData {
    /// PHP-format response array
    pub result: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct MiniGameResponseData {
    pub drawn_numbers: Vec<i32>,
    pub number_results: Vec<NumberResultData>,
    pub total_bet: i64,
    pub total_payout: i64,
    pub net_result: i64,
    pub matches_count: u8,
    pub new_balance: i64,
    pub odds_info: OddsInfoData,
}

#[derive(Debug, Serialize)]
pub struct NumberResultData {
    pub number: i32,
    pub bet: i64,
    pub matched: bool,
    pub payout: i64,
}

#[derive(Debug, Serialize)]
pub struct OddsInfoData {
    pub probability: f64,
    pub odds: f64,
    pub description: String,
}

/// Response for ticket-based mini-game
#[derive(Debug, Serialize)]
pub struct TicketMiniGameResponseData {
    pub drawn_numbers: Vec<i32>,
    pub ticket_results: Vec<TicketResultData>,
    pub total_bet: i64,
    pub total_payout: i64,
    pub net_result: i64,
    pub new_balance: i64,
}

/// Single ticket result for response
#[derive(Debug, Serialize)]
pub struct TicketResultData {
    pub numbers_played: u8,
    pub matches: u8,
    pub bet: i64,
    pub payout: i64,
}

/// Helper to get user_id from request extensions (set by JWT middleware)
fn get_user_id(req: &HttpRequest) -> Option<i64> {
    req.extensions().get::<i64>().copied()
}

impl SlotMachineController {
    /// POST /api/games/slot-machine
    ///
    /// Single AJAX endpoint that routes to different handlers based on action.
    pub async fn handle(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<SlotMachineAjaxRequest>,
    ) -> HttpResponse {
        // Authenticate user
        let user_id = match get_user_id(&req) {
            Some(id) => id,
            None => {
                return HttpResponse::Unauthorized()
                    .json(AjaxResponse::<()>::error("Unauthorized"));
            }
        };

        // Route based on action
        match body.action.as_str() {
            "slot_spin" => Self::spin(state, user_id, &body.data).await,
            "slot_minigame" => Self::minigame(state, user_id, &body.data).await,
            "slot_history" => Self::history(state, user_id, &body.data).await,
            "slot_stats" => Self::stats(state, user_id).await,
            _ => HttpResponse::BadRequest().json(AjaxResponse::<()>::error("Invalid action")),
        }
    }

    /// Handle slot_spin action
    async fn spin(
        state: web::Data<AppState>,
        user_id: i64,
        data: &serde_json::Value,
    ) -> HttpResponse {
        // Parse spin request
        let request: SlotSpinRequest = match serde_json::from_value(data.clone()) {
            Ok(r) => r,
            Err(e) => {
                return HttpResponse::BadRequest()
                    .json(AjaxResponse::<()>::error(format!("Invalid request: {}", e)));
            }
        };

        // Validate joker cost (fraud detection)
        if !request.validate_joker() {
            // Fraud detected - zero out balance
            let db = state.db.lock().await;
            if let Err(e) = user_mutations::update_partial(
                &db,
                user_id,
                &user_mutations::UpdateUserPartialParams {
                    first_name: None,
                    last_name: None,
                    balance: Some(0),
                    password: None,
                },
            )
            .await
            {
                error!("Failed to zero balance for fraud: {}", e);
            }

            warn!(
                user_id = %user_id,
                expected_joker_cost = %request.ulog * 5,
                actual_joker_cost = %request.vrednost_dzokera,
                "Joker fraud detected"
            );

            // Return fraud response in PHP format
            let fraud_response = serde_json::json!([
                1, 1, 1, 1, 1,
                serde_json::to_string(&request).unwrap_or_default(),
                "Varali ste, krediti su vam oduzeti",
                0,
                0,
                0,
                ["nema dobitka"]
            ]);

            return HttpResponse::Ok().json(AjaxResponse::success(SpinResponseData {
                result: fraud_response,
            }));
        }

        // Calculate total bet in coins
        let total_bet_coins = request.total_bet();

        // Convert to balance units (1 coin = 100 balance)
        let total_bet_balance = total_bet_coins * BALANCE_TO_COIN_RATIO;

        // Deduct balance atomically
        let db = state.db.lock().await;
        match user_mutations::deduct_balance_if_sufficient(&db, user_id, total_bet_balance).await {
            Ok(_) => {}
            Err(user_mutations::DeductBalanceError::InsufficientBalance { current, required }) => {
                warn!(
                    user_id = %user_id,
                    current = %current,
                    required = %required,
                    "Insufficient balance for slot spin"
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
        let result = execute_spin(&request);

        // Add winnings to balance if any (convert coins to balance units)
        if result.total_payout > 0 {
            let payout_balance = result.total_payout * BALANCE_TO_COIN_RATIO;
            if let Err(e) = user_mutations::add_balance(&db, user_id, payout_balance).await {
                error!(
                    "Failed to add winnings to user {}: {}. Payout: {}",
                    user_id, e, result.total_payout
                );
            }
        }

        // Get updated balance (in coins for response)
        let new_balance_coins = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u.balance / BALANCE_TO_COIN_RATIO,
            Err(_) => 0,
        };

        // Save to history (MongoDB)
        if let Some(mongodb) = state.mongo() {
            let slot_client = MongoSlotMachineClient::new(mongodb.clone());
            if let Err(e) = slot_client
                .save_spin(
                    user_id,
                    &result.reels,
                    result.grid.clone(),
                    &request.broj_linija,
                    request.ulog,
                    total_bet_coins,
                    request.dzoker > 0,
                    if request.dzoker > 0 {
                        Some(request.dzoker)
                    } else {
                        None
                    },
                    request.vrednost_dzokera,
                    &result.winning_lines,
                    result.total_payout,
                    result.mini_game_triggered,
                    request.reward_mode_name(),
                    request.game_mode_name(),
                )
                .await
            {
                warn!("Failed to save slot machine history: {}", e);
            }
        }

        info!(
            user_id = %user_id,
            reels = ?result.reels,
            bet = %total_bet_coins,
            payout = %result.total_payout,
            mini_game = %result.mini_game_triggered,
            "Slot machine spin completed"
        );

        // Convert result to PHP format
        let request_json = serde_json::to_string(&request).unwrap_or_default();
        let php_response = result.to_php_response(&request_json, new_balance_coins);

        HttpResponse::Ok().json(AjaxResponse::success(SpinResponseData {
            result: php_response,
        }))
    }

    /// Handle slot_minigame action
    /// Supports both old format (bets array) and new format (tickets + coin_value)
    async fn minigame(
        state: web::Data<AppState>,
        user_id: i64,
        data: &serde_json::Value,
    ) -> HttpResponse {
        // Detect request format: new format has "tickets" field
        if data.get("tickets").is_some() {
            // New ticket-based format
            return Self::minigame_tickets(&state, user_id, data).await;
        }

        // Get user's current balance for validation (old format)
        let db = state.db.lock().await;
        let user_balance_coins = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u.balance / BALANCE_TO_COIN_RATIO,
            Err(_) => {
                return HttpResponse::NotFound().json(AjaxResponse::<()>::error("User not found"));
            }
        };

        // Old format with individual bets
        let mut request: MiniGameRequest = match serde_json::from_value(data.clone()) {
            Ok(r) => r,
            Err(e) => {
                return HttpResponse::BadRequest()
                    .json(AjaxResponse::<()>::error(format!("Invalid request: {}", e)));
            }
        };

        // Set user_coins for validation
        request.user_coins = user_balance_coins;

        // Execute mini-game (includes validation)
        let result = match execute_minigame(&request) {
            Ok(r) => r,
            Err(e) => {
                return HttpResponse::BadRequest().json(AjaxResponse::<()>::error(e));
            }
        };

        // Deduct total bet from balance
        if result.total_bet > 0 {
            let bet_balance = result.total_bet * BALANCE_TO_COIN_RATIO;
            if let Err(e) =
                user_mutations::deduct_balance_if_sufficient(&db, user_id, bet_balance).await
            {
                error!(
                    "Failed to deduct mini-game bet from user {}: {}. Bet: {}",
                    user_id, e, result.total_bet
                );
                return HttpResponse::BadRequest()
                    .json(AjaxResponse::<()>::error("Insufficient balance"));
            }
        }

        // Add winnings to balance if any (convert coins to balance units)
        if result.total_payout > 0 {
            let payout_balance = result.total_payout * BALANCE_TO_COIN_RATIO;
            if let Err(e) = user_mutations::add_balance(&db, user_id, payout_balance).await {
                error!(
                    "Failed to add mini-game winnings to user {}: {}. Payout: {}",
                    user_id, e, result.total_payout
                );
            }
        }

        // Get updated balance (in coins)
        let new_balance_coins = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u.balance / BALANCE_TO_COIN_RATIO,
            Err(_) => 0,
        };

        // Save to history (MongoDB)
        if let Some(mongodb) = state.mongo() {
            let slot_client = MongoSlotMachineClient::new(mongodb.clone());
            if let Err(e) = slot_client
                .save_minigame(
                    user_id,
                    None, // No parent spin ID in this flow
                    &result.number_results,
                    &result.drawn_numbers,
                    result.total_bet,
                    result.total_payout,
                    result.matches_count,
                )
                .await
            {
                warn!("Failed to save mini-game history: {}", e);
            }
        }

        info!(
            user_id = %user_id,
            drawn = ?result.drawn_numbers,
            total_bet = %result.total_bet,
            payout = %result.total_payout,
            matches = %result.matches_count,
            "Slot machine mini-game completed"
        );

        // Convert to response format
        let number_results: Vec<NumberResultData> = result
            .number_results
            .into_iter()
            .map(|nr| NumberResultData {
                number: nr.number,
                bet: nr.bet,
                matched: nr.matched,
                payout: nr.payout,
            })
            .collect();

        HttpResponse::Ok().json(AjaxResponse::success(MiniGameResponseData {
            drawn_numbers: result.drawn_numbers,
            number_results,
            total_bet: result.total_bet,
            total_payout: result.total_payout,
            net_result: result.net_result,
            matches_count: result.matches_count,
            new_balance: new_balance_coins,
            odds_info: OddsInfoData {
                probability: result.odds_info.probability,
                odds: result.odds_info.odds,
                description: result.odds_info.description,
            },
        }))
    }

    /// Handle ticket-based mini-game (new format)
    async fn minigame_tickets(
        state: &web::Data<AppState>,
        user_id: i64,
        data: &serde_json::Value,
    ) -> HttpResponse {
        // Parse ticket-based request
        let mut request: TicketMiniGameRequest = match serde_json::from_value(data.clone()) {
            Ok(r) => r,
            Err(e) => {
                return HttpResponse::BadRequest()
                    .json(AjaxResponse::<()>::error(format!("Invalid request: {}", e)));
            }
        };

        // Get user's current balance for validation
        let db = state.db.lock().await;
        let user_balance_coins = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u.balance / BALANCE_TO_COIN_RATIO,
            Err(_) => {
                return HttpResponse::NotFound().json(AjaxResponse::<()>::error("User not found"));
            }
        };

        // Set user_coins for validation
        request.user_coins = user_balance_coins;

        // Execute ticket mini-game (includes validation)
        let result = match execute_ticket_minigame(&request) {
            Ok(r) => r,
            Err(e) => {
                return HttpResponse::BadRequest().json(AjaxResponse::<()>::error(e));
            }
        };

        // Deduct total bet from balance
        if result.total_bet > 0 {
            let bet_balance = result.total_bet * BALANCE_TO_COIN_RATIO;
            if let Err(e) =
                user_mutations::deduct_balance_if_sufficient(&db, user_id, bet_balance).await
            {
                error!(
                    "Failed to deduct ticket mini-game bet from user {}: {}. Bet: {}",
                    user_id, e, result.total_bet
                );
                return HttpResponse::BadRequest()
                    .json(AjaxResponse::<()>::error("Insufficient balance"));
            }
        }

        // Add winnings to balance if any
        if result.total_payout > 0 {
            let payout_balance = result.total_payout * BALANCE_TO_COIN_RATIO;
            if let Err(e) = user_mutations::add_balance(&db, user_id, payout_balance).await {
                error!(
                    "Failed to add ticket mini-game winnings to user {}: {}. Payout: {}",
                    user_id, e, result.total_payout
                );
            }
        }

        // Get updated balance (in coins)
        let new_balance_coins = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u.balance / BALANCE_TO_COIN_RATIO,
            Err(_) => 0,
        };

        // Calculate total matches for logging
        let total_matches: u8 = result.ticket_results.iter().map(|t| t.matches).sum();

        info!(
            user_id = %user_id,
            drawn = ?result.drawn_numbers,
            coin_value = %request.coin_value,
            total_bet = %result.total_bet,
            payout = %result.total_payout,
            matches = %total_matches,
            "Slot machine ticket mini-game completed"
        );

        // Convert to response format
        let ticket_results: Vec<TicketResultData> = result
            .ticket_results
            .into_iter()
            .map(|tr| TicketResultData {
                numbers_played: tr.numbers_played,
                matches: tr.matches,
                bet: tr.bet,
                payout: tr.payout,
            })
            .collect();

        HttpResponse::Ok().json(AjaxResponse::success(TicketMiniGameResponseData {
            drawn_numbers: result.drawn_numbers,
            ticket_results,
            total_bet: result.total_bet,
            total_payout: result.total_payout,
            net_result: result.net_result,
            new_balance: new_balance_coins,
        }))
    }

    /// Handle slot_history action
    async fn history(
        state: web::Data<AppState>,
        user_id: i64,
        data: &serde_json::Value,
    ) -> HttpResponse {
        let page = data
            .get("page")
            .and_then(|v| v.as_i64())
            .unwrap_or(1)
            .max(1);
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

        let slot_client = MongoSlotMachineClient::new(mongodb.clone());

        // Get total count
        let total = match slot_client.count_user_history(user_id).await {
            Ok(c) => c,
            Err(e) => {
                error!("Failed to count history for user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(AjaxResponse::<()>::error("Failed to get history"));
            }
        };

        // Get history
        let history = match slot_client.get_user_history(user_id, limit, skip).await {
            Ok(h) => h,
            Err(e) => {
                error!("Failed to get history for user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(AjaxResponse::<()>::error("Failed to get history"));
            }
        };

        // Map to response format
        let items: Vec<SlotHistoryItem> = history.into_iter().map(SlotHistoryItem::from).collect();

        let total_pages = ((total as f64) / (limit as f64)).ceil() as i64;

        HttpResponse::Ok().json(AjaxResponse::success(SlotHistoryResponse {
            history: items,
            page,
            total_pages,
            has_more: page < total_pages,
        }))
    }

    /// Handle slot_stats action
    async fn stats(state: web::Data<AppState>, user_id: i64) -> HttpResponse {
        // Get MongoDB client
        let mongodb = match state.mongo() {
            Some(db) => db,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(AjaxResponse::<()>::error("Database unavailable"));
            }
        };

        let slot_client = MongoSlotMachineClient::new(mongodb.clone());

        // Get stats
        let stats = match slot_client.get_user_stats(user_id).await {
            Ok(s) => s,
            Err(e) => {
                error!("Failed to get stats for user {}: {}", user_id, e);
                return HttpResponse::InternalServerError()
                    .json(AjaxResponse::<()>::error("Failed to get stats"));
            }
        };

        HttpResponse::Ok().json(AjaxResponse::success(stats))
    }
}
