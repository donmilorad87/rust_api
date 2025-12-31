use super::types::DomainEvent;
use crate::config::KafkaConfig;
use rdkafka::config::ClientConfig;
use rdkafka::producer::{FutureProducer, FutureRecord, Producer};
use rdkafka::util::Timeout;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};

/// Kafka event producer for publishing domain events
pub struct EventProducer {
    producer: FutureProducer,
}

impl EventProducer {
    /// Create a new Kafka producer
    pub fn new() -> Result<Self, rdkafka::error::KafkaError> {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", KafkaConfig::bootstrap_servers())
            .set("client.id", KafkaConfig::client_id())
            .set("message.timeout.ms", "5000")
            .set("acks", "all") // Wait for all replicas to acknowledge
            .set("retries", "3")
            .set("retry.backoff.ms", "100")
            .set("enable.idempotence", "true") // Ensure exactly-once delivery
            .set("compression.type", "lz4") // Compress messages
            .set("linger.ms", "5") // Small batching for low latency
            .set("batch.size", "16384")
            .create()?;

        info!(
            "Kafka producer initialized with bootstrap servers: {}",
            KafkaConfig::bootstrap_servers()
        );

        Ok(Self { producer })
    }

    /// Publish a domain event to Kafka
    pub async fn publish(&self, event: &DomainEvent) -> Result<(), EventPublishError> {
        let topic = event.topic();
        let key = event.partition_key();
        let payload = event.to_bytes().map_err(|e| EventPublishError::Serialization(e.to_string()))?;

        let record = FutureRecord::to(topic)
            .key(key)
            .payload(&payload)
            .headers(self.create_headers(event));

        match self
            .producer
            .send(record, Timeout::After(Duration::from_secs(5)))
            .await
        {
            Ok((partition, offset)) => {
                info!(
                    event_id = %event.id,
                    event_type = %event.event_type,
                    topic = %topic,
                    partition = %partition,
                    offset = %offset,
                    "Event published successfully"
                );
                Ok(())
            }
            Err((err, _)) => {
                error!(
                    event_id = %event.id,
                    event_type = %event.event_type,
                    error = %err,
                    "Failed to publish event"
                );
                Err(EventPublishError::Kafka(err.to_string()))
            }
        }
    }

    /// Publish multiple events (batch)
    pub async fn publish_batch(&self, events: &[DomainEvent]) -> Vec<Result<(), EventPublishError>> {
        let futures: Vec<_> = events.iter().map(|event| self.publish(event)).collect();
        futures::future::join_all(futures).await
    }

    /// Publish event with retry logic
    pub async fn publish_with_retry(
        &self,
        event: &DomainEvent,
        max_retries: u32,
    ) -> Result<(), EventPublishError> {
        let mut attempts = 0;
        let mut last_error = None;

        while attempts < max_retries {
            match self.publish(event).await {
                Ok(()) => return Ok(()),
                Err(e) => {
                    attempts += 1;
                    last_error = Some(e);

                    if attempts < max_retries {
                        let backoff = Duration::from_millis(100 * 2u64.pow(attempts));
                        warn!(
                            event_id = %event.id,
                            attempt = %attempts,
                            max_retries = %max_retries,
                            backoff_ms = %backoff.as_millis(),
                            "Retrying event publish"
                        );
                        tokio::time::sleep(backoff).await;
                    }
                }
            }
        }

        Err(last_error.unwrap_or(EventPublishError::Unknown))
    }

    /// Create Kafka headers for the event
    fn create_headers(&self, event: &DomainEvent) -> rdkafka::message::OwnedHeaders {
        use rdkafka::message::OwnedHeaders;

        let mut headers = OwnedHeaders::new()
            .insert(rdkafka::message::Header {
                key: "event_id",
                value: Some(event.id.as_bytes()),
            })
            .insert(rdkafka::message::Header {
                key: "event_type",
                value: Some(event.event_type.to_string().as_bytes()),
            })
            .insert(rdkafka::message::Header {
                key: "entity_type",
                value: Some(event.entity_type.as_bytes()),
            })
            .insert(rdkafka::message::Header {
                key: "timestamp",
                value: Some(event.timestamp.to_string().as_bytes()),
            })
            .insert(rdkafka::message::Header {
                key: "schema_version",
                value: Some(event.metadata.schema_version.as_bytes()),
            });

        if let Some(ref correlation_id) = event.metadata.correlation_id {
            headers = headers.insert(rdkafka::message::Header {
                key: "correlation_id",
                value: Some(correlation_id.as_bytes()),
            });
        }

        if let Some(actor_id) = event.metadata.actor_id {
            headers = headers.insert(rdkafka::message::Header {
                key: "actor_id",
                value: Some(actor_id.to_string().as_bytes()),
            });
        }

        headers
    }

    /// Flush pending messages (useful before shutdown)
    pub fn flush(&self, timeout: Duration) {
        let _ = self.producer.flush(Timeout::After(timeout));
    }
}

/// Errors that can occur during event publishing
#[derive(Debug, Clone)]
pub enum EventPublishError {
    Serialization(String),
    Kafka(String),
    Unknown,
}

impl std::fmt::Display for EventPublishError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventPublishError::Serialization(e) => write!(f, "Serialization error: {}", e),
            EventPublishError::Kafka(e) => write!(f, "Kafka error: {}", e),
            EventPublishError::Unknown => write!(f, "Unknown error"),
        }
    }
}

impl std::error::Error for EventPublishError {}

/// Shared producer instance wrapped in Arc for thread-safe access
pub type SharedProducer = Arc<EventProducer>;

/// Initialize the event producer
pub fn init() -> Result<SharedProducer, rdkafka::error::KafkaError> {
    let producer = EventProducer::new()?;
    Ok(Arc::new(producer))
}
