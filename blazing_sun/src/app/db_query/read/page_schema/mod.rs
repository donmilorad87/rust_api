//! Page Schema Read Queries
//!
//! Read operations for the page_schemas table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

/// Full page schema record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageSchema {
    pub id: i64,
    pub page_seo_id: i64,
    pub schema_type: String,
    pub schema_data: serde_json::Value,
    pub position: Option<i32>,
    pub is_active: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Get all schemas for a page by page_seo_id
pub async fn get_by_page_seo_id(
    db: &Pool<Postgres>,
    page_seo_id: i64,
) -> Result<Vec<PageSchema>, sqlx::Error> {
    sqlx::query_as!(
        PageSchema,
        r#"
        SELECT
            id,
            page_seo_id,
            schema_type,
            schema_data,
            position,
            is_active,
            created_at,
            updated_at
        FROM page_schemas
        WHERE page_seo_id = $1
        ORDER BY position ASC, id ASC
        "#,
        page_seo_id
    )
    .fetch_all(db)
    .await
}

/// Get active schemas for a page (for rendering)
pub async fn get_active_by_page_seo_id(
    db: &Pool<Postgres>,
    page_seo_id: i64,
) -> Result<Vec<PageSchema>, sqlx::Error> {
    sqlx::query_as!(
        PageSchema,
        r#"
        SELECT
            id,
            page_seo_id,
            schema_type,
            schema_data,
            position,
            is_active,
            created_at,
            updated_at
        FROM page_schemas
        WHERE page_seo_id = $1 AND is_active = true
        ORDER BY position ASC, id ASC
        "#,
        page_seo_id
    )
    .fetch_all(db)
    .await
}

/// Get a single schema by ID
pub async fn get_by_id(db: &Pool<Postgres>, id: i64) -> Result<PageSchema, sqlx::Error> {
    sqlx::query_as!(
        PageSchema,
        r#"
        SELECT
            id,
            page_seo_id,
            schema_type,
            schema_data,
            position,
            is_active,
            created_at,
            updated_at
        FROM page_schemas
        WHERE id = $1
        "#,
        id
    )
    .fetch_one(db)
    .await
}

/// Check if schema exists
pub async fn exists(db: &Pool<Postgres>, id: i64) -> bool {
    sqlx::query!("SELECT EXISTS(SELECT 1 FROM page_schemas WHERE id = $1)", id)
        .fetch_one(db)
        .await
        .map(|r| r.exists.unwrap_or(false))
        .unwrap_or(false)
}
