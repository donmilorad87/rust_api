use crate::modules::db::{self, AppState};
use actix_web::{HttpResponse, Responder, post, web};
use serde::Deserialize;
use serde_json::json;

#[derive(Deserialize, Debug)]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
}

#[post("/auth/sign-up")]
pub async fn sign_up(state: web::Data<AppState>, user: web::Json<SignupRequest>) -> HttpResponse {
    let db = state.db.lock().await;

    if db::user::has_with_email(&db, &user.email).await {
        return HttpResponse::Conflict().json(json!({
            "status": "error",
            "message": "User already exists"
        }));
    }

    if !db::user::create(&db, &user).await {
        return HttpResponse::InternalServerError().json(json!({
            "status": "error",
            "message": "Failed to create user"
        }));
    }

    return HttpResponse::Created().json(json!({
        "status": "success",
        "message": "User created successfully"
    }));
}

#[post("/auth/sign-in")]
pub async fn sign_in() -> impl Responder {
    "Sign In Endpoint"
}
