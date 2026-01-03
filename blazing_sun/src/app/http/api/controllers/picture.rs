//! Picture API Controller
//!
//! REST API endpoints for picture management within galleries.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::app::db_query::{mutations as db_mutations, read as db_read};
use crate::bootstrap::database::database::AppState;
use crate::bootstrap::utility::assets;

/// Request body for adding a picture to a gallery
#[derive(Debug, Deserialize)]
pub struct AddPictureRequest {
    pub upload_id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
}

/// Request body for updating a picture
#[derive(Debug, Deserialize)]
pub struct UpdatePictureRequest {
    pub title: Option<String>,
    pub description: Option<String>,
}

/// Request body for reordering pictures
#[derive(Debug, Deserialize)]
pub struct ReorderPicturesRequest {
    pub picture_ids: Vec<i64>,
}

/// Response for picture with upload metadata
#[derive(Debug, Serialize)]
pub struct PictureResponse {
    pub id: i64,
    pub gallery_id: i64,
    pub upload_id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub display_order: i32,
    pub created_at: String,
    pub updated_at: String,
    // Upload metadata
    pub upload: UploadInfo,
    // Pre-generated URLs for different sizes
    pub urls: PictureUrls,
}

#[derive(Debug, Serialize)]
pub struct UploadInfo {
    pub stored_name: String,
    pub original_name: String,
    pub storage_type: String,
    pub mime_type: String,
    pub size_bytes: i64,
}

#[derive(Debug, Serialize)]
pub struct PictureUrls {
    pub thumb: String,
    pub small: String,
    pub medium: String,
    pub large: String,
    pub full: String,
}

/// Get all pictures in a gallery
pub async fn get_gallery_pictures(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let gallery_id = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Check if gallery exists and user has access
    match db_read::gallery::get_by_id(&db, gallery_id).await {
        Ok(gallery) => {
            // Check access: user owns gallery OR gallery is public
            if gallery.user_id != user_id && !gallery.is_public {
                drop(db);
                return HttpResponse::Forbidden().json(serde_json::json!({
                    "error": "Access denied"
                }));
            }
        }
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Gallery not found"
            }));
        }
        Err(e) => {
            eprintln!("Failed to fetch gallery: {:?}", e);
            drop(db);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch gallery"
            }));
        }
    }

    // Fetch pictures with upload information
    match db_read::picture::get_by_gallery_with_uploads(&db, gallery_id).await {
        Ok(pictures) => {
            let response: Vec<PictureResponse> = pictures
                .into_iter()
                .map(|p| {
                    // Generate URLs for all sizes
                    let urls = PictureUrls {
                        thumb: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("thumb")),
                        small: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("small")),
                        medium: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("medium")),
                        large: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("large")),
                        full: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("full")),
                    };

                    PictureResponse {
                        id: p.id,
                        gallery_id: p.gallery_id,
                        upload_id: p.upload_id,
                        title: p.title,
                        description: p.description,
                        display_order: p.display_order,
                        created_at: p.created_at.to_rfc3339(),
                        updated_at: p.updated_at.to_rfc3339(),
                        upload: UploadInfo {
                            stored_name: p.upload_stored_name,
                            original_name: p.upload_original_name,
                            storage_type: p.upload_storage_type,
                            mime_type: p.upload_mime_type,
                            size_bytes: p.upload_size_bytes,
                        },
                        urls,
                    }
                })
                .collect();

            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "status": "success",
                "pictures": response
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch pictures: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch pictures"
            }))
        }
    }
}

/// Add a picture to a gallery
pub async fn add_picture(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<AddPictureRequest>,
) -> HttpResponse {
    let gallery_id = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Check if upload exists
    if !db_read::upload::exists(&db, body.upload_id).await {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Upload not found"
        }));
    }

    // Check if picture already exists in gallery
    if db_read::picture::upload_exists_in_gallery(&db, gallery_id, body.upload_id).await {
        drop(db);
        return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Picture already exists in this gallery"
        }));
    }

    // Get current picture count for display_order
    let picture_count = db_read::picture::count_by_gallery(&db, gallery_id)
        .await
        .unwrap_or(0);

    // Add picture to gallery
    let params = db_mutations::picture::AddPictureParams {
        gallery_id,
        upload_id: body.upload_id,
        title: body.title.clone(),
        description: body.description.clone(),
        display_order: picture_count as i32,
    };

    match db_mutations::picture::add_to_gallery(&db, &params).await {
        Ok(picture_id) => {
            // Fetch the created picture with upload info
            match db_read::picture::get_by_id_with_upload(&db, picture_id).await {
                Ok(p) => {
                    let urls = PictureUrls {
                        thumb: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("thumb")),
                        small: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("small")),
                        medium: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("medium")),
                        large: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("large")),
                        full: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("full")),
                    };

                    let response = PictureResponse {
                        id: p.id,
                        gallery_id: p.gallery_id,
                        upload_id: p.upload_id,
                        title: p.title,
                        description: p.description,
                        display_order: p.display_order,
                        created_at: p.created_at.to_rfc3339(),
                        updated_at: p.updated_at.to_rfc3339(),
                        upload: UploadInfo {
                            stored_name: p.upload_stored_name,
                            original_name: p.upload_original_name,
                            storage_type: p.upload_storage_type,
                            mime_type: p.upload_mime_type,
                            size_bytes: p.upload_size_bytes,
                        },
                        urls,
                    };

                    drop(db);
                    HttpResponse::Created().json(response)
                }
                Err(e) => {
                    drop(db);
                    eprintln!("Failed to fetch created picture: {:?}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Picture added but failed to fetch"
                    }))
                }
            }
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to add picture: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to add picture"
            }))
        }
    }
}

/// Update a picture's metadata
pub async fn update_picture(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(i64, i64)>,
    body: web::Json<UpdatePictureRequest>,
) -> HttpResponse {
    let (gallery_id, picture_id) = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Check if picture exists in this gallery
    match db_read::picture::get_by_id(&db, picture_id).await {
        Ok(picture) => {
            if picture.gallery_id != gallery_id {
                drop(db);
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "Picture does not belong to this gallery"
                }));
            }
        }
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Picture not found"
            }));
        }
        Err(e) => {
            eprintln!("Failed to fetch picture: {:?}", e);
            drop(db);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch picture"
            }));
        }
    }

    // Update picture
    let params = db_mutations::picture::UpdatePictureParams {
        title: body.title.clone(),
        description: body.description.clone(),
        display_order: None, // Don't update display_order here (use reorder endpoint)
    };

    match db_mutations::picture::update(&db, picture_id, &params).await {
        Ok(_) => {
            // Fetch updated picture
            match db_read::picture::get_by_id_with_upload(&db, picture_id).await {
                Ok(p) => {
                    let urls = PictureUrls {
                        thumb: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("thumb")),
                        small: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("small")),
                        medium: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("medium")),
                        large: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("large")),
                        full: assets::asset_by_id(&p.upload_uuid, &p.upload_storage_type, Some("full")),
                    };

                    let response = PictureResponse {
                        id: p.id,
                        gallery_id: p.gallery_id,
                        upload_id: p.upload_id,
                        title: p.title,
                        description: p.description,
                        display_order: p.display_order,
                        created_at: p.created_at.to_rfc3339(),
                        updated_at: p.updated_at.to_rfc3339(),
                        upload: UploadInfo {
                            stored_name: p.upload_stored_name,
                            original_name: p.upload_original_name,
                            storage_type: p.upload_storage_type,
                            mime_type: p.upload_mime_type,
                            size_bytes: p.upload_size_bytes,
                        },
                        urls,
                    };

                    drop(db);
                    HttpResponse::Ok().json(response)
                }
                Err(e) => {
                    drop(db);
                    eprintln!("Failed to fetch updated picture: {:?}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Picture updated but failed to fetch"
                    }))
                }
            }
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to update picture: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update picture"
            }))
        }
    }
}

/// Remove a picture from a gallery
pub async fn remove_picture(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(i64, i64)>,
) -> HttpResponse {
    let (gallery_id, picture_id) = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Verify picture belongs to this gallery
    match db_read::picture::get_by_id(&db, picture_id).await {
        Ok(picture) => {
            if picture.gallery_id != gallery_id {
                drop(db);
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "Picture does not belong to this gallery"
                }));
            }
        }
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Picture not found"
            }));
        }
        Err(e) => {
            eprintln!("Failed to fetch picture: {:?}", e);
            drop(db);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch picture"
            }));
        }
    }

    // Remove picture from gallery
    match db_mutations::picture::remove_from_gallery(&db, picture_id).await {
        Ok(rows_affected) => {
            drop(db);
            if rows_affected > 0 {
                HttpResponse::Ok().json(serde_json::json!({
                    "message": "Picture removed successfully"
                }))
            } else {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Picture not found"
                }))
            }
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to remove picture: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to remove picture"
            }))
        }
    }
}

/// Reorder pictures in a gallery
pub async fn reorder_pictures(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<ReorderPicturesRequest>,
) -> HttpResponse {
    let gallery_id = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Reorder pictures using bulk update
    match db_mutations::picture::reorder_gallery(&db, gallery_id, &body.picture_ids).await {
        Ok(_) => {
            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "message": "Pictures reordered successfully"
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to reorder pictures: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to reorder pictures"
            }))
        }
    }
}
