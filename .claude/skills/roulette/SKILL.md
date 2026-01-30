---
name: roulette
description: ROULETTE game reference implementation. Complete patterns for American roulette with dual-mode gameplay (single-player REST API + multiplayer WebSocket), 120-second betting cycles, real-time Kafka tick events, and payment integration.
invocable: false
agent: game-developer
---

# ROULETTE Reference Implementation

This skill documents the complete ROULETTE game implementation as a reference for creating new games. The roulette game features **dual-mode gameplay**: single-player via REST API and multiplayer via WebSocket with Kafka event streaming.

## File Locations

### Frontend
```
blazing_sun/src/frontend/games/ROULETTE/
├── package.json
├── vite.config.js
└── src/
    ├── main.js           # Entry point, registers <mini-roulette> web component
    ├── MiniRoulette.js   # Main component (2000+ lines)
    └── styles/
        └── main.scss     # SCSS styles
```

### Backend - Game Logic
```
blazing_sun/src/app/games/
├── mod.rs                          # Module declarations
├── roulette.rs                     # Core game logic (spin, bets, payouts)
├── roulette_types.rs               # Protocol types (commands, events, phases)
├── mongodb_roulette.rs             # Single-player history (read operations)
└── mongodb_roulette_multiplayer.rs # Multiplayer state persistence
```

### Backend - Event Handlers
```
blazing_sun/src/bootstrap/events/
├── mod.rs                          # Events module
├── topics.rs                       # Kafka topic definitions
├── roulette_tick_producer.rs       # Background tick producer (1/second)
└── handlers/
    ├── mod.rs                      # Handlers registration
    └── roulette.rs                 # RouletteCommandHandler (processes commands)
```

### Controllers & Routes
```
blazing_sun/src/app/http/api/controllers/
├── roulette.rs                     # REST API endpoints (655 lines)
└── roulette_ajax.rs                # Legacy AJAX controller

blazing_sun/src/routes/
├── api.rs                          # API route definitions
└── web.rs                          # Web route definitions

blazing_sun/src/app/http/web/controllers/
└── pages.rs                        # Web page rendering
```

### WebSocket Gateway
```
ws_gateway/src/
├── protocol.rs           # ClientMessage::RouletteCommand, ServerMessage variants
└── server/mod.rs         # Event routing for roulette events
```

### Templates
```
blazing_sun/src/resources/views/web/
├── roulette.html                   # Single-player game page
└── roulette_multiplayer.html       # Multiplayer game page
```

### Compiled Assets
```
blazing_sun/src/resources/js/games/ROULETTE/app.js
blazing_sun/src/resources/css/ROULETTE/style.css
```

### Tests
```
blazing_sun/tests/routes/api/ROULETTE_MULTIPLAYER/
```

---

## Game Rules

### American Roulette
| Rule | Value |
|------|-------|
| **Wheel Numbers** | 38 (0, 00, 1-36) |
| **Red Numbers** | 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36 |
| **Black Numbers** | 2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35 |
| **Green Numbers** | 0, 00 |

### Multiplayer Mode
| Rule | Value |
|------|-------|
| **Cycle Duration** | 120 seconds (2 minutes) |
| **Betting Closes At** | 5 seconds remaining |
| **History Bar Size** | 20 recent spins |
| **Balance Ratio** | 1000 balance units = 1 coin |
| **Auto-Broadcast** | Bets sent automatically at 5 seconds |

### Bet Types & Payouts
| Bet Type | Payout | Description |
|----------|--------|-------------|
| Straight | 35:1 | Single number |
| Split | 17:1 | Two adjacent numbers |
| Street | 11:1 | Three numbers in a row |
| Corner | 8:1 | Four numbers in a square |
| Line | 5:1 | Six numbers (two rows) |
| Basket | 6:1 | 0, 00, 1, 2, 3 |
| Column | 2:1 | 12 numbers in a column |
| Dozen | 2:1 | 1-12, 13-24, or 25-36 |
| Color | 1:1 | Red or black |
| Parity | 1:1 | Odd or even |
| Range | 1:1 | 1-18 or 19-36 |
| Sector | 35:1 | Wheel sector bet |

---

## Kafka Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `roulette.ticks` | tick_producer → handler | Countdown events (every 1 second) |
| `roulette.commands` | ws_gateway → handler | Client commands (join, leave, broadcast_bets, chat) |
| `roulette.events` | handler → ws_gateway | Events to clients (tick, bet_confirmed, spin_result, payout) |
| `roulette.bet_payed` | handler → checkout | User bet payment confirmation |
| `roulette.payout` | handler → checkout | Payout confirmation |

### Tick Event Payload (every 1 second)

```json
{
  "spin_id": "uuid-...",
  "seconds_remaining": 45,
  "phase": "betting"
}
```

### Command Payloads

```json
// Join multiplayer
{
  "command": "join",
  "user_id": 123,
  "username": "player1",
  "socket_id": "ws-socket-id"
}

// Broadcast bets (sent at 5 seconds)
{
  "command": "broadcast_bets",
  "user_id": 123,
  "spin_id": "uuid-...",
  "bets": [
    { "type": "straight", "key": "17", "tokens": 10, "multiplier": 100 },
    { "type": "color", "key": "red", "tokens": 5, "multiplier": 100 }
  ],
  "total_amount": 1500
}

// Chat message
{
  "command": "chat",
  "user_id": 123,
  "username": "player1",
  "content": "Good luck everyone!"
}

// Toggle chat opt-out
{
  "command": "toggle_chat",
  "user_id": 123
}

// Leave multiplayer
{
  "command": "leave",
  "user_id": 123
}

// Request current state
{
  "command": "get_state",
  "user_id": 123,
  "socket_id": "ws-socket-id"
}
```

### Event Payloads

```json
// Tick event (broadcast every second)
{
  "type": "roulette.tick",
  "spin_id": "uuid-...",
  "seconds_remaining": 45,
  "phase": "betting",
  "connected_count": 12
}

// User joined
{
  "type": "roulette.user_joined",
  "user_id": 123,
  "username": "player1",
  "connected_count": 13
}

// Bet confirmed
{
  "type": "roulette.bet_confirmed",
  "user_id": 123,
  "spin_id": "uuid-...",
  "bets": [...],
  "total_amount": 1500,
  "new_balance": 48500
}

// Bet rejected
{
  "type": "roulette.bet_rejected",
  "user_id": 123,
  "reason": "insufficient_balance",
  "message": "Not enough balance for this bet"
}

// Spin result (broadcast to all)
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

// Individual payout (sent to each user)
{
  "type": "roulette.payout",
  "user_id": 123,
  "spin_id": "uuid-...",
  "total_bet": 1500,
  "total_payout": 5400,
  "net_result": 3900,
  "new_balance": 52400,
  "bet_results": [
    { "type": "straight", "key": "17", "amount": 1000, "won": true, "payout": 36000 },
    { "type": "color", "key": "red", "amount": 500, "won": false, "payout": 0 }
  ]
}

// Full state (on join/reconnect)
{
  "type": "roulette.state",
  "spin_id": "uuid-...",
  "seconds_remaining": 45,
  "phase": "betting",
  "connected_count": 12,
  "history": [
    { "number": "23", "color": "red" },
    { "number": "0", "color": "green" }
  ],
  "pending_bets": [...],
  "balance": 50000
}

// Chat message
{
  "type": "roulette.chat",
  "user_id": 123,
  "username": "player1",
  "avatar_id": 5,
  "content": "Nice spin!",
  "is_system": false,
  "timestamp": "2024-01-20T10:30:01Z"
}
```

---

## Backend: Game Phase Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ROULETTE CYCLE (120 seconds)             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  BETTING PHASE (120s → 5s)                                  │
│  ├── Accept bets from players                               │
│  ├── Broadcast tick events every second                     │
│  └── Players can place/modify bets                          │
│                                                             │
│  ANIMATION PHASE (5s → 3s)                                  │
│  ├── Betting locked (blockBets = true)                      │
│  ├── Auto-broadcast any pending bets                        │
│  └── Wheel animation begins                                 │
│                                                             │
│  SPINNING PHASE (3s → 1s)                                   │
│  ├── Ball is spinning on wheel                              │
│  └── Anticipation UI state                                  │
│                                                             │
│  PAYOUT PHASE (1s → 0s)                                     │
│  ├── process_spin_result() called                           │
│  ├── Calculate all winnings                                 │
│  ├── Credit winnings to PostgreSQL                          │
│  ├── Save results to MongoDB                                │
│  ├── Broadcast spin_result to all                           │
│  └── Send individual payout to each bettor                  │
│                                                             │
│  NEW CYCLE (0s → 120s)                                      │
│  └── New spin_id generated, cycle restarts                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend: Core Types (roulette_types.rs)

```rust
/// Game phases in the betting cycle
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RoulettePhase {
    Betting,    // 120s → 5s: accepting bets
    Animation,  // 5s → 3s: wheel animation starting
    Spinning,   // 3s → 1s: ball spinning
    Payout,     // 1s → 0s: calculating and distributing payouts
}

/// Commands from clients (via WebSocket → Kafka)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case")]
pub enum RouletteCommand {
    Join {
        user_id: i64,
        username: String,
        socket_id: String,
    },
    Leave {
        user_id: i64,
    },
    BroadcastBets {
        user_id: i64,
        spin_id: String,
        bets: Vec<RouletteBet>,
        total_amount: i64,
    },
    Chat {
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        content: String,
    },
    ToggleChat {
        user_id: i64,
    },
    GetState {
        user_id: i64,
        socket_id: String,
    },
}

/// Individual bet structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteBet {
    #[serde(rename = "type")]
    pub bet_type: String,   // straight, split, color, etc.
    pub key: String,        // "17", "red", "1-12", etc.
    pub tokens: i32,        // Number of tokens
    pub multiplier: i32,    // Chip value multiplier (default 100)
}

/// Tick event from producer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteTick {
    pub spin_id: String,
    pub seconds_remaining: u32,
    pub phase: RoulettePhase,
}

/// Constants
pub const CYCLE_DURATION_SECONDS: u32 = 120;
pub const BLOCK_BETS_AT_SECONDS: u32 = 5;
pub const HISTORY_BAR_SIZE: usize = 20;
pub const BALANCE_TO_COIN_RATIO: i64 = 1000;
```

---

## Backend: Tick Producer (roulette_tick_producer.rs)

Background task that sends tick events every second:

```rust
pub async fn start_roulette_tick_producer(kafka_producer: Arc<KafkaProducer>) {
    let mut spin_id = Uuid::new_v4().to_string();
    let mut seconds_remaining = CYCLE_DURATION_SECONDS;

    loop {
        // Determine current phase
        let phase = match seconds_remaining {
            6..=120 => RoulettePhase::Betting,
            4..=5 => RoulettePhase::Animation,
            2..=3 => RoulettePhase::Spinning,
            0..=1 => RoulettePhase::Payout,
            _ => RoulettePhase::Betting,
        };

        // Create tick event
        let tick = RouletteTick {
            spin_id: spin_id.clone(),
            seconds_remaining,
            phase,
        };

        // Publish to Kafka
        let payload = serde_json::to_string(&tick).unwrap();
        kafka_producer.send(
            "roulette.ticks",
            &spin_id,  // Partition key
            &payload,
        ).await;

        // Sleep 1 second
        tokio::time::sleep(Duration::from_secs(1)).await;

        // Decrement or reset
        if seconds_remaining == 0 {
            spin_id = Uuid::new_v4().to_string();
            seconds_remaining = CYCLE_DURATION_SECONDS;
        } else {
            seconds_remaining -= 1;
        }
    }
}
```

---

## Backend: Command Handler (handlers/roulette.rs)

```rust
pub struct RouletteCommandHandler {
    db: PgPool,
    mongo: MongoClient,
    kafka_producer: Arc<KafkaProducer>,

    // In-memory state (not persisted)
    current_spin: RwLock<CurrentSpinState>,
    connected_users: RwLock<HashMap<i64, ConnectedUser>>,
    chat_opt_out: RwLock<HashSet<i64>>,
}

#[derive(Debug, Clone, Default)]
pub struct CurrentSpinState {
    pub spin_id: String,
    pub seconds_remaining: u32,
    pub phase: RoulettePhase,
    pub result: Option<SpinResult>,
}

impl EventHandler for RouletteCommandHandler {
    async fn handle(&self, topic: &str, payload: &[u8]) -> Result<(), EventHandlerError> {
        match topic {
            "roulette.ticks" => self.handle_tick(payload).await,
            "roulette.commands" => self.handle_command(payload).await,
            _ => Ok(()),
        }
    }
}
```

### Handle Tick

```rust
async fn handle_tick(&self, payload: &[u8]) -> Result<(), EventHandlerError> {
    let tick: RouletteTick = serde_json::from_slice(payload)?;

    // Update current spin state
    {
        let mut state = self.current_spin.write().await;
        state.spin_id = tick.spin_id.clone();
        state.seconds_remaining = tick.seconds_remaining;
        state.phase = tick.phase.clone();
    }

    // Broadcast tick to all connected users
    let connected_count = self.connected_users.read().await.len();
    let event = RouletteEvent::Tick {
        spin_id: tick.spin_id.clone(),
        seconds_remaining: tick.seconds_remaining,
        phase: tick.phase.clone(),
        connected_count: connected_count as u32,
    };
    self.broadcast_event(event).await?;

    // At 0 seconds, process spin result
    if tick.seconds_remaining == 0 {
        self.process_spin_result(&tick.spin_id).await?;
    }

    Ok(())
}
```

### Process Spin Result

```rust
async fn process_spin_result(&self, spin_id: &str) -> Result<(), EventHandlerError> {
    // 1. Spin the wheel
    let result = spin_wheel();
    let winning_number = result.number.clone();
    let winning_color = determine_color(&result.number);
    let winning_parity = determine_parity(&result.number);

    // 2. Get all pending bets for this spin
    let pending_bets = mongodb_roulette_multiplayer::get_pending_bets_for_spin(
        &self.mongo,
        spin_id,
    ).await?;

    let mut total_bets_amount: i64 = 0;
    let mut total_payouts: i64 = 0;
    let bet_count = pending_bets.len();

    // 3. Process each user's bets
    for bet_record in pending_bets {
        let user_id = bet_record.user_id;
        let mut user_payout: i64 = 0;
        let mut bet_results = Vec::new();

        for bet in &bet_record.bets {
            let amount = (bet.tokens as i64) * (bet.multiplier as i64);
            total_bets_amount += amount;

            let payout = calculate_winnings(bet, &winning_number, &winning_color, &winning_parity);
            user_payout += payout;
            total_payouts += payout;

            bet_results.push(BetResult {
                bet_type: bet.bet_type.clone(),
                key: bet.key.clone(),
                amount,
                won: payout > 0,
                payout,
            });
        }

        // 4. Credit winnings to PostgreSQL
        if user_payout > 0 {
            mutations::user::add_balance(&self.db, user_id, user_payout).await?;
        }

        // 5. Mark bets as processed in MongoDB
        mongodb_roulette_multiplayer::mark_bets_processed(
            &self.mongo,
            spin_id,
            user_id,
            user_payout,
        ).await?;

        // 6. Get new balance and send payout event to user
        let new_balance = read::user::get_balance(&self.db, user_id).await?;

        let payout_event = RouletteEvent::Payout {
            user_id,
            spin_id: spin_id.to_string(),
            total_bet: bet_record.total_amount,
            total_payout: user_payout,
            net_result: user_payout - bet_record.total_amount,
            new_balance,
            bet_results,
        };
        self.send_event_to_user(user_id, payout_event).await?;
    }

    // 7. Save spin record to MongoDB
    mongodb_roulette_multiplayer::save_spin_record(
        &self.mongo,
        spin_id,
        &winning_number,
        &winning_color,
        &winning_parity,
        total_bets_amount,
        total_payouts,
        bet_count as i32,
    ).await?;

    // 8. Broadcast spin result to all
    let spin_result_event = RouletteEvent::SpinResult {
        spin_id: spin_id.to_string(),
        winning_number,
        winning_color,
        winning_parity,
        total_bets_amount,
        total_payouts,
        bet_count: bet_count as u32,
    };
    self.broadcast_event(spin_result_event).await?;

    Ok(())
}
```

### Handle Broadcast Bets

```rust
async fn handle_broadcast_bets(
    &self,
    user_id: i64,
    spin_id: &str,
    bets: Vec<RouletteBet>,
    total_amount: i64,
) -> Result<(), EventHandlerError> {
    // 1. Validate spin_id matches current
    let current_spin = self.current_spin.read().await;
    if current_spin.spin_id != spin_id {
        return self.send_bet_rejected(user_id, "invalid_spin", "Spin cycle has changed").await;
    }

    // 2. Validate betting is still open
    if current_spin.seconds_remaining <= BLOCK_BETS_AT_SECONDS {
        return self.send_bet_rejected(user_id, "betting_closed", "Betting is closed").await;
    }
    drop(current_spin);

    // 3. Validate bets
    for bet in &bets {
        if let Err(e) = validate_bet(bet) {
            return self.send_bet_rejected(user_id, "invalid_bet", &e).await;
        }
    }

    // 4. Check and deduct balance atomically
    let current_balance = read::user::get_balance(&self.db, user_id).await?;
    if current_balance < total_amount {
        return self.send_bet_rejected(user_id, "insufficient_balance", "Not enough balance").await;
    }

    mutations::user::deduct_balance_if_sufficient(&self.db, user_id, total_amount).await?;

    // 5. Save bets to MongoDB
    let username = self.get_username(user_id).await?;
    mongodb_roulette_multiplayer::save_bet(
        &self.mongo,
        user_id,
        &username,
        spin_id,
        &bets,
        total_amount,
    ).await?;

    // 6. Send confirmation
    let new_balance = current_balance - total_amount;
    let confirm_event = RouletteEvent::BetConfirmed {
        user_id,
        spin_id: spin_id.to_string(),
        bets,
        total_amount,
        new_balance,
    };
    self.send_event_to_user(user_id, confirm_event).await?;

    Ok(())
}
```

---

## Backend: Core Game Logic (roulette.rs)

```rust
/// American roulette wheel numbers
pub const WHEEL_NUMBERS: [&str; 38] = [
    "0", "00", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
    "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
    "31", "32", "33", "34", "35", "36"
];

/// Red numbers on American roulette wheel
pub const RED_NUMBERS: [&str; 18] = [
    "1", "3", "5", "7", "9", "12", "14", "16", "18",
    "19", "21", "23", "25", "27", "30", "32", "34", "36"
];

/// Spin the wheel and get a random result
pub fn spin_wheel() -> SpinResult {
    let mut rng = rand::thread_rng();
    let index = rng.gen_range(0..38);
    let number = WHEEL_NUMBERS[index].to_string();

    SpinResult {
        number: number.clone(),
        color: determine_color(&number),
        parity: determine_parity(&number),
    }
}

/// Determine color of a number
pub fn determine_color(number: &str) -> String {
    if number == "0" || number == "00" {
        "green".to_string()
    } else if RED_NUMBERS.contains(&number) {
        "red".to_string()
    } else {
        "black".to_string()
    }
}

/// Determine parity of a number
pub fn determine_parity(number: &str) -> String {
    if number == "0" || number == "00" {
        "none".to_string()
    } else {
        let n: i32 = number.parse().unwrap_or(0);
        if n % 2 == 0 { "even".to_string() } else { "odd".to_string() }
    }
}

/// Calculate winnings for a bet
pub fn calculate_winnings(bet: &RouletteBet, number: &str, color: &str, parity: &str) -> i64 {
    let amount = (bet.tokens as i64) * (bet.multiplier as i64);

    let (won, multiplier) = match bet.bet_type.as_str() {
        "straight" => (bet.key == number, 35),
        "color" => (bet.key == color, 1),
        "parity" => (bet.key == parity && parity != "none", 1),
        "dozen" => {
            let n: i32 = number.parse().unwrap_or(0);
            let in_dozen = match bet.key.as_str() {
                "1-12" => n >= 1 && n <= 12,
                "13-24" => n >= 13 && n <= 24,
                "25-36" => n >= 25 && n <= 36,
                _ => false,
            };
            (in_dozen, 2)
        },
        "column" => {
            let n: i32 = number.parse().unwrap_or(0);
            if n == 0 { return 0; }
            let col = ((n - 1) % 3) + 1;
            let key_col: i32 = bet.key.parse().unwrap_or(0);
            (col == key_col, 2)
        },
        "range" => {
            let n: i32 = number.parse().unwrap_or(0);
            let in_range = match bet.key.as_str() {
                "1-18" => n >= 1 && n <= 18,
                "19-36" => n >= 19 && n <= 36,
                _ => false,
            };
            (in_range, 1)
        },
        "split" => {
            let numbers: Vec<&str> = bet.key.split(',').collect();
            (numbers.contains(&number), 17)
        },
        "street" => {
            let numbers: Vec<&str> = bet.key.split(',').collect();
            (numbers.contains(&number), 11)
        },
        "corner" => {
            let numbers: Vec<&str> = bet.key.split(',').collect();
            (numbers.contains(&number), 8)
        },
        "line" => {
            let numbers: Vec<&str> = bet.key.split(',').collect();
            (numbers.contains(&number), 5)
        },
        "basket" => {
            let basket_numbers = ["0", "00", "1", "2", "3"];
            (basket_numbers.contains(&number), 6)
        },
        "sector" => (bet.key == number, 35),
        _ => (false, 0),
    };

    if won {
        amount + (amount * multiplier)  // Return original bet + winnings
    } else {
        0
    }
}

/// Validate a bet structure
pub fn validate_bet(bet: &RouletteBet) -> Result<(), String> {
    if bet.tokens <= 0 {
        return Err("Tokens must be positive".to_string());
    }
    if bet.multiplier <= 0 {
        return Err("Multiplier must be positive".to_string());
    }

    match bet.bet_type.as_str() {
        "straight" => {
            if !WHEEL_NUMBERS.contains(&bet.key.as_str()) {
                return Err(format!("Invalid number: {}", bet.key));
            }
        },
        "color" => {
            if !["red", "black"].contains(&bet.key.as_str()) {
                return Err(format!("Invalid color: {}", bet.key));
            }
        },
        "parity" => {
            if !["odd", "even"].contains(&bet.key.as_str()) {
                return Err(format!("Invalid parity: {}", bet.key));
            }
        },
        "dozen" => {
            if !["1-12", "13-24", "25-36"].contains(&bet.key.as_str()) {
                return Err(format!("Invalid dozen: {}", bet.key));
            }
        },
        "column" => {
            if !["1", "2", "3"].contains(&bet.key.as_str()) {
                return Err(format!("Invalid column: {}", bet.key));
            }
        },
        "range" => {
            if !["1-18", "19-36"].contains(&bet.key.as_str()) {
                return Err(format!("Invalid range: {}", bet.key));
            }
        },
        "split" | "street" | "corner" | "line" | "basket" | "sector" => {
            // These require more complex validation
        },
        _ => return Err(format!("Unknown bet type: {}", bet.bet_type)),
    }

    Ok(())
}
```

---

## Backend: MongoDB Collections

### roulette_multiplayer_bets
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct RouletteBetRecord {
    pub user_id: i64,
    pub username: String,
    pub spin_id: String,
    pub bets: Vec<RouletteBet>,
    pub total_amount: i64,
    pub created_at: DateTime<Utc>,
    pub processed: bool,
    pub payout: Option<i64>,
}
```

### roulette_multiplayer_spins
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct RouletteSpinRecord {
    pub spin_id: String,
    pub winning_number: String,
    pub winning_color: String,
    pub winning_parity: String,
    pub total_bets_amount: i64,
    pub total_payouts: i64,
    pub bet_count: i32,
    pub created_at: DateTime<Utc>,
}
```

### roulette_multiplayer_chat (TTL: 24 hours)
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct RouletteChatRecord {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub content: String,
    pub is_system: bool,
    pub created_at: DateTime<Utc>,
}
```

---

## Frontend: Web Component Structure

```javascript
class MiniRouletteGame extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // State
        this.credits = 0;
        this.placements = [];       // Active bets on board
        this.selectedChip = 1;      // Current chip value
        this.isSpinning = false;
        this.lastResults = [];      // History bar

        // WebSocket state (multiplayer)
        this.ws = null;
        this.wsState = {
            connected: false,
            authenticated: false,
            spinId: null,
            secondsRemaining: 120,
            phase: 'betting',
            connectedCount: 0,
        };
        this.betsBroadcasted = false;
        this.pendingBets = [];

        // Wheel layout (American roulette)
        this.wheelOrder = [
            '0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5',
            '22', '34', '15', '3', '24', '36', '13', '1', '00', '27', '10',
            '25', '29', '12', '8', '19', '31', '18', '6', '21', '33', '16',
            '4', '23', '35', '14', '2'
        ];
    }

    connectedCallback() {
        this.render();
        this.setupEventListeners();

        if (this.isMultiplayer) {
            this.connectWebSocket();
        }
    }
}
```

---

## Frontend: WebSocket Integration

```javascript
connectWebSocket() {
    const wsUrl = this.getAttribute('data-ws-url') || 'wss://localhost/ws/roulette';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
        this.wsState.connected = true;
        this.authenticate();
    };

    this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleWebSocketMessage(message);
    };

    this.ws.onclose = () => {
        this.wsState.connected = false;
        this.wsState.authenticated = false;
        this.scheduleReconnect();
    };
}

authenticate() {
    const token = localStorage.getItem('jwt_token') || this.getAttribute('data-token');
    this.ws.send(JSON.stringify({
        type: 'auth',
        token: token,
    }));
}

handleWebSocketMessage(message) {
    switch (message.type) {
        case 'system.welcome':
            console.log('Connected to roulette server');
            break;

        case 'system.authenticated':
            this.wsState.authenticated = true;
            this.sendCommand('join');
            break;

        case 'roulette.tick':
            this.handleTick(message);
            break;

        case 'roulette.state':
            this.handleState(message);
            break;

        case 'roulette.user_joined':
        case 'roulette.user_left':
            this.wsState.connectedCount = message.connected_count;
            this.updateConnectedCount();
            break;

        case 'roulette.bet_confirmed':
            this.handleBetConfirmed(message);
            break;

        case 'roulette.bet_rejected':
            this.handleBetRejected(message);
            break;

        case 'roulette.spin_result':
            this.handleSpinResult(message);
            break;

        case 'roulette.payout':
            this.handlePayout(message);
            break;

        case 'roulette.chat':
            this.handleChatMessage(message);
            break;
    }
}
```

---

## Frontend: Tick Handler & Auto-Broadcast

```javascript
handleTick(message) {
    this.wsState.spinId = message.spin_id;
    this.wsState.secondsRemaining = message.seconds_remaining;
    this.wsState.phase = message.phase;
    this.wsState.connectedCount = message.connected_count;

    // Update timer display
    this.updateTimer();

    // Update phase indicator
    this.updatePhaseIndicator();

    // Auto-broadcast bets at 5 seconds
    if (message.seconds_remaining <= 5 && !this.betsBroadcasted && this.placements.length > 0) {
        this.broadcastBets();
    }

    // Reset for new spin
    if (message.seconds_remaining === 120 && this.wsState.phase === 'betting') {
        this.betsBroadcasted = false;
        this.resetForNewSpin();
    }
}

broadcastBets() {
    if (this.betsBroadcasted || this.placements.length === 0) return;

    const bets = this.placements.map(p => ({
        type: p.betType,
        key: p.key,
        tokens: p.tokens,
        multiplier: this.chipMultiplier,
    }));

    const totalAmount = this.calculateTotalStake();

    this.sendCommand('broadcast_bets', {
        spin_id: this.wsState.spinId,
        bets: bets,
        total_amount: totalAmount,
    });

    this.betsBroadcasted = true;
}

sendCommand(command, data = {}) {
    if (!this.ws || !this.wsState.authenticated) return;

    this.ws.send(JSON.stringify({
        type: `roulette.command.${command}`,
        user_id: this.userId,
        username: this.username,
        ...data,
    }));
}
```

---

## Frontend: Betting Board Rendering

```javascript
renderBettingBoard() {
    return `
        <div class="betting-board">
            <!-- Zero row -->
            <div class="zero-row">
                <button class="board-cell zero" data-number="0">0</button>
                <button class="board-cell zero" data-number="00">00</button>
            </div>

            <!-- Main grid (3 rows x 12 columns) -->
            <div class="number-grid">
                ${this.renderNumberRows()}
            </div>

            <!-- Bottom bets (dozens, columns) -->
            <div class="bottom-bets">
                <button class="board-cell dozen" data-bet-type="dozen" data-key="1-12">1st 12</button>
                <button class="board-cell dozen" data-bet-type="dozen" data-key="13-24">2nd 12</button>
                <button class="board-cell dozen" data-bet-type="dozen" data-key="25-36">3rd 12</button>
            </div>

            <!-- Outside bets -->
            <div class="outside-bets">
                <button class="board-cell outside" data-bet-type="range" data-key="1-18">1-18</button>
                <button class="board-cell outside" data-bet-type="parity" data-key="even">EVEN</button>
                <button class="board-cell outside red" data-bet-type="color" data-key="red">RED</button>
                <button class="board-cell outside black" data-bet-type="color" data-key="black">BLACK</button>
                <button class="board-cell outside" data-bet-type="parity" data-key="odd">ODD</button>
                <button class="board-cell outside" data-bet-type="range" data-key="19-36">19-36</button>
            </div>
        </div>
    `;
}

renderNumberRows() {
    const rows = [
        [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
        [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
        [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
    ];

    return rows.map((row, rowIndex) => `
        <div class="number-row">
            ${row.map(num => {
                const color = this.getNumberColor(num);
                return `
                    <button class="board-cell number ${color}"
                            data-number="${num}"
                            data-bet-type="straight"
                            data-key="${num}">
                        ${num}
                    </button>
                `;
            }).join('')}
            <button class="board-cell column" data-bet-type="column" data-key="${3 - rowIndex}">2:1</button>
        </div>
    `).join('');
}
```

---

## Frontend: Wheel Canvas Rendering

```javascript
renderWheel() {
    const canvas = this.shadowRoot.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    const sliceAngle = (2 * Math.PI) / this.wheelOrder.length;

    this.wheelOrder.forEach((number, index) => {
        const startAngle = index * sliceAngle - Math.PI / 2;
        const endAngle = startAngle + sliceAngle;

        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();

        // Fill with color
        const color = this.getNumberColor(number);
        ctx.fillStyle = color === 'red' ? '#dc2626' :
                        color === 'black' ? '#1f2937' : '#16a34a';
        ctx.fill();
        ctx.stroke();

        // Draw number
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(number, radius * 0.75, 4);
        ctx.restore();
    });
}

spinWheelAnimation(winningNumber) {
    const canvas = this.shadowRoot.getElementById('wheelCanvas');
    const winningIndex = this.wheelOrder.indexOf(winningNumber);
    const sliceAngle = 360 / this.wheelOrder.length;

    // Calculate final rotation (multiple full rotations + landing position)
    const fullRotations = 5 + Math.random() * 3;
    const landingAngle = winningIndex * sliceAngle;
    const totalRotation = fullRotations * 360 + (360 - landingAngle);

    // Animate with easing
    canvas.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
    canvas.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(() => {
        canvas.style.transition = 'none';
        canvas.style.transform = `rotate(${360 - landingAngle}deg)`;
    }, 5000);
}
```

---

## Frontend: Chip Selector

```javascript
renderChipSelector() {
    const chips = [1, 2, 5, 10, 20, 30, 50, 100, 200, 500];

    return `
        <div class="chip-selector">
            ${chips.map(value => `
                <button class="chip ${this.selectedChip === value ? 'selected' : ''}"
                        data-chip-value="${value}"
                        style="--chip-color: ${this.getChipColor(value)}">
                    ${value}
                </button>
            `).join('')}
        </div>
    `;
}

getChipColor(value) {
    const colors = {
        1: '#ef4444',    // Red
        2: '#f97316',    // Orange
        5: '#eab308',    // Yellow
        10: '#22c55e',   // Green
        20: '#3b82f6',   // Blue
        30: '#8b5cf6',   // Purple
        50: '#ec4899',   // Pink
        100: '#14b8a6',  // Teal
        200: '#6366f1',  // Indigo
        500: '#000000',  // Black
    };
    return colors[value] || '#6b7280';
}
```

---

## Frontend: History Bar

```javascript
renderHistoryBar() {
    return `
        <div class="history-bar">
            <span class="history-label">Last ${this.lastResults.length} spins:</span>
            <div class="history-results">
                ${this.lastResults.slice(0, 20).map(result => `
                    <span class="history-item ${result.color}">
                        ${result.number}
                    </span>
                `).join('')}
            </div>
        </div>
    `;
}

updateHistoryBar(spinResult) {
    this.lastResults.unshift({
        number: spinResult.winning_number,
        color: spinResult.winning_color,
    });

    if (this.lastResults.length > 20) {
        this.lastResults.pop();
    }

    this.renderHistoryBar();
}
```

---

## REST API Endpoints (Single-Player)

### Place Bet (Validation Only)
```
POST /api/v1/roulette/place-bet
Authorization: Bearer <token>

Request:
{
  "bets": [
    { "type": "straight", "tokens": 10, "multiplier": 100, "key": "17" }
  ]
}

Response:
{
  "valid": true,
  "total_stake": 1000,
  "balance": 50000
}
```

### Spin (Execute)
```
POST /api/v1/roulette/spin
Authorization: Bearer <token>

Request:
{
  "bets": [
    { "type": "straight", "tokens": 10, "multiplier": 100, "key": "17" }
  ]
}

Response:
{
  "result": {
    "number": "17",
    "color": "black",
    "parity": "odd"
  },
  "total_stake": 1000,
  "payout": 36000,
  "net_result": 35000,
  "new_balance": 85000,
  "bet_results": [
    { "type": "straight", "key": "17", "amount": 1000, "won": true, "payout": 36000 }
  ]
}
```

### Get History
```
GET /api/v1/roulette/history?page=1&per_page=20
Authorization: Bearer <token>

Response:
{
  "items": [...],
  "total": 150,
  "page": 1,
  "per_page": 20
}
```

### Get Stats
```
GET /api/v1/roulette/stats
Authorization: Bearer <token>

Response:
{
  "total_spins": 150,
  "total_wagered": 150000,
  "total_won": 145000,
  "net_result": -5000,
  "biggest_win": 36000,
  "favorite_bet": "color"
}
```

---

## Build Commands

```bash
# Development build
cd blazing_sun/src/frontend/games/ROULETTE
npm install
npm run build

# Watch mode
npm run dev

# Production build
npm run build:prod

# After build, bump assets_version in .env to bust cache
```

---

## vite.config.js

```javascript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: resolve(__dirname, '../../../resources/js/games/ROULETTE'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.js'),
      output: {
        entryFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return '../../../css/ROULETTE/style.css'
          }
          return '[name][extname]'
        }
      }
    },
    cssCodeSplit: false
  }
})
```

---

## Testing Checklist

### Single-Player Mode
- [ ] Place valid bets (all bet types)
- [ ] Place invalid bets (validation errors)
- [ ] Spin with sufficient balance
- [ ] Spin with insufficient balance
- [ ] Verify payout calculations (all bet types)
- [ ] Verify history saves correctly
- [ ] Verify statistics update

### Multiplayer Mode
- [ ] WebSocket connection establishes
- [ ] JWT authentication works
- [ ] Join event received by all
- [ ] Tick events received every second
- [ ] Phase transitions correct (betting → animation → spinning → payout)
- [ ] Bets auto-broadcast at 5 seconds
- [ ] Bet confirmation received
- [ ] Bet rejection on insufficient balance
- [ ] Bet rejection after betting closes
- [ ] Spin result broadcast to all
- [ ] Individual payout received
- [ ] Balance updates correctly
- [ ] History bar updates
- [ ] Chat messages work
- [ ] Chat opt-out works
- [ ] Reconnection restores state
- [ ] Multiple concurrent players

### Frontend
- [ ] Wheel renders correctly
- [ ] Chip selector works
- [ ] Betting board clickable
- [ ] Chips display on board
- [ ] Chip removal works
- [ ] Total stake displays
- [ ] Timer displays correctly
- [ ] Wheel spin animation
- [ ] Result highlight
- [ ] Payout display
- [ ] History bar renders

---

## Constants Reference

```rust
// roulette_types.rs
pub const CYCLE_DURATION_SECONDS: u32 = 120;
pub const BLOCK_BETS_AT_SECONDS: u32 = 5;
pub const HISTORY_BAR_SIZE: usize = 20;
pub const BALANCE_TO_COIN_RATIO: i64 = 1000;

// roulette.rs - Bet payouts
pub const PAYOUT_STRAIGHT: i64 = 35;
pub const PAYOUT_SPLIT: i64 = 17;
pub const PAYOUT_STREET: i64 = 11;
pub const PAYOUT_CORNER: i64 = 8;
pub const PAYOUT_LINE: i64 = 5;
pub const PAYOUT_BASKET: i64 = 6;
pub const PAYOUT_COLUMN: i64 = 2;
pub const PAYOUT_DOZEN: i64 = 2;
pub const PAYOUT_COLOR: i64 = 1;
pub const PAYOUT_PARITY: i64 = 1;
pub const PAYOUT_RANGE: i64 = 1;
```
