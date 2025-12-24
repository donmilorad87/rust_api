//! List User Emails Cron Job
//!
//! Lists all user emails in the database.
//! Runs every 2 minutes.

use crate::database::read::user;
use sqlx::{Pool, Postgres};
use tracing::info;

/// Run the list user emails job
pub async fn run(db: Pool<Postgres>) {
    let emails = user::get_all_emails(&db).await;

    if emails.is_empty() {
        info!("No users found in database");
        return;
    }

    info!("Found {} user(s):", emails.len());
    for (index, email) in emails.iter().enumerate() {
        info!("  {}. {}", index + 1, email);
    }
}
