//! Store Product Item Read Queries
//!
//! Read operations for the store_product_items table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Store product item record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreProductItem {
    pub id: i64,
    pub product_id: i64,
    pub item_type: String,
    pub picture_id: Option<i64>,
    pub gallery_id: Option<i64>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
}

/// Store product item with picture details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreProductItemWithPicture {
    pub id: i64,
    pub product_id: i64,
    pub item_type: String,
    pub picture_id: Option<i64>,
    pub gallery_id: Option<i64>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
    // Picture fields (when item_type = 'picture')
    pub picture_title: Option<String>,
    pub picture_description: Option<String>,
    pub upload_id: Option<i64>,
    pub upload_uuid: Option<Uuid>,
    pub upload_stored_name: Option<String>,
}

/// Store product item with gallery details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreProductItemWithGallery {
    pub id: i64,
    pub product_id: i64,
    pub item_type: String,
    pub picture_id: Option<i64>,
    pub gallery_id: Option<i64>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
    // Gallery fields (when item_type = 'gallery')
    pub gallery_name: Option<String>,
    pub gallery_description: Option<String>,
    pub gallery_cover_image_id: Option<i64>,
    pub gallery_picture_count: Option<i64>,
}

/// Get all items for a product
pub async fn get_by_product_id(
    db: &Pool<Postgres>,
    product_id: i64,
) -> Result<Vec<StoreProductItem>, sqlx::Error> {
    sqlx::query_as!(
        StoreProductItem,
        r#"
        SELECT id, product_id, item_type, picture_id, gallery_id, display_order, created_at
        FROM store_product_items
        WHERE product_id = $1
        ORDER BY display_order ASC
        "#,
        product_id
    )
    .fetch_all(db)
    .await
}

/// Get all picture items for a product with picture details
pub async fn get_pictures_by_product_id(
    db: &Pool<Postgres>,
    product_id: i64,
) -> Result<Vec<StoreProductItemWithPicture>, sqlx::Error> {
    sqlx::query_as!(
        StoreProductItemWithPicture,
        r#"
        SELECT
            spi.id,
            spi.product_id,
            spi.item_type,
            spi.picture_id,
            spi.gallery_id,
            spi.display_order,
            spi.created_at,
            p.title as picture_title,
            p.description as picture_description,
            p.upload_id,
            u.uuid as upload_uuid,
            u.stored_name as upload_stored_name
        FROM store_product_items spi
        LEFT JOIN pictures p ON spi.picture_id = p.id
        LEFT JOIN uploads u ON p.upload_id = u.id
        WHERE spi.product_id = $1 AND spi.item_type = 'picture'
        ORDER BY spi.display_order ASC
        "#,
        product_id
    )
    .fetch_all(db)
    .await
}

/// Get all gallery items for a product with gallery details
pub async fn get_galleries_by_product_id(
    db: &Pool<Postgres>,
    product_id: i64,
) -> Result<Vec<StoreProductItemWithGallery>, sqlx::Error> {
    sqlx::query_as!(
        StoreProductItemWithGallery,
        r#"
        SELECT
            spi.id,
            spi.product_id,
            spi.item_type,
            spi.picture_id,
            spi.gallery_id,
            spi.display_order,
            spi.created_at,
            g.name as gallery_name,
            g.description as gallery_description,
            g.cover_image_id as gallery_cover_image_id,
            (SELECT COUNT(*) FROM pictures WHERE gallery_id = g.id) as gallery_picture_count
        FROM store_product_items spi
        LEFT JOIN galleries g ON spi.gallery_id = g.id
        WHERE spi.product_id = $1 AND spi.item_type = 'gallery'
        ORDER BY spi.display_order ASC
        "#,
        product_id
    )
    .fetch_all(db)
    .await
}

/// Get item by ID
pub async fn get_by_id(db: &Pool<Postgres>, item_id: i64) -> Result<StoreProductItem, sqlx::Error> {
    sqlx::query_as!(
        StoreProductItem,
        r#"
        SELECT id, product_id, item_type, picture_id, gallery_id, display_order, created_at
        FROM store_product_items
        WHERE id = $1
        "#,
        item_id
    )
    .fetch_one(db)
    .await
}

/// Check if picture is already linked to product
pub async fn picture_exists_in_product(
    db: &Pool<Postgres>,
    product_id: i64,
    picture_id: i64,
) -> bool {
    sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM store_product_items
            WHERE product_id = $1 AND picture_id = $2
        ) as "exists!"
        "#,
        product_id,
        picture_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if gallery is already linked to product
pub async fn gallery_exists_in_product(
    db: &Pool<Postgres>,
    product_id: i64,
    gallery_id: i64,
) -> bool {
    sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM store_product_items
            WHERE product_id = $1 AND gallery_id = $2
        ) as "exists!"
        "#,
        product_id,
        gallery_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Count items in a product
pub async fn count_by_product_id(db: &Pool<Postgres>, product_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM store_product_items WHERE product_id = $1"#,
        product_id
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Get all picture IDs for a product (for download access checking)
pub async fn get_picture_ids_by_product_id(
    db: &Pool<Postgres>,
    product_id: i64,
) -> Result<Vec<i64>, sqlx::Error> {
    // Get direct picture items
    let direct_pictures = sqlx::query!(
        r#"
        SELECT picture_id
        FROM store_product_items
        WHERE product_id = $1 AND item_type = 'picture' AND picture_id IS NOT NULL
        "#,
        product_id
    )
    .fetch_all(db)
    .await?;

    // Get pictures from gallery items
    let gallery_pictures = sqlx::query!(
        r#"
        SELECT p.id as picture_id
        FROM store_product_items spi
        INNER JOIN pictures p ON p.gallery_id = spi.gallery_id
        WHERE spi.product_id = $1 AND spi.item_type = 'gallery'
        "#,
        product_id
    )
    .fetch_all(db)
    .await?;

    let mut picture_ids: Vec<i64> = direct_pictures
        .into_iter()
        .filter_map(|r| r.picture_id)
        .collect();

    picture_ids.extend(gallery_pictures.into_iter().map(|r| r.picture_id));

    Ok(picture_ids)
}
