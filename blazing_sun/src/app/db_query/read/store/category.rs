//! Store Category Read Queries
//!
//! Read operations for the store_categories table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

/// Store category record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreCategory {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub cover_image_id: Option<i64>,
    pub display_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Store category with product count
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreCategoryWithCount {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub cover_image_id: Option<i64>,
    pub display_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub product_count: i64,
}

/// Get all active categories
pub async fn get_all_active(db: &Pool<Postgres>) -> Result<Vec<StoreCategory>, sqlx::Error> {
    sqlx::query_as!(
        StoreCategory,
        r#"
        SELECT id, name, slug, description, cover_image_id, display_order, is_active, created_at, updated_at
        FROM store_categories
        WHERE is_active = TRUE
        ORDER BY display_order ASC, name ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get all categories including inactive (for admin)
pub async fn get_all_admin(db: &Pool<Postgres>) -> Result<Vec<StoreCategory>, sqlx::Error> {
    sqlx::query_as!(
        StoreCategory,
        r#"
        SELECT id, name, slug, description, cover_image_id, display_order, is_active, created_at, updated_at
        FROM store_categories
        ORDER BY display_order ASC, name ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get all active categories with product counts
pub async fn get_all_active_with_counts(
    db: &Pool<Postgres>,
) -> Result<Vec<StoreCategoryWithCount>, sqlx::Error> {
    sqlx::query_as!(
        StoreCategoryWithCount,
        r#"
        SELECT
            c.id,
            c.name,
            c.slug,
            c.description,
            c.cover_image_id,
            c.display_order,
            c.is_active,
            c.created_at,
            c.updated_at,
            COUNT(p.id) FILTER (WHERE p.is_active = TRUE AND p.is_sold = FALSE) as "product_count!"
        FROM store_categories c
        LEFT JOIN store_products p ON c.id = p.category_id
        WHERE c.is_active = TRUE
        GROUP BY c.id
        ORDER BY c.display_order ASC, c.name ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get all categories with product counts (for admin)
pub async fn get_all_admin_with_counts(
    db: &Pool<Postgres>,
) -> Result<Vec<StoreCategoryWithCount>, sqlx::Error> {
    sqlx::query_as!(
        StoreCategoryWithCount,
        r#"
        SELECT
            c.id,
            c.name,
            c.slug,
            c.description,
            c.cover_image_id,
            c.display_order,
            c.is_active,
            c.created_at,
            c.updated_at,
            COUNT(p.id) as "product_count!"
        FROM store_categories c
        LEFT JOIN store_products p ON c.id = p.category_id
        GROUP BY c.id
        ORDER BY c.display_order ASC, c.name ASC
        "#
    )
    .fetch_all(db)
    .await
}

/// Get category by ID
pub async fn get_by_id(db: &Pool<Postgres>, category_id: i64) -> Result<StoreCategory, sqlx::Error> {
    sqlx::query_as!(
        StoreCategory,
        r#"
        SELECT id, name, slug, description, cover_image_id, display_order, is_active, created_at, updated_at
        FROM store_categories
        WHERE id = $1
        "#,
        category_id
    )
    .fetch_one(db)
    .await
}

/// Get category by slug
pub async fn get_by_slug(db: &Pool<Postgres>, slug: &str) -> Result<StoreCategory, sqlx::Error> {
    sqlx::query_as!(
        StoreCategory,
        r#"
        SELECT id, name, slug, description, cover_image_id, display_order, is_active, created_at, updated_at
        FROM store_categories
        WHERE slug = $1 AND is_active = TRUE
        "#,
        slug
    )
    .fetch_one(db)
    .await
}

/// Get category by slug (for admin - includes inactive)
pub async fn get_by_slug_admin(
    db: &Pool<Postgres>,
    slug: &str,
) -> Result<StoreCategory, sqlx::Error> {
    sqlx::query_as!(
        StoreCategory,
        r#"
        SELECT id, name, slug, description, cover_image_id, display_order, is_active, created_at, updated_at
        FROM store_categories
        WHERE slug = $1
        "#,
        slug
    )
    .fetch_one(db)
    .await
}

/// Check if category slug exists
pub async fn slug_exists(db: &Pool<Postgres>, slug: &str) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM store_categories WHERE slug = $1) as "exists!""#,
        slug
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if category slug exists excluding specific category
pub async fn slug_exists_except(db: &Pool<Postgres>, slug: &str, category_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM store_categories WHERE slug = $1 AND id != $2) as "exists!""#,
        slug,
        category_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if category exists by ID
pub async fn exists(db: &Pool<Postgres>, category_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM store_categories WHERE id = $1) as "exists!""#,
        category_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Count total active categories
pub async fn count_active(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM store_categories WHERE is_active = TRUE"#
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Count all categories
pub async fn count_all(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(r#"SELECT COUNT(*) as "count!" FROM store_categories"#)
        .fetch_one(db)
        .await?;
    Ok(result)
}
