use crate::app::mq::jobs::create_user::{self, CreateUserParams};
use crate::mq::{JobResult, MessageQueue, QueuedJob};
use tracing::{error, info};

/// Process a create_user job
pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<()>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Processing create_user job: {}", job.id);

    // Deserialize the payload
    let params: CreateUserParams = match serde_json::from_str(&job.payload) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to deserialize create_user payload: {}", e);
            return Ok(JobResult::Failed(format!("Invalid payload: {}", e)));
        }
    };

    // Execute the job
    match create_user::execute(mq.db(), &params).await {
        Ok(true) => {
            info!("create_user job {} completed successfully", job.id);
            Ok(JobResult::Success(()))
        }
        Ok(false) => {
            Ok(JobResult::Retry("User creation returned false".to_string()))
        }
        Err(e) => {
            error!("create_user job {} failed: {}", job.id, e);
            // Check if it's a retryable error
            if e.contains("connection") || e.contains("timeout") {
                Ok(JobResult::Retry(e))
            } else {
                Ok(JobResult::Failed(e))
            }
        }
    }
}
