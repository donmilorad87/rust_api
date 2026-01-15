//! Geo place read queries
//!
//! Read operations for geo_places table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoPlace {
    pub id: i64,
    pub name: String,
    pub place_type: String,
    pub description: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub created_by: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub image_count: i64,
}

/// List all geo places
pub async fn get_all(db: &Pool<Postgres>) -> Result<Vec<GeoPlace>, sqlx::Error> {
    sqlx::query_as!(
        GeoPlace,
        r#"
        SELECT
            p.id,
            p.name,
            p.place_type,
            p.description,
            p.latitude,
            p.longitude,
            p.created_by,
            p.created_at,
            p.updated_at,
            COUNT(i.id) as "image_count!"
        FROM geo_places p
        LEFT JOIN geo_place_images i ON p.id = i.place_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
        "#
    )
    .fetch_all(db)
    .await
}

/// List geo places by type
pub async fn get_by_type(
    db: &Pool<Postgres>,
    place_type: &str,
) -> Result<Vec<GeoPlace>, sqlx::Error> {
    sqlx::query_as!(
        GeoPlace,
        r#"
        SELECT
            p.id,
            p.name,
            p.place_type,
            p.description,
            p.latitude,
            p.longitude,
            p.created_by,
            p.created_at,
            p.updated_at,
            COUNT(i.id) as "image_count!"
        FROM geo_places p
        LEFT JOIN geo_place_images i ON p.id = i.place_id
        WHERE p.place_type = $1
        GROUP BY p.id
        ORDER BY p.created_at DESC
        "#,
        place_type
    )
    .fetch_all(db)
    .await
}

/// Check if geo place exists
pub async fn exists(db: &Pool<Postgres>, place_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM geo_places WHERE id = $1) as "exists!""#,
        place_id
    )
    .fetch_one(db)
    .await
    .map(|row| row.exists)
    .unwrap_or(false)
}
