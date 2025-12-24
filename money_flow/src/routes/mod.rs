//!
//! Routes Module
//!
//!
//! - `api` - API route definitions (JSON responses)
//! - `web` - Web route definitions (HTML responses)
//! - `crons` - Cron job schedule definitions
//!

pub mod api;
pub mod crons;
pub mod web;

// Re-export commonly used items from bootstrap for convenience
pub use crate::bootstrap::routes::controller::api::{register_route, route, route_url};
pub use crate::bootstrap::routes::controller::crons::{schedules, Schedule};
