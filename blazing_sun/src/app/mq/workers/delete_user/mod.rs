use crate::app::mq::jobs::delete_user::{self, DeleteUserParams};
use crate::mq::{JobResult, MessageQueue, QueuedJob};
use tracing::{error, info};

pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Processing delete_user job: {}", job.id);

    let params: DeleteUserParams = match serde_json::from_str(&job.payload) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to deserialize delete_user payload: {}", e);
            return Ok(JobResult::Failed(format!("Invalid payload: {}", e)));
        }
    };

    match delete_user::execute(mq.db(), &params).await {
        Ok(true) => {
            info!("delete_user job {} completed successfully", job.id);
            Ok(JobResult::Success(serde_json::Value::Null))
        }
        Ok(false) => Ok(JobResult::Failed("User not found".to_string())),
        Err(e) => {
            error!("delete_user job {} failed: {}", job.id, e);
            if e.contains("connection") || e.contains("timeout") {
                Ok(JobResult::Retry(e))
            } else {
                Ok(JobResult::Failed(e))
            }
        }
    }
}
