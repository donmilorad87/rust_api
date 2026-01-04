//! OAuth Authorization Mutation Queries
//!
//! Write operations for authorization codes, consent grants, and refresh tokens.

use sqlx::{Pool, Postgres};

// ============================================================================
// Parameter Structs
// ============================================================================

/// Parameters for creating an authorization code
pub struct CreateAuthorizationCodeParams {
    pub code: String,
    pub client_id: i64,
    pub user_id: i64,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

/// Parameters for creating a consent grant
pub struct CreateConsentGrantParams {
    pub user_id: i64,
    pub client_id: i64,
    pub granted_scopes: Vec<String>,
}

/// Parameters for creating a refresh token
pub struct CreateRefreshTokenParams {
    pub token_hash: String,
    pub token_hint: String,
    pub client_id: i64,
    pub user_id: i64,
    pub scopes: Vec<String>,
    pub token_family_id: String,
    pub parent_token_id: Option<i64>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

// ============================================================================
// Authorization Code Mutations
// ============================================================================

/// Create a new authorization code
pub async fn create_authorization_code(
    db: &Pool<Postgres>,
    params: &CreateAuthorizationCodeParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO oauth_authorization_codes (
            code, client_id, user_id, redirect_uri, scopes,
            code_challenge, code_challenge_method, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        "#,
        params.code,
        params.client_id,
        params.user_id,
        params.redirect_uri,
        &params.scopes,
        params.code_challenge,
        params.code_challenge_method,
        params.expires_at
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Mark authorization code as used
pub async fn mark_authorization_code_used(
    db: &Pool<Postgres>,
    code: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE oauth_authorization_codes
        SET is_used = true
        WHERE code = $1
        "#,
        code
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete authorization code
pub async fn delete_authorization_code(
    db: &Pool<Postgres>,
    code: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM oauth_authorization_codes
        WHERE code = $1
        "#,
        code
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete expired authorization codes (cleanup job)
pub async fn delete_expired_authorization_codes(db: &Pool<Postgres>) -> Result<u64, sqlx::Error> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        r#"
        DELETE FROM oauth_authorization_codes
        WHERE expires_at < NOW()
        "#
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

// ============================================================================
// Consent Grant Mutations
// ============================================================================

/// Create or update consent grant
/// If a consent grant already exists for this user+client, update the granted_scopes
pub async fn upsert_consent_grant(
    db: &Pool<Postgres>,
    params: &CreateConsentGrantParams,
) -> Result<i64, sqlx::Error> {
    // First, try to update existing active consent
    let updated = sqlx::query!(
        r#"
        UPDATE oauth_consent_grants
        SET granted_scopes = $3, updated_at = NOW()
        WHERE user_id = $1 AND client_id = $2 AND is_active = TRUE
        RETURNING id
        "#,
        params.user_id,
        params.client_id,
        &params.granted_scopes
    )
    .fetch_optional(db)
    .await?;

    if let Some(row) = updated {
        return Ok(row.id);
    }

    // If no active consent exists, insert new one
    let result = sqlx::query!(
        r#"
        INSERT INTO oauth_consent_grants (user_id, client_id, granted_scopes)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
        params.user_id,
        params.client_id,
        &params.granted_scopes
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Revoke consent grant
pub async fn revoke_consent_grant(
    db: &Pool<Postgres>,
    user_id: i64,
    client_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM oauth_consent_grants
        WHERE user_id = $1 AND client_id = $2
        "#,
        user_id,
        client_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Revoke all consent grants for a user
pub async fn revoke_all_user_consent_grants(
    db: &Pool<Postgres>,
    user_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM oauth_consent_grants
        WHERE user_id = $1
        "#,
        user_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Revoke all consent grants for a client
pub async fn revoke_all_client_consent_grants(
    db: &Pool<Postgres>,
    client_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM oauth_consent_grants
        WHERE client_id = $1
        "#,
        client_id
    )
    .execute(db)
    .await?;

    Ok(())
}

// ============================================================================
// Refresh Token Mutations
// ============================================================================

/// Create a new refresh token
pub async fn create_refresh_token(
    db: &Pool<Postgres>,
    params: &CreateRefreshTokenParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO oauth_refresh_tokens (
            token_hash, token_hint, client_id, user_id, scopes, token_family_id,
            parent_token_id, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        "#,
        params.token_hash,
        params.token_hint,
        params.client_id,
        params.user_id,
        &params.scopes,
        params.token_family_id,
        params.parent_token_id,
        params.expires_at
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Revoke a single refresh token
pub async fn revoke_refresh_token(
    db: &Pool<Postgres>,
    token_hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE oauth_refresh_tokens
        SET is_revoked = true, revoked_at = NOW()
        WHERE token_hash = $1
        "#,
        token_hash
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Revoke an entire token family (for reuse detection)
pub async fn revoke_token_family(
    db: &Pool<Postgres>,
    token_family_id: &str,
) -> Result<u64, sqlx::Error> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        r#"
        UPDATE oauth_refresh_tokens
        SET is_revoked = true, revoked_at = NOW()
        WHERE token_family_id = $1
        "#,
        token_family_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Revoke all refresh tokens for a user and client
pub async fn revoke_user_client_refresh_tokens(
    db: &Pool<Postgres>,
    user_id: i64,
    client_id: i64,
) -> Result<u64, sqlx::Error> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        r#"
        UPDATE oauth_refresh_tokens
        SET is_revoked = true, revoked_at = NOW()
        WHERE user_id = $1 AND client_id = $2
        "#,
        user_id,
        client_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Revoke all refresh tokens for a user
pub async fn revoke_all_user_refresh_tokens(
    db: &Pool<Postgres>,
    user_id: i64,
) -> Result<u64, sqlx::Error> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        r#"
        UPDATE oauth_refresh_tokens
        SET is_revoked = true, revoked_at = NOW()
        WHERE user_id = $1
        "#,
        user_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Revoke all refresh tokens for a client
pub async fn revoke_all_client_refresh_tokens(
    db: &Pool<Postgres>,
    client_id: i64,
) -> Result<u64, sqlx::Error> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        r#"
        UPDATE oauth_refresh_tokens
        SET is_revoked = true, revoked_at = NOW()
        WHERE client_id = $1
        "#,
        client_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Delete expired refresh tokens (cleanup job)
pub async fn delete_expired_refresh_tokens(db: &Pool<Postgres>) -> Result<u64, sqlx::Error> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        r#"
        DELETE FROM oauth_refresh_tokens
        WHERE expires_at < NOW()
        "#
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Delete revoked refresh tokens older than X days (cleanup job)
pub async fn delete_old_revoked_refresh_tokens(
    db: &Pool<Postgres>,
    days_old: i32,
) -> Result<u64, sqlx::Error> {
    let result: sqlx::postgres::PgQueryResult = sqlx::query!(
        r#"
        DELETE FROM oauth_refresh_tokens
        WHERE is_revoked = true
          AND created_at < NOW() - INTERVAL '1 day' * $1
        "#,
        days_old as f64
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}
