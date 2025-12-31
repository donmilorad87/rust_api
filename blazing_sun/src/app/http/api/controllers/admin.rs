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

        // Clear user's avatar_uuid
        if let Err(e) = db_user_mutations::update_avatar(&db, user_id, None).await {
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
}

/// Request to update user permissions
#[derive(Deserialize)]
pub struct UpdatePermissionsRequest {
    pub permissions: i16,
}
