use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Pool, Postgres};

use crate::app::db_query::read as db_read;
use crate::config::AppConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListGalleryImagesParams {
    pub gallery_id: i64,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Serialize)]
struct ImageItem {
    id: i64,
    gallery_id: i64,
    upload_id: i64,
    title: Option<String>,
    description: Option<String>,
    display_order: i32,
    image_url: String,
    created_at: String,
    updated_at: String,
}

fn build_image_url(base_url: &str, upload_uuid: &uuid::Uuid) -> String {
    format!(
        "{}/api/v1/upload/download/public/{}",
        base_url.trim_end_matches('/'),
        upload_uuid
    )
}

pub async fn execute(db: &Pool<Postgres>, params: &ListGalleryImagesParams) -> Result<serde_json::Value, String> {
    let base_url = AppConfig::app_url();

    if let Err(sqlx::Error::RowNotFound) = db_read::gallery::get_by_id(db, params.gallery_id).await {
        return Ok(json!({
            "status_code": 404,
            "body": {
                "error": "not_found",
                "error_description": "Gallery not found"
            }
        }));
    }

    let total = db_read::picture::count_by_gallery(db, params.gallery_id)
        .await
        .map_err(|e| format!("Failed to count gallery images: {}", e))?;

    let pictures = db_read::picture::get_by_gallery_paginated(db, params.gallery_id, params.limit, params.offset)
        .await
        .map_err(|e| format!("Failed to fetch gallery images: {}", e))?;

    let images = pictures
        .into_iter()
        .map(|picture| ImageItem {
            id: picture.id,
            gallery_id: picture.gallery_id,
            upload_id: picture.upload_id,
            title: picture.title,
            description: picture.description,
            display_order: picture.display_order,
            image_url: build_image_url(base_url, &picture.upload_uuid),
            created_at: picture.created_at.to_rfc3339(),
            updated_at: picture.updated_at.to_rfc3339(),
        })
        .collect::<Vec<_>>();

    Ok(json!({
        "status_code": 200,
        "body": {
            "total": total,
            "limit": params.limit,
            "offset": params.offset,
            "images": images
        }
    }))
}
