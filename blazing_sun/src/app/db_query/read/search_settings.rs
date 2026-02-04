//! Search Index Settings - Read Operations

use sqlx::PgPool;

/// Search index setting record
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize)]
pub struct SearchIndexSetting {
    pub id: i32,
    pub content_type: String,
    pub is_enabled: bool,
    pub display_name: String,
    pub display_order: i32,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Get all search index settings ordered by display_order
pub async fn get_all_settings(pool: &PgPool) -> Result<Vec<SearchIndexSetting>, sqlx::Error> {
    sqlx::query_as!(
        SearchIndexSetting,
        r#"
        SELECT id, content_type, is_enabled, display_name, display_order, created_at, updated_at
        FROM search_index_settings
        ORDER BY display_order ASC
        "#
    )
    .fetch_all(pool)
    .await
}

/// Get enabled content types for reindexing
pub async fn get_enabled_content_types(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query_scalar!(
        r#"
        SELECT content_type
        FROM search_index_settings
        WHERE is_enabled = true
        ORDER BY display_order ASC
        "#
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Check if a specific content type is enabled
pub async fn is_content_type_enabled(
    pool: &PgPool,
    content_type: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT is_enabled as "is_enabled!"
        FROM search_index_settings
        WHERE content_type = $1
        "#,
        content_type
    )
    .fetch_optional(pool)
    .await?;

    Ok(result.unwrap_or(false))
}
