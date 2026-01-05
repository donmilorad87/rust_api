use crate::app::mq::jobs::oauth_delete_picture::{self, DeletePictureParams};
use crate::mq::{JobResult, MessageQueue, QueuedJob};
use tracing::{error, info};

pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Processing oauth_delete_picture job: {}", job.id);

    let params: DeletePictureParams = match serde_json::from_str(&job.payload) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to deserialize oauth_delete_picture payload: {}", e);
            return Ok(JobResult::Failed(format!("Invalid payload: {}", e)));
        }
    };

    match oauth_delete_picture::execute(mq.db(), &params).await {
        Ok(payload) => Ok(JobResult::Success(payload)),
        Err(e) => {
            error!("oauth_delete_picture job {} failed: {}", job.id, e);
            Ok(JobResult::Failed(e))
        }
    }
}
