//!
//! Web Routes
//!
//! This file defines all web routes for the application.
//!

use actix_files::Files;
use actix_web::{web, Route};

use crate::app::http::web::controllers::pages::PagesController;
use crate::route;

/// Register all web routes
pub fn register(cfg: &mut web::ServiceConfig) {
    // Register named routes for URL generation
    register_route_names();

    // ============================================
    // Static Assets
    // ============================================
    cfg.service(
        Files::new(
            "/assets/js",
            concat!(env!("CARGO_MANIFEST_DIR"), "/src/resources/js"),
        )
        .show_files_listing(),
    );
    cfg.service(
        Files::new(
            "/assets/css",
            concat!(env!("CARGO_MANIFEST_DIR"), "/src/resources/css"),
        )
        .show_files_listing(),
    );

    // ============================================
    // Web Pages (Public)
    // ============================================
    cfg.route("/", web::get().to(PagesController::homepage));
    cfg.route("/sign-up", web::get().to(PagesController::sign_up));
    cfg.route("/sign-in", web::get().to(PagesController::sign_in));
    cfg.route(
        "/forgot-password",
        web::get().to(PagesController::forgot_password),
    );

    // ============================================
    // Web Pages (Authenticated)
    // ============================================
    cfg.route("/profile", web::get().to(PagesController::profile));
    cfg.route("/oauth/applications", web::get().to(PagesController::oauth_applications));
    cfg.route("/galleries", web::get().to(PagesController::galleries));
    cfg.route("/logout", web::get().to(PagesController::logout));

    // ============================================
    // Admin Pages (Permission Protected)
    // Routes named by MINIMUM permission required
    // Higher permissions inherit access (Super Admin can access Admin routes)
    // ============================================
    cfg.route(
        "/admin/uploads",
        web::get().to(PagesController::uploads),
    );
    cfg.route(
        "/admin/theme",
        web::get().to(PagesController::theme),
    );

    // ============================================
    // Super Admin Pages (Super Admin Only)
    // ============================================
    cfg.route(
        "/superadmin/users",
        web::get().to(PagesController::registered_users),
    );

    // ============================================
    // 404 Fallback (must be last)
    // ============================================
    cfg.default_service(Route::new().to(PagesController::not_found));
}

/// Register all web route names for URL generation
fn register_route_names() {
    route!("web.home", "/");
    route!("web.sign_up", "/sign-up");
    route!("web.sign_in", "/sign-in");
    route!("web.forgot_password", "/forgot-password");
    route!("web.profile", "/profile");
    route!("oauth.applications", "/oauth/applications");
    route!("web.galleries", "/galleries");
    route!("web.logout", "/logout");

    // Admin pages (Admin+ can access)
    route!("admin.uploads", "/admin/uploads");
    route!("admin.theme", "/admin/theme");

    // Super Admin pages (Super Admin only)
    route!("superadmin.users", "/superadmin/users");
}
