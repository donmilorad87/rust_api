//! Game Player Disconnects Mutation Queries
//!
//! Write operations for the game_player_disconnects table.

use sqlx::{Pool, Postgres};

/// Record a player disconnect (called when player loses WebSocket connection)
pub async fn record_disconnect(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
    timeout_seconds: Option<i32>,
) -> Result<i64, sqlx::Error> {
    let timeout = timeout_seconds.unwrap_or(30);
    let result = sqlx::query_scalar!(
        r#"SELECT sp_record_player_disconnect($1, $2, $3) as "id!""#,
        room_id,
        user_id,
        timeout
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Mark player as reconnected (called when player reconnects)
pub async fn mark_reconnected(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_player_reconnected($1, $2) as "success!""#,
        room_id,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Mark a disconnect as processed (player was deselected)
pub async fn mark_deselected(db: &Pool<Postgres>, disconnect_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_mark_disconnect_deselected($1) as "success!""#,
        disconnect_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Cleanup old disconnect records
pub async fn cleanup_old(
    db: &Pool<Postgres>,
    older_than_hours: Option<i32>,
) -> Result<i32, sqlx::Error> {
    let hours = older_than_hours.unwrap_or(24);
    let result = sqlx::query_scalar!(
        r#"SELECT sp_cleanup_old_disconnects($1) as "count!""#,
        hours
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Delete disconnect record for a specific player (manual cleanup)
pub async fn delete_for_player(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM game_player_disconnects
        WHERE room_id = $1 AND user_id = $2
        "#,
        room_id,
        user_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Delete all disconnect records for a room (cleanup when room closes)
pub async fn delete_for_room(db: &Pool<Postgres>, room_id: &str) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM game_player_disconnects
        WHERE room_id = $1
        "#,
        room_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}
