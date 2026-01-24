---
name: tic-tac-toe
description: TIC_TAC_TOE game reference implementation. Complete patterns for Tic Tac Toe with best-of-9 matches, 60-second turn timer, disconnection handling, and payment integration.
invocable: false
agent: game-developer
---

# TIC_TAC_TOE Reference Implementation

This skill documents the complete TIC_TAC_TOE game implementation as a reference for creating new games.

## File Locations

### Frontend
```
blazing_sun/src/frontend/games/TIC_TAC_TOE/
├── package.json
├── vite.config.js
└── src/
    ├── main.js           # Entry point, registers <tic-tac-toe> web component
    ├── TicTacToe.js      # Main component
    └── styles/
        └── main.scss     # SCSS styles
```

### Backend
```
blazing_sun/src/app/games/
├── tic_tac_toe.rs        # Game logic, match state, win detection
└── types.rs              # GameCommand, GameEvent variants for TicTacToe

blazing_sun/src/bootstrap/events/handlers/
└── games.rs              # handle_tic_tac_toe_move(), disconnect handling
```

### WebSocket Gateway
```
ws_gateway/src/
├── protocol.rs           # ClientMessage::TicTacToeMove, ServerMessage variants
└── server/mod.rs         # Event routing for tic_tac_toe events
```

### Template & Route
```
blazing_sun/src/resources/views/web/tic_tac_toe.html
blazing_sun/src/routes/web.rs                        # /games/tic-tac-toe route
blazing_sun/src/app/http/web/controllers/pages.rs    # tic_tac_toe_lobby, tic_tac_toe_game
```

### Compiled Assets
```
blazing_sun/src/resources/js/games/TIC_TAC_TOE/app.js
blazing_sun/src/resources/css/games/TIC_TAC_TOE/style.css
```

---

## Game Rules

| Rule | Value |
|------|-------|
| **Players** | 2 (exactly) |
| **Match Win** | First to 5 game wins |
| **First Game** | Random player gets X, X goes first |
| **Turn Order** | Reverses after EVERY game (win or draw) |
| **Draw Handling** | No points, move to next game with reversed order |
| **Turn Timer** | 60 seconds per move |
| **Timer Expire** | Player forfeits that game (opponent +1 point) |
| **Entry Fee** | 1000 coins per player (2000 pool) |
| **Winner Prize** | 60% of pool = 1200 coins |

### Disconnection Rules

| Scenario | Result |
|----------|--------|
| One player disconnects 10+ min | Remaining player **wins** (1200 coins) |
| Both players disconnect 10+ min | Both refunded **990 coins** each (10 coin penalty) |
| Player reconnects within 10 min | Game resumes, timer restarts |

### Key Differences from BIGGER_DICE

- NO auto-playing (game pauses on disconnect)
- NO rematch (room closes after match)
- NO kick system
- Longer turn timer (60s vs 5s)
- Best-of-9 format (first to 5 wins)

---

## Kafka Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `tic_tac_toe.participation_payed` | blazing_sun → checkout | Entry fee deducted when player selected |
| `tic_tac_toe.win_prize` | blazing_sun → checkout | Prize awarded to winner |
| `tic_tac_toe.match_cancelled` | blazing_sun → checkout | Both disconnected, refund both |

### Participation Event Payload

```json
{
  "event_type": "game.participation.deducted",
  "event_id": "uuid",
  "timestamp": "2024-01-20T10:30:01Z",
  "user_id": 123,
  "amount_cents": 100000,
  "game_type": "tic_tac_toe",
  "room_id": "room-abc123",
  "room_name": "My Game",
  "username": "Player1",
  "description": "PAY TIC TAC TOE GAME"
}
```

### Prize Event Payload

```json
{
  "event_type": "game.prize.won",
  "event_id": "uuid",
  "timestamp": "2024-01-20T10:35:00Z",
  "user_id": 123,
  "amount_cents": 120000,
  "game_type": "tic_tac_toe",
  "room_id": "room-abc123",
  "room_name": "My Game",
  "username": "Player1",
  "total_players": 2,
  "description": "WON TIC TAC TOE MATCH"
}
```

### Match Cancelled Event Payload

```json
{
  "event_type": "game.match.cancelled",
  "event_id": "uuid",
  "timestamp": "2024-01-20T10:40:00Z",
  "game_type": "tic_tac_toe",
  "room_id": "room-abc123",
  "room_name": "My Game",
  "refund_amount_cents": 99000,
  "player_ids": [123, 456],
  "reason": "both_players_disconnected"
}
```

---

## WebSocket Commands (Client → Server)

```javascript
// Make a move on the board
{
  type: 'games.command.tic_tac_toe.move',
  room_id: 'uuid',
  position: 4  // 0-8, representing 3x3 grid
}
```

### Board Position Mapping

```
 0 | 1 | 2
-----------
 3 | 4 | 5
-----------
 6 | 7 | 8
```

---

## WebSocket Events (Server → Client)

```javascript
// Move made
{
  type: 'games.event.tic_tac_toe.moved',
  room_id: 'uuid',
  player_id: 123,
  position: 4,
  mark: 'X',
  board: ['X', null, 'O', null, 'X', null, null, null, 'O'],
  next_turn: 456
}

// Single game result (within match)
{
  type: 'games.event.tic_tac_toe.game_result',
  room_id: 'uuid',
  winner_id: 123,  // or null for draw
  winning_line: [0, 4, 8],  // or null for draw
  is_draw: false,
  scores: { "123": 3, "456": 2 },
  game_number: 5
}

// Match ended (first to 5 wins)
{
  type: 'games.event.tic_tac_toe.match_ended',
  room_id: 'uuid',
  winner_id: 123,
  final_scores: { "123": 5, "456": 3 },
  prize_cents: 120000
}

// Full state sync (for reconnection)
{
  type: 'games.event.tic_tac_toe.state',
  room_id: 'uuid',
  board: ['X', null, 'O', null, 'X', null, null, null, 'O'],
  player_x_id: 123,
  player_o_id: 456,
  current_turn: 123,
  scores: { "123": 2, "456": 2 },
  game_number: 5,
  move_deadline: "2024-01-20T10:31:00Z"
}

// Turn timeout (player forfeited game)
{
  type: 'games.event.tic_tac_toe.turn_timeout',
  room_id: 'uuid',
  timed_out_player_id: 123,
  winner_id: 456,
  scores: { "123": 2, "456": 3 },
  game_number: 5
}

// Game paused (player disconnected)
{
  type: 'games.event.tic_tac_toe.game_paused',
  room_id: 'uuid',
  disconnected_player_id: 123,
  time_remaining_seconds: 600
}

// Game resumed (player reconnected)
{
  type: 'games.event.tic_tac_toe.game_resumed',
  room_id: 'uuid',
  reconnected_player_id: 123,
  board: ['X', null, 'O', null, 'X', null, null, null, 'O'],
  current_turn: 456,
  move_deadline: "2024-01-20T10:31:00Z"
}

// Match cancelled (both disconnected 10+ min)
{
  type: 'games.event.tic_tac_toe.match_cancelled',
  room_id: 'uuid',
  reason: 'both_players_disconnected',
  refund_cents: 99000
}
```

---

## Backend: TicTacToeMatchState

```rust
pub struct TicTacToeMatchState {
    /// The 3x3 board (None = empty, Some('X') or Some('O'))
    pub board: [Option<char>; 9],

    /// Player assigned X for current game
    pub player_x_id: i64,

    /// Player assigned O for current game
    pub player_o_id: i64,

    /// Current turn player
    pub current_turn: i64,

    /// Match scores (player_id -> wins)
    pub scores: HashMap<i64, i32>,

    /// Current game number in match (1-9)
    pub game_number: i32,

    /// Who went first in current game (for reversal tracking)
    pub first_player_this_game: i64,

    /// Deadline for current move (60 second timer)
    pub move_deadline: Option<DateTime<Utc>>,

    /// Tracks when each player disconnected
    pub disconnected_at: HashMap<i64, DateTime<Utc>>,
}
```

### Key Methods

```rust
impl TicTacToeMatchState {
    /// Initialize a new match between two players
    pub fn initialize(player1_id: i64, player2_id: i64) -> Self;

    /// Make a move on the board
    pub fn make_move(&mut self, player_id: i64, position: u8) -> Result<(), String>;

    /// Check for winner (returns winning line if any)
    pub fn check_winner(&self) -> Option<(i64, [usize; 3])>;

    /// Check if board is full (draw)
    pub fn is_board_full(&self) -> bool;

    /// Start next game in match (swap X/O, reverse turn order)
    pub fn start_new_game(&mut self);

    /// Pause game when player disconnects
    pub fn pause_game(&mut self, player_id: i64);

    /// Resume game when player reconnects
    pub fn resume_game(&mut self, player_id: i64);

    /// Get opponent player ID
    pub fn get_opponent(&self, player_id: i64) -> i64;

    /// Check if disconnect timeout has expired (10 minutes)
    pub fn is_disconnect_expired(&self, player_id: i64) -> bool;
}
```

---

## Backend: Win Detection

```rust
/// Winning line combinations
const WINNING_LINES: [[usize; 3]; 8] = [
    [0, 1, 2], // Top row
    [3, 4, 5], // Middle row
    [6, 7, 8], // Bottom row
    [0, 3, 6], // Left column
    [1, 4, 7], // Middle column
    [2, 5, 8], // Right column
    [0, 4, 8], // Diagonal TL-BR
    [2, 4, 6], // Diagonal TR-BL
];

pub fn check_winner(&self) -> Option<(i64, [usize; 3])> {
    for line in WINNING_LINES.iter() {
        let [a, b, c] = *line;
        if let (Some(mark_a), Some(mark_b), Some(mark_c)) =
            (self.board[a], self.board[b], self.board[c])
        {
            if mark_a == mark_b && mark_b == mark_c {
                let winner_id = if mark_a == 'X' {
                    self.player_x_id
                } else {
                    self.player_o_id
                };
                return Some((winner_id, *line));
            }
        }
    }
    None
}
```

---

## Backend: Turn Reversal Logic

After each game (win or draw), the turn order reverses:

```rust
pub fn start_new_game(&mut self) {
    // Reset board
    self.board = [None; 9];
    self.game_number += 1;

    // Swap X and O assignments
    std::mem::swap(&mut self.player_x_id, &mut self.player_o_id);

    // The player who went SECOND last game goes FIRST this game
    // (X always goes first, so the new X player goes first)
    self.current_turn = self.player_x_id;
    self.first_player_this_game = self.player_x_id;

    // Reset move deadline
    self.move_deadline = Some(Utc::now() + Duration::seconds(60));
}
```

---

## Frontend: Board UI

```javascript
// State
this.board = Array(9).fill(null);
this.playerX = null;
this.playerO = null;
this.currentTurn = null;
this.scores = {};
this.gameNumber = 1;
this.moveDeadline = null;
this.isGamePaused = false;

// Render board
renderBoard() {
    const cells = this.board.map((mark, index) => `
        <div class="ttt-cell ${mark ? 'filled' : ''} ${mark === 'X' ? 'x-mark' : mark === 'O' ? 'o-mark' : ''}"
             data-index="${index}"
             ${mark ? 'disabled' : ''}>
            ${mark || ''}
        </div>
    `).join('');

    return `
        <div class="ttt-board">
            ${cells}
        </div>
    `;
}

// Handle cell click
handleCellClick(index) {
    // Validate move
    if (this.board[index] !== null) return;
    if (this.currentTurn !== this.myPlayerId) return;
    if (this.isSpectator) return;
    if (this.isGamePaused) return;

    // Send move command
    this.sendCommand('games.command.tic_tac_toe.move', {
        room_id: this.roomId,
        position: index
    });
}
```

---

## Frontend: 60-Second Turn Timer

```javascript
// State
this.turnTimer = null;
this.turnTimeRemaining = 60;

startTurnTimer(deadline) {
    this.stopTurnTimer();

    if (!deadline) return;

    const updateTimer = () => {
        const now = Date.now();
        const remaining = Math.max(0, (new Date(deadline) - now) / 1000);
        this.turnTimeRemaining = remaining;
        this.updateTurnTimerUI();

        if (remaining <= 0) {
            this.stopTurnTimer();
            // Server handles timeout, we just show UI
        }
    };

    updateTimer();
    this.turnTimer = setInterval(updateTimer, 100);
}

stopTurnTimer() {
    if (this.turnTimer) {
        clearInterval(this.turnTimer);
        this.turnTimer = null;
    }
}

updateTurnTimerUI() {
    const timerEl = this.shadowRoot.getElementById('turnTimer');
    if (!timerEl) return;

    const seconds = Math.ceil(this.turnTimeRemaining);
    timerEl.textContent = `${seconds}s`;

    // Warning state under 10 seconds
    if (seconds <= 10) {
        timerEl.classList.add('warning');
    } else {
        timerEl.classList.remove('warning');
    }
}
```

---

## Frontend: Match Score Display

```javascript
renderMatchScore() {
    const player1Score = this.scores[this.players[0]?.user_id] || 0;
    const player2Score = this.scores[this.players[1]?.user_id] || 0;

    return `
        <div class="match-score">
            <div class="match-score__header">
                <span>Best of 9</span>
                <span>First to 5 wins</span>
            </div>
            <div class="match-score__players">
                <div class="match-score__player ${this.currentTurn === this.players[0]?.user_id ? 'active' : ''}">
                    <span class="name">${this.players[0]?.username || 'Player 1'}</span>
                    <span class="mark">${this.getPlayerMark(this.players[0]?.user_id)}</span>
                    <span class="score">${player1Score}</span>
                </div>
                <div class="match-score__vs">vs</div>
                <div class="match-score__player ${this.currentTurn === this.players[1]?.user_id ? 'active' : ''}">
                    <span class="name">${this.players[1]?.username || 'Player 2'}</span>
                    <span class="mark">${this.getPlayerMark(this.players[1]?.user_id)}</span>
                    <span class="score">${player2Score}</span>
                </div>
            </div>
            <div class="match-score__game">
                Game ${this.gameNumber}
            </div>
        </div>
    `;
}
```

---

## Frontend: Winning Line Animation

```javascript
handleGameResult(message) {
    const { winner_id, winning_line, is_draw, scores, game_number } = message;

    // Update scores
    this.scores = scores;
    this.gameNumber = game_number;

    if (!is_draw && winning_line) {
        // Highlight winning line
        this.highlightWinningLine(winning_line);

        // Show winner message
        const winnerName = this.getPlayerName(winner_id);
        this.showGameMessage(`${winnerName} wins this game!`);
    } else {
        // Show draw message
        this.showGameMessage('Draw! No points awarded.');
    }

    // Wait before starting next game
    setTimeout(() => {
        this.resetBoardUI();
    }, 2000);
}

highlightWinningLine(line) {
    const cells = this.shadowRoot.querySelectorAll('.ttt-cell');
    line.forEach(index => {
        cells[index].classList.add('winning');
    });
}
```

---

## Frontend: Disconnection Handling

```javascript
handleGamePaused(message) {
    const { disconnected_player_id, time_remaining_seconds } = message;

    this.isGamePaused = true;
    this.stopTurnTimer();

    const playerName = this.getPlayerName(disconnected_player_id);
    this.showPausedOverlay(playerName, time_remaining_seconds);
}

handleGameResumed(message) {
    this.isGamePaused = false;
    this.hidePausedOverlay();

    // Update state
    this.board = message.board;
    this.currentTurn = message.current_turn;

    // Restart timer
    this.startTurnTimer(message.move_deadline);

    this.renderBoard();
}

showPausedOverlay(playerName, timeRemaining) {
    const overlay = `
        <div class="paused-overlay" id="pausedOverlay">
            <div class="paused-content">
                <div class="paused-icon">⏸️</div>
                <h2>Game Paused</h2>
                <p>${playerName} disconnected</p>
                <p class="countdown">Waiting ${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, '0')}</p>
                <p class="note">Game will continue when they reconnect,<br>or you win if they don't return within 10 minutes.</p>
            </div>
        </div>
    `;

    this.shadowRoot.querySelector('.game-container').insertAdjacentHTML('beforeend', overlay);
}
```

---

## Board CSS

```scss
.ttt-board {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    background: var(--ttt-border);
    padding: 8px;
    border-radius: 12px;
    max-width: 320px;
    margin: 0 auto;
}

.ttt-cell {
    aspect-ratio: 1;
    background: var(--ttt-card-bg);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(.filled) {
        background: rgba(99, 102, 241, 0.1);
    }

    &.x-mark {
        color: var(--ttt-x-color);
    }

    &.o-mark {
        color: var(--ttt-o-color);
    }

    &.winning {
        animation: winning-pulse 0.5s ease-in-out infinite;
        background: rgba(34, 197, 94, 0.2);
    }
}

@keyframes winning-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}
```

---

## Build Commands

```bash
# Development build
cd blazing_sun/src/frontend/games/TIC_TAC_TOE
npm install
npm run build

# Watch mode
npm run dev

# Production build
npm run build:prod

# After build, bump assets_version in .env to bust cache
```

---

## Testing Checklist

- [ ] Create room with/without password
- [ ] Join room as player
- [ ] Join room as spectator
- [ ] Player selection deducts balance (1000 coins)
- [ ] Both players ready starts game
- [ ] Random player gets X, X goes first
- [ ] Make moves, verify board sync
- [ ] 60-second turn timer counts down
- [ ] Timer expire forfeits game to opponent
- [ ] Win game, verify +1 score and turn reversal
- [ ] Draw game, verify no points and turn reversal
- [ ] Win match (5 wins), verify 1200 coin prize
- [ ] Disconnect handling:
  - [ ] One player disconnects: game pauses
  - [ ] Player reconnects within 10 min: game resumes
  - [ ] One player disconnects 10+ min: other wins
  - [ ] Both disconnect 10+ min: both get 990 refund
- [ ] Spectator joins mid-game
- [ ] Chat works in all channels
- [ ] Room closes after match ends

---

## Constants

```rust
// In tic_tac_toe.rs
pub const WIN_SCORE: i32 = 5;                  // First to 5 wins match
pub const TURN_TIMER_SECONDS: i64 = 60;        // 60 second turn timer
pub const DISCONNECT_TIMEOUT_MINUTES: i64 = 10; // 10 min disconnect timeout
pub const ENTRY_FEE_CENTS: i64 = 100000;       // 1000 coins entry fee
pub const WINNING_PERCENTAGE: i64 = 60;        // Winner gets 60% of pool
pub const REFUND_PENALTY_CENTS: i64 = 1000;    // 10 coin penalty on cancel
```
