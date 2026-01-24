//!
//! Game Config Controller
//!
//! Public endpoint to expose game configuration to frontend.
//! GET /api/v1/games/config: Get game configuration values
//!

use actix_web::HttpResponse;
use serde::Serialize;

use crate::config::GamesConfig;

/// Game configuration response
#[derive(Debug, Serialize)]
pub struct GameConfigResponse {
    pub bigger_dice: BiggerDiceConfig,
}

/// Bigger Dice game configuration
#[derive(Debug, Serialize)]
pub struct BiggerDiceConfig {
    pub entry_fee_cents: i64,
    pub ready_timeout_seconds: i32,
    pub winning_percentage: i32,
}

/// Get game configuration
///
/// GET /api/v1/games/config
///
/// Returns configuration for all games (currently Bigger Dice).
/// This is a public endpoint - no authentication required.
pub async fn get_config() -> HttpResponse {
    let config = GameConfigResponse {
        bigger_dice: BiggerDiceConfig {
            entry_fee_cents: GamesConfig::bigger_dice_entry_fee_cents(),
            ready_timeout_seconds: GamesConfig::bigger_dice_ready_timeout_seconds(),
            winning_percentage: GamesConfig::bigger_dice_winning_percentage(),
        },
    };

    HttpResponse::Ok().json(config)
}
