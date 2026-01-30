# Roulette Game Documentation

This document provides comprehensive documentation for the Roulette game implementation in Blazing Sun.

## Overview

The roulette game features **dual-mode gameplay**:
- **Single-player mode**: REST API-based with user-friendly JavaScript interface
- **Multiplayer mode**: WebSocket-based with real-time Kafka event streaming, supporting concurrent players

### Technology Stack
| Component | Technology |
|-----------|------------|
| Backend | Rust with Actix-web |
| Real-time | WebSocket via ws_gateway |
| Database | PostgreSQL (balances), MongoDB (game history) |
| Message Streaming | Apache Kafka |
| Frontend | Vanilla ES6 JavaScript Web Components |
| Build Tool | Vite |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ROULETTE SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐        │
│  │   Browser    │────▶│  ws_gateway  │────▶│  Kafka Topics    │        │
│  │  (WebSocket) │◀────│  (WebSocket) │◀────│  roulette.*      │        │
│  └──────────────┘     └──────────────┘     └────────┬─────────┘        │
│                                                      │                  │
│                                                      ▼                  │
│  ┌──────────────┐     ┌──────────────────────────────────────┐         │
│  │   Browser    │────▶│          blazing_sun                  │         │
│  │  (REST API)  │◀────│  ┌─────────────────────────────────┐ │         │
│  └──────────────┘     │  │    RouletteCommandHandler       │ │         │
│                       │  │  - Tick processing              │ │         │
│                       │  │  - Bet handling                 │ │         │
│                       │  │  - Payout calculation           │ │         │
│                       │  └─────────────────────────────────┘ │         │
│                       │  ┌─────────────────────────────────┐ │         │
│                       │  │    Roulette REST Controller     │ │         │
│                       │  │  - Single-player endpoints      │ │         │
│                       │  │  - History & stats              │ │         │
│                       │  └─────────────────────────────────┘ │         │
│                       └──────────────────────────────────────┘         │
│                                      │                                  │
│                       ┌──────────────┼──────────────┐                  │
│                       ▼              ▼              ▼                  │
│               ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│               │ PostgreSQL │  │  MongoDB   │  │   Redis    │           │
│               │ (balances) │  │ (history)  │  │ (sessions) │           │
│               └────────────┘  └────────────┘  └────────────┘           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Multiplayer Event Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Roulette Tick Producer (Background Task)                    │
│ - Runs continuously                                         │
│ - Sends tick every 1 second                                 │
│ - Counts: 120 → 0 → reset with new spin_id                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
            roulette.ticks (Kafka)
                     │
                     ▼
┌────────────────────────────────────────┐
│ RouletteCommandHandler                 │
│ - Consumes roulette.ticks              │
│ - Consumes roulette.commands           │
│ - Broadcasts to connected clients      │
│ - At 0s: process_spin_result()         │
└────────────┬───────────────────────────┘
             │
             ├─→ PostgreSQL (deduct & add balance)
             ├─→ MongoDB (save bets & spins)
             └─→ roulette.events (Kafka)
                       │
                       ▼
┌─────────────────────────────────────────┐
│ ws_gateway (WebSocket Gateway)          │
│ - Subscribes to roulette.events         │
│ - Routes events to connected clients    │
│ - Handles client commands → Kafka       │
└─────────────────────────────────────────┘
```

---

## Game Rules

### American Roulette Wheel
- **38 numbers**: 0, 00, 1-36
- **18 red numbers**: 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
- **18 black numbers**: 2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35
- **2 green numbers**: 0, 00

### Multiplayer Timing

| Phase | Duration | Description |
|-------|----------|-------------|
| Betting | 120s → 5s | Accept bets from players |
| Animation | 5s → 3s | Wheel animation begins, betting locked |
| Spinning | 3s → 1s | Ball spinning on wheel |
| Payout | 1s → 0s | Calculate and distribute payouts |

### Bet Types and Payouts

| Bet Type | Payout | Numbers Covered | Description |
|----------|--------|-----------------|-------------|
| Straight | 35:1 | 1 | Single number |
| Split | 17:1 | 2 | Two adjacent numbers |
| Street | 11:1 | 3 | Three numbers in a row |
| Corner | 8:1 | 4 | Four numbers in a square |
| Line | 5:1 | 6 | Six numbers (two rows) |
| Basket | 6:1 | 5 | 0, 00, 1, 2, 3 |
| Column | 2:1 | 12 | 12 numbers in a column |
| Dozen | 2:1 | 12 | 1-12, 13-24, or 25-36 |
| Color | 1:1 | 18 | Red or black |
| Parity | 1:1 | 18 | Odd or even |
| Range | 1:1 | 18 | 1-18 or 19-36 |

---

## File Structure

### Backend Files

```
blazing_sun/src/
├── app/games/
│   ├── mod.rs                          # Module declarations
│   ├── roulette.rs                     # Core game logic
│   ├── roulette_types.rs               # Protocol types
│   ├── mongodb_roulette.rs             # Single-player history
│   └── mongodb_roulette_multiplayer.rs # Multiplayer state
│
├── app/http/api/controllers/
│   ├── roulette.rs                     # REST API endpoints
│   └── roulette_ajax.rs                # Legacy AJAX controller
│
├── bootstrap/events/
│   ├── mod.rs                          # Events module
│   ├── topics.rs                       # Kafka topics
│   ├── roulette_tick_producer.rs       # Tick producer
│   └── handlers/
│       └── roulette.rs                 # Command handler
│
└── routes/
    ├── api.rs                          # API routes
    └── web.rs                          # Web routes
```

### Frontend Files

```
blazing_sun/src/frontend/games/ROULETTE/
├── package.json
├── vite.config.js
└── src/
    ├── main.js                         # Entry point
    ├── MiniRoulette.js                 # Web component
    └── styles/
        └── main.scss                   # Styles

Compiled output:
blazing_sun/src/resources/
├── js/games/ROULETTE/app.js
└── css/ROULETTE/style.css
```

### Templates

```
blazing_sun/src/resources/views/web/
├── roulette.html                       # Single-player page
└── roulette_multiplayer.html           # Multiplayer page
```

---

## Kafka Topics

| Topic | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `roulette.ticks` | Tick Producer | Command Handler | Countdown events |
| `roulette.commands` | ws_gateway | Command Handler | Client commands |
| `roulette.events` | Command Handler | ws_gateway | Events to clients |
| `roulette.bet_payed` | Command Handler | Checkout | Bet payment |
| `roulette.payout` | Command Handler | Checkout | Payout confirmation |

### Tick Event
```json
{
  "spin_id": "uuid-...",
  "seconds_remaining": 45,
  "phase": "betting"
}
```

### Command Examples

**Join:**
```json
{
  "command": "join",
  "user_id": 123,
  "username": "player1",
  "socket_id": "ws-socket-id"
}
```

**Broadcast Bets:**
```json
{
  "command": "broadcast_bets",
  "user_id": 123,
  "spin_id": "uuid-...",
  "bets": [
    { "type": "straight", "key": "17", "tokens": 10, "multiplier": 100 }
  ],
  "total_amount": 1000
}
```

### Event Examples

**Spin Result:**
```json
{
  "type": "roulette.spin_result",
  "spin_id": "uuid-...",
  "winning_number": "17",
  "winning_color": "black",
  "winning_parity": "odd",
  "total_bets_amount": 250000,
  "total_payouts": 150000,
  "bet_count": 45
}
```

**Payout:**
```json
{
  "type": "roulette.payout",
  "user_id": 123,
  "spin_id": "uuid-...",
  "total_bet": 1000,
  "total_payout": 36000,
  "net_result": 35000,
  "new_balance": 85000,
  "bet_results": [...]
}
```

---

## MongoDB Collections

### roulette_history (Single-player)
```javascript
{
  "_id": ObjectId,
  "user_id": 123,
  "event_type": "game",
  "result_number": "17",
  "result_color": "black",
  "result_parity": "odd",
  "total_stake": 1000,
  "payout": 36000,
  "net_result": 35000,
  "bets_json": [...],
  "bet_results": [...],
  "created_at": ISODate
}
```

### roulette_multiplayer_bets
```javascript
{
  "_id": ObjectId,
  "user_id": 123,
  "username": "player1",
  "spin_id": "uuid-...",
  "bets": [...],
  "total_amount": 1000,
  "created_at": ISODate,
  "processed": false,
  "payout": null
}
```

### roulette_multiplayer_spins
```javascript
{
  "_id": ObjectId,
  "spin_id": "uuid-...",
  "winning_number": "17",
  "winning_color": "black",
  "winning_parity": "odd",
  "total_bets_amount": 250000,
  "total_payouts": 150000,
  "bet_count": 45,
  "created_at": ISODate
}
```

### roulette_multiplayer_chat (TTL: 24 hours)
```javascript
{
  "_id": ObjectId,
  "user_id": 123,
  "username": "player1",
  "avatar_id": 5,
  "content": "Nice spin!",
  "is_system": false,
  "created_at": ISODate
}
```

---

## REST API Endpoints

### Single-Player Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/roulette/place-bet` | Validate bets (no balance deduction) |
| POST | `/api/v1/roulette/spin` | Execute spin, deduct balance, calculate payout |
| GET | `/api/v1/roulette/history` | Get paginated game history |
| GET | `/api/v1/roulette/stats` | Get user statistics |
| GET | `/api/v1/roulette/balance` | Get current balance |

### Multiplayer Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/roulette/multiplayer/state` | Get initial state |
| GET | `/api/v1/roulette/multiplayer/spin-history` | Get last 20 spins |
| GET | `/api/v1/roulette/multiplayer/my-bets/{spin_id}` | Get user's bets for spin |

---

## Web Routes

| Route Name | URL | Description |
|------------|-----|-------------|
| `web.games.roulette_lobby` | `/games/roulette` | Single-player lobby |
| `web.games.roulette` | `/games/roulette/{room_id}` | Single-player game |
| `web.games.roulette_multiplayer` | `/games/roulette-multiplayer` | Multiplayer lobby |

### Serbian Translations
- `/igre/rulet` → Single-player lobby
- `/igre/rulet/{room_id}` → Single-player game
- `/igre/rulet-multiplayer` → Multiplayer lobby

---

## Frontend Web Component

The `<mini-roulette>` web component provides the complete game UI:

### Attributes
```html
<mini-roulette
    data-ws-url="{{ ws_url }}"
    data-user-id="{{ user.id }}"
    data-username="{{ user.username }}"
    data-balance="{{ user.balance }}"
    data-token="{{ jwt_token }}"
    data-mode="multiplayer"
></mini-roulette>
```

### Features
- Canvas-rendered wheel with spin animation
- Interactive betting board
- Chip selector with drag-and-drop
- Real-time timer display
- History bar (last 20 spins)
- Chat panel with opt-out
- Responsive design

---

## Constants

```rust
// Timing
pub const CYCLE_DURATION_SECONDS: u32 = 120;
pub const BLOCK_BETS_AT_SECONDS: u32 = 5;

// Display
pub const HISTORY_BAR_SIZE: usize = 20;

// Balance
pub const BALANCE_TO_COIN_RATIO: i64 = 1000;

// Payouts
pub const PAYOUT_STRAIGHT: i64 = 35;
pub const PAYOUT_SPLIT: i64 = 17;
pub const PAYOUT_STREET: i64 = 11;
pub const PAYOUT_CORNER: i64 = 8;
pub const PAYOUT_LINE: i64 = 5;
pub const PAYOUT_BASKET: i64 = 6;
pub const PAYOUT_COLUMN: i64 = 2;
pub const PAYOUT_DOZEN: i64 = 2;
pub const PAYOUT_OUTSIDE: i64 = 1;  // color, parity, range
```

---

## Development

### Build Frontend
```bash
cd blazing_sun/src/frontend/games/ROULETTE
npm install
npm run build

# Watch mode
npm run dev

# Production
npm run build:prod
```

### Run Tests
```bash
cd blazing_sun
cargo test roulette
```

### Debug Kafka Events
```bash
# View tick events
docker compose exec kafka kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic roulette.ticks

# View commands
docker compose exec kafka kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic roulette.commands

# View events
docker compose exec kafka kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic roulette.events
```

---

## Troubleshooting

### WebSocket Not Connecting
1. Check ws_gateway is running: `docker compose ps ws_gateway`
2. Verify nginx proxy config for `/ws/roulette`
3. Check browser console for connection errors

### Bets Not Processing
1. Check tick producer is running in logs
2. Verify command handler is consuming from topics
3. Check MongoDB for pending bets

### Payout Incorrect
1. Verify bet validation in `roulette.rs`
2. Check payout calculation for bet type
3. Review MongoDB bet record

### Balance Not Updating
1. Check PostgreSQL for balance changes
2. Verify atomic deduction in mutations
3. Check payout event delivery

---

## Related Documentation

- [WebSocket Gateway](../socket-system/IMPLEMENTATION_PLAN.md)
- [Kafka Events](../blazing_sun/Events/EVENTS.md)
- [MongoDB](../blazing_sun/MongoDB/MONGODB.md)
- [Frontend Build](../blazing_sun/Frontend/FRONTEND_BUILD.md)
