//!
//! Cron Scheduling Controller
//!
//! This module provides the Schedule builder for cron jobs and
//! the scheduler initialization.
//!

use crate::routes::crons as cron_routes;
use sqlx::{Pool, Postgres};
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use tokio_cron_scheduler::{Job, JobScheduler};
use tracing::{error, info};

/// Initialize the cron scheduler
///
/// Creates the scheduler and registers all cron jobs defined in `routes/crons.rs`.
pub async fn init(db: Pool<Postgres>) -> Result<JobScheduler, Box<dyn std::error::Error>> {
    info!("Initializing cron scheduler...");

    let scheduler = JobScheduler::new().await?;

    // Register all cron schedules from routes/crons.rs
    cron_routes::register(&scheduler, db).await;

    // Start the scheduler
    scheduler.start().await?;

    info!("Cron scheduler started successfully");

    Ok(scheduler)
}

/// Type alias for async cron job functions
pub type CronJobFn =
    Arc<dyn Fn(Pool<Postgres>) -> Pin<Box<dyn Future<Output = ()> + Send>> + Send + Sync>;

/// Schedule builder for cron jobs
pub struct Schedule {
    name: String,
    cron_expression: Option<String>,
    job_fn: CronJobFn,
}

impl Schedule {
    /// Create a new schedule with a job function
    ///
    /// # Example
    /// ```rust,ignore
    /// Schedule::job("user_counter", |db| Box::pin(async move {
    ///     // job logic here
    /// }))
    /// ```
    pub fn job<F, Fut>(name: &str, f: F) -> Self
    where
        F: Fn(Pool<Postgres>) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = ()> + Send + 'static,
    {
        Schedule {
            name: name.to_string(),
            cron_expression: None,
            job_fn: Arc::new(move |db| Box::pin(f(db))),
        }
    }

    /// Set cron expression directly (6-field format: sec min hour day month day_of_week)
    ///
    /// # Example
    /// ```rust,ignore
    /// Schedule::job("my_job", handler)
    ///     .cron("0 */5 * * * *")  // Every 5 minutes
    /// ```
    pub fn cron(mut self, expression: &str) -> Self {
        self.cron_expression = Some(expression.to_string());
        self
    }

    /// Run daily at a specific time (HH:MM format)
    ///
    /// # Example
    /// ```rust,ignore
    /// Schedule::job("daily_report", handler)
    ///     .daily_at("03:00")  // Every day at 3:00 AM
    /// ```
    pub fn daily_at(mut self, time: &str) -> Self {
        let parts: Vec<&str> = time.split(':').collect();
        if parts.len() == 2 {
            let hour = parts[0];
            let minute = parts[1];
            // sec min hour day month day_of_week
            self.cron_expression = Some(format!("0 {} {} * * *", minute, hour));
        } else {
            error!("Invalid daily_at format '{}'. Expected HH:MM", time);
            self.cron_expression = Some("0 0 0 * * *".to_string()); // Default to midnight
        }
        self
    }

    /// Run hourly at a specific minute (MM format)
    ///
    /// # Example
    /// ```rust,ignore
    /// Schedule::job("hourly_sync", handler)
    ///     .hourly_at("30")  // Every hour at :30
    /// ```
    pub fn hourly_at(mut self, minute: &str) -> Self {
        // sec min hour day month day_of_week
        self.cron_expression = Some(format!("0 {} * * * *", minute));
        self
    }

    /// Run monthly at a specific day (DD format, 1-31)
    ///
    /// # Example
    /// ```rust,ignore
    /// Schedule::job("monthly_report", handler)
    ///     .monthly_at("01")  // First day of every month at midnight
    /// ```
    pub fn monthly_at(mut self, day: &str) -> Self {
        // sec min hour day month day_of_week
        self.cron_expression = Some(format!("0 0 0 {} * *", day));
        self
    }

    /// Run every N minutes
    ///
    /// # Example
    /// ```rust,ignore
    /// Schedule::job("quick_check", handler)
    ///     .every_minutes(5)  // Every 5 minutes
    /// ```
    pub fn every_minutes(mut self, minutes: u32) -> Self {
        self.cron_expression = Some(format!("0 */{} * * * *", minutes));
        self
    }

    /// Run every N hours
    ///
    /// # Example
    /// ```rust,ignore
    /// Schedule::job("sync_job", handler)
    ///     .every_hours(4)  // Every 4 hours
    /// ```
    pub fn every_hours(mut self, hours: u32) -> Self {
        self.cron_expression = Some(format!("0 0 */{} * * *", hours));
        self
    }

    /// Register this schedule with the scheduler
    pub async fn register(
        self,
        scheduler: &JobScheduler,
        db: Pool<Postgres>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let cron_expr = self.cron_expression.ok_or("No cron expression set")?;
        let name = self.name.clone();
        let job_fn = self.job_fn.clone();

        info!(
            "Registering cron job '{}' with schedule: {}",
            name, cron_expr
        );

        let job = Job::new_async(cron_expr.as_str(), move |_uuid, _lock| {
            let db = db.clone();
            let job_fn = job_fn.clone();
            let name = name.clone();
            Box::pin(async move {
                info!("Running cron job '{}'...", name);
                job_fn(db).await;
                info!("Cron job '{}' completed", name);
            })
        })?;

        scheduler.add(job).await?;
        Ok(())
    }
}

/// Convenience constants for common schedules
pub mod schedules {
    /// Every minute: "0 * * * * *"
    pub const EVERY_MINUTE: &str = "0 * * * * *";

    /// Every 2 minutes: "0 */2 * * * *"
    pub const EVERY_TWO_MINUTES: &str = "0 */2 * * * *";

    /// Every 5 minutes: "0 */5 * * * *"
    pub const EVERY_FIVE_MINUTES: &str = "0 */5 * * * *";

    /// Every 10 minutes: "0 */10 * * * *"
    pub const EVERY_TEN_MINUTES: &str = "0 */10 * * * *";

    /// Every 15 minutes: "0 */15 * * * *"
    pub const EVERY_FIFTEEN_MINUTES: &str = "0 */15 * * * *";

    /// Every 30 minutes: "0 */30 * * * *"
    pub const EVERY_THIRTY_MINUTES: &str = "0 */30 * * * *";

    /// Every hour: "0 0 * * * *"
    pub const HOURLY: &str = "0 0 * * * *";

    /// Every 4 hours: "0 0 */4 * * *"
    pub const EVERY_FOUR_HOURS: &str = "0 0 */4 * * *";

    /// Daily at midnight: "0 0 0 * * *"
    pub const DAILY: &str = "0 0 0 * * *";

    /// Weekly (Sunday midnight): "0 0 0 * * 0"
    pub const WEEKLY: &str = "0 0 0 * * 0";

    /// Monthly (1st at midnight): "0 0 0 1 * *"
    pub const MONTHLY: &str = "0 0 0 1 * *";
}
