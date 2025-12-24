//! Message Queue module
//!
//! Core RabbitMQ infrastructure for background job processing.

pub mod controller;

pub use controller::mq::*;

// Re-export jobs and workers from app::mq
pub use crate::app::mq::jobs;
pub use crate::app::mq::workers;
