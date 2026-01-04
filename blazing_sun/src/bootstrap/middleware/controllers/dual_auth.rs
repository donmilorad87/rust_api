use crate::app::http::api::controllers::auth::Claims;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::database::AppState;
use actix_session::SessionExt;
use actix_web::HttpMessage;
use actix_web::{
    body::BoxBody,
    dev::{ServiceRequest, ServiceResponse},
    middleware::Next,
    web, HttpResponse,
};
use jsonwebtoken::{decode, DecodingKey, Validation};

/// Middleware that accepts BOTH JWT tokens AND session authentication
/// This allows OAuth client management endpoints to be accessed from:
/// 1. API calls with JWT Bearer tokens
/// 2. Web UI with session cookies
pub async fn verify_jwt_or_session(
    request: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error> {
    // Try JWT first (from Authorization header or auth_token cookie)
    if let Some(user_id) = try_jwt_auth(&request) {
        // Insert i64 to match what JWT auth middleware does
        request.extensions_mut().insert(user_id);
        return next.call(request).await;
    }

    // Fallback to session authentication
    if let Some(user_id) = try_session_auth(&request) {
        // Convert i32 from session to i64 for consistency
        request.extensions_mut().insert(user_id as i64);
        return next.call(request).await;
    }

    // Neither auth method worked
    let response = HttpResponse::Unauthorized()
        .json(BaseResponse::error("Authentication required"));
    Ok(request.into_response(response).map_into_boxed_body())
}

/// Try to authenticate using JWT token
fn try_jwt_auth(request: &ServiceRequest) -> Option<i64> {
    // Extract token from Authorization header or auth_token cookie
    let token = extract_jwt_token(request)?;

    // Get app state
    let state = request.app_data::<web::Data<AppState>>()?;
    let decoding_key = DecodingKey::from_secret(state.jwt_secret.as_bytes());

    // Decode and validate JWT
    let token_data = decode::<Claims>(&token, &decoding_key, &Validation::default()).ok()?;

    // Return i64 user ID from JWT claims
    Some(token_data.claims.sub)
}

/// Try to authenticate using session
fn try_session_auth(request: &ServiceRequest) -> Option<i32> {
    let session = request.get_session();
    session.get("user_id").ok().flatten()
}

/// Extract JWT token from Authorization header or auth_token cookie
fn extract_jwt_token(request: &ServiceRequest) -> Option<String> {
    // First, try Authorization header
    if let Some(auth_header) = request.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                if let Some(token) = auth_str.strip_prefix("Bearer ") {
                    return Some(token.to_string());
                }
            }
        }
    }

    // Fallback: try auth_token cookie
    if let Some(cookie) = request.cookie("auth_token") {
        return Some(cookie.value().to_string());
    }

    None
}
