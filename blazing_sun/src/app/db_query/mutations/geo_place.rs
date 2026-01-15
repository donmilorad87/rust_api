//! Geo place mutation queries
//!
//! Write operations for geo_places table.

use sqlx::{Pool, Postgres};

/// Parameters for creating a geo place
pub struct CreateGeoPlaceParams {
    pub name: String,
    pub place_type: String,
    pub description: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub created_by: Option<i64>,
}

/// Create a new geo place
pub async fn create(db: &Pool<Postgres>, params: &CreateGeoPlaceParams) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO geo_places (name, place_type, description, latitude, longitude, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
        "#,
        params.name,
        params.place_type,
        params.description,
        params.latitude,
        params.longitude,
        params.created_by
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}
