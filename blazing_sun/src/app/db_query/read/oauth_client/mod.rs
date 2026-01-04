//! OAuth Client Read Queries
//!
//! Read operations for OAuth clients, secrets, URIs, domains, and related data.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

/// OAuth Client record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthClient {
    pub id: i64,
    pub user_id: i64,
    pub client_id: String,
    pub client_name: String,
    pub client_type: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub homepage_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub terms_of_service_url: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// OAuth Client with related counts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthClientWithCounts {
    pub id: i64,
    pub user_id: i64,
    pub client_id: String,
    pub client_name: String,
    pub client_type: String,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub homepage_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub terms_of_service_url: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub redirect_uri_count: i64,
    pub authorized_domain_count: i64,
    pub secret_count: i64,
}

/// OAuth Client Secret record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthClientSecret {
    pub id: i64,
    pub client_id: i64,
    pub secret_hash: String,
    pub secret_hint: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// OAuth Redirect URI record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthRedirectUri {
    pub id: i64,
    pub client_id: i64,
    pub redirect_uri: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// OAuth Authorized Domain record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthAuthorizedDomain {
    pub id: i64,
    pub client_id: i64,
    pub domain: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ============================================================================
// OAuth Client Queries
// ============================================================================

/// Get OAuth client by ID
pub async fn get_by_id(db: &Pool<Postgres>, client_db_id: i64) -> Result<OAuthClient, sqlx::Error> {
    sqlx::query_as!(
        OAuthClient,
        r#"
        SELECT id, user_id, client_id, client_name, client_type, description, logo_url,
               homepage_url, privacy_policy_url, terms_of_service_url, is_active,
               created_at, updated_at
        FROM oauth_clients
        WHERE id = $1
        "#,
        client_db_id
    )
    .fetch_one(db)
    .await
}

/// Get OAuth client by client_id string
pub async fn get_by_client_id(db: &Pool<Postgres>, client_id: &str) -> Result<OAuthClient, sqlx::Error> {
    sqlx::query_as!(
        OAuthClient,
        r#"
        SELECT id, user_id, client_id, client_name, client_type, description, logo_url,
               homepage_url, privacy_policy_url, terms_of_service_url, is_active,
               created_at, updated_at
        FROM oauth_clients
        WHERE client_id = $1
        "#,
        client_id
    )
    .fetch_one(db)
    .await
}

/// Get OAuth client by ID and user (ownership check)
pub async fn get_by_id_and_user(
    db: &Pool<Postgres>,
    client_db_id: i64,
    user_id: i64,
) -> Result<OAuthClient, sqlx::Error> {
    sqlx::query_as!(
        OAuthClient,
        r#"
        SELECT id, user_id, client_id, client_name, client_type, description, logo_url,
               homepage_url, privacy_policy_url, terms_of_service_url, is_active,
               created_at, updated_at
        FROM oauth_clients
        WHERE id = $1 AND user_id = $2
        "#,
        client_db_id,
        user_id
    )
    .fetch_one(db)
    .await
}

/// Get all OAuth clients for a user
pub async fn get_by_user(db: &Pool<Postgres>, user_id: i64) -> Result<Vec<OAuthClient>, sqlx::Error> {
    sqlx::query_as!(
        OAuthClient,
        r#"
        SELECT id, user_id, client_id, client_name, client_type, description, logo_url,
               homepage_url, privacy_policy_url, terms_of_service_url, is_active,
               created_at, updated_at
        FROM oauth_clients
        WHERE user_id = $1
        ORDER BY created_at DESC
        "#,
        user_id
    )
    .fetch_all(db)
    .await
}

/// Get all OAuth clients for a user with counts
pub async fn get_by_user_with_counts(
    db: &Pool<Postgres>,
    user_id: i64,
) -> Result<Vec<OAuthClientWithCounts>, sqlx::Error> {
    sqlx::query_as!(
        OAuthClientWithCounts,
        r#"
        SELECT
            c.id,
            c.user_id,
            c.client_id,
            c.client_name,
            c.client_type,
            c.description,
            c.logo_url,
            c.homepage_url,
            c.privacy_policy_url,
            c.terms_of_service_url,
            c.is_active,
            c.created_at,
            c.updated_at,
            COUNT(DISTINCT r.id) as "redirect_uri_count!",
            COUNT(DISTINCT d.id) as "authorized_domain_count!",
            COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = true) as "secret_count!"
        FROM oauth_clients c
        LEFT JOIN oauth_redirect_uris r ON c.id = r.client_id
        LEFT JOIN oauth_authorized_domains d ON c.id = d.client_id
        LEFT JOIN oauth_client_secrets s ON c.id = s.client_id
        WHERE c.user_id = $1
        GROUP BY c.id
        ORDER BY c.created_at DESC
        "#,
        user_id
    )
    .fetch_all(db)
    .await
}

/// Check if user owns OAuth client
pub async fn user_owns_client(
    db: &Pool<Postgres>,
    client_db_id: i64,
    user_id: i64,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM oauth_clients WHERE id = $1 AND user_id = $2) as "exists!""#,
        client_db_id,
        user_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if client_id exists (for validation)
pub async fn client_id_exists(db: &Pool<Postgres>, client_id: &str) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM oauth_clients WHERE client_id = $1) as "exists!""#,
        client_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Count OAuth clients for a user
pub async fn count_by_user(db: &Pool<Postgres>, user_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"SELECT COUNT(*) as "count!" FROM oauth_clients WHERE user_id = $1"#,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.count)
}

// ============================================================================
// OAuth Client Secrets Queries
// ============================================================================

/// Get all active secrets for a client
pub async fn get_secrets_by_client(
    db: &Pool<Postgres>,
    client_db_id: i64,
) -> Result<Vec<OAuthClientSecret>, sqlx::Error> {
    sqlx::query_as!(
        OAuthClientSecret,
        r#"
        SELECT id, client_id, secret_hash, secret_hint, description, is_active,
               last_used_at, expires_at, created_at
        FROM oauth_client_secrets
        WHERE client_id = $1 AND is_active = true
        ORDER BY created_at DESC
        "#,
        client_db_id
    )
    .fetch_all(db)
    .await
}

/// Get secret by ID
pub async fn get_secret_by_id(
    db: &Pool<Postgres>,
    secret_id: i64,
) -> Result<OAuthClientSecret, sqlx::Error> {
    sqlx::query_as!(
        OAuthClientSecret,
        r#"
        SELECT id, client_id, secret_hash, secret_hint, description, is_active,
               last_used_at, expires_at, created_at
        FROM oauth_client_secrets
        WHERE id = $1
        "#,
        secret_id
    )
    .fetch_one(db)
    .await
}

// ============================================================================
// OAuth Redirect URIs Queries
// ============================================================================

/// Get all redirect URIs for a client
pub async fn get_redirect_uris_by_client(
    db: &Pool<Postgres>,
    client_db_id: i64,
) -> Result<Vec<OAuthRedirectUri>, sqlx::Error> {
    sqlx::query_as!(
        OAuthRedirectUri,
        r#"
        SELECT id, client_id, redirect_uri, description, created_at
        FROM oauth_redirect_uris
        WHERE client_id = $1
        ORDER BY created_at ASC
        "#,
        client_db_id
    )
    .fetch_all(db)
    .await
}

/// Check if redirect URI exists for client
pub async fn redirect_uri_exists(
    db: &Pool<Postgres>,
    client_db_id: i64,
    redirect_uri: &str,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM oauth_redirect_uris WHERE client_id = $1 AND redirect_uri = $2) as "exists!""#,
        client_db_id,
        redirect_uri
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

// ============================================================================
// OAuth Authorized Domains Queries
// ============================================================================

/// Get all authorized domains for a client
pub async fn get_authorized_domains_by_client(
    db: &Pool<Postgres>,
    client_db_id: i64,
) -> Result<Vec<OAuthAuthorizedDomain>, sqlx::Error> {
    sqlx::query_as!(
        OAuthAuthorizedDomain,
        r#"
        SELECT id, client_id, domain, description, created_at
        FROM oauth_authorized_domains
        WHERE client_id = $1
        ORDER BY created_at ASC
        "#,
        client_db_id
    )
    .fetch_all(db)
    .await
}

/// Check if authorized domain exists for client
pub async fn authorized_domain_exists(
    db: &Pool<Postgres>,
    client_db_id: i64,
    domain: &str,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM oauth_authorized_domains WHERE client_id = $1 AND domain = $2) as "exists!""#,
        client_db_id,
        domain
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}
