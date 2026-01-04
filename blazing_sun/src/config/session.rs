use std::env;

/// Session configuration
#[derive(Debug, Clone)]
pub struct SessionConfig {
    pub driver: String,
    pub redis_url: String,
    pub cookie_name: String,
    pub lifetime_minutes: u32,
    pub refresh_ttl: bool,
    pub regenerate_on_login: bool,
    pub secure_cookie: bool,
    pub http_only: bool,
    pub same_site: String,
    pub cookie_path: String,
    pub key_prefix: String,
}

impl SessionConfig {
    /// Load session configuration from environment
    pub fn from_env() -> Result<Self, env::VarError> {
        Ok(Self {
            driver: env::var("SESSION_DRIVER").unwrap_or_else(|_| "redis".to_string()),
            redis_url: env::var("SESSION_REDIS_URL")?,
            cookie_name: env::var("SESSION_COOKIE").unwrap_or_else(|_| "app_session".to_string()),
            lifetime_minutes: env::var("SESSION_LIFETIME_MINUTES")
                .unwrap_or_else(|_| "120".to_string())
                .parse()
                .unwrap_or(120),
            refresh_ttl: env::var("SESSION_REFRESH_TTL")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            regenerate_on_login: env::var("SESSION_REGENERATE_ON_LOGIN")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            secure_cookie: env::var("SESSION_SECURE_COOKIE")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),
            http_only: env::var("SESSION_HTTP_ONLY")
                .unwrap_or_else(|_| "true".to_string())
                .parse()
                .unwrap_or(true),
            same_site: env::var("SESSION_SAMESITE").unwrap_or_else(|_| "lax".to_string()),
            cookie_path: env::var("SESSION_COOKIE_PATH").unwrap_or_else(|_| "/".to_string()),
            key_prefix: env::var("SESSION_KEY_PREFIX").unwrap_or_else(|_| "sess:".to_string()),
        })
    }

    /// Get session TTL in seconds
    pub fn ttl_seconds(&self) -> i64 {
        (self.lifetime_minutes as i64) * 60
    }
}
