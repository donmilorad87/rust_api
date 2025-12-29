//! Auth Utility
//!
//! Helper functions for authentication checks.

use crate::app::http::api::controllers::auth::Claims;
use crate::config::JwtConfig;
use actix_web::HttpRequest;
use jsonwebtoken::{decode, DecodingKey, Validation};

/// Result of checking if user is logged in
#[derive(Debug, Clone)]
pub struct AuthInfo {
    pub is_logged: bool,
    pub user_id: Option<i64>,
    pub role: Option<String>,
    pub permissions: Option<i16>,
}

impl AuthInfo {
    /// Create an unauthenticated auth info
    pub fn guest() -> Self {
        Self {
            is_logged: false,
            user_id: None,
            role: None,
            permissions: None,
        }
    }

    /// Create an authenticated auth info
    pub fn logged(user_id: i64, role: String, permissions: i16) -> Self {
        Self {
            is_logged: true,
            user_id: Some(user_id),
            role: Some(role),
            permissions: Some(permissions),
        }
    }

    /// Check if user has admin permissions (level = 10 or 100)
    pub fn is_admin(&self) -> bool {
        self.permissions.map(|p| p == 10 || p == 100).unwrap_or(false)
    }

    /// Check if user has super admin permissions (level = 100)
    pub fn is_super_admin(&self) -> bool {
        self.permissions.map(|p| p == 100).unwrap_or(false)
    }

    /// Check if user has affiliate permissions (level = 50 or 100)
    pub fn is_affiliate(&self) -> bool {
        self.permissions.map(|p| p == 50 || p == 100).unwrap_or(false)
    }

    /// Check if user has the exact permission level or is super admin
    pub fn has_permission(&self, level: i16) -> bool {
        self.permissions.map(|p| p == level || p == 100).unwrap_or(false)
    }
}

/// Check if the request has a valid JWT token
///
/// Checks both Authorization header (for API requests) and auth_token cookie (for web requests).
/// Returns AuthInfo with user details if logged in, or guest info if not.
///
/// # Example
/// ```rust,ignore
/// use crate::bootstrap::utility::auth::is_logged;
///
/// pub async fn homepage(req: HttpRequest) -> HttpResponse {
///     let auth = is_logged(&req);
///     if auth.is_logged {
///         // Show logged-in content
///     } else {
///         // Show guest content
///     }
/// }
/// ```
pub fn is_logged(req: &HttpRequest) -> AuthInfo {
    // Try to get token from Authorization header first (API requests)
    let token = get_token_from_header(req).or_else(|| get_token_from_cookie(req));

    let token = match token {
        Some(t) => t,
        None => return AuthInfo::guest(),
    };

    // Decode and validate JWT
    let decoding_key = DecodingKey::from_secret(JwtConfig::secret().as_bytes());

    match decode::<Claims>(&token, &decoding_key, &Validation::default()) {
        Ok(token_data) => {
            let claims = token_data.claims;
            AuthInfo::logged(claims.sub, claims.role, claims.permissions)
        }
        Err(_) => AuthInfo::guest(),
    }
}

/// Extract token from Authorization header
fn get_token_from_header(req: &HttpRequest) -> Option<String> {
    let auth_header = req.headers().get("Authorization")?;
    let auth_str = auth_header.to_str().ok()?;

    if !auth_str.starts_with("Bearer ") {
        return None;
    }

    auth_str.strip_prefix("Bearer ").map(|s| s.to_string())
}

/// Extract token from auth_token cookie
fn get_token_from_cookie(req: &HttpRequest) -> Option<String> {
    req.cookie("auth_token").map(|c| c.value().to_string())
}

/// Simple check if user is logged in (returns bool)
pub fn check_logged(req: &HttpRequest) -> bool {
    is_logged(req).is_logged
}
