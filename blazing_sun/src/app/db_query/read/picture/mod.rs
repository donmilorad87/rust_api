//! Picture Read Queries
//!
//! Read operations for the pictures table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Picture record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Picture {
    pub id: i64,
    pub gallery_id: i64,
    pub upload_id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Picture with upload information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PictureWithUpload {
    pub id: i64,
    pub gallery_id: i64,
    pub upload_id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Upload fields
    pub upload_uuid: Uuid,
    pub upload_stored_name: String,
    pub upload_original_name: String,
    pub upload_storage_type: String,
    pub upload_mime_type: String,
    pub upload_size_bytes: i64,
    pub upload_title: Option<String>,
    pub upload_description: Option<String>,
}

/// Get picture by ID
pub async fn get_by_id(db: &Pool<Postgres>, picture_id: i64) -> Result<Picture, sqlx::Error> {
    sqlx::query_as!(
        Picture,
        r#"
        SELECT id, gallery_id, upload_id, title, description, latitude, longitude, display_order, created_at, updated_at
        FROM pictures
        WHERE id = $1
        "#,
        picture_id
    )
    .fetch_one(db)
    .await
}

/// Get picture by ID with upload information
pub async fn get_by_id_with_upload(
    db: &Pool<Postgres>,
    picture_id: i64,
) -> Result<PictureWithUpload, sqlx::Error> {
    sqlx::query_as!(
        PictureWithUpload,
        r#"
        SELECT
            p.id,
            p.gallery_id,
            p.upload_id,
            p.title,
            p.description,
            p.latitude,
            p.longitude,
            p.display_order,
            p.created_at,
            p.updated_at,
            u.uuid as upload_uuid,
            u.stored_name as upload_stored_name,
            u.original_name as upload_original_name,
            u.storage_type as upload_storage_type,
            u.mime_type as upload_mime_type,
            u.size_bytes as upload_size_bytes,
            u.title as upload_title,
            u.description as upload_description
        FROM pictures p
        INNER JOIN uploads u ON p.upload_id = u.id
        WHERE p.id = $1
        "#,
        picture_id
    )
    .fetch_one(db)
    .await
}

/// Get all pictures in a gallery (ordered by display_order)
pub async fn get_by_gallery(
    db: &Pool<Postgres>,
    gallery_id: i64,
) -> Result<Vec<Picture>, sqlx::Error> {
    sqlx::query_as!(
        Picture,
        r#"
        SELECT id, gallery_id, upload_id, title, description, latitude, longitude, display_order, created_at, updated_at
        FROM pictures
        WHERE gallery_id = $1
        ORDER BY display_order ASC, created_at DESC
        "#,
        gallery_id
    )
    .fetch_all(db)
    .await
}

/// Get all pictures in a gallery with upload information
pub async fn get_by_gallery_with_uploads(
    db: &Pool<Postgres>,
    gallery_id: i64,
) -> Result<Vec<PictureWithUpload>, sqlx::Error> {
    sqlx::query_as!(
        PictureWithUpload,
        r#"
        SELECT
            p.id,
            p.gallery_id,
            p.upload_id,
            p.title,
            p.description,
            p.latitude,
            p.longitude,
            p.display_order,
            p.created_at,
            p.updated_at,
            u.uuid as upload_uuid,
            u.stored_name as upload_stored_name,
            u.original_name as upload_original_name,
            u.storage_type as upload_storage_type,
            u.mime_type as upload_mime_type,
            u.size_bytes as upload_size_bytes,
            u.title as upload_title,
            u.description as upload_description
        FROM pictures p
        INNER JOIN uploads u ON p.upload_id = u.id
        WHERE p.gallery_id = $1
        ORDER BY p.display_order ASC, p.created_at DESC
        "#,
        gallery_id
    )
    .fetch_all(db)
    .await
}

/// Get all pictures in a gallery with pagination
pub async fn get_by_gallery_paginated(
    db: &Pool<Postgres>,
    gallery_id: i64,
    limit: i64,
    offset: i64,
) -> Result<Vec<PictureWithUpload>, sqlx::Error> {
    sqlx::query_as!(
        PictureWithUpload,
        r#"
        SELECT
            p.id,
            p.gallery_id,
            p.upload_id,
            p.title,
            p.description,
            p.latitude,
            p.longitude,
            p.display_order,
            p.created_at,
            p.updated_at,
            u.uuid as upload_uuid,
            u.stored_name as upload_stored_name,
            u.original_name as upload_original_name,
            u.storage_type as upload_storage_type,
            u.mime_type as upload_mime_type,
            u.size_bytes as upload_size_bytes,
            u.title as upload_title,
            u.description as upload_description
        FROM pictures p
        INNER JOIN uploads u ON p.upload_id = u.id
        WHERE p.gallery_id = $1
        ORDER BY p.display_order ASC, p.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        gallery_id,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Count pictures in a gallery
pub async fn count_by_gallery(db: &Pool<Postgres>, gallery_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"SELECT COUNT(*) as "count!" FROM pictures WHERE gallery_id = $1"#,
        gallery_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.count)
}

/// Check if picture exists
pub async fn exists(db: &Pool<Postgres>, picture_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM pictures WHERE id = $1) as "exists!""#,
        picture_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Get picture IDs that belong to a gallery from a provided list
pub async fn get_ids_by_gallery_and_ids(
    db: &Pool<Postgres>,
    gallery_id: i64,
    picture_ids: &[i64],
) -> Result<Vec<i64>, sqlx::Error> {
    if picture_ids.is_empty() {
        return Ok(Vec::new());
    }

    let rows = sqlx::query!(
        r#"
        SELECT id
        FROM pictures
        WHERE gallery_id = $1 AND id = ANY($2)
        "#,
        gallery_id,
        picture_ids
    )
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().map(|row| row.id).collect())
}

/// Check if upload is already in gallery (prevent duplicates)
pub async fn upload_exists_in_gallery(
    db: &Pool<Postgres>,
    gallery_id: i64,
    upload_id: i64,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM pictures WHERE gallery_id = $1 AND upload_id = $2) as "exists!""#,
        gallery_id,
        upload_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Get the UUID of the first picture in a gallery (for cover image)
pub async fn get_first_picture_uuid(
    db: &Pool<Postgres>,
    gallery_id: i64,
) -> Result<Option<Uuid>, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        SELECT u.uuid
        FROM pictures p
        INNER JOIN uploads u ON p.upload_id = u.id
        WHERE p.gallery_id = $1
        ORDER BY p.display_order ASC, p.created_at ASC
        LIMIT 1
        "#,
        gallery_id
    )
    .fetch_optional(db)
    .await?;

    Ok(result.map(|r| r.uuid))
}

/// Get picture by gallery and upload (for checking duplicates)
pub async fn get_by_gallery_and_upload(
    db: &Pool<Postgres>,
    gallery_id: i64,
    upload_id: i64,
) -> Result<Picture, sqlx::Error> {
    sqlx::query_as!(
        Picture,
        r#"
        SELECT id, gallery_id, upload_id, title, description, latitude, longitude, display_order, created_at, updated_at
        FROM pictures
        WHERE gallery_id = $1 AND upload_id = $2
        "#,
        gallery_id,
        upload_id
    )
    .fetch_one(db)
    .await
}
