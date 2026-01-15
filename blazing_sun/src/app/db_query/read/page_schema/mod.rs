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
    pub lang_code: String,
    pub schema_type: String,
    pub entity_schema_id: Option<String>,
    pub schema_data: Option<serde_json::Value>,  // From schema_entities via JOIN
    pub position: Option<i32>,
    pub is_active: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Get all schemas for a page by page_seo_id
/// JOINs with schema_entities to get schema_data from the canonical source
pub async fn get_by_page_seo_id(
    db: &Pool<Postgres>,
    page_seo_id: i64,
) -> Result<Vec<PageSchema>, sqlx::Error> {
    sqlx::query_as!(
        PageSchema,
        r#"
        SELECT
            ps.id,
            ps.page_seo_id,
            ps.lang_code,
            ps.schema_type,
            ps.entity_schema_id,
            se.schema_data,
            ps.position,
            ps.is_active,
            ps.created_at,
            ps.updated_at
        FROM page_schemas ps
        LEFT JOIN schema_entities se
            ON se.lang_code = ps.lang_code
            AND se.schema_id = ps.entity_schema_id
        WHERE ps.page_seo_id = $1
        ORDER BY ps.position ASC, ps.id ASC
        "#,
        page_seo_id
    )
    .fetch_all(db)
    .await
}

pub async fn get_by_page_seo_id_lang(
    db: &Pool<Postgres>,
    page_seo_id: i64,
    lang_code: &str,
) -> Result<Vec<PageSchema>, sqlx::Error> {
    sqlx::query_as!(
        PageSchema,
        r#"
        SELECT
            ps.id,
            ps.page_seo_id,
            ps.lang_code,
            ps.schema_type,
            ps.entity_schema_id,
            se.schema_data,
            ps.position,
            ps.is_active,
            ps.created_at,
            ps.updated_at
        FROM page_schemas ps
        LEFT JOIN schema_entities se
            ON se.lang_code = ps.lang_code
            AND se.schema_id = ps.entity_schema_id
        WHERE ps.page_seo_id = $1 AND ps.lang_code = $2
        ORDER BY ps.position ASC, ps.id ASC
        "#,
        page_seo_id,
        lang_code
    )
    .fetch_all(db)
    .await
}

/// Get active schemas for a page (for rendering)
/// JOINs with schema_entities to get schema_data from the canonical source
pub async fn get_active_by_page_seo_id(
    db: &Pool<Postgres>,
    page_seo_id: i64,
) -> Result<Vec<PageSchema>, sqlx::Error> {
    sqlx::query_as!(
        PageSchema,
        r#"
        SELECT
            ps.id,
            ps.page_seo_id,
            ps.lang_code,
            ps.schema_type,
            ps.entity_schema_id,
            se.schema_data,
            ps.position,
            ps.is_active,
            ps.created_at,
            ps.updated_at
        FROM page_schemas ps
        LEFT JOIN schema_entities se
            ON se.lang_code = ps.lang_code
            AND se.schema_id = ps.entity_schema_id
        WHERE ps.page_seo_id = $1 AND ps.is_active = true
        ORDER BY ps.position ASC, ps.id ASC
        "#,
        page_seo_id
    )
    .fetch_all(db)
    .await
}

pub async fn get_active_by_page_seo_id_lang(
    db: &Pool<Postgres>,
    page_seo_id: i64,
    lang_code: &str,
) -> Result<Vec<PageSchema>, sqlx::Error> {
    sqlx::query_as!(
        PageSchema,
        r#"
        SELECT
            ps.id,
            ps.page_seo_id,
            ps.lang_code,
            ps.schema_type,
            ps.entity_schema_id,
            se.schema_data,
            ps.position,
            ps.is_active,
            ps.created_at,
            ps.updated_at
        FROM page_schemas ps
        LEFT JOIN schema_entities se
            ON se.lang_code = ps.lang_code
            AND se.schema_id = ps.entity_schema_id
        WHERE ps.page_seo_id = $1 AND ps.is_active = true AND ps.lang_code = $2
        ORDER BY ps.position ASC, ps.id ASC
        "#,
        page_seo_id,
        lang_code
    )
    .fetch_all(db)
    .await
}

/// Get a single schema by ID
/// JOINs with schema_entities to get schema_data from the canonical source
pub async fn get_by_id(db: &Pool<Postgres>, id: i64) -> Result<PageSchema, sqlx::Error> {
    sqlx::query_as!(
        PageSchema,
        r#"
        SELECT
            ps.id,
            ps.page_seo_id,
            ps.lang_code,
            ps.schema_type,
            ps.entity_schema_id,
            se.schema_data,
            ps.position,
            ps.is_active,
            ps.created_at,
            ps.updated_at
        FROM page_schemas ps
        LEFT JOIN schema_entities se
            ON se.lang_code = ps.lang_code
            AND se.schema_id = ps.entity_schema_id
        WHERE ps.id = $1
        "#,
        id
    )
    .fetch_one(db)
    .await
}

/// Check if schema exists
pub async fn exists(db: &Pool<Postgres>, id: i64) -> bool {
    sqlx::query!(
        "SELECT EXISTS(SELECT 1 FROM page_schemas WHERE id = $1)",
        id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists.unwrap_or(false))
    .unwrap_or(false)
}
