# Kafka Event System Documentation

This document provides comprehensive documentation for the Apache Kafka event streaming system in the Blazing Sun application.

---

## Overview

The Blazing Sun application uses Apache Kafka for event-driven architecture. Unlike RabbitMQ (task queue), Kafka provides an immutable event log with multiple consumers.

**File Locations:**
- Event System Core: `bootstrap/events/mod.rs`
- Event Types: `bootstrap/events/types.rs`
- Topics: `bootstrap/events/topics.rs`
- Producer: `bootstrap/events/producer.rs`
- Consumer: `bootstrap/events/consumer.rs`
- Event Handlers: `bootstrap/events/handlers/`
- Kafka Config: `config/kafka.rs`

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Kafka Event System Architecture                      │
└────────────────────────────────────────────────────────────────────────────┘

┌───────────────┐                    ┌─────────────────────────────────────┐
│  Controller   │                    │           Apache Kafka              │
│   (Publish)   │───────────────────▶│                                     │
└───────────────┘                    │  Topics:                            │
                                     │  ├── user.events                    │
                                     │  ├── auth.events                    │
                                     │  ├── transaction.events             │
                                     │  ├── category.events                │
                                     │  ├── system.events                  │
                                     │  └── events.dead_letter             │
                                     │                                     │
                                     └────────────────┬────────────────────┘
                                                      │
                           ┌──────────────────────────┼──────────────────────────┐
                           │                          │                          │
                           ▼                          ▼                          ▼
                    ┌─────────────┐            ┌─────────────┐           ┌─────────────┐
                    │ Consumer    │            │ Consumer    │           │ Consumer    │
                    │ Group:      │            │ Group:      │           │ Group:      │
                    │ main-app    │            │ analytics   │           │ audit       │
                    │             │            │             │           │             │
                    │ Handlers:   │            │ Handlers:   │           │ Handlers:   │
                    │ - User      │            │ - Metrics   │           │ - Logger    │
                    │ - Auth      │            │ - Reports   │           │ - Archiver  │
                    └─────────────┘            └─────────────┘           └─────────────┘
```

### RabbitMQ vs Kafka

| Feature | RabbitMQ | Kafka |
|---------|----------|-------|
| Pattern | Task Queue | Event Log |
| Use Case | Commands/Tasks | Facts/Events |
| Message | Deleted after ACK | Retained (configurable) |
| Consumers | One per message | Multiple can read same message |
| Replay | No | Yes (offset-based) |
| Best For | Email, payments | Audit, analytics, sync |

---

## Configuration

### Environment Variables

```env
# Kafka Configuration
KAFKA_HOST=kafka
KAFKA_PORT=9092
KAFKA_CONTROLLER_PORT=9093
KAFKA_BROKER_ID=1
KAFKA_CLUSTER_ID=MkU3OEVBNTcwNTJENDM2Qk
KAFKA_NUM_PARTITIONS=3
KAFKA_LOG_RETENTION_HOURS=168

# Consumer
KAFKA_GROUP_ID=blazing-sun-main
KAFKA_AUTO_OFFSET_RESET=earliest
```

### KafkaConfig (`config/kafka.rs`)

```rust
use once_cell::sync::Lazy;

pub struct KafkaConfig {
    pub bootstrap_servers: String,
    pub group_id: String,
    pub auto_offset_reset: String,
    pub enable_auto_commit: bool,
    pub session_timeout_ms: u32,
}

pub static KAFKA: Lazy<KafkaConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    let host = std::env::var("KAFKA_HOST").unwrap_or_else(|_| "kafka".to_string());
    let port = std::env::var("KAFKA_PORT").unwrap_or_else(|_| "9092".to_string());

    KafkaConfig {
        bootstrap_servers: format!("{}:{}", host, port),
        group_id: std::env::var("KAFKA_GROUP_ID")
            .unwrap_or_else(|_| "blazing-sun-main".to_string()),
        auto_offset_reset: std::env::var("KAFKA_AUTO_OFFSET_RESET")
            .unwrap_or_else(|_| "earliest".to_string()),
        enable_auto_commit: true,
        session_timeout_ms: 30000,
    }
});

impl KafkaConfig {
    pub fn bootstrap_servers() -> &'static str { &KAFKA.bootstrap_servers }
    pub fn group_id() -> &'static str { &KAFKA.group_id }
}
```

---

## Topics

### Available Topics

| Topic | Description | Event Types |
|-------|-------------|-------------|
| `user.events` | User lifecycle events | created, updated, deleted, activated |
| `auth.events` | Authentication events | sign_in, sign_out, sign_in_failed |
| `transaction.events` | Financial transactions | created, updated, deleted |
| `category.events` | Category management | created, updated, deleted |
| `system.events` | System-level events | health_check, error, warning |
| `events.dead_letter` | Failed events | All types (for reprocessing) |
| `checkout.requests` | Checkout requests (raw JSON) | CheckoutKafkaRequest |
| `checkout.finished` | Checkout completion events (raw JSON) | session_created, success, failed |
| `games.commands` | Game commands from WebSocket gateway | create_room, join_room, roll_dice |
| `games.events` | Game events to WebSocket gateway | room_created, player_joined, game_over |
| `bigger_dice.participation_payed` | Player selected for game (balance deducted) | game.participation.deducted |
| `bigger_dice.win_prize` | Player won game (prize awarded) | game.prize.won |

### Topics Module (`bootstrap/events/topics.rs`)

```rust
pub mod topic {
    pub const USER_EVENTS: &str = "user.events";
    pub const AUTH_EVENTS: &str = "auth.events";
    pub const TRANSACTION_EVENTS: &str = "transaction.events";
    pub const CATEGORY_EVENTS: &str = "category.events";
    pub const SYSTEM_EVENTS: &str = "system.events";
    pub const DEAD_LETTER: &str = "events.dead_letter";
    pub const CHECKOUT_REQUESTS: &str = "checkout.requests";
    pub const CHECKOUT_FINISHED: &str = "checkout.finished";
    pub const GAMES_COMMANDS: &str = "games.commands";
    pub const GAMES_EVENTS: &str = "games.events";
    pub const BIGGER_DICE_PARTICIPATION_PAYED: &str = "bigger_dice.participation_payed";
    pub const BIGGER_DICE_WIN_PRIZE: &str = "bigger_dice.win_prize";
}

pub mod consumer_groups {
    pub const MAIN_APP: &str = "blazing-sun-main";
    pub const ANALYTICS: &str = "blazing-sun-analytics";
    pub const AUDIT: &str = "blazing-sun-audit";
}
```

---

## Event Types

### EventType Enum

```rust
// bootstrap/events/types.rs

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "domain", content = "type")]
pub enum EventType {
    User(UserEventType),
    Auth(AuthEventType),
    Transaction(TransactionEventType),
    Category(CategoryEventType),
    System(SystemEventType),
}

impl EventType {
    /// Get the topic name for this event type
    pub fn topic(&self) -> &'static str {
        match self {
            EventType::User(_) => topic::USER_EVENTS,
            EventType::Auth(_) => topic::AUTH_EVENTS,
            EventType::Transaction(_) => topic::TRANSACTION_EVENTS,
            EventType::Category(_) => topic::CATEGORY_EVENTS,
            EventType::System(_) => topic::SYSTEM_EVENTS,
        }
    }

    /// Get the entity type name
    pub fn entity_type(&self) -> &'static str {
        match self {
            EventType::User(_) => "user",
            EventType::Auth(_) => "auth",
            EventType::Transaction(_) => "transaction",
            EventType::Category(_) => "category",
            EventType::System(_) => "system",
        }
    }
}
```

### User Event Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UserEventType {
    Created,
    Updated,
    Deleted,
    Activated,
    Deactivated,
    PasswordChanged,
    ProfileUpdated,
    BalanceUpdated,
}
```

### Auth Event Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuthEventType {
    SignIn,
    SignOut,
    SignInFailed,
    PasswordResetRequested,
    PasswordResetCompleted,
    AccountLocked,
    AccountUnlocked,
}
```

### Transaction Event Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TransactionEventType {
    Created,
    Updated,
    Deleted,
    Categorized,
    AmountAdjusted,
}
```

### Category Event Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CategoryEventType {
    Created,
    Updated,
    Deleted,
    BalanceRecalculated,
}
```

### System Event Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SystemEventType {
    HealthCheck,
    Error,
    Warning,
    ServiceStarted,
    ServiceStopped,
}
```

---

## DomainEvent Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEvent {
    /// Unique identifier for this event (UUID v4)
    pub id: String,

    /// Type of event
    pub event_type: EventType,

    /// Entity type (user, transaction, etc.)
    pub entity_type: String,

    /// ID of the affected entity
    pub entity_id: String,

    /// Event payload (flexible JSON structure)
    pub payload: Value,

    /// Event metadata for tracing
    pub metadata: EventMetadata,

    /// Unix timestamp in milliseconds
    pub timestamp: i64,

    /// Version number for ordering
    pub version: i64,
}

impl DomainEvent {
    pub fn new(event_type: EventType, entity_id: &str, payload: Value) -> Self {
        let entity_type = event_type.entity_type().to_string();
        Self {
            id: Uuid::new_v4().to_string(),
            event_type,
            entity_type,
            entity_id: entity_id.to_string(),
            payload,
            metadata: EventMetadata::default(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            version: 1,
        }
    }

    /// Get the topic for this event
    pub fn topic(&self) -> &'static str {
        self.event_type.topic()
    }

    /// Get the partition key (entity_id for ordering)
    pub fn partition_key(&self) -> &str {
        &self.entity_id
    }
}
```

---

## EventMetadata

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventMetadata {
    /// Correlation ID for tracing related events
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,

    /// ID of the event that caused this event
    #[serde(skip_serializing_if = "Option::is_none")]
    pub causation_id: Option<String>,

    /// User ID who triggered the event
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor_id: Option<i64>,

    /// Source service/module
    pub source: String,

    /// IP address of the request
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,

    /// User agent string
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,

    /// Request ID for HTTP tracing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,

    /// Schema version for compatibility
    pub schema_version: String,
}

impl EventMetadata {
    pub fn new(source: &str) -> Self {
        Self {
            source: source.to_string(),
            schema_version: "1.0".to_string(),
            ..Default::default()
        }
    }

    pub fn with_actor(mut self, actor_id: i64) -> Self {
        self.actor_id = Some(actor_id);
        self
    }

    pub fn with_correlation_id(mut self, id: &str) -> Self {
        self.correlation_id = Some(id.to_string());
        self
    }

    pub fn with_request_context(
        mut self,
        request_id: Option<String>,
        ip_address: Option<String>,
        user_agent: Option<String>,
    ) -> Self {
        self.request_id = request_id;
        self.ip_address = ip_address;
        self.user_agent = user_agent;
        self
    }
}
```

---

## EventBuilder

```rust
pub struct EventBuilder {
    event_type: EventType,
    entity_id: String,
    payload: Value,
    metadata: EventMetadata,
    version: i64,
}

impl EventBuilder {
    pub fn new(event_type: EventType, entity_id: &str) -> Self {
        Self {
            event_type,
            entity_id: entity_id.to_string(),
            payload: Value::Null,
            metadata: EventMetadata::default(),
            version: 1,
        }
    }

    pub fn payload<T: Serialize>(mut self, payload: T) -> Self {
        self.payload = serde_json::to_value(payload).unwrap_or(Value::Null);
        self
    }

    pub fn metadata(mut self, metadata: EventMetadata) -> Self {
        self.metadata = metadata;
        self
    }

    pub fn actor(mut self, actor_id: i64) -> Self {
        self.metadata.actor_id = Some(actor_id);
        self
    }

    pub fn correlation_id(mut self, id: &str) -> Self {
        self.metadata.correlation_id = Some(id.to_string());
        self
    }

    pub fn version(mut self, version: i64) -> Self {
        self.version = version;
        self
    }

    pub fn build(self) -> DomainEvent {
        DomainEvent::new(self.event_type, &self.entity_id, self.payload)
            .with_metadata(self.metadata)
            .with_version(self.version)
    }
}
```

---

## Publishing Events

### Method 1: Using Helper Functions (Recommended)

```rust
use crate::bootstrap::events;

// In a controller
if let Some(event_bus) = state.event_bus() {
    // User created event
    events::publish::user_created(
        event_bus,
        user_id,
        &email,
        &first_name,
        &last_name,
        None,  // actor_id
    ).await?;

    // Auth sign in event
    events::publish::auth_sign_in(
        event_bus,
        user_id,
        &email,
        ip_address.as_deref(),
        user_agent.as_deref(),
    ).await?;

    // User password changed event
    events::publish::user_password_changed(
        event_bus,
        user_id,
        Some(actor_id),
    ).await?;
}
```

### Available Helper Functions

```rust
// bootstrap/events/mod.rs::publish

/// Publish a user.created event
pub async fn user_created(
    event_bus: &EventBus,
    user_id: i64,
    email: &str,
    first_name: &str,
    last_name: &str,
    actor_id: Option<i64>,
) -> Result<String, EventPublishError>

/// Publish a user.updated event
pub async fn user_updated(
    event_bus: &EventBus,
    user_id: i64,
    fields_changed: Vec<String>,
    first_name: Option<String>,
    last_name: Option<String>,
    balance: Option<i64>,
    actor_id: Option<i64>,
) -> Result<String, EventPublishError>

/// Publish a user.deleted event
pub async fn user_deleted(
    event_bus: &EventBus,
    user_id: i64,
    email: &str,
    reason: Option<&str>,
    actor_id: Option<i64>,
) -> Result<String, EventPublishError>

/// Publish a user.activated event
pub async fn user_activated(
    event_bus: &EventBus,
    user_id: i64,
    actor_id: Option<i64>,
) -> Result<String, EventPublishError>

/// Publish an auth.sign_in event
pub async fn auth_sign_in(
    event_bus: &EventBus,
    user_id: i64,
    email: &str,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) -> Result<String, EventPublishError>

/// Publish an auth.sign_in_failed event
pub async fn auth_sign_in_failed(
    event_bus: &EventBus,
    email: &str,
    reason: &str,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) -> Result<String, EventPublishError>

/// Publish a user.password_changed event
pub async fn user_password_changed(
    event_bus: &EventBus,
    user_id: i64,
    actor_id: Option<i64>,
) -> Result<String, EventPublishError>
```

### Method 2: Using EventBuilder

```rust
use crate::bootstrap::events::{EventBuilder, EventType, UserEventType};

let event = EventBuilder::new(
    EventType::User(UserEventType::BalanceUpdated),
    &user_id.to_string(),
)
.payload(serde_json::json!({
    "old_balance": old_balance,
    "new_balance": new_balance,
    "change": new_balance - old_balance,
}))
.actor(actor_id)
.correlation_id("request-123")
.build();

event_bus.publish(&event).await?;
```

### Method 3: Direct DomainEvent Creation

```rust
use crate::bootstrap::events::types::{DomainEvent, EventType, UserEventType, EventMetadata};

let event = DomainEvent::new(
    EventType::User(UserEventType::ProfileUpdated),
    &user_id.to_string(),
    serde_json::json!({
        "changed_fields": ["first_name", "avatar"],
    }),
)
.with_metadata(
    EventMetadata::new("user-service")
        .with_actor(actor_id)
        .with_correlation_id("req-abc-123")
);

event_bus.publish(&event).await?;
```

---

## Event Payloads

### Pre-defined Payloads

```rust
// bootstrap/events/types.rs::payloads

/// Payload for user created event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserCreatedPayload {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub activated: bool,
}

/// Payload for user updated event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserUpdatedPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub balance: Option<i64>,
    pub fields_changed: Vec<String>,
}

/// Payload for user deleted event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDeletedPayload {
    pub email: String,
    pub reason: Option<String>,
}

/// Payload for auth sign in event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSignInPayload {
    pub email: String,
    pub success: bool,
    pub failure_reason: Option<String>,
}
```

---

## Consuming Events

### EventHandler Trait

```rust
// bootstrap/events/consumer.rs

use async_trait::async_trait;

#[async_trait]
pub trait EventHandler: Send + Sync {
    /// Handler name for logging
    fn name(&self) -> &'static str;

    /// Topics this handler subscribes to
    fn topics(&self) -> Vec<&'static str>;

    /// Handle an event
    async fn handle(&self, event: &DomainEvent) -> Result<(), EventHandlerError>;
}

#[derive(Debug)]
pub enum EventHandlerError {
    Temporary(String),  // Will retry
    Permanent(String),  // Will not retry
}
```

### Creating a Handler

```rust
// bootstrap/events/handlers/my_handler.rs

use crate::bootstrap::events::consumer::{EventHandler, EventHandlerError};
use crate::bootstrap::events::types::{DomainEvent, EventType, UserEventType};
use crate::bootstrap::events::topics::topic;
use async_trait::async_trait;
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct MyEventHandler {
    db: Arc<Mutex<Pool<Postgres>>>,
}

impl MyEventHandler {
    pub fn new(db: Arc<Mutex<Pool<Postgres>>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl EventHandler for MyEventHandler {
    fn name(&self) -> &'static str {
        "my_event_handler"
    }

    fn topics(&self) -> Vec<&'static str> {
        vec![topic::USER_EVENTS, topic::AUTH_EVENTS]
    }

    async fn handle(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        match &event.event_type {
            EventType::User(UserEventType::Created) => {
                // Handle user created
                let db = self.db.lock().await;
                // Do something...
                tracing::info!("User {} created", event.entity_id);
            }
            EventType::Auth(AuthEventType::SignIn) => {
                // Handle sign in
                tracing::info!("User {} signed in", event.entity_id);
            }
            _ => {
                // Ignore other events
            }
        }

        Ok(())
    }
}
```

### Registering Handlers

```rust
// bootstrap/events/handlers/mod.rs

pub mod user;
pub mod auth;
pub mod my_handler;

use crate::bootstrap::events::consumer::EventConsumer;
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;

pub type SharedDb = Arc<Mutex<Pool<Postgres>>>;

pub fn register_default_handlers(consumer: &mut EventConsumer, db: SharedDb) {
    // Register user event handler
    consumer.register_handler(Arc::new(user::UserEventHandler::new(db.clone())));

    // Register auth event handler
    consumer.register_handler(Arc::new(auth::AuthEventHandler::new(db.clone())));

    // Register your handler
    consumer.register_handler(Arc::new(my_handler::MyEventHandler::new(db.clone())));
}
```

---

## EventBus

```rust
// bootstrap/events/mod.rs

pub struct EventBus {
    producer: SharedProducer,
}

impl EventBus {
    pub fn new(producer: SharedProducer) -> Self {
        Self { producer }
    }

    /// Publish a domain event
    pub async fn publish(&self, event: &DomainEvent) -> Result<(), EventPublishError> {
        self.producer.publish(event).await
    }

    /// Publish with retry
    pub async fn publish_reliable(
        &self,
        event: &DomainEvent,
        max_retries: u32,
    ) -> Result<(), EventPublishError> {
        self.producer.publish_with_retry(event, max_retries).await
    }

    /// Publish multiple events
    pub async fn publish_batch(&self, events: &[DomainEvent]) -> Vec<Result<(), EventPublishError>> {
        self.producer.publish_batch(events).await
    }
}

pub type SharedEventBus = Arc<EventBus>;
```

---

## Initialization

### Full Initialization (Producer + Consumer)

```rust
// bootstrap/events/mod.rs

pub async fn init(
    db: Arc<Mutex<Pool<Postgres>>>,
) -> Result<(SharedEventBus, Arc<EventConsumer>), Box<dyn std::error::Error + Send + Sync>> {
    info!("Initializing Kafka event system...");

    // Initialize producer
    let producer = producer::init()?;
    let event_bus = Arc::new(EventBus::new(producer));

    // Initialize consumer
    let mut consumer = consumer::init(consumer_groups::MAIN_APP)?;

    // Register default handlers
    handlers::register_default_handlers(&mut consumer, db);

    // Subscribe to topics
    consumer.subscribe()?;

    let consumer = Arc::new(consumer);

    info!("Kafka event system initialized successfully");

    Ok((event_bus, consumer))
}
```

### Producer Only

```rust
pub fn init_producer() -> Result<SharedEventBus, Box<dyn std::error::Error + Send + Sync>> {
    let producer = producer::init()?;
    let event_bus = Arc::new(EventBus::new(producer));
    Ok(event_bus)
}
```

### Starting Consumer

```rust
pub fn start_consumer(consumer: Arc<EventConsumer>) {
    consumer::start_consumer(consumer);
}
```

---

## Application Integration

### In main.rs

```rust
use crate::bootstrap::events;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Initialize tracing
    tracing_logger::init();

    // Create database pool
    let pool = create_pool().await;
    let db = Arc::new(Mutex::new(pool.clone()));

    // Initialize Kafka (producer + consumer)
    let (event_bus, consumer) = events::init(db.clone()).await
        .expect("Failed to initialize Kafka");

    // Start consumer in background
    events::start_consumer(consumer);

    // Create app state with event bus
    let state = state_with_mq_and_events(dyn_mq, event_bus).await;

    // Start server...
}
```

### In Controllers

```rust
use crate::bootstrap::events;

pub async fn sign_up(
    state: web::Data<AppState>,
    body: web::Json<SignupRequest>,
) -> HttpResponse {
    // ... create user ...

    // Publish event
    if let Some(event_bus) = state.event_bus() {
        if let Err(e) = events::publish::user_created(
            event_bus, user_id, &email, &first_name, &last_name, None
        ).await {
            tracing::warn!("Failed to publish user.created event: {}", e);
            // Don't fail the request - events are non-critical
        }
    }

    HttpResponse::Ok().json(response)
}
```

---

## Best Practices

1. **Event naming**: Use past tense (`user.created`, not `user.create`)
2. **Idempotent handlers**: Design handlers to safely process duplicate events
3. **Include metadata**: Always add correlation_id for tracing
4. **Don't block on events**: Publish async, don't wait for confirmation in request path
5. **Handle failures gracefully**: Log and continue, events are non-critical
6. **Version your schemas**: Include schema_version in metadata
7. **Use appropriate topics**: Don't mix unrelated events

---

## Monitoring

### Kafka UI

Access at `http://localhost:8080/kafka`:
- View topics and partitions
- See consumer groups and lag
- Browse messages

### Useful Kafka Commands

```bash
# List topics
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
    --list --bootstrap-server localhost:9092

# Describe topic
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
    --describe --topic user.events --bootstrap-server localhost:9092

# Consume messages (for debugging)
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic user.events \
    --from-beginning

# Check consumer group lag
docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh \
    --bootstrap-server localhost:9092 \
    --group blazing-sun-main \
    --describe
```

---

## Related Documentation

- [Message Queue (RabbitMQ)](../MessageQueue/MESSAGE_QUEUE.md) - Task queue comparison
- [Bootstrap Documentation](../Bootstrap/BOOTSTRAP.md) - Core framework
- [API Routes](../Routes/Api/API_ROUTES.md) - API endpoints that publish events
