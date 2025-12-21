use crate::db::read::user;
use sqlx::{Pool, Postgres};
use tracing::info;

pub async fn count_users(db: &Pool<Postgres>) -> i64 {
    let count = user::count(db).await;
    info!("User count: {}", count);
    count
}
