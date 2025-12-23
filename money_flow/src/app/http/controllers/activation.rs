//! Activation Controller
//!
//! Handles account activation and password reset operations:
//! - POST /activate-account: Activate user account with code
//! - POST /forgot-password: Request password reset
//! - POST /verify-hash: Verify hash code
//! - POST /reset-password: Reset password with verified hash
//! - GET /set-password-when-needed: Verify password setup link
//! - POST /set-password-when-needed: Set password for admin-created users
//! - POST /change-password: Request password change (authenticated)
//! - POST /verify-password-change: Verify and complete password change (authenticated)

use actix_web::{HttpMessage, HttpRequest, HttpResponse, web};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use validator::Validate;

use crate::app::http::controllers::responses::{
    BaseResponse, MissingFieldsResponse, ValidationErrorResponse,
};
use crate::app::http::validators::auth::validate_password;
use crate::config::ActivationConfig;
use crate::db::mutations::activation_hash as db_activation_hash;
use crate::db::mutations::user as db_user_mutations;
use crate::db::read::user as db_user;
use crate::db::AppState;
use crate::mq;
use crate::mq::jobs::email::{EmailTemplate, SendEmailParams};
use crate::mq::JobOptions;

/// Activation Controller
pub struct ActivationController;

// ============================================
// Request/Response Structures
// ============================================

#[derive(Deserialize, Debug)]
pub struct ActivateAccountRequest {
    pub code: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct ForgotPasswordRequest {
    pub email: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct VerifyHashRequest {
    pub code: Option<String>,
}

#[derive(Serialize)]
struct VerifyHashResponse {
    #[serde(flatten)]
    base: BaseResponse,
    code: String,
}

#[derive(Deserialize, Debug)]
pub struct ResetPasswordRequestRaw {
    pub code: Option<String>,
    pub password: Option<String>,
    pub confirm_password: Option<String>,
}

#[derive(Debug, Validate)]
pub struct ResetPasswordRequest {
    pub code: String,
    pub password: String,
    pub confirm_password: String,
}

/// Response structure for reset password validation errors
#[derive(Serialize)]
struct ResetPasswordValidationErrors {
    pub status: &'static str,
    pub message: &'static str,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub code_errors: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub password_errors: Vec<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub confirm_password_errors: Vec<String>,
}

impl ResetPasswordValidationErrors {
    fn new() -> Self {
        Self {
            status: "error",
            message: "Validation failed",
            code_errors: Vec::new(),
            password_errors: Vec::new(),
            confirm_password_errors: Vec::new(),
        }
    }

    fn has_errors(&self) -> bool {
        !self.code_errors.is_empty()
            || !self.password_errors.is_empty()
            || !self.confirm_password_errors.is_empty()
    }
}

#[derive(Deserialize, Debug)]
pub struct SetPasswordQuery {
    pub user_id: i64,
    pub hash: String,
}

#[derive(Deserialize, Debug)]
pub struct SetPasswordRequestRaw {
    pub user_id: Option<i64>,
    pub hash: Option<String>,
    pub password: Option<String>,
    pub confirm_password: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct ChangePasswordVerifyRequestRaw {
    pub code: Option<String>,
    pub password: Option<String>,
    pub confirm_password: Option<String>,
}

impl ActivationController {
    /// POST /activate-account - Activate user account with code
    ///
    /// # Request Body
    /// ```json
    /// { "code": "40-character-activation-code" }
    /// ```
    ///
    /// # Responses
    /// - 200: Account activated successfully
    /// - 400: Invalid or missing code
    /// - 404: Code not found or expired
    pub async fn activate_account(
        state: web::Data<AppState>,
        body: web::Json<ActivateAccountRequest>,
    ) -> HttpResponse {
        let raw = body.into_inner();

        let Some(code) = raw.code else {
            return HttpResponse::BadRequest()
                .json(MissingFieldsResponse::new(vec!["code is required".to_string()]));
        };

        if code.len() != 40 {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Invalid activation code format"));
        }

        let db = state.db.lock().await;

        // Find the activation hash
        let hash_record = match db_activation_hash::find_by_hash(&db, &code).await {
            Ok(record) => record,
            Err(_) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Invalid or expired activation code"));
            }
        };

        // Validate the hash
        if !db_activation_hash::is_valid(&hash_record) {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Activation code has expired or already been used"));
        }

        // Check hash type
        if hash_record.hash_type != "activation" {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Invalid activation code"));
        }

        // Activate the user
        if let Err(e) = db_user_mutations::set_activated(&db, hash_record.user_id, 1).await {
            tracing::error!("Failed to activate user: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to activate account"));
        }

        // Mark hash as used
        if let Err(e) = db_activation_hash::mark_as_used(&db, hash_record.id).await {
            tracing::error!("Failed to mark hash as used: {}", e);
        }

        // Send success email
        if let Some(ref mq) = state.mq {
            if let Ok(user) = db_user::get_by_id(&db, hash_record.user_id).await {
                let email_params = SendEmailParams::new(
                    &user.email,
                    &user.first_name,
                    EmailTemplate::ActivationSuccess,
                )
                .with_variable("first_name", &user.first_name)
                .with_variable("email", &user.email)
                .with_variable("login_url", "/login");

                let email_options = JobOptions::new().priority(1).fault_tolerance(3);

                if let Err(e) =
                    mq::enqueue_job_dyn(mq, "send_email", &email_params, email_options).await
                {
                    tracing::warn!("Failed to queue activation success email: {}", e);
                }
            }
        }

        HttpResponse::Ok().json(BaseResponse::success("Account activated successfully"))
    }

    /// POST /forgot-password - Request password reset
    ///
    /// # Request Body
    /// ```json
    /// { "email": "user@example.com" }
    /// ```
    ///
    /// # Responses
    /// - 200: Password reset email sent (always returns success for security)
    pub async fn forgot_password(
        state: web::Data<AppState>,
        body: web::Json<ForgotPasswordRequest>,
    ) -> HttpResponse {
        let raw = body.into_inner();

        let Some(email) = raw.email else {
            return HttpResponse::BadRequest()
                .json(MissingFieldsResponse::new(vec!["email is required".to_string()]));
        };

        let db = state.db.lock().await;

        // Check if user exists (but always return success for security)
        let user = match db_user::get_by_email(&db, &email).await {
            Ok(user) => user,
            Err(_) => {
                // Don't reveal if email exists
                return HttpResponse::Ok()
                    .json(BaseResponse::success("If the email exists, a reset code has been sent"));
            }
        };

        // Generate hash
        let hash = db_activation_hash::generate_hash();
        let expiry_minutes = ActivationConfig::expiry_forgot_password();

        if let Err(e) =
            db_activation_hash::create(&db, user.id, &hash, "forgot_password", expiry_minutes).await
        {
            tracing::error!("Failed to create reset hash: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to process request"));
        }

        // Send email
        if let Some(ref mq) = state.mq {
            let email_params =
                SendEmailParams::new(&user.email, &user.first_name, EmailTemplate::ForgotPassword)
                    .with_variable("first_name", &user.first_name)
                    .with_variable("email", &user.email)
                    .with_variable("reset_code", &hash);

            let email_options = JobOptions::new().priority(1).fault_tolerance(3);

            if let Err(e) =
                mq::enqueue_job_dyn(mq, "send_email", &email_params, email_options).await
            {
                tracing::warn!("Failed to queue forgot password email: {}", e);
            }
        }

        HttpResponse::Ok()
            .json(BaseResponse::success("If the email exists, a reset code has been sent"))
    }

    /// POST /verify-hash - Verify hash code and get temporary token
    ///
    /// # Request Body
    /// ```json
    /// { "code": "40-character-hash-code" }
    /// ```
    ///
    /// # Responses
    /// - 200: Hash verified, returns temporary token
    /// - 400: Invalid code
    /// - 404: Code not found or expired
    pub async fn verify_hash(
        state: web::Data<AppState>,
        body: web::Json<VerifyHashRequest>,
    ) -> HttpResponse {
        let raw = body.into_inner();

        let Some(code) = raw.code else {
            return HttpResponse::BadRequest()
                .json(MissingFieldsResponse::new(vec!["code is required".to_string()]));
        };

        if code.len() != 40 {
            return HttpResponse::BadRequest().json(BaseResponse::error("Invalid code format"));
        }

        let db = state.db.lock().await;

        // Find the hash
        let hash_record = match db_activation_hash::find_by_hash(&db, &code).await {
            Ok(record) => record,
            Err(_) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Invalid or expired code"));
            }
        };

        // Validate the hash
        if !db_activation_hash::is_valid(&hash_record) {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Code has expired or already been used"));
        }

        // Only allow forgot_password and password_change hash types
        if hash_record.hash_type != "forgot_password" && hash_record.hash_type != "password_change"
        {
            return HttpResponse::BadRequest().json(BaseResponse::error("Invalid code type"));
        }

        // Return the code (they'll use it in the next step)
        HttpResponse::Ok().json(VerifyHashResponse {
            base: BaseResponse::success("Code verified successfully"),
            code,
        })
    }

    /// POST /reset-password - Reset password using verified hash
    ///
    /// # Request Body
    /// ```json
    /// {
    ///     "code": "40-character-hash-code",
    ///     "password": "NewPassword123!",
    ///     "confirm_password": "NewPassword123!"
    /// }
    /// ```
    ///
    /// # Responses
    /// - 200: Password reset successfully
    /// - 400: Validation failed (returns combined errors for code, password, confirm_password)
    pub async fn reset_password(
        state: web::Data<AppState>,
        body: web::Json<ResetPasswordRequestRaw>,
    ) -> HttpResponse {
        let raw = body.into_inner();

        // Step 1: Check all required fields first
        let mut missing_fields: Vec<String> = Vec::new();

        if raw.code.is_none() {
            missing_fields.push("code is required".to_string());
        }
        if raw.password.is_none() {
            missing_fields.push("password is required".to_string());
        }
        if raw.confirm_password.is_none() {
            missing_fields.push("confirm_password is required".to_string());
        }

        if !missing_fields.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(missing_fields));
        }

        let request = ResetPasswordRequest {
            code: raw.code.unwrap(),
            password: raw.password.unwrap(),
            confirm_password: raw.confirm_password.unwrap(),
        };

        // Step 2: Validate all fields and collect all errors
        let mut validation_errors = ResetPasswordValidationErrors::new();

        let db = state.db.lock().await;

        // 2a. Code validation
        let hash_record = match db_activation_hash::find_by_hash(&db, &request.code).await {
            Ok(record) => {
                // Check if valid (not expired, not used)
                if !db_activation_hash::is_valid(&record) {
                    validation_errors
                        .code_errors
                        .push("code has expired or already been used".to_string());
                    None
                } else if record.hash_type != "forgot_password"
                    && record.hash_type != "password_change"
                {
                    validation_errors
                        .code_errors
                        .push("invalid code type".to_string());
                    None
                } else {
                    Some(record)
                }
            }
            Err(_) => {
                validation_errors
                    .code_errors
                    .push("invalid or expired code".to_string());
                None
            }
        };

        // 2b. Password validation (same as sign-up)
        let password_errors = validate_password(&request.password);
        if !password_errors.is_empty() {
            validation_errors.password_errors = password_errors;
        }

        // 2c. Confirm password validation
        if request.password != request.confirm_password {
            validation_errors
                .confirm_password_errors
                .push("passwords do not match".to_string());
        }

        // Return all validation errors if any
        if validation_errors.has_errors() {
            return HttpResponse::BadRequest().json(validation_errors);
        }

        // At this point we have a valid hash_record
        let hash_record = hash_record.unwrap();

        // Update password
        if let Err(e) =
            db_user_mutations::update_password(&db, hash_record.user_id, &request.password).await
        {
            tracing::error!("Failed to update password: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to reset password"));
        }

        // Mark hash as used
        if let Err(e) = db_activation_hash::mark_as_used(&db, hash_record.id).await {
            tracing::error!("Failed to mark hash as used: {}", e);
        }

        // Send success email
        if let Some(ref mq) = state.mq {
            if let Ok(user) = db_user::get_by_id(&db, hash_record.user_id).await {
                let email_params = SendEmailParams::new(
                    &user.email,
                    &user.first_name,
                    EmailTemplate::PasswordResetSuccess,
                )
                .with_variable("first_name", &user.first_name)
                .with_variable("email", &user.email)
                .with_variable("login_url", "/login");

                let email_options = JobOptions::new().priority(1).fault_tolerance(3);

                if let Err(e) =
                    mq::enqueue_job_dyn(mq, "send_email", &email_params, email_options).await
                {
                    tracing::warn!("Failed to queue password reset success email: {}", e);
                }
            }
        }

        HttpResponse::Ok().json(BaseResponse::success("Password reset successfully"))
    }

    /// GET /set-password-when-needed - Verify password setup link (for admin-created users)
    ///
    /// # Query Parameters
    /// - user_id: The user ID
    /// - hash: The 40-character hash
    ///
    /// # Responses
    /// - 200: Link verified, returns token
    /// - 400: Invalid parameters
    /// - 404: Link not found or expired
    pub async fn verify_set_password_link(
        state: web::Data<AppState>,
        query: web::Query<SetPasswordQuery>,
    ) -> HttpResponse {
        let params = query.into_inner();

        if params.hash.len() != 40 {
            return HttpResponse::BadRequest().json(BaseResponse::error("Invalid link format"));
        }

        let db = state.db.lock().await;

        // Find the hash by hash and user_id
        let hash_record =
            match db_activation_hash::find_by_hash_and_user(&db, &params.hash, params.user_id).await
            {
                Ok(record) => record,
                Err(_) => {
                    return HttpResponse::NotFound()
                        .json(BaseResponse::error("Invalid or expired link"));
                }
            };

        // Validate the hash
        if !db_activation_hash::is_valid(&hash_record) {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Link has expired or already been used"));
        }

        // Check hash type
        if hash_record.hash_type != "user_must_set_password" {
            return HttpResponse::BadRequest().json(BaseResponse::error("Invalid link type"));
        }

        // Return success with the hash as code
        HttpResponse::Ok().json(VerifyHashResponse {
            base: BaseResponse::success("Link verified successfully"),
            code: params.hash,
        })
    }

    /// POST /set-password-when-needed - Set password for admin-created users
    ///
    /// # Request Body
    /// ```json
    /// {
    ///     "user_id": 123,
    ///     "hash": "40-character-hash",
    ///     "password": "NewPassword123!",
    ///     "confirm_password": "NewPassword123!"
    /// }
    /// ```
    ///
    /// # Responses
    /// - 200: Password set and account activated
    /// - 400: Validation failed
    /// - 404: Invalid link
    pub async fn set_password_when_needed(
        state: web::Data<AppState>,
        body: web::Json<SetPasswordRequestRaw>,
    ) -> HttpResponse {
        let raw = body.into_inner();
        let mut missing_fields: Vec<String> = Vec::new();

        if raw.user_id.is_none() {
            missing_fields.push("user_id is required".to_string());
        }
        if raw.hash.is_none() {
            missing_fields.push("hash is required".to_string());
        }
        if raw.password.is_none() {
            missing_fields.push("password is required".to_string());
        }
        if raw.confirm_password.is_none() {
            missing_fields.push("confirm_password is required".to_string());
        }

        if !missing_fields.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(missing_fields));
        }

        let user_id = raw.user_id.unwrap();
        let hash = raw.hash.unwrap();
        let password = raw.password.unwrap();
        let confirm_password = raw.confirm_password.unwrap();

        // Validate passwords match
        if password != confirm_password {
            let mut errors: HashMap<String, Vec<String>> = HashMap::new();
            errors.insert(
                "confirm_password".to_string(),
                vec!["passwords do not match".to_string()],
            );
            return HttpResponse::BadRequest().json(ValidationErrorResponse::new(errors));
        }

        // Validate password strength
        let password_errors = validate_password(&password);
        if !password_errors.is_empty() {
            let mut errors: HashMap<String, Vec<String>> = HashMap::new();
            errors.insert("password".to_string(), password_errors);
            return HttpResponse::BadRequest().json(ValidationErrorResponse::new(errors));
        }

        let db = state.db.lock().await;

        // Find the hash by hash and user_id
        let hash_record = match db_activation_hash::find_by_hash_and_user(&db, &hash, user_id).await
        {
            Ok(record) => record,
            Err(_) => {
                return HttpResponse::NotFound()
                    .json(BaseResponse::error("Invalid or expired link"));
            }
        };

        // Validate the hash
        if !db_activation_hash::is_valid(&hash_record) {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Link has expired or already been used"));
        }

        // Check hash type
        if hash_record.hash_type != "user_must_set_password" {
            return HttpResponse::BadRequest().json(BaseResponse::error("Invalid link type"));
        }

        // Update password
        if let Err(e) = db_user_mutations::update_password(&db, user_id, &password).await {
            tracing::error!("Failed to update password: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to set password"));
        }

        // Activate user and clear user_must_set_password flag
        if let Err(e) = db_user_mutations::activate_and_clear_must_set_password(&db, user_id).await
        {
            tracing::error!("Failed to activate user: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to activate account"));
        }

        // Mark hash as used
        if let Err(e) = db_activation_hash::mark_as_used(&db, hash_record.id).await {
            tracing::error!("Failed to mark hash as used: {}", e);
        }

        // Send success email
        if let Some(ref mq) = state.mq {
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                let email_params = SendEmailParams::new(
                    &user.email,
                    &user.first_name,
                    EmailTemplate::ActivationSuccess,
                )
                .with_variable("first_name", &user.first_name)
                .with_variable("email", &user.email)
                .with_variable("login_url", "/login");

                let email_options = JobOptions::new().priority(1).fault_tolerance(3);

                if let Err(e) =
                    mq::enqueue_job_dyn(mq, "send_email", &email_params, email_options).await
                {
                    tracing::warn!("Failed to queue activation success email: {}", e);
                }
            }
        }

        HttpResponse::Ok().json(BaseResponse::success("Password set and account activated"))
    }

    /// POST /change-password - Request password change for logged-in user
    ///
    /// # Responses
    /// - 200: Password change code sent to email
    /// - 401: Unauthorized
    pub async fn request_change_password(
        state: web::Data<AppState>,
        req: HttpRequest,
    ) -> HttpResponse {
        // Get user ID from JWT
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        let db = state.db.lock().await;

        // Get user
        let user = match db_user::get_by_id(&db, user_id).await {
            Ok(user) => user,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("User not found"));
            }
        };

        // Generate hash
        let hash = db_activation_hash::generate_hash();
        let expiry_minutes = ActivationConfig::expiry_password_change();

        if let Err(e) =
            db_activation_hash::create(&db, user_id, &hash, "password_change", expiry_minutes).await
        {
            tracing::error!("Failed to create password change hash: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to process request"));
        }

        // Send email
        if let Some(ref mq) = state.mq {
            let email_params =
                SendEmailParams::new(&user.email, &user.first_name, EmailTemplate::PasswordChange)
                    .with_variable("first_name", &user.first_name)
                    .with_variable("email", &user.email)
                    .with_variable("change_code", &hash);

            let email_options = JobOptions::new().priority(1).fault_tolerance(3);

            if let Err(e) =
                mq::enqueue_job_dyn(mq, "send_email", &email_params, email_options).await
            {
                tracing::warn!("Failed to queue password change email: {}", e);
            }
        }

        HttpResponse::Ok().json(BaseResponse::success("Password change code sent to your email"))
    }

    /// POST /verify-password-change - Verify code and change password for logged-in user
    ///
    /// # Request Body
    /// ```json
    /// {
    ///     "code": "40-character-code",
    ///     "password": "NewPassword123!",
    ///     "confirm_password": "NewPassword123!"
    /// }
    /// ```
    ///
    /// # Responses
    /// - 200: Password changed successfully
    /// - 400: Validation failed
    /// - 401: Unauthorized
    /// - 404: Invalid code
    pub async fn verify_and_change_password(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<ChangePasswordVerifyRequestRaw>,
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

        if raw.code.is_none() {
            missing_fields.push("code is required".to_string());
        }
        if raw.password.is_none() {
            missing_fields.push("password is required".to_string());
        }
        if raw.confirm_password.is_none() {
            missing_fields.push("confirm_password is required".to_string());
        }

        if !missing_fields.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(missing_fields));
        }

        let code = raw.code.unwrap();
        let password = raw.password.unwrap();
        let confirm_password = raw.confirm_password.unwrap();

        // Validate passwords match
        if password != confirm_password {
            let mut errors: HashMap<String, Vec<String>> = HashMap::new();
            errors.insert(
                "confirm_password".to_string(),
                vec!["passwords do not match".to_string()],
            );
            return HttpResponse::BadRequest().json(ValidationErrorResponse::new(errors));
        }

        // Validate password strength
        let password_errors = validate_password(&password);
        if !password_errors.is_empty() {
            let mut errors: HashMap<String, Vec<String>> = HashMap::new();
            errors.insert("password".to_string(), password_errors);
            return HttpResponse::BadRequest().json(ValidationErrorResponse::new(errors));
        }

        let db = state.db.lock().await;

        // Find the hash by hash and user_id
        let hash_record =
            match db_activation_hash::find_by_hash_and_user(&db, &code, user_id).await {
                Ok(record) => record,
                Err(_) => {
                    return HttpResponse::NotFound()
                        .json(BaseResponse::error("Invalid or expired code"));
                }
            };

        // Validate the hash
        if !db_activation_hash::is_valid(&hash_record) {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Code has expired or already been used"));
        }

        // Check hash type
        if hash_record.hash_type != "password_change" {
            return HttpResponse::BadRequest().json(BaseResponse::error("Invalid code type"));
        }

        // Update password
        if let Err(e) = db_user_mutations::update_password(&db, user_id, &password).await {
            tracing::error!("Failed to update password: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to change password"));
        }

        // Mark hash as used
        if let Err(e) = db_activation_hash::mark_as_used(&db, hash_record.id).await {
            tracing::error!("Failed to mark hash as used: {}", e);
        }

        // Send success email
        if let Some(ref mq) = state.mq {
            if let Ok(user) = db_user::get_by_id(&db, user_id).await {
                let email_params = SendEmailParams::new(
                    &user.email,
                    &user.first_name,
                    EmailTemplate::PasswordResetSuccess,
                )
                .with_variable("first_name", &user.first_name)
                .with_variable("email", &user.email)
                .with_variable("login_url", "/login");

                let email_options = JobOptions::new().priority(1).fault_tolerance(3);

                if let Err(e) =
                    mq::enqueue_job_dyn(mq, "send_email", &email_params, email_options).await
                {
                    tracing::warn!("Failed to queue password change success email: {}", e);
                }
            }
        }

        HttpResponse::Ok().json(BaseResponse::success("Password changed successfully"))
    }
}
