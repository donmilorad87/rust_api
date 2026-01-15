//! Image Variant read queries
//!
//! Database operations for reading image variant records.

use chrono::{DateTime, Utc};
use sqlx::{FromRow, Pool, Postgres};

/// Image variant record from database
#[derive(Debug, Clone, FromRow)]
pub struct ImageVariant {
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

/// Get all variants for an upload
pub async fn get_by_upload_id(
    db: &Pool<Postgres>,
    upload_id: i64,
) -> Result<Vec<ImageVariant>, sqlx::Error> {
    sqlx::query_as!(
        ImageVariant,
        r#"SELECT id, upload_id, variant_name, stored_name, width, height, size_bytes,
                  storage_path, created_at, updated_at
           FROM image_variants WHERE upload_id = $1
           ORDER BY
               CASE variant_name
                   WHEN 'thumb' THEN 1
                   WHEN 'small' THEN 2
                   WHEN 'medium' THEN 3
                   WHEN 'large' THEN 4
                   WHEN 'full' THEN 5
                   ELSE 6
               END"#,
        upload_id
    )
    .fetch_all(db)
    .await
}

/// Get a specific variant by upload_id and variant_name
pub async fn get_variant(
    db: &Pool<Postgres>,
    upload_id: i64,
    variant_name: &str,
) -> Result<ImageVariant, sqlx::Error> {
    sqlx::query_as!(
        ImageVariant,
        r#"SELECT id, upload_id, variant_name, stored_name, width, height, size_bytes,
                  storage_path, created_at, updated_at
           FROM image_variants
           WHERE upload_id = $1 AND variant_name = $2"#,
        upload_id,
        variant_name
    )
    .fetch_one(db)
    .await
}

/// Check if variants exist for an upload
pub async fn has_variants(db: &Pool<Postgres>, upload_id: i64) -> bool {
    sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM image_variants WHERE upload_id = $1)",
        upload_id
    )
    .fetch_one(db)
    .await
    .unwrap_or(Some(false))
    .unwrap_or(false)
}

/// Count variants for an upload
pub async fn count_by_upload(db: &Pool<Postgres>, upload_id: i64) -> i64 {
    sqlx::query_scalar!(
        "SELECT COUNT(*) FROM image_variants WHERE upload_id = $1",
        upload_id
    )
    .fetch_one(db)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0)
}
