//! Schema Entity Mutations
//!
//! Create, update, delete operations for schema_entities and entity_relations.

use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertSchemaEntityParams {
    pub schema_id: String,
    pub lang_code: String,
    pub schema_type: String,
    pub schema_data: serde_json::Value,
    pub schema_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateEntityRelationParams {
    pub lang_code: String,
    pub from_schema_id: String,
    pub property: String,
    pub to_schema_id: String,
}

pub async fn upsert(
    db: &Pool<Postgres>,
    params: &UpsertSchemaEntityParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO schema_entities (schema_id, lang_code, schema_type, schema_data, schema_hash)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (lang_code, schema_id)
        DO UPDATE SET
            schema_type = EXCLUDED.schema_type,
            schema_data = EXCLUDED.schema_data,
            schema_hash = EXCLUDED.schema_hash,
            updated_at = NOW()
        RETURNING id
        "#,
        params.schema_id,
        params.lang_code,
        params.schema_type,
        params.schema_data,
        params.schema_hash
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

pub async fn find_by_hash(
    db: &Pool<Postgres>,
    lang_code: &str,
    schema_type: &str,
    schema_hash: &str,
) -> Result<Option<String>, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT schema_id
        FROM schema_entities
        WHERE lang_code = $1 AND schema_type = $2 AND schema_hash = $3
        "#,
        lang_code,
        schema_type,
        schema_hash
    )
    .fetch_optional(db)
    .await?;

    Ok(result.map(|row| row.schema_id))
}

pub async fn delete_relations_by_from_id(
    db: &Pool<Postgres>,
    lang_code: &str,
    from_schema_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM entity_relations
        WHERE lang_code = $1 AND from_schema_id = $2
        "#,
        lang_code,
        from_schema_id
    )
    .execute(db)
    .await?;

    Ok(())
}

pub async fn create_relation(
    db: &Pool<Postgres>,
    params: &CreateEntityRelationParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO entity_relations (lang_code, from_schema_id, property, to_schema_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (lang_code, from_schema_id, property, to_schema_id)
        DO NOTHING
        RETURNING id
        "#,
        params.lang_code,
        params.from_schema_id,
        params.property,
        params.to_schema_id
    )
    .fetch_optional(db)
    .await?;

    Ok(result.map(|row| row.id).unwrap_or(0))
}

/// Delete a schema entity by schema_id and lang_code
/// This will cascade delete all page_schemas that reference this entity
pub async fn delete_by_schema_id_lang(
    db: &Pool<Postgres>,
    schema_id: &str,
    lang_code: &str,
) -> Result<bool, sqlx::Error> {
    // First delete all relations involving this entity
    sqlx::query!(
        r#"
        DELETE FROM entity_relations
        WHERE lang_code = $1 AND (from_schema_id = $2 OR to_schema_id = $2)
        "#,
        lang_code,
        schema_id
    )
    .execute(db)
    .await?;

    // Then delete the entity itself (page_schemas will cascade delete via FK)
    let result = sqlx::query!(
        r#"
        DELETE FROM schema_entities
        WHERE lang_code = $1 AND schema_id = $2
        "#,
        lang_code,
        schema_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}

/// Delete a schema entity by its database ID
pub async fn delete_by_id(db: &Pool<Postgres>, id: i64) -> Result<bool, sqlx::Error> {
    // Get the schema_id and lang_code first for relation cleanup
    let entity = sqlx::query!(
        r#"
        SELECT schema_id, lang_code FROM schema_entities WHERE id = $1
        "#,
        id
    )
    .fetch_optional(db)
    .await?;

    if let Some(entity) = entity {
        // Delete relations involving this entity
        sqlx::query!(
            r#"
            DELETE FROM entity_relations
            WHERE lang_code = $1 AND (from_schema_id = $2 OR to_schema_id = $2)
            "#,
            entity.lang_code,
            entity.schema_id
        )
        .execute(db)
        .await?;
    }

    // Delete the entity (page_schemas will cascade delete via FK)
    let result = sqlx::query!(
        r#"
        DELETE FROM schema_entities WHERE id = $1
        "#,
        id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() > 0)
}
