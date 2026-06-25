//! Store Category Controller
//!
//! Handles store category API endpoints for both public and admin access.
//!
//! **Public API** (no auth required):
//! - List active categories with product counts
//!
//! **Admin API** (requires Admin permission level 10+):
//! - CRUD operations for store categories
//! - Reorder categories

use actix_web::{web, HttpResponse};
use chrono::{DateTime, Utc};
use serde::Serialize;

use crate::app::db_query::mutations::store::category as category_mutations;
use crate::app::db_query::read::store::category as category_read;
use crate::app::http::api::controllers::responses::{BaseResponse, MissingFieldsResponse};
use crate::app::http::api::validators::store_category::{
    CreateStoreCategoryRequest, ReorderCategoriesRequest, UpdateStoreCategoryRequest,
};
use crate::database::AppState;

/// Store Category Controller
pub struct StoreCategoryController;

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/// Store category response DTO (for admin)
#[derive(Debug, Serialize)]
pub struct StoreCategoryDto {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub cover_image_id: Option<i64>,
    pub display_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<category_read::StoreCategory> for StoreCategoryDto {
    fn from(cat: category_read::StoreCategory) -> Self {
        Self {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            cover_image_id: cat.cover_image_id,
            display_order: cat.display_order,
            is_active: cat.is_active,
            created_at: cat.created_at,
            updated_at: cat.updated_at,
        }
    }
}

/// Store category with product count DTO (for public)
#[derive(Debug, Serialize)]
pub struct StoreCategoryWithCountDto {
    pub id: i64,
    pub name: String,
    pub slug: String,
    pub description: Option<String>,
    pub cover_image_id: Option<i64>,
    pub display_order: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub product_count: i64,
}

impl From<category_read::StoreCategoryWithCount> for StoreCategoryWithCountDto {
    fn from(cat: category_read::StoreCategoryWithCount) -> Self {
        Self {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            cover_image_id: cat.cover_image_id,
            display_order: cat.display_order,
            is_active: cat.is_active,
            created_at: cat.created_at,
            updated_at: cat.updated_at,
            product_count: cat.product_count,
        }
    }
}

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

impl StoreCategoryController {
    /// GET /api/v1/store/categories - List all active categories with product counts
    ///
    /// Public endpoint - no authentication required.
    /// Returns categories ordered by display_order, with product counts.
    pub async fn list_public(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;

        match category_read::get_all_active_with_counts(&db).await {
            Ok(categories) => {
                let dtos: Vec<StoreCategoryWithCountDto> =
                    categories.into_iter().map(StoreCategoryWithCountDto::from).collect();
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "categories": dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list store categories: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list categories"))
            }
        }
    }

    // ============================================================================
    // ADMIN ENDPOINTS
    // ============================================================================

    /// GET /api/v1/admin/store/categories - List all categories (including inactive)
    ///
    /// Admin endpoint - requires permission level 10+.
    /// Returns all categories ordered by display_order.
    pub async fn admin_list(state: web::Data<AppState>) -> HttpResponse {
        let db = state.db.lock().await;

        match category_read::get_all_admin(&db).await {
            Ok(categories) => {
                let dtos: Vec<StoreCategoryDto> =
                    categories.into_iter().map(StoreCategoryDto::from).collect();
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "categories": dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list store categories (admin): {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list categories"))
            }
        }
    }

    /// GET /api/v1/admin/store/categories/{id} - Get category by ID
    ///
    /// Admin endpoint - requires permission level 10+.
    pub async fn admin_get(state: web::Data<AppState>, path: web::Path<i64>) -> HttpResponse {
        let category_id = path.into_inner();
        let db = state.db.lock().await;

        match category_read::get_by_id(&db, category_id).await {
            Ok(category) => {
                let dto = StoreCategoryDto::from(category);
                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "category": dto
                }))
            }
            Err(sqlx::Error::RowNotFound) => {
                HttpResponse::NotFound().json(BaseResponse::error("Category not found"))
            }
            Err(e) => {
                tracing::error!("Failed to get store category: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get category"))
            }
        }
    }

    /// POST /api/v1/admin/store/categories - Create category
    ///
    /// Admin endpoint - requires permission level 10+.
    /// Auto-generates slug from name if not provided.
    pub async fn admin_create(
        state: web::Data<AppState>,
        body: web::Json<CreateStoreCategoryRequest>,
    ) -> HttpResponse {
        // Validate request
        let validation_errors = body.validate();
        if !validation_errors.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(validation_errors));
        }

        let db = state.db.lock().await;

        // Get or generate slug
        let slug = body.get_slug();

        // Validate generated slug
        let slug_errors = crate::app::http::api::validators::store_category::validate_slug(&slug);
        if !slug_errors.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(slug_errors));
        }

        // Check slug uniqueness
        if category_read::slug_exists(&db, &slug).await {
            return HttpResponse::Conflict()
                .json(BaseResponse::error("Category slug already exists"));
        }

        let params = category_mutations::CreateCategoryParams {
            name: body.name.clone(),
            slug,
            description: body.description.clone(),
            cover_image_id: body.cover_image_id,
            display_order: body.display_order,
            is_active: true,
        };

        match category_mutations::create(&db, &params).await {
            Ok(id) => {
                // Fetch the created category to return full details
                match category_read::get_by_id(&db, id).await {
                    Ok(category) => {
                        let dto = StoreCategoryDto::from(category);
                        HttpResponse::Created().json(serde_json::json!({
                            "status": "success",
                            "message": "Category created",
                            "category": dto
                        }))
                    }
                    Err(_) => HttpResponse::Created().json(serde_json::json!({
                        "status": "success",
                        "message": "Category created",
                        "id": id
                    })),
                }
            }
            Err(e) => {
                tracing::error!("Failed to create store category: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create category"))
            }
        }
    }

    /// PUT /api/v1/admin/store/categories/{id} - Update category
    ///
    /// Admin endpoint - requires permission level 10+.
    pub async fn admin_update(
        state: web::Data<AppState>,
        path: web::Path<i64>,
        body: web::Json<UpdateStoreCategoryRequest>,
    ) -> HttpResponse {
        let category_id = path.into_inner();

        // Validate request
        let validation_errors = body.validate();
        if !validation_errors.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(validation_errors));
        }

        let db = state.db.lock().await;

        // Check if category exists
        if !category_read::exists(&db, category_id).await {
            return HttpResponse::NotFound().json(BaseResponse::error("Category not found"));
        }

        // Check slug uniqueness if being changed
        if let Some(ref slug) = body.slug {
            if category_read::slug_exists_except(&db, slug, category_id).await {
                return HttpResponse::Conflict()
                    .json(BaseResponse::error("Category slug already exists"));
            }
        }

        let params = category_mutations::UpdateCategoryParams {
            name: body.name.clone(),
            slug: body.slug.clone(),
            description: body.description.clone(),
            cover_image_id: body.cover_image_id,
            display_order: body.display_order,
            is_active: body.is_active,
        };

        match category_mutations::update(&db, category_id, &params).await {
            Ok(()) => {
                // Fetch the updated category to return full details
                match category_read::get_by_id(&db, category_id).await {
                    Ok(category) => {
                        let dto = StoreCategoryDto::from(category);
                        HttpResponse::Ok().json(serde_json::json!({
                            "status": "success",
                            "message": "Category updated",
                            "category": dto
                        }))
                    }
                    Err(_) => HttpResponse::Ok().json(BaseResponse::success("Category updated")),
                }
            }
            Err(e) => {
                tracing::error!("Failed to update store category: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update category"))
            }
        }
    }

    /// DELETE /api/v1/admin/store/categories/{id} - Delete category
    ///
    /// Admin endpoint - requires permission level 10+.
    /// Note: Products with this category will have category_id set to NULL.
    pub async fn admin_delete(state: web::Data<AppState>, path: web::Path<i64>) -> HttpResponse {
        let category_id = path.into_inner();
        let db = state.db.lock().await;

        // Check if category exists
        if !category_read::exists(&db, category_id).await {
            return HttpResponse::NotFound().json(BaseResponse::error("Category not found"));
        }

        match category_mutations::delete(&db, category_id).await {
            Ok(rows_affected) => {
                if rows_affected > 0 {
                    HttpResponse::Ok().json(BaseResponse::success("Category deleted"))
                } else {
                    HttpResponse::NotFound().json(BaseResponse::error("Category not found"))
                }
            }
            Err(e) => {
                tracing::error!("Failed to delete store category: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete category"))
            }
        }
    }

    /// POST /api/v1/admin/store/categories/reorder - Reorder categories
    ///
    /// Admin endpoint - requires permission level 10+.
    /// Updates display_order for all categories based on their position in the array.
    pub async fn admin_reorder(
        state: web::Data<AppState>,
        body: web::Json<ReorderCategoriesRequest>,
    ) -> HttpResponse {
        // Validate request
        let validation_errors = body.validate();
        if !validation_errors.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(validation_errors));
        }

        let db = state.db.lock().await;

        // Verify all category IDs exist
        for category_id in &body.category_ids {
            if !category_read::exists(&db, *category_id).await {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "status": "error",
                    "message": format!("Category with id {} not found", category_id)
                }));
            }
        }

        match category_mutations::reorder(&db, &body.category_ids).await {
            Ok(()) => HttpResponse::Ok().json(BaseResponse::success("Categories reordered")),
            Err(e) => {
                tracing::error!("Failed to reorder store categories: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to reorder categories"))
            }
        }
    }
}
