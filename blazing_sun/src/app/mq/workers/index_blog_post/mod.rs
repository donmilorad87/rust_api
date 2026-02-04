//! Blog Post Elasticsearch Indexing Worker
//!
//! Processes index_blog_post jobs from the RabbitMQ queue.

use tracing::{error, info, warn};

use crate::app::mq::jobs::index_blog_post::{self, IndexBlogPostParams};
use crate::bootstrap::mq::{JobResult, MessageQueue, QueuedJob};

/// Process an index_blog_post job
pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    info!("=== INDEX_BLOG_POST WORKER RECEIVED JOB: {} ===", job.id);
    info!("Job payload: {}", job.payload);

    // Deserialize the job parameters
    let params: IndexBlogPostParams = match serde_json::from_str(&job.payload) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to deserialize index_blog_post payload: {}", e);
            return Ok(JobResult::Failed(format!("Invalid payload: {}", e)));
        }
    };

    info!(
        "Index action: {:?}, post_id: {:?}, slug: {:?}",
        params.action, params.post_id, params.post_slug
    );

    // Get the Elasticsearch client
    info!("Getting Elasticsearch client from MessageQueue...");
    let es_client = match mq.elasticsearch() {
        Some(client) => {
            info!("Elasticsearch client is available");
            client
        }
        None => {
            error!("Elasticsearch client NOT available in MessageQueue, retrying...");
            return Ok(JobResult::Retry(
                "Elasticsearch client not available".to_string(),
            ));
        }
    };

    // Execute the indexing job
    match index_blog_post::execute(mq.db(), es_client, &params).await {
        Ok(true) => {
            info!("index_blog_post job {} completed successfully", job.id);
            Ok(JobResult::Success(serde_json::json!({
                "action": format!("{:?}", params.action),
                "post_id": params.post_id,
                "status": "success"
            })))
        }
        Ok(false) => {
            // Unexpected false return, treat as retry
            warn!("index_blog_post job {} returned false, retrying", job.id);
            Ok(JobResult::Retry("Job returned false".to_string()))
        }
        Err(e) => {
            error!("index_blog_post job {} failed: {}", job.id, e);

            // Check if error is retryable
            let error_lower = e.to_lowercase();
            if error_lower.contains("connection")
                || error_lower.contains("timeout")
                || error_lower.contains("temporarily")
                || error_lower.contains("unavailable")
                || error_lower.contains("network")
            {
                warn!("Retryable error detected, will retry: {}", e);
                Ok(JobResult::Retry(e))
            } else {
                // Permanent failure
                Ok(JobResult::Failed(e))
            }
        }
    }
}
