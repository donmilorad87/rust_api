# WebSocket Real-Time System

This document provides comprehensive documentation for the Blazing Sun real-time WebSocket system.

---

## Overview

The WebSocket system provides real-time communication capabilities for the Blazing Sun platform, supporting:

- **Games**: Real-time multiplayer games with turn-based mechanics
- **Chat**: Room-based messaging (planned extension)
- **Presence**: Online status tracking via Redis

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                            │
│   GamesPage.js - WebSocket connection, UI management                │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ WebSocket (wss://)
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WS_GATEWAY (Rust Microservice)                   │
│   - WebSocket handling (tokio-tungstenite)                          │
│   - Authentication (JWT)                                            │
│   - Message routing                                                 │
│   - Connection management                                           │
└────────────┬─────────────────────────────────┬──────────────────────┘
             │ Kafka (games.commands)          │ Kafka (games.events)
             ▼                                 │
┌─────────────────────────────────┐           │
│      BLAZING_SUN (Main App)     │◄──────────┘
│   - GameCommandHandler          │
│   - Room state (Redis)          │
│   - Game history (MongoDB)      │
└─────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| WebSocket Server | tokio-tungstenite | Real-time bidirectional communication |
| Message Broker | Apache Kafka | Event streaming between services |
| State Store | Redis | Ephemeral game state, sessions, presence |
| History Store | MongoDB | Game history, persistent data |
| Frontend | Vanilla ES6 | GamesPage.js controller |

---

## WebSocket Endpoints

### Games WebSocket
- **URL**: `wss://localhost/ws/games`
- **Auth**: JWT token via cookie or query param

---

## Message Protocol

All messages are JSON objects with a `type` field.

### Client → Server (Commands)

#### Authentication
```json
{
  "type": "auth",
  "user_id": 123,
  "username": "player1",
  "avatar_id": 456
}
```

#### Room Management
```json
// Create room
{
  "type": "create_room",
  "user_id": 123,
  "username": "player1",
  "avatar_id": 456,
  "game_type": "bigger_dice",
  "room_name": "My Game Room"
}

// Join room
{
  "type": "join_room",
  "user_id": 123,
  "username": "player1",
  "avatar_id": 456,
  "room_name": "My Game Room"
}

// Leave room
{
  "type": "leave_room",
  "user_id": 123,
  "room_id": "room_abc123"
}

// Rejoin room (after reconnection)
{
  "type": "rejoin_room",
  "user_id": 123,
  "room_id": "room_abc123"
}

// Ready up
{
  "type": "ready",
  "user_id": 123,
  "room_id": "room_abc123"
}

// List available rooms
{
  "type": "list_rooms"
}
```

#### Spectator Commands
```json
// Spectate a room
{
  "type": "spectate",
  "user_id": 123,
  "room_id": "room_abc123"
}

// Leave spectating
{
  "type": "leave_spectate",
  "user_id": 123,
  "room_id": "room_abc123"
}
```

#### Game Actions (Bigger Dice)
```json
// Roll dice
{
  "type": "bigger_dice.roll",
  "user_id": 123,
  "room_id": "room_abc123"
}
```

#### Heartbeat
```json
// Ping (client sends)
{ "type": "ping" }

// Pong (server responds)
{ "type": "pong" }
```

### Server → Client (Events)

#### Room Events
```json
// Room created
{
  "type": "room_created",
  "room_id": "room_abc123",
  "room_name": "My Game Room",
  "game_type": "bigger_dice",
  "host_id": 123,
  "host_username": "player1"
}

// Room joined
{
  "type": "room_joined",
  "room_id": "room_abc123",
  "room_name": "My Game Room",
  "player": {
    "user_id": 456,
    "username": "player2",
    "avatar_id": 789,
    "score": 0,
    "is_ready": false
  }
}

// Player left
{
  "type": "player_left",
  "room_id": "room_abc123",
  "user_id": 456,
  "username": "player2"
}

// Player rejoined
{
  "type": "player_rejoined",
  "room_id": "room_abc123",
  "user_id": 456,
  "username": "player2"
}

// Player ready
{
  "type": "player_ready",
  "room_id": "room_abc123",
  "user_id": 123,
  "username": "player1"
}

// Room state (sent on join/rejoin)
{
  "type": "room_state",
  "room": { /* full GameRoom object */ }
}

// Room list
{
  "type": "room_list",
  "rooms": [ /* array of room summaries */ ]
}
```

#### Spectator Events
```json
// Spectator joined
{
  "type": "spectator_joined",
  "room_id": "room_abc123",
  "user_id": 789,
  "username": "viewer1"
}

// Spectator left
{
  "type": "spectator_left",
  "room_id": "room_abc123",
  "user_id": 789,
  "username": "viewer1"
}
```

#### Game Events
```json
// Game started
{
  "type": "game_started",
  "room_id": "room_abc123",
  "players": [ /* array of GamePlayer */ ],
  "first_turn": 123
}

// Turn changed
{
  "type": "turn_changed",
  "room_id": "room_abc123",
  "current_turn": 456,
  "turn_number": 5
}

// Game ended
{
  "type": "game_ended",
  "room_id": "room_abc123",
  "winner_id": 123,
  "winner_username": "player1",
  "final_scores": [
    [123, "player1", 10],
    [456, "player2", 7]
  ]
}
```

#### Bigger Dice Events
```json
// Dice rolled
{
  "type": "bigger_dice.rolled",
  "room_id": "room_abc123",
  "player_id": 123,
  "player_username": "player1",
  "roll": 5,
  "new_score": 8
}

// Round result
{
  "type": "bigger_dice.round_result",
  "room_id": "room_abc123",
  "player1_id": 123,
  "player1_roll": 5,
  "player2_id": 456,
  "player2_roll": 3,
  "winner_id": 123,
  "is_tie": false
}
```

#### Error Event
```json
{
  "type": "error",
  "code": "NOT_YOUR_TURN",
  "message": "It's not your turn to roll",
  "socket_id": "socket_xyz"
}
```

---

## Data Types

### GameRoom
```rust
pub struct GameRoom {
    pub room_id: String,
    pub room_name: String,
    pub game_type: GameType,
    pub status: RoomStatus,
    pub host_id: i64,
    pub players: Vec<GamePlayer>,
    pub spectators: Vec<i64>,
    pub current_turn: Option<i64>,
    pub turn_number: i32,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub winner_id: Option<i64>,
}
```

### GamePlayer
```rust
pub struct GamePlayer {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub score: i32,
    pub is_ready: bool,
    pub joined_at: DateTime<Utc>,
}
```

### RoomStatus
```rust
pub enum RoomStatus {
    Waiting,     // Waiting for players
    InProgress,  // Game is active
    Finished,    // Game has ended
    Abandoned,   // All players left
}
```

### GameType
```rust
pub enum GameType {
    BiggerDice,  // 2-player dice game, first to 10 wins
}
```

---

## Kafka Topics

### games.commands
Commands from ws_gateway to blazing_sun:
- Room management (create, join, leave, rejoin)
- Game actions (ready, roll dice)
- Spectator actions (spectate, leave_spectate)

### games.events
Events from blazing_sun to ws_gateway:
- Room events (created, joined, left, state)
- Game events (started, turn_changed, ended)
- Spectator events (joined, left)

### Event Envelope
```rust
pub struct EventEnvelope {
    pub event_id: String,
    pub event_type: String,
    pub timestamp: String,
    pub actor: Actor,
    pub audience: Audience,
    pub payload: serde_json::Value,
}
```

---

## Redis Keys

| Key Pattern | Purpose | TTL |
|------------|---------|-----|
| `game:room:{room_id}` | Room state JSON | None (until abandoned) |
| `game:rooms:list` | Set of active room IDs | None |
| `game:user:{user_id}:room` | User's current room | None |
| `ws:presence:{user_id}` | Online status | 60s |

---

## Resilience Features

### Heartbeat
- Client sends `ping` every 30 seconds
- Server responds with `pong`
- Connection closed if no pong within 10 seconds

### Session Recovery
- Room ID saved to sessionStorage on join
- On reconnection, client sends `rejoin_room`
- Server validates user was in room and sends `room_state`

### Reconnection
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max 5 reconnection attempts
- Full state sync on successful reconnect

---

## Files

### Backend (blazing_sun)
- `src/app/games/types.rs` - Data types and enums
- `src/bootstrap/events/handlers/games.rs` - Command handler
- `src/bootstrap/events/topics.rs` - Kafka topic definitions

### Frontend
- `src/frontend/pages/GAMES/src/GamesPage.js` - Main controller
- `src/frontend/pages/GAMES/src/styles/_games.scss` - Styles
- `src/resources/views/web/games.html` - Template

### Route
- `src/routes/web.rs` - Route: `/games`
- `src/app/http/web/controllers/pages.rs` - Controller

---

## Security

- WebSocket connections require valid JWT
- User ID validated against JWT claims
- Room operations validate user membership
- Spectators cannot perform game actions
- Turn validation prevents out-of-order actions

---

## See Also

- [Games Page Documentation](../GamesPage/README.md)
- [Kafka Events](../Events/EVENTS.md)
- [Redis Usage](../Bootstrap/BOOTSTRAP.md)
