//! Application module
//!
//! This module contains the core application components:
//! - HTTP layer (controllers, validators, middlewares)
//! - Cron jobs (scheduled tasks)
//! - Message queue (RabbitMQ for async tasks)
//! - Database queries (read/mutations)

pub mod cron;
pub mod db_query;
pub mod http;
pub mod mq;
