//!
//! User Controller
//!
//! Handles user profile operations:
//! - GET /user: Get current user profile (from JWT)
//! - GET /user/{id}: Get user profile by ID
//! - PATCH /user: Full update (first_name, last_name required; balance, password optional)
//! - PUT /user: Partial update (at least one field required)
//! - POST /user: Admin create user (requires JWT)
//! - DELETE /user/{id}: Delete user
//!

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::Deserialize;
use std::collections::HashMap;
use tracing::info;
use uuid::Uuid;
use validator::Validate;

use crate::app::http::api::controllers::responses::{
    BaseResponse, MissingFieldsResponse, UserDto, ValidationErrorResponse,
};
use crate::app::http::api::validators::auth::validate_password;
use crate::app::http::api::validators::user::{PatchUserRequest, PatchUserRequestRaw, PutUserRequest};
use crate::config::ActivationConfig;
use crate::database::mutations::activation_hash as db_activation_hash;
use crate::database::mutations::user as db_mutations;
use crate::database::read::user as db_user;
use crate::database::AppState;
use crate::mq;
use crate::mq::jobs::email::{EmailTemplate, SendEmailParams};
use crate::mq::JobOptions;

/// User Controller
///
/// Provides methods for handling user routes.
pub struct UserController;

/// Admin create user request (raw)
#[derive(Deserialize, Debug)]
pub struct AdminCreateUserRequestRaw {
    pub email: Option<String>,
    pub password: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

/// Admin create user request (validated)
#[derive(Debug, Validate)]
pub struct AdminCreateUserRequest {
    #[validate(email(message = "invalid email format"))]
    pub email: String,
    pub password: String,
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub first_name: String,
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub last_name: String,
}

impl UserController {
    /// GET /user - Get current user profile from JWT
    ///
    /// # Responses
    /// - 200: User profile
    /// - 401: Unauthorized (no JWT or invalid JWT)
    /// - 404: User not found
    pub async fn get_current(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        // Get user ID from JWT (set by auth middleware)
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };
        info!("User ID: {}", user_id);
        let db = state.db.lock().await;

        match db_user::get_by_id(&db, user_id).await {
            Ok(user) => HttpResponse::Ok().json(UserResponse {
                base: BaseResponse::success("User retrieved successfully"),
                user: UserDto {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    balance: user.balance,
                    permissions: user.permissions,
                    avatar_uuid: user.avatar_uuid.map(|u| u.to_string()),
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                },
            }),
            Err(_) => HttpResponse::NotFound().json(BaseResponse::error("User not found")),
        }
    }

    /// GET /user/{id} - Get user profile by ID
    ///
    /// # Path Parameters
    /// - `id`: User ID
    ///
    /// # Responses
    /// - 200: User profile
    /// - 404: User not found
    pub async fn get_by_id(state: web::Data<AppState>, path: web::Path<i64>) -> HttpResponse {
        let user_id = path.into_inner();
        let db = state.db.lock().await;

        match db_user::get_by_id(&db, user_id).await {
            Ok(user) => HttpResponse::Ok().json(UserResponse {
                base: BaseResponse::success("User retrieved successfully"),
                user: UserDto {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    balance: user.balance,
                    permissions: user.permissions,
                    avatar_uuid: user.avatar_uuid.map(|u| u.to_string()),
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                },
            }),
            Err(_) => HttpResponse::NotFound().json(BaseResponse::error("User not found")),
        }
    }

    /// PATCH /user - Full update (first_name, last_name required; balance, password optional)
    /// Email is NOT updatable
    ///
    /// # Request Body
    /// ```json
    /// {
    ///     "first_name": "John",
    ///     "last_name": "Doe",
    ///     "balance": 1000,
    ///     "password": "NewPassword123!"
    /// }
    /// ```
    ///
    /// # Responses
    /// - 200: User updated successfully
    /// - 400: Validation failed
    /// - 401: Unauthorized
    /// - 500: Internal server error
    pub async fn update_full(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<PatchUserRequestRaw>,
    ) -> HttpResponse {
        // Get user ID from JWT
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        let raw = body.into_inner();
        let mut missing_fields: Vec<String> = Vec::new();

        // Check required fields (first_name and last_name)
        if raw.first_name.is_none() {
            missing_fields.push("first_name is required".to_string());
        }
        if raw.last_name.is_none() {
            missing_fields.push("last_name is required".to_string());
        }

        if !missing_fields.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(missing_fields));
        }

        let update_data = PatchUserRequest {
            first_name: raw.first_name.unwrap(),
            last_name: raw.last_name.unwrap(),
            balance: raw.balance,
            password: raw.password,
        };

        // Validate fields
        let mut errors: HashMap<String, Vec<String>> = HashMap::new();
        if let Err(validation_errors) = update_data.validate() {
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

        // Validate password if provided
        let password_errors = update_data.validate_password_if_present();
        if !password_errors.is_empty() {
            errors
                .entry("password".to_string())
                .or_default()
                .extend(password_errors);
        }

        // Validate balance if provided
        if let Some(balance) = update_data.balance {
            if balance < 0 {
                errors
                    .entry("balance".to_string())
                    .or_default()
                    .push("must be non-negative".to_string());
            }
        }

        if !errors.is_empty() {
            return HttpResponse::BadRequest().json(ValidationErrorResponse::new(errors));
        }

        let db = state.db.lock().await;

        let params = db_mutations::UpdateUserFullParams {
            first_name: update_data.first_name,
            last_name: update_data.last_name,
            balance: update_data.balance,
            password: update_data.password,
        };

        match db_mutations::update_full(&db, user_id, &params).await {
            Ok(_) => {
                // Fetch updated user
                match db_user::get_by_id(&db, user_id).await {
                    Ok(user) => HttpResponse::Ok().json(UserResponse {
                        base: BaseResponse::success("User updated successfully"),
                        user: UserDto {
                            id: user.id,
                            email: user.email,
                            first_name: user.first_name,
                            last_name: user.last_name,
                            balance: user.balance,
                            permissions: user.permissions,
                            avatar_uuid: user.avatar_uuid.map(|u| u.to_string()),
                            created_at: user.created_at,
                            updated_at: user.updated_at,
                        },
                    }),
                    Err(_) => HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to retrieve updated user")),
                }
            }
            Err(e) => {
                tracing::error!("Failed to update user: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update user"))
            }
        }
    }

    /// PUT /user - Partial update (at least ONE field required)
    /// Email is NOT updatable
    ///
    /// # Request Body
    /// ```json
    /// {
    ///     "first_name": "John"  // Only fields to update
    /// }
    /// ```
    ///
    /// # Responses
    /// - 200: User updated successfully
    /// - 400: Validation failed (no fields provided or invalid values)
    /// - 401: Unauthorized
    /// - 500: Internal server error
    pub async fn update_partial(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<PutUserRequest>,
    ) -> HttpResponse {
        // Get user ID from JWT
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        let update_data = body.into_inner();

        // Check if at least one field is provided
        if !update_data.has_any_field() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(vec![
                "at least one field is required (first_name, last_name, balance, or password)"
                    .to_string(),
            ]));
        }

        // Validate provided fields
        let field_errors = update_data.validate_fields();
        if !field_errors.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(field_errors));
        }

        let db = state.db.lock().await;

        let params = db_mutations::UpdateUserPartialParams {
            first_name: update_data.first_name,
            last_name: update_data.last_name,
            balance: update_data.balance,
            password: update_data.password,
        };

        match db_mutations::update_partial(&db, user_id, &params).await {
            Ok(_) => {
                // Fetch updated user
                match db_user::get_by_id(&db, user_id).await {
                    Ok(user) => HttpResponse::Ok().json(UserResponse {
                        base: BaseResponse::success("User updated successfully"),
                        user: UserDto {
                            id: user.id,
                            email: user.email,
                            first_name: user.first_name,
                            last_name: user.last_name,
                            balance: user.balance,
                            permissions: user.permissions,
                            avatar_uuid: user.avatar_uuid.map(|u| u.to_string()),
                            created_at: user.created_at,
                            updated_at: user.updated_at,
                        },
                    }),
                    Err(_) => HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to retrieve updated user")),
                }
            }
            Err(e) => {
                tracing::error!("Failed to update user: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update user"))
            }
        }
    }

    /// POST /user - Admin create user (requires JWT)
    /// Creates a user with user_must_set_password = 1 and activated = 0
    /// Sends email with activation link
    ///
    /// # Request Body
    /// ```json
    /// {
    ///     "email": "user@example.com",
    ///     "password": "TempPassword123!",
    ///     "first_name": "John",
    ///     "last_name": "Doe"
    /// }
    /// ```
    ///
    /// # Responses
    /// - 201: User created successfully
    /// - 400: Validation failed
    /// - 401: Unauthorized
    /// - 409: User already exists
    /// - 500: Internal server error
    pub async fn admin_create(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<AdminCreateUserRequestRaw>,
    ) -> HttpResponse {
        // Verify admin is authenticated (JWT middleware already did this)
        if req.extensions().get::<i64>().is_none() {
            return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
        }

        let raw = body.into_inner();
        let mut missing_fields: Vec<String> = Vec::new();

        // Check all required fields
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

        if !missing_fields.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(missing_fields));
        }

        let user_data = AdminCreateUserRequest {
            email: raw.email.unwrap(),
            password: raw.password.unwrap(),
            first_name: raw.first_name.unwrap(),
            last_name: raw.last_name.unwrap(),
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

        // Validate password
        let password_errors = validate_password(&user_data.password);
        if !password_errors.is_empty() {
            errors
                .entry("password".to_string())
                .or_default()
                .extend(password_errors);
        }

        if !errors.is_empty() {
            return HttpResponse::BadRequest().json(ValidationErrorResponse::new(errors));
        }

        let db = state.db.lock().await;

        // Check if user already exists
        if db_user::has_with_email(&db, &user_data.email).await {
            return HttpResponse::Conflict().json(BaseResponse::error("User already exists"));
        }

        // Create user with user_must_set_password = 1 and activated = 0
        let params = db_mutations::CreateUserAdminParams {
            email: user_data.email.clone(),
            password: user_data.password,
            first_name: user_data.first_name.clone(),
            last_name: user_data.last_name.clone(),
            user_must_set_password: 1,
            activated: 0,
        };

        match db_mutations::create_admin(&db, &params).await {
            Ok(user_id) => {
                // Create activation hash
                let hash = db_activation_hash::generate_hash();
                let expiry_minutes = ActivationConfig::expiry_user_must_set_password();

                if let Err(e) = db_activation_hash::create(
                    &db,
                    user_id,
                    &hash,
                    "user_must_set_password",
                    expiry_minutes,
                )
                .await
                {
                    tracing::error!("Failed to create activation hash: {}", e);
                    return HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to create user"));
                }

                // Send email with password setup link
                if let Some(ref mq) = state.mq {
                    let email_params = SendEmailParams::new(
                        &user_data.email,
                        &user_data.first_name,
                        EmailTemplate::UserMustSetPassword,
                    )
                    .with_variable("first_name", &user_data.first_name)
                    .with_variable("user_id", &user_id.to_string())
                    .with_variable("hash", &hash);

                    let email_options = JobOptions::new().priority(1).fault_tolerance(3);

                    if let Err(e) =
                        mq::enqueue_job_dyn(mq, "send_email", &email_params, email_options).await
                    {
                        tracing::warn!("Failed to queue password setup email: {}", e);
                    }
                }

                HttpResponse::Created().json(BaseResponse::success("User created successfully"))
            }
            Err(e) => {
                tracing::error!("Failed to create user: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create user"))
            }
        }
    }

    /// DELETE /user/{id} - Delete user
    ///
    /// # Path Parameters
    /// - `id`: User ID
    ///
    /// # Responses
    /// - 200: User deleted successfully
    /// - 401: Unauthorized
    /// - 404: User not found
    /// - 500: Internal server error
    pub async fn delete(
        state: web::Data<AppState>,
        req: HttpRequest,
        path: web::Path<i64>,
    ) -> HttpResponse {
        // Verify admin is authenticated
        if req.extensions().get::<i64>().is_none() {
            return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
        }

        let user_id = path.into_inner();
        let db = state.db.lock().await;

        match db_mutations::delete(&db, user_id).await {
            Ok(true) => HttpResponse::Ok().json(BaseResponse::success("User deleted successfully")),
            Ok(false) => HttpResponse::NotFound().json(BaseResponse::error("User not found")),
            Err(e) => {
                tracing::error!("Failed to delete user: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to delete user"))
            }
        }
    }

    /// PATCH /user/avatar - Update user's profile picture
    ///
    /// # Request Body
    /// ```json
    /// {
    ///     "avatar_uuid": "550e8400-e29b-41d4-a716-446655440000"
    /// }
    /// ```
    ///
    /// # Responses
    /// - 200: Avatar updated successfully
    /// - 400: Invalid UUID format
    /// - 401: Unauthorized
    /// - 500: Internal server error
    pub async fn update_avatar(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<UpdateAvatarRequest>,
    ) -> HttpResponse {
        // Get user ID from JWT
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        let avatar_uuid = match &body.avatar_uuid {
            Some(uuid_str) => {
                match Uuid::parse_str(uuid_str) {
                    Ok(uuid) => Some(uuid),
                    Err(_) => {
                        return HttpResponse::BadRequest()
                            .json(BaseResponse::error("Invalid UUID format"));
                    }
                }
            }
            None => None,
        };

        let db = state.db.lock().await;

        match db_mutations::update_avatar(&db, user_id, avatar_uuid).await {
            Ok(_) => {
                // Fetch updated user
                match db_user::get_by_id(&db, user_id).await {
                    Ok(user) => HttpResponse::Ok().json(UserResponse {
                        base: BaseResponse::success("Avatar updated successfully"),
                        user: UserDto {
                            id: user.id,
                            email: user.email,
                            first_name: user.first_name,
                            last_name: user.last_name,
                            balance: user.balance,
                            permissions: user.permissions,
                            avatar_uuid: user.avatar_uuid.map(|u| u.to_string()),
                            created_at: user.created_at,
                            updated_at: user.updated_at,
                        },
                    }),
                    Err(_) => HttpResponse::InternalServerError()
                        .json(BaseResponse::error("Failed to retrieve updated user")),
                }
            }
            Err(e) => {
                tracing::error!("Failed to update avatar: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to update avatar"))
            }
        }
    }
}

/// Request to update user avatar
#[derive(Deserialize, Debug)]
pub struct UpdateAvatarRequest {
    pub avatar_uuid: Option<String>,
}

/// User response structure
#[derive(serde::Serialize)]
struct UserResponse {
    #[serde(flatten)]
    base: BaseResponse,
    user: UserDto,
}
