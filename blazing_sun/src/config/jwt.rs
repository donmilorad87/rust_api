use once_cell::sync::Lazy;

pub struct JwtConfig {
    pub secret: String,
    pub expiration_minutes: i64,
    pub refresh_secret: String,
    pub refresh_expiration_days: i64,
}

pub static JWT: Lazy<JwtConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    JwtConfig {
        secret: std::env::var("JWT_SECRET").expect("JWT_SECRET must be set"),
        expiration_minutes: std::env::var("JWT_EXPIRATION_MINUTES")
            .unwrap_or_else(|_| "120".to_string())
            .parse()
            .expect("JWT_EXPIRATION_MINUTES must be a valid number"),
        refresh_secret: std::env::var("REFRESH_TOKEN_SECRET")
            .expect("REFRESH_TOKEN_SECRET must be set"),
        refresh_expiration_days: std::env::var("REFRESH_TOKEN_EXPIRATION_DAYS")
            .unwrap_or_else(|_| "30".to_string())
            .parse()
            .expect("REFRESH_TOKEN_EXPIRATION_DAYS must be a valid number"),
    }
});

impl JwtConfig {
    pub fn secret() -> &'static str {
        &JWT.secret
    }

    pub fn expiration_minutes() -> i64 {
        JWT.expiration_minutes
    }

    pub fn refresh_secret() -> &'static str {
        &JWT.refresh_secret
    }

    pub fn refresh_expiration_days() -> i64 {
        JWT.refresh_expiration_days
    }
}
