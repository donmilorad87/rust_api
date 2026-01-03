//! Upload Controller
//!
//! Handles file upload and download operations (all uploads require authentication):
//! - POST /upload/public: Upload a public file
//! - POST /upload/private: Upload a private file
//! - POST /upload/multiple: Upload multiple files
//! - GET /upload/download/public/{uuid}: Download public file (no auth)
//! - GET /upload/private/{uuid}: Download private file
//! - DELETE /upload/{uuid}: Delete an upload
//! - POST /upload/chunked/start: Start a chunked upload session
//! - POST /upload/chunked/{uuid}/chunk/{index}: Upload a chunk
//! - POST /upload/chunked/{uuid}/complete: Complete chunked upload
//! - DELETE /upload/chunked/{uuid}: Cancel chunked upload

use actix_multipart::Multipart;
use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use futures::StreamExt;
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::app::http::api::controllers::auth::Claims;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::app::mq::jobs::resize_image::ResizeImageParams;
use crate::app::db_query::read::image_variant;
use crate::bootstrap::includes::controllers::uploads::{self, chunked, StorageType};
use crate::bootstrap::includes::image::is_supported_image;
use crate::bootstrap::mq::{self, JobOptions};
use crate::database::mutations::upload as db_upload_mutations;
use crate::database::mutations::user as db_user_mutations;
use crate::database::read::upload as db_upload_read;
use crate::database::AppState;
use crate::config::upload::UploadConfig;

/// Upload Controller
pub struct UploadController;

/// Upload DTO
#[derive(Serialize)]
pub struct UploadDto {
    pub uuid: String,
    pub original_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_type: String,
    pub url: String,
    pub created_at: String,
}

/// Failed upload info
#[derive(Serialize)]
struct FailedUpload {
    filename: String,
    error: String,
}

/// Chunked upload start request
#[derive(Deserialize)]
pub struct StartChunkedUploadRequest {
    pub filename: String,
    pub total_chunks: u32,
    pub total_size: u64,
    pub storage_type: String,
}

/// Helper to create error response with dynamic message
fn error_response(message: String) -> serde_json::Value {
    serde_json::json!({
        "status": "error",
        "message": message
    })
}

/// Helper to get user_id from request (returns error response if not authenticated)
fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    req.extensions()
        .get::<i64>()
        .copied()
        .ok_or_else(|| {
            HttpResponse::Unauthorized()
                .json(BaseResponse::error("Authentication required"))
        })
}

/// Helper to get user_id from request extensions OR auth_token cookie
/// This is used for endpoints that need to work with both API calls (JWT header)
/// and browser requests (cookie, e.g., <img src="...">)
fn get_user_id_with_cookie_fallback(req: &HttpRequest, state: &web::Data<AppState>) -> Result<i64, HttpResponse> {
    // First, try to get from request extensions (set by JWT middleware)
    if let Some(user_id) = req.extensions().get::<i64>().copied() {
        return Ok(user_id);
    }

    // Fallback: try to get from auth_token cookie
    if let Some(cookie) = req.cookie("auth_token") {
        let token = cookie.value();
        let decoding_key = DecodingKey::from_secret(state.jwt_secret.as_bytes());

        if let Ok(token_data) = decode::<Claims>(token, &decoding_key, &Validation::default()) {
            return Ok(token_data.claims.sub);
        }
    }

    Err(HttpResponse::Unauthorized()
        .json(BaseResponse::error("Authentication required")))
}

impl UploadController {
    /// POST /upload/public - Upload a public file (requires auth)
    pub async fn upload_public(
        state: web::Data<AppState>,
        req: HttpRequest,
        payload: Multipart,
    ) -> HttpResponse {
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        Self::handle_upload(state, payload, StorageType::Public, user_id).await
    }

    /// POST /upload/private - Upload a private file (requires auth)
    pub async fn upload_private(
        state: web::Data<AppState>,
        req: HttpRequest,
        payload: Multipart,
    ) -> HttpResponse {
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        Self::handle_upload(state, payload, StorageType::Private, user_id).await
    }

    /// Common upload handler
    async fn handle_upload(
        state: web::Data<AppState>,
        mut payload: Multipart,
        storage_type: StorageType,
        user_id: i64,
    ) -> HttpResponse {
        // Initialize storage
        if let Err(e) = uploads::init_storage().await {
            return HttpResponse::InternalServerError()
                .json(error_response(format!("Storage error: {}", e)));
        }

        // Process multipart form
        let mut file_data: Option<Vec<u8>> = None;
        let mut filename: Option<String> = None;

        while let Some(item) = payload.next().await {
            match item {
                Ok(mut field) => {
                    // Get filename from content disposition
                    if let Some(content_disposition) = field.content_disposition() {
                        if let Some(name) = content_disposition.get_filename() {
                            filename = Some(name.to_string());
                        }
                    }

                    // Read file data
                    let mut data = Vec::new();
                    while let Some(chunk) = field.next().await {
                        match chunk {
                            Ok(bytes) => data.extend_from_slice(&bytes),
                            Err(e) => {
                                return HttpResponse::BadRequest()
                                    .json(error_response(format!("Upload error: {}", e)));
                            }
                        }
                    }
                    file_data = Some(data);
                    break; // Only process first file
                }
                Err(e) => {
                    return HttpResponse::BadRequest()
                        .json(error_response(format!("Multipart error: {}", e)));
                }
            }
        }

        // Validate we have file data and filename
        let data = match file_data {
            Some(d) if !d.is_empty() => d,
            _ => {
                return HttpResponse::BadRequest().json(BaseResponse::error("No file data received"));
            }
        };

        let original_name = match filename {
            Some(n) if !n.is_empty() => n,
            _ => {
                return HttpResponse::BadRequest().json(BaseResponse::error("No filename provided"));
            }
        };

        // Save file
        let result = match uploads::save_file(&data, &original_name, storage_type, None).await {
            Ok(r) => r,
            Err(e) => {
                return HttpResponse::BadRequest()
                    .json(error_response(format!("{}", e)));
            }
        };

        // Save to database
        let db = state.db.lock().await;
        let params = db_upload_mutations::CreateUploadParams {
            uuid: result.uuid,
            original_name: result.original_name.clone(),
            stored_name: result.stored_name.clone(),
            extension: result.extension.clone(),
            mime_type: result.mime_type.clone(),
            size_bytes: result.size_bytes as i64,
            storage_type: storage_type.as_str().to_string(),
            storage_path: result.storage_path.clone(),
            user_id: Some(user_id),
            title: None,
            description: None,
        };

        let upload_id = match db_upload_mutations::create(&db, &params).await {
            Ok(id) => id,
            Err(e) => {
                // Try to delete the file if database insert fails
                let _ = uploads::delete_file(&result.storage_path).await;
                return HttpResponse::InternalServerError()
                    .json(error_response(format!("Database error: {}", e)));
            }
        };

        // Enqueue image resizing job for supported formats
        if is_supported_image(&result.extension) {
            if let Some(mq) = &state.mq {
                // Build absolute file path for image processor
                // storage_path in DB is relative (e.g., "public/filename.jpg")
                // UPLOAD_STORAGE_PATH contains full path (e.g., "src/storage/app")
                let storage_base = UploadConfig::storage_path();
                let full_file_path = format!("{}/{}", storage_base, result.storage_path);

                tracing::info!("Enqueueing resize job: storage_base={}, storage_path={}, full_file_path={}",
                    storage_base, result.storage_path, full_file_path);

                let resize_params = ResizeImageParams {
                    upload_id,
                    upload_uuid: result.uuid.to_string(),
                    stored_name: result.stored_name.clone(),
                    extension: result.extension.clone(),
                    storage_type: storage_type.as_str().to_string(),
                    file_path: full_file_path,
                };

                let options = JobOptions::new()
                    .priority(5)
                    .fault_tolerance(3);

                if let Err(e) = mq::enqueue_job_dyn(
                    mq,
                    "resize_image",
                    &resize_params,
                    options,
                )
                .await
                {
                    tracing::warn!(
                        "Failed to enqueue resize job for upload {}: {}",
                        upload_id,
                        e
                    );
                } else {
                    tracing::info!(
                        "Enqueued resize job for upload {} ({})",
                        upload_id,
                        result.original_name
                    );
                }
            } else {
                tracing::warn!(
                    "Message queue not available, skipping resize for upload {}",
                    upload_id
                );
            }
        }

        // Build URL
        let url = Self::build_url(&result.uuid, storage_type);

        HttpResponse::Created().json(serde_json::json!({
            "status": "success",
            "message": "File uploaded successfully",
            "id": upload_id,
            "upload": {
                "id": upload_id,
                "uuid": result.uuid.to_string(),
                "original_name": result.original_name,
                "extension": result.extension,
                "mime_type": result.mime_type,
                "size_bytes": result.size_bytes,
                "storage_type": storage_type.as_str(),
                "url": url,
                "created_at": chrono::Utc::now().to_rfc3339()
            }
        }))
    }

    /// POST /upload/multiple - Upload multiple files (requires auth)
    pub async fn upload_multiple(
        state: web::Data<AppState>,
        req: HttpRequest,
        mut payload: Multipart,
    ) -> HttpResponse {
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        // Initialize storage
        if let Err(e) = uploads::init_storage().await {
            return HttpResponse::InternalServerError()
                .json(error_response(format!("Storage error: {}", e)));
        }

        let mut successful_uploads: Vec<UploadDto> = Vec::new();
        let mut failed_uploads: Vec<FailedUpload> = Vec::new();
        let max_files = uploads::max_files_per_upload();

        // Determine storage type from query or default to public
        let storage_type = StorageType::Public;

        while let Some(item) = payload.next().await {
            // Check file count limit
            if successful_uploads.len() + failed_uploads.len() >= max_files {
                failed_uploads.push(FailedUpload {
                    filename: "remaining files".to_string(),
                    error: format!("Maximum {} files per upload exceeded", max_files),
                });
                break;
            }

            match item {
                Ok(mut field) => {
                    let filename = field
                        .content_disposition()
                        .and_then(|cd| cd.get_filename())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "unknown".to_string());

                    // Read file data
                    let mut data = Vec::new();
                    while let Some(chunk) = field.next().await {
                        match chunk {
                            Ok(bytes) => data.extend_from_slice(&bytes),
                            Err(e) => {
                                failed_uploads.push(FailedUpload {
                                    filename: filename.clone(),
                                    error: format!("Read error: {}", e),
                                });
                                continue;
                            }
                        }
                    }

                    if data.is_empty() {
                        failed_uploads.push(FailedUpload {
                            filename,
                            error: "Empty file".to_string(),
                        });
                        continue;
                    }

                    // Save file
                    match uploads::save_file(&data, &filename, storage_type, None).await {
                        Ok(result) => {
                            let db = state.db.lock().await;
                            let params = db_upload_mutations::CreateUploadParams {
                                uuid: result.uuid,
                                original_name: result.original_name.clone(),
                                stored_name: result.stored_name.clone(),
                                extension: result.extension.clone(),
                                mime_type: result.mime_type.clone(),
                                size_bytes: result.size_bytes as i64,
                                storage_type: storage_type.as_str().to_string(),
                                storage_path: result.storage_path.clone(),
                                user_id: Some(user_id),
                                title: None,
                                description: None,
                            };

                            match db_upload_mutations::create(&db, &params).await {
                                Ok(upload_id) => {
                                    let url = Self::build_url(&result.uuid, storage_type);
                                    successful_uploads.push(UploadDto {
                                        uuid: result.uuid.to_string(),
                                        original_name: result.original_name.clone(),
                                        extension: result.extension.clone(),
                                        mime_type: result.mime_type,
                                        size_bytes: result.size_bytes as i64,
                                        storage_type: storage_type.as_str().to_string(),
                                        url,
                                        created_at: chrono::Utc::now().to_rfc3339(),
                                    });

                                    // Enqueue image resizing job for supported formats
                                    if is_supported_image(&result.extension) {
                                        if let Some(mq) = &state.mq {
                                            // Build absolute file path for image processor
                                            // storage_path in DB is relative (e.g., "public/filename.jpg")
                                            // UPLOAD_STORAGE_PATH contains full path (e.g., "src/storage/app")
                                            let storage_base = UploadConfig::storage_path();
                                            let full_file_path = format!("{}/{}", storage_base, result.storage_path);

                                            tracing::info!("Enqueueing resize job (multiple): storage_base={}, storage_path={}, full_file_path={}",
                                                storage_base, result.storage_path, full_file_path);

                                            let resize_params = ResizeImageParams {
                                                upload_id,
                                                upload_uuid: result.uuid.to_string(),
                                                stored_name: result.stored_name.clone(),
                                                extension: result.extension.clone(),
                                                storage_type: storage_type.as_str().to_string(),
                                                file_path: full_file_path,
                                            };

                                            let options = JobOptions::new()
                                                .priority(5)
                                                .fault_tolerance(3);

                                            if let Err(e) = mq::enqueue_job_dyn(
                                                mq,
                                                "resize_image",
                                                &resize_params,
                                                options,
                                            )
                                            .await
                                            {
                                                tracing::warn!(
                                                    "Failed to enqueue resize job for upload {}: {}",
                                                    upload_id,
                                                    e
                                                );
                                            } else {
                                                tracing::info!(
                                                    "Enqueued resize job for upload {} ({})",
                                                    upload_id,
                                                    result.original_name
                                                );
                                            }
                                        } else {
                                            tracing::warn!(
                                                "Message queue not available, skipping resize for upload {}",
                                                upload_id
                                            );
                                        }
                                    }
                                }
                                Err(_) => {
                                    let _ = uploads::delete_file(&result.storage_path).await;
                                    failed_uploads.push(FailedUpload {
                                        filename,
                                        error: "Database error".to_string(),
                                    });
                                }
                            }
                        }
                        Err(e) => {
                            failed_uploads.push(FailedUpload {
                                filename,
                                error: e.to_string(),
                            });
                        }
                    }
                }
                Err(e) => {
                    failed_uploads.push(FailedUpload {
                        filename: "unknown".to_string(),
                        error: format!("Multipart error: {}", e),
                    });
                }
            }
        }

        HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "message": format!("Uploaded {} files, {} failed", successful_uploads.len(), failed_uploads.len()),
            "uploads": successful_uploads,
            "failed": failed_uploads
        }))
    }

    /// GET /upload/download/public/{uuid} - Download public file (no auth required)
    pub async fn download_public(
        state: web::Data<AppState>,
        path: web::Path<String>,
        query: web::Query<std::collections::HashMap<String, String>>,
    ) -> HttpResponse {
        let uuid_str = path.into_inner();
        let uuid = match Uuid::parse_str(&uuid_str) {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::BadRequest().json(BaseResponse::error("Invalid UUID format"));
            }
        };

        let db = state.db.lock().await;

        // Get public upload
        let upload = match db_upload_read::get_public_by_uuid(&db, &uuid).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("File not found"));
            }
        };

        // Check if a variant is requested (e.g., ?variant=thumb)
        let storage_path = if let Some(variant_name) = query.get("variant") {
            // Try to get the variant from database
            match image_variant::get_variant(&db, upload.id, variant_name).await {
                Ok(variant) => {
                    // Use the variant's storage path
                    // Extract full path by replacing the original filename with variant filename
                    let original_path = std::path::Path::new(&upload.storage_path);
                    if let Some(parent) = original_path.parent() {
                        parent.join(&variant.stored_name).to_string_lossy().to_string()
                    } else {
                        variant.storage_path
                    }
                }
                Err(_) => {
                    // Variant not found, fallback to original
                    tracing::warn!(
                        "Variant '{}' not found for upload {}, serving original",
                        variant_name,
                        upload.id
                    );
                    upload.storage_path.clone()
                }
            }
        } else {
            upload.storage_path.clone()
        };

        // Read file
        let data = match uploads::read_file(&storage_path).await {
            Ok(d) => d,
            Err(_) => {
                // If original file doesn't exist, try to serve a variant (e.g., _medium)
                tracing::warn!("Original file not found at {}, trying variant", storage_path);

                // Try common variants in order of preference: medium, large, small, thumb
                let variants_to_try = vec!["_medium", "_large", "_small", "_thumb"];
                let mut found_data = None;

                for variant_suffix in variants_to_try {
                    // Insert variant suffix before file extension
                    let path_with_variant = if let Some(dot_pos) = storage_path.rfind('.') {
                        format!("{}{}{}", &storage_path[..dot_pos], variant_suffix, &storage_path[dot_pos..])
                    } else {
                        format!("{}{}", storage_path, variant_suffix)
                    };

                    if let Ok(variant_data) = uploads::read_file(&path_with_variant).await {
                        tracing::info!("Serving variant: {}", path_with_variant);
                        found_data = Some(variant_data);
                        break;
                    }
                }

                match found_data {
                    Some(d) => d,
                    None => {
                        return HttpResponse::InternalServerError()
                            .json(BaseResponse::error("Failed to read file"));
                    }
                }
            }
        };

        HttpResponse::Ok()
            .content_type(upload.mime_type)
            .insert_header((
                "Content-Disposition",
                format!("inline; filename=\"{}\"", upload.original_name),
            ))
            .body(data)
    }

    /// GET /upload/private/{uuid} - Download private file (requires auth via header or cookie)
    /// This endpoint supports both:
    /// - Authorization: Bearer <token> header (for API calls)
    /// - auth_token cookie (for browser requests like <img src="...">)
    /// Query parameters:
    /// - variant: Optional image variant (thumb, small, medium, large, full)
    pub async fn download_private(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
        query: web::Query<std::collections::HashMap<String, String>>,
    ) -> HttpResponse {
        // Use cookie fallback for browser requests (e.g., <img src="...">)
        let user_id = match get_user_id_with_cookie_fallback(&req, &state) {
            Ok(id) => id,
            Err(response) => return response,
        };

        let uuid_str = path.into_inner();
        let uuid = match Uuid::parse_str(&uuid_str) {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::BadRequest().json(BaseResponse::error("Invalid UUID format"));
            }
        };

        let db = state.db.lock().await;

        // Get private upload (checks user ownership)
        let upload = match db_upload_read::get_private_by_uuid(&db, &uuid, user_id).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("File not found"));
            }
        };

        // Check if a variant is requested (e.g., ?variant=thumb)
        let storage_path = if let Some(variant_name) = query.get("variant") {
            // Try to get the variant from database
            match image_variant::get_variant(&db, upload.id, variant_name).await {
                Ok(variant) => {
                    // Use the variant's storage path
                    // Extract full path by replacing the original filename with variant filename
                    let original_path = std::path::Path::new(&upload.storage_path);
                    if let Some(parent) = original_path.parent() {
                        parent.join(&variant.stored_name).to_string_lossy().to_string()
                    } else {
                        variant.storage_path
                    }
                }
                Err(_) => {
                    // Variant not found, fallback to original
                    tracing::warn!(
                        "Variant '{}' not found for upload {}, serving original",
                        variant_name,
                        upload.id
                    );
                    upload.storage_path.clone()
                }
            }
        } else {
            upload.storage_path.clone()
        };

        // Read file
        let data = match uploads::read_file(&storage_path).await {
            Ok(d) => d,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to read file"));
            }
        };

        // Use inline for images (better for <img> tags), attachment for others
        let disposition = if upload.mime_type.starts_with("image/") {
            format!("inline; filename=\"{}\"", upload.original_name)
        } else {
            format!("attachment; filename=\"{}\"", upload.original_name)
        };

        HttpResponse::Ok()
            .content_type(upload.mime_type)
            .insert_header(("Content-Disposition", disposition))
            .insert_header(("Cache-Control", "private, max-age=3600")) // Cache for 1 hour
            .body(data)
    }

    /// DELETE /upload/{uuid} - Delete an upload (requires auth)
    pub async fn delete(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
    ) -> HttpResponse {
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        let uuid_str = path.into_inner();
        let uuid = match Uuid::parse_str(&uuid_str) {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::BadRequest().json(BaseResponse::error("Invalid UUID format"));
            }
        };

        let db = state.db.lock().await;

        // Get upload
        let upload = match db_upload_read::get_by_uuid(&db, &uuid).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("File not found"));
            }
        };

        // Check ownership
        if upload.user_id != Some(user_id) {
            return HttpResponse::Forbidden()
                .json(BaseResponse::error("You don't have permission to delete this file"));
        }

        // Check if this upload is used as logo or favicon in site_config
        // If so, clear those references before deleting
        if let Ok(site_config) = crate::app::db_query::read::site_config::get(&db).await {
            use crate::app::db_query::mutations::site_config as site_config_mutations;

            if site_config.logo_uuid == Some(uuid) {
                tracing::info!("Clearing logo reference from site_config (upload being deleted)");
                if let Err(e) = site_config_mutations::update_logo(&db, None).await {
                    tracing::warn!("Failed to clear logo reference: {}", e);
                }
            }

            if site_config.favicon_uuid == Some(uuid) {
                tracing::info!("Clearing favicon reference from site_config (upload being deleted)");
                if let Err(e) = site_config_mutations::update_favicon(&db, None).await {
                    tracing::warn!("Failed to clear favicon reference: {}", e);
                }
            }
        }

        // Delete from storage
        if let Err(e) = uploads::delete_file(&upload.storage_path).await {
            tracing::warn!("Failed to delete file from storage: {}", e);
        }

        // Delete all image variants (files and database records)
        if let Ok(variants) = image_variant::get_by_upload_id(&db, upload.id).await {
            for variant in variants {
                // Delete variant file from storage
                if let Err(e) = uploads::delete_file(&variant.storage_path).await {
                    tracing::warn!(
                        "Failed to delete variant file {} from storage: {}",
                        variant.storage_path,
                        e
                    );
                }
            }
            tracing::info!("Deleted variant files for upload_id={}", upload.id);
        }

        // Delete from database (CASCADE will delete variant records)
        if let Err(e) = db_upload_mutations::delete_by_uuid(&db, &uuid).await {
            return HttpResponse::InternalServerError()
                .json(error_response(format!("Database error: {}", e)));
        }

        HttpResponse::Ok().json(BaseResponse::success("File deleted successfully"))
    }

    /// POST /upload/chunked/start - Start a chunked upload session (requires auth)
    pub async fn start_chunked_upload(
        req: HttpRequest,
        body: web::Json<StartChunkedUploadRequest>,
    ) -> HttpResponse {
        // All uploads require authentication
        if get_user_id(&req).is_err() {
            return HttpResponse::Unauthorized()
                .json(BaseResponse::error("Authentication required"));
        }

        let request = body.into_inner();

        let storage_type = match StorageType::from_str(&request.storage_type) {
            Some(t) => t,
            None => {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Invalid storage type (use 'public' or 'private')"));
            }
        };

        let session_uuid = match chunked::start_session(
            &request.filename,
            request.total_chunks,
            request.total_size,
            storage_type,
        )
        .await
        {
            Ok(uuid) => uuid,
            Err(e) => {
                return HttpResponse::BadRequest()
                    .json(error_response(format!("{}", e)));
            }
        };

        HttpResponse::Created().json(serde_json::json!({
            "status": "success",
            "message": "Chunked upload session started",
            "session_uuid": session_uuid.to_string()
        }))
    }

    /// POST /upload/chunked/{uuid}/chunk/{index} - Upload a chunk (requires auth)
    pub async fn upload_chunk(
        req: HttpRequest,
        path: web::Path<(String, u32)>,
        body: web::Bytes,
    ) -> HttpResponse {
        if get_user_id(&req).is_err() {
            return HttpResponse::Unauthorized()
                .json(BaseResponse::error("Authentication required"));
        }

        let (uuid_str, chunk_index) = path.into_inner();

        let uuid = match Uuid::parse_str(&uuid_str) {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::BadRequest().json(BaseResponse::error("Invalid UUID format"));
            }
        };

        match chunked::add_chunk(&uuid, chunk_index, body.to_vec()).await {
            Ok(complete) => {
                let (received, total) = chunked::get_progress(&uuid).await.unwrap_or((0, 0));
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "message": "Chunk received",
                    "received_chunks": received,
                    "total_chunks": total,
                    "complete": complete
                }))
            }
            Err(e) => HttpResponse::BadRequest().json(error_response(e)),
        }
    }

    /// POST /upload/chunked/{uuid}/complete - Complete chunked upload (requires auth)
    pub async fn complete_chunked_upload(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
    ) -> HttpResponse {
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        let uuid_str = path.into_inner();
        let uuid = match Uuid::parse_str(&uuid_str) {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::BadRequest().json(BaseResponse::error("Invalid UUID format"));
            }
        };

        // Initialize storage
        if let Err(e) = uploads::init_storage().await {
            return HttpResponse::InternalServerError()
                .json(error_response(format!("Storage error: {}", e)));
        }

        // Finalize chunked upload
        let result = match chunked::finalize(&uuid).await {
            Ok(r) => r,
            Err(e) => {
                return HttpResponse::BadRequest()
                    .json(error_response(format!("Failed to complete upload: {}", e)));
            }
        };

        // Save to database
        let db = state.db.lock().await;
        let params = db_upload_mutations::CreateUploadParams {
            uuid: result.uuid,
            original_name: result.original_name.clone(),
            stored_name: result.stored_name.clone(),
            extension: result.extension.clone(),
            mime_type: result.mime_type.clone(),
            size_bytes: result.size_bytes as i64,
            storage_type: result.storage_type.as_str().to_string(),
            storage_path: result.storage_path.clone(),
            user_id: Some(user_id),
            title: None,
            description: None,
        };

        if let Err(e) = db_upload_mutations::create(&db, &params).await {
            let _ = uploads::delete_file(&result.storage_path).await;
            return HttpResponse::InternalServerError()
                .json(error_response(format!("Database error: {}", e)));
        }

        let url = Self::build_url(&result.uuid, result.storage_type);

        HttpResponse::Created().json(serde_json::json!({
            "status": "success",
            "message": "Chunked upload completed",
            "upload": {
                "uuid": result.uuid.to_string(),
                "original_name": result.original_name,
                "extension": result.extension,
                "mime_type": result.mime_type,
                "size_bytes": result.size_bytes,
                "storage_type": result.storage_type.as_str(),
                "url": url,
                "created_at": chrono::Utc::now().to_rfc3339()
            }
        }))
    }

    /// DELETE /upload/chunked/{uuid} - Cancel chunked upload (requires auth)
    pub async fn cancel_chunked_upload(
        req: HttpRequest,
        path: web::Path<String>,
    ) -> HttpResponse {
        if get_user_id(&req).is_err() {
            return HttpResponse::Unauthorized()
                .json(BaseResponse::error("Authentication required"));
        }

        let uuid_str = path.into_inner();
        let uuid = match Uuid::parse_str(&uuid_str) {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::BadRequest().json(BaseResponse::error("Invalid UUID format"));
            }
        };

        if chunked::cancel(&uuid).await {
            HttpResponse::Ok().json(BaseResponse::success("Chunked upload cancelled"))
        } else {
            HttpResponse::NotFound().json(BaseResponse::error("Session not found"))
        }
    }

    /// GET /upload/user - Get all uploads for current user (requires auth)
    pub async fn get_user_uploads(
        state: web::Data<AppState>,
        req: HttpRequest,
    ) -> HttpResponse {
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        let db = state.db.lock().await;
        let uploads = db_upload_read::get_by_user_id(&db, user_id).await;

        let upload_dtos: Vec<UploadDto> = uploads
            .into_iter()
            .map(|u| {
                let storage_type =
                    StorageType::from_str(&u.storage_type).unwrap_or(StorageType::Public);
                let url = Self::build_url(&u.uuid, storage_type);
                UploadDto {
                    uuid: u.uuid.to_string(),
                    original_name: u.original_name,
                    extension: u.extension,
                    mime_type: u.mime_type,
                    size_bytes: u.size_bytes,
                    storage_type: u.storage_type,
                    url,
                    created_at: u.created_at.to_rfc3339(),
                }
            })
            .collect();

        HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "uploads": upload_dtos
        }))
    }

    /// Build download URL for an upload
    fn build_url(uuid: &Uuid, storage_type: StorageType) -> String {
        match storage_type {
            StorageType::Public => format!("/api/v1/upload/download/public/{}", uuid),
            StorageType::Private => format!("/api/v1/upload/private/{}", uuid),
        }
    }

    /// POST /upload/avatar - Upload profile picture (requires auth)
    /// Stores in profile-pictures/ subfolder and creates an upload record
    pub async fn upload_avatar(
        state: web::Data<AppState>,
        req: HttpRequest,
        mut payload: Multipart,
    ) -> HttpResponse {
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        // Initialize storage
        if let Err(e) = uploads::init_storage().await {
            return HttpResponse::InternalServerError()
                .json(error_response(format!("Storage error: {}", e)));
        }

        // Process multipart form
        let mut file_data: Option<Vec<u8>> = None;
        let mut filename: Option<String> = None;

        while let Some(item) = payload.next().await {
            match item {
                Ok(mut field) => {
                    // Get filename from content disposition
                    if let Some(content_disposition) = field.content_disposition() {
                        if let Some(name) = content_disposition.get_filename() {
                            filename = Some(name.to_string());
                        }
                    }

                    // Read file data
                    let mut data = Vec::new();
                    while let Some(chunk) = field.next().await {
                        match chunk {
                            Ok(bytes) => data.extend_from_slice(&bytes),
                            Err(e) => {
                                return HttpResponse::BadRequest()
                                    .json(error_response(format!("Upload error: {}", e)));
                            }
                        }
                    }
                    file_data = Some(data);
                    break; // Only process first file
                }
                Err(e) => {
                    return HttpResponse::BadRequest()
                        .json(error_response(format!("Multipart error: {}", e)));
                }
            }
        }

        // Validate we have file data and filename
        let data = match file_data {
            Some(d) if !d.is_empty() => d,
            _ => {
                return HttpResponse::BadRequest().json(BaseResponse::error("No file data received"));
            }
        };

        let original_name = match filename {
            Some(n) if !n.is_empty() => n,
            _ => {
                return HttpResponse::BadRequest().json(BaseResponse::error("No filename provided"));
            }
        };

        // Validate it's an image
        let mime_type = mime_guess::from_path(&original_name)
            .first_or_octet_stream()
            .to_string();
        if !mime_type.starts_with("image/") {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Only image files are allowed for profile pictures"));
        }

        // Save file to profile-pictures subfolder (private visibility)
        let result = match uploads::save_file_with_subfolder(
            &data,
            &original_name,
            StorageType::Private,
            Some(10 * 1024 * 1024), // 10MB max for avatars
            Some("profile-pictures"),
        )
        .await
        {
            Ok(r) => r,
            Err(e) => {
                return HttpResponse::BadRequest()
                    .json(error_response(format!("{}", e)));
            }
        };

        let db = state.db.lock().await;

        // Create upload record (using uploads table, not assets)
        let upload_params = db_upload_mutations::CreateUploadParams {
            uuid: result.uuid,
            original_name: result.original_name.clone(),
            stored_name: result.stored_name.clone(),
            extension: result.extension.clone(),
            mime_type: result.mime_type.clone(),
            size_bytes: result.size_bytes as i64,
            storage_type: "private".to_string(),
            storage_path: result.storage_path.clone(),
            user_id: Some(user_id),
            title: None,
            description: Some("profile-picture".to_string()), // Mark as profile picture
        };

        let upload_id = match db_upload_mutations::create(&db, &upload_params).await {
            Ok(id) => id,
            Err(e) => {
                // Try to delete the file if database insert fails
                let _ = uploads::delete_file(&result.storage_path).await;
                return HttpResponse::InternalServerError()
                    .json(error_response(format!("Database error: {}", e)));
            }
        };

        // Enqueue image resizing job for supported formats
        if is_supported_image(&result.extension) {
            if let Some(mq) = &state.mq {
                // Build absolute file path for image processor
                // storage_path in DB is relative (e.g., "private/profile-pictures/filename.jpg")
                // UPLOAD_STORAGE_PATH contains full path (e.g., "src/storage/app")
                let storage_base = UploadConfig::storage_path();
                let full_file_path = format!("{}/{}", storage_base, result.storage_path);

                tracing::info!("Enqueueing resize job for avatar: storage_base={}, storage_path={}, full_file_path={}",
                    storage_base, result.storage_path, full_file_path);

                let resize_params = ResizeImageParams {
                    upload_id,
                    upload_uuid: result.uuid.to_string(),
                    stored_name: result.stored_name.clone(),
                    extension: result.extension.clone(),
                    storage_type: "private".to_string(),
                    file_path: full_file_path,
                };

                let options = JobOptions::new().priority(1).fault_tolerance(3);
                if let Err(e) = mq::enqueue_job_dyn(mq, "resize_image", &resize_params, options).await {
                    tracing::warn!("Failed to enqueue resize_image job for avatar: {}", e);
                }
            }
        }

        // Update user's avatar (both UUID and ID)
        if let Err(e) = db_user_mutations::update_avatar(&db, user_id, Some(result.uuid), Some(upload_id)).await {
            tracing::warn!("Failed to update user avatar: {}", e);
            // Don't fail the request - upload was created successfully
        }

        // Build URL for profile picture (served via API for private files)
        let url = format!("/api/v1/avatar/{}", result.uuid);

        HttpResponse::Created().json(serde_json::json!({
            "status": "success",
            "message": "Profile picture uploaded successfully",
            "upload": {
                "uuid": result.uuid.to_string(),
                "original_name": result.original_name,
                "extension": result.extension,
                "mime_type": result.mime_type,
                "size_bytes": result.size_bytes,
                "url": url,
                "created_at": chrono::Utc::now().to_rfc3339()
            }
        }))
    }

    /// DELETE /upload/avatar - Delete current user's profile picture (requires auth)
    pub async fn delete_avatar(
        state: web::Data<AppState>,
        req: HttpRequest,
    ) -> HttpResponse {
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        let db = state.db.lock().await;

        // Get current user's avatar
        let user = match crate::database::read::user::get_by_id(&db, user_id).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("User not found"));
            }
        };

        let avatar_uuid = match user.avatar_uuid {
            Some(uuid) => uuid,
            None => {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("No profile picture to delete"));
            }
        };

        // Get upload record from uploads table
        let upload = match db_upload_read::get_by_uuid(&db, &avatar_uuid).await {
            Ok(u) => u,
            Err(_) => {
                // Avatar UUID exists but upload doesn't - clear the reference
                let _ = db_user_mutations::update_avatar(&db, user_id, None, None).await;
                return HttpResponse::Ok()
                    .json(BaseResponse::success("Profile picture reference cleared"));
            }
        };

        // Check if this upload is used as logo or favicon in site_config
        // If so, clear those references before deleting
        if let Ok(site_config) = crate::app::db_query::read::site_config::get(&db).await {
            use crate::app::db_query::mutations::site_config as site_config_mutations;

            if site_config.logo_uuid == Some(avatar_uuid) {
                tracing::info!("Clearing logo reference from site_config (avatar being deleted)");
                if let Err(e) = site_config_mutations::update_logo(&db, None).await {
                    tracing::warn!("Failed to clear logo reference: {}", e);
                }
            }

            if site_config.favicon_uuid == Some(avatar_uuid) {
                tracing::info!("Clearing favicon reference from site_config (avatar being deleted)");
                if let Err(e) = site_config_mutations::update_favicon(&db, None).await {
                    tracing::warn!("Failed to clear favicon reference: {}", e);
                }
            }
        }

        // Delete file from storage
        if let Err(e) = uploads::delete_file(&upload.storage_path).await {
            tracing::warn!("Failed to delete avatar file from storage: {}", e);
        }

        // Delete all image variants (files and database records)
        if let Ok(variants) = image_variant::get_by_upload_id(&db, upload.id).await {
            for variant in variants {
                // Delete variant file from storage
                if let Err(e) = uploads::delete_file(&variant.storage_path).await {
                    tracing::warn!(
                        "Failed to delete variant file {} from storage: {}",
                        variant.storage_path,
                        e
                    );
                }
            }
            tracing::info!("Deleted variant files for upload_id={}", upload.id);
        }

        // Delete upload record by UUID (CASCADE will delete variant records)
        if let Err(e) = db_upload_mutations::delete_by_uuid(&db, &avatar_uuid).await {
            tracing::warn!("Failed to delete upload record: {}", e);
        }

        // Clear user's avatar (both UUID and ID)
        if let Err(e) = db_user_mutations::update_avatar(&db, user_id, None, None).await {
            tracing::warn!("Failed to clear user avatar: {}", e);
        }

        HttpResponse::Ok().json(BaseResponse::success("Profile picture deleted successfully"))
    }

    /// GET /api/v1/avatar/{uuid} - Get profile picture from uploads table (auth required)
    /// User can only access their own avatar
    /// Supports both JWT header and cookie authentication (for <img> tags)
    /// Supports variant query parameter: ?variant=thumb|small|medium|large|full
    pub async fn get_avatar(
        req: HttpRequest,
        state: web::Data<AppState>,
        path: web::Path<String>,
        query: web::Query<std::collections::HashMap<String, String>>,
    ) -> HttpResponse {
        // Use cookie fallback for browser requests (e.g., <img src="...">)
        let user_id = match get_user_id_with_cookie_fallback(&req, &state) {
            Ok(id) => id,
            Err(response) => return response,
        };

        let uuid_str = path.into_inner();
        let uuid = match Uuid::parse_str(&uuid_str) {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::BadRequest().json(BaseResponse::error("Invalid UUID format"));
            }
        };

        let db = state.db.lock().await;

        // Get upload record from uploads table
        let upload = match db_upload_read::get_by_uuid(&db, &uuid).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Avatar not found"));
            }
        };

        // Verify it's a profile picture and belongs to the user
        if upload.description.as_deref() != Some("profile-picture") {
            return HttpResponse::NotFound().json(BaseResponse::error("Avatar not found"));
        }

        // Check ownership - user can only access their own avatar
        if upload.user_id != Some(user_id) {
            return HttpResponse::Forbidden()
                .json(BaseResponse::error("Access denied"));
        }

        // Check if a variant is requested (e.g., ?variant=thumb)
        let storage_path = if let Some(variant_name) = query.get("variant") {
            // Try to get the variant from database
            match image_variant::get_variant(&db, upload.id, variant_name).await {
                Ok(variant) => {
                    // Use the variant's storage path
                    variant.storage_path
                }
                Err(_) => {
                    // Variant not found, fallback to original
                    tracing::warn!(
                        "Variant '{}' not found for avatar {}, serving original",
                        variant_name,
                        upload.id
                    );
                    upload.storage_path.clone()
                }
            }
        } else {
            upload.storage_path.clone()
        };

        // Read file from storage with fallback to variants if original doesn't exist
        let data = match uploads::read_file(&storage_path).await {
            Ok(d) => d,
            Err(_) => {
                // If original file doesn't exist, try to serve a variant (e.g., _medium)
                tracing::warn!("Original avatar file not found at {}, trying variant", storage_path);

                // Try common variants in order of preference: medium, large, small, thumb
                let variants_to_try = vec!["_medium", "_large", "_small", "_thumb"];
                let mut found_data = None;

                for variant_suffix in variants_to_try {
                    // Insert variant suffix before file extension
                    let path_with_variant = if let Some(dot_pos) = storage_path.rfind('.') {
                        format!("{}{}{}", &storage_path[..dot_pos], variant_suffix, &storage_path[dot_pos..])
                    } else {
                        format!("{}{}", storage_path, variant_suffix)
                    };

                    if let Ok(variant_data) = uploads::read_file(&path_with_variant).await {
                        tracing::info!("Serving avatar variant: {}", path_with_variant);
                        found_data = Some(variant_data);
                        break;
                    }
                }

                match found_data {
                    Some(d) => d,
                    None => {
                        return HttpResponse::InternalServerError()
                            .json(BaseResponse::error("Failed to read file"));
                    }
                }
            }
        };

        HttpResponse::Ok()
            .content_type(upload.mime_type)
            .insert_header((
                "Content-Disposition",
                format!("inline; filename=\"{}\"", upload.original_name),
            ))
            .insert_header(("Cache-Control", "private, max-age=86400")) // Private cache for 24 hours
            .body(data)
    }
}
