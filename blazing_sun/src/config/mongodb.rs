use once_cell::sync::Lazy;

pub struct MongoDbConfig {
    pub url: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
    pub max_pool_size: u32,
    pub min_pool_size: u32,
    pub connect_timeout_ms: u64,
}

pub static MONGODB: Lazy<MongoDbConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    let host = std::env::var("MONGO_HOST").unwrap_or_else(|_| "mongo".to_string());
    let port: u16 = std::env::var("MONGO_PORT")
        .unwrap_or_else(|_| "27017".to_string())
        .parse()
        .expect("MONGO_PORT must be a valid number");
    let user = std::env::var("MONGO_USER").unwrap_or_else(|_| "app".to_string());
    let password = std::env::var("MONGO_PASSWORD").unwrap_or_else(|_| "".to_string());
    let database =
        std::env::var("MONGO_INITDB_DATABASE").unwrap_or_else(|_| "blazing_sun".to_string());

    // Build URL from components if MONGO_URL not provided
    let url = std::env::var("MONGO_URL").unwrap_or_else(|_| {
        if password.is_empty() {
            format!("mongodb://{}:{}/{}", host, port, database)
        } else {
            format!(
                "mongodb://{}:{}@{}:{}/{}",
                user, password, host, port, database
            )
        }
    });

    MongoDbConfig {
        url,
        host,
        port,
        user,
        password,
        database,
        max_pool_size: std::env::var("MONGO_MAX_POOL_SIZE")
            .unwrap_or_else(|_| "100".to_string())
            .parse()
            .expect("MONGO_MAX_POOL_SIZE must be a valid number"),
        min_pool_size: std::env::var("MONGO_MIN_POOL_SIZE")
            .unwrap_or_else(|_| "5".to_string())
            .parse()
            .expect("MONGO_MIN_POOL_SIZE must be a valid number"),
        connect_timeout_ms: std::env::var("MONGO_CONNECT_TIMEOUT_MS")
            .unwrap_or_else(|_| "10000".to_string())
            .parse()
            .expect("MONGO_CONNECT_TIMEOUT_MS must be a valid number"),
    }
});

impl MongoDbConfig {
    pub fn url() -> &'static str {
        &MONGODB.url
    }

    pub fn host() -> &'static str {
        &MONGODB.host
    }

    pub fn port() -> u16 {
        MONGODB.port
    }

    pub fn user() -> &'static str {
        &MONGODB.user
    }

    pub fn password() -> &'static str {
        &MONGODB.password
    }

    pub fn database() -> &'static str {
        &MONGODB.database
    }

    pub fn max_pool_size() -> u32 {
        MONGODB.max_pool_size
    }

    pub fn min_pool_size() -> u32 {
        MONGODB.min_pool_size
    }

    pub fn connect_timeout_ms() -> u64 {
        MONGODB.connect_timeout_ms
    }
}
