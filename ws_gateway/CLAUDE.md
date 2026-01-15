# ws_gateway - WebSocket Gateway

## Overview

This is the WebSocket Gateway service for Blazing Sun's real-time communication layer. It handles all WebSocket connections and routes messages between clients and backend services via Kafka.

## Architecture

```
Client (Browser)
      |
   WebSocket (wss://localhost/ws)
      |
[ws_gateway Service] <---> Redis (presence, sessions, rooms)
      |
   Kafka Topics
      |
[blazing_sun Services] (Chat, Games modules)
      |
   PostgreSQL / MongoDB
```

## Key Components

### Source Structure
```
src/
├── main.rs              # Entry point, server initialization
├── config.rs            # Configuration from environment
├── error.rs             # Error types
├── protocol.rs          # Message types (client/server)
├── auth.rs              # JWT validation
├── redis_client.rs      # Redis operations
├── server/
│   └── mod.rs           # WebSocket server implementation
├── connection/
│   ├── mod.rs
│   ├── manager.rs       # Connection pool management
│   └── session.rs       # Individual session state
└── kafka/
    ├── mod.rs
    ├── producer.rs      # Publish to Kafka
    └── consumer.rs      # Consume from Kafka
```

## Configuration

Environment variables (set in docker-compose.yml):

| Variable | Default | Description |
|----------|---------|-------------|
| WS_HOST | 0.0.0.0 | Bind address |
| WS_PORT | 9998 | WebSocket port |
| WS_HEALTH_PORT | 9997 | Health check port |
| REDIS_HOST | redis | Redis hostname |
| REDIS_PORT | 6379 | Redis port |
| KAFKA_HOST | kafka | Kafka hostname |
| KAFKA_PORT | 9092 | Kafka port |
| JWT_PUBLIC_KEY_PATH | /keys/jwt_public.pem | Path to JWT public key |

## Kafka Topics

### Producer (commands from clients)
- `chat.commands` - Chat commands
- `games.commands` - Game commands
- `system.events` - System events
- `gateway.presence` - Presence updates

### Consumer (events to clients)
- `chat.events` - Chat events
- `games.events` - Game events
- `system.events` - System events

## Redis Keys

### Socket Management
- `socket:{socketId}` - Session data (user_id, username, connected_at)
- `user:{userId}:sockets` - Set of socket IDs for user
- `presence:online` - Set of online user IDs

### Room Management
- `room:{roomId}:info` - Room metadata
- `room:{roomId}:users` - Users in room
- `room:{roomId}:sockets` - Sockets in room

### Game State
- `game:{gameId}:players` - Ordered list of players
- `game:{gameId}:spectators` - Set of spectators
- `game:{gameId}:turn` - Current turn user ID
- `reconnect:{userId}:{gameId}` - Reconnection data (TTL: 5min)

## Protocol Messages

### Client → Server

```json
// Authenticate
{ "type": "system.authenticate", "token": "jwt..." }

// Heartbeat
{ "type": "system.heartbeat" }

// Chat
{ "type": "chat.command.send_message", "recipient_id": "...", "content": "..." }
{ "type": "chat.command.send_lobby_message", "lobby_id": "...", "content": "..." }

// Games
{ "type": "games.command.create_room", "game_type": "bigger_dice", "room_name": "..." }
{ "type": "games.command.join_room", "room_name": "..." }
{ "type": "games.command.bigger_dice.roll", "room_id": "..." }
```

### Server → Client

```json
// Welcome
{ "type": "system.welcome", "connection_id": "...", "timestamp": "..." }

// Authenticated
{ "type": "system.authenticated", "user_id": "...", "username": "...", "roles": [...] }

// Error
{ "type": "system.error", "code": "...", "message": "..." }

// Chat events
{ "type": "chat.event.message_received", "sender_id": "...", "content": "...", ... }

// Game events
{ "type": "games.event.room_created", "room_id": "...", "room_name": "...", ... }
{ "type": "games.event.bigger_dice.rolled", "player_id": "...", "roll": 5, ... }
```

## Development

### Build
```bash
cargo build
```

### Run locally (outside Docker)
```bash
# Set environment variables
export REDIS_HOST=localhost
export KAFKA_HOST=localhost
export JWT_PUBLIC_KEY_PATH=../blazing_sun/keys/jwt_public.pem

cargo run
```

### Docker
```bash
# Build and start
docker compose up -d ws_gateway

# Logs
docker compose logs -f ws_gateway

# Restart
docker compose restart ws_gateway
```

## Health Check

```bash
curl http://localhost:9997/health
# Returns: {"status":"ok"}
```

## Network

- Docker IP: 172.28.0.23
- WebSocket: ws://ws_gateway:9998 (internal), wss://localhost/ws (external via nginx)
- Health: http://ws_gateway:9997/health

## Dependencies

- `tokio-tungstenite` - WebSocket implementation
- `rdkafka` - Kafka client
- `redis` - Redis client
- `jsonwebtoken` - JWT validation
- `dashmap` - Concurrent HashMap for connections
