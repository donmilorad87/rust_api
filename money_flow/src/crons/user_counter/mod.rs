pub mod controller;

use crate::config::CronConfig;
use controller::user_counter::count_users;
use sqlx::{Pool, Postgres};
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::info;

pub async fn init(scheduler: &JobScheduler, db: Pool<Postgres>) -> Result<(), Box<dyn std::error::Error>> {
    let cron_expression = CronConfig::user_counter();

    info!("Initializing user_counter cron job with schedule: {}", cron_expression);

    let job = Job::new_async(cron_expression, move |_uuid, _lock| {
        let db = db.clone();
        Box::pin(async move {
            info!("Running user_counter cron job...");
            let count = count_users(&db).await;
            info!("Cron job completed. Total users: {}", count);
        })
    })?;

    scheduler.add(job).await?;

    Ok(())
}
