//!
//! API Routes
//!
//! This file defines all API routes for the application.
//!

use actix_web::{middleware::from_fn, web};

use crate::app::http::api::controllers::activation::ActivationController;
use crate::app::http::api::controllers::admin::AdminController;
use crate::app::http::api::controllers::auth::AuthController;
use crate::app::http::api::controllers::email::EmailController;
use crate::app::http::api::controllers::{gallery, picture};
use crate::app::http::api::controllers::theme::ThemeController;
use crate::app::http::api::controllers::upload::UploadController;
use crate::app::http::api::controllers::user::UserController;
use crate::middleware;
use crate::middleware::permission::{levels, require_permission};
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
                web::post().to(ActivationController::change_password_direct),
            )
            .route(
                "/verify-password-change",
                web::post().to(ActivationController::verify_and_change_password),
            ),
    );

    // ============================================
    // Email Change Routes (Protected - requires JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/email")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route(
                "/request-change",
                web::post().to(EmailController::request_change),
            )
            .route(
                "/verify-old-email",
                web::post().to(EmailController::verify_old_email),
            )
            .route(
                "/verify-new-email",
                web::post().to(EmailController::verify_new_email),
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
            .route("/avatar", web::patch().to(UserController::update_avatar))
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
            // Avatar/profile picture routes (requires auth)
            .route("/avatar", web::post().to(UploadController::upload_avatar))
            .route("/avatar", web::delete().to(UploadController::delete_avatar))
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

    // ============================================
    // Avatar Download (Protected - requires JWT)
    // User can only access their own avatar
    // ============================================
    cfg.service(
        web::scope("/api/v1/avatar")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route("/{uuid}", web::get().to(UploadController::get_avatar)),
    );

    // ============================================
    // Admin Routes (Protected - requires JWT + permissions)
    // Note: Using separate scopes with specific paths to avoid routing conflicts
    // ============================================

    // Theme routes (Admin+ permission = 10 or 100)
    // NOTE: Actix middleware order is REVERSED - last .wrap() runs first!
    cfg.service(
        web::scope("/api/v1/admin/theme")
            .wrap(from_fn(require_permission(levels::ADMIN))) // Runs second (checks permissions)
            .wrap(from_fn(middleware::auth::verify_jwt))      // Runs first (extracts permissions)
            .route("", web::get().to(ThemeController::get))
            .route("", web::put().to(ThemeController::update))
            .route("/branding", web::put().to(ThemeController::update_branding))
            .route("/build", web::post().to(ThemeController::trigger_build))
            .route("/build/status", web::get().to(ThemeController::build_status)),
    );

    // ============================================
    // Gallery Routes (Protected - requires JWT)
    // ============================================
    cfg.service(
        web::scope("/api/v1/galleries")
            .wrap(from_fn(middleware::auth::verify_jwt))
            .route("", web::get().to(gallery::get_user_galleries))
            .route("", web::post().to(gallery::create_gallery))
            .route("/reorder", web::post().to(gallery::reorder_galleries))
            .route("/{id}", web::get().to(gallery::get_gallery))
            .route("/{id}", web::put().to(gallery::update_gallery))
            .route("/{id}", web::delete().to(gallery::delete_gallery))
            // Picture routes within gallery
            .route("/{id}/pictures", web::get().to(picture::get_gallery_pictures))
            .route("/{id}/pictures", web::post().to(picture::add_picture))
            .route("/{id}/pictures/reorder", web::post().to(picture::reorder_pictures))
            .route("/{gallery_id}/pictures/{picture_id}", web::put().to(picture::update_picture))
            .route("/{gallery_id}/pictures/{picture_id}", web::delete().to(picture::remove_picture)),
    );

    // SEO routes (Admin+ permission = 10 or 100)
    // NOTE: Actix middleware order is REVERSED - last .wrap() runs first!
    cfg.service(
        web::scope("/api/v1/admin/seo")
            .wrap(from_fn(require_permission(levels::ADMIN))) // Runs second (checks permissions)
            .wrap(from_fn(middleware::auth::verify_jwt))      // Runs first (extracts permissions)
            // Page SEO routes
            .route("", web::get().to(ThemeController::seo_list))
            .route("/{route_name}", web::get().to(ThemeController::seo_get))
            .route("/{route_name}", web::put().to(ThemeController::seo_update))
            .route("/{route_name}/toggle", web::patch().to(ThemeController::seo_toggle_active))
            // Schema routes (for structured data)
            .route("/page/{id}/schemas", web::get().to(ThemeController::schema_list))
            .route("/page/{id}/schemas", web::post().to(ThemeController::schema_create))
            .route("/schema/{id}", web::get().to(ThemeController::schema_get))
            .route("/schema/{id}", web::put().to(ThemeController::schema_update))
            .route("/schema/{id}", web::delete().to(ThemeController::schema_delete)),
    );

    // Super Admin routes (permission = 100) - must be registered before Admin routes
    // to ensure /users is matched before /users/{id}/avatar
    // NOTE: Actix middleware order is REVERSED - last .wrap() runs first!
    // So we need: verify_jwt THEN require_permission
    cfg.service(
        web::scope("/api/v1/admin/users")
            .wrap(from_fn(require_permission(levels::SUPER_ADMIN))) // Runs second (checks permissions)
            .wrap(from_fn(middleware::auth::verify_jwt))            // Runs first (extracts permissions)
            .route("", web::get().to(AdminController::list_users))
            .route(
                "/{id}/permissions",
                web::patch().to(AdminController::update_user_permissions),
            ),
    );

    // Admin routes (permission = 10 or 100)
    // NOTE: Actix middleware order is REVERSED - last .wrap() runs first!
    cfg.service(
        web::scope("/api/v1/admin")
            .wrap(from_fn(require_permission(levels::ADMIN))) // Runs second (checks permissions)
            .wrap(from_fn(middleware::auth::verify_jwt))      // Runs first (extracts permissions)
            .route("/uploads", web::get().to(AdminController::list_uploads))
            .route(
                "/uploads/{uuid}/metadata",
                web::patch().to(AdminController::update_upload_metadata),
            )
            .route("/assets", web::get().to(AdminController::list_assets))
            .route(
                "/users/{id}/avatar",
                web::delete().to(AdminController::delete_user_avatar),
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
    route!("user.avatar", "/api/v1/user/avatar");
    route!("user.delete", "/api/v1/user/{id}");

    // Gallery routes
    route!("galleries.list", "/api/v1/galleries");
    route!("galleries.create", "/api/v1/galleries");
    route!("galleries.reorder", "/api/v1/galleries/reorder");
    route!("galleries.show", "/api/v1/galleries/{id}");
    route!("galleries.update", "/api/v1/galleries/{id}");
    route!("galleries.delete", "/api/v1/galleries/{id}");

    // Picture routes
    route!("pictures.list", "/api/v1/galleries/{id}/pictures");
    route!("pictures.add", "/api/v1/galleries/{id}/pictures");
    route!("pictures.reorder", "/api/v1/galleries/{id}/pictures/reorder");
    route!("pictures.update", "/api/v1/galleries/{gallery_id}/pictures/{picture_id}");
    route!("pictures.remove", "/api/v1/galleries/{gallery_id}/pictures/{picture_id}");

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

    // Avatar routes
    route!("upload.avatar", "/api/v1/upload/avatar");
    route!("upload.avatar.delete", "/api/v1/upload/avatar");
    route!("avatar.get", "/api/v1/avatar/{uuid}");

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

    // Admin routes (permission protected)
    route!("admin.uploads", "/api/v1/admin/uploads");
    route!(
        "admin.uploads.update_metadata",
        "/api/v1/admin/uploads/{uuid}/metadata"
    );
    route!("admin.assets", "/api/v1/admin/assets");
    route!("admin.users", "/api/v1/admin/users");
    route!("admin.delete_user_avatar", "/api/v1/admin/users/{id}/avatar");
    route!(
        "admin.update_user_permissions",
        "/api/v1/admin/users/{id}/permissions"
    );

    // Theme routes (Admin+ permission)
    route!("admin.theme", "/api/v1/admin/theme");
    route!("admin.theme.update", "/api/v1/admin/theme");
    route!("admin.theme.branding", "/api/v1/admin/theme/branding");
    route!("admin.theme.build", "/api/v1/admin/theme/build");
    route!("admin.theme.build_status", "/api/v1/admin/theme/build/status");

    // SEO routes (Admin+ permission)
    route!("admin.seo.list", "/api/v1/admin/seo");
    route!("admin.seo.get", "/api/v1/admin/seo/{route_name}");
    route!("admin.seo.update", "/api/v1/admin/seo/{route_name}");
    route!("admin.seo.toggle", "/api/v1/admin/seo/{route_name}/toggle");

    // Schema routes (Admin+ permission)
    route!("admin.seo.schema.list", "/api/v1/admin/seo/page/{id}/schemas");
    route!(
        "admin.seo.schema.create",
        "/api/v1/admin/seo/page/{id}/schemas"
    );
    route!("admin.seo.schema.get", "/api/v1/admin/seo/schema/{id}");
    route!("admin.seo.schema.update", "/api/v1/admin/seo/schema/{id}");
    route!("admin.seo.schema.delete", "/api/v1/admin/seo/schema/{id}");
}
