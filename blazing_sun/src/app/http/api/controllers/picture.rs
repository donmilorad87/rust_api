//! Picture API Controller
//!
//! REST API endpoints for picture management within galleries.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::app::db_query::{mutations as db_mutations, read as db_read};
use crate::app::mq::jobs::bulk_delete_pictures::BulkDeletePicturesParams;
use crate::bootstrap::database::database::AppState;
use crate::bootstrap::mq::{self, JobOptions, JobStatus};
use crate::bootstrap::utility::assets;

/// Request body for adding a picture to a gallery
#[derive(Debug, Deserialize)]
pub struct AddPictureRequest {
    pub upload_id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

/// Request body for updating a picture
#[derive(Debug, Deserialize)]
pub struct UpdatePictureRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
}

/// Request body for reordering pictures
#[derive(Debug, Deserialize)]
pub struct ReorderPicturesRequest {
    pub picture_ids: Vec<i64>,
}

/// Request body for bulk deleting pictures
#[derive(Debug, Deserialize)]
pub struct BulkDeletePicturesRequest {
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
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
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
                        thumb: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("thumb"),
                        ),
                        small: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("small"),
                        ),
                        medium: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("medium"),
                        ),
                        large: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("large"),
                        ),
                        full: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("full"),
                        ),
                    };

                    PictureResponse {
                        id: p.id,
                        gallery_id: p.gallery_id,
                        upload_id: p.upload_id,
                        title: p.title,
                        description: p.description,
                        latitude: p.latitude,
                        longitude: p.longitude,
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
        latitude: body.latitude,
        longitude: body.longitude,
        display_order: picture_count as i32,
    };

    match db_mutations::picture::add_to_gallery(&db, &params).await {
        Ok(picture_id) => {
            // Fetch the created picture with upload info
            match db_read::picture::get_by_id_with_upload(&db, picture_id).await {
                Ok(p) => {
                    let urls = PictureUrls {
                        thumb: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("thumb"),
                        ),
                        small: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("small"),
                        ),
                        medium: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("medium"),
                        ),
                        large: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("large"),
                        ),
                        full: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("full"),
                        ),
                    };

                    let response = PictureResponse {
                        id: p.id,
                        gallery_id: p.gallery_id,
                        upload_id: p.upload_id,
                        title: p.title,
                        description: p.description,
                        latitude: p.latitude,
                        longitude: p.longitude,
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
        latitude: body.latitude,
        longitude: body.longitude,
        display_order: None, // Don't update display_order here (use reorder endpoint)
    };

    match db_mutations::picture::update(&db, picture_id, &params).await {
        Ok(_) => {
            // Fetch updated picture
            match db_read::picture::get_by_id_with_upload(&db, picture_id).await {
                Ok(p) => {
                    let urls = PictureUrls {
                        thumb: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("thumb"),
                        ),
                        small: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("small"),
                        ),
                        medium: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("medium"),
                        ),
                        large: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("large"),
                        ),
                        full: assets::asset_by_id(
                            &p.upload_uuid,
                            &p.upload_storage_type,
                            Some("full"),
                        ),
                    };

                    let response = PictureResponse {
                        id: p.id,
                        gallery_id: p.gallery_id,
                        upload_id: p.upload_id,
                        title: p.title,
                        description: p.description,
                        latitude: p.latitude,
                        longitude: p.longitude,
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

/// Bulk remove pictures from a gallery
pub async fn bulk_delete_pictures(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<BulkDeletePicturesRequest>,
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

    let mut picture_ids = body.picture_ids.clone();
    picture_ids.sort_unstable();
    picture_ids.dedup();

    if picture_ids.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No pictures selected"
        }));
    }

    let db = state.db.lock().await;

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Verify all picture IDs belong to this gallery
    let valid_ids =
        match db_read::picture::get_ids_by_gallery_and_ids(&db, gallery_id, &picture_ids).await {
            Ok(ids) => ids,
            Err(e) => {
                drop(db);
                eprintln!("Failed to validate pictures: {:?}", e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to validate pictures"
                }));
            }
        };

    if valid_ids.len() != picture_ids.len() {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Some pictures do not belong to this gallery"
        }));
    }

    drop(db);

    let Some(ref mq) = state.mq else {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Message queue not available"
        }));
    };

    let params = BulkDeletePicturesParams {
        gallery_id,
        picture_ids,
    };
    let options = JobOptions::new().priority(0).fault_tolerance(3);

    match mq::enqueue_and_wait_dyn(mq, "bulk_delete_pictures", &params, options, 30000).await {
        Ok(JobStatus::Completed) => HttpResponse::Ok().json(serde_json::json!({
            "message": "Pictures removed successfully"
        })),
        Ok(JobStatus::Failed) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to remove pictures"
        })),
        Ok(_) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Unexpected job status"
        })),
        Err(e) => {
            tracing::error!("Bulk delete pictures job error: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to remove pictures"
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

// ============================================================================
// OAuth-Protected Handlers
// ============================================================================

/*
// OAuth handlers temporarily commented out - need implementation fixes
// TODO: Fix OAuth picture handlers to match current Picture structure
use crate::bootstrap::middleware::controllers::{enforce_scopes, extract_oauth_claims};

/// OAuth: Get gallery pictures (requires galleries.read scope)
pub async fn get_gallery_pictures_oauth(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let gallery_id = path.into_inner();

    // Extract OAuth claims
    let claims = match extract_oauth_claims(&req) {
        Some(c) => c,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "invalid_token",
                "error_description": "OAuth token required"
            }));
        }
    };

    // Enforce scope: galleries.read
    if let Err(response) = enforce_scopes(&claims, "galleries.read") {
        return response;
    }

    let user_id = claims.user_id;
    let db = state.db.lock().await;

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Fetch pictures
    match db_read::picture::get_by_gallery(&db, gallery_id).await {
        Ok(pictures) => {
            let response: Vec<PictureResponse> = pictures
                .into_iter()
                .map(|p| PictureResponse {
                    id: p.id,
                    gallery_id: p.gallery_id,
                    upload_id: p.upload_id,
                    upload_uuid: p.upload_uuid,
                    display_order: p.display_order,
                    image_url: build_image_url(p.upload_uuid),
                    created_at: p.created_at.to_rfc3339(),
                    updated_at: p.updated_at.to_rfc3339(),
                })
                .collect();

            drop(db);
            HttpResponse::Ok().json(response)
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

/// OAuth: Add picture to gallery (requires galleries.write scope)
pub async fn add_picture_oauth(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<AddPictureRequest>,
) -> HttpResponse {
    let gallery_id = path.into_inner();

    // Extract OAuth claims
    let claims = match extract_oauth_claims(&req) {
        Some(c) => c,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "invalid_token",
                "error_description": "OAuth token required"
            }));
        }
    };

    // Enforce scope: galleries.write
    if let Err(response) = enforce_scopes(&claims, "galleries.write") {
        return response;
    }

    let user_id = claims.user_id;
    let db = state.db.lock().await;

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Verify upload exists and belongs to user
    let upload = match db_read::upload::get_by_id(&db, body.upload_id).await {
        Ok(u) => u,
        Err(_) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Upload not found"
            }));
        }
    };

    if upload.user_id != user_id {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Cannot use another user's upload"
        }));
    }

    // Get next display order
    let display_order = db_read::picture::get_next_display_order(&db, gallery_id)
        .await
        .unwrap_or(0);

    // Create picture
    let params = db_mutations::picture::CreatePictureParams {
        gallery_id,
        upload_id: body.upload_id,
        upload_uuid: upload.uuid,
        display_order,
    };

    match db_mutations::picture::create(&db, &params).await {
        Ok(picture_id) => {
            match db_read::picture::get_by_id(&db, picture_id).await {
                Ok(picture) => {
                    let response = PictureResponse {
                        id: picture.id,
                        gallery_id: picture.gallery_id,
                        upload_id: picture.upload_id,
                        upload_uuid: picture.upload_uuid,
                        display_order: picture.display_order,
                        image_url: build_image_url(picture.upload_uuid),
                        created_at: picture.created_at.to_rfc3339(),
                        updated_at: picture.updated_at.to_rfc3339(),
                    };

                    drop(db);
                    HttpResponse::Created().json(response)
                }
                Err(e) => {
                    drop(db);
                    eprintln!("Failed to fetch created picture: {:?}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Picture created but failed to fetch"
                    }))
                }
            }
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to create picture: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to add picture"
            }))
        }
    }
}

/// OAuth: Update picture (requires galleries.write scope)
pub async fn update_picture_oauth(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(i64, i64)>,
    body: web::Json<UpdatePictureRequest>,
) -> HttpResponse {
    let (gallery_id, picture_id) = path.into_inner();

    // Extract OAuth claims
    let claims = match extract_oauth_claims(&req) {
        Some(c) => c,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "invalid_token",
                "error_description": "OAuth token required"
            }));
        }
    };

    // Enforce scope: galleries.write
    if let Err(response) = enforce_scopes(&claims, "galleries.write") {
        return response;
    }

    let user_id = claims.user_id;
    let db = state.db.lock().await;

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Check if picture belongs to this gallery
    if !db_read::picture::belongs_to_gallery(&db, picture_id, gallery_id).await {
        drop(db);
        return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Picture not found in this gallery"
        }));
    }

    // If changing upload, verify new upload exists and belongs to user
    if let Some(new_upload_id) = body.upload_id {
        let upload = match db_read::upload::get_by_id(&db, new_upload_id).await {
            Ok(u) => u,
            Err(_) => {
                drop(db);
                return HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Upload not found"
                }));
            }
        };

        if upload.user_id != user_id {
            drop(db);
            return HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Cannot use another user's upload"
            }));
        }

        let params = db_mutations::picture::UpdatePictureParams {
            upload_id: Some(new_upload_id),
            upload_uuid: Some(upload.uuid),
            display_order: body.display_order,
        };

        match db_mutations::picture::update(&db, picture_id, &params).await {
            Ok(_) => {}
            Err(e) => {
                drop(db);
                eprintln!("Failed to update picture: {:?}", e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to update picture"
                }));
            }
        }
    } else if let Some(new_display_order) = body.display_order {
        let params = db_mutations::picture::UpdatePictureParams {
            upload_id: None,
            upload_uuid: None,
            display_order: Some(new_display_order),
        };

        match db_mutations::picture::update(&db, picture_id, &params).await {
            Ok(_) => {}
            Err(e) => {
                drop(db);
                eprintln!("Failed to update picture: {:?}", e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to update picture"
                }));
            }
        }
    }

    // Fetch updated picture
    match db_read::picture::get_by_id(&db, picture_id).await {
        Ok(picture) => {
            let response = PictureResponse {
                id: picture.id,
                gallery_id: picture.gallery_id,
                upload_id: picture.upload_id,
                upload_uuid: picture.upload_uuid,
                display_order: picture.display_order,
                image_url: build_image_url(picture.upload_uuid),
                created_at: picture.created_at.to_rfc3339(),
                updated_at: picture.updated_at.to_rfc3339(),
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

/// OAuth: Remove picture from gallery (requires galleries.delete scope)
pub async fn remove_picture_oauth(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(i64, i64)>,
) -> HttpResponse {
    let (gallery_id, picture_id) = path.into_inner();

    // Extract OAuth claims
    let claims = match extract_oauth_claims(&req) {
        Some(c) => c,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "invalid_token",
                "error_description": "OAuth token required"
            }));
        }
    };

    // Enforce scope: galleries.delete
    if let Err(response) = enforce_scopes(&claims, "galleries.delete") {
        return response;
    }

    let user_id = claims.user_id;
    let db = state.db.lock().await;

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Check if picture belongs to this gallery
    if !db_read::picture::belongs_to_gallery(&db, picture_id, gallery_id).await {
        drop(db);
        return HttpResponse::NotFound().json(serde_json::json!({
            "error": "Picture not found in this gallery"
        }));
    }

    // Delete picture
    match db_mutations::picture::delete(&db, picture_id).await {
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
            eprintln!("Failed to delete picture: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to remove picture"
            }))
        }
    }
}

/// OAuth: Reorder pictures in gallery (requires galleries.reorder scope)
pub async fn reorder_pictures_oauth(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<ReorderPicturesRequest>,
) -> HttpResponse {
    let gallery_id = path.into_inner();

    // Extract OAuth claims
    let claims = match extract_oauth_claims(&req) {
        Some(c) => c,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "invalid_token",
                "error_description": "OAuth token required"
            }));
        }
    };

    // Enforce scope: galleries.reorder
    if let Err(response) = enforce_scopes(&claims, "galleries.reorder") {
        return response;
    }

    let user_id = claims.user_id;
    let db = state.db.lock().await;

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Validate that all pictures belong to this gallery
    for picture_id in &body.picture_ids {
        if !db_read::picture::belongs_to_gallery(&db, *picture_id, gallery_id).await {
            drop(db);
            return HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Cannot reorder pictures from another gallery"
            }));
        }
    }

    // Update display_order for each picture
    for (index, picture_id) in body.picture_ids.iter().enumerate() {
        if let Err(e) = db_mutations::picture::update_display_order(&db, *picture_id, index as i32).await {
            eprintln!("Failed to update display order for picture {}: {:?}", picture_id, e);
            drop(db);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to reorder pictures"
            }));
        }
    }

    drop(db);
    HttpResponse::Ok().json(serde_json::json!({
        "message": "Pictures reordered successfully"
    }))
}
*/
