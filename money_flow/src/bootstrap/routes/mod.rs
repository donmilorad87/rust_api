//! Bootstrap Routes Module
//!
//! This module contains route and cron scheduling infrastructure.
//! - `controller/api` - Route registry and URL generation utilities
//! - `controller/crons` - Cron scheduling system (Schedule builder)

pub mod controller;

// Re-export commonly used items for convenience
pub use controller::api::{register_route, route, route_url};
pub use controller::crons::{init as init_crons, schedules, Schedule};
