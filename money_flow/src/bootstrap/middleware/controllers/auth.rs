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
use jsonwebtoken::{DecodingKey, Validation, decode};

/// Helper to create JSON error response
fn unauthorized_response(request: ServiceRequest, message: &'static str) -> ServiceResponse<BoxBody> {
    let response = HttpResponse::Unauthorized()
        .json(BaseResponse::error(message));
    request.into_response(response).map_into_boxed_body()
}

pub async fn verify_jwt(
    request: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error> {
    // Get Authorization header
    let auth_header = match request.headers().get("Authorization") {
        Some(header) => header,
        None => {
            return Ok(unauthorized_response(request, "Authorization header missing"));
        }
    };

    // Convert to string
    let auth_str = match auth_header.to_str() {
        Ok(s) => s,
        Err(_) => {
            return Ok(unauthorized_response(request, "Invalid Authorization header"));
        }
    };

    // Check Bearer prefix
    if !auth_str.starts_with("Bearer ") {
        return Ok(unauthorized_response(request, "Invalid Authorization format"));
    }

    let token = auth_str.strip_prefix("Bearer ").unwrap();

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

    match decode::<Claims>(token, &decoding_key, &Validation::default()) {
        Ok(token_data) => {
            let claims = token_data.claims;
            // Store user ID in request extensions
            request.extensions_mut().insert(claims.sub);
            // Proceed to next middleware/handler
            next.call(request).await
        }
        Err(_) => {
            Ok(unauthorized_response(request, "Invalid or expired token"))
        }
    }
}
