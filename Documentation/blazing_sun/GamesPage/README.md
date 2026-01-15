# Games Page Documentation

This document covers the `/games` page functionality, including the game lobby, "Bigger Dice" game, and spectator system.

---

## Overview

The Games Page provides a real-time multiplayer gaming experience with:
- **Game Lobby**: Browse and create game rooms
- **Bigger Dice Game**: 2-player turn-based dice game
- **Spectator System**: Watch live games
- **Real-time Updates**: WebSocket-based communication

---

## Route

| Pattern | Name | Permission |
|---------|------|------------|
| `/games` | `web.games` | Authenticated users |
| `/igre` | `web.games` (Serbian) | Authenticated users |

---

## Features

### Game Lobby

The lobby allows users to:
- View available game rooms with status
- Create new game rooms
- Join waiting rooms
- Spectate in-progress games

**Room States:**
- `waiting` - Room open for players
- `in_progress` - Game active
- `finished` - Game completed
- `abandoned` - All players left

### Bigger Dice Game

A simple 2-player dice game where:
1. Each player takes turns rolling a dice
2. Higher roll wins the round
3. Winner gets 1 point
4. Ties result in re-roll
5. First to **10 points** wins

**Game Flow:**
1. Player creates room → status: `waiting`
2. Second player joins
3. Both players click "Ready"
4. Game starts → status: `in_progress`
5. Players alternate rolling dice
6. First to 10 wins → status: `finished`

### Spectator System

Users can watch games without participating:
- Real-time view of game state
- See all dice rolls and scores
- Spectator count visible to players
- Cannot interact with game mechanics

---

## Frontend Architecture

### Files
```
src/frontend/pages/GAMES/
├── src/
│   ├── GamesPage.js      # Main controller class
│   ├── main.js           # Entry point
│   └── styles/
│       ├── main.scss     # Entry point
│       ├── _variables.scss
│       └── _games.scss   # All component styles
├── vite.config.js
└── package.json
```

### GamesPage Class

```javascript
export class GamesPage {
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.wsUrl = options.wsUrl;
    this.userId = options.userId;
    this.username = options.username;
    // ...
  }

  // Connection management
  connect()
  handleOpen()
  handleClose()
  handleMessage()

  // Heartbeat
  startHeartbeat()
  stopHeartbeat()
  handlePong()

  // Session recovery
  saveLastRoomId()
  loadLastRoomId()
  clearLastRoomId()
  rejoinRoom()

  // Room management
  createRoom()
  joinRoom()
  leaveRoom()
  spectateRoom()
  toggleReady()

  // Game actions
  rollDice()

  // Event handlers
  handleRoomCreated()
  handleRoomJoined()
  handleRoomState()
  handlePlayerLeft()
  handlePlayerRejoined()
  handlePlayerReady()
  handleGameStarted()
  handleTurnChanged()
  handleDiceRolled()
  handleRoundResult()
  handleGameEnded()
  handleSpectatorJoined()
  handleSpectatorLeft()

  // UI updates
  updateGameUI()
  updatePlayerCards()
  updateActionButtons()
  updateTurnIndicator()

  // Animations
  animateGameStart()
  animateDiceRoll()
  showRoundResult()
  showGameEndModal()
}
```

### Global Variables (from template)

```javascript
window.BASE_URL     // Server base URL
window.WS_URL       // WebSocket URL
window.USER_ID      // Current user ID
window.USERNAME     // Current user's name
window.AVATAR_ID    // User's avatar reference
```

---

## UI Components

### Lobby Section

```html
<section id="lobbySection" class="lobby-section">
  <!-- Loading State -->
  <div id="loadingState">...</div>

  <!-- Error State -->
  <div id="errorState">...</div>

  <!-- Empty State -->
  <div id="emptyState">...</div>

  <!-- Rooms Grid -->
  <div id="roomsGrid" class="rooms-grid">
    <!-- Room cards rendered here -->
  </div>
</section>
```

### Room Card

```html
<div class="room-card" data-room-id="...">
  <div class="room-header">
    <h3 class="room-name">Room Name</h3>
    <span class="room-status waiting">Waiting</span>
  </div>
  <div class="room-info">
    <span class="game-type">Bigger Dice</span>
    <span class="player-count">1/2 players</span>
  </div>
  <div class="room-players">
    <span class="player-badge ready">Player 1</span>
  </div>
  <div class="room-actions">
    <button class="btn btn-primary btn-join">Join Game</button>
    <button class="btn btn-secondary btn-spectate">Spectate</button>
  </div>
</div>
```

### Game Board

```html
<section id="gameSection" class="game-section">
  <div class="game-container">
    <div class="game-board">
      <!-- Header -->
      <header class="game-board__header">
        <h2 id="gameBoardTitle">Bigger Dice</h2>
        <span id="gameBoardStatus">Waiting...</span>
      </header>

      <!-- Turn Indicator -->
      <div id="turnIndicator">Your turn!</div>

      <!-- Players Area -->
      <div class="players-area">
        <div id="player1Card" class="player-card">...</div>
        <div id="player2Card" class="player-card">...</div>
      </div>

      <!-- Dice Area -->
      <div class="dice-area">
        <div class="dice-container">
          <div id="dice1" class="dice">?</div>
          <div id="dice2" class="dice">?</div>
        </div>
        <button id="rollDiceBtn">Roll Dice</button>
      </div>

      <!-- Footer -->
      <footer class="game-board__footer">
        <span id="gameRoundInfo">Round 0</span>
        <button id="leaveGameBtn">Leave Game</button>
      </footer>
    </div>

    <!-- Chat Sidebar -->
    <aside class="chat-sidebar">...</aside>
  </div>
</section>
```

### Modals

1. **Create Room Modal** - Form for new room
2. **Round Result Overlay** - Shows after each round
3. **Game End Modal** - Winner announcement

---

## CSS Architecture

### Variables (`_variables.scss`)

```scss
:root {
  // Layout
  --games-max-width: 1200px;
  --games-padding: 2rem;
  --room-card-min-width: 300px;

  // Status colors
  --status-waiting: #f59e0b;
  --status-in-progress: #10b981;
  --status-finished: #6b7280;
  --status-abandoned: #ef4444;

  // Player colors
  --player-1-color: #3b82f6;
  --player-2-color: #ef4444;
  --spectator-color: #8b5cf6;

  // Dice
  --dice-size: 80px;
  --dice-dot-size: 12px;
}
```

### BEM Naming

- `.games-page` - Page container
- `.games-page__header` - Page header
- `.room-card` - Individual room card
- `.room-card__status` - Room status badge
- `.room-card__status--waiting` - Modifier
- `.game-board` - Game playing area
- `.player-card` - Player info card
- `.dice` - Dice element
- `.dice--rolling` - Rolling animation

---

## Connection States

```javascript
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting'
};
```

Visual indicator shows current state with colored dot.

---

## Resilience

### Heartbeat Mechanism
- Ping sent every 30 seconds
- Pong expected within 10 seconds
- Connection reset if timeout

### Session Recovery
- Room ID stored in `sessionStorage`
- On reconnect, `rejoin_room` command sent
- Server restores room state
- Clear on explicit leave

### Reconnection
- Exponential backoff (1s → 16s)
- Max 5 attempts
- Toast notifications for status

---

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader announcements
- High contrast support via CSS variables
- Focus management in modals

---

## Building

```bash
cd src/frontend/pages/GAMES

# Install dependencies
npm install

# Development build
npm run build

# Production build
npm run build:prod

# Watch mode
npm run watch
```

Output:
- `src/resources/js/GAMES/app.js`
- `src/resources/css/GAMES/style.css`

---

## API Dependencies

The Games Page requires WebSocket system components:

| Component | File |
|-----------|------|
| Types | `src/app/games/types.rs` |
| Handler | `src/bootstrap/events/handlers/games.rs` |
| Route | `src/routes/web.rs` |
| Controller | `src/app/http/web/controllers/pages.rs` |
| Template | `src/resources/views/web/games.html` |

---

## Future Enhancements

1. **Chat System**: In-game messaging
2. **Game History**: View past games
3. **Leaderboards**: Rankings by wins
4. **More Games**: Additional game types
5. **Tournaments**: Bracket-style competition
6. **Friends System**: Invite friends to games
7. **Custom Rules**: Configurable win conditions

---

## See Also

- [WebSocket System](../WebSocket/README.md)
- [Frontend Overview](../Frontend/README.md)
- [Routes Quick Reference](../Routes/Web/quick-reference.md)
