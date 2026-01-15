//! Authentication Controller
//!
//! Handles user authentication operations:
//! - Sign Up: Create a new user account
//! - Sign In: Authenticate and receive JWT token

use actix_web::{web, HttpRequest, HttpResponse};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use validator::Validate;

use crate::app::http::api::controllers::responses::{
    BaseResponse, MissingFieldsResponse, UserDto, ValidationErrorResponse,
};
use crate::app::http::api::validators::auth::{
    validate_name, validate_password, validate_passwords_match, SigninRequest, SigninRequestRaw,
    SignupRequest, SignupRequestRaw,
};
use crate::config::{ActivationConfig, JwtConfig};
use crate::database::mutations::activation_hash as db_activation_hash;
use crate::database::mutations::session_refresh_token as db_refresh_token_mut;
use crate::database::read::session_refresh_token as db_refresh_token;
use crate::database::read::user as db_user;
use crate::database::AppState;
use crate::events;
use crate::mq::jobs::create_user::CreateUserParams;
use crate::mq::jobs::email::{EmailTemplate, SendEmailParams};
use crate::mq::{self, JobOptions, JobStatus};

/// JWT Claims structure
#[derive(Serialize, Deserialize, Debug)]
pub struct Claims {
    pub sub: i64,
    pub role: String,
    pub permissions: i16,
    pub exp: i64,
}

/// Sign In Response
#[derive(Serialize)]
struct SignInResponse {
    #[serde(flatten)]
    base: BaseResponse,
    token: String,
    user: UserDto,
}

/// Authentication Controller
///
/// Provides static methods for handling authentication routes.
pub struct AuthController;

impl AuthController {
    /// Sign Up - Create a new user account
    ///
    /// # Route
    /// `POST /api/v1/auth/sign-up`
    ///
    /// # Request Body
    /// ```json
    /// {
    ///     "email": "user@example.com",
    ///     "password": "SecurePass123!",
    ///     "first_name": "John",
    ///     "last_name": "Doe"
    /// }
    /// ```
    ///
    /// # Responses
    /// - 201: User created successfully
    /// - 400: Validation failed
    /// - 409: User already exists
    /// - 500: Internal server error
    pub async fn sign_up(
        state: web::Data<AppState>,
        body: web::Json<SignupRequestRaw>,
    ) -> HttpResponse {
        let raw = body.into_inner();
        let mut missing_fields: Vec<String> = Vec::new();

        // Check all required fields first
        if raw.email.is_none() {
            missing_fields.push("email is required".to_string());
        }
        if raw.password.is_none() {
            missing_fields.push("password is required".to_string());
        }
        if raw.confirm_password.is_none() {
            missing_fields.push("confirm_password is required".to_string());
        }
        if raw.first_name.is_none() {
            missing_fields.push("first_name is required".to_string());
        }
        if raw.last_name.is_none() {
            missing_fields.push("last_name is required".to_string());
        }

        // If any required fields are missing, return early
        if !missing_fields.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(missing_fields));
        }

        // Now we can safely unwrap since we checked above
        let user = SignupRequest {
            email: raw.email.clone().unwrap(),
            password: raw.password.clone().unwrap(),
            confirm_password: raw.confirm_password.clone().unwrap(),
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

        // Validate that password and confirm_password match
        if let Some(mismatch_error) =
            validate_passwords_match(&user.password, &user.confirm_password)
        {
            errors
                .entry("confirm_password".to_string())
                .or_default()
                .push(mismatch_error);
        }

        // Validate first_name (letters only, min 2 chars)
        let first_name_errors = validate_name(&user.first_name, "first_name");
        if !first_name_errors.is_empty() {
            errors
                .entry("first_name".to_string())
                .or_default()
                .extend(first_name_errors);
        }

        // Validate last_name (letters only, min 2 chars)
        let last_name_errors = validate_name(&user.last_name, "last_name");
        if !last_name_errors.is_empty() {
            errors
                .entry("last_name".to_string())
                .or_default()
                .extend(last_name_errors);
        }

        // If validation errors, return with object format
        if !errors.is_empty() {
            return HttpResponse::BadRequest().json(ValidationErrorResponse::new(errors));
        }

        let db = state.db.lock().await;

        if db_user::has_with_email(&db, &user.email).await {
            return HttpResponse::Conflict().json(BaseResponse::error("User already exists"));
        }

        // Queue the user creation job
        let Some(ref mq) = state.mq else {
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Message queue not available"));
        };

        let params = CreateUserParams {
            email: user.email.clone(),
            password: user.password.clone(),
            first_name: user.first_name.clone(),
            last_name: user.last_name.clone(),
        };

        let options = JobOptions::new()
            .priority(0) // FIFO
            .fault_tolerance(3); // Retry 3 times

        match mq::enqueue_and_wait_dyn(mq, "create_user", &params, options, 30000).await {
            Ok(JobStatus::Completed) => {
                // Get the created user to get the ID
                let created_user = match db_user::get_by_email(&db, &user.email).await {
                    Ok(u) => u,
                    Err(_) => {
                        return HttpResponse::InternalServerError()
                            .json(BaseResponse::error("Failed to retrieve created user"));
                    }
                };

                // Generate activation hash
                let hash = db_activation_hash::generate_hash();
                let expiry_minutes = ActivationConfig::expiry_account_activation();

                if let Err(e) = db_activation_hash::create(
                    &db,
                    created_user.id,
                    &hash,
                    "activation",
                    expiry_minutes,
                )
                .await
                {
                    tracing::error!("Failed to create activation hash: {}", e);
                    // User is created but activation hash failed - still return success
                    // but log the error
                }

                // Queue activation email (fire and forget)
                let email_params = SendEmailParams::new(
                    &user.email,
                    &user.first_name,
                    EmailTemplate::AccountActivation,
                )
                .with_variable("first_name", &user.first_name)
                .with_variable("email", &user.email)
                .with_variable("activation_code", &hash);

                let email_options = JobOptions::new()
                    .priority(1) // Low priority
                    .fault_tolerance(3);

                // Fire and forget - don't wait for email
                if let Err(e) =
                    mq::enqueue_job_dyn(mq, "send_email", &email_params, email_options).await
                {
                    tracing::warn!("Failed to queue activation email: {}", e);
                }

                // Publish user.created event to Kafka
                if let Some(event_bus) = state.event_bus() {
                    if let Err(e) = events::publish::user_created(
                        event_bus,
                        created_user.id,
                        &user.email,
                        &user.first_name,
                        &user.last_name,
                        None, // No actor for self-registration
                    )
                    .await
                    {
                        tracing::warn!("Failed to publish user.created event: {}", e);
                    }
                }

                HttpResponse::Created().json(BaseResponse::success(
                    "User created successfully. Please check your email for activation code.",
                ))
            }
            Ok(JobStatus::Failed) => HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to create user")),
            Ok(_) => HttpResponse::InternalServerError()
                .json(BaseResponse::error("Unexpected job status")),
            Err(e) => {
                tracing::error!("Job error: {}", e);
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create user"))
            }
        }
    }

    /// Sign In - Authenticate and receive JWT token
    ///
    /// # Route
    /// `POST /api/v1/auth/sign-in`
    ///
    /// # Request Body
    /// ```json
    /// {
    ///     "email": "user@example.com",
    ///     "password": "SecurePass123!"
    /// }
    /// ```
    ///
    /// # Responses
    /// - 200: Signed in successfully (includes JWT token)
    /// - 400: Validation failed
    /// - 401: Invalid credentials
    pub async fn sign_in(
        state: web::Data<AppState>,
        body: web::Json<SigninRequestRaw>,
    ) -> HttpResponse {
        let raw = body.into_inner();
        let mut missing_fields: Vec<String> = Vec::new();

        // Check all required fields first
        if raw.email.is_none() {
            missing_fields.push("email is required".to_string());
        }
        if raw.password.is_none() {
            missing_fields.push("password is required".to_string());
        }

        // If any required fields are missing, return early
        if !missing_fields.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(missing_fields));
        }

        // Now we can safely unwrap since we checked above
        let user_data = SigninRequest {
            email: raw.email.clone().unwrap(),
            password: raw.password.clone().unwrap(),
            remember_me: raw.remember_me,
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
            return HttpResponse::BadRequest().json(ValidationErrorResponse::new(errors));
        }

        let db = state.db.lock().await;

        let Ok(user) = db_user::sign_in(&db, &user_data).await else {
            // Publish auth.sign_in_failed event
            if let Some(event_bus) = state.event_bus() {
                let _ = events::publish::auth_sign_in_failed(
                    event_bus,
                    &user_data.email,
                    "user_not_found",
                    None,
                    None,
                )
                .await;
            }
            return HttpResponse::Unauthorized()
                .json(BaseResponse::error("Invalid email or password"));
        };

        if !bcrypt::verify(&user_data.password, &user.password).unwrap_or(false) {
            // Publish auth.sign_in_failed event
            if let Some(event_bus) = state.event_bus() {
                let _ = events::publish::auth_sign_in_failed(
                    event_bus,
                    &user_data.email,
                    "invalid_password",
                    None,
                    None,
                )
                .await;
            }
            return HttpResponse::Unauthorized()
                .json(BaseResponse::error("Invalid email or password"));
        }

        // Check if user is activated
        if user.activated == 0 {
            return HttpResponse::Forbidden().json(BaseResponse::error(
                "Account not activated. Please check your email for activation code.",
            ));
        }

        // Check if user must set password
        if user.user_must_set_password == 1 {
            return HttpResponse::Forbidden().json(BaseResponse::error(
                "You must set your password before logging in. Please check your email.",
            ));
        }

        let claims = Claims {
            sub: user.id,
            role: "user".to_string(),
            permissions: user.permissions,
            exp: (Utc::now() + Duration::minutes(JwtConfig::expiration_minutes())).timestamp(),
        };

        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(state.jwt_secret.as_bytes()),
        )
        .unwrap();

        // Publish auth.sign_in event to Kafka
        if let Some(event_bus) = state.event_bus() {
            if let Err(e) = events::publish::auth_sign_in(
                event_bus,
                user.id,
                &user.email,
                None, // TODO: extract from request
                None, // TODO: extract from request
            )
            .await
            {
                tracing::warn!("Failed to publish auth.sign_in event: {}", e);
            }
        }

        // Set auth_token cookie for browser requests (e.g., <img> tags loading avatar)
        use actix_web::cookie::{Cookie, SameSite};
        let cookie = Cookie::build("auth_token", token.clone())
            .path("/")
            .max_age(actix_web::cookie::time::Duration::minutes(
                JwtConfig::expiration_minutes(),
            ))
            .http_only(true)
            .same_site(SameSite::Lax)
            .finish();

        let mut response = HttpResponse::Ok();
        response.cookie(cookie);

        // If remember_me is checked, create a long-lived refresh token
        if user_data.remember_me {
            let refresh_token = match db_refresh_token_mut::create(
                &db, user.id, None, // TODO: extract device info from User-Agent
                None, // TODO: extract IP from request
            )
            .await
            {
                Ok(token) => token,
                Err(e) => {
                    tracing::warn!("Failed to create refresh token: {}", e);
                    // Continue without refresh token - not critical
                    return response.json(SignInResponse {
                        base: BaseResponse::success("Signed in successfully"),
                        token,
                        user: UserDto {
                            id: user.id,
                            email: user.email.clone(),
                            first_name: user.first_name.clone(),
                            last_name: user.last_name.clone(),
                            balance: user.balance,
                            permissions: user.permissions,
                            avatar_uuid: user.avatar_uuid.map(|u| u.to_string()),
                            created_at: user.created_at,
                            updated_at: user.updated_at,
                        },
                    });
                }
            };

            // Set refresh_token cookie (long-lived, HttpOnly, Secure)
            let refresh_cookie = Cookie::build("refresh_token", refresh_token)
                .path("/api/v1/auth")
                .max_age(actix_web::cookie::time::Duration::days(
                    JwtConfig::refresh_expiration_days(),
                ))
                .http_only(true)
                .same_site(SameSite::Strict)
                .finish();
            response.cookie(refresh_cookie);
        }

        response.json(SignInResponse {
            base: BaseResponse::success("Signed in successfully"),
            token,
            user: UserDto {
                id: user.id,
                email: user.email.clone(),
                first_name: user.first_name.clone(),
                last_name: user.last_name.clone(),
                balance: user.balance,
                permissions: user.permissions,
                avatar_uuid: user.avatar_uuid.map(|u| u.to_string()),
                created_at: user.created_at,
                updated_at: user.updated_at,
            },
        })
    }

    /// Sign Out - Revoke refresh token
    ///
    /// # Route
    /// `POST /api/v1/auth/sign-out`
    ///
    /// # Responses
    /// - 200: Signed out successfully
    pub async fn sign_out(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        use actix_web::cookie::{Cookie, SameSite};

        let db = state.db.lock().await;

        // Get refresh token from cookie
        if let Some(refresh_cookie) = req.cookie("refresh_token") {
            let token_hash = db_refresh_token_mut::hash_token(refresh_cookie.value());
            if let Err(e) = db_refresh_token_mut::revoke_by_hash(&db, &token_hash).await {
                tracing::warn!("Failed to revoke refresh token: {}", e);
            }
        }

        // Clear both cookies
        let clear_auth = Cookie::build("auth_token", "")
            .path("/")
            .max_age(actix_web::cookie::time::Duration::ZERO)
            .http_only(true)
            .same_site(SameSite::Lax)
            .finish();

        let clear_refresh = Cookie::build("refresh_token", "")
            .path("/api/v1/auth")
            .max_age(actix_web::cookie::time::Duration::ZERO)
            .http_only(true)
            .same_site(SameSite::Strict)
            .finish();

        HttpResponse::Ok()
            .cookie(clear_auth)
            .cookie(clear_refresh)
            .json(BaseResponse::success("Signed out successfully"))
    }

    /// Refresh - Exchange refresh token for new access token
    ///
    /// # Route
    /// `POST /api/v1/auth/refresh`
    ///
    /// # Responses
    /// - 200: New access token issued
    /// - 401: Invalid or expired refresh token
    pub async fn refresh(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        use actix_web::cookie::{Cookie, SameSite};

        // Get refresh token from cookie
        let refresh_cookie = match req.cookie("refresh_token") {
            Some(cookie) => cookie,
            None => {
                return HttpResponse::Unauthorized()
                    .json(BaseResponse::error("No refresh token provided"));
            }
        };

        let token_hash = db_refresh_token_mut::hash_token(refresh_cookie.value());
        let db = state.db.lock().await;

        // Validate refresh token
        let refresh_record = match db_refresh_token::get_valid_by_hash(&db, &token_hash).await {
            Ok(record) => record,
            Err(_) => {
                return HttpResponse::Unauthorized()
                    .json(BaseResponse::error("Invalid or expired refresh token"));
            }
        };

        // Update last_used_at
        if let Err(e) = db_refresh_token_mut::update_last_used(&db, &token_hash).await {
            tracing::warn!("Failed to update refresh token last_used_at: {}", e);
        }

        // Get user
        let user = match db_user::get_by_id(&db, refresh_record.user_id).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("User not found"));
            }
        };

        // Check if user is still active
        if user.activated == 0 {
            return HttpResponse::Forbidden().json(BaseResponse::error("Account not activated"));
        }

        // Generate new access token
        let claims = Claims {
            sub: user.id,
            role: "user".to_string(),
            permissions: user.permissions,
            exp: (Utc::now() + Duration::minutes(JwtConfig::expiration_minutes())).timestamp(),
        };

        let token = jsonwebtoken::encode(
            &jsonwebtoken::Header::default(),
            &claims,
            &jsonwebtoken::EncodingKey::from_secret(state.jwt_secret.as_bytes()),
        )
        .unwrap();

        // Set new auth_token cookie
        let cookie = Cookie::build("auth_token", token.clone())
            .path("/")
            .max_age(actix_web::cookie::time::Duration::minutes(
                JwtConfig::expiration_minutes(),
            ))
            .http_only(true)
            .same_site(SameSite::Lax)
            .finish();

        HttpResponse::Ok().cookie(cookie).json(SignInResponse {
            base: BaseResponse::success("Token refreshed successfully"),
            token,
            user: UserDto {
                id: user.id,
                email: user.email.clone(),
                first_name: user.first_name.clone(),
                last_name: user.last_name.clone(),
                balance: user.balance,
                permissions: user.permissions,
                avatar_uuid: user.avatar_uuid.map(|u| u.to_string()),
                created_at: user.created_at,
                updated_at: user.updated_at,
            },
        })
    }

    /// Sign Out All - Revoke all refresh tokens for a user (logout from all devices)
    ///
    /// # Route
    /// `POST /api/v1/auth/sign-out-all`
    ///
    /// # Responses
    /// - 200: Signed out from all devices
    /// - 401: Not authenticated
    pub async fn sign_out_all(state: web::Data<AppState>, req: HttpRequest) -> HttpResponse {
        use actix_web::cookie::{Cookie, SameSite};

        // Get user_id from JWT (must be authenticated)
        let token = match req.cookie("auth_token") {
            Some(cookie) => cookie.value().to_string(),
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Not authenticated"));
            }
        };

        let claims = match jsonwebtoken::decode::<Claims>(
            &token,
            &jsonwebtoken::DecodingKey::from_secret(state.jwt_secret.as_bytes()),
            &jsonwebtoken::Validation::default(),
        ) {
            Ok(data) => data.claims,
            Err(_) => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Invalid token"));
            }
        };

        let db = state.db.lock().await;

        // Revoke all refresh tokens for this user
        match db_refresh_token_mut::revoke_all_for_user(&db, claims.sub).await {
            Ok(count) => {
                tracing::info!("Revoked {} refresh tokens for user {}", count, claims.sub);
            }
            Err(e) => {
                tracing::error!("Failed to revoke all refresh tokens: {}", e);
            }
        }

        // Clear current session cookies
        let clear_auth = Cookie::build("auth_token", "")
            .path("/")
            .max_age(actix_web::cookie::time::Duration::ZERO)
            .http_only(true)
            .same_site(SameSite::Lax)
            .finish();

        let clear_refresh = Cookie::build("refresh_token", "")
            .path("/api/v1/auth")
            .max_age(actix_web::cookie::time::Duration::ZERO)
            .http_only(true)
            .same_site(SameSite::Strict)
            .finish();

        HttpResponse::Ok()
            .cookie(clear_auth)
            .cookie(clear_refresh)
            .json(BaseResponse::success("Signed out from all devices"))
    }
}
