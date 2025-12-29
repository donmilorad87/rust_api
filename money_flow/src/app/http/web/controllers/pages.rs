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

use crate::bootstrap::utility::auth::is_logged;
use crate::bootstrap::utility::template::{
    get_assets_version, get_images_version, register_template_functions,
};
use crate::database::read::user as db_user;
use crate::database::AppState;
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
const THEME_COOKIE_NAME: &str = "moneyflow_theme";

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
        context.insert("app_name", "MoneyFlow");
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
    pub async fn homepage(req: HttpRequest) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        let mut context = Self::base_context(&req);

        if auth.is_logged {
            context.insert("template_type", "logged");
        } else {
            context.insert("template_type", "guest");
        }

        Ok(Self::render("homepage.html", &context))
    }

    /// Sign Up page - redirects to profile if logged in
    pub async fn sign_up(req: HttpRequest) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if auth.is_logged {
            return Ok(Self::redirect("/profile"));
        }

        let context = Self::base_context(&req);
        Ok(Self::render("sign_up.html", &context))
    }

    /// Sign In page - redirects to profile if logged in
    pub async fn sign_in(req: HttpRequest) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if auth.is_logged {
            return Ok(Self::redirect("/profile"));
        }

        let context = Self::base_context(&req);
        Ok(Self::render("sign_in.html", &context))
    }

    /// Forgot Password page - redirects to profile if logged in
    pub async fn forgot_password(req: HttpRequest) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if auth.is_logged {
            return Ok(Self::redirect("/profile"));
        }

        let context = Self::base_context(&req);
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

        // Fetch user data if we have a user_id
        if let Some(user_id) = auth.user_id {
            let db = state.db.lock().await;
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                // Get avatar URL from asset record if user has an avatar
                let avatar_url = if let Some(avatar_uuid) = user.avatar_uuid {
                    // Avatar assets are served via API endpoint (private storage)
                    Some(format!("/api/v1/avatar/{}", avatar_uuid))
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
    pub async fn uploads(req: HttpRequest) -> Result<HttpResponse> {
        let auth = is_logged(&req);

        // Must be logged in
        if !auth.is_logged {
            return Ok(Self::redirect("/sign-in"));
        }

        // Must have admin permissions (>= 10)
        if !auth.is_admin() {
            return Ok(Self::redirect("/"));
        }

        let context = Self::base_context(&req);
        Ok(Self::render("uploads.html", &context))
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

        let context = Self::base_context(&req);

        // We don't load user data server-side since JavaScript fetches via API
        // This avoids code duplication and keeps data fresh

        Ok(Self::render("registered_users.html", &context))
    }

    /// 404 Not Found page
    pub async fn not_found(req: HttpRequest) -> Result<HttpResponse> {
        let context = Self::base_context(&req);
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
