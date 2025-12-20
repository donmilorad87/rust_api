use crate::modules::db::{self, AppState};
use actix_web::{HttpResponse, post, web};

use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};

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
        return HttpResponse::Conflict().json(BaseResponse {
            status: "error",
            message: "User already exists",
        });
    }

    if !db::user::create(&db, &user).await {
        return HttpResponse::InternalServerError().json(BaseResponse {
            status: "error",
            message: "Failed to create user",
        });
    }

    return HttpResponse::Created().json(BaseResponse {
        status: "success",
        message: "User created successfully",
    });
}

#[derive(Deserialize, Debug)]
pub struct SignInRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Claims {
    pub sub: i64,
    pub role: String,
    pub exp: i64,
}

#[derive(Serialize)]
struct UserDto {
    id: i64,
    email: String,
    first_name: String,
    last_name: String,
    balance: i64, // or whatever type
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}
#[derive(Serialize)]
struct BaseResponse {
    status: &'static str,
    message: &'static str,
}

#[derive(Serialize)]
struct SignInResponse {
    #[serde(flatten)]
    base: BaseResponse,
    token: String,
    user: UserDto,
}

#[post("/auth/sign-in")]
pub async fn sign_in(state: web::Data<AppState>, data: web::Json<SignInRequest>) -> HttpResponse {
    let db = state.db.lock().await;

    let Ok(user) = db::user::sign_in(&db, &data).await else {
        return HttpResponse::Unauthorized().json(BaseResponse {
            status: "error",
            message: "Invalid email or password1",
        });
    };

    if !bcrypt::verify(&data.password, &user.password).unwrap_or(false) {
        return HttpResponse::Unauthorized().json(BaseResponse {
            status: "error",
            message: "Invalid email or password2",
        });
    }
    let minutes: i64 = std::env::var("EXPIRATION_TIME").unwrap().parse().unwrap();
    let claims: Claims = Claims {
        sub: user.id,
        role: "user".to_string(),
        exp: (Utc::now() + Duration::minutes(minutes)).timestamp(),
    };

    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )
    .unwrap();

    return HttpResponse::Ok().json(SignInResponse {
        base: BaseResponse {
            status: "success",
            message: "Signed in successfully",
        },
        token,
        user: UserDto {
            id: user.id,
            email: user.email.clone(),
            first_name: user.first_name.clone(),
            last_name: user.last_name.clone(),
            balance: user.balance,
            created_at: user.created_at,
            updated_at: user.updated_at,
        },
    });
}
