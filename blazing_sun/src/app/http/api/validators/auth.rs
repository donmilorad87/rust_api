//! Authentication Validators
//!
//! Validation rules for authentication requests.

use regex::Regex;
use serde::Deserialize;
use std::sync::LazyLock;
use validator::Validate;

/// Regex for valid name characters (letters, spaces, hyphens, apostrophes)
static NAME_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-zA-Z\s'-]+$").unwrap());

/// Validate name field (first_name or last_name)
///
/// Name must:
/// - Be at least 2 characters
/// - Contain only letters, spaces, hyphens, and apostrophes
pub fn validate_name(name: &str, field_name: &str) -> Vec<String> {
    let mut errors = Vec::new();

    if name.is_empty() {
        errors.push(format!("{} is required", field_name));
        return errors;
    }

    if name.len() < 2 {
        errors.push("minimum 2 characters".to_string());
    }

    if !NAME_REGEX.is_match(name) {
        errors.push("letters only (no special characters)".to_string());
    }

    errors
}

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
    pub confirm_password: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

/// Validated sign-up request
#[derive(Debug, Validate)]
pub struct SignupRequest {
    #[validate(email(message = "invalid email format"))]
    pub email: String,
    pub password: String,
    pub confirm_password: String,
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub first_name: String,
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub last_name: String,
}

/// Validate that password and confirm_password match
pub fn validate_passwords_match(password: &str, confirm_password: &str) -> Option<String> {
    if password != confirm_password {
        Some("passwords do not match".to_string())
    } else {
        None
    }
}

/// Raw sign-in request (allows optional fields for better error messages)
#[derive(Deserialize, Debug)]
pub struct SigninRequestRaw {
    pub email: Option<String>,
    pub password: Option<String>,
    #[serde(default)]
    pub remember_me: bool,
}

/// Validated sign-in request
#[derive(Debug, Validate)]
pub struct SigninRequest {
    #[validate(email(message = "invalid email format"))]
    pub email: String,
    pub password: String,
    pub remember_me: bool,
}
