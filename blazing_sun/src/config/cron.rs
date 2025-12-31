use once_cell::sync::Lazy;

pub struct CronConfig {
    pub user_counter: String,
}

pub static CRON: Lazy<CronConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    CronConfig {
        user_counter: std::env::var("USER_COUNTER")
            .unwrap_or_else(|_| "0 * * * * *".to_string()), // Default: every minute
    }
});

impl CronConfig {
    pub fn user_counter() -> &'static str {
        &CRON.user_counter
    }
}
