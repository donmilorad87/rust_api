//! Asset read queries
//!
//! Read operations for the assets table.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Asset record from database
pub struct Asset {
    pub id: i64,
    pub uuid: Uuid,
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
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Get asset by UUID
pub async fn get_by_uuid(db: &Pool<Postgres>, uuid: &Uuid) -> Result<Asset, sqlx::Error> {
    sqlx::query_as!(Asset, "SELECT * FROM assets WHERE uuid = $1", uuid)
        .fetch_one(db)
        .await
}

/// Get asset by UUID (optional - returns None if not found)
pub async fn find_by_uuid(db: &Pool<Postgres>, uuid: &Uuid) -> Option<Asset> {
    sqlx::query_as!(Asset, "SELECT * FROM assets WHERE uuid = $1", uuid)
        .fetch_optional(db)
        .await
        .ok()
        .flatten()
}

/// Get all assets by user ID
pub async fn get_by_user_id(db: &Pool<Postgres>, user_id: i64) -> Vec<Asset> {
    sqlx::query_as!(
        Asset,
        "SELECT * FROM assets WHERE user_id = $1 ORDER BY created_at DESC",
        user_id
    )
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

/// Get assets by category
pub async fn get_by_category(db: &Pool<Postgres>, category: &str) -> Vec<Asset> {
    sqlx::query_as!(
        Asset,
        "SELECT * FROM assets WHERE category = $1 ORDER BY created_at DESC",
        category
    )
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

/// Get assets by user ID and category
pub async fn get_by_user_and_category(
    db: &Pool<Postgres>,
    user_id: i64,
    category: &str,
) -> Vec<Asset> {
    sqlx::query_as!(
        Asset,
        "SELECT * FROM assets WHERE user_id = $1 AND category = $2 ORDER BY created_at DESC",
        user_id,
        category
    )
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

/// Get all assets (admin use)
pub async fn get_all(db: &Pool<Postgres>, limit: i64, offset: i64) -> Vec<Asset> {
    sqlx::query_as!(
        Asset,
        "SELECT * FROM assets ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        limit,
        offset
    )
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

/// Count all assets
pub async fn count(db: &Pool<Postgres>) -> i64 {
    sqlx::query_scalar!("SELECT COUNT(*) FROM assets")
        .fetch_one(db)
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0)
}

/// Count assets by user ID
pub async fn count_by_user(db: &Pool<Postgres>, user_id: i64) -> i64 {
    sqlx::query_scalar!("SELECT COUNT(*) FROM assets WHERE user_id = $1", user_id)
        .fetch_one(db)
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0)
}

/// Check if asset exists by UUID
pub async fn exists(db: &Pool<Postgres>, uuid: &Uuid) -> bool {
    sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM assets WHERE uuid = $1)", uuid)
        .fetch_one(db)
        .await
        .unwrap_or(Some(false))
        .unwrap_or(false)
}
