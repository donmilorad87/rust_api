use crate::app::mq::jobs::oauth_list_gallery_images::{self, ListGalleryImagesParams};
use crate::mq::{JobResult, MessageQueue, QueuedJob};
use tracing::{error, info};

pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Processing oauth_list_gallery_images job: {}", job.id);

    let params: ListGalleryImagesParams = match serde_json::from_str(&job.payload) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to deserialize oauth_list_gallery_images payload: {}", e);
            return Ok(JobResult::Failed(format!("Invalid payload: {}", e)));
        }
    };

    match oauth_list_gallery_images::execute(mq.db(), &params).await {
        Ok(payload) => Ok(JobResult::Success(payload)),
        Err(e) => {
            error!("oauth_list_gallery_images job {} failed: {}", job.id, e);
            Ok(JobResult::Failed(e))
        }
    }
}
