use sqlx::{Pool, Postgres};
use tracing::info;

pub async fn count_users(db: &Pool<Postgres>) -> i64 {
    let result = sqlx::query_scalar!("SELECT COUNT(*) FROM users")
        .fetch_one(db)
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0);

    info!("User count: {}", result);

    result
}
