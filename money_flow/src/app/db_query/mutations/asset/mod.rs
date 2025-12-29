//! Asset mutation queries
//!
//! Create, update, delete operations for the assets table.

use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Parameters for creating a new asset
pub struct CreateAssetParams {
    pub title: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub original_name: String,
    pub stored_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub subfolder: Option<String>,
    pub user_id: Option<i64>,
}

/// Create a new asset
///
/// Returns the UUID of the created asset
pub async fn create(db: &Pool<Postgres>, params: &CreateAssetParams) -> Result<Uuid, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO assets (
            title, description, category,
            original_name, stored_name, extension, mime_type, size_bytes,
            storage_type, storage_path, subfolder, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING uuid
        "#,
        params.title,
        params.description,
        params.category,
        params.original_name,
        params.stored_name,
        params.extension,
        params.mime_type,
        params.size_bytes,
        params.storage_type,
        params.storage_path,
        params.subfolder,
        params.user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.uuid)
}

/// Parameters for updating asset metadata
pub struct UpdateAssetParams {
    pub title: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
}

/// Update asset metadata
pub async fn update(
    db: &Pool<Postgres>,
    uuid: &Uuid,
    params: &UpdateAssetParams,
) -> Result<(), sqlx::Error> {
    // Update each field individually if present
    if let Some(ref title) = params.title {
        sqlx::query!(
            "UPDATE assets SET title = $1, updated_at = NOW() WHERE uuid = $2",
            title,
            uuid
        )
        .execute(db)
        .await?;
    }
    if let Some(ref description) = params.description {
        sqlx::query!(
            "UPDATE assets SET description = $1, updated_at = NOW() WHERE uuid = $2",
            description,
            uuid
        )
        .execute(db)
        .await?;
    }
    if let Some(ref category) = params.category {
        sqlx::query!(
            "UPDATE assets SET category = $1, updated_at = NOW() WHERE uuid = $2",
            category,
            uuid
        )
        .execute(db)
        .await?;
    }
    Ok(())
}

/// Delete an asset by UUID
///
/// Returns true if the asset was deleted
pub async fn delete(db: &Pool<Postgres>, uuid: &Uuid) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!("DELETE FROM assets WHERE uuid = $1", uuid)
        .execute(db)
        .await?;
    Ok(result.rows_affected() > 0)
}

/// Delete all assets by user ID
///
/// Returns the number of deleted assets
pub async fn delete_by_user(db: &Pool<Postgres>, user_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!("DELETE FROM assets WHERE user_id = $1", user_id)
        .execute(db)
        .await?;
    Ok(result.rows_affected())
}

/// Transfer asset ownership to another user
pub async fn transfer_ownership(
    db: &Pool<Postgres>,
    uuid: &Uuid,
    new_user_id: Option<i64>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE assets SET user_id = $1, updated_at = NOW() WHERE uuid = $2",
        new_user_id,
        uuid
    )
    .execute(db)
    .await?;
    Ok(())
}
