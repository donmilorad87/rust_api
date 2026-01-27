/**
 * TicTacToe Web Component
 *
 * A self-contained tic-tac-toe game component that handles WebSocket communication,
 * game state, and rendering. Supports lobby mode, game mode, and spectator mode.
 *
 * Game Rules:
 * - Best-of-9 match (first to 5 wins)
 * - 60-second turn timer
 * - Turn order reverses after each game (win or draw)
 * - Winner gets 60% of prize pool (1200 coins from 2000 pool)
 *
 * Usage (Lobby Mode):
 * <tic-tac-toe
 *   data-ws-url="wss://localhost/ws/games"
 *   data-user-id="1"
 *   data-username="Player1"
 *   data-mode="lobby"
 * ></tic-tac-toe>
 *
 * Usage (Game Mode):
 * <tic-tac-toe
 *   data-ws-url="wss://localhost/ws/games"
 *   data-room-id="abc123"
 *   data-room-name="My Game"
 *   data-user-id="1"
 *   data-username="Player1"
 *   data-avatar-id="avatar123"
 *   data-mode="game"
 * ></tic-tac-toe>
 */

const TURN_TIMER_SECONDS = 60;
const WIN_SCORE = 5;

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      font-family: var(--font-family, system-ui, sans-serif);
      --primary-color: var(--game-primary, #6366f1);
      --success-color: var(--game-success, #22c55e);
      --danger-color: var(--game-danger, #ef4444);
      --warning-color: var(--game-warning, #f59e0b);
      --bg-color: var(--game-bg, #1e1e2e);
      --card-bg: var(--game-card-bg, #2a2a3e);
      --text-color: var(--game-text, #e2e8f0);
      --text-muted: var(--game-text-muted, #94a3b8);
      --border-color: var(--game-border, #3f3f5a);
      --x-color: #3b82f6;
      --o-color: #f59e0b;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .game-container {
      background: var(--bg-color);
      border-radius: 1rem;
      padding: 1.5rem;
      color: var(--text-color);
      min-height: 400px;
    }

    .game-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
      gap: 1rem;
    }

    .game-title {
      font-size: 1.5rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .game-status {
      font-size: 0.875rem;
      padding: 0.375rem 0.75rem;
      border-radius: 9999px;
      background: var(--card-bg);
    }

    .game-status--waiting { color: var(--warning-color); }
    .game-status--playing { color: var(--success-color); }
    .game-status--finished { color: var(--text-muted); }

    .connection-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .connection-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--danger-color);
    }

    .connection-dot--connected { background: var(--success-color); }
    .connection-dot--connecting {
      background: var(--warning-color);
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* ============================================
       LOBBY MODE STYLES
       ============================================ */

    .lobby-section {
      display: none;
    }

    .lobby-section.active {
      display: block;
    }

    .lobby-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .lobby-title {
      font-size: 1.25rem;
      font-weight: 600;
    }

    .create-room-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      font-size: 0.9375rem;
      font-weight: 600;
      border: none;
      border-radius: 0.5rem;
      background: var(--primary-color);
      color: white;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.2s;
    }

    .create-room-btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .rooms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .room-card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.75rem;
      padding: 1.25rem;
      cursor: pointer;
      transition: border-color 0.2s, transform 0.2s;
    }

    .room-card:hover {
      border-color: var(--primary-color);
      transform: translateY(-2px);
    }

    .room-card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .room-card__name {
      font-size: 1.125rem;
      font-weight: 600;
    }

    .room-card__status {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .room-card__status--waiting {
      background: rgba(245, 158, 11, 0.2);
      color: var(--warning-color);
    }

    .room-card__status--playing {
      background: rgba(34, 197, 94, 0.2);
      color: var(--success-color);
    }

    .room-card__info {
      display: flex;
      gap: 1rem;
      color: var(--text-muted);
      font-size: 0.8125rem;
      margin-bottom: 0.75rem;
    }

    .room-card__info-item {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .room-card__info-icon {
      width: 14px;
      height: 14px;
    }

    .room-card__no-spectators {
      font-size: 0.75rem;
      color: var(--text-muted);
      opacity: 0.7;
    }

    .room-card__players {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .player-badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.625rem;
      border-radius: 0.375rem;
      background: var(--bg-color);
    }

    .player-badge--ready {
      background: rgba(34, 197, 94, 0.15);
      color: var(--success-color);
    }

    .room-card__actions {
      display: flex;
      gap: 0.5rem;
    }

    .join-btn {
      flex: 1;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      border: none;
      border-radius: 0.5rem;
      background: var(--primary-color);
      color: white;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .join-btn:hover {
      opacity: 0.9;
    }

    .spectate-btn {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      background: transparent;
      color: var(--text-color);
      cursor: pointer;
      transition: all 0.2s;
    }

    .spectate-btn:hover {
      background: var(--border-color);
    }

    .room-card__lock {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--text-muted);
      font-size: 0.75rem;
    }

    .room-card__lock-icon {
      width: 14px;
      height: 14px;
    }

    .room-card__status--in_progress {
      background: rgba(34, 197, 94, 0.15);
      color: var(--success-color);
    }

    .no-rooms {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
      text-align: center;
    }

    .empty-state__icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .empty-state__title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .empty-state__message {
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 1rem;
    }

    /* ============================================
       GAME MODE STYLES
       ============================================ */

    .game-section {
      display: none;
    }

    .game-section.active {
      display: block;
    }

    .match-info {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 2rem;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: var(--card-bg);
      border-radius: 0.75rem;
    }

    .player-score {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      min-width: 120px;
    }

    .player-score__name {
      font-weight: 600;
      font-size: 1rem;
    }

    .player-score__mark {
      font-size: 1.5rem;
      font-weight: bold;
    }

    .player-score__mark--x { color: var(--x-color); }
    .player-score__mark--o { color: var(--o-color); }

    .player-score__value {
      font-size: 2rem;
      font-weight: bold;
    }

    .player-score--active {
      background: rgba(99, 102, 241, 0.2);
      border-radius: 0.5rem;
      padding: 0.5rem 1rem;
    }

    .vs-divider {
      font-size: 1.25rem;
      color: var(--text-muted);
      font-weight: bold;
    }

    .game-number {
      text-align: center;
      margin-bottom: 1rem;
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    .turn-timer {
      text-align: center;
      margin-bottom: 1rem;
    }

    .turn-timer__text {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .turn-timer__value {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--text-color);
    }

    .turn-timer__value--warning {
      color: var(--warning-color);
    }

    .turn-timer__value--danger {
      color: var(--danger-color);
      animation: pulse 0.5s infinite;
    }

    /* ============================================
       GAME BOARD STYLES
       ============================================ */

    .board-container {
      display: flex;
      justify-content: center;
      margin-bottom: 1.5rem;
    }

    .board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      max-width: 300px;
      width: 100%;
    }

    .cell {
      aspect-ratio: 1;
      background: var(--card-bg);
      border: 2px solid var(--border-color);
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s, transform 0.1s;
    }

    .cell:hover:not(.cell--disabled) {
      background: rgba(99, 102, 241, 0.1);
      border-color: var(--primary-color);
    }

    .cell--disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }

    .cell--x {
      color: var(--x-color);
    }

    .cell--o {
      color: var(--o-color);
    }

    .cell--winning {
      background: rgba(34, 197, 94, 0.3);
      border-color: var(--success-color);
      animation: winPulse 0.5s ease-in-out 3;
    }

    @keyframes winPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    /* ============================================
       TURN INDICATOR
       ============================================ */

    .turn-indicator {
      text-align: center;
      padding: 1rem;
      background: var(--card-bg);
      border-radius: 0.5rem;
      margin-bottom: 1rem;
    }

    .turn-indicator__text {
      font-size: 1.125rem;
      font-weight: 600;
    }

    .turn-indicator--your-turn {
      background: rgba(99, 102, 241, 0.2);
      border: 2px solid var(--primary-color);
    }

    /* ============================================
       GAME RESULT OVERLAY
       ============================================ */

    .game-result {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }

    .game-result.active {
      display: flex;
    }

    .game-result__content {
      background: var(--card-bg);
      border-radius: 1rem;
      padding: 2rem;
      text-align: center;
      max-width: 400px;
      width: 90%;
    }

    .game-result__title {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 1rem;
    }

    .game-result__title--win {
      color: var(--success-color);
    }

    .game-result__title--lose {
      color: var(--danger-color);
    }

    .game-result__title--draw {
      color: var(--warning-color);
    }

    .game-result__message {
      font-size: 1rem;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }

    .game-result__prize {
      font-size: 1.5rem;
      font-weight: bold;
      color: var(--success-color);
      margin-bottom: 1rem;
    }

    .game-result__btn {
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      border-radius: 0.5rem;
      background: var(--primary-color);
      color: white;
      cursor: pointer;
    }

    /* ============================================
       WAITING ROOM
       ============================================ */

    .waiting-room {
      display: none;
      text-align: center;
      padding: 2rem;
    }

    .waiting-room.active {
      display: block;
    }

    .waiting-room__title {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .waiting-room__players {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 1.5rem;
    }

    .waiting-player {
      padding: 1rem 2rem;
      background: var(--card-bg);
      border-radius: 0.5rem;
      min-width: 150px;
    }

    .waiting-player__name {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .waiting-player__status {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .waiting-player__status--ready {
      color: var(--success-color);
    }

    .ready-btn {
      padding: 0.75rem 2rem;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      border-radius: 0.5rem;
      background: var(--success-color);
      color: white;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .ready-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .leave-btn {
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
    }

    /* ============================================
       CHAT STYLES
       ============================================ */

    .chat-container {
      margin-top: 1.5rem;
      border-top: 1px solid var(--border-color);
      padding-top: 1rem;
    }

    .chat-messages {
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 0.75rem;
      padding: 0.5rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 0.5rem;
    }

    .chat-message {
      font-size: 0.875rem;
      margin-bottom: 0.25rem;
    }

    .chat-message__sender {
      font-weight: 600;
      color: var(--primary-color);
    }

    .chat-message__content {
      color: var(--text-color);
    }

    .chat-input-container {
      display: flex;
      gap: 0.5rem;
    }

    .chat-input {
      flex: 1;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      background: var(--card-bg);
      color: var(--text-color);
      font-size: 0.875rem;
    }

    .chat-input:focus {
      outline: none;
      border-color: var(--primary-color);
    }

    .chat-send-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.5rem;
      background: var(--primary-color);
      color: white;
      cursor: pointer;
    }

    /* ============================================
       MODAL STYLES
       ============================================ */

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal-content {
      background: var(--card-bg);
      border-radius: 1rem;
      padding: 2rem;
      width: 90%;
      max-width: 400px;
      animation: scaleIn 0.2s;
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .modal-title {
      font-size: 1.25rem;
      font-weight: 600;
    }

    .modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
    }

    .modal-close:hover {
      color: var(--text-color);
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    .form-label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    .form-label__optional {
      font-weight: 400;
      color: var(--text-muted);
    }

    .form-input {
      width: 100%;
      padding: 0.625rem 0.875rem;
      font-size: 1rem;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      background: var(--bg-color);
      color: var(--text-color);
      outline: none;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      border-color: var(--primary-color);
    }

    .form-hint {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.375rem;
    }

    .form-group--checkbox {
      padding-top: 0.25rem;
    }

    .form-checkbox {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .form-checkbox input[type="checkbox"] {
      width: 1.125rem;
      height: 1.125rem;
      margin: 0;
      accent-color: var(--primary-color);
      cursor: pointer;
    }

    .form-checkbox__label {
      font-size: 0.9375rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .form-error {
      color: var(--danger-color);
      font-size: 0.8125rem;
      margin-top: 0.375rem;
    }

    .modal-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
    }

    .btn-secondary {
      padding: 0.625rem 1.25rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      background: transparent;
      color: var(--text-color);
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary:hover {
      background: var(--border-color);
      color: var(--text-color);
    }

    .btn-primary {
      padding: 0.625rem 1.25rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border: none;
      border-radius: 0.5rem;
      background: var(--primary-color);
      color: white;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .hidden {
      display: none !important;
    }

    /* ============================================
       PAUSED OVERLAY
       ============================================ */

    .paused-overlay {
      display: none;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 50;
      align-items: center;
      justify-content: center;
    }

    .paused-overlay.active {
      display: flex;
    }

    .paused-content {
      text-align: center;
      padding: 2rem;
    }

    .paused-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--warning-color);
      margin-bottom: 0.5rem;
    }

    .paused-message {
      color: var(--text-muted);
    }

    /* ============================================
       CONFIRMATION MODALS
       ============================================ */

    .modal-content--small {
      max-width: 340px;
      padding: 1.5rem;
    }

    .modal-body {
      margin-bottom: 1.5rem;
    }

    .confirm-message {
      font-size: 0.9375rem;
      line-height: 1.5;
      color: var(--text-color);
    }

    .confirm-message--error {
      color: var(--danger-color);
    }

    .confirm-loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 0;
    }

    .loader-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-color);
      border-top-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .loader-text {
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    /* ============================================
       TOAST NOTIFICATIONS
       ============================================ */

    .toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: none;
    }

    .toast {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      padding: 0.875rem 1rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      max-width: 320px;
      pointer-events: auto;
      animation: toastSlideIn 0.3s ease;
    }

    .toast--error {
      border-color: var(--danger-color);
      background: rgba(220, 53, 69, 0.1);
    }

    .toast--success {
      border-color: var(--success-color);
      background: rgba(40, 167, 69, 0.1);
    }

    .toast__message {
      font-size: 0.875rem;
      color: var(--text-color);
      line-height: 1.4;
    }

    .toast--error .toast__message {
      color: var(--danger-color);
    }

    .toast--success .toast__message {
      color: var(--success-color);
    }

    @keyframes toastSlideIn {
      from {
        opacity: 0;
        transform: translateX(100%);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes toastSlideOut {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }

    /* ============================================
       ADMIN LOBBY STYLES
       ============================================ */
    .admin-lobby {
      margin-bottom: 2rem;
    }

    .admin-lobby__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .admin-lobby__title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .admin-lobby__count {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .lobby-players {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .lobby-player {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 1rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      transition: border-color 0.2s;
    }

    .lobby-player:hover {
      border-color: var(--primary-color);
    }

    .lobby-player__info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .lobby-player__avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1rem;
    }

    .lobby-player__name {
      font-weight: 500;
    }

    .lobby-player__joined {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .lobby-player__actions {
      display: flex;
      gap: 0.5rem;
    }

    .lobby-player--ready {
      border-color: var(--success-color);
      background: rgba(34, 197, 94, 0.05);
    }

    .lobby-player--admin {
      border-color: var(--primary-color);
      background: rgba(99, 102, 241, 0.05);
    }

    .lobby-player__avatar--admin {
      background: rgba(99, 102, 241, 0.2);
      color: var(--primary-color);
      border: 2px solid var(--primary-color);
    }

    .lobby-player--spectator {
      border-color: var(--warning-color);
      background: rgba(245, 158, 11, 0.05);
    }

    .lobby-player__avatar--spectator {
      background: rgba(245, 158, 11, 0.2);
      color: var(--warning-color);
    }

    /* Action Buttons */
    .select-btn {
      padding: 0.375rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 500;
      border: none;
      border-radius: 0.375rem;
      background: var(--success-color);
      color: white;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .select-btn:hover {
      opacity: 0.9;
    }

    .kick-btn, .ban-btn {
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
      font-weight: 500;
      border: 1px solid var(--border-color);
      border-radius: 0.375rem;
      background: transparent;
      cursor: pointer;
      transition: all 0.2s;
    }

    .kick-btn {
      color: var(--warning-color);
    }

    .kick-btn:hover {
      background: var(--warning-color);
      color: white;
      border-color: var(--warning-color);
    }

    .ban-btn {
      color: var(--danger-color);
    }

    .ban-btn:hover {
      background: var(--danger-color);
      color: white;
      border-color: var(--danger-color);
    }

    .lobby-empty {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-muted);
      background: var(--card-bg);
      border-radius: 0.5rem;
    }

    .lobby-empty__icon {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    /* Badges */
    .admin-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      padding: 0.125rem 0.5rem;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.15);
      color: var(--primary-color);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .ready-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      background: var(--success-color);
      color: white;
      font-size: 0.7rem;
      font-weight: 600;
      border-radius: 1rem;
      margin-left: 0.5rem;
    }

    .waiting-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      background: var(--text-muted);
      color: white;
      font-size: 0.7rem;
      font-weight: 500;
      border-radius: 1rem;
      margin-left: 0.5rem;
    }

    .spectator-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning-color);
      font-size: 0.7rem;
      font-weight: 600;
      border-radius: 1rem;
      margin-left: 0.5rem;
    }

    /* ============================================
       BANNED PLAYERS SECTION
       ============================================ */
    .banned-players-section {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border-color);
    }

    .banned-players-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .banned-players-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--danger-color);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .banned-players-count {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .banned-players-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .banned-player {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.625rem 0.875rem;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 0.375rem;
    }

    .banned-player__info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .banned-player__avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.875rem;
    }

    .banned-player__name {
      font-size: 0.875rem;
      font-weight: 500;
    }

    .unban-btn {
      padding: 0.25rem 0.625rem;
      font-size: 0.75rem;
      font-weight: 500;
      border: 1px solid var(--success-color);
      border-radius: 0.25rem;
      background: transparent;
      color: var(--success-color);
      cursor: pointer;
      transition: all 0.2s;
    }

    .unban-btn:hover {
      background: var(--success-color);
      color: white;
    }

    /* ============================================
       WAITING FOR ADMIN STYLES
       ============================================ */
    .waiting-for-admin {
      text-align: center;
      padding: 2rem 1rem;
      background: var(--card-bg);
      border-radius: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .waiting-for-admin__icon {
      font-size: 2.5rem;
      margin-bottom: 0.75rem;
    }

    .waiting-for-admin__title {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .waiting-for-admin__message {
      color: var(--text-muted);
    }

    .waiting-players-list {
      margin-top: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 300px;
      margin-left: auto;
      margin-right: auto;
    }

    .waiting-player {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.75rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }

    .waiting-player--ready {
      background: rgba(34, 197, 94, 0.1);
    }

    .waiting-player--admin {
      background: rgba(99, 102, 241, 0.1);
      border-left: 3px solid var(--primary-color);
    }

    .waiting-player__name {
      font-weight: 500;
    }

    .waiting-player__status {
      font-size: 0.75rem;
    }

    .waiting-player__status--ready {
      color: var(--success-color);
      font-weight: 600;
    }

    .waiting-player__status--waiting {
      color: var(--text-muted);
    }

    /* ============================================
       NOT IN ROOM STYLES
       ============================================ */
    .not-in-room {
      text-align: center;
      padding: 3rem 1rem;
      background: var(--card-bg);
      border-radius: 1rem;
      border: 1px solid var(--border-color);
    }

    .not-in-room__icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .not-in-room__title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-color);
    }

    .not-in-room__text {
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }

    .not-in-room__actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
    }

    .not-in-room__hint {
      font-size: 0.875rem;
      color: var(--text-muted);
      margin-top: 1rem;
    }

    .not-in-room__spectator-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: rgba(99, 102, 241, 0.1);
      border-radius: 0.5rem;
      border: 1px solid var(--primary-color);
    }

    /* ============================================
       WAITING MESSAGE STYLES
       ============================================ */
    .waiting-message {
      text-align: center;
      padding: 3rem 1rem;
    }

    .waiting-message__icon {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }

    /* ============================================
       SPECTATOR BANNER & PANEL STYLES
       ============================================ */
    .spectator-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid var(--warning-color);
      border-radius: 0.5rem;
      margin-bottom: 1rem;
    }

    .spectator-banner__icon {
      font-size: 1.25rem;
    }

    .spectator-banner__text {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--warning-color);
    }

    .spectator-banner__action {
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
      font-weight: 500;
      border: 1px solid var(--warning-color);
      border-radius: 0.375rem;
      background: transparent;
      color: var(--warning-color);
      cursor: pointer;
      transition: all 0.2s;
    }

    .spectator-banner__action:hover {
      background: var(--warning-color);
      color: white;
    }

    .spectators-panel {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      padding: 0.75rem;
      margin-bottom: 1rem;
    }

    .spectators-panel__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .spectators-panel__title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .spectators-panel__count {
      padding: 0.125rem 0.5rem;
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning-color);
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .spectators-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .spectators-empty {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .spectator-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.5rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 0.375rem;
      font-size: 0.8125rem;
    }

    .spectator-item--me {
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid var(--primary-color);
    }

    .spectator-item__avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.625rem;
      font-weight: 600;
    }

    .spectator-item__name {
      font-weight: 500;
    }

    /* ============================================
       MULTI-CHANNEL CHAT PANEL STYLES
       ============================================ */
    .chat-panel {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.75rem;
      margin-top: 1.5rem;
      overflow: hidden;
    }

    .chat-panel.collapsed .chat-body {
      display: none;
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem;
      background: var(--bg-color);
      border-bottom: 1px solid var(--border-color);
    }

    .chat-tabs {
      display: flex;
      gap: 0.25rem;
    }

    .chat-tab {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
      font-weight: 500;
      border: none;
      border-radius: 0.375rem;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }

    .chat-tab:hover {
      background: var(--border-color);
      color: var(--text-color);
    }

    .chat-tab.active {
      background: var(--primary-color);
      color: white;
    }

    .chat-tab.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .chat-tab__badge {
      min-width: 1.25rem;
      padding: 0.125rem 0.375rem;
      font-size: 0.6875rem;
      font-weight: 600;
      border-radius: 9999px;
      background: var(--danger-color);
      color: white;
    }

    .chat-tab.active .chat-tab__badge {
      background: rgba(255, 255, 255, 0.3);
    }

    .chat-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: none;
      border-radius: 0.375rem;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }

    .chat-toggle:hover {
      background: var(--border-color);
      color: var(--text-color);
    }

    .chat-toggle__icon {
      width: 1.125rem;
      height: 1.125rem;
    }

    .chat-body {
      display: flex;
      flex-direction: column;
      height: 250px;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .chat-empty {
      color: var(--text-muted);
      font-size: 0.875rem;
      text-align: center;
      padding: 2rem;
    }

    .chat-message {
      display: flex;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 0.5rem;
      background: var(--bg-color);
    }

    .chat-message--system {
      background: rgba(99, 102, 241, 0.1);
      justify-content: center;
      font-size: 0.8125rem;
      color: var(--text-muted);
      font-style: italic;
    }

    .chat-message--muted {
      opacity: 0.3;
    }

    .chat-message__avatar {
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: var(--primary-color);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      flex-shrink: 0;
    }

    .chat-message__content {
      flex: 1;
      min-width: 0;
    }

    .chat-message__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.125rem;
    }

    .chat-message__username {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .chat-message__time {
      font-size: 0.6875rem;
      color: var(--text-muted);
    }

    .chat-message__text {
      font-size: 0.875rem;
      color: var(--text-color);
      word-wrap: break-word;
    }

    .chat-message__mute {
      opacity: 0;
      padding: 0.25rem;
      border: none;
      border-radius: 0.25rem;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: opacity 0.2s, color 0.2s;
    }

    .chat-message:hover .chat-message__mute {
      opacity: 1;
    }

    .chat-message__mute:hover {
      color: var(--danger-color);
    }

    .chat-form {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem;
      border-top: 1px solid var(--border-color);
    }

    .chat-form .chat-input {
      flex: 1;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      border: 1px solid var(--border-color);
      border-radius: 0.375rem;
      background: var(--bg-color);
      color: var(--text-color);
      outline: none;
      transition: border-color 0.2s;
    }

    .chat-form .chat-input:focus {
      border-color: var(--primary-color);
    }

    .chat-form .chat-input:disabled {
      background: rgba(0, 0, 0, 0.2);
      opacity: 0.6;
      cursor: not-allowed;
    }

    .chat-send {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border: none;
      border-radius: 0.375rem;
      background: var(--primary-color);
      color: white;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .chat-send:hover {
      opacity: 0.9;
    }

    .chat-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .chat-send svg {
      width: 1rem;
      height: 1rem;
    }

    .chat-input--disabled {
      opacity: 0.7;
    }

    .chat-input--disabled .chat-input {
      background: rgba(0, 0, 0, 0.2);
      cursor: not-allowed;
    }

    .chat-input--disabled .chat-send {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ============================================
       GAME FOOTER STYLES
       ============================================ */
    .game-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      margin-top: 1rem;
    }

    .game-info {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    /* ============================================
       LEGACY WAITING ROOM (hidden by default)
       ============================================ */
    .legacy-waiting-room {
      display: none;
    }
  </style>

  <div class="game-container">
    <header class="game-header">
      <div class="game-title">
        <span id="headerTitle">Tic Tac Toe</span>
        <span class="game-status game-status--waiting" id="gameStatus">Waiting</span>
      </div>
      <div class="connection-indicator">
        <span class="connection-dot" id="connectionDot"></span>
        <span id="connectionText">Disconnected</span>
      </div>
    </header>

    <!-- Lobby Section -->
    <section id="lobbySection" class="lobby-section">
      <div class="lobby-controls">
        <h2 class="lobby-title">Available Rooms</h2>
        <button class="create-room-btn" id="createRoomBtn">
          <span>+</span> Create Room
        </button>
      </div>

      <div id="loadingState" class="loading-state">
        <div class="spinner"></div>
        <p>Loading rooms...</p>
      </div>

      <div id="emptyState" class="empty-state hidden">
        <div class="empty-state__icon">🎮</div>
        <h3 class="empty-state__title">No Active Rooms</h3>
        <p class="empty-state__message">Create a new room to start playing!</p>
      </div>

      <div id="roomsGrid" class="rooms-grid hidden"></div>
    </section>

    <!-- Game Section (contains all room-related views like BiggerDice) -->
    <section id="gameSection" class="game-section">
      <!-- Waiting state for non-admin players in lobby -->
      <div id="waitingForAdmin" class="waiting-for-admin hidden">
        <div class="waiting-for-admin__icon">⏳</div>
        <div class="waiting-for-admin__title">Waiting in Lobby</div>
        <p class="waiting-for-admin__message">The room admin will select players. Please wait...</p>
        <div id="waitingPlayersList" class="waiting-players-list"></div>
      </div>

      <!-- Admin lobby view - shows waiting players with select/kick/ban actions -->
      <div id="adminLobby" class="admin-lobby hidden">
        <div class="admin-lobby__header">
          <h3 class="admin-lobby__title">Players in Lobby</h3>
          <span class="admin-lobby__count" id="lobbyCount">0 waiting</span>
        </div>
        <div id="lobbyPlayersList" class="lobby-players">
          <div class="lobby-empty">
            <div class="lobby-empty__icon">👥</div>
            <p>No players waiting. Share the room link to invite players!</p>
          </div>
        </div>

        <!-- Banned players section -->
        <div id="bannedPlayersSection" class="banned-players-section hidden">
          <div class="banned-players-header">
            <h4 class="banned-players-title">🚫 Banned Players</h4>
            <span class="banned-players-count" id="bannedCount">0 banned</span>
          </div>
          <div id="bannedPlayersList" class="banned-players-list"></div>
        </div>
      </div>

      <!-- Simple waiting state (when selected, waiting for opponent) -->
      <div id="waitingState" class="waiting-message hidden">
        <div class="waiting-message__icon">Waiting for opponent...</div>
        <p>Share the room link to invite a friend!</p>
      </div>

      <!-- Not-in-room state (when user visits room URL but isn't a member) -->
      <div id="notInRoomState" class="not-in-room hidden">
        <div class="not-in-room__icon">🚪</div>
        <h3 class="not-in-room__title">You are not in this room</h3>
        <p class="not-in-room__text">This room already has players. You can request to join the game.</p>
        <div id="spectatorOptionContainer" class="not-in-room__spectator-option hidden">
          <label class="form-checkbox">
            <input type="checkbox" id="joinAsSpectatorCheckbox">
            <span class="form-checkbox__label">Join as Spectator</span>
          </label>
          <span class="form-hint">Watch the game without participating</span>
        </div>
        <div class="not-in-room__actions">
          <button id="enterRoomBtn" class="game-btn game-btn--primary">
            <span id="enterRoomBtnText">Enter Room</span>
          </button>
        </div>
        <p class="not-in-room__hint" id="notInRoomHint"></p>
      </div>

      <!-- Game Board (contains actual game + spectator elements + chat) -->
      <div id="gameBoard" class="hidden">
        <!-- Spectator Mode Banner (shown when user is a spectator) -->
        <div id="spectatorBanner" class="spectator-banner hidden">
          <span class="spectator-banner__icon">👁</span>
          <span class="spectator-banner__text">You are watching as a spectator</span>
          <button id="requestToPlayBtn" class="spectator-banner__action hidden">Request to Play</button>
        </div>

        <!-- Spectators Panel (shows who's watching) -->
        <div id="spectatorsPanel" class="spectators-panel hidden">
          <div class="spectators-panel__header">
            <span class="spectators-panel__title">
              👁 Watching
              <span class="spectators-panel__count" id="spectatorsCount">0</span>
            </span>
          </div>
          <div class="spectators-list" id="spectatorsList">
            <span class="spectators-empty">No spectators</span>
          </div>
        </div>

        <div class="match-info">
          <div class="player-score player-score--player1">
            <span class="player-score__name">Player 1</span>
            <span class="player-score__mark player-score__mark--x">X</span>
            <span class="player-score__value">0</span>
          </div>
          <div class="vs-divider">VS</div>
          <div class="player-score player-score--player2">
            <span class="player-score__name">Player 2</span>
            <span class="player-score__mark player-score__mark--o">O</span>
            <span class="player-score__value">0</span>
          </div>
        </div>

        <div class="game-number">Game 1 of 9</div>

        <div id="turnIndicator" class="turn-indicator hidden">
          <span class="turn-indicator__text">Waiting...</span>
        </div>

        <div class="turn-timer hidden" id="turnTimer">
          <span class="turn-timer__icon">⏱️</span>
          <div class="turn-timer__content">
            <span class="turn-timer__label">Time remaining</span>
            <div class="turn-timer__bar">
              <div class="turn-timer__progress" id="turnTimerProgress"></div>
            </div>
          </div>
          <span class="turn-timer__text" id="turnTimerText">60</span>
        </div>

        <div class="board-container">
          <div class="board">
            <div class="cell" data-position="0"></div>
            <div class="cell" data-position="1"></div>
            <div class="cell" data-position="2"></div>
            <div class="cell" data-position="3"></div>
            <div class="cell" data-position="4"></div>
            <div class="cell" data-position="5"></div>
            <div class="cell" data-position="6"></div>
            <div class="cell" data-position="7"></div>
            <div class="cell" data-position="8"></div>
          </div>
        </div>

        <div class="action-buttons" id="actionButtons">
          <button class="ready-btn hidden" id="readyBtn">Ready!</button>
        </div>

        <div class="paused-overlay hidden">
          <div class="paused-content">
            <div class="paused-title">Game Paused</div>
            <div class="paused-message">Waiting for opponent to reconnect...</div>
          </div>
        </div>
      </div>

      <!-- Multi-Channel Chat Panel (outside gameBoard so visible in all room states) -->
      <div id="chatPanel" class="chat-panel">
        <div class="chat-header">
          <div class="chat-tabs">
            <button class="chat-tab active" data-channel="lobby" id="chatTabLobby">
              <span class="chat-tab__label">Lobby</span>
              <span class="chat-tab__badge hidden" id="lobbyBadge">0</span>
            </button>
            <button class="chat-tab" data-channel="spectators" id="chatTabSpectators">
              <span class="chat-tab__label">Spectators</span>
              <span class="chat-tab__badge hidden" id="spectatorsBadge">0</span>
            </button>
            <button class="chat-tab" data-channel="players" id="chatTabPlayers">
              <span class="chat-tab__label">Players</span>
              <span class="chat-tab__badge hidden" id="playersBadge">0</span>
            </button>
          </div>
          <button class="chat-toggle" id="chatToggle" title="Toggle chat">
            <svg class="chat-toggle__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
        </div>
        <div class="chat-body" id="chatBody">
          <div class="chat-messages" id="chatMessages">
            <div class="chat-empty">No messages yet. Say hello!</div>
          </div>
          <form class="chat-form" id="chatForm">
            <input type="text" class="chat-input" id="chatInput" placeholder="Type a message..." maxlength="500" autocomplete="off">
            <button type="submit" class="chat-send" id="chatSend">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>

      <footer class="game-footer" id="gameFooter">
        <span class="round-info" id="roundInfo">Best of 9 - First to 5 wins</span>
        <button class="leave-btn" id="leaveBtn">Leave Game</button>
      </footer>
    </section>

    <!-- Game Result Overlay -->
    <div class="game-result">
      <div class="game-result__content">
        <h2 class="game-result__title">Match Complete!</h2>
        <p class="game-result__message"></p>
        <p class="game-result__prize"></p>
        <button class="game-result__btn">Back to Lobby</button>
      </div>
    </div>

    <!-- Create Room Modal -->
    <div id="createRoomModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Create Room</h3>
          <button class="modal-close" id="modalCloseBtn">&times;</button>
        </div>
        <form id="createRoomForm">
          <div class="form-group">
            <label class="form-label" for="roomNameInput">Room Name</label>
            <input type="text" class="form-input" id="roomNameInput" placeholder="Enter room name..." maxlength="50" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="roomPasswordInput">Password <span class="form-label__optional">(optional)</span></label>
            <input type="password" class="form-input" id="roomPasswordInput" placeholder="Leave empty for public room" maxlength="50">
            <span class="form-hint">Protected rooms require a password to join</span>
          </div>
          <div class="form-group form-group--checkbox">
            <label class="form-checkbox">
              <input type="checkbox" id="allowSpectatorsInput" checked>
              <span class="form-checkbox__label">Allow Spectators</span>
            </label>
            <span class="form-hint">Let others watch the game without participating</span>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="modalCancelBtn">Cancel</button>
            <button type="submit" class="btn-primary" id="modalCreateBtn">Create</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Join Password Modal -->
    <div id="joinPasswordModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Enter Room Password</h3>
          <button class="modal-close" id="joinPasswordCloseBtn">&times;</button>
        </div>
        <form id="joinPasswordForm">
          <div class="form-group">
            <label class="form-label" for="joinPasswordInput">Password</label>
            <input type="password" class="form-input" id="joinPasswordInput" placeholder="Enter room password..." required>
            <p class="form-error hidden" id="joinPasswordError">Incorrect password</p>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="joinPasswordCancelBtn">Cancel</button>
            <button type="submit" class="btn-primary">Join Room</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Create Room Confirmation Modal -->
    <div id="createConfirmModal" class="modal-overlay">
      <div class="modal-content modal-content--small">
        <div class="modal-header">
          <h3 class="modal-title">Create Game Room</h3>
          <button class="modal-close" id="createConfirmCloseBtn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="confirm-loader" id="createConfirmLoader">
            <div class="loader-spinner"></div>
            <p class="loader-text">Checking balance...</p>
          </div>
          <p class="confirm-message hidden" id="createConfirmMessage"></p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="createConfirmCancelBtn">Cancel</button>
          <button type="button" class="btn-primary hidden" id="createConfirmBtn">Create Room</button>
        </div>
      </div>
    </div>

    <!-- Join Room Confirmation Modal -->
    <div id="joinConfirmModal" class="modal-overlay">
      <div class="modal-content modal-content--small">
        <div class="modal-header">
          <h3 class="modal-title">Join Game Room</h3>
          <button class="modal-close" id="joinConfirmCloseBtn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="confirm-loader" id="joinConfirmLoader">
            <div class="loader-spinner"></div>
            <p class="loader-text">Checking balance...</p>
          </div>
          <p class="confirm-message hidden" id="joinConfirmMessage"></p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" id="joinConfirmCancelBtn">Cancel</button>
          <button type="button" class="btn-primary hidden" id="joinConfirmBtn">Join Room</button>
        </div>
      </div>
    </div>

    <!-- Toast Container -->
    <div class="toast-container" id="toastContainer"></div>
  </div>
`;

export class TicTacToe extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        // State
        this.ws = null;
        this.wsUrl = '';
        this.userId = '';
        this.username = '';
        this.avatarId = '';
        this.roomId = '';
        this.roomName = '';
        this.mode = 'lobby';
        this.wsConnected = false;
        this.isSpectator = false;

        // Game state
        this.board = Array(9).fill(null);
        this.playerXId = null;
        this.playerOId = null;
        this.currentTurn = null;
        this.scores = {};
        this.gameNumber = 1;
        this.moveDeadline = null;
        this.isGamePaused = false;
        this.winningLine = null;

        // Timer
        this.timerInterval = null;
        this.timeRemaining = TURN_TIMER_SECONDS;

        // Rooms list
        this.rooms = [];

        // Players in waiting room
        this.players = [];
        this.selectedPlayers = [];
        this.isReady = false;
        this.isHost = false;

        // Room to join
        this.roomToJoin = null;

        // Lobby state (BiggerDice parity)
        this.lobby = [];              // Players waiting in lobby
        this.bannedPlayers = [];      // Banned players list
        this.spectators = [];         // Spectators watching
        this.hostId = null;           // Room admin user ID
        this.isAdmin = false;         // Is current user admin
        this.notInRoomInfo = null;    // Room info when not a member
        this.wantsToSpectate = false; // Join as spectator flag
        this.maxPlayers = 2;          // TicTacToe is always 2 players
        this.allowSpectators = true;  // Whether spectators can join

        // Multi-channel chat state (replaces simple chatMessages array)
        this.chatChannel = 'lobby';
        this.chatMessages = {
            lobby: [],
            players: [],
            spectators: []
        };
        this.chatHistoryRequested = {
            lobby: false,
            players: false,
            spectators: false
        };
        this.chatUnreadCounts = {
            lobby: 0,
            players: 0,
            spectators: 0
        };
        this.mutedUsers = new Set();
        this.isChatCollapsed = false;
        this.isPlayer = false;        // Whether current user is a player

        // Window event handlers for disconnect detection
        this.windowEventsBound = false;
        this.hasSentDisconnectIntent = false;
        this._handlePageHide = null;
        this._handleBeforeUnload = null;
        this._handleOffline = null;

        // Element references
        this.els = {};

        this._bindElements();
        this._bindEvents();
    }

    connectedCallback() {
        this.wsUrl = this.dataset.wsUrl || '';
        this.userId = this.dataset.userId || '';
        this.username = this.dataset.username || '';
        this.avatarId = this.dataset.avatarId || '';
        this.roomId = this.dataset.roomId || '';
        this.roomName = this.dataset.roomName || '';
        this.mode = this.dataset.mode || 'lobby';

        this._bindWindowEvents();
        this._connect();
    }

    disconnectedCallback() {
        this._unbindWindowEvents();
        this._disconnect();
    }

    _bindElements() {
        const s = this.shadowRoot;
        this.els = {
            // Header elements
            headerTitle: s.querySelector('#headerTitle'),
            gameStatus: s.querySelector('#gameStatus'),
            connectionDot: s.querySelector('#connectionDot'),
            connectionText: s.querySelector('#connectionText'),
            // Main sections
            lobbySection: s.querySelector('#lobbySection'),
            gameSection: s.querySelector('#gameSection'),
            gameBoard: s.querySelector('#gameBoard'),
            roomsGrid: s.querySelector('#roomsGrid'),
            loadingState: s.querySelector('#loadingState'),
            emptyState: s.querySelector('#emptyState'),
            createRoomBtn: s.querySelector('#createRoomBtn'),
            // Create Room Modal
            createRoomModal: s.querySelector('#createRoomModal'),
            createRoomForm: s.querySelector('#createRoomForm'),
            roomNameInput: s.querySelector('#roomNameInput'),
            roomPasswordInput: s.querySelector('#roomPasswordInput'),
            allowSpectatorsInput: s.querySelector('#allowSpectatorsInput'),
            modalCloseBtn: s.querySelector('#modalCloseBtn'),
            modalCancelBtn: s.querySelector('#modalCancelBtn'),
            // Join Password Modal
            joinPasswordModal: s.querySelector('#joinPasswordModal'),
            joinPasswordForm: s.querySelector('#joinPasswordForm'),
            joinPasswordInput: s.querySelector('#joinPasswordInput'),
            joinPasswordError: s.querySelector('#joinPasswordError'),
            joinPasswordCloseBtn: s.querySelector('#joinPasswordCloseBtn'),
            joinPasswordCancelBtn: s.querySelector('#joinPasswordCancelBtn'),
            // Create confirmation modal
            createConfirmModal: s.querySelector('#createConfirmModal'),
            createConfirmLoader: s.querySelector('#createConfirmLoader'),
            createConfirmMessage: s.querySelector('#createConfirmMessage'),
            createConfirmCloseBtn: s.querySelector('#createConfirmCloseBtn'),
            createConfirmCancelBtn: s.querySelector('#createConfirmCancelBtn'),
            createConfirmBtn: s.querySelector('#createConfirmBtn'),
            // Join confirmation modal
            joinConfirmModal: s.querySelector('#joinConfirmModal'),
            joinConfirmLoader: s.querySelector('#joinConfirmLoader'),
            joinConfirmMessage: s.querySelector('#joinConfirmMessage'),
            joinConfirmCloseBtn: s.querySelector('#joinConfirmCloseBtn'),
            joinConfirmCancelBtn: s.querySelector('#joinConfirmCancelBtn'),
            joinConfirmBtn: s.querySelector('#joinConfirmBtn'),
            // Action buttons
            actionButtons: s.querySelector('#actionButtons'),
            readyBtn: s.querySelector('#readyBtn'),
            // Admin Lobby
            waitingForAdmin: s.querySelector('#waitingForAdmin'),
            waitingPlayersList: s.querySelector('#waitingPlayersList'),
            adminLobby: s.querySelector('#adminLobby'),
            lobbyCount: s.querySelector('#lobbyCount'),
            lobbyPlayersList: s.querySelector('#lobbyPlayersList'),
            bannedPlayersSection: s.querySelector('#bannedPlayersSection'),
            bannedCount: s.querySelector('#bannedCount'),
            bannedPlayersList: s.querySelector('#bannedPlayersList'),
            waitingState: s.querySelector('#waitingState'),
            // Not-in-room state
            notInRoomState: s.querySelector('#notInRoomState'),
            enterRoomBtn: s.querySelector('#enterRoomBtn'),
            enterRoomBtnText: s.querySelector('#enterRoomBtnText'),
            notInRoomHint: s.querySelector('#notInRoomHint'),
            spectatorOptionContainer: s.querySelector('#spectatorOptionContainer'),
            joinAsSpectatorCheckbox: s.querySelector('#joinAsSpectatorCheckbox'),
            // Spectator elements
            spectatorBanner: s.querySelector('#spectatorBanner'),
            requestToPlayBtn: s.querySelector('#requestToPlayBtn'),
            spectatorsPanel: s.querySelector('#spectatorsPanel'),
            spectatorsCount: s.querySelector('#spectatorsCount'),
            spectatorsList: s.querySelector('#spectatorsList'),
            // Game footer
            gameFooter: s.querySelector('#gameFooter'),
            roundInfo: s.querySelector('#roundInfo'),
            leaveBtn: s.querySelector('#leaveBtn'),
            // Game board elements
            board: s.querySelector('.board'),
            cells: s.querySelectorAll('.cell'),
            player1Score: s.querySelector('.player-score--player1'),
            player2Score: s.querySelector('.player-score--player2'),
            gameNumber: s.querySelector('.game-number'),
            turnIndicator: s.querySelector('#turnIndicator'),
            turnIndicatorText: s.querySelector('.turn-indicator__text'),
            turnTimer: s.querySelector('#turnTimer'),
            turnTimerProgress: s.querySelector('#turnTimerProgress'),
            turnTimerText: s.querySelector('#turnTimerText'),
            pausedOverlay: s.querySelector('.paused-overlay'),
            // Game result
            gameResult: s.querySelector('.game-result'),
            gameResultTitle: s.querySelector('.game-result__title'),
            gameResultMessage: s.querySelector('.game-result__message'),
            gameResultPrize: s.querySelector('.game-result__prize'),
            gameResultBtn: s.querySelector('.game-result__btn'),
            // Multi-channel Chat
            chatPanel: s.querySelector('#chatPanel'),
            chatTabLobby: s.querySelector('#chatTabLobby'),
            chatTabPlayers: s.querySelector('#chatTabPlayers'),
            chatTabSpectators: s.querySelector('#chatTabSpectators'),
            lobbyBadge: s.querySelector('#lobbyBadge'),
            playersBadge: s.querySelector('#playersBadge'),
            spectatorsBadge: s.querySelector('#spectatorsBadge'),
            chatToggle: s.querySelector('#chatToggle'),
            chatBody: s.querySelector('#chatBody'),
            chatMessages: s.querySelector('#chatMessages'),
            chatForm: s.querySelector('#chatForm'),
            chatInput: s.querySelector('#chatInput'),
            chatSend: s.querySelector('#chatSend'),
            // Legacy chat (for backwards compatibility)
            chatSendBtn: s.querySelector('.chat-send-btn'),
            // Toast
            toastContainer: s.querySelector('#toastContainer'),
        };
    }

    _bindEvents() {
        // Create room button
        this.els.createRoomBtn.addEventListener('click', () => this._showCreateRoomModal());
        this.els.modalCloseBtn.addEventListener('click', () => this._hideCreateRoomModal());
        this.els.modalCancelBtn.addEventListener('click', () => this._hideCreateRoomModal());
        this.els.createRoomForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this._createRoom();
        });

        // Join password modal
        this.els.joinPasswordCloseBtn.addEventListener('click', () => this._hideJoinRoomModal());
        this.els.joinPasswordCancelBtn.addEventListener('click', () => this._hideJoinRoomModal());
        this.els.joinPasswordForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this._confirmJoinRoom();
        });

        // Close modals when clicking overlay
        this.els.createRoomModal.addEventListener('click', (e) => {
            if (e.target === this.els.createRoomModal) this._hideCreateRoomModal();
        });
        this.els.joinPasswordModal.addEventListener('click', (e) => {
            if (e.target === this.els.joinPasswordModal) this._hideJoinRoomModal();
        });

        // Create confirmation modal
        this.els.createConfirmCloseBtn.addEventListener('click', () => this._hideCreateConfirmModal());
        this.els.createConfirmCancelBtn.addEventListener('click', () => this._hideCreateConfirmModal());
        this.els.createConfirmBtn.addEventListener('click', () => {
            this._hideCreateConfirmModal();
            this._executeCreateRoom();
        });
        this.els.createConfirmModal.addEventListener('click', (e) => {
            if (e.target === this.els.createConfirmModal) this._hideCreateConfirmModal();
        });

        // Join confirmation modal
        this.els.joinConfirmCloseBtn.addEventListener('click', () => this._hideJoinConfirmModal());
        this.els.joinConfirmCancelBtn.addEventListener('click', () => this._hideJoinConfirmModal());
        this.els.joinConfirmBtn.addEventListener('click', () => {
            this._hideJoinConfirmModal();
            this._executeJoinRoom();
        });
        this.els.joinConfirmModal.addEventListener('click', (e) => {
            if (e.target === this.els.joinConfirmModal) this._hideJoinConfirmModal();
        });

        // Waiting room
        this.els.readyBtn.addEventListener('click', () => this._toggleReady());
        this.els.leaveBtn.addEventListener('click', () => this._leaveRoom());

        // Board clicks
        this.els.cells.forEach(cell => {
            cell.addEventListener('click', () => this._handleCellClick(cell));
        });

        // Game result
        this.els.gameResultBtn.addEventListener('click', () => this._backToLobby());

        // Multi-channel Chat
        if (this.els.chatTabLobby) {
            this.els.chatTabLobby.addEventListener('click', () => this._switchChatChannel('lobby'));
        }
        if (this.els.chatTabPlayers) {
            this.els.chatTabPlayers.addEventListener('click', () => this._switchChatChannel('players'));
        }
        if (this.els.chatTabSpectators) {
            this.els.chatTabSpectators.addEventListener('click', () => this._switchChatChannel('spectators'));
        }
        if (this.els.chatToggle) {
            this.els.chatToggle.addEventListener('click', () => this._toggleChat());
        }
        if (this.els.chatForm) {
            this.els.chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this._sendChatMessage();
            });
        }
        if (this.els.chatSend) {
            this.els.chatSend.addEventListener('click', () => this._sendChatMessage());
        }
        if (this.els.chatInput) {
            this.els.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this._sendChatMessage();
            });
        }

        // Enter Room button (for not-in-room state)
        if (this.els.enterRoomBtn) {
            this.els.enterRoomBtn.addEventListener('click', () => this._handleEnterRoomClick());
        }

        // Join as Spectator checkbox (for not-in-room state)
        if (this.els.joinAsSpectatorCheckbox) {
            this.els.joinAsSpectatorCheckbox.addEventListener('change', (e) => {
                this.wantsToSpectate = e.target.checked;
                this._updateEnterRoomButton();
            });
        }

        // Spectator "Request to Play" button
        if (this.els.requestToPlayBtn) {
            this.els.requestToPlayBtn.addEventListener('click', () => this._requestToPlay());
        }

        // Game footer leave button
        if (this.els.leaveBtn) {
            this.els.leaveBtn.addEventListener('click', () => this._leaveRoom());
        }
    }

    _connect() {
        if (!this.wsUrl) return;

        this._updateConnectionStatus('connecting');
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
            console.log('[TicTacToe] WebSocket connected');
            this._updateConnectionStatus('connected');
            this._authenticate();
        };

        this.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                this._handleMessage(msg);
            } catch (e) {
                console.error('[TicTacToe] Failed to parse message:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('[TicTacToe] WebSocket closed');
            this._updateConnectionStatus('disconnected');
            setTimeout(() => this._connect(), 3000);
        };

        this.ws.onerror = (err) => {
            console.error('[TicTacToe] WebSocket error:', err);
        };
    }

    _disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._stopTimer();
    }

    _bindWindowEvents() {
        if (this.windowEventsBound) return;

        this._handlePageHide = () => this._notifyDisconnectIntent();
        this._handleBeforeUnload = () => this._notifyDisconnectIntent();
        this._handleOffline = () => {
            this._notifyDisconnectIntent();
            this.ws?.close();
        };

        window.addEventListener('pagehide', this._handlePageHide);
        window.addEventListener('beforeunload', this._handleBeforeUnload);
        window.addEventListener('offline', this._handleOffline);
        this.windowEventsBound = true;
    }

    _unbindWindowEvents() {
        if (!this.windowEventsBound) return;

        if (this._handlePageHide) {
            window.removeEventListener('pagehide', this._handlePageHide);
        }
        if (this._handleBeforeUnload) {
            window.removeEventListener('beforeunload', this._handleBeforeUnload);
        }
        if (this._handleOffline) {
            window.removeEventListener('offline', this._handleOffline);
        }

        this._handlePageHide = null;
        this._handleBeforeUnload = null;
        this._handleOffline = null;
        this.windowEventsBound = false;
    }

    _notifyDisconnectIntent() {
        if (this.hasSentDisconnectIntent) return;
        if (!this.roomId) return;
        // Only notify if we're actually in a room (playing or waiting)
        if (this.mode === 'lobby') return;
        if (this.isSpectator) return;

        this.hasSentDisconnectIntent = true;
        this._send({
            type: 'games.command.leave_room',
            room_id: this.roomId,
        });
    }

    _send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    _authenticate() {
        this._send({
            type: 'system.authenticate',
            user_id: this.userId,
            username: this.username,
            avatar_id: this.avatarId || null,
        });
    }

    _updateConnectionStatus(status) {
        this.wsConnected = status === 'connected';
        if (this.els.connectionDot) {
            this.els.connectionDot.className = 'connection-dot';
            if (status === 'connected') {
                this.els.connectionDot.classList.add('connection-dot--connected');
            } else if (status === 'connecting') {
                this.els.connectionDot.classList.add('connection-dot--connecting');
            }
        }
        if (this.els.connectionText) {
            if (status === 'connected') {
                this.els.connectionText.textContent = 'Connected';
            } else if (status === 'connecting') {
                this.els.connectionText.textContent = 'Connecting...';
            } else {
                this.els.connectionText.textContent = 'Disconnected';
            }
        }
    }

    _updateGameStatus(status) {
        if (!this.els.gameStatus) return;

        this.els.gameStatus.className = 'game-status';
        switch (status) {
            case 'waiting':
                this.els.gameStatus.classList.add('game-status--waiting');
                this.els.gameStatus.textContent = 'Waiting';
                break;
            case 'playing':
                this.els.gameStatus.classList.add('game-status--playing');
                this.els.gameStatus.textContent = 'Playing';
                break;
            case 'finished':
                this.els.gameStatus.classList.add('game-status--finished');
                this.els.gameStatus.textContent = 'Finished';
                break;
            default:
                this.els.gameStatus.classList.add('game-status--waiting');
                this.els.gameStatus.textContent = 'Waiting';
        }
    }

    _updateHeaderTitle(title) {
        if (this.els.headerTitle) {
            this.els.headerTitle.textContent = title || 'Tic Tac Toe';
        }
    }

    _handleMessage(msg) {
        console.log('[TicTacToe] Message:', msg.type, msg);

        switch (msg.type) {
            case 'system.authenticated':
                this._onAuthenticated(msg);
                break;
            case 'games.event.room_list':
                this._onRoomList(msg);
                break;
            // Room created - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.room_created':
                this._onRoomCreated(msg);
                break;
            // Room removed - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.room_removed':
                this._onRoomRemoved(msg);
                break;
            // Room state - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.room_state':
                this._onRoomState(msg);
                break;
            // Waiting room updates - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.player_selected':
            case 'games.event.tic_tac_toe.lobby_joined':
            case 'games.event.tic_tac_toe.player_ready_changed':
            case 'games.event.tic_tac_toe.selected_players_updated':
                this._onWaitingRoomUpdate(msg);
                break;
            // Game started - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.game_started':
                this._onGameStarted(msg);
                break;
            case 'games.event.tic_tac_toe.turn_changed':
                this._onTurnChanged(msg);
                break;
            case 'games.event.tic_tac_toe.moved':
                this._onMoveMade(msg);
                break;
            case 'games.event.tic_tac_toe.game_result':
                this._onGameResult(msg);
                break;
            case 'games.event.tic_tac_toe.match_ended':
                this._onMatchEnded(msg);
                break;
            case 'games.event.tic_tac_toe.state':
                this._onStateSync(msg);
                break;
            case 'games.event.tic_tac_toe.turn_timeout':
                this._onTurnTimeout(msg);
                break;
            case 'games.event.tic_tac_toe.game_paused':
                this._onGamePaused(msg);
                break;
            case 'games.event.tic_tac_toe.game_resumed':
                this._onGameResumed(msg);
                break;
            case 'games.event.tic_tac_toe.chat_message':
                this._handleChatMessage(msg);
                break;
            case 'games.event.tic_tac_toe.chat_history':
                this._handleChatHistory(msg);
                break;
            // Player left - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.player_left':
                this._onPlayerLeft(msg);
                break;
            // Admin/Lobby events - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.lobby_updated':
                this._onLobbyUpdated(msg);
                break;
            // Player kicked - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.player_kicked':
                this._onPlayerKicked(msg);
                break;
            // Player banned - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.player_banned':
                this._onPlayerBanned(msg);
                break;
            // Player unbanned - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.player_unbanned':
                this._onPlayerUnbanned(msg);
                break;
            case 'games.event.tic_tac_toe.not_in_room':
                this._onNotInRoom(msg);
                break;
            // Spectator events - tic_tac_toe prefixed
            case 'games.event.tic_tac_toe.spectator_joined':
                this._onSpectatorJoined(msg);
                break;
            case 'games.event.tic_tac_toe.spectator_left':
                this._onSpectatorLeft(msg);
                break;
            case 'games.event.tic_tac_toe.request_to_play_accepted':
                this._onRequestToPlayAccepted(msg);
                break;
            case 'system.error':
                this._onError(msg);
                break;
        }
    }

    _onAuthenticated(msg) {
        console.log('[TicTacToe] Authenticated as', msg.username);

        if (this.mode === 'lobby') {
            this._showLobby();
            this._listRooms();
        } else if (this.roomId) {
            // Join/rejoin the room - roomId from URL is the UUID
            this._send({
                type: 'games.command.rejoin_room',
                room_id: this.roomId,
            });
        }
    }

    _listRooms() {
        this._send({
            type: 'games.command.list_rooms',
            game_type: 'tic_tac_toe',
        });
    }

    _onRoomList(msg) {
        console.log('[TicTacToe] Rooms list received:', msg.rooms);
        this.rooms = msg.rooms || [];
        this._renderRooms();
    }

    _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    _formatStatus(status) {
        if (status === 'waiting') return 'Waiting';
        if (status === 'in_progress') return 'In Progress';
        return status;
    }

    _renderRooms() {
        // Filter for tic_tac_toe rooms, excluding rooms we're already in
        const ticTacToeRooms = this.rooms.filter(r => {
            if (r.game_type !== 'tic_tac_toe') return false;
            // Don't show rooms we're currently in
            if (this.roomId && r.room_id === this.roomId) return false;
            return true;
        });

        // Hide loading state
        this.els.loadingState.classList.add('hidden');

        if (ticTacToeRooms.length === 0) {
            this.els.roomsGrid.classList.add('hidden');
            this.els.emptyState.classList.remove('hidden');
            return;
        }

        this.els.emptyState.classList.add('hidden');
        this.els.roomsGrid.classList.remove('hidden');

        this.els.roomsGrid.innerHTML = ticTacToeRooms.map(room => {
            const currentPlayers = room.players?.length || 0;
            const maxPlayers = room.player_count || room.max_players || 2;
            const spectatorCount = room.spectator_count || 0;
            const allowSpectators = room.allow_spectators === true;
            const isFull = currentPlayers >= maxPlayers;
            const canRejoin = room.can_rejoin === true;

            return `
            <div class="room-card" data-room-id="${room.room_id}">
                <div class="room-card__header">
                    <span class="room-card__name">
                        ${this._escapeHtml(room.room_name)}
                        ${room.is_password_protected ? `
                            <span class="room-card__lock" title="Password protected">
                                <svg class="room-card__lock-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </span>
                        ` : ''}
                    </span>
                    <span class="room-card__status room-card__status--${room.status}">${this._formatStatus(room.status)}</span>
                </div>
                <div class="room-card__info">
                    <span class="room-card__info-item" title="Players">
                        <svg class="room-card__info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        ${currentPlayers}/${maxPlayers}
                    </span>
                    ${allowSpectators ? `
                        <span class="room-card__info-item" title="Spectators">
                            <svg class="room-card__info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            ${spectatorCount}
                        </span>
                    ` : `
                        <span class="room-card__no-spectators" title="Spectators not allowed">No spectators</span>
                    `}
                </div>
                <div class="room-card__players">
                    ${(room.players || []).map(p => `
                        <span class="player-badge ${p.is_ready ? 'player-badge--ready' : ''}">${this._escapeHtml(p.username || p.name)}</span>
                    `).join('')}
                    ${currentPlayers < maxPlayers ? '<span class="player-badge">Waiting...</span>' : ''}
                </div>
                <div class="room-card__actions">
                    ${canRejoin ? `
                        <button class="join-btn" data-action="rejoin" data-room-id="${room.room_id}" data-room-name="${this._escapeHtml(room.room_name)}" data-protected="${room.is_password_protected || false}">Rejoin</button>
                    ` : ''}
                    ${!canRejoin && room.status === 'waiting' && !isFull ? `
                        <button class="join-btn" data-action="join" data-room-id="${room.room_id}" data-room-name="${this._escapeHtml(room.room_name)}" data-protected="${room.is_password_protected || false}">Join Game</button>
                    ` : ''}
                    ${!canRejoin && allowSpectators ? `
                        <button class="spectate-btn" data-action="spectate" data-room-id="${room.room_id}">
                            ${room.status === 'waiting' ? 'Spectate' : 'Watch'}
                        </button>
                    ` : ''}
                </div>
            </div>
        `}).join('');

        // Bind room card action events
        this.els.roomsGrid.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const roomId = e.target.dataset.roomId;
                const roomName = e.target.dataset.roomName;
                const action = e.target.dataset.action;
                const isProtected = e.target.dataset.protected === 'true';

                if (action === 'rejoin') {
                    // Rejoin uses room_id directly, no balance check needed (already paid)
                    this._rejoinRoom(roomId);
                } else if (action === 'join') {
                    // Navigate to room and show "not in room" state (like BiggerDice)
                    // User must click "Enter Room" to actually join
                    this._showNotInRoomView(roomId);
                } else if (action === 'spectate') {
                    this._spectateRoom(roomId);
                }
            });
        });
    }

    _rejoinRoom(roomId) {
        // Rejoin doesn't need balance check - user already paid
        this._send({
            type: 'games.command.rejoin_room',
            room_id: roomId,
        });
    }

    _joinRoomByName(roomName) {
        // Check if we're already in this room
        if (this.roomName === roomName && this.roomId) {
            console.log('[TicTacToe] Already in this room, requesting room state instead');
            this._send({
                type: 'games.command.get_room_state',
                room_name: roomName,
            });
            return;
        }

        // Store room data for confirmation
        this._pendingJoinData = {
            roomName: roomName,
            password: null,
        };
        this._showJoinConfirmModal();
    }

    _spectateRoom(roomId) {
        // Spectators can join for free - no balance check needed
        this._send({
            type: 'games.command.spectate',
            room_id: roomId,
        });
    }

    _showLobby() {
        this.mode = 'lobby';
        this.els.lobbySection.classList.add('active');
        this.els.gameSection.classList.remove('active');
        // Hide all game section sub-views
        this._hideAllGameSubViews();
        // Reset header
        this._updateHeaderTitle('Tic Tac Toe');
        this._updateGameStatus('waiting');
        // Reset room state
        this.roomId = null;
        this.roomName = null;
        this.isHost = false;
        this.isAdmin = false;
        this.hostId = null;
        this.lobby = [];
        this.players = [];
        this.spectators = [];
        this.bannedPlayers = [];
        this.notInRoomInfo = null;
        this.wantsToSpectate = false;
    }

    _showWaitingRoom() {
        this.mode = 'room';
        this.els.lobbySection.classList.remove('active');
        this.els.gameSection.classList.add('active');
        // Hide all sub-views first, then show appropriate one via _updateGameUI
        this._hideAllGameSubViews();
    }

    _showGame() {
        this.mode = 'game';
        this.els.lobbySection.classList.remove('active');
        this.els.gameSection.classList.add('active');
        // Show game board, hide other sub-views
        this._hideAllGameSubViews();
        this.els.gameBoard.classList.remove('hidden');
    }

    _hideAllGameSubViews() {
        // Hide all sub-views within gameSection
        if (this.els.waitingForAdmin) this.els.waitingForAdmin.classList.add('hidden');
        if (this.els.adminLobby) this.els.adminLobby.classList.add('hidden');
        if (this.els.waitingState) this.els.waitingState.classList.add('hidden');
        if (this.els.notInRoomState) this.els.notInRoomState.classList.add('hidden');
        if (this.els.gameBoard) this.els.gameBoard.classList.add('hidden');
    }

    _showCreateRoomModal() {
        this.els.createRoomModal.classList.add('active');
        this.els.roomNameInput.value = '';
        this.els.roomPasswordInput.value = '';
        this.els.allowSpectatorsInput.checked = true;
        this.els.roomNameInput.focus();
    }

    _hideCreateRoomModal() {
        this.els.createRoomModal.classList.remove('active');
    }

    _createRoom() {
        const roomName = this.els.roomNameInput.value.trim();
        if (!roomName) {
            this.els.roomNameInput.focus();
            return;
        }

        // Store room data for later use
        this._pendingRoomData = {
            roomName: roomName,
            password: this.els.roomPasswordInput.value || null,
            allowSpectators: this.els.allowSpectatorsInput.checked,
        };

        // Hide create room modal and show confirmation
        this._hideCreateRoomModal();
        this._showCreateConfirmModal();
    }

    async _showCreateConfirmModal() {
        console.log('[TicTacToe] showCreateConfirmModal called');

        // Show modal with loader
        this.els.createConfirmModal.classList.add('active');

        // Show loader, hide message and button
        this.els.createConfirmLoader.classList.remove('hidden');
        this.els.createConfirmMessage.classList.add('hidden');
        this.els.createConfirmBtn.classList.add('hidden');

        try {
            // Fetch user balance from API
            const response = await fetch('/api/v1/user', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }

            const data = await response.json();
            const balance = data.user?.balance ?? 0;
            const hasEnoughBalance = balance >= 1000;

            console.log('[TicTacToe] User balance:', balance, 'Has enough:', hasEnoughBalance);

            // Hide loader
            this.els.createConfirmLoader.classList.add('hidden');

            // Show message
            if (hasEnoughBalance) {
                this.els.createConfirmMessage.textContent = 'Creating this game will cost 1000 coins. Are you sure you want to proceed?';
                this.els.createConfirmMessage.classList.remove('confirm-message--error');
                this.els.createConfirmBtn.classList.remove('hidden');
            } else {
                this.els.createConfirmMessage.textContent = 'You do not have enough balance to create a game. You need at least 1000 coins.';
                this.els.createConfirmMessage.classList.add('confirm-message--error');
                this.els.createConfirmBtn.classList.add('hidden');
            }
            this.els.createConfirmMessage.classList.remove('hidden');

        } catch (error) {
            console.error('[TicTacToe] Error fetching balance:', error);

            // Hide loader
            this.els.createConfirmLoader.classList.add('hidden');

            // Show error message
            this.els.createConfirmMessage.textContent = 'Failed to check balance. Please try again.';
            this.els.createConfirmMessage.classList.add('confirm-message--error');
            this.els.createConfirmMessage.classList.remove('hidden');
            this.els.createConfirmBtn.classList.add('hidden');
        }
    }

    _hideCreateConfirmModal() {
        console.log('[TicTacToe] hideCreateConfirmModal called');
        this.els.createConfirmModal.classList.remove('active');
    }

    _executeCreateRoom() {
        if (!this._pendingRoomData) return;

        const { roomName, password, allowSpectators } = this._pendingRoomData;

        this._send({
            type: 'games.command.create_room',
            game_type: 'tic_tac_toe',
            room_name: roomName,
            password: password,
            max_players: 2,
            allow_spectators: allowSpectators,
        });

        this._pendingRoomData = null;
    }

    _onRoomCreated(msg) {
        console.log('[TicTacToe] Room created:', msg);

        // Filter events that aren't for tic_tac_toe
        if (msg.game_type && msg.game_type !== 'tic_tac_toe') {
            console.log('[TicTacToe] Ignoring room_created for different game:', msg.game_type);
            return;
        }

        // Normalize to strings for comparison
        const hostIdStr = String(msg.host_id);
        const userIdStr = String(this.userId);

        // If we created the room, navigate to it
        if (hostIdStr === userIdStr) {
            console.log('[TicTacToe] We are the host, entering room');
            this.roomId = msg.room_id;
            this.roomName = msg.room_name;
            this.isHost = true;
            this.isAdmin = true;
            this.hostId = msg.host_id;
            this.allowSpectators = msg.allow_spectators === true;
            this.maxPlayers = msg.player_count || msg.max_players || 2;

            // Initialize lobby with ourselves as the only player
            this.lobby = [{
                user_id: this.userId,
                username: this.username,
                is_ready: false,
            }];
            this.players = [];
            this.spectators = [];
            this.bannedPlayers = [];

            // Update header and status
            this._updateHeaderTitle(msg.room_name || `Room ${msg.room_id}`);
            this._updateGameStatus('waiting');

            // Show waiting room and render admin lobby
            this._showWaitingRoom();
            this._updateGameUI();
        } else {
            // Add the new room directly to the list for instant update (for other players)
            console.log('[TicTacToe] Not the host, adding room to lobby list');
            const newRoom = {
                room_id: msg.room_id,
                room_name: msg.room_name,
                game_type: msg.game_type || 'tic_tac_toe',
                host_name: msg.host_name || msg.host_username || 'Unknown',
                status: 'waiting',
                players: [{ user_id: msg.host_id, username: msg.host_username }],
                player_count: msg.player_count || 2,
                max_players: msg.player_count || msg.max_players || 2,
                spectator_count: 0,
                allow_spectators: msg.allow_spectators === true,
                is_password_protected: msg.is_password_protected || false,
            };

            // Only add if we're in lobby mode and room doesn't already exist
            if (this.mode === 'lobby') {
                const exists = this.rooms.some(r => r.room_id === newRoom.room_id);
                if (!exists) {
                    this.rooms.unshift(newRoom); // Add at beginning (newest first)
                    this._renderRooms();
                }
            }
        }
    }

    _onRoomRemoved(msg) {
        console.log('[TicTacToe] Room removed:', msg);
        const roomId = msg.room_id;
        const reason = msg.reason || 'unknown';

        // Remove from rooms array
        const initialLength = this.rooms.length;
        this.rooms = this.rooms.filter(r => r.room_id !== roomId);

        if (this.rooms.length < initialLength) {
            console.log(`[TicTacToe] Room ${roomId} removed from list (reason: ${reason})`);
            // Re-render the room list if we're in lobby mode
            if (this.mode === 'lobby') {
                this._renderRooms();
            }
        }

        // If we're currently in this room and it's being removed, show message and return to lobby
        // BUT NOT if the reason is "game_started" - that's a valid transition, not a room closure
        if (this.roomId === roomId && this.mode !== 'lobby' && reason !== 'game_started') {
            this._showToast('Room has been closed', 'info');
            this.mode = 'lobby';
            this._showLobby();
            this._listRooms();
        }
    }

    _showJoinRoomModal() {
        this.els.joinPasswordModal.classList.add('active');
        this.els.joinPasswordInput.value = '';
        this.els.joinPasswordError.classList.add('hidden');
        this.els.joinPasswordInput.focus();
    }

    _hideJoinRoomModal() {
        this.els.joinPasswordModal.classList.remove('active');
        this.roomToJoin = null;
    }

    _confirmJoinRoom() {
        const password = this.els.joinPasswordInput.value;
        // Store room data for confirmation (roomToJoin is now { roomId, roomName })
        this._pendingJoinData = {
            roomName: this.roomToJoin.roomName,
            password: password,
        };
        this._hideJoinRoomModal();
        this._showJoinConfirmModal();
    }

    async _showJoinConfirmModal() {
        console.log('[TicTacToe] showJoinConfirmModal called');

        // Show modal with loader
        this.els.joinConfirmModal.classList.add('active');

        // Show loader, hide message and button
        this.els.joinConfirmLoader.classList.remove('hidden');
        this.els.joinConfirmMessage.classList.add('hidden');
        this.els.joinConfirmBtn.classList.add('hidden');

        try {
            // Fetch user balance from API
            const response = await fetch('/api/v1/user', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }

            const data = await response.json();
            const balance = data.user?.balance ?? 0;
            const hasEnoughBalance = balance >= 1000;

            console.log('[TicTacToe] User balance:', balance, 'Has enough:', hasEnoughBalance);

            // Hide loader
            this.els.joinConfirmLoader.classList.add('hidden');

            // Show message
            if (hasEnoughBalance) {
                this.els.joinConfirmMessage.textContent = 'Joining this game will cost 1000 coins. Are you sure you want to proceed?';
                this.els.joinConfirmMessage.classList.remove('confirm-message--error');
                this.els.joinConfirmBtn.classList.remove('hidden');
            } else {
                this.els.joinConfirmMessage.textContent = 'You do not have enough balance to join this game. You need at least 1000 coins.';
                this.els.joinConfirmMessage.classList.add('confirm-message--error');
                this.els.joinConfirmBtn.classList.add('hidden');
            }
            this.els.joinConfirmMessage.classList.remove('hidden');

        } catch (error) {
            console.error('[TicTacToe] Error fetching balance:', error);

            // Hide loader
            this.els.joinConfirmLoader.classList.add('hidden');

            // Show error message
            this.els.joinConfirmMessage.textContent = 'Failed to check balance. Please try again.';
            this.els.joinConfirmMessage.classList.add('confirm-message--error');
            this.els.joinConfirmMessage.classList.remove('hidden');
            this.els.joinConfirmBtn.classList.add('hidden');
        }
    }

    _hideJoinConfirmModal() {
        console.log('[TicTacToe] hideJoinConfirmModal called');
        this.els.joinConfirmModal.classList.remove('active');
    }

    _executeJoinRoom() {
        if (!this._pendingJoinData) return;

        const { roomName, password, isPasswordProtected, asSpectator } = this._pendingJoinData;

        // Check if we're already in this room
        if (this.roomName === roomName && this.roomId) {
            console.log('[TicTacToe] Already in this room, requesting room state instead');
            this._send({
                type: 'games.command.get_room_state',
                room_name: roomName,
            });
            this._pendingJoinData = null;
            return;
        }

        // If password protected and no password yet, show password modal
        if (isPasswordProtected && !password) {
            this.roomToJoin = { roomId: null, roomName: roomName };
            this._showJoinRoomModal();
            return;
        }

        // Send appropriate command based on spectator mode
        if (asSpectator) {
            this._send({
                type: 'games.command.join_as_spectator',
                room_name: roomName,
                password: password,
            });
        } else {
            this._send({
                type: 'games.command.join_room',
                room_name: roomName,
                password: password,
            });
        }

        this._pendingJoinData = null;
    }

    _joinRoom(roomName, password = null) {
        // Check if we're already in this room
        if (this.roomName === roomName && this.roomId) {
            console.log('[TicTacToe] Already in this room, requesting room state instead');
            this._send({
                type: 'games.command.get_room_state',
                room_name: roomName,
            });
            return;
        }

        this._send({
            type: 'games.command.join_room',
            room_name: roomName,
            password: password,
        });
    }

    _onRoomState(msg) {
        const room = msg.room;
        console.log('[TicTacToe] Room state received:', room);

        // Reset disconnect intent flag since we're now in a room
        this.hasSentDisconnectIntent = false;

        // Clear "not in room" state since we're receiving room state
        this.notInRoomInfo = null;
        if (this.els.notInRoomState) {
            this.els.notInRoomState.classList.add('hidden');
        }

        // Show chat panel now that user has joined the room
        if (this.els.chatPanel) {
            this.els.chatPanel.classList.remove('hidden');
        }

        this.roomId = room.room_id;
        this.roomName = room.room_name;
        this.hostId = room.host_id;
        this.isHost = room.host_id == this.userId;
        this.isAdmin = this.isHost;
        this.maxPlayers = room.player_count || room.max_players || 2;
        this.allowSpectators = room.allow_spectators === true;

        // Initialize lobby and players
        this.lobby = room.lobby || [];
        this.players = room.players || [];
        this.selectedPlayers = room.selected_players || [];

        // Initialize banned players from room state
        if (room.banned_users && Array.isArray(room.banned_users)) {
            this.bannedPlayers = room.banned_users.map(banned => {
                if (typeof banned === 'object' && banned !== null) {
                    return {
                        user_id: banned.user_id,
                        username: banned.username || `User #${banned.user_id}`
                    };
                }
                return {
                    user_id: banned,
                    username: `User #${banned}`
                };
            });
        } else {
            this.bannedPlayers = [];
        }

        // Initialize spectators from room state
        this.spectators = room.spectators_data || room.spectators || [];

        // Determine if current user is a player or spectator
        const userIdStr = String(this.userId);
        const inPlayers = this.players.some(p => String(p.id || p.user_id) === userIdStr);
        const inLobby = this.lobby.some(p => String(p.user_id) === userIdStr);
        this.isPlayer = inPlayers || inLobby;
        this.isSpectator = this.spectators.some(s => {
            if (typeof s === 'object' && s !== null) {
                return String(s.user_id || s.id) === userIdStr;
            }
            return String(s) === userIdStr;
        });

        console.log('[TicTacToe] Role check:', {
            userId: this.userId,
            isAdmin: this.isAdmin,
            isPlayer: this.isPlayer,
            isSpectator: this.isSpectator,
            lobbyCount: this.lobby.length,
            playersCount: this.players.length,
            spectatorsCount: this.spectators.length
        });

        // Update chat tab access based on role
        this._updateChatTabAccess();

        // Update spectator UI
        this._updateSpectatorUI();

        // Request chat history for the lobby channel on initial room join
        if (!this.chatHistoryRequested.lobby && this.chatMessages.lobby.length === 0) {
            this.chatHistoryRequested.lobby = true;
            this._requestChatHistory('lobby');
        }

        // Update header with room name and status
        this._updateHeaderTitle(room.room_name || `Room ${room.room_id}`);

        if (room.status === 'waiting') {
            this._updateGameStatus('waiting');
            this._showWaitingRoom();
            this._updateGameUI();
        } else if (room.status === 'in_progress') {
            this._updateGameStatus('playing');
            this._showGame();
        }
    }

    _onWaitingRoomUpdate(msg) {
        // Update local state based on message
        if (msg.type === 'games.event.tic_tac_toe.lobby_joined') {
            // A new player joined the lobby - add them to the lobby array
            const player = msg.player || {
                user_id: msg.user_id,
                username: msg.username,
                avatar_id: msg.avatar_id,
                score: 0,
                is_ready: false,
            };

            // Add to lobby if not already there
            const existingIdx = this.lobby.findIndex(p =>
                String(p.user_id) === String(player.user_id)
            );
            if (existingIdx === -1) {
                this.lobby.push(player);
                console.log('[TicTacToe] Player joined lobby:', player.username);
            }
        } else if (msg.type === 'games.event.tic_tac_toe.player_ready_changed') {
            const player = this.lobby.find(p => p.user_id == msg.user_id);
            if (player) {
                player.is_ready = msg.is_ready;
            }
        } else if (msg.type === 'games.event.tic_tac_toe.player_selected') {
            // A player was selected - move them from lobby to selectedPlayers
            const player = msg.player || {
                user_id: msg.user_id,
                username: msg.username,
                avatar_id: msg.avatar_id,
                score: 0,
                is_ready: false,
            };
            const playerId = String(player.user_id);
            console.log('[TicTacToe] Player selected:', player.username, playerId);

            // Remove from lobby if present
            const lobbyIdx = this.lobby.findIndex(p => String(p.user_id) === playerId);
            if (lobbyIdx !== -1) {
                this.lobby.splice(lobbyIdx, 1);
            }

            // Add to selectedPlayers if not already there
            const alreadySelected = this.selectedPlayers.some(p => String(p.user_id) === playerId);
            if (!alreadySelected) {
                this.selectedPlayers.push(player);
                console.log('[TicTacToe] Selected players count:', this.selectedPlayers.length);
            }

            // Check if we have enough players to potentially start
            if (this.selectedPlayers.length >= this.maxPlayers) {
                console.log('[TicTacToe] All players selected, waiting for game to start');
            }
        } else if (msg.type === 'games.event.tic_tac_toe.selected_players_updated') {
            // Full selected players list update
            if (msg.selected_players) {
                this.selectedPlayers = msg.selected_players;
                console.log('[TicTacToe] Selected players updated:', this.selectedPlayers.length);
            }
        }

        this._updateGameUI();
    }

    _updateGameUI() {
        // Decide which view to show based on admin status
        if (this.isAdmin) {
            // Admin sees the lobby management interface
            this._renderAdminLobby();
            if (this.els.adminLobby) {
                this.els.adminLobby.classList.remove('hidden');
            }
            if (this.els.waitingForAdmin) {
                this.els.waitingForAdmin.classList.add('hidden');
            }
        } else {
            // Non-admin sees the "waiting for admin" view
            this._renderWaitingPlayersList();
            if (this.els.waitingForAdmin) {
                this.els.waitingForAdmin.classList.remove('hidden');
            }
            if (this.els.adminLobby) {
                this.els.adminLobby.classList.add('hidden');
            }
        }

        // Update ready button state for legacy waiting room
        const myPlayer = this.lobby.find(p => p.user_id == this.userId);
        this.isReady = myPlayer?.is_ready || false;
        if (this.els.readyBtn) {
            this.els.readyBtn.textContent = this.isReady ? 'Not Ready' : 'Ready';
        }
    }

    _renderAdminLobby() {
        const lobbyList = this.els.lobbyPlayersList;
        const countEl = this.els.lobbyCount;
        if (!lobbyList) return;

        // Update count
        if (countEl) {
            countEl.textContent = `${this.lobby.length} waiting`;
        }

        // If lobby is empty, show empty state
        if (this.lobby.length === 0) {
            lobbyList.innerHTML = `
                <div class="lobby-empty">
                    <div class="lobby-empty__icon">👥</div>
                    <p>No players waiting. Share the room link to invite players!</p>
                </div>
            `;
        } else {
            // Render players with select/kick/ban buttons
            lobbyList.innerHTML = this.lobby.map(player => {
                const isMe = String(player.user_id) === String(this.userId);
                const isHost = String(player.user_id) === String(this.hostId);
                const isSpectator = this.spectators.some(s =>
                    String(s.user_id || s) === String(player.user_id)
                );
                const isReady = player.is_ready;
                const initial = (player.username || 'U').charAt(0).toUpperCase();

                let statusClass = '';
                let avatarClass = 'lobby-player__avatar';
                if (isHost) {
                    statusClass = 'lobby-player--admin';
                    avatarClass += ' lobby-player__avatar--admin';
                } else if (isSpectator) {
                    statusClass = 'lobby-player--spectator';
                    avatarClass += ' lobby-player__avatar--spectator';
                } else if (isReady) {
                    statusClass = 'lobby-player--ready';
                }

                // Build badges (matching BiggerDice pattern)
                let badges = '';
                if (isHost) {
                    badges += '<span class="admin-badge">👑 Admin</span> ';
                }
                if (isReady) {
                    badges += '<span class="ready-badge">✓ Ready</span>';
                } else {
                    badges += '<span class="waiting-badge">Waiting...</span>';
                }
                if (isSpectator) {
                    badges += ' <span class="spectator-badge">👁 Spectator</span>';
                }

                // Build subtitle text
                let subtitle = '';
                if (isHost) {
                    subtitle = 'Room host - select players to start';
                } else if (isReady) {
                    subtitle = 'Player is ready to start';
                } else {
                    subtitle = 'Waiting for admin selection';
                }

                // Action buttons - different for admin vs other players
                let actionsHtml = '';
                if (isMe && isHost) {
                    // Admin's own entry - can select self or become spectator
                    actionsHtml = `
                        <button class="select-btn" data-action="select" data-user-id="${player.user_id}">Select Myself</button>
                        ${this.allowSpectators ? `<button class="kick-btn" data-action="become-spectator" data-user-id="${player.user_id}">Become Spectator</button>` : ''}
                    `;
                } else if (!isMe) {
                    // Other players - standard actions
                    actionsHtml = `
                        <button class="select-btn" data-action="select" data-user-id="${player.user_id}">Select</button>
                        <button class="kick-btn" data-action="kick" data-user-id="${player.user_id}">Kick</button>
                        <button class="ban-btn" data-action="ban" data-user-id="${player.user_id}">Ban</button>
                    `;
                }

                return `
                    <div class="lobby-player ${statusClass}" data-user-id="${player.user_id}">
                        <div class="lobby-player__info">
                            <div class="${avatarClass}">${initial}</div>
                            <div>
                                <div class="lobby-player__name">
                                    ${this._escapeHtml(player.username)}${isMe ? ' (you)' : ''}
                                    ${badges}
                                </div>
                                <div class="lobby-player__joined">${subtitle}</div>
                            </div>
                        </div>
                        <div class="lobby-player__actions">
                            ${actionsHtml}
                        </div>
                    </div>
                `;
            }).join('');

            // Bind action buttons
            this._bindAdminLobbyActions();
        }

        // Render banned players section
        this._renderBannedPlayersList();
    }

    _renderWaitingPlayersList() {
        const listEl = this.els.waitingPlayersList;
        if (!listEl) return;

        listEl.innerHTML = this.lobby.map(player => {
            const isMe = String(player.user_id) === String(this.userId);
            const isAdmin = String(player.user_id) === String(this.hostId);

            let statusClass = '';
            let statusText = '';
            if (isAdmin) {
                statusClass = 'waiting-player--admin';
                statusText = '<span class="waiting-player__status">Admin</span>';
            } else if (player.is_ready) {
                statusClass = 'waiting-player--ready';
                statusText = '<span class="waiting-player__status waiting-player__status--ready">Ready</span>';
            } else {
                statusText = '<span class="waiting-player__status waiting-player__status--waiting">Waiting</span>';
            }

            return `
                <div class="waiting-player ${statusClass}">
                    <span class="waiting-player__name">${this._escapeHtml(player.username)}${isMe ? ' (you)' : ''}</span>
                    ${statusText}
                </div>
            `;
        }).join('');
    }

    _renderBannedPlayersList() {
        const section = this.els.bannedPlayersSection;
        const listEl = this.els.bannedPlayersList;
        const countEl = this.els.bannedCount;
        if (!section || !listEl) return;

        if (this.bannedPlayers.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');

        if (countEl) {
            countEl.textContent = `${this.bannedPlayers.length} banned`;
        }

        listEl.innerHTML = this.bannedPlayers.map(player => {
            const initial = (player.username || 'U').charAt(0).toUpperCase();
            return `
                <div class="banned-player" data-user-id="${player.user_id}">
                    <div class="banned-player__info">
                        <div class="banned-player__avatar">${initial}</div>
                        <span class="banned-player__name">${this._escapeHtml(player.username)}</span>
                    </div>
                    <button class="unban-btn" data-user-id="${player.user_id}">Unban</button>
                </div>
            `;
        }).join('');

        // Bind unban buttons
        listEl.querySelectorAll('.unban-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = parseInt(e.target.dataset.userId, 10);
                this._unbanPlayer(userId);
            });
        });
    }

    _bindAdminLobbyActions() {
        const lobbyList = this.els.lobbyPlayersList;
        if (!lobbyList) return;

        // Handle all action buttons using data-action attribute (BiggerDice pattern)
        lobbyList.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const userId = parseInt(e.target.dataset.userId, 10);

                if (action === 'select') {
                    this._selectPlayer(userId);
                } else if (action === 'kick') {
                    this._kickPlayer(userId);
                } else if (action === 'ban') {
                    this._banPlayer(userId);
                } else if (action === 'become-spectator') {
                    this._becomeSpectator();
                }
            });
        });
    }

    // ============================================
    // Admin Action Methods
    // ============================================

    _selectPlayer(userId) {
        console.log('[TicTacToe] Selecting player:', userId);
        this._send({
            type: 'games.command.select_player',
            room_id: this.roomId,
            target_user_id: String(userId),
        });
    }

    _kickPlayer(userId) {
        if (!this.isAdmin) return;
        console.log('[TicTacToe] Kicking player:', userId);
        this._send({
            type: 'games.command.kick_player',
            room_id: this.roomId,
            target_user_id: String(userId),
        });
    }

    _banPlayer(userId) {
        if (!this.isAdmin) return;
        console.log('[TicTacToe] Banning player:', userId);
        this._send({
            type: 'games.command.ban_player',
            room_id: this.roomId,
            target_user_id: String(userId),
        });
    }

    _unbanPlayer(userId) {
        if (!this.isAdmin) return;
        console.log('[TicTacToe] Unbanning player:', userId);
        this._send({
            type: 'games.command.unban_player',
            room_id: this.roomId,
            target_user_id: String(userId),
        });
    }

    _becomeSpectator() {
        console.log('[TicTacToe] Admin becoming spectator');
        this._send({
            type: 'games.command.become_spectator',
            room_id: this.roomId,
        });
    }

    // ============================================
    // Admin Event Handlers
    // ============================================

    _onLobbyUpdated(msg) {
        console.log('[TicTacToe] Lobby updated:', msg);
        this.lobby = msg.lobby || [];
        this._updateGameUI();
    }

    _onPlayerKicked(msg) {
        console.log('[TicTacToe] Player kicked:', msg);
        const kickedUserId = String(msg.player_id || msg.user_id);
        const kickedPlayerName = msg.player_name || msg.username || 'Player';

        // Remove from lobby list
        this.lobby = this.lobby.filter(p => String(p.user_id) !== kickedUserId);

        // Check if we were kicked
        if (kickedUserId === String(this.userId)) {
            // Show kicked message before going back to lobby
            this._showKickedMessage();
            return;
        }

        this._updateGameUI();
        this._addSystemMessage(`${kickedPlayerName} was kicked from the room`);
    }

    _showKickedMessage() {
        // Clear room state immediately to prevent further room events from affecting us
        // Store room name for potential rejoin info
        const kickedFromRoom = this.roomName;
        this.roomId = null;
        this.roomName = null;
        this.isHost = false;
        this.isAdmin = false;
        this.hostId = null;
        this.lobby = [];
        this.players = [];

        // Hide all game states
        if (this.els.waitingState) this.els.waitingState.classList.add('hidden');
        if (this.els.adminLobby) this.els.adminLobby.classList.add('hidden');
        if (this.els.gameBoard) this.els.gameBoard.classList.add('hidden');
        if (this.els.notInRoomState) this.els.notInRoomState.classList.add('hidden');

        // Show kicked message using waitingForAdmin element
        if (this.els.waitingForAdmin) {
            const iconEl = this.els.waitingForAdmin.querySelector('.waiting-for-admin__icon');
            const titleEl = this.els.waitingForAdmin.querySelector('.waiting-for-admin__title');
            const textEl = this.els.waitingForAdmin.querySelector('.waiting-for-admin__text');

            if (iconEl) iconEl.textContent = '🚫';
            if (titleEl) titleEl.textContent = 'You have been kicked';
            if (textEl) textEl.textContent = 'The host has kicked you from the lobby.';

            this.els.waitingForAdmin.classList.remove('hidden');
        }

        // Redirect to lobby after a short delay
        setTimeout(() => {
            this.mode = 'lobby';
            this._showLobby();
            this._listRooms();
        }, 3000);
    }

    _onPlayerBanned(msg) {
        console.log('[TicTacToe] Player banned:', msg);
        const bannedUserId = String(msg.player_id || msg.user_id);
        const bannedPlayerName = msg.player_name || msg.username || 'Player';

        // Remove from lobby list and add to banned list
        this.lobby = this.lobby.filter(p => String(p.user_id) !== bannedUserId);
        this.bannedPlayers.push({
            user_id: bannedUserId,
            username: bannedPlayerName,
        });

        // Check if we were banned
        if (bannedUserId === String(this.userId)) {
            // Show banned message before going back to lobby
            this._showBannedMessage();
            return;
        }

        this._updateGameUI();
        this._addSystemMessage(`${bannedPlayerName} was banned from the room`);
    }

    _showBannedMessage() {
        // Clear room state immediately to prevent further room events from affecting us
        this.roomId = null;
        this.roomName = null;
        this.isHost = false;
        this.isAdmin = false;
        this.hostId = null;
        this.lobby = [];
        this.players = [];

        // Hide all game states
        if (this.els.waitingState) this.els.waitingState.classList.add('hidden');
        if (this.els.adminLobby) this.els.adminLobby.classList.add('hidden');
        if (this.els.gameBoard) this.els.gameBoard.classList.add('hidden');
        if (this.els.notInRoomState) this.els.notInRoomState.classList.add('hidden');

        // Show banned message using waitingForAdmin element
        if (this.els.waitingForAdmin) {
            const iconEl = this.els.waitingForAdmin.querySelector('.waiting-for-admin__icon');
            const titleEl = this.els.waitingForAdmin.querySelector('.waiting-for-admin__title');
            const textEl = this.els.waitingForAdmin.querySelector('.waiting-for-admin__text');

            if (iconEl) iconEl.textContent = '🚫';
            if (titleEl) titleEl.textContent = 'You have been banned';
            if (textEl) textEl.textContent = 'The host has banned you from this room. You cannot rejoin.';

            this.els.waitingForAdmin.classList.remove('hidden');
        }

        // Redirect to lobby after a short delay
        setTimeout(() => {
            this.mode = 'lobby';
            this._showLobby();
            this._listRooms();
        }, 3000);
    }

    _onPlayerUnbanned(msg) {
        console.log('[TicTacToe] Player unbanned:', msg);
        const unbannedUserId = String(msg.player_id || msg.user_id);
        const unbannedPlayerName = msg.player_name || msg.username || 'Player';
        this.bannedPlayers = this.bannedPlayers.filter(p => String(p.user_id) !== unbannedUserId);
        this._updateGameUI();
        this._addSystemMessage(`${unbannedPlayerName} was unbanned`);
    }

    _showNotInRoomView(roomId) {
        // Find the room from the rooms list
        const room = this.rooms.find(r => r.room_id === roomId);
        if (!room) {
            console.error('[TicTacToe] Room not found:', roomId);
            this._showToast('Room not found', 'error');
            return;
        }

        console.log('[TicTacToe] Showing not-in-room view for room:', room.room_name);

        // Create a fake "not in room" message and call the handler
        // This ensures consistent behavior with server-sent not_in_room events
        this._onNotInRoom({
            room_id: room.room_id,
            room_name: room.room_name,
            is_password_protected: room.is_password_protected || false,
            status: room.status || 'waiting',
            allow_spectators: room.allow_spectators === true,
            is_banned: false,
            is_full: false,
            message: 'Click "Enter Room" to join this game.',
        });
    }

    _onNotInRoom(msg) {
        console.log('[TicTacToe] Not in room:', msg);

        // Store the room info for the "Enter Room" button
        this.notInRoomInfo = {
            room_id: msg.room_id,
            room_name: msg.room_name,
            is_password_protected: msg.is_password_protected || false,
            status: msg.status,
            allow_spectators: msg.allow_spectators === true,
            is_banned: msg.is_banned || false,
            is_full: msg.is_full || false,
        };

        // Update header with room info
        this._updateHeaderTitle(msg.room_name || 'Tic Tac Toe');
        this._updateGameStatus(msg.status || 'waiting');

        // Switch to game section but show not-in-room state
        this.mode = 'not_in_room';
        this.els.lobbySection.classList.remove('active');
        this.els.gameSection.classList.add('active');

        // Hide all sub-views first
        this._hideAllGameSubViews();

        // Hide chat panel until user confirms joining
        if (this.els.chatPanel) {
            this.els.chatPanel.classList.add('hidden');
        }

        // Show not-in-room state
        if (this.els.notInRoomState) {
            this.els.notInRoomState.classList.remove('hidden');

            // Update text based on room info
            const titleEl = this.els.notInRoomState.querySelector('.not-in-room__title');
            const textEl = this.els.notInRoomState.querySelector('.not-in-room__text');
            const hintEl = this.els.notInRoomHint;
            const spectatorOption = this.els.spectatorOptionContainer;

            if (titleEl) titleEl.textContent = 'You are not in this room';
            if (textEl) textEl.textContent = msg.message || 'This room already has players.';

            // Show spectator option if allowed
            if (spectatorOption) {
                if (this.notInRoomInfo.allow_spectators) {
                    spectatorOption.classList.remove('hidden');
                    // Reset checkbox state
                    if (this.els.joinAsSpectatorCheckbox) {
                        this.els.joinAsSpectatorCheckbox.checked = this.wantsToSpectate || false;
                    }
                } else {
                    spectatorOption.classList.add('hidden');
                    this.wantsToSpectate = false;
                }
            }

            if (hintEl) {
                if (this.notInRoomInfo.is_banned) {
                    hintEl.textContent = 'You have been banned from this room.';
                } else {
                    hintEl.textContent = '';
                }
            }

            this._updateEnterRoomButton();
        }
    }

    _handleEnterRoomClick() {
        if (!this.notInRoomInfo) return;

        // Spectators don't need balance check - they can watch for free
        if (this.wantsToSpectate) {
            // But they still need password if room is protected
            if (this.notInRoomInfo.is_password_protected) {
                // Store data for password modal
                this.roomToJoin = {
                    roomId: this.notInRoomInfo.room_id,
                    roomName: this.notInRoomInfo.room_name,
                };
                this._pendingJoinData = {
                    roomName: this.notInRoomInfo.room_name,
                    asSpectator: true,
                };
                this._showJoinRoomModal();
            } else {
                this._send({
                    type: 'games.command.join_as_spectator',
                    room_name: this.notInRoomInfo.room_name,
                });
            }
            return;
        }

        // Players need balance check before joining - show confirmation modal
        this._pendingJoinData = {
            roomName: this.notInRoomInfo.room_name,
            password: null,
            isPasswordProtected: this.notInRoomInfo.is_password_protected,
        };
        this._showJoinConfirmModal();
    }

    _updateEnterRoomButton() {
        if (!this.els.enterRoomBtnText || !this.notInRoomInfo) return;

        if (this.wantsToSpectate) {
            if (this.notInRoomInfo.is_password_protected) {
                this.els.enterRoomBtnText.textContent = 'Watch as Spectator (Password Required)';
                if (this.els.notInRoomHint) {
                    this.els.notInRoomHint.textContent = 'This room is password protected. You will join as a spectator.';
                }
            } else {
                this.els.enterRoomBtnText.textContent = 'Watch as Spectator';
                if (this.els.notInRoomHint) {
                    this.els.notInRoomHint.textContent = 'You will join as a spectator and watch the game.';
                }
            }
        } else if (this.notInRoomInfo.is_password_protected) {
            this.els.enterRoomBtnText.textContent = 'Enter Room (Password Required)';
            if (this.els.notInRoomHint) {
                this.els.notInRoomHint.textContent = 'This room is password protected.';
            }
        } else {
            this.els.enterRoomBtnText.textContent = 'Enter Room';
            if (this.els.notInRoomHint) {
                this.els.notInRoomHint.textContent = '';
            }
        }
    }

    _toggleReady() {
        this._send({
            type: 'games.command.ready',
            room_id: this.roomId,
        });
        // Disable button after clicking (like BiggerDice)
        this.els.readyBtn.disabled = true;
    }

    _leaveRoom() {
        // Store room info before resetting
        const roomId = this.roomId;
        const roomName = this.roomName;

        // Send leave command
        this._send({
            type: 'games.command.leave_room',
            room_id: roomId,
        });

        // Clear notInRoomInfo so we don't have stale data
        this.notInRoomInfo = null;

        // Reset chat state when leaving
        this.chatMessages = { lobby: [], players: [], spectators: [] };
        this.chatUnreadCounts = { lobby: 0, players: 0, spectators: 0 };

        // Switch to lobby
        this.mode = 'lobby';
        this._showLobby();

        // Refresh room list after a short delay to ensure server processes leave command
        // The room we just left should appear in the list if it's still waiting
        setTimeout(() => {
            this._listRooms();
        }, 300);

        // Dispatch event with the room ID we left
        this.dispatchEvent(new CustomEvent('game-leave', { detail: { roomId, roomName } }));
    }

    _onGameStarted(msg) {
        console.log('[TicTacToe] Game started:', msg);
        this._updateGameStatus('playing');
        this._showGame();
        this._resetBoard();
    }

    _onStateSync(msg) {
        console.log('[TicTacToe] State sync:', msg);

        // Update board
        this.board = msg.board || Array(9).fill(null);
        this.playerXId = msg.player_x_id;
        this.playerOId = msg.player_o_id;
        this.currentTurn = msg.current_turn;
        this.gameNumber = msg.game_number || 1;
        this.isGamePaused = msg.is_paused || false;

        // Update scores
        if (msg.scores) {
            this.scores = {};
            msg.scores.forEach(([playerId, score]) => {
                this.scores[playerId] = score;
            });
        }

        // Update timer
        if (msg.move_deadline) {
            this.moveDeadline = new Date(msg.move_deadline);
            this._startTimer();
        }

        this._renderBoard();
        this._updateMatchInfo();
        this._updateTurnIndicator();

        if (this.isGamePaused) {
            this.els.pausedOverlay.classList.add('active');
        }

        this._showGame();
    }

    _onTurnChanged(msg) {
        this.currentTurn = msg.current_turn;
        this._startTimer();
        this._updateTurnIndicator();
    }

    _onMoveMade(msg) {
        console.log('[TicTacToe] Move made:', msg);

        // Update board
        this.board = msg.board || this.board;
        this.board[msg.position] = msg.mark;

        this._renderBoard();
    }

    _onGameResult(msg) {
        console.log('[TicTacToe] Game result:', msg);

        // Update scores
        if (msg.scores) {
            this.scores = {};
            msg.scores.forEach(([playerId, score]) => {
                this.scores[playerId] = score;
            });
        }

        // Show winning line
        if (msg.winning_line) {
            this.winningLine = msg.winning_line;
            this._highlightWinningLine();
        }

        // Update game number
        this.gameNumber = msg.game_number + 1;

        this._updateMatchInfo();

        // Show result briefly then reset for next game
        setTimeout(() => {
            this.winningLine = null;
            this._resetBoard();
            this._updateMatchInfo();
        }, 2000);
    }

    _onMatchEnded(msg) {
        console.log('[TicTacToe] Match ended:', msg);

        this._stopTimer();

        const isWinner = msg.winner_id == this.userId;

        this.els.gameResultTitle.textContent = isWinner ? 'You Won!' : 'You Lost';
        this.els.gameResultTitle.className = 'game-result__title ' + (isWinner ? 'game-result__title--win' : 'game-result__title--lose');
        this.els.gameResultMessage.textContent = `Final score: ${msg.final_scores.map(([id, name, score]) => `${name}: ${score}`).join(' - ')}`;
        this.els.gameResultPrize.textContent = isWinner ? `Prize: ${(msg.prize_amount / 100).toFixed(0)} coins` : '';

        this.els.gameResult.classList.add('active');
    }

    _onTurnTimeout(msg) {
        console.log('[TicTacToe] Turn timeout:', msg);

        // Update scores
        if (msg.scores) {
            this.scores = {};
            msg.scores.forEach(([playerId, score]) => {
                this.scores[playerId] = score;
            });
        }

        this._updateMatchInfo();

        // Add chat message about timeout
        this._addSystemMessage(`${msg.player_username} timed out! ${msg.winner_username} wins this game.`);

        // Reset for next game
        setTimeout(() => {
            this._resetBoard();
        }, 2000);
    }

    _onGamePaused(msg) {
        console.log('[TicTacToe] Game paused:', msg);
        this.isGamePaused = true;
        this.els.pausedOverlay.classList.add('active');
        this._stopTimer();
        this._addSystemMessage(`${msg.disconnected_player_username} disconnected. Waiting for reconnection...`);
    }

    _onGameResumed(msg) {
        console.log('[TicTacToe] Game resumed:', msg);
        this.isGamePaused = false;
        this.els.pausedOverlay.classList.remove('active');
        this._startTimer();
        this._addSystemMessage(`${msg.reconnected_player_username} reconnected!`);
    }

    _onPlayerLeft(msg) {
        console.log('[TicTacToe] Player left:', msg);
        const leftPlayerId = String(msg.player_id);

        // Check if host/admin left - show notification and go back to lobby
        if (leftPlayerId === String(this.hostId)) {
            console.log('[TicTacToe] Host left, room is closed');
            this._addSystemMessage('Room host has left. The room is now closed.');
            // _showLobby() resets room state internally
            this._showLobby();
            this._listRooms();
            return;
        }

        // Remove from players list
        this.players = this.players.filter(p => String(p.user_id || p.id) !== leftPlayerId);

        // Remove from lobby list
        this.lobby = this.lobby.filter(p => String(p.user_id) !== leftPlayerId);

        // Update the UI
        this._updateGameUI();
        this._renderWaitingRoom();
    }

    // ============================================
    // Multi-Channel Chat Methods
    // ============================================

    _switchChatChannel(channel) {
        // Determine if current user is a playing player
        const amIAPlayer = this.players.some(p =>
            String(p.user_id || p.id) === String(this.userId)
        ) || this.lobby.some(p => String(p.user_id) === String(this.userId));

        console.log('[Chat] switchChatChannel called:', {
            channel,
            isPlayer: this.isPlayer,
            isSpectator: this.isSpectator,
            amIAPlayer,
            currentChannel: this.chatChannel
        });

        // Check if lobby chat is disabled (during game)
        if (channel === 'lobby' && this._isLobbyChatDisabled()) {
            console.log('[Chat] Lobby chat is disabled during game');
            return;
        }

        // Check if user can access players channel
        if (channel === 'players' && !this.isPlayer && !this.isSpectator && !amIAPlayer) {
            console.log('[Chat] Cannot access players channel - not a player or spectator');
            return;
        }

        // Check if user can access spectators channel
        if (channel === 'spectators' && (amIAPlayer || !this.isSpectator)) {
            console.log('[Chat] Cannot access spectators channel - players cannot see spectator chat');
            return;
        }

        console.log('[Chat] Access granted, setting chatChannel to:', channel);
        this.chatChannel = channel;

        // Update tab styles
        if (this.els.chatTabLobby) this.els.chatTabLobby.classList.toggle('active', channel === 'lobby');
        if (this.els.chatTabPlayers) this.els.chatTabPlayers.classList.toggle('active', channel === 'players');
        if (this.els.chatTabSpectators) this.els.chatTabSpectators.classList.toggle('active', channel === 'spectators');

        // Clear unread count for this channel
        this.chatUnreadCounts[channel] = 0;
        this._updateChatBadges();

        // Render messages for this channel
        this._renderChatMessages();

        // Update chat input visibility based on channel and role
        this._updateChatInputAccess();

        // Request chat history if we don't have messages for this channel
        if (!this.chatHistoryRequested[channel] && this.chatMessages[channel].length === 0 && this.roomId) {
            this.chatHistoryRequested[channel] = true;
            this._requestChatHistory(channel);
        }
    }

    _isLobbyChatDisabled() {
        // Lobby chat is disabled during game
        return this.mode !== 'lobby' && (this.players.length >= this.maxPlayers ||
            this.selectedPlayers.length >= this.maxPlayers);
    }

    _updateChatInputAccess() {
        const chatForm = this.els.chatForm;
        const chatInput = this.els.chatInput;
        const sendBtn = this.els.chatSend;

        // Determine if current user is a playing player
        const amIAPlayer = this.players.some(p =>
            String(p.user_id || p.id) === String(this.userId)
        );

        // Spectators viewing players chat cannot send messages
        const isSpectatorViewingPlayersChat = this.isSpectator && !amIAPlayer && this.chatChannel === 'players';

        if (chatForm) {
            if (isSpectatorViewingPlayersChat) {
                chatForm.classList.add('chat-input--disabled');
                if (chatInput) {
                    chatInput.disabled = true;
                    chatInput.placeholder = 'Spectators cannot send messages in players chat';
                }
                if (sendBtn) sendBtn.disabled = true;
            } else {
                chatForm.classList.remove('chat-input--disabled');
                if (chatInput) {
                    chatInput.disabled = false;
                    chatInput.placeholder = 'Type a message...';
                }
                if (sendBtn) sendBtn.disabled = false;
            }
        }
    }

    _toggleChat() {
        this.isChatCollapsed = !this.isChatCollapsed;
        if (this.els.chatPanel) {
            this.els.chatPanel.classList.toggle('collapsed', this.isChatCollapsed);
        }
    }

    _sendChatMessage() {
        const content = this.els.chatInput?.value.trim();
        if (!content || !this.roomId) return;

        this._send({
            type: 'games.command.send_chat',
            room_id: this.roomId,
            channel: this.chatChannel,
            content: content,
            avatar_id: this.avatarId || null
        });

        // Clear input
        if (this.els.chatInput) {
            this.els.chatInput.value = '';
        }
    }

    _requestChatHistory(channel) {
        if (!this.roomId) return;

        this._send({
            type: 'games.command.get_chat_history',
            room_id: this.roomId,
            channel: channel,
            limit: 50
        });
    }

    _handleChatMessage(message) {
        console.log('[Chat] handleChatMessage received:', {
            channel: message.channel,
            username: message.username,
            content: message.content?.substring(0, 50)
        });

        const chatMsg = {
            id: message.message_id || Date.now(),
            userId: message.user_id,
            username: message.username || 'Unknown',
            avatarId: message.avatar_id,
            content: message.content,
            isSystem: message.is_system || false,
            timestamp: message.created_at ? new Date(message.created_at) : new Date(),
        };

        const channel = message.channel || 'lobby';

        // Add to messages array
        if (!this.chatMessages[channel]) {
            this.chatMessages[channel] = [];
        }
        this.chatMessages[channel].push(chatMsg);

        // Keep only last 100 messages per channel
        if (this.chatMessages[channel].length > 100) {
            this.chatMessages[channel] = this.chatMessages[channel].slice(-100);
        }

        // If this is the active channel, render
        if (channel === this.chatChannel) {
            this._renderChatMessages();
        } else {
            // Increment unread count for other channels
            this.chatUnreadCounts[channel]++;
            this._updateChatBadges();
        }
    }

    _handleChatHistory(message) {
        const channel = message.channel || 'lobby';
        const historyMessages = message.messages || [];
        console.log('[Chat] handleChatHistory received for channel:', channel, 'messages count:', historyMessages.length);

        // Convert history messages to our internal format
        const historyMapped = historyMessages.map(m => ({
            id: m.message_id || m._id || Date.now(),
            userId: m.user_id,
            username: m.username || 'Unknown',
            avatarId: m.avatar_id,
            content: m.content,
            isSystem: m.is_system || false,
            timestamp: m.created_at ? new Date(m.created_at) : new Date(),
        }));

        // Get existing messages
        const existingMessages = this.chatMessages[channel] || [];
        const existingIds = new Set(existingMessages.map(m => String(m.id)));

        // Merge: history messages + any real-time messages not in history
        const newMessagesFromHistory = historyMapped.filter(m => !existingIds.has(String(m.id)));
        const merged = [...newMessagesFromHistory, ...existingMessages];

        // Sort by timestamp (oldest first)
        merged.sort((a, b) => a.timestamp - b.timestamp);

        // Keep only last 100 messages
        this.chatMessages[channel] = merged.slice(-100);

        // Render if this is the active channel
        if (channel === this.chatChannel) {
            this._renderChatMessages();
        }
    }

    _renderChatMessages() {
        const container = this.els.chatMessages;
        if (!container) return;

        const messages = this.chatMessages[this.chatChannel] || [];

        if (messages.length === 0) {
            container.innerHTML = '<div class="chat-empty">No messages yet. Say hello!</div>';
            return;
        }

        container.innerHTML = messages.map(msg => {
            const isMuted = this.mutedUsers.has(String(msg.userId));

            if (msg.isSystem) {
                return `<div class="chat-message chat-message--system">${this._escapeHtml(msg.content)}</div>`;
            }

            const initials = (msg.username || 'U').substring(0, 2).toUpperCase();
            const timeStr = msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="chat-message ${isMuted ? 'chat-message--muted' : ''}" data-user-id="${msg.userId}">
                    <div class="chat-message__avatar">${initials}</div>
                    <div class="chat-message__content">
                        <div class="chat-message__header">
                            <span class="chat-message__username">${this._escapeHtml(msg.username)}</span>
                            <span class="chat-message__time">${timeStr}</span>
                        </div>
                        <div class="chat-message__text">${this._escapeHtml(msg.content)}</div>
                    </div>
                    ${String(msg.userId) !== String(this.userId) ? `
                        <button class="chat-message__mute" data-user-id="${msg.userId}" title="${isMuted ? 'Unmute user' : 'Mute user'}">
                            ${isMuted ? '🔊' : '🔇'}
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;

        // Bind mute buttons
        container.querySelectorAll('.chat-message__mute').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.target.dataset.userId;
                this._toggleMuteUser(userId);
            });
        });
    }

    _toggleMuteUser(userId) {
        const userIdStr = String(userId);
        if (this.mutedUsers.has(userIdStr)) {
            this.mutedUsers.delete(userIdStr);
        } else {
            this.mutedUsers.add(userIdStr);
        }
        this._renderChatMessages();
    }

    _updateChatBadges() {
        const updateBadge = (badge, count) => {
            if (!badge) return;
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : String(count);
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        };

        updateBadge(this.els.lobbyBadge, this.chatUnreadCounts.lobby);
        updateBadge(this.els.playersBadge, this.chatUnreadCounts.players);
        updateBadge(this.els.spectatorsBadge, this.chatUnreadCounts.spectators);
    }

    _updateChatTabAccess() {
        const lobbyTab = this.els.chatTabLobby;
        const playersTab = this.els.chatTabPlayers;
        const spectatorsTab = this.els.chatTabSpectators;

        const lobbyChatDisabled = this._isLobbyChatDisabled();

        // Determine if current user is a playing player
        const amIAPlayer = this.players.some(p =>
            String(p.user_id || p.id) === String(this.userId)
        );

        // Lobby tab - visible during lobby/selecting phase, hidden during game
        if (lobbyTab) {
            if (lobbyChatDisabled) {
                lobbyTab.classList.add('hidden');
                lobbyTab.disabled = true;
            } else {
                lobbyTab.classList.remove('hidden');
                lobbyTab.disabled = false;
            }
        }

        // Players tab - visible during game for both players and spectators
        if (playersTab) {
            if (lobbyChatDisabled) {
                playersTab.classList.remove('hidden');
                playersTab.classList.remove('disabled');
                playersTab.disabled = false;

                if (this.isSpectator && !amIAPlayer) {
                    playersTab.setAttribute('title', 'View players chat (read-only)');
                } else {
                    playersTab.removeAttribute('title');
                }
            } else {
                playersTab.classList.add('hidden');
                playersTab.disabled = true;
            }
        }

        // Spectators tab - visible to spectators only
        if (spectatorsTab) {
            if (this.isSpectator && !amIAPlayer) {
                spectatorsTab.classList.remove('hidden');
                spectatorsTab.classList.remove('disabled');
                spectatorsTab.disabled = false;
            } else {
                spectatorsTab.classList.add('hidden');
                spectatorsTab.disabled = true;
            }
        }

        // If current channel is no longer accessible, switch to appropriate channel
        if (this.chatChannel === 'lobby' && lobbyChatDisabled) {
            if (this.isSpectator && !amIAPlayer) {
                this._switchChatChannel('spectators');
            } else {
                this._switchChatChannel('players');
            }
        }

        if (this.chatChannel === 'spectators' && (!this.isSpectator || amIAPlayer)) {
            if (lobbyChatDisabled) {
                this._switchChatChannel('players');
            } else {
                this._switchChatChannel('lobby');
            }
        }

        // Update input access for current channel
        this._updateChatInputAccess();
    }

    _addSystemMessage(text) {
        // Add system message to the current active channel
        const chatMsg = {
            id: Date.now(),
            userId: 0,
            username: 'System',
            content: text,
            isSystem: true,
            timestamp: new Date(),
        };

        // Add to the appropriate channel based on game state
        const channel = this._isLobbyChatDisabled() ? 'players' : 'lobby';
        if (!this.chatMessages[channel]) {
            this.chatMessages[channel] = [];
        }
        this.chatMessages[channel].push(chatMsg);

        // Render if this is the active channel
        if (channel === this.chatChannel) {
            this._renderChatMessages();
        } else {
            this.chatUnreadCounts[channel]++;
            this._updateChatBadges();
        }
    }

    // ============================================
    // Spectator Methods
    // ============================================

    _updateSpectatorUI() {
        // Update spectator banner (shown when user is a spectator)
        const banner = this.els.spectatorBanner;
        const requestBtn = this.els.requestToPlayBtn;

        if (banner) {
            if (this.isSpectator) {
                banner.classList.remove('hidden');
                // Show "Request to Play" button if room has space
                if (requestBtn) {
                    const roomHasSpace = this.lobby.length < this.maxPlayers;
                    requestBtn.classList.toggle('hidden', !roomHasSpace);
                }
            } else {
                banner.classList.add('hidden');
            }
        }

        // Update spectators panel (shows who's watching)
        this._renderSpectatorsList();
    }

    _renderSpectatorsList() {
        const panel = this.els.spectatorsPanel;
        const countEl = this.els.spectatorsCount;
        const listEl = this.els.spectatorsList;

        if (!panel || !listEl) return;

        // Show/hide the panel based on whether spectators are allowed and there are spectators
        if (!this.allowSpectators || this.spectators.length === 0) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');

        // Update count
        if (countEl) {
            countEl.textContent = this.spectators.length;
        }

        // Render spectator list
        const myId = String(this.userId);
        listEl.innerHTML = this.spectators.map(spectator => {
            const initial = (spectator.username || 'U').charAt(0).toUpperCase();
            const isMe = String(spectator.user_id) === myId;
            return `
                <div class="spectator-item ${isMe ? 'spectator-item--me' : ''}" data-user-id="${spectator.user_id}">
                    <span class="spectator-item__avatar">${initial}</span>
                    <span class="spectator-item__name">${this._escapeHtml(spectator.username)}${isMe ? ' (you)' : ''}</span>
                </div>
            `;
        }).join('');
    }

    _requestToPlay() {
        // Request to switch from spectator to player
        console.log('[TicTacToe] Requesting to play');
        this._send({
            type: 'games.command.request_to_play',
            room_id: this.roomId
        });

        // Disable the button while waiting for response
        if (this.els.requestToPlayBtn) {
            this.els.requestToPlayBtn.disabled = true;
            this.els.requestToPlayBtn.textContent = 'Requested...';
        }
    }

    _onSpectatorJoined(msg) {
        console.log('[TicTacToe] Spectator joined:', msg);

        // Handle both formats: direct fields or nested spectator object
        const spectatorData = msg.spectator || msg;
        const spectator = {
            user_id: spectatorData.user_id,
            username: spectatorData.username,
            avatar_id: spectatorData.avatar_id,
            joined_at: spectatorData.joined_at
        };

        // Add to spectators list if not already there
        if (!this.spectators.find(s => String(s.user_id) === String(spectator.user_id))) {
            this.spectators.push(spectator);
        }

        // If this is the current user, set isSpectator flag and update chat tabs
        if (String(spectator.user_id) === String(this.userId)) {
            this.isSpectator = true;
            this.isPlayer = false;
            console.log('[TicTacToe] Current user joined as spectator, updating chat tabs');
            this._updateChatTabAccess();
        }

        // Update spectator UI and admin lobby (to show spectator with badge)
        this._updateSpectatorUI();

        // Re-render admin lobby if admin is viewing it
        if (this.isAdmin && this.els.adminLobby && !this.els.adminLobby.classList.contains('hidden')) {
            this._renderAdminLobby();
        }
    }

    _onSpectatorLeft(msg) {
        console.log('[TicTacToe] Spectator left:', msg);
        const userId = String(msg.user_id);

        // Remove from spectators list
        this.spectators = this.spectators.filter(s => String(s.user_id) !== userId);

        // Update spectator UI
        this._updateSpectatorUI();
    }

    _onRequestToPlayAccepted(msg) {
        console.log('[TicTacToe] Request to play accepted:', msg);

        // If this is about me, update my state
        if (String(msg.user_id) === String(this.userId)) {
            this.isSpectator = false;
            // Note: The player will be added to lobby, so we'll get a lobby_joined event too
        }

        // Remove from spectators
        const userId = String(msg.user_id);
        this.spectators = this.spectators.filter(s => String(s.user_id) !== userId);

        // Update UI
        this._updateSpectatorUI();
        this._updateChatTabAccess();
    }

    // Legacy method to support old waiting room rendering
    _renderWaitingRoom() {
        // This is kept for compatibility but now delegates to the new system
        this._updateGameUI();
    }

    _handleCellClick(cell) {
        if (this.isSpectator) return;
        if (this.currentTurn != this.userId) return;
        if (this.isGamePaused) return;

        const position = parseInt(cell.dataset.position);
        if (this.board[position] !== null) return;

        this._send({
            type: 'games.command.tic_tac_toe.move',
            room_id: this.roomId,
            position: position,
        });
    }

    _resetBoard() {
        this.board = Array(9).fill(null);
        this.winningLine = null;
        this._renderBoard();
    }

    _renderBoard() {
        this.els.cells.forEach((cell, i) => {
            const mark = this.board[i];
            cell.textContent = mark || '';
            cell.className = 'cell';

            if (mark === 'X') {
                cell.classList.add('cell--x');
            } else if (mark === 'O') {
                cell.classList.add('cell--o');
            }

            if (this.currentTurn != this.userId || mark !== null || this.isGamePaused) {
                cell.classList.add('cell--disabled');
            }
        });
    }

    _highlightWinningLine() {
        if (!this.winningLine) return;
        this.winningLine.forEach(pos => {
            this.els.cells[pos].classList.add('cell--winning');
        });
    }

    _updateMatchInfo() {
        // Find players
        const player1 = { id: this.playerXId, score: this.scores[this.playerXId] || 0 };
        const player2 = { id: this.playerOId, score: this.scores[this.playerOId] || 0 };

        // Get names (we might need to store these from game started event)
        const player1Name = player1.id == this.userId ? this.username : 'Opponent';
        const player2Name = player2.id == this.userId ? this.username : 'Opponent';

        // Update player 1 (X)
        this.els.player1Score.querySelector('.player-score__name').textContent = player1Name;
        this.els.player1Score.querySelector('.player-score__value').textContent = player1.score;
        this.els.player1Score.classList.toggle('player-score--active', this.currentTurn == player1.id);

        // Update player 2 (O)
        this.els.player2Score.querySelector('.player-score__name').textContent = player2Name;
        this.els.player2Score.querySelector('.player-score__value').textContent = player2.score;
        this.els.player2Score.classList.toggle('player-score--active', this.currentTurn == player2.id);

        // Update game number
        this.els.gameNumber.textContent = `Game ${this.gameNumber} of 9 (First to ${WIN_SCORE} wins)`;
    }

    _updateTurnIndicator() {
        const isMyTurn = this.currentTurn == this.userId;
        const myMark = this.playerXId == this.userId ? 'X' : 'O';

        this.els.turnIndicator.classList.toggle('turn-indicator--your-turn', isMyTurn);
        this.els.turnIndicatorText.textContent = isMyTurn
            ? `Your turn (${myMark})`
            : `Opponent's turn`;
    }

    _startTimer() {
        this._stopTimer();
        this.timeRemaining = TURN_TIMER_SECONDS;

        if (this.moveDeadline) {
            const now = new Date();
            this.timeRemaining = Math.max(0, Math.floor((this.moveDeadline - now) / 1000));
        }

        this._updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            this.timeRemaining = Math.max(0, this.timeRemaining - 1);
            this._updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                this._stopTimer();
            }
        }, 1000);
    }

    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    _updateTimerDisplay() {
        this.els.turnTimerValue.textContent = this.timeRemaining;
        this.els.turnTimerValue.className = 'turn-timer__value';

        if (this.timeRemaining <= 10) {
            this.els.turnTimerValue.classList.add('turn-timer__value--danger');
        } else if (this.timeRemaining <= 20) {
            this.els.turnTimerValue.classList.add('turn-timer__value--warning');
        }
    }

    _backToLobby() {
        this.els.gameResult.classList.remove('active');
        this.mode = 'lobby';
        this._showLobby();
        this._listRooms();
        this.dispatchEvent(new CustomEvent('game-leave', { detail: { roomId: this.roomId } }));
    }

    _onError(msg) {
        console.error('[TicTacToe] Error:', msg);

        // Handle specific error cases
        if (msg.code === 'already_in_room') {
            // User is already in this room - request the room state to rejoin
            console.log('[TicTacToe] Already in room, requesting room state...');
            const roomName = this._pendingJoinData?.roomName || msg.room_name || this.roomName;
            const roomId = msg.room_id || this.roomId;

            if (roomName) {
                this._send({
                    type: 'games.command.get_room_state',
                    room_name: roomName,
                });
                this._showToast('Rejoining room...', 'info');
            } else if (roomId) {
                // If we have room_id but not room_name, try to find it in our rooms list
                const room = this.rooms.find(r => r.room_id === roomId);
                if (room) {
                    this._send({
                        type: 'games.command.get_room_state',
                        room_name: room.room_name,
                    });
                    this._showToast('Rejoining room...', 'info');
                } else {
                    this._showToast('Already in a room. Refreshing...', 'info');
                    this._listRooms();
                }
            } else {
                this._showToast('Already in a room', 'info');
            }
            return;
        }

        this._showToast(msg.message, 'error');

        // Also dispatch event for parent page to handle
        this.dispatchEvent(new CustomEvent('game-error', {
            detail: { code: msg.code, message: msg.message }
        }));
    }

    _showToast(message, type = 'error') {
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `<span class="toast__message">${this._escapeHtml(message)}</span>`;

        this.els.toastContainer.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'toastSlideOut 0.3s ease forwards';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
    }
}
