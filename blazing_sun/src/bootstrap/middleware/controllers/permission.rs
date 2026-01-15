//! Permission Middleware
//!
//! Provides permission-based access control for routes.
//!
//! ## Permission Levels
//! - 1: Basic (default for all users)
//! - 10: Admin (can view uploads, manage assets)
//! - 50: Affiliate (future affiliate features)
//! - 100: Super Admin (full access, can view all users)
//!
//! ## Usage
//! ```rust,ignore
//! use actix_web::middleware::from_fn;
//! use crate::bootstrap::middleware::controllers::permission::require_permission;
//!
//! // Apply to routes requiring Admin access (permission = 10 or 100)
//! scope("/admin")
//!     .wrap(from_fn(verify_jwt))
//!     .wrap(from_fn(require_permission(levels::ADMIN)))
//!     .route("/uploads", get().to(list_uploads))
//!
//! // Apply to routes requiring Super Admin access (permission = 100 only)
//! scope("/super-admin")
//!     .wrap(from_fn(verify_jwt))
//!     .wrap(from_fn(require_permission(levels::SUPER_ADMIN)))
//!     .route("/users", get().to(list_users))
//! ```

use crate::app::http::api::controllers::responses::BaseResponse;
use actix_web::{
    body::BoxBody,
    dev::{ServiceRequest, ServiceResponse},
    middleware::Next,
    HttpMessage, HttpResponse,
};

/// Permission level constants
pub mod levels {
    /// Basic user (default)
    pub const BASIC: i16 = 1;
    /// Admin - can manage uploads, assets
    pub const ADMIN: i16 = 10;
    /// Affiliate - future affiliate features
    pub const AFFILIATE: i16 = 50;
    /// Super Admin - full access
    pub const SUPER_ADMIN: i16 = 100;
}

/// Helper to create JSON forbidden response
fn forbidden_response(request: ServiceRequest, message: &'static str) -> ServiceResponse<BoxBody> {
    let response = HttpResponse::Forbidden().json(BaseResponse::error(message));
    request.into_response(response).map_into_boxed_body()
}

/// Factory function to create a permission middleware
///
/// Returns a middleware that checks if the user's permission level
/// matches the required level(s).
///
/// # Arguments
/// * `required_level` - Required permission level for the route
///
/// # Access Rules
/// - ADMIN (10): Allows Admin (10) or Super Admin (100)
/// - SUPER_ADMIN (100): Allows only Super Admin (100)
/// - AFFILIATE (50): Allows Affiliate (50) or Super Admin (100)
///
/// # Example
/// ```rust,ignore
/// // Require Admin level (10 or 100)
/// .wrap(from_fn(require_permission(levels::ADMIN)))
///
/// // Require Super Admin level (100 only)
/// .wrap(from_fn(require_permission(levels::SUPER_ADMIN)))
/// ```
pub fn require_permission(
    required_level: i16,
) -> impl Fn(
    ServiceRequest,
    Next<BoxBody>,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<ServiceResponse<BoxBody>, actix_web::Error>>>,
> + Clone {
    move |request: ServiceRequest, next: Next<BoxBody>| {
        let required = required_level;
        Box::pin(async move {
            // Get permissions from request extensions (set by JWT middleware)
            // We need to copy the value out before using request
            let permissions_opt = request.extensions().get::<i16>().copied();

            let permissions = match permissions_opt {
                Some(p) => p,
                None => {
                    // No permissions found - either JWT middleware didn't run
                    // or user doesn't have permissions set
                    return Ok(forbidden_response(request, "Authentication required"));
                }
            };

            // Check if user has the required permissions
            // Super Admin (100) has access to all protected routes
            // Other levels only have access to their specific level
            let has_access = match required {
                levels::SUPER_ADMIN => permissions == levels::SUPER_ADMIN,
                levels::ADMIN => permissions == levels::ADMIN || permissions == levels::SUPER_ADMIN,
                levels::AFFILIATE => {
                    permissions == levels::AFFILIATE || permissions == levels::SUPER_ADMIN
                }
                levels::BASIC => true, // All authenticated users
                _ => permissions == required || permissions == levels::SUPER_ADMIN,
            };

            if !has_access {
                return Ok(forbidden_response(request, "Insufficient permissions"));
            }

            // User has sufficient permissions, proceed
            next.call(request).await
        })
    }
}

/// Check if a permission level is Admin (10) or Super Admin (100)
pub fn is_admin(permissions: i16) -> bool {
    permissions == levels::ADMIN || permissions == levels::SUPER_ADMIN
}

/// Check if a permission level is Super Admin (100)
pub fn is_super_admin(permissions: i16) -> bool {
    permissions == levels::SUPER_ADMIN
}

/// Check if a permission level is Affiliate (50) or Super Admin (100)
pub fn is_affiliate(permissions: i16) -> bool {
    permissions == levels::AFFILIATE || permissions == levels::SUPER_ADMIN
}

/// Get permission level name
pub fn permission_name(level: i16) -> &'static str {
    match level {
        levels::SUPER_ADMIN => "Super Admin",
        levels::AFFILIATE => "Affiliate",
        levels::ADMIN => "Admin",
        levels::BASIC => "Basic",
        _ => "Unknown",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_admin() {
        assert!(!is_admin(1));
        assert!(!is_admin(9));
        assert!(is_admin(10)); // Admin
        assert!(!is_admin(50)); // Affiliate is NOT admin
        assert!(is_admin(100)); // Super Admin
    }

    #[test]
    fn test_is_super_admin() {
        assert!(!is_super_admin(1));
        assert!(!is_super_admin(10));
        assert!(!is_super_admin(50));
        assert!(!is_super_admin(99));
        assert!(is_super_admin(100));
        assert!(!is_super_admin(200)); // Only exactly 100
    }

    #[test]
    fn test_is_affiliate() {
        assert!(!is_affiliate(1));
        assert!(!is_affiliate(10));
        assert!(is_affiliate(50)); // Affiliate
        assert!(is_affiliate(100)); // Super Admin
    }

    #[test]
    fn test_permission_name() {
        assert_eq!(permission_name(1), "Basic");
        assert_eq!(permission_name(5), "Unknown");
        assert_eq!(permission_name(10), "Admin");
        assert_eq!(permission_name(49), "Unknown");
        assert_eq!(permission_name(50), "Affiliate");
        assert_eq!(permission_name(99), "Unknown");
        assert_eq!(permission_name(100), "Super Admin");
        assert_eq!(permission_name(200), "Unknown");
    }
}
