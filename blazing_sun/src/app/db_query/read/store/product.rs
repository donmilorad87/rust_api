//! Store Product Read Queries
//!
//! Read operations for the store_products table.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

/// Store product record (full)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreProduct {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub price_cents: i64,
    pub product_type: String,
    pub category_id: Option<i64>,
    pub cover_image_id: Option<i64>,

    // Rich metadata for natural images
    pub author_name: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub nearest_mountain: Option<String>,
    pub nearest_river: Option<String>,
    pub natural_park: Option<String>,
    pub altitude_meters: Option<i32>,
    pub season: Option<String>,
    pub weather_conditions: Option<String>,
    pub camera_info: Option<String>,
    pub date_taken: Option<NaiveDate>,

    // Location
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,

    // Status
    pub is_active: bool,
    pub is_sold: bool,
    pub is_featured: bool,

    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Store product list item (for listings)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreProductListItem {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub price_cents: i64,
    pub product_type: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub cover_image_id: Option<i64>,
    pub author_name: Option<String>,
    pub country: Option<String>,
    pub is_featured: bool,
    pub created_at: DateTime<Utc>,
}

/// Store product with category info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreProductWithCategory {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub price_cents: i64,
    pub product_type: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub category_slug: Option<String>,
    pub cover_image_id: Option<i64>,

    // Rich metadata
    pub author_name: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub nearest_mountain: Option<String>,
    pub nearest_river: Option<String>,
    pub natural_park: Option<String>,
    pub altitude_meters: Option<i32>,
    pub season: Option<String>,
    pub weather_conditions: Option<String>,
    pub camera_info: Option<String>,
    pub date_taken: Option<NaiveDate>,

    // Location
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,

    // Status
    pub is_active: bool,
    pub is_sold: bool,
    pub is_featured: bool,

    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Get all available products (active and not sold) with pagination
pub async fn get_available_paginated(
    db: &Pool<Postgres>,
    limit: i64,
    offset: i64,
) -> Result<Vec<StoreProductListItem>, sqlx::Error> {
    sqlx::query_as!(
        StoreProductListItem,
        r#"
        SELECT
            p.id,
            p.title,
            p.slug,
            p.description,
            p.price_cents,
            p.product_type,
            p.category_id,
            c.name as category_name,
            p.cover_image_id,
            p.author_name,
            p.country,
            p.is_featured,
            p.created_at
        FROM store_products p
        LEFT JOIN store_categories c ON p.category_id = c.id
        WHERE p.is_active = TRUE AND p.is_sold = FALSE
        ORDER BY p.is_featured DESC, p.created_at DESC
        LIMIT $1 OFFSET $2
        "#,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Get all products (for admin) with pagination
pub async fn get_all_admin_paginated(
    db: &Pool<Postgres>,
    limit: i64,
    offset: i64,
) -> Result<Vec<StoreProductListItem>, sqlx::Error> {
    sqlx::query_as!(
        StoreProductListItem,
        r#"
        SELECT
            p.id,
            p.title,
            p.slug,
            p.description,
            p.price_cents,
            p.product_type,
            p.category_id,
            c.name as category_name,
            p.cover_image_id,
            p.author_name,
            p.country,
            p.is_featured,
            p.created_at
        FROM store_products p
        LEFT JOIN store_categories c ON p.category_id = c.id
        ORDER BY p.created_at DESC
        LIMIT $1 OFFSET $2
        "#,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Get products by category slug with pagination
pub async fn get_by_category_slug_paginated(
    db: &Pool<Postgres>,
    category_slug: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<StoreProductListItem>, sqlx::Error> {
    sqlx::query_as!(
        StoreProductListItem,
        r#"
        SELECT
            p.id,
            p.title,
            p.slug,
            p.description,
            p.price_cents,
            p.product_type,
            p.category_id,
            c.name as category_name,
            p.cover_image_id,
            p.author_name,
            p.country,
            p.is_featured,
            p.created_at
        FROM store_products p
        INNER JOIN store_categories c ON p.category_id = c.id
        WHERE c.slug = $1 AND p.is_active = TRUE AND p.is_sold = FALSE
        ORDER BY p.is_featured DESC, p.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        category_slug,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Get featured products
pub async fn get_featured(
    db: &Pool<Postgres>,
    limit: i64,
) -> Result<Vec<StoreProductListItem>, sqlx::Error> {
    sqlx::query_as!(
        StoreProductListItem,
        r#"
        SELECT
            p.id,
            p.title,
            p.slug,
            p.description,
            p.price_cents,
            p.product_type,
            p.category_id,
            c.name as category_name,
            p.cover_image_id,
            p.author_name,
            p.country,
            p.is_featured,
            p.created_at
        FROM store_products p
        LEFT JOIN store_categories c ON p.category_id = c.id
        WHERE p.is_active = TRUE AND p.is_sold = FALSE AND p.is_featured = TRUE
        ORDER BY p.created_at DESC
        LIMIT $1
        "#,
        limit
    )
    .fetch_all(db)
    .await
}

/// Get product by ID
pub async fn get_by_id(db: &Pool<Postgres>, product_id: i64) -> Result<StoreProduct, sqlx::Error> {
    sqlx::query_as!(
        StoreProduct,
        r#"
        SELECT
            id, title, slug, description, price_cents, product_type, category_id, cover_image_id,
            author_name, city, country, region, nearest_mountain, nearest_river, natural_park,
            altitude_meters, season, weather_conditions, camera_info, date_taken,
            latitude, longitude, tags,
            is_active, is_sold, is_featured, created_at, updated_at
        FROM store_products
        WHERE id = $1
        "#,
        product_id
    )
    .fetch_one(db)
    .await
}

/// Get product by ID with category info
pub async fn get_by_id_with_category(
    db: &Pool<Postgres>,
    product_id: i64,
) -> Result<StoreProductWithCategory, sqlx::Error> {
    sqlx::query_as!(
        StoreProductWithCategory,
        r#"
        SELECT
            p.id, p.title, p.slug, p.description, p.price_cents, p.product_type,
            p.category_id, c.name as category_name, c.slug as category_slug,
            p.cover_image_id, p.author_name, p.city, p.country, p.region,
            p.nearest_mountain, p.nearest_river, p.natural_park,
            p.altitude_meters, p.season, p.weather_conditions, p.camera_info, p.date_taken,
            p.latitude, p.longitude, p.tags,
            p.is_active, p.is_sold, p.is_featured, p.created_at, p.updated_at
        FROM store_products p
        LEFT JOIN store_categories c ON p.category_id = c.id
        WHERE p.id = $1
        "#,
        product_id
    )
    .fetch_one(db)
    .await
}

/// Get product by slug
pub async fn get_by_slug(db: &Pool<Postgres>, slug: &str) -> Result<StoreProduct, sqlx::Error> {
    sqlx::query_as!(
        StoreProduct,
        r#"
        SELECT
            id, title, slug, description, price_cents, product_type, category_id, cover_image_id,
            author_name, city, country, region, nearest_mountain, nearest_river, natural_park,
            altitude_meters, season, weather_conditions, camera_info, date_taken,
            latitude, longitude, tags,
            is_active, is_sold, is_featured, created_at, updated_at
        FROM store_products
        WHERE slug = $1 AND is_active = TRUE
        "#,
        slug
    )
    .fetch_one(db)
    .await
}

/// Get product by slug with category info
pub async fn get_by_slug_with_category(
    db: &Pool<Postgres>,
    slug: &str,
) -> Result<StoreProductWithCategory, sqlx::Error> {
    sqlx::query_as!(
        StoreProductWithCategory,
        r#"
        SELECT
            p.id, p.title, p.slug, p.description, p.price_cents, p.product_type,
            p.category_id, c.name as category_name, c.slug as category_slug,
            p.cover_image_id, p.author_name, p.city, p.country, p.region,
            p.nearest_mountain, p.nearest_river, p.natural_park,
            p.altitude_meters, p.season, p.weather_conditions, p.camera_info, p.date_taken,
            p.latitude, p.longitude, p.tags,
            p.is_active, p.is_sold, p.is_featured, p.created_at, p.updated_at
        FROM store_products p
        LEFT JOIN store_categories c ON p.category_id = c.id
        WHERE p.slug = $1 AND p.is_active = TRUE
        "#,
        slug
    )
    .fetch_one(db)
    .await
}

/// Get product by slug (admin - includes inactive)
pub async fn get_by_slug_admin(db: &Pool<Postgres>, slug: &str) -> Result<StoreProduct, sqlx::Error> {
    sqlx::query_as!(
        StoreProduct,
        r#"
        SELECT
            id, title, slug, description, price_cents, product_type, category_id, cover_image_id,
            author_name, city, country, region, nearest_mountain, nearest_river, natural_park,
            altitude_meters, season, weather_conditions, camera_info, date_taken,
            latitude, longitude, tags,
            is_active, is_sold, is_featured, created_at, updated_at
        FROM store_products
        WHERE slug = $1
        "#,
        slug
    )
    .fetch_one(db)
    .await
}

/// Search products by tags
pub async fn search_by_tags(
    db: &Pool<Postgres>,
    tags: &[String],
    limit: i64,
    offset: i64,
) -> Result<Vec<StoreProductListItem>, sqlx::Error> {
    sqlx::query_as!(
        StoreProductListItem,
        r#"
        SELECT
            p.id,
            p.title,
            p.slug,
            p.description,
            p.price_cents,
            p.product_type,
            p.category_id,
            c.name as category_name,
            p.cover_image_id,
            p.author_name,
            p.country,
            p.is_featured,
            p.created_at
        FROM store_products p
        LEFT JOIN store_categories c ON p.category_id = c.id
        WHERE p.is_active = TRUE AND p.is_sold = FALSE AND p.tags && $1
        ORDER BY p.is_featured DESC, p.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        tags,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Search products by country
pub async fn search_by_country(
    db: &Pool<Postgres>,
    country: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<StoreProductListItem>, sqlx::Error> {
    sqlx::query_as!(
        StoreProductListItem,
        r#"
        SELECT
            p.id,
            p.title,
            p.slug,
            p.description,
            p.price_cents,
            p.product_type,
            p.category_id,
            c.name as category_name,
            p.cover_image_id,
            p.author_name,
            p.country,
            p.is_featured,
            p.created_at
        FROM store_products p
        LEFT JOIN store_categories c ON p.category_id = c.id
        WHERE p.is_active = TRUE AND p.is_sold = FALSE AND p.country ILIKE $1
        ORDER BY p.is_featured DESC, p.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        country,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Search products by season
pub async fn search_by_season(
    db: &Pool<Postgres>,
    season: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<StoreProductListItem>, sqlx::Error> {
    sqlx::query_as!(
        StoreProductListItem,
        r#"
        SELECT
            p.id,
            p.title,
            p.slug,
            p.description,
            p.price_cents,
            p.product_type,
            p.category_id,
            c.name as category_name,
            p.cover_image_id,
            p.author_name,
            p.country,
            p.is_featured,
            p.created_at
        FROM store_products p
        LEFT JOIN store_categories c ON p.category_id = c.id
        WHERE p.is_active = TRUE AND p.is_sold = FALSE AND p.season = $1
        ORDER BY p.is_featured DESC, p.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        season,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Search products by text (title, description, author)
pub async fn search_by_text(
    db: &Pool<Postgres>,
    search_term: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<StoreProductListItem>, sqlx::Error> {
    let search_pattern = format!("%{}%", search_term);
    sqlx::query_as!(
        StoreProductListItem,
        r#"
        SELECT
            p.id,
            p.title,
            p.slug,
            p.description,
            p.price_cents,
            p.product_type,
            p.category_id,
            c.name as category_name,
            p.cover_image_id,
            p.author_name,
            p.country,
            p.is_featured,
            p.created_at
        FROM store_products p
        LEFT JOIN store_categories c ON p.category_id = c.id
        WHERE p.is_active = TRUE AND p.is_sold = FALSE
            AND (p.title ILIKE $1 OR p.description ILIKE $1 OR p.author_name ILIKE $1)
        ORDER BY p.is_featured DESC, p.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        search_pattern,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Check if product slug exists
pub async fn slug_exists(db: &Pool<Postgres>, slug: &str) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM store_products WHERE slug = $1) as "exists!""#,
        slug
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if product slug exists excluding specific product
pub async fn slug_exists_except(db: &Pool<Postgres>, slug: &str, product_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM store_products WHERE slug = $1 AND id != $2) as "exists!""#,
        slug,
        product_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if product exists by ID
pub async fn exists(db: &Pool<Postgres>, product_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM store_products WHERE id = $1) as "exists!""#,
        product_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Count available products
pub async fn count_available(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM store_products WHERE is_active = TRUE AND is_sold = FALSE"#
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Count products by category slug
pub async fn count_by_category_slug(db: &Pool<Postgres>, category_slug: &str) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*) as "count!"
        FROM store_products p
        INNER JOIN store_categories c ON p.category_id = c.id
        WHERE c.slug = $1 AND p.is_active = TRUE AND p.is_sold = FALSE
        "#,
        category_slug
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Count all products (for admin)
pub async fn count_all(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(r#"SELECT COUNT(*) as "count!" FROM store_products"#)
        .fetch_one(db)
        .await?;
    Ok(result)
}

/// Get distinct countries from products
pub async fn get_distinct_countries(db: &Pool<Postgres>) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        SELECT DISTINCT country
        FROM store_products
        WHERE country IS NOT NULL AND is_active = TRUE AND is_sold = FALSE
        ORDER BY country
        "#
    )
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().filter_map(|r| r.country).collect())
}

/// Get distinct seasons from products
pub async fn get_distinct_seasons(db: &Pool<Postgres>) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query!(
        r#"
        SELECT DISTINCT season
        FROM store_products
        WHERE season IS NOT NULL AND is_active = TRUE AND is_sold = FALSE
        ORDER BY season
        "#
    )
    .fetch_all(db)
    .await?;

    Ok(rows.into_iter().filter_map(|r| r.season).collect())
}

/// Tag with usage count
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TagWithCount {
    pub tag: Option<String>,
    pub count: i64,
}

/// Get all unique tags from products with usage counts
pub async fn get_tags_with_counts(db: &Pool<Postgres>) -> Result<Vec<TagWithCount>, sqlx::Error> {
    let rows: Vec<TagWithCount> = sqlx::query_as(
        r#"
        SELECT tag, COUNT(*) as count
        FROM (
            SELECT UNNEST(tags) as tag
            FROM store_products
            WHERE is_active = TRUE AND is_sold = FALSE AND tags IS NOT NULL
        ) t
        GROUP BY tag
        ORDER BY count DESC, tag ASC
        "#
    )
    .fetch_all(db)
    .await?;

    // Filter out None tags
    let tags = rows
        .into_iter()
        .filter(|t| t.tag.is_some())
        .collect();

    Ok(tags)
}
