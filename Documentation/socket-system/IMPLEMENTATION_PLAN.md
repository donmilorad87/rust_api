# Blazing Sun Real-Time Socket System - Implementation Plan

**Version:** 1.0
**Created:** 2026-01-08
**Status:** Approved for Implementation

---

## Executive Summary

Building a real-time communication layer for Blazing Sun using:
- **WebSocket Gateway** (`ws_gateway`) - Separate Rust microservice
- **Kafka** - Event-driven pub/sub (per-domain topics)
- **Redis** - Ephemeral state (sessions, presence, rooms)
- **MongoDB** - Game state + private chat persistence
- **PostgreSQL** - Source of truth + public lobby chat

### MVP Deliverables
1. WebSocket Gateway with auth handshake
2. Chat system (private + public lobby)
3. Games page with catalog
4. "Bigger Dice" game with animated UI
5. Spectator system with separate chat
6. Reconnection support

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  /games (catalog)     /games/bigger_dice (Web Component)                │
│         │                        │                                       │
│         └────────────┬───────────┘                                       │
│                      │                                                   │
│              SOCKETS Module (JS)                                         │
│                      │                                                   │
└──────────────────────┼───────────────────────────────────────────────────┘
                       │ WebSocket
┌──────────────────────┼───────────────────────────────────────────────────┐
│                      ▼                                                   │
│          ┌───────────────────────┐                                       │
│          │    WS_GATEWAY         │◄──────► Redis                         │
│          │  (Rust microservice)  │         (sessions, presence, rooms)   │
│          └───────────┬───────────┘                                       │
│                      │ Kafka                                             │
│          ┌───────────┴───────────┐                                       │
│          ▼                       ▼                                       │
│   ┌─────────────┐         ┌─────────────┐                               │
│   │ Chat Module │         │ Games Module│                               │
│   └──────┬──────┘         └──────┬──────┘                               │
│          │                       │                                       │
│          ▼                       ▼                                       │
│   ┌─────────────┐         ┌─────────────┐                               │
│   │  MongoDB    │         │  MongoDB    │                               │
│   │ (private)   │         │ (game state)│                               │
│   └─────────────┘         └─────────────┘                               │
│          │                       │                                       │
│          └───────────┬───────────┘                                       │
│                      ▼                                                   │
│              ┌─────────────┐                                            │
│              │ PostgreSQL  │ (users, friends, public chat)              │
│              └─────────────┘                                            │
│                                                                          │
│                      BLAZING_SUN                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Infrastructure Setup

**Goal:** Set up ws_gateway service skeleton and Kafka topics

### 1.1 Create ws_gateway Rust Workspace

**Files to create:**
```
/ws_gateway/
├── Cargo.toml
├── src/
│   ├── main.rs
│   ├── config.rs
│   ├── lib.rs
│   └── server/
│       └── mod.rs
├── Dockerfile
└── .env.example
```

**Dependencies:**
- `tokio` - async runtime
- `tokio-tungstenite` - WebSocket server
- `rdkafka` - Kafka client
- `redis` - Redis client
- `jsonwebtoken` - JWT validation
- `serde` / `serde_json` - serialization
- `tracing` - logging
- `uuid` - event IDs

### 1.2 Docker Compose Integration

**Modify:** `docker-compose.yml`
- Add `ws_gateway` service
- Assign IP: `172.28.0.23`
- Expose port: `9998`
- Depends on: kafka, redis, postgres

### 1.3 Kafka Topics Setup

**Topics to create:**
```
# System events
system.events          (partitions: 3, retention: 7d)

# Chat domain
chat.commands          (partitions: 3, retention: 7d)
chat.events            (partitions: 3, retention: 7d)

# Games domain
games.commands         (partitions: 6, retention: 7d)
games.events           (partitions: 6, retention: 7d)

# Gateway internal
gateway.presence       (partitions: 3, retention: 1d)
```

**Partition key strategy:**
- Chat: `userId` for private, `lobbyId` for public
- Games: `gameId` for game events, `lobbyId` for lobby

### 1.4 Redis Data Structure Design

**Keys:**
```redis
# Socket mapping
socket:{socketId}                  → JSON{userId, connectedAt, lastSeen}
user:{userId}:sockets              → SET[socketId, ...]

# Presence
user:{userId}:presence             → JSON{status, lastSeen, currentRoom}
presence:online                    → SET[userId, ...]

# Rooms (chat + games)
room:{roomId}:info                 → JSON{type, name, createdBy, createdAt}
room:{roomId}:users                → SET[userId, ...]
room:{roomId}:sockets              → SET[socketId, ...]

# Game-specific
game:{gameId}:state                → JSON{...gameState}
game:{gameId}:players              → LIST[userId1, userId2]
game:{gameId}:spectators           → SET[userId, ...]
game:{gameId}:turn                 → userId

# Reconnection
reconnect:{userId}:{gameId}        → JSON{lastState, timestamp} TTL:300
```

### 1.5 Deliverables
- [ ] ws_gateway compiles and starts
- [ ] Service visible in docker-compose
- [ ] Kafka topics created
- [ ] Redis connection verified
- [ ] Health check endpoint `/health`

---

## Phase 2: WebSocket Gateway Core

**Goal:** Connection lifecycle, auth, heartbeat, Kafka integration

### 2.1 Connection Manager

**Files:**
```
/ws_gateway/src/
├── connection/
│   ├── mod.rs
│   ├── manager.rs        # Connection pool management
│   ├── session.rs        # Individual session state
│   └── codec.rs          # Message encoding/decoding
```

**Connection lifecycle:**
1. Client connects → assign `connectionId`
2. Send `system.welcome` with `connectionId`
3. Client sends `system.authenticate` with JWT
4. Validate JWT → extract userId, roles
5. Bind session to user
6. Update Redis mappings
7. Publish `system.event.user_connected` to Kafka

### 2.2 Authentication Handshake

**Protocol messages:**

```json
// Server → Client (on connect)
{
  "type": "system.welcome",
  "connectionId": "uuid",
  "timestamp": "ISO-8601"
}

// Client → Server (authenticate)
{
  "type": "system.authenticate",
  "token": "jwt-token-from-cookie"
}

// Server → Client (success)
{
  "type": "system.authenticated",
  "userId": "123",
  "username": "johndoe",
  "roles": ["user"],
  "timestamp": "ISO-8601"
}

// Server → Client (failure)
{
  "type": "system.error",
  "code": "AUTH_FAILED",
  "message": "Invalid or expired token"
}
```

### 2.3 JWT Validation

**Shared JWT keys with blazing_sun:**
- Read from same `/keys/jwt_public.pem`
- Validate: signature, expiry, issuer
- Extract: userId, roles, permissions

### 2.4 Heartbeat & Presence

**Heartbeat flow:**
```
Client sends: {"type": "system.heartbeat"} every 15 seconds
Server responds: {"type": "system.heartbeat_ack", "timestamp": "..."}
Server updates: Redis user:{userId}:presence.lastSeen
```

**Timeout handling:**
- No heartbeat for 45 seconds → mark user offline
- Remove from `presence:online` set
- Keep room memberships (for reconnection)
- Publish `system.event.user_disconnected`

### 2.5 Kafka Integration

**Files:**
```
/ws_gateway/src/
├── kafka/
│   ├── mod.rs
│   ├── producer.rs       # Publish events
│   ├── consumer.rs       # Subscribe to events
│   └── envelope.rs       # Event envelope format
```

**Event envelope:**
```json
{
  "eventId": "uuid",
  "eventType": "chat.event.message_sent",
  "timestamp": "2026-01-08T12:00:00Z",
  "correlationId": "uuid",
  "producer": "ws_gateway",
  "actor": {
    "userId": "123",
    "roles": ["user"]
  },
  "audience": {
    "type": "user|room|broadcast",
    "userIds": ["456"],
    "roomId": "lobby:main"
  },
  "payload": { ... }
}
```

### 2.6 Message Routing

**Inbound (Client → Gateway → Kafka):**
1. Parse client message
2. Validate message type is allowed
3. Wrap in envelope with actor info
4. Publish to appropriate Kafka topic

**Outbound (Kafka → Gateway → Clients):**
1. Consume from event topics
2. Read `audience` field
3. Lookup matching sockets in Redis
4. Push to each connected socket

### 2.7 Deliverables
- [ ] WebSocket server accepts connections
- [ ] Auth handshake completes
- [ ] Redis session/presence tracking works
- [ ] Heartbeat mechanism functional
- [ ] Kafka producer/consumer working
- [ ] Messages route correctly

---

## Phase 3: Chat System

**Goal:** Private chat (MongoDB) + public lobby chat (PostgreSQL)

### 3.1 Chat Module in blazing_sun

**Files to create:**
```
/blazing_sun/src/app/
├── chat/
│   ├── mod.rs
│   ├── service.rs        # Chat business logic
│   ├── kafka_handler.rs  # Process chat commands
│   └── models.rs         # Chat message models
```

### 3.2 Private Chat (MongoDB)

**Collection:** `private_chats`
```json
{
  "_id": ObjectId,
  "participants": ["userId1", "userId2"],
  "created_at": ISODate,
  "updated_at": ISODate
}
```

**Collection:** `private_messages`
```json
{
  "_id": ObjectId,
  "chat_id": ObjectId,
  "sender_id": "userId",
  "content": "message text",
  "sent_at": ISODate,
  "read_at": ISODate | null
}
```

**Friend validation flow:**
1. Receive `chat.command.send_message`
2. Query PostgreSQL: are sender & recipient friends?
3. If not friends AND sender not admin → reject
4. If valid → persist to MongoDB
5. Publish `chat.event.message_sent`

### 3.3 Public Lobby Chat (PostgreSQL)

**Migration:**
```sql
CREATE TABLE public_lobby_messages (
    id BIGSERIAL PRIMARY KEY,
    lobby_id VARCHAR(100) NOT NULL,
    sender_id INTEGER NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    INDEX idx_lobby_sent (lobby_id, sent_at DESC)
);

-- Stored procedure to insert and trim to 1000
CREATE OR REPLACE FUNCTION insert_lobby_message(
    p_lobby_id VARCHAR,
    p_sender_id INTEGER,
    p_content TEXT
) RETURNS BIGINT AS $$
DECLARE
    new_id BIGINT;
BEGIN
    INSERT INTO public_lobby_messages (lobby_id, sender_id, content)
    VALUES (p_lobby_id, p_sender_id, p_content)
    RETURNING id INTO new_id;

    -- Delete old messages beyond 1000
    DELETE FROM public_lobby_messages
    WHERE lobby_id = p_lobby_id
    AND id NOT IN (
        SELECT id FROM public_lobby_messages
        WHERE lobby_id = p_lobby_id
        ORDER BY sent_at DESC
        LIMIT 1000
    );

    RETURN new_id;
END;
$$ LANGUAGE plpgsql;
```

### 3.4 Chat Commands & Events

**Commands (Client → Server):**
```json
// Send private message
{
  "type": "chat.command.send_message",
  "recipientId": "456",
  "content": "Hello!"
}

// Send lobby message
{
  "type": "chat.command.send_lobby_message",
  "lobbyId": "games:bigger_dice",
  "content": "Anyone want to play?"
}

// Typing indicator
{
  "type": "chat.command.typing",
  "recipientId": "456"
}
```

**Events (Server → Client):**
```json
// Private message received
{
  "type": "chat.event.message_received",
  "messageId": "...",
  "senderId": "123",
  "senderName": "johndoe",
  "content": "Hello!",
  "sentAt": "ISO-8601"
}

// Lobby message
{
  "type": "chat.event.lobby_message",
  "lobbyId": "games:bigger_dice",
  "messageId": "...",
  "senderId": "123",
  "senderName": "johndoe",
  "content": "Anyone want to play?",
  "sentAt": "ISO-8601"
}

// Message rejected
{
  "type": "chat.event.message_rejected",
  "reason": "NOT_FRIENDS",
  "recipientId": "456"
}
```

### 3.5 Deliverables
- [ ] Private chat works between friends
- [ ] Admin can message anyone
- [ ] Non-friends get rejection
- [ ] Public lobby chat works
- [ ] Messages persist correctly
- [ ] Chat history loads on connect

---

## Phase 4: Games Infrastructure

**Goal:** Games page, catalog, lobby system, room management

### 4.1 Games Module in blazing_sun

**Files:**
```
/blazing_sun/src/app/
├── games/
│   ├── mod.rs
│   ├── service.rs        # Game coordination
│   ├── kafka_handler.rs  # Process game commands
│   ├── lobby.rs          # Lobby management
│   ├── room.rs           # Room lifecycle
│   └── models.rs         # Game models
```

### 4.2 Database Schema

**PostgreSQL - Game catalog:**
```sql
CREATE TABLE game_types (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    min_players INTEGER NOT NULL DEFAULT 2,
    max_players INTEGER NOT NULL DEFAULT 2,
    thumbnail_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO game_types (slug, name, description, min_players, max_players) VALUES
('bigger_dice', 'Bigger Dice', 'Roll the dice! Highest roll wins the round. First to 10 points wins!', 2, 2);
```

**MongoDB - Game rooms & state:**
```json
// Collection: game_rooms
{
  "_id": ObjectId,
  "game_type": "bigger_dice",
  "room_name": "my-game-room",
  "host_id": "userId",
  "status": "waiting|playing|finished",
  "players": ["userId1", "userId2"],
  "spectators": ["userId3"],
  "created_at": ISODate,
  "started_at": ISODate | null,
  "finished_at": ISODate | null
}

// Collection: game_states (per game type)
{
  "_id": ObjectId,
  "room_id": ObjectId,
  "game_type": "bigger_dice",
  "state": {
    "scores": {"userId1": 5, "userId2": 3},
    "current_turn": "userId1",
    "last_rolls": {"userId1": null, "userId2": null},
    "round": 8
  },
  "history": [
    {"round": 1, "rolls": {"userId1": 4, "userId2": 2}, "winner": "userId1"}
  ],
  "updated_at": ISODate
}
```

### 4.3 Web Routes

**Files to modify/create:**
```
/blazing_sun/src/app/http/web/controllers/
├── games.rs              # Games page controllers
```

**Routes:**
```
GET  /games                    → Games catalog page
GET  /games/:slug              → Game lobby page (e.g., /games/bigger_dice)
GET  /games/:slug/play/:room   → Active game page (web component loads here)
```

### 4.4 Games Page Frontend

**Files:**
```
/blazing_sun/src/frontend/pages/GAMES/
├── package.json
├── vite.config.js
├── src/
│   ├── main.js
│   ├── GamesCatalog.js    # Game cards component
│   └── styles/
│       └── main.scss
```

**Tera template:** `templates/pages/games/index.html`

### 4.5 Lobby System

**Lobby features:**
- List of available rooms (waiting for players)
- Public chat for game lobby
- Create room with unique name
- Join room by name
- Room status updates in real-time

**Room lifecycle:**
```
1. Host creates room → status: "waiting"
2. Second player joins → status: "playing"
3. Game completes → status: "finished"
4. Room archived after 24 hours
```

### 4.6 Game Commands & Events

**Commands:**
```json
// Create room
{
  "type": "games.command.create_room",
  "gameType": "bigger_dice",
  "roomName": "my-awesome-game"
}

// Join room
{
  "type": "games.command.join_room",
  "roomName": "my-awesome-game"
}

// Leave room
{
  "type": "games.command.leave_room",
  "roomId": "..."
}

// Join as spectator
{
  "type": "games.command.spectate",
  "roomId": "..."
}
```

**Events:**
```json
// Room created
{
  "type": "games.event.room_created",
  "roomId": "...",
  "roomName": "my-awesome-game",
  "gameType": "bigger_dice",
  "hostId": "123"
}

// Player joined
{
  "type": "games.event.player_joined",
  "roomId": "...",
  "playerId": "456",
  "playerName": "jane"
}

// Game started
{
  "type": "games.event.game_started",
  "roomId": "...",
  "players": [
    {"id": "123", "name": "john"},
    {"id": "456", "name": "jane"}
  ],
  "firstTurn": "123"
}

// Room list update (for lobby)
{
  "type": "games.event.rooms_updated",
  "gameType": "bigger_dice",
  "rooms": [
    {"roomId": "...", "roomName": "...", "hostName": "...", "status": "waiting"}
  ]
}
```

### 4.7 Deliverables
- [ ] /games page shows game catalog
- [ ] /games/bigger_dice shows lobby
- [ ] Create/join room flow works
- [ ] Public lobby chat functional
- [ ] Room list updates in real-time
- [ ] Room lifecycle managed correctly

---

## Phase 5: Bigger Dice Game

**Goal:** Complete game implementation with animated UI

### 5.1 Game Logic (blazing_sun module)

**Files:**
```
/blazing_sun/src/app/games/
├── bigger_dice/
│   ├── mod.rs
│   ├── logic.rs          # Game rules
│   ├── handler.rs        # Kafka command handler
│   └── state.rs          # State management
```

**Game rules:**
```rust
struct BiggerDiceState {
    players: [UserId; 2],
    scores: [u8; 2],       // 0-10
    current_turn: usize,   // 0 or 1
    current_round: u8,
    last_rolls: [Option<u8>; 2],  // 1-6 or None
    phase: RoundPhase,     // WaitingForRoll | WaitingForSecondRoll | RoundComplete
}

enum RoundPhase {
    WaitingForRoll,        // Current player can roll
    WaitingForSecondRoll,  // Second player can roll
    RoundComplete,         // Both rolled, determine winner
}

fn roll_dice() -> u8 {
    rand::thread_rng().gen_range(1..=6)
}

fn determine_round_winner(roll1: u8, roll2: u8) -> Option<usize> {
    match roll1.cmp(&roll2) {
        Ordering::Greater => Some(0),
        Ordering::Less => Some(1),
        Ordering::Equal => None,  // Draw
    }
}
```

### 5.2 Game Commands & Events

**Commands:**
```json
// Roll dice (only current turn player)
{
  "type": "games.command.bigger_dice.roll",
  "roomId": "..."
}
```

**Events:**
```json
// Dice rolled
{
  "type": "games.event.bigger_dice.rolled",
  "roomId": "...",
  "playerId": "123",
  "roll": 5,
  "isFirstRoll": true
}

// Round complete
{
  "type": "games.event.bigger_dice.round_complete",
  "roomId": "...",
  "round": 5,
  "rolls": {"player1": 5, "player2": 3},
  "winner": "123",  // or null for draw
  "scores": {"123": 4, "456": 2},
  "nextTurn": "456"
}

// Game over
{
  "type": "games.event.bigger_dice.game_over",
  "roomId": "...",
  "winner": "123",
  "winnerName": "john",
  "finalScores": {"123": 10, "456": 7}
}

// State sync (for reconnection)
{
  "type": "games.event.bigger_dice.state_sync",
  "roomId": "...",
  "state": {
    "scores": {"123": 4, "456": 2},
    "currentTurn": "123",
    "round": 6,
    "lastRolls": {"123": null, "456": null}
  }
}
```

### 5.3 Web Component

**Files:**
```
/blazing_sun/src/frontend/games/BIGGER_DICE/
├── package.json
├── vite.config.js
├── build.sh
├── src/
│   ├── main.js                 # Entry point, registers component
│   ├── BiggerDiceGame.js       # Main Web Component class
│   ├── components/
│   │   ├── Dice.js             # Animated dice component
│   │   ├── Scoreboard.js       # Score display
│   │   ├── PlayerCard.js       # Player info
│   │   ├── GameChat.js         # In-game player chat
│   │   └── RollButton.js       # Action button
│   ├── socket/
│   │   ├── connection.js       # WS connection manager
│   │   └── handlers.js         # Event handlers
│   ├── styles/
│   │   ├── main.scss
│   │   ├── _dice.scss          # Dice animation styles
│   │   ├── _scoreboard.scss
│   │   └── _variables.scss
│   └── utils/
│       └── audio.js            # Sound effects (optional)
```

### 5.4 Web Component Structure

```javascript
// BiggerDiceGame.js
class BiggerDiceGame extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.state = {
            connected: false,
            authenticated: false,
            gameState: null,
            myPlayerId: null,
            isMyTurn: false
        };
    }

    connectedCallback() {
        this.roomId = this.getAttribute('room-id');
        this.userId = this.getAttribute('user-id');
        this.render();
        this.initSocket();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>${styles}</style>
            <div class="game-container">
                <div class="game-header">
                    <player-card position="left"></player-card>
                    <scoreboard></scoreboard>
                    <player-card position="right"></player-card>
                </div>
                <div class="game-board">
                    <animated-dice id="dice1"></animated-dice>
                    <animated-dice id="dice2"></animated-dice>
                </div>
                <div class="game-controls">
                    <roll-button></roll-button>
                </div>
                <game-chat></game-chat>
            </div>
        `;
    }

    // ... socket handlers, game logic
}

customElements.define('bigger-dice-game', BiggerDiceGame);
```

### 5.5 Animated Dice Component

```javascript
// Dice.js
class AnimatedDice extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    roll(finalValue, duration = 1000) {
        return new Promise(resolve => {
            const dice = this.shadowRoot.querySelector('.dice');
            dice.classList.add('rolling');

            // Random intermediate values
            let frames = 0;
            const maxFrames = duration / 50;
            const interval = setInterval(() => {
                const randomFace = Math.floor(Math.random() * 6) + 1;
                this.showFace(randomFace);
                frames++;
                if (frames >= maxFrames) {
                    clearInterval(interval);
                    dice.classList.remove('rolling');
                    this.showFace(finalValue);
                    resolve();
                }
            }, 50);
        });
    }

    showFace(value) {
        const faces = this.shadowRoot.querySelectorAll('.dice-face');
        faces.forEach(f => f.classList.remove('active'));
        this.shadowRoot.querySelector(`.face-${value}`).classList.add('active');
    }
}
```

### 5.6 Tera Template

**File:** `templates/pages/games/bigger_dice/play.html`
```html
{% extends "layouts/base.html" %}

{% block content %}
<div class="game-page">
    <bigger-dice-game
        room-id="{{ room_id }}"
        user-id="{{ user.id }}"
        user-name="{{ user.username }}"
        auth-token="{{ auth_token }}">
    </bigger-dice-game>
</div>

<script type="module" src="/assets/games/bigger_dice/main.js"></script>
{% endblock %}
```

### 5.7 Player Chat (In-Game)

Separate from spectator chat:
- Only player1 and player2 can see/send
- Messages not persisted (ephemeral)
- Uses room-scoped events

### 5.8 Deliverables
- [ ] Game logic validates turns correctly
- [ ] Only current player can roll
- [ ] Dice animation plays
- [ ] Scores update correctly
- [ ] First to 10 wins
- [ ] Winner announcement displays
- [ ] Player chat works
- [ ] Game state persists to MongoDB

---

## Phase 6: Spectator System

**Goal:** Watch games + separate spectator chat

### 6.1 Spectator Features

- Join as spectator (not player)
- See all game events (rolls, scores)
- Separate chat room (spectators only)
- Leave spectator mode anytime
- Count displayed in UI

### 6.2 Event Filtering

**Players receive:**
- All game events
- Player chat events

**Spectators receive:**
- All game events
- Spectator chat events only (NOT player chat)

### 6.3 Spectator Commands & Events

**Commands:**
```json
// Join as spectator
{
  "type": "games.command.spectate",
  "roomId": "..."
}

// Leave spectating
{
  "type": "games.command.stop_spectating",
  "roomId": "..."
}

// Spectator chat
{
  "type": "games.command.spectator_chat",
  "roomId": "...",
  "content": "Nice roll!"
}
```

**Events:**
```json
// Spectator joined
{
  "type": "games.event.spectator_joined",
  "roomId": "...",
  "spectatorId": "789",
  "spectatorName": "viewer1",
  "spectatorCount": 5
}

// Spectator chat message
{
  "type": "games.event.spectator_chat_message",
  "roomId": "...",
  "senderId": "789",
  "senderName": "viewer1",
  "content": "Nice roll!",
  "sentAt": "ISO-8601"
}
```

### 6.4 UI Changes

- Spectator count badge
- "Watch" button on room list
- Spectator chat panel (when spectating)
- "You are spectating" indicator

### 6.5 Deliverables
- [ ] Join as spectator works
- [ ] Spectators see game events
- [ ] Spectator chat separate from player chat
- [ ] Players don't see spectator chat
- [ ] Spectator count updates
- [ ] Leave spectating works

---

## Phase 7: Reconnection & Resilience

**Goal:** Handle disconnections gracefully

### 7.1 Reconnection Flow

```
1. User disconnects (network, refresh, etc.)
2. Redis keeps:
   - room membership
   - game participation
   - reconnection metadata (TTL: 5 min)
3. User reconnects with same JWT
4. Gateway:
   - Creates new socketId
   - Finds existing user data in Redis
   - Re-joins user to rooms
   - Requests state sync from services
5. Services send state snapshots
6. User resumes where they left off
```

### 7.2 State Sync Protocol

```json
// Client requests sync after reconnect
{
  "type": "system.command.sync_state"
}

// Server sends relevant state
{
  "type": "system.event.state_snapshot",
  "activeRooms": ["room1", "room2"],
  "gameStates": {
    "room1": { ... game state ... }
  },
  "unreadMessages": 3
}
```

### 7.3 Reconnection Window

- **5-minute window:** Full state recovery
- **After 5 minutes:**
  - If game was active: opponent wins by forfeit
  - User can start fresh

### 7.4 Error Handling

**Connection errors:**
- WebSocket close → attempt reconnect (exponential backoff)
- Auth failure → redirect to login
- Rate limit → show warning

**Game errors:**
- Invalid action → show error, don't change state
- Opponent disconnected → show waiting indicator
- Game state conflict → request resync

### 7.5 Deliverables
- [ ] Reconnection restores state
- [ ] Game continues after brief disconnect
- [ ] Forfeit after timeout
- [ ] Error messages display properly
- [ ] Exponential backoff works

---

## Phase 8: Testing & Documentation

### 8.1 Unit Tests

**ws_gateway:**
- Connection lifecycle
- JWT validation
- Message routing
- Redis operations

**blazing_sun chat:**
- Friend validation
- Message persistence
- Lobby message trimming

**blazing_sun games:**
- Bigger Dice logic
- Turn validation
- Win condition
- State management

### 8.2 Integration Tests

- Full WebSocket flow
- Kafka event delivery
- Multi-client game
- Reconnection scenario

### 8.3 Load Testing

- 100+ concurrent connections
- Message throughput
- Kafka consumer lag

### 8.4 Documentation

- API documentation (commands/events)
- Deployment guide
- Monitoring guide

---

## File Summary

### New Files to Create

**ws_gateway (new Rust crate):**
```
/ws_gateway/                          (~20 files)
├── Cargo.toml
├── Dockerfile
├── src/
│   ├── main.rs
│   ├── config.rs
│   ├── connection/
│   ├── kafka/
│   ├── redis/
│   └── auth/
```

**blazing_sun additions:**
```
/blazing_sun/src/app/
├── chat/                             (~5 files)
├── games/                            (~10 files)
│   └── bigger_dice/

/blazing_sun/src/frontend/
├── pages/GAMES/                      (~5 files)
├── games/BIGGER_DICE/                (~15 files)
├── modules/SOCKETS/                  (~5 files)
```

**Templates:**
```
/blazing_sun/templates/pages/
├── games/
│   ├── index.html
│   ├── lobby.html
│   └── bigger_dice/
│       └── play.html
```

**Migrations:**
```
/blazing_sun/migrations/
├── YYYYMMDD_create_game_types.sql
├── YYYYMMDD_create_public_lobby_messages.sql
```

### Modified Files

- `docker-compose.yml` - Add ws_gateway service
- `.env` - Add WS_GATEWAY_* variables
- `blazing_sun/Cargo.toml` - Add dependencies
- `blazing_sun/src/app/mod.rs` - Register modules
- `blazing_sun/src/bootstrap/routes/controller/mod.rs` - Add routes

---

## Timeline Estimate

| Phase | Description | Complexity |
|-------|-------------|------------|
| 1 | Infrastructure Setup | Medium |
| 2 | WebSocket Gateway Core | High |
| 3 | Chat System | Medium |
| 4 | Games Infrastructure | High |
| 5 | Bigger Dice Game | High |
| 6 | Spectator System | Medium |
| 7 | Reconnection & Resilience | Medium |
| 8 | Testing & Documentation | Medium |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Kafka complexity | Start with single partition, scale later |
| WebSocket scaling | Single instance MVP, add Redis pub/sub for multi-instance |
| State consistency | MongoDB + Redis with clear ownership |
| Animation performance | CSS transforms, requestAnimationFrame |
| Reconnection edge cases | Comprehensive testing, timeout handling |

---

## Success Criteria

✅ WebSocket Gateway connects/authenticates users
✅ Private chat works (friends only, admin override)
✅ Public lobby chat with history
✅ Games catalog page displays
✅ Create/join game room flow
✅ Bigger Dice game plays correctly
✅ Animated dice rolls
✅ Spectators can watch with separate chat
✅ Reconnection recovers game state
✅ All tests pass

---

**End of Implementation Plan**
