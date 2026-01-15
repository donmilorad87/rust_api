//! Event-Driven Architecture Module for Blazing Sun
//!
//! This module provides a comprehensive event streaming system using Apache Kafka.
//! It enables:
//! - Publishing domain events for all database mutations
//! - Consuming events for building derived data, auditing, and notifications
//! - Decoupled, scalable architecture with multiple consumers
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────┐     ┌─────────┐     ┌──────────────┐
//! │   API       │────>│  Kafka  │────>│  Consumers   │
//! │  Handlers   │     │  Topics │     │  (Handlers)  │
//! └─────────────┘     └─────────┘     └──────────────┘
//!       │                                    │
//!       │                                    │
//!       v                                    v
//! ┌─────────────┐                    ┌──────────────┐
//! │  Database   │                    │   Derived    │
//! │  (Source)   │                    │    State     │
//! └─────────────┘                    └──────────────┘
//! ```
//!
//! # Topics
//!
//! - `user.events` - User lifecycle events (created, updated, deleted)
//! - `auth.events` - Authentication events (sign_in, sign_out, password changes)
//! - `transaction.events` - Financial transaction events
//! - `category.events` - Category management events
//! - `system.events` - System-level events
//!
//! # Usage
//!
//! ## Publishing Events
//!
//! ```rust,ignore
//! use events::{EventBus, EventType, UserEventType, EventBuilder};
//!
//! // Get the event bus from AppState
//! let event_bus = state.event_bus();
//!
//! // Create and publish an event
//! let event = EventBuilder::new(
//!     EventType::User(UserEventType::Created),
//!     &user_id.to_string()
//! )
//! .payload(UserCreatedPayload { email, first_name, last_name, activated: false })
//! .actor(actor_id)
//! .build();
//!
//! event_bus.publish(&event).await?;
//! ```
//!
//! ## Consuming Events
//!
//! ```rust,ignore
//! use events::{EventConsumer, EventHandler, consumer_groups};
//!
//! // Create a consumer for a specific group
//! let mut consumer = EventConsumer::new(consumer_groups::ANALYTICS)?;
//!
//! // Register handlers
//! consumer.register_handler(Arc::new(MyHandler::new()));
//!
//! // Subscribe and start consuming
//! consumer.subscribe()?;
//! consumer.start().await;
//! ```

pub mod consumer;
pub mod handlers;
pub mod producer;
pub mod topics;
pub mod types;

pub use consumer::{EventConsumer, EventHandler, EventHandlerError};
pub use producer::{EventProducer, EventPublishError, SharedProducer};
pub use topics::{consumer_groups, topic};
pub use types::{
    AuthEventType, CategoryEventType, DomainEvent, EventBuilder, EventMetadata, EventType,
    SystemEventType, TransactionEventType, UserEventType,
};

use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info};

/// The main event bus that provides a unified interface for publishing events
pub struct EventBus {
    producer: SharedProducer,
}

impl EventBus {
    /// Create a new event bus
    pub fn new(producer: SharedProducer) -> Self {
        Self { producer }
    }

    /// Publish a domain event
    pub async fn publish(&self, event: &DomainEvent) -> Result<(), EventPublishError> {
        self.producer.publish(event).await
    }

    /// Publish a domain event with retry
    pub async fn publish_reliable(
        &self,
        event: &DomainEvent,
        max_retries: u32,
    ) -> Result<(), EventPublishError> {
        self.producer.publish_with_retry(event, max_retries).await
    }

    /// Publish multiple events (batch)
    pub async fn publish_batch(
        &self,
        events: &[DomainEvent],
    ) -> Vec<Result<(), EventPublishError>> {
        self.producer.publish_batch(events).await
    }

    /// Get a reference to the underlying producer
    pub fn producer(&self) -> &SharedProducer {
        &self.producer
    }
}

/// Shared event bus instance
pub type SharedEventBus = Arc<EventBus>;

/// Initialize the event system (producer + consumer with default handlers)
pub async fn init(
    db: Arc<Mutex<Pool<Postgres>>>,
) -> Result<(SharedEventBus, Arc<EventConsumer>), Box<dyn std::error::Error + Send + Sync>> {
    // Delegate to init_full with no MongoDB (default handlers only)
    init_full(db, None).await
}

/// Initialize the event system with MongoDB support (for WebSocket gateway handlers)
/// This registers chat and game handlers in addition to default handlers.
pub async fn init_full(
    db: Arc<Mutex<Pool<Postgres>>>,
    mongodb: Option<Arc<mongodb::Database>>,
) -> Result<(SharedEventBus, Arc<EventConsumer>), Box<dyn std::error::Error + Send + Sync>> {
    info!("Initializing Kafka event system...");

    // Initialize producer
    let producer = producer::init().map_err(|e| {
        error!("Failed to initialize Kafka producer: {}", e);
        Box::new(e) as Box<dyn std::error::Error + Send + Sync>
    })?;

    let event_bus = Arc::new(EventBus::new(producer.clone()));

    // Initialize consumer
    let mut consumer = consumer::init(consumer_groups::MAIN_APP).map_err(|e| {
        error!("Failed to initialize Kafka consumer: {}", e);
        Box::new(e) as Box<dyn std::error::Error + Send + Sync>
    })?;

    // Register handlers based on whether MongoDB is available
    if mongodb.is_some() {
        // Register all handlers including WebSocket gateway handlers
        handlers::register_all_handlers(&mut consumer, db, mongodb, Some(producer.clone()));
        info!("Registered all handlers (default + WebSocket gateway)");
    } else {
        // Register only default handlers
        handlers::register_default_handlers(&mut consumer, db, Some(producer.clone()));
        info!("Registered default handlers only");
    }

    // Subscribe to topics
    consumer.subscribe().map_err(|e| {
        error!("Failed to subscribe to topics: {}", e);
        Box::new(e) as Box<dyn std::error::Error + Send + Sync>
    })?;

    let consumer = Arc::new(consumer);

    info!("Kafka event system initialized successfully");

    Ok((event_bus, consumer))
}

/// Initialize only the producer (for lighter-weight usage)
pub fn init_producer() -> Result<SharedEventBus, Box<dyn std::error::Error + Send + Sync>> {
    info!("Initializing Kafka producer only...");

    let producer = producer::init().map_err(|e| {
        error!("Failed to initialize Kafka producer: {}", e);
        Box::new(e) as Box<dyn std::error::Error + Send + Sync>
    })?;

    let event_bus = Arc::new(EventBus::new(producer));

    info!("Kafka producer initialized successfully");

    Ok(event_bus)
}

/// Start the consumer in a background task
pub fn start_consumer(consumer: Arc<EventConsumer>) {
    info!("Starting Kafka event consumer in background...");
    consumer::start_consumer(consumer);
}

/// Helper functions for common event publishing patterns
pub mod publish {
    use super::*;
    use types::payloads::*;

    /// Publish a user.created event
    pub async fn user_created(
        event_bus: &EventBus,
        user_id: i64,
        email: &str,
        first_name: &str,
        last_name: &str,
        actor_id: Option<i64>,
    ) -> Result<String, EventPublishError> {
        let payload = UserCreatedPayload {
            email: email.to_string(),
            first_name: first_name.to_string(),
            last_name: last_name.to_string(),
            activated: false,
        };

        let mut builder = EventBuilder::new(
            EventType::User(UserEventType::Created),
            &user_id.to_string(),
        )
        .payload(payload);

        if let Some(actor) = actor_id {
            builder = builder.actor(actor);
        }

        let event = builder.build();
        let event_id = event.id.clone();

        event_bus.publish(&event).await?;
        Ok(event_id)
    }

    /// Publish a user.updated event
    pub async fn user_updated(
        event_bus: &EventBus,
        user_id: i64,
        fields_changed: Vec<String>,
        first_name: Option<String>,
        last_name: Option<String>,
        balance: Option<i64>,
        actor_id: Option<i64>,
    ) -> Result<String, EventPublishError> {
        let payload = UserUpdatedPayload {
            first_name,
            last_name,
            balance,
            fields_changed,
        };

        let mut builder = EventBuilder::new(
            EventType::User(UserEventType::Updated),
            &user_id.to_string(),
        )
        .payload(payload);

        if let Some(actor) = actor_id {
            builder = builder.actor(actor);
        }

        let event = builder.build();
        let event_id = event.id.clone();

        event_bus.publish(&event).await?;
        Ok(event_id)
    }

    /// Publish a user.deleted event
    pub async fn user_deleted(
        event_bus: &EventBus,
        user_id: i64,
        email: &str,
        reason: Option<&str>,
        actor_id: Option<i64>,
    ) -> Result<String, EventPublishError> {
        let payload = UserDeletedPayload {
            email: email.to_string(),
            reason: reason.map(|s| s.to_string()),
        };

        let mut builder = EventBuilder::new(
            EventType::User(UserEventType::Deleted),
            &user_id.to_string(),
        )
        .payload(payload);

        if let Some(actor) = actor_id {
            builder = builder.actor(actor);
        }

        let event = builder.build();
        let event_id = event.id.clone();

        event_bus.publish(&event).await?;
        Ok(event_id)
    }

    /// Publish a user.activated event
    pub async fn user_activated(
        event_bus: &EventBus,
        user_id: i64,
        actor_id: Option<i64>,
    ) -> Result<String, EventPublishError> {
        let mut builder = EventBuilder::new(
            EventType::User(UserEventType::Activated),
            &user_id.to_string(),
        )
        .payload(serde_json::json!({"activated": true}));

        if let Some(actor) = actor_id {
            builder = builder.actor(actor);
        }

        let event = builder.build();
        let event_id = event.id.clone();

        event_bus.publish(&event).await?;
        Ok(event_id)
    }

    /// Publish an auth.sign_in event
    pub async fn auth_sign_in(
        event_bus: &EventBus,
        user_id: i64,
        email: &str,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<String, EventPublishError> {
        let payload = AuthSignInPayload {
            email: email.to_string(),
            success: true,
            failure_reason: None,
        };

        let metadata = EventMetadata::new("auth-service")
            .with_actor(user_id)
            .with_request_context(
                None,
                ip_address.map(|s| s.to_string()),
                user_agent.map(|s| s.to_string()),
            );

        let event = EventBuilder::new(EventType::Auth(AuthEventType::SignIn), &user_id.to_string())
            .payload(payload)
            .metadata(metadata)
            .build();

        let event_id = event.id.clone();
        event_bus.publish(&event).await?;
        Ok(event_id)
    }

    /// Publish an auth.sign_in_failed event
    pub async fn auth_sign_in_failed(
        event_bus: &EventBus,
        email: &str,
        reason: &str,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<String, EventPublishError> {
        let payload = AuthSignInPayload {
            email: email.to_string(),
            success: false,
            failure_reason: Some(reason.to_string()),
        };

        let metadata = EventMetadata::new("auth-service").with_request_context(
            None,
            ip_address.map(|s| s.to_string()),
            user_agent.map(|s| s.to_string()),
        );

        let event = EventBuilder::new(
            EventType::Auth(AuthEventType::SignInFailed),
            email, // Use email as entity_id since we don't have user_id
        )
        .payload(payload)
        .metadata(metadata)
        .build();

        let event_id = event.id.clone();
        event_bus.publish(&event).await?;
        Ok(event_id)
    }

    /// Publish a user.password_changed event
    pub async fn user_password_changed(
        event_bus: &EventBus,
        user_id: i64,
        actor_id: Option<i64>,
    ) -> Result<String, EventPublishError> {
        let mut builder = EventBuilder::new(
            EventType::User(UserEventType::PasswordChanged),
            &user_id.to_string(),
        )
        .payload(serde_json::json!({"changed": true}));

        if let Some(actor) = actor_id {
            builder = builder.actor(actor);
        }

        let event = builder.build();
        let event_id = event.id.clone();

        event_bus.publish(&event).await?;
        Ok(event_id)
    }
}
