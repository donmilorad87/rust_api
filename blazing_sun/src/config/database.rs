use once_cell::sync::Lazy;

pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
}

pub static DATABASE: Lazy<DatabaseConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    DatabaseConfig {
        url: std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set"),
        max_connections: std::env::var("DATABASE_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "10000".to_string())
            .parse()
            .expect("DATABASE_MAX_CONNECTIONS must be a valid number"),
    }
});

impl DatabaseConfig {
    pub fn url() -> &'static str {
        &DATABASE.url
    }

    pub fn max_connections() -> u32 {
        DATABASE.max_connections
    }
}
