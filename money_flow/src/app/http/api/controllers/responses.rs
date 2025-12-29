//! Common HTTP Response Types
//!
//! This module contains shared response structures used across controllers.

use serde::Serialize;
use std::collections::HashMap;

/// Base response structure for simple success/error messages
#[derive(Serialize, Debug)]
pub struct BaseResponse {
    pub status: &'static str,
    pub message: &'static str,
}

impl BaseResponse {
    pub fn success(message: &'static str) -> Self {
        Self {
            status: "success",
            message,
        }
    }

    pub fn error(message: &'static str) -> Self {
        Self {
            status: "error",
            message,
        }
    }
}

impl std::fmt::Display for BaseResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}",
            serde_json::to_string(self).unwrap_or_default()
        )
    }
}

/// Response for missing required fields (array of error messages)
#[derive(Serialize, Debug)]
pub struct MissingFieldsResponse {
    pub status: &'static str,
    pub message: &'static str,
    pub errors: Vec<String>,
}

impl MissingFieldsResponse {
    pub fn new(errors: Vec<String>) -> Self {
        Self {
            status: "error",
            message: "Validation failed",
            errors,
        }
    }
}

/// Response for validation errors (field-specific error messages)
#[derive(Serialize, Debug)]
pub struct ValidationErrorResponse {
    pub status: &'static str,
    pub message: &'static str,
    pub errors: HashMap<String, Vec<String>>,
}

impl ValidationErrorResponse {
    pub fn new(errors: HashMap<String, Vec<String>>) -> Self {
        Self {
            status: "error",
            message: "Validation failed",
            errors,
        }
    }
}

/// User DTO for responses
#[derive(Serialize, Debug)]
pub struct UserDto {
    pub id: i64,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub balance: i64,
    pub permissions: i16,
    pub avatar_uuid: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
