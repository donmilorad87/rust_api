use once_cell::sync::Lazy;

pub struct GamesConfig {
    pub bigger_dice_winning_percentage: i32,
    pub bigger_dice_entry_fee_cents: i64,
    pub bigger_dice_ready_timeout_seconds: i32,
}

pub static GAMES: Lazy<GamesConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    GamesConfig {
        bigger_dice_winning_percentage: std::env::var("BIGGER_DICE_WINNING_PERCENTAGE")
            .unwrap_or_else(|_| "60".to_string())
            .parse()
            .expect("BIGGER_DICE_WINNING_PERCENTAGE must be a valid number"),
        bigger_dice_entry_fee_cents: std::env::var("BIGGER_DICE_ENTRY_FEE_CENTS")
            .unwrap_or_else(|_| "1000".to_string())
            .parse()
            .expect("BIGGER_DICE_ENTRY_FEE_CENTS must be a valid number"),
        bigger_dice_ready_timeout_seconds: std::env::var("BIGGER_DICE_READY_TIMEOUT_SECONDS")
            .unwrap_or_else(|_| "30".to_string())
            .parse()
            .expect("BIGGER_DICE_READY_TIMEOUT_SECONDS must be a valid number"),
    }
});

impl GamesConfig {
    /// Get the winning percentage for Bigger Dice (default: 60)
    pub fn bigger_dice_winning_percentage() -> i32 {
        GAMES.bigger_dice_winning_percentage
    }

    /// Get the entry fee in cents for Bigger Dice (default: 1000 = 10 coins)
    pub fn bigger_dice_entry_fee_cents() -> i64 {
        GAMES.bigger_dice_entry_fee_cents
    }

    /// Get the ready timeout in seconds for Bigger Dice (default: 30)
    pub fn bigger_dice_ready_timeout_seconds() -> i32 {
        GAMES.bigger_dice_ready_timeout_seconds
    }
}
