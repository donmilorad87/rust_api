//! Friend mutation queries
//!
//! Provides functions to mutate friend relationships in PostgreSQL.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres, Row};

/// Result of a friend request operation
#[derive(Debug, Clone)]
pub struct FriendRequestResult {
    pub id: i64,
    pub user_id: i64,
    pub friend_id: i64,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

/// Send a friend request (or auto-accept if mutual)
pub async fn send_request(
    db: &Pool<Postgres>,
    user_id: i64,
    friend_id: i64,
) -> Result<FriendRequestResult, sqlx::Error> {
    let row = sqlx::query(
        "SELECT * FROM send_friend_request($1, $2)"
    )
    .bind(user_id)
    .bind(friend_id)
    .fetch_one(db)
    .await?;

    Ok(FriendRequestResult {
        id: row.get("id"),
        user_id: row.get("user_id"),
        friend_id: row.get("friend_id"),
        status: row.get("status"),
        created_at: row.get("created_at"),
    })
}

/// Accept a friend request
pub async fn accept_request(
    db: &Pool<Postgres>,
    user_id: i64,
    friend_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        "SELECT accept_friend_request($1, $2)",
        user_id,
        friend_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.unwrap_or(false))
}

/// Remove a friend or decline a friend request
pub async fn remove_friend(
    db: &Pool<Postgres>,
    user_id: i64,
    friend_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        "SELECT remove_friend($1, $2)",
        user_id,
        friend_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.unwrap_or(false))
}

/// Block a user
pub async fn block_user(
    db: &Pool<Postgres>,
    user_id: i64,
    blocked_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        "SELECT block_user($1, $2)",
        user_id,
        blocked_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.unwrap_or(false))
}

/// Unblock a user
pub async fn unblock_user(
    db: &Pool<Postgres>,
    user_id: i64,
    blocked_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        "SELECT unblock_user($1, $2)",
        user_id,
        blocked_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.unwrap_or(false))
}
