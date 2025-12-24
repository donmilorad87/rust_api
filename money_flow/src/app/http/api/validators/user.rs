//! User Validators
//!
//! Validation rules for user update requests.

use serde::Deserialize;
use validator::Validate;

use crate::app::http::api::validators::auth::validate_password;

/// PATCH /user - Full update request (ALL fields required except password)
/// Email is NOT updatable
#[derive(Deserialize, Debug)]
pub struct PatchUserRequestRaw {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub balance: Option<i64>,
    pub password: Option<String>,
}

/// Validated PATCH request - first_name and last_name required, balance and password optional
#[derive(Debug, Validate)]
pub struct PatchUserRequest {
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub first_name: String,
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub last_name: String,
    pub balance: Option<i64>,
    pub password: Option<String>,
}

impl PatchUserRequest {
    /// Validate password if provided
    pub fn validate_password_if_present(&self) -> Vec<String> {
        if let Some(ref password) = self.password {
            validate_password(password)
        } else {
            Vec::new()
        }
    }
}

/// PUT /user - Partial update request (at least ONE field required)
/// Email is NOT updatable
#[derive(Deserialize, Debug, Default)]
pub struct PutUserRequest {
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub balance: Option<i64>,
    #[serde(default)]
    pub password: Option<String>,
}

impl PutUserRequest {
    /// Check if at least one field is provided
    pub fn has_any_field(&self) -> bool {
        self.first_name.is_some()
            || self.last_name.is_some()
            || self.balance.is_some()
            || self.password.is_some()
    }

    /// Validate the fields that are provided
    pub fn validate_fields(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if let Some(ref first_name) = self.first_name {
            if first_name.len() < 2 {
                errors.push("first_name: minimum 2 characters".to_string());
            }
        }

        if let Some(ref last_name) = self.last_name {
            if last_name.len() < 2 {
                errors.push("last_name: minimum 2 characters".to_string());
            }
        }

        if let Some(ref balance) = self.balance {
            if *balance < 0 {
                errors.push("balance: must be non-negative".to_string());
            }
        }

        if let Some(ref password) = self.password {
            let password_errors = validate_password(password);
            for err in password_errors {
                errors.push(format!("password: {}", err));
            }
        }

        errors
    }
}
