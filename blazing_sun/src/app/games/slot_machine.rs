//! Slot Machine Game Logic
//!
//! Core game logic for the slot machine:
//! - Symbol generation (random 1-6)
//! - Grid building (expand 5 reels to 15-position grid)
//! - Payline evaluation with joker wildcard
//! - Payout calculation based on kvote odds

use rand::Rng;

use super::slot_machine_types::{
    SlotSpinRequest, SlotSpinResult, WinLine, GRID_SIZE, JOKER_SYMBOL, PAYLINES, REEL_COUNT,
    SYMBOL_COUNT,
};

// =============================================================================
// Symbol Generation
// =============================================================================

/// Generate random symbols for the 5 reels (values 1-6)
pub fn generate_symbols() -> Vec<i32> {
    let mut rng = rand::thread_rng();
    (0..REEL_COUNT)
        .map(|_| rng.gen_range(1..=SYMBOL_COUNT as i32))
        .collect()
}

// =============================================================================
// Grid Building
// =============================================================================

/// Build the 15-position grid from 5 reel symbols
///
/// Grid layout for multi-line mode:
///   Row 0 (top):    symbols[i] + 1 (or wrap to 1 if 6)
///   Row 1 (middle): symbols[i]
///   Row 2 (bottom): symbols[i] - 1 (or wrap to 6 if 1)
///
/// Positions:
///   [0, 1, 2, 3, 4]     <- top row
///   [5, 6, 7, 8, 9]     <- middle row
///   [10, 11, 12, 13, 14] <- bottom row
pub fn build_grid(symbols: &[i32], joker_position: u8) -> Vec<String> {
    assert!(symbols.len() >= REEL_COUNT, "Need at least 5 symbols");

    let mut grid = vec![String::new(); GRID_SIZE];

    for i in 0..REEL_COUNT {
        let symbol = symbols[i];

        // Top row: symbol + 1 (wrap 6 -> 1)
        let top = if symbol == SYMBOL_COUNT as i32 {
            1
        } else {
            symbol + 1
        };

        // Middle row: the actual symbol
        let mid = symbol;

        // Bottom row: symbol - 1 (wrap 1 -> 6)
        let bot = if symbol == 1 {
            SYMBOL_COUNT as i32
        } else {
            symbol - 1
        };

        grid[i] = top.to_string();      // positions 0-4
        grid[i + 5] = mid.to_string();  // positions 5-9
        grid[i + 10] = bot.to_string(); // positions 10-14
    }

    // Apply joker if specified (1-indexed position)
    if joker_position > 0 && (joker_position as usize) <= GRID_SIZE {
        grid[(joker_position - 1) as usize] = JOKER_SYMBOL.to_string();
    }

    grid
}

// =============================================================================
// Payline Evaluation
// =============================================================================

/// Count consecutive matching symbols from left to right on a payline
///
/// The joker ('jok') acts as a wildcard:
/// - If first symbol is joker, it takes the value of the second symbol
/// - If last symbol is joker, it takes the value of the previous symbol
/// - Middle jokers take the value of the symbol before them
///
/// Returns: (first_symbol_value, match_count)
fn count_consecutive_matches(line_symbols: &[String]) -> (i32, usize) {
    assert!(line_symbols.len() >= REEL_COUNT, "Payline must have 5 symbols");

    // Resolve jokers to actual symbol values (PHP logic)
    let mut resolved: Vec<i32> = Vec::with_capacity(REEL_COUNT);

    for (i, sym) in line_symbols.iter().enumerate() {
        if sym == JOKER_SYMBOL {
            // Joker takes value from adjacent symbol
            if i == 0 {
                // First position: look ahead
                let next_val = line_symbols
                    .get(1)
                    .and_then(|s| s.parse::<i32>().ok())
                    .unwrap_or(1);
                resolved.push(next_val);
            } else {
                // Middle/last position: look behind
                resolved.push(*resolved.last().unwrap_or(&1));
            }
        } else {
            resolved.push(sym.parse::<i32>().unwrap_or(1));
        }
    }

    // Count consecutive matches from left
    let first_symbol = resolved[0];
    let mut count = 1;

    for &sym in &resolved[1..] {
        if sym == first_symbol {
            count += 1;
        } else {
            break;
        }
    }

    (first_symbol, count)
}

/// Evaluate a single payline and return winnings if any
fn evaluate_payline(
    grid: &[String],
    payline: &[usize; 5],
    line_index: u8,
    kvote: &[i64],
    bet: i64,
) -> Option<WinLine> {
    // Extract symbols for this payline
    let line_symbols: Vec<String> = payline.iter().map(|&idx| grid[idx].clone()).collect();

    let (symbol, match_count) = count_consecutive_matches(&line_symbols);

    // Need at least 2 matches to win
    if match_count < 2 {
        return None;
    }

    // Get payout multiplier from kvote based on symbol and match count
    let multiplier = get_multiplier(symbol, match_count, kvote);

    if multiplier == 0 {
        return None;
    }

    let payout = bet * multiplier;

    Some(WinLine {
        symbol,
        match_count: match_count as i32,
        multiplier,
        bet,
        payout,
        line_index,
    })
}

/// Get payout multiplier from kvote array
///
/// kvote layout (12 elements):
///   [0-3]: symbols 5,6 - 5x, 4x, 3x, 2x multipliers
///   [4-7]: symbols 3,4 - 5x, 4x, 3x, 2x multipliers
///   [8-11]: symbols 1,2 - 5x, 4x, 3x, 2x multipliers
fn get_multiplier(symbol: i32, match_count: usize, kvote: &[i64]) -> i64 {
    if kvote.len() < 12 || match_count < 2 || match_count > 5 {
        return 0;
    }

    // Determine symbol group offset
    let group_offset = match symbol {
        5 | 6 => 0,  // High symbols
        3 | 4 => 4,  // Mid symbols
        1 | 2 => 8,  // Low symbols
        _ => return 0,
    };

    // Determine match count offset (5x=0, 4x=1, 3x=2, 2x=3)
    let match_offset = match match_count {
        5 => 0,
        4 => 1,
        3 => 2,
        2 => 3,
        _ => return 0,
    };

    kvote.get(group_offset + match_offset).copied().unwrap_or(0)
}

// =============================================================================
// Main Spin Execution
// =============================================================================

/// Execute a slot machine spin
///
/// # Flow:
/// 1. Generate random symbols
/// 2. Build grid (for multi-line mode)
/// 3. Evaluate active paylines
/// 4. Calculate total payout
/// 5. Determine if mini-game triggered
pub fn execute_spin(request: &SlotSpinRequest) -> SlotSpinResult {
    // Generate random symbols
    let reels = generate_symbols();

    if request.nacin == 2 {
        // Single-line mode: evaluate only the 5 reels directly
        execute_single_line_spin(request, reels)
    } else {
        // Multi-line mode: build grid and evaluate all active paylines
        execute_multi_line_spin(request, reels)
    }
}

/// Execute single-line mode spin (nacin == 2)
fn execute_single_line_spin(request: &SlotSpinRequest, reels: Vec<i32>) -> SlotSpinResult {
    // Convert reels to strings for consistent processing
    let line_symbols: Vec<String> = reels.iter().map(|&s| s.to_string()).collect();

    let (symbol, match_count) = count_consecutive_matches(&line_symbols);

    let mut winning_lines = Vec::new();
    let mut total_payout = 0;

    if match_count >= 2 {
        let multiplier = get_multiplier(symbol, match_count, &request.kvote);
        if multiplier > 0 {
            let payout = request.ulog * multiplier;
            total_payout = payout;
            winning_lines.push(WinLine {
                symbol,
                match_count: match_count as i32,
                multiplier,
                bet: request.ulog,
                payout,
                line_index: 0,
            });
        }
    }

    // Mini-game triggered randomly on win
    let mini_game_triggered = if total_payout > 0 {
        rand::thread_rng().gen_bool(0.5)
    } else {
        false
    };

    SlotSpinResult {
        reels,
        grid: None,
        winning_lines,
        total_payout,
        mini_game_triggered,
        status: "Sve ok3".to_string(),
    }
}

/// Execute multi-line mode spin (nacin == 1)
fn execute_multi_line_spin(request: &SlotSpinRequest, reels: Vec<i32>) -> SlotSpinResult {
    // Build the 15-position grid
    let grid = build_grid(&reels, request.dzoker);

    let mut winning_lines = Vec::new();
    let mut total_payout = 0;

    // Evaluate each active payline
    for (i, payline) in PAYLINES.iter().enumerate() {
        // Check if this line is active
        if request.broj_linija.get(i).copied().unwrap_or(0) == 1 {
            if let Some(win) = evaluate_payline(&grid, payline, i as u8, &request.kvote, request.ulog)
            {
                total_payout += win.payout;
                winning_lines.push(win);
            }
        }
    }

    // Mini-game triggered randomly on win
    let mini_game_triggered = if total_payout > 0 {
        rand::thread_rng().gen_bool(0.5)
    } else {
        false
    };

    // Determine status based on joker validation
    let status = if request.dzoker > 0 {
        "Sve ok1".to_string()
    } else {
        "Sve ok2".to_string()
    };

    SlotSpinResult {
        reels,
        grid: Some(grid),
        winning_lines,
        total_payout,
        mini_game_triggered,
        status,
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app::games::slot_machine_types::DEFAULT_KVOTE;

    #[test]
    fn test_generate_symbols() {
        let symbols = generate_symbols();
        assert_eq!(symbols.len(), REEL_COUNT);
        for s in &symbols {
            assert!(*s >= 1 && *s <= SYMBOL_COUNT as i32);
        }
    }

    #[test]
    fn test_build_grid_no_joker() {
        let symbols = vec![1, 2, 3, 4, 5];
        let grid = build_grid(&symbols, 0);

        assert_eq!(grid.len(), GRID_SIZE);

        // Check middle row (should match symbols)
        assert_eq!(grid[5], "1");
        assert_eq!(grid[6], "2");
        assert_eq!(grid[7], "3");
        assert_eq!(grid[8], "4");
        assert_eq!(grid[9], "5");

        // Check top row (symbol + 1, wrap 6->1)
        assert_eq!(grid[0], "2"); // 1 + 1 = 2
        assert_eq!(grid[1], "3"); // 2 + 1 = 3
        assert_eq!(grid[4], "6"); // 5 + 1 = 6

        // Check bottom row (symbol - 1, wrap 1->6)
        assert_eq!(grid[10], "6"); // 1 - 1 = 6 (wrap)
        assert_eq!(grid[11], "1"); // 2 - 1 = 1
    }

    #[test]
    fn test_build_grid_with_joker() {
        let symbols = vec![1, 2, 3, 4, 5];
        let grid = build_grid(&symbols, 7); // Position 7 = grid index 6

        assert_eq!(grid[6], JOKER_SYMBOL);
    }

    #[test]
    fn test_count_consecutive_matches_all_same() {
        let symbols: Vec<String> = vec!["5", "5", "5", "5", "5"]
            .into_iter()
            .map(String::from)
            .collect();
        let (symbol, count) = count_consecutive_matches(&symbols);
        assert_eq!(symbol, 5);
        assert_eq!(count, 5);
    }

    #[test]
    fn test_count_consecutive_matches_partial() {
        let symbols: Vec<String> = vec!["3", "3", "3", "4", "5"]
            .into_iter()
            .map(String::from)
            .collect();
        let (symbol, count) = count_consecutive_matches(&symbols);
        assert_eq!(symbol, 3);
        assert_eq!(count, 3);
    }

    #[test]
    fn test_count_consecutive_matches_with_joker() {
        let symbols: Vec<String> = vec!["3", "jok", "3", "4", "5"]
            .into_iter()
            .map(String::from)
            .collect();
        let (symbol, count) = count_consecutive_matches(&symbols);
        assert_eq!(symbol, 3);
        assert_eq!(count, 3); // 3, jok(=3), 3
    }

    #[test]
    fn test_count_consecutive_matches_joker_first() {
        let symbols: Vec<String> = vec!["jok", "5", "5", "5", "5"]
            .into_iter()
            .map(String::from)
            .collect();
        let (symbol, count) = count_consecutive_matches(&symbols);
        assert_eq!(symbol, 5); // Joker takes value of next symbol
        assert_eq!(count, 5);
    }

    #[test]
    fn test_get_multiplier_high_symbols() {
        let kvote = DEFAULT_KVOTE.to_vec();

        // Symbol 5 or 6, 5 matches = 100x
        assert_eq!(get_multiplier(5, 5, &kvote), 100);
        assert_eq!(get_multiplier(6, 5, &kvote), 100);

        // Symbol 5 or 6, 4 matches = 50x
        assert_eq!(get_multiplier(5, 4, &kvote), 50);

        // Symbol 5 or 6, 3 matches = 30x
        assert_eq!(get_multiplier(5, 3, &kvote), 30);

        // Symbol 5 or 6, 2 matches = 5x
        assert_eq!(get_multiplier(5, 2, &kvote), 5);
    }

    #[test]
    fn test_get_multiplier_mid_symbols() {
        let kvote = DEFAULT_KVOTE.to_vec();

        // Symbol 3 or 4, 5 matches = 50x
        assert_eq!(get_multiplier(3, 5, &kvote), 50);
        assert_eq!(get_multiplier(4, 5, &kvote), 50);

        // Symbol 3 or 4, 2 matches = 4x
        assert_eq!(get_multiplier(3, 2, &kvote), 4);
    }

    #[test]
    fn test_get_multiplier_low_symbols() {
        let kvote = DEFAULT_KVOTE.to_vec();

        // Symbol 1 or 2, 5 matches = 30x
        assert_eq!(get_multiplier(1, 5, &kvote), 30);
        assert_eq!(get_multiplier(2, 5, &kvote), 30);

        // Symbol 1 or 2, 2 matches = 3x
        assert_eq!(get_multiplier(1, 2, &kvote), 3);
    }

    #[test]
    fn test_evaluate_payline_win() {
        // Grid with all 5s in middle row
        let mut grid = vec![String::from("1"); GRID_SIZE];
        for i in 5..10 {
            grid[i] = String::from("5");
        }

        let kvote = DEFAULT_KVOTE.to_vec();
        let win = evaluate_payline(&grid, &PAYLINES[0], 0, &kvote, 2);

        assert!(win.is_some());
        let w = win.unwrap();
        assert_eq!(w.symbol, 5);
        assert_eq!(w.match_count, 5);
        assert_eq!(w.multiplier, 100);
        assert_eq!(w.payout, 200); // 2 × 100
    }

    #[test]
    fn test_evaluate_payline_no_win() {
        // Grid with no consecutive symbols
        let grid: Vec<String> = (1..=15).map(|i| ((i % 6) + 1).to_string()).collect();

        let kvote = DEFAULT_KVOTE.to_vec();
        let win = evaluate_payline(&grid, &PAYLINES[0], 0, &kvote, 2);

        assert!(win.is_none());
    }

    #[test]
    fn test_execute_spin_single_line() {
        let request = SlotSpinRequest {
            broj_kredita: 1000,
            ulog: 2,
            broj_linija: vec![1, 0, 0, 0, 0, 0, 0],
            nacin: 2, // Single-line mode
            dzoker: 0,
            vrednost_dzokera: 0,
            kvote: DEFAULT_KVOTE.to_vec(),
            igra: 1,
        };

        let result = execute_spin(&request);

        assert_eq!(result.reels.len(), REEL_COUNT);
        assert!(result.grid.is_none());
        assert_eq!(result.status, "Sve ok3");
    }

    #[test]
    fn test_execute_spin_multi_line() {
        let request = SlotSpinRequest {
            broj_kredita: 1000,
            ulog: 2,
            broj_linija: vec![1, 1, 1, 0, 0, 0, 0],
            nacin: 1, // Multi-line mode
            dzoker: 0,
            vrednost_dzokera: 0,
            kvote: DEFAULT_KVOTE.to_vec(),
            igra: 1,
        };

        let result = execute_spin(&request);

        assert_eq!(result.reels.len(), REEL_COUNT);
        assert!(result.grid.is_some());
        assert_eq!(result.grid.as_ref().unwrap().len(), GRID_SIZE);
        assert_eq!(result.status, "Sve ok2");
    }

    #[test]
    fn test_execute_spin_with_joker() {
        let request = SlotSpinRequest {
            broj_kredita: 1000,
            ulog: 2,
            broj_linija: vec![1, 1, 1, 0, 0, 0, 0],
            nacin: 1,
            dzoker: 7, // Position 7 (middle row, position 2)
            vrednost_dzokera: 10,
            kvote: DEFAULT_KVOTE.to_vec(),
            igra: 1,
        };

        let result = execute_spin(&request);

        assert!(result.grid.is_some());
        let grid = result.grid.unwrap();
        assert_eq!(grid[6], JOKER_SYMBOL); // Position 7 - 1 = index 6
        assert_eq!(result.status, "Sve ok1");
    }
}
