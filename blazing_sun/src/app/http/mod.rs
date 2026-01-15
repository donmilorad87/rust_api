//! HTTP Layer
//!
//! This module contains all HTTP-related components:
//! - API: REST API controllers, validators, middlewares (JSON responses)
//! - Web: Web controllers, validators, middlewares (HTML responses)

pub mod api;
pub mod web;

// Re-export common response types for convenience
pub use api::controllers::responses::{
    BaseResponse, MissingFieldsResponse, ValidationErrorResponse,
};
