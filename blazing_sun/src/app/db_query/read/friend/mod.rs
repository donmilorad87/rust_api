//! Friend read queries
//!
//! Provides functions to query friend relationships from PostgreSQL.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres, Row};

/// Friend information returned from queries
#[derive(Debug, Clone)]
pub struct FriendInfo {
    pub friend_id: i64,
    pub friend_username: String,
    pub friend_first_name: String,
    pub friend_last_name: String,
    pub friend_avatar_id: Option<i64>,
    pub friendship_status: String,
    pub created_at: DateTime<Utc>,
}

/// Incoming friend request
#[derive(Debug, Clone)]
pub struct IncomingFriendRequest {
    pub requester_id: i64,
    pub requester_username: String,
    pub requester_first_name: String,
    pub requester_last_name: String,
    pub requester_avatar_id: Option<i64>,
    pub created_at: DateTime<Utc>,
}

/// Check if two users are friends (accepted status)
pub async fn are_friends(db: &Pool<Postgres>, user_id_1: i64, user_id_2: i64) -> bool {
    let result = sqlx::query_scalar!(
        "SELECT are_friends($1, $2)",
        user_id_1,
        user_id_2
    )
    .fetch_one(db)
    .await;

    result.unwrap_or(Some(false)).unwrap_or(false)
}

/// Check if a user has blocked another user
pub async fn is_blocked(db: &Pool<Postgres>, blocker_id: i64, blocked_id: i64) -> bool {
    let result = sqlx::query_scalar!(
        "SELECT is_blocked($1, $2)",
        blocker_id,
        blocked_id
    )
    .fetch_one(db)
    .await;

    result.unwrap_or(Some(false)).unwrap_or(false)
}

/// Check if a user can message another user (friends or admin bypass)
pub async fn can_message_user(db: &Pool<Postgres>, sender_id: i64, recipient_id: i64) -> bool {
    let result = sqlx::query_scalar!(
        "SELECT can_message_user($1, $2)",
        sender_id,
        recipient_id
    )
    .fetch_one(db)
    .await;

    result.unwrap_or(Some(false)).unwrap_or(false)
}

/// Get a user's friends list
pub async fn get_friends(
    db: &Pool<Postgres>,
    user_id: i64,
    status: Option<&str>,
) -> Vec<FriendInfo> {
    let rows = sqlx::query(
        "SELECT * FROM get_friends($1, $2)"
    )
    .bind(user_id)
    .bind(status.unwrap_or("accepted"))
    .fetch_all(db)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|row| FriendInfo {
            friend_id: row.get("friend_id"),
            friend_username: row.get("friend_username"),
            friend_first_name: row.get("friend_first_name"),
            friend_last_name: row.get("friend_last_name"),
            friend_avatar_id: row.get("friend_avatar_id"),
            friendship_status: row.get("friendship_status"),
            created_at: row.get("created_at"),
        })
        .collect()
}

/// Get incoming friend requests for a user
pub async fn get_incoming_requests(db: &Pool<Postgres>, user_id: i64) -> Vec<IncomingFriendRequest> {
    let rows = sqlx::query(
        "SELECT * FROM get_incoming_friend_requests($1)"
    )
    .bind(user_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|row| IncomingFriendRequest {
            requester_id: row.get("requester_id"),
            requester_username: row.get("requester_username"),
            requester_first_name: row.get("requester_first_name"),
            requester_last_name: row.get("requester_last_name"),
            requester_avatar_id: row.get("requester_avatar_id"),
            created_at: row.get("created_at"),
        })
        .collect()
}

/// Get friend IDs for a user (for batch operations)
pub async fn get_friend_ids(db: &Pool<Postgres>, user_id: i64) -> Vec<i64> {
    let result = sqlx::query_scalar!(
        "SELECT get_friend_ids($1)",
        user_id
    )
    .fetch_one(db)
    .await;

    result.unwrap_or(None).unwrap_or_default()
}

/// Count total friends for a user
pub async fn count_friends(db: &Pool<Postgres>, user_id: i64) -> i64 {
    sqlx::query_scalar!(
        "SELECT COUNT(*) FROM friends WHERE user_id = $1 AND status = 'accepted'",
        user_id
    )
    .fetch_one(db)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0)
}

/// Count pending incoming requests for a user
pub async fn count_pending_requests(db: &Pool<Postgres>, user_id: i64) -> i64 {
    sqlx::query_scalar!(
        "SELECT COUNT(*) FROM friends WHERE friend_id = $1 AND status = 'pending'",
        user_id
    )
    .fetch_one(db)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0)
}

/// Get friendship status between two users
pub async fn get_friendship_status(
    db: &Pool<Postgres>,
    user_id: i64,
    other_user_id: i64,
) -> Option<String> {
    let result = sqlx::query_scalar!(
        "SELECT status FROM friends WHERE user_id = $1 AND friend_id = $2",
        user_id,
        other_user_id
    )
    .fetch_optional(db)
    .await;

    result.ok().flatten()
}
