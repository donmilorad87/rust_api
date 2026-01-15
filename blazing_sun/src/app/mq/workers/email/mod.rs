use crate::app::mq::jobs::email::{self, SendEmailParams};
use crate::mq::{JobResult, MessageQueue, QueuedJob};
use tracing::{error, info};

/// Process a send_email job
pub async fn process(
    _mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Processing send_email job: {}", job.id);

    // Deserialize the payload
    let params: SendEmailParams = match serde_json::from_str(&job.payload) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to deserialize send_email payload: {}", e);
            return Ok(JobResult::Failed(format!("Invalid payload: {}", e)));
        }
    };

    // Execute the job
    match email::execute(&params).await {
        Ok(true) => {
            info!("send_email job {} completed successfully", job.id);
            Ok(JobResult::Success(serde_json::Value::Null))
        }
        Ok(false) => Ok(JobResult::Retry("Email sending returned false".to_string())),
        Err(e) => {
            error!("send_email job {} failed: {}", job.id, e);
            // Check if it's a retryable error
            if e.contains("connection") || e.contains("timeout") || e.contains("temporarily") {
                Ok(JobResult::Retry(e))
            } else {
                Ok(JobResult::Failed(e))
            }
        }
    }
}
