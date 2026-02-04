//! Bootstrap module
//!
//! Contains core system components:
//! - Database connection and state management
//! - Middleware (auth, cors, security headers, tracing)
//! - Message queue infrastructure
//! - Events (Kafka event streaming)
//! - Routes (route registry and cron scheduling)
//! - Includes (shared utilities)
//! - Utility (static helper functions)
//! - Elasticsearch (blog search)

pub mod database;
pub mod elasticsearch;
pub mod events;
pub mod includes;
pub mod middleware;
pub mod mq;
pub mod routes;
pub mod utility;
