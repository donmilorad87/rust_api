//! Payout Calculation Unit Tests
//!
//! # Test Coverage
//! - [x] Straight bet payout (35:1)
//! - [x] Split bet payout (17:1)
//! - [x] Street bet payout (11:1)
//! - [x] Corner bet payout (8:1)
//! - [x] Line bet payout (5:1)
//! - [x] Basket bet payout (6:1)
//! - [x] Column bet payout (2:1)
//! - [x] Dozen bet payout (2:1)
//! - [x] Color bet payout (1:1)
//! - [x] Parity bet payout (1:1)
//! - [x] Range bet payout (1:1)
//! - [x] 0/00 edge cases

use blazing_sun::app::games::roulette::{
    calculate_winnings, get_bet_payouts, RouletteBet,
};
use tabled::{settings::Style, Table, Tabled};

#[derive(Tabled)]
struct PayoutTestResult {
    #[tabled(rename = "Bet Type")]
    bet_type: String,
    #[tabled(rename = "Bet Amount")]
    bet_amount: i64,
    #[tabled(rename = "Winning #")]
    winning_number: String,
    #[tabled(rename = "Expected Payout")]
    expected_payout: i64,
    #[tabled(rename = "Actual Payout")]
    actual_payout: i64,
    #[tabled(rename = "Status")]
    status: String,
}

impl PayoutTestResult {
    fn new(
        bet_type: &str,
        bet_amount: i64,
        winning_number: &str,
        expected: i64,
        actual: i64,
    ) -> Self {
        let passed = expected == actual;
        Self {
            bet_type: bet_type.to_string(),
            bet_amount,
            winning_number: winning_number.to_string(),
            expected_payout: expected,
            actual_payout: actual,
            status: if passed { "PASS".to_string() } else { "FAIL".to_string() },
        }
    }
}

fn create_bet(bet_type: &str, key: &str, tokens: i64, multiplier: i64) -> RouletteBet {
    RouletteBet {
        bet_type: bet_type.to_string(),
        tokens,
        multiplier,
        value: Some(key.to_string()),
        key: key.to_string(),
        targets: None,
    }
}

fn create_bet_with_targets(bet_type: &str, key: &str, tokens: i64, multiplier: i64, targets: Vec<&str>) -> RouletteBet {
    RouletteBet {
        bet_type: bet_type.to_string(),
        tokens,
        multiplier,
        value: None,
        key: key.to_string(),
        targets: Some(targets.iter().map(|s| s.to_string()).collect()),
    }
}

#[test]
fn test_payout_multipliers() {
    println!("\n");
    println!("======================================================");
    println!("         PAYOUT MULTIPLIERS VERIFICATION              ");
    println!("======================================================");
    println!();

    let payouts = get_bet_payouts();

    let expected = [
        ("straight", 35),
        ("split", 17),
        ("street", 11),
        ("corner", 8),
        ("line", 5),
        ("basket", 6),
        ("column", 2),
        ("dozen", 2),
        ("color", 1),
        ("parity", 1),
        ("range", 1),
        ("sector", 35),
    ];

    for (bet_type, expected_mult) in &expected {
        let actual = payouts.get(*bet_type).copied().unwrap_or(0);
        assert_eq!(
            actual, *expected_mult,
            "Payout for {} should be {}:1, got {}:1",
            bet_type, expected_mult, actual
        );
        println!("  {} - {}:1", bet_type, actual);
    }
}

#[test]
fn test_straight_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           STRAIGHT BET PAYOUT TESTS                  ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Winning straight bet: 100 * (1 + 35) = 3600
    let bet = create_bet("straight", "17", 10, 10); // 100 total
    let (payout, _) = calculate_winnings(&[bet], "17");
    let expected = 100 + (100 * 35); // Original stake + winnings
    results.push(PayoutTestResult::new("straight", 100, "17", expected, payout));
    assert_eq!(payout, expected, "Winning straight bet payout incorrect");

    // Losing straight bet
    let bet = create_bet("straight", "17", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "18");
    results.push(PayoutTestResult::new("straight", 100, "18", 0, payout));
    assert_eq!(payout, 0, "Losing straight bet should pay 0");

    // Straight bet on 0
    let bet = create_bet("straight", "0", 5, 20); // 100 total
    let (payout, _) = calculate_winnings(&[bet], "0");
    let expected = 100 + (100 * 35);
    results.push(PayoutTestResult::new("straight (0)", 100, "0", expected, payout));
    assert_eq!(payout, expected, "Straight bet on 0 payout incorrect");

    // Straight bet on 00
    let bet = create_bet("straight", "00", 2, 50); // 100 total
    let (payout, _) = calculate_winnings(&[bet], "00");
    let expected = 100 + (100 * 35);
    results.push(PayoutTestResult::new("straight (00)", 100, "00", expected, payout));
    assert_eq!(payout, expected, "Straight bet on 00 payout incorrect");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_split_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           SPLIT BET PAYOUT TESTS                     ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Split bet covering 17-18, wins on 17
    let bet = create_bet_with_targets("split", "17-18", 10, 10, vec!["17", "18"]);
    let (payout, _) = calculate_winnings(&[bet], "17");
    let expected = 100 + (100 * 17);
    results.push(PayoutTestResult::new("split (17-18)", 100, "17", expected, payout));
    assert_eq!(payout, expected, "Split bet payout incorrect");

    // Split bet covering 17-18, wins on 18
    let bet = create_bet_with_targets("split", "17-18", 10, 10, vec!["17", "18"]);
    let (payout, _) = calculate_winnings(&[bet], "18");
    let expected = 100 + (100 * 17);
    results.push(PayoutTestResult::new("split (17-18)", 100, "18", expected, payout));
    assert_eq!(payout, expected, "Split bet payout incorrect on alternate number");

    // Split bet loses
    let bet = create_bet_with_targets("split", "17-18", 10, 10, vec!["17", "18"]);
    let (payout, _) = calculate_winnings(&[bet], "19");
    results.push(PayoutTestResult::new("split (17-18)", 100, "19", 0, payout));
    assert_eq!(payout, 0, "Losing split bet should pay 0");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_street_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           STREET BET PAYOUT TESTS                    ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Street bet covering 1-2-3
    let bet = create_bet_with_targets("street", "1-2-3", 10, 10, vec!["1", "2", "3"]);
    let (payout, _) = calculate_winnings(&[bet], "2");
    let expected = 100 + (100 * 11);
    results.push(PayoutTestResult::new("street (1-2-3)", 100, "2", expected, payout));
    assert_eq!(payout, expected, "Street bet payout incorrect");

    // Street bet loses
    let bet = create_bet_with_targets("street", "1-2-3", 10, 10, vec!["1", "2", "3"]);
    let (payout, _) = calculate_winnings(&[bet], "4");
    results.push(PayoutTestResult::new("street (1-2-3)", 100, "4", 0, payout));
    assert_eq!(payout, 0, "Losing street bet should pay 0");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_corner_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           CORNER BET PAYOUT TESTS                    ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Corner bet covering 1-2-4-5
    let bet = create_bet_with_targets("corner", "1-2-4-5", 10, 10, vec!["1", "2", "4", "5"]);
    let (payout, _) = calculate_winnings(&[bet], "5");
    let expected = 100 + (100 * 8);
    results.push(PayoutTestResult::new("corner (1-2-4-5)", 100, "5", expected, payout));
    assert_eq!(payout, expected, "Corner bet payout incorrect");

    // Corner bet loses
    let bet = create_bet_with_targets("corner", "1-2-4-5", 10, 10, vec!["1", "2", "4", "5"]);
    let (payout, _) = calculate_winnings(&[bet], "6");
    results.push(PayoutTestResult::new("corner (1-2-4-5)", 100, "6", 0, payout));
    assert_eq!(payout, 0, "Losing corner bet should pay 0");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_line_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           LINE BET PAYOUT TESTS                      ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Line bet covering 1-2-3-4-5-6
    let bet = create_bet_with_targets("line", "1-2-3-4-5-6", 10, 10, vec!["1", "2", "3", "4", "5", "6"]);
    let (payout, _) = calculate_winnings(&[bet], "4");
    let expected = 100 + (100 * 5);
    results.push(PayoutTestResult::new("line (1-6)", 100, "4", expected, payout));
    assert_eq!(payout, expected, "Line bet payout incorrect");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_basket_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           BASKET BET PAYOUT TESTS                    ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Basket bet covers 0, 00, 1, 2, 3
    let bet = create_bet("basket", "basket", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "0");
    let expected = 100 + (100 * 6);
    results.push(PayoutTestResult::new("basket", 100, "0", expected, payout));
    assert_eq!(payout, expected, "Basket bet on 0 payout incorrect");

    let bet = create_bet("basket", "basket", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "00");
    results.push(PayoutTestResult::new("basket", 100, "00", expected, payout));
    assert_eq!(payout, expected, "Basket bet on 00 payout incorrect");

    let bet = create_bet("basket", "basket", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "2");
    results.push(PayoutTestResult::new("basket", 100, "2", expected, payout));
    assert_eq!(payout, expected, "Basket bet on 2 payout incorrect");

    // Basket bet loses on 4
    let bet = create_bet("basket", "basket", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "4");
    results.push(PayoutTestResult::new("basket", 100, "4", 0, payout));
    assert_eq!(payout, 0, "Basket bet should lose on 4");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_column_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           COLUMN BET PAYOUT TESTS                    ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // 1st column wins on 1
    let bet = create_bet("column", "1st", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "1");
    let expected = 100 + (100 * 2);
    results.push(PayoutTestResult::new("column (1st)", 100, "1", expected, payout));
    assert_eq!(payout, expected, "1st column payout incorrect");

    // 1st column loses on 2
    let bet = create_bet("column", "1st", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "2");
    results.push(PayoutTestResult::new("column (1st)", 100, "2", 0, payout));
    assert_eq!(payout, 0, "1st column should lose on 2");

    // 2nd column wins on 17 (17 % 3 == 2)
    let bet = create_bet("column", "2nd", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "17");
    results.push(PayoutTestResult::new("column (2nd)", 100, "17", expected, payout));
    assert_eq!(payout, expected, "2nd column payout incorrect");

    // Column bet loses on 0
    let bet = create_bet("column", "1st", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "0");
    results.push(PayoutTestResult::new("column (1st)", 100, "0", 0, payout));
    assert_eq!(payout, 0, "Column bet should lose on 0");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_dozen_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           DOZEN BET PAYOUT TESTS                     ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // 1st dozen wins on 5
    let bet = create_bet("dozen", "1st", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "5");
    let expected = 100 + (100 * 2);
    results.push(PayoutTestResult::new("dozen (1st)", 100, "5", expected, payout));
    assert_eq!(payout, expected, "1st dozen payout incorrect");

    // 2nd dozen wins on 17
    let bet = create_bet("dozen", "2nd", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "17");
    results.push(PayoutTestResult::new("dozen (2nd)", 100, "17", expected, payout));
    assert_eq!(payout, expected, "2nd dozen payout incorrect");

    // 3rd dozen wins on 30
    let bet = create_bet("dozen", "3rd", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "30");
    results.push(PayoutTestResult::new("dozen (3rd)", 100, "30", expected, payout));
    assert_eq!(payout, expected, "3rd dozen payout incorrect");

    // 1st dozen loses on 15
    let bet = create_bet("dozen", "1st", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "15");
    results.push(PayoutTestResult::new("dozen (1st)", 100, "15", 0, payout));
    assert_eq!(payout, 0, "1st dozen should lose on 15");

    // Dozen bet loses on 0
    let bet = create_bet("dozen", "2nd", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "0");
    results.push(PayoutTestResult::new("dozen (2nd)", 100, "0", 0, payout));
    assert_eq!(payout, 0, "Dozen bet should lose on 0");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_color_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           COLOR BET PAYOUT TESTS                     ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Red bet wins on 1 (red)
    let bet = create_bet("color", "red", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "1");
    let expected = 100 + (100 * 1);
    results.push(PayoutTestResult::new("color (red)", 100, "1", expected, payout));
    assert_eq!(payout, expected, "Red bet payout incorrect");

    // Red bet loses on 2 (black)
    let bet = create_bet("color", "red", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "2");
    results.push(PayoutTestResult::new("color (red)", 100, "2", 0, payout));
    assert_eq!(payout, 0, "Red bet should lose on black");

    // Black bet wins on 17 (black)
    let bet = create_bet("color", "black", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "17");
    results.push(PayoutTestResult::new("color (black)", 100, "17", expected, payout));
    assert_eq!(payout, expected, "Black bet payout incorrect");

    // Color bets lose on 0 (green)
    let bet = create_bet("color", "red", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "0");
    results.push(PayoutTestResult::new("color (red)", 100, "0", 0, payout));
    assert_eq!(payout, 0, "Color bet should lose on 0");

    // Color bets lose on 00 (green)
    let bet = create_bet("color", "black", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "00");
    results.push(PayoutTestResult::new("color (black)", 100, "00", 0, payout));
    assert_eq!(payout, 0, "Color bet should lose on 00");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_parity_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           PARITY BET PAYOUT TESTS                    ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Odd bet wins on 17
    let bet = create_bet("parity", "odd", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "17");
    let expected = 100 + (100 * 1);
    results.push(PayoutTestResult::new("parity (odd)", 100, "17", expected, payout));
    assert_eq!(payout, expected, "Odd bet payout incorrect");

    // Odd bet loses on 18
    let bet = create_bet("parity", "odd", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "18");
    results.push(PayoutTestResult::new("parity (odd)", 100, "18", 0, payout));
    assert_eq!(payout, 0, "Odd bet should lose on even");

    // Even bet wins on 18
    let bet = create_bet("parity", "even", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "18");
    results.push(PayoutTestResult::new("parity (even)", 100, "18", expected, payout));
    assert_eq!(payout, expected, "Even bet payout incorrect");

    // Parity bets lose on 0
    let bet = create_bet("parity", "odd", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "0");
    results.push(PayoutTestResult::new("parity (odd)", 100, "0", 0, payout));
    assert_eq!(payout, 0, "Parity bet should lose on 0");

    // Parity bets lose on 00
    let bet = create_bet("parity", "even", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "00");
    results.push(PayoutTestResult::new("parity (even)", 100, "00", 0, payout));
    assert_eq!(payout, 0, "Parity bet should lose on 00");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_range_bet_payout() {
    println!("\n");
    println!("======================================================");
    println!("           RANGE BET PAYOUT TESTS                     ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Low (1-18) wins on 17
    let bet = create_bet("range", "1-18", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "17");
    let expected = 100 + (100 * 1);
    results.push(PayoutTestResult::new("range (1-18)", 100, "17", expected, payout));
    assert_eq!(payout, expected, "Low range payout incorrect");

    // Low (1-18) loses on 19
    let bet = create_bet("range", "1-18", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "19");
    results.push(PayoutTestResult::new("range (1-18)", 100, "19", 0, payout));
    assert_eq!(payout, 0, "Low range should lose on 19");

    // High (19-36) wins on 30
    let bet = create_bet("range", "19-36", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "30");
    results.push(PayoutTestResult::new("range (19-36)", 100, "30", expected, payout));
    assert_eq!(payout, expected, "High range payout incorrect");

    // Range bets lose on 0
    let bet = create_bet("range", "1-18", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "0");
    results.push(PayoutTestResult::new("range (1-18)", 100, "0", 0, payout));
    assert_eq!(payout, 0, "Range bet should lose on 0");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_multiple_bets_payout() {
    println!("\n");
    println!("======================================================");
    println!("         MULTIPLE BETS COMBINED PAYOUT                ");
    println!("======================================================");
    println!();

    // Place multiple bets
    let bets = vec![
        create_bet("straight", "17", 5, 10),  // 50 total, wins on 17
        create_bet("color", "black", 10, 5),   // 50 total, wins on 17 (black)
        create_bet("parity", "odd", 5, 10),    // 50 total, wins on 17 (odd)
        create_bet("straight", "5", 10, 10),   // 100 total, loses
    ];

    let (total_payout, bet_results) = calculate_winnings(&bets, "17");

    // Expected payouts:
    // - Straight on 17: 50 + (50 * 35) = 1800
    // - Color black: 50 + (50 * 1) = 100
    // - Parity odd: 50 + (50 * 1) = 100
    // - Straight on 5: 0
    // Total: 2000
    let expected_total = 1800 + 100 + 100 + 0;

    println!("Individual bet results:");
    for (i, result) in bet_results.iter().enumerate() {
        println!(
            "  Bet {}: {} on {:?} - {} - payout: {}",
            i + 1,
            result.bet_type,
            result.numbers,
            if result.won { "WON" } else { "LOST" },
            result.payout
        );
    }
    println!();
    println!("Total payout: {} (expected: {})", total_payout, expected_total);

    assert_eq!(
        total_payout, expected_total,
        "Multiple bets combined payout incorrect"
    );
}

#[test]
fn test_zero_and_double_zero_edge_cases() {
    println!("\n");
    println!("======================================================");
    println!("        0 AND 00 EDGE CASE TESTS                      ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Only straight bets on 0/00 should win
    let bets_on_zero = vec![
        create_bet("straight", "0", 10, 10),
        create_bet("color", "red", 10, 10),
        create_bet("parity", "odd", 10, 10),
        create_bet("range", "1-18", 10, 10),
        create_bet("column", "1st", 10, 10),
        create_bet("dozen", "1st", 10, 10),
    ];

    let (payout, _) = calculate_winnings(&bets_on_zero, "0");
    // Only straight bet wins: 100 + (100 * 35) = 3600
    let expected = 3600;
    results.push(PayoutTestResult::new("all bets", 600, "0", expected, payout));
    assert_eq!(payout, expected, "Only straight bet should win on 0");

    // Basket bet wins on 0
    let bet = create_bet("basket", "basket", 10, 10);
    let (payout, _) = calculate_winnings(&[bet], "0");
    let expected_basket = 100 + (100 * 6);
    results.push(PayoutTestResult::new("basket only", 100, "0", expected_basket, payout));
    assert_eq!(payout, expected_basket, "Basket should win on 0");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}
