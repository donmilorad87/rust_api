---
name: rust-games
description: Rust backend game development patterns. Covers game types, command handlers, MongoDB history, chat system, spectators, and payment integration.
invocable: false
agent: game-developer
---

# Rust Game Development Skill

This skill provides knowledge about Rust backend patterns for game development in the Blazing Sun project.

**For concrete examples**, see the **bigger-dice** skill which contains the complete BIGGER_DICE reference implementation.

## Project Context

**Always read these files before starting work:**
- @blazing_sun/CLAUDE.md - Full application documentation
- @CLAUDE.md - Infrastructure documentation

---

## Game Code Structure

```
blazing_sun/src/app/games/
├── mod.rs                  # Module exports
├── types.rs                # Shared types (GameRoom, GameCommand, GameEvent, etc.)
├── bigger_dice.rs          # Reference: Bigger Dice game logic
├── mongodb_games.rs        # MongoDB client for game history
└── {new_game}.rs          # New game logic module

blazing_sun/src/bootstrap/events/handlers/
└── games.rs               # Game command handler (3500+ lines)
```

---

## Core Types

### GameType Enum

Add new game types to this enum:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GameType {
    BiggerDice,
    // Add new games here
    NewGame,
}

impl GameType {
    pub fn as_str(&self) -> &'static str {
        match self {
            GameType::BiggerDice => "bigger_dice",
            GameType::NewGame => "new_game",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "bigger_dice" => Some(GameType::BiggerDice),
            "new_game" => Some(GameType::NewGame),
            _ => None,
        }
    }

    pub fn win_score(&self) -> i32 {
        match self {
            GameType::BiggerDice => 10,
            GameType::NewGame => /* your win condition */,
        }
    }

    pub fn max_players(&self) -> usize {
        match self {
            GameType::BiggerDice => 2,
            GameType::NewGame => /* max players */,
        }
    }

    pub fn min_players(&self) -> usize {
        match self {
            GameType::BiggerDice => 2,
            GameType::NewGame => /* min players */,
        }
    }

    pub fn entry_fee_cents(&self) -> i64 {
        match self {
            GameType::BiggerDice => 1000,
            GameType::NewGame => /* fee in cents */,
        }
    }
}
```

### GameRoom Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRoom {
    pub room_id: String,
    pub room_name: String,
    pub game_type: GameType,
    pub status: RoomStatus,
    pub host_id: i64,
    pub players: Vec<GamePlayer>,
    pub lobby: Vec<GamePlayer>,        // Players waiting to be selected
    pub banned_users: Vec<i64>,
    pub spectators: Vec<SpectatorData>, // Full spectator info
    pub muted_users: Vec<i64>,          // Muted in chat
    pub current_turn: Option<i64>,
    pub turn_number: i32,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub winner_id: Option<i64>,
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,  // bcrypt hash
    pub is_password_protected: bool,    // UI flag
    pub max_players: usize,
}

impl GameRoom {
    pub fn is_player(&self, user_id: i64) -> bool {
        self.players.iter().any(|p| p.user_id == user_id)
    }

    pub fn is_spectator(&self, user_id: i64) -> bool {
        self.spectators.iter().any(|s| s.user_id == user_id)
    }

    pub fn is_in_lobby(&self, user_id: i64) -> bool {
        self.lobby.iter().any(|p| p.user_id == user_id)
    }

    pub fn is_muted(&self, user_id: i64) -> bool {
        self.muted_users.contains(&user_id)
    }
}
```

### GamePlayer Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamePlayer {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub score: i32,
    pub is_ready: bool,
    pub is_auto: bool,              // Auto-play enabled (disconnected)
    pub joined_at: DateTime<Utc>,
}
```

### SpectatorData Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpectatorData {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub joined_at: DateTime<Utc>,
}
```

### RoomStatus Enum

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RoomStatus {
    Waiting,    // Lobby phase
    Starting,   // Players selected, about to start
    Playing,    // Game in progress (alias: InProgress)
    Finished,   // Game over
    Abandoned,  // All players left
}
```

---

## Chat System

### ChatChannel Enum

```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ChatChannel {
    Lobby,      // Pre-game, all participants
    Players,    // In-game, players only send (spectators read-only)
    Spectators, // In-game, spectators only
}

impl ChatChannel {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "lobby" => Some(ChatChannel::Lobby),
            "players" => Some(ChatChannel::Players),
            "spectators" => Some(ChatChannel::Spectators),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            ChatChannel::Lobby => "lobby",
            ChatChannel::Players => "players",
            ChatChannel::Spectators => "spectators",
        }
    }
}
```

### Chat Access Rules

| Channel | Who Can Send | Who Can Read |
|---------|--------------|--------------|
| Lobby | All in lobby | All in lobby |
| Players | Players only | Players + Spectators |
| Spectators | Spectators only | Spectators only |

### MongoDB Chat Collection

Chat messages are persisted to MongoDB `game_chat_messages`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub message_id: String,         // UUID for deduplication
    pub room_id: String,
    pub channel: String,            // "lobby" | "players" | "spectators"
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub content: String,
    pub timestamp: DateTime<Utc>,
}
```

### Channel Access Validation

```rust
fn can_read_channel(&self, room: &GameRoom, user_id: i64, channel: &ChatChannel) -> bool {
    match channel {
        ChatChannel::Lobby => {
            room.is_player(user_id) || room.is_spectator(user_id) || room.is_in_lobby(user_id)
        }
        ChatChannel::Players => {
            // Players and spectators can read player chat
            room.is_player(user_id) || room.is_spectator(user_id)
        }
        ChatChannel::Spectators => {
            // Only spectators can read spectator chat
            room.is_spectator(user_id)
        }
    }
}

fn can_send_to_channel(&self, room: &GameRoom, user_id: i64, channel: &ChatChannel) -> bool {
    if room.is_muted(user_id) {
        return false;
    }

    match channel {
        ChatChannel::Lobby => {
            room.status == RoomStatus::Waiting &&
            (room.is_in_lobby(user_id) || room.is_player(user_id))
        }
        ChatChannel::Players => {
            room.status == RoomStatus::Playing && room.is_player(user_id)
        }
        ChatChannel::Spectators => {
            room.status == RoomStatus::Playing && room.is_spectator(user_id)
        }
    }
}
```

---

## Game-Specific State (Transient)

Each game needs its own transient state struct for tracking current round/turn information that isn't persisted to the database.

### Pattern: Game State Struct

```rust
/// Transient state for tracking current round (not persisted)
#[derive(Debug, Clone, Default)]
pub struct {GameName}State {
    // Track player actions this round
    pub actions: HashMap<i64, ActionType>,
    pub action_order: Vec<i64>,           // Order players acted (for tiebreaker)
    pub round_complete: bool,

    // Tiebreaker state (if game has ties)
    pub is_tiebreaker: bool,
    pub tiebreaker_players: Vec<i64>,
    pub tiebreaker_iteration: u32,        // Safety counter
}

impl {GameName}State {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn reset_for_new_round(&mut self) {
        self.actions.clear();
        self.action_order.clear();
        self.round_complete = false;
        self.is_tiebreaker = false;
        self.tiebreaker_players.clear();
        self.tiebreaker_iteration = 0;
    }

    pub fn start_tiebreaker(&mut self, tied_players: Vec<i64>) {
        self.actions.clear();
        self.action_order.clear();
        self.round_complete = false;
        self.is_tiebreaker = true;
        self.tiebreaker_players = tied_players;
        self.tiebreaker_iteration += 1;
    }
}
```

### Storing State in Handler

```rust
pub struct GameCommandHandler {
    db: Arc<Mutex<Pool<Postgres>>>,
    mongodb: Option<Arc<Database>>,
    producer: Option<Arc<EventProducer>>,
    rooms: Arc<Mutex<HashMap<String, GameRoom>>>,
    // Game-specific transient state (add one per game type)
    {game_name}_states: Arc<Mutex<HashMap<String, {GameName}State>>>,
}
```

**See bigger-dice skill for concrete example**: BiggerDiceRoundState

---

## Tiebreaker Pattern

When multiple players tie, implement tiebreaker logic:

### Preserve Action Order

```rust
/// Find winners preserving original action order
fn find_winners(actions: &HashMap<i64, i32>, action_order: &[i64]) -> (i32, Vec<i64>) {
    let max_value = actions.values().copied().max().unwrap_or(0);

    // Preserve original order for consistent tiebreaker ordering
    let winners: Vec<i64> = action_order
        .iter()
        .filter(|&player_id| actions.get(player_id).copied() == Some(max_value))
        .copied()
        .collect();

    (max_value, winners)
}
```

### Safety Limit

```rust
const MAX_TIEBREAKER_ITERATIONS: u32 = 100;

async fn process_round_result(&self, room: &mut GameRoom, state: &mut GameState) {
    let (_, winners) = Self::find_winners(&state.actions, &state.action_order);

    if winners.len() == 1 {
        // Clear winner
        self.award_round_win(room, winners[0]).await?;
        state.reset_for_new_round();
    } else if state.tiebreaker_iteration >= MAX_TIEBREAKER_ITERATIONS {
        // Safety limit - select first player
        warn!("Tiebreaker limit reached");
        self.award_round_win(room, winners[0]).await?;
        state.reset_for_new_round();
    } else {
        // Start tiebreaker with tied players only
        state.start_tiebreaker(winners.clone());
        self.publish_tiebreaker_event(room, winners).await?;
    }
}
```

**See bigger-dice skill for concrete example**: find_highest_rollers, process_round_result

---

## Auto-Player System

When a player disconnects and timeout occurs:

```rust
async fn handle_player_timeout(
    &self,
    room_id: &str,
    user_id: i64,
) -> Result<(), EventHandlerError> {
    let mut rooms = self.rooms.lock().await;
    let room = rooms.get_mut(room_id).ok_or_else(|| {
        EventHandlerError::Fatal("Room not found".to_string())
    })?;

    // Mark player as auto
    if let Some(player) = room.players.iter_mut().find(|p| p.user_id == user_id) {
        player.is_auto = true;
    }

    // Publish event
    let event = GameEvent::PlayerAutoEnabled {
        room_id: room_id.to_string(),
        user_id,
    };
    self.publish_game_event(event, Audience::room(room_id)).await?;

    // If it's their turn, trigger auto-action
    if room.current_turn == Some(user_id) {
        self.trigger_auto_action(room_id, user_id).await?;
    }

    Ok(())
}

async fn trigger_auto_action(
    &self,
    room_id: &str,
    user_id: i64,
) -> Result<(), EventHandlerError> {
    // Generate random/default action for the game
    // Process as normal action
    self.process_action(room_id, user_id, action).await
}
```

---

## Checkout Integration (Payments)

### Entry Fee Deduction

When host selects a player for the game:

```rust
async fn handle_select_player(
    &self,
    room: &mut GameRoom,
    target_user_id: i64,
) -> Result<(), EventHandlerError> {
    let entry_fee = room.game_type.entry_fee_cents();

    // Atomically deduct balance
    let db = self.db.lock().await;
    let result = user_mutations::deduct_balance_if_sufficient(
        &db,
        target_user_id,
        entry_fee,
    ).await;

    match result {
        Ok(new_balance) => {
            // Move player from lobby to players
            if let Some(idx) = room.lobby.iter().position(|p| p.user_id == target_user_id) {
                let player = room.lobby.remove(idx);
                room.players.push(player);
            }

            // Publish payment event to checkout service
            self.publish_participation_paid(room, target_user_id, entry_fee).await?;
        }
        Err(_) => {
            // Insufficient balance - send error to user
            let event = GameEvent::Error {
                code: "insufficient_balance".to_string(),
                message: "Insufficient balance for game entry".to_string(),
                socket_id: String::new(),
            };
            self.publish_game_event(event, Audience::user(target_user_id)).await?;
        }
    }

    Ok(())
}
```

### Prize Distribution

When game ends and winner is determined:

```rust
async fn distribute_prize(
    &self,
    room: &GameRoom,
    winner_id: i64,
) -> Result<(), EventHandlerError> {
    let entry_fee = room.game_type.entry_fee_cents();
    let total_pool = entry_fee * room.players.len() as i64;
    let house_cut = total_pool * 20 / 100;  // 20% house cut
    let prize = total_pool - house_cut;      // 80% to winner

    // Add to winner's balance
    let db = self.db.lock().await;
    user_mutations::add_balance(&db, winner_id, prize).await?;

    // Publish prize event
    self.publish_prize_won(room, winner_id, prize).await?;

    Ok(())
}
```

---

## GameCommand Enum Pattern

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameCommand {
    // Generic room commands (already implemented)
    #[serde(rename = "create_room")]
    CreateRoom { ... },

    #[serde(rename = "join_room")]
    JoinRoom { ... },

    #[serde(rename = "join_as_spectator")]
    JoinAsSpectator { user_id: i64, room_name: String, socket_id: String },

    // Add game-specific commands with pattern: {game_name}.{action}
    #[serde(rename = "{game_name}.{action}")]
    {GameName}{Action} {
        user_id: i64,
        room_id: String,
        socket_id: String,
        // action-specific fields
    },
}
```

---

## GameEvent Enum Pattern

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameEvent {
    // Generic events (already implemented)
    #[serde(rename = "room_created")]
    RoomCreated { ... },

    #[serde(rename = "game_ended")]
    GameEnded { room_id: String, winner_id: i64, final_scores: HashMap<String, i32> },

    // Add game-specific events with pattern: {game_name}.{event}
    #[serde(rename = "{game_name}.{event}")]
    {GameName}{Event} {
        room_id: String,
        // event-specific fields
    },
}

impl GameEvent {
    pub fn event_type_name(&self) -> &'static str {
        match self {
            // Generic
            GameEvent::RoomCreated { .. } => "room_created",
            GameEvent::GameEnded { .. } => "game_ended",
            // Game-specific
            GameEvent::{GameName}{Event} { .. } => "{game_name}.{event}",
        }
    }
}
```

---

## Audience Types for Publishing

```rust
pub enum AudienceType {
    User,       // Single user (errors, private state)
    Users,      // Multiple users by ID
    Room,       // All in room (players + spectators)
    Players,    // Players only (player chat)
    Spectators, // Spectators only (spectator chat)
    Broadcast,  // All connected users (room list)
}

pub struct Audience {
    pub audience_type: AudienceType,
    pub user_ids: Vec<String>,
    pub room_id: Option<String>,
    pub game_id: Option<String>,
}

impl Audience {
    pub fn user(user_id: i64) -> Self {
        Self {
            audience_type: AudienceType::User,
            user_ids: vec![user_id.to_string()],
            room_id: None,
            game_id: None,
        }
    }

    pub fn room(room_id: &str) -> Self {
        Self {
            audience_type: AudienceType::Room,
            user_ids: vec![],
            room_id: Some(room_id.to_string()),
            game_id: None,
        }
    }

    pub fn players(room_id: &str) -> Self {
        Self {
            audience_type: AudienceType::Players,
            user_ids: vec![],
            room_id: Some(room_id.to_string()),
            game_id: None,
        }
    }

    pub fn spectators(room_id: &str) -> Self {
        Self {
            audience_type: AudienceType::Spectators,
            user_ids: vec![],
            room_id: Some(room_id.to_string()),
            game_id: None,
        }
    }
}
```

---

## MongoDB Game History

### GameHistory Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameHistory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub room_id: String,
    pub room_name: String,
    pub game_type: String,
    pub players: Vec<GameHistoryPlayer>,
    pub winner_id: Option<i64>,
    pub duration_seconds: i64,
    pub turns: Vec<GameTurn>,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameHistoryPlayer {
    pub user_id: i64,
    pub username: String,
    pub final_score: i32,
    pub is_winner: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameTurn {
    pub turn_number: i32,
    pub player_id: i64,
    pub action: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}
```

---

## Best Practices

1. **Validate turns**: Always check `room.current_turn == Some(user_id)` before processing
2. **Handle disconnections**: Mark as auto, allow rejoin within timeout window
3. **Chat validation**: Check `can_send_to_channel()` before saving/publishing
4. **Atomic balance operations**: Use `deduct_balance_if_sufficient()` for entry fees
5. **Preserve action order**: Store order for consistent tiebreaker results
6. **Safety limits**: Use `MAX_TIEBREAKER_ITERATIONS` to prevent infinite loops
7. **Error events**: Always include `socket_id` for routing to correct client
8. **Log Kafka failures**: Warn, don't fail the request
9. **MongoDB optional**: Check `if let Some(mongodb) = &self.mongodb` before operations
10. **Bounded loops**: Follow NASA Power of 10 - explicit loop bounds

---

## Adding a New Game Checklist

### Backend Types
- [ ] Add `GameType` variant in `types.rs`
- [ ] Implement `entry_fee_cents()`, `win_score()`, `max_players()`, `min_players()`
- [ ] Add game-specific `GameCommand` variants
- [ ] Add game-specific `GameEvent` variants
- [ ] Update `event_type_name()` mapping

### Game Logic Module
- [ ] Create `{game_name}.rs` in `app/games/`
- [ ] Define `{GameName}State` struct (transient)
- [ ] Implement game rules and validation
- [ ] Implement tiebreaker logic (if applicable)
- [ ] Export module in `mod.rs`

### Command Handler
- [ ] Add command handlers in `games.rs`
- [ ] Implement turn validation
- [ ] Implement score tracking
- [ ] Implement game end detection
- [ ] Add MongoDB history saving
- [ ] Add checkout integration (entry fees, prizes)

### Kafka Topics
- [ ] Add payment topics in `topics.rs` (if paid game)
  - `{game_name}.participation_payed`
  - `{game_name}.win_prize`
