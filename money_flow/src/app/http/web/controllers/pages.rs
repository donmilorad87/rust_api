//! Pages Controller
//!
//! Handles web page rendering using Tera templates.

use crate::bootstrap::utility::auth::is_logged;
use actix_web::{HttpRequest, HttpResponse, Result};
use once_cell::sync::Lazy;
use tera::{Context, Tera};
use tracing::error;

/// Initialize Tera template engine with all web templates
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

    tera.autoescape_on(vec![".html"]);
    tera
});

/// Pages controller for rendering web pages
pub struct PagesController;

impl PagesController {
    /// Get the base URL from the request
    fn get_base_url(req: &HttpRequest) -> String {
        let conn_info = req.connection_info();
        format!("{}://{}", conn_info.scheme(), conn_info.host())
    }

    /// Create base context with common variables and auth info
    fn base_context(req: &HttpRequest) -> Context {
        let auth = is_logged(req);

        let mut context = Context::new();
        context.insert("base_url", &Self::get_base_url(req));
        context.insert("year", &chrono::Utc::now().format("%Y").to_string());
        context.insert("app_name", "MoneyFlow");
        context.insert("is_logged", &auth.is_logged);
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
    pub async fn profile(req: HttpRequest) -> Result<HttpResponse> {
        let auth = is_logged(&req);
        if !auth.is_logged {
            return Ok(Self::redirect("/sign-in"));
        }

        let context = Self::base_context(&req);
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
}
