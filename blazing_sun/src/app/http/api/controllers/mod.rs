//! HTTP Controllers
//!
//! Controllers handle incoming HTTP requests and return responses.
//! Each controller is organized by feature/resource.

pub mod activation;
pub mod admin;
pub mod auth;
pub mod email;
pub mod gallery;
pub mod picture;
pub mod responses;
pub mod theme;
pub mod upload;
pub mod user;

// Re-export controllers for convenience
pub use activation::ActivationController;
pub use admin::AdminController;
pub use auth::AuthController;
pub use email::EmailController;
pub use theme::ThemeController;
pub use upload::UploadController;
pub use user::UserController;
