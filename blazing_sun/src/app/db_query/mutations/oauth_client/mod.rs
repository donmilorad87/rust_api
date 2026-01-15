//! OAuth Client Mutation Queries
//!
//! Write operations for OAuth clients, secrets, URIs, and domains.

use sqlx::{Pool, Postgres};

// ============================================================================
// Parameter Structs
// ============================================================================

/// Parameters for creating a new OAuth client
pub struct CreateOAuthClientParams {
    pub user_id: i64,
    pub client_id: String,
    pub client_name: String,
    pub client_type: String, // 'public' or 'confidential'
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub homepage_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub terms_of_service_url: Option<String>,
}

/// Parameters for updating an OAuth client
pub struct UpdateOAuthClientParams {
    pub client_name: Option<String>,
    pub description: Option<String>,
    pub logo_url: Option<String>,
    pub homepage_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub terms_of_service_url: Option<String>,
}

/// Parameters for creating a client secret
pub struct CreateClientSecretParams {
    pub client_id: i64,
    pub secret_hash: String,
    pub secret_hint: String,
    pub description: Option<String>,
}

/// Parameters for creating a redirect URI
pub struct CreateRedirectUriParams {
    pub client_id: i64,
    pub redirect_uri: String,
    pub description: Option<String>,
}

/// Parameters for creating an authorized domain
pub struct CreateAuthorizedDomainParams {
    pub client_id: i64,
    pub domain: String,
    pub description: Option<String>,
}

// ============================================================================
// OAuth Client Mutations
// ============================================================================

/// Create a new OAuth client
pub async fn create(
    db: &Pool<Postgres>,
    params: &CreateOAuthClientParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO oauth_clients (
            user_id, client_id, client_name, client_type, description,
            logo_url, homepage_url, privacy_policy_url, terms_of_service_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        "#,
        params.user_id,
        params.client_id,
        params.client_name,
        params.client_type,
        params.description,
        params.logo_url,
        params.homepage_url,
        params.privacy_policy_url,
        params.terms_of_service_url
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Update OAuth client name
pub async fn update_name(
    db: &Pool<Postgres>,
    client_db_id: i64,
    client_name: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE oauth_clients SET client_name = $1, updated_at = NOW() WHERE id = $2"#,
        client_name,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update OAuth client description
pub async fn update_description(
    db: &Pool<Postgres>,
    client_db_id: i64,
    description: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE oauth_clients SET description = $1, updated_at = NOW() WHERE id = $2"#,
        description,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update OAuth client logo URL
pub async fn update_logo_url(
    db: &Pool<Postgres>,
    client_db_id: i64,
    logo_url: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE oauth_clients SET logo_url = $1, updated_at = NOW() WHERE id = $2"#,
        logo_url,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update OAuth client homepage URL
pub async fn update_homepage_url(
    db: &Pool<Postgres>,
    client_db_id: i64,
    homepage_url: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE oauth_clients SET homepage_url = $1, updated_at = NOW() WHERE id = $2"#,
        homepage_url,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update OAuth client privacy policy URL
pub async fn update_privacy_policy_url(
    db: &Pool<Postgres>,
    client_db_id: i64,
    privacy_policy_url: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE oauth_clients SET privacy_policy_url = $1, updated_at = NOW() WHERE id = $2"#,
        privacy_policy_url,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update OAuth client terms of service URL
pub async fn update_terms_of_service_url(
    db: &Pool<Postgres>,
    client_db_id: i64,
    terms_of_service_url: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE oauth_clients SET terms_of_service_url = $1, updated_at = NOW() WHERE id = $2"#,
        terms_of_service_url,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update full OAuth client
pub async fn update(
    db: &Pool<Postgres>,
    client_db_id: i64,
    params: &UpdateOAuthClientParams,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE oauth_clients
        SET
            client_name = COALESCE($1, client_name),
            description = COALESCE($2, description),
            logo_url = COALESCE($3, logo_url),
            homepage_url = COALESCE($4, homepage_url),
            privacy_policy_url = COALESCE($5, privacy_policy_url),
            terms_of_service_url = COALESCE($6, terms_of_service_url),
            updated_at = NOW()
        WHERE id = $7
        "#,
        params.client_name,
        params.description,
        params.logo_url,
        params.homepage_url,
        params.privacy_policy_url,
        params.terms_of_service_url,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Deactivate OAuth client (soft delete)
pub async fn deactivate(db: &Pool<Postgres>, client_db_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE oauth_clients SET is_active = false, updated_at = NOW() WHERE id = $1"#,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Activate OAuth client
pub async fn activate(db: &Pool<Postgres>, client_db_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE oauth_clients SET is_active = true, updated_at = NOW() WHERE id = $1"#,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete OAuth client (hard delete)
pub async fn delete(db: &Pool<Postgres>, client_db_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(r#"DELETE FROM oauth_clients WHERE id = $1"#, client_db_id)
        .execute(db)
        .await?;

    Ok(())
}

// ============================================================================
// OAuth Client Secrets Mutations
// ============================================================================

/// Create a new client secret
pub async fn create_secret(
    db: &Pool<Postgres>,
    params: &CreateClientSecretParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO oauth_client_secrets (client_id, secret_hash, secret_hint, description)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        "#,
        params.client_id,
        params.secret_hash,
        params.secret_hint,
        params.description
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Deactivate a client secret
pub async fn deactivate_secret(db: &Pool<Postgres>, secret_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE oauth_client_secrets SET is_active = false WHERE id = $1"#,
        secret_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete a client secret
pub async fn delete_secret(db: &Pool<Postgres>, secret_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"DELETE FROM oauth_client_secrets WHERE id = $1"#,
        secret_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update secret last used timestamp
pub async fn update_secret_last_used(
    db: &Pool<Postgres>,
    secret_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE oauth_client_secrets SET last_used_at = NOW() WHERE id = $1"#,
        secret_id
    )
    .execute(db)
    .await?;

    Ok(())
}

// ============================================================================
// OAuth Redirect URIs Mutations
// ============================================================================

/// Create a new redirect URI
pub async fn create_redirect_uri(
    db: &Pool<Postgres>,
    params: &CreateRedirectUriParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO oauth_redirect_uris (client_id, redirect_uri, description)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
        params.client_id,
        params.redirect_uri,
        params.description
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Delete a redirect URI
pub async fn delete_redirect_uri(
    db: &Pool<Postgres>,
    redirect_uri_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"DELETE FROM oauth_redirect_uris WHERE id = $1"#,
        redirect_uri_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete all redirect URIs for a client
pub async fn delete_all_redirect_uris(
    db: &Pool<Postgres>,
    client_db_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"DELETE FROM oauth_redirect_uris WHERE client_id = $1"#,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

// ============================================================================
// OAuth Authorized Domains Mutations
// ============================================================================

/// Create a new authorized domain
pub async fn create_authorized_domain(
    db: &Pool<Postgres>,
    params: &CreateAuthorizedDomainParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO oauth_authorized_domains (client_id, domain, description)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
        params.client_id,
        params.domain,
        params.description
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Delete an authorized domain
pub async fn delete_authorized_domain(
    db: &Pool<Postgres>,
    domain_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"DELETE FROM oauth_authorized_domains WHERE id = $1"#,
        domain_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete all authorized domains for a client
pub async fn delete_all_authorized_domains(
    db: &Pool<Postgres>,
    client_db_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"DELETE FROM oauth_authorized_domains WHERE client_id = $1"#,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}
