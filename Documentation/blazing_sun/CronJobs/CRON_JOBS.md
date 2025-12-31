# Cron Jobs Documentation

This document provides comprehensive documentation for the cron job system in the Blazing Sun application.

---

## Overview

The Blazing Sun application uses `tokio-cron-scheduler` for scheduled task execution. Cron jobs run periodically in the background to perform maintenance, reporting, and cleanup tasks.

**File Locations:**
- Cron Controller: `bootstrap/routes/controller/crons.rs`
- Job Implementations: `app/cron/`
- Job Registration: `routes/crons.rs`
- Cron Config: `config/cron.rs`

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Cron Job System                                    │
└────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                           Application Startup                              │
│                                                                            │
│   main.rs ──▶ crons::init(db) ──▶ routes/crons.rs::register()             │
│                                         │                                  │
│                     ┌───────────────────┼───────────────────┐             │
│                     │                   │                   │             │
│                     ▼                   ▼                   ▼             │
│              ┌────────────┐      ┌────────────┐      ┌────────────┐       │
│              │ user_counter│     │list_user_  │      │ Your Job   │       │
│              │ (every 5m)  │     │emails (1h) │      │ (schedule) │       │
│              └─────┬───────┘     └─────┬──────┘      └─────┬──────┘       │
│                    │                   │                   │              │
│                    └───────────────────┼───────────────────┘              │
│                                        ▼                                   │
│                              ┌──────────────────┐                         │
│                              │  JobScheduler    │                         │
│                              │  (Background)    │                         │
│                              └──────────────────┘                         │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Cron Expression Format

The system uses 6-field cron expressions:

```
┌───────────── second (0-59)
│ ┌───────────── minute (0-59)
│ │ ┌───────────── hour (0-23)
│ │ │ ┌───────────── day of month (1-31)
│ │ │ │ ┌───────────── month (1-12)
│ │ │ │ │ ┌───────────── day of week (0-6, 0=Sunday)
│ │ │ │ │ │
* * * * * *
```

### Common Patterns

| Expression | Description |
|------------|-------------|
| `0 * * * * *` | Every minute |
| `0 */5 * * * *` | Every 5 minutes |
| `0 0 * * * *` | Every hour |
| `0 0 0 * * *` | Daily at midnight |
| `0 0 0 * * 0` | Weekly (Sunday midnight) |
| `0 0 0 1 * *` | Monthly (1st at midnight) |
| `0 30 9 * * 1-5` | Weekdays at 9:30 AM |

---

## Schedule Builder

The `Schedule` struct provides a fluent API for creating cron jobs:

### Creating Jobs

```rust
// bootstrap/routes/controller/crons.rs

pub struct Schedule {
    name: String,
    cron_expression: Option<String>,
    job_fn: CronJobFn,
}

impl Schedule {
    /// Create a new schedule with a job function
    pub fn job<F, Fut>(name: &str, f: F) -> Self
    where
        F: Fn(Pool<Postgres>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = ()> + Send + 'static,
    {
        Schedule {
            name: name.to_string(),
            cron_expression: None,
            job_fn: Arc::new(move |db| Box::pin(f(db))),
        }
    }
}
```

### Schedule Methods

```rust
impl Schedule {
    /// Set raw cron expression
    pub fn cron(mut self, expression: &str) -> Self

    /// Run daily at specific time (HH:MM)
    pub fn daily_at(mut self, time: &str) -> Self

    /// Run hourly at specific minute (MM)
    pub fn hourly_at(mut self, minute: &str) -> Self

    /// Run monthly at specific day (DD)
    pub fn monthly_at(mut self, day: &str) -> Self

    /// Run every N minutes
    pub fn every_minutes(mut self, minutes: u32) -> Self

    /// Run every N hours
    pub fn every_hours(mut self, hours: u32) -> Self

    /// Register with scheduler
    pub async fn register(self, scheduler: &JobScheduler, db: Pool<Postgres>) -> Result<(), ...>
}
```

---

## Pre-defined Schedule Constants

```rust
// bootstrap/routes/controller/crons.rs::schedules

pub mod schedules {
    /// Every minute: "0 * * * * *"
    pub const EVERY_MINUTE: &str = "0 * * * * *";

    /// Every 2 minutes: "0 */2 * * * *"
    pub const EVERY_TWO_MINUTES: &str = "0 */2 * * * *";

    /// Every 5 minutes: "0 */5 * * * *"
    pub const EVERY_FIVE_MINUTES: &str = "0 */5 * * * *";

    /// Every 10 minutes: "0 */10 * * * *"
    pub const EVERY_TEN_MINUTES: &str = "0 */10 * * * *";

    /// Every 15 minutes: "0 */15 * * * *"
    pub const EVERY_FIFTEEN_MINUTES: &str = "0 */15 * * * *";

    /// Every 30 minutes: "0 */30 * * * *"
    pub const EVERY_THIRTY_MINUTES: &str = "0 */30 * * * *";

    /// Every hour: "0 0 * * * *"
    pub const HOURLY: &str = "0 0 * * * *";

    /// Every 4 hours: "0 0 */4 * * *"
    pub const EVERY_FOUR_HOURS: &str = "0 0 */4 * * *";

    /// Daily at midnight: "0 0 0 * * *"
    pub const DAILY: &str = "0 0 0 * * *";

    /// Weekly (Sunday midnight): "0 0 0 * * 0"
    pub const WEEKLY: &str = "0 0 0 * * 0";

    /// Monthly (1st at midnight): "0 0 0 1 * *"
    pub const MONTHLY: &str = "0 0 0 1 * *";
}
```

---

## Existing Jobs

### user_counter

Counts total users in the database and logs the count.

**File:** `app/cron/user_counter.rs`

```rust
//! User Counter Cron Job
//!
//! Counts total users in the database.

use crate::database::read::user;
use sqlx::{Pool, Postgres};
use tracing::info;

/// Run the user counter job
pub async fn run(db: Pool<Postgres>) {
    let count = user::count(&db).await;
    info!("User count: {}", count);
}
```

**Schedule:** Every 5 minutes

### list_user_emails

Lists all user emails in the system.

**File:** `app/cron/list_user_emails.rs`

```rust
//! List User Emails Cron Job

use crate::database::read::user;
use sqlx::{Pool, Postgres};
use tracing::info;

pub async fn run(db: Pool<Postgres>) {
    let users = user::get_all(&db).await;
    for user in users {
        info!("User email: {}", user.email);
    }
}
```

**Schedule:** Hourly

---

## Registering Jobs

Jobs are registered in `routes/crons.rs`:

```rust
// routes/crons.rs

use crate::app::cron::{user_counter, list_user_emails};
use crate::bootstrap::routes::controller::crons::{Schedule, schedules};
use sqlx::{Pool, Postgres};
use tokio_cron_scheduler::JobScheduler;

pub async fn register(scheduler: &JobScheduler, db: Pool<Postgres>) {
    // User counter - every 5 minutes
    Schedule::job("user_counter", user_counter::run)
        .every_minutes(5)
        .register(scheduler, db.clone())
        .await
        .expect("Failed to register user_counter job");

    // List user emails - hourly
    Schedule::job("list_user_emails", list_user_emails::run)
        .cron(schedules::HOURLY)
        .register(scheduler, db.clone())
        .await
        .expect("Failed to register list_user_emails job");
}
```

---

## Creating a New Cron Job

### Step 1: Create Job Module

Create `app/cron/my_job.rs`:

```rust
//! My Custom Cron Job
//!
//! Description of what this job does.

use sqlx::{Pool, Postgres};
use tracing::{info, error};

/// Run the job
pub async fn run(db: Pool<Postgres>) {
    info!("Starting my_job...");

    // Your job logic here
    match do_something(&db).await {
        Ok(_) => info!("my_job completed successfully"),
        Err(e) => error!("my_job failed: {}", e),
    }
}

async fn do_something(db: &Pool<Postgres>) -> Result<(), Box<dyn std::error::Error>> {
    // Database operations, cleanup, reporting, etc.
    Ok(())
}
```

### Step 2: Export Job Module

In `app/cron/mod.rs`:

```rust
//! Cron Job Functions
//!
//! This module contains all cron job implementations.

pub mod list_user_emails;
pub mod user_counter;
pub mod my_job;  // Add this line
```

### Step 3: Register Job

In `routes/crons.rs`:

```rust
use crate::app::cron::{user_counter, list_user_emails, my_job};
use crate::bootstrap::routes::controller::crons::{Schedule, schedules};

pub async fn register(scheduler: &JobScheduler, db: Pool<Postgres>) {
    // Existing jobs...

    // My new job - daily at 3:00 AM
    Schedule::job("my_job", my_job::run)
        .daily_at("03:00")
        .register(scheduler, db.clone())
        .await
        .expect("Failed to register my_job");
}
```

---

## Schedule Examples

### Using Builder Methods

```rust
// Every 5 minutes
Schedule::job("quick_check", quick_check::run)
    .every_minutes(5)
    .register(scheduler, db.clone()).await?;

// Every 4 hours
Schedule::job("sync_data", sync_data::run)
    .every_hours(4)
    .register(scheduler, db.clone()).await?;

// Daily at 3:00 AM
Schedule::job("daily_cleanup", cleanup::run)
    .daily_at("03:00")
    .register(scheduler, db.clone()).await?;

// Hourly at :30
Schedule::job("hourly_report", report::run)
    .hourly_at("30")
    .register(scheduler, db.clone()).await?;

// Monthly on the 1st
Schedule::job("monthly_summary", summary::run)
    .monthly_at("1")
    .register(scheduler, db.clone()).await?;
```

### Using Raw Cron Expressions

```rust
// Every weekday at 9:00 AM
Schedule::job("weekday_job", weekday::run)
    .cron("0 0 9 * * 1-5")
    .register(scheduler, db.clone()).await?;

// Every Sunday at midnight
Schedule::job("weekly_cleanup", weekly_cleanup::run)
    .cron("0 0 0 * * 0")
    .register(scheduler, db.clone()).await?;

// First day of quarter at noon
Schedule::job("quarterly_report", quarterly::run)
    .cron("0 0 12 1 1,4,7,10 *")
    .register(scheduler, db.clone()).await?;
```

### Using Constants

```rust
use crate::bootstrap::routes::controller::crons::schedules;

// Every minute
Schedule::job("health_check", health::run)
    .cron(schedules::EVERY_MINUTE)
    .register(scheduler, db.clone()).await?;

// Daily
Schedule::job("daily_digest", digest::run)
    .cron(schedules::DAILY)
    .register(scheduler, db.clone()).await?;

// Monthly
Schedule::job("monthly_archive", archive::run)
    .cron(schedules::MONTHLY)
    .register(scheduler, db.clone()).await?;
```

---

## Initialization Flow

### In main.rs

```rust
use crate::bootstrap::routes::controller::crons;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize tracing
    tracing_logger::init();

    // Create database pool
    let pool = create_pool().await;

    // Initialize cron scheduler
    let scheduler = crons::init(pool.clone()).await
        .expect("Failed to initialize cron scheduler");

    // Keep scheduler reference alive
    let _scheduler = scheduler;

    // Start HTTP server...
    HttpServer::new(...)
}
```

### Cron Controller Init

```rust
// bootstrap/routes/controller/crons.rs

pub async fn init(db: Pool<Postgres>) -> Result<JobScheduler, Box<dyn std::error::Error>> {
    info!("Initializing cron scheduler...");

    let scheduler = JobScheduler::new().await?;

    // Register all cron schedules from routes/crons.rs
    cron_routes::register(&scheduler, db).await;

    // Start the scheduler
    scheduler.start().await?;

    info!("Cron scheduler started successfully");

    Ok(scheduler)
}
```

---

## Job Best Practices

### 1. Always Use Logging

```rust
pub async fn run(db: Pool<Postgres>) {
    info!("Job starting...");

    // ... job logic ...

    match result {
        Ok(_) => info!("Job completed successfully"),
        Err(e) => error!("Job failed: {}", e),
    }
}
```

### 2. Handle Errors Gracefully

```rust
pub async fn run(db: Pool<Postgres>) {
    if let Err(e) = perform_task(&db).await {
        error!("Task failed: {}", e);
        // Don't panic - let the job retry next time
    }
}
```

### 3. Keep Jobs Idempotent

```rust
// Good: Idempotent - safe to run multiple times
pub async fn cleanup_expired(db: Pool<Postgres>) {
    let result = sqlx::query!(
        "DELETE FROM sessions WHERE expires_at < NOW()"
    )
    .execute(&db)
    .await;

    if let Ok(r) = result {
        info!("Cleaned up {} expired sessions", r.rows_affected());
    }
}

// Bad: Not idempotent - may duplicate data
pub async fn generate_report(db: Pool<Postgres>) {
    // This will create duplicates if run twice
    sqlx::query!("INSERT INTO reports (date) VALUES (NOW())")
        .execute(&db)
        .await;
}
```

### 4. Consider Execution Time

```rust
// For long-running jobs, add checkpoints
pub async fn process_large_batch(db: Pool<Postgres>) {
    let batch_size = 1000;
    let mut offset = 0;

    loop {
        let items = fetch_batch(&db, batch_size, offset).await;
        if items.is_empty() {
            break;
        }

        process_items(&items).await;
        offset += batch_size;

        // Log progress
        info!("Processed {} items", offset);
    }
}
```

### 5. Use Appropriate Schedules

| Task Type | Recommended Schedule |
|-----------|---------------------|
| Health checks | Every 1-5 minutes |
| Cache refresh | Every 5-15 minutes |
| Data sync | Every 15-60 minutes |
| Cleanup | Daily |
| Reports | Daily or weekly |
| Archives | Weekly or monthly |

---

## Common Job Patterns

### Cleanup Job

```rust
pub async fn cleanup_old_data(db: Pool<Postgres>) {
    info!("Starting cleanup job...");

    // Delete old sessions
    let sessions = sqlx::query!(
        "DELETE FROM sessions WHERE created_at < NOW() - INTERVAL '30 days'"
    )
    .execute(&db)
    .await;

    // Delete old activation hashes
    let hashes = sqlx::query!(
        "DELETE FROM activation_hashes WHERE expires_at < NOW()"
    )
    .execute(&db)
    .await;

    info!(
        "Cleanup completed: {} sessions, {} hashes deleted",
        sessions.map(|r| r.rows_affected()).unwrap_or(0),
        hashes.map(|r| r.rows_affected()).unwrap_or(0)
    );
}
```

### Sync Job

```rust
pub async fn sync_external_data(db: Pool<Postgres>) {
    info!("Starting sync job...");

    // Fetch from external API
    let data = match fetch_external_data().await {
        Ok(d) => d,
        Err(e) => {
            error!("Failed to fetch external data: {}", e);
            return;
        }
    };

    // Update database
    for item in data {
        if let Err(e) = upsert_item(&db, &item).await {
            error!("Failed to sync item {}: {}", item.id, e);
        }
    }

    info!("Sync completed: {} items processed", data.len());
}
```

### Report Job

```rust
pub async fn generate_daily_report(db: Pool<Postgres>) {
    info!("Generating daily report...");

    let stats = sqlx::query!(
        r#"
        SELECT
            COUNT(*) as total_users,
            COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as new_users,
            SUM(balance) as total_balance
        FROM users
        "#
    )
    .fetch_one(&db)
    .await;

    if let Ok(s) = stats {
        info!(
            "Daily Report: {} total users, {} new users, total balance: {}",
            s.total_users, s.new_users, s.total_balance
        );
    }
}
```

---

## Monitoring

### Check Logs

```bash
# View cron job logs
docker compose logs rust | grep -i "cron\|job"

# Watch for specific job
docker compose logs -f rust 2>&1 | grep "user_counter"
```

### Verify Jobs Running

Jobs log their start and completion:

```
INFO cron job 'user_counter' starting...
INFO User count: 42
INFO cron job 'user_counter' completed
```

---

## Related Documentation

- [Bootstrap Documentation](../Bootstrap/BOOTSTRAP.md) - Core framework
- [Database Documentation](../Database/DATABASE.md) - Database queries in jobs
- [API Routes](../Routes/Api/API_ROUTES.md) - Related API endpoints
