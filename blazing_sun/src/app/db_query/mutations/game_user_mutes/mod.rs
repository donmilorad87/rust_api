//! Game User Mutes Mutation Queries
//!
//! Write operations for the game_user_mutes table.

use sqlx::{Pool, Postgres};

/// Mute a user (global or room-specific)
/// Returns the mute ID if successful, None if already muted
pub async fn mute_user(
    db: &Pool<Postgres>,
    muter_user_id: i64,
    muted_user_id: i64,
    room_id: Option<&str>,
) -> Result<Option<i64>, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_mute_user($1, $2, $3) as "id""#,
        muter_user_id,
        muted_user_id,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Unmute a user (global or room-specific)
pub async fn unmute_user(
    db: &Pool<Postgres>,
    muter_user_id: i64,
    muted_user_id: i64,
    room_id: Option<&str>,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_unmute_user($1, $2, $3) as "success!""#,
        muter_user_id,
        muted_user_id,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Unmute all users muted by a user (clear all mutes)
pub async fn unmute_all(db: &Pool<Postgres>, muter_user_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM game_user_mutes
        WHERE muter_user_id = $1
        "#,
        muter_user_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Unmute all users in a specific room
pub async fn unmute_all_in_room(
    db: &Pool<Postgres>,
    muter_user_id: i64,
    room_id: &str,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM game_user_mutes
        WHERE muter_user_id = $1 AND room_id = $2
        "#,
        muter_user_id,
        room_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Cleanup room-specific mutes when room is deleted
pub async fn cleanup_room_mutes(db: &Pool<Postgres>, room_id: &str) -> Result<i32, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_cleanup_room_mutes($1) as "count!""#,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Transfer room-specific mutes to global mutes (when user wants to persist mute)
pub async fn upgrade_to_global_mute(
    db: &Pool<Postgres>,
    muter_user_id: i64,
    muted_user_id: i64,
    room_id: &str,
) -> Result<bool, sqlx::Error> {
    // First check if global mute already exists
    let exists = sqlx::query_scalar!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM game_user_mutes
            WHERE muter_user_id = $1
            AND muted_user_id = $2
            AND room_id IS NULL
        ) as "exists!"
        "#,
        muter_user_id,
        muted_user_id
    )
    .fetch_one(db)
    .await?;

    if exists {
        // Already has global mute, just delete the room-specific one
        sqlx::query!(
            r#"
            DELETE FROM game_user_mutes
            WHERE muter_user_id = $1 AND muted_user_id = $2 AND room_id = $3
            "#,
            muter_user_id,
            muted_user_id,
            room_id
        )
        .execute(db)
        .await?;
        return Ok(true);
    }

    // Update room-specific to global by setting room_id to NULL
    let result = sqlx::query!(
        r#"
        UPDATE game_user_mutes
        SET room_id = NULL
        WHERE muter_user_id = $1 AND muted_user_id = $2 AND room_id = $3
        "#,
        muter_user_id,
        muted_user_id,
        room_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}
