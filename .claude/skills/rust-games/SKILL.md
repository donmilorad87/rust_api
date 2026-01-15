---
name: rust-games
description: Rust backend game development patterns. Covers game types, command handlers, MongoDB history, and state management.
invocable: false
agent: game-developer
---

# Rust Game Development Skill

This skill provides knowledge about Rust backend patterns for game development in the Blazing Sun project.

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
├── bigger_dice.rs          # Bigger Dice game logic
├── mongodb_games.rs        # MongoDB client for game history
└── {new_game}.rs          # New game logic module
```

---

## Core Types

### GameType Enum

Add new game types to this enum:

```rust
// In types.rs
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GameType {
    BiggerDice,
    // Add new games here
    Chess,
    Poker,
}

impl GameType {
    pub fn as_str(&self) -> &'static str {
        match self {
            GameType::BiggerDice => "bigger_dice",
            GameType::Chess => "chess",
            GameType::Poker => "poker",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "bigger_dice" => Some(GameType::BiggerDice),
            "chess" => Some(GameType::Chess),
            "poker" => Some(GameType::Poker),
            _ => None,
        }
    }

    pub fn win_score(&self) -> i32 {
        match self {
            GameType::BiggerDice => 10,
            GameType::Chess => 1,  // Checkmate wins
            GameType::Poker => 100, // Chips target
        }
    }

    pub fn max_players(&self) -> usize {
        match self {
            GameType::BiggerDice => 2,
            GameType::Chess => 2,
            GameType::Poker => 8,
        }
    }

    pub fn min_players(&self) -> usize {
        match self {
            GameType::BiggerDice => 2,
            GameType::Chess => 2,
            GameType::Poker => 2,
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
    pub spectators: Vec<i64>,
    pub current_turn: Option<i64>,
    pub turn_number: i32,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub winner_id: Option<i64>,
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,  // bcrypt hash
    pub is_password_protected: bool,    // UI flag
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
    pub joined_at: DateTime<Utc>,
}
```

---

## GameCommand Enum

Add new game commands to this enum:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameCommand {
    // Generic room commands
    #[serde(rename = "create_room")]
    CreateRoom { ... },

    #[serde(rename = "join_room")]
    JoinRoom { ... },

    #[serde(rename = "leave_room")]
    LeaveRoom { ... },

    // Bigger Dice specific
    #[serde(rename = "bigger_dice.roll")]
    BiggerDiceRoll { user_id: i64, room_id: String, socket_id: String },

    // Add new game commands
    #[serde(rename = "chess.move")]
    ChessMove {
        user_id: i64,
        room_id: String,
        socket_id: String,
        from: String,
        to: String,
    },
}
```

---

## GameEvent Enum

Add new game events to this enum:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameEvent {
    // Generic events
    #[serde(rename = "room_created")]
    RoomCreated { ... },

    #[serde(rename = "lobby_joined")]
    LobbyJoined { ... },

    #[serde(rename = "game_ended")]
    GameEnded { ... },

    #[serde(rename = "error")]
    Error { code: String, message: String, socket_id: String },

    // Bigger Dice specific
    #[serde(rename = "bigger_dice.rolled")]
    BiggerDiceRolled { ... },

    // Add new game events
    #[serde(rename = "chess.moved")]
    ChessMoved {
        room_id: String,
        player_id: i64,
        from: String,
        to: String,
        piece: String,
        is_check: bool,
        is_checkmate: bool,
    },
}

impl GameEvent {
    /// Get the event type name for Kafka routing
    pub fn event_type_name(&self) -> &'static str {
        match self {
            GameEvent::RoomCreated { .. } => "room_created",
            GameEvent::LobbyJoined { .. } => "lobby_joined",
            GameEvent::GameEnded { .. } => "game_ended",
            GameEvent::Error { .. } => "error",
            GameEvent::BiggerDiceRolled { .. } => "bigger_dice.rolled",
            // Add new mappings
            GameEvent::ChessMoved { .. } => "chess.moved",
        }
    }
}
```

---

## Game Command Handler

**Location**: `blazing_sun/src/bootstrap/events/handlers/games.rs`

```rust
pub struct GameCommandHandler {
    db: Arc<Mutex<Pool<Postgres>>>,
    mongodb: Option<Arc<Database>>,
    producer: Option<Arc<EventProducer>>,
    rooms: Arc<Mutex<HashMap<String, GameRoom>>>,
    // Game-specific transient state
    round_states: Arc<Mutex<HashMap<String, BiggerDiceRoundState>>>,
}

#[async_trait]
impl EventHandler for GameCommandHandler {
    async fn handle(&self, event: &str) -> Result<(), EventHandlerError> {
        let envelope: EventEnvelope = serde_json::from_str(event)?;

        // Extract payload
        let payload = &envelope.payload;

        match envelope.event_type.as_str() {
            // Generic room commands
            "games.command.create_room" => {
                self.handle_create_room(&envelope, payload).await
            }
            "games.command.join_room" => {
                self.handle_join_room(&envelope, payload).await
            }

            // Game-specific commands
            "games.command.bigger_dice.roll" => {
                self.handle_bigger_dice_roll(&envelope, payload).await
            }
            "games.command.chess.move" => {
                self.handle_chess_move(&envelope, payload).await
            }

            _ => {
                warn!("Unknown game command: {}", envelope.event_type);
                Ok(())
            }
        }
    }
}
```

---

## Creating a New Game Module

### Step 1: Create Game Logic Module

Create `blazing_sun/src/app/games/{game_name}.rs`:

```rust
//! Chess game logic

use super::types::{GamePlayer, GameRoom, RoomStatus};
use std::collections::HashMap;

/// Chess-specific game state (transient, stored in memory)
#[derive(Debug, Clone)]
pub struct ChessState {
    pub board: [[Option<ChessPiece>; 8]; 8],
    pub current_player: i64,
    pub move_history: Vec<ChessMove>,
    pub is_check: bool,
    pub is_checkmate: bool,
}

#[derive(Debug, Clone)]
pub struct ChessPiece {
    pub piece_type: PieceType,
    pub color: PieceColor,
}

#[derive(Debug, Clone)]
pub enum PieceType {
    King, Queen, Rook, Bishop, Knight, Pawn,
}

#[derive(Debug, Clone)]
pub enum PieceColor {
    White, Black,
}

#[derive(Debug, Clone)]
pub struct ChessMove {
    pub from: (usize, usize),
    pub to: (usize, usize),
    pub piece: ChessPiece,
    pub captured: Option<ChessPiece>,
}

impl ChessState {
    pub fn new(player1_id: i64, player2_id: i64) -> Self {
        Self {
            board: Self::initial_board(),
            current_player: player1_id, // White goes first
            move_history: Vec::new(),
            is_check: false,
            is_checkmate: false,
        }
    }

    fn initial_board() -> [[Option<ChessPiece>; 8]; 8] {
        // Set up initial chess position
        // ... implementation
        [[None; 8]; 8]
    }

    pub fn is_valid_move(&self, from: (usize, usize), to: (usize, usize)) -> bool {
        // Validate move according to chess rules
        // ... implementation
        true
    }

    pub fn make_move(&mut self, from: (usize, usize), to: (usize, usize)) -> Option<ChessMove> {
        if !self.is_valid_move(from, to) {
            return None;
        }

        // Execute move
        // ... implementation

        None
    }

    pub fn check_game_over(&self) -> Option<i64> {
        // Return winner_id if game is over
        if self.is_checkmate {
            // Return opposite player
        }
        None
    }
}
```

### Step 2: Export Module

In `blazing_sun/src/app/games/mod.rs`:

```rust
pub mod types;
pub mod bigger_dice;
pub mod mongodb_games;
pub mod chess;  // Add new module
```

### Step 3: Add Handler Methods

In `blazing_sun/src/bootstrap/events/handlers/games.rs`:

```rust
impl GameCommandHandler {
    /// Handle chess move command
    async fn handle_chess_move(
        &self,
        envelope: &EventEnvelope,
        payload: &serde_json::Value,
    ) -> Result<(), EventHandlerError> {
        let user_id = Self::parse_user_id(payload.get("user_id"))
            .ok_or_else(|| EventHandlerError::Fatal("Missing user_id".to_string()))?;
        let room_id = payload.get("room_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| EventHandlerError::Fatal("Missing room_id".to_string()))?;
        let socket_id = payload.get("socket_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let from = payload.get("from")
            .and_then(|v| v.as_str())
            .ok_or_else(|| EventHandlerError::Fatal("Missing from".to_string()))?;
        let to = payload.get("to")
            .and_then(|v| v.as_str())
            .ok_or_else(|| EventHandlerError::Fatal("Missing to".to_string()))?;

        // Get room
        let room = self.get_room(room_id).await?
            .ok_or_else(|| EventHandlerError::Fatal("Room not found".to_string()))?;

        // Verify player's turn
        if room.current_turn != Some(user_id) {
            let error_event = GameEvent::Error {
                code: "not_your_turn".to_string(),
                message: "It's not your turn".to_string(),
                socket_id,
            };
            self.publish_game_event(error_event, Audience::user(user_id)).await?;
            return Ok(());
        }

        // Process move (implement game logic)
        // ...

        // Publish move event
        let event = GameEvent::ChessMoved {
            room_id: room_id.to_string(),
            player_id: user_id,
            from: from.to_string(),
            to: to.to_string(),
            piece: "pawn".to_string(),  // From game state
            is_check: false,
            is_checkmate: false,
        };

        self.publish_game_event(event, Audience::room(room_id)).await?;

        Ok(())
    }
}
```

---

## MongoDB Game History

Games are saved to MongoDB after completion for analytics and replay.

### GameHistory Structure

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameHistory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub room_id: String,
    pub room_name: String,
    pub game_type: GameType,
    pub players: Vec<GameHistoryPlayer>,
    pub winner_id: Option<i64>,
    pub duration_seconds: i64,
    pub turns: Vec<GameTurn>,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameTurn {
    pub turn_number: i32,
    pub player_id: i64,
    pub action: serde_json::Value,  // Game-specific action data
    pub timestamp: DateTime<Utc>,
}
```

### Saving Game History

```rust
async fn save_game_history(&self, room: &GameRoom) -> Result<(), EventHandlerError> {
    let Some(mongodb) = &self.mongodb else {
        warn!("MongoDB not available for game history");
        return Ok(());
    };

    let history = GameHistory {
        id: None,
        room_id: room.room_id.clone(),
        room_name: room.room_name.clone(),
        game_type: room.game_type.clone(),
        players: room.players.iter().map(|p| GameHistoryPlayer {
            user_id: p.user_id,
            username: p.username.clone(),
            final_score: p.score,
            is_winner: room.winner_id == Some(p.user_id),
        }).collect(),
        winner_id: room.winner_id,
        duration_seconds: room.finished_at
            .map(|f| f.signed_duration_since(room.started_at.unwrap_or_else(Utc::now)).num_seconds())
            .unwrap_or(0),
        turns: vec![],  // Populate from game state
        started_at: room.started_at.unwrap_or_else(Utc::now),
        finished_at: room.finished_at.unwrap_or_else(Utc::now),
    };

    let client = MongoGameClient::new(mongodb.clone());
    client.save_game(history).await?;

    Ok(())
}
```

---

## Database: game_rooms Table

Active rooms are stored in PostgreSQL for persistence:

```sql
CREATE TABLE game_rooms (
    room_id VARCHAR(36) PRIMARY KEY,
    room_name VARCHAR(100) NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    host_id BIGINT NOT NULL,
    players JSONB NOT NULL DEFAULT '[]',
    lobby JSONB NOT NULL DEFAULT '[]',
    banned_users BIGINT[] NOT NULL DEFAULT '{}',
    spectators BIGINT[] NOT NULL DEFAULT '{}',
    current_turn BIGINT,
    turn_number INTEGER NOT NULL DEFAULT 0,
    password_hash VARCHAR(100),
    is_password_protected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    winner_id BIGINT,
    CONSTRAINT valid_status CHECK (status IN ('waiting', 'in_progress', 'finished', 'abandoned'))
);

CREATE INDEX idx_game_rooms_room_name ON game_rooms(room_name);
CREATE INDEX idx_game_rooms_status ON game_rooms(status);
CREATE INDEX idx_game_rooms_host_id ON game_rooms(host_id);
```

---

## Best Practices

1. **Validate turns**: Always check if it's the player's turn before processing actions
2. **Handle disconnections**: Mark players as disconnected, allow rejoin within timeout
3. **Store game state**: Use PostgreSQL for room state, MongoDB for history
4. **Use Kafka for events**: Never directly call ws_gateway - always publish to Kafka
5. **Error events**: Always include socket_id in error events for routing
6. **Bounded loops**: Follow NASA Power of 10 - use explicit loop bounds
7. **Short functions**: Keep handler methods under 60 lines
8. **No recursion**: Use iteration instead of recursion for game logic

---

## Adding a New Game Checklist

1. [ ] Add `GameType` variant in `types.rs`
2. [ ] Add game-specific `GameCommand` variants
3. [ ] Add game-specific `GameEvent` variants
4. [ ] Update `event_type_name()` method
5. [ ] Create game logic module (`{game_name}.rs`)
6. [ ] Export module in `games/mod.rs`
7. [ ] Add command handlers in `games.rs`
8. [ ] Add event handlers in ws_gateway `server/mod.rs`
9. [ ] Add client message types in ws_gateway `protocol.rs`
10. [ ] Add server message types in ws_gateway `protocol.rs`
11. [ ] Create frontend game component
12. [ ] Create Tera template
13. [ ] Add web route
14. [ ] Build and test
