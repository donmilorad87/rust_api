use actix_web::{
    body::{MessageBody, EitherBody},
    dev::{ServiceRequest, ServiceResponse},
    http::{Method, StatusCode},
    middleware::Next,
    HttpResponse,
    FromRequest,
};
use actix_session::Session;
use crate::app::http::api::controllers::responses::BaseResponse;
use crate::bootstrap::utility::csrf;

/// Extract CSRF token from request (form field `_token` or header `X-CSRF-TOKEN`)
async fn extract_token_from_request(request: &ServiceRequest) -> Option<String> {
    // First, try X-CSRF-TOKEN header
    if let Some(header_value) = request.headers().get("X-CSRF-TOKEN") {
        if let Ok(token) = header_value.to_str() {
            return Some(token.to_string());
        }
    }

    // Fallback: try to extract from form body (for form submissions)
    // Note: This requires reading the body, which we handle by checking the form data
    // For now, we prioritize the header approach for forms as well
    // Forms should include the token via JavaScript before submission

    None
}

/// Check if the request path should be excluded from CSRF verification
fn is_excluded_path(path: &str) -> bool {
    // Exclude webhook routes
    if path.starts_with("/api/webhooks/") || path == "/api/webhooks" {
        return true;
    }

    // Exclude all OAuth endpoints (external apps won't have CSRF token)
    // OAuth security is handled by state parameter, PKCE, and access tokens
    if path.starts_with("/oauth/") || path.starts_with("/api/v1/oauth/") {
        return true;
    }

    false
}

/// CSRF verification middleware
pub async fn verify_csrf<B>(
    request: ServiceRequest,
    next: Next<B>,
) -> Result<ServiceResponse<EitherBody<B>>, actix_web::Error>
where
    B: MessageBody,
{
    let method = request.method();
    let path = request.path();

    // Skip CSRF verification for safe methods
    if matches!(method, &Method::GET | &Method::HEAD | &Method::OPTIONS) {
        return next.call(request).await.map(|res| res.map_into_left_body());
    }

    // Skip CSRF verification for excluded paths
    if is_excluded_path(path) {
        return next.call(request).await.map(|res| res.map_into_left_body());
    }

    // Get session from the request
    let session = Session::from_request(request.request(), &mut actix_web::dev::Payload::None).await?;

    // Get token from session
    let session_token = match csrf::get_token_from_session(&session)? {
        Some(token) => token,
        None => {
            // No session token - this should not happen if session is properly initialized
            let response = HttpResponse::build(StatusCode::from_u16(419).unwrap())
                .json(BaseResponse::error("CSRF token missing from session"));
            return Ok(request.into_response(response).map_into_right_body());
        }
    };

    // Get token from request
    let request_token = match extract_token_from_request(&request).await {
        Some(token) => token,
        None => {
            let response = HttpResponse::build(StatusCode::from_u16(419).unwrap())
                .json(BaseResponse::error("CSRF token missing from request"));
            return Ok(request.into_response(response).map_into_right_body());
        }
    };

    // Validate token using constant-time comparison
    if !csrf::validate_token(&session_token, &request_token) {
        let response = HttpResponse::build(StatusCode::from_u16(419).unwrap())
            .json(BaseResponse::error("CSRF token mismatch"));
        return Ok(request.into_response(response).map_into_right_body());
    }

    // Token valid, proceed
    next.call(request).await.map(|res| res.map_into_left_body())
}
