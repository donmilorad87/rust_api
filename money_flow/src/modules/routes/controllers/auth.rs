use crate::db::AppState;
use crate::db::read::user as db_user;
use crate::modules::routes::validators::auth::{
    validate_password, SigninRequest, SigninRequestRaw, SignupRequest, SignupRequestRaw,
};
use crate::mq::{self, JobOptions, JobStatus};
use crate::mq::jobs::create_user::CreateUserParams;
use actix_web::{HttpResponse, post, web};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json;
use std::collections::HashMap;
use validator::Validate;

#[post("/auth/sign-up")]
pub async fn sign_up(
    state: web::Data<AppState>,
    raw: web::Json<SignupRequestRaw>,
) -> HttpResponse {
    let mut missing_fields: Vec<String> = Vec::new();

    // Check all required fields first
    if raw.email.is_none() {
        missing_fields.push("email is required".to_string());
    }
    if raw.password.is_none() {
        missing_fields.push("password is required".to_string());
    }
    if raw.first_name.is_none() {
        missing_fields.push("first_name is required".to_string());
    }
    if raw.last_name.is_none() {
        missing_fields.push("last_name is required".to_string());
    }

    // If any required fields are missing, return early with array format
    if !missing_fields.is_empty() {
        return HttpResponse::BadRequest().json(MissingFieldsResponse {
            status: "error",
            message: "Validation failed",
            errors: missing_fields,
        });
    }

    // Now we can safely unwrap since we checked above
    let user = SignupRequest {
        email: raw.email.clone().unwrap(),
        password: raw.password.clone().unwrap(),
        first_name: raw.first_name.clone().unwrap(),
        last_name: raw.last_name.clone().unwrap(),
    };

    let mut errors: HashMap<String, Vec<String>> = HashMap::new();

    // Validate using validator crate
    if let Err(validation_errors) = user.validate() {
        for (field, field_errors) in validation_errors.field_errors() {
            let messages: Vec<String> = field_errors
                .iter()
                .map(|e| {
                    e.message
                        .as_ref()
                        .map(|m| m.to_string())
                        .unwrap_or_else(|| e.code.to_string())
                })
                .collect();
            errors.insert(field.to_string(), messages);
        }
    }

    // Validate password separately to get all errors
    let password_errors = validate_password(&user.password);
    if !password_errors.is_empty() {
        errors
            .entry("password".to_string())
            .or_default()
            .extend(password_errors);
    }

    // If validation errors, return with object format
    if !errors.is_empty() {
        return HttpResponse::BadRequest().json(ValidationErrorResponse {
            status: "error",
            message: "Validation failed",
            errors,
        });
    }

    let db = state.db.lock().await;

    if db_user::has_with_email(&db, &user.email).await {
        return HttpResponse::Conflict().json(BaseResponse {
            status: "error",
            message: "User already exists",
        });
    }

    // Queue the user creation job
    let Some(ref mq) = state.mq else {
        return HttpResponse::InternalServerError().json(BaseResponse {
            status: "error",
            message: "Message queue not available",
        });
    };

    let params = CreateUserParams {
        email: user.email.clone(),
        password: user.password.clone(),
        first_name: user.first_name.clone(),
        last_name: user.last_name.clone(),
    };

    let options = JobOptions::new()
        .priority(0)          // FIFO
        .fault_tolerance(3);  // Retry 3 times

    match mq::enqueue_and_wait_dyn(mq, "create_user", &params, options, 30000).await {
        Ok(JobStatus::Completed) => {
            HttpResponse::Created().json(BaseResponse {
                status: "success",
                message: "User created successfully",
            })
        }
        Ok(JobStatus::Failed) => {
            HttpResponse::InternalServerError().json(BaseResponse {
                status: "error",
                message: "Failed to create user",
            })
        }
        Ok(_) => {
            HttpResponse::InternalServerError().json(BaseResponse {
                status: "error",
                message: "Unexpected job status",
            })
        }
        Err(e) => {
            tracing::error!("Job error: {}", e);
            HttpResponse::InternalServerError().json(BaseResponse {
                status: "error",
                message: "Failed to create user",
            })
        }
    }
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
#[derive(Serialize, Debug)]
pub struct BaseResponse {
    pub status: &'static str,
    pub message: &'static str,
}

impl std::fmt::Display for BaseResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", serde_json::to_string(self).unwrap_or_default())
    }
}

#[derive(Serialize)]
struct MissingFieldsResponse {
    status: &'static str,
    message: &'static str,
    errors: Vec<String>,
}

#[derive(Serialize)]
struct ValidationErrorResponse {
    status: &'static str,
    message: &'static str,
    errors: HashMap<String, Vec<String>>,
}

#[derive(Serialize)]
struct SignInResponse {
    #[serde(flatten)]
    base: BaseResponse,
    token: String,
    user: UserDto,
}

#[post("/auth/sign-in")]
pub async fn sign_in(state: web::Data<AppState>, raw: web::Json<SigninRequestRaw>) -> HttpResponse {
    let mut missing_fields: Vec<String> = Vec::new();

    // Check all required fields first
    if raw.email.is_none() {
        missing_fields.push("email is required".to_string());
    }
    if raw.password.is_none() {
        missing_fields.push("password is required".to_string());
    }

    // If any required fields are missing, return early with array format
    if !missing_fields.is_empty() {
        return HttpResponse::BadRequest().json(MissingFieldsResponse {
            status: "error",
            message: "Validation failed",
            errors: missing_fields,
        });
    }

    // Now we can safely unwrap since we checked above
    let user_data = SigninRequest {
        email: raw.email.clone().unwrap(),
        password: raw.password.clone().unwrap(),
    };
    
    let mut errors: HashMap<String, Vec<String>> = HashMap::new();

    // Validate using validator crate
    if let Err(validation_errors) = user_data.validate() {
        for (field, field_errors) in validation_errors.field_errors() {
            let messages: Vec<String> = field_errors
                .iter()
                .map(|e| {
                    e.message
                        .as_ref()
                        .map(|m| m.to_string())
                        .unwrap_or_else(|| e.code.to_string())
                })
                .collect();
            errors.insert(field.to_string(), messages);
        }
    }

    // Validate password separately to get all errors
    let password_errors = validate_password(&user_data.password);
    if !password_errors.is_empty() {
        errors
            .entry("password".to_string())
            .or_default()
            .extend(password_errors);
    }

    // If validation errors, return with object format
    if !errors.is_empty() {
        return HttpResponse::BadRequest().json(ValidationErrorResponse {
            status: "error",
            message: "Validation failed",
            errors,
        });
    }

    let db = state.db.lock().await;

    let Ok(user) = db_user::sign_in(&db, &user_data).await else {
        return HttpResponse::Unauthorized().json(BaseResponse {
            status: "error",
            message: "Invalid email or password1",
        });
    };

    if !bcrypt::verify(&user_data.password, &user.password).unwrap_or(false) {
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
