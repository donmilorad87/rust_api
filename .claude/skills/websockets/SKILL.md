---
name: websockets
description: WebSocket communication skill for real-time game features. Covers ws_gateway, protocol messages, room/spectator handling, and client integration.
invocable: false
---

# WebSocket Communication Skill

This skill provides knowledge about WebSocket communication patterns used in the Blazing Sun project for real-time game features.

## Project Context

**Always read these files before starting work:**
- @ws_gateway/CLAUDE.md - WebSocket gateway documentation
- @blazing_sun/CLAUDE.md - Full application documentation
- @CLAUDE.md - Infrastructure documentation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       WEBSOCKET COMMUNICATION FLOW                                │
│                                                                                   │
│  ┌──────────────┐        ┌─────────────────┐        ┌────────────────┐          │
│  │   Browser    │  WSS   │   ws_gateway    │  Kafka │  blazing_sun   │          │
│  │   (Client)   │◄─────►│   :9998         │◄──────►│   (Backend)    │          │
│  │              │        │                 │        │                │          │
│  │ BiggerDice.js│        │ tokio-tungstenite        │ GameCommandHandler        │
│  └──────────────┘        └─────────────────┘        └────────────────┘          │
│                                   │                                              │
│                               ┌───▼───┐                                          │
│                               │ Redis │  (presence, rooms, sessions)             │
│                               └───────┘                                          │
│                                                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## WebSocket Gateway (ws_gateway)

**Location**: `/home/milner/Desktop/rust/ws_gateway/`

### Key Files

| File | Purpose |
|------|---------|
| `src/main.rs` | Entry point, server initialization |
| `src/server/mod.rs` | WebSocket server, message routing, room management |
| `src/protocol.rs` | Message types (ClientMessage, ServerMessage) |
| `src/auth.rs` | JWT validation |
| `src/redis_client.rs` | Redis operations (presence, rooms) |
| `src/kafka/producer.rs` | Publish to Kafka |
| `src/kafka/consumer.rs` | Consume from Kafka |

### Configuration

```env
WS_HOST=0.0.0.0
WS_PORT=9998
WS_HEALTH_PORT=9997
REDIS_HOST=redis
REDIS_PORT=6379
KAFKA_HOST=kafka
KAFKA_PORT=9092
JWT_PUBLIC_KEY_PATH=/keys/jwt_public.pem
```

---

## Room and Spectator Tracking

### Redis Room Keys

ws_gateway tracks users in rooms using Redis:

```
room:{room_id}          # All participants (players + spectators)
spectators:{room_id}    # Spectators only (separate tracking)
```

### Audience Types

Events are routed based on `AudienceType`:

```rust
pub enum AudienceType {
    User,        // Single user (by user_id) - errors, private state
    Users,       // Multiple users (by user_ids array)
    Room,        // All in room (players + spectators)
    Players,     // Players only (player chat)
    Spectators,  // Spectators only (spectator chat)
    Broadcast,   // All connected users (room list updates)
}

pub struct Audience {
    pub audience_type: AudienceType,
    pub user_ids: Vec<String>,        // For User/Users
    pub room_id: Option<String>,      // For Room/Spectators/Players
    pub game_id: Option<String>,      // Alternative to room_id
}
```

### Routing Logic in ws_gateway

```rust
// In server/mod.rs - route_to_audience()
match audience.audience_type {
    AudienceType::User => {
        // Send to specific user by user_id
        self.send_to_user(&audience.user_ids[0], &message).await;
    }
    AudienceType::Room => {
        // Send to all in room:{room_id}
        self.send_to_room(&audience.room_id.unwrap(), &message).await;
    }
    AudienceType::Players => {
        // Send to players only (exclude spectators)
        self.send_to_players(&audience.room_id.unwrap(), &message).await;
    }
    AudienceType::Spectators => {
        // Send to spectators:{room_id} only
        self.send_to_spectators(&audience.room_id.unwrap(), &message).await;
    }
}
```

---

## Protocol Messages

### Client → Server Messages

```javascript
// Authentication
{ "type": "system.authenticate", "token": "jwt_token_here" }

// Heartbeat (keep-alive)
{ "type": "system.heartbeat" }

// Create game room
{
    "type": "games.command.create_room",
    "game_type": "bigger_dice",
    "room_name": "My Room",
    "password": null,  // Optional for protected rooms
    "max_players": 2
}

// Join game room (lobby)
{
    "type": "games.command.join_room",
    "room_name": "My Room",
    "password": null  // Required for protected rooms
}

// Join as spectator
{ "type": "games.command.join_as_spectator", "room_id": "uuid" }

// Rejoin room (reconnection)
{ "type": "games.command.rejoin_room", "room_id": "uuid" }

// Leave room
{ "type": "games.command.leave_room", "room_id": "uuid" }

// Admin commands (host only)
{ "type": "games.command.select_player", "room_id": "uuid", "target_user_id": 123 }
{ "type": "games.command.kick_player", "room_id": "uuid", "target_user_id": 123 }
{ "type": "games.command.ban_player", "room_id": "uuid", "target_user_id": 123 }

// Player ready
{ "type": "games.command.ready", "room_id": "uuid" }

// Game-specific commands
{ "type": "games.command.bigger_dice.roll", "room_id": "uuid" }
{ "type": "games.command.bigger_dice.enable_auto_play", "room_id": "uuid" }

// Chat commands
{
    "type": "games.command.send_chat",
    "room_id": "uuid",
    "channel": "lobby",  // "lobby" | "players" | "spectators"
    "content": "Hello!",
    "avatar_id": 1
}

// Get chat history (on rejoin)
{
    "type": "games.command.get_chat_history",
    "room_id": "uuid",
    "channel": "lobby",  // "lobby" | "players" | "spectators"
    "limit": 50
}

// Mute user (room admin)
{ "type": "games.command.mute_user", "room_id": "uuid", "target_user_id": 123 }
```

### Server → Client Messages

```javascript
// Welcome (on connect)
{ "type": "system.welcome", "connection_id": "uuid", "timestamp": "..." }

// Authenticated
{
    "type": "system.authenticated",
    "user_id": "123",
    "username": "player1",
    "roles": ["user"],
    "avatar_id": 1
}

// Error
{ "type": "system.error", "code": "auth_failed", "message": "Invalid token" }

// Room events
{
    "type": "games.event.room_created",
    "room_id": "uuid",
    "room_name": "My Room",
    "game_type": "bigger_dice",
    "host_id": "123",
    "host_name": "player1",
    "is_password_protected": false,
    "max_players": 2
}

{
    "type": "games.event.lobby_joined",
    "room_id": "uuid",
    "room_name": "My Room",
    "player": { "user_id": 123, "username": "player1", "avatar_id": 1 }
}

// Full room state (on rejoin)
{
    "type": "games.event.room_state",
    "room": {
        "room_id": "uuid",
        "room_name": "My Room",
        "status": "playing",
        "players": [...],
        "lobby": [...],
        "spectators": [...],
        "current_turn": 123,
        "turn_number": 5,
        ...
    }
}

// Player events
{ "type": "games.event.player_selected", "room_id": "uuid", "player": {...} }
{ "type": "games.event.player_kicked", "room_id": "uuid", "user_id": 123 }
{ "type": "games.event.player_banned", "room_id": "uuid", "user_id": 123 }
{ "type": "games.event.player_left", "room_id": "uuid", "user_id": 123 }
{ "type": "games.event.player_disconnected", "room_id": "uuid", "user_id": 123, "timeout_at": "..." }
{ "type": "games.event.player_rejoined", "room_id": "uuid", "user_id": 123 }
{ "type": "games.event.player_auto_enabled", "room_id": "uuid", "user_id": 123 }

// Spectator events
{ "type": "games.event.spectator_joined", "room_id": "uuid", "user_id": 123, "username": "viewer" }
{
    "type": "games.event.spectator_data_joined",
    "room_id": "uuid",
    "spectator": { "user_id": 123, "username": "viewer", "avatar_id": 1 }
}

// Game flow events
{
    "type": "games.event.game_started",
    "room_id": "uuid",
    "players": [...],
    "first_turn": 123
}
{ "type": "games.event.turn_changed", "room_id": "uuid", "current_turn": 123, "turn_number": 2 }
{
    "type": "games.event.game_ended",
    "room_id": "uuid",
    "winner_id": 123,
    "final_scores": { "123": 10, "456": 8 }
}

// Bigger Dice specific events
{
    "type": "games.event.bigger_dice.rolled",
    "room_id": "uuid",
    "player_id": 123,
    "roll": 5,
    "new_score": 25
}
{
    "type": "games.event.bigger_dice.round_result",
    "room_id": "uuid",
    "rolls": { "123": 5, "456": 3 },
    "winner_id": 123,
    "is_tie": false,
    "scores": { "123": 1, "456": 0 }
}
{
    "type": "games.event.bigger_dice.tiebreaker_started",
    "room_id": "uuid",
    "tied_players": [123, 456],
    "tied_roll": 4
}

// Chat events
{
    "type": "games.event.chat_message",
    "room_id": "uuid",
    "channel": "lobby",
    "user_id": 123,
    "username": "player1",
    "avatar_id": 1,
    "content": "Hello!",
    "timestamp": "2024-01-20T10:30:00Z"
}
{
    "type": "games.event.chat_history",
    "room_id": "uuid",
    "channel": "lobby",
    "messages": [...]
}
{ "type": "games.event.user_muted", "room_id": "uuid", "user_id": 123 }
```

---

## Chat System (3 Channels)

### Channel Types

| Channel | When Available | Who Can Send | Who Can Read |
|---------|---------------|--------------|--------------|
| `lobby` | Waiting phase | All in lobby | All in lobby |
| `players` | Playing phase | Players only | Players + Spectators |
| `spectators` | Playing phase | Spectators only | Spectators only |

### Frontend Chat Tab Order

Recommended tab order: **Lobby → Spectators → Players**
(Spectators next to Lobby for better UX)

### Chat History on Rejoin

When a player/spectator rejoins, request history for relevant channels:

```javascript
handleRoomState(message) {
    // Always request lobby history
    if (!this.chatHistoryRequested.lobby) {
        this.requestChatHistory('lobby');
    }

    // During active game, request game channels
    const isGameActive = ['playing', 'in_progress'].includes(this.gameStatus);
    if (isGameActive) {
        // Players chat - visible to players and spectators
        if (!this.chatHistoryRequested.players) {
            this.requestChatHistory('players');
        }

        // Spectators chat - only for spectators
        if (this.isSpectator && !this.chatHistoryRequested.spectators) {
            this.requestChatHistory('spectators');
        }
    }
}
```

---

## Connection State Management

### Connection States

```javascript
const ConnectionState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting'
};
```

### Reconnection Pattern

```javascript
class GameWebSocket {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.connectionState = ConnectionState.DISCONNECTED;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
    }

    connect() {
        this.connectionState = ConnectionState.CONNECTING;
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
            this.connectionState = ConnectionState.CONNECTED;
            this.reconnectAttempts = 0;
            this.authenticate();
        };

        this.ws.onclose = (event) => {
            if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.connectionState = ConnectionState.RECONNECTING;
                this.scheduleReconnect();
            } else {
                this.connectionState = ConnectionState.DISCONNECTED;
            }
        };
    }

    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        setTimeout(() => this.connect(), delay);
    }

    // On reconnection, rejoin the room
    onAuthenticated() {
        if (this.roomId) {
            this.send({
                type: 'games.command.rejoin_room',
                room_id: this.roomId
            });
        }
    }
}
```

---

## Adding WebSocket Support for a New Game

### Step 1: Define Client Messages (ws_gateway)

In `ws_gateway/src/protocol.rs`, add new client message types:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    // ... existing messages

    #[serde(rename = "games.command.new_game.action")]
    NewGameAction {
        room_id: String,
        // game-specific fields
    },
}
```

### Step 2: Define Server Messages (ws_gateway)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    // ... existing messages

    #[serde(rename = "games.event.new_game.action_result")]
    NewGameActionResult {
        room_id: String,
        player_id: String,
        // game-specific fields
    },
}
```

### Step 3: Route Client Message to Kafka

In `ws_gateway/src/server/mod.rs`:

```rust
async fn handle_client_message(&self, msg: ClientMessage, ...) {
    match msg {
        ClientMessage::NewGameAction { room_id } => {
            self.publish_game_command(
                "games.command.new_game.action",
                json!({
                    "type": "new_game.action",
                    "user_id": user.user_id,
                    "username": &user.username,
                    "room_id": room_id,
                    "socket_id": connection_id,
                }),
                connection_id,
                user,
            ).await
        }
    }
}
```

### Step 4: Handle Kafka Event to Server Message

In `envelope_to_server_message()`:

```rust
fn envelope_to_server_message(envelope: &EventEnvelope) -> Result<Option<ServerMessage>, Error> {
    match envelope.event_type.as_str() {
        "games.event.new_game.action_result" => {
            let payload = &envelope.payload;
            Ok(Some(ServerMessage::NewGameActionResult {
                room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                player_id: payload.get("player_id").and_then(|v| v.as_i64()).unwrap_or(0).to_string(),
                // extract other fields...
            }))
        }
        _ => Ok(None)
    }
}
```

---

## Redis Keys

### Socket Management

| Key | Type | Description |
|-----|------|-------------|
| `socket:{socketId}` | Hash | Session data (user_id, username, connected_at) |
| `user:{userId}:sockets` | Set | Socket IDs for user (supports multiple connections) |
| `presence:online` | Set | Online user IDs |

### Room Management

| Key | Type | Description |
|-----|------|-------------|
| `room:{roomId}` | Set | All users in room (players + spectators) |
| `spectators:{roomId}` | Set | Spectators only |
| `room:{roomId}:info` | Hash | Room metadata |

### Reconnection

| Key | Type | Description |
|-----|------|-------------|
| `reconnect:{userId}:{roomId}` | Hash | Reconnection data (TTL: 5min) |

---

## Connection Lifecycle

```
1. Client connects to wss://localhost/ws
2. Server sends: { "type": "system.welcome", "connection_id": "..." }
3. Client sends: { "type": "system.authenticate", "token": "..." }
4. Server validates JWT
5. Server sends: { "type": "system.authenticated", "user_id": "...", ... }
6. Client joins room / creates room / rejoins room
7. Client/Server exchange game messages
8. On disconnect:
   - If in game: Server marks player as disconnected, starts timeout
   - Player can rejoin within timeout window
9. Server cleans up Redis entries after timeout or explicit leave
```

---

## Heartbeat / Keep-Alive

Clients should send heartbeats to prevent connection timeout:

```javascript
// Send heartbeat every 30 seconds
setInterval(() => {
    if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'system.heartbeat' }));
    }
}, 30000);
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `auth_failed` | Invalid or expired JWT token |
| `room_not_found` | Room does not exist |
| `room_full` | Room has reached max players |
| `not_your_turn` | Player tried to act out of turn |
| `game_not_started` | Action requires game to be in progress |
| `already_in_room` | Player is already in a room |
| `banned` | Player is banned from the room |
| `wrong_password` | Incorrect room password |
| `insufficient_balance` | Not enough balance for game fee |
| `not_host` | Only room host can perform this action |
| `already_selected` | Player already selected for game |
| `muted` | User is muted in this room |

---

## Testing WebSocket Connections

### Using wscat (CLI)

```bash
# Install
npm install -g wscat

# Connect (skip SSL verification for dev)
wscat -c wss://localhost/ws --no-check

# Send authentication
{"type":"system.authenticate","token":"your_jwt_token"}

# Create room
{"type":"games.command.create_room","game_type":"bigger_dice","room_name":"Test Room"}

# Join as spectator
{"type":"games.command.join_as_spectator","room_id":"uuid"}
```

### Using Browser DevTools

1. Open Network tab
2. Filter by WS
3. Click on the WebSocket connection
4. View Messages tab for sent/received data

---

## Best Practices

1. **Always authenticate** before sending game commands
2. **Handle reconnection** gracefully with exponential backoff
3. **Store room_id** for rejoin on reconnection
4. **Request chat history** on rejoin for each relevant channel
5. **Use heartbeats** to keep connections alive
6. **Handle all error codes** from the server
7. **Clean up** event handlers when component unmounts
8. **Serialize user_id as string** in messages to ws_gateway
9. **Track connection state** to show UI feedback
10. **Handle spectator vs player** role differences in UI
