---
name: bigger-dice
description: BIGGER_DICE game reference implementation. Complete patterns for dice rolling game with tiebreakers, animations, turn timer, and payment integration.
invocable: false
agent: game-developer
---

# BIGGER_DICE Reference Implementation

This skill documents the complete BIGGER_DICE game implementation as a reference for creating new games.

## File Locations

### Frontend
```
blazing_sun/src/frontend/games/BIGGER_DICE/
├── package.json
├── vite.config.js
└── src/
    ├── main.js           # Entry point, registers <bigger-dice> web component
    └── BiggerDice.js     # Main component (7000+ lines)
```

### Backend
```
blazing_sun/src/app/games/
├── bigger_dice.rs        # Game logic, tiebreaker functions
└── types.rs              # GameCommand::BiggerDiceRoll, GameEvent::BiggerDiceRolled, etc.

blazing_sun/src/bootstrap/events/handlers/
└── games.rs              # handle_bigger_dice_roll(), process_round_result()
```

### WebSocket Gateway
```
ws_gateway/src/
├── protocol.rs           # ClientMessage::GameBiggerDiceRoll, ServerMessage variants
└── server/mod.rs         # Event routing for bigger_dice events
```

### Template & Route
```
blazing_sun/src/resources/views/web/bigger_dice.html
blazing_sun/src/routes/web.rs                        # /games/bigger-dice route
```

### Compiled Assets
```
blazing_sun/src/resources/js/games/BIGGER_DICE/app.js
blazing_sun/src/resources/css/games/BIGGER_DICE/style.css
```

---

## Game Rules

- **Players**: 2 players
- **Win Condition**: First to 10 points
- **Rounds**: Each round, both players roll a die (1-6)
- **Scoring**: Higher roll wins 1 point; ties trigger tiebreaker
- **Tiebreaker**: Tied players re-roll until one wins
- **Entry Fee**: $10.00 (1000 cents)
- **Prize**: 80% of pool to winner (20% house cut)

---

## Kafka Topics

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `bigger_dice.participation_payed` | blazing_sun → checkout | Entry fee deducted when player selected |
| `bigger_dice.win_prize` | blazing_sun → checkout | Prize awarded to winner |

### Participation Event Payload

```json
{
  "event_type": "game.participation.deducted",
  "event_id": "uuid",
  "timestamp": "2024-01-20T10:30:01Z",
  "user_id": 123,
  "amount_cents": 1000,
  "game_type": "bigger_dice",
  "room_id": "room-abc123",
  "room_name": "My Game",
  "username": "Player1",
  "description": "PAY BIGGER DICE GAME"
}
```

### Prize Event Payload

```json
{
  "event_type": "game.prize.won",
  "event_id": "uuid",
  "timestamp": "2024-01-20T10:35:00Z",
  "user_id": 123,
  "amount_cents": 1600,
  "game_type": "bigger_dice",
  "room_id": "room-abc123",
  "room_name": "My Game",
  "username": "Player1",
  "total_players": 2,
  "description": "WON BIGGER DICE GAME"
}
```

---

## WebSocket Commands (Client → Server)

```javascript
// Roll the die (player's turn)
{
  type: 'games.command.bigger_dice.roll',
  room_id: 'uuid'
}

// Enable auto-play (disconnected player takes over)
{
  type: 'games.command.bigger_dice.enable_auto_play',
  room_id: 'uuid'
}
```

---

## WebSocket Events (Server → Client)

```javascript
// Player rolled
{
  type: 'games.event.bigger_dice.rolled',
  room_id: 'uuid',
  player_id: 123,
  roll: 5,
  new_score: 3
}

// Round finished
{
  type: 'games.event.bigger_dice.round_result',
  room_id: 'uuid',
  rolls: { "123": 5, "456": 3 },
  winner_id: 123,
  is_tie: false,
  scores: { "123": 3, "456": 2 }
}

// Tiebreaker started
{
  type: 'games.event.bigger_dice.tiebreaker_started',
  room_id: 'uuid',
  tied_players: [123, 456],
  tied_roll: 4
}
```

---

## Backend: BiggerDiceRoundState

Transient state for tracking current round (not persisted to DB):

```rust
#[derive(Debug, Clone, Default)]
pub struct BiggerDiceRoundState {
    pub rolls: HashMap<i64, i32>,       // player_id -> roll value
    pub roll_order: Vec<i64>,           // Order players rolled (for tiebreaker)
    pub round_complete: bool,
    pub is_tiebreaker: bool,
    pub tiebreaker_players: Vec<i64>,   // Players in tiebreaker
    pub tiebreaker_iteration: u32,      // Safety counter
}

impl BiggerDiceRoundState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn reset_for_new_round(&mut self) {
        self.rolls.clear();
        self.roll_order.clear();
        self.round_complete = false;
        self.is_tiebreaker = false;
        self.tiebreaker_players.clear();
        self.tiebreaker_iteration = 0;
    }

    pub fn start_tiebreaker(&mut self, tied_players: Vec<i64>) {
        self.rolls.clear();
        self.roll_order.clear();
        self.round_complete = false;
        self.is_tiebreaker = true;
        self.tiebreaker_players = tied_players;
        self.tiebreaker_iteration += 1;
    }
}
```

---

## Backend: Tiebreaker Logic

```rust
/// Find players with highest roll, preserving roll order for consistency
fn find_highest_rollers(rolls: &HashMap<i64, i32>, roll_order: &[i64]) -> (i32, Vec<i64>) {
    let max_roll = rolls.values().copied().max().unwrap_or(0);

    // Preserve original roll order for tiebreakers
    let highest_players: Vec<i64> = roll_order
        .iter()
        .filter(|&player_id| rolls.get(player_id).copied() == Some(max_roll))
        .copied()
        .collect();

    (max_roll, highest_players)
}

/// Process round result - determine winner or start tiebreaker
async fn process_round_result(
    &self,
    room: &mut GameRoom,
    round_state: &mut BiggerDiceRoundState,
) -> Result<(), EventHandlerError> {
    const MAX_TIEBREAKER_ITERATIONS: u32 = 100;

    let (max_roll, highest_players) = Self::find_highest_rollers(
        &round_state.rolls,
        &round_state.roll_order,
    );

    if highest_players.len() == 1 {
        // Clear winner
        let winner_id = highest_players[0];
        self.award_round_win(room, winner_id).await?;
        round_state.reset_for_new_round();
    } else if round_state.tiebreaker_iteration >= MAX_TIEBREAKER_ITERATIONS {
        // Safety limit - select first player as winner
        let winner_id = highest_players[0];
        warn!("Tiebreaker limit reached, selecting first player: {}", winner_id);
        self.award_round_win(room, winner_id).await?;
        round_state.reset_for_new_round();
    } else {
        // Tie - start tiebreaker with tied players only
        round_state.start_tiebreaker(highest_players.clone());

        // Publish tiebreaker event
        let event = GameEvent::BiggerDiceTiebreakerStarted {
            room_id: room.room_id.clone(),
            tied_players: highest_players,
            tied_roll: max_roll,
        };
        self.publish_game_event(event, Audience::room(&room.room_id)).await?;
    }

    Ok(())
}
```

---

## Backend: Roll Handler

```rust
async fn handle_bigger_dice_roll(
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

    // Verify it's player's turn
    let room = self.get_room(room_id).await?;
    if room.current_turn != Some(user_id) {
        return self.send_error(user_id, "not_your_turn", "It's not your turn", &socket_id).await;
    }

    // Generate roll
    let roll = rand::thread_rng().gen_range(1..=6);

    // Record roll in round state
    let mut round_states = self.round_states.lock().await;
    let round_state = round_states.entry(room_id.to_string()).or_default();
    round_state.rolls.insert(user_id, roll);
    round_state.roll_order.push(user_id);

    // Get player's current score
    let player_score = room.players.iter()
        .find(|p| p.user_id == user_id)
        .map(|p| p.score)
        .unwrap_or(0);

    // Publish rolled event
    let event = GameEvent::BiggerDiceRolled {
        room_id: room_id.to_string(),
        player_id: user_id,
        roll,
        new_score: player_score,
    };
    self.publish_game_event(event, Audience::room(room_id)).await?;

    // Check if round is complete (all players rolled or all tiebreaker players rolled)
    let expected_players = if round_state.is_tiebreaker {
        &round_state.tiebreaker_players
    } else {
        &room.players.iter().map(|p| p.user_id).collect::<Vec<_>>()
    };

    let all_rolled = expected_players.iter().all(|pid| round_state.rolls.contains_key(pid));

    if all_rolled {
        // Process round result
        drop(round_states); // Release lock before async call
        self.process_round_result_for_room(room_id).await?;
    } else {
        // Advance turn to next player
        self.advance_turn(room_id, &round_state).await?;
    }

    Ok(())
}
```

---

## Frontend: Animation Queue

Queue roll events to ensure sequential dice animations:

```javascript
// State
this.rollEventQueue = [];
this.isAnimating = false;

// Queue incoming roll events
handleRolled(message) {
    this.rollEventQueue.push(message);
    this.processRollQueue();
}

// Process queue sequentially
processRollQueue() {
    if (this.isAnimating || this.rollEventQueue.length === 0) return;

    const event = this.rollEventQueue.shift();
    this.isAnimating = true;

    this.animateDiceRoll(event).then(() => {
        this.isAnimating = false;
        this.processRollQueue();  // Process next
    });
}

// Animate single roll
animateDiceRoll(event) {
    return new Promise(resolve => {
        const diceEl = this.getDiceElement(event.player_id);

        // Animate rolling
        diceEl.classList.add('rolling');

        // Show result after animation
        setTimeout(() => {
            diceEl.classList.remove('rolling');
            diceEl.textContent = event.roll;
            diceEl.classList.add('show-result');

            // Update score
            this.updatePlayerScore(event.player_id, event.new_score);

            setTimeout(resolve, 500);
        }, 1000);
    });
}
```

---

## Frontend: Turn Timer (5 seconds)

Auto-roll when timer expires:

```javascript
// State
this.turnTimer = null;
this.turnTimeRemaining = 0;
this.turnTimerDuration = 5;

startTurnTimer() {
    // Only start if: playing, my turn, not auto-play, not spectator
    if (this.gameStatus !== GameStatus.PLAYING) return;
    if (String(this.currentTurn) !== String(this.myPlayerId)) return;
    if (this.autoPlayers.has(String(this.myPlayerId))) return;
    if (this.isSpectator) return;

    this.stopTurnTimer(); // Clear any existing timer
    this.turnTimeRemaining = this.turnTimerDuration;
    this.showTurnTimer();

    this.turnTimer = setInterval(() => {
        this.turnTimeRemaining -= 0.1;
        this.updateTurnTimerUI();

        if (this.turnTimeRemaining <= 0) {
            this.onTurnTimerExpired();
        }
    }, 100);
}

stopTurnTimer() {
    if (this.turnTimer) {
        clearInterval(this.turnTimer);
        this.turnTimer = null;
    }
    this.hideTurnTimer();
}

onTurnTimerExpired() {
    this.stopTurnTimer();
    this.sendRoll(); // Auto-roll
}
```

### Turn Timer HTML

```html
<div class="turn-timer hidden" id="turnTimer">
    <span class="turn-timer__icon">⏱️</span>
    <div class="turn-timer__content">
        <span class="turn-timer__label">Auto-roll in</span>
        <div class="turn-timer__bar">
            <div class="turn-timer__progress" id="turnTimerProgress"></div>
        </div>
    </div>
    <span class="turn-timer__text" id="turnTimerText">5</span>
</div>
```

### Turn Timer CSS

```css
.turn-timer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
    border: 2px solid rgba(99, 102, 241, 0.4);
    border-radius: 2rem;
    animation: timer-pulse 1s ease-in-out infinite;
}

.turn-timer--warning {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(249, 115, 22, 0.2));
    border-color: rgba(239, 68, 68, 0.5);
    animation: timer-shake 0.3s ease-in-out infinite;
}

@keyframes timer-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
}

@keyframes timer-shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-2px); }
    75% { transform: translateX(2px); }
}
```

---

## Frontend: Dice UI

### Dice Display HTML

```html
<div class="dice-container">
    <div class="dice-area">
        <div class="player-dice" id="player1Dice">
            <div class="dice" id="dice1">?</div>
            <div class="player-name" id="player1Name">Player 1</div>
            <div class="player-score">Score: <span id="player1Score">0</span></div>
        </div>

        <div class="vs-indicator">VS</div>

        <div class="player-dice" id="player2Dice">
            <div class="dice" id="dice2">?</div>
            <div class="player-name" id="player2Name">Player 2</div>
            <div class="player-score">Score: <span id="player2Score">0</span></div>
        </div>
    </div>

    <button class="roll-btn" id="rollBtn">Roll Dice</button>
</div>
```

### Dice Animation CSS

```css
.dice {
    width: 80px;
    height: 80px;
    background: white;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    font-weight: bold;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
}

.dice.rolling {
    animation: dice-roll 0.5s ease-in-out infinite;
}

.dice.show-result {
    animation: dice-pop 0.3s ease-out;
}

@keyframes dice-roll {
    0% { transform: rotate(0deg) scale(1); }
    25% { transform: rotate(90deg) scale(1.1); }
    50% { transform: rotate(180deg) scale(1); }
    75% { transform: rotate(270deg) scale(1.1); }
    100% { transform: rotate(360deg) scale(1); }
}

@keyframes dice-pop {
    0% { transform: scale(0.8); }
    50% { transform: scale(1.15); }
    100% { transform: scale(1); }
}

.dice.winner {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
}

.dice.loser {
    opacity: 0.5;
}
```

---

## Frontend: Round Result Handling

```javascript
handleRoundResult(message) {
    const { rolls, winner_id, is_tie, scores } = message;

    // Update scores
    for (const [playerId, score] of Object.entries(scores)) {
        this.updatePlayerScore(playerId, score);
    }

    // Highlight winner/loser dice
    if (!is_tie && winner_id) {
        this.highlightWinner(winner_id);

        // Check for game end
        const winnerScore = scores[winner_id];
        if (winnerScore >= 10) {
            // Game will end, wait for game_ended event
        }
    }

    // Show tie message if applicable
    if (is_tie) {
        this.showTieMessage(rolls);
    }
}

handleTiebreakerStarted(message) {
    const { tied_players, tied_roll } = message;

    // Reset dice for tied players only
    this.resetDiceForPlayers(tied_players);

    // Show tiebreaker message
    this.showTiebreakerMessage(tied_players, tied_roll);

    // Update turn indicator
    this.updateTurnIndicator();
}
```

---

## Frontend: Game Over UI

```javascript
processGameOver(message) {
    this.gameStatus = GameStatus.FINISHED;
    this.winner = message.winner_id;
    this.finalScores = message.final_scores;

    // Hide chat panel and game footer
    this.elements.chatPanel?.classList.add('hidden');
    this.elements.gameFooter?.classList.add('hidden');

    // Stop turn timer
    this.stopTurnTimer();

    // Show game over result
    this.showGameOverResult(message);

    // Update UI
    this.updateGameUI();
}

showGameOverResult(message) {
    const isWinner = String(message.winner_id) === String(this.myPlayerId);
    const winnerName = this.getPlayerName(message.winner_id);
    const prizeAmount = this.formatCurrency(message.prize_cents || 1600);

    const resultHtml = `
        <div class="game-over-overlay">
            <div class="game-over-content">
                <div class="game-over-icon">${isWinner ? '🏆' : '😢'}</div>
                <h2 class="game-over-title">
                    ${isWinner ? 'You Won!' : `${winnerName} Wins!`}
                </h2>
                <div class="game-over-prize">
                    ${isWinner ? `You earned ${prizeAmount}!` : `Prize: ${prizeAmount}`}
                </div>
                <div class="game-over-scores">
                    ${this.formatFinalScores(message.final_scores)}
                </div>
                <button class="game-over-btn" onclick="this.closest('.game-over-overlay').remove()">
                    Close
                </button>
            </div>
        </div>
    `;

    this.shadowRoot.querySelector('.game-container').insertAdjacentHTML('beforeend', resultHtml);
}
```

---

## vite.config.js

```javascript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: resolve(__dirname, '../../../resources/js/games/BIGGER_DICE'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.js'),
      output: {
        entryFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return '../../../css/games/BIGGER_DICE/style.css'
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

## Tera Template (bigger_dice.html)

```html
{% extends "layouts/app.html" %}

{% block title %}Bigger Dice - {{ room_name | default(value="Game") }}{% endblock %}

{% block styles %}
<link rel="stylesheet" href="/assets/css/games/BIGGER_DICE/style.css?v={{ assets_version }}">
{% endblock %}

{% block content %}
<div class="game-page">
    <bigger-dice
        data-ws-url="{{ ws_url }}"
        data-room-id="{{ room_id | default(value='') }}"
        data-room-name="{{ room_name | default(value='') }}"
        data-user-id="{{ user.id }}"
        data-username="{{ user.username }}"
        data-avatar-id="{{ user.avatar_id | default(value='1') }}"
        data-balance="{{ user.balance | default(value='0') }}"
        data-mode="{{ mode | default(value='lobby') }}"
        data-spectate="{{ spectate | default(value='false') }}"
    ></bigger-dice>
</div>
{% endblock %}

{% block scripts %}
<script type="module" src="/assets/js/games/BIGGER_DICE/app.js?v={{ assets_version }}"></script>
{% endblock %}
```

---

## Build Commands

```bash
# Development build
cd blazing_sun/src/frontend/games/BIGGER_DICE
npm run build

# Watch mode
npm run watch

# Production build
npm run build:prod

# After build, bump assets_version in .env to bust cache
```

---

## Testing Checklist

- [ ] Create room with/without password
- [ ] Join room as player
- [ ] Join room as spectator
- [ ] Player selection deducts balance
- [ ] Both players ready starts game
- [ ] Roll dice updates score
- [ ] Turn timer auto-rolls after 5s
- [ ] Tiebreaker triggers on tie
- [ ] Game ends at 10 points
- [ ] Winner receives prize
- [ ] Spectators see read-only player chat
- [ ] Reconnection restores game state
- [ ] Auto-play works for disconnected players
