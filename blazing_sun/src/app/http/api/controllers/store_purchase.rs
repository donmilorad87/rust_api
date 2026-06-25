//! Store Purchase Controller
//!
//! Handles store checkout and purchase operations:
//! - POST /api/v1/store/checkout/{product_id}: Initiate checkout for a product
//! - GET /api/v1/store/purchases: Get user's completed purchases
//! - GET /api/v1/store/purchases/{id}: Get purchase detail
//! - GET /api/v1/store/purchases/{id}/downloads: Get downloadable images for a purchase
//! - GET /api/v1/store/downloads/{purchase_id}/{picture_id}: Download a purchased image

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::app::checkout::{register_pending, remove_pending, CheckoutKafkaRequest};
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::config::upload::UploadConfig;
use crate::config::AppConfig;
use crate::database::read::picture as db_picture_read;
use crate::database::read::store::download as db_download_read;
use crate::database::read::store::product as db_product_read;
use crate::database::read::store::product_item as db_product_item_read;
use crate::database::read::store::purchase as db_purchase_read;
use crate::database::mutations::store::download as db_download_mutations;
use crate::database::mutations::store::purchase as db_purchase_mutations;
use crate::database::AppState;
use crate::events::topic;

/// Store Purchase Controller
pub struct StorePurchaseController;

// ============================================================================
// Request/Response DTOs
// ============================================================================

/// Pagination query parameters
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_page() -> u64 {
    1
}
fn default_limit() -> i64 {
    16
}

/// Checkout session response
#[derive(Debug, Serialize)]
pub struct CheckoutSessionResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub session_id: String,
    pub url: String,
    pub purchase_id: i64,
}

/// Paginated response wrapper
#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub pagination: PaginationInfo,
}

/// Pagination info
#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    pub page: u64,
    pub limit: i64,
    pub total: u64,
    pub total_pages: u64,
    pub has_next: bool,
    pub has_prev: bool,
}

/// Purchase list item
#[derive(Debug, Serialize)]
pub struct PurchaseListItem {
    pub id: i64,
    pub product_id: i64,
    pub amount_cents: i64,
    pub status: String,
    pub license_type: String,
    pub purchased_at: Option<String>,
    pub created_at: String,
    pub product_title: String,
    pub product_slug: String,
    pub product_type: String,
    pub product_cover_image_id: Option<i64>,
}

/// Purchase detail response
#[derive(Debug, Serialize)]
pub struct PurchaseDetailResponse {
    pub id: i64,
    pub product_id: i64,
    pub amount_cents: i64,
    pub status: String,
    pub license_type: String,
    pub purchased_at: Option<String>,
    pub created_at: String,
    pub product: ProductInfo,
    pub items: Vec<ProductItemInfo>,
}

/// Product info for purchase detail
#[derive(Debug, Serialize)]
pub struct ProductInfo {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub product_type: String,
    pub cover_image_id: Option<i64>,
}

/// Product item info
#[derive(Debug, Serialize)]
pub struct ProductItemInfo {
    pub id: i64,
    pub item_type: String,
    pub picture_id: Option<i64>,
    pub gallery_id: Option<i64>,
    pub picture_title: Option<String>,
    pub upload_uuid: Option<String>,
}

/// Downloadable image info
#[derive(Debug, Serialize)]
pub struct DownloadableImage {
    pub picture_id: i64,
    pub title: Option<String>,
    pub download_count: i32,
    pub last_downloaded_at: Option<String>,
    pub download_url: String,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get user_id from request extensions
fn get_user_id(req: &HttpRequest) -> Result<i64, HttpResponse> {
    req.extensions().get::<i64>().copied().ok_or_else(|| {
        HttpResponse::Unauthorized().json(BaseResponse::error("Authentication required"))
    })
}

// ============================================================================
// Controller Implementation
// ============================================================================

impl StorePurchaseController {
    /// POST /api/v1/store/checkout/{product_id} - Initiate checkout for a product
    ///
    /// Creates a pending purchase and initiates Stripe checkout via Kafka.
    pub async fn create_checkout(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        let product_id = path.into_inner();

        // 2. Check event bus availability
        let event_bus = match state.event_bus() {
            Some(bus) => bus,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Checkout service unavailable"));
            }
        };

        // 3. Get database connection
        let db = state.db.lock().await;

        // 4. Get and validate product
        let product = match db_product_read::get_by_id(&db, product_id).await {
            Ok(p) => p,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Product not found"));
            }
        };

        // 5. Validate product is available
        if !product.is_active {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Product is not available"));
        }

        if product.is_sold {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Product has already been sold"));
        }

        // 6. Check if user already has a purchase for this product
        if db_purchase_read::user_has_purchased_product(&db, user_id, product_id).await {
            return HttpResponse::Conflict()
                .json(BaseResponse::error("You have already purchased this product"));
        }

        // 7. Check for existing pending purchase
        if let Ok(existing) = db_purchase_read::get_by_user_and_product(&db, user_id, product_id).await {
            if existing.status == "pending" {
                return HttpResponse::Conflict()
                    .json(BaseResponse::error("You already have a pending purchase for this product"));
            }
        }

        // 8. Generate request ID for Kafka correlation
        let request_id = Uuid::new_v4().to_string();

        // 9. Create pending purchase in database
        let create_params = db_purchase_mutations::CreatePurchaseParams {
            user_id,
            product_id,
            amount_cents: product.price_cents,
            stripe_session_id: None, // Will be updated after checkout service responds
            license_type: "standard".to_string(),
        };

        let purchase_id = match db_purchase_mutations::create(&db, &create_params).await {
            Ok(id) => id,
            Err(e) => {
                error!("Failed to create pending purchase: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create purchase"));
            }
        };

        // 10. Build URLs for Stripe redirect
        let app_url = AppConfig::app_url().trim_end_matches('/');
        let success_url = format!(
            "{}/store/purchase/success?session_id={{CHECKOUT_SESSION_ID}}&purchase_id={}",
            app_url, purchase_id
        );
        let cancel_url = format!(
            "{}/store/product/{}?status=cancelled",
            app_url, product.slug
        );

        // 11. Register pending request for Kafka response
        let receiver = register_pending(request_id.clone()).await;

        // 12. Create checkout request with store_product purpose
        let checkout_request = CheckoutKafkaRequest {
            request_id: request_id.clone(),
            user_id,
            amount_cents: product.price_cents,
            currency: "eur".to_string(),
            purpose: "store_product".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            success_url,
            cancel_url,
        };

        // 13. Serialize and publish to checkout topic
        let payload = match serde_json::to_vec(&checkout_request) {
            Ok(p) => p,
            Err(e) => {
                remove_pending(&request_id).await;
                // Clean up the pending purchase
                let _ = db_purchase_mutations::delete(&db, purchase_id).await;
                error!("Failed to serialize checkout request: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Checkout request failed"));
            }
        };

        if let Err(e) = event_bus
            .producer()
            .send_raw(topic::CHECKOUT_REQUESTS, Some(&request_id), &payload)
            .await
        {
            remove_pending(&request_id).await;
            // Clean up the pending purchase
            let _ = db_purchase_mutations::delete(&db, purchase_id).await;
            warn!("Failed to publish checkout request to Kafka: {}", e);
            return HttpResponse::BadGateway()
                .json(BaseResponse::error("Checkout service unavailable"));
        }

        // Drop database lock before waiting
        drop(db);

        // 14. Wait for response from checkout service (via checkout_finished handler)
        let response = match tokio::time::timeout(Duration::from_secs(15), receiver).await {
            Ok(Ok(response)) => response,
            Ok(Err(_)) => {
                return HttpResponse::BadGateway()
                    .json(BaseResponse::error("Checkout service failed"));
            }
            Err(_) => {
                remove_pending(&request_id).await;
                return HttpResponse::GatewayTimeout()
                    .json(BaseResponse::error("Checkout timed out"));
            }
        };

        // 15. Handle response
        if let Some(error_message) = response.error {
            warn!("Checkout session failed: {}", error_message);
            // Mark purchase as failed
            let db = state.db.lock().await;
            let _ = db_purchase_mutations::mark_failed(&db, purchase_id).await;
            return HttpResponse::BadGateway().json(BaseResponse::error("Checkout failed"));
        }

        let session_id = match response.session_id {
            Some(id) => id,
            None => {
                return HttpResponse::BadGateway()
                    .json(BaseResponse::error("Checkout session missing"));
            }
        };

        let session_url = match response.session_url {
            Some(url) => url,
            None => {
                return HttpResponse::BadGateway()
                    .json(BaseResponse::error("Checkout session URL missing"));
            }
        };

        // 16. Update purchase with stripe session ID
        let db = state.db.lock().await;
        if let Err(e) = db_purchase_mutations::update_stripe_session_id(&db, purchase_id, &session_id).await {
            warn!("Failed to update stripe session ID: {}", e);
        }

        info!(
            user_id = %user_id,
            product_id = %product_id,
            purchase_id = %purchase_id,
            session_id = %session_id,
            "Store checkout session created"
        );

        HttpResponse::Ok().json(CheckoutSessionResponse {
            base: BaseResponse::success("Checkout session created"),
            session_id,
            url: session_url,
            purchase_id,
        })
    }

    /// GET /api/v1/store/purchases - Get user's completed purchases
    pub async fn list_purchases(
        state: web::Data<AppState>,
        req: HttpRequest,
        query: web::Query<PaginationQuery>,
    ) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        // 2. Parse pagination
        let limit = query.limit.min(50).max(1);
        let page = query.page.max(1);
        let offset = ((page - 1) * (limit as u64)) as i64;

        // 3. Get database connection
        let db = state.db.lock().await;

        // 4. Get total count
        let total = match db_purchase_read::count_completed_by_user(&db, user_id).await {
            Ok(count) => count as u64,
            Err(_) => 0,
        };

        // 5. Get purchases
        let purchases = match db_purchase_read::get_completed_by_user_paginated(&db, user_id, limit, offset).await {
            Ok(p) => p,
            Err(e) => {
                error!("Failed to get purchases: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get purchases"));
            }
        };

        // 6. Convert to response items
        let items: Vec<PurchaseListItem> = purchases
            .into_iter()
            .map(|p| PurchaseListItem {
                id: p.id,
                product_id: p.product_id,
                amount_cents: p.amount_cents,
                status: p.status,
                license_type: p.license_type,
                purchased_at: p.purchased_at.map(|dt| dt.to_rfc3339()),
                created_at: p.created_at.to_rfc3339(),
                product_title: p.product_title,
                product_slug: p.product_slug,
                product_type: p.product_type,
                product_cover_image_id: p.product_cover_image_id,
            })
            .collect();

        // 7. Calculate pagination
        let total_pages = if total > 0 {
            ((total as f64) / (limit as f64)).ceil() as u64
        } else {
            0
        };

        HttpResponse::Ok().json(PaginatedResponse {
            items,
            pagination: PaginationInfo {
                page,
                limit,
                total,
                total_pages,
                has_next: page < total_pages,
                has_prev: page > 1,
            },
        })
    }

    /// GET /api/v1/store/purchases/{id} - Get purchase detail
    pub async fn get_purchase(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        let purchase_id = path.into_inner();

        // 2. Get database connection
        let db = state.db.lock().await;

        // 3. Get purchase with ownership check
        let purchase = match db_purchase_read::get_by_id_and_user(&db, purchase_id, user_id).await {
            Ok(p) => p,
            Err(_) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Purchase not found"));
            }
        };

        // 4. Get product details
        let product = match db_product_read::get_by_id(&db, purchase.product_id).await {
            Ok(p) => p,
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Product not found"));
            }
        };

        // 5. Get product items
        let items = match db_product_item_read::get_pictures_by_product_id(&db, purchase.product_id).await {
            Ok(i) => i,
            Err(_) => Vec::new(),
        };

        // 6. Build response
        let item_infos: Vec<ProductItemInfo> = items
            .into_iter()
            .map(|item| ProductItemInfo {
                id: item.id,
                item_type: item.item_type,
                picture_id: item.picture_id,
                gallery_id: item.gallery_id,
                picture_title: item.picture_title,
                upload_uuid: item.upload_uuid.map(|u| u.to_string()),
            })
            .collect();

        HttpResponse::Ok().json(PurchaseDetailResponse {
            id: purchase.id,
            product_id: purchase.product_id,
            amount_cents: purchase.amount_cents,
            status: purchase.status,
            license_type: purchase.license_type,
            purchased_at: purchase.purchased_at.map(|dt| dt.to_rfc3339()),
            created_at: purchase.created_at.to_rfc3339(),
            product: ProductInfo {
                id: product.id,
                title: product.title,
                slug: product.slug,
                description: product.description,
                product_type: product.product_type,
                cover_image_id: product.cover_image_id,
            },
            items: item_infos,
        })
    }

    /// GET /api/v1/store/purchases/{id}/downloads - Get downloadable images for a purchase
    pub async fn list_downloads(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        let purchase_id = path.into_inner();

        // 2. Get database connection
        let db = state.db.lock().await;

        // 3. Verify purchase ownership and completion
        let purchase = match db_purchase_read::get_by_id_and_user(&db, purchase_id, user_id).await {
            Ok(p) => p,
            Err(_) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Purchase not found"));
            }
        };

        if purchase.status != "completed" {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Purchase is not completed"));
        }

        // 4. Get all picture IDs for the product
        let picture_ids = match db_product_item_read::get_picture_ids_by_product_id(&db, purchase.product_id).await {
            Ok(ids) => ids,
            Err(e) => {
                error!("Failed to get picture IDs: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to get downloadable images"));
            }
        };

        // 5. Get download records for existing downloads
        let existing_downloads = match db_download_read::get_by_purchase_id(&db, purchase_id).await {
            Ok(d) => d,
            Err(_) => Vec::new(),
        };

        // 6. Build downloadable images list
        let app_url = AppConfig::app_url().trim_end_matches('/');
        let mut downloadable_images: Vec<DownloadableImage> = Vec::new();

        for picture_id in picture_ids {
            // Check if we have an existing download record
            let existing = existing_downloads.iter().find(|d| d.picture_id == picture_id);

            // Get picture title if not in existing downloads
            let title = if let Some(d) = existing {
                d.picture_title.clone()
            } else {
                // Fetch picture title from database
                match db_picture_read::get_by_id(&db, picture_id).await {
                    Ok(p) => p.title,
                    Err(_) => None,
                }
            };

            downloadable_images.push(DownloadableImage {
                picture_id,
                title,
                download_count: existing.map(|d| d.download_count).unwrap_or(0),
                last_downloaded_at: existing.and_then(|d| Some(d.last_downloaded_at.to_rfc3339())),
                download_url: format!(
                    "{}/api/v1/store/downloads/{}/{}",
                    app_url, purchase_id, picture_id
                ),
            });
        }

        HttpResponse::Ok().json(serde_json::json!({
            "status": "success",
            "downloads": downloadable_images,
            "total": downloadable_images.len(),
        }))
    }

    /// GET /api/v1/store/downloads/{purchase_id}/{picture_id} - Download a purchased image
    pub async fn download_image(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<(i64, i64)>,
    ) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match get_user_id(&req) {
            Ok(id) => id,
            Err(response) => return response,
        };

        let (purchase_id, picture_id) = path.into_inner();

        // 2. Get database connection
        let db = state.db.lock().await;

        // 3. Verify purchase ownership and completion
        let purchase = match db_purchase_read::get_by_id_and_user(&db, purchase_id, user_id).await {
            Ok(p) => p,
            Err(_) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Purchase not found"));
            }
        };

        if purchase.status != "completed" {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Purchase is not completed"));
        }

        // 4. Verify user can download this picture (belongs to purchased product)
        if !db_download_read::user_can_download_picture(&db, user_id, picture_id).await {
            return HttpResponse::Forbidden()
                .json(BaseResponse::error("You do not have access to this image"));
        }

        // 5. Get picture with upload info
        let picture = match db_picture_read::get_by_id_with_upload(&db, picture_id).await {
            Ok(p) => p,
            Err(_) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Image not found"));
            }
        };

        // 6. Record/update download
        let download_params = db_download_mutations::RecordDownloadParams {
            purchase_id,
            user_id,
            picture_id,
        };

        if let Err(e) = db_download_mutations::record_download(&db, &download_params).await {
            warn!("Failed to record download: {}", e);
            // Continue with download even if recording fails
        }

        // 7. Build file path
        let storage_base = UploadConfig::storage_path();
        let file_path = format!(
            "{}/public/{}",
            storage_base, picture.upload_stored_name
        );

        // 8. Read and return file
        match tokio::fs::read(&file_path).await {
            Ok(data) => {
                let content_type = picture.upload_mime_type;
                let filename = picture.upload_original_name;

                info!(
                    user_id = %user_id,
                    purchase_id = %purchase_id,
                    picture_id = %picture_id,
                    "Store image downloaded"
                );

                HttpResponse::Ok()
                    .content_type(content_type)
                    .insert_header((
                        "Content-Disposition",
                        format!("attachment; filename=\"{}\"", filename),
                    ))
                    .body(data)
            }
            Err(e) => {
                error!("Failed to read file {}: {}", file_path, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to download image"))
            }
        }
    }
}
