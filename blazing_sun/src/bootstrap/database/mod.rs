//! Database module
//!
//! Provides database connection pooling, application state management,
//! and re-exports query modules.

pub mod database;

// Re-export connection and state
pub use database::*;

// Re-export query modules from app
pub use crate::app::db_query::{mutations, read};
