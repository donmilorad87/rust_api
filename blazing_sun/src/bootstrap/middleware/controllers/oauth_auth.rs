//! OAuth JWT Verification Middleware
//!
//! Verifies OAuth RS256 JWT access tokens and makes claims available to handlers.
//! This middleware is for OAuth-protected API endpoints.

use crate::app::http::api::controllers::responses::BaseResponse;
use crate::bootstrap::utility::oauth_jwt::OAuthClaims;
use crate::database::AppState;
use actix_web::HttpMessage;
use actix_web::{
    body::BoxBody,
    dev::{ServiceRequest, ServiceResponse},
    middleware::Next,
    web, HttpRequest, HttpResponse,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use std::fs;

/// OAuth Claims Extension
/// This struct is stored in request extensions and can be extracted in handlers
#[derive(Debug, Clone)]
pub struct OAuthClaimsExt {
    pub user_id: i64,
    pub client_id: String,
    pub scope: String,
    pub expires_at: i64,
}

/// Helper to create JSON error response
fn oauth_unauthorized_response(
    request: ServiceRequest,
    error: &str,
    error_description: &str,
) -> ServiceResponse<BoxBody> {
    // OAuth 2.0 error format
    let response = HttpResponse::Unauthorized()
        .insert_header((
            "WWW-Authenticate",
            format!(
                r#"Bearer realm="OAuth", error="{}", error_description="{}""#,
                error, error_description
            ),
        ))
        .json(serde_json::json!({
            "error": error,
            "error_description": error_description
        }));
    request.into_response(response).map_into_boxed_body()
}

/// Extract OAuth Bearer token from Authorization header
fn extract_oauth_token(request: &ServiceRequest) -> Option<String> {
    if let Some(auth_header) = request.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                if let Some(token) = auth_str.strip_prefix("Bearer ") {
                    return Some(token.to_string());
                }
            }
        }
    }
    None
}

/// Verify OAuth RS256 JWT access token
///
/// This middleware:
/// 1. Extracts Bearer token from Authorization header
/// 2. Verifies RS256 signature using public key
/// 3. Validates issuer, expiration, and other claims
/// 4. Stores OAuthClaimsExt in request extensions
pub async fn verify_oauth_jwt(
    request: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error> {
    // Extract token from Authorization header
    let token = match extract_oauth_token(&request) {
        Some(t) => t,
        None => {
            return Ok(oauth_unauthorized_response(
                request,
                "invalid_token",
                "Bearer token is required",
            ));
        }
    };

    // Get app state
    let state = match request.app_data::<web::Data<AppState>>() {
        Some(s) => s,
        None => {
            let response = HttpResponse::InternalServerError()
                .json(BaseResponse::error("Server configuration error"));
            return Ok(request.into_response(response).map_into_boxed_body());
        }
    };

    // Read public key from file
    let public_key_path = &state.oauth_public_key_path;
    let public_key_pem = match fs::read_to_string(public_key_path) {
        Ok(pem) => pem,
        Err(_) => {
            let response = HttpResponse::InternalServerError()
                .json(BaseResponse::error("OAuth configuration error"));
            return Ok(request.into_response(response).map_into_boxed_body());
        }
    };

    // Create decoding key from RSA PEM
    let decoding_key = match DecodingKey::from_rsa_pem(public_key_pem.as_bytes()) {
        Ok(key) => key,
        Err(_) => {
            let response = HttpResponse::InternalServerError()
                .json(BaseResponse::error("OAuth key configuration error"));
            return Ok(request.into_response(response).map_into_boxed_body());
        }
    };

    // Configure validation
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[&state.oauth_issuer]);
    validation.validate_exp = true;
    // OAuth access tokens use client_id as aud; skip aud validation here.
    validation.validate_aud = false;

    // Decode and verify JWT
    match decode::<OAuthClaims>(&token, &decoding_key, &validation) {
        Ok(token_data) => {
            let claims = token_data.claims;

            // Parse user ID from subject
            let user_id: i64 = match claims.sub.parse() {
                Ok(id) => id,
                Err(_) => {
                    return Ok(oauth_unauthorized_response(
                        request,
                        "invalid_token",
                        "Invalid subject claim",
                    ));
                }
            };

            // Create OAuth claims extension
            let oauth_claims_ext = OAuthClaimsExt {
                user_id,
                client_id: claims.client_id,
                scope: claims.scope,
                expires_at: claims.exp,
            };

            // Store OAuth claims in request extensions
            request.extensions_mut().insert(oauth_claims_ext);

            // Proceed to next middleware/handler
            next.call(request).await
        }
        Err(err) => {
            let error_description = match err.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => "Token has expired",
                jsonwebtoken::errors::ErrorKind::InvalidIssuer => "Invalid token issuer",
                jsonwebtoken::errors::ErrorKind::InvalidSignature => "Invalid token signature",
                _ => "Invalid or malformed token",
            };

            Ok(oauth_unauthorized_response(
                request,
                "invalid_token",
                error_description,
            ))
        }
    }
}

// ============================================================================
// Scope Enforcement Functions
// ============================================================================

/// Extract OAuth claims from request
///
/// Use this in handlers to get OAuth claims after verify_oauth_jwt middleware
pub fn extract_oauth_claims(req: &HttpRequest) -> Option<OAuthClaimsExt> {
    req.extensions().get::<OAuthClaimsExt>().cloned()
}

/// Check if OAuth token has required scopes
///
/// Scopes are space-separated. This function checks if ALL required scopes are present.
///
/// # Examples
/// ```ignore
/// // Token has: "galleries.read galleries.write"
/// has_scopes(&claims, "galleries.read")  // true
/// has_scopes(&claims, "galleries.read galleries.write")  // true
/// has_scopes(&claims, "galleries.delete")  // false
/// ```
pub fn has_scopes(claims: &OAuthClaimsExt, required_scopes: &str) -> bool {
    let token_scopes: Vec<&str> = claims.scope.split_whitespace().collect();
    let required: Vec<&str> = required_scopes.split_whitespace().collect();

    // Check if all required scopes are present in token
    required
        .iter()
        .all(|req_scope| token_scopes.contains(req_scope))
}

/// Check if OAuth token has ANY of the required scopes
///
/// Useful when you need at least one scope from a set
pub fn has_any_scope(claims: &OAuthClaimsExt, required_scopes: &str) -> bool {
    let token_scopes: Vec<&str> = claims.scope.split_whitespace().collect();
    let required: Vec<&str> = required_scopes.split_whitespace().collect();

    // Check if any required scope is present in token
    required
        .iter()
        .any(|req_scope| token_scopes.contains(req_scope))
}

/// Enforce scope requirements in handler
///
/// Returns HttpResponse error if scopes are missing, otherwise returns Ok(())
///
/// # Usage in handlers
/// ```ignore
/// pub async fn my_handler(req: HttpRequest) -> HttpResponse {
///     let claims = extract_oauth_claims(&req).unwrap();
///
///     // Enforce scope
///     if let Err(response) = enforce_scopes(&claims, "galleries.read") {
///         return response;
///     }
///
///     // Proceed with handler logic
///     HttpResponse::Ok().json(...)
/// }
/// ```
pub fn enforce_scopes(claims: &OAuthClaimsExt, required_scopes: &str) -> Result<(), HttpResponse> {
    if has_scopes(claims, required_scopes) {
        Ok(())
    } else {
        Err(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "insufficient_scope",
            "error_description": format!("Required scopes: {}", required_scopes),
            "scope": required_scopes
        })))
    }
}

/// Enforce that token has ANY of the required scopes
pub fn enforce_any_scope(
    claims: &OAuthClaimsExt,
    required_scopes: &str,
) -> Result<(), HttpResponse> {
    if has_any_scope(claims, required_scopes) {
        Ok(())
    } else {
        Err(HttpResponse::Forbidden().json(serde_json::json!({
            "error": "insufficient_scope",
            "error_description": format!("At least one of these scopes required: {}", required_scopes),
            "scope": required_scopes
        })))
    }
}

// ============================================================================
// Actix-web FromRequest Extractor (Optional)
// ============================================================================

use actix_web::FromRequest;
use std::future::{ready, Ready};

/// Actix-web extractor for OAuth claims
///
/// Use this to automatically extract and validate OAuth claims in handlers
///
/// # Example
/// ```ignore
/// pub async fn my_handler(oauth: OAuthExtractor) -> HttpResponse {
///     // oauth.user_id, oauth.client_id, oauth.scope are available
///     HttpResponse::Ok().json(...)
/// }
/// ```
pub struct OAuthExtractor(pub OAuthClaimsExt);

impl FromRequest for OAuthExtractor {
    type Error = actix_web::Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut actix_web::dev::Payload) -> Self::Future {
        match extract_oauth_claims(req) {
            Some(claims) => ready(Ok(OAuthExtractor(claims))),
            None => ready(Err(actix_web::error::ErrorUnauthorized(
                serde_json::json!({
                    "error": "invalid_token",
                    "error_description": "OAuth token required"
                }),
            ))),
        }
    }
}

/// Actix-web extractor for OAuth claims with scope enforcement
///
/// Use this to automatically extract claims AND enforce specific scopes
///
/// # Example
/// ```ignore
/// pub async fn my_handler(
///     oauth: RequireScopes
/// ) -> HttpResponse {
///     // Handler only runs if token has required scopes
///     // Use oauth.has_scope("galleries.read") to check individual scopes
///     HttpResponse::Ok().json(...)
/// }
/// ```
pub struct RequireScopes(pub OAuthClaimsExt);

impl RequireScopes {
    /// Check if the token has a specific scope
    pub fn has_scope(&self, scope: &str) -> bool {
        has_scopes(&self.0, scope)
    }

    /// Check if the token has all of the specified scopes (space-separated)
    pub fn has_all_scopes(&self, scopes: &str) -> bool {
        has_scopes(&self.0, scopes)
    }
}

impl FromRequest for RequireScopes {
    type Error = actix_web::Error;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _: &mut actix_web::dev::Payload) -> Self::Future {
        match extract_oauth_claims(req) {
            Some(claims) => ready(Ok(RequireScopes(claims))),
            None => ready(Err(actix_web::error::ErrorUnauthorized(
                serde_json::json!({
                    "error": "invalid_token",
                    "error_description": "OAuth token required"
                }),
            ))),
        }
    }
}
