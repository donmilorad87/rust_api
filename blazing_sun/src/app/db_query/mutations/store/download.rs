//! Store Download Mutation Queries
//!
//! Write operations for the store_downloads table.

use sqlx::{Pool, Postgres};

/// Parameters for recording a download
pub struct RecordDownloadParams {
    pub purchase_id: i64,
    pub user_id: i64,
    pub picture_id: i64,
}

/// Record a new download or increment existing count
/// Uses upsert pattern to handle first download vs. subsequent downloads
pub async fn record_download(
    db: &Pool<Postgres>,
    params: &RecordDownloadParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO store_downloads (purchase_id, user_id, picture_id, download_count, first_downloaded_at, last_downloaded_at)
        VALUES ($1, $2, $3, 1, NOW(), NOW())
        ON CONFLICT (purchase_id, picture_id) DO UPDATE SET
            download_count = store_downloads.download_count + 1,
            last_downloaded_at = NOW()
        RETURNING id
        "#,
        params.purchase_id,
        params.user_id,
        params.picture_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Increment download count for existing record
pub async fn increment_count(
    db: &Pool<Postgres>,
    download_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE store_downloads
        SET download_count = download_count + 1,
            last_downloaded_at = NOW()
        WHERE id = $1
        "#,
        download_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Increment download count by purchase and picture
pub async fn increment_by_purchase_and_picture(
    db: &Pool<Postgres>,
    purchase_id: i64,
    picture_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE store_downloads
        SET download_count = download_count + 1,
            last_downloaded_at = NOW()
        WHERE purchase_id = $1 AND picture_id = $2
        "#,
        purchase_id,
        picture_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete a download record
pub async fn delete(db: &Pool<Postgres>, download_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM store_downloads WHERE id = $1"#, download_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}

/// Delete all download records for a purchase (used when refunding)
pub async fn delete_by_purchase(
    db: &Pool<Postgres>,
    purchase_id: i64,
) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(
        r#"DELETE FROM store_downloads WHERE purchase_id = $1"#,
        purchase_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}
