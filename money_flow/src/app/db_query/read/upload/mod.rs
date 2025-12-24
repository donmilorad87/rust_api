//! Upload read queries
//!
//! Database operations for reading upload records.

use chrono::{DateTime, Utc};
use sqlx::{FromRow, Pool, Postgres};
use uuid::Uuid;

/// Upload record from database
#[derive(Debug, Clone, FromRow)]
pub struct Upload {
    pub id: i64,
    pub uuid: Uuid,
    pub original_name: String,
    pub stored_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub upload_status: String,
    pub chunks_received: Option<i32>,
    pub total_chunks: Option<i32>,
    pub user_id: Option<i64>,
    pub description: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Get upload by ID
pub async fn get_by_id(db: &Pool<Postgres>, id: i64) -> Result<Upload, sqlx::Error> {
    sqlx::query_as!(
        Upload,
        r#"SELECT id, uuid, original_name, stored_name, extension, mime_type, size_bytes,
                  storage_type, storage_path, upload_status, chunks_received, total_chunks,
                  user_id, description, metadata, created_at, updated_at
           FROM uploads WHERE id = $1"#,
        id
    )
    .fetch_one(db)
    .await
}

/// Get upload by UUID
pub async fn get_by_uuid(db: &Pool<Postgres>, uuid: &Uuid) -> Result<Upload, sqlx::Error> {
    sqlx::query_as!(
        Upload,
        r#"SELECT id, uuid, original_name, stored_name, extension, mime_type, size_bytes,
                  storage_type, storage_path, upload_status, chunks_received, total_chunks,
                  user_id, description, metadata, created_at, updated_at
           FROM uploads WHERE uuid = $1"#,
        uuid
    )
    .fetch_one(db)
    .await
}

/// Get uploads by user ID
pub async fn get_by_user_id(db: &Pool<Postgres>, user_id: i64) -> Vec<Upload> {
    sqlx::query_as!(
        Upload,
        r#"SELECT id, uuid, original_name, stored_name, extension, mime_type, size_bytes,
                  storage_type, storage_path, upload_status, chunks_received, total_chunks,
                  user_id, description, metadata, created_at, updated_at
           FROM uploads WHERE user_id = $1 ORDER BY created_at DESC"#,
        user_id
    )
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

/// Get uploads by storage type (public/private)
pub async fn get_by_storage_type(db: &Pool<Postgres>, storage_type: &str) -> Vec<Upload> {
    sqlx::query_as!(
        Upload,
        r#"SELECT id, uuid, original_name, stored_name, extension, mime_type, size_bytes,
                  storage_type, storage_path, upload_status, chunks_received, total_chunks,
                  user_id, description, metadata, created_at, updated_at
           FROM uploads WHERE storage_type = $1 ORDER BY created_at DESC"#,
        storage_type
    )
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

/// Get public upload by UUID (no auth required)
pub async fn get_public_by_uuid(db: &Pool<Postgres>, uuid: &Uuid) -> Result<Upload, sqlx::Error> {
    sqlx::query_as!(
        Upload,
        r#"SELECT id, uuid, original_name, stored_name, extension, mime_type, size_bytes,
                  storage_type, storage_path, upload_status, chunks_received, total_chunks,
                  user_id, description, metadata, created_at, updated_at
           FROM uploads WHERE uuid = $1 AND storage_type = 'public' AND upload_status = 'completed'"#,
        uuid
    )
    .fetch_one(db)
    .await
}

/// Get private upload by UUID (auth required, checks user ownership)
pub async fn get_private_by_uuid(
    db: &Pool<Postgres>,
    uuid: &Uuid,
    user_id: i64,
) -> Result<Upload, sqlx::Error> {
    sqlx::query_as!(
        Upload,
        r#"SELECT id, uuid, original_name, stored_name, extension, mime_type, size_bytes,
                  storage_type, storage_path, upload_status, chunks_received, total_chunks,
                  user_id, description, metadata, created_at, updated_at
           FROM uploads WHERE uuid = $1 AND storage_type = 'private' AND user_id = $2 AND upload_status = 'completed'"#,
        uuid,
        user_id
    )
    .fetch_one(db)
    .await
}

/// Check if upload exists by UUID
pub async fn exists_by_uuid(db: &Pool<Postgres>, uuid: &Uuid) -> bool {
    sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM uploads WHERE uuid = $1)", uuid)
        .fetch_one(db)
        .await
        .unwrap_or(Some(false))
        .unwrap_or(false)
}

/// Get pending uploads for a user (for resumable uploads)
pub async fn get_pending_by_user(db: &Pool<Postgres>, user_id: i64) -> Vec<Upload> {
    sqlx::query_as!(
        Upload,
        r#"SELECT id, uuid, original_name, stored_name, extension, mime_type, size_bytes,
                  storage_type, storage_path, upload_status, chunks_received, total_chunks,
                  user_id, description, metadata, created_at, updated_at
           FROM uploads WHERE user_id = $1 AND upload_status IN ('pending', 'uploading') ORDER BY created_at DESC"#,
        user_id
    )
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

/// Count total uploads
pub async fn count(db: &Pool<Postgres>) -> i64 {
    sqlx::query_scalar!("SELECT COUNT(*) FROM uploads")
        .fetch_one(db)
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0)
}

/// Count uploads by user
pub async fn count_by_user(db: &Pool<Postgres>, user_id: i64) -> i64 {
    sqlx::query_scalar!(
        "SELECT COUNT(*) FROM uploads WHERE user_id = $1",
        user_id
    )
    .fetch_one(db)
    .await
    .unwrap_or(Some(0))
    .unwrap_or(0)
}
