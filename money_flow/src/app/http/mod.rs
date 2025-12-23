//! HTTP Layer
//!
//! This module contains all HTTP-related components:
//! - Controllers: Handle incoming requests and return responses
//! - Validators: Validate request data
//! - Middlewares: Process requests/responses (auth, logging, etc.)

pub mod controllers;
pub mod middlewares;
pub mod validators;

// Re-export common response types for convenience
pub use controllers::responses::{
    BaseResponse, MissingFieldsResponse, ValidationErrorResponse,
};
