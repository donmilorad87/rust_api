//! Image Variant mutation queries
//!
//! Database operations for creating and deleting image variant records.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};

/// Parameters for creating an image variant
#[derive(Debug, Clone)]
pub struct CreateImageVariantParams {
    pub upload_id: i64,
    pub variant_name: String,
    pub stored_name: String,
    pub width: i32,
    pub height: i32,
    pub size_bytes: i64,
    pub storage_path: String,
}

/// Image variant record after creation
#[derive(Debug, Clone)]
pub struct CreatedImageVariant {
    pub id: i64,
    pub upload_id: i64,
    pub variant_name: String,
    pub stored_name: String,
    pub width: i32,
    pub height: i32,
    pub size_bytes: i64,
    pub storage_path: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Create a new image variant
pub async fn create(
    db: &Pool<Postgres>,
    params: &CreateImageVariantParams,
) -> Result<CreatedImageVariant, sqlx::Error> {
    sqlx::query_as!(
        CreatedImageVariant,
        r#"INSERT INTO image_variants (upload_id, variant_name, stored_name, width, height, size_bytes, storage_path)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, upload_id, variant_name, stored_name, width, height, size_bytes, storage_path, created_at, updated_at"#,
        params.upload_id,
        params.variant_name,
        params.stored_name,
        params.width,
        params.height,
        params.size_bytes,
        params.storage_path
    )
    .fetch_one(db)
    .await
}

/// Batch create multiple variants for an upload
pub async fn create_batch(
    db: &Pool<Postgres>,
    variants: Vec<CreateImageVariantParams>,
) -> Result<Vec<i64>, sqlx::Error> {
    let mut variant_ids = Vec::new();

    for params in variants {
        let variant = create(db, &params).await?;
        variant_ids.push(variant.id);
    }

    Ok(variant_ids)
}

/// Delete all variants for an upload
pub async fn delete_by_upload_id(db: &Pool<Postgres>, upload_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!("DELETE FROM image_variants WHERE upload_id = $1", upload_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}

/// Delete a specific variant
pub async fn delete_variant(
    db: &Pool<Postgres>,
    upload_id: i64,
    variant_name: &str,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        "DELETE FROM image_variants WHERE upload_id = $1 AND variant_name = $2",
        upload_id,
        variant_name
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

/// Update storage_path for a variant (used when moving between public/private)
pub async fn update_storage_path(
    db: &Pool<Postgres>,
    variant_id: i64,
    new_storage_path: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE image_variants
           SET storage_path = $1, updated_at = NOW()
           WHERE id = $2"#,
        new_storage_path,
        variant_id
    )
    .execute(db)
    .await?;

    Ok(())
}
