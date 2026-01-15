//! Lobby mutation queries
//!
//! Provides functions to mutate lobbies and public messages in PostgreSQL.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres, Row};

/// Result of sending a lobby message
#[derive(Debug, Clone)]
pub struct SentMessage {
    pub id: i64,
    pub lobby_id: i64,
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub content: String,
    pub message_type: String,
    pub created_at: DateTime<Utc>,
}

/// Lobby creation result
#[derive(Debug, Clone)]
pub struct CreatedLobby {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub max_messages: i32,
    pub created_at: DateTime<Utc>,
}

/// Send a message to a lobby
pub async fn send_message(
    db: &Pool<Postgres>,
    lobby_id: i64,
    user_id: i64,
    content: &str,
    message_type: Option<&str>,
) -> Result<SentMessage, sqlx::Error> {
    let msg_type = message_type.unwrap_or("text");

    let row = sqlx::query(
        "SELECT * FROM send_lobby_message($1, $2, $3, $4)"
    )
    .bind(lobby_id)
    .bind(user_id)
    .bind(content)
    .bind(msg_type)
    .fetch_one(db)
    .await?;

    Ok(SentMessage {
        id: row.get("id"),
        lobby_id: row.get("lobby_id"),
        user_id: row.get("user_id"),
        username: row.get("username"),
        avatar_id: row.get("avatar_id"),
        content: row.get("content"),
        message_type: row.get("message_type"),
        created_at: row.get("created_at"),
    })
}

/// Delete a lobby message (soft delete)
pub async fn delete_message(
    db: &Pool<Postgres>,
    message_id: i64,
    deleted_by: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        "SELECT delete_lobby_message($1, $2)",
        message_id,
        deleted_by
    )
    .fetch_one(db)
    .await?;

    Ok(result.unwrap_or(false))
}

/// Create a new lobby (admin only)
pub async fn create_lobby(
    db: &Pool<Postgres>,
    name: &str,
    description: Option<&str>,
    max_messages: Option<i32>,
) -> Result<CreatedLobby, sqlx::Error> {
    let max_msgs = max_messages.unwrap_or(1000);

    let row = sqlx::query(
        "SELECT * FROM create_lobby($1, $2, $3)"
    )
    .bind(name)
    .bind(description)
    .bind(max_msgs)
    .fetch_one(db)
    .await?;

    Ok(CreatedLobby {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        max_messages: row.get("max_messages"),
        created_at: row.get("created_at"),
    })
}

/// Deactivate a lobby (soft delete)
pub async fn deactivate_lobby(db: &Pool<Postgres>, lobby_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        "UPDATE lobbies SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
        lobby_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Cleanup old deleted messages (for cron job)
pub async fn cleanup_deleted_messages(db: &Pool<Postgres>, days_old: i32) -> i32 {
    let result = sqlx::query_scalar!(
        "SELECT cleanup_deleted_lobby_messages($1)",
        days_old
    )
    .fetch_one(db)
    .await;

    result.unwrap_or(Some(0)).unwrap_or(0)
}
