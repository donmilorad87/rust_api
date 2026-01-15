use crate::app::mq::jobs::bulk_delete_uploads::{self, BulkDeleteUploadsParams};
use crate::mq::{JobResult, MessageQueue, QueuedJob};
use tracing::{error, info};

pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Processing bulk_delete_uploads job: {}", job.id);

    let params: BulkDeleteUploadsParams = match serde_json::from_str(&job.payload) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to deserialize bulk_delete_uploads payload: {}", e);
            return Ok(JobResult::Failed(format!("Invalid payload: {}", e)));
        }
    };

    match bulk_delete_uploads::execute(mq.db(), &params).await {
        Ok(_) => {
            info!("bulk_delete_uploads job {} completed successfully", job.id);
            Ok(JobResult::Success(serde_json::Value::Null))
        }
        Err(e) => {
            error!("bulk_delete_uploads job {} failed: {}", job.id, e);
            if e.contains("connection") || e.contains("timeout") {
                Ok(JobResult::Retry(e))
            } else {
                Ok(JobResult::Failed(e))
            }
        }
    }
}
