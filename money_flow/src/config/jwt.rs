use once_cell::sync::Lazy;

pub struct JwtConfig {
    pub secret: String,
    pub expiration_minutes: i64,
}

pub static JWT: Lazy<JwtConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    JwtConfig {
        secret: std::env::var("JWT_SECRET")
            .expect("JWT_SECRET must be set"),
        expiration_minutes: std::env::var("EXPIRATION_TIME")
            .unwrap_or_else(|_| "60".to_string())
            .parse()
            .expect("EXPIRATION_TIME must be a valid number"),
    }
});

impl JwtConfig {
    pub fn secret() -> &'static str {
        &JWT.secret
    }

    pub fn expiration_minutes() -> i64 {
        JWT.expiration_minutes
    }
}
