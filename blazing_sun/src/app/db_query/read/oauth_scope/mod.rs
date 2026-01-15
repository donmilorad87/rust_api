//! OAuth Scope Catalog Read Queries
//!
//! Read operations for scopes, API products, and client scope associations.

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

// ============================================================================
// Structs
// ============================================================================

/// OAuth Scope from catalog
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OAuthScope {
    pub id: i64,
    pub scope_name: String,
    pub scope_description: String,
    pub sensitive: bool,
    pub api_product_id: Option<i64>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// OAuth API Product
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OAuthApiProduct {
    pub id: i64,
    pub product_key: String,
    pub product_name: String,
    pub product_description: String,
    pub icon_url: Option<String>,
    pub documentation_url: Option<String>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Client's allowed scope
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ClientAllowedScope {
    pub client_id: i64,
    pub scope_id: i64,
    pub scope_name: String,
    pub scope_description: String,
    pub sensitive: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Client's enabled API
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ClientEnabledApi {
    pub client_id: i64,
    pub api_product_id: i64,
    pub product_key: String,
    pub product_name: String,
    pub product_description: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ============================================================================
// Scope Catalog Queries
// ============================================================================

/// Get all available scopes
pub async fn get_all_scopes(db: &Pool<Postgres>) -> Result<Vec<OAuthScope>, sqlx::Error> {
    sqlx::query_as!(
        OAuthScope,
        r#"
        SELECT id, scope_name, scope_description, sensitive, api_product_id, created_at
        FROM oauth_scope_catalog
        ORDER BY scope_name
        "#
    )
    .fetch_all(db)
    .await
}

/// Get scope by ID
pub async fn get_scope_by_id(
    db: &Pool<Postgres>,
    scope_id: i64,
) -> Result<Option<OAuthScope>, sqlx::Error> {
    sqlx::query_as!(
        OAuthScope,
        r#"
        SELECT id, scope_name, scope_description, sensitive, api_product_id, created_at
        FROM oauth_scope_catalog
        WHERE id = $1
        "#,
        scope_id
    )
    .fetch_optional(db)
    .await
}

/// Get scope by name
pub async fn get_scope_by_name(
    db: &Pool<Postgres>,
    scope_name: &str,
) -> Result<Option<OAuthScope>, sqlx::Error> {
    sqlx::query_as!(
        OAuthScope,
        r#"
        SELECT id, scope_name, scope_description, sensitive, api_product_id, created_at
        FROM oauth_scope_catalog
        WHERE scope_name = $1
        "#,
        scope_name
    )
    .fetch_optional(db)
    .await
}

/// Get multiple scopes by names
pub async fn get_scopes_by_names(
    db: &Pool<Postgres>,
    scope_names: &[String],
) -> Result<Vec<OAuthScope>, sqlx::Error> {
    sqlx::query_as!(
        OAuthScope,
        r#"
        SELECT id, scope_name, scope_description, sensitive, api_product_id, created_at
        FROM oauth_scope_catalog
        WHERE scope_name = ANY($1)
        ORDER BY scope_name
        "#,
        scope_names
    )
    .fetch_all(db)
    .await
}

/// Get all scopes for a specific API product
pub async fn get_scopes_by_api_product(
    db: &Pool<Postgres>,
    api_product_id: i64,
) -> Result<Vec<OAuthScope>, sqlx::Error> {
    sqlx::query_as!(
        OAuthScope,
        r#"
        SELECT id, scope_name, scope_description, sensitive, api_product_id, created_at
        FROM oauth_scope_catalog
        WHERE api_product_id = $1
        ORDER BY scope_name
        "#,
        api_product_id
    )
    .fetch_all(db)
    .await
}

// ============================================================================
// API Products Queries
// ============================================================================

/// Get all API products
pub async fn get_all_api_products(
    db: &Pool<Postgres>,
) -> Result<Vec<OAuthApiProduct>, sqlx::Error> {
    sqlx::query_as!(
        OAuthApiProduct,
        r#"
        SELECT id, product_key, product_name, product_description, icon_url, documentation_url, is_active, created_at, updated_at
        FROM oauth_api_products
        WHERE is_active = true
        ORDER BY product_name
        "#
    )
    .fetch_all(db)
    .await
}

/// Get API product by ID
pub async fn get_api_product_by_id(
    db: &Pool<Postgres>,
    product_id: i64,
) -> Result<Option<OAuthApiProduct>, sqlx::Error> {
    sqlx::query_as!(
        OAuthApiProduct,
        r#"
        SELECT id, product_key, product_name, product_description, icon_url, documentation_url, is_active, created_at, updated_at
        FROM oauth_api_products
        WHERE id = $1
        "#,
        product_id
    )
    .fetch_optional(db)
    .await
}

/// Get API product by name
pub async fn get_api_product_by_name(
    db: &Pool<Postgres>,
    product_name: &str,
) -> Result<Option<OAuthApiProduct>, sqlx::Error> {
    sqlx::query_as!(
        OAuthApiProduct,
        r#"
        SELECT id, product_key, product_name, product_description, icon_url, documentation_url, is_active, created_at, updated_at
        FROM oauth_api_products
        WHERE product_name = $1
        "#,
        product_name
    )
    .fetch_optional(db)
    .await
}

/// Get API product by key
pub async fn get_api_product_by_key(
    db: &Pool<Postgres>,
    product_key: &str,
) -> Result<Option<OAuthApiProduct>, sqlx::Error> {
    sqlx::query_as!(
        OAuthApiProduct,
        r#"
        SELECT id, product_key, product_name, product_description, icon_url, documentation_url, is_active, created_at, updated_at
        FROM oauth_api_products
        WHERE product_key = $1
        "#,
        product_key
    )
    .fetch_optional(db)
    .await
}

// ============================================================================
// Client Allowed Scopes Queries
// ============================================================================

/// Get all scopes allowed for a specific client
pub async fn get_client_allowed_scopes(
    db: &Pool<Postgres>,
    client_db_id: i64,
) -> Result<Vec<ClientAllowedScope>, sqlx::Error> {
    sqlx::query_as!(
        ClientAllowedScope,
        r#"
        SELECT
            cas.client_id,
            cas.scope_id,
            sc.scope_name,
            sc.scope_description,
            sc.sensitive,
            cas.created_at
        FROM oauth_client_allowed_scopes cas
        JOIN oauth_scope_catalog sc ON cas.scope_id = sc.id
        WHERE cas.client_id = $1
        ORDER BY sc.scope_name
        "#,
        client_db_id
    )
    .fetch_all(db)
    .await
}

/// Check if client is allowed a specific scope
pub async fn client_has_scope(
    db: &Pool<Postgres>,
    client_db_id: i64,
    scope_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM oauth_client_allowed_scopes
            WHERE client_id = $1 AND scope_id = $2
        ) as "exists!"
        "#,
        client_db_id,
        scope_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.exists)
}

/// Check if client is allowed a specific scope by scope name
pub async fn client_has_scope_by_name(
    db: &Pool<Postgres>,
    client_db_id: i64,
    scope_name: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM oauth_client_allowed_scopes cas
            JOIN oauth_scope_catalog sc ON cas.scope_id = sc.id
            WHERE cas.client_id = $1 AND sc.scope_name = $2
        ) as "exists!"
        "#,
        client_db_id,
        scope_name
    )
    .fetch_one(db)
    .await?;

    Ok(result.exists)
}

// ============================================================================
// Client Enabled APIs Queries
// ============================================================================

/// Get all API products enabled for a specific client
pub async fn get_client_enabled_apis(
    db: &Pool<Postgres>,
    client_db_id: i64,
) -> Result<Vec<ClientEnabledApi>, sqlx::Error> {
    sqlx::query_as!(
        ClientEnabledApi,
        r#"
        SELECT
            cea.client_id,
            cea.api_product_id,
            ap.product_key,
            ap.product_name,
            ap.product_description,
            cea.created_at
        FROM oauth_client_enabled_apis cea
        JOIN oauth_api_products ap ON cea.api_product_id = ap.id
        WHERE cea.client_id = $1
        ORDER BY ap.product_name
        "#,
        client_db_id
    )
    .fetch_all(db)
    .await
}

/// Check if client has access to a specific API product
pub async fn client_has_api_product(
    db: &Pool<Postgres>,
    client_db_id: i64,
    api_product_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM oauth_client_enabled_apis
            WHERE client_id = $1 AND api_product_id = $2
        ) as "exists!"
        "#,
        client_db_id,
        api_product_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.exists)
}

/// Check if client has access to a specific API product by product name
pub async fn client_has_api_product_by_name(
    db: &Pool<Postgres>,
    client_db_id: i64,
    product_name: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM oauth_client_enabled_apis cea
            JOIN oauth_api_products ap ON cea.api_product_id = ap.id
            WHERE cea.client_id = $1 AND ap.product_name = $2
        ) as "exists!"
        "#,
        client_db_id,
        product_name
    )
    .fetch_one(db)
    .await?;

    Ok(result.exists)
}
