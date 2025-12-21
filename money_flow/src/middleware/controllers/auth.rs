use crate::db::AppState;
use crate::modules::routes::controllers::auth::{BaseResponse, Claims};
use actix_web::HttpMessage;
use actix_web::{
    body::BoxBody,
    dev::{ServiceRequest, ServiceResponse},
    middleware::Next,
    web,
};
use jsonwebtoken::{DecodingKey, Validation, decode};

pub async fn verify_jwt(
    request: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse, actix_web::Error> {
    // Implementation for JWT verification

    let auth_header = request.headers().get("Authorization").ok_or_else(|| {
        actix_web::error::ErrorUnauthorized(BaseResponse {
            status: "error",
            message: "Authorization header missing",
        })
    })?;

    let auth_str = auth_header.to_str().map_err(|_| {
        actix_web::error::ErrorUnauthorized(BaseResponse {
            status: "error",
            message: "Invalid Authorization malformed",
        })
    })?;

    if !auth_str.starts_with("Bearer ") {
        return Err(actix_web::error::ErrorUnauthorized(BaseResponse {
            status: "error",
            message: "Invalid Authorization format",
        }));
    }

    //let token = &auth_str[7..]; // Extract the token part
    let token = auth_str.strip_prefix("Bearer ").unwrap();

    let state = request.app_data::<web::Data<AppState>>().unwrap();
    let decoding_key = DecodingKey::from_secret(state.jwt_secret.as_bytes());

    match decode::<Claims>(token, &decoding_key, &Validation::default()) {
        Ok(token_data) => {
            let claims = token_data.claims;
            // Token is valid, you can access claims via token_data.claims
            request.extensions_mut().insert(claims.sub);

            // Token is valid, proceed to the next middleware or handler
            next.call(request).await
        }
        Err(_) => {
            // Token is invalid
            Err(actix_web::error::ErrorUnauthorized(BaseResponse {
                status: "error",
                message: "Invalid token",
            }))
        }
    }
}
