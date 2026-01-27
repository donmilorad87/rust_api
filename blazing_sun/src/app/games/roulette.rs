//! Roulette game logic
//!
//! This module contains the game logic for the roulette game.
//! Based on American roulette with 0 and 00.

use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Valid chip multipliers (bet amounts)
pub const CHIP_MULTIPLIERS: [i64; 10] = [1, 2, 5, 10, 20, 30, 50, 100, 200, 500];

/// Maximum tokens per field
pub const MAX_TOKENS_PER_FIELD: i64 = 16;

/// Red numbers on the roulette wheel
pub const RED_NUMBERS: [i32; 18] = [
    1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
];

/// American roulette wheel order (result pool)
pub const RESULT_POOL: [&str; 38] = [
    "0", "28", "9", "26", "30", "11", "7", "20", "32", "17", "5", "22", "34", "15", "3", "24", "36",
    "13", "1", "00", "27", "10", "25", "29", "12", "8", "19", "31", "18", "6", "21", "33", "16", "4",
    "23", "35", "14", "2",
];

/// Bet payouts by bet type
pub fn get_bet_payouts() -> HashMap<&'static str, i64> {
    let mut payouts = HashMap::new();
    payouts.insert("straight", 35);
    payouts.insert("split", 17);
    payouts.insert("street", 11);
    payouts.insert("corner", 8);
    payouts.insert("line", 5);
    payouts.insert("basket", 6);
    payouts.insert("column", 2);
    payouts.insert("dozen", 2);
    payouts.insert("color", 1);
    payouts.insert("parity", 1);
    payouts.insert("range", 1);
    payouts.insert("sector", 35);
    payouts
}

/// A single bet placed by the player (matches PHP frontend format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteBet {
    /// Bet type: straight, split, street, corner, line, basket, column, dozen, color, parity, range, sector
    #[serde(rename = "type")]
    pub bet_type: String,
    /// Number of chips/tokens placed
    pub tokens: i64,
    /// Chip value multiplier (1, 2, 5, 10, 20, etc.)
    pub multiplier: i64,
    /// The bet target value (e.g., "5" for straight on 5, "red" for color bet)
    #[serde(default)]
    pub value: Option<String>,
    /// Unique key for this bet position
    pub key: String,
    /// Target numbers for split/street/corner bets
    #[serde(default)]
    pub targets: Option<Vec<String>>,
}

impl RouletteBet {
    /// Calculate the total amount for this bet (tokens * multiplier)
    pub fn amount(&self) -> i64 {
        self.tokens * self.multiplier
    }

    /// Get the numbers covered by this bet
    pub fn get_covered_numbers(&self) -> Vec<String> {
        // For bets with explicit targets, use those
        if let Some(ref targets) = self.targets {
            if !targets.is_empty() {
                return targets.clone();
            }
        }

        // Otherwise derive from value/key based on bet type
        match self.bet_type.as_str() {
            "straight" | "sector" => {
                if let Some(ref v) = self.value {
                    vec![v.clone()]
                } else {
                    vec![self.key.clone()]
                }
            }
            "split" | "street" | "corner" | "line" => {
                // Parse from key which contains the numbers
                self.key.split('-').map(|s| s.to_string()).collect()
            }
            "column" => {
                // Column bets: 1st (1,4,7...), 2nd (2,5,8...), 3rd (3,6,9...)
                let col = self.value.as_ref().map(|v| v.as_str()).unwrap_or(&self.key);
                match col {
                    "1st" | "col1" | "1" => (1..=36).filter(|n| n % 3 == 1).map(|n| n.to_string()).collect(),
                    "2nd" | "col2" | "2" => (1..=36).filter(|n| n % 3 == 2).map(|n| n.to_string()).collect(),
                    "3rd" | "col3" | "3" | _ => (1..=36).filter(|n| n % 3 == 0).map(|n| n.to_string()).collect(),
                }
            }
            "dozen" => {
                let dozen = self.value.as_ref().map(|v| v.as_str()).unwrap_or(&self.key);
                match dozen {
                    "1st" | "1-12" | "1" => (1..=12).map(|n| n.to_string()).collect(),
                    "2nd" | "13-24" | "2" => (13..=24).map(|n| n.to_string()).collect(),
                    "3rd" | "25-36" | "3" | _ => (25..=36).map(|n| n.to_string()).collect(),
                }
            }
            "color" => {
                let color = self.value.as_ref().map(|v| v.as_str()).unwrap_or(&self.key);
                if color == "red" {
                    RED_NUMBERS.iter().map(|n| n.to_string()).collect()
                } else {
                    // Black numbers
                    (1..=36)
                        .filter(|n| !RED_NUMBERS.contains(n))
                        .map(|n| n.to_string())
                        .collect()
                }
            }
            "parity" => {
                let parity = self.value.as_ref().map(|v| v.as_str()).unwrap_or(&self.key);
                if parity == "odd" {
                    (1..=36).filter(|n| n % 2 == 1).map(|n| n.to_string()).collect()
                } else {
                    (1..=36).filter(|n| n % 2 == 0).map(|n| n.to_string()).collect()
                }
            }
            "range" => {
                let range = self.value.as_ref().map(|v| v.as_str()).unwrap_or(&self.key);
                if range == "1-18" || range == "low" {
                    (1..=18).map(|n| n.to_string()).collect()
                } else {
                    (19..=36).map(|n| n.to_string()).collect()
                }
            }
            "basket" => {
                // Basket bet covers 0, 00, 1, 2, 3
                vec!["0".to_string(), "00".to_string(), "1".to_string(), "2".to_string(), "3".to_string()]
            }
            _ => vec![],
        }
    }
}

/// Spin result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpinResult {
    /// The winning number (0, 00, or 1-36)
    pub result_number: String,
    /// Color: red, black, or green
    pub result_color: String,
    /// Parity: odd, even, or none (for 0/00)
    pub result_parity: String,
    /// Total payout in cents
    pub payout: i64,
    /// Individual bet results
    pub bet_results: Vec<BetResult>,
}

/// Result of a single bet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BetResult {
    pub bet_type: String,
    pub numbers: Vec<String>,
    pub amount: i64,
    pub won: bool,
    pub payout: i64,
}

/// Validate a bet structure
pub fn validate_bet(bet: &RouletteBet) -> Result<(), String> {
    // Validate bet type
    let valid_types = [
        "straight", "split", "street", "corner", "line", "basket", "column", "dozen", "color",
        "parity", "range", "sector",
    ];
    if !valid_types.contains(&bet.bet_type.as_str()) {
        return Err(format!("Invalid bet type: {}", bet.bet_type));
    }

    // Validate tokens
    if bet.tokens <= 0 {
        return Err("Tokens must be positive".to_string());
    }

    // Validate multiplier
    if bet.multiplier <= 0 {
        return Err("Multiplier must be positive".to_string());
    }

    // Validate key is not empty
    if bet.key.is_empty() {
        return Err("Bet key is required".to_string());
    }

    Ok(())
}

/// Calculate total stake from bets
pub fn calculate_total_stake(bets: &[RouletteBet]) -> i64 {
    bets.iter().map(|b| b.amount()).sum()
}

/// Determine the color of a number
pub fn determine_color(number: &str) -> String {
    if number == "0" || number == "00" {
        return "green".to_string();
    }

    if let Ok(n) = number.parse::<i32>() {
        if RED_NUMBERS.contains(&n) {
            "red".to_string()
        } else {
            "black".to_string()
        }
    } else {
        "green".to_string()
    }
}

/// Determine the parity of a number
pub fn determine_parity(number: &str) -> String {
    if number == "0" || number == "00" {
        return "none".to_string();
    }

    if let Ok(n) = number.parse::<i32>() {
        if n % 2 == 0 {
            "even".to_string()
        } else {
            "odd".to_string()
        }
    } else {
        "none".to_string()
    }
}

/// Spin the roulette wheel and get a random result
pub fn spin_wheel() -> String {
    let mut rng = rand::thread_rng();
    let index = rng.gen_range(0..RESULT_POOL.len());
    RESULT_POOL[index].to_string()
}

/// Calculate winnings for all bets based on the result
pub fn calculate_winnings(bets: &[RouletteBet], result: &str) -> (i64, Vec<BetResult>) {
    let payouts = get_bet_payouts();
    let mut total_payout: i64 = 0;
    let mut bet_results = Vec::new();

    for bet in bets {
        let covered_numbers = bet.get_covered_numbers();
        let bet_amount = bet.amount();
        let won = check_bet_wins(bet, result, &covered_numbers);
        let payout = if won {
            let multiplier = payouts.get(bet.bet_type.as_str()).copied().unwrap_or(0);
            bet_amount + (bet_amount * multiplier)
        } else {
            0
        };

        total_payout += payout;

        bet_results.push(BetResult {
            bet_type: bet.bet_type.clone(),
            numbers: covered_numbers,
            amount: bet_amount,
            won,
            payout,
        });
    }

    (total_payout, bet_results)
}

/// Check if a bet wins based on the result
fn check_bet_wins(bet: &RouletteBet, result: &str, covered_numbers: &[String]) -> bool {
    match bet.bet_type.as_str() {
        "straight" | "split" | "street" | "corner" | "line" | "basket" | "sector"
        | "column" | "dozen" | "range" => {
            if result == "0" || result == "00" {
                // 0 and 00 only win straight bets on those numbers
                return covered_numbers.iter().any(|n| n == result);
            }
            covered_numbers.iter().any(|n| n == result)
        }
        "color" => {
            if result == "0" || result == "00" {
                return false;
            }
            let result_color = determine_color(result);
            let bet_color = bet.value.as_ref().map(|v| v.as_str()).unwrap_or(&bet.key);
            result_color == bet_color
        }
        "parity" => {
            if result == "0" || result == "00" {
                return false;
            }
            let result_parity = determine_parity(result);
            let bet_parity = bet.value.as_ref().map(|v| v.as_str()).unwrap_or(&bet.key);
            result_parity == bet_parity
        }
        _ => false,
    }
}

/// Execute a full spin with bets
pub fn execute_spin(bets: &[RouletteBet]) -> SpinResult {
    let result_number = spin_wheel();
    let result_color = determine_color(&result_number);
    let result_parity = determine_parity(&result_number);
    let (payout, bet_results) = calculate_winnings(bets, &result_number);

    SpinResult {
        result_number,
        result_color,
        result_parity,
        payout,
        bet_results,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_determine_color() {
        assert_eq!(determine_color("0"), "green");
        assert_eq!(determine_color("00"), "green");
        assert_eq!(determine_color("1"), "red");
        assert_eq!(determine_color("2"), "black");
        assert_eq!(determine_color("3"), "red");
    }

    #[test]
    fn test_determine_parity() {
        assert_eq!(determine_parity("0"), "none");
        assert_eq!(determine_parity("00"), "none");
        assert_eq!(determine_parity("1"), "odd");
        assert_eq!(determine_parity("2"), "even");
    }

    #[test]
    fn test_validate_bet() {
        let valid_bet = RouletteBet {
            bet_type: "straight".to_string(),
            numbers: vec!["17".to_string()],
            amount: 100,
        };
        assert!(validate_bet(&valid_bet).is_ok());

        let invalid_bet = RouletteBet {
            bet_type: "straight".to_string(),
            numbers: vec!["17".to_string(), "18".to_string()],
            amount: 100,
        };
        assert!(validate_bet(&invalid_bet).is_err());
    }

    #[test]
    fn test_calculate_winnings_straight() {
        let bets = vec![RouletteBet {
            bet_type: "straight".to_string(),
            numbers: vec!["17".to_string()],
            amount: 100,
        }];

        let (payout, results) = calculate_winnings(&bets, "17");
        assert_eq!(payout, 3600); // 100 + (100 * 35)
        assert!(results[0].won);

        let (payout, results) = calculate_winnings(&bets, "18");
        assert_eq!(payout, 0);
        assert!(!results[0].won);
    }
}
