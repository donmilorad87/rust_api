//! HTTP Controllers
//!
//! Controllers handle incoming HTTP requests and return responses.
//! Each controller is organized by feature/resource.

pub mod activation;
pub mod auth;
pub mod responses;
pub mod user;

// Re-export controllers for convenience
pub use activation::ActivationController;
pub use auth::AuthController;
pub use user::UserController;
