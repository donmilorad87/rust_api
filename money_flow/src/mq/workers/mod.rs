pub mod create_user;
pub mod email;

use crate::mq::{JobResult, MessageQueue, QueuedJob};

/// Process a job by routing to the appropriate worker
pub async fn process(
    mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<()>, Box<dyn std::error::Error + Send + Sync>> {
    match job.worker_name.as_str() {
        "create_user" => create_user::process(mq, job).await,
        "send_email" => email::process(mq, job).await,
        _ => {
            tracing::error!("Unknown worker: {}", job.worker_name);
            Ok(JobResult::Failed(format!("Unknown worker: {}", job.worker_name)))
        }
    }
}
