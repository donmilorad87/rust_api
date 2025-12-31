//!
//! Theme Controller
//!
//! Handles theme configuration operations:
//! - GET /admin/theme: Get current theme configuration
//! - PUT /admin/theme: Update theme variables (triggers build)
//! - PUT /admin/theme/branding: Update branding (name, description, logo, favicon)
//! - POST /admin/theme/build: Trigger manual rebuild
//! - GET /admin/theme/build/status: Get build status
//!

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{error, info};
use uuid::Uuid;

use crate::app::db_query::mutations::page_schema as schema_mutations;
use crate::app::db_query::mutations::page_seo as seo_mutations;
use crate::app::db_query::mutations::site_config as db_mutations;
use crate::app::db_query::read::page_schema as schema_read;
use crate::app::db_query::read::page_seo as seo_read;
use crate::app::db_query::read::site_config as db_read;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::bootstrap::includes::theme::ThemeService;
use crate::database::AppState;

/// Theme Controller
pub struct ThemeController;

/// Theme configuration response
#[derive(Debug, Serialize)]
pub struct ThemeConfigResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub config: ThemeConfigDto,
}

/// Theme configuration DTO
#[derive(Debug, Serialize, Deserialize)]
pub struct ThemeConfigDto {
    // Identity/Branding
    pub site_name: String,
    pub show_site_name: bool,
    pub identity_color_start: String,
    pub identity_color_end: String,
    pub identity_size: String,
    pub logo_uuid: Option<String>,
    pub favicon_uuid: Option<String>,
    // Theme variables
    pub scss_variables: Value,
    pub theme_light: Value,
    pub theme_dark: Value,
    // Build info
    pub assets_version: String,
    pub last_build_status: Option<String>,
    pub last_build_at: Option<String>,
    pub last_build_error: Option<String>,
}

/// Theme update request
#[derive(Debug, Deserialize)]
pub struct ThemeUpdateRequest {
    pub logo_uuid: Option<String>,
    pub favicon_uuid: Option<String>,
    pub scss_variables: Option<Value>,
    pub theme_light: Option<Value>,
    pub theme_dark: Option<Value>,
}

/// Branding update request
#[derive(Debug, Deserialize)]
pub struct BrandingUpdateRequest {
    pub site_name: Option<String>,
    pub show_site_name: Option<bool>,
    pub identity_color_start: Option<String>,
    pub identity_color_end: Option<String>,
    pub identity_size: Option<String>,
    pub logo_uuid: Option<String>,
    pub favicon_uuid: Option<String>,
}

/// Build status response
#[derive(Debug, Serialize)]
pub struct BuildStatusResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub status: String,
    pub error: Option<String>,
    pub version: String,
}

/// Build result response
#[derive(Debug, Serialize)]
pub struct BuildResultResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub success: bool,
    pub new_version: Option<String>,
    pub build_output: Option<String>,
    pub error: Option<String>,
}

// ============================================
// SEO DTOs and Responses
// ============================================

/// SEO list response
#[derive(Debug, Serialize)]
pub struct SeoListResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub pages: Vec<SeoListItemDto>,
}

/// SEO list item DTO
#[derive(Debug, Serialize)]
pub struct SeoListItemDto {
    pub id: i64,
    pub route_name: String,
    pub page_path: String,
    pub page_label: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub robots: Option<String>,
    pub is_active: Option<bool>,
}

/// Full SEO response
#[derive(Debug, Serialize)]
pub struct SeoResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub seo: SeoDto,
}

/// Full SEO DTO
#[derive(Debug, Serialize)]
pub struct SeoDto {
    pub id: i64,
    pub route_name: String,
    pub page_path: String,
    pub page_label: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub keywords: Option<String>,
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_image_uuid: Option<String>,
    pub og_type: Option<String>,
    pub twitter_card: Option<String>,
    pub twitter_title: Option<String>,
    pub twitter_description: Option<String>,
    pub twitter_image_uuid: Option<String>,
    pub canonical_url: Option<String>,
    pub robots: Option<String>,
    pub structured_data: Option<Value>,
    pub custom_meta: Option<Value>,
    pub is_active: Option<bool>,
}

/// SEO update request
#[derive(Debug, Deserialize)]
pub struct SeoUpdateRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub keywords: Option<String>,
    pub og_title: Option<String>,
    pub og_description: Option<String>,
    pub og_image_uuid: Option<String>,
    pub og_type: Option<String>,
    pub twitter_card: Option<String>,
    pub twitter_title: Option<String>,
    pub twitter_description: Option<String>,
    pub twitter_image_uuid: Option<String>,
    pub canonical_url: Option<String>,
    pub robots: Option<String>,
    pub structured_data: Option<Value>,
    pub custom_meta: Option<Value>,
    pub is_active: Option<bool>,
}

// ============================================
// Schema DTOs and Responses
// ============================================

/// Schema list response
#[derive(Debug, Serialize)]
pub struct SchemaListResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub schemas: Vec<SchemaDto>,
}

/// Single schema response
#[derive(Debug, Serialize)]
pub struct SchemaResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub schema: SchemaDto,
}

/// Schema DTO
#[derive(Debug, Serialize)]
pub struct SchemaDto {
    pub id: i64,
    pub page_seo_id: i64,
    pub schema_type: String,
    pub schema_data: Value,
    pub position: Option<i32>,
    pub is_active: Option<bool>,
}

/// Create schema request
#[derive(Debug, Deserialize)]
pub struct CreateSchemaRequest {
    pub schema_type: String,
    pub schema_data: Value,
    pub position: Option<i32>,
    pub is_active: Option<bool>,
}

/// Update schema request
#[derive(Debug, Deserialize)]
pub struct UpdateSchemaRequest {
    pub schema_type: Option<String>,
    pub schema_data: Option<Value>,
    pub position: Option<i32>,
    pub is_active: Option<bool>,
}

impl ThemeController {
    /// Check if user has admin permissions (level 10+)
    fn check_admin_permission(req: &HttpRequest) -> Option<HttpResponse> {
        // Get user permissions from JWT extensions
        let permissions = req.extensions().get::<i16>().copied().unwrap_or(0);

        if permissions < 10 {
            return Some(
                HttpResponse::Forbidden().json(BaseResponse::error("Admin permission required")),
            );
        }
        None
    }

    /// GET /api/v1/admin/theme - Get current theme configuration
    pub async fn get(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let db = state.db.lock().await;

        match db_read::get(&db).await {
            Ok(config) => HttpResponse::Ok().json(ThemeConfigResponse {
                base: BaseResponse::success("Theme configuration retrieved"),
                config: ThemeConfigDto {
                    // Identity/Branding
                    site_name: config.site_name,
                    show_site_name: config.show_site_name,
                    identity_color_start: config.identity_color_start,
                    identity_color_end: config.identity_color_end,
                    identity_size: config.identity_size,
                    logo_uuid: config.logo_uuid.map(|u| u.to_string()),
                    favicon_uuid: config.favicon_uuid.map(|u| u.to_string()),
                    // Theme variables
                    scss_variables: config.scss_variables,
                    theme_light: config.theme_light,
                    theme_dark: config.theme_dark,
                    // Build info
                    assets_version: config.assets_version,
                    last_build_status: config.last_build_status,
                    last_build_at: config.last_build_at.map(|t| t.to_rfc3339()),
                    last_build_error: config.last_build_error,
                },
            }),
            Err(e) => {
                error!("Failed to get theme config: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to retrieve theme configuration"))
            }
        }
    }

    /// PUT /api/v1/admin/theme - Update theme variables and trigger build
    pub async fn update(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<ThemeUpdateRequest>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        info!("Theme update requested");
        info!("Received theme_light: {:?}", body.theme_light);
        info!("Received theme_dark: {:?}", body.theme_dark);

        // Mark build as started in database
        {
            let db = state.db.lock().await;
            if let Err(e) = db_mutations::set_build_started(&db).await {
                error!("Failed to set build started: {}", e);
            }
        }

        // Update database first
        {
            let db = state.db.lock().await;

            // Update logo if provided
            if let Some(ref logo_str) = body.logo_uuid {
                let logo_uuid = if logo_str.is_empty() {
                    None
                } else {
                    match Uuid::parse_str(logo_str) {
                        Ok(uuid) => Some(uuid),
                        Err(_) => {
                            return HttpResponse::BadRequest()
                                .json(BaseResponse::error("Invalid logo UUID format"));
                        }
                    }
                };

                if let Err(e) = db_mutations::update_logo(&db, logo_uuid).await {
                    error!("Failed to update logo: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to update logo"));
                }
            }

            // Update favicon if provided
            if let Some(ref favicon_str) = body.favicon_uuid {
                let favicon_uuid = if favicon_str.is_empty() {
                    None
                } else {
                    match Uuid::parse_str(favicon_str) {
                        Ok(uuid) => Some(uuid),
                        Err(_) => {
                            return HttpResponse::BadRequest()
                                .json(BaseResponse::error("Invalid favicon UUID format"));
                        }
                    }
                };

                if let Err(e) = db_mutations::update_favicon(&db, favicon_uuid).await {
                    error!("Failed to update favicon: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to update favicon"));
                }
            }

            // Update theme variables
            if let Err(e) = db_mutations::update_themes(
                &db,
                body.scss_variables.as_ref(),
                body.theme_light.as_ref(),
                body.theme_dark.as_ref(),
            )
            .await
            {
                error!("Failed to update themes in database: {}", e);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to save theme configuration"));
            }
        }

        // Run the update and build
        match ThemeService::update_and_build(
            body.scss_variables.clone(),
            body.theme_light.clone(),
            body.theme_dark.clone(),
        )
        .await
        {
            Ok(result) => {
                // Update database with result
                let db = state.db.lock().await;
                if result.success {
                    if let Some(ref version) = result.new_version {
                        let _ = db_mutations::set_build_success(&db, version).await;
                    }
                } else {
                    let error_msg = result.error.as_deref().unwrap_or("Build failed");
                    let _ = db_mutations::set_build_failed(&db, error_msg).await;
                }

                HttpResponse::Ok().json(BuildResultResponse {
                    base: if result.success {
                        BaseResponse::success("Theme updated and built successfully")
                    } else {
                        BaseResponse::error("Build failed - changes rolled back")
                    },
                    success: result.success,
                    new_version: result.new_version,
                    build_output: result.build_output.map(|b| b.stdout),
                    error: result.error,
                })
            }
            Err(e) => {
                error!("Theme update failed: {}", e);

                // Update database with failure
                let db = state.db.lock().await;
                let _ = db_mutations::set_build_failed(&db, &e.to_string()).await;

                HttpResponse::InternalServerError().json(BuildResultResponse {
                    base: BaseResponse::error("Theme update failed"),
                    success: false,
                    new_version: None,
                    build_output: None,
                    error: Some(e.to_string()),
                })
            }
        }
    }

    /// PUT /api/v1/admin/theme/branding - Update branding (identity changes trigger rebuild)
    pub async fn update_branding(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<BrandingUpdateRequest>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        info!("Branding update requested");

        // Check if identity fields changed (these require rebuild)
        let needs_rebuild = body.identity_color_start.is_some()
            || body.identity_color_end.is_some()
            || body.identity_size.is_some();

        // Mark build as started if rebuild needed
        if needs_rebuild {
            let db = state.db.lock().await;
            if let Err(e) = db_mutations::set_build_started(&db).await {
                error!("Failed to set build started: {}", e);
            }
        }

        // Update database
        {
            let db = state.db.lock().await;

            // Update identity if any identity field provided
            if body.site_name.is_some()
                || body.show_site_name.is_some()
                || body.identity_color_start.is_some()
                || body.identity_color_end.is_some()
                || body.identity_size.is_some()
            {
                // Get current config for defaults
                let current = match db_read::get(&db).await {
                    Ok(c) => c,
                    Err(e) => {
                        error!("Failed to get current config: {}", e);
                        return HttpResponse::InternalServerError()
                            .json(BaseResponse::error("Failed to get current configuration"));
                    }
                };

                let params = db_mutations::UpdateIdentityParams {
                    site_name: body.site_name.clone().unwrap_or(current.site_name),
                    show_site_name: body.show_site_name.unwrap_or(current.show_site_name),
                    identity_color_start: body
                        .identity_color_start
                        .clone()
                        .unwrap_or(current.identity_color_start),
                    identity_color_end: body
                        .identity_color_end
                        .clone()
                        .unwrap_or(current.identity_color_end),
                    identity_size: body.identity_size.clone().unwrap_or(current.identity_size),
                };

                if let Err(e) = db_mutations::update_identity(&db, &params).await {
                    error!("Failed to update identity: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to update identity"));
                }
            }

            // Update logo
            if let Some(ref logo_str) = body.logo_uuid {
                let logo_uuid = if logo_str.is_empty() {
                    None
                } else {
                    match Uuid::parse_str(logo_str) {
                        Ok(uuid) => Some(uuid),
                        Err(_) => {
                            return HttpResponse::BadRequest()
                                .json(BaseResponse::error("Invalid logo UUID format"));
                        }
                    }
                };

                if let Err(e) = db_mutations::update_logo(&db, logo_uuid).await {
                    error!("Failed to update logo: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to update logo"));
                }
            }

            // Update favicon
            if let Some(ref favicon_str) = body.favicon_uuid {
                let favicon_uuid = if favicon_str.is_empty() {
                    None
                } else {
                    match Uuid::parse_str(favicon_str) {
                        Ok(uuid) => Some(uuid),
                        Err(_) => {
                            return HttpResponse::BadRequest()
                                .json(BaseResponse::error("Invalid favicon UUID format"));
                        }
                    }
                };

                if let Err(e) = db_mutations::update_favicon(&db, favicon_uuid).await {
                    error!("Failed to update favicon: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to update favicon"));
                }
            }
        }

        // If identity colors/size changed, trigger rebuild with SCSS variables
        if needs_rebuild {
            // Build SCSS variables JSON with identity values
            let scss_vars = serde_json::json!({
                "identity_color_start": body.identity_color_start.as_deref().unwrap_or("#3498db"),
                "identity_color_end": body.identity_color_end.as_deref().unwrap_or("#764ba2"),
                "identity_size": body.identity_size.as_deref().unwrap_or("1.375rem"),
            });

            match ThemeService::update_and_build(Some(scss_vars), None, None).await {
                Ok(result) => {
                    // Update database with result
                    let db = state.db.lock().await;
                    if result.success {
                        if let Some(ref version) = result.new_version {
                            let _ = db_mutations::set_build_success(&db, version).await;
                        }
                    } else {
                        let error_msg = result.error.as_deref().unwrap_or("Build failed");
                        let _ = db_mutations::set_build_failed(&db, error_msg).await;
                    }

                    HttpResponse::Ok().json(BuildResultResponse {
                        base: if result.success {
                            BaseResponse::success("Branding saved and theme rebuilt successfully")
                        } else {
                            BaseResponse::error("Build failed - changes rolled back")
                        },
                        success: result.success,
                        new_version: result.new_version,
                        build_output: result.build_output.map(|b| b.stdout),
                        error: result.error,
                    })
                }
                Err(e) => {
                    error!("Theme build failed: {}", e);

                    let db = state.db.lock().await;
                    let _ = db_mutations::set_build_failed(&db, &e.to_string()).await;

                    HttpResponse::InternalServerError().json(BuildResultResponse {
                        base: BaseResponse::error("Theme build failed"),
                        success: false,
                        new_version: None,
                        build_output: None,
                        error: Some(e.to_string()),
                    })
                }
            }
        } else {
            // No rebuild needed - just logo/favicon/site_name text change
            HttpResponse::Ok().json(BaseResponse::success("Branding updated successfully"))
        }
    }

    /// POST /api/v1/admin/theme/build - Trigger manual rebuild
    pub async fn trigger_build(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        info!("Manual theme build triggered");

        // Mark build as started
        {
            let db = state.db.lock().await;
            if let Err(e) = db_mutations::set_build_started(&db).await {
                error!("Failed to set build started: {}", e);
            }
        }

        // Run rebuild
        match ThemeService::rebuild().await {
            Ok(result) => {
                // Update database
                let db = state.db.lock().await;
                if result.success {
                    if let Some(ref version) = result.new_version {
                        let _ = db_mutations::set_build_success(&db, version).await;
                    }
                } else {
                    let error_msg = result.error.as_deref().unwrap_or("Build failed");
                    let _ = db_mutations::set_build_failed(&db, error_msg).await;
                }

                HttpResponse::Ok().json(BuildResultResponse {
                    base: if result.success {
                        BaseResponse::success("Build completed successfully")
                    } else {
                        BaseResponse::error("Build failed")
                    },
                    success: result.success,
                    new_version: result.new_version,
                    build_output: result.build_output.map(|b| b.stdout),
                    error: result.error,
                })
            }
            Err(e) => {
                error!("Build failed: {}", e);

                let db = state.db.lock().await;
                let _ = db_mutations::set_build_failed(&db, &e.to_string()).await;

                HttpResponse::InternalServerError().json(BuildResultResponse {
                    base: BaseResponse::error("Build failed"),
                    success: false,
                    new_version: None,
                    build_output: None,
                    error: Some(e.to_string()),
                })
            }
        }
    }

    /// GET /api/v1/admin/theme/build/status - Get build status
    pub async fn build_status(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let db = state.db.lock().await;

        match db_read::get(&db).await {
            Ok(config) => HttpResponse::Ok().json(BuildStatusResponse {
                base: BaseResponse::success("Build status retrieved"),
                status: config.last_build_status.unwrap_or_else(|| "pending".to_string()),
                error: config.last_build_error,
                version: config.assets_version,
            }),
            Err(e) => {
                error!("Failed to get build status: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to retrieve build status"))
            }
        }
    }

    // ============================================
    // SEO Endpoints
    // ============================================

    /// GET /api/v1/admin/seo - Get all page SEO entries
    pub async fn seo_list(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let db = state.db.lock().await;

        match seo_read::get_all(&db).await {
            Ok(pages) => {
                let items: Vec<SeoListItemDto> = pages
                    .into_iter()
                    .map(|p| SeoListItemDto {
                        id: p.id,
                        route_name: p.route_name,
                        page_path: p.page_path,
                        page_label: p.page_label,
                        title: p.title,
                        description: p.description,
                        robots: p.robots,
                        is_active: p.is_active,
                    })
                    .collect();

                HttpResponse::Ok().json(SeoListResponse {
                    base: BaseResponse::success("SEO pages retrieved"),
                    pages: items,
                })
            }
            Err(e) => {
                error!("Failed to get SEO pages: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to retrieve SEO pages"))
            }
        }
    }

    /// GET /api/v1/admin/seo/{route_name} - Get SEO for specific page
    pub async fn seo_get(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let route_name = path.into_inner();
        let db = state.db.lock().await;

        match seo_read::get_by_route(&db, &route_name).await {
            Ok(seo) => HttpResponse::Ok().json(SeoResponse {
                base: BaseResponse::success("SEO data retrieved"),
                seo: SeoDto {
                    id: seo.id,
                    route_name: seo.route_name,
                    page_path: seo.page_path,
                    page_label: seo.page_label,
                    title: seo.title,
                    description: seo.description,
                    keywords: seo.keywords,
                    og_title: seo.og_title,
                    og_description: seo.og_description,
                    og_image_uuid: seo.og_image_uuid.map(|u| u.to_string()),
                    og_type: seo.og_type,
                    twitter_card: seo.twitter_card,
                    twitter_title: seo.twitter_title,
                    twitter_description: seo.twitter_description,
                    twitter_image_uuid: seo.twitter_image_uuid.map(|u| u.to_string()),
                    canonical_url: seo.canonical_url,
                    robots: seo.robots,
                    structured_data: seo.structured_data,
                    custom_meta: seo.custom_meta,
                    is_active: seo.is_active,
                },
            }),
            Err(e) => {
                error!("Failed to get SEO for route {}: {}", route_name, e);
                HttpResponse::NotFound().json(BaseResponse::error("Page SEO not found"))
            }
        }
    }

    /// PUT /api/v1/admin/seo/{route_name} - Update SEO for specific page
    pub async fn seo_update(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
        body: web::Json<SeoUpdateRequest>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let route_name = path.into_inner();
        let db = state.db.lock().await;

        // Check if page exists
        if !seo_read::exists_by_route(&db, &route_name).await {
            return HttpResponse::NotFound().json(BaseResponse::error("Page SEO not found"));
        }

        // Parse UUIDs if provided
        let og_image_uuid = match &body.og_image_uuid {
            Some(s) if s.is_empty() => Some(None),
            Some(s) => match Uuid::parse_str(s) {
                Ok(uuid) => Some(Some(uuid)),
                Err(_) => {
                    return HttpResponse::BadRequest()
                        .json(BaseResponse::error("Invalid og_image_uuid format"));
                }
            },
            None => None,
        };

        let twitter_image_uuid = match &body.twitter_image_uuid {
            Some(s) if s.is_empty() => Some(None),
            Some(s) => match Uuid::parse_str(s) {
                Ok(uuid) => Some(Some(uuid)),
                Err(_) => {
                    return HttpResponse::BadRequest()
                        .json(BaseResponse::error("Invalid twitter_image_uuid format"));
                }
            },
            None => None,
        };

        // Build update params
        let params = seo_mutations::UpdatePageSeoParams {
            title: body.title.clone(),
            description: body.description.clone(),
            keywords: body.keywords.clone(),
            og_title: body.og_title.clone(),
            og_description: body.og_description.clone(),
            og_image_uuid: og_image_uuid.unwrap_or(None),
            og_type: body.og_type.clone(),
            twitter_card: body.twitter_card.clone(),
            twitter_title: body.twitter_title.clone(),
            twitter_description: body.twitter_description.clone(),
            twitter_image_uuid: twitter_image_uuid.unwrap_or(None),
            canonical_url: body.canonical_url.clone(),
            robots: body.robots.clone(),
            structured_data: body.structured_data.clone(),
            custom_meta: body.custom_meta.clone(),
            is_active: body.is_active,
        };

        match seo_mutations::update_by_route(&db, &route_name, &params).await {
            Ok(_) => {
                info!("SEO updated for route: {}", route_name);
                HttpResponse::Ok().json(BaseResponse::success("SEO updated successfully"))
            }
            Err(e) => {
                error!("Failed to update SEO for route {}: {}", route_name, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update SEO"))
            }
        }
    }

    /// PATCH /api/v1/admin/seo/{route_name}/toggle - Toggle active status
    pub async fn seo_toggle_active(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<String>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let route_name = path.into_inner();
        let db = state.db.lock().await;

        match seo_mutations::toggle_active(&db, &route_name).await {
            Ok(new_status) => {
                info!("SEO active status toggled for {}: {}", route_name, new_status);
                HttpResponse::Ok().json(serde_json::json!({
                    "success": true,
                    "message": "Active status toggled",
                    "is_active": new_status
                }))
            }
            Err(e) => {
                error!("Failed to toggle SEO active for {}: {}", route_name, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to toggle active status"))
            }
        }
    }

    // ============================================
    // Schema Endpoints
    // ============================================

    /// GET /api/v1/admin/seo/page/{id}/schemas - Get all schemas for a page
    pub async fn schema_list(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let page_seo_id = path.into_inner();
        let db = state.db.lock().await;

        match schema_read::get_by_page_seo_id(&db, page_seo_id).await {
            Ok(schemas) => {
                let items: Vec<SchemaDto> = schemas
                    .into_iter()
                    .map(|s| SchemaDto {
                        id: s.id,
                        page_seo_id: s.page_seo_id,
                        schema_type: s.schema_type,
                        schema_data: s.schema_data,
                        position: s.position,
                        is_active: s.is_active,
                    })
                    .collect();

                HttpResponse::Ok().json(SchemaListResponse {
                    base: BaseResponse::success("Schemas retrieved"),
                    schemas: items,
                })
            }
            Err(e) => {
                error!("Failed to get schemas for page {}: {}", page_seo_id, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to retrieve schemas"))
            }
        }
    }

    /// POST /api/v1/admin/seo/page/{id}/schemas - Create a new schema for a page
    pub async fn schema_create(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
        body: web::Json<CreateSchemaRequest>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let page_seo_id = path.into_inner();
        let db = state.db.lock().await;

        // Check if page exists
        match seo_read::get_by_id(&db, page_seo_id).await {
            Ok(_) => {}
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("Page not found"));
            }
        }

        let params = schema_mutations::CreatePageSchemaParams {
            page_seo_id,
            schema_type: body.schema_type.clone(),
            schema_data: body.schema_data.clone(),
            position: body.position,
            is_active: body.is_active,
        };

        match schema_mutations::create(&db, &params).await {
            Ok(id) => {
                info!("Schema created: {} for page {}", id, page_seo_id);

                // Fetch the created schema to return
                match schema_read::get_by_id(&db, id).await {
                    Ok(schema) => HttpResponse::Created().json(SchemaResponse {
                        base: BaseResponse::success("Schema created successfully"),
                        schema: SchemaDto {
                            id: schema.id,
                            page_seo_id: schema.page_seo_id,
                            schema_type: schema.schema_type,
                            schema_data: schema.schema_data,
                            position: schema.position,
                            is_active: schema.is_active,
                        },
                    }),
                    Err(_) => HttpResponse::Created().json(serde_json::json!({
                        "success": true,
                        "message": "Schema created successfully",
                        "id": id
                    })),
                }
            }
            Err(e) => {
                error!("Failed to create schema: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to save schema"))
            }
        }
    }

    /// PUT /api/v1/admin/seo/schema/{id} - Update a schema
    pub async fn schema_update(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
        body: web::Json<UpdateSchemaRequest>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let schema_id = path.into_inner();
        let db = state.db.lock().await;

        // Check if schema exists
        if !schema_read::exists(&db, schema_id).await {
            return HttpResponse::NotFound().json(BaseResponse::error("Schema not found"));
        }

        let params = schema_mutations::UpdatePageSchemaParams {
            schema_type: body.schema_type.clone(),
            schema_data: body.schema_data.clone(),
            position: body.position,
            is_active: body.is_active,
        };

        match schema_mutations::update(&db, schema_id, &params).await {
            Ok(_) => {
                info!("Schema updated: {}", schema_id);

                // Fetch updated schema
                match schema_read::get_by_id(&db, schema_id).await {
                    Ok(schema) => HttpResponse::Ok().json(SchemaResponse {
                        base: BaseResponse::success("Schema updated successfully"),
                        schema: SchemaDto {
                            id: schema.id,
                            page_seo_id: schema.page_seo_id,
                            schema_type: schema.schema_type,
                            schema_data: schema.schema_data,
                            position: schema.position,
                            is_active: schema.is_active,
                        },
                    }),
                    Err(_) => {
                        HttpResponse::Ok().json(BaseResponse::success("Schema updated successfully"))
                    }
                }
            }
            Err(e) => {
                error!("Failed to update schema {}: {}", schema_id, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update schema"))
            }
        }
    }

    /// DELETE /api/v1/admin/seo/schema/{id} - Delete a schema
    pub async fn schema_delete(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let schema_id = path.into_inner();
        let db = state.db.lock().await;

        match schema_mutations::delete(&db, schema_id).await {
            Ok(deleted) => {
                if deleted {
                    info!("Schema deleted: {}", schema_id);
                    HttpResponse::Ok().json(BaseResponse::success("Schema deleted successfully"))
                } else {
                    HttpResponse::NotFound().json(BaseResponse::error("Schema not found"))
                }
            }
            Err(e) => {
                error!("Failed to delete schema {}: {}", schema_id, e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete schema"))
            }
        }
    }

    /// GET /api/v1/admin/seo/schema/{id} - Get a single schema
    pub async fn schema_get(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        // Check admin permission
        if let Some(response) = Self::check_admin_permission(&req) {
            return response;
        }

        let schema_id = path.into_inner();
        let db = state.db.lock().await;

        match schema_read::get_by_id(&db, schema_id).await {
            Ok(schema) => HttpResponse::Ok().json(SchemaResponse {
                base: BaseResponse::success("Schema retrieved"),
                schema: SchemaDto {
                    id: schema.id,
                    page_seo_id: schema.page_seo_id,
                    schema_type: schema.schema_type,
                    schema_data: schema.schema_data,
                    position: schema.position,
                    is_active: schema.is_active,
                },
            }),
            Err(e) => {
                error!("Failed to get schema {}: {}", schema_id, e);
                HttpResponse::NotFound().json(BaseResponse::error("Schema not found"))
            }
        }
    }
}
