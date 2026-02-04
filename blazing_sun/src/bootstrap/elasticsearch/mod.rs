//! Elasticsearch module
//!
//! Provides Elasticsearch client for blog search functionality.
//! - Full-text search with fuzzy matching
//! - Blog post indexing and retrieval
//! - Search analytics

mod client;
mod search;

pub use client::*;
pub use search::*;
