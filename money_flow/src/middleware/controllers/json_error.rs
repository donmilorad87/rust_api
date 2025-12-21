use actix_web::{error::JsonPayloadError, HttpRequest, HttpResponse};
use serde::Serialize;

#[derive(Serialize)]
struct JsonErrorResponse {
    status: &'static str,
    message: &'static str,
    errors: Vec<String>,
}

pub fn json_error_handler(err: JsonPayloadError, _req: &HttpRequest) -> actix_web::error::Error {
    let detail = err.to_string();

    // For JSON syntax errors, return the detail
    let errors = vec![detail];

    let response = HttpResponse::BadRequest().json(JsonErrorResponse {
        status: "error",
        message: "Invalid request body",
        errors,
    });

    actix_web::error::InternalError::from_response(err, response).into()
}
