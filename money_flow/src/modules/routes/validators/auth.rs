use serde::Deserialize;
use validator::Validate;

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

#[derive(Deserialize, Debug)]
pub struct SignupRequestRaw {
    pub email: Option<String>,
    pub password: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

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

#[derive(Deserialize, Debug)]
pub struct SigninRequestRaw {
    pub email: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Validate)]
pub struct SigninRequest {
    #[validate(email(message = "invalid email format"))]
    pub email: String,
    pub password: String,
}