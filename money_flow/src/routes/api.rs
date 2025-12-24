//!
//! API Routes
//!
//! This file defines all API routes for the application.
//!

use actix_web::{middleware::from_fn, web};

use crate::app::http::api::controllers::activation::ActivationController;
use crate::app::http::api::controllers::auth::AuthController;
use crate::app::http::api::controllers::upload::UploadController;
use crate::app::http::api::controllers::user::UserController;
use crate::middleware;
use crate::route;

/// Register all API routes
pub fn register(cfg: &mut web::ServiceConfig) {
    // Register named routes for URL generation
    register_route_names();

    // ============================================
    // Authentication Routes (Public)
    // ============================================
    cfg.service(
        web::scope("/api/v1/auth")
            .route("/sign-up", web::post().to(AuthController::sign_up))
            .route("/sign-in", web::post().to(AuthController::sign_in)),
    );

    // ============================================
    // Account Activation & Password Reset Routes (Public)
    // ============================================
    cfg.service(
        web::scope("/api/v1/account")
            .route(
                "/activate-account",
                web::post().to(ActivationController::activate_account),
            )
            .route(
                "/forgot-password",
                web::post().to(ActivationController::forgot_password),
            )
            .route(
                "/verify-hash",
                web::post().to(ActivationController::verify_hash),
            )
            .route(
                "/reset-password",
                web::post().to(ActivationController::reset_password),
            )
            .route(
                "/set-password-when-needed",
                web::get().to(ActivationController::verify_set_password_link),
            )
            .route(
                "/set-password-when-needed",
                web::post().to(ActivationController::set_password_when_needed),
            ),
    );

    // ============================================
    // Password Change Routes (Protected - requires JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/password")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route(
                "/change-password",
                web::post().to(ActivationController::request_change_password),
            )
            .route(
                "/verify-password-change",
                web::post().to(ActivationController::verify_and_change_password),
            ),
    );

    // ============================================
    // User Routes (Protected - requires JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/user")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route("", web::get().to(UserController::get_current))
            .route("/{id}", web::get().to(UserController::get_by_id))
            .route("", web::patch().to(UserController::update_partial))
            .route("", web::put().to(UserController::update_full))
            .route("", web::post().to(UserController::admin_create))
            .route("/{id}", web::delete().to(UserController::delete)),
    );

    // ============================================
    // Upload Downloads (Public files - no auth required)
    // ============================================
    cfg.service(
        web::scope("/api/v1/upload/download")
            // Public file downloads (no auth)
            .route(
                "/public/{uuid}",
                web::get().to(UploadController::download_public),
            ),
    );

    // ============================================
    // Upload Routes (All uploads require JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/upload")
            .wrap(from_fn(middleware::auth::verify_jwt))
            // Upload public file (requires auth)
            .route("/public", web::post().to(UploadController::upload_public))
            // Upload private file (requires auth)
            .route("/private", web::post().to(UploadController::upload_private))
            // Upload multiple files (requires auth)
            .route(
                "/multiple",
                web::post().to(UploadController::upload_multiple),
            )
            // Download private file (requires auth)
            .route(
                "/private/{uuid}",
                web::get().to(UploadController::download_private),
            )
            // Delete upload (requires auth)
            .route("/{uuid}", web::delete().to(UploadController::delete))
            // Get user's uploads (requires auth)
            .route("/user", web::get().to(UploadController::get_user_uploads))
            // Chunked upload routes
            .route(
                "/chunked/start",
                web::post().to(UploadController::start_chunked_upload),
            )
            .route(
                "/chunked/{uuid}/chunk/{index}",
                web::post().to(UploadController::upload_chunk),
            )
            .route(
                "/chunked/{uuid}/complete",
                web::post().to(UploadController::complete_chunked_upload),
            )
            .route(
                "/chunked/{uuid}",
                web::delete().to(UploadController::cancel_chunked_upload),
            ),
    );
}

/// Register all route names for URL generation
fn register_route_names() {
    // Auth routes
    route!("auth.sign_up", "/api/v1/auth/sign-up");
    route!("auth.sign_in", "/api/v1/auth/sign-in");

    // Account routes
    route!("account.activate", "/api/v1/account/activate-account");
    route!("account.forgot_password", "/api/v1/account/forgot-password");
    route!("account.verify_hash", "/api/v1/account/verify-hash");
    route!("account.reset_password", "/api/v1/account/reset-password");
    route!(
        "account.set_password_when_needed",
        "/api/v1/account/set-password-when-needed"
    );

    // Password routes
    route!("password.change", "/api/v1/password/change-password");
    route!(
        "password.verify_change",
        "/api/v1/password/verify-password-change"
    );

    // User routes
    route!("user.current", "/api/v1/user");
    route!("user.show", "/api/v1/user/{id}");
    route!("user.update_full", "/api/v1/user");
    route!("user.update_partial", "/api/v1/user");
    route!("user.admin_create", "/api/v1/user");
    route!("user.delete", "/api/v1/user/{id}");

    // Upload routes (all require auth except public download)
    route!("upload.public", "/api/v1/upload/public");
    route!("upload.private", "/api/v1/upload/private");
    route!("upload.multiple", "/api/v1/upload/multiple");
    route!(
        "upload.download.public",
        "/api/v1/upload/download/public/{uuid}"
    );
    route!("upload.private.download", "/api/v1/upload/private/{uuid}");
    route!("upload.delete", "/api/v1/upload/{uuid}");
    route!("upload.user", "/api/v1/upload/user");

    // Chunked upload routes
    route!("upload.chunked.start", "/api/v1/upload/chunked/start");
    route!(
        "upload.chunked.chunk",
        "/api/v1/upload/chunked/{uuid}/chunk/{index}"
    );
    route!(
        "upload.chunked.complete",
        "/api/v1/upload/chunked/{uuid}/complete"
    );
    route!("upload.chunked.cancel", "/api/v1/upload/chunked/{uuid}");
}
