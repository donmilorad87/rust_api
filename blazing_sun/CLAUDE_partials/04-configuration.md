# Configuration Pattern

All configs use `once_cell::Lazy` for static initialization from environment variables:

```rust
// config/upload.rs example
use once_cell::sync::Lazy;

pub struct UploadConfig {
    pub max_file_size: u64,
    pub max_files_per_upload: usize,
    pub allowed_types: Vec<String>,
    pub storage_path: String,
    pub storage_driver: String,
    pub public_url_base: String,
    pub private_url_base: String,
}

pub static UPLOAD: Lazy<UploadConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();
    UploadConfig {
        max_file_size: std::env::var("UPLOAD_MAX_FILE_SIZE")
            .unwrap_or_else(|_| "104857600".to_string())
            .parse()
            .unwrap(),
        // ... more fields
    }
});

impl UploadConfig {
    pub fn max_file_size() -> u64 { UPLOAD.max_file_size }
    pub fn storage_driver() -> &'static str { &UPLOAD.storage_driver }
    // ... more accessors
}
```

## Available Configs

- `AppConfig::host()`, `AppConfig::port()`
- `DatabaseConfig::url()`, `DatabaseConfig::max_connections()`
- `JwtConfig::secret()`, `JwtConfig::expiration_minutes()`
- `RedisConfig::url()`
- `RabbitMQConfig::url()`
- `KafkaConfig::bootstrap_servers()`, `KafkaConfig::group_id()`
- `EmailConfig::host()`, `EmailConfig::port()`, `EmailConfig::username()`, etc.
- `ActivationConfig::expiry_account_activation()`, `expiry_password_reset()`
- `CronConfig::user_counter()`
- `UploadConfig::max_file_size()`, `UploadConfig::allowed_types()`, `UploadConfig::storage_driver()`

---

# AppState

```rust
pub struct AppState {
    pub db: Mutex<Pool<Postgres>>,      // Database connection pool
    pub jwt_secret: &'static str,        // JWT signing secret
    pub mq: Option<DynMq>,               // RabbitMQ (optional)
    pub events: Option<SharedEventBus>,  // Kafka (optional)
}

impl AppState {
    pub fn event_bus(&self) -> Option<&SharedEventBus> {
        self.events.as_ref()
    }
}

// DynMq avoids circular dependency with mq module
pub type DynMq = Arc<Mutex<dyn Any + Send + Sync>>;
pub type SharedEventBus = Arc<EventBus>;

// Factory functions
pub async fn create_pool() -> Pool<Postgres>;
pub async fn state() -> web::Data<AppState>;
pub async fn state_with_mq(mq: DynMq) -> web::Data<AppState>;
pub async fn state_with_mq_and_events(mq: DynMq, events: SharedEventBus) -> web::Data<AppState>;
```
