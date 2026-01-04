//! Email Controller
//!
//! Handles email change operations with 4-step verification flow:
//! - POST /request-change: Request email change (Step 1)
//! - POST /verify-old-email: Verify old email hash (Step 2)
//! - POST /verify-new-email: Verify new email hash and complete change (Step 3)

use actix_web::{HttpMessage, HttpRequest, HttpResponse, web};
use serde::Deserialize;
use validator::Validate;

use crate::app::http::api::controllers::responses::{
    BaseResponse, MissingFieldsResponse, ValidationErrorResponse,
};
use crate::config::ActivationConfig;
use crate::database::read::activation_hash as db_activation_hash;
use crate::database::mutations::activation_hash as db_activation_hash_mutations;
use crate::database::read::user as db_user;
use crate::database::mutations::user as db_user_mutations;
use crate::database::AppState;
use crate::bootstrap::mq;
use crate::app::mq::jobs::email::{EmailTemplate, SendEmailParams};
use crate::bootstrap::mq::JobOptions;
use std::collections::HashMap;

/// Email Controller
pub struct EmailController;

// ============================================
// Request/Response Structures
// ============================================

/// Request for starting email change process (Step 1)
#[derive(Deserialize, Debug)]
pub struct RequestEmailChangeRaw {
    pub new_email: Option<String>,
}

#[derive(Debug, Validate)]
pub struct RequestEmailChangeRequest {
    #[validate(email(message = "Invalid email format"))]
    pub new_email: String,
}

/// Request for verifying old email (Step 2)
#[derive(Deserialize, Debug)]
pub struct VerifyOldEmailRaw {
    pub code: Option<String>,
}

/// Request for verifying new email (Step 3)
#[derive(Deserialize, Debug)]
pub struct VerifyNewEmailRaw {
    pub code: Option<String>,
}

impl EmailController {
    /// POST /request-change - Request email change (Step 1)
    ///
    /// # Request Body
    /// ```json
    /// {
    ///   "new_email": "new@example.com"
    /// }
    /// ```
    ///
    /// # Response
    /// - 200: Email change request initiated, verification code sent to old email
    /// - 400: Validation error (missing/invalid email)
    /// - 401: Unauthorized (not authenticated)
    /// - 409: Email already in use
    /// - 500: Server error
    pub async fn request_change(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<RequestEmailChangeRaw>,
    ) -> HttpResponse {
        // Get user ID from JWT
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        // Validate required fields
        let new_email = match &body.new_email {
            Some(email) if !email.trim().is_empty() => email.trim().to_string(),
            _ => {
                return HttpResponse::BadRequest().json(MissingFieldsResponse::new(vec![
                    "new_email is required".to_string()
                ]));
            }
        };

        // Validate email format
        let validated_request = RequestEmailChangeRequest {
            new_email: new_email.clone(),
        };

        if let Err(e) = validated_request.validate() {
            // Convert ValidationErrors to HashMap<String, Vec<String>>
            let mut errors = HashMap::new();
            for (field, field_errors) in e.field_errors() {
                let messages: Vec<String> = field_errors
                    .iter()
                    .filter_map(|err| err.message.as_ref().map(|m| m.to_string()))
                    .collect();
                if !messages.is_empty() {
                    errors.insert(field.to_string(), messages);
                }
            }
            return HttpResponse::BadRequest().json(ValidationErrorResponse::new(errors));
        }

        let db = state.db.lock().await;

        // Get current user
        let user = match db_user::get_by_id(&db, user_id).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("User not found"));
            }
        };

        // Check if new email is the same as current email
        if user.email.to_lowercase() == new_email.to_lowercase() {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("New email cannot be the same as current email"));
        }

        // Check if new email is already in use
        if db_user::get_by_email(&db, &new_email).await.is_ok() {
            return HttpResponse::Conflict()
                .json(BaseResponse::error("Email address is already in use"));
        }

        // Delete any existing unused email_change hashes for this user
        if let Err(e) =
            db_activation_hash_mutations::delete_unused_by_type(&db, user_id, "email_change").await
        {
            tracing::error!("Failed to delete old email_change hashes: {}", e);
        }

        // Generate verification hash for old email
        let hash = uuid::Uuid::new_v4().to_string().replace("-", "");

        // Get expiry time from config
        let expiry_minutes = ActivationConfig::expiry_email_change();
        let expiry_time = chrono::Utc::now() + chrono::Duration::minutes(expiry_minutes);

        // Store metadata with new_email and old_email
        let metadata = serde_json::json!({
            "old_email": user.email,
            "new_email": new_email,
            "step": "verify_old_email"
        });

        // Create activation hash with metadata
        if let Err(e) = db_activation_hash_mutations::create_with_metadata(
            &db,
            user_id,
            &hash,
            "email_change",
            expiry_time,
            metadata,
        )
        .await
        {
            tracing::error!("Failed to create email_change hash: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to initiate email change"));
        }

        // Send verification email to old email address
        let mut variables = HashMap::new();
        variables.insert("first_name".to_string(), user.first_name.clone());
        variables.insert("code".to_string(), hash.clone());
        variables.insert("new_email".to_string(), new_email.clone());
        variables.insert("expiry_minutes".to_string(), expiry_minutes.to_string());
        variables.insert("email".to_string(), user.email.clone()); // Required by base template

        let email_params = SendEmailParams {
            to_email: user.email.clone(),
            to_name: user.first_name.clone(),
            template: EmailTemplate::EmailChangeVerifyOld,
            variables,
        };

        if let Some(mq) = &state.mq {
            if let Err(e) =
                mq::enqueue_job_dyn(mq, "send_email", &email_params, JobOptions::new()).await
            {
                tracing::error!("Failed to enqueue email job: {}", e);
                // Don't fail the request if email fails to queue
            }
        }

        HttpResponse::Ok().json(BaseResponse::success(
            "Email change initiated. Please check your current email address for a verification code.",
        ))
    }

    /// POST /verify-old-email - Verify old email hash (Step 2)
    ///
    /// # Request Body
    /// ```json
    /// {
    ///   "code": "verification-code-from-old-email"
    /// }
    /// ```
    ///
    /// # Response
    /// - 200: Old email verified, verification code sent to new email
    /// - 400: Validation error (missing code)
    /// - 401: Unauthorized (not authenticated)
    /// - 404: Invalid or expired code
    /// - 500: Server error
    pub async fn verify_old_email(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<VerifyOldEmailRaw>,
    ) -> HttpResponse {
        // Get user ID from JWT
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        // Validate required fields
        let code = match &body.code {
            Some(c) if !c.trim().is_empty() => c.trim(),
            _ => {
                return HttpResponse::BadRequest().json(MissingFieldsResponse::new(vec![
                    "code is required".to_string()
                ]));
            }
        };

        let db = state.db.lock().await;

        // Get the activation hash
        let activation_hash =
            match db_activation_hash::get_by_hash_and_type(&db, code, "email_change", user_id).await
            {
                Ok(hash) => hash,
                Err(_) => {
                    return HttpResponse::NotFound().json(BaseResponse::error(
                        "Invalid or expired verification code",
                    ));
                }
            };

        // Parse metadata to get emails
        let old_email = match activation_hash.metadata.get("old_email") {
            Some(serde_json::Value::String(email)) => email.clone(),
            _ => {
                tracing::error!("Missing old_email in activation_hash metadata");
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Invalid verification data"));
            }
        };

        let new_email = match activation_hash.metadata.get("new_email") {
            Some(serde_json::Value::String(email)) => email.clone(),
            _ => {
                tracing::error!("Missing new_email in activation_hash metadata");
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Invalid verification data"));
            }
        };

        // Verify step is correct
        let step = activation_hash.metadata.get("step");
        if step != Some(&serde_json::Value::String("verify_old_email".to_string())) {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Invalid verification step"));
        }

        // Mark old hash as used
        if let Err(e) = db_activation_hash_mutations::mark_as_used(&db, activation_hash.id).await {
            tracing::error!("Failed to mark activation_hash as used: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to process verification"));
        }

        // Generate new verification hash for new email
        let new_hash = uuid::Uuid::new_v4().to_string().replace("-", "");

        // Get expiry time from config
        let expiry_minutes = ActivationConfig::expiry_email_change();
        let expiry_time = chrono::Utc::now() + chrono::Duration::minutes(expiry_minutes);

        // Store metadata for new email verification
        let metadata = serde_json::json!({
            "old_email": old_email,
            "new_email": new_email,
            "step": "verify_new_email"
        });

        // Create new activation hash
        if let Err(e) = db_activation_hash_mutations::create_with_metadata(
            &db,
            user_id,
            &new_hash,
            "email_change",
            expiry_time,
            metadata,
        )
        .await
        {
            tracing::error!("Failed to create new email_change hash: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to process verification"));
        }

        // Get user for email
        let user = match db_user::get_by_id(&db, user_id).await {
            Ok(u) => u,
            Err(_) => {
                return HttpResponse::NotFound().json(BaseResponse::error("User not found"));
            }
        };

        // Send verification email to new email address
        let mut variables = HashMap::new();
        variables.insert("first_name".to_string(), user.first_name.clone());
        variables.insert("code".to_string(), new_hash.clone());
        variables.insert("old_email".to_string(), old_email.clone());
        variables.insert("expiry_minutes".to_string(), expiry_minutes.to_string());
        variables.insert("email".to_string(), new_email.clone()); // Required by base template

        let email_params = SendEmailParams {
            to_email: new_email.clone(),
            to_name: user.first_name.clone(),
            template: EmailTemplate::EmailChangeVerifyNew,
            variables,
        };

        if let Some(mq) = &state.mq {
            if let Err(e) =
                mq::enqueue_job_dyn(mq, "send_email", &email_params, JobOptions::new()).await
            {
                tracing::error!("Failed to enqueue email job: {}", e);
                // Don't fail the request if email fails to queue
            }
        }

        HttpResponse::Ok().json(BaseResponse::success(
            "Old email verified. Please check your new email address for a verification code.",
        ))
    }

    /// POST /verify-new-email - Verify new email hash and complete change (Step 3)
    ///
    /// # Request Body
    /// ```json
    /// {
    ///   "code": "verification-code-from-new-email"
    /// }
    /// ```
    ///
    /// # Response
    /// - 200: New email verified, email changed successfully, user logged out
    /// - 400: Validation error (missing code)
    /// - 401: Unauthorized (not authenticated)
    /// - 404: Invalid or expired code
    /// - 409: Email already in use (race condition)
    /// - 500: Server error
    pub async fn verify_new_email(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<VerifyNewEmailRaw>,
    ) -> HttpResponse {
        // Get user ID from JWT
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        // Validate required fields
        let code = match &body.code {
            Some(c) if !c.trim().is_empty() => c.trim(),
            _ => {
                return HttpResponse::BadRequest().json(MissingFieldsResponse::new(vec![
                    "code is required".to_string()
                ]));
            }
        };

        let db = state.db.lock().await;

        // Get the activation hash
        let activation_hash =
            match db_activation_hash::get_by_hash_and_type(&db, code, "email_change", user_id).await
            {
                Ok(hash) => hash,
                Err(_) => {
                    return HttpResponse::NotFound().json(BaseResponse::error(
                        "Invalid or expired verification code",
                    ));
                }
            };

        // Parse metadata to get new email
        let old_email = match activation_hash.metadata.get("old_email") {
            Some(serde_json::Value::String(email)) => email.clone(),
            _ => {
                tracing::error!("Missing old_email in activation_hash metadata");
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Invalid verification data"));
            }
        };

        let new_email = match activation_hash.metadata.get("new_email") {
            Some(serde_json::Value::String(email)) => email.clone(),
            _ => {
                tracing::error!("Missing new_email in activation_hash metadata");
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Invalid verification data"));
            }
        };

        // Verify step is correct
        let step = activation_hash.metadata.get("step");
        if step != Some(&serde_json::Value::String("verify_new_email".to_string())) {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Invalid verification step"));
        }

        // Check if new email is now in use (race condition check)
        if db_user::get_by_email(&db, &new_email).await.is_ok() {
            // Mark hash as used before returning error
            let _ = db_activation_hash_mutations::mark_as_used(&db, activation_hash.id).await;
            return HttpResponse::Conflict()
                .json(BaseResponse::error("Email address is already in use"));
        }

        // Update user email
        if let Err(e) = db_user_mutations::update_email(&db, user_id, &new_email).await {
            tracing::error!("Failed to update user email: {}", e);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to update email address"));
        }

        // Mark hash as used
        if let Err(e) = db_activation_hash_mutations::mark_as_used(&db, activation_hash.id).await {
            tracing::error!("Failed to mark activation_hash as used: {}", e);
            // Continue anyway since email was updated
        }

        // Get user for success email
        let user = match db_user::get_by_id(&db, user_id).await {
            Ok(u) => u,
            Err(_) => {
                // Email was updated but we can't send confirmation
                tracing::error!("User not found after email update");
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Email updated but confirmation failed"));
            }
        };

        // Send success email to new email address
        let mut variables = HashMap::new();
        variables.insert("first_name".to_string(), user.first_name.clone());
        variables.insert("old_email".to_string(), old_email.clone());
        variables.insert("email".to_string(), new_email.clone()); // Required by base template

        let email_params = SendEmailParams {
            to_email: new_email.clone(),
            to_name: user.first_name.clone(),
            template: EmailTemplate::EmailChangeSuccess,
            variables,
        };

        if let Some(mq) = &state.mq {
            if let Err(e) =
                mq::enqueue_job_dyn(mq, "send_email", &email_params, JobOptions::new()).await
            {
                tracing::error!("Failed to enqueue success email job: {}", e);
                // Don't fail the request if email fails to queue
            }
        }

        // Clear the auth_token cookie to log the user out
        // Email change is a security-sensitive operation, so we force re-authentication
        use actix_web::cookie::{Cookie, SameSite};
        let clear_cookie = Cookie::build("auth_token", "")
            .path("/")
            .max_age(actix_web::cookie::time::Duration::seconds(-1)) // Expire immediately
            .http_only(true)
            .same_site(SameSite::Lax)
            .finish();

        HttpResponse::Ok()
            .cookie(clear_cookie)
            .json(BaseResponse::success(
                "Email changed successfully. Please sign in with your new email address.",
            ))
    }
}
