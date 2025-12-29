# Bootstrap Module Documentation

This document provides comprehensive documentation for the Bootstrap module - the core framework layer of the Money Flow application.

**File Location:** `money_flow/src/bootstrap/`

---

## Overview

The Bootstrap module contains the core system components that power the Money Flow application. It provides:

- **Database** - Connection pooling, application state management, MongoDB integration
- **Events** - Apache Kafka event streaming system
- **Middleware** - HTTP middleware (auth, CORS, security headers, logging)
- **MQ** - RabbitMQ message queue infrastructure
- **Routes** - Route registry and cron job scheduling
- **Includes** - Shared utilities (storage drivers, email controller, uploads)
- **Utility** - Static helper functions (auth, templates)

---

## Module Structure

```
bootstrap/
├── mod.rs                          # Re-exports all submodules
│
├── database/                       # Database Connection & State
│   ├── mod.rs                      # Re-exports database module
│   └── database.rs                 # AppState, DynMq, create_pool()
│
├── events/                         # Kafka Event Streaming
│   ├── mod.rs                      # EventBus, init(), start_consumer()
│   ├── types.rs                    # DomainEvent, EventType, EventBuilder
│   ├── topics.rs                   # Topic constants
│   ├── producer.rs                 # EventProducer
│   ├── consumer.rs                 # EventConsumer, EventHandler trait
│   └── handlers/                   # Event subscribers
│       ├── mod.rs                  # Handler registration
│       ├── user.rs                 # UserEventHandler
│       └── auth.rs                 # AuthEventHandler
│
├── middleware/                     # HTTP Middleware
│   ├── mod.rs                      # Re-exports middleware controllers
│   └── controllers/
│       ├── mod.rs                  # Re-exports all middleware
│       ├── auth.rs                 # JWT authentication middleware
│       ├── cors.rs                 # CORS configuration
│       ├── permission.rs           # Permission-based access control
│       ├── security_headers.rs     # Security headers
│       ├── json_error.rs           # JSON error handler
│       └── tracing_logger.rs       # Request logging
│
├── mq/                             # RabbitMQ Message Queue
│   ├── mod.rs                      # Re-exports mq controller
│   └── controller/
│       ├── mod.rs                  # Re-exports mq functions
│       └── mq.rs                   # MessageQueue, enqueue functions
│
├── routes/                         # Route Registration
│   ├── mod.rs                      # Re-exports route controllers
│   └── controller/
│       ├── mod.rs                  # Re-exports api and crons
│       ├── api.rs                  # Named route registry with i18n
│       └── crons.rs                # Cron job scheduler
│
├── includes/                       # Shared Controllers & Services
│   ├── mod.rs                      # Re-exports controllers and storage
│   ├── controllers/
│   │   ├── mod.rs                  # Re-exports all controllers
│   │   ├── email.rs                # EmailController: SMTP email sending
│   │   └── uploads.rs              # UploadsController: file handling
│   └── storage/                    # Storage Driver Abstraction
│       ├── mod.rs                  # StorageDriver trait, Storage manager
│       ├── local.rs                # LocalStorageDriver: filesystem
│       └── s3.rs                   # S3StorageDriver: AWS S3 (CDN-ready)
│
└── utility/                        # Utility Functions
    ├── mod.rs                      # Re-exports auth and template
    ├── auth.rs                     # AuthInfo, is_logged(), check_logged()
    └── template.rs                 # Template helpers, named routes
```

---

## 1. Database Module

**File:** `bootstrap/database/database.rs`

The database module manages PostgreSQL connections and provides the shared application state.

### AppState

The `AppState` struct is shared across all HTTP request handlers:

```rust
pub struct AppState {
    pub db: Mutex<sqlx::Pool<sqlx::Postgres>>,  // PostgreSQL pool
    pub jwt_secret: &'static str,                // JWT signing secret
    pub mq: Option<DynMq>,                       // RabbitMQ (optional)
    pub events: Option<SharedEventBus>,          // Kafka EventBus (optional)
    pub mongodb: Option<SharedMongoDb>,          // MongoDB (optional)
}

impl AppState {
    /// Get the event bus for publishing events
    pub fn event_bus(&self) -> Option<&SharedEventBus>;

    /// Get the MongoDB database reference
    pub fn mongo(&self) -> Option<&SharedMongoDb>;
}
```

### Type Aliases

```rust
/// Avoids circular dependency with mq module
pub type DynMq = Arc<Mutex<dyn Any + Send + Sync>>;

/// Shared MongoDB client
pub type SharedMongoDb = Arc<MongoDatabase>;
```

### Factory Functions

| Function | Description |
|----------|-------------|
| `create_pool()` | Create a new PostgreSQL connection pool |
| `create_mongodb()` | Create a new MongoDB client and database |
| `state()` | Create AppState without MQ or events |
| `state_with_mq(mq)` | Create AppState with message queue |
| `state_with_mq_and_events(mq, events)` | Create AppState with MQ and Kafka |
| `state_full(mq, events, mongodb)` | Create AppState with all services |

### Usage Example

```rust
use crate::bootstrap::database::{state_full, create_pool, create_mongodb};

// In main.rs initialization
let db = create_pool().await;
let mongodb = create_mongodb().await.ok();
let mq = mq::init(db.clone()).await?;
let (events, consumer) = events::init(Arc::new(Mutex::new(db.clone()))).await?;

let app_state = state_full(
    Arc::new(Mutex::new(mq)) as DynMq,
    Some(events),
    mongodb,
).await;
```

---

## 2. Events Module (Kafka)

**File:** `bootstrap/events/mod.rs`

The events module provides Apache Kafka event streaming for the event-driven architecture.

### Architecture

```
┌─────────────┐     ┌─────────┐     ┌──────────────┐
│   API       │────>│  Kafka  │────>│  Consumers   │
│  Handlers   │     │  Topics │     │  (Handlers)  │
└─────────────┘     └─────────┘     └──────────────┘
      │                                    │
      v                                    v
┌─────────────┐                    ┌──────────────┐
│  Database   │                    │   Derived    │
│  (Source)   │                    │    State     │
└─────────────┘                    └──────────────┘
```

### Topics

| Topic | Events | Purpose |
|-------|--------|---------|
| `user.events` | created, updated, deleted, activated, password_changed | User lifecycle |
| `auth.events` | sign_in, sign_in_failed, sign_out, password_reset | Authentication |
| `transaction.events` | created, updated, deleted | Financial transactions |
| `category.events` | created, updated, deleted | Category management |
| `system.events` | health_check, error, warning | System-level events |

### EventBus

The main interface for publishing events:

```rust
pub struct EventBus {
    producer: SharedProducer,
}

impl EventBus {
    /// Publish a domain event
    pub async fn publish(&self, event: &DomainEvent) -> Result<(), EventPublishError>;

    /// Publish with retry
    pub async fn publish_reliable(&self, event: &DomainEvent, max_retries: u32) -> Result<(), EventPublishError>;

    /// Batch publish
    pub async fn publish_batch(&self, events: &[DomainEvent]) -> Vec<Result<(), EventPublishError>>;
}

pub type SharedEventBus = Arc<EventBus>;
```

### Event Types

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
```

### DomainEvent Structure

```rust
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

#### Using Helper Functions (Recommended)

```rust
use crate::bootstrap::events;

// In a controller
if let Some(event_bus) = state.event_bus() {
    // User created
    events::publish::user_created(event_bus, user_id, &email, &first_name, &last_name, None).await?;

    // User updated
    events::publish::user_updated(event_bus, user_id, vec!["first_name".into()], Some(name), None, None, Some(actor_id)).await?;

    // User deleted
    events::publish::user_deleted(event_bus, user_id, &email, Some("User requested deletion"), Some(actor_id)).await?;

    // Auth sign in
    events::publish::auth_sign_in(event_bus, user_id, &email, Some(&ip), Some(&user_agent)).await?;

    // Auth sign in failed
    events::publish::auth_sign_in_failed(event_bus, &email, "Invalid password", Some(&ip), Some(&user_agent)).await?;
}
```

#### Using EventBuilder (Custom Events)

```rust
use crate::bootstrap::events::{EventBuilder, EventType, UserEventType};

let event = EventBuilder::new(
    EventType::User(UserEventType::BalanceUpdated),
    &user_id.to_string()
)
.payload(serde_json::json!({
    "old_balance": 1000,
    "new_balance": 1500,
    "change": 500
}))
.actor(actor_id)
.correlation_id("req-123")
.build();

event_bus.publish(&event).await?;
```

### Creating Event Handlers

```rust
// bootstrap/events/handlers/my_handler.rs
use crate::bootstrap::events::consumer::{EventHandler, EventHandlerError};
use crate::bootstrap::events::types::{DomainEvent, EventType, UserEventType};
use async_trait::async_trait;

pub struct MyHandler;

#[async_trait]
impl EventHandler for MyHandler {
    fn name(&self) -> &'static str {
        "my_handler"
    }

    fn topics(&self) -> Vec<&'static str> {
        vec!["user.events", "auth.events"]
    }

    async fn handle(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        match &event.event_type {
            EventType::User(UserEventType::Created) => {
                // Handle user created event
                let email = event.payload.get("email").and_then(|v| v.as_str());
                tracing::info!("New user created: {:?}", email);
            }
            EventType::Auth(AuthEventType::SignIn) => {
                // Handle sign in event
                tracing::info!("User signed in: {}", event.entity_id);
            }
            _ => {}
        }
        Ok(())
    }
}
```

Register handler in `bootstrap/events/handlers/mod.rs`:

```rust
pub fn create_handlers(db: SharedDb) -> Vec<Arc<dyn EventHandler>> {
    vec![
        Arc::new(UserEventHandler::new(db.clone())),
        Arc::new(AuthEventHandler::new(db.clone())),
        Arc::new(MyHandler),  // Add your handler
    ]
}
```

### Initialization

```rust
use crate::bootstrap::events;

// Initialize full event system (producer + consumer)
let (event_bus, consumer) = events::init(db.clone()).await?;

// Start consumer in background
events::start_consumer(consumer);

// Or initialize producer only (lighter weight)
let event_bus = events::init_producer()?;
```

---

## 3. Middleware Module

**File:** `bootstrap/middleware/controllers/`

The middleware module provides HTTP middleware for request processing.

### 3.1 JWT Authentication (`auth.rs`)

Validates JWT tokens from Authorization header or `auth_token` cookie.

```rust
pub async fn verify_jwt(
    request: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error>
```

**Token Extraction Order:**
1. `Authorization: Bearer <token>` header
2. `auth_token` cookie (fallback)

**Request Extensions Added:**
- `claims.sub` (i64) - User ID
- `claims.permissions` (i16) - Permission level

**Responses:**
- `401 Unauthorized` - No token, invalid token, or expired token
- `500 Internal Server Error` - Server configuration error

### 3.2 Permission Middleware (`permission.rs`)

Role-based access control middleware.

```rust
pub fn require_permission(
    required_level: i16,
) -> impl Fn(ServiceRequest, Next<BoxBody>) -> Pin<Box<dyn Future<...>>> + Clone
```

**Permission Levels:**

| Level | Constant | Name | Description |
|-------|----------|------|-------------|
| 1 | `levels::BASIC` | Basic User | Default for all registered users |
| 10 | `levels::ADMIN` | Admin | Can manage uploads, view assets |
| 50 | `levels::AFFILIATE` | Affiliate | Future affiliate features |
| 100 | `levels::SUPER_ADMIN` | Super Admin | Full access to all features |

**Helper Functions:**

```rust
pub fn is_admin(permissions: i16) -> bool;
pub fn is_super_admin(permissions: i16) -> bool;
```

**Route Usage:**

```rust
use crate::bootstrap::middleware::controllers::permission::{levels, require_permission};

// IMPORTANT: Middleware order is REVERSED in Actix!
// The last .wrap() runs FIRST
cfg.service(
    web::scope("/api/v1/admin")
        .wrap(from_fn(require_permission(levels::ADMIN)))  // Runs SECOND
        .wrap(from_fn(middleware::auth::verify_jwt))       // Runs FIRST
        .route("/uploads", web::get().to(list_uploads))
);
```

### 3.3 CORS Configuration (`cors.rs`)

```rust
pub fn configure() -> Cors {
    // CORS - allow all for development
    Cors::permissive()
}
```

### 3.4 Security Headers (`security_headers.rs`)

Adds security headers to all responses:

```rust
pub fn configure() -> DefaultHeaders {
    DefaultHeaders::new()
        .add((header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
        .add((header::X_FRAME_OPTIONS, "DENY"))
        .add((header::STRICT_TRANSPORT_SECURITY, "max-age=31536000; includeSubDomains"))
        .add((header::X_XSS_PROTECTION, "1; mode=block"))
        .add((header::CONTENT_SECURITY_POLICY, "default-src 'self'; frame-ancestors 'none'"))
        .add((header::REFERRER_POLICY, "strict-origin-when-cross-origin"))
}
```

### 3.5 Tracing Logger (`tracing_logger.rs`)

Request logging using tracing.

```rust
pub fn init() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().pretty())
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .init();
}

pub fn configure() -> TracingLogger<impl tracing_actix_web::RootSpanBuilder> {
    TracingLogger::default()
}
```

### 3.6 JSON Error Handler (`json_error.rs`)

Handles invalid JSON in request bodies.

```rust
pub fn json_error_handler(err: JsonPayloadError, _: &HttpRequest) -> actix_web::Error;
```

---

## 4. Message Queue Module (RabbitMQ)

**File:** `bootstrap/mq/controller/mq.rs`

The MQ module provides RabbitMQ job queue infrastructure.

### Priority Levels

| Priority | Enum Value | Use Case |
|----------|------------|----------|
| 0 | `Priority::Fifo` | Default, processed in order |
| 1 | `Priority::Low` | Non-urgent (welcome emails) |
| 2 | `Priority::Normal` | Standard priority |
| 3 | `Priority::Medium` | Important tasks |
| 4 | `Priority::High` | Time-sensitive |
| 5 | `Priority::Critical` | Must process immediately |

### JobOptions

```rust
pub struct JobOptions {
    pub priority: Priority,
    pub fault_tolerance: u32,  // Number of retries
    pub delay_ms: Option<u64>, // Delay before processing
}

impl JobOptions {
    pub fn new() -> Self;
    pub fn priority(mut self, priority: u8) -> Self;
    pub fn fault_tolerance(mut self, retries: u32) -> Self;
    pub fn delay(mut self, ms: u64) -> Self;
}
```

### JobStatus

```rust
pub enum JobStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Retrying,
}
```

### QueuedJob

```rust
pub struct QueuedJob {
    pub id: String,           // UUID
    pub worker_name: String,  // Worker to process this job
    pub payload: String,      // JSON payload
    pub options: JobOptions,
    pub status: JobStatus,
    pub attempts: u32,
    pub created_at: i64,
    pub updated_at: i64,
}
```

### MessageQueue

```rust
pub struct MessageQueue {
    channel: Channel,
    db: Pool<Postgres>,
}

impl MessageQueue {
    pub async fn new(db: Pool<Postgres>) -> Result<Self, ...>;
    pub async fn enqueue(&self, job: QueuedJob) -> Result<String, ...>;
    pub async fn get_consumer(&self, worker_id: usize) -> Result<Consumer, ...>;
    pub async fn ack(&self, delivery_tag: u64) -> Result<(), ...>;
    pub async fn nack(&self, delivery_tag: u64, requeue: bool) -> Result<(), ...>;
    pub async fn move_to_failed(&self, job: &QueuedJob, error: &str) -> Result<(), ...>;
    pub async fn retry(&self, job: QueuedJob, error: &str) -> Result<bool, ...>;
    pub fn db(&self) -> &Pool<Postgres>;
}

pub type SharedQueue = Arc<Mutex<MessageQueue>>;
```

### Enqueueing Jobs

```rust
use crate::bootstrap::mq::{enqueue_job_dyn, enqueue_and_wait_dyn, JobOptions};

// Fire and forget
let options = JobOptions::new()
    .priority(1)
    .fault_tolerance(3);

let job_id = enqueue_job_dyn(&mq, "send_email", &params, options).await?;

// Wait for completion (with timeout)
let status = enqueue_and_wait_dyn(&mq, "create_user", &params, options, 30000).await?;

match status {
    JobStatus::Completed => { /* success */ }
    JobStatus::Failed => { /* failed after retries */ }
    JobStatus::Pending => { /* still processing */ }
    JobStatus::Retrying => { /* retrying */ }
}
```

### Initialization

```rust
use crate::bootstrap::mq;

// Initialize message queue
let queue = mq::init(db.clone()).await?;

// Start worker processor (4 concurrent workers)
mq::start_processor(queue, 4).await;
```

---

## 5. Routes Module

**File:** `bootstrap/routes/controller/`

### 5.1 Named Route Registry (`api.rs`)

Laravel-style named routes with internationalization (i18n) support.

#### Route Registration

```rust
use crate::route;

// Default language (English)
route!("auth.sign_up", "/api/v1/auth/sign-up");
route!("user.show", "/api/v1/user/{id}");

// With language variants
route!("web.sign_up", "/sign-up");              // English (default)
route!("web.sign_up", "/registrazione", "it");  // Italian
route!("web.sign_up", "/inscription", "fr");    // French
route!("web.sign_up", "/anmeldung", "de");      // German
```

#### Getting Route URLs

```rust
use crate::bootstrap::routes::controller::api::{route, route_with_lang};
use std::collections::HashMap;

// Simple route (default language)
let url = route("web.sign_up", None);
// Returns: Some("/sign-up")

// Route with language
let url = route_with_lang("web.sign_up", "it", None);
// Returns: Some("/registrazione")

// Route with parameters
let mut params = HashMap::new();
params.insert("id".to_string(), "123".to_string());
let url = route("user.show", Some(&params));
// Returns: Some("/api/v1/user/123")
```

#### Using in Tera Templates

```html
<!-- Simple route -->
<a href="{{ route(name='web.sign_up') }}">Sign Up</a>

<!-- Route with language -->
<a href="{{ route(name='web.sign_up', lang='it') }}">Registrati</a>

<!-- Route with parameters -->
<a href="{{ route(name='user.show', id=user.id) }}">View Profile</a>

<!-- Route with parameters and language -->
<a href="{{ route(name='user.profile', id=user.id, lang='it') }}">Vedi Profilo</a>
```

### 5.2 Cron Scheduler (`crons.rs`)

Cron job scheduling using `tokio-cron-scheduler`.

#### Schedule Builder

```rust
use crate::bootstrap::routes::controller::crons::Schedule;

// Every 5 minutes
Schedule::job("my_job", |db| async move {
    // Job logic here
})
.every_minutes(5)
.register(&scheduler, db.clone())
.await?;

// Daily at 3:00 AM
Schedule::job("daily_report", |db| async move {
    // Report logic
})
.daily_at("03:00")
.register(&scheduler, db.clone())
.await?;

// Custom cron expression
Schedule::job("custom", handler)
.cron("0 */15 * * * *")  // Every 15 minutes
.register(&scheduler, db.clone())
.await?;
```

#### Convenience Methods

| Method | Description | Example |
|--------|-------------|---------|
| `.cron(expr)` | Raw cron expression | `"0 */5 * * * *"` |
| `.daily_at(time)` | Daily at HH:MM | `"03:00"` |
| `.hourly_at(min)` | Hourly at minute | `"30"` |
| `.monthly_at(day)` | Monthly on day | `"01"` |
| `.every_minutes(n)` | Every N minutes | `5` |
| `.every_hours(n)` | Every N hours | `4` |

#### Common Schedule Constants

```rust
use crate::bootstrap::routes::controller::crons::schedules;

schedules::EVERY_MINUTE       // "0 * * * * *"
schedules::EVERY_FIVE_MINUTES // "0 */5 * * * *"
schedules::EVERY_TEN_MINUTES  // "0 */10 * * * *"
schedules::HOURLY             // "0 0 * * * *"
schedules::DAILY              // "0 0 0 * * *"
schedules::WEEKLY             // "0 0 0 * * 0"
schedules::MONTHLY            // "0 0 0 1 * *"
```

---

## 6. Includes Module

**File:** `bootstrap/includes/`

### 6.1 Storage Driver System

The storage module provides a unified interface for file storage with pluggable backends.

#### Storage Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Storage Manager                           │
│                  (from_config())                             │
└─────────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
┌─────────────────────┐           ┌─────────────────────┐
│  LocalStorageDriver │           │   S3StorageDriver   │
│    (filesystem)     │           │   (AWS S3 / CDN)    │
│                     │           │                     │
│ storage/app/public/ │           │ s3://bucket/public/ │
│ storage/app/private/│           │ s3://bucket/private/│
└─────────────────────┘           └─────────────────────┘
```

#### StorageDriver Trait

```rust
#[async_trait]
pub trait StorageDriver: Send + Sync {
    /// Get the driver type
    fn driver_type(&self) -> StorageDriverType;

    /// Store a file
    async fn put(&self, data: &[u8], filename: &str, visibility: Visibility) -> Result<StoredFile, StorageError>;

    /// Store a file in a subfolder
    async fn put_with_subfolder(&self, data: &[u8], filename: &str, visibility: Visibility, subfolder: &str) -> Result<StoredFile, StorageError>;

    /// Get file contents
    async fn get(&self, path: &str) -> Result<Vec<u8>, StorageError>;

    /// Delete a file
    async fn delete(&self, path: &str) -> Result<bool, StorageError>;

    /// Check if file exists
    async fn exists(&self, path: &str) -> Result<bool, StorageError>;

    /// Get file size
    async fn size(&self, path: &str) -> Result<u64, StorageError>;

    /// Get public URL for a file
    fn url(&self, path: &str, visibility: Visibility) -> String;

    /// Get full path for a file
    fn path(&self, path: &str) -> PathBuf;

    /// Initialize the storage
    async fn init(&self) -> Result<(), StorageError>;
}
```

#### Visibility Enum

```rust
pub enum Visibility {
    Public,   // Served by nginx at /storage/
    Private,  // Served by API with authentication
}
```

#### StorageDriverType

```rust
pub enum StorageDriverType {
    Local,  // Filesystem storage
    S3,     // AWS S3 or S3-compatible (MinIO, etc.)
}
```

#### StoredFile Result

```rust
pub struct StoredFile {
    pub id: String,              // UUID
    pub original_name: String,   // Original filename
    pub stored_name: String,     // Stored filename
    pub extension: String,       // File extension
    pub mime_type: String,       // MIME type
    pub size_bytes: u64,         // File size
    pub visibility: Visibility,  // Public or Private
    pub storage_path: String,    // Internal storage path
    pub checksum: String,        // SHA256 hash
    pub url: String,             // Access URL
}
```

#### Storage Usage

```rust
use crate::bootstrap::includes::storage::{get_storage, Visibility};

// Get global storage instance
let storage = get_storage()?;

// Store a file
let stored = storage.put(data, "filename.jpg", Visibility::Public).await?;

// Store in subfolder (e.g., avatars)
let stored = storage.put_with_subfolder(data, "avatar.jpg", Visibility::Private, "avatars").await?;

// Get file contents
let contents = storage.get(&stored.storage_path).await?;

// Check existence
let exists = storage.exists(&stored.storage_path).await?;

// Get file size
let size = storage.size(&stored.storage_path).await?;

// Delete file
let deleted = storage.delete(&stored.storage_path).await?;

// Get URL
let url = storage.url(&stored.storage_path, Visibility::Public);
```

#### LocalStorageDriver

Stores files on the local filesystem:

- **Public path:** `storage/app/public/` (served by nginx at `/storage/`)
- **Private path:** `storage/app/private/` (served by API)

Filename format: `{timestamp}_{uuid}.{extension}`
Example: `20251228_123456_550e8400-e29b-41d4-a716-446655440000.jpg`

#### S3StorageDriver (CDN-Ready)

**File:** `bootstrap/includes/storage/s3.rs`

Placeholder implementation for AWS S3 or S3-compatible services.

**Required Environment Variables:**

```env
S3_BUCKET=my-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_ENDPOINT=https://minio.example.com  # Optional, for S3-compatible services
S3_PUBLIC_URL=https://cdn.example.com  # Optional, CDN URL
```

**Configuration:**

```rust
pub struct S3Config {
    pub bucket: String,
    pub region: String,
    pub endpoint: Option<String>,         // For MinIO, DigitalOcean Spaces, etc.
    pub access_key_id: String,
    pub secret_access_key: String,
    pub public_url_base: Option<String>,  // CDN URL
}
```

**Implementation Status:**

The S3 driver is a placeholder. To enable:

1. Add `aws-sdk-s3` to Cargo.toml
2. Implement the actual S3 operations in `s3.rs`

**Example Implementation (TODO):**

```rust
// In put_with_subfolder():
let client = aws_sdk_s3::Client::new(&aws_config);

let key = format!("{}/{}/{}", visibility.as_str(), subfolder, stored_name);

client.put_object()
    .bucket(&self.config.bucket)
    .key(&key)
    .body(data.into())
    .content_type(&mime_type)
    .acl(match visibility {
        Visibility::Public => ObjectCannedAcl::PublicRead,
        Visibility::Private => ObjectCannedAcl::Private,
    })
    .send()
    .await?;
```

### 6.2 Email Controller

**File:** `bootstrap/includes/controllers/email.rs`

SMTP email sending with Tera templating.

#### Email Templates

| Template | Subject | Purpose |
|----------|---------|---------|
| `Welcome` | Welcome to MoneyFlow! | Welcome new user |
| `AccountActivation` | Activate Your Account | Account activation code |
| `ForgotPassword` | Reset Your Password | Password reset code |
| `UserMustSetPassword` | Set Up Your Password | Force password set |
| `PasswordChange` | Password Change Request | Password change notification |
| `ActivationSuccess` | Account Activated | Activation confirmation |
| `PasswordResetSuccess` | Password Changed | Password change confirmation |

#### Sending Emails

```rust
use crate::bootstrap::includes::controllers::email::{send, send_welcome, EmailRecipient, EmailTemplate};
use std::collections::HashMap;

// Send welcome email (convenience)
let recipient = EmailRecipient::new("user@example.com", "John Doe");
send_welcome(&recipient, "John").await?;

// Send custom email with template
let mut variables = HashMap::new();
variables.insert("first_name".to_string(), "John".to_string());
variables.insert("activation_code".to_string(), "ABC123".to_string());

send(&recipient, &EmailTemplate::AccountActivation, &variables).await?;
```

### 6.3 Uploads Controller

**File:** `bootstrap/includes/controllers/uploads.rs`

File upload utilities for public/private storage.

#### Storage Types

```rust
pub enum StorageType {
    Public,   // storage/app/public/
    Private,  // storage/app/private/
}
```

#### Upload Result

```rust
pub struct UploadResult {
    pub uuid: Uuid,
    pub original_name: String,
    pub stored_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub storage_type: StorageType,
    pub storage_path: String,
    pub checksum: String,
}
```

#### Upload Functions

```rust
use crate::bootstrap::includes::controllers::uploads::{save_file, save_file_with_subfolder, delete_file, read_file, StorageType};

// Save file
let result = save_file(data, "document.pdf", StorageType::Private, None).await?;

// Save with subfolder
let result = save_file_with_subfolder(data, "avatar.jpg", StorageType::Private, None, Some("avatars")).await?;

// Delete file
delete_file(&result.storage_path).await?;

// Read file
let contents = read_file(&result.storage_path).await?;

// Check existence
let exists = file_exists(&result.storage_path).await;
```

#### Chunked Uploads

For large files, use chunked uploads:

```rust
use crate::bootstrap::includes::controllers::uploads::chunked;

// Start session
let session_id = chunked::start_session(
    "large_file.zip",
    10,                      // total chunks
    1024 * 1024 * 100,       // total size (100MB)
    StorageType::Private
).await?;

// Add chunks (in order)
for (index, chunk_data) in chunks.iter().enumerate() {
    let complete = chunked::add_chunk(&session_id, index as u32, chunk_data.clone()).await?;

    if complete {
        // All chunks received, finalize
        let result = chunked::finalize(&session_id).await?;
    }
}

// Get progress
let (received, total) = chunked::get_progress(&session_id).await.unwrap();

// Cancel upload
chunked::cancel(&session_id).await;
```

---

## 7. Utility Module

**File:** `bootstrap/utility/`

### 7.1 Auth Utilities (`auth.rs`)

Authentication helper functions for checking login state.

#### AuthInfo

```rust
pub struct AuthInfo {
    pub is_logged: bool,
    pub user_id: Option<i64>,
    pub role: Option<String>,
    pub permissions: Option<i16>,
}

impl AuthInfo {
    pub fn guest() -> Self;
    pub fn logged(user_id: i64, role: String, permissions: i16) -> Self;
    pub fn is_admin(&self) -> bool;        // level 10 or 100
    pub fn is_super_admin(&self) -> bool;  // level 100
    pub fn is_affiliate(&self) -> bool;    // level 50 or 100
    pub fn has_permission(&self, level: i16) -> bool;
}
```

#### Functions

```rust
use crate::bootstrap::utility::auth::{is_logged, check_logged};

// In a controller
pub async fn homepage(req: HttpRequest) -> HttpResponse {
    let auth = is_logged(&req);

    if auth.is_logged {
        if auth.is_admin() {
            // Admin content
        } else {
            // Regular user content
        }
    } else {
        // Guest content
    }
}

// Simple boolean check
if check_logged(&req) {
    // User is logged in
}
```

### 7.2 Template Utilities (`template.rs`)

Helper functions for Tera templates.

#### Asset Versioning

All assets include version query parameters for cache busting:

```rust
use crate::bootstrap::utility::template::{assets, asset, private_asset, avatar_asset};

// Public asset with version
let url = assets("image.jpg", "public");
// Returns: "/storage/image.jpg?v=1.0.0"

// Shorthand for public
let url = asset("image.jpg");
// Returns: "/storage/image.jpg?v=1.0.0"

// Private asset (API route)
let url = private_asset("uuid-123");
// Returns: "/api/v1/upload/private/uuid-123"

// Avatar asset (dedicated endpoint)
let url = avatar_asset("uuid-123");
// Returns: "/api/v1/avatar/uuid-123"
```

#### Page Assets

```rust
use crate::bootstrap::utility::template::{determine_assets, PageAssets};

// Get CSS/JS for a page
let assets = determine_assets("SIGN_UP");
// css_path: "/assets/css/SIGN_UP/style.css?v=1.0.43"
// js_path: "/assets/js/SIGN_UP/app.js?v=1.0.43"
```

#### Named Routes in Templates

See Section 5.1 for route registration. Use in templates:

```html
<!-- Simple route -->
<a href="{{ route(name='web.sign_up') }}">Sign Up</a>

<!-- With parameters -->
<a href="{{ route(name='user.show', id=user.id) }}">Profile</a>

<!-- With language -->
<a href="{{ route(name='web.sign_up', lang='it') }}">Registrati</a>
```

#### Registering Template Functions

```rust
use crate::bootstrap::utility::template::register_template_functions;

let mut tera = Tera::new("templates/**/*.html").unwrap();
register_template_functions(&mut tera);
```

---

## Initialization Flow

The bootstrap modules are initialized in `main.rs` in this order:

```rust
// 1. Initialize logging
tracing_logger::init();

// 2. Create database pool
let db = create_pool().await;

// 3. Initialize storage
storage::init().await?;

// 4. Initialize cron scheduler
let scheduler = crons::init(db.clone()).await?;

// 5. Initialize RabbitMQ
let mq = mq::init(db.clone()).await?;
let shared_mq = Arc::new(Mutex::new(mq)) as DynMq;

// 6. Initialize Kafka events
let (event_bus, consumer) = events::init(Arc::new(Mutex::new(db.clone()))).await?;
events::start_consumer(consumer);

// 7. Initialize MongoDB (optional)
let mongodb = create_mongodb().await.ok();

// 8. Create AppState
let app_state = state_full(shared_mq, Some(event_bus), mongodb).await;

// 9. Start HTTP server
HttpServer::new(move || {
    App::new()
        .app_data(app_state.clone())
        .wrap(middleware::tracing_logger::configure())
        .wrap(middleware::security_headers::configure())
        .wrap(middleware::cors::configure())
        .configure(routes::register)
})
.bind("0.0.0.0:9999")?
.run()
.await
```

---

## Related Documentation

- [Database Documentation](../Database/DATABASE.md) - SQLx migrations and queries
- [Uploads Documentation](../Uploads/UPLOADS.md) - File upload system
- [Permissions Documentation](../Permissions/PERMISSIONS.md) - Access control
- [API Routes Documentation](../Routes/Api/API_ROUTES.md) - REST API endpoints
- [Web Routes Documentation](../Routes/Web/WEB_ROUTES.md) - Web pages

