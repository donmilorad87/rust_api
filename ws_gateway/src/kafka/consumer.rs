//! Kafka Consumer for receiving events from domain services

use rdkafka::config::ClientConfig;
use rdkafka::consumer::{Consumer, StreamConsumer};
use rdkafka::message::Message;
use rdkafka::TopicPartitionList;
use futures_util::StreamExt;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, error, info, warn};

use crate::config::KafkaTopics;
use crate::error::{GatewayError, GatewayResult};
use crate::protocol::EventEnvelope;

/// Event received from Kafka
#[derive(Debug, Clone)]
pub struct KafkaEvent {
    pub topic: String,
    pub partition: i32,
    pub offset: i64,
    pub key: Option<String>,
    pub envelope: EventEnvelope,
}

/// Kafka consumer for the WebSocket Gateway
pub struct KafkaConsumer {
    consumer: StreamConsumer,
    topics: KafkaTopics,
    event_tx: broadcast::Sender<KafkaEvent>,
}

impl KafkaConsumer {
    /// Create a new Kafka consumer
    pub fn new(brokers: &str, group_id: &str) -> GatewayResult<(Self, broadcast::Receiver<KafkaEvent>)> {
        info!("Creating Kafka consumer for brokers: {}, group: {}", brokers, group_id);

        let consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("group.id", group_id)
            .set("enable.auto.commit", "true")
            .set("auto.commit.interval.ms", "5000")
            .set("auto.offset.reset", "latest")
            .set("session.timeout.ms", "30000")
            .set("heartbeat.interval.ms", "10000")
            .set("max.poll.interval.ms", "300000")
            .set("fetch.min.bytes", "1")
            .set("fetch.wait.max.ms", "500")
            .create()
            .map_err(|e| GatewayError::Internal(format!("Failed to create Kafka consumer: {}", e)))?;

        let topics = KafkaTopics::default();

        // Subscribe to event topics
        let topic_list: Vec<&str> = topics.consumer_topics();
        consumer.subscribe(&topic_list)
            .map_err(|e| GatewayError::Internal(format!("Failed to subscribe to topics: {}", e)))?;

        info!("Subscribed to topics: {:?}", topic_list);

        // Create broadcast channel for events
        let (event_tx, event_rx) = broadcast::channel(10000);

        Ok((
            Self {
                consumer,
                topics,
                event_tx,
            },
            event_rx,
        ))
    }

    /// Get a new receiver for events
    pub fn subscribe(&self) -> broadcast::Receiver<KafkaEvent> {
        self.event_tx.subscribe()
    }

    /// Start consuming messages (runs in a loop)
    pub async fn start(&self) -> GatewayResult<()> {
        info!("Starting Kafka consumer loop");

        let mut message_stream = self.consumer.stream();

        while let Some(result) = message_stream.next().await {
            match result {
                Ok(message) => {
                    let topic = message.topic().to_string();
                    let partition = message.partition();
                    let offset = message.offset();

                    // Extract key
                    let key = message.key().map(|k| {
                        String::from_utf8_lossy(k).to_string()
                    });

                    // Extract payload
                    if let Some(payload) = message.payload() {
                        match serde_json::from_slice::<EventEnvelope>(payload) {
                            Ok(envelope) => {
                                debug!(
                                    "Received event from {}[{}]@{}: type={}",
                                    topic, partition, offset, envelope.event_type
                                );

                                let event = KafkaEvent {
                                    topic,
                                    partition,
                                    offset,
                                    key,
                                    envelope,
                                };

                                // Broadcast to all listeners
                                if let Err(e) = self.event_tx.send(event) {
                                    warn!("No active listeners for Kafka event: {}", e);
                                }
                            }
                            Err(e) => {
                                warn!(
                                    "Failed to parse event from {}[{}]@{}: {}",
                                    topic, partition, offset, e
                                );
                            }
                        }
                    }
                }
                Err(e) => {
                    error!("Kafka consumer error: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Stop consuming
    pub fn stop(&self) {
        info!("Stopping Kafka consumer");
        // Unsubscribe from all topics
        self.consumer.unsubscribe();
    }

    /// Get consumer lag (for monitoring)
    pub async fn get_lag(&self) -> GatewayResult<Vec<(String, i32, i64)>> {
        let mut lag_info = Vec::new();

        // Get assigned partitions
        if let Ok(assignment) = self.consumer.assignment() {
            for tp in assignment.elements() {
                let topic = tp.topic();
                let partition = tp.partition();

                // Get current position
                if let Ok(position) = self.consumer.position() {
                    if let Some(offset) = position.find_partition(topic, partition) {
                        if let Ok((_, high)) = self.consumer.fetch_watermarks(topic, partition, std::time::Duration::from_secs(5)) {
                            let current = offset.offset().to_raw().unwrap_or(0);
                            let lag = high - current;
                            lag_info.push((topic.to_string(), partition, lag));
                        }
                    }
                }
            }
        }

        Ok(lag_info)
    }
}

/// Shared Kafka consumer
pub type SharedKafkaConsumer = Arc<KafkaConsumer>;
