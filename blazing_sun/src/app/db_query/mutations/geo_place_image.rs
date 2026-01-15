//! Geo place image mutation queries
//!
//! Write operations for geo_place_images table.

use sqlx::{Pool, Postgres};

pub struct CreateGeoPlaceImageParams {
    pub place_id: i64,
    pub upload_id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub tag: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub created_by: Option<i64>,
}

/// Create a new geo place image record
pub async fn create(
    db: &Pool<Postgres>,
    params: &CreateGeoPlaceImageParams,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO geo_place_images
            (place_id, upload_id, title, description, tag, latitude, longitude, created_by)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
        "#,
        params.place_id,
        params.upload_id,
        params.title,
        params.description,
        params.tag,
        params.latitude,
        params.longitude,
        params.created_by
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}
