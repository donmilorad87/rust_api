//! Page Schema Mutations
//!
//! Create, update, delete operations for the page_schemas table.

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

/// Parameters for creating a new page schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePageSchemaParams {
    pub page_seo_id: i64,
    pub lang_code: String,
    pub schema_type: String,
    /// Reference to schema_entities.schema_id (the @id from JSON-LD)
    /// schema_data is fetched from schema_entities via JOIN
    pub entity_schema_id: String,
    pub position: Option<i32>,
    pub is_active: Option<bool>,
}

/// Parameters for updating a page schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePageSchemaParams {
    pub schema_type: Option<String>,
    pub entity_schema_id: Option<String>,
    pub position: Option<i32>,
    pub is_active: Option<bool>,
}

/// Create a new page schema
/// Uses entity_schema_id to reference schema_entities - schema_data comes from JOIN
pub async fn create(
    db: &Pool<Postgres>,
    params: &CreatePageSchemaParams,
) -> Result<i64, sqlx::Error> {
    let position = params.position.unwrap_or(0);
    let is_active = params.is_active.unwrap_or(true);

    let result = sqlx::query!(
        r#"
        INSERT INTO page_schemas (page_seo_id, lang_code, schema_type, entity_schema_id, position, is_active)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
        params.page_seo_id,
        params.lang_code,
        params.schema_type,
        params.entity_schema_id,
        position,
        is_active
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Update an existing page schema
pub async fn update(
    db: &Pool<Postgres>,
    id: i64,
    params: &UpdatePageSchemaParams,
) -> Result<(), sqlx::Error> {
    // Update all provided fields using COALESCE to keep existing values for nulls
    sqlx::query!(
        r#"
        UPDATE page_schemas
        SET
            schema_type = COALESCE($1, schema_type),
            entity_schema_id = COALESCE($2, entity_schema_id),
            position = COALESCE($3, position),
            is_active = COALESCE($4, is_active)
        WHERE id = $5
        "#,
        params.schema_type,
        params.entity_schema_id,
        params.position,
        params.is_active,
        id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete a page schema
pub async fn delete(db: &Pool<Postgres>, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!("DELETE FROM page_schemas WHERE id = $1", id)
        .execute(db)
        .await?;

    Ok(result.rows_affected() > 0)
}

/// Toggle active status for a page schema
pub async fn toggle_active(db: &Pool<Postgres>, id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        UPDATE page_schemas
        SET is_active = NOT is_active
        WHERE id = $1
        RETURNING is_active
        "#,
        id
    )
    .fetch_one(db)
    .await?;

    Ok(result.is_active.unwrap_or(false))
}

/// Reorder schemas for a page
pub async fn reorder(
    db: &Pool<Postgres>,
    page_seo_id: i64,
    schema_ids: &[i64],
) -> Result<(), sqlx::Error> {
    for (position, schema_id) in schema_ids.iter().enumerate() {
        sqlx::query!(
            "UPDATE page_schemas SET position = $1 WHERE id = $2 AND page_seo_id = $3",
            position as i32,
            schema_id,
            page_seo_id
        )
        .execute(db)
        .await?;
    }

    Ok(())
}
