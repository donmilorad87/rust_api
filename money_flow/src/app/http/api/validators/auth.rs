//! Authentication Validators
//!
//! Validation rules for authentication requests.

use serde::Deserialize;
use validator::Validate;

/// Validate password strength
///
/// Password must contain:
/// - Minimum 8 characters
/// - At least one uppercase letter
/// - At least one lowercase letter
/// - At least one number
/// - At least one special character
pub fn validate_password(password: &str) -> Vec<String> {
    let mut errors = Vec::new();

    if password.len() < 8 {
        errors.push("minimum 8 characters".to_string());
    }
    if !password.chars().any(|c| c.is_uppercase()) {
        errors.push("at least one uppercase letter".to_string());
    }
    if !password.chars().any(|c| c.is_lowercase()) {
        errors.push("at least one lowercase letter".to_string());
    }
    if !password.chars().any(|c| c.is_numeric()) {
        errors.push("at least one number".to_string());
    }
    if !password.chars().any(|c| !c.is_alphanumeric()) {
        errors.push("at least one special character".to_string());
    }

    errors
}

/// Raw sign-up request (allows optional fields for better error messages)
#[derive(Deserialize, Debug)]
pub struct SignupRequestRaw {
    pub email: Option<String>,
    pub password: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

/// Validated sign-up request
#[derive(Debug, Validate)]
pub struct SignupRequest {
    #[validate(email(message = "invalid email format"))]
    pub email: String,
    pub password: String,
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub first_name: String,
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub last_name: String,
}

/// Raw sign-in request (allows optional fields for better error messages)
#[derive(Deserialize, Debug)]
pub struct SigninRequestRaw {
    pub email: Option<String>,
    pub password: Option<String>,
}

/// Validated sign-in request
#[derive(Debug, Validate)]
pub struct SigninRequest {
    #[validate(email(message = "invalid email format"))]
    pub email: String,
    pub password: String,
}
