//! Slot Machine Mini-Game (Keno-style number betting)
//!
//! Mini-game that triggers randomly after winning spins:
//! - User picks numbers from pool 1-30 (each number only once)
//! - User assigns a bet amount to each picked number
//! - Bet amounts: 10, 50, 100, 200, 300, 500, 1000 coins
//! - System draws 12 random numbers
//! - Each matched number pays: bet × odds (2.5x fair odds at 40% probability)
//!
//! Mathematical Probability:
//! P(specific number is drawn) = 12/30 = 40%
//! Fair odds = 1/0.4 = 2.5x

use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// =============================================================================
// Constants
// =============================================================================

/// Number pool for mini-game (1-30)
pub const NUMBER_POOL_SIZE: i32 = 30;

/// Numbers drawn per game
pub const DRAWN_NUMBERS_COUNT: usize = 12;

/// Maximum numbers a user can bet on
pub const MAX_BETS: usize = 30;

/// Valid bet amounts
pub const BET_AMOUNTS: [i64; 7] = [10, 50, 100, 200, 300, 500, 1000];

/// Payout odds for matched numbers
/// P(match) = 12/30 = 40%, fair odds = 2.5x
pub const PAYOUT_ODDS: f64 = 2.5;

/// Probability of a single number being drawn (for display)
pub const MATCH_PROBABILITY: f64 = 40.0;

// =============================================================================
// Request/Response Types
// =============================================================================

/// Single number bet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NumberBet {
    /// Number selected (1-30)
    pub number: i32,
    /// Bet amount for this number
    pub bet: i64,
}

/// Mini-game request from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniGameRequest {
    /// List of number bets (each number with its bet amount)
    pub bets: Vec<NumberBet>,
    /// User's available coins (for validation)
    pub user_coins: i64,
}

/// Single number result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NumberResult {
    /// The number that was bet on
    pub number: i32,
    /// Bet amount for this number
    pub bet: i64,
    /// Whether this number was matched
    pub matched: bool,
    /// Payout for this number (0 if not matched)
    pub payout: i64,
}

/// Odds info for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OddsInfo {
    /// Probability (percentage)
    pub probability: f64,
    /// Payout multiplier
    pub odds: f64,
    /// Description
    pub description: String,
}

/// Mini-game result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniGameResult {
    /// The 12 drawn numbers
    pub drawn_numbers: Vec<i32>,
    /// Results for each bet
    pub number_results: Vec<NumberResult>,
    /// Total bet amount
    pub total_bet: i64,
    /// Total payout
    pub total_payout: i64,
    /// Net result (payout - bet)
    pub net_result: i64,
    /// Numbers matched count
    pub matches_count: u8,
    /// Odds info for display
    pub odds_info: OddsInfo,
}

/// Mini-game report for history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MiniGameReport {
    /// Numbers bet on
    pub numbers_played: u8,
    /// Numbers matched
    pub numbers_matched: u8,
    /// Total bet
    pub total_bet: i64,
    /// Total payout
    pub total_payout: i64,
}

// =============================================================================
// Validation
// =============================================================================

/// Validate mini-game request
/// Rules:
/// - Must have at least one bet
/// - Maximum 30 bets (one per number)
/// - Numbers must be in range 1-30
/// - No duplicate numbers
/// - Bet amounts must be valid (10, 50, 100, 200, 300, 500, 1000)
/// - Total bets must not exceed user's coins
pub fn validate_request(request: &MiniGameRequest) -> Result<(), String> {
    // Must have at least one bet
    if request.bets.is_empty() {
        return Err("Must place at least one bet".to_string());
    }

    // Maximum bets
    if request.bets.len() > MAX_BETS {
        return Err(format!(
            "Maximum {} bets allowed, got {}",
            MAX_BETS,
            request.bets.len()
        ));
    }

    let mut seen_numbers: HashMap<i32, bool> = HashMap::new();
    let mut total_bet: i64 = 0;

    for bet in &request.bets {
        // Validate number range
        if bet.number < 1 || bet.number > NUMBER_POOL_SIZE {
            return Err(format!(
                "Invalid number {}, must be 1-{}",
                bet.number, NUMBER_POOL_SIZE
            ));
        }

        // Check for duplicate numbers
        if seen_numbers.contains_key(&bet.number) {
            return Err(format!(
                "Duplicate number {} - each number can only be selected once",
                bet.number
            ));
        }
        seen_numbers.insert(bet.number, true);

        // Validate bet amount
        if !BET_AMOUNTS.contains(&bet.bet) {
            return Err(format!(
                "Invalid bet amount {}. Valid amounts: {:?}",
                bet.bet, BET_AMOUNTS
            ));
        }

        total_bet += bet.bet;
    }

    // Check total bet against user's coins
    if total_bet > request.user_coins {
        return Err(format!(
            "Total bet ({}) exceeds available coins ({})",
            total_bet, request.user_coins
        ));
    }

    Ok(())
}

// =============================================================================
// Game Logic
// =============================================================================

/// Draw random numbers for the mini-game
pub fn draw_numbers() -> Vec<i32> {
    let mut rng = rand::thread_rng();
    let mut pool: Vec<i32> = (1..=NUMBER_POOL_SIZE).collect();
    pool.shuffle(&mut rng);
    pool.into_iter().take(DRAWN_NUMBERS_COUNT).collect()
}

/// Calculate payout for a matched number
fn calculate_payout(bet: i64) -> i64 {
    (bet as f64 * PAYOUT_ODDS).round() as i64
}

/// Build odds info for display
fn build_odds_info() -> OddsInfo {
    OddsInfo {
        probability: MATCH_PROBABILITY,
        odds: PAYOUT_ODDS,
        description: format!(
            "Each number has {}% chance to match. Matched numbers pay {}x the bet.",
            MATCH_PROBABILITY, PAYOUT_ODDS
        ),
    }
}

/// Execute the mini-game
pub fn execute_minigame(request: &MiniGameRequest) -> Result<MiniGameResult, String> {
    validate_request(request)?;

    let drawn_numbers = draw_numbers();
    let mut number_results = Vec::with_capacity(request.bets.len());
    let mut total_bet: i64 = 0;
    let mut total_payout: i64 = 0;
    let mut matches_count: u8 = 0;

    for bet in &request.bets {
        let matched = drawn_numbers.contains(&bet.number);
        let payout = if matched {
            matches_count += 1;
            calculate_payout(bet.bet)
        } else {
            0
        };

        total_bet += bet.bet;
        total_payout += payout;

        number_results.push(NumberResult {
            number: bet.number,
            bet: bet.bet,
            matched,
            payout,
        });
    }

    Ok(MiniGameResult {
        drawn_numbers,
        number_results,
        total_bet,
        total_payout,
        net_result: total_payout - total_bet,
        matches_count,
        odds_info: build_odds_info(),
    })
}

/// Generate mini-game report for history
pub fn generate_report(result: &MiniGameResult) -> MiniGameReport {
    MiniGameReport {
        numbers_played: result.number_results.len() as u8,
        numbers_matched: result.matches_count,
        total_bet: result.total_bet,
        total_payout: result.total_payout,
    }
}

/// Get valid bet amounts (for frontend display)
pub fn get_bet_amounts() -> Vec<i64> {
    BET_AMOUNTS.to_vec()
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_valid_request() -> MiniGameRequest {
        MiniGameRequest {
            bets: vec![
                NumberBet { number: 1, bet: 100 },
                NumberBet { number: 5, bet: 50 },
                NumberBet { number: 10, bet: 200 },
            ],
            user_coins: 1000,
        }
    }

    #[test]
    fn test_validate_request_valid() {
        let request = make_valid_request();
        assert!(validate_request(&request).is_ok());
    }

    #[test]
    fn test_validate_request_empty_bets() {
        let request = MiniGameRequest {
            bets: vec![],
            user_coins: 1000,
        };
        assert!(validate_request(&request).is_err());
    }

    #[test]
    fn test_validate_request_invalid_number() {
        let request = MiniGameRequest {
            bets: vec![NumberBet { number: 31, bet: 100 }],
            user_coins: 1000,
        };
        let result = validate_request(&request);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid number"));
    }

    #[test]
    fn test_validate_request_duplicate_numbers() {
        let request = MiniGameRequest {
            bets: vec![
                NumberBet { number: 5, bet: 100 },
                NumberBet { number: 5, bet: 50 },
            ],
            user_coins: 1000,
        };
        let result = validate_request(&request);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Duplicate"));
    }

    #[test]
    fn test_validate_request_invalid_bet_amount() {
        let request = MiniGameRequest {
            bets: vec![NumberBet { number: 1, bet: 75 }],
            user_coins: 1000,
        };
        let result = validate_request(&request);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid bet amount"));
    }

    #[test]
    fn test_validate_request_exceeds_coins() {
        let request = MiniGameRequest {
            bets: vec![
                NumberBet { number: 1, bet: 1000 },
                NumberBet { number: 2, bet: 1000 },
            ],
            user_coins: 1500,
        };
        let result = validate_request(&request);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("exceeds available coins"));
    }

    #[test]
    fn test_draw_numbers() {
        let drawn = draw_numbers();
        assert_eq!(drawn.len(), DRAWN_NUMBERS_COUNT);

        // All numbers should be unique
        let mut sorted = drawn.clone();
        sorted.sort();
        sorted.dedup();
        assert_eq!(sorted.len(), DRAWN_NUMBERS_COUNT);

        // All numbers should be in range
        for n in &drawn {
            assert!(*n >= 1 && *n <= NUMBER_POOL_SIZE);
        }
    }

    #[test]
    fn test_calculate_payout() {
        // 100 × 2.5 = 250
        assert_eq!(calculate_payout(100), 250);
        // 50 × 2.5 = 125
        assert_eq!(calculate_payout(50), 125);
        // 1000 × 2.5 = 2500
        assert_eq!(calculate_payout(1000), 2500);
    }

    #[test]
    fn test_execute_minigame() {
        let request = make_valid_request();
        let result = execute_minigame(&request);

        assert!(result.is_ok());
        let res = result.unwrap();

        assert_eq!(res.drawn_numbers.len(), DRAWN_NUMBERS_COUNT);
        assert_eq!(res.number_results.len(), 3);
        assert_eq!(res.total_bet, 350); // 100 + 50 + 200

        // Verify each result
        for nr in &res.number_results {
            assert!(nr.number >= 1 && nr.number <= 30);
            assert!(BET_AMOUNTS.contains(&nr.bet));
            if nr.matched {
                assert_eq!(nr.payout, calculate_payout(nr.bet));
            } else {
                assert_eq!(nr.payout, 0);
            }
        }

        // Verify matches count
        let actual_matches = res.number_results.iter().filter(|r| r.matched).count();
        assert_eq!(actual_matches as u8, res.matches_count);

        // Verify net result
        assert_eq!(res.net_result, res.total_payout - res.total_bet);
    }

    #[test]
    fn test_execute_minigame_all_numbers() {
        // Bet on all 30 numbers
        let bets: Vec<NumberBet> = (1..=30)
            .map(|n| NumberBet { number: n, bet: 10 })
            .collect();

        let request = MiniGameRequest {
            bets,
            user_coins: 500,
        };

        let result = execute_minigame(&request);
        assert!(result.is_ok());
        let res = result.unwrap();

        // With all 30 numbers, exactly 12 should match
        assert_eq!(res.matches_count, 12);
        assert_eq!(res.total_bet, 300); // 30 × 10
        assert_eq!(res.total_payout, 300); // 12 × 10 × 2.5 = 300
    }

    #[test]
    fn test_generate_report() {
        let result = MiniGameResult {
            drawn_numbers: vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            number_results: vec![
                NumberResult {
                    number: 1,
                    bet: 100,
                    matched: true,
                    payout: 250,
                },
                NumberResult {
                    number: 15,
                    bet: 50,
                    matched: false,
                    payout: 0,
                },
            ],
            total_bet: 150,
            total_payout: 250,
            net_result: 100,
            matches_count: 1,
            odds_info: build_odds_info(),
        };

        let report = generate_report(&result);
        assert_eq!(report.numbers_played, 2);
        assert_eq!(report.numbers_matched, 1);
        assert_eq!(report.total_bet, 150);
        assert_eq!(report.total_payout, 250);
    }

    #[test]
    fn test_get_bet_amounts() {
        let amounts = get_bet_amounts();
        assert_eq!(amounts, vec![10, 50, 100, 200, 300, 500, 1000]);
    }

    #[test]
    fn test_build_odds_info() {
        let info = build_odds_info();
        assert_eq!(info.probability, 40.0);
        assert_eq!(info.odds, 2.5);
        assert!(!info.description.is_empty());
    }
}
