//! OAuth Authorization Read Queries
//!
//! Read operations for authorization codes, consent grants, and refresh tokens.

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

// ============================================================================
// Structs
// ============================================================================

/// Authorization Code
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OAuthAuthorizationCode {
    pub id: i64,
    pub code: String,
    pub client_id: i64,
    pub user_id: i64,
    pub redirect_uri: String,
    pub scopes: Vec<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub is_used: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Consent Grant
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OAuthConsentGrant {
    pub id: i64,
    pub user_id: i64,
    pub client_id: i64,
    pub granted_scopes: Vec<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Refresh Token
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OAuthRefreshToken {
    pub id: i64,
    pub token_hash: String,
    pub token_hint: String,
    pub client_id: i64,
    pub user_id: i64,
    pub scopes: Vec<String>,
    pub token_family_id: String,
    pub parent_token_id: Option<i64>,
    pub is_revoked: bool,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ============================================================================
// Authorization Code Queries
// ============================================================================

/// Get authorization code by code string
pub async fn get_authorization_code_by_code(
    db: &Pool<Postgres>,
    code: &str,
) -> Result<Option<OAuthAuthorizationCode>, sqlx::Error> {
    sqlx::query_as!(
        OAuthAuthorizationCode,
        r#"
        SELECT id, code, client_id, user_id, redirect_uri, scopes,
               code_challenge, code_challenge_method, expires_at, is_used, created_at
        FROM oauth_authorization_codes
        WHERE code = $1
        "#,
        code
    )
    .fetch_optional(db)
    .await
}

/// Check if authorization code is valid (not used, not expired)
pub async fn is_authorization_code_valid(
    db: &Pool<Postgres>,
    code: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM oauth_authorization_codes
            WHERE code = $1
              AND is_used = false
              AND expires_at > NOW()
        ) as "exists!"
        "#,
        code
    )
    .fetch_one(db)
    .await?;

    Ok(result.exists)
}

// ============================================================================
// Consent Grant Queries
// ============================================================================

/// Get consent grant for user and client
pub async fn get_consent_grant(
    db: &Pool<Postgres>,
    user_id: i64,
    client_id: i64,
) -> Result<Option<OAuthConsentGrant>, sqlx::Error> {
    sqlx::query_as!(
        OAuthConsentGrant,
        r#"
        SELECT id, user_id, client_id, granted_scopes, created_at, updated_at
        FROM oauth_consent_grants
        WHERE user_id = $1 AND client_id = $2
        "#,
        user_id,
        client_id
    )
    .fetch_optional(db)
    .await
}

/// Check if user has granted consent to client with specific scopes
pub async fn has_consent_for_scopes(
    db: &Pool<Postgres>,
    user_id: i64,
    client_id: i64,
    requested_scopes: &[String],
) -> Result<bool, sqlx::Error> {
    // Get the existing consent grant
    let consent = get_consent_grant(db, user_id, client_id).await?;

    match consent {
        Some(grant) => {
            // Check if all requested scopes are in the granted scopes
            let all_scopes_granted = requested_scopes
                .iter()
                .all(|req_scope| grant.granted_scopes.contains(req_scope));

            Ok(all_scopes_granted)
        }
        None => Ok(false),
    }
}

/// Get all consent grants for a user
pub async fn get_user_consent_grants(
    db: &Pool<Postgres>,
    user_id: i64,
) -> Result<Vec<OAuthConsentGrant>, sqlx::Error> {
    sqlx::query_as!(
        OAuthConsentGrant,
        r#"
        SELECT id, user_id, client_id, granted_scopes, created_at, updated_at
        FROM oauth_consent_grants
        WHERE user_id = $1
        ORDER BY updated_at DESC
        "#,
        user_id
    )
    .fetch_all(db)
    .await
}

// ============================================================================
// Refresh Token Queries
// ============================================================================

/// Get refresh token by token hash
pub async fn get_refresh_token_by_hash(
    db: &Pool<Postgres>,
    token_hash: &str,
) -> Result<Option<OAuthRefreshToken>, sqlx::Error> {
    sqlx::query_as!(
        OAuthRefreshToken,
        r#"
        SELECT id, token_hash, token_hint, client_id, user_id, scopes, token_family_id,
               parent_token_id, is_revoked, expires_at, created_at
        FROM oauth_refresh_tokens
        WHERE token_hash = $1
        "#,
        token_hash
    )
    .fetch_optional(db)
    .await
}

/// Check if refresh token is valid (not revoked, not expired)
pub async fn is_refresh_token_valid(
    db: &Pool<Postgres>,
    token_hash: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM oauth_refresh_tokens
            WHERE token_hash = $1
              AND is_revoked = false
              AND expires_at > NOW()
        ) as "exists!"
        "#,
        token_hash
    )
    .fetch_one(db)
    .await?;

    Ok(result.exists)
}

/// Get all tokens in a token family
pub async fn get_token_family(
    db: &Pool<Postgres>,
    token_family_id: &str,
) -> Result<Vec<OAuthRefreshToken>, sqlx::Error> {
    sqlx::query_as!(
        OAuthRefreshToken,
        r#"
        SELECT id, token_hash, token_hint, client_id, user_id, scopes, token_family_id,
               parent_token_id, is_revoked, expires_at, created_at
        FROM oauth_refresh_tokens
        WHERE token_family_id = $1
        ORDER BY created_at ASC
        "#,
        token_family_id
    )
    .fetch_all(db)
    .await
}

/// Check for refresh token reuse (parent token has been used to create a child)
pub async fn is_token_reused(db: &Pool<Postgres>, token_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM oauth_refresh_tokens
            WHERE parent_token_id = $1
        ) as "exists!"
        "#,
        token_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.exists)
}

/// Get user's active refresh tokens for a client
pub async fn get_user_active_refresh_tokens(
    db: &Pool<Postgres>,
    user_id: i64,
    client_id: i64,
) -> Result<Vec<OAuthRefreshToken>, sqlx::Error> {
    sqlx::query_as!(
        OAuthRefreshToken,
        r#"
        SELECT id, token_hash, token_hint, client_id, user_id, scopes, token_family_id,
               parent_token_id, is_revoked, expires_at, created_at
        FROM oauth_refresh_tokens
        WHERE user_id = $1
          AND client_id = $2
          AND is_revoked = false
          AND expires_at > NOW()
        ORDER BY created_at DESC
        "#,
        user_id,
        client_id
    )
    .fetch_all(db)
    .await
}

// ============================================================================
// Authorized Apps (User-facing) Queries
// ============================================================================

/// Authorized App - user-facing representation of an app they've authorized
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorizedApp {
    pub consent_id: i64,
    pub client_db_id: i64,
    pub client_id: String,
    pub client_name: String,
    pub client_description: Option<String>,
    pub logo_url: Option<String>,
    pub homepage_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub granted_scopes: Vec<String>,
    pub authorized_at: chrono::DateTime<chrono::Utc>,
    pub last_used_at: chrono::DateTime<chrono::Utc>,
}

/// Get all apps the user has authorized (with client details)
pub async fn get_user_authorized_apps(
    db: &Pool<Postgres>,
    user_id: i64,
) -> Result<Vec<AuthorizedApp>, sqlx::Error> {
    sqlx::query_as!(
        AuthorizedApp,
        r#"
        SELECT
            cg.id as consent_id,
            c.id as client_db_id,
            c.client_id,
            c.client_name,
            c.description as client_description,
            c.logo_url,
            c.homepage_url,
            c.privacy_policy_url,
            cg.granted_scopes,
            cg.created_at as authorized_at,
            cg.updated_at as last_used_at
        FROM oauth_consent_grants cg
        INNER JOIN oauth_clients c ON cg.client_id = c.id
        WHERE cg.user_id = $1
          AND cg.is_active = true
          AND c.is_active = true
        ORDER BY cg.updated_at DESC
        "#,
        user_id
    )
    .fetch_all(db)
    .await
}
