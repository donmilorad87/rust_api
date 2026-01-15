//! User Counter Cron Job
//!
//! Counts total users in the database.

use crate::database::read::user;
use sqlx::{Pool, Postgres};
use tracing::info;

/// Run the user counter job
pub async fn run(db: Pool<Postgres>) {
    let count = user::count(&db).await;
    info!("User count: {}", count);
}
