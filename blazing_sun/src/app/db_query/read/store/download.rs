//! Store Download Read Queries
//!
//! Read operations for the store_downloads table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Store download record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreDownload {
    pub id: i64,
    pub purchase_id: i64,
    pub user_id: i64,
    pub picture_id: i64,
    pub download_count: i32,
    pub first_downloaded_at: DateTime<Utc>,
    pub last_downloaded_at: DateTime<Utc>,
}

/// Store download with picture details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreDownloadWithPicture {
    pub id: i64,
    pub purchase_id: i64,
    pub user_id: i64,
    pub picture_id: i64,
    pub download_count: i32,
    pub first_downloaded_at: DateTime<Utc>,
    pub last_downloaded_at: DateTime<Utc>,
    // Picture fields
    pub picture_title: Option<String>,
    pub upload_uuid: Uuid,
    pub upload_stored_name: String,
}

/// Get download record by ID
pub async fn get_by_id(db: &Pool<Postgres>, download_id: i64) -> Result<StoreDownload, sqlx::Error> {
    sqlx::query_as!(
        StoreDownload,
        r#"
        SELECT id, purchase_id, user_id, picture_id, download_count, first_downloaded_at, last_downloaded_at
        FROM store_downloads
        WHERE id = $1
        "#,
        download_id
    )
    .fetch_one(db)
    .await
}

/// Get download record by purchase and picture
pub async fn get_by_purchase_and_picture(
    db: &Pool<Postgres>,
    purchase_id: i64,
    picture_id: i64,
) -> Result<StoreDownload, sqlx::Error> {
    sqlx::query_as!(
        StoreDownload,
        r#"
        SELECT id, purchase_id, user_id, picture_id, download_count, first_downloaded_at, last_downloaded_at
        FROM store_downloads
        WHERE purchase_id = $1 AND picture_id = $2
        "#,
        purchase_id,
        picture_id
    )
    .fetch_one(db)
    .await
}

/// Get all downloads for a user with pagination
pub async fn get_by_user_paginated(
    db: &Pool<Postgres>,
    user_id: i64,
    limit: i64,
    offset: i64,
) -> Result<Vec<StoreDownloadWithPicture>, sqlx::Error> {
    sqlx::query_as!(
        StoreDownloadWithPicture,
        r#"
        SELECT
            sd.id,
            sd.purchase_id,
            sd.user_id,
            sd.picture_id,
            sd.download_count,
            sd.first_downloaded_at,
            sd.last_downloaded_at,
            p.title as picture_title,
            u.uuid as upload_uuid,
            u.stored_name as upload_stored_name
        FROM store_downloads sd
        INNER JOIN pictures p ON sd.picture_id = p.id
        INNER JOIN uploads u ON p.upload_id = u.id
        WHERE sd.user_id = $1
        ORDER BY sd.last_downloaded_at DESC
        LIMIT $2 OFFSET $3
        "#,
        user_id,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Get all downloads for a purchase
pub async fn get_by_purchase_id(
    db: &Pool<Postgres>,
    purchase_id: i64,
) -> Result<Vec<StoreDownloadWithPicture>, sqlx::Error> {
    sqlx::query_as!(
        StoreDownloadWithPicture,
        r#"
        SELECT
            sd.id,
            sd.purchase_id,
            sd.user_id,
            sd.picture_id,
            sd.download_count,
            sd.first_downloaded_at,
            sd.last_downloaded_at,
            p.title as picture_title,
            u.uuid as upload_uuid,
            u.stored_name as upload_stored_name
        FROM store_downloads sd
        INNER JOIN pictures p ON sd.picture_id = p.id
        INNER JOIN uploads u ON p.upload_id = u.id
        WHERE sd.purchase_id = $1
        ORDER BY sd.first_downloaded_at ASC
        "#,
        purchase_id
    )
    .fetch_all(db)
    .await
}

/// Check if a download record exists
pub async fn exists_for_purchase_and_picture(
    db: &Pool<Postgres>,
    purchase_id: i64,
    picture_id: i64,
) -> bool {
    sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM store_downloads
            WHERE purchase_id = $1 AND picture_id = $2
        ) as "exists!"
        "#,
        purchase_id,
        picture_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if user can download a picture (has completed purchase for a product containing this picture)
pub async fn user_can_download_picture(
    db: &Pool<Postgres>,
    user_id: i64,
    picture_id: i64,
) -> bool {
    // Check direct picture items
    let direct_access = sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM store_purchases sp
            INNER JOIN store_product_items spi ON sp.product_id = spi.product_id
            WHERE sp.user_id = $1
                AND sp.status = 'completed'
                AND spi.picture_id = $2
        ) as "exists!"
        "#,
        user_id,
        picture_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false);

    if direct_access {
        return true;
    }

    // Check gallery items (picture belongs to a gallery that is part of purchased product)
    sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM store_purchases sp
            INNER JOIN store_product_items spi ON sp.product_id = spi.product_id
            INNER JOIN pictures p ON p.gallery_id = spi.gallery_id
            WHERE sp.user_id = $1
                AND sp.status = 'completed'
                AND p.id = $2
        ) as "exists!"
        "#,
        user_id,
        picture_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Count total downloads for a user
pub async fn count_by_user(db: &Pool<Postgres>, user_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM store_downloads WHERE user_id = $1"#,
        user_id
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Count total downloads for a purchase
pub async fn count_by_purchase(db: &Pool<Postgres>, purchase_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM store_downloads WHERE purchase_id = $1"#,
        purchase_id
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Get total download count (sum of all download_count)
pub async fn get_total_download_count(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COALESCE(SUM(download_count), 0) as "sum!" FROM store_downloads"#
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Get download count for a picture (sum across all users)
pub async fn get_picture_download_count(
    db: &Pool<Postgres>,
    picture_id: i64,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(download_count), 0) as "sum!"
        FROM store_downloads
        WHERE picture_id = $1
        "#,
        picture_id
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Get most downloaded pictures (admin analytics)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PictureDownloadStats {
    pub picture_id: i64,
    pub picture_title: Option<String>,
    pub total_downloads: i64,
    pub unique_users: i64,
}

pub async fn get_most_downloaded_pictures(
    db: &Pool<Postgres>,
    limit: i64,
) -> Result<Vec<PictureDownloadStats>, sqlx::Error> {
    sqlx::query_as!(
        PictureDownloadStats,
        r#"
        SELECT
            sd.picture_id,
            p.title as picture_title,
            SUM(sd.download_count) as "total_downloads!",
            COUNT(DISTINCT sd.user_id) as "unique_users!"
        FROM store_downloads sd
        INNER JOIN pictures p ON sd.picture_id = p.id
        GROUP BY sd.picture_id, p.title
        ORDER BY "total_downloads!" DESC
        LIMIT $1
        "#,
        limit
    )
    .fetch_all(db)
    .await
}
