//! Session Refresh Token Mutations
//!
//! Database write operations for session refresh tokens.
//! Used for "Keep me logged in" functionality.

use chrono::{Duration, Utc};
use sha2::{Digest, Sha256};
use sqlx::{Pool, Postgres};

use crate::config::JwtConfig;

/// Generate a secure random refresh token
pub fn generate_token() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    (0..64)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Hash a refresh token using SHA-256
pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Get the last 8 characters of a token for display hint
pub fn get_token_hint(token: &str) -> String {
    if token.len() >= 8 {
        token[token.len() - 8..].to_string()
    } else {
        token.to_string()
    }
}

/// Create a new session refresh token
///
/// Returns the raw token (to be sent to client) - never stored in DB
pub async fn create(
    db: &Pool<Postgres>,
    user_id: i64,
    device_info: Option<&str>,
    ip_address: Option<&str>,
) -> Result<String, sqlx::Error> {
    let token = generate_token();
    let token_hash = hash_token(&token);
    let token_hint = get_token_hint(&token);
    let expires_at = Utc::now() + Duration::days(JwtConfig::refresh_expiration_days());

    sqlx::query!(
        r#"
        INSERT INTO session_refresh_tokens
            (token_hash, token_hint, user_id, device_info, ip_address, expires_at, created_at)
        VALUES
            ($1, $2, $3, $4, $5, $6, NOW())
        "#,
        token_hash,
        token_hint,
        user_id,
        device_info,
        ip_address,
        expires_at
    )
    .execute(db)
    .await?;

    Ok(token)
}

/// Revoke a refresh token by its hash
pub async fn revoke_by_hash(db: &Pool<Postgres>, token_hash: &str) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE session_refresh_tokens
        SET is_revoked = TRUE, revoked_at = NOW()
        WHERE token_hash = $1
        "#,
        token_hash
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Revoke all refresh tokens for a user (logout from all devices)
pub async fn revoke_all_for_user(db: &Pool<Postgres>, user_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        UPDATE session_refresh_tokens
        SET is_revoked = TRUE, revoked_at = NOW()
        WHERE user_id = $1 AND is_revoked = FALSE
        "#,
        user_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Update last_used_at timestamp when a token is used
pub async fn update_last_used(db: &Pool<Postgres>, token_hash: &str) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE session_refresh_tokens
        SET last_used_at = NOW()
        WHERE token_hash = $1
        "#,
        token_hash
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete a specific refresh token by its hash
pub async fn delete_by_hash(db: &Pool<Postgres>, token_hash: &str) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM session_refresh_tokens
        WHERE token_hash = $1
        "#,
        token_hash
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete all expired tokens (cleanup job)
pub async fn delete_expired(db: &Pool<Postgres>) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        DELETE FROM session_refresh_tokens
        WHERE expires_at < NOW()
        "#
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Delete all revoked tokens older than given days (cleanup job)
pub async fn delete_old_revoked(db: &Pool<Postgres>, days: i64) -> Result<u64, sqlx::Error> {
    let cutoff = Utc::now() - Duration::days(days);

    let result = sqlx::query!(
        r#"
        DELETE FROM session_refresh_tokens
        WHERE is_revoked = TRUE AND revoked_at < $1
        "#,
        cutoff
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}
