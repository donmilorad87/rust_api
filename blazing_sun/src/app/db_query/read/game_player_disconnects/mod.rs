//! Game Player Disconnects Read Queries
//!
//! Read operations for the game_player_disconnects table.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};

/// Expired disconnect record for auto-deselection
#[derive(Debug, Clone)]
pub struct ExpiredDisconnectRecord {
    pub id: i64,
    pub room_id: String,
    pub user_id: i64,
    pub disconnected_at: DateTime<Utc>,
}

/// Get all expired disconnects that need auto-deselection
pub async fn get_expired_disconnects(
    db: &Pool<Postgres>,
) -> Result<Vec<ExpiredDisconnectRecord>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"SELECT * FROM sp_get_expired_disconnects()"#
    )
    .fetch_all(db)
    .await?;

    Ok(rows
        .into_iter()
        .filter_map(|row| {
            Some(ExpiredDisconnectRecord {
                id: row.id?,
                room_id: row.room_id?,
                user_id: row.user_id?,
                disconnected_at: row.disconnected_at?,
            })
        })
        .collect())
}

/// Check if a player has a pending disconnect (not deselected, not reconnected)
pub async fn has_pending_disconnect(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM game_player_disconnects
            WHERE room_id = $1 AND user_id = $2
            AND NOT deselected AND NOT reconnected
        ) as "exists!"
        "#,
        room_id,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Get disconnect record for a player
pub async fn get_disconnect(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<Option<(i64, DateTime<Utc>, i32, bool, bool)>, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        SELECT id, disconnected_at, timeout_seconds, deselected, reconnected
        FROM game_player_disconnects
        WHERE room_id = $1 AND user_id = $2
        "#,
        room_id,
        user_id
    )
    .fetch_optional(db)
    .await?;

    Ok(row.map(|r| (r.id, r.disconnected_at, r.timeout_seconds, r.deselected, r.reconnected)))
}

/// Count pending disconnects in a room
pub async fn count_pending_in_room(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM game_player_disconnects
        WHERE room_id = $1
        AND NOT deselected AND NOT reconnected
        "#,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Get all pending disconnects for a room
pub async fn get_pending_in_room(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<Vec<(i64, i64, DateTime<Utc>, i32)>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        SELECT id, user_id, disconnected_at, timeout_seconds
        FROM game_player_disconnects
        WHERE room_id = $1
        AND NOT deselected AND NOT reconnected
        ORDER BY disconnected_at ASC
        "#,
        room_id
    )
    .fetch_all(db)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| (r.id, r.user_id, r.disconnected_at, r.timeout_seconds))
        .collect())
}
