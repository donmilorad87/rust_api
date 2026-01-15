pub mod bulk_delete_pictures;
pub mod bulk_delete_uploads;
pub mod bulk_user_action;
pub mod create_user;
pub mod delete_upload;
pub mod delete_user;
pub mod email;
pub mod oauth_delete_gallery;
pub mod oauth_delete_picture;
pub mod oauth_list_galleries;
pub mod oauth_list_gallery_images;
pub mod resize_image;

use crate::mq::{JobResult, MessageQueue, QueuedJob};

/// Process a job by routing to the appropriate worker
pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    match job.worker_name.as_str() {
        "create_user" => create_user::process(mq, job).await,
        "bulk_user_action" => bulk_user_action::process(mq, job).await,
        "bulk_delete_pictures" => bulk_delete_pictures::process(mq, job).await,
        "bulk_delete_uploads" => bulk_delete_uploads::process(mq, job).await,
        "delete_user" => delete_user::process(mq, job).await,
        "delete_upload" => delete_upload::process(mq, job).await,
        "send_email" => email::process(mq, job).await,
        "oauth_list_galleries" => oauth_list_galleries::process(mq, job).await,
        "oauth_list_gallery_images" => oauth_list_gallery_images::process(mq, job).await,
        "oauth_delete_gallery" => oauth_delete_gallery::process(mq, job).await,
        "oauth_delete_picture" => oauth_delete_picture::process(mq, job).await,
        "resize_image" => resize_image::process(mq, job).await,
        _ => {
            tracing::error!("Unknown worker: {}", job.worker_name);
            Ok(JobResult::Failed(format!(
                "Unknown worker: {}",
                job.worker_name
            )))
        }
    }
}
