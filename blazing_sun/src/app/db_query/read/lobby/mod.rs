//! Lobby read queries
//!
//! Provides functions to query lobbies and public messages from PostgreSQL.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres, Row};

/// Lobby information
#[derive(Debug, Clone)]
pub struct Lobby {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub max_messages: i32,
    pub created_at: DateTime<Utc>,
}

/// Lobby summary with message count
#[derive(Debug, Clone)]
pub struct LobbySummary {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub message_count: i64,
}

/// Lobby message
#[derive(Debug, Clone)]
pub struct LobbyMessage {
    pub id: i64,
    pub lobby_id: i64,
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub content: String,
    pub message_type: String,
    pub created_at: DateTime<Utc>,
}

/// Get lobby by name
pub async fn get_by_name(db: &Pool<Postgres>, name: &str) -> Option<Lobby> {
    let row = sqlx::query(
        "SELECT * FROM get_lobby_by_name($1)"
    )
    .bind(name)
    .fetch_optional(db)
    .await
    .ok()?;

    row.map(|r| Lobby {
        id: r.get("id"),
        name: r.get("name"),
        description: r.get("description"),
        is_active: r.get("is_active"),
        max_messages: r.get("max_messages"),
        created_at: r.get("created_at"),
    })
}

/// Get lobby by ID
pub async fn get_by_id(db: &Pool<Postgres>, id: i64) -> Option<Lobby> {
    sqlx::query_as!(
        Lobby,
        "SELECT id, name, description, is_active, max_messages, created_at
         FROM lobbies WHERE id = $1 AND is_active = TRUE",
        id
    )
    .fetch_optional(db)
    .await
    .ok()
    .flatten()
}

/// Get all active lobbies
pub async fn get_all_active(db: &Pool<Postgres>) -> Vec<LobbySummary> {
    let rows = sqlx::query(
        "SELECT * FROM get_active_lobbies()"
    )
    .fetch_all(db)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|row| LobbySummary {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            message_count: row.get("message_count"),
        })
        .collect()
}

/// Get recent messages from a lobby
pub async fn get_messages(
    db: &Pool<Postgres>,
    lobby_id: i64,
    limit: i32,
    before_id: Option<i64>,
) -> Vec<LobbyMessage> {
    let rows = sqlx::query(
        "SELECT * FROM get_lobby_messages($1, $2, $3)"
    )
    .bind(lobby_id)
    .bind(limit)
    .bind(before_id)
    .fetch_all(db)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|row| LobbyMessage {
            id: row.get("id"),
            lobby_id: row.get("lobby_id"),
            user_id: row.get("user_id"),
            username: row.get("username"),
            avatar_id: row.get("avatar_id"),
            content: row.get("content"),
            message_type: row.get("message_type"),
            created_at: row.get("created_at"),
        })
        .collect()
}

/// Count messages in a lobby
pub async fn count_messages(db: &Pool<Postgres>, lobby_id: i64) -> i64 {
    sqlx::query_scalar!(
        "SELECT COUNT(*) FROM lobby_messages WHERE lobby_id = $1 AND is_deleted = FALSE",
        lobby_id
    )
    .fetch_one(db)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0)
}

/// Check if lobby exists and is active
pub async fn exists(db: &Pool<Postgres>, lobby_id: i64) -> bool {
    sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM lobbies WHERE id = $1 AND is_active = TRUE)",
        lobby_id
    )
    .fetch_one(db)
    .await
    .unwrap_or(Some(false))
    .unwrap_or(false)
}
