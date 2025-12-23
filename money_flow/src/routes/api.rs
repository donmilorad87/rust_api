//! API Routes
//!
//! This file defines all API routes for the application.
//! Routes are registered in a Laravel-style syntax.
//!
//! # Example
//! ```rust
//! // Register route with name
//! route!("auth.sign_up", "/api/v1/auth/sign-up");
//!
//! // Use route URL by name
//! let url = route_url("auth.sign_up", None);
//! ```

use actix_web::{middleware::from_fn, web};

use crate::app::http::controllers::activation::ActivationController;
use crate::app::http::controllers::auth::AuthController;
use crate::app::http::controllers::user::UserController;
use crate::middleware;
use crate::route;

/// Register all API routes
///
/// This function is called from the main application configuration
/// to register all API routes with the Actix-web server.
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
            // POST /activate-account - Activate account with code
            .route(
                "/activate-account",
                web::post().to(ActivationController::activate_account),
            )
            // POST /forgot-password - Request password reset
            .route(
                "/forgot-password",
                web::post().to(ActivationController::forgot_password),
            )
            // POST /verify-hash - Verify hash code and get token
            .route(
                "/verify-hash",
                web::post().to(ActivationController::verify_hash),
            )
            // POST /reset-password - Reset password with token
            .route(
                "/reset-password",
                web::post().to(ActivationController::reset_password),
            )
            // GET /set-password-when-needed - Verify password setup link
            .route(
                "/set-password-when-needed",
                web::get().to(ActivationController::verify_set_password_link),
            )
            // POST /set-password-when-needed - Set password for admin-created users
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
            // POST /change-password - Request password change
            .route(
                "/change-password",
                web::post().to(ActivationController::request_change_password),
            )
            // POST /verify-password-change - Verify and complete password change
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
            // GET /user - Get current user from JWT
            .route("", web::get().to(UserController::get_current))
            // GET /user/{id} - Get user by ID
            .route("/{id}", web::get().to(UserController::get_by_id))
            // PATCH /user - Full update (first_name, last_name required; balance, password optional)
            .route("", web::patch().to(UserController::update_partial))
            // PUT /user - Partial update (at least one field required)
            .route("", web::put().to(UserController::update_full))
            // POST /user - Admin create user
            .route("", web::post().to(UserController::admin_create))
            // DELETE /user/{id} - Delete user
            .route("/{id}", web::delete().to(UserController::delete)),
    );
}

/// Register all route names for URL generation
fn register_route_names() {
    route!("auth.sign_up", "/api/v1/auth/sign-up");
    route!("auth.sign_in", "/api/v1/auth/sign-in");
    route!("account.activate", "/api/v1/account/activate-account");
    route!("account.forgot_password", "/api/v1/account/forgot-password");
    route!("account.verify_hash", "/api/v1/account/verify-hash");
    route!("account.reset_password", "/api/v1/account/reset-password");
    route!(
        "account.set_password_when_needed",
        "/api/v1/account/set-password-when-needed"
    );
    route!("password.change", "/api/v1/password/change-password");
    route!(
        "password.verify_change",
        "/api/v1/password/verify-password-change"
    );
    route!("user.current", "/api/v1/user");
    route!("user.show", "/api/v1/user/{id}");
    route!("user.update_full", "/api/v1/user");
    route!("user.update_partial", "/api/v1/user");
    route!("user.admin_create", "/api/v1/user");
    route!("user.delete", "/api/v1/user/{id}");
}

/// Get route URL by name
///
/// # Example
/// ```rust
/// use crate::routes::api::route_url;
/// use std::collections::HashMap;
///
/// // Simple route
/// let url = route_url("auth.sign_up", None);
/// // Returns: Some("/api/v1/auth/sign-up")
///
/// // Route with parameters
/// let mut params = HashMap::new();
/// params.insert("id".to_string(), "123".to_string());
/// let url = route_url("users.show", Some(&params));
/// // Returns: Some("/api/v1/users/123")
/// ```
pub fn route_url(
    name: &str,
    params: Option<&std::collections::HashMap<String, String>>,
) -> Option<String> {
    crate::routes::route(name, params)
}
