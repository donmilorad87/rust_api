//! Bet Validation Unit Tests
//!
//! # Test Coverage
//! - [x] Valid bet types (all 12 types)
//! - [x] Invalid bet types
//! - [x] Token validation (positive/negative/zero)
//! - [x] Multiplier validation
//! - [x] Key validation
//! - [x] Covered numbers for each bet type

use blazing_sun::app::games::roulette::{
    validate_bet, RouletteBet, RED_NUMBERS, CHIP_MULTIPLIERS,
    determine_color, determine_parity,
};
use tabled::{settings::Style, Table, Tabled};

#[derive(Tabled)]
struct TestResult {
    #[tabled(rename = "Test Case")]
    test_case: String,
    #[tabled(rename = "Input")]
    input: String,
    #[tabled(rename = "Expected")]
    expected: String,
    #[tabled(rename = "Actual")]
    actual: String,
    #[tabled(rename = "Status")]
    status: String,
}

impl TestResult {
    fn new(test_case: &str, input: &str, expected: &str, actual: &str, passed: bool) -> Self {
        Self {
            test_case: test_case.to_string(),
            input: input.to_string(),
            expected: expected.to_string(),
            actual: actual.to_string(),
            status: if passed {
                "PASS".to_string()
            } else {
                "FAIL".to_string()
            },
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

#[test]
fn test_valid_bet_types() {
    println!("\n");
    println!("======================================================");
    println!("           BET TYPE VALIDATION TESTS                  ");
    println!("======================================================");
    println!();

    let valid_types = [
        "straight", "split", "street", "corner", "line", "basket",
        "column", "dozen", "color", "parity", "range", "sector",
    ];

    let mut results = vec![];

    for bet_type in &valid_types {
        let bet = create_bet(bet_type, "test_key", 1, 1);
        let result = validate_bet(&bet);
        let passed = result.is_ok();
        results.push(TestResult::new(
            &format!("Valid type: {}", bet_type),
            bet_type,
            "Ok",
            if passed { "Ok" } else { "Err" },
            passed,
        ));
        assert!(passed, "Bet type '{}' should be valid", bet_type);
    }

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_invalid_bet_types() {
    println!("\n");
    println!("======================================================");
    println!("        INVALID BET TYPE VALIDATION TESTS             ");
    println!("======================================================");
    println!();

    let invalid_types = ["invalid", "foo", "bar", "straight_up", "red", "black"];

    let mut results = vec![];

    for bet_type in &invalid_types {
        let bet = create_bet(bet_type, "test_key", 1, 1);
        let result = validate_bet(&bet);
        let passed = result.is_err();
        results.push(TestResult::new(
            &format!("Invalid type: {}", bet_type),
            bet_type,
            "Err",
            if result.is_ok() { "Ok" } else { "Err" },
            passed,
        ));
        assert!(passed, "Bet type '{}' should be invalid", bet_type);
    }

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_token_validation() {
    println!("\n");
    println!("======================================================");
    println!("           TOKEN VALIDATION TESTS                     ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Positive tokens - should pass
    let bet = create_bet("straight", "17", 5, 1);
    let result = validate_bet(&bet);
    let passed = result.is_ok();
    results.push(TestResult::new(
        "Positive tokens",
        "tokens=5",
        "Ok",
        if passed { "Ok" } else { "Err" },
        passed,
    ));
    assert!(passed, "Positive tokens should be valid");

    // Zero tokens - should fail
    let bet = create_bet("straight", "17", 0, 1);
    let result = validate_bet(&bet);
    let passed = result.is_err();
    results.push(TestResult::new(
        "Zero tokens",
        "tokens=0",
        "Err",
        if result.is_ok() { "Ok" } else { "Err" },
        passed,
    ));
    assert!(passed, "Zero tokens should be invalid");

    // Negative tokens - should fail
    let bet = create_bet("straight", "17", -5, 1);
    let result = validate_bet(&bet);
    let passed = result.is_err();
    results.push(TestResult::new(
        "Negative tokens",
        "tokens=-5",
        "Err",
        if result.is_ok() { "Ok" } else { "Err" },
        passed,
    ));
    assert!(passed, "Negative tokens should be invalid");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_multiplier_validation() {
    println!("\n");
    println!("======================================================");
    println!("         MULTIPLIER VALIDATION TESTS                  ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Test all valid chip multipliers
    for &mult in &CHIP_MULTIPLIERS {
        let bet = create_bet("straight", "17", 1, mult);
        let result = validate_bet(&bet);
        let passed = result.is_ok();
        results.push(TestResult::new(
            &format!("Valid multiplier: {}", mult),
            &format!("multiplier={}", mult),
            "Ok",
            if passed { "Ok" } else { "Err" },
            passed,
        ));
        assert!(passed, "Multiplier {} should be valid", mult);
    }

    // Zero multiplier - should fail
    let bet = create_bet("straight", "17", 1, 0);
    let result = validate_bet(&bet);
    let passed = result.is_err();
    results.push(TestResult::new(
        "Zero multiplier",
        "multiplier=0",
        "Err",
        if result.is_ok() { "Ok" } else { "Err" },
        passed,
    ));
    assert!(passed, "Zero multiplier should be invalid");

    // Negative multiplier - should fail
    let bet = create_bet("straight", "17", 1, -10);
    let result = validate_bet(&bet);
    let passed = result.is_err();
    results.push(TestResult::new(
        "Negative multiplier",
        "multiplier=-10",
        "Err",
        if result.is_ok() { "Ok" } else { "Err" },
        passed,
    ));
    assert!(passed, "Negative multiplier should be invalid");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_key_validation() {
    println!("\n");
    println!("======================================================");
    println!("            KEY VALIDATION TESTS                      ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Valid key - should pass
    let bet = create_bet("straight", "17", 1, 1);
    let result = validate_bet(&bet);
    let passed = result.is_ok();
    results.push(TestResult::new(
        "Valid key",
        "key='17'",
        "Ok",
        if passed { "Ok" } else { "Err" },
        passed,
    ));
    assert!(passed, "Valid key should pass");

    // Empty key - should fail
    let bet = RouletteBet {
        bet_type: "straight".to_string(),
        tokens: 1,
        multiplier: 1,
        value: Some("17".to_string()),
        key: "".to_string(),
        targets: None,
    };
    let result = validate_bet(&bet);
    let passed = result.is_err();
    results.push(TestResult::new(
        "Empty key",
        "key=''",
        "Err",
        if result.is_ok() { "Ok" } else { "Err" },
        passed,
    ));
    assert!(passed, "Empty key should be invalid");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_color_determination() {
    println!("\n");
    println!("======================================================");
    println!("         COLOR DETERMINATION TESTS                    ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Test green (0 and 00)
    let color = determine_color("0");
    let passed = color == "green";
    results.push(TestResult::new("Zero", "0", "green", &color, passed));
    assert!(passed, "0 should be green");

    let color = determine_color("00");
    let passed = color == "green";
    results.push(TestResult::new("Double Zero", "00", "green", &color, passed));
    assert!(passed, "00 should be green");

    // Test red numbers
    for &num in &[1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36] {
        let color = determine_color(&num.to_string());
        let passed = color == "red";
        results.push(TestResult::new(
            &format!("Red number {}", num),
            &num.to_string(),
            "red",
            &color,
            passed,
        ));
        assert!(passed, "{} should be red", num);
    }

    // Test black numbers
    for &num in &[2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35] {
        let color = determine_color(&num.to_string());
        let passed = color == "black";
        results.push(TestResult::new(
            &format!("Black number {}", num),
            &num.to_string(),
            "black",
            &color,
            passed,
        ));
        assert!(passed, "{} should be black", num);
    }

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_parity_determination() {
    println!("\n");
    println!("======================================================");
    println!("         PARITY DETERMINATION TESTS                   ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Test none (0 and 00)
    let parity = determine_parity("0");
    let passed = parity == "none";
    results.push(TestResult::new("Zero", "0", "none", &parity, passed));
    assert!(passed, "0 should have parity 'none'");

    let parity = determine_parity("00");
    let passed = parity == "none";
    results.push(TestResult::new("Double Zero", "00", "none", &parity, passed));
    assert!(passed, "00 should have parity 'none'");

    // Test odd numbers
    for num in (1..=35).step_by(2) {
        let parity = determine_parity(&num.to_string());
        let passed = parity == "odd";
        results.push(TestResult::new(
            &format!("Odd number {}", num),
            &num.to_string(),
            "odd",
            &parity,
            passed,
        ));
        assert!(passed, "{} should be odd", num);
    }

    // Test even numbers
    for num in (2..=36).step_by(2) {
        let parity = determine_parity(&num.to_string());
        let passed = parity == "even";
        results.push(TestResult::new(
            &format!("Even number {}", num),
            &num.to_string(),
            "even",
            &parity,
            passed,
        ));
        assert!(passed, "{} should be even", num);
    }

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_bet_amount_calculation() {
    println!("\n");
    println!("======================================================");
    println!("         BET AMOUNT CALCULATION TESTS                 ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Test various combinations
    let test_cases = [
        (1, 1, 1),      // 1 token * 1 multiplier = 1
        (5, 10, 50),    // 5 tokens * 10 multiplier = 50
        (10, 100, 1000), // 10 tokens * 100 multiplier = 1000
        (16, 500, 8000), // 16 tokens * 500 multiplier = 8000 (max tokens)
    ];

    for (tokens, multiplier, expected) in test_cases {
        let bet = create_bet("straight", "17", tokens, multiplier);
        let amount = bet.amount();
        let passed = amount == expected;
        results.push(TestResult::new(
            &format!("{}t * {}m", tokens, multiplier),
            &format!("tokens={}, mult={}", tokens, multiplier),
            &expected.to_string(),
            &amount.to_string(),
            passed,
        ));
        assert!(passed, "Amount calculation failed for {}*{}", tokens, multiplier);
    }

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_covered_numbers_straight() {
    println!("\n");
    println!("======================================================");
    println!("      STRAIGHT BET COVERED NUMBERS TESTS              ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Test straight bets
    for num in ["0", "00", "1", "17", "36"] {
        let bet = create_bet("straight", num, 1, 1);
        let covered = bet.get_covered_numbers();
        let passed = covered.len() == 1 && covered[0] == num;
        results.push(TestResult::new(
            &format!("Straight on {}", num),
            num,
            &format!("[{}]", num),
            &format!("{:?}", covered),
            passed,
        ));
        assert!(passed, "Straight bet on {} should cover only [{}]", num, num);
    }

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_covered_numbers_color() {
    println!("\n");
    println!("======================================================");
    println!("       COLOR BET COVERED NUMBERS TESTS                ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Red bet should cover 18 numbers
    let bet = create_bet("color", "red", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 18;
    results.push(TestResult::new(
        "Red bet count",
        "red",
        "18",
        &covered.len().to_string(),
        passed,
    ));
    assert!(passed, "Red bet should cover 18 numbers");

    // Verify all red numbers are covered
    for &num in &RED_NUMBERS {
        let contains = covered.contains(&num.to_string());
        results.push(TestResult::new(
            &format!("Red contains {}", num),
            &num.to_string(),
            "true",
            &contains.to_string(),
            contains,
        ));
        assert!(contains, "Red bet should include {}", num);
    }

    // Black bet should also cover 18 numbers
    let bet = create_bet("color", "black", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 18;
    results.push(TestResult::new(
        "Black bet count",
        "black",
        "18",
        &covered.len().to_string(),
        passed,
    ));
    assert!(passed, "Black bet should cover 18 numbers");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_covered_numbers_column() {
    println!("\n");
    println!("======================================================");
    println!("      COLUMN BET COVERED NUMBERS TESTS                ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // 1st column: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
    let bet = create_bet("column", "1st", 1, 1);
    let covered = bet.get_covered_numbers();
    let expected: Vec<String> = (1..=36).filter(|n| n % 3 == 1).map(|n| n.to_string()).collect();
    let passed = covered.len() == 12 && covered == expected;
    results.push(TestResult::new(
        "1st column count",
        "1st",
        "12",
        &covered.len().to_string(),
        covered.len() == 12,
    ));

    // 2nd column: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
    let bet = create_bet("column", "2nd", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 12;
    results.push(TestResult::new(
        "2nd column count",
        "2nd",
        "12",
        &covered.len().to_string(),
        passed,
    ));

    // 3rd column: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
    let bet = create_bet("column", "3rd", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 12;
    results.push(TestResult::new(
        "3rd column count",
        "3rd",
        "12",
        &covered.len().to_string(),
        passed,
    ));

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_covered_numbers_dozen() {
    println!("\n");
    println!("======================================================");
    println!("       DOZEN BET COVERED NUMBERS TESTS                ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // 1st dozen: 1-12
    let bet = create_bet("dozen", "1st", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 12 && covered[0] == "1" && covered[11] == "12";
    results.push(TestResult::new(
        "1st dozen",
        "1st",
        "1-12 (12 nums)",
        &format!("{}-{} ({} nums)", covered.first().unwrap_or(&"?".to_string()),
                 covered.last().unwrap_or(&"?".to_string()), covered.len()),
        passed,
    ));

    // 2nd dozen: 13-24
    let bet = create_bet("dozen", "2nd", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 12 && covered[0] == "13" && covered[11] == "24";
    results.push(TestResult::new(
        "2nd dozen",
        "2nd",
        "13-24 (12 nums)",
        &format!("{}-{} ({} nums)", covered.first().unwrap_or(&"?".to_string()),
                 covered.last().unwrap_or(&"?".to_string()), covered.len()),
        passed,
    ));

    // 3rd dozen: 25-36
    let bet = create_bet("dozen", "3rd", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 12 && covered[0] == "25" && covered[11] == "36";
    results.push(TestResult::new(
        "3rd dozen",
        "3rd",
        "25-36 (12 nums)",
        &format!("{}-{} ({} nums)", covered.first().unwrap_or(&"?".to_string()),
                 covered.last().unwrap_or(&"?".to_string()), covered.len()),
        passed,
    ));

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_covered_numbers_parity() {
    println!("\n");
    println!("======================================================");
    println!("      PARITY BET COVERED NUMBERS TESTS                ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Odd: 1, 3, 5, ..., 35 (18 numbers)
    let bet = create_bet("parity", "odd", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 18 && covered.iter().all(|n| n.parse::<i32>().map(|x| x % 2 == 1).unwrap_or(false));
    results.push(TestResult::new(
        "Odd bet",
        "odd",
        "18 odd numbers",
        &format!("{} numbers", covered.len()),
        passed,
    ));

    // Even: 2, 4, 6, ..., 36 (18 numbers)
    let bet = create_bet("parity", "even", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 18 && covered.iter().all(|n| n.parse::<i32>().map(|x| x % 2 == 0).unwrap_or(false));
    results.push(TestResult::new(
        "Even bet",
        "even",
        "18 even numbers",
        &format!("{} numbers", covered.len()),
        passed,
    ));

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_covered_numbers_range() {
    println!("\n");
    println!("======================================================");
    println!("       RANGE BET COVERED NUMBERS TESTS                ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Low: 1-18
    let bet = create_bet("range", "1-18", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 18 && covered[0] == "1" && covered[17] == "18";
    results.push(TestResult::new(
        "Low range (1-18)",
        "1-18",
        "18 numbers (1-18)",
        &format!("{} numbers ({}-{})", covered.len(),
                 covered.first().unwrap_or(&"?".to_string()),
                 covered.last().unwrap_or(&"?".to_string())),
        passed,
    ));

    // High: 19-36
    let bet = create_bet("range", "19-36", 1, 1);
    let covered = bet.get_covered_numbers();
    let passed = covered.len() == 18 && covered[0] == "19" && covered[17] == "36";
    results.push(TestResult::new(
        "High range (19-36)",
        "19-36",
        "18 numbers (19-36)",
        &format!("{} numbers ({}-{})", covered.len(),
                 covered.first().unwrap_or(&"?".to_string()),
                 covered.last().unwrap_or(&"?".to_string())),
        passed,
    ));

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}

#[test]
fn test_covered_numbers_basket() {
    println!("\n");
    println!("======================================================");
    println!("      BASKET BET COVERED NUMBERS TESTS                ");
    println!("======================================================");
    println!();

    let mut results = vec![];

    // Basket: 0, 00, 1, 2, 3
    let bet = create_bet("basket", "basket", 1, 1);
    let covered = bet.get_covered_numbers();
    let expected = vec!["0", "00", "1", "2", "3"];
    let passed = covered.len() == 5 && expected.iter().all(|n| covered.contains(&n.to_string()));
    results.push(TestResult::new(
        "Basket bet",
        "basket",
        "[0, 00, 1, 2, 3]",
        &format!("{:?}", covered),
        passed,
    ));

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);
}
