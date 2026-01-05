use crate::app::mq::jobs::bulk_user_action::{self, BulkUserActionParams};
use crate::mq::{JobResult, MessageQueue, QueuedJob};
use tracing::{error, info};

pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Processing bulk_user_action job: {}", job.id);

    let params: BulkUserActionParams = match serde_json::from_str(&job.payload) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to deserialize bulk_user_action payload: {}", e);
            return Ok(JobResult::Failed(format!("Invalid payload: {}", e)));
        }
    };

    match bulk_user_action::execute(mq.db(), &params).await {
        Ok(true) => {
            info!("bulk_user_action job {} completed successfully", job.id);
            Ok(JobResult::Success(serde_json::Value::Null))
        }
        Ok(false) => Ok(JobResult::Failed("Bulk action failed".to_string())),
        Err(e) => {
            error!("bulk_user_action job {} failed: {}", job.id, e);
            if e.contains("connection") || e.contains("timeout") {
                Ok(JobResult::Retry(e))
            } else {
                Ok(JobResult::Failed(e))
            }
        }
    }
}
