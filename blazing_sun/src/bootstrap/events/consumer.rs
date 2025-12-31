use super::types::DomainEvent;
use crate::config::KafkaConfig;
use async_trait::async_trait;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{CommitMode, Consumer, StreamConsumer};
use rdkafka::message::{BorrowedMessage, Headers};
use rdkafka::Message;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;
use tracing::{error, info, warn};

/// Trait for event handlers
#[async_trait]
pub trait EventHandler: Send + Sync {
    /// Handle a domain event
    /// Returns true if the event was handled successfully, false if it should be retried
    async fn handle(&self, event: &DomainEvent) -> Result<(), EventHandlerError>;

    /// Get the topics this handler is interested in
    fn topics(&self) -> Vec<&'static str>;

    /// Get the handler name for logging
    fn name(&self) -> &'static str;
}

/// Errors that can occur during event handling
#[derive(Debug, Clone)]
pub enum EventHandlerError {
    /// Temporary error - event should be retried
    Retryable(String),
    /// Permanent error - event should be sent to dead letter queue
    Fatal(String),
    /// Skip this event (e.g., not relevant for this handler)
    Skip,
}

impl std::fmt::Display for EventHandlerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EventHandlerError::Retryable(e) => write!(f, "Retryable error: {}", e),
            EventHandlerError::Fatal(e) => write!(f, "Fatal error: {}", e),
            EventHandlerError::Skip => write!(f, "Event skipped"),
        }
    }
}

impl std::error::Error for EventHandlerError {}

/// Kafka event consumer
pub struct EventConsumer {
    consumer: StreamConsumer,
    group_id: String,
    handlers: Vec<Arc<dyn EventHandler>>,
    shutdown_tx: broadcast::Sender<()>,
}

impl EventConsumer {
    /// Create a new Kafka consumer
    pub fn new(group_id: &str) -> Result<Self, rdkafka::error::KafkaError> {
        let consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", KafkaConfig::bootstrap_servers())
            .set("group.id", group_id)
            .set("client.id", format!("{}-consumer", KafkaConfig::client_id()))
            .set("auto.offset.reset", KafkaConfig::auto_offset_reset())
            .set(
                "enable.auto.commit",
                if KafkaConfig::enable_auto_commit() {
                    "true"
                } else {
                    "false"
                },
            )
            .set("auto.commit.interval.ms", "5000")
            .set("session.timeout.ms", "30000")
            .set("heartbeat.interval.ms", "10000")
            .set("max.poll.interval.ms", "300000")
            .set("fetch.min.bytes", "1")
            .set("fetch.wait.max.ms", "500")
            .create()?;

        let (shutdown_tx, _) = broadcast::channel(1);

        info!(
            "Kafka consumer initialized for group: {} with bootstrap servers: {}",
            group_id,
            KafkaConfig::bootstrap_servers()
        );

        Ok(Self {
            consumer,
            group_id: group_id.to_string(),
            handlers: Vec::new(),
            shutdown_tx,
        })
    }

    /// Register an event handler
    pub fn register_handler(&mut self, handler: Arc<dyn EventHandler>) {
        info!(
            "Registering handler '{}' for topics: {:?}",
            handler.name(),
            handler.topics()
        );
        self.handlers.push(handler);
    }

    /// Subscribe to topics based on registered handlers
    pub fn subscribe(&self) -> Result<(), rdkafka::error::KafkaError> {
        let mut topics: Vec<&str> = Vec::new();

        for handler in &self.handlers {
            for topic in handler.topics() {
                if !topics.contains(&topic) {
                    topics.push(topic);
                }
            }
        }

        if topics.is_empty() {
            warn!("No topics to subscribe to - no handlers registered");
            return Ok(());
        }

        info!("Subscribing to topics: {:?}", topics);
        self.consumer.subscribe(&topics)
    }

    /// Start consuming events
    pub async fn start(&self) {
        info!(
            "Starting event consumer for group: {}",
            self.group_id
        );

        let mut shutdown_rx = self.shutdown_tx.subscribe();

        loop {
            tokio::select! {
                // Check for shutdown signal
                _ = shutdown_rx.recv() => {
                    info!("Shutdown signal received, stopping consumer");
                    break;
                }

                // Poll for messages
                message = self.consumer.recv() => {
                    match message {
                        Ok(msg) => {
                            if let Err(e) = self.process_message(&msg).await {
                                error!(
                                    topic = %msg.topic(),
                                    partition = %msg.partition(),
                                    offset = %msg.offset(),
                                    error = %e,
                                    "Failed to process message"
                                );
                            }
                        }
                        Err(e) => {
                            error!("Error receiving message: {}", e);
                            tokio::time::sleep(Duration::from_millis(100)).await;
                        }
                    }
                }
            }
        }

        info!("Event consumer stopped");
    }

    /// Process a single message
    async fn process_message(&self, msg: &BorrowedMessage<'_>) -> Result<(), Box<dyn std::error::Error>> {
        let payload = msg.payload().ok_or("Empty message payload")?;

        // Parse the event
        let event = match DomainEvent::from_bytes(payload) {
            Ok(e) => e,
            Err(e) => {
                error!(
                    topic = %msg.topic(),
                    partition = %msg.partition(),
                    offset = %msg.offset(),
                    error = %e,
                    "Failed to deserialize event"
                );
                // Commit to avoid reprocessing invalid messages
                self.consumer.commit_message(msg, CommitMode::Async)?;
                return Err(e.into());
            }
        };

        info!(
            event_id = %event.id,
            event_type = %event.event_type,
            entity_id = %event.entity_id,
            topic = %msg.topic(),
            partition = %msg.partition(),
            offset = %msg.offset(),
            "Processing event"
        );

        // Find and invoke matching handlers
        let mut handled = false;
        for handler in &self.handlers {
            if handler.topics().contains(&msg.topic()) {
                match handler.handle(&event).await {
                    Ok(()) => {
                        info!(
                            event_id = %event.id,
                            handler = %handler.name(),
                            "Event handled successfully"
                        );
                        handled = true;
                    }
                    Err(EventHandlerError::Skip) => {
                        // Handler chose to skip this event
                        continue;
                    }
                    Err(EventHandlerError::Retryable(reason)) => {
                        warn!(
                            event_id = %event.id,
                            handler = %handler.name(),
                            reason = %reason,
                            "Handler returned retryable error"
                        );
                        // Don't commit - message will be redelivered
                        return Err(reason.into());
                    }
                    Err(EventHandlerError::Fatal(reason)) => {
                        error!(
                            event_id = %event.id,
                            handler = %handler.name(),
                            reason = %reason,
                            "Handler returned fatal error"
                        );
                        // TODO: Send to dead letter queue
                        // For now, commit to avoid infinite loop
                    }
                }
            }
        }

        if !handled {
            warn!(
                event_id = %event.id,
                topic = %msg.topic(),
                "No handler processed the event"
            );
        }

        // Commit the offset
        self.consumer.commit_message(msg, CommitMode::Async)?;

        Ok(())
    }

    /// Get shutdown sender for graceful shutdown
    pub fn shutdown_signal(&self) -> broadcast::Sender<()> {
        self.shutdown_tx.clone()
    }

    /// Shutdown the consumer
    pub fn shutdown(&self) {
        let _ = self.shutdown_tx.send(());
    }
}

/// Shared consumer instance
pub type SharedConsumer = Arc<EventConsumer>;

/// Initialize an event consumer with a group ID
pub fn init(group_id: &str) -> Result<EventConsumer, rdkafka::error::KafkaError> {
    EventConsumer::new(group_id)
}

/// Start the consumer in a background task
pub fn start_consumer(consumer: SharedConsumer) {
    tokio::spawn(async move {
        consumer.start().await;
    });
}

/// Extract correlation ID from message headers
pub fn get_correlation_id(msg: &BorrowedMessage<'_>) -> Option<String> {
    msg.headers()
        .and_then(|headers| {
            for header in headers.iter() {
                if header.key == "correlation_id" {
                    return header.value.map(|v| String::from_utf8_lossy(v).to_string());
                }
            }
            None
        })
}

/// Extract actor ID from message headers
pub fn get_actor_id(msg: &BorrowedMessage<'_>) -> Option<i64> {
    msg.headers()
        .and_then(|headers| {
            for header in headers.iter() {
                if header.key == "actor_id" {
                    return header.value.and_then(|v| {
                        String::from_utf8_lossy(v).parse().ok()
                    });
                }
            }
            None
        })
}
