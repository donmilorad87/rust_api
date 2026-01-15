//! Gallery API Controller
//!
//! REST API endpoints for gallery management.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::app::db_query::{mutations as db_mutations, read as db_read};
use crate::bootstrap::database::database::AppState;

const GALLERY_TYPE_REGULAR: &str = "regular_galleries";
const GALLERY_TYPE_GEO: &str = "geo_galleries";

// OAuth imports (for OAuth-protected handlers)
#[allow(unused_imports)]
use crate::bootstrap::middleware::oauth_auth::{enforce_scopes, extract_oauth_claims};

/// Request body for creating a gallery
#[derive(Debug, Deserialize)]
pub struct CreateGalleryRequest {
    pub name: String,
    pub description: Option<String>,
    pub is_public: Option<bool>,
    pub gallery_type: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,
    pub cover_image_id: Option<i64>,
}

/// Request body for updating a gallery
#[derive(Debug, Deserialize)]
pub struct UpdateGalleryRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_public: Option<bool>,
    pub gallery_type: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,
    pub cover_image_id: Option<i64>,
}

/// Request body for reordering galleries
#[derive(Debug, Deserialize)]
pub struct ReorderGalleriesRequest {
    pub gallery_ids: Vec<i64>,
}

/// Response for gallery with metadata
#[derive(Debug, Serialize)]
pub struct GalleryResponse {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub gallery_type: String,
    pub display_order: i32,
    pub picture_count: i64,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,
    pub cover_image_id: Option<i64>,
    pub cover_image_url: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Geo gallery map item response
#[derive(Debug, Serialize)]
pub struct GeoGalleryMapItem {
    pub id: i64,
    pub gallery_uuid: uuid::Uuid,
    pub title: String,
    pub description: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub tags: Option<Vec<String>>,
    pub cover_image_url: String,
    pub picture_count: i64,
}

/// Geo gallery detail response
#[derive(Debug, Serialize)]
pub struct GeoGalleryDetailResponse {
    pub id: i64,
    pub gallery_uuid: uuid::Uuid,
    pub user_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_public: bool,
    pub gallery_type: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,
    pub cover_image_url: String,
    pub picture_count: i64,
    pub created_at: String,
    pub updated_at: String,
    pub is_owner: bool,
}

/// Build cover image URL for a gallery
fn build_cover_image_url(
    cover_image_uuid: Option<uuid::Uuid>,
    fallback_uuid: Option<uuid::Uuid>,
) -> String {
    let uuid = cover_image_uuid.or(fallback_uuid);
    match uuid {
        Some(uuid) => format!("/api/v1/upload/download/public/{}", uuid),
        None => "/assets/img/gallery-placeholder.svg".to_string(),
    }
}

fn parse_gallery_type(value: Option<&str>) -> Result<Option<&'static str>, HttpResponse> {
    match value {
        Some(GALLERY_TYPE_GEO) => Ok(Some(GALLERY_TYPE_GEO)),
        Some(GALLERY_TYPE_REGULAR) => Ok(Some(GALLERY_TYPE_REGULAR)),
        Some(_) => Err(HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid gallery type. Use regular_galleries or geo_galleries."
        }))),
        None => Ok(None),
    }
}

/// Get all galleries for the authenticated user
pub async fn get_user_galleries(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
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

    // Fetch galleries with counts
    match db_read::gallery::get_by_user_with_counts(&db, user_id).await {
        Ok(galleries) => {
            let mut response: Vec<GalleryResponse> = Vec::new();

            for g in galleries {
                // Get first picture UUID for cover image
                let first_picture_uuid = db_read::picture::get_first_picture_uuid(&db, g.id)
                    .await
                    .unwrap_or(None);

                response.push(GalleryResponse {
                    id: g.id,
                    user_id: g.user_id,
                    name: g.name,
                    description: g.description,
                    is_public: g.is_public,
                    gallery_type: g.gallery_type.clone(),
                    display_order: g.display_order,
                    picture_count: g.picture_count,
                    latitude: g.latitude,
                    longitude: g.longitude,
                    tags: g.tags.clone(),
                    cover_image_id: g.cover_image_id,
                    cover_image_url: build_cover_image_url(g.cover_image_uuid, first_picture_uuid),
                    created_at: g.created_at.to_rfc3339(),
                    updated_at: g.updated_at.to_rfc3339(),
                });
            }

            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "galleries": response
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch user galleries: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch galleries"
            }))
        }
    }
}

/// Get a specific gallery by ID
pub async fn get_gallery(
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

    // Fetch gallery
    match db_read::gallery::get_by_id(&db, gallery_id).await {
        Ok(gallery) => {
            // Check if user owns this gallery or if it's public
            if gallery.user_id != user_id && !gallery.is_public {
                drop(db);
                return HttpResponse::Forbidden().json(serde_json::json!({
                    "error": "Access denied"
                }));
            }

            // Get picture count
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
                name: gallery.name,
                description: gallery.description,
                is_public: gallery.is_public,
                gallery_type: gallery.gallery_type.clone(),
                display_order: gallery.display_order,
                picture_count,
                latitude: gallery.latitude,
                longitude: gallery.longitude,
                tags: gallery.tags.clone(),
                cover_image_id: gallery.cover_image_id,
                cover_image_url: build_cover_image_url(gallery.cover_image_uuid, first_picture_uuid),
                created_at: gallery.created_at.to_rfc3339(),
                updated_at: gallery.updated_at.to_rfc3339(),
            };

            drop(db);
            HttpResponse::Ok().json(response)
        }
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Gallery not found"
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch gallery"
            }))
        }
    }
}

/// Get geo galleries for map (public + own)
pub async fn get_geo_galleries(req: HttpRequest, state: web::Data<AppState>) -> HttpResponse {
    if req.extensions().get::<i64>().is_none() {
        return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        }));
    }

    let db = state.db.lock().await;

    match db_read::gallery::get_geo_for_map(&db).await {
        Ok(galleries) => {
            let mut response: Vec<GeoGalleryMapItem> = Vec::new();

            for g in galleries {
                let first_picture_uuid = db_read::picture::get_first_picture_uuid(&db, g.id)
                    .await
                    .unwrap_or(None);

                let cover_image_url = build_cover_image_url(g.cover_image_uuid, first_picture_uuid);

                if let (Some(latitude), Some(longitude)) = (g.latitude, g.longitude) {
                    response.push(GeoGalleryMapItem {
                        id: g.id,
                        gallery_uuid: g.gallery_uuid,
                        title: g.name,
                        description: g.description,
                        latitude,
                        longitude,
                        tags: g.tags,
                        cover_image_url,
                        picture_count: g.picture_count,
                    });
                }
            }

            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "galleries": response
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch geo galleries: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch geo galleries"
            }))
        }
    }
}

/// Get a geo gallery by UUID
pub async fn get_geo_gallery(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<uuid::Uuid>,
) -> HttpResponse {
    let gallery_uuid = path.into_inner();

    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    match db_read::gallery::get_by_uuid(&db, gallery_uuid).await {
        Ok(gallery) => {
            if gallery.gallery_type != GALLERY_TYPE_GEO {
                drop(db);
                return HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Gallery not found"
                }));
            }

            let is_owner = gallery.user_id == user_id;

            let picture_count = db_read::picture::count_by_gallery(&db, gallery.id)
                .await
                .unwrap_or(0);

            let first_picture_uuid = db_read::picture::get_first_picture_uuid(&db, gallery.id)
                .await
                .unwrap_or(None);

            let response = GeoGalleryDetailResponse {
                id: gallery.id,
                gallery_uuid,
                user_id: gallery.user_id,
                name: gallery.name,
                description: gallery.description,
                is_public: gallery.is_public,
                gallery_type: gallery.gallery_type,
                latitude: gallery.latitude,
                longitude: gallery.longitude,
                tags: gallery.tags,
                cover_image_url: build_cover_image_url(gallery.cover_image_uuid, first_picture_uuid),
                picture_count,
                created_at: gallery.created_at.to_rfc3339(),
                updated_at: gallery.updated_at.to_rfc3339(),
                is_owner,
            };

            drop(db);
            HttpResponse::Ok().json(response)
        }
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Gallery not found"
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch geo gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch gallery"
            }))
        }
    }
}

/// Create a new gallery
pub async fn create_gallery(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<CreateGalleryRequest>,
) -> HttpResponse {
    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    // Validate gallery name
    if body.name.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Gallery name cannot be empty"
        }));
    }

    let db = state.db.lock().await;

    // Check if gallery name already exists for this user
    if db_read::gallery::name_exists_for_user(&db, user_id, &body.name).await {
        drop(db);
        return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Gallery name already exists"
        }));
    }

    // Get current gallery count for display_order
    let gallery_count = db_read::gallery::count_by_user(&db, user_id)
        .await
        .unwrap_or(0);

    let mut latitude = body.latitude;
    let mut longitude = body.longitude;

    if latitude.is_some() ^ longitude.is_some() {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Latitude and longitude must be provided together"
        }));
    }

    let requested_type = match parse_gallery_type(body.gallery_type.as_deref()) {
        Ok(value) => value,
        Err(response) => {
            drop(db);
            return response;
        }
    };

    let has_coords = latitude.is_some() && longitude.is_some();
    let gallery_type = requested_type.unwrap_or(if has_coords {
        GALLERY_TYPE_GEO
    } else {
        GALLERY_TYPE_REGULAR
    });

    let is_geo = gallery_type == GALLERY_TYPE_GEO;

    if is_geo && !has_coords {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Latitude and longitude are required for geo galleries"
        }));
    }

    if !is_geo {
        latitude = None;
        longitude = None;
    }

    let mut cover_image_uuid = None;
    if let Some(cover_image_id) = body.cover_image_id {
        match db_read::upload::get_by_id(&db, cover_image_id).await {
            Ok(upload) => {
                if upload.storage_type != "public" {
                    drop(db);
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "Cover image must be a public upload"
                    }));
                }
                if upload.user_id != Some(user_id) {
                    drop(db);
                    return HttpResponse::Forbidden().json(serde_json::json!({
                        "error": "Cover image must belong to the gallery owner"
                    }));
                }
                cover_image_uuid = Some(upload.uuid);
            }
            Err(_) => {
                drop(db);
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "Cover image upload not found"
                }));
            }
        }
    } else if is_geo {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Cover image is required for geo galleries"
        }));
    }

    // Create gallery
    let params = db_mutations::gallery::CreateGalleryParams {
        user_id,
        name: body.name.clone(),
        description: body.description.clone(),
        is_public: body.is_public.unwrap_or(false),
        gallery_type: gallery_type.to_string(),
        display_order: gallery_count as i32,
        latitude,
        longitude,
        tags: body.tags.clone(),
        cover_image_id: body.cover_image_id,
        cover_image_uuid,
    };

    match db_mutations::gallery::create(&db, &params).await {
        Ok(gallery_id) => {
            // Fetch the created gallery
            match db_read::gallery::get_by_id(&db, gallery_id).await {
                Ok(gallery) => {
                    // Get first picture UUID for cover image (will be None for new gallery)
                    let first_picture_uuid =
                        db_read::picture::get_first_picture_uuid(&db, gallery_id)
                            .await
                            .unwrap_or(None);

                    let response = GalleryResponse {
                        id: gallery.id,
                        user_id: gallery.user_id,
                        name: gallery.name,
                        description: gallery.description,
                        is_public: gallery.is_public,
                        gallery_type: gallery.gallery_type.clone(),
                        display_order: gallery.display_order,
                        picture_count: 0,
                        latitude: gallery.latitude,
                        longitude: gallery.longitude,
                        tags: gallery.tags.clone(),
                        cover_image_id: gallery.cover_image_id,
                        cover_image_url: build_cover_image_url(
                            gallery.cover_image_uuid,
                            first_picture_uuid,
                        ),
                        created_at: gallery.created_at.to_rfc3339(),
                        updated_at: gallery.updated_at.to_rfc3339(),
                    };

                    drop(db);
                    HttpResponse::Created().json(response)
                }
                Err(e) => {
                    drop(db);
                    eprintln!("Failed to fetch created gallery: {:?}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Gallery created but failed to fetch"
                    }))
                }
            }
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to create gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create gallery"
            }))
        }
    }
}

/// Update an existing gallery
pub async fn update_gallery(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<UpdateGalleryRequest>,
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

    // Validate name if provided
    if let Some(ref name) = body.name {
        if name.trim().is_empty() {
            drop(db);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Gallery name cannot be empty"
            }));
        }

        // Check if new name already exists for this user (excluding current gallery)
        if db_read::gallery::name_exists_for_user_except(&db, user_id, name, gallery_id).await {
            drop(db);
            return HttpResponse::Conflict().json(serde_json::json!({
                "error": "Gallery name already exists"
            }));
        }
    }

    let existing_gallery = match db_read::gallery::get_by_id(&db, gallery_id).await {
        Ok(gallery) => gallery,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Gallery not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch gallery: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch gallery"
            }));
        }
    };

    let mut latitude = body.latitude;
    let mut longitude = body.longitude;

    if latitude.is_some() ^ longitude.is_some() {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Latitude and longitude must be provided together"
        }));
    }

    let requested_type = match parse_gallery_type(body.gallery_type.as_deref()) {
        Ok(value) => value,
        Err(response) => {
            drop(db);
            return response;
        }
    };

    let has_coords = latitude.is_some() && longitude.is_some();
    let effective_type = if let Some(requested_type) = requested_type {
        requested_type
    } else if has_coords {
        GALLERY_TYPE_GEO
    } else {
        existing_gallery.gallery_type.as_str()
    };

    let is_geo = effective_type == GALLERY_TYPE_GEO;

    if is_geo && !has_coords {
        let has_existing_coords =
            existing_gallery.latitude.is_some() && existing_gallery.longitude.is_some();
        if !has_existing_coords {
            drop(db);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Latitude and longitude are required for geo galleries"
            }));
        }
    }

    if !is_geo {
        latitude = None;
        longitude = None;
    }

    let mut cover_image_uuid = None;
    if let Some(cover_image_id) = body.cover_image_id {
        match db_read::upload::get_by_id(&db, cover_image_id).await {
            Ok(upload) => {
                if upload.storage_type != "public" {
                    drop(db);
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "Cover image must be a public upload"
                    }));
                }
                if upload.user_id != Some(user_id) {
                    drop(db);
                    return HttpResponse::Forbidden().json(serde_json::json!({
                        "error": "Cover image must belong to the gallery owner"
                    }));
                }
                cover_image_uuid = Some(upload.uuid);
            }
            Err(_) => {
                drop(db);
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "Cover image upload not found"
                }));
            }
        }
    } else if is_geo && existing_gallery.cover_image_id.is_none() {
        drop(db);
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Cover image is required for geo galleries"
        }));
    }

    // Update gallery
    let gallery_type_update = match requested_type {
        Some(requested_type) => Some(requested_type.to_string()),
        None => {
            if has_coords {
                Some(GALLERY_TYPE_GEO.to_string())
            } else {
                None
            }
        }
    };

    let params = db_mutations::gallery::UpdateGalleryParams {
        name: body.name.clone(),
        description: body.description.clone(),
        is_public: body.is_public,
        gallery_type: gallery_type_update,
        display_order: None, // Don't update display_order here (use reorder endpoint)
        latitude,
        longitude,
        tags: body.tags.clone(),
        cover_image_id: body.cover_image_id,
        cover_image_uuid,
    };

    match db_mutations::gallery::update(&db, gallery_id, &params).await {
        Ok(_) => {
            // Fetch updated gallery
            match db_read::gallery::get_by_id(&db, gallery_id).await {
                Ok(gallery) => {
                    let picture_count = db_read::picture::count_by_gallery(&db, gallery_id)
                        .await
                        .unwrap_or(0);

                    // Get first picture UUID for cover image
                    let first_picture_uuid =
                        db_read::picture::get_first_picture_uuid(&db, gallery_id)
                            .await
                            .unwrap_or(None);

                    let response = GalleryResponse {
                        id: gallery.id,
                        user_id: gallery.user_id,
                        name: gallery.name,
                        description: gallery.description,
                        is_public: gallery.is_public,
                        gallery_type: gallery.gallery_type.clone(),
                        display_order: gallery.display_order,
                        picture_count,
                        latitude: gallery.latitude,
                        longitude: gallery.longitude,
                        tags: gallery.tags.clone(),
                        cover_image_id: gallery.cover_image_id,
                        cover_image_url: build_cover_image_url(
                            gallery.cover_image_uuid,
                            first_picture_uuid,
                        ),
                        created_at: gallery.created_at.to_rfc3339(),
                        updated_at: gallery.updated_at.to_rfc3339(),
                    };

                    drop(db);
                    HttpResponse::Ok().json(response)
                }
                Err(e) => {
                    drop(db);
                    eprintln!("Failed to fetch updated gallery: {:?}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Gallery updated but failed to fetch"
                    }))
                }
            }
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to update gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update gallery"
            }))
        }
    }
}

/// Delete a gallery
pub async fn delete_gallery(
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

    // Check if user owns the gallery
    if !db_read::gallery::user_owns_gallery(&db, gallery_id, user_id).await {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Delete gallery (cascade deletes all pictures)
    match db_mutations::gallery::delete(&db, gallery_id).await {
        Ok(rows_affected) => {
            drop(db);
            if rows_affected > 0 {
                HttpResponse::Ok().json(serde_json::json!({
                    "message": "Gallery deleted successfully"
                }))
            } else {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Gallery not found"
                }))
            }
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to delete gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete gallery"
            }))
        }
    }
}

/// Reorder galleries for the authenticated user
pub async fn reorder_galleries(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<ReorderGalleriesRequest>,
) -> HttpResponse {
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

    // Validate that all galleries belong to the user
    for gallery_id in &body.gallery_ids {
        if !db_read::gallery::user_owns_gallery(&db, *gallery_id, user_id).await {
            drop(db);
            return HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Cannot reorder galleries you don't own"
            }));
        }
    }

    // Update display_order for each gallery
    for (index, gallery_id) in body.gallery_ids.iter().enumerate() {
        if let Err(e) =
            db_mutations::gallery::update_display_order(&db, *gallery_id, index as i32).await
        {
            eprintln!(
                "Failed to update display order for gallery {}: {:?}",
                gallery_id, e
            );
            drop(db);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to reorder galleries"
            }));
        }
    }

    drop(db);
    HttpResponse::Ok().json(serde_json::json!({
        "message": "Galleries reordered successfully"
    }))
}

// ============================================================================
// OAuth-Protected Handlers (COMMENTED OUT - see routes/api.rs)
// ============================================================================
// TODO: Fix OAuth handlers to match current database schema and structures
// The OAuth core functionality (authorization, token flow) is complete and working

/*
/// OAuth: Get user galleries (requires galleries.read scope)
pub async fn get_user_galleries_oauth(
    req: HttpRequest,
    state: web::Data<AppState>,
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

    let user_id = claims.user_id;
    let db = state.db.lock().await;

    // Fetch galleries with counts
    match db_read::gallery::get_by_user_with_counts(&db, user_id).await {
        Ok(galleries) => {
            let mut response: Vec<GalleryResponse> = Vec::new();

            for g in galleries {
                // Get first picture UUID for cover image
                let first_picture_uuid = db_read::picture::get_first_picture_uuid(&db, g.id)
                    .await
                    .unwrap_or(None);

                response.push(GalleryResponse {
                    id: g.id,
                    user_id: g.user_id,
                    name: g.name,
                    description: g.description,
                    is_public: g.is_public,
                    display_order: g.display_order,
                    picture_count: g.picture_count,
                    cover_image_url: build_cover_image_url(first_picture_uuid),
                    created_at: g.created_at.to_rfc3339(),
                    updated_at: g.updated_at.to_rfc3339(),
                });
            }

            drop(db);
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch galleries: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch galleries"
            }))
        }
    }
}

/// OAuth: Get single gallery (requires galleries.read scope)
pub async fn get_gallery_oauth(
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

    // Fetch gallery details
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
                name: gallery.name,
                description: gallery.description,
                is_public: gallery.is_public,
                display_order: gallery.display_order,
                picture_count,
                cover_image_url: build_cover_image_url(first_picture_uuid),
                created_at: gallery.created_at.to_rfc3339(),
                updated_at: gallery.updated_at.to_rfc3339(),
            };

            drop(db);
            HttpResponse::Ok().json(response)
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch gallery: {:?}", e);
            HttpResponse::NotFound().json(serde_json::json!({
                "error": "Gallery not found"
            }))
        }
    }
}

/// OAuth: Create gallery (requires galleries.write scope)
pub async fn create_gallery_oauth(
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

    // Validate name
    if body.name.trim().is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Gallery name cannot be empty"
        }));
    }

    let db = state.db.lock().await;

    // Check if gallery with same name already exists for this user
    if db_read::gallery::name_exists_for_user(&db, user_id, &body.name).await {
        drop(db);
        return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Gallery name already exists"
        }));
    }

    // Get user's next display_order
    let display_order = db_read::gallery::get_next_display_order(&db, user_id)
        .await
        .unwrap_or(0);

    // Create gallery
    let params = db_mutations::gallery::CreateGalleryParams {
        user_id,
        name: body.name.clone(),
        description: body.description.clone(),
        is_public: body.is_public.unwrap_or(false),
        display_order,
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
                        name: gallery.name,
                        description: gallery.description,
                        is_public: gallery.is_public,
                        display_order: gallery.display_order,
                        picture_count: 0,
                        cover_image_url: build_cover_image_url(first_picture_uuid),
                        created_at: gallery.created_at.to_rfc3339(),
                        updated_at: gallery.updated_at.to_rfc3339(),
                    };

                    drop(db);
                    HttpResponse::Created().json(response)
                }
                Err(e) => {
                    drop(db);
                    eprintln!("Failed to fetch created gallery: {:?}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Gallery created but failed to fetch"
                    }))
                }
            }
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to create gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create gallery"
            }))
        }
    }
}

/// OAuth: Update gallery (requires galleries.write scope)
pub async fn update_gallery_oauth(
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

    // Validate name if provided
    if let Some(ref name) = body.name {
        if name.trim().is_empty() {
            drop(db);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Gallery name cannot be empty"
            }));
        }

        // Check if new name already exists for this user (excluding current gallery)
        if db_read::gallery::name_exists_for_user_except(&db, user_id, name, gallery_id).await {
            drop(db);
            return HttpResponse::Conflict().json(serde_json::json!({
                "error": "Gallery name already exists"
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
                        name: gallery.name,
                        description: gallery.description,
                        is_public: gallery.is_public,
                        display_order: gallery.display_order,
                        picture_count,
                        cover_image_url: build_cover_image_url(first_picture_uuid),
                        created_at: gallery.created_at.to_rfc3339(),
                        updated_at: gallery.updated_at.to_rfc3339(),
                    };

                    drop(db);
                    HttpResponse::Ok().json(response)
                }
                Err(e) => {
                    drop(db);
                    eprintln!("Failed to fetch updated gallery: {:?}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": "Gallery updated but failed to fetch"
                    }))
                }
            }
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to update gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update gallery"
            }))
        }
    }
}

/// OAuth: Delete gallery (requires galleries.delete scope)
pub async fn delete_gallery_oauth(
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

    // Delete gallery (cascade deletes all pictures)
    match db_mutations::gallery::delete(&db, gallery_id).await {
        Ok(rows_affected) => {
            drop(db);
            if rows_affected > 0 {
                HttpResponse::Ok().json(serde_json::json!({
                    "message": "Gallery deleted successfully"
                }))
            } else {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Gallery not found"
                }))
            }
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to delete gallery: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete gallery"
            }))
        }
    }
}

/// OAuth: Reorder galleries (requires galleries.reorder scope)
pub async fn reorder_galleries_oauth(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<ReorderGalleriesRequest>,
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

    // Enforce scope: galleries.reorder
    if let Err(response) = enforce_scopes(&claims, "galleries.reorder") {
        return response;
    }

    let user_id = claims.user_id;
    let db = state.db.lock().await;

    // Validate that all galleries belong to the user
    for gallery_id in &body.gallery_ids {
        if !db_read::gallery::user_owns_gallery(&db, *gallery_id, user_id).await {
            drop(db);
            return HttpResponse::Forbidden().json(serde_json::json!({
                "error": "Cannot reorder galleries you don't own"
            }));
        }
    }

    // Update display_order for each gallery
    for (index, gallery_id) in body.gallery_ids.iter().enumerate() {
        if let Err(e) = db_mutations::gallery::update_display_order(&db, *gallery_id, index as i32).await {
            eprintln!("Failed to update display order for gallery {}: {:?}", gallery_id, e);
            drop(db);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to reorder galleries"
            }));
        }
    }

    drop(db);
    HttpResponse::Ok().json(serde_json::json!({
        "message": "Galleries reordered successfully"
    }))
}
*/
