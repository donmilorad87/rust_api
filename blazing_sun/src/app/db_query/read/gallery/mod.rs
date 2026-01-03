//! Gallery Read Queries
//!
//! Read operations for the galleries table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

/// Gallery record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gallery {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub display_order: i32,
    pub cover_image_id: Option<i64>,
    pub cover_image_uuid: Option<uuid::Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Gallery with picture count
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GalleryWithCount {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub display_order: i32,
    pub cover_image_id: Option<i64>,
    pub cover_image_uuid: Option<uuid::Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub picture_count: i64,
}

/// Get gallery by ID
pub async fn get_by_id(db: &Pool<Postgres>, gallery_id: i64) -> Result<Gallery, sqlx::Error> {
    sqlx::query_as!(
        Gallery,
        r#"
        SELECT id, user_id, name, description, is_public, display_order, cover_image_id, cover_image_uuid, created_at, updated_at
        FROM galleries
        WHERE id = $1
        "#,
        gallery_id
    )
    .fetch_one(db)
    .await
}

/// Get gallery by ID for a specific user (ownership check)
pub async fn get_by_id_and_user(
    db: &Pool<Postgres>,
    gallery_id: i64,
    user_id: i64,
) -> Result<Gallery, sqlx::Error> {
    sqlx::query_as!(
        Gallery,
        r#"
        SELECT id, user_id, name, description, is_public, display_order, cover_image_id, cover_image_uuid, created_at, updated_at
        FROM galleries
        WHERE id = $1 AND user_id = $2
        "#,
        gallery_id,
        user_id
    )
    .fetch_one(db)
    .await
}

/// Get all galleries for a user (ordered by display_order)
pub async fn get_by_user(db: &Pool<Postgres>, user_id: i64) -> Result<Vec<Gallery>, sqlx::Error> {
    sqlx::query_as!(
        Gallery,
        r#"
        SELECT id, user_id, name, description, is_public, display_order, cover_image_id, cover_image_uuid, created_at, updated_at
        FROM galleries
        WHERE user_id = $1
        ORDER BY display_order ASC, created_at DESC
        "#,
        user_id
    )
    .fetch_all(db)
    .await
}

/// Get all galleries for a user with picture counts
pub async fn get_by_user_with_counts(
    db: &Pool<Postgres>,
    user_id: i64,
) -> Result<Vec<GalleryWithCount>, sqlx::Error> {
    sqlx::query_as!(
        GalleryWithCount,
        r#"
        SELECT
            g.id,
            g.user_id,
            g.name,
            g.description,
            g.is_public,
            g.display_order,
            g.cover_image_id,
            g.cover_image_uuid,
            g.created_at,
            g.updated_at,
            COUNT(p.id) as "picture_count!"
        FROM galleries g
        LEFT JOIN pictures p ON g.id = p.gallery_id
        WHERE g.user_id = $1
        GROUP BY g.id
        ORDER BY g.display_order ASC, g.created_at DESC
        "#,
        user_id
    )
    .fetch_all(db)
    .await
}

/// Get all public galleries (for browsing)
pub async fn get_public(
    db: &Pool<Postgres>,
    limit: i64,
    offset: i64,
) -> Result<Vec<GalleryWithCount>, sqlx::Error> {
    sqlx::query_as!(
        GalleryWithCount,
        r#"
        SELECT
            g.id,
            g.user_id,
            g.name,
            g.description,
            g.is_public,
            g.display_order,
            g.cover_image_id,
            g.cover_image_uuid,
            g.created_at,
            g.updated_at,
            COUNT(p.id) as "picture_count!"
        FROM galleries g
        LEFT JOIN pictures p ON g.id = p.gallery_id
        WHERE g.is_public = true
        GROUP BY g.id
        ORDER BY g.created_at DESC
        LIMIT $1 OFFSET $2
        "#,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Count total galleries for a user
pub async fn count_by_user(db: &Pool<Postgres>, user_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"SELECT COUNT(*) as "count!" FROM galleries WHERE user_id = $1"#,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.count)
}

/// Count total public galleries
pub async fn count_public(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"SELECT COUNT(*) as "count!" FROM galleries WHERE is_public = true"#
    )
    .fetch_one(db)
    .await?;

    Ok(result.count)
}

/// Check if gallery exists
pub async fn exists(db: &Pool<Postgres>, gallery_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM galleries WHERE id = $1) as "exists!""#,
        gallery_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if user owns gallery
pub async fn user_owns_gallery(
    db: &Pool<Postgres>,
    gallery_id: i64,
    user_id: i64,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM galleries WHERE id = $1 AND user_id = $2) as "exists!""#,
        gallery_id,
        user_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if gallery name exists for user (for validation)
pub async fn name_exists_for_user(
    db: &Pool<Postgres>,
    user_id: i64,
    name: &str,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM galleries WHERE user_id = $1 AND name = $2) as "exists!""#,
        user_id,
        name
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if gallery name exists for user excluding specific gallery (for update validation)
pub async fn name_exists_for_user_except(
    db: &Pool<Postgres>,
    user_id: i64,
    name: &str,
    gallery_id: i64,
) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM galleries WHERE user_id = $1 AND name = $2 AND id != $3) as "exists!""#,
        user_id,
        name,
        gallery_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}
