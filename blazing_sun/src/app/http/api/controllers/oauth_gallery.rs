//! OAuth Gallery Controller
//!
//! OAuth-protected API endpoints for gallery management.
//! Enforces scope-based permissions and ownership rules.
//!
//! ## Scope Permissions:
//! - `galleries.read` - Can read ALL galleries (no ownership check)
//! - `galleries.write` - Can create new galleries (auto-owned by authorizing user)
//! - `galleries.edit` - Can edit ONLY OWNED galleries (ownership check)
//! - `galleries.delete` - Can delete ONLY OWNED galleries (ownership check)
//!
//! ## Ownership Model:
//! - Ownership = gallery.user_id matches the user who created the OAuth application
//! - OAuth client owner's user_id determines ownership
//! - All operations (write, edit, delete) enforce ownership except read

use actix_web::{http::StatusCode, web, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::app::db_query::{mutations as db_mutations, read as db_read};
use crate::bootstrap::database::database::AppState;
use crate::bootstrap::middleware::oauth_auth::{extract_oauth_claims, enforce_scopes, has_scopes};
use crate::config::AppConfig;
use crate::mq::{self, JobOptions, JobResult};

/// Request body for creating a gallery
#[derive(Debug, Deserialize)]
pub struct CreateGalleryRequest {
    pub name: String,
    pub description: Option<String>,
    pub is_public: Option<bool>,
}

/// Request body for updating a gallery
#[derive(Debug, Deserialize)]
pub struct UpdateGalleryRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_public: Option<bool>,
}

/// Response for gallery with metadata
#[derive(Debug, Serialize)]
pub struct GalleryResponse {
    pub id: i64,
    pub user_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub display_order: i32,
    pub picture_count: i64,
    pub cover_image_url: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Build cover image URL for a gallery
fn build_cover_image_url(base_url: &str, cover_image_uuid: Option<uuid::Uuid>) -> String {
    match cover_image_uuid {
        Some(uuid) => build_public_upload_url(base_url, &uuid.to_string()),
        None => build_full_url(base_url, "/assets/img/gallery-placeholder.svg"),
    }
}

fn build_full_url(base_url: &str, path: &str) -> String {
    format!("{}{}", base_url.trim_end_matches('/'), path)
}

fn build_public_upload_url(base_url: &str, upload_uuid: &str) -> String {
    build_full_url(
        base_url,
        &format!("/api/v1/upload/download/public/{}", upload_uuid),
    )
}

fn normalize_pagination(params: &PaginationParams) -> (i64, i64) {
    let limit = params.limit.unwrap_or(16).max(1);
    let offset = params.offset.unwrap_or(0).max(0);
    (limit, offset)
}

fn job_result_to_response(result: JobResult<serde_json::Value>) -> HttpResponse {
    match result {
        JobResult::Success(payload) => {
            let status = payload
                .get("status_code")
                .and_then(|value| value.as_u64())
                .and_then(|code| StatusCode::from_u16(code as u16).ok())
                .unwrap_or(StatusCode::OK);
            let body = payload.get("body").cloned().unwrap_or(serde_json::json!({}));
            HttpResponse::build(status).json(body)
        }
        JobResult::Retry(reason) => HttpResponse::ServiceUnavailable().json(serde_json::json!({
            "error": "job_retry",
            "error_description": reason
        })),
        JobResult::Failed(reason) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "job_failed",
            "error_description": reason
        })),
    }
}

// ============================================================================
// OAuth-Protected Handlers
// ============================================================================

/// OAuth: Get all galleries for the authenticated user
///
/// **Scope Required**: `galleries.read`
///
/// **Endpoint**: `GET /api/v1/oauth/galleries`
pub async fn list_galleries(
    req: HttpRequest,
    state: web::Data<AppState>,
    query: web::Query<PaginationParams>,
) -> HttpResponse {
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

    let (limit, offset) = normalize_pagination(&query);
    let Some(ref mq) = state.mq else {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": "server_error", "error_description": "Message queue not available"}));
    };

    let params = mq::jobs::ListGalleriesParams { limit, offset };
    let options = JobOptions::new().priority(0).fault_tolerance(1);

    match mq::enqueue_and_wait_result_dyn(mq, "oauth_list_galleries", &params, options, 30000).await {
        Ok(result) => job_result_to_response(result),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "server_error",
            "error_description": format!("Failed to process job: {}", e)
        })),
    }
}

/// OAuth: Get a single gallery by ID
///
/// **Scope Required**: `galleries.read`
///
/// **Ownership**: Can read ANY gallery (no ownership check for read operations)
///
/// **Endpoint**: `GET /api/v1/oauth/galleries/{id}`
pub async fn get_gallery(
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

    let base_url = AppConfig::app_url();
    let db = state.db.lock().await;

    // Fetch gallery details (NO OWNERSHIP CHECK for galleries.read)
    match db_read::gallery::get_by_id(&db, gallery_id).await {
        Ok(gallery) => {
            let picture_count = db_read::picture::count_by_gallery(&db, gallery_id)
                .await
                .unwrap_or(0);

            // Get first picture UUID for cover image
            let first_picture_uuid = db_read::picture::get_first_picture_uuid(&db, gallery_id)
                .await
                .unwrap_or(None);

            let response = GalleryResponse {
                id: gallery.id,
                user_id: gallery.user_id,
                title: gallery.name,
                description: gallery.description,
                is_public: gallery.is_public,
                display_order: gallery.display_order,
                picture_count,
                cover_image_url: build_cover_image_url(base_url, first_picture_uuid),
                created_at: gallery.created_at.to_rfc3339(),
                updated_at: gallery.updated_at.to_rfc3339(),
            };

            drop(db);
            HttpResponse::Ok().json(response)
        }
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "not_found",
                "error_description": "Gallery not found"
            }))
        }
        Err(e) => {
            drop(db);
            tracing::error!("Failed to fetch gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "server_error",
                "error_description": "Failed to fetch gallery"
            }))
        }
    }
}

/// OAuth: Get gallery images by gallery ID
///
/// **Scope Required**: `galleries.read`
///
/// **Endpoint**: `GET /api/v1/oauth/galleries/{id}/images`
pub async fn list_gallery_images(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    query: web::Query<PaginationParams>,
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

    let (limit, offset) = normalize_pagination(&query);
    let Some(ref mq) = state.mq else {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": "server_error", "error_description": "Message queue not available"}));
    };

    let params = mq::jobs::ListGalleryImagesParams {
        gallery_id,
        limit,
        offset,
    };
    let options = JobOptions::new().priority(0).fault_tolerance(1);

    match mq::enqueue_and_wait_result_dyn(mq, "oauth_list_gallery_images", &params, options, 30000).await {
        Ok(result) => job_result_to_response(result),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "server_error",
            "error_description": format!("Failed to process job: {}", e)
        })),
    }
}

/// OAuth: Create a new gallery
///
/// **Scope Required**: `galleries.write`
///
/// **Ownership**: Gallery is created for the authorizing user (JWT's sub claim)
///
/// **Endpoint**: `POST /api/v1/oauth/galleries`
pub async fn create_gallery(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<CreateGalleryRequest>,
) -> HttpResponse {
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
    let base_url = AppConfig::app_url();

    // Validate name
    if body.name.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "invalid_request",
            "error_description": "Gallery name cannot be empty"
        }));
    }

    let db = state.db.lock().await;

    // Check if gallery with same name already exists for this user
    if db_read::gallery::name_exists_for_user(&db, user_id, &body.name).await {
        drop(db);
        return HttpResponse::Conflict().json(serde_json::json!({
            "error": "conflict",
            "error_description": "Gallery name already exists"
        }));
    }

    // Get current gallery count for display_order
    let gallery_count = db_read::gallery::count_by_user(&db, user_id)
        .await
        .unwrap_or(0);

    // Create gallery
    let params = db_mutations::gallery::CreateGalleryParams {
        user_id,
        name: body.name.clone(),
        description: body.description.clone(),
        is_public: body.is_public.unwrap_or(false),
        display_order: gallery_count as i32,
    };

    match db_mutations::gallery::create(&db, &params).await {
        Ok(gallery_id) => {
            // Fetch created gallery
            match db_read::gallery::get_by_id(&db, gallery_id).await {
                Ok(gallery) => {
                    let first_picture_uuid = db_read::picture::get_first_picture_uuid(&db, gallery_id)
                        .await
                        .unwrap_or(None);

                    let response = GalleryResponse {
                        id: gallery.id,
                        user_id: gallery.user_id,
                        title: gallery.name,
                        description: gallery.description,
                        is_public: gallery.is_public,
                        display_order: gallery.display_order,
                        picture_count: 0,
                        cover_image_url: build_cover_image_url(base_url, first_picture_uuid),
                        created_at: gallery.created_at.to_rfc3339(),
                        updated_at: gallery.updated_at.to_rfc3339(),
                    };

                    drop(db);
                    HttpResponse::Created().json(response)
                }
                Err(e) => {
                    drop(db);
                    tracing::error!("Failed to fetch created gallery: {:?}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "server_error",
                        "error_description": "Gallery created but failed to fetch"
                    }))
                }
            }
        }
        Err(e) => {
            drop(db);
            tracing::error!("Failed to create gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "server_error",
                "error_description": "Failed to create gallery"
            }))
        }
    }
}

/// OAuth: Update an existing gallery
///
/// **Scope Required**: `galleries.edit`
///
/// **Ownership**: Can only update galleries owned by the authorizing user
///
/// **Endpoint**: `PUT /api/v1/oauth/galleries/{id}`
pub async fn update_gallery(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<UpdateGalleryRequest>,
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

    // Enforce scope: galleries.edit
    if let Err(response) = enforce_scopes(&claims, "galleries.edit") {
        return response;
    }

    let user_id = claims.user_id;
    let base_url = AppConfig::app_url();
    let db = state.db.lock().await;

    // OWNERSHIP CHECK: Can only update own galleries
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "insufficient_permissions",
            "error_description": "You can only modify galleries you own"
        }));
    }

    // Validate name if provided
    if let Some(ref name) = body.name {
        if name.trim().is_empty() {
            drop(db);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "invalid_request",
                "error_description": "Gallery name cannot be empty"
            }));
        }

        // Check if new name already exists for this user (excluding current gallery)
        if db_read::gallery::name_exists_for_user_except(&db, user_id, name, gallery_id).await {
            drop(db);
            return HttpResponse::Conflict().json(serde_json::json!({
                "error": "conflict",
                "error_description": "Gallery name already exists"
            }));
        }
    }

    // Update gallery
    let params = db_mutations::gallery::UpdateGalleryParams {
        name: body.name.clone(),
        description: body.description.clone(),
        is_public: body.is_public,
        display_order: None,
    };

    match db_mutations::gallery::update(&db, gallery_id, &params).await {
        Ok(_) => {
            // Fetch updated gallery
            match db_read::gallery::get_by_id(&db, gallery_id).await {
                Ok(gallery) => {
                    let picture_count = db_read::picture::count_by_gallery(&db, gallery_id)
                        .await
                        .unwrap_or(0);

                    let first_picture_uuid = db_read::picture::get_first_picture_uuid(&db, gallery_id)
                        .await
                        .unwrap_or(None);

                    let response = GalleryResponse {
                        id: gallery.id,
                        user_id: gallery.user_id,
                        title: gallery.name,
                        description: gallery.description,
                        is_public: gallery.is_public,
                        display_order: gallery.display_order,
                        picture_count,
                        cover_image_url: build_cover_image_url(base_url, first_picture_uuid),
                        created_at: gallery.created_at.to_rfc3339(),
                        updated_at: gallery.updated_at.to_rfc3339(),
                    };

                    drop(db);
                    HttpResponse::Ok().json(response)
                }
                Err(e) => {
                    drop(db);
                    tracing::error!("Failed to fetch updated gallery: {:?}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "server_error",
                        "error_description": "Gallery updated but failed to fetch"
                    }))
                }
            }
        }
        Err(e) => {
            drop(db);
            tracing::error!("Failed to update gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "server_error",
                "error_description": "Failed to update gallery"
            }))
        }
    }
}

/// OAuth: Delete a gallery
///
/// **Scope Required**: `galleries.delete`
///
/// **Ownership**: Can only delete galleries owned by the authorizing user
///
/// **Endpoint**: `DELETE /api/v1/oauth/galleries/{id}`
pub async fn delete_gallery(
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

    // Enforce scope: galleries.delete
    if !has_scopes(&claims, "galleries.delete") {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "insufficient_scope",
            "error_description": "You do not have scope access for deletion",
            "scope": "galleries.delete"
        }));
    }

    let Some(ref mq) = state.mq else {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": "server_error", "error_description": "Message queue not available"}));
    };

    let params = mq::jobs::DeleteGalleryParams {
        gallery_id,
        user_id: claims.user_id,
        client_id: claims.client_id.clone(),
    };
    let options = JobOptions::new().priority(0).fault_tolerance(1);

    match mq::enqueue_and_wait_result_dyn(mq, "oauth_delete_gallery", &params, options, 30000).await {
        Ok(result) => job_result_to_response(result),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "server_error",
            "error_description": format!("Failed to process job: {}", e)
        })),
    }
}

/// OAuth: Delete a picture by ID
///
/// **Scope Required**: `galleries.delete`
///
/// **Ownership**: Can only delete pictures owned by the authorizing user
///
/// **Endpoint**: `DELETE /api/v1/oauth/pictures/{id}`
pub async fn delete_picture(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let picture_id = path.into_inner();

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
    if !has_scopes(&claims, "galleries.delete") {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "insufficient_scope",
            "error_description": "You do not have scope access for deletion",
            "scope": "galleries.delete"
        }));
    }

    let Some(ref mq) = state.mq else {
        return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": "server_error", "error_description": "Message queue not available"}));
    };

    let params = mq::jobs::DeletePictureParams {
        picture_id,
        user_id: claims.user_id,
        client_id: claims.client_id.clone(),
    };
    let options = JobOptions::new().priority(0).fault_tolerance(1);

    match mq::enqueue_and_wait_result_dyn(mq, "oauth_delete_picture", &params, options, 30000).await {
        Ok(result) => job_result_to_response(result),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "server_error",
            "error_description": format!("Failed to process job: {}", e)
        })),
    }
}
