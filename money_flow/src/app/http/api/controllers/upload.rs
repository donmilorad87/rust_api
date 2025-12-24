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
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::app::http::api::controllers::responses::BaseResponse;
use crate::bootstrap::includes::controllers::uploads::{self, chunked, StorageType};
use crate::database::mutations::upload as db_upload_mutations;
use crate::database::read::upload as db_upload_read;
use crate::database::AppState;

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
            description: None,
        };

        if let Err(e) = db_upload_mutations::create(&db, &params).await {
            // Try to delete the file if database insert fails
            let _ = uploads::delete_file(&result.storage_path).await;
            return HttpResponse::InternalServerError()
                .json(error_response(format!("Database error: {}", e)));
        }

        // Build URL
        let url = Self::build_url(&result.uuid, storage_type);

        HttpResponse::Created().json(serde_json::json!({
            "status": "success",
            "message": "File uploaded successfully",
            "upload": {
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
                                description: None,
                            };

                            if db_upload_mutations::create(&db, &params).await.is_ok() {
                                let url = Self::build_url(&result.uuid, storage_type);
                                successful_uploads.push(UploadDto {
                                    uuid: result.uuid.to_string(),
                                    original_name: result.original_name,
                                    extension: result.extension,
                                    mime_type: result.mime_type,
                                    size_bytes: result.size_bytes as i64,
                                    storage_type: storage_type.as_str().to_string(),
                                    url,
                                    created_at: chrono::Utc::now().to_rfc3339(),
                                });
                            } else {
                                let _ = uploads::delete_file(&result.storage_path).await;
                                failed_uploads.push(FailedUpload {
                                    filename,
                                    error: "Database error".to_string(),
                                });
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

        // Read file
        let data = match uploads::read_file(&upload.storage_path).await {
            Ok(d) => d,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to read file"));
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

    /// GET /upload/private/{uuid} - Download private file (requires auth)
    pub async fn download_private(
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

        // Get private upload (checks user ownership)
        let upload = match db_upload_read::get_private_by_uuid(&db, &uuid, user_id).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("File not found"));
            }
        };

        // Read file
        let data = match uploads::read_file(&upload.storage_path).await {
            Ok(d) => d,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to read file"));
            }
        };

        HttpResponse::Ok()
            .content_type(upload.mime_type)
            .insert_header((
                "Content-Disposition",
                format!("attachment; filename=\"{}\"", upload.original_name),
            ))
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

        // Delete from storage
        if let Err(e) = uploads::delete_file(&upload.storage_path).await {
            tracing::warn!("Failed to delete file from storage: {}", e);
        }

        // Delete from database
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
}
