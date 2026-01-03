# Event-Driven Architecture

## Dual Messaging Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                     HTTP Request Handler                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│      RabbitMQ         │       │        Kafka          │
│   (Task Queue)        │       │    (Event Stream)     │
│                       │       │                       │
│ Pattern: Work Queue   │       │ Pattern: Pub/Sub      │
│ Delivery: At-least-1  │       │ Delivery: At-least-1  │
│ Consumers: 1 per msg  │       │ Consumers: Many       │
└───────────┬───────────┘       └───────────┬───────────┘
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│   MQ Workers (4)      │       │   Event Handlers      │
│   - create_user       │       │   - UserEventHandler  │
│   - send_email        │       │   - AuthEventHandler  │
└───────────────────────┘       └───────────────────────┘
```

| System   | Purpose | When to Use |
|----------|---------|-------------|
| RabbitMQ | Commands/Tasks | Side effects, external calls (email, SMS, payments) |
| Kafka    | Events/Facts | Audit, analytics, notifications, cross-service |

## Kafka Topics

| Topic | Events | Entity |
|-------|--------|--------|
| `user.events` | created, updated, deleted, activated, password_changed | User |
| `auth.events` | sign_in, sign_in_failed, sign_out, password_reset_requested | Auth |
| `transaction.events` | created, updated, deleted | Transaction |
| `category.events` | created, updated, deleted | Category |
| `system.events` | health_check, error, warning | System |

## Event Types (`bootstrap/events/types.rs`)

```rust
pub enum EventType {
    User(UserEventType),
    Auth(AuthEventType),
    Transaction(TransactionEventType),
    Category(CategoryEventType),
    System(SystemEventType),
}

pub enum UserEventType {
    Created, Updated, Deleted, Activated, PasswordChanged, BalanceUpdated,
}

pub enum AuthEventType {
    SignIn, SignInFailed, SignOut, PasswordResetRequested, PasswordReset,
}

pub struct DomainEvent {
    pub id: String,              // UUID v4
    pub event_type: EventType,
    pub entity_type: String,     // "user", "auth", etc.
    pub entity_id: String,       // Affected entity ID
    pub payload: Value,          // JSON payload
    pub metadata: EventMetadata,
    pub timestamp: i64,          // Unix milliseconds
    pub version: i64,            // For ordering
}
```

## Publishing Events

```rust
use crate::bootstrap::events;

// Using helper functions (recommended)
if let Some(event_bus) = state.event_bus() {
    events::publish::user_created(event_bus, user_id, &email, &first_name, &last_name, None).await?;
    events::publish::auth_sign_in(event_bus, user_id, &email, ip, user_agent).await?;
}

// Using EventBuilder (for custom events)
use crate::bootstrap::events::{EventBuilder, EventType, UserEventType};

let event = EventBuilder::new(EventType::User(UserEventType::BalanceUpdated), &user_id.to_string())
    .payload(serde_json::json!({ "old_balance": 1000, "new_balance": 1500 }))
    .actor(actor_id)
    .correlation_id("req-123")
    .build();

event_bus.publish(&event).await?;
```

## Creating Event Handlers

```rust
// bootstrap/events/handlers/my_handler.rs
use crate::bootstrap::events::consumer::{EventHandler, EventHandlerError};
use crate::bootstrap::events::types::DomainEvent;
use async_trait::async_trait;

pub struct MyHandler;

#[async_trait]
impl EventHandler for MyHandler {
    fn name(&self) -> &'static str { "my_handler" }

    fn topics(&self) -> Vec<&'static str> {
        vec!["user.events", "auth.events"]
    }

    async fn handle(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        match &event.event_type {
            EventType::User(UserEventType::Created) => { /* handle */ }
            _ => {}
        }
        Ok(())
    }
}

// Register in bootstrap/events/handlers/mod.rs
pub fn create_handlers(db: SharedDb) -> Vec<Arc<dyn EventHandler>> {
    vec![
        Arc::new(UserEventHandler::new(db.clone())),
        Arc::new(AuthEventHandler::new(db.clone())),
        Arc::new(MyHandler),
    ]
}
```
