//! Message Queue Controller
//!
//! Core RabbitMQ message queue infrastructure.

use crate::config::RabbitMQConfig;
use futures_lite::StreamExt;
use lapin::{
    options::*, types::FieldTable, BasicProperties, Channel, Connection, ConnectionProperties,
    Consumer,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info, warn};
use uuid::Uuid;

const QUEUE_NAME: &str = "jobs";
const FAILED_QUEUE: &str = "jobs_failed";

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

/// The Message Queue manager using RabbitMQ
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

        channel
            .queue_declare(
                QUEUE_NAME,
                QueueDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                args,
            )
            .await?;

        // Declare failed queue
        channel
            .queue_declare(
                FAILED_QUEUE,
                QueueDeclareOptions {
                    durable: true,
                    ..Default::default()
                },
                FieldTable::default(),
            )
            .await?;

        info!("RabbitMQ connection established");

        Ok(Self { channel, db })
    }

    /// Enqueue a job with priority support
    pub async fn enqueue(
        &self,
        job: QueuedJob,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let job_id = job.id.clone();
        let job_json = serde_json::to_string(&job)?;

        // Map priority to RabbitMQ priority (0-10)
        let priority = (job.options.priority as u8) * 2;

        self.channel
            .basic_publish(
                "",
                QUEUE_NAME,
                BasicPublishOptions::default(),
                job_json.as_bytes(),
                BasicProperties::default()
                    .with_priority(priority)
                    .with_delivery_mode(2) // persistent
                    .with_message_id(job_id.clone().into()),
            )
            .await?
            .await?;

        info!(
            "Job {} enqueued with priority {:?}",
            job_id, job.options.priority
        );
        Ok(job_id)
    }

    /// Get a consumer for the queue with unique tag
    pub async fn get_consumer(
        &self,
        worker_id: usize,
    ) -> Result<Consumer, Box<dyn std::error::Error + Send + Sync>> {
        let consumer_tag = format!("worker-{}", worker_id);
        let consumer = self
            .channel
            .basic_consume(
                QUEUE_NAME,
                &consumer_tag,
                BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await?;

        Ok(consumer)
    }

    /// Acknowledge a message
    pub async fn ack(
        &self,
        delivery_tag: u64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.channel
            .basic_ack(delivery_tag, BasicAckOptions::default())
            .await?;
        Ok(())
    }

    /// Reject a message (requeue or dead-letter)
    pub async fn nack(
        &self,
        delivery_tag: u64,
        requeue: bool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.channel
            .basic_nack(
                delivery_tag,
                BasicNackOptions {
                    requeue,
                    ..Default::default()
                },
            )
            .await?;
        Ok(())
    }

    /// Move job to failed queue
    pub async fn move_to_failed(
        &self,
        job: &QueuedJob,
        error: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut failed_job = job.clone();
        failed_job.status = JobStatus::Failed;
        failed_job.updated_at = chrono::Utc::now().timestamp_millis();

        let job_json = serde_json::to_string(&failed_job)?;

        self.channel
            .basic_publish(
                "",
                FAILED_QUEUE,
                BasicPublishOptions::default(),
                job_json.as_bytes(),
                BasicProperties::default()
                    .with_delivery_mode(2)
                    .with_message_id(failed_job.id.clone().into()),
            )
            .await?
            .await?;

        error!(
            "Job {} moved to failed queue: {}",
            failed_job.id, error
        );
        Ok(())
    }

    /// Retry a failed job
    pub async fn retry(
        &self,
        mut job: QueuedJob,
        error: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        job.attempts += 1;

        if job.attempts >= job.options.fault_tolerance {
            self.move_to_failed(&job, error).await?;
            return Ok(false);
        }

        // Re-enqueue for retry
        job.status = JobStatus::Retrying;
        job.updated_at = chrono::Utc::now().timestamp_millis();

        warn!(
            "Job {} retrying (attempt {}/{}): {}",
            job.id, job.attempts, job.options.fault_tolerance, error
        );

        self.enqueue(job).await?;
        Ok(true)
    }

    /// Get the database pool
    pub fn db(&self) -> &Pool<Postgres> {
        &self.db
    }

    /// Get the channel for advanced operations
    pub fn channel(&self) -> &Channel {
        &self.channel
    }
}

/// Shared message queue instance
pub type SharedQueue = Arc<Mutex<MessageQueue>>;

// Type alias for DynMq from database module (used to avoid circular dependency)
pub type DynMq = crate::database::DynMq;

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
    let mq = guard
        .downcast_ref::<MessageQueue>()
        .ok_or("Failed to downcast message queue")?;
    mq.enqueue(job).await
}

/// Enqueue a job and wait for completion using DynMq (for use in routes)
/// Note: This is a simplified implementation that processes the job synchronously
pub async fn enqueue_and_wait_dyn<T: serde::Serialize>(
    queue: &DynMq,
    worker_name: &str,
    params: &T,
    options: JobOptions,
    timeout_ms: u64,
) -> Result<JobStatus, Box<dyn std::error::Error + Send + Sync>> {
    let payload = serde_json::to_string(params)?;
    let job = QueuedJob::new(worker_name, payload, options.clone());

    let guard = queue.lock().await;
    let mq = guard
        .downcast_ref::<MessageQueue>()
        .ok_or("Failed to downcast message queue")?;

    // Process the job synchronously for wait operations
    let result = tokio::time::timeout(
        std::time::Duration::from_millis(timeout_ms),
        crate::app::mq::workers::process(mq, &job),
    )
    .await;

    match result {
        Ok(Ok(JobResult::Success(_))) => Ok(JobStatus::Completed),
        Ok(Ok(JobResult::Failed(_))) => Ok(JobStatus::Failed),
        Ok(Ok(JobResult::Retry(reason))) => {
            // Try to retry
            let mut retry_job = job.clone();
            retry_job.attempts += 1;
            if retry_job.attempts < options.fault_tolerance {
                mq.enqueue(retry_job).await?;
                Ok(JobStatus::Retrying)
            } else {
                warn!("Job failed after retries: {}", reason);
                Ok(JobStatus::Failed)
            }
        }
        Ok(Err(e)) => {
            error!("Job execution error: {}", e);
            Ok(JobStatus::Failed)
        }
        Err(_) => Err("Job timeout".into()),
    }
}

/// Enqueue a job and wait for completion, returning the worker payload
pub async fn enqueue_and_wait_result_dyn<T: serde::Serialize>(
    queue: &DynMq,
    worker_name: &str,
    params: &T,
    options: JobOptions,
    timeout_ms: u64,
) -> Result<JobResult<Value>, Box<dyn std::error::Error + Send + Sync>> {
    let payload = serde_json::to_string(params)?;
    let job = QueuedJob::new(worker_name, payload, options.clone());

    let guard = queue.lock().await;
    let mq = guard
        .downcast_ref::<MessageQueue>()
        .ok_or("Failed to downcast message queue")?;

    let result = tokio::time::timeout(
        std::time::Duration::from_millis(timeout_ms),
        crate::app::mq::workers::process(mq, &job),
    )
    .await;

    match result {
        Ok(Ok(JobResult::Success(value))) => Ok(JobResult::Success(value)),
        Ok(Ok(JobResult::Failed(reason))) => Ok(JobResult::Failed(reason)),
        Ok(Ok(JobResult::Retry(reason))) => {
            let mut retry_job = job.clone();
            retry_job.attempts += 1;
            if retry_job.attempts < options.fault_tolerance {
                mq.enqueue(retry_job).await?;
                Ok(JobResult::Retry(reason))
            } else {
                warn!("Job failed after retries: {}", reason);
                Ok(JobResult::Failed(reason))
            }
        }
        Ok(Err(e)) => {
            error!("Job execution error: {}", e);
            Ok(JobResult::Failed(e.to_string()))
        }
        Err(_) => Ok(JobResult::Failed("Job timeout".to_string())),
    }
}

/// Initialize the message queue
pub async fn init(
    db: Pool<Postgres>,
) -> Result<SharedQueue, Box<dyn std::error::Error + Send + Sync>> {
    info!("Initializing RabbitMQ message queue...");
    let mq = MessageQueue::new(db).await?;
    let shared = Arc::new(Mutex::new(mq));
    info!("RabbitMQ message queue initialized successfully");
    Ok(shared)
}

/// Start the queue worker processor
pub async fn start_processor(queue: SharedQueue, concurrency: usize) {
    info!(
        "Starting RabbitMQ message queue processor with {} workers",
        concurrency
    );

    for i in 0..concurrency {
        let queue_clone = queue.clone();
        tokio::spawn(async move {
            if let Err(e) = process_worker(queue_clone, i).await {
                error!("Worker {} failed: {}", i, e);
            }
        });
    }
}

async fn process_worker(
    queue: SharedQueue,
    worker_id: usize,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let consumer = {
        let mq = queue.lock().await;
        mq.get_consumer(worker_id).await?
    };

    let mut consumer = consumer;

    info!("Worker {} started consuming", worker_id);

    while let Some(delivery) = consumer.next().await {
        match delivery {
            Ok(delivery) => {
                let job_json = String::from_utf8_lossy(&delivery.data);
                let job: QueuedJob = match serde_json::from_str(&job_json) {
                    Ok(j) => j,
                    Err(e) => {
                        error!("Worker {}: Failed to parse job: {}", worker_id, e);
                        let mq = queue.lock().await;
                        mq.ack(delivery.delivery_tag).await?;
                        continue;
                    }
                };

                info!(
                    "Worker {}: Processing job {} ({})",
                    worker_id, job.id, job.worker_name
                );

                let mq = queue.lock().await;
                let result = crate::app::mq::workers::process(&mq, &job).await;

                match result {
                    Ok(JobResult::Success(_)) => {
                        mq.ack(delivery.delivery_tag).await?;
                        info!("Worker {}: Job {} completed", worker_id, job.id);
                    }
                    Ok(JobResult::Retry(reason)) => {
                        mq.ack(delivery.delivery_tag).await?;
                        if let Err(e) = mq.retry(job, &reason).await {
                            error!("Worker {}: Failed to retry job: {}", worker_id, e);
                        }
                    }
                    Ok(JobResult::Failed(reason)) => {
                        mq.ack(delivery.delivery_tag).await?;
                        if let Err(e) = mq.move_to_failed(&job, &reason).await {
                            error!("Worker {}: Failed to move job to failed: {}", worker_id, e);
                        }
                    }
                    Err(e) => {
                        mq.ack(delivery.delivery_tag).await?;
                        if let Err(retry_err) = mq.retry(job, &e.to_string()).await {
                            error!("Worker {}: Failed to retry job: {}", worker_id, retry_err);
                        }
                    }
                }
            }
            Err(e) => {
                error!("Worker {}: Consumer error: {}", worker_id, e);
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        }
    }

    Ok(())
}
