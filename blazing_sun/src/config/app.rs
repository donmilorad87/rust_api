use once_cell::sync::Lazy;

pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub rust_log: String,
    /// Version string for CSS and JavaScript assets (e.g., "1.0.43")
    /// Used as query parameter: /assets/css/PAGE/style.css?v=1.0.43
    /// Update this when CSS/JS files change to bust browser cache.
    pub assets_version: String,
    /// Version string for image assets (e.g., "1.0.12")
    /// Used as query parameter: /storage/image.jpg?v=1.0.12
    /// Update this when images change to bust browser cache.
    pub images_assets_version: String,
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
        assets_version: std::env::var("ASSETS_VERSION")
            .unwrap_or_else(|_| "1.0.0".to_string()),
        images_assets_version: std::env::var("IMAGES_ASSETS_VERSION")
            .unwrap_or_else(|_| "1.0.0".to_string()),
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

    /// Get the current assets version (CSS/JS)
    ///
    /// # Example
    /// ```rust
    /// use blazing_sun::config::AppConfig;
    /// let version = AppConfig::assets_version(); // e.g., "1.0.43"
    /// ```
    pub fn assets_version() -> &'static str {
        &APP.assets_version
    }

    /// Get the current images assets version
    ///
    /// # Example
    /// ```rust
    /// use blazing_sun::config::AppConfig;
    /// let version = AppConfig::images_assets_version(); // e.g., "1.0.12"
    /// ```
    pub fn images_assets_version() -> &'static str {
        &APP.images_assets_version
    }
}
