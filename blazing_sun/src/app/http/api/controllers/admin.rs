//! Admin Controller
//!
//! Protected endpoints for admin operations:
//! - GET /api/v1/admin/uploads - List all uploads (Admin+: permission >= 10)
//! - GET /api/v1/admin/assets - List all assets (Admin+: permission >= 10)
//! - GET /api/v1/admin/users - List all users (Super Admin: permission >= 100)
//! - DELETE /api/v1/admin/users/{id}/avatar - Delete user's avatar (Admin+)

use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::app::http::api::controllers::responses::BaseResponse;
use crate::bootstrap::includes::controllers::uploads;
use crate::database::mutations::asset as db_asset_mutations;
use crate::database::mutations::user as db_user_mutations;
use crate::database::read::asset as db_asset_read;
use crate::database::read::upload as db_upload_read;
use crate::database::read::user as db_user_read;
use crate::database::AppState;

/// Admin Controller
pub struct AdminController;

/// Pagination query parameters
#[derive(Deserialize)]
pub struct PaginationQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Upload list query parameters (with filters)
#[derive(Deserialize)]
pub struct UploadListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub storage_type: Option<String>,
    pub search: Option<String>,
}

/// Upload DTO for admin view
#[derive(Serialize)]
pub struct AdminUploadDto {
    pub uuid: String,
    pub original_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub upload_status: String,
    pub user_id: Option<i64>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub created_at: String,
}

/// Asset DTO for admin view
#[derive(Serialize)]
pub struct AdminAssetDto {
    pub uuid: String,
    pub title: Option<String>,
    pub category: Option<String>,
    pub original_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub subfolder: Option<String>,
    pub user_id: Option<i64>,
    pub created_at: String,
}

/// User DTO for admin view (includes permissions)
#[derive(Serialize)]
pub struct AdminUserDto {
    pub id: i64,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub balance: i64,
    pub permissions: i16,
    pub activated: i16,
    pub verified: i16,
    pub avatar_uuid: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl AdminController {
    /// GET /api/v1/admin/uploads - List all uploads (Admin+)
    ///
    /// Query params:
    /// - limit: Max number of results (default 50)
    /// - offset: Number to skip (default 0)
    /// - storage_type: Filter by "public" or "private" (optional)
    /// - search: Search by original filename (optional)
    pub async fn list_uploads(
        state: web::Data<AppState>,
        query: web::Query<UploadListQuery>,
    ) -> HttpResponse {
        let limit = query.limit.unwrap_or(50).min(100); // Max 100
        let offset = query.offset.unwrap_or(0);

        // Validate storage_type if provided
        let storage_type = query.storage_type.as_ref().and_then(|st| {
            if st == "public" || st == "private" {
                Some(st.as_str())
            } else {
                None // Invalid values are ignored
            }
        });

        let search = query.search.as_ref().and_then(|s| {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                Some(trimmed)
            } else {
                None
            }
        });

        let db = state.db.lock().await;
        let uploads = db_upload_read::get_all_filtered(&db, limit, offset, storage_type, search).await;
        let total = db_upload_read::count_filtered(&db, storage_type, search).await;

        let upload_dtos: Vec<AdminUploadDto> = uploads
            .into_iter()
            .map(|u| AdminUploadDto {
                uuid: u.uuid.to_string(),
                original_name: u.original_name,
                extension: u.extension,
                mime_type: u.mime_type,
                size_bytes: u.size_bytes,
                storage_type: u.storage_type,
                storage_path: u.storage_path,
                user_id: u.user_id,
                upload_status: u.upload_status,
                title: u.title,
                description: u.description,
                created_at: u.created_at.to_rfc3339(),
            })
            .collect();

        HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "uploads": upload_dtos,
            "total": total,
            "limit": limit,
            "offset": offset
        }))
    }

    /// GET /api/v1/admin/assets - List all assets (Admin+)
    ///
    /// Query params:
    /// - limit: Max number of results (default 50)
    /// - offset: Number to skip (default 0)
    pub async fn list_assets(
        state: web::Data<AppState>,
        query: web::Query<PaginationQuery>,
    ) -> HttpResponse {
        let limit = query.limit.unwrap_or(50).min(100); // Max 100
        let offset = query.offset.unwrap_or(0);

        let db = state.db.lock().await;
        let assets = db_asset_read::get_all(&db, limit, offset).await;
        let total = db_asset_read::count(&db).await;

        let asset_dtos: Vec<AdminAssetDto> = assets
            .into_iter()
            .map(|a| AdminAssetDto {
                uuid: a.uuid.to_string(),
                title: a.title,
                category: a.category,
                original_name: a.original_name,
                extension: a.extension,
                mime_type: a.mime_type,
                size_bytes: a.size_bytes,
                storage_type: a.storage_type,
                storage_path: a.storage_path,
                subfolder: a.subfolder,
                user_id: a.user_id,
                created_at: a.created_at.to_rfc3339(),
            })
            .collect();

        HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "assets": asset_dtos,
            "total": total,
            "limit": limit,
            "offset": offset
        }))
    }

    /// GET /api/v1/admin/users - List all users (Super Admin only)
    ///
    /// Query params:
    /// - limit: Max number of results (default 50)
    /// - offset: Number to skip (default 0)
    pub async fn list_users(
        state: web::Data<AppState>,
        query: web::Query<PaginationQuery>,
    ) -> HttpResponse {
        let limit = query.limit.unwrap_or(50).min(100); // Max 100
        let offset = query.offset.unwrap_or(0);

        let db = state.db.lock().await;
        let users = db_user_read::get_all(&db, limit, offset).await;
        let total = db_user_read::count(&db).await;

        let user_dtos: Vec<AdminUserDto> = users
            .into_iter()
            .map(|u| AdminUserDto {
                id: u.id,
                email: u.email,
                first_name: u.first_name,
                last_name: u.last_name,
                balance: u.balance,
                permissions: u.permissions,
                activated: u.activated,
                verified: u.verified,
                avatar_uuid: u.avatar_uuid.map(|uuid| uuid.to_string()),
                created_at: u.created_at.to_rfc3339(),
                updated_at: u.updated_at.to_rfc3339(),
            })
            .collect();

        HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "users": user_dtos,
            "total": total,
            "limit": limit,
            "offset": offset
        }))
    }

    /// DELETE /api/v1/admin/users/{id}/avatar - Delete a user's avatar (Admin+)
    pub async fn delete_user_avatar(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let user_id = path.into_inner();
        let db = state.db.lock().await;

        // Get user
        let user = match db_user_read::get_by_id(&db, user_id).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("User not found"));
            }
        };

        let avatar_uuid = match user.avatar_uuid {
            Some(uuid) => uuid,
            None => {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("User has no profile picture"));
            }
        };

        // Get asset record
        if let Some(asset) = db_asset_read::find_by_uuid(&db, &avatar_uuid).await {
            // Delete file from storage
            if let Err(e) = uploads::delete_file(&asset.storage_path).await {
                tracing::warn!("Failed to delete avatar file from storage: {}", e);
            }

            // Delete asset record
            if let Err(e) = db_asset_mutations::delete(&db, &avatar_uuid).await {
                tracing::warn!("Failed to delete asset record: {}", e);
            }
        }

        // Clear user's avatar (both UUID and ID)
        if let Err(e) = db_user_mutations::update_avatar(&db, user_id, None, None).await {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to clear user avatar"));
        }

        HttpResponse::Ok().json(BaseResponse::success("User avatar deleted successfully"))
    }

    /// PATCH /api/v1/admin/users/{id}/permissions - Update user's permissions (Super Admin only)
    pub async fn update_user_permissions(
        state: web::Data<AppState>,
        path: web::Path<i64>,
        body: web::Json<UpdatePermissionsRequest>,
    ) -> HttpResponse {
        let user_id = path.into_inner();
        let new_permissions = body.permissions;

        // Validate permission value
        if ![1, 10, 50, 100].contains(&new_permissions) {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Invalid permission level. Must be 1, 10, 50, or 100"));
        }

        let db = state.db.lock().await;

        // Verify user exists
        if db_user_read::get_by_id(&db, user_id).await.is_err() {
            return HttpResponse::NotFound().json(BaseResponse::error("User not found"));
        }

        // Update permissions
        match db_user_mutations::update_permissions(&db, user_id, new_permissions).await {
            Ok(_) => HttpResponse::Ok().json(BaseResponse::success("User permissions updated")),
            Err(e) => {
                tracing::error!("Failed to update user permissions: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update permissions"))
            }
        }
    }

    /// PATCH /api/v1/admin/uploads/{uuid}/metadata - Update upload metadata (Admin+)
    pub async fn update_upload_metadata(
        state: web::Data<AppState>,
        path: web::Path<String>,
        body: web::Json<UpdateUploadMetadataRequest>,
    ) -> HttpResponse {
        let uuid_str = path.into_inner();

        // Parse UUID
        let uuid = match uuid::Uuid::parse_str(&uuid_str) {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::BadRequest().json(BaseResponse::error("Invalid UUID format"));
            }
        };

        let db = state.db.lock().await;

        // Verify upload exists
        let upload = match db_upload_read::get_by_uuid(&db, &uuid).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Upload not found"));
            }
        };

        // Check if storage_type is being changed
        let storage_type_changed = body.storage_type.is_some()
            && body.storage_type.as_deref() != Some(&upload.storage_type);

        // If storage type changed, move files
        let new_storage_path = if storage_type_changed {
            let new_storage_type = body.storage_type.as_ref().unwrap();

            tracing::info!(
                "Storage type changing from {} to {} for upload {}",
                upload.storage_type,
                new_storage_type,
                upload.uuid
            );

            // Calculate new storage path
            let stored_name = &upload.stored_name;
            let mut actual_stored_name = stored_name.clone();
            let mut new_path = if new_storage_type == "private" {
                // Moving to private - determine subfolder based on description
                if upload.description.as_deref() == Some("profile-picture") {
                    format!("private/profile-pictures/{}", stored_name)
                } else {
                    format!("private/{}", stored_name)
                }
            } else {
                // Moving to public - always flat structure
                format!("public/{}", stored_name)
            };

            // Move the main file
            use crate::bootstrap::includes::controllers::uploads;
            let storage_base = crate::config::upload::UploadConfig::storage_path();
            let mut old_full_path = std::path::PathBuf::from(storage_base).join(&upload.storage_path);
            let mut new_full_path = std::path::PathBuf::from(storage_base).join(&new_path);

            tracing::info!("Attempting to move: {:?} -> {:?}", old_full_path, new_full_path);

            // Check if file exists at database path, if not search alternative locations
            if !old_full_path.exists() {
                tracing::warn!("File not found at database path: {:?}, checking alternative locations", old_full_path);

                // Check alternative locations
                if let Some(filename) = std::path::Path::new(&upload.storage_path).file_name() {
                    let filename_str = filename.to_string_lossy();

                    // Build list of alternative paths to check
                    let mut alternative_paths = vec![
                        format!("public/{}", filename_str),
                        format!("private/{}", filename_str),
                        format!("private/profile-pictures/{}", filename_str),
                    ];

                    // Also check for _full variant (used when original file is replaced by variants)
                    let filename_string: String = filename_str.to_string();
                    if let Some(stem) = std::path::Path::new(&filename_string).file_stem() {
                        if let Some(ext) = std::path::Path::new(&filename_string).extension() {
                            let stem_str = stem.to_string_lossy();
                            let ext_str = ext.to_string_lossy();
                            let full_variant = format!("{}_full.{}", stem_str, ext_str);
                            alternative_paths.push(format!("public/{}", full_variant));
                            alternative_paths.push(format!("private/{}", full_variant));
                            alternative_paths.push(format!("private/profile-pictures/{}", full_variant));
                        }
                    }

                    let mut found = false;
                    for alt_path in alternative_paths {
                        let alt_full_path = std::path::PathBuf::from(storage_base).join(&alt_path);
                        if alt_full_path.exists() {
                            tracing::info!("Found file at alternative location: {:?}", alt_full_path);
                            old_full_path = alt_full_path;

                            // Extract the actual filename from the alternative path
                            if let Some(alt_filename) = std::path::Path::new(&alt_path).file_name() {
                                actual_stored_name = alt_filename.to_string_lossy().to_string();
                                tracing::info!("Updated stored_name to actual file: {}", actual_stored_name);

                                // Recalculate new_path with the actual filename
                                new_path = if new_storage_type == "private" {
                                    if upload.description.as_deref() == Some("profile-picture") {
                                        format!("private/profile-pictures/{}", actual_stored_name)
                                    } else {
                                        format!("private/{}", actual_stored_name)
                                    }
                                } else {
                                    format!("public/{}", actual_stored_name)
                                };
                                new_full_path = std::path::PathBuf::from(storage_base).join(&new_path);
                                tracing::info!("Recalculated destination path: {:?}", new_full_path);
                            }

                            found = true;
                            break;
                        }
                    }

                    if !found {
                        tracing::error!("Source file does not exist at any location. Database path: {:?}", upload.storage_path);
                        return HttpResponse::InternalServerError()
                            .json(BaseResponse::error("Source file not found at any location - cannot migrate storage type"));
                    }
                } else {
                    tracing::error!("Could not extract filename from storage_path: {}", upload.storage_path);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Invalid storage path"));
                }
            }

            // Create parent directory for new path
            if let Some(parent) = new_full_path.parent() {
                if let Err(e) = tokio::fs::create_dir_all(parent).await {
                    tracing::error!("Failed to create directory for moved file: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to create destination directory"));
                }
            }

            // Move the file
            if let Err(e) = tokio::fs::rename(&old_full_path, &new_full_path).await {
                tracing::error!("Failed to move file from {:?} to {:?}: {}", old_full_path, new_full_path, e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to move file - check server logs for details"));
            }
            tracing::info!("Successfully moved main file from {:?} to {:?}", old_full_path, new_full_path);

            // Move all variant files
            use crate::app::db_query::read::image_variant;
            use crate::app::db_query::mutations::image_variant as image_variant_mutations;

            if let Ok(variants) = image_variant::get_by_upload_id(&db, upload.id).await {
                let variant_count = variants.len();
                tracing::info!("Moving {} variant files", variant_count);

                for variant in variants {
                    let mut old_variant_full_path = std::path::PathBuf::from(storage_base).join(&variant.storage_path);

                    // Calculate new variant path
                    let new_variant_path = if new_storage_type == "private" {
                        if upload.description.as_deref() == Some("profile-picture") {
                            format!("private/profile-pictures/{}", variant.stored_name)
                        } else {
                            format!("private/{}", variant.stored_name)
                        }
                    } else {
                        format!("public/{}", variant.stored_name)
                    };

                    let new_variant_full_path = std::path::PathBuf::from(storage_base).join(&new_variant_path);

                    tracing::info!("Moving variant: {:?} -> {:?}", old_variant_full_path, new_variant_full_path);

                    // Check if variant file exists at database path, if not search alternative locations
                    if !old_variant_full_path.exists() {
                        tracing::warn!("Variant file not found at database path: {:?}, checking alternatives", old_variant_full_path);

                        // Check alternative locations
                        if let Some(filename) = std::path::Path::new(&variant.storage_path).file_name() {
                            let filename_str = filename.to_string_lossy();
                            let alternative_paths = vec![
                                format!("public/{}", filename_str),
                                format!("private/{}", filename_str),
                                format!("private/profile-pictures/{}", filename_str),
                            ];

                            let mut found = false;
                            for alt_path in alternative_paths {
                                let alt_full_path = std::path::PathBuf::from(storage_base).join(&alt_path);
                                if alt_full_path.exists() {
                                    tracing::info!("Found variant file at alternative location: {:?}", alt_full_path);
                                    old_variant_full_path = alt_full_path;
                                    found = true;
                                    break;
                                }
                            }

                            if !found {
                                tracing::warn!("Variant file does not exist at any location: {:?}", variant.storage_path);
                                continue;
                            }
                        } else {
                            tracing::warn!("Could not extract filename from variant storage_path: {}", variant.storage_path);
                            continue;
                        }
                    }

                    // Move variant file
                    if let Err(e) = tokio::fs::rename(&old_variant_full_path, &new_variant_full_path).await {
                        tracing::error!("Failed to move variant file {:?} to {:?}: {}", old_variant_full_path, new_variant_full_path, e);
                        // Don't fail the whole operation for variant move failure, just log
                    } else {
                        tracing::info!("Successfully moved variant {:?}", new_variant_full_path);
                        // Update variant storage_path in database
                        if let Err(e) = image_variant_mutations::update_storage_path(&db, variant.id, &new_variant_path).await {
                            tracing::error!("Failed to update variant storage_path in database: {}", e);
                        } else {
                            tracing::info!("Updated variant storage_path in database for variant_id={}", variant.id);
                        }
                    }
                }
                tracing::info!("Finished moving {} variant files", variant_count);
            }

            Some(new_path)
        } else {
            None
        };

        // Update metadata
        use crate::database::mutations::upload as db_upload_mutations;
        match db_upload_mutations::update_metadata(
            &db,
            upload.id,
            body.title.as_deref(),
            body.description.as_deref(),
            body.storage_type.as_deref(),
            new_storage_path.as_deref(), // Update storage_path if it changed
            None, // metadata JSON not updated here
        )
        .await
        {
            Ok(_) => HttpResponse::Ok().json(BaseResponse::success("Upload metadata updated")),
            Err(e) => {
                tracing::error!("Failed to update upload metadata: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update metadata"))
            }
        }
    }
}

/// Request to update user permissions
#[derive(Deserialize)]
pub struct UpdatePermissionsRequest {
    pub permissions: i16,
}

/// Request to update upload metadata
#[derive(Deserialize)]
pub struct UpdateUploadMetadataRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub storage_type: Option<String>,
}
