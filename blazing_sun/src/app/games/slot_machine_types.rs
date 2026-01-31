//! Slot Machine Types
//!
//! Type definitions for the slot machine game:
//! - Constants for grid dimensions and paylines
//! - Request/Response types matching PHP format for frontend compatibility
//! - Winning line structures

use serde::{Deserialize, Serialize};

// =============================================================================
// Constants
// =============================================================================

/// Number of reels in the slot machine
pub const REEL_COUNT: usize = 5;

/// Number of distinct symbols (1-6)
pub const SYMBOL_COUNT: usize = 6;

/// Grid size for multi-line mode (3 rows × 5 columns)
pub const GRID_SIZE: usize = 15;

/// Number of paylines in multi-line mode
pub const PAYLINE_COUNT: usize = 7;

/// Balance unit: 100 balance = 1 coin
pub const BALANCE_TO_COIN_RATIO: i64 = 100;

/// Joker cost multiplier (joker costs 5× the bet per line)
pub const JOKER_COST_MULTIPLIER: i64 = 5;

/// Joker symbol representation
pub const JOKER_SYMBOL: &str = "jok";

/// 7 paylines (indices into 15-position grid)
/// Grid layout:
///   Row 0 (top):    positions 0-4
///   Row 1 (middle): positions 5-9
///   Row 2 (bottom): positions 10-14
pub const PAYLINES: [[usize; 5]; 7] = [
    [5, 6, 7, 8, 9],       // Line 0: Middle row (horizontal)
    [0, 1, 2, 3, 4],       // Line 1: Top row (horizontal)
    [10, 11, 12, 13, 14],  // Line 2: Bottom row (horizontal)
    [5, 11, 7, 3, 9],      // Line 3: Diagonal pattern 1
    [5, 1, 7, 13, 9],      // Line 4: Diagonal pattern 2
    [0, 6, 12, 8, 4],      // Line 5: Zigzag down
    [10, 6, 2, 8, 14],     // Line 6: Zigzag up
];

/// Default payout odds for "numbers" game type
/// Format: [5x_high, 4x_high, 3x_high, 2x_high, 5x_mid, 4x_mid, 3x_mid, 2x_mid, 5x_low, 4x_low, 3x_low, 2x_low]
/// High = symbols 5,6; Mid = symbols 3,4; Low = symbols 1,2
pub const DEFAULT_KVOTE: [i64; 12] = [100, 50, 30, 5, 50, 30, 20, 4, 30, 20, 10, 3];

// =============================================================================
// Request Types (matching PHP frontend format)
// =============================================================================

/// Slot machine spin request from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlotSpinRequest {
    /// Current balance in coins (not database units)
    #[serde(rename = "brojKredita")]
    pub broj_kredita: i64,

    /// Bet per line in coins
    pub ulog: i64,

    /// Active lines array [1,1,1,0,0,0,0] where 1=active, 0=inactive
    /// Index 0 = line 1, index 6 = line 7
    #[serde(rename = "brojLinija")]
    pub broj_linija: Vec<u8>,

    /// Game mode: 1=multi-line (3x5), 2=single-line (1x5)
    pub nacin: u8,

    /// Joker position (0=none, 1-15=grid position)
    pub dzoker: u8,

    /// Joker cost in coins (must equal ulog*5 if dzoker>0)
    #[serde(rename = "vrednostDzokera")]
    pub vrednost_dzokera: i64,

    /// Payout odds array (12 elements)
    pub kvote: Vec<i64>,

    /// Game type (1=numbers, 2=roman, 3=fruits, 4=animals, 5=emoji)
    #[serde(default = "default_igra")]
    pub igra: u8,
}

fn default_igra() -> u8 {
    1
}

impl SlotSpinRequest {
    /// Count active lines
    pub fn active_line_count(&self) -> usize {
        self.broj_linija.iter().filter(|&&x| x == 1).count()
    }

    /// Calculate total bet (lines × bet + joker cost)
    pub fn total_bet(&self) -> i64 {
        if self.nacin == 2 {
            // Single-line mode: just the bet amount
            self.ulog
        } else {
            // Multi-line mode: (active lines × bet) + joker cost
            (self.active_line_count() as i64 * self.ulog) + self.vrednost_dzokera
        }
    }

    /// Validate joker cost (fraud detection)
    /// Returns true if valid, false if cheating detected
    pub fn validate_joker(&self) -> bool {
        if self.dzoker > 0 {
            self.vrednost_dzokera == self.ulog * JOKER_COST_MULTIPLIER
        } else {
            self.vrednost_dzokera == 0
        }
    }

    /// Get game mode name
    pub fn game_mode_name(&self) -> &'static str {
        match self.igra {
            1 => "numbers",
            2 => "roman",
            3 => "fruits",
            4 => "animals",
            5 => "emoji",
            _ => "numbers",
        }
    }

    /// Get reward mode name
    pub fn reward_mode_name(&self) -> &'static str {
        match self.nacin {
            1 => "multi",
            2 => "single",
            _ => "single",
        }
    }
}

// =============================================================================
// Response Types
// =============================================================================

/// Winning line details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WinLine {
    /// Symbol that matched (1-6)
    pub symbol: i32,
    /// Number of consecutive matches (2-5)
    pub match_count: i32,
    /// Payout multiplier from kvote
    pub multiplier: i64,
    /// Bet amount for this line
    pub bet: i64,
    /// Total payout for this line (bet × multiplier)
    pub payout: i64,
    /// Line index (0-6)
    pub line_index: u8,
}

impl WinLine {
    /// Convert to the PHP array format [symbol, match_count, multiplier, bet, payout, line_index]
    pub fn to_php_array(&self) -> Vec<serde_json::Value> {
        vec![
            serde_json::json!(self.symbol),
            serde_json::json!(self.match_count),
            serde_json::json!(self.multiplier),
            serde_json::json!(self.bet),
            serde_json::json!(self.payout),
            serde_json::json!(self.line_index),
        ]
    }
}

/// Slot machine spin result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotSpinResult {
    /// The 5 reel symbols (1-6)
    pub reels: Vec<i32>,
    /// The full 15-position grid (multi-line mode only)
    pub grid: Option<Vec<String>>,
    /// Winning line details
    pub winning_lines: Vec<WinLine>,
    /// Total payout in coins
    pub total_payout: i64,
    /// Whether mini-game was triggered
    pub mini_game_triggered: bool,
    /// Status message
    pub status: String,
}

impl SlotSpinResult {
    /// Convert to PHP response format
    /// Returns: [reel0, reel1, reel2, reel3, reel4, request_echo, status, winnings, new_balance, mini_game, win_details]
    pub fn to_php_response(
        &self,
        request_json: &str,
        new_balance: i64,
    ) -> serde_json::Value {
        let win_details: Vec<serde_json::Value> = if self.winning_lines.is_empty() {
            vec![serde_json::json!("nema dobitka")]
        } else {
            self.winning_lines
                .iter()
                .map(|w| serde_json::json!(w.to_php_array()))
                .collect()
        };

        serde_json::json!([
            self.reels.get(0).copied().unwrap_or(1),
            self.reels.get(1).copied().unwrap_or(1),
            self.reels.get(2).copied().unwrap_or(1),
            self.reels.get(3).copied().unwrap_or(1),
            self.reels.get(4).copied().unwrap_or(1),
            request_json,
            self.status,
            self.total_payout,
            new_balance,
            if self.mini_game_triggered { 1 } else { 0 },
            win_details
        ])
    }
}

// =============================================================================
// AJAX Request/Response
// =============================================================================

/// AJAX action request wrapper
#[derive(Debug, Deserialize)]
pub struct SlotMachineAjaxRequest {
    pub action: String,
    #[serde(flatten)]
    pub data: serde_json::Value,
}

/// Standard AJAX response
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

// =============================================================================
// History/Stats Response Types
// =============================================================================

/// Slot machine history item for API response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotHistoryItem {
    pub id: String,
    pub reels: Vec<i32>,
    pub active_lines: usize,
    pub bet_per_line: i64,
    pub total_bet: i64,
    pub total_payout: i64,
    pub net_result: i64,
    pub joker_enabled: bool,
    pub mini_game_triggered: bool,
    pub reward_mode: String,
    pub game_mode: String,
    pub timestamp: String,
}

/// Paginated history response
#[derive(Debug, Serialize)]
pub struct SlotHistoryResponse {
    pub history: Vec<SlotHistoryItem>,
    pub page: i64,
    pub total_pages: i64,
    pub has_more: bool,
}

/// User statistics response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotUserStats {
    pub user_id: i64,
    pub total_spins: i64,
    pub total_wagered: i64,
    pub total_won: i64,
    pub total_net: i64,
    pub wins: i64,
    pub losses: i64,
    pub win_rate: f64,
    pub biggest_win: i64,
    pub biggest_loss: i64,
    pub mini_games_triggered: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_request_active_line_count() {
        let req = SlotSpinRequest {
            broj_kredita: 1000,
            ulog: 2,
            broj_linija: vec![1, 1, 1, 0, 0, 0, 0],
            nacin: 1,
            dzoker: 0,
            vrednost_dzokera: 0,
            kvote: DEFAULT_KVOTE.to_vec(),
            igra: 1,
        };
        assert_eq!(req.active_line_count(), 3);
    }

    #[test]
    fn test_request_total_bet_multiline() {
        let req = SlotSpinRequest {
            broj_kredita: 1000,
            ulog: 2,
            broj_linija: vec![1, 1, 1, 0, 0, 0, 0],
            nacin: 1,
            dzoker: 0,
            vrednost_dzokera: 0,
            kvote: DEFAULT_KVOTE.to_vec(),
            igra: 1,
        };
        assert_eq!(req.total_bet(), 6); // 3 lines × 2
    }

    #[test]
    fn test_request_total_bet_with_joker() {
        let req = SlotSpinRequest {
            broj_kredita: 1000,
            ulog: 2,
            broj_linija: vec![1, 1, 1, 0, 0, 0, 0],
            nacin: 1,
            dzoker: 5,
            vrednost_dzokera: 10, // 2 × 5
            kvote: DEFAULT_KVOTE.to_vec(),
            igra: 1,
        };
        assert_eq!(req.total_bet(), 16); // (3 × 2) + 10
    }

    #[test]
    fn test_request_single_line_mode() {
        let req = SlotSpinRequest {
            broj_kredita: 1000,
            ulog: 5,
            broj_linija: vec![1, 0, 0, 0, 0, 0, 0],
            nacin: 2, // single-line
            dzoker: 0,
            vrednost_dzokera: 0,
            kvote: DEFAULT_KVOTE.to_vec(),
            igra: 1,
        };
        assert_eq!(req.total_bet(), 5); // Just the bet amount
    }

    #[test]
    fn test_validate_joker_valid() {
        let req = SlotSpinRequest {
            broj_kredita: 1000,
            ulog: 2,
            broj_linija: vec![1, 1, 1, 0, 0, 0, 0],
            nacin: 1,
            dzoker: 5,
            vrednost_dzokera: 10, // 2 × 5 = 10 ✓
            kvote: DEFAULT_KVOTE.to_vec(),
            igra: 1,
        };
        assert!(req.validate_joker());
    }

    #[test]
    fn test_validate_joker_fraud() {
        let req = SlotSpinRequest {
            broj_kredita: 1000,
            ulog: 2,
            broj_linija: vec![1, 1, 1, 0, 0, 0, 0],
            nacin: 1,
            dzoker: 5,
            vrednost_dzokera: 5, // Should be 10, fraud!
            kvote: DEFAULT_KVOTE.to_vec(),
            igra: 1,
        };
        assert!(!req.validate_joker());
    }

    #[test]
    fn test_validate_joker_no_joker() {
        let req = SlotSpinRequest {
            broj_kredita: 1000,
            ulog: 2,
            broj_linija: vec![1, 1, 1, 0, 0, 0, 0],
            nacin: 1,
            dzoker: 0,
            vrednost_dzokera: 0,
            kvote: DEFAULT_KVOTE.to_vec(),
            igra: 1,
        };
        assert!(req.validate_joker());
    }

    #[test]
    fn test_win_line_to_php_array() {
        let win = WinLine {
            symbol: 5,
            match_count: 3,
            multiplier: 30,
            bet: 2,
            payout: 60,
            line_index: 0,
        };
        let arr = win.to_php_array();
        assert_eq!(arr.len(), 6);
        assert_eq!(arr[0], serde_json::json!(5));
        assert_eq!(arr[1], serde_json::json!(3));
        assert_eq!(arr[5], serde_json::json!(0));
    }
}
