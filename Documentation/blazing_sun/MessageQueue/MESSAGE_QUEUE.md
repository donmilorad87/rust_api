# RabbitMQ Message Queue Documentation

This document provides comprehensive documentation for the RabbitMQ message queue system in the Blazing Sun application.

---

## Overview

The Blazing Sun application uses RabbitMQ for asynchronous task processing. It's designed for reliable, background job execution with priority support and automatic retries.

**File Locations:**
- MQ Core: `bootstrap/mq/controller/mq.rs`
- Job Definitions: `app/mq/jobs/`
- Job Workers: `app/mq/workers/`
- MQ Config: `config/rabbitmq.rs`

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        RabbitMQ Message Queue Flow                          │
└────────────────────────────────────────────────────────────────────────────┘

┌───────────────┐     ┌───────────────────────────────────────────┐
│   Controller  │────▶│              RabbitMQ Server              │
│  (Enqueue)    │     │  ┌─────────────────┐ ┌─────────────────┐  │
└───────────────┘     │  │   jobs (main)   │ │  jobs_failed    │  │
                      │  │  Priority Queue │ │  (Dead Letter)  │  │
                      │  └────────┬────────┘ └─────────────────┘  │
                      └───────────┼───────────────────────────────┘
                                  │
                      ┌───────────┼───────────┐
                      ▼           ▼           ▼
               ┌──────────┐ ┌──────────┐ ┌──────────┐
               │ Worker 0 │ │ Worker 1 │ │ Worker N │
               │          │ │          │ │          │
               │ Process  │ │ Process  │ │ Process  │
               │   Jobs   │ │   Jobs   │ │   Jobs   │
               └──────────┘ └──────────┘ └──────────┘
```

### Queues

| Queue | Purpose | Features |
|-------|---------|----------|
| `jobs` | Main job queue | Priority 0-10, durable, persistent |
| `jobs_failed` | Dead letter queue | Failed jobs after max retries |

---

## Configuration

### Environment Variables

```env
# RabbitMQ Configuration
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=app
RABBITMQ_PASSWORD=rabbitmq_secret_password
RABBITMQ_VHOST=/
```

### RabbitMQConfig (`config/rabbitmq.rs`)

```rust
use once_cell::sync::Lazy;

pub struct RabbitMQConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub vhost: String,
    pub url: String,
}

pub static RABBITMQ: Lazy<RabbitMQConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    let host = std::env::var("RABBITMQ_HOST").unwrap_or_else(|_| "rabbitmq".to_string());
    let port: u16 = std::env::var("RABBITMQ_PORT")
        .unwrap_or_else(|_| "5672".to_string())
        .parse()
        .expect("RABBITMQ_PORT must be a number");
    let user = std::env::var("RABBITMQ_USER").unwrap_or_else(|_| "app".to_string());
    let password = std::env::var("RABBITMQ_PASSWORD").unwrap_or_else(|_| "".to_string());
    let vhost = std::env::var("RABBITMQ_VHOST").unwrap_or_else(|_| "/".to_string());

    let url = format!("amqp://{}:{}@{}:{}/{}", user, password, host, port, vhost);

    RabbitMQConfig { host, port, user, password, vhost, url }
});

impl RabbitMQConfig {
    pub fn url() -> &'static str { &RABBITMQ.url }
}
```

---

## Priority Levels

The message queue supports 6 priority levels:

| Level | Name | Value | Use Case |
|-------|------|-------|----------|
| 0 | FIFO | 0 | Default, processed in order |
| 1 | Low | 1 | Non-urgent tasks (welcome emails) |
| 2 | Normal | 2 | Standard tasks |
| 3 | Medium | 3 | Important tasks |
| 4 | High | 4 | Time-sensitive operations |
| 5 | Critical | 5 | Must process immediately |

### Priority Enum

```rust
// bootstrap/mq/controller/mq.rs

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum Priority {
    Fifo = 0,
    Low = 1,
    Normal = 2,
    Medium = 3,
    High = 4,
    Critical = 5,
}

impl Default for Priority {
    fn default() -> Self {
        Priority::Fifo
    }
}

impl From<u8> for Priority {
    fn from(value: u8) -> Self {
        match value {
            0 => Priority::Fifo,
            1 => Priority::Low,
            2 => Priority::Normal,
            3 => Priority::Medium,
            4 => Priority::High,
            5 => Priority::Critical,
            _ => Priority::Fifo,
        }
    }
}
```

---

## Job Options

### JobOptions Struct

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobOptions {
    pub priority: Priority,      // Job priority level
    pub fault_tolerance: u32,    // Number of retries before failure
    pub delay_ms: Option<u64>,   // Optional delay before processing
}

impl Default for JobOptions {
    fn default() -> Self {
        Self {
            priority: Priority::Fifo,
            fault_tolerance: 3,  // Default 3 retries
            delay_ms: None,
        }
    }
}
```

### Builder Pattern

```rust
let options = JobOptions::new()
    .priority(4)         // High priority
    .fault_tolerance(5)  // 5 retries
    .delay(1000);        // 1 second delay
```

---

## Job Status

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobStatus {
    Pending,     // Waiting in queue
    Processing,  // Currently being processed
    Completed,   // Successfully completed
    Failed,      // Failed after all retries
    Retrying,    // Scheduled for retry
}
```

---

## QueuedJob Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedJob {
    pub id: String,           // UUID v4
    pub worker_name: String,  // Worker to process this job
    pub payload: String,      // JSON serialized parameters
    pub options: JobOptions,  // Priority, retries, delay
    pub status: JobStatus,    // Current status
    pub attempts: u32,        // Number of attempts made
    pub created_at: i64,      // Unix timestamp (ms)
    pub updated_at: i64,      // Last update timestamp
}

impl QueuedJob {
    pub fn new(worker_name: &str, payload: String, options: JobOptions) -> Self {
        let now = chrono::Utc::now().timestamp_millis();
        Self {
            id: Uuid::new_v4().to_string(),
            worker_name: worker_name.to_string(),
            payload,
            options,
            status: JobStatus::Pending,
            attempts: 0,
            created_at: now,
            updated_at: now,
        }
    }
}
```

---

## MessageQueue Manager

### Initialization

```rust
// bootstrap/mq/controller/mq.rs

pub struct MessageQueue {
    channel: Channel,
    db: Pool<Postgres>,
}

impl MessageQueue {
    pub async fn new(db: Pool<Postgres>) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let url = RabbitMQConfig::url();
        info!("Connecting to RabbitMQ at {}", url);

        let conn = Connection::connect(url, ConnectionProperties::default()).await?;
        let channel = conn.create_channel().await?;

        // Declare main queue with priority support (max priority 10)
        let mut args = FieldTable::default();
        args.insert("x-max-priority".into(), 10i32.into());

        channel.queue_declare(
            "jobs",
            QueueDeclareOptions { durable: true, ..Default::default() },
            args,
        ).await?;

        // Declare failed queue
        channel.queue_declare(
            "jobs_failed",
            QueueDeclareOptions { durable: true, ..Default::default() },
            FieldTable::default(),
        ).await?;

        Ok(Self { channel, db })
    }
}
```

### Core Methods

```rust
impl MessageQueue {
    /// Enqueue a job
    pub async fn enqueue(&self, job: QueuedJob) -> Result<String, ...>

    /// Acknowledge a message
    pub async fn ack(&self, delivery_tag: u64) -> Result<(), ...>

    /// Reject a message (requeue or dead-letter)
    pub async fn nack(&self, delivery_tag: u64, requeue: bool) -> Result<(), ...>

    /// Move job to failed queue
    pub async fn move_to_failed(&self, job: &QueuedJob, error: &str) -> Result<(), ...>

    /// Retry a failed job
    pub async fn retry(&self, job: QueuedJob, error: &str) -> Result<bool, ...>

    /// Get database pool reference
    pub fn db(&self) -> &Pool<Postgres>

    /// Get channel for advanced operations
    pub fn channel(&self) -> &Channel
}
```

---

## Enqueuing Jobs

### Method 1: Fire and Forget

```rust
use crate::bootstrap::mq::{enqueue_job_dyn, JobOptions};
use crate::app::mq::jobs::email::SendEmailParams;

let params = SendEmailParams {
    to_email: "user@example.com".to_string(),
    to_name: "John Doe".to_string(),
    template: EmailTemplate::Welcome,
    variables: HashMap::new(),
};

let options = JobOptions::new()
    .priority(2)
    .fault_tolerance(3);

// Returns immediately, job processed in background
let job_id = enqueue_job_dyn(&mq, "send_email", &params, options).await?;
```

### Method 2: Wait for Completion

```rust
use crate::bootstrap::mq::{enqueue_and_wait_dyn, JobOptions, JobStatus};

let options = JobOptions::new()
    .priority(4)
    .fault_tolerance(3);

// Blocks until job completes or times out
let status = enqueue_and_wait_dyn(
    &mq,
    "create_user",
    &params,
    options,
    30000  // 30 second timeout
).await?;

match status {
    JobStatus::Completed => println!("Job completed successfully"),
    JobStatus::Failed => println!("Job failed after retries"),
    JobStatus::Retrying => println!("Job scheduled for retry"),
    _ => println!("Unexpected status"),
}
```

### Helper Functions

```rust
// For SharedQueue type
pub async fn enqueue_job<T: Serialize>(
    queue: &SharedQueue,
    worker_name: &str,
    params: &T,
    options: JobOptions,
) -> Result<String, ...>

// For DynMq type (used in routes)
pub async fn enqueue_job_dyn<T: Serialize>(
    queue: &DynMq,
    worker_name: &str,
    params: &T,
    options: JobOptions,
) -> Result<String, ...>

// Enqueue and wait for completion
pub async fn enqueue_and_wait_dyn<T: Serialize>(
    queue: &DynMq,
    worker_name: &str,
    params: &T,
    options: JobOptions,
    timeout_ms: u64,
) -> Result<JobStatus, ...>
```

---

## Creating Workers

### Step 1: Define Job Parameters

Create `app/mq/jobs/my_job/mod.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MyJobParams {
    pub user_id: i64,
    pub action: String,
    pub data: Option<String>,
}
```

### Step 2: Create Worker

Create `app/mq/workers/my_job/mod.rs`:

```rust
use crate::bootstrap::mq::{JobResult, MessageQueue};
use crate::app::mq::jobs::my_job::MyJobParams;
use tracing::{info, error};

pub async fn process(
    mq: &MessageQueue,
    params: &MyJobParams,
) -> Result<JobResult<()>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Processing my_job for user {}", params.user_id);

    // Get database connection
    let db = mq.db();

    // Your job logic here
    match do_something(db, params).await {
        Ok(_) => {
            info!("my_job completed successfully");
            Ok(JobResult::Success(()))
        }
        Err(e) if is_retryable(&e) => {
            Ok(JobResult::Retry(format!("Retryable error: {}", e)))
        }
        Err(e) => {
            error!("my_job failed: {}", e);
            Ok(JobResult::Failed(format!("Fatal error: {}", e)))
        }
    }
}

fn is_retryable(error: &str) -> bool {
    error.contains("timeout") || error.contains("connection")
}
```

### Step 3: Register Worker

In `app/mq/workers/mod.rs`:

```rust
pub mod my_job;
// ... other workers

use crate::bootstrap::mq::{JobResult, MessageQueue, QueuedJob};

pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<()>, Box<dyn std::error::Error + Send + Sync>> {
    match job.worker_name.as_str() {
        "send_email" => {
            let params: SendEmailParams = serde_json::from_str(&job.payload)?;
            email::process(&params).await
        }
        "create_user" => {
            let params: CreateUserParams = serde_json::from_str(&job.payload)?;
            create_user::process(mq, &params).await
        }
        "my_job" => {  // Add new worker
            let params: MyJobParams = serde_json::from_str(&job.payload)?;
            my_job::process(mq, &params).await
        }
        _ => {
            error!("Unknown worker: {}", job.worker_name);
            Ok(JobResult::Failed(format!("Unknown worker: {}", job.worker_name)))
        }
    }
}
```

### Step 4: Export Job Module

In `app/mq/jobs/mod.rs`:

```rust
pub mod email;
pub mod create_user;
pub mod my_job;  // Add export
```

---

## Existing Jobs

### send_email

Sends emails via SMTP with Tera templates.

**Parameters:**
```rust
pub struct SendEmailParams {
    pub to_email: String,
    pub to_name: String,
    pub template: EmailTemplate,
    pub variables: HashMap<String, String>,
}
```

**Usage:**
```rust
let params = SendEmailParams {
    to_email: "user@example.com".to_string(),
    to_name: "John".to_string(),
    template: EmailTemplate::Welcome,
    variables: {
        let mut vars = HashMap::new();
        vars.insert("first_name".to_string(), "John".to_string());
        vars
    },
};

enqueue_job_dyn(&mq, "send_email", &params, JobOptions::default()).await?;
```

### create_user

Creates a user in the database.

**Parameters:**
```rust
pub struct CreateUserParams {
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
}
```

**Usage:**
```rust
let params = CreateUserParams {
    email: "user@example.com".to_string(),
    password: "hashed_password".to_string(),
    first_name: "John".to_string(),
    last_name: "Doe".to_string(),
};

let status = enqueue_and_wait_dyn(&mq, "create_user", &params, JobOptions::default(), 30000).await?;
```

---

## Worker Processing Loop

The worker processor runs in the background consuming jobs:

```rust
// bootstrap/mq/controller/mq.rs

pub async fn start_processor(queue: SharedQueue, concurrency: usize) {
    info!("Starting RabbitMQ processor with {} workers", concurrency);

    for i in 0..concurrency {
        let queue_clone = queue.clone();
        tokio::spawn(async move {
            if let Err(e) = process_worker(queue_clone, i).await {
                error!("Worker {} failed: {}", i, e);
            }
        });
    }
}

async fn process_worker(queue: SharedQueue, worker_id: usize) -> Result<(), ...> {
    let consumer = {
        let mq = queue.lock().await;
        mq.get_consumer(worker_id).await?
    };

    while let Some(delivery) = consumer.next().await {
        // Parse job
        let job: QueuedJob = serde_json::from_slice(&delivery.data)?;

        // Process job
        let mq = queue.lock().await;
        let result = workers::process(&mq, &job).await;

        match result {
            Ok(JobResult::Success(_)) => {
                mq.ack(delivery.delivery_tag).await?;
            }
            Ok(JobResult::Retry(reason)) => {
                mq.ack(delivery.delivery_tag).await?;
                mq.retry(job, &reason).await?;
            }
            Ok(JobResult::Failed(reason)) => {
                mq.ack(delivery.delivery_tag).await?;
                mq.move_to_failed(&job, &reason).await?;
            }
            Err(e) => {
                mq.ack(delivery.delivery_tag).await?;
                mq.retry(job, &e.to_string()).await?;
            }
        }
    }

    Ok(())
}
```

---

## Retry Logic

### Automatic Retries

```rust
pub async fn retry(&self, mut job: QueuedJob, error: &str) -> Result<bool, ...> {
    job.attempts += 1;

    // Check if max retries exceeded
    if job.attempts >= job.options.fault_tolerance {
        self.move_to_failed(&job, error).await?;
        return Ok(false);  // No more retries
    }

    // Re-enqueue for retry
    job.status = JobStatus::Retrying;
    job.updated_at = chrono::Utc::now().timestamp_millis();

    warn!("Job {} retrying (attempt {}/{}): {}",
        job.id, job.attempts, job.options.fault_tolerance, error);

    self.enqueue(job).await?;
    Ok(true)  // Will retry
}
```

### Retry Flow

```
Job Fails (Attempt 1)
       ↓
   Retry Check: attempts < fault_tolerance?
       ↓
      YES → Re-enqueue with status=Retrying
       ↓
Job Fails (Attempt 2)
       ↓
   Retry Check: attempts < fault_tolerance?
       ↓
      YES → Re-enqueue with status=Retrying
       ↓
Job Fails (Attempt 3)
       ↓
   Retry Check: attempts < fault_tolerance (3)?
       ↓
      NO → Move to jobs_failed queue
```

---

## Failed Jobs

Jobs that fail after all retries are moved to `jobs_failed`:

```rust
pub async fn move_to_failed(&self, job: &QueuedJob, error: &str) -> Result<(), ...> {
    let mut failed_job = job.clone();
    failed_job.status = JobStatus::Failed;
    failed_job.updated_at = chrono::Utc::now().timestamp_millis();

    let job_json = serde_json::to_string(&failed_job)?;

    self.channel.basic_publish(
        "",
        "jobs_failed",
        BasicPublishOptions::default(),
        job_json.as_bytes(),
        BasicProperties::default().with_delivery_mode(2),
    ).await?;

    error!("Job {} moved to failed queue: {}", failed_job.id, error);
    Ok(())
}
```

### Monitoring Failed Jobs

Use RabbitMQ Management UI at `http://localhost:15672`:
- Queue: `jobs_failed`
- View message details
- Requeue or delete messages

---

## Application Initialization

In `main.rs`:

```rust
use crate::bootstrap::mq;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize tracing
    tracing_logger::init();

    // Create database pool
    let pool = create_pool().await;

    // Initialize RabbitMQ
    let mq = mq::init(pool.clone()).await
        .expect("Failed to initialize RabbitMQ");

    // Start 4 worker threads
    let queue_clone = mq.clone();
    tokio::spawn(async move {
        mq::start_processor(queue_clone, 4).await;
    });

    // Convert to DynMq for AppState
    let dyn_mq: DynMq = Arc::new(Mutex::new(MessageQueue::try_from(mq).unwrap()));

    // Create app state
    let state = state_with_mq(dyn_mq).await;

    // Start HTTP server
    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            // ... routes
    })
    .bind("0.0.0.0:9999")?
    .run()
    .await
}
```

---

## Best Practices

1. **Use appropriate priority levels**:
   - Critical: User-facing, time-sensitive
   - High: Important background tasks
   - Normal: Standard processing
   - Low: Non-urgent, can be delayed

2. **Set realistic fault_tolerance**:
   - 3 retries for network operations
   - 1-2 for logic errors (unlikely to succeed on retry)
   - 5+ for external API calls

3. **Identify retryable errors**:
   - Timeouts: Yes
   - Connection errors: Yes
   - Validation errors: No
   - Database constraint violations: No

4. **Monitor the system**:
   - Check `jobs_failed` queue regularly
   - Set up alerts for queue depth
   - Monitor worker health

5. **Keep jobs small**:
   - Don't pass large data in payload
   - Pass IDs and fetch from database
   - Break large tasks into smaller jobs

---

## Related Documentation

- [Email System](../Email/EMAIL.md) - Email sending via MQ
- [Kafka Events](../Events/EVENTS.md) - Event streaming comparison
- [Bootstrap Documentation](../Bootstrap/BOOTSTRAP.md) - Core framework
