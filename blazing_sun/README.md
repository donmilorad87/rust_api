# Blazing Sun Application

A Rust web application for personal finance tracking built with Actix-web, PostgreSQL, and event-driven architecture.

> **Infrastructure docs are in root folder.** See [../README.md](../README.md) for Docker and infrastructure documentation.

---

## Tech Stack

| Category       | Technology                                      |
|----------------|------------------------------------------------|
| Framework      | Actix-web 4                                    |
| Database       | PostgreSQL + SQLx (compile-time checked queries)|
| Queue (Tasks)  | RabbitMQ (lapin)                               |
| Events         | Apache Kafka (rdkafka)                         |
| Cache          | Redis                                          |
| Templates      | Tera                                           |
| Email          | Lettre (SMTP)                                  |
| Auth           | JWT (jsonwebtoken) + Bcrypt                    |
| Validation     | validator crate                                |
| Logging        | tracing + tracing-subscriber                   |
| Cron           | tokio-cron-scheduler                           |
| Async Runtime  | Tokio                                          |
| File Storage   | Local filesystem (S3-ready architecture)       |

---

## Architecture

### Event-Driven Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HTTP Request                                 │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Actix-web Handler                               │
│  1. Validate request                                                 │
│  2. Execute business logic                                           │
│  3. Enqueue task (RabbitMQ) → fire-and-forget or wait               │
│  4. Publish event (Kafka) → async notification                       │
│  5. Return response                                                  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│       RabbitMQ          │     │        Kafka            │
│    (Task Queue)         │     │    (Event Stream)       │
│                         │     │                         │
│  - send_email           │     │  - user.events          │
│  - create_user          │     │  - auth.events          │
│  - future tasks...      │     │  - transaction.events   │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│      MQ Workers         │     │    Event Handlers       │
│  (Process tasks)        │     │  (React to events)      │
└─────────────────────────┘     └─────────────────────────┘
```

### Dual Messaging Strategy

| System   | Purpose            | Pattern     | Use Cases                           |
|----------|--------------------| ------------|-------------------------------------|
| RabbitMQ | Commands/Tasks     | Work Queue  | Emails, user creation, background jobs |
| Kafka    | Events/Facts       | Pub/Sub     | Audit logs, analytics, notifications   |

---

## Folder Structure

```
blazing_sun/
├── Cargo.toml                          # Dependencies and project config
├── Cargo.lock                          # Locked dependency versions
├── .env                                # App environment variables
├── .env.example                        # Example env file
├── CLAUDE.md                           # AI assistant guidance
├── README.md                           # This file
│
├── migrations/                         # SQLx database migrations
│   ├── 20251217202253_create_users_table.sql
│   ├── 20251217203606_create_categories_table.sql
│   ├── 20251217204134_create_transactions_table.sql
│   ├── 20251222231150_add_user_fields_and_activation_hashes.sql
│   └── 20251224120000_create_uploads_table.sql
│
├── .sqlx/                              # Cached query metadata (COMMIT TO GIT)
│   └── query-*.json                    # SQLx offline mode cache
│
├── storage/                            # File storage
│   └── app/
│       ├── public/                     # Public files (served by nginx at /storage/)
│       └── private/                    # Private files (served by API)
│
├── tests/                              # Integration tests
│
└── src/
    ├── main.rs                         # Application entry point
    ├── lib.rs                          # Module exports
    │
    ├── config/                         # Configuration (env vars via once_cell::Lazy)
    │   ├── mod.rs                      # Re-exports all config modules
    │   ├── app.rs                      # HOST, PORT, RUST_LOG
    │   ├── database.rs                 # DATABASE_URL, max_connections
    │   ├── jwt.rs                      # JWT_SECRET, EXPIRATION_TIME
    │   ├── redis.rs                    # REDIS_URL
    │   ├── rabbitmq.rs                 # RABBITMQ_URL
    │   ├── kafka.rs                    # bootstrap_servers, group_id
    │   ├── email.rs                    # SMTP settings
    │   ├── activation.rs               # Token expiry times
    │   ├── cron.rs                     # Job schedules
    │   └── upload.rs                   # Upload settings (max size, types, storage)
    │
    ├── bootstrap/                      # Core framework components
    │   ├── mod.rs
    │   │
    │   ├── database/                   # Database connection
    │   │   ├── mod.rs
    │   │   └── database.rs             # AppState, create_pool()
    │   │
    │   ├── events/                     # Kafka Event System
    │   │   ├── mod.rs                  # EventBus, init(), publish helpers
    │   │   ├── types.rs                # DomainEvent, EventType, EventMetadata
    │   │   ├── topics.rs               # Topic constants
    │   │   ├── producer.rs             # Kafka producer
    │   │   ├── consumer.rs             # Kafka consumer, EventHandler trait
    │   │   └── handlers/               # Event handlers (subscribers)
    │   │       ├── mod.rs
    │   │       ├── user.rs             # UserEventHandler, UserAuditHandler
    │   │       └── auth.rs             # AuthEventHandler
    │   │
    │   ├── includes/                   # Shared controllers and utilities
    │   │   ├── mod.rs
    │   │   ├── controllers/
    │   │   │   ├── mod.rs
    │   │   │   ├── email.rs            # EmailController (SMTP sending)
    │   │   │   └── uploads.rs          # UploadsController (file handling)
    │   │   └── storage/                # Storage driver abstraction
    │   │       ├── mod.rs              # StorageDriver trait, Storage manager
    │   │       ├── local.rs            # Local filesystem driver
    │   │       └── s3.rs               # S3 driver (placeholder)
    │   │
    │   ├── middleware/                 # HTTP Middleware
    │   │   ├── mod.rs
    │   │   └── controllers/
    │   │       ├── mod.rs
    │   │       ├── auth.rs             # JwtMiddleware
    │   │       ├── cors.rs             # CORS configuration
    │   │       ├── json_error.rs       # JSON error handler
    │   │       ├── security_headers.rs # Security headers
    │   │       └── tracing_logger.rs   # Request logging
    │   │
    │   ├── mq/                         # RabbitMQ core
    │   │   ├── mod.rs
    │   │   └── controller/
    │   │       ├── mod.rs
    │   │       └── mq.rs               # MessageQueue, SharedQueue, enqueue functions
    │   │
    │   ├── routes/                     # Route registration
    │   │   ├── mod.rs
    │   │   └── controller/
    │   │       ├── mod.rs
    │   │       ├── api.rs              # API routes registration
    │   │       └── crons.rs            # Cron jobs registration
    │   │
    │   └── utility/                    # Utility functions
    │       ├── mod.rs
    │       ├── auth.rs                 # Auth utilities (JWT, password)
    │       └── template.rs             # Template helpers (assets function)
    │
    ├── app/                            # Application layer
    │   ├── mod.rs
    │   │
    │   ├── cron/                       # Cron job implementations
    │   │   ├── mod.rs
    │   │   ├── user_counter.rs         # Counts users periodically
    │   │   └── list_user_emails.rs     # Lists user emails
    │   │
    │   ├── db_query/                   # Database queries
    │   │   ├── mod.rs
    │   │   ├── read/                   # SELECT queries
    │   │   │   ├── mod.rs
    │   │   │   ├── user/mod.rs         # User reads
    │   │   │   └── upload/mod.rs       # Upload reads
    │   │   └── mutations/              # INSERT/UPDATE/DELETE
    │   │       ├── mod.rs
    │   │       ├── user/mod.rs         # User mutations
    │   │       ├── upload/mod.rs       # Upload mutations
    │   │       └── activation_hash/mod.rs
    │   │
    │   ├── http/                       # HTTP layer
    │   │   ├── mod.rs
    │   │   ├── api/                    # API endpoints
    │   │   │   ├── mod.rs
    │   │   │   ├── controllers/
    │   │   │   │   ├── mod.rs
    │   │   │   │   ├── auth.rs         # Sign up, sign in
    │   │   │   │   ├── user.rs         # User CRUD
    │   │   │   │   ├── activation.rs   # Account activation
    │   │   │   │   ├── upload.rs       # File upload endpoints
    │   │   │   │   └── responses.rs    # Response types
    │   │   │   ├── validators/
    │   │   │   │   ├── mod.rs
    │   │   │   │   ├── auth.rs         # Auth request validation
    │   │   │   │   └── user.rs         # User request validation
    │   │   │   └── middlewares/
    │   │   │       └── mod.rs
    │   │   └── web/                    # Web pages (Tera templates)
    │   │       ├── mod.rs
    │   │       ├── controllers/
    │   │       │   ├── mod.rs
    │   │       │   └── pages.rs        # Page handlers
    │   │       ├── validators/
    │   │       │   └── mod.rs
    │   │       └── middlewares/
    │   │           └── mod.rs
    │   │
    │   └── mq/                         # Message queue jobs
    │       ├── mod.rs
    │       ├── jobs/                   # Job definitions
    │       │   ├── mod.rs
    │       │   ├── create_user/mod.rs
    │       │   └── email/mod.rs
    │       └── workers/                # Job processors
    │           ├── mod.rs
    │           ├── create_user/mod.rs
    │           └── email/mod.rs
    │
    ├── routes/                         # Route definitions
    │   ├── mod.rs                      # Named routes registry
    │   ├── api.rs                      # API route definitions
    │   ├── web.rs                      # Web route definitions
    │   └── crons.rs                    # Cron job definitions
    │
    └── resources/                      # Static resources
        ├── css/
        │   └── toastify.min.css
        ├── js/
        │   └── toastify.min.js
        └── views/
            ├── emails/                 # Email templates (Tera)
            │   ├── base.html
            │   ├── welcome.html
            │   ├── account_activation.html
            │   ├── forgot_password.html
            │   ├── user_must_set_password.html
            │   ├── password_change.html
            │   ├── activation_success.html
            │   └── password_reset_success.html
            └── web/                    # Web page templates (Tera)
```

---

## Features

### Authentication & Authorization
- JWT-based authentication
- Bcrypt password hashing
- Account activation via email
- Password reset flow
- Configurable token expiration

### User Management
- Full CRUD operations
- Partial updates (PATCH)
- Profile management
- Balance tracking (stored in cents)

### File Upload System
- Single and multiple file upload
- Chunked upload support (resumable)
- Configurable: max file size, max files, allowed types
- Public/private file visibility
- Database tracking of uploads
- S3-ready architecture (storage driver abstraction)
- Public files served by nginx at `/storage/`
- Private files served by API with authentication

### Event System (Kafka)
- Domain events for all mutations
- User lifecycle events (created, updated, deleted, activated)
- Auth events (sign_in, sign_in_failed, sign_out)
- Transaction events
- Dead letter queue for failed events
- Configurable event handlers

### Task Queue (RabbitMQ)
- Async email sending
- User creation tasks
- Priority levels (0-5)
- Retry with fault tolerance
- Dead letter queue for failed jobs

### Email System
- SMTP via Lettre
- Tera templates
- Templates: welcome, activation, password reset, etc.
- Async sending via RabbitMQ

### Cron Jobs
- Configurable schedules via .env
- User counter job
- List user emails job
- Easy to add new jobs

---

## API Endpoints

### Authentication (Public)

| Method | Endpoint                          | Description                |
|--------|-----------------------------------|----------------------------|
| POST   | `/api/v1/auth/sign-up`            | Register new user          |
| POST   | `/api/v1/auth/sign-in`            | Login, get JWT token       |

### Account (Public)

| Method | Endpoint                          | Description                |
|--------|-----------------------------------|----------------------------|
| POST   | `/api/v1/account/activate-account`| Activate with code         |
| POST   | `/api/v1/account/forgot-password` | Request reset code         |
| POST   | `/api/v1/account/reset-password`  | Reset with code            |

### User (Auth Required)

| Method | Endpoint                          | Description                |
|--------|-----------------------------------|----------------------------|
| GET    | `/api/v1/user`                    | Get current user profile   |
| PATCH  | `/api/v1/user`                    | Partial update profile     |
| PUT    | `/api/v1/user`                    | Full update profile        |
| DELETE | `/api/v1/user/{id}`               | Delete user                |

### File Upload (Auth Required)

| Method | Endpoint                              | Description                |
|--------|---------------------------------------|----------------------------|
| POST   | `/api/v1/upload/single`               | Upload single file         |
| POST   | `/api/v1/upload/multiple`             | Upload multiple files      |
| POST   | `/api/v1/upload/chunk/init`           | Initialize chunked upload  |
| POST   | `/api/v1/upload/chunk/upload`         | Upload chunk               |
| POST   | `/api/v1/upload/chunk/complete`       | Complete chunked upload    |
| GET    | `/api/v1/upload/chunk/status/{id}`    | Get upload status          |
| GET    | `/api/v1/upload/private/{uuid}`       | Download private file      |
| DELETE | `/api/v1/upload/{uuid}`               | Delete upload              |

### File Download (Public)

| Method | Endpoint                              | Description                |
|--------|---------------------------------------|----------------------------|
| GET    | `/api/v1/upload/download/public/{uuid}` | Download public file     |

### Static Files (Public)

| URL                    | Description                |
|------------------------|----------------------------|
| `/storage/{filename}`  | Public files (nginx)       |

---

## Kafka Event System

### Topics

| Topic                | Events                                    |
|----------------------|-------------------------------------------|
| `user.events`        | created, updated, deleted, activated      |
| `auth.events`        | sign_in, sign_in_failed, sign_out         |
| `transaction.events` | created, updated, deleted                 |
| `category.events`    | created, updated, deleted                 |
| `system.events`      | health_check, error, warning              |

### Publishing Events

```rust
use crate::bootstrap::events;

// Using helper functions
if let Some(event_bus) = state.event_bus() {
    events::publish::user_created(event_bus, user_id, &email, &first_name, &last_name, None).await?;
    events::publish::auth_sign_in(event_bus, user_id, &email, ip, user_agent).await?;
}
```

---

## RabbitMQ Jobs

### Existing Jobs

| Job           | Description              | Parameters           |
|---------------|--------------------------|----------------------|
| `send_email`  | Send email via SMTP      | `SendEmailParams`    |
| `create_user` | Create user in database  | `CreateUserParams`   |

### Enqueueing Jobs

```rust
use crate::bootstrap::mq::{self, JobOptions, JobStatus};

// Fire and forget
let options = JobOptions::new().priority(1).fault_tolerance(3);
mq::enqueue_job_dyn(&mq, "send_email", &params, options).await?;

// Wait for completion
let status = mq::enqueue_and_wait_dyn(&mq, "create_user", &params, options, 30000).await?;
```

---

## Configuration

All config loaded via `once_cell::Lazy` from environment:

```rust
// Access anywhere in code
let host = AppConfig::host();
let jwt_secret = JwtConfig::secret();
let max_file_size = UploadConfig::max_file_size();
let storage_driver = UploadConfig::storage_driver();
```

### Environment Variables

```env
# App
HOST=0.0.0.0
PORT=9999
RUST_LOG=debug

# Database
DATABASE_URL=postgres://user:pass@host:5432/db
SQLX_OFFLINE=true

# JWT
JWT_SECRET=your_secret
EXPIRATION_TIME=60

# Upload Configuration
UPLOAD_MAX_FILE_SIZE=104857600    # 100MB
UPLOAD_MAX_FILES=10
UPLOAD_ALLOWED_TYPES=jpg,jpeg,png,gif,webp,pdf
UPLOAD_STORAGE_PATH=storage/app

# Storage Driver
STORAGE_DRIVER=local              # or "s3"
STORAGE_PUBLIC_URL=/storage
STORAGE_PRIVATE_URL=/api/v1/upload/private

# S3 (when STORAGE_DRIVER=s3)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=
# S3_BUCKET=
# S3_ENDPOINT=
```

---

## Database Schema

### Tables

| Table              | Description                    |
|--------------------|--------------------------------|
| `users`            | User accounts with balance     |
| `categories`       | User spending categories       |
| `transactions`     | Income/expense records         |
| `activation_hashes`| Account activation tokens      |
| `uploads`          | File upload records            |

### Users Table

| Column                  | Type      | Description            |
|-------------------------|-----------|------------------------|
| id                      | BIGSERIAL | Primary key            |
| email                   | VARCHAR   | Unique email           |
| password                | VARCHAR   | Bcrypt hash            |
| first_name              | VARCHAR   | First name             |
| last_name               | VARCHAR   | Last name              |
| balance                 | BIGINT    | Balance in cents       |
| activated               | SMALLINT  | 0=inactive, 1=active   |
| user_must_set_password  | SMALLINT  | 0=no, 1=yes            |
| created_at              | TIMESTAMP | Creation time          |
| updated_at              | TIMESTAMP | Last update            |

### Uploads Table

| Column        | Type      | Description            |
|---------------|-----------|------------------------|
| id            | BIGSERIAL | Primary key            |
| uuid          | UUID      | Public identifier      |
| user_id       | BIGINT    | FK to users            |
| original_name | VARCHAR   | Original filename      |
| stored_name   | VARCHAR   | Stored filename        |
| storage_path  | VARCHAR   | Full path              |
| mime_type     | VARCHAR   | MIME type              |
| size_bytes    | BIGINT    | File size              |
| extension     | VARCHAR   | File extension         |
| visibility    | VARCHAR   | "public" or "private"  |
| checksum      | VARCHAR   | SHA256 hash            |
| created_at    | TIMESTAMP | Upload time            |

---

## Development Commands

```bash
# Inside container: docker compose exec rust bash

# Build
cargo build
cargo check                    # Fast type check

# Run
cargo run

# Test
cargo test
cargo test -- --nocapture

# Lint
cargo clippy
cargo fmt

# Migrations
sqlx migrate run
sqlx migrate add <name>
sqlx migrate revert

# SQLx cache (REQUIRED after changing queries)
cargo sqlx prepare
```

---

## Adding New Features

### New API Endpoint
1. Create handler in `app/http/api/controllers/<name>.rs`
2. Add validator in `app/http/api/validators/<name>.rs` (if needed)
3. Register route in `routes/api.rs`
4. Add database queries in `app/db_query/read/` or `mutations/`
5. Publish Kafka event on success
6. Run `cargo sqlx prepare` if queries changed

### New Kafka Event Type
1. Add variant to `EventType` enum in `bootstrap/events/types.rs`
2. Add helper function in `bootstrap/events/mod.rs::publish`
3. Create handler in `bootstrap/events/handlers/` if needed

### New RabbitMQ Job
1. Create `app/mq/jobs/<job_name>/mod.rs` with params struct
2. Create `app/mq/workers/<job_name>/mod.rs` with `process()` fn
3. Add to `app/mq/workers/mod.rs` match statement

### New Database Table
1. Create migration: `sqlx migrate add <name>`
2. Add read queries in `app/db_query/read/<entity>/mod.rs`
3. Add mutations in `app/db_query/mutations/<entity>/mod.rs`
4. Run `cargo sqlx prepare`

### New Cron Job
1. Create job in `app/cron/<job_name>.rs`
2. Register in `routes/crons.rs`

---

## Response Formats

### Success Response
```json
{
    "status": "success",
    "message": "Operation completed"
}
```

### Error Response
```json
{
    "status": "error",
    "message": "Error description"
}
```

### Validation Error
```json
{
    "status": "error",
    "message": "Validation failed",
    "errors": {
        "email": ["Invalid email format"],
        "password": ["Must be at least 8 characters"]
    }
}
```

### Sign In Response
```json
{
    "status": "success",
    "message": "Signed in successfully",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
        "id": 1,
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "balance": 10000
    }
}
```

---

## Template Helper Functions

For use in Tera templates:

```rust
use blazing_sun::bootstrap::utility::template::{assets, asset, private_asset};

// Public file URL: /storage/filename.jpg
let url = assets("filename.jpg", "public");
let url = asset("filename.jpg");  // shorthand

// Private file URL: /api/v1/upload/private/uuid
let url = assets("uuid", "private");
let url = private_asset("uuid");  // shorthand
```

---

## Storage Driver Architecture

The storage system uses a trait-based abstraction for S3 compatibility:

```rust
// StorageDriver trait
pub trait StorageDriver: Send + Sync {
    async fn put(&self, data: &[u8], filename: &str, visibility: Visibility) -> Result<StoredFile, StorageError>;
    async fn get(&self, path: &str) -> Result<Vec<u8>, StorageError>;
    async fn delete(&self, path: &str) -> Result<bool, StorageError>;
    async fn exists(&self, path: &str) -> Result<bool, StorageError>;
    fn url(&self, path: &str, visibility: Visibility) -> String;
}

// Switch drivers via STORAGE_DRIVER env var
// Currently: "local" (default)
// Future: "s3"
```
