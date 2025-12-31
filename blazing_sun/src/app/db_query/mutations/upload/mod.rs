//! Upload mutations
//!
//! Database operations for creating and updating uploads.

use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Parameters for creating a new upload record
pub struct CreateUploadParams {
    pub uuid: Uuid,
    pub original_name: String,
    pub stored_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub user_id: Option<i64>,
    pub description: Option<String>,
}

/// Create a new upload record
pub async fn create(db: &Pool<Postgres>, params: &CreateUploadParams) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"INSERT INTO uploads (uuid, original_name, stored_name, extension, mime_type, size_bytes, storage_type, storage_path, user_id, description, upload_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed')
           RETURNING id"#,
        params.uuid,
        params.original_name,
        params.stored_name,
        params.extension,
        params.mime_type,
        params.size_bytes,
        params.storage_type,
        params.storage_path,
        params.user_id,
        params.description
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Parameters for creating a chunked upload (pending status)
pub struct CreateChunkedUploadParams {
    pub uuid: Uuid,
    pub original_name: String,
    pub stored_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub total_chunks: i32,
    pub user_id: Option<i64>,
}

/// Create a chunked upload record (pending status)
pub async fn create_chunked(
    db: &Pool<Postgres>,
    params: &CreateChunkedUploadParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"INSERT INTO uploads (uuid, original_name, stored_name, extension, mime_type, size_bytes, storage_type, storage_path, upload_status, total_chunks, chunks_received, user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, 0, $10)
           RETURNING id"#,
        params.uuid,
        params.original_name,
        params.stored_name,
        params.extension,
        params.mime_type,
        params.size_bytes,
        params.storage_type,
        params.storage_path,
        params.total_chunks,
        params.user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Update chunk progress
pub async fn update_chunk_progress(
    db: &Pool<Postgres>,
    upload_id: i64,
    chunks_received: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE uploads SET chunks_received = $1, upload_status = 'uploading', updated_at = NOW() WHERE id = $2"#,
        chunks_received,
        upload_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Mark upload as completed
pub async fn mark_completed(db: &Pool<Postgres>, upload_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE uploads SET upload_status = 'completed', updated_at = NOW() WHERE id = $1"#,
        upload_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Mark upload as failed
pub async fn mark_failed(db: &Pool<Postgres>, upload_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE uploads SET upload_status = 'failed', updated_at = NOW() WHERE id = $1"#,
        upload_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update upload metadata
pub async fn update_metadata(
    db: &Pool<Postgres>,
    upload_id: i64,
    description: Option<&str>,
    metadata: Option<&serde_json::Value>,
) -> Result<(), sqlx::Error> {
    if let Some(desc) = description {
        sqlx::query!(
            "UPDATE uploads SET description = $1, updated_at = NOW() WHERE id = $2",
            desc,
            upload_id
        )
        .execute(db)
        .await?;
    }

    if let Some(meta) = metadata {
        sqlx::query!(
            "UPDATE uploads SET metadata = $1, updated_at = NOW() WHERE id = $2",
            meta,
            upload_id
        )
        .execute(db)
        .await?;
    }

    Ok(())
}

/// Delete an upload record
pub async fn delete(db: &Pool<Postgres>, upload_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!("DELETE FROM uploads WHERE id = $1", upload_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected() > 0)
}

/// Delete an upload by UUID
pub async fn delete_by_uuid(db: &Pool<Postgres>, uuid: &Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!("DELETE FROM uploads WHERE uuid = $1", uuid)
        .execute(db)
        .await?;

    Ok(result.rows_affected() > 0)
}
