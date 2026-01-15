//! Gallery Like API Controller
//!
//! Handles community likes for galleries.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::Serialize;

use crate::app::db_query::{mutations as db_mutations, read as db_read};
use crate::bootstrap::database::database::AppState;

#[derive(Debug, Serialize)]
pub struct GalleryLikeResponse {
    pub gallery_id: i64,
    pub likes_count: i64,
}

/// Like a gallery (auth required)
pub async fn like_gallery(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let gallery_id = path.into_inner();
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    if !db_read::gallery::exists(&db, gallery_id).await {
        drop(db);
        return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Gallery not found"
        }));
    }

    if db_read::gallery_like::exists_for_user(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Gallery already liked"
        }));
    }

    match db_mutations::gallery_like::add_like(&db, gallery_id, user_id).await {
        Ok(_) => match db_read::gallery_like::count_by_gallery(&db, gallery_id).await {
            Ok(count) => {
                drop(db);
                HttpResponse::Created().json(GalleryLikeResponse {
                    gallery_id,
                    likes_count: count,
                })
            }
            Err(e) => {
                drop(db);
                eprintln!("Failed to count likes: {:?}", e);
                HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to count likes"
                }))
            }
        },
        Err(e) => {
            drop(db);
            eprintln!("Failed to like gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to like gallery"
            }))
        }
    }
}

/// Unlike a gallery (auth required)
pub async fn unlike_gallery(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let gallery_id = path.into_inner();
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    if !db_read::gallery_like::exists_for_user(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Gallery not liked"
        }));
    }

    match db_mutations::gallery_like::remove_like(&db, gallery_id, user_id).await {
        Ok(_) => match db_read::gallery_like::count_by_gallery(&db, gallery_id).await {
            Ok(count) => {
                drop(db);
                HttpResponse::Ok().json(GalleryLikeResponse {
                    gallery_id,
                    likes_count: count,
                })
            }
            Err(e) => {
                drop(db);
                eprintln!("Failed to count likes: {:?}", e);
                HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to count likes"
                }))
            }
        },
        Err(e) => {
            drop(db);
            eprintln!("Failed to unlike gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to unlike gallery"
            }))
        }
    }
}

/// Get like count for a gallery (public)
pub async fn get_like_count(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let gallery_id = path.into_inner();
    let db = state.db.lock().await;

    match db_read::gallery_like::count_by_gallery(&db, gallery_id).await {
        Ok(count) => {
            drop(db);
            HttpResponse::Ok().json(GalleryLikeResponse {
                gallery_id,
                likes_count: count,
            })
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to count likes: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to count likes"
            }))
        }
    }
}
