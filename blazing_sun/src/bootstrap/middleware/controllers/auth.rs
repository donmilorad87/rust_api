use crate::app::http::api::controllers::auth::Claims;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::config::JwtConfig;
use crate::database::mutations::session_refresh_token as db_refresh_token_mut;
use crate::database::read::session_refresh_token as db_refresh_token;
use crate::database::read::user as db_user;
use crate::database::AppState;
use actix_web::cookie::{Cookie, SameSite};
use actix_web::HttpMessage;
use actix_web::{
    body::BoxBody,
    dev::{ServiceRequest, ServiceResponse},
    middleware::Next,
    web, HttpResponse,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};

/// Helper to create JSON error response
fn unauthorized_response(
    request: ServiceRequest,
    message: &'static str,
) -> ServiceResponse<BoxBody> {
    let response = HttpResponse::Unauthorized().json(BaseResponse::error(message));
    request.into_response(response).map_into_boxed_body()
}

/// Extract JWT token from Authorization header or auth_token cookie
fn extract_token(request: &ServiceRequest) -> Option<String> {
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

/// Extract refresh token from cookie
fn extract_refresh_token(request: &ServiceRequest) -> Option<String> {
    request
        .cookie("refresh_token")
        .map(|c| c.value().to_string())
}

pub async fn verify_jwt(
    request: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error> {
    // Get app state first (needed for both normal and refresh flows)
    let state = match request.app_data::<web::Data<AppState>>() {
        Some(s) => s.clone(),
        None => {
            let response = HttpResponse::InternalServerError()
                .json(BaseResponse::error("Server configuration error"));
            return Ok(request.into_response(response).map_into_boxed_body());
        }
    };

    let decoding_key = DecodingKey::from_secret(state.jwt_secret.as_bytes());

    // Extract token from header or cookie
    let token = match extract_token(&request) {
        Some(t) => t,
        None => {
            // No access token - check for refresh token
            return try_refresh_or_unauthorized(request, next, &state).await;
        }
    };

    // Try to validate the JWT token
    match decode::<Claims>(&token, &decoding_key, &Validation::default()) {
        Ok(token_data) => {
            let claims = token_data.claims;
            // Store user ID in request extensions
            request.extensions_mut().insert(claims.sub);
            // Store permissions in request extensions for permission middleware
            request.extensions_mut().insert(claims.permissions);
            // Proceed to next middleware/handler
            next.call(request).await
        }
        Err(err) => {
            // Check if error is specifically due to token expiration
            if matches!(
                err.kind(),
                jsonwebtoken::errors::ErrorKind::ExpiredSignature
            ) {
                // Try to use refresh token
                return try_refresh_or_unauthorized(request, next, &state).await;
            }
            // Other JWT errors (invalid token, etc.)
            Ok(unauthorized_response(request, "Invalid token"))
        }
    }
}

/// Optional JWT verification middleware
/// This middleware extracts user_id if a valid token is present, but does NOT reject
/// unauthenticated requests. Use this for endpoints that work for both authenticated
/// and unauthenticated users (e.g., OAuth consent page).
pub async fn verify_jwt_optional(
    request: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error> {
    // Get app state
    let state = match request.app_data::<web::Data<AppState>>() {
        Some(s) => s.clone(),
        None => {
            // Still proceed, just won't have user_id
            return next.call(request).await;
        }
    };

    let decoding_key = DecodingKey::from_secret(state.jwt_secret.as_bytes());

    // Extract token from header or cookie
    let token = match extract_token(&request) {
        Some(t) => t,
        None => {
            // No access token - try refresh token silently
            return try_refresh_optional(request, next, &state).await;
        }
    };

    // Try to validate the JWT token
    match decode::<Claims>(&token, &decoding_key, &Validation::default()) {
        Ok(token_data) => {
            let claims = token_data.claims;
            // Store user ID in request extensions
            request.extensions_mut().insert(claims.sub);
            // Store permissions in request extensions for permission middleware
            request.extensions_mut().insert(claims.permissions);
            // Proceed to next middleware/handler
            next.call(request).await
        }
        Err(err) => {
            // Check if error is specifically due to token expiration
            if matches!(
                err.kind(),
                jsonwebtoken::errors::ErrorKind::ExpiredSignature
            ) {
                // Try to use refresh token
                return try_refresh_optional(request, next, &state).await;
            }
            // Other JWT errors - proceed without user_id (don't reject)
            next.call(request).await
        }
    }
}

/// Attempt to use refresh token to get a new access token, or proceed without auth
async fn try_refresh_optional(
    request: ServiceRequest,
    next: Next<BoxBody>,
    state: &web::Data<AppState>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error> {
    // Check for refresh token
    let refresh_token_raw = match extract_refresh_token(&request) {
        Some(t) => t,
        None => {
            // No refresh token - proceed without auth (don't reject)
            return next.call(request).await;
        }
    };

    // Hash the refresh token for lookup
    let token_hash = db_refresh_token_mut::hash_token(&refresh_token_raw);

    // Get database connection
    let db = state.db.lock().await;

    // Validate refresh token
    let refresh_record = match db_refresh_token::get_valid_by_hash(&db, &token_hash).await {
        Ok(record) => record,
        Err(_) => {
            // Invalid refresh token - proceed without auth (don't reject)
            drop(db);
            return next.call(request).await;
        }
    };

    // Update last_used_at
    let _ = db_refresh_token_mut::update_last_used(&db, &token_hash).await;

    // Get user
    let user = match db_user::get_by_id(&db, refresh_record.user_id).await {
        Ok(u) => u,
        Err(_) => {
            drop(db);
            return next.call(request).await;
        }
    };

    // Check if user is still active
    if user.activated == 0 {
        drop(db);
        return next.call(request).await;
    }

    // Generate new access token
    let claims = Claims {
        sub: user.id,
        role: "user".to_string(),
        permissions: user.permissions,
        exp: (Utc::now() + Duration::minutes(JwtConfig::expiration_minutes())).timestamp(),
    };

    let new_token = match encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    ) {
        Ok(t) => t,
        Err(_) => {
            drop(db);
            return next.call(request).await;
        }
    };

    // Store user ID and permissions in request extensions
    request.extensions_mut().insert(claims.sub);
    request.extensions_mut().insert(claims.permissions);

    // Drop database lock before calling next middleware
    drop(db);

    // Call the next middleware/handler
    let mut response = next.call(request).await?;

    // Add the new auth_token cookie to the response
    let cookie = Cookie::build("auth_token", new_token)
        .path("/")
        .max_age(actix_web::cookie::time::Duration::minutes(
            JwtConfig::expiration_minutes(),
        ))
        .http_only(true)
        .same_site(SameSite::Lax)
        .finish();

    // Add cookie to response headers
    if let Ok(cookie_value) = cookie.to_string().parse() {
        response
            .headers_mut()
            .insert(actix_web::http::header::SET_COOKIE, cookie_value);
    }

    Ok(response)
}

/// Attempt to use refresh token to get a new access token, or return unauthorized
async fn try_refresh_or_unauthorized(
    request: ServiceRequest,
    next: Next<BoxBody>,
    state: &web::Data<AppState>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error> {
    // Check for refresh token
    let refresh_token_raw = match extract_refresh_token(&request) {
        Some(t) => t,
        None => {
            return Ok(unauthorized_response(request, "Authentication required"));
        }
    };

    // Hash the refresh token for lookup
    let token_hash = db_refresh_token_mut::hash_token(&refresh_token_raw);

    // Get database connection
    let db = state.db.lock().await;

    // Validate refresh token
    let refresh_record = match db_refresh_token::get_valid_by_hash(&db, &token_hash).await {
        Ok(record) => record,
        Err(_) => {
            return Ok(unauthorized_response(
                request,
                "Session expired. Please sign in again.",
            ));
        }
    };

    // Update last_used_at
    let _ = db_refresh_token_mut::update_last_used(&db, &token_hash).await;

    // Get user
    let user = match db_user::get_by_id(&db, refresh_record.user_id).await {
        Ok(u) => u,
        Err(_) => {
            return Ok(unauthorized_response(request, "User not found"));
        }
    };

    // Check if user is still active
    if user.activated == 0 {
        return Ok(unauthorized_response(request, "Account not activated"));
    }

    // Generate new access token
    let claims = Claims {
        sub: user.id,
        role: "user".to_string(),
        permissions: user.permissions,
        exp: (Utc::now() + Duration::minutes(JwtConfig::expiration_minutes())).timestamp(),
    };

    let new_token = match encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    ) {
        Ok(t) => t,
        Err(_) => {
            let response = HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to generate token"));
            return Ok(request.into_response(response).map_into_boxed_body());
        }
    };

    // Store user ID and permissions in request extensions
    request.extensions_mut().insert(claims.sub);
    request.extensions_mut().insert(claims.permissions);

    // Drop database lock before calling next middleware
    drop(db);

    // Call the next middleware/handler
    let mut response = next.call(request).await?;

    // Add the new auth_token cookie to the response
    let cookie = Cookie::build("auth_token", new_token)
        .path("/")
        .max_age(actix_web::cookie::time::Duration::minutes(
            JwtConfig::expiration_minutes(),
        ))
        .http_only(true)
        .same_site(SameSite::Lax)
        .finish();

    // Add cookie to response headers
    if let Ok(cookie_value) = cookie.to_string().parse() {
        response
            .headers_mut()
            .insert(actix_web::http::header::SET_COOKIE, cookie_value);
    }

    Ok(response)
}
