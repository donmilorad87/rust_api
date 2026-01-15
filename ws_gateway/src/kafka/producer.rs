//! Kafka Producer for publishing commands and events

use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord};
use std::time::Duration;
use tracing::{debug, error, info};

use crate::config::KafkaTopics;
use crate::error::{GatewayError, GatewayResult};
use crate::protocol::EventEnvelope;

/// Kafka producer for the WebSocket Gateway
pub struct KafkaProducer {
    producer: FutureProducer,
    topics: KafkaTopics,
}

impl KafkaProducer {
    /// Create a new Kafka producer
    pub fn new(brokers: &str) -> GatewayResult<Self> {
        info!("Creating Kafka producer for brokers: {}", brokers);

        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("message.timeout.ms", "5000")
            .set("queue.buffering.max.messages", "100000")
            .set("queue.buffering.max.kbytes", "1048576")
            .set("batch.num.messages", "10000")
            .set("linger.ms", "5")
            .set("compression.type", "snappy")
            .set("acks", "1")
            .create()
            .map_err(|e| GatewayError::Internal(format!("Failed to create Kafka producer: {}", e)))?;

        info!("Kafka producer created successfully");

        Ok(Self {
            producer,
            topics: KafkaTopics::default(),
        })
    }

    /// Publish an event to a specific topic
    pub async fn publish(&self, topic: &str, key: &str, envelope: &EventEnvelope) -> GatewayResult<()> {
        let payload = serde_json::to_string(envelope)?;

        debug!(
            "Publishing to topic {}: event_type={}, key={}",
            topic, envelope.event_type, key
        );

        let record = FutureRecord::to(topic)
            .key(key)
            .payload(&payload);

        match self.producer.send(record, Duration::from_secs(5)).await {
            Ok((partition, offset)) => {
                debug!(
                    "Published to {}[{}] at offset {}",
                    topic, partition, offset
                );
                Ok(())
            }
            Err((err, _)) => {
                error!("Failed to publish to {}: {}", topic, err);
                Err(GatewayError::Kafka(err))
            }
        }
    }

    /// Publish a chat command
    pub async fn publish_chat_command(&self, key: &str, envelope: &EventEnvelope) -> GatewayResult<()> {
        self.publish(self.topics.chat_commands, key, envelope).await
    }

    /// Publish a chat event
    pub async fn publish_chat_event(&self, key: &str, envelope: &EventEnvelope) -> GatewayResult<()> {
        self.publish(self.topics.chat_events, key, envelope).await
    }

    /// Publish a games command
    pub async fn publish_games_command(&self, key: &str, envelope: &EventEnvelope) -> GatewayResult<()> {
        self.publish(self.topics.games_commands, key, envelope).await
    }

    /// Publish a games event
    pub async fn publish_games_event(&self, key: &str, envelope: &EventEnvelope) -> GatewayResult<()> {
        self.publish(self.topics.games_events, key, envelope).await
    }

    /// Publish a system event
    pub async fn publish_system_event(&self, key: &str, envelope: &EventEnvelope) -> GatewayResult<()> {
        self.publish(self.topics.system_events, key, envelope).await
    }

    /// Publish presence update
    pub async fn publish_presence(&self, key: &str, envelope: &EventEnvelope) -> GatewayResult<()> {
        self.publish(self.topics.gateway_presence, key, envelope).await
    }

    /// Get topic for event type
    pub fn topic_for_command(&self, event_type: &str) -> &str {
        if event_type.starts_with("chat.") {
            self.topics.chat_commands
        } else if event_type.starts_with("games.") {
            self.topics.games_commands
        } else {
            self.topics.system_events
        }
    }
}
