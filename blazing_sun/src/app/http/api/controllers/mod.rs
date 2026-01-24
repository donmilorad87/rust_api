//! HTTP Controllers
//!
//! Controllers handle incoming HTTP requests and return responses.
//! Each controller is organized by feature/resource.

pub mod activation;
pub mod admin;
pub mod auth;
pub mod balance;
pub mod competitions;
pub mod email;
pub mod gallery;
pub mod gallery_like;
pub mod game_chat_config;
pub mod game_config;
pub mod geo_place;
pub mod localization;
pub mod oauth;
pub mod oauth_api_product;
pub mod oauth_client;
pub mod oauth_gallery;
pub mod oauth_scope;
pub mod picture;
pub mod responses;
pub mod schema;
pub mod theme;
pub mod upload;
pub mod user;

// Re-export controllers for convenience
pub use activation::ActivationController;
pub use admin::AdminController;
pub use auth::AuthController;
pub use balance::BalanceController;
pub use email::EmailController;
pub use game_chat_config::GameChatConfigController;
pub use localization::LocalizationController;
pub use schema::SchemaController;
pub use theme::ThemeController;
pub use upload::UploadController;
pub use user::UserController;
