//!
//! Cron Schedule Definitions
//!
//! Define all your scheduled cron jobs here.
//!
//! # Example
//! ```rust,ignore
//! // Every minute
//! Schedule::job("user_counter", user_counter::run)
//!     .cron("0 * * * * *")
//!     .register(&scheduler, db.clone()).await;
//!
//! // Every day at 3 AM
//! Schedule::job("daily_report", report::run)
//!     .daily_at("03:00")
//!     .register(&scheduler, db.clone()).await;
//!
//! // Every hour at :30
//! Schedule::job("hourly_sync", sync::run)
//!     .hourly_at("30")
//!     .register(&scheduler, db.clone()).await;
//!
//! // Monthly on the 1st
//! Schedule::job("monthly_report", report::run)
//!     .monthly_at("01")
//!     .register(&scheduler, db.clone()).await;
//! ```
//!
//!
use crate::app::cron::{list_user_emails, user_counter};
use crate::bootstrap::routes::controller::crons::{schedules, Schedule};
use crate::config::CronConfig;
use sqlx::{Pool, Postgres};
use tokio_cron_scheduler::JobScheduler;
use tracing::error;

/// Register all cron schedules
///
/// This is called from `crons/mod.rs` during initialization.
/// Add your cron job schedules here.
pub async fn register(scheduler: &JobScheduler, db: Pool<Postgres>) {
    // =========================================================================
    // Cron Schedules
    // =========================================================================

    // User counter - runs every minute (from config)
    if let Err(e) = Schedule::job("user_counter", user_counter::run)
        .cron(CronConfig::user_counter())
        .register(scheduler, db.clone())
        .await
    {
        error!("Failed to register user_counter: {}", e);
    }

    // List user emails - runs every 2 minutes
    if let Err(e) = Schedule::job("list_user_emails", list_user_emails::run)
        .cron(schedules::EVERY_TWO_MINUTES)
        .register(scheduler, db.clone())
        .await
    {
        error!("Failed to register list_user_emails: {}", e);
    }

    // =========================================================================
    // Add more cron jobs below:
    // =========================================================================

    // // Daily cleanup at 3 AM
    // Schedule::job("daily_cleanup", cleanup::run)
    //     .daily_at("03:00")
    //     .register(scheduler, db.clone()).await;

    // // Hourly sync at :30
    // Schedule::job("hourly_sync", sync::run)
    //     .hourly_at("30")
    //     .register(scheduler, db.clone()).await;

    // // Monthly report on the 1st
    // Schedule::job("monthly_report", report::run)
    //     .monthly_at("01")
    //     .register(scheduler, db.clone()).await;

    // // Every 5 minutes
    // Schedule::job("quick_check", check::run)
    //     .every_minutes(5)
    //     .register(scheduler, db.clone()).await;

    // // Every 4 hours
    // Schedule::job("sync_external", external::run)
    //     .every_hours(4)
    //     .register(scheduler, db.clone()).await;
}
