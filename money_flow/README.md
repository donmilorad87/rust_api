# Money Flow Application

A Rust web application for personal finance tracking built with Actix-web and PostgreSQL.

## Tech Stack

| Category       | Technology                                      |
|----------------|------------------------------------------------|
| Framework      | Actix-web 4                                    |
| Database       | PostgreSQL + SQLx (compile-time checked queries)|
| Cache/Queue    | Redis                                          |
| Templates      | Tera (Laravel Blade-like syntax)               |
| Email          | Lettre (SMTP)                                  |
| Auth           | JWT (jsonwebtoken)                             |
| Validation     | validator crate                                |
| Logging        | tracing + tracing-subscriber                   |
| Cron           | tokio-cron-scheduler                           |
| Async Runtime  | Tokio                                          |

---

## Folder Structure

```
money_flow/
├── Cargo.toml                      # Dependencies and project config
├── Cargo.lock                      # Locked dependency versions
├── .env                            # App environment variables
├── .env.example                    # Example env file
│
├── migrations/                     # SQLx database migrations
│   ├── 20251217202253_create_users_table.sql
│   ├── 20251217203606_create_categories_table.sql
│   └── 20251217204134_create_transactions_table.sql
│
├── .sqlx/                          # Cached query metadata (commit to git)
│
├── tests/                          # Integration tests
│
└── src/
    ├── main.rs                     # Entry point - server startup
    ├── lib.rs                      # Module exports
    │
    ├── config/                     # Static configuration (env vars)
    │   ├── mod.rs
    │   ├── app.rs                  # HOST, PORT, RUST_LOG
    │   ├── database.rs             # DATABASE_URL, max_connections
    │   ├── jwt.rs                  # JWT_SECRET, EXPIRATION_TIME
    │   ├── redis.rs                # REDIS_URL and related
    │   ├── cron.rs                 # Cron job schedules
    │   └── email.rs                # SMTP/Mailtrap settings
    │
    ├── db/                         # Database layer
    │   ├── mod.rs                  # AppState, DynMq type
    │   ├── read/                   # SELECT queries
    │   │   ├── mod.rs
    │   │   └── user/
    │   │       └── mod.rs          # User read operations
    │   └── mutations/              # INSERT/UPDATE/DELETE queries
    │       ├── mod.rs
    │       └── user/
    │           └── mod.rs          # User write operations
    │
    ├── middleware/                 # HTTP middleware
    │   ├── mod.rs
    │   └── controllers/
    │       ├── mod.rs
    │       ├── auth.rs             # JWT authentication middleware
    │       ├── cors.rs             # CORS configuration
    │       ├── json_error.rs       # JSON error handler
    │       ├── security_headers.rs # Security headers (Helmet-like)
    │       └── tracing_logger.rs   # Request logging
    │
    ├── modules/                    # Feature modules
    │   ├── mod.rs
    │   └── routes/                 # HTTP routes
    │       ├── mod.rs              # Route configuration
    │       ├── controllers/
    │       │   ├── mod.rs
    │       │   ├── auth.rs         # POST /auth/sign-up, /auth/sign-in
    │       │   └── me.rs           # GET/POST /me (profile)
    │       └── validators/
    │           ├── mod.rs
    │           └── auth.rs         # Request validation
    │
    ├── mq/                         # Message Queue (Redis-based)
    │   ├── mod.rs                  # Queue manager, priority, fault tolerance
    │   ├── jobs/                   # Job definitions (what to do)
    │   │   ├── mod.rs
    │   │   ├── create_user/
    │   │   │   └── mod.rs          # User creation job
    │   │   └── email/
    │   │       └── mod.rs          # Email sending job + Tera templates
    │   └── workers/                # Job processors (how to do it)
    │       ├── mod.rs              # Worker router
    │       ├── create_user/
    │       │   └── mod.rs          # Processes create_user jobs
    │       └── email/
    │           └── mod.rs          # Processes send_email jobs
    │
    ├── crons/                      # Scheduled tasks
    │   ├── mod.rs                  # Cron scheduler init
    │   └── user_counter/
    │       ├── mod.rs              # Job registration
    │       └── controller/
    │           ├── mod.rs
    │           └── user_counter.rs # Count users task
    │
    └── resources/                  # Static resources
        ├── js/
        ├── css/
        └── views/
            └── emails/             # Email templates (Tera)
                ├── base.html       # Base layout
                └── welcome.html    # Welcome email template
```

---

## Architecture

### Request Flow

```
Client → Nginx (SSL) → Actix-web → Middleware → Routes → DB/MQ
```

1. **Nginx** terminates SSL and proxies to the Rust app
2. **Middleware** applies security headers, CORS, logging, auth
3. **Routes** handle HTTP endpoints
4. **DB layer** executes queries (read/mutations separation)
5. **MQ** handles async jobs (emails, user creation)

### Module Overview

| Module       | Purpose                                           |
|--------------|---------------------------------------------------|
| `config/`    | Environment variables as static configs           |
| `db/`        | Database operations (read/mutations separation)   |
| `middleware/`| HTTP middleware (auth, cors, security, logging)   |
| `modules/`   | Feature modules with routes and validators        |
| `mq/`        | Message queue with jobs and workers               |
| `crons/`     | Scheduled background tasks                        |
| `resources/` | Static files and email templates                  |

---

## Configuration

All config is loaded from environment variables using `once_cell::Lazy`:

```rust
// Access config anywhere in the app
let host = AppConfig::host();
let jwt_secret = JwtConfig::secret();
let smtp_host = EmailConfig::host();
let redis_url = RedisConfig::url();
```

### Environment Variables

```env
# App
HOST=0.0.0.0
PORT=9999
RUST_LOG=debug

# Database
DATABASE_URL=postgres://user:pass@host:5432/db

# JWT
JWT_SECRET=your_secret
EXPIRATION_TIME=60

# Redis
REDIS_URL=redis://user:pass@host:6379/0

# Email (SMTP)
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=user
MAIL_PASSWORD=pass
MAIL_FROM_ADDRESS=noreply@example.com
MAIL_FROM_NAME=MoneyFlow

# Cron
USER_COUNTER=0 * * * * *
```

---

## Database Layer

Separated into **read** (SELECT) and **mutations** (INSERT/UPDATE/DELETE):

```rust
// Read operations
use crate::db::read::user;
let exists = user::has_with_email(&db, "test@example.com").await;
let count = user::count(&db).await;

// Mutation operations
use crate::db::mutations::user;
user::create(&db, &params).await;
```

### Schema

| Table        | Description                    |
|--------------|--------------------------------|
| users        | User accounts with balance     |
| categories   | User spending categories       |
| transactions | Income/expense records         |

Money is stored as `BIGINT` (cents) for precision.

---

## Message Queue

Redis-based queue with priority and fault tolerance:

```rust
// Queue a job
let options = JobOptions::new()
    .priority(2)           // 0=FIFO, 1=Low, 2=Normal, 3=Medium, 4=High, 5=Critical
    .fault_tolerance(3);   // Retry 3 times on failure

mq::enqueue_job_dyn(&mq, "send_email", &params, options).await;

// Queue and wait for completion
mq::enqueue_and_wait_dyn(&mq, "create_user", &params, options, 30000).await;
```

### Creating a New Job

1. Create job in `mq/jobs/your_job/mod.rs`:
```rust
#[derive(Serialize, Deserialize)]
pub struct YourJobParams {
    pub field: String,
}

pub async fn execute(db: &Pool<Postgres>, params: &YourJobParams) -> Result<bool, String> {
    // Job logic here
    Ok(true)
}
```

2. Create worker in `mq/workers/your_job/mod.rs`:
```rust
pub async fn process(mq: &MessageQueue, job: &QueuedJob) -> Result<JobResult<()>, ...> {
    let params: YourJobParams = serde_json::from_str(&job.payload)?;
    match your_job::execute(mq.db(), &params).await {
        Ok(true) => Ok(JobResult::Success(())),
        Ok(false) => Ok(JobResult::Retry("reason".to_string())),
        Err(e) => Ok(JobResult::Failed(e)),
    }
}
```

3. Register in `mq/workers/mod.rs`:
```rust
match job.worker_name.as_str() {
    "your_job" => your_job::process(mq, job).await,
    // ...
}
```

---

## Email System

Uses **Tera** templating engine (Laravel Blade-like syntax).

### Template Syntax

```html
{% extends "base.html" %}

{% block title %}Page Title{% endblock %}

{% block content %}
<h1>Hello, {{ first_name }}!</h1>

{% if show_button %}
    <a href="{{ link }}" class="button">Click Here</a>
{% endif %}

{% for item in items %}
    <li>{{ item.name }} - {{ item.price | round }}</li>
{% endfor %}
{% endblock %}
```

### Sending Email

```rust
use crate::mq::jobs::email::{EmailTemplate, SendEmailParams};

let params = SendEmailParams::new(&email, &name, EmailTemplate::Welcome)
    .with_variable("first_name", "John")
    .with_variable("email", "john@example.com");

let options = JobOptions::new().priority(1).fault_tolerance(3);
mq::enqueue_job_dyn(&mq, "send_email", &params, options).await;
```

### Adding New Email Template

1. Create template in `resources/views/emails/your_template.html`
2. Add variant to `EmailTemplate` enum in `mq/jobs/email/mod.rs`
3. Implement `template_path()` and `subject()` for the variant

---

## API Endpoints

| Method | Endpoint        | Description          | Auth |
|--------|-----------------|----------------------|------|
| POST   | /auth/sign-up   | Register new user    | No   |
| POST   | /auth/sign-in   | Login, get JWT       | No   |
| GET    | /me             | Get user profile     | Yes  |
| POST   | /me             | Update profile       | Yes  |

### Authentication

JWT-based authentication. Include token in header:
```
Authorization: Bearer <token>
```

---

## Cron Jobs

Scheduled tasks using `tokio-cron-scheduler`:

```rust
// In crons/your_job/mod.rs
pub async fn init(scheduler: &JobScheduler, db: Pool<Postgres>) -> Result<(), ...> {
    let cron_expression = "0 * * * * *"; // Every minute

    let job = Job::new_async(cron_expression, move |_uuid, _lock| {
        let db = db.clone();
        Box::pin(async move {
            // Your task logic
        })
    })?;

    scheduler.add(job).await?;
    Ok(())
}
```

---

## Development Commands

```bash
# Build
cargo build
cargo check

# Run tests
cargo test
cargo test -- --nocapture

# Linting
cargo clippy
cargo fmt

# Migrations
sqlx migrate run
sqlx migrate add <name>
sqlx migrate revert

# Regenerate SQLx query cache
cargo sqlx prepare
```

---

## SQLx Offline Mode

SQLx verifies SQL queries at compile time. For CI/CD builds without database:

1. `SQLX_OFFLINE=true` in `.env` enables offline mode
2. `.sqlx/` directory contains cached query metadata
3. Run `cargo sqlx prepare` after changing queries
4. **Commit `.sqlx/` to git** for builds without database
