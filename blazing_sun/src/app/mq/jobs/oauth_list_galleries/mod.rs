use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Pool, Postgres};

use crate::app::db_query::read as db_read;
use crate::config::AppConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListGalleriesParams {
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Serialize)]
struct GalleryItem {
    id: i64,
    user_id: i64,
    title: String,
    description: Option<String>,
    is_public: bool,
    display_order: i32,
    picture_count: i64,
    cover_image_url: String,
    created_at: String,
    updated_at: String,
}

fn build_cover_image_url(base_url: &str, cover_image_uuid: Option<uuid::Uuid>) -> String {
    match cover_image_uuid {
        Some(uuid) => format!(
            "{}/api/v1/upload/download/public/{}",
            base_url.trim_end_matches('/'),
            uuid
        ),
        None => format!(
            "{}/assets/img/gallery-placeholder.svg",
            base_url.trim_end_matches('/')
        ),
    }
}

pub async fn execute(
    db: &Pool<Postgres>,
    params: &ListGalleriesParams,
) -> Result<serde_json::Value, String> {
    let base_url = AppConfig::app_url();

    let total = db_read::gallery::count_all(db)
        .await
        .map_err(|e| format!("Failed to count galleries: {}", e))?;

    let galleries =
        db_read::gallery::get_all_with_counts_paginated(db, params.limit, params.offset)
            .await
            .map_err(|e| format!("Failed to fetch galleries: {}", e))?;

    let mut items = Vec::new();
    for gallery in galleries {
        let first_picture_uuid = db_read::picture::get_first_picture_uuid(db, gallery.id)
            .await
            .unwrap_or(None);

        items.push(GalleryItem {
            id: gallery.id,
            user_id: gallery.user_id,
            title: gallery.name,
            description: gallery.description,
            is_public: gallery.is_public,
            display_order: gallery.display_order,
            picture_count: gallery.picture_count,
            cover_image_url: build_cover_image_url(base_url, first_picture_uuid),
            created_at: gallery.created_at.to_rfc3339(),
            updated_at: gallery.updated_at.to_rfc3339(),
        });
    }

    Ok(json!({
        "status_code": 200,
        "body": {
            "total": total,
            "limit": params.limit,
            "offset": params.offset,
            "galleries": items
        }
    }))
}
