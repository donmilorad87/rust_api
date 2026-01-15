# Games Page (`/games`)

## Overview

The Games page provides real-time multiplayer gaming functionality with WebSocket-based communication.

---

## Route Details

| Property | Value |
|----------|-------|
| **Path** | `/games` |
| **Route Name** | `web.games` |
| **Auth** | Required (manual check) |
| **Permission** | Basic (1+) |
| **Controller** | `pages::games()` |
| **Template** | `web/games.html` |
| **Frontend** | `/src/frontend/pages/GAMES/` |

### Localized Variants
- `/igre` - Serbian

---

## Template Variables

```rust
{
    "base_url": "https://localhost",
    "user_id": 123,
    "user": {
        "id": 123,
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "avatar_url": "/uploads/avatars/...",
        "permission": 1
    }
}
```

### JavaScript Globals (from template)

```javascript
window.BASE_URL    // "https://localhost"
window.WS_URL      // "wss://localhost/ws/games"
window.USER_ID     // 123
window.USERNAME    // "John"
window.AVATAR_ID   // "..." or null
```

---

## Frontend Bundle

| File | Size (gzipped) |
|------|----------------|
| `app.js` | 20KB (5.4KB) |
| `style.css` | 17KB (3.4KB) |
| **Total** | 37KB (8.8KB) |

---

## Features

### Game Lobby
- View available game rooms
- Room status indicators (waiting, in-progress, finished)
- Create new rooms with custom names
- Join waiting rooms
- Spectate active games

### Bigger Dice Game
- 2-player turn-based dice rolling
- Real-time updates via WebSocket
- Visual dice rolling animation
- Score tracking
- Round results overlay
- Winner announcement modal

### Spectator Mode
- Watch games without participating
- Real-time game state updates
- Spectator count display
- No interaction with game mechanics

### Resilience
- WebSocket heartbeat (30s ping)
- Automatic reconnection (exponential backoff)
- Session recovery (rejoin room after disconnect)
- Connection status indicator

---

## WebSocket Connection

### Endpoint
```
wss://localhost/ws/games
```

### Authentication
JWT token from session cookie

### Message Types

**Commands (Client → Server):**
- `auth` - Authenticate connection
- `create_room` - Create new game room
- `join_room` - Join existing room
- `leave_room` - Leave current room
- `rejoin_room` - Reconnect to room
- `ready` - Mark ready to start
- `spectate` - Watch a game
- `leave_spectate` - Stop watching
- `bigger_dice.roll` - Roll the dice
- `ping` - Heartbeat

**Events (Server → Client):**
- `room_created` - Room was created
- `room_joined` - Player joined room
- `player_left` - Player left room
- `player_rejoined` - Player reconnected
- `player_ready` - Player is ready
- `game_started` - Game began
- `turn_changed` - Turn switched
- `bigger_dice.rolled` - Dice rolled
- `bigger_dice.round_result` - Round outcome
- `game_ended` - Game finished
- `spectator_joined` - Spectator watching
- `spectator_left` - Spectator left
- `room_state` - Full room state
- `error` - Error message
- `pong` - Heartbeat response

---

## UI Components

### Connection Status
Visual indicator showing:
- Connected (green)
- Connecting (yellow)
- Disconnected (red)
- Reconnecting (orange)

### Room Cards
Display room information:
- Room name
- Game type
- Player count
- Status badge
- Player names
- Join/Spectate buttons

### Game Board
Main game interface:
- Title bar with room name
- Turn indicator
- Player cards with scores
- Dice display area
- Roll button
- Leave button

### Modals
- Create Room - Form for new room
- Round Result - After each roll
- Game End - Winner announcement

---

## Accessibility

- Semantic HTML (`<main>`, `<section>`, `<header>`)
- ARIA labels on buttons
- `aria-live` for dynamic updates
- Keyboard navigation support
- Focus management in modals

---

## Dependencies

### Backend
- `src/app/games/types.rs` - Data types
- `src/bootstrap/events/handlers/games.rs` - Event handler
- `src/routes/web.rs` - Route registration
- `src/app/http/web/controllers/pages.rs` - Controller

### External Services
- **Redis** - Game room state
- **Kafka** - Event streaming
- **MongoDB** - Game history
- **WebSocket Gateway** - Real-time communication

---

## Error Handling

| Error | Handling |
|-------|----------|
| Not authenticated | Redirect to `/sign-in` |
| WebSocket failed | Show error state, retry button |
| Connection lost | Auto-reconnect with backoff |
| Game error | Toast notification |

---

## Testing

### Manual Testing Checklist
- [ ] Page loads for authenticated user
- [ ] Connection status shows "Connected"
- [ ] Can create a new room
- [ ] Can join existing room
- [ ] Ready button works
- [ ] Game starts when both ready
- [ ] Dice rolls animate correctly
- [ ] Scores update in real-time
- [ ] Winner modal shows correctly
- [ ] Can leave room
- [ ] Reconnection works
- [ ] Session recovery works
- [ ] Spectator mode works

---

## See Also

- [WebSocket System](../../WebSocket/README.md)
- [GamesPage Documentation](../../GamesPage/README.md)
- [Frontend Overview](../../Frontend/README.md)
