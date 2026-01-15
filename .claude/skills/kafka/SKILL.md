---
name: kafka
description: Kafka event streaming skill for game development. Defines topics, event patterns, and Kafka integration.
invocable: false
---

# Kafka Event Streaming Skill

This skill provides knowledge about Kafka event streaming patterns used in the Blazing Sun project for real-time game communication.

## Project Context

**Always read these files before starting work:**
- @blazing_sun/CLAUDE.md - Full application documentation
- @CLAUDE.md - Infrastructure documentation
- @ws_gateway/CLAUDE.md - WebSocket gateway documentation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       KAFKA EVENT FLOW FOR GAMES                                  │
│                                                                                   │
│  ┌──────────┐     ┌───────────┐     ┌─────────┐     ┌───────────┐               │
│  │  Browser │◄───►│ ws_gateway│◄───►│  Kafka  │◄───►│blazing_sun│               │
│  │ (Client) │ WS  │  (Rust)   │     │ Topics  │     │  (Rust)   │               │
│  └──────────┘     └───────────┘     └─────────┘     └───────────┘               │
│                                                                                   │
│  Flow: Client → WebSocket → ws_gateway → Kafka commands → blazing_sun           │
│        blazing_sun → Kafka events → ws_gateway → WebSocket → Client             │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Kafka Topics

### Game Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `games.commands` | ws_gateway → blazing_sun | Commands from players (create_room, join_room, roll, etc.) |
| `games.events` | blazing_sun → ws_gateway | Events back to players (room_created, rolled, etc.) |

### Other Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `chat.commands` | ws_gateway → blazing_sun | Chat messages from users |
| `chat.events` | blazing_sun → ws_gateway | Chat events to users |
| `system.events` | bidirectional | System events (presence, connection status) |
| `gateway.presence` | ws_gateway → blazing_sun | User presence updates |

---

## Event Envelope Format

All Kafka messages use the `EventEnvelope` structure:

```rust
pub struct EventEnvelope {
    pub event_id: String,           // UUID
    pub event_type: String,         // e.g., "games.event.room_created"
    pub timestamp: String,          // RFC3339 format
    pub correlation_id: Option<String>,
    pub producer: String,           // "ws_gateway" or "blazing_sun"
    pub actor: Actor,               // Who triggered the event
    pub audience: Audience,         // Who should receive it
    pub payload: serde_json::Value, // Event-specific data
}
```

### Actor Structure

```rust
pub struct Actor {
    pub user_id: i64,          // User ID (serialized as string for ws_gateway)
    pub username: String,
    pub socket_id: String,     // WebSocket connection ID
    pub roles: Vec<String>,    // User roles
}
```

### Audience Types

```rust
pub enum AudienceType {
    User,       // Single user (by user_id)
    Users,      // Multiple users (by user_ids array)
    Room,       // All users in a game room
    Broadcast,  // All connected users
    Spectators, // Spectators of a game
    Players,    // Players in a game (not spectators)
}
```

---

## Event Type Naming Convention

Event types follow a hierarchical naming pattern:

```
{domain}.{direction}.{event_name}
```

### Examples:

- `games.command.create_room` - Command to create a game room
- `games.event.room_created` - Event indicating room was created
- `games.event.bigger_dice.rolled` - Game-specific event (Bigger Dice roll)
- `chat.command.send_message` - Command to send a chat message
- `chat.event.message_received` - Event indicating message was received

### Game-Specific Events

For game-specific events, use the pattern:
```
games.event.{game_name}.{event_name}
```

Examples:
- `games.event.bigger_dice.rolled`
- `games.event.bigger_dice.round_result`
- `games.event.poker.dealt`
- `games.event.chess.moved`

---

## Adding Kafka Topics for a New Game

When creating a new game, you typically **don't need new topics**. Use the existing `games.commands` and `games.events` topics.

### Steps:

1. **Define game commands** in `blazing_sun/src/app/games/types.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameCommand {
    // ... existing commands

    // New game commands
    #[serde(rename = "new_game.action")]
    NewGameAction {
        user_id: i64,
        room_id: String,
        socket_id: String,
        // game-specific fields
    },
}
```

2. **Define game events** in the same file:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameEvent {
    // ... existing events

    // New game events
    #[serde(rename = "new_game.action_result")]
    NewGameActionResult {
        room_id: String,
        // game-specific fields
    },
}
```

3. **Add event_type_name()** mapping:

```rust
impl GameEvent {
    pub fn event_type_name(&self) -> &'static str {
        match self {
            // ... existing mappings
            GameEvent::NewGameActionResult { .. } => "new_game.action_result",
        }
    }
}
```

4. **Handle commands** in `blazing_sun/src/bootstrap/events/handlers/games.rs`

5. **Handle events** in `ws_gateway/src/server/mod.rs` (add to `envelope_to_server_message`)

---

## Kafka Configuration

### Environment Variables

```env
KAFKA_HOST=kafka
KAFKA_PORT=9092
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
```

### Topic Creation

Topics are auto-created with default settings. For custom configuration:

```bash
# Access Kafka UI
http://localhost:8080/kafka

# Or via CLI
docker compose exec kafka kafka-topics.sh --create \
  --topic games.commands \
  --partitions 3 \
  --replication-factor 1 \
  --bootstrap-server localhost:9092
```

### Consumer Groups

| Consumer Group | Service | Topics |
|----------------|---------|--------|
| `ws_gateway` | WebSocket Gateway | `games.events`, `chat.events`, `system.events` |
| `blazing_sun` | Rust Backend | `games.commands`, `chat.commands`, `system.events`, `gateway.presence` |

---

## Publishing Events (Backend)

```rust
use crate::app::games::types::{Audience, EventEnvelope, GameEvent};
use crate::events::producer::EventProducer;
use crate::events::topics::topic;

async fn publish_game_event(
    producer: &EventProducer,
    event: GameEvent,
    audience: Audience,
) -> Result<(), EventHandlerError> {
    let event_type = format!("games.event.{}", event.event_type_name());

    let envelope = EventEnvelope {
        event_id: Uuid::new_v4().to_string(),
        event_type,
        timestamp: Utc::now().to_rfc3339(),
        correlation_id: None,
        producer: "blazing_sun".to_string(),
        actor: Actor {
            user_id: 0,
            username: "system".to_string(),
            socket_id: String::new(),
            roles: vec![],
        },
        audience,
        payload: serde_json::to_value(&event).unwrap_or(Value::Null),
    };

    let payload = serde_json::to_string(&envelope)?;
    producer.send(topic::GAMES_EVENTS, &envelope.event_id, &payload).await?;

    Ok(())
}
```

---

## Consuming Commands (Backend)

```rust
use crate::events::consumer::{EventHandler, EventHandlerError};
use async_trait::async_trait;

pub struct GameCommandHandler {
    db: Arc<Mutex<Pool<Postgres>>>,
    producer: Option<Arc<EventProducer>>,
}

#[async_trait]
impl EventHandler for GameCommandHandler {
    async fn handle(&self, event: &str) -> Result<(), EventHandlerError> {
        let envelope: EventEnvelope = serde_json::from_str(event)?;

        match envelope.event_type.as_str() {
            "games.command.create_room" => {
                self.handle_create_room(&envelope).await
            }
            "games.command.join_room" => {
                self.handle_join_room(&envelope).await
            }
            // ... other commands
            _ => {
                warn!("Unknown game command: {}", envelope.event_type);
                Ok(())
            }
        }
    }
}
```

---

## Error Handling

### Error Event Pattern

When a command fails, publish an error event to the originating user:

```rust
let error_event = GameEvent::Error {
    code: "room_not_found".to_string(),
    message: "The room does not exist".to_string(),
    socket_id: socket_id.clone(),
};

self.publish_game_event(
    error_event,
    Audience::user(user_id),
).await?;
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `room_not_found` | Room does not exist |
| `room_full` | Room has reached max players |
| `not_your_turn` | Player tried to act out of turn |
| `game_not_started` | Action requires game to be in progress |
| `already_in_room` | Player is already in a room |
| `banned` | Player is banned from the room |
| `wrong_password` | Incorrect room password |

---

## Debugging Kafka

### View Topics
```bash
docker compose exec kafka kafka-topics.sh --list --bootstrap-server localhost:9092
```

### View Consumer Groups
```bash
docker compose exec kafka kafka-consumer-groups.sh --list --bootstrap-server localhost:9092
```

### View Messages (tail)
```bash
docker compose exec kafka kafka-console-consumer.sh \
  --topic games.events \
  --from-beginning \
  --bootstrap-server localhost:9092
```

### Kafka UI
Access: http://localhost:8080/kafka

---

## Best Practices

1. **Always include socket_id** in error events so ws_gateway can route them
2. **Use Audience.room()** for events affecting all room participants
3. **Use Audience.user()** for private events (errors, state sync)
4. **Serialize user_id as string** for ws_gateway compatibility
5. **Include correlation_id** when responding to commands for tracing
6. **Log Kafka failures as warnings**, don't fail the request
