//! Game User Mutes Read Queries
//!
//! Read operations for the game_user_mutes table.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};

/// Muted user record
#[derive(Debug, Clone)]
pub struct MutedUserRecord {
    pub muted_user_id: i64,
    pub room_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Check if a user has muted another user (considers both global and room-specific mutes)
pub async fn is_user_muted(
    db: &Pool<Postgres>,
    muter_user_id: i64,
    muted_user_id: i64,
    room_id: Option<&str>,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_is_user_muted($1, $2, $3) as "is_muted!""#,
        muter_user_id,
        muted_user_id,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Get all users muted by a specific user (for a specific room context)
pub async fn get_muted_users(
    db: &Pool<Postgres>,
    user_id: i64,
    room_id: Option<&str>,
) -> Result<Vec<MutedUserRecord>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"SELECT * FROM sp_get_muted_users($1, $2)"#,
        user_id,
        room_id
    )
    .fetch_all(db)
    .await?;

    Ok(rows
        .into_iter()
        .filter_map(|row| {
            Some(MutedUserRecord {
                muted_user_id: row.muted_user_id?,
                room_id: row.room_id,
                created_at: row.created_at?,
            })
        })
        .collect())
}

/// Get list of muted user IDs only (for filtering in-memory)
pub async fn get_muted_user_ids(
    db: &Pool<Postgres>,
    user_id: i64,
    room_id: Option<&str>,
) -> Result<Vec<i64>, sqlx::Error> {
    let muted = get_muted_users(db, user_id, room_id).await?;
    Ok(muted.into_iter().map(|m| m.muted_user_id).collect())
}

/// Count how many users a user has muted
pub async fn count_muted_by_user(
    db: &Pool<Postgres>,
    user_id: i64,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM game_user_mutes
        WHERE muter_user_id = $1
        "#,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Count how many times a user has been muted (for analytics/moderation)
pub async fn count_times_muted(
    db: &Pool<Postgres>,
    user_id: i64,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM game_user_mutes
        WHERE muted_user_id = $1
        "#,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Check if user has a global mute on another user
pub async fn has_global_mute(
    db: &Pool<Postgres>,
    muter_user_id: i64,
    muted_user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
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

    Ok(result)
}
