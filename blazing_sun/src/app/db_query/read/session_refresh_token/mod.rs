//! Session Refresh Token Read Queries
//!
//! Database read operations for session refresh tokens.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

/// Session refresh token record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRefreshToken {
    pub id: i64,
    pub token_hash: String,
    pub token_hint: String,
    pub user_id: i64,
    pub device_info: Option<String>,
    pub ip_address: Option<String>,
    pub is_revoked: bool,
    pub revoked_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Get a refresh token by its hash
pub async fn get_by_hash(
    db: &Pool<Postgres>,
    token_hash: &str,
) -> Result<SessionRefreshToken, sqlx::Error> {
    sqlx::query_as!(
        SessionRefreshToken,
        r#"
        SELECT
            id,
            token_hash,
            token_hint,
            user_id,
            device_info,
            ip_address,
            is_revoked,
            revoked_at,
            expires_at,
            last_used_at,
            created_at
        FROM session_refresh_tokens
        WHERE token_hash = $1
        LIMIT 1
        "#,
        token_hash
    )
    .fetch_one(db)
    .await
}

/// Get a valid (not revoked, not expired) refresh token by its hash
pub async fn get_valid_by_hash(
    db: &Pool<Postgres>,
    token_hash: &str,
) -> Result<SessionRefreshToken, sqlx::Error> {
    sqlx::query_as!(
        SessionRefreshToken,
        r#"
        SELECT
            id,
            token_hash,
            token_hint,
            user_id,
            device_info,
            ip_address,
            is_revoked,
            revoked_at,
            expires_at,
            last_used_at,
            created_at
        FROM session_refresh_tokens
        WHERE token_hash = $1
          AND is_revoked = FALSE
          AND expires_at > NOW()
        LIMIT 1
        "#,
        token_hash
    )
    .fetch_one(db)
    .await
}

/// Get all active (not revoked, not expired) refresh tokens for a user
/// Useful for "Manage Sessions" UI
pub async fn get_active_by_user(
    db: &Pool<Postgres>,
    user_id: i64,
) -> Result<Vec<SessionRefreshToken>, sqlx::Error> {
    sqlx::query_as!(
        SessionRefreshToken,
        r#"
        SELECT
            id,
            token_hash,
            token_hint,
            user_id,
            device_info,
            ip_address,
            is_revoked,
            revoked_at,
            expires_at,
            last_used_at,
            created_at
        FROM session_refresh_tokens
        WHERE user_id = $1
          AND is_revoked = FALSE
          AND expires_at > NOW()
        ORDER BY created_at DESC
        "#,
        user_id
    )
    .fetch_all(db)
    .await
}

/// Count active sessions for a user
pub async fn count_active_for_user(db: &Pool<Postgres>, user_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM session_refresh_tokens
        WHERE user_id = $1
          AND is_revoked = FALSE
          AND expires_at > NOW()
        "#,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.count)
}

/// Check if a token hash exists and is valid
pub async fn is_valid_token(db: &Pool<Postgres>, token_hash: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM session_refresh_tokens
            WHERE token_hash = $1
              AND is_revoked = FALSE
              AND expires_at > NOW()
        ) as "exists!"
        "#,
        token_hash
    )
    .fetch_one(db)
    .await?;

    Ok(result.exists)
}
