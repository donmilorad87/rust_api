//! Application module
//!
//! This module contains the core application components:
//! - HTTP layer (controllers, validators, middlewares)
//! - Cron jobs (scheduled tasks)
//! - Message queue (RabbitMQ for async tasks)
//! - Database queries (read/mutations)
//! - Chat (real-time messaging via WebSocket gateway)
//! - Games (real-time multiplayer games via WebSocket gateway)

pub mod chat;
pub mod checkout;
pub mod cron;
pub mod db_query;
pub mod games;
pub mod http;
pub mod mq;
