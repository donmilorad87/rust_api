pub mod jobs;
pub mod workers;

use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Priority levels for jobs (0 = FIFO default, higher = more priority)
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

/// Options for job execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobOptions {
    pub priority: Priority,
    pub fault_tolerance: u32,
    pub delay_ms: Option<u64>,
}

impl Default for JobOptions {
    fn default() -> Self {
        Self {
            priority: Priority::Fifo,
            fault_tolerance: 3,
            delay_ms: None,
        }
    }
}

impl JobOptions {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn priority(mut self, priority: u8) -> Self {
        self.priority = Priority::from(priority);
        self
    }

    pub fn fault_tolerance(mut self, retries: u32) -> Self {
        self.fault_tolerance = retries;
        self
    }

    pub fn delay(mut self, ms: u64) -> Self {
        self.delay_ms = Some(ms);
        self
    }
}

/// Job status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Retrying,
}

/// A queued job with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueuedJob {
    pub id: String,
    pub worker_name: String,
    pub payload: String,
    pub options: JobOptions,
    pub status: JobStatus,
    pub attempts: u32,
    pub created_at: i64,
    pub updated_at: i64,
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

/// Result of job execution
#[derive(Debug)]
pub enum JobResult<T> {
    Success(T),
    Retry(String),
    Failed(String),
}

/// The Message Queue manager
pub struct MessageQueue {
    redis: ConnectionManager,
    db: Pool<Postgres>,
    queue_key: String,
    processing_key: String,
    failed_key: String,
}

impl MessageQueue {
    pub async fn new(db: Pool<Postgres>) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let redis_url = std::env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

        let client = redis::Client::open(redis_url)?;
        let redis = ConnectionManager::new(client).await?;

        Ok(Self {
            redis,
            db,
            queue_key: "mq:jobs".to_string(),
            processing_key: "mq:processing".to_string(),
            failed_key: "mq:failed".to_string(),
        })
    }

    /// Enqueue a job with priority support
    pub async fn enqueue(&self, job: QueuedJob) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.redis.clone();
        let job_id = job.id.clone();
        let job_json = serde_json::to_string(&job)?;

        // Use Redis sorted set for priority queue
        // Score = priority * 1_000_000_000_000 - timestamp (higher priority, earlier time = higher score)
        let priority_score = (job.options.priority as i64) * 1_000_000_000_000_i64;
        let time_score = 1_000_000_000_000_i64 - (job.created_at % 1_000_000_000_000_i64);
        let score = priority_score + time_score;

        conn.zadd::<_, _, _, ()>(&self.queue_key, &job_json, score as f64).await?;

        // Store job details for lookup
        let job_key = format!("mq:job:{}", job_id);
        conn.set::<_, _, ()>(&job_key, &job_json).await?;

        info!("Job {} enqueued with priority {:?}", job_id, job.options.priority);
        Ok(job_id)
    }

    /// Dequeue the highest priority job
    pub async fn dequeue(&self) -> Result<Option<QueuedJob>, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.redis.clone();

        // Get highest priority job (highest score)
        let result: Vec<String> = conn.zpopmax(&self.queue_key, 1).await?;

        if result.is_empty() {
            return Ok(None);
        }

        // Result is [member, score] pairs
        let job_json = &result[0];
        let mut job: QueuedJob = serde_json::from_str(job_json)?;

        // Update status
        job.status = JobStatus::Processing;
        job.updated_at = chrono::Utc::now().timestamp_millis();

        // Move to processing set
        let updated_json = serde_json::to_string(&job)?;
        conn.hset::<_, _, _, ()>(&self.processing_key, &job.id, &updated_json).await?;

        // Update job details
        let job_key = format!("mq:job:{}", job.id);
        conn.set::<_, _, ()>(&job_key, &updated_json).await?;

        Ok(Some(job))
    }

    /// Mark job as completed
    pub async fn complete(&self, job_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.redis.clone();

        // Remove from processing
        conn.hdel::<_, _, ()>(&self.processing_key, job_id).await?;

        // Update job status
        let job_key = format!("mq:job:{}", job_id);
        if let Ok(job_json) = conn.get::<_, String>(&job_key).await {
            if let Ok(mut job) = serde_json::from_str::<QueuedJob>(&job_json) {
                job.status = JobStatus::Completed;
                job.updated_at = chrono::Utc::now().timestamp_millis();
                let updated_json = serde_json::to_string(&job)?;
                conn.set::<_, _, ()>(&job_key, &updated_json).await?;
                // Set TTL for completed jobs (24 hours)
                conn.expire::<_, ()>(&job_key, 86400).await?;
            }
        }

        info!("Job {} completed", job_id);
        Ok(())
    }

    /// Retry a failed job
    pub async fn retry(&self, mut job: QueuedJob, error: &str) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.redis.clone();

        job.attempts += 1;

        if job.attempts >= job.options.fault_tolerance {
            // Max retries exceeded, move to failed queue
            job.status = JobStatus::Failed;
            job.updated_at = chrono::Utc::now().timestamp_millis();

            let job_json = serde_json::to_string(&job)?;
            conn.hset::<_, _, _, ()>(&self.failed_key, &job.id, &job_json).await?;
            conn.hdel::<_, _, ()>(&self.processing_key, &job.id).await?;

            error!("Job {} failed after {} attempts: {}", job.id, job.attempts, error);
            return Ok(false);
        }

        // Re-enqueue for retry
        job.status = JobStatus::Retrying;
        job.updated_at = chrono::Utc::now().timestamp_millis();

        conn.hdel::<_, _, ()>(&self.processing_key, &job.id).await?;

        warn!("Job {} retrying (attempt {}/{}): {}", job.id, job.attempts, job.options.fault_tolerance, error);

        self.enqueue(job).await?;
        Ok(true)
    }

    /// Get the database pool
    pub fn db(&self) -> &Pool<Postgres> {
        &self.db
    }

    /// Get job by ID
    pub async fn get_job(&self, job_id: &str) -> Result<Option<QueuedJob>, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.redis.clone();
        let job_key = format!("mq:job:{}", job_id);

        match conn.get::<_, String>(&job_key).await {
            Ok(job_json) => {
                let job: QueuedJob = serde_json::from_str(&job_json)?;
                Ok(Some(job))
            }
            Err(_) => Ok(None),
        }
    }

    /// Get queue length
    pub async fn queue_length(&self) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let mut conn = self.redis.clone();
        let len: usize = conn.zcard(&self.queue_key).await?;
        Ok(len)
    }

    /// Wait for job completion with timeout
    pub async fn wait_for_completion(
        &self,
        job_id: &str,
        timeout_ms: u64,
    ) -> Result<JobStatus, Box<dyn std::error::Error + Send + Sync>> {
        let start = std::time::Instant::now();
        let timeout = std::time::Duration::from_millis(timeout_ms);

        loop {
            if start.elapsed() > timeout {
                return Err("Job timeout".into());
            }

            if let Some(job) = self.get_job(job_id).await? {
                match job.status {
                    JobStatus::Completed => return Ok(JobStatus::Completed),
                    JobStatus::Failed => return Ok(JobStatus::Failed),
                    _ => {}
                }
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        }
    }
}

/// Helper to enqueue a job from handlers
pub async fn enqueue_job<T: serde::Serialize>(
    queue: &SharedQueue,
    worker_name: &str,
    params: &T,
    options: JobOptions,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let payload = serde_json::to_string(params)?;
    let job = QueuedJob::new(worker_name, payload, options);
    let mq = queue.lock().await;
    mq.enqueue(job).await
}

/// Enqueue a job and wait for completion
pub async fn enqueue_and_wait<T: serde::Serialize>(
    queue: &SharedQueue,
    worker_name: &str,
    params: &T,
    options: JobOptions,
    timeout_ms: u64,
) -> Result<JobStatus, Box<dyn std::error::Error + Send + Sync>> {
    let payload = serde_json::to_string(params)?;
    let job = QueuedJob::new(worker_name, payload, options);
    let job_id = {
        let mq = queue.lock().await;
        mq.enqueue(job).await?
    };

    // Wait for completion
    let mq = queue.lock().await;
    mq.wait_for_completion(&job_id, timeout_ms).await
}

// Type alias for DynMq from db module (used to avoid circular dependency)
pub type DynMq = crate::db::DynMq;

/// Enqueue a job from handlers using DynMq (for use in routes)
pub async fn enqueue_job_dyn<T: serde::Serialize>(
    queue: &DynMq,
    worker_name: &str,
    params: &T,
    options: JobOptions,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let payload = serde_json::to_string(params)?;
    let job = QueuedJob::new(worker_name, payload, options);
    let guard = queue.lock().await;
    let mq = guard.downcast_ref::<MessageQueue>()
        .ok_or("Failed to downcast message queue")?;
    mq.enqueue(job).await
}

/// Enqueue a job and wait for completion using DynMq (for use in routes)
pub async fn enqueue_and_wait_dyn<T: serde::Serialize>(
    queue: &DynMq,
    worker_name: &str,
    params: &T,
    options: JobOptions,
    timeout_ms: u64,
) -> Result<JobStatus, Box<dyn std::error::Error + Send + Sync>> {
    let payload = serde_json::to_string(params)?;
    let job = QueuedJob::new(worker_name, payload, options);

    let job_id = {
        let guard = queue.lock().await;
        let mq = guard.downcast_ref::<MessageQueue>()
            .ok_or("Failed to downcast message queue")?;
        mq.enqueue(job).await?
    };

    // Wait for completion
    let guard = queue.lock().await;
    let mq = guard.downcast_ref::<MessageQueue>()
        .ok_or("Failed to downcast message queue")?;
    mq.wait_for_completion(&job_id, timeout_ms).await
}

/// Shared message queue instance
pub type SharedQueue = Arc<Mutex<MessageQueue>>;

/// Initialize the message queue
pub async fn init(db: Pool<Postgres>) -> Result<SharedQueue, Box<dyn std::error::Error + Send + Sync>> {
    info!("Initializing message queue...");
    let mq = MessageQueue::new(db).await?;
    let shared = Arc::new(Mutex::new(mq));
    info!("Message queue initialized successfully");
    Ok(shared)
}

/// Start the queue worker processor
pub async fn start_processor(queue: SharedQueue, concurrency: usize) {
    info!("Starting message queue processor with {} workers", concurrency);

    for i in 0..concurrency {
        let queue_clone = queue.clone();
        tokio::spawn(async move {
            loop {
                process_next_job(queue_clone.clone(), i).await;
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        });
    }
}

async fn process_next_job(queue: SharedQueue, worker_id: usize) {
    let mq = queue.lock().await;

    let job = match mq.dequeue().await {
        Ok(Some(job)) => job,
        Ok(None) => return,
        Err(e) => {
            error!("Worker {}: Failed to dequeue job: {}", worker_id, e);
            return;
        }
    };

    info!("Worker {}: Processing job {} ({})", worker_id, job.id, job.worker_name);

    // Process the job based on worker_name
    let result = workers::process(&mq, &job).await;

    match result {
        Ok(JobResult::Success(_)) => {
            if let Err(e) = mq.complete(&job.id).await {
                error!("Worker {}: Failed to complete job {}: {}", worker_id, job.id, e);
            }
        }
        Ok(JobResult::Retry(reason)) => {
            if let Err(e) = mq.retry(job, &reason).await {
                error!("Worker {}: Failed to retry job: {}", worker_id, e);
            }
        }
        Ok(JobResult::Failed(reason)) => {
            let mut failed_job = job.clone();
            failed_job.attempts = failed_job.options.fault_tolerance; // Force fail
            if let Err(e) = mq.retry(failed_job, &reason).await {
                error!("Worker {}: Failed to mark job as failed: {}", worker_id, e);
            }
        }
        Err(e) => {
            if let Err(retry_err) = mq.retry(job, &e.to_string()).await {
                error!("Worker {}: Failed to retry job: {}", worker_id, retry_err);
            }
        }
    }
}
