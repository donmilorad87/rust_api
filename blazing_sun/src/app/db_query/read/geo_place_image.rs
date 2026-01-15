//! Geo place image read queries
//!
//! Read operations for geo_place_images table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoPlaceImage {
    pub id: i64,
    pub place_id: i64,
    pub upload_id: i64,
    pub upload_uuid: uuid::Uuid,
    pub title: Option<String>,
    pub description: Option<String>,
    pub tag: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub created_by: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// List images for a geo place
pub async fn get_by_place(
    db: &Pool<Postgres>,
    place_id: i64,
) -> Result<Vec<GeoPlaceImage>, sqlx::Error> {
    sqlx::query_as!(
        GeoPlaceImage,
        r#"
        SELECT
            i.id,
            i.place_id,
            i.upload_id,
            u.uuid as "upload_uuid!",
            i.title,
            i.description,
            i.tag,
            i.latitude,
            i.longitude,
            i.created_by,
            i.created_at,
            i.updated_at
        FROM geo_place_images i
        JOIN uploads u ON u.id = i.upload_id
        WHERE i.place_id = $1
        ORDER BY i.created_at DESC
        "#,
        place_id
    )
    .fetch_all(db)
    .await
}
