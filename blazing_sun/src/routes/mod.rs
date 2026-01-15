//!
//! Routes Module
//!
//! Laravel-like named routing system with language (i18n) support.
//!
//! - `api` - API route definitions (JSON responses)
//! - `web` - Web route definitions (HTML responses)
//! - `crons` - Cron job schedule definitions
//!
//! ## Named Routes with Language Support
//!
//! ```rust,ignore
//! // Register routes with the route! macro
//! route!("web.sign_up", "/sign-up");              // Default language (en)
//! route!("web.sign_up", "/registrazione", "it");  // Italian
//! route!("web.sign_up", "/inscription", "fr");    // French
//!
//! // Get URLs in templates
//! // {{ route(name='web.sign_up') }}              -> "/sign-up"
//! // {{ route(name='web.sign_up', lang='it') }}   -> "/registrazione"
//! ```

pub mod api;
pub mod crons;
pub mod web;

// Re-export commonly used items from bootstrap for convenience
pub use crate::bootstrap::routes::controller::api::{
    get_route_languages, register_route, register_route_with_lang, route, route_exists, route_url,
    route_url_lang, route_with_lang, DEFAULT_LANG,
};
pub use crate::bootstrap::routes::controller::crons::{schedules, Schedule};
