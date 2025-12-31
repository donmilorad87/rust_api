use once_cell::sync::Lazy;

pub struct RedisConfig {
    pub url: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub db: u8,
}

pub static REDIS: Lazy<RedisConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    let host = std::env::var("REDIS_HOST")
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    let port: u16 = std::env::var("REDIS_PORT")
        .unwrap_or_else(|_| "6379".to_string())
        .parse()
        .expect("REDIS_PORT must be a valid number");
    let user = std::env::var("REDIS_USER")
        .unwrap_or_else(|_| "default".to_string());
    let password = std::env::var("REDIS_PASSWORD")
        .unwrap_or_default();
    let db: u8 = std::env::var("REDIS_DB")
        .unwrap_or_else(|_| "0".to_string())
        .parse()
        .expect("REDIS_DB must be a valid number");

    // Build URL if not provided
    let url = std::env::var("REDIS_URL").unwrap_or_else(|_| {
        if password.is_empty() {
            format!("redis://{}:{}/{}", host, port, db)
        } else {
            format!("redis://{}:{}@{}:{}/{}", user, password, host, port, db)
        }
    });

    RedisConfig {
        url,
        host,
        port,
        user,
        password,
        db,
    }
});

impl RedisConfig {
    pub fn url() -> &'static str {
        &REDIS.url
    }

    pub fn host() -> &'static str {
        &REDIS.host
    }

    pub fn port() -> u16 {
        REDIS.port
    }

    pub fn user() -> &'static str {
        &REDIS.user
    }

    pub fn password() -> &'static str {
        &REDIS.password
    }

    pub fn db() -> u8 {
        REDIS.db
    }
}
