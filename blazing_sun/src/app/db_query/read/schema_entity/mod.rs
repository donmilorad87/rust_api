//! Schema Entity Read Queries
//!
//! Read operations for schema_entities and entity_relations tables.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaEntity {
    pub id: i64,
    pub schema_id: String,
    pub lang_code: String,
    pub schema_type: String,
    pub schema_data: serde_json::Value,
    pub schema_hash: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityRelation {
    pub id: i64,
    pub lang_code: String,
    pub from_schema_id: String,
    pub property: String,
    pub to_schema_id: String,
    pub created_at: Option<DateTime<Utc>>,
}

pub async fn get_by_schema_id_lang(
    db: &Pool<Postgres>,
    schema_id: &str,
    lang_code: &str,
) -> Result<SchemaEntity, sqlx::Error> {
    sqlx::query_as!(
        SchemaEntity,
        r#"
        SELECT
            id,
            schema_id,
            lang_code,
            schema_type,
            schema_data,
            schema_hash,
            created_at,
            updated_at
        FROM schema_entities
        WHERE schema_id = $1 AND lang_code = $2
        "#,
        schema_id,
        lang_code
    )
    .fetch_one(db)
    .await
}

pub async fn get_by_schema_ids_lang(
    db: &Pool<Postgres>,
    schema_ids: &[String],
    lang_code: &str,
) -> Result<Vec<SchemaEntity>, sqlx::Error> {
    sqlx::query_as!(
        SchemaEntity,
        r#"
        SELECT
            id,
            schema_id,
            lang_code,
            schema_type,
            schema_data,
            schema_hash,
            created_at,
            updated_at
        FROM schema_entities
        WHERE lang_code = $1 AND schema_id = ANY($2)
        "#,
        lang_code,
        schema_ids
    )
    .fetch_all(db)
    .await
}

pub async fn search_by_schema_id_lang(
    db: &Pool<Postgres>,
    query: &str,
    lang_code: &str,
    limit: i64,
) -> Result<Vec<SchemaEntity>, sqlx::Error> {
    sqlx::query_as!(
        SchemaEntity,
        r#"
        SELECT
            id,
            schema_id,
            lang_code,
            schema_type,
            schema_data,
            schema_hash,
            created_at,
            updated_at
        FROM schema_entities
        WHERE lang_code = $1 AND schema_id ILIKE $2
        ORDER BY schema_id ASC
        LIMIT $3
        "#,
        lang_code,
        format!("%{}%", query),
        limit
    )
    .fetch_all(db)
    .await
}

/// List entities by schema type and language with optional search
pub async fn list_by_type_lang(
    db: &Pool<Postgres>,
    schema_type: &str,
    lang_code: &str,
    search: Option<&str>,
    limit: i64,
) -> Result<Vec<SchemaEntity>, sqlx::Error> {
    let search_pattern = search
        .filter(|s| !s.is_empty())
        .map(|s| format!("%{}%", s))
        .unwrap_or_else(|| "%".to_string());

    sqlx::query_as!(
        SchemaEntity,
        r#"
        SELECT
            id,
            schema_id,
            lang_code,
            schema_type,
            schema_data,
            schema_hash,
            created_at,
            updated_at
        FROM schema_entities
        WHERE lang_code = $1
          AND schema_type = $2
          AND schema_id ILIKE $3
        ORDER BY schema_id ASC
        LIMIT $4
        "#,
        lang_code,
        schema_type,
        search_pattern,
        limit
    )
    .fetch_all(db)
    .await
}

/// List all entity types for a given language
pub async fn list_types_by_lang(
    db: &Pool<Postgres>,
    lang_code: &str,
) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query_scalar!(
        r#"
        SELECT DISTINCT schema_type
        FROM schema_entities
        WHERE lang_code = $1
        ORDER BY schema_type ASC
        "#,
        lang_code
    )
    .fetch_all(db)
    .await?;

    Ok(rows)
}

pub async fn get_relations_by_from_id(
    db: &Pool<Postgres>,
    from_schema_id: &str,
    lang_code: &str,
) -> Result<Vec<EntityRelation>, sqlx::Error> {
    sqlx::query_as!(
        EntityRelation,
        r#"
        SELECT
            id,
            lang_code,
            from_schema_id,
            property,
            to_schema_id,
            created_at
        FROM entity_relations
        WHERE lang_code = $1 AND from_schema_id = $2
        ORDER BY id ASC
        "#,
        lang_code,
        from_schema_id
    )
    .fetch_all(db)
    .await
}
