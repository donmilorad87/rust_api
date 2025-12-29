use crate::app::http::api::controllers::auth::Claims;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::database::AppState;
use actix_web::HttpMessage;
use actix_web::{
    body::BoxBody,
    dev::{ServiceRequest, ServiceResponse},
    middleware::Next,
    web, HttpResponse,
};
use jsonwebtoken::{decode, DecodingKey, Validation};

/// Helper to create JSON error response
fn unauthorized_response(request: ServiceRequest, message: &'static str) -> ServiceResponse<BoxBody> {
    let response = HttpResponse::Unauthorized()
        .json(BaseResponse::error(message));
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

pub async fn verify_jwt(
    request: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error> {
    // Extract token from header or cookie
    let token = match extract_token(&request) {
        Some(t) => t,
        None => {
            return Ok(unauthorized_response(request, "Authentication required"));
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

    let decoding_key = DecodingKey::from_secret(state.jwt_secret.as_bytes());

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
        Err(_) => {
            Ok(unauthorized_response(request, "Invalid or expired token"))
        }
    }
}
