pub mod user_counter;

use sqlx::{Pool, Postgres};
use tokio_cron_scheduler::JobScheduler;
use tracing::{error, info};

pub async fn init(db: Pool<Postgres>) -> Result<JobScheduler, Box<dyn std::error::Error>> {
    info!("Initializing cron jobs...");

    let scheduler = JobScheduler::new().await?;

    // Initialize user_counter cron job
    if let Err(e) = user_counter::init(&scheduler, db).await {
        error!("Failed to initialize user_counter cron job: {}", e);
    }

    // Start the scheduler
    scheduler.start().await?;

    info!("Cron jobs initialized successfully");

    Ok(scheduler)
}
