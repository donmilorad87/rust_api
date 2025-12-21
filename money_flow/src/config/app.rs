use once_cell::sync::Lazy;

pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub rust_log: String,
}

pub static APP: Lazy<AppConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    AppConfig {
        host: std::env::var("HOST")
            .unwrap_or_else(|_| "0.0.0.0".to_string()),
        port: std::env::var("PORT")
            .unwrap_or_else(|_| "8888".to_string())
            .parse()
            .expect("PORT must be a valid number"),
        rust_log: std::env::var("RUST_LOG")
            .unwrap_or_else(|_| "info".to_string()),
    }
});

impl AppConfig {
    pub fn host() -> &'static str {
        &APP.host
    }

    pub fn port() -> u16 {
        APP.port
    }

    pub fn rust_log() -> &'static str {
        &APP.rust_log
    }
}
