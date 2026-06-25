//! Store Product Controller
//!
//! Handles store product API endpoints for both public and admin access.
//!
//! **Public API** (no auth required):
//! - List available products with search and filtering
//! - Get featured products
//! - Get product detail by slug
//! - Get all unique tags
//!
//! **Admin API** (requires Admin permission level 10+):
//! - CRUD operations for store products
//! - Toggle featured/active status
//! - Helper endpoints for product creation (galleries, pictures)

use actix_web::{web, HttpResponse};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Serialize;
use uuid::Uuid;

use crate::app::db_query::mutations::store::product as product_mutations;
use crate::app::db_query::mutations::store::product_item as product_item_mutations;
use crate::app::db_query::read::gallery as gallery_read;
use crate::app::db_query::read::picture as picture_read;
use crate::app::db_query::read::store::category as category_read;
use crate::app::db_query::read::store::product as product_read;
use crate::app::db_query::read::store::product_item as product_item_read;
use crate::app::http::api::controllers::responses::{
    BaseResponse, DynamicBaseResponse, MissingFieldsResponse,
};
use crate::app::http::api::validators::store_product::{
    validate_slug, AdminGalleriesQuery, AdminListProductsQuery, CreateStoreProductRequest,
    FeaturedProductsQuery, ListProductsQuery, TagsQuery, UpdateStoreProductRequest,
};
use crate::database::AppState;

/// Store Product Controller
pub struct StoreProductController;

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/// Store product list item DTO
#[derive(Debug, Serialize)]
pub struct StoreProductListItemDto {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub price_cents: i64,
    pub product_type: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub cover_image_id: Option<i64>,
    pub author_name: Option<String>,
    pub country: Option<String>,
    pub is_featured: bool,
    pub created_at: DateTime<Utc>,
}

impl From<product_read::StoreProductListItem> for StoreProductListItemDto {
    fn from(p: product_read::StoreProductListItem) -> Self {
        Self {
            id: p.id,
            title: p.title,
            slug: p.slug,
            description: p.description,
            price_cents: p.price_cents,
            product_type: p.product_type,
            category_id: p.category_id,
            category_name: p.category_name,
            cover_image_id: p.cover_image_id,
            author_name: p.author_name,
            country: p.country,
            is_featured: p.is_featured,
            created_at: p.created_at,
        }
    }
}

/// Store product detail DTO (for public view)
#[derive(Debug, Serialize)]
pub struct StoreProductDetailDto {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub price_cents: i64,
    pub product_type: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub category_slug: Option<String>,
    pub cover_image_id: Option<i64>,

    // Rich metadata
    pub author_name: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub nearest_mountain: Option<String>,
    pub nearest_river: Option<String>,
    pub natural_park: Option<String>,
    pub altitude_meters: Option<i32>,
    pub season: Option<String>,
    pub weather_conditions: Option<String>,
    pub camera_info: Option<String>,
    pub date_taken: Option<NaiveDate>,

    // Location
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,

    // Status
    pub is_featured: bool,

    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,

    // Product items
    pub items: Vec<ProductItemDto>,
}

impl From<product_read::StoreProductWithCategory> for StoreProductDetailDto {
    fn from(p: product_read::StoreProductWithCategory) -> Self {
        Self {
            id: p.id,
            title: p.title,
            slug: p.slug,
            description: p.description,
            price_cents: p.price_cents,
            product_type: p.product_type,
            category_id: p.category_id,
            category_name: p.category_name,
            category_slug: p.category_slug,
            cover_image_id: p.cover_image_id,
            author_name: p.author_name,
            city: p.city,
            country: p.country,
            region: p.region,
            nearest_mountain: p.nearest_mountain,
            nearest_river: p.nearest_river,
            natural_park: p.natural_park,
            altitude_meters: p.altitude_meters,
            season: p.season,
            weather_conditions: p.weather_conditions,
            camera_info: p.camera_info,
            date_taken: p.date_taken,
            latitude: p.latitude,
            longitude: p.longitude,
            tags: p.tags,
            is_featured: p.is_featured,
            created_at: p.created_at,
            updated_at: p.updated_at,
            items: Vec::new(),
        }
    }
}

/// Store product admin DTO (includes all status fields)
#[derive(Debug, Serialize)]
pub struct StoreProductAdminDto {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub price_cents: i64,
    pub product_type: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub category_slug: Option<String>,
    pub cover_image_id: Option<i64>,

    // Rich metadata
    pub author_name: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub nearest_mountain: Option<String>,
    pub nearest_river: Option<String>,
    pub natural_park: Option<String>,
    pub altitude_meters: Option<i32>,
    pub season: Option<String>,
    pub weather_conditions: Option<String>,
    pub camera_info: Option<String>,
    pub date_taken: Option<NaiveDate>,

    // Location
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,

    // Status (all fields for admin)
    pub is_active: bool,
    pub is_sold: bool,
    pub is_featured: bool,

    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,

    // Product items
    pub items: Vec<ProductItemDto>,
}

impl From<product_read::StoreProductWithCategory> for StoreProductAdminDto {
    fn from(p: product_read::StoreProductWithCategory) -> Self {
        Self {
            id: p.id,
            title: p.title,
            slug: p.slug,
            description: p.description,
            price_cents: p.price_cents,
            product_type: p.product_type,
            category_id: p.category_id,
            category_name: p.category_name,
            category_slug: p.category_slug,
            cover_image_id: p.cover_image_id,
            author_name: p.author_name,
            city: p.city,
            country: p.country,
            region: p.region,
            nearest_mountain: p.nearest_mountain,
            nearest_river: p.nearest_river,
            natural_park: p.natural_park,
            altitude_meters: p.altitude_meters,
            season: p.season,
            weather_conditions: p.weather_conditions,
            camera_info: p.camera_info,
            date_taken: p.date_taken,
            latitude: p.latitude,
            longitude: p.longitude,
            tags: p.tags,
            is_active: p.is_active,
            is_sold: p.is_sold,
            is_featured: p.is_featured,
            created_at: p.created_at,
            updated_at: p.updated_at,
            items: Vec::new(),
        }
    }
}

/// Product item DTO (picture or gallery reference)
#[derive(Debug, Serialize)]
pub struct ProductItemDto {
    pub id: i64,
    pub item_type: String,
    pub display_order: i32,
    // For picture items
    pub picture_id: Option<i64>,
    pub picture_title: Option<String>,
    pub picture_description: Option<String>,
    pub upload_uuid: Option<Uuid>,
    // For gallery items
    pub gallery_id: Option<i64>,
    pub gallery_name: Option<String>,
    pub gallery_description: Option<String>,
    pub gallery_picture_count: Option<i64>,
}

impl From<product_item_read::StoreProductItemWithPicture> for ProductItemDto {
    fn from(item: product_item_read::StoreProductItemWithPicture) -> Self {
        Self {
            id: item.id,
            item_type: item.item_type,
            display_order: item.display_order,
            picture_id: item.picture_id,
            picture_title: item.picture_title,
            picture_description: item.picture_description,
            upload_uuid: item.upload_uuid,
            gallery_id: item.gallery_id,
            gallery_name: None,
            gallery_description: None,
            gallery_picture_count: None,
        }
    }
}

impl From<product_item_read::StoreProductItemWithGallery> for ProductItemDto {
    fn from(item: product_item_read::StoreProductItemWithGallery) -> Self {
        Self {
            id: item.id,
            item_type: item.item_type,
            display_order: item.display_order,
            picture_id: item.picture_id,
            picture_title: None,
            picture_description: None,
            upload_uuid: None,
            gallery_id: item.gallery_id,
            gallery_name: item.gallery_name,
            gallery_description: item.gallery_description,
            gallery_picture_count: item.gallery_picture_count,
        }
    }
}

/// Tag with usage count (DTO for API response)
#[derive(Debug, Serialize)]
pub struct TagWithCountDto {
    pub tag: String,
    pub count: i64,
}

/// Gallery summary for admin selection
#[derive(Debug, Serialize)]
pub struct GallerySummaryDto {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub gallery_type: String,
    pub picture_count: i64,
    pub cover_image_uuid: Option<Uuid>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,
    pub created_at: DateTime<Utc>,
}

impl From<gallery_read::GalleryWithCount> for GallerySummaryDto {
    fn from(g: gallery_read::GalleryWithCount) -> Self {
        Self {
            id: g.id,
            name: g.name,
            description: g.description,
            gallery_type: g.gallery_type,
            picture_count: g.picture_count,
            cover_image_uuid: g.cover_image_uuid,
            latitude: g.latitude,
            longitude: g.longitude,
            tags: g.tags,
            created_at: g.created_at,
        }
    }
}

/// Picture summary for admin selection
#[derive(Debug, Serialize)]
pub struct PictureSummaryDto {
    pub id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub upload_uuid: Uuid,
    pub upload_original_name: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub display_order: i32,
    pub created_at: DateTime<Utc>,
}

impl From<picture_read::PictureWithUpload> for PictureSummaryDto {
    fn from(p: picture_read::PictureWithUpload) -> Self {
        Self {
            id: p.id,
            title: p.title,
            description: p.description,
            upload_uuid: p.upload_uuid,
            upload_original_name: p.upload_original_name,
            latitude: p.latitude,
            longitude: p.longitude,
            display_order: p.display_order,
            created_at: p.created_at,
        }
    }
}

/// Pagination info
#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    pub page: u64,
    pub per_page: i64,
    pub total: i64,
    pub total_pages: u64,
    pub has_next: bool,
    pub has_prev: bool,
}

impl PaginationInfo {
    pub fn new(page: u64, per_page: i64, total: i64) -> Self {
        let total_pages = if total > 0 {
            ((total as f64) / (per_page as f64)).ceil() as u64
        } else {
            0
        };

        Self {
            page,
            per_page,
            total,
            total_pages,
            has_next: page < total_pages,
            has_prev: page > 1,
        }
    }
}

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

impl StoreProductController {
    /// GET /api/v1/store/products - List available products with search and filtering
    ///
    /// Public endpoint - no authentication required.
    /// Returns only active products that are not sold.
    pub async fn list_public(
        state: web::Data<AppState>,
        query: web::Query<ListProductsQuery>,
    ) -> HttpResponse {
        // Validate query parameters
        let validation_errors = query.validate();
        if !validation_errors.is_empty() {
            return HttpResponse::BadRequest()
                .json(MissingFieldsResponse::new(validation_errors));
        }

        let db = state.db.lock().await;

        let per_page = query.get_per_page();
        let page = query.get_page();
        let offset = query.get_offset();

        // Get products based on filters
        let products_result = if query.featured_only {
            product_read::get_featured(&db, per_page).await
        } else if let Some(category_id) = query.category_id {
            // Get category slug from ID
            if let Ok(category) = category_read::get_by_id(&db, category_id).await {
                product_read::get_by_category_slug_paginated(
                    &db,
                    &category.slug,
                    per_page,
                    offset,
                )
                .await
            } else {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Category not found"));
            }
        } else if let Some(ref search) = query.search {
            product_read::search_by_text(&db, search, per_page, offset).await
        } else if let Some(tags) = query.get_tags() {
            if !tags.is_empty() {
                product_read::search_by_tags(&db, &tags, per_page, offset).await
            } else {
                product_read::get_available_paginated(&db, per_page, offset).await
            }
        } else if let Some(ref country) = query.country {
            product_read::search_by_country(&db, country, per_page, offset).await
        } else if let Some(ref season) = query.season {
            product_read::search_by_season(&db, season, per_page, offset).await
        } else {
            product_read::get_available_paginated(&db, per_page, offset).await
        };

        match products_result {
            Ok(products) => {
                // Get total count for pagination
                let total = product_read::count_available(&db).await.unwrap_or(0);

                let dtos: Vec<StoreProductListItemDto> = products
                    .into_iter()
                    .map(StoreProductListItemDto::from)
                    .collect();

                let pagination = PaginationInfo::new(page, per_page, total);

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "products": dtos,
                    "pagination": pagination
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list store products: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list products"))
            }
        }
    }

    /// GET /api/v1/store/products/featured - Get featured products
    ///
    /// Public endpoint - no authentication required.
    pub async fn list_featured(
        state: web::Data<AppState>,
        query: web::Query<FeaturedProductsQuery>,
    ) -> HttpResponse {
        let db = state.db.lock().await;
        let limit = query.get_limit();

        match product_read::get_featured(&db, limit).await {
            Ok(products) => {
                let dtos: Vec<StoreProductListItemDto> = products
                    .into_iter()
                    .map(StoreProductListItemDto::from)
                    .collect();

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "products": dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list featured products: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list featured products"))
            }
        }
    }

    /// GET /api/v1/store/products/{slug} - Get product detail by slug
    ///
    /// Public endpoint - no authentication required.
    /// Only returns if is_active = true and is_sold = false.
    pub async fn get_by_slug(
        state: web::Data<AppState>,
        path: web::Path<String>,
    ) -> HttpResponse {
        let slug = path.into_inner();
        let db = state.db.lock().await;

        match product_read::get_by_slug_with_category(&db, &slug).await {
            Ok(product) => {
                // Check if product is available for public view
                if !product.is_active || product.is_sold {
                    return HttpResponse::NotFound()
                        .json(BaseResponse::error("Product not found"));
                }

                let mut dto = StoreProductDetailDto::from(product);

                // Load product items based on product type
                if dto.product_type == "gallery" {
                    if let Ok(gallery_items) =
                        product_item_read::get_galleries_by_product_id(&db, dto.id).await
                    {
                        dto.items = gallery_items.into_iter().map(ProductItemDto::from).collect();
                    }
                } else {
                    if let Ok(picture_items) =
                        product_item_read::get_pictures_by_product_id(&db, dto.id).await
                    {
                        dto.items = picture_items.into_iter().map(ProductItemDto::from).collect();
                    }
                }

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "product": dto
                }))
            }
            Err(sqlx::Error::RowNotFound) => {
                HttpResponse::NotFound().json(BaseResponse::error("Product not found"))
            }
            Err(e) => {
                tracing::error!("Failed to get store product: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get product"))
            }
        }
    }

    /// GET /api/v1/store/products/tags - Get all unique tags from products
    ///
    /// Public endpoint - no authentication required.
    pub async fn list_tags(
        state: web::Data<AppState>,
        _query: web::Query<TagsQuery>,
    ) -> HttpResponse {
        let db = state.db.lock().await;

        match product_read::get_tags_with_counts(&db).await {
            Ok(tags) => {
                // Map to our DTO - filter out any tags that are None
                let tag_dtos: Vec<TagWithCountDto> = tags
                    .into_iter()
                    .filter_map(|t| {
                        t.tag.map(|tag| TagWithCountDto {
                            tag,
                            count: t.count,
                        })
                    })
                    .collect();

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "tags": tag_dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list product tags: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list tags"))
            }
        }
    }

    // ============================================================================
    // ADMIN ENDPOINTS
    // ============================================================================

    /// GET /api/v1/admin/store/products - List all products (including inactive/sold)
    ///
    /// Admin endpoint - requires permission level 10+.
    pub async fn admin_list(
        state: web::Data<AppState>,
        query: web::Query<AdminListProductsQuery>,
    ) -> HttpResponse {
        // Validate query parameters
        let validation_errors = query.validate();
        if !validation_errors.is_empty() {
            return HttpResponse::BadRequest()
                .json(MissingFieldsResponse::new(validation_errors));
        }

        let db = state.db.lock().await;

        let per_page = query.get_per_page();
        let page = query.get_page();
        let offset = query.get_offset();

        match product_read::get_all_admin_paginated(&db, per_page, offset).await {
            Ok(products) => {
                let total = product_read::count_all(&db).await.unwrap_or(0);

                let dtos: Vec<StoreProductListItemDto> = products
                    .into_iter()
                    .map(StoreProductListItemDto::from)
                    .collect();

                let pagination = PaginationInfo::new(page, per_page, total);

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "products": dtos,
                    "pagination": pagination
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list store products (admin): {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list products"))
            }
        }
    }

    /// POST /api/v1/admin/store/products - Create product
    ///
    /// Admin endpoint - requires permission level 10+.
    pub async fn admin_create(
        state: web::Data<AppState>,
        body: web::Json<CreateStoreProductRequest>,
    ) -> HttpResponse {
        // Validate request
        let validation_errors = body.validate();
        if !validation_errors.is_empty() {
            return HttpResponse::BadRequest()
                .json(MissingFieldsResponse::new(validation_errors));
        }

        let db = state.db.lock().await;

        // Get or generate slug
        let slug = body.get_slug();

        // Validate generated slug
        let slug_errors = validate_slug(&slug);
        if !slug_errors.is_empty() {
            return HttpResponse::BadRequest()
                .json(MissingFieldsResponse::new(slug_errors));
        }

        // Check slug uniqueness
        if product_read::slug_exists(&db, &slug).await {
            return HttpResponse::Conflict()
                .json(BaseResponse::error("Product slug already exists"));
        }

        // Validate category exists if provided
        if let Some(category_id) = body.category_id {
            if !category_read::exists(&db, category_id).await {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Category not found"));
            }
        }

        // Validate pictures exist if provided
        if let Some(ref picture_ids) = body.picture_ids {
            for picture_id in picture_ids {
                if !picture_read::exists(&db, *picture_id).await {
                    return HttpResponse::BadRequest().json(DynamicBaseResponse::error(
                        format!("Picture with id {} not found", picture_id),
                    ));
                }
            }
        }

        // Validate gallery exists if provided
        if let Some(gallery_id) = body.gallery_id {
            if !gallery_read::exists(&db, gallery_id).await {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Gallery not found"));
            }
        }

        // Create product
        let params = product_mutations::CreateProductParams {
            title: body.title.clone(),
            slug,
            description: body.description.clone(),
            price_cents: body.price_cents,
            product_type: body.product_type.clone(),
            category_id: body.category_id,
            cover_image_id: body.cover_image_id,
            author_name: body.author_name.clone(),
            city: body.city.clone(),
            country: body.country.clone(),
            region: body.region.clone(),
            nearest_mountain: body.nearest_mountain.clone(),
            nearest_river: body.nearest_river.clone(),
            natural_park: body.natural_park.clone(),
            altitude_meters: body.altitude_meters,
            season: body.season.clone(),
            weather_conditions: body.weather_conditions.clone(),
            camera_info: body.camera_info.clone(),
            date_taken: body.date_taken,
            latitude: body.latitude,
            longitude: body.longitude,
            tags: body.tags.clone(),
            is_active: true,
            is_featured: body.is_featured,
        };

        match product_mutations::create(&db, &params).await {
            Ok(product_id) => {
                // Add product items based on type
                match body.product_type.as_str() {
                    "single_image" | "bundle" => {
                        if let Some(ref picture_ids) = body.picture_ids {
                            for (index, picture_id) in picture_ids.iter().enumerate() {
                                let item_params = product_item_mutations::AddPictureToProductParams {
                                    product_id,
                                    picture_id: *picture_id,
                                    display_order: index as i32,
                                };
                                if let Err(e) =
                                    product_item_mutations::add_picture(&db, &item_params).await
                                {
                                    tracing::warn!(
                                        "Failed to add picture {} to product {}: {}",
                                        picture_id,
                                        product_id,
                                        e
                                    );
                                }
                            }
                        }
                    }
                    "gallery" => {
                        if let Some(gallery_id) = body.gallery_id {
                            let item_params = product_item_mutations::AddGalleryToProductParams {
                                product_id,
                                gallery_id,
                                display_order: 0,
                            };
                            if let Err(e) =
                                product_item_mutations::add_gallery(&db, &item_params).await
                            {
                                tracing::warn!(
                                    "Failed to add gallery {} to product {}: {}",
                                    gallery_id,
                                    product_id,
                                    e
                                );
                            }
                        }
                    }
                    _ => {}
                }

                // Fetch the created product to return full details
                match product_read::get_by_id_with_category(&db, product_id).await {
                    Ok(product) => {
                        let mut dto = StoreProductAdminDto::from(product);

                        // Load product items
                        if dto.product_type == "gallery" {
                            if let Ok(gallery_items) =
                                product_item_read::get_galleries_by_product_id(&db, dto.id).await
                            {
                                dto.items =
                                    gallery_items.into_iter().map(ProductItemDto::from).collect();
                            }
                        } else {
                            if let Ok(picture_items) =
                                product_item_read::get_pictures_by_product_id(&db, dto.id).await
                            {
                                dto.items =
                                    picture_items.into_iter().map(ProductItemDto::from).collect();
                            }
                        }

                        HttpResponse::Created().json(serde_json::json!({
                            "status": "success",
                            "message": "Product created",
                            "product": dto
                        }))
                    }
                    Err(_) => HttpResponse::Created().json(serde_json::json!({
                        "status": "success",
                        "message": "Product created",
                        "id": product_id
                    })),
                }
            }
            Err(e) => {
                tracing::error!("Failed to create store product: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create product"))
            }
        }
    }

    /// GET /api/v1/admin/store/products/{id} - Get product by ID (admin view)
    ///
    /// Admin endpoint - requires permission level 10+.
    /// Returns full product with items, even if inactive.
    pub async fn admin_get(state: web::Data<AppState>, path: web::Path<i64>) -> HttpResponse {
        let product_id = path.into_inner();
        let db = state.db.lock().await;

        match product_read::get_by_id_with_category(&db, product_id).await {
            Ok(product) => {
                let mut dto = StoreProductAdminDto::from(product);

                // Load product items based on type
                if dto.product_type == "gallery" {
                    if let Ok(gallery_items) =
                        product_item_read::get_galleries_by_product_id(&db, dto.id).await
                    {
                        dto.items = gallery_items.into_iter().map(ProductItemDto::from).collect();
                    }
                } else {
                    if let Ok(picture_items) =
                        product_item_read::get_pictures_by_product_id(&db, dto.id).await
                    {
                        dto.items = picture_items.into_iter().map(ProductItemDto::from).collect();
                    }
                }

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "product": dto
                }))
            }
            Err(sqlx::Error::RowNotFound) => {
                HttpResponse::NotFound().json(BaseResponse::error("Product not found"))
            }
            Err(e) => {
                tracing::error!("Failed to get store product (admin): {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get product"))
            }
        }
    }

    /// PUT /api/v1/admin/store/products/{id} - Update product
    ///
    /// Admin endpoint - requires permission level 10+.
    pub async fn admin_update(
        state: web::Data<AppState>,
        path: web::Path<i64>,
        body: web::Json<UpdateStoreProductRequest>,
    ) -> HttpResponse {
        let product_id = path.into_inner();

        // Validate request
        let validation_errors = body.validate();
        if !validation_errors.is_empty() {
            return HttpResponse::BadRequest()
                .json(MissingFieldsResponse::new(validation_errors));
        }

        let db = state.db.lock().await;

        // Check if product exists
        if !product_read::exists(&db, product_id).await {
            return HttpResponse::NotFound().json(BaseResponse::error("Product not found"));
        }

        // Check slug uniqueness if being changed
        if let Some(ref slug) = body.slug {
            if product_read::slug_exists_except(&db, slug, product_id).await {
                return HttpResponse::Conflict()
                    .json(BaseResponse::error("Product slug already exists"));
            }
        }

        // Validate category exists if provided
        if let Some(category_id) = body.category_id {
            if !category_read::exists(&db, category_id).await {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Category not found"));
            }
        }

        // Build update params
        let params = product_mutations::UpdateProductParams {
            title: body.title.clone(),
            slug: body.slug.clone(),
            description: body.description.clone(),
            price_cents: body.price_cents,
            product_type: body.product_type.clone(),
            category_id: body.category_id,
            cover_image_id: body.cover_image_id,
            author_name: body.author_name.clone(),
            city: body.city.clone(),
            country: body.country.clone(),
            region: body.region.clone(),
            nearest_mountain: body.nearest_mountain.clone(),
            nearest_river: body.nearest_river.clone(),
            natural_park: body.natural_park.clone(),
            altitude_meters: body.altitude_meters,
            season: body.season.clone(),
            weather_conditions: body.weather_conditions.clone(),
            camera_info: body.camera_info.clone(),
            date_taken: body.date_taken,
            latitude: body.latitude,
            longitude: body.longitude,
            tags: body.tags.clone(),
            is_active: body.is_active,
            is_featured: body.is_featured,
        };

        match product_mutations::update(&db, product_id, &params).await {
            Ok(()) => {
                // Update product items if provided
                if let Some(ref picture_ids) = body.picture_ids {
                    // Validate all pictures exist
                    for picture_id in picture_ids {
                        if !picture_read::exists(&db, *picture_id).await {
                            return HttpResponse::BadRequest().json(DynamicBaseResponse::error(
                                format!("Picture with id {} not found", picture_id),
                            ));
                        }
                    }

                    // Replace all items
                    if let Err(e) =
                        product_item_mutations::replace_with_pictures(&db, product_id, picture_ids)
                            .await
                    {
                        tracing::warn!("Failed to update product items: {}", e);
                    }
                }

                if let Some(gallery_id) = body.gallery_id {
                    if !gallery_read::exists(&db, gallery_id).await {
                        return HttpResponse::BadRequest()
                            .json(BaseResponse::error("Gallery not found"));
                    }

                    // Remove existing items and add the new gallery
                    let _ = product_item_mutations::remove_all_from_product(&db, product_id).await;
                    let item_params = product_item_mutations::AddGalleryToProductParams {
                        product_id,
                        gallery_id,
                        display_order: 0,
                    };
                    if let Err(e) = product_item_mutations::add_gallery(&db, &item_params).await {
                        tracing::warn!("Failed to update product gallery: {}", e);
                    }
                }

                // Fetch the updated product to return full details
                match product_read::get_by_id_with_category(&db, product_id).await {
                    Ok(product) => {
                        let mut dto = StoreProductAdminDto::from(product);

                        // Load product items
                        if dto.product_type == "gallery" {
                            if let Ok(gallery_items) =
                                product_item_read::get_galleries_by_product_id(&db, dto.id).await
                            {
                                dto.items =
                                    gallery_items.into_iter().map(ProductItemDto::from).collect();
                            }
                        } else {
                            if let Ok(picture_items) =
                                product_item_read::get_pictures_by_product_id(&db, dto.id).await
                            {
                                dto.items =
                                    picture_items.into_iter().map(ProductItemDto::from).collect();
                            }
                        }

                        HttpResponse::Ok().json(serde_json::json!({
                            "status": "success",
                            "message": "Product updated",
                            "product": dto
                        }))
                    }
                    Err(_) => {
                        HttpResponse::Ok().json(BaseResponse::success("Product updated"))
                    }
                }
            }
            Err(e) => {
                tracing::error!("Failed to update store product: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update product"))
            }
        }
    }

    /// DELETE /api/v1/admin/store/products/{id} - Delete product
    ///
    /// Admin endpoint - requires permission level 10+.
    /// Cannot delete sold products.
    pub async fn admin_delete(state: web::Data<AppState>, path: web::Path<i64>) -> HttpResponse {
        let product_id = path.into_inner();
        let db = state.db.lock().await;

        // Check if product exists and is not sold
        match product_read::get_by_id(&db, product_id).await {
            Ok(product) => {
                if product.is_sold {
                    return HttpResponse::BadRequest()
                        .json(BaseResponse::error("Cannot delete a sold product"));
                }
            }
            Err(sqlx::Error::RowNotFound) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Product not found"));
            }
            Err(e) => {
                tracing::error!("Failed to check product before delete: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete product"));
            }
        }

        match product_mutations::delete(&db, product_id).await {
            Ok(rows_affected) => {
                if rows_affected > 0 {
                    HttpResponse::Ok().json(BaseResponse::success("Product deleted"))
                } else {
                    HttpResponse::NotFound().json(BaseResponse::error("Product not found"))
                }
            }
            Err(e) => {
                tracing::error!("Failed to delete store product: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete product"))
            }
        }
    }

    /// POST /api/v1/admin/store/products/{id}/feature - Toggle featured status
    ///
    /// Admin endpoint - requires permission level 10+.
    pub async fn admin_toggle_featured(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let product_id = path.into_inner();
        let db = state.db.lock().await;

        // Get current product
        match product_read::get_by_id(&db, product_id).await {
            Ok(product) => {
                let new_featured = !product.is_featured;

                match product_mutations::update_is_featured(&db, product_id, new_featured).await {
                    Ok(()) => HttpResponse::Ok().json(serde_json::json!({
                        "status": "success",
                        "message": if new_featured { "Product featured" } else { "Product unfeatured" },
                        "is_featured": new_featured
                    })),
                    Err(e) => {
                        tracing::error!("Failed to toggle product featured: {}", e);
                        HttpResponse::InternalServerError()
                            .json(BaseResponse::error("Failed to toggle featured status"))
                    }
                }
            }
            Err(sqlx::Error::RowNotFound) => {
                HttpResponse::NotFound().json(BaseResponse::error("Product not found"))
            }
            Err(e) => {
                tracing::error!("Failed to get product for feature toggle: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to toggle featured status"))
            }
        }
    }

    /// POST /api/v1/admin/store/products/{id}/activate - Toggle active status
    ///
    /// Admin endpoint - requires permission level 10+.
    pub async fn admin_toggle_active(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let product_id = path.into_inner();
        let db = state.db.lock().await;

        // Get current product
        match product_read::get_by_id(&db, product_id).await {
            Ok(product) => {
                let new_active = !product.is_active;

                match product_mutations::update_is_active(&db, product_id, new_active).await {
                    Ok(()) => HttpResponse::Ok().json(serde_json::json!({
                        "status": "success",
                        "message": if new_active { "Product activated" } else { "Product deactivated" },
                        "is_active": new_active
                    })),
                    Err(e) => {
                        tracing::error!("Failed to toggle product active: {}", e);
                        HttpResponse::InternalServerError()
                            .json(BaseResponse::error("Failed to toggle active status"))
                    }
                }
            }
            Err(sqlx::Error::RowNotFound) => {
                HttpResponse::NotFound().json(BaseResponse::error("Product not found"))
            }
            Err(e) => {
                tracing::error!("Failed to get product for active toggle: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to toggle active status"))
            }
        }
    }

    // ============================================================================
    // HELPER ENDPOINTS FOR PRODUCT CREATION
    // ============================================================================

    /// GET /api/v1/admin/store/galleries - List geo galleries for selection
    ///
    /// Admin endpoint - requires permission level 10+.
    /// Returns galleries with picture counts for admin to select from.
    pub async fn admin_list_galleries(
        state: web::Data<AppState>,
        query: web::Query<AdminGalleriesQuery>,
    ) -> HttpResponse {
        let db = state.db.lock().await;

        let per_page = query.get_per_page();
        let page = query.get_page();
        let offset = query.get_offset();

        match gallery_read::get_all_with_counts_paginated(&db, per_page, offset).await {
            Ok(galleries) => {
                let total = gallery_read::count_all(&db).await.unwrap_or(0);

                let dtos: Vec<GallerySummaryDto> = galleries
                    .into_iter()
                    .filter(|g| g.gallery_type == query.gallery_type)
                    .map(GallerySummaryDto::from)
                    .collect();

                let pagination = PaginationInfo::new(page, per_page, total);

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "galleries": dtos,
                    "pagination": pagination
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list galleries for admin: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list galleries"))
            }
        }
    }

    /// GET /api/v1/admin/store/galleries/{id}/pictures - List pictures in gallery
    ///
    /// Admin endpoint - requires permission level 10+.
    /// For admin to select specific pictures when creating bundle.
    pub async fn admin_list_gallery_pictures(
        state: web::Data<AppState>,
        path: web::Path<i64>,
    ) -> HttpResponse {
        let gallery_id = path.into_inner();
        let db = state.db.lock().await;

        // Check if gallery exists
        if !gallery_read::exists(&db, gallery_id).await {
            return HttpResponse::NotFound().json(BaseResponse::error("Gallery not found"));
        }

        match picture_read::get_by_gallery_with_uploads(&db, gallery_id).await {
            Ok(pictures) => {
                let dtos: Vec<PictureSummaryDto> = pictures
                    .into_iter()
                    .map(PictureSummaryDto::from)
                    .collect();

                HttpResponse::Ok().json(serde_json::json!({
                    "status": "success",
                    "pictures": dtos
                }))
            }
            Err(e) => {
                tracing::error!("Failed to list gallery pictures: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to list pictures"))
            }
        }
    }
}
