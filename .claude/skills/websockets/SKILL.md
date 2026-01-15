---
name: websockets
description: WebSocket communication skill for real-time game features. Covers ws_gateway, protocol messages, and client integration.
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
| `src/server/mod.rs` | WebSocket server, message routing |
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
    "password": null  // Optional for protected rooms
}

// Join game room
{
    "type": "games.command.join_room",
    "room_name": "My Room",
    "password": null  // Required for protected rooms
}

// Leave room
{ "type": "games.command.leave_room", "room_id": "uuid" }

// Game-specific command
{ "type": "games.command.bigger_dice.roll", "room_id": "uuid" }

// Chat message
{
    "type": "chat.command.send_message",
    "recipient_id": "123",
    "content": "Hello!"
}
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
    "roles": ["user"]
}

// Error
{ "type": "system.error", "code": "auth_failed", "message": "Invalid token" }

// Game room created
{
    "type": "games.event.room_created",
    "room_id": "uuid",
    "room_name": "My Room",
    "game_type": "bigger_dice",
    "host_id": "123",
    "host_name": "player1",
    "is_password_protected": false
}

// Joined room lobby
{
    "type": "games.event.lobby_joined",
    "room_id": "uuid",
    "room_name": "My Room",
    "player": { "user_id": 123, "username": "player1", ... }
}

// Game event
{
    "type": "games.event.bigger_dice.rolled",
    "room_id": "uuid",
    "player_id": "123",
    "roll": 5,
    "new_score": 25
}
```

---

## Client-Side WebSocket Integration

### JavaScript WebSocket Class Pattern

```javascript
class GameWebSocket {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.eventHandlers = new Map();
    }

    connect() {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.authenticate();
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };

        this.ws.onclose = () => {
            this.isConnected = false;
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    authenticate() {
        const token = this.getJwtToken();
        this.send({
            type: 'system.authenticate',
            token: token
        });
    }

    send(message) {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify(message));
        }
    }

    handleMessage(message) {
        const handler = this.eventHandlers.get(message.type);
        if (handler) {
            handler(message);
        }
    }

    on(eventType, handler) {
        this.eventHandlers.set(eventType, handler);
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
        }
    }
}
```

### Usage in Game Component

```javascript
class BiggerDice {
    constructor() {
        this.ws = new GameWebSocket(window.WS_URL);
        this.setupEventHandlers();
        this.ws.connect();
    }

    setupEventHandlers() {
        this.ws.on('system.authenticated', (msg) => {
            this.userId = msg.user_id;
            this.username = msg.username;
            this.updateConnectionStatus('connected');
        });

        this.ws.on('games.event.room_created', (msg) => {
            this.roomId = msg.room_id;
            this.showLobby(msg);
        });

        this.ws.on('games.event.lobby_joined', (msg) => {
            this.roomId = msg.room_id;
            this.showLobby(msg);
        });

        this.ws.on('games.event.bigger_dice.rolled', (msg) => {
            this.showRollResult(msg);
        });

        this.ws.on('system.error', (msg) => {
            this.showError(msg.message);
        });
    }

    createRoom(roomName, password = null) {
        this.ws.send({
            type: 'games.command.create_room',
            game_type: 'bigger_dice',
            room_name: roomName,
            password: password
        });
    }

    joinRoom(roomName, password = null) {
        this.ws.send({
            type: 'games.command.join_room',
            room_name: roomName,
            password: password
        });
    }

    roll() {
        this.ws.send({
            type: 'games.command.bigger_dice.roll',
            room_id: this.roomId
        });
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

    // New game commands
    #[serde(rename = "games.command.chess.move")]
    ChessMove {
        room_id: String,
        from: String,
        to: String,
    },
}
```

### Step 2: Define Server Messages (ws_gateway)

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    // ... existing messages

    // New game events
    #[serde(rename = "games.event.chess.moved")]
    ChessMoved {
        room_id: String,
        player_id: String,
        from: String,
        to: String,
        piece: String,
    },
}
```

### Step 3: Route Client Message to Kafka

In `ws_gateway/src/server/mod.rs`, handle the new client message:

```rust
async fn handle_client_message(
    &self,
    msg: ClientMessage,
    connection_id: &str,
    user: &AuthenticatedUser,
) -> Result<(), Error> {
    match msg {
        // ... existing handlers

        ClientMessage::ChessMove { room_id, from, to } => {
            self.publish_game_command(
                "games.command.chess.move",
                json!({
                    "type": "chess.move",
                    "user_id": user.user_id,
                    "username": &user.username,
                    "room_id": room_id,
                    "from": from,
                    "to": to,
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

In `ws_gateway/src/server/mod.rs`, add event handler:

```rust
fn envelope_to_server_message(envelope: &EventEnvelope) -> Result<Option<ServerMessage>, Error> {
    match envelope.event_type.as_str() {
        // ... existing handlers

        "games.event.chess.moved" => {
            let payload = &envelope.payload;
            Ok(Some(ServerMessage::ChessMoved {
                room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                player_id: payload.get("player_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                from: payload.get("from").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                to: payload.get("to").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                piece: payload.get("piece").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            }))
        }
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
| `room:{roomId}:info` | Hash | Room metadata |
| `room:{roomId}:users` | Set | Users in room |
| `room:{roomId}:sockets` | Set | Sockets in room |

### Game State

| Key | Type | Description |
|-----|------|-------------|
| `game:{gameId}:players` | List | Ordered list of players |
| `game:{gameId}:spectators` | Set | Spectators |
| `game:{gameId}:turn` | String | Current turn user ID |
| `reconnect:{userId}:{gameId}` | Hash | Reconnection data (TTL: 5min) |

---

## Connection Lifecycle

```
1. Client connects to wss://localhost/ws
2. Server sends: { "type": "system.welcome", "connection_id": "..." }
3. Client sends: { "type": "system.authenticate", "token": "..." }
4. Server validates JWT
5. Server sends: { "type": "system.authenticated", "user_id": "...", ... }
6. Client joins room / creates room
7. Client/Server exchange game messages
8. Client disconnects
9. Server cleans up Redis entries
```

---

## Heartbeat / Keep-Alive

Clients should send heartbeats to prevent connection timeout:

```javascript
// Send heartbeat every 30 seconds
setInterval(() => {
    this.ws.send(JSON.stringify({ type: 'system.heartbeat' }));
}, 30000);
```

---

## Error Handling

### Connection Errors

```javascript
ws.onerror = (error) => {
    // Show connection error UI
    this.showError('Connection lost. Reconnecting...');
};

ws.onclose = (event) => {
    if (!event.wasClean) {
        // Unexpected disconnect - attempt reconnect
        this.attemptReconnect();
    }
};
```

### Game Errors

Listen for error events from the server:

```javascript
this.ws.on('system.error', (msg) => {
    switch (msg.code) {
        case 'room_not_found':
            this.showError('Room does not exist');
            break;
        case 'not_your_turn':
            this.showError('Wait for your turn');
            break;
        case 'wrong_password':
            this.showPasswordError('Incorrect password');
            break;
        default:
            this.showError(msg.message);
    }
});
```

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
3. **Store connection state** to detect disconnects
4. **Use heartbeats** to keep connections alive
5. **Handle all error codes** from the server
6. **Clean up** event handlers when component unmounts
7. **Serialize user_id as string** in messages to ws_gateway
