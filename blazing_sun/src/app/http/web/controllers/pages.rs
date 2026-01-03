//! Pages Controller
//!
//! Handles web page rendering using Tera templates.
//!
//! ## Named Routes in Templates
//!
//! Use the `route()` function to generate URLs from route names:
//!
//! ```html
//! <a href="{{ route(name='web.sign_up') }}">Sign Up</a>
//! <a href="{{ route(name='user.show', id=user.id) }}">View Profile</a>
//! ```
//!
//! See `bootstrap/utility/template.rs` for available routes and documentation.

use crate::app::db_query::read::page_schema as db_page_schema;
use crate::app::db_query::read::page_seo as db_page_seo;
use crate::bootstrap::utility::auth::is_logged;
use crate::bootstrap::utility::template::{
    get_assets_version, get_images_version, register_template_functions,
};
use crate::database::read::site_config as db_site_config;
use crate::database::read::user as db_user;
use crate::database::AppState;
use sqlx::{Pool, Postgres};
use actix_web::{web, HttpRequest, HttpResponse, Result};
use once_cell::sync::Lazy;
use serde::Serialize;
use tera::{Context, Tera};
use tracing::error;

/// Initialize Tera template engine with all web templates
///
/// This registers custom functions including:
/// - `route(name, ...)` - Generate URLs from named routes
static WEB_TEMPLATES: Lazy<Tera> = Lazy::new(|| {
    // Load only from views/web directory
    let template_pattern = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/resources/views/web/**/*.html"
    );

    let mut tera = match Tera::new(template_pattern) {
        Ok(t) => t,
        Err(e) => {
            panic!("Failed to initialize web templates: {}", e);
        }
    };

    // Register custom template functions (route(), etc.)
    register_template_functions(&mut tera);

    tera.autoescape_on(vec![".html"]);
    tera
});

/// Pages controller for rendering web pages
pub struct PagesController;

/// Theme cookie name (must match JavaScript ThemeManager)
const THEME_COOKIE_NAME: &str = "blazing_sun_theme";

/// User data for template context
#[derive(Serialize)]
struct TemplateUser {
    id: i64,
    email: String,
    first_name: String,
    last_name: String,
    avatar_url: Option<String>,
}

impl PagesController {
    /// Get the base URL from the request
    fn get_base_url(req: &HttpRequest) -> String {
        let conn_info = req.connection_info();
        format!("{}://{}", conn_info.scheme(), conn_info.host())
    }

    /// Get theme from cookie
    /// Returns "dark" or "light" (defaults to "light" if not set)
    fn get_theme(req: &HttpRequest) -> String {
        req.cookie(THEME_COOKIE_NAME)
            .map(|c| c.value().to_string())
            .filter(|v| v == "dark" || v == "light")
            .unwrap_or_else(|| "light".to_string())
    }

    /// Create base context with common variables and auth info
    fn base_context(req: &HttpRequest) -> Context {
        let auth = is_logged(req);

        let mut context = Context::new();
        context.insert("base_url", &Self::get_base_url(req));
        context.insert("year", &chrono::Utc::now().format("%Y").to_string());
        context.insert("app_name", "Blazing Sun");
        context.insert("is_logged", &auth.is_logged);
        // Admin permission flags for navigation
        context.insert("is_admin", &auth.is_admin());
        context.insert("is_super_admin", &auth.is_super_admin());
        // Theme from cookie (server-side rendering)
        context.insert("theme", &Self::get_theme(req));
        // Asset versioning for cache busting
        context.insert("assets_version", get_assets_version());
        context.insert("images_version", get_images_version());
        if let Some(user_id) = auth.user_id {
            context.insert("user_id", &user_id);
        }
        context
    }

    /// Add branding info (logo, favicon, site identity) to template context
    /// Uses ID-based asset rendering - automatically determines public/private from database
    async fn add_branding_to_context(context: &mut Context, db: &Pool<Postgres>) {
        if let Ok(branding) = db_site_config::get_branding(db).await {
            // Site identity (name, visibility, colors, size)
            context.insert("site_name", &branding.site_name);
            context.insert("show_site_name", &branding.show_site_name);
            context.insert("identity_color_start", &branding.identity_color_start);
            context.insert("identity_color_end", &branding.identity_color_end);
            context.insert("identity_size", &branding.identity_size);
            // Override app_name with site_name from database
            context.insert("app_name", &branding.site_name);

            // Logo - use ID-based asset rendering (unified approach)
            // Automatically determines public/private from database storage_type
            if let Some(logo_id) = branding.logo_id {
                use crate::bootstrap::utility::template::asset_by_id;
                // Use medium variant for logo (768px) for good quality on most screens
                if let Some(logo_url) = asset_by_id(db, logo_id, Some("medium")).await {
                    context.insert("logo_url", &logo_url);
                }
            }

            // Favicon - use ID-based asset rendering (unified approach)
            // Automatically determines public/private from database storage_type
            if let Some(favicon_id) = branding.favicon_id {
                use crate::bootstrap::utility::template::asset_by_id;
                // Use small variant for favicon (320px) suitable for browser tabs
                if let Some(favicon_url) = asset_by_id(db, favicon_id, Some("small")).await {
                    context.insert("favicon_url", &favicon_url);
                }
            }
        }
    }

    /// Add SEO meta and JSON-LD schemas to template context
    /// Fetches page_seo by route_name and associated active schemas
    async fn add_seo_to_context(context: &mut Context, db: &Pool<Postgres>, route_name: &str) {
        // Fetch SEO meta for this page
        if let Ok(seo) = db_page_seo::get_meta_by_route(db, route_name).await {
            // Basic meta tags
            if let Some(ref title) = seo.title {
                context.insert("seo_title", title);
            }
            if let Some(ref description) = seo.description {
                context.insert("seo_description", description);
            }
            if let Some(ref keywords) = seo.keywords {
                context.insert("seo_keywords", keywords);
            }
            if let Some(ref robots) = seo.robots {
                context.insert("seo_robots", robots);
            }
            if let Some(ref canonical) = seo.canonical_url {
                context.insert("seo_canonical", canonical);
            }

            // Open Graph
            if let Some(ref og_title) = seo.og_title {
                context.insert("og_title", og_title);
            }
            if let Some(ref og_desc) = seo.og_description {
                context.insert("og_description", og_desc);
            }
            if let Some(ref og_type) = seo.og_type {
                context.insert("og_type", og_type);
            }

            // Twitter Card
            if let Some(ref twitter_card) = seo.twitter_card {
                context.insert("twitter_card", twitter_card);
            }
            if let Some(ref twitter_title) = seo.twitter_title {
                context.insert("twitter_title", twitter_title);
            }
            if let Some(ref twitter_desc) = seo.twitter_description {
                context.insert("twitter_description", twitter_desc);
            }
        }

        // Fetch page_seo ID to get schemas
        if let Ok(page_seo) = db_page_seo::get_by_route(db, route_name).await {
            // Fetch active schemas for this page
            if let Ok(schemas) = db_page_schema::get_active_by_page_seo_id(db, page_seo.id).await {
                // Build JSON-LD array
                let json_ld_schemas: Vec<serde_json::Value> = schemas
                    .into_iter()
                    .map(|s| {
                        let mut schema = s.schema_data;
                        // Ensure @context and @type are set
                        if let serde_json::Value::Object(ref mut map) = schema {
                            map.insert(
                                "@context".to_string(),
                                serde_json::Value::String("https://schema.org".to_string()),
                            );
                            if !map.contains_key("@type") {
                                map.insert(
                                    "@type".to_string(),
                                    serde_json::Value::String(s.schema_type),
                                );
                            }
                        }
                        schema
                    })
                    .collect();

                if !json_ld_schemas.is_empty() {
                    // Serialize to JSON string for safe embedding in template
                    if let Ok(json_str) = serde_json::to_string(&json_ld_schemas) {
                        context.insert("json_ld_schemas", &json_str);
                    }
                }
            }
        }
    }

    /// Redirect response
    fn redirect(location: &str) -> HttpResponse {
        HttpResponse::Found()
            .insert_header(("Location", location))
            .finish()
    }

    /// Render a template with the given context
    fn render(template: &str, context: &Context) -> HttpResponse {
        match WEB_TEMPLATES.render(template, context) {
            Ok(html) => HttpResponse::Ok().content_type("text/html").body(html),
            Err(e) => {
                error!("Template rendering error: {}", e);
                HttpResponse::InternalServerError()
                    .content_type("text/html")
                    .body(format!(
                        "<h1>500 - Internal Server Error</h1><p>Template error: {}</p>",
                        e
                    ))
            }
        }
    }

    /// Homepage - shows different content for logged/guest users
    pub async fn homepage(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        let mut context = Self::base_context(&req);

        // Add branding (logo, favicon, site name)
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&mut context, &db, "web.home").await;
        drop(db);

        if auth.is_logged {
            context.insert("template_type", "logged");
        } else {
            context.insert("template_type", "guest");
        }

        Ok(Self::render("homepage.html", &context))
    }

    /// Sign Up page - redirects to profile if logged in
    pub async fn sign_up(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if auth.is_logged {
            return Ok(Self::redirect("/profile"));
        }

        let mut context = Self::base_context(&req);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&mut context, &db, "web.sign_up").await;
        drop(db);

        Ok(Self::render("sign_up.html", &context))
    }

    /// Sign In page - redirects to profile if logged in
    pub async fn sign_in(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if auth.is_logged {
            return Ok(Self::redirect("/profile"));
        }

        let mut context = Self::base_context(&req);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&mut context, &db, "web.sign_in").await;
        drop(db);

        Ok(Self::render("sign_in.html", &context))
    }

    /// Forgot Password page - redirects to profile if logged in
    pub async fn forgot_password(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if auth.is_logged {
            return Ok(Self::redirect("/profile"));
        }

        let mut context = Self::base_context(&req);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&mut context, &db, "web.forgot_password").await;
        drop(db);

        Ok(Self::render("forgot_password.html", &context))
    }

    /// Profile page - redirects to sign-in if not logged in
    pub async fn profile(
        req: HttpRequest,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if !auth.is_logged {
            return Ok(Self::redirect("/sign-in"));
        }

        let mut context = Self::base_context(&req);
        let db = state.db.lock().await;

        // Add branding (logo, favicon, site name)
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&mut context, &db, "web.profile").await;

        // Fetch user data if we have a user_id
        if let Some(user_id) = auth.user_id {
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                // Get avatar URL using dedicated avatar endpoint
                // This works regardless of storage_type (public/private)
                let avatar_url = if let Some(avatar_id) = user.avatar_id {
                    use crate::bootstrap::utility::template::avatar_by_id;
                    // Use small variant (320px) for profile picture display
                    avatar_by_id(&db, avatar_id, Some("small")).await
                } else {
                    None
                };

                let template_user = TemplateUser {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    avatar_url,
                };
                context.insert("user", &template_user);
            }
        }
        drop(db);

        Ok(Self::render("profile.html", &context))
    }

    /// Logout - clears auth cookie and redirects to homepage
    pub async fn logout(_req: HttpRequest) -> Result<HttpResponse> {
        use actix_web::cookie::{Cookie, time::Duration};

        // Create an expired cookie to clear the auth token
        let cookie = Cookie::build("auth_token", "")
            .path("/")
            .max_age(Duration::seconds(0))
            .http_only(true)
            .finish();

        Ok(HttpResponse::Found()
            .cookie(cookie)
            .insert_header(("Location", "/"))
            .finish())
    }

    /// Uploads Admin page - requires Admin+ permissions
    pub async fn uploads(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect("/sign-in"));
        }

        // Must have admin permissions (>= 10)
        if !auth.is_admin() {
            return Ok(Self::redirect("/"));
        }

        let mut context = Self::base_context(&req);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&mut context, &db, "admin.uploads").await;
        drop(db);

        Ok(Self::render("uploads.html", &context))
    }

    /// Theme Configuration Admin page - requires Admin+ permissions
    pub async fn theme(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect("/sign-in"));
        }

        // Must have admin permissions (>= 10)
        if !auth.is_admin() {
            return Ok(Self::redirect("/"));
        }

        let mut context = Self::base_context(&req);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&mut context, &db, "admin.theme").await;
        drop(db);

        Ok(Self::render("admin_theme.html", &context))
    }

    /// Registered Users Admin page - requires Super Admin permissions
    pub async fn registered_users(
        req: HttpRequest,
        state: web::Data<AppState>,
    ) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect("/sign-in"));
        }

        // Must have super admin permissions (>= 100)
        if !auth.is_super_admin() {
            return Ok(Self::redirect("/"));
        }

        let mut context = Self::base_context(&req);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&mut context, &db, "admin.users").await;
        drop(db);

        // We don't load user data server-side since JavaScript fetches via API
        // This avoids code duplication and keeps data fresh

        Ok(Self::render("registered_users.html", &context))
    }

    /// Galleries page - requires authentication
    pub async fn galleries(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect("/sign-in"));
        }

        let mut context = Self::base_context(&req);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        Self::add_seo_to_context(&mut context, &db, "web.galleries").await;
        drop(db);

        // JavaScript will fetch galleries via API
        Ok(Self::render("galleries.html", &context))
    }

    /// 404 Not Found page
    pub async fn not_found(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
        let mut context = Self::base_context(&req);
        let db = state.db.lock().await;
        Self::add_branding_to_context(&mut context, &db).await;
        drop(db);

        Ok(Self::render_with_status("404.html", &context, actix_web::http::StatusCode::NOT_FOUND))
    }

    /// Render a template with a custom status code
    fn render_with_status(template: &str, context: &Context, status: actix_web::http::StatusCode) -> HttpResponse {
        match WEB_TEMPLATES.render(template, context) {
            Ok(html) => HttpResponse::build(status)
                .content_type("text/html")
                .body(html),
            Err(e) => {
                error!("Template rendering error: {}", e);
                HttpResponse::InternalServerError()
                    .content_type("text/html")
                    .body(format!(
                        "<h1>500 - Internal Server Error</h1><p>Template error: {}</p>",
                        e
                    ))
            }
        }
    }
}
