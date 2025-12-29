# CLAUDE.md

This file provides guidance to Claude Code when working with the Money Flow application.

> **Infrastructure docs are in root `CLAUDE.md`.** This file covers application code only.

## Application Overview

**Money Flow** - Rust web API for personal finance tracking with event-driven architecture.

### Tech Stack

| Category | Technology | Crate |
|----------|------------|-------|
| Framework | Actix-web 4 | `actix-web`, `actix-cors`, `actix-multipart` |
| Database | PostgreSQL | `sqlx` (compile-time checked) |
| Queue (Tasks) | RabbitMQ | `lapin` |
| Events (Streaming) | Apache Kafka | `rdkafka` |
| Cache | Redis | `redis` |
| Email | SMTP | `lettre` |
| Templates | Tera | `tera` |
| Auth | JWT | `jsonwebtoken`, `bcrypt` |
| Cron | Scheduler | `tokio-cron-scheduler` |
| Async | Tokio | `tokio` |
| Logging | Tracing | `tracing`, `tracing-subscriber` |
| Validation | Validator | `validator` |
| Serialization | Serde | `serde`, `serde_json` |
| UUID | uuid v4 | `uuid` |
| DateTime | Chrono | `chrono` |
| File Hashing | SHA256 | `sha2` |

---

## Complete Project Structure

```
money_flow/
├── Cargo.toml                          # Dependencies and project config
├── Cargo.lock                          # Locked dependency versions
├── .env                                # App environment variables (synced from Docker)
├── .env.example                        # Example env file
│
├── migrations/                         # SQLx database migrations
│   ├── 20251217202253_create_users_table.sql
│   ├── 20251217203606_create_categories_table.sql
│   ├── 20251217204134_create_transactions_table.sql
│   ├── 20251222231150_add_user_fields_and_activation_hashes.sql
│   └── 20251224120000_create_uploads_table.sql
│
├── .sqlx/                              # SQLx query cache (COMMIT TO GIT)
│   └── query-*.json                    # Cached query metadata for offline builds
│
├── storage/                            # File storage
│   └── app/
│       ├── public/                     # Public files (nginx serves at /storage/)
│       └── private/                    # Private files (API serves with auth)
│
├── tests/                              # Integration tests
│   └── routes_test.rs
│
└── src/
    ├── main.rs                         # Application entry point
    ├── lib.rs                          # Module exports for library usage
    │
    ├── config/                         # Configuration modules (once_cell::Lazy)
    │   ├── mod.rs                      # Re-exports all config modules
    │   ├── app.rs                      # AppConfig: HOST, PORT, RUST_LOG
    │   ├── database.rs                 # DatabaseConfig: DATABASE_URL, max_connections
    │   ├── jwt.rs                      # JwtConfig: JWT_SECRET, EXPIRATION_TIME
    │   ├── redis.rs                    # RedisConfig: REDIS_URL
    │   ├── rabbitmq.rs                 # RabbitMQConfig: RABBITMQ_URL
    │   ├── kafka.rs                    # KafkaConfig: bootstrap_servers, group_id
    │   ├── email.rs                    # EmailConfig: SMTP settings
    │   ├── activation.rs               # ActivationConfig: token expiry times
    │   ├── cron.rs                     # CronConfig: job schedules
    │   └── upload.rs                   # UploadConfig: max_file_size, allowed_types, storage
    │
    ├── bootstrap/                      # Core Framework Layer
    │   ├── mod.rs                      # Re-exports: database, events, includes, middleware, mq, routes, utility
    │   │
    │   ├── database/                   # Database connection and state
    │   │   ├── mod.rs                  # Re-exports database module
    │   │   └── database.rs             # AppState, DynMq, SharedEventBus, create_pool()
    │   │
    │   ├── events/                     # Kafka Event System
    │   │   ├── mod.rs                  # EventBus, SharedEventBus, init(), start_consumer(), publish module
    │   │   ├── types.rs                # DomainEvent, EventType, EventMetadata, EventBuilder
    │   │   ├── topics.rs               # Topic constants: USER_EVENTS, AUTH_EVENTS, etc.
    │   │   ├── producer.rs             # EventProducer: publish(), publish_batch(), publish_with_retry()
    │   │   ├── consumer.rs             # EventConsumer, EventHandler trait, EventHandlerError
    │   │   └── handlers/               # Event subscribers
    │   │       ├── mod.rs              # Handler registration: create_handlers()
    │   │       ├── user.rs             # UserEventHandler, UserAuditHandler
    │   │       └── auth.rs             # AuthEventHandler
    │   │
    │   ├── includes/                   # Shared Controllers and Services
    │   │   ├── mod.rs                  # Re-exports controllers and storage
    │   │   ├── controllers/
    │   │   │   ├── mod.rs              # Re-exports all shared controllers
    │   │   │   ├── email.rs            # EmailController: send_email() via SMTP
    │   │   │   └── uploads.rs          # UploadsController: handle file uploads
    │   │   └── storage/                # Storage Driver Abstraction (S3-ready)
    │   │       ├── mod.rs              # StorageDriver trait, Storage manager, StorageError
    │   │       ├── local.rs            # LocalStorageDriver: filesystem storage
    │   │       └── s3.rs               # S3StorageDriver: AWS S3 (placeholder)
    │   │
    │   ├── middleware/                 # HTTP Middleware
    │   │   ├── mod.rs                  # Re-exports middleware controllers
    │   │   └── controllers/
    │   │       ├── mod.rs              # Re-exports all middleware, json_error_handler
    │   │       ├── auth.rs             # JwtMiddleware: validate JWT, extract claims
    │   │       ├── cors.rs             # CORS configuration: configure()
    │   │       ├── json_error.rs       # JSON error handler for invalid JSON
    │   │       ├── security_headers.rs # Security headers: X-Content-Type-Options, etc.
    │   │       └── tracing_logger.rs   # Request logging: init(), configure()
    │   │
    │   ├── mq/                         # RabbitMQ Message Queue Core
    │   │   ├── mod.rs                  # Re-exports mq controller
    │   │   └── controller/
    │   │       ├── mod.rs              # Re-exports mq functions
    │   │       └── mq.rs               # MessageQueue, SharedQueue, JobOptions, JobStatus, enqueue functions
    │   │
    │   ├── routes/                     # Route Registration
    │   │   ├── mod.rs                  # Re-exports route controllers
    │   │   └── controller/
    │   │       ├── mod.rs              # Re-exports api and crons
    │   │       ├── api.rs              # register(): all API route definitions
    │   │       └── crons.rs            # register(): all cron job schedules
    │   │
    │   └── utility/                    # Utility Functions
    │       ├── mod.rs                  # Re-exports auth and template
    │       ├── auth.rs                 # Auth utilities: JWT generation, password hashing
    │       └── template.rs             # Template helpers: assets(), asset(), private_asset()
    │
    ├── app/                            # Application Layer
    │   ├── mod.rs                      # Re-exports: cron, db_query, http, mq
    │   │
    │   ├── cron/                       # Cron Job Implementations
    │   │   ├── mod.rs                  # Re-exports all cron jobs
    │   │   ├── user_counter.rs         # UserCounterJob: counts users periodically
    │   │   └── list_user_emails.rs     # ListUserEmailsJob: lists all user emails
    │   │
    │   ├── db_query/                   # Database Queries
    │   │   ├── mod.rs                  # Re-exports read and mutations
    │   │   ├── read/                   # SELECT queries (read-only)
    │   │   │   ├── mod.rs              # Re-exports read modules
    │   │   │   ├── user/
    │   │   │   │   └── mod.rs          # get_by_id, get_by_email, has_with_email, sign_in, count
    │   │   │   └── upload/
    │   │   │       └── mod.rs          # get_by_uuid, get_by_user_id, get_public_by_uuid
    │   │   └── mutations/              # INSERT/UPDATE/DELETE queries
    │   │       ├── mod.rs              # Re-exports mutation modules
    │   │       ├── user/
    │   │       │   └── mod.rs          # create, update_partial, update_full, delete
    │   │       ├── upload/
    │   │       │   └── mod.rs          # create, delete
    │   │       └── activation_hash/
    │   │           └── mod.rs          # create, verify, delete, generate_hash
    │   │
    │   ├── http/                       # HTTP Layer
    │   │   ├── mod.rs                  # Re-exports api and web modules
    │   │   ├── api/                    # REST API
    │   │   │   ├── mod.rs              # Re-exports controllers, validators, middlewares
    │   │   │   ├── controllers/
    │   │   │   │   ├── mod.rs          # Re-exports all controllers
    │   │   │   │   ├── auth.rs         # AuthController: sign_up(), sign_in()
    │   │   │   │   ├── user.rs         # UserController: get_current(), update_*, delete()
    │   │   │   │   ├── activation.rs   # ActivationController: activate, forgot_password, reset
    │   │   │   │   ├── upload.rs       # UploadController: single, multiple, chunked, download
    │   │   │   │   └── responses.rs    # BaseResponse, UserDto, ValidationErrorResponse
    │   │   │   ├── validators/
    │   │   │   │   ├── mod.rs          # Re-exports validators
    │   │   │   │   ├── auth.rs         # SignupRequest, SigninRequest, validate_password()
    │   │   │   │   └── user.rs         # UpdateUserRequest, user field validators
    │   │   │   └── middlewares/
    │   │   │       └── mod.rs          # API-specific middlewares
    │   │   └── web/                    # Web Pages (Tera templates)
    │   │       ├── mod.rs              # Re-exports web modules
    │   │       ├── controllers/
    │   │       │   ├── mod.rs
    │   │       │   └── pages.rs        # Page handlers: index, dashboard, etc.
    │   │       ├── validators/
    │   │       │   └── mod.rs
    │   │       └── middlewares/
    │   │           └── mod.rs
    │   │
    │   └── mq/                         # Message Queue Jobs
    │       ├── mod.rs                  # Re-exports jobs and workers
    │       ├── jobs/                   # Job Definitions (parameters)
    │       │   ├── mod.rs              # Re-exports job modules
    │       │   ├── create_user/
    │       │   │   └── mod.rs          # CreateUserParams, execute()
    │       │   └── email/
    │       │       └── mod.rs          # SendEmailParams, EmailTemplate enum
    │       └── workers/                # Job Processors (executors)
    │           ├── mod.rs              # Worker router: process_job()
    │           ├── create_user/
    │           │   └── mod.rs          # CreateUserWorker: process()
    │           └── email/
    │               └── mod.rs          # EmailWorker: process(), render templates
    │
    ├── routes/                         # Route Definitions
    │   ├── mod.rs                      # Named routes registry
    │   ├── api.rs                      # API routes: /api/v1/*
    │   ├── web.rs                      # Web routes: /, /dashboard, etc.
    │   └── crons.rs                    # Cron job schedules
    │
    └── resources/                      # Static Resources
        ├── css/
        │   └── toastify.min.css
        ├── js/
        │   └── toastify.min.js
        └── views/
            ├── emails/                 # Tera email templates
            │   ├── base.html           # Base layout (header, footer, styles)
            │   ├── welcome.html
            │   ├── account_activation.html
            │   ├── forgot_password.html
            │   ├── user_must_set_password.html
            │   ├── password_change.html
            │   ├── activation_success.html
            │   └── password_reset_success.html
            └── web/                    # Tera web page templates
```

---

## Module Details

### `main.rs` - Entry Point

```rust
// Initialization sequence:
1. tracing_logger::init()           // Initialize logging
2. crons::register(pool)            // Start cron scheduler
3. mq::init(pool)                   // Connect to RabbitMQ
4. mq::start_processor(queue, 4)    // Start 4 worker threads
5. events::init(pool)               // Connect to Kafka
6. events::start_consumer(consumer) // Start event consumer
7. HttpServer::new()                // Start HTTP server
```

### `lib.rs` - Module Exports

```rust
pub mod app;        // Application layer (http, db_query, cron, mq)
pub mod bootstrap;  // Core framework (database, events, middleware, routes, utility)
pub mod config;     // Configuration
pub mod routes;     // Route definitions

// Re-exports for convenience
pub use bootstrap::database;
pub use bootstrap::middleware::controllers::json_error_handler;
```

---

## Configuration Pattern

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

**Available configs:**
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

## AppState

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

---

## Database Queries

### Read Operations (`app/db_query/read/`)

```rust
use crate::app::db_query::read::user;

// Check if user exists
let exists: bool = user::has_with_email(&db, "test@example.com").await;

// Get user by ID
let user: Option<User> = user::get_by_id(&db, 123).await?;

// Get user by email
let user: User = user::get_by_email(&db, "test@example.com").await?;

// Sign in (returns user if credentials valid)
let user: User = user::sign_in(&db, &signin_request).await?;

// Count all users
let count: i64 = user::count(&db).await;

// Upload reads
use crate::app::db_query::read::upload;
let upload = upload::get_by_uuid(&db, &uuid).await?;
let uploads = upload::get_by_user_id(&db, user_id).await?;
```

### Mutation Operations (`app/db_query/mutations/`)

```rust
use crate::app::db_query::mutations::user;
use crate::app::db_query::mutations::activation_hash;
use crate::app::db_query::mutations::upload;

// Create user
user::create(&db, &CreateUserParams { email, password, first_name, last_name }).await;

// Update user (partial - only provided fields)
user::update_partial(&db, user_id, &UpdateParams { first_name: Some("New"), .. }).await?;

// Delete user
user::delete(&db, user_id).await?;

// Activation hashes
let hash: String = activation_hash::generate_hash(); // Random 6-char code
activation_hash::create(&db, user_id, &hash, "activation", expiry_minutes).await?;
let valid: bool = activation_hash::verify(&db, user_id, &hash, "activation").await?;

// Upload mutations
upload::create(&db, &CreateUploadParams { ... }).await?;
upload::delete(&db, &uuid).await?;
```

---

## Event-Driven Architecture

### Dual Messaging Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                     HTTP Request Handler                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│      RabbitMQ         │       │        Kafka          │
│   (Task Queue)        │       │    (Event Stream)     │
│                       │       │                       │
│ Pattern: Work Queue   │       │ Pattern: Pub/Sub      │
│ Delivery: At-least-1  │       │ Delivery: At-least-1  │
│ Consumers: 1 per msg  │       │ Consumers: Many       │
└───────────┬───────────┘       └───────────┬───────────┘
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│   MQ Workers (4)      │       │   Event Handlers      │
│   - create_user       │       │   - UserEventHandler  │
│   - send_email        │       │   - AuthEventHandler  │
└───────────────────────┘       └───────────────────────┘
```

| System   | Purpose | When to Use |
|----------|---------|-------------|
| RabbitMQ | Commands/Tasks | Side effects, external calls (email, SMS, payments) |
| Kafka    | Events/Facts | Audit, analytics, notifications, cross-service |

### Kafka Topics

| Topic | Events | Entity |
|-------|--------|--------|
| `user.events` | created, updated, deleted, activated, password_changed | User |
| `auth.events` | sign_in, sign_in_failed, sign_out, password_reset_requested | Auth |
| `transaction.events` | created, updated, deleted | Transaction |
| `category.events` | created, updated, deleted | Category |
| `system.events` | health_check, error, warning | System |

### Event Types (`bootstrap/events/types.rs`)

```rust
pub enum EventType {
    User(UserEventType),
    Auth(AuthEventType),
    Transaction(TransactionEventType),
    Category(CategoryEventType),
    System(SystemEventType),
}

pub enum UserEventType {
    Created, Updated, Deleted, Activated, PasswordChanged, BalanceUpdated,
}

pub enum AuthEventType {
    SignIn, SignInFailed, SignOut, PasswordResetRequested, PasswordReset,
}

pub struct DomainEvent {
    pub id: String,              // UUID v4
    pub event_type: EventType,
    pub entity_type: String,     // "user", "auth", etc.
    pub entity_id: String,       // Affected entity ID
    pub payload: Value,          // JSON payload
    pub metadata: EventMetadata,
    pub timestamp: i64,          // Unix milliseconds
    pub version: i64,            // For ordering
}
```

### Publishing Events

```rust
use crate::bootstrap::events;

// Using helper functions (recommended)
if let Some(event_bus) = state.event_bus() {
    events::publish::user_created(event_bus, user_id, &email, &first_name, &last_name, None).await?;
    events::publish::auth_sign_in(event_bus, user_id, &email, ip, user_agent).await?;
}

// Using EventBuilder (for custom events)
use crate::bootstrap::events::{EventBuilder, EventType, UserEventType};

let event = EventBuilder::new(EventType::User(UserEventType::BalanceUpdated), &user_id.to_string())
    .payload(serde_json::json!({ "old_balance": 1000, "new_balance": 1500 }))
    .actor(actor_id)
    .correlation_id("req-123")
    .build();

event_bus.publish(&event).await?;
```

### Creating Event Handlers

```rust
// bootstrap/events/handlers/my_handler.rs
use crate::bootstrap::events::consumer::{EventHandler, EventHandlerError};
use crate::bootstrap::events::types::DomainEvent;
use async_trait::async_trait;

pub struct MyHandler;

#[async_trait]
impl EventHandler for MyHandler {
    fn name(&self) -> &'static str { "my_handler" }

    fn topics(&self) -> Vec<&'static str> {
        vec!["user.events", "auth.events"]
    }

    async fn handle(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        match &event.event_type {
            EventType::User(UserEventType::Created) => { /* handle */ }
            _ => {}
        }
        Ok(())
    }
}

// Register in bootstrap/events/handlers/mod.rs
pub fn create_handlers(db: SharedDb) -> Vec<Arc<dyn EventHandler>> {
    vec![
        Arc::new(UserEventHandler::new(db.clone())),
        Arc::new(AuthEventHandler::new(db.clone())),
        Arc::new(MyHandler),
    ]
}
```

---

## RabbitMQ Jobs

### Job Priority Levels

| Priority | Name | Use Case |
|----------|------|----------|
| 0 | FIFO | Default, processed in order |
| 1 | Low | Non-urgent (welcome emails) |
| 2 | Normal | Standard priority |
| 3 | Medium | Important tasks |
| 4 | High | Time-sensitive |
| 5 | Critical | Must process immediately |

### Existing Jobs

| Job | Description | Parameters |
|-----|-------------|------------|
| `create_user` | Create user in database | `CreateUserParams { email, password, first_name, last_name }` |
| `send_email` | Send email via SMTP | `SendEmailParams { to, name, template, variables }` |

### Enqueueing Jobs

```rust
use crate::bootstrap::mq::{self, JobOptions, JobStatus};

// Fire and forget
let options = JobOptions::new()
    .priority(1)
    .fault_tolerance(3);  // Retry 3 times

mq::enqueue_job_dyn(&mq, "send_email", &params, options).await?;

// Wait for completion (with timeout)
let status = mq::enqueue_and_wait_dyn(&mq, "create_user", &params, options, 30000).await?;
match status {
    JobStatus::Completed => { /* success */ }
    JobStatus::Failed => { /* failed after retries */ }
    JobStatus::Pending => { /* still processing */ }
    JobStatus::Timeout => { /* timed out */ }
}
```

### Email Templates

| Template | Variables | Purpose |
|----------|-----------|---------|
| `welcome` | `first_name`, `email` | Welcome new user |
| `account_activation` | `first_name`, `email`, `activation_code` | Activation code |
| `forgot_password` | `first_name`, `reset_code` | Password reset |
| `user_must_set_password` | `first_name`, `set_password_code` | Force password set |
| `password_change` | `first_name` | Password changed notification |
| `activation_success` | `first_name` | Account activated |
| `password_reset_success` | `first_name` | Password reset success |

---

## Storage System

### Storage Driver Architecture

```rust
// bootstrap/includes/storage/mod.rs
#[async_trait]
pub trait StorageDriver: Send + Sync {
    fn driver_type(&self) -> StorageDriverType;
    async fn put(&self, data: &[u8], filename: &str, visibility: Visibility) -> Result<StoredFile, StorageError>;
    async fn get(&self, path: &str) -> Result<Vec<u8>, StorageError>;
    async fn delete(&self, path: &str) -> Result<bool, StorageError>;
    async fn exists(&self, path: &str) -> Result<bool, StorageError>;
    async fn size(&self, path: &str) -> Result<u64, StorageError>;
    fn url(&self, path: &str, visibility: Visibility) -> String;
    fn path(&self, path: &str) -> PathBuf;
    async fn init(&self) -> Result<(), StorageError>;
}

pub enum Visibility {
    Public,   // Served by nginx at /storage/
    Private,  // Served by API with auth
}

pub enum StorageDriverType {
    Local,
    S3,
}
```

### Using Storage

```rust
use crate::bootstrap::includes::storage::{get_storage, Visibility};

// Get global storage instance
let storage = get_storage()?;

// Store a file
let stored = storage.put(data, "filename.jpg", Visibility::Public).await?;

// Get file contents
let contents = storage.get(&stored.storage_path).await?;

// Check existence
let exists = storage.exists(&stored.storage_path).await?;

// Delete file
storage.delete(&stored.storage_path).await?;
```

### Template Helper Functions

```rust
use crate::bootstrap::utility::template::{assets, asset, private_asset};

// Public file URL: /storage/filename.jpg
let url = assets("filename.jpg", "public");
let url = asset("filename.jpg");  // shorthand

// Private file URL: /api/v1/upload/private/uuid
let url = assets("uuid", "private");
let url = private_asset("uuid");  // shorthand
```

---

## API Endpoints

### Authentication (No Auth Required)

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| POST | `/api/v1/auth/sign-up` | `AuthController::sign_up` | Register new user |
| POST | `/api/v1/auth/sign-in` | `AuthController::sign_in` | Login, get JWT |

### Account (No Auth Required)

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| POST | `/api/v1/account/activate-account` | `ActivationController::activate_account` | Activate with code |
| POST | `/api/v1/account/forgot-password` | `ActivationController::forgot_password` | Request reset code |
| POST | `/api/v1/account/reset-password` | `ActivationController::reset_password` | Reset with code |

### User (Auth Required)

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| GET | `/api/v1/user` | `UserController::get_current` | Get current user |
| PATCH | `/api/v1/user` | `UserController::update_partial` | Update some fields |
| PUT | `/api/v1/user` | `UserController::update_full` | Update all fields |
| DELETE | `/api/v1/user/{id}` | `UserController::delete` | Delete user |

### File Upload (Auth Required)

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| POST | `/api/v1/upload/single` | `UploadController::single` | Single file |
| POST | `/api/v1/upload/multiple` | `UploadController::multiple` | Multiple files |
| POST | `/api/v1/upload/chunk/init` | `UploadController::chunk_init` | Init chunked |
| POST | `/api/v1/upload/chunk/upload` | `UploadController::chunk_upload` | Upload chunk |
| POST | `/api/v1/upload/chunk/complete` | `UploadController::chunk_complete` | Complete chunked |
| GET | `/api/v1/upload/chunk/status/{id}` | `UploadController::chunk_status` | Get status |
| GET | `/api/v1/upload/private/{uuid}` | `UploadController::download_private` | Download private |
| DELETE | `/api/v1/upload/{uuid}` | `UploadController::delete` | Delete upload |

### File Download (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/upload/download/public/{uuid}` | Download public file |
| GET | `/storage/{filename}` | Static file (nginx) |

---

## Named Routes (Laravel-like) with i18n Support

The application uses Laravel-style named routes for URL generation with full language/localization support. Routes are registered with names and language variants, and can be used in both Rust code and Tera templates.

### Registering Routes

Routes are registered in `routes/api.rs` and `routes/web.rs` using the `route!` macro:

```rust
// In routes/api.rs or routes/web.rs

// Default language (English) - most common usage
route!("auth.sign_up", "/api/v1/auth/sign-up");
route!("user.show", "/api/v1/user/{id}");

// Web routes with language variants
route!("web.sign_up", "/sign-up");              // English (default)
route!("web.sign_up", "/registrazione", "it");  // Italian
route!("web.sign_up", "/inscription", "fr");    // French
route!("web.sign_up", "/anmeldung", "de");      // German

// Routes with parameters and language variants
route!("user.profile", "/user/{id}/profile");           // English
route!("user.profile", "/utente/{id}/profilo", "it");   // Italian
```

### Using Routes in Tera Templates

Use the `route()` function in templates to generate URLs:

```html
<!-- Simple route (no parameters, default language) -->
<a href="{{ route(name='web.sign_up') }}">Sign Up</a>
<a href="{{ route(name='web.sign_in') }}">Sign In</a>

<!-- Route with language parameter -->
<a href="{{ route(name='web.sign_up', lang='it') }}">Registrati</a>
<a href="{{ route(name='web.sign_up', lang='fr') }}">S'inscrire</a>

<!-- Route with language from context variable -->
<a href="{{ route(name='web.sign_up', lang=current_lang) }}">Sign Up</a>

<!-- Route with a single parameter -->
<a href="{{ route(name='user.show', id='123') }}">View User 123</a>
<a href="{{ route(name='user.show', id=user.id) }}">View Profile</a>

<!-- Route with parameters and language -->
<a href="{{ route(name='user.profile', id=user.id, lang='it') }}">Vedi Profilo</a>

<!-- Route with multiple parameters -->
<a href="{{ route(name='upload.chunked.chunk', uuid='abc-def', index='0') }}">
    Upload First Chunk
</a>
```

### Language Fallback

If a route is not registered for the requested language, it automatically falls back to the default language (English). This allows you to:
1. Register only English routes initially
2. Add localized routes gradually as needed
3. Not worry about missing translations - English will be used as fallback

### Available Web Routes

| Route Name | URL | Description |
|------------|-----|-------------|
| `web.home` | `/` | Homepage |
| `web.sign_up` | `/sign-up` | Sign up page |
| `web.sign_in` | `/sign-in` | Sign in page |
| `web.forgot_password` | `/forgot-password` | Forgot password page |
| `web.profile` | `/profile` | User profile page |
| `web.logout` | `/logout` | Logout |

### Available API Routes

| Route Name | URL | Description |
|------------|-----|-------------|
| `auth.sign_up` | `/api/v1/auth/sign-up` | Register new user |
| `auth.sign_in` | `/api/v1/auth/sign-in` | Login |
| `account.activate` | `/api/v1/account/activate-account` | Activate account |
| `account.forgot_password` | `/api/v1/account/forgot-password` | Request reset |
| `account.verify_hash` | `/api/v1/account/verify-hash` | Verify hash |
| `account.reset_password` | `/api/v1/account/reset-password` | Reset password |
| `account.set_password_when_needed` | `/api/v1/account/set-password-when-needed` | Set password |
| `password.change` | `/api/v1/password/change-password` | Request password change |
| `password.verify_change` | `/api/v1/password/verify-password-change` | Verify & change password |
| `user.current` | `/api/v1/user` | Get current user |
| `user.show` | `/api/v1/user/{id}` | Get user by ID |
| `user.update_full` | `/api/v1/user` | Update all fields (PUT) |
| `user.update_partial` | `/api/v1/user` | Update some fields (PATCH) |
| `user.admin_create` | `/api/v1/user` | Admin create user (POST) |
| `user.delete` | `/api/v1/user/{id}` | Delete user |
| `upload.public` | `/api/v1/upload/public` | Upload public file |
| `upload.private` | `/api/v1/upload/private` | Upload private file |
| `upload.multiple` | `/api/v1/upload/multiple` | Upload multiple files |
| `upload.download.public` | `/api/v1/upload/download/public/{uuid}` | Download public file |
| `upload.private.download` | `/api/v1/upload/private/{uuid}` | Download private file |
| `upload.delete` | `/api/v1/upload/{uuid}` | Delete upload |
| `upload.user` | `/api/v1/upload/user` | Get user's uploads |
| `upload.chunked.start` | `/api/v1/upload/chunked/start` | Start chunked upload |
| `upload.chunked.chunk` | `/api/v1/upload/chunked/{uuid}/chunk/{index}` | Upload chunk |
| `upload.chunked.complete` | `/api/v1/upload/chunked/{uuid}/complete` | Complete upload |
| `upload.chunked.cancel` | `/api/v1/upload/chunked/{uuid}` | Cancel upload |

### Using Routes in Rust Code

```rust
use crate::bootstrap::utility::template::{
    route_by_name, route_by_name_lang,
    route_with_params, route_with_params_lang
};
use std::collections::HashMap;

// Simple route (no parameters, default language)
let url = route_by_name("web.sign_up");
// Returns: Some("/sign-up")

// Simple route with language
let url = route_by_name_lang("web.sign_up", "it");
// Returns: Some("/registrazione")

// Route with parameters (default language)
let mut params = HashMap::new();
params.insert("id".to_string(), "123".to_string());
let url = route_with_params("user.show", &params);
// Returns: Some("/api/v1/user/123")

// Route with parameters and language
let url = route_with_params_lang("user.profile", "it", &params);
// Returns: Some("/utente/123/profilo")
```

### Adding New Named Routes

1. Add the route to `routes/api.rs` or `routes/web.rs`:
```rust
// In register_route_names() function

// Default language route
route!("my_feature.action", "/api/v1/my-feature/{id}");

// With language variants
route!("my_feature.action", "/api/v1/my-feature/{id}");           // English (default)
route!("my_feature.action", "/api/v1/mia-funzione/{id}", "it");   // Italian
route!("my_feature.action", "/api/v1/ma-fonction/{id}", "fr");    // French
```

2. Use in templates:
```html
<!-- Default language -->
<a href="{{ route(name='my_feature.action', id=item.id) }}">Action</a>

<!-- With language -->
<a href="{{ route(name='my_feature.action', id=item.id, lang='it') }}">Azione</a>
```

### Checking Route Existence

```rust
use crate::routes::{route_exists, get_route_languages};

// Check if a route exists for a specific language
if route_exists("web.sign_up", "it") {
    // Italian route is registered
}

// Get all registered languages for a route
let languages = get_route_languages("web.sign_up");
// Returns: Some({"en": "/sign-up", "it": "/registrazione", ...})
```

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `categories` | Budget categories per user |
| `transactions` | Income/expense records |
| `activation_hashes` | Activation/reset tokens |
| `uploads` | File upload records |

### Users Table

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| email | VARCHAR | Unique email |
| password | VARCHAR | Bcrypt hash |
| first_name | VARCHAR | First name |
| last_name | VARCHAR | Last name |
| balance | BIGINT | Balance in cents |
| activated | SMALLINT | 0=inactive, 1=active |
| user_must_set_password | SMALLINT | 0=no, 1=yes |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update |

### Uploads Table

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| uuid | UUID | Public identifier |
| user_id | BIGINT | FK to users |
| original_name | VARCHAR | Original filename |
| stored_name | VARCHAR | Stored filename |
| storage_path | VARCHAR | Full path |
| mime_type | VARCHAR | MIME type |
| size_bytes | BIGINT | File size |
| extension | VARCHAR | File extension |
| visibility | VARCHAR | public/private |
| checksum | VARCHAR | SHA256 hash |
| created_at | TIMESTAMP | Upload time |

**Note:** Money is stored as `BIGINT` (cents) for precision.

---

## Adding New Features

### New API Endpoint

1. Create handler in `app/http/api/controllers/<name>.rs`
2. Add request validator in `app/http/api/validators/<name>.rs` (if needed)
3. Register route in `routes/api.rs`
4. Add database queries in `app/db_query/read/` or `mutations/`
5. Publish Kafka event on success
6. Run `cargo sqlx prepare` if queries changed

### New Kafka Event Type

1. Add variant to `EventType` enum in `bootstrap/events/types.rs`
2. Add payload struct if needed
3. Add helper function in `bootstrap/events/mod.rs::publish`
4. Create handler in `bootstrap/events/handlers/` if needed
5. Register handler in `bootstrap/events/handlers/mod.rs::create_handlers()`

### New RabbitMQ Job

1. Create params struct in `app/mq/jobs/<job_name>/mod.rs`
2. Create worker in `app/mq/workers/<job_name>/mod.rs`
3. Add to match statement in `app/mq/workers/mod.rs::process_job()`

### New Email Template

1. Create template in `resources/views/emails/<name>.html`
2. Add variant to `EmailTemplate` enum in `app/mq/jobs/email/mod.rs`
3. Implement `template_path()` and `subject()` for the variant

### New Database Table

1. Create migration: `sqlx migrate add <name>`
2. Add read queries in `app/db_query/read/<entity>/mod.rs`
3. Add mutations in `app/db_query/mutations/<entity>/mod.rs`
4. Run `cargo sqlx prepare`

### New Cron Job

1. Create job in `app/cron/<job_name>.rs`
2. Register in `routes/crons.rs`

---

## Development Commands

```bash
# Inside container (docker compose exec rust bash)

# Build
cargo build                    # Debug build
cargo build --release          # Release build
cargo check                    # Type check only (faster)

# Run
cargo run                      # Run debug
cargo run --release            # Run release

# Test
cargo test                     # Run all tests
cargo test -- --nocapture      # Show println output
cargo test <test_name>         # Run specific test

# Lint
cargo clippy                   # Linter
cargo fmt                      # Format code
cargo fmt -- --check           # Check formatting

# Migrations
sqlx migrate run               # Run pending migrations
sqlx migrate add <name>        # Create new migration
sqlx migrate revert            # Revert last migration

# SQLx cache (REQUIRED after changing queries)
cargo sqlx prepare             # Generate .sqlx/ cache
```

---

## Important Notes

### SQLx Offline Mode

- Queries are compile-time checked against database schema
- `.sqlx/` directory contains query cache - **COMMIT TO GIT**
- Run `cargo sqlx prepare` after changing any `sqlx::query!` macro
- Set `SQLX_OFFLINE=true` for builds without database connection

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

### JWT Claims

```rust
pub struct Claims {
    pub sub: i64,       // User ID
    pub role: String,   // "user"
    pub exp: i64,       // Expiration timestamp
}
```

### Error Handling Pattern

```rust
// In handlers, use ? operator with proper error conversion
let user = db_user::get_by_id(&db, id)
    .await
    .map_err(|_| HttpResponse::NotFound().json(BaseResponse::error("User not found")))?;

// For Kafka/MQ failures, log warning and continue (non-critical)
if let Some(event_bus) = state.event_bus() {
    if let Err(e) = events::publish::user_created(event_bus, ...).await {
        tracing::warn!("Failed to publish event: {}", e);
        // Don't fail the request
    }
}
```
