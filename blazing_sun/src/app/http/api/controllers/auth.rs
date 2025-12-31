//! Authentication Controller
//!
//! Handles user authentication operations:
//! - Sign Up: Create a new user account
//! - Sign In: Authenticate and receive JWT token

use actix_web::{web, HttpResponse};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use validator::Validate;

use crate::app::http::api::controllers::responses::{
    BaseResponse, MissingFieldsResponse, UserDto, ValidationErrorResponse,
};
use crate::app::http::api::validators::auth::{
    validate_password, validate_passwords_match, SigninRequest, SigninRequestRaw, SignupRequest,
    SignupRequestRaw,
};
use crate::config::{ActivationConfig, JwtConfig};
use crate::database::mutations::activation_hash as db_activation_hash;
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
            Ok(JobStatus::Failed) => {
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to create user"))
            }
            Ok(_) => {
                HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Unexpected job status"))
            }
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
            return HttpResponse::Forbidden()
                .json(BaseResponse::error("Account not activated. Please check your email for activation code."));
        }

        // Check if user must set password
        if user.user_must_set_password == 1 {
            return HttpResponse::Forbidden()
                .json(BaseResponse::error("You must set your password before logging in. Please check your email."));
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

        HttpResponse::Ok().json(SignInResponse {
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
}
