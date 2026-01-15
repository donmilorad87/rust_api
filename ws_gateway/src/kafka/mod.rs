//! Kafka integration for WebSocket Gateway
//!
//! Handles publishing commands and consuming events from Kafka.

mod producer;
mod consumer;

pub use producer::KafkaProducer;
pub use consumer::{KafkaConsumer, KafkaEvent};

use std::sync::Arc;

/// Shared Kafka producer
pub type SharedKafkaProducer = Arc<KafkaProducer>;
