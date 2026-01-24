/**
 * BiggerDice Web Component
 *
 * A self-contained dice game component that handles WebSocket communication,
 * game state, and rendering. Supports both lobby mode and game mode.
 *
 * Usage (Lobby Mode):
 * <bigger-dice
 *   data-ws-url="wss://localhost/ws/games"
 *   data-user-id="1"
 *   data-username="Player1"
 *   data-mode="lobby"
 * ></bigger-dice>
 *
 * Usage (Game Mode):
 * <bigger-dice
 *   data-ws-url="wss://localhost/ws/games"
 *   data-room-id="abc123"
 *   data-room-name="My Game"
 *   data-user-id="1"
 *   data-username="Player1"
 *   data-avatar-id="avatar123"
 *   data-mode="game"
 * ></bigger-dice>
 */

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

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
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
    }

    .room-card__status--waiting {
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning-color);
    }

    .room-card__status--in_progress {
      background: rgba(34, 197, 94, 0.15);
      color: var(--success-color);
    }

    .room-card__players {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .player-badge {
      font-size: 0.8125rem;
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
      border-radius: 0.375rem;
      background: var(--primary-color);
      color: white;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .join-btn:hover {
      opacity: 0.9;
    }

    .join-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .spectate-btn {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      border: 1px solid var(--border-color);
      border-radius: 0.375rem;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s;
    }

    .spectate-btn:hover {
      border-color: var(--text-color);
      color: var(--text-color);
    }

    /* Room card lock icon */
    .room-card__lock {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--warning-color);
      font-size: 0.75rem;
    }

    .room-card__lock-icon {
      width: 14px;
      height: 14px;
    }

    .room-card__info {
      display: flex;
      gap: 1rem;
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }

    .room-card__info-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .room-card__info-icon {
      width: 14px;
      height: 14px;
      opacity: 0.8;
    }

    .room-card__no-spectators {
      color: var(--text-muted);
      font-size: 0.75rem;
      text-decoration: line-through;
      opacity: 0.6;
    }

    /* Spectator Mode Banner */
    .spectator-banner {
      background: linear-gradient(135deg, var(--warning-color, #f59e0b) 0%, #d97706 100%);
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      text-align: center;
      margin-bottom: 1rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .spectator-banner__icon {
      font-size: 1.25rem;
    }

    .spectator-banner__text {
      font-size: 0.875rem;
    }

    .spectator-banner__action {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 0.375rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      cursor: pointer;
      margin-left: 1rem;
      transition: background 0.2s;
    }

    .spectator-banner__action:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Spectator List Panel */
    .spectators-panel {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      padding: 0.75rem;
      margin-bottom: 1rem;
    }

    .spectators-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .spectators-panel__title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-color);
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }

    .spectators-panel__count {
      background: var(--bg-color);
      color: var(--text-muted);
      font-size: 0.6875rem;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-weight: 500;
    }

    .spectators-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .spectator-item {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      background: var(--bg-color);
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
    }

    .spectator-item__avatar {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--primary-color);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.625rem;
      font-weight: 600;
    }

    .spectator-item__name {
      color: var(--text-color);
    }

    .spectator-item--me .spectator-item__name {
      font-weight: 600;
    }

    .spectators-empty {
      color: var(--text-muted);
      font-size: 0.75rem;
      font-style: italic;
    }

    /* Form hint text */
    .form-hint {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.375rem;
    }

    .form-label__optional {
      font-weight: 400;
      color: var(--text-muted);
    }

    /* Form error message */
    .form-error {
      color: var(--danger-color);
      font-size: 0.8125rem;
      margin-top: 0.375rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
    }

    .empty-state__icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .empty-state__title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 0.5rem;
    }

    .empty-state__message {
      margin-bottom: 1.5rem;
    }

    .loading-state {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Create Room Modal */
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

    .loader-text {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .hidden {
      display: none !important;
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

    /* ============================================
       GAME MODE STYLES
       ============================================ */

    .game-section {
      display: none;
    }

    .game-section.active {
      display: block;
    }

    .players-area {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1rem;
      align-items: center;
      margin-bottom: 2rem;
    }

    .player-card {
      background: var(--card-bg);
      border-radius: 0.75rem;
      padding: 1.5rem;
      text-align: center;
      border: 2px solid transparent;
      transition: border-color 0.3s, transform 0.3s;
    }

    .player-card--active {
      border-color: var(--primary-color);
      transform: scale(1.02);
    }

    .player-card--winner {
      border-color: var(--success-color);
      background: linear-gradient(135deg, var(--card-bg), rgba(34, 197, 94, 0.1));
    }

    .player-card--empty {
      opacity: 0.5;
    }

    .player-card--disconnected {
      opacity: 0.7;
      position: relative;
    }

    .player-card--auto {
      border-color: var(--warning-color);
    }

    .player-card__auto {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--warning-color);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .player-card__disconnect {
      margin-top: 0.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .disconnect-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid var(--border-color);
      border-top-color: var(--warning-color);
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }

    .disconnect-timer {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .kick-btn {
      padding: 0.375rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 0.5rem;
      border: 1px solid var(--danger-color);
      background: transparent;
      color: var(--danger-color);
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    }

    .kick-btn:hover {
      background: var(--danger-color);
      color: #fff;
    }

    .disconnect-overlay {
      position: fixed;
      inset: 0;
      background: rgba(8, 10, 18, 0.72);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 900;
      animation: fadeIn 0.2s;
    }

    .disconnect-overlay.active {
      display: flex;
    }

    .disconnect-modal {
      width: min(460px, 90vw);
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      animation: scaleIn 0.2s;
    }

    .disconnect-modal__header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .disconnect-modal__title {
      font-size: 1.125rem;
      font-weight: 700;
    }

    .disconnect-modal__subtitle {
      font-size: 0.8125rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    .disconnect-list {
      display: grid;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .disconnect-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border-color);
      background: var(--bg-color);
    }

    .disconnect-item__left {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .disconnect-item__name {
      font-weight: 600;
    }

    .disconnect-item__timer {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .disconnect-item__status {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--warning-color);
    }

    .disconnect-voted {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .disconnect-hint {
      margin-top: 1rem;
      font-size: 0.8125rem;
      color: var(--text-muted);
      text-align: center;
    }

    .player-avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--border-color);
      margin: 0 auto 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 600;
      overflow: hidden;
    }

    .player-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .player-name {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .player-score {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--primary-color);
      transition: transform 0.15s ease-out, color 0.15s ease-out;
    }

    .player-score.score-updated {
      transform: scale(1.2);
      color: var(--success-color);
    }

    .player-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .player-ready {
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: var(--success-color);
    }

    .vs-indicator {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-muted);
    }

    .dice-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .dice-container {
      display: flex;
      gap: 2rem;
      align-items: flex-start;
      justify-content: center;
      flex-wrap: wrap;
    }

    .dice-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .dice-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
      max-width: 80px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      text-align: center;
    }

    .dice {
      width: 80px;
      height: 80px;
      background: white;
      border-radius: 12px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      padding: 10px;
      gap: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transition: transform 0.3s;
    }

    .dice--rolling {
      animation: diceShake 0.1s infinite;
    }

    @keyframes diceShake {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      25% { transform: translate(-3px, 3px) rotate(-5deg); }
      50% { transform: translate(3px, -3px) rotate(5deg); }
      75% { transform: translate(-3px, -3px) rotate(-3deg); }
    }

    .dice--player-0 {
      border: 3px solid var(--primary-color);
    }

    .dice--player-1 {
      border: 3px solid var(--warning-color);
    }

    .dice--player-2 {
      border: 3px solid var(--success-color);
    }

    .dice--player-3 {
      border: 3px solid #e879f9;
    }

    .dice--player-4 {
      border: 3px solid #38bdf8;
    }

    .dice--player-5 {
      border: 3px solid #fb7185;
    }

    .dice--player-6 {
      border: 3px solid #a78bfa;
    }

    .dice--player-7 {
      border: 3px solid #34d399;
    }

    .dice--player-8 {
      border: 3px solid #fbbf24;
    }

    .dice--player-9 {
      border: 3px solid #f472b6;
    }

    .dice-dot {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: transparent;
    }

    /* Dice dot patterns */
    .dice[data-value="1"] .dice-dot:nth-child(5) { background: #1e1e2e; }
    .dice[data-value="2"] .dice-dot:nth-child(1),
    .dice[data-value="2"] .dice-dot:nth-child(9) { background: #1e1e2e; }
    .dice[data-value="3"] .dice-dot:nth-child(1),
    .dice[data-value="3"] .dice-dot:nth-child(5),
    .dice[data-value="3"] .dice-dot:nth-child(9) { background: #1e1e2e; }
    .dice[data-value="4"] .dice-dot:nth-child(1),
    .dice[data-value="4"] .dice-dot:nth-child(3),
    .dice[data-value="4"] .dice-dot:nth-child(7),
    .dice[data-value="4"] .dice-dot:nth-child(9) { background: #1e1e2e; }
    .dice[data-value="5"] .dice-dot:nth-child(1),
    .dice[data-value="5"] .dice-dot:nth-child(3),
    .dice[data-value="5"] .dice-dot:nth-child(5),
    .dice[data-value="5"] .dice-dot:nth-child(7),
    .dice[data-value="5"] .dice-dot:nth-child(9) { background: #1e1e2e; }
    .dice[data-value="6"] .dice-dot:nth-child(1),
    .dice[data-value="6"] .dice-dot:nth-child(3),
    .dice[data-value="6"] .dice-dot:nth-child(4),
    .dice[data-value="6"] .dice-dot:nth-child(6),
    .dice[data-value="6"] .dice-dot:nth-child(7),
    .dice[data-value="6"] .dice-dot:nth-child(9) { background: #1e1e2e; }

    .action-buttons {
      display: flex;
      gap: 1rem;
      align-items: center;
      justify-content: center;
    }

    .ready-btn, .roll-btn, .auto-play-btn {
      padding: 1rem 2.5rem;
      font-size: 1.125rem;
      font-weight: 600;
      border-radius: 0.75rem;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ready-btn {
      background: var(--success-color);
      color: white;
    }

    .ready-btn:hover {
      opacity: 0.9;
      transform: translateY(-2px);
    }

    .roll-btn {
      background: linear-gradient(135deg, var(--primary-color), #4f46e5);
      color: white;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }

    .roll-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.5);
    }

    .roll-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .auto-play-btn {
      background: linear-gradient(135deg, var(--warning-color, #f59e0b), #d97706);
      color: white;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    }

    .auto-play-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(245, 158, 11, 0.5);
    }

    /* Turn Timer */
    .turn-timer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding: 0.75rem 1.25rem;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
      border: 2px solid rgba(99, 102, 241, 0.4);
      border-radius: 2rem;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);
      animation: timer-pulse 1s ease-in-out infinite;
    }

    @keyframes timer-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }

    .turn-timer__icon {
      font-size: 1.5rem;
      animation: icon-swing 0.5s ease-in-out infinite alternate;
    }

    @keyframes icon-swing {
      0% { transform: rotate(-5deg); }
      100% { transform: rotate(5deg); }
    }

    .turn-timer__content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .turn-timer__label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary-color, #6366f1);
      opacity: 0.8;
    }

    .turn-timer__bar {
      width: 120px;
      height: 6px;
      background: rgba(99, 102, 241, 0.2);
      border-radius: 3px;
      overflow: hidden;
    }

    .turn-timer__progress {
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7);
      border-radius: 3px;
      transition: width 0.1s linear;
    }

    .turn-timer__text {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--primary-color, #6366f1);
      min-width: 2rem;
      text-align: center;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
    }

    /* Warning state - last 2 seconds */
    .turn-timer--warning {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(249, 115, 22, 0.2));
      border-color: rgba(239, 68, 68, 0.5);
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
      animation: timer-shake 0.3s ease-in-out infinite;
    }

    @keyframes timer-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-2px); }
      75% { transform: translateX(2px); }
    }

    .turn-timer--warning .turn-timer__icon {
      animation: icon-shake 0.2s ease-in-out infinite;
    }

    @keyframes icon-shake {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-10deg); }
      75% { transform: rotate(10deg); }
    }

    .turn-timer--warning .turn-timer__progress {
      background: linear-gradient(90deg, #ef4444, #f97316, #eab308);
    }

    .turn-timer--warning .turn-timer__text {
      color: #ef4444;
      text-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
    }

    .turn-timer--warning .turn-timer__label {
      color: #ef4444;
    }

    /* Ready Timer - similar to turn timer but for ready phase */
    .ready-timer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      padding: 0.75rem 1.25rem;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.15));
      border: 2px solid rgba(34, 197, 94, 0.4);
      border-radius: 2rem;
      box-shadow: 0 4px 15px rgba(34, 197, 94, 0.2);
      animation: ready-timer-pulse 1s ease-in-out infinite;
    }

    @keyframes ready-timer-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.02); }
    }

    .ready-timer__icon {
      font-size: 1.5rem;
      animation: icon-swing 0.5s ease-in-out infinite alternate;
    }

    .ready-timer__content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .ready-timer__label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--success-color, #22c55e);
      opacity: 0.8;
    }

    .ready-timer__bar {
      width: 120px;
      height: 6px;
      background: rgba(34, 197, 94, 0.2);
      border-radius: 3px;
      overflow: hidden;
    }

    .ready-timer__progress {
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #22c55e, #10b981, #14b8a6);
      border-radius: 3px;
      transition: width 0.1s linear;
    }

    .ready-timer__text {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--success-color, #22c55e);
      min-width: 2rem;
      text-align: center;
      font-variant-numeric: tabular-nums;
      text-shadow: 0 2px 4px rgba(34, 197, 94, 0.3);
    }

    /* Warning state - last 5 seconds */
    .ready-timer--warning {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(249, 115, 22, 0.2));
      border-color: rgba(239, 68, 68, 0.5);
      box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
      animation: timer-shake 0.3s ease-in-out infinite;
    }

    .ready-timer--warning .ready-timer__icon {
      animation: icon-shake 0.2s ease-in-out infinite;
    }

    .ready-timer--warning .ready-timer__progress {
      background: linear-gradient(90deg, #ef4444, #f97316, #eab308);
    }

    .ready-timer--warning .ready-timer__text {
      color: #ef4444;
      text-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
    }

    .ready-timer--warning .ready-timer__label {
      color: #ef4444;
    }

    .turn-indicator {
      text-align: center;
      padding: 1rem;
      margin-bottom: 1.5rem;
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid var(--primary-color);
      border-radius: 0.5rem;
      font-weight: 600;
    }

    .waiting-message {
      text-align: center;
      padding: 3rem 1rem;
    }

    .waiting-message__icon {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }

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
      background: var(--primary-color-alpha, rgba(99, 102, 241, 0.1));
      border-radius: 0.5rem;
      border: 1px solid var(--primary-color, #6366f1);
    }

    .not-in-room__spectator-option .form-checkbox {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .not-in-room__spectator-option .form-checkbox input[type="checkbox"] {
      width: 1.25rem;
      height: 1.25rem;
      cursor: pointer;
      accent-color: var(--primary-color, #6366f1);
    }

    .not-in-room__spectator-option .form-checkbox__label {
      font-weight: 500;
      color: var(--text-color);
    }

    .not-in-room__spectator-option .form-hint {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* ============================================
       CHAT PANEL STYLES
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

    .chat-input {
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

    .chat-input:focus {
      border-color: var(--primary-color);
    }

    .chat-input:disabled {
      background: var(--surface-color, #1e1e2e);
      opacity: 0.6;
      cursor: not-allowed;
    }

    .chat-input--disabled {
      opacity: 0.7;
    }

    .chat-input--disabled .chat-input {
      background: var(--surface-color, #1e1e2e);
      cursor: not-allowed;
    }

    .chat-input--disabled .chat-send-btn {
      opacity: 0.5;
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

    .game-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      margin-top: 1rem;
    }

    .round-info {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .leave-btn {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: border-color 0.2s, color 0.2s;
    }

    .leave-btn:hover {
      border-color: var(--danger-color);
      color: var(--danger-color);
    }

    /* Game Over Screen */
    .game-over {
      text-align: center;
      padding: 2rem;
      max-width: 600px;
      margin: 0 auto;
    }

    .game-over__header {
      margin-bottom: 2rem;
    }

    .game-over__icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .game-over__title {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .game-over__subtitle {
      color: var(--text-muted);
      font-size: 1.125rem;
    }

    .game-over__scores {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .game-over__scores--multi {
      flex-wrap: wrap;
      gap: 1rem;
    }

    .game-over__scores--multi .game-over__player {
      min-width: 100px;
      padding: 0.75rem 1rem;
    }

    .game-over__scores--multi .game-over__player-score {
      font-size: 2rem;
    }

    .game-over__player {
      text-align: center;
      padding: 1rem 1.5rem;
      background: var(--card-bg);
      border: 2px solid var(--border-color);
      border-radius: 0.75rem;
      min-width: 120px;
    }

    .game-over__player--winner {
      border-color: var(--success-color, #22c55e);
      background: rgba(34, 197, 94, 0.1);
    }

    .game-over__player-name {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .game-over__player-score {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--primary-color);
    }

    .game-over__btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .game-over__vs {
      color: var(--text-muted);
      font-weight: 600;
    }

    .game-over__history {
      margin-bottom: 2rem;
    }

    .game-over__history-title {
      font-weight: 600;
      margin-bottom: 1rem;
      font-size: 1rem;
    }

    .game-over__table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .game-over__table th,
    .game-over__table td {
      padding: 0.75rem;
      text-align: center;
      border-bottom: 1px solid var(--border-color);
    }

    .game-over__table th {
      font-weight: 600;
      background: var(--bg-secondary, #f3f4f6);
    }

    .game-over__row--win {
      background: rgba(34, 197, 94, 0.05);
    }

    .game-over__cell--winner {
      color: var(--success-color, #22c55e);
      font-weight: 700;
    }

    .game-over__actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }

    .game-over__btn {
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .game-over__btn:hover {
      opacity: 0.9;
    }

    .game-over__btn--primary {
      background: var(--primary-color);
      color: white;
    }

    .game-over__btn--secondary {
      background: var(--border-color);
      color: var(--text-primary);
    }

    /* Result Overlay */
    .result-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.3s;
    }

    .result-overlay.active {
      display: flex;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .result-content {
      background: var(--card-bg);
      border-radius: 1rem;
      padding: 2rem;
      text-align: center;
      max-width: 400px;
      animation: scaleIn 0.3s;
    }

    @keyframes scaleIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .result-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }

    .result-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }

    .result-scores {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 1.5rem;
    }

    .result-score {
      text-align: center;
    }

    .result-score__value {
      font-size: 2rem;
      font-weight: 700;
    }

    .result-score__label {
      font-size: 0.875rem;
      color: var(--text-muted);
    }

    .result-message {
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }

    .result-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }

    .hidden { display: none !important; }

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
      border-color: var(--success-color, #22c55e);
      background: rgba(34, 197, 94, 0.05);
    }

    .ready-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      background: var(--success-color, #22c55e);
      color: white;
      font-size: 0.7rem;
      font-weight: 600;
      border-radius: 1rem;
      margin-left: 0.5rem;
    }

    .waiting-badge {
      display: inline-block;
      padding: 0.125rem 0.5rem;
      background: var(--text-muted, #6b7280);
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
      color: var(--warning-color, #f59e0b);
      font-size: 0.7rem;
      font-weight: 600;
      border-radius: 1rem;
      margin-left: 0.5rem;
    }

    .lobby-player--spectator {
      border-color: var(--warning-color, #f59e0b);
      background: rgba(245, 158, 11, 0.05);
    }

    .lobby-player__avatar--spectator {
      background: rgba(245, 158, 11, 0.2);
      color: var(--warning-color, #f59e0b);
    }

    .lobby-player--admin {
      border-color: var(--primary-color, #6366f1);
      background: rgba(99, 102, 241, 0.05);
    }

    .lobby-player__avatar--admin {
      background: rgba(99, 102, 241, 0.2);
      color: var(--primary-color, #6366f1);
      border: 2px solid var(--primary-color, #6366f1);
    }

    .waiting-player--admin {
      background: rgba(99, 102, 241, 0.1);
      border-left: 3px solid var(--primary-color, #6366f1);
    }

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

    /* Banned players section */
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

    .banned-players-empty {
      text-align: center;
      padding: 1rem;
      color: var(--text-muted);
      font-size: 0.8125rem;
    }

    /* Waiting for admin message (for non-admin players) */
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
      background: var(--bg-secondary, #f3f4f6);
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }

    .waiting-player--ready {
      background: rgba(34, 197, 94, 0.1);
    }

    .waiting-player__name {
      font-weight: 500;
    }

    .waiting-player__status {
      font-size: 0.75rem;
    }

    .waiting-player__status--ready {
      color: var(--success-color, #22c55e);
      font-weight: 600;
    }

    .waiting-player__status--waiting {
      color: var(--text-muted);
    }

    /* Admin badge */
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

    @media (max-width: 640px) {
      .players-area {
        flex-direction: column;
        gap: 0.5rem;
      }
      .vs-indicator {
        display: none;
      }
      .player-card {
        width: 100%;
        max-width: 200px;
      }
      .dice-container {
        gap: 1.5rem;
      }
      .dice {
        width: 60px;
        height: 60px;
        padding: 8px;
      }
    }
  </style>

  <div class="game-container">
    <header class="game-header">
      <div class="game-title">
        <span id="headerTitle">Bigger Dice</span>
        <span class="game-status game-status--waiting" id="gameStatus">Connecting</span>
      </div>
      <div class="connection-indicator">
        <span class="connection-dot" id="connectionDot"></span>
        <span id="connectionText">Disconnected</span>
      </div>
    </header>

    <!-- LOBBY SECTION -->
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
        <div class="empty-state__icon">🎲</div>
        <h3 class="empty-state__title">No Active Rooms</h3>
        <p class="empty-state__message">Create a new room to start playing!</p>
      </div>

      <div id="roomsGrid" class="rooms-grid hidden"></div>
    </section>

    <!-- GAME SECTION -->
    <section id="gameSection" class="game-section">
      <!-- Waiting state for non-admin players in lobby -->
      <div id="waitingForAdmin" class="waiting-for-admin hidden">
        <div class="waiting-for-admin__icon">⏳</div>
        <div class="waiting-for-admin__title">Waiting in Lobby</div>
        <p class="waiting-for-admin__message">The room admin will select you to play. Please wait...</p>
        <div id="waitingPlayersList" class="waiting-players-list"></div>
      </div>

      <!-- Admin lobby view - shows waiting players -->
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
            <h4 class="banned-players-title">Banned Players</h4>
            <span class="banned-players-count" id="bannedCount">0 banned</span>
          </div>
          <div id="bannedPlayersList" class="banned-players-list"></div>
        </div>
      </div>

      <div id="waitingState" class="waiting-message hidden">
        <div class="waiting-message__icon">Waiting for opponent...</div>
        <p>Share the room link to invite a friend!</p>
      </div>

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

        <div id="turnIndicator" class="turn-indicator hidden">
          Waiting for turn...
        </div>

        <div class="players-area" id="playersArea">
          <!-- Player cards are rendered dynamically based on player_count -->
        </div>

        <div class="dice-area">
          <div class="dice-container" id="diceContainer">
            <!-- Dice are rendered dynamically based on player count -->
          </div>

          <button class="ready-btn hidden" id="readyBtn">Ready!</button>
          <div class="ready-timer hidden" id="readyTimer">
            <span class="ready-timer__icon">⏱️</span>
            <div class="ready-timer__content">
              <span class="ready-timer__label">Auto-ready in</span>
              <div class="ready-timer__bar">
                <div class="ready-timer__progress" id="readyTimerProgress"></div>
              </div>
            </div>
            <span class="ready-timer__text" id="readyTimerText">30</span>
          </div>
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
          <div class="action-buttons" id="actionButtons">
            <button class="roll-btn hidden" id="rollBtn" disabled>Roll Dice</button>
            <button class="auto-play-btn hidden" id="autoPlayBtn">Auto Play</button>
          </div>
        </div>
      </div>

      <!-- Chat Panel -->
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
        <span class="round-info" id="roundInfo">Round 0 / First to 10</span>
        <button class="leave-btn" id="leaveBtn">Leave Game</button>
      </footer>
    </section>
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
        <div class="form-group">
          <label class="form-label" for="playerCountInput">Max Players</label>
          <select class="form-input" id="playerCountInput">
            <option value="2" selected>2 Players</option>
            <option value="3">3 Players</option>
            <option value="4">4 Players</option>
            <option value="5">5 Players</option>
            <option value="6">6 Players</option>
            <option value="7">7 Players</option>
            <option value="8">8 Players</option>
            <option value="9">9 Players</option>
            <option value="10">10 Players</option>
          </select>
          <span class="form-hint">Game starts when all players are ready</span>
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

  <!-- Disconnect Overlay -->
  <div id="disconnectOverlay" class="disconnect-overlay" aria-hidden="true"></div>

  <!-- Result Overlay -->
  <div id="resultOverlay" class="result-overlay">
    <div class="result-content">
      <div class="result-icon" id="resultIcon">🎲</div>
      <h3 class="result-title" id="resultTitle">Round Complete</h3>
      <div class="result-scores">
        <div class="result-score">
          <div class="result-score__value" id="resultScore1">0</div>
          <div class="result-score__label" id="resultLabel1">Player 1</div>
        </div>
        <div class="result-score">
          <div class="result-score__value" id="resultScore2">0</div>
          <div class="result-score__label" id="resultLabel2">Player 2</div>
        </div>
      </div>
      <p class="result-message" id="resultMessage"></p>
      <div class="result-actions">
        <button class="roll-btn" id="resultContinueBtn">Continue</button>
        <button class="leave-btn" id="resultLeaveBtn">Leave Game</button>
      </div>
    </div>
  </div>
`;

/**
 * Connection states
 */
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting'
};

/**
 * Game status
 */
const GameStatus = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished'
};

/**
 * Component modes
 */
const ComponentMode = {
  LOBBY: 'lobby',
  GAME: 'game'
};

/**
 * BiggerDice Custom Element
 */
export class BiggerDice extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    // State
    this.mode = ComponentMode.GAME;
    this.connectionState = ConnectionState.DISCONNECTED;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;

    // Lobby state
    this.availableRooms = [];
    // Pending join state for password-protected rooms
    this.pendingJoinRoomId = null;
    this.pendingJoinRoomName = null;
    this.pendingJoinAsSpectator = false;
    // Not-in-room state (when user visits room URL but isn't a member)
    this.notInRoomInfo = null;
    this.wantsToSpectate = false;  // Whether user wants to join as spectator

    // Game state
    this.roomId = '';
    this.roomName = '';
    this.players = [];
    this.lobby = [];           // Players waiting in lobby
    this.bannedPlayers = [];   // Players banned from room (user_id, username)
    this.spectators = [];      // Users watching the game
    this.hostId = null;        // Room admin/host user ID
    this.isAdmin = false;      // Whether current user is room admin
    this.maxPlayers = 2;       // Max players for this room (2-10)
    this.allowSpectators = true; // Whether spectators can join
    this.gameStatus = GameStatus.WAITING;
    this.currentTurn = null;
    this.round = 0;
    this.myPlayerId = null;
    this.roundHistory = [];    // Track all round results for game over screen
    this.lastDiceState = null;
    this.diceElements = [];    // Array of dice DOM elements (one per player)
    this.disconnectedPlayers = new Map(); // user_id -> { timeoutAt }
    this.kickVotes = new Set();           // user_id values already voted to kick
    this.autoPlayers = new Set();         // user_id values auto-controlled
    this.pendingAutoRoll = null;          // Tracks pending auto-roll to prevent duplicates
    this.autoRollTimeoutId = null;        // Tracks setTimeout ID for auto-roll (for cleanup)
    this.isAnimating = false;             // Flag to track dice animation in progress
    this.animationPromise = null;         // Promise that resolves when current animation completes
    this.rollEventQueue = [];             // Queue of roll events waiting to be animated
    this.roundEndedWithWinner = false;    // Flag to add delay after round ends before next auto-roll
    this.disconnectTicker = null;
    this.disconnectOverlayIds = new Set();
    this.windowEventsBound = false;
    this.hasSentDisconnectIntent = false;
    this.handlePageHide = null;
    this.handleBeforeUnload = null;
    this.handleOffline = null;

    // Turn timer state (5 second auto-roll for manual players)
    this.turnTimer = null;              // Timer interval reference
    this.turnTimeRemaining = 0;         // Seconds remaining
    this.turnTimerDuration = 5;         // Total seconds for turn timer

    // Game config state (loaded from API)
    this.gameConfig = {
      entry_fee_cents: 1000,            // Default: 10 coins
      ready_timeout_seconds: 30,        // Default: 30 seconds
      winning_percentage: 60            // Default: 60%
    };

    // Ready timer state (auto-ready when all players selected)
    this.readyTimer = null;             // Timer interval reference
    this.readyTimeRemaining = 0;        // Seconds remaining
    this.readyTimerDuration = 30;       // Total seconds (loaded from config)

    // Chat state
    this.chatChannel = 'lobby';           // Current chat channel (lobby, players, spectators)
    this.chatMessages = {                 // Messages by channel
      lobby: [],
      players: [],
      spectators: []
    };
    this.chatHistoryRequested = {         // Track if history was already requested (prevents infinite loops)
      lobby: false,
      players: false,
      spectators: false
    };
    this.chatUnreadCounts = {             // Unread message counts by channel
      lobby: 0,
      players: 0,
      spectators: 0
    };
    this.mutedUsers = new Set();          // User IDs we've muted locally
    this.isChatCollapsed = false;         // Chat panel collapse state
    this.isPlayer = false;                // Whether current user is a player
    this.isSpectator = false;             // Whether current user is a spectator

    this.cacheElements();
    this.bindEvents();
  }

  static get observedAttributes() {
    return ['data-ws-url', 'data-room-id', 'data-room-name', 'data-user-id', 'data-username', 'data-avatar-id', 'data-balance', 'data-mode', 'data-spectate'];
  }

  connectedCallback() {
    this.wsUrl = this.dataset.wsUrl;
    this.roomId = this.dataset.roomId || '';
    this.roomName = this.dataset.roomName || '';
    this.userId = this.dataset.userId;
    this.username = this.dataset.username;
    this.avatarId = this.dataset.avatarId;
    this.myPlayerId = this.userId;
    this.mode = this.dataset.mode === 'lobby' ? ComponentMode.LOBBY : ComponentMode.GAME;
    this.wantsToSpectate = this.dataset.spectate === 'true';

    // Fetch game config from API (async, doesn't block connection)
    this.fetchGameConfig();

    // Set up UI based on mode
    this.setupModeUI();
    this.bindWindowEvents();

    if (this.wsUrl) {
      this.connect();
    }
  }

  disconnectedCallback() {
    this.unbindWindowEvents();
    this.disconnect();
    // Clear any pending auto-roll timeout (parallel games fix)
    if (this.autoRollTimeoutId) {
      clearTimeout(this.autoRollTimeoutId);
      this.autoRollTimeoutId = null;
    }
    this.pendingAutoRoll = null;
    // Stop ready timer if running
    this.stopReadyTimer();
  }

  cacheElements() {
    const $ = (id) => {
      const el = this.shadowRoot.getElementById(id);
      if (!el) {
        console.warn(`[BiggerDice] Element not found: ${id}`);
      }
      return el;
    };

    this.elements = {
      headerTitle: $('headerTitle'),
      gameStatus: $('gameStatus'),
      connectionDot: $('connectionDot'),
      connectionText: $('connectionText'),
      // Lobby elements
      lobbySection: $('lobbySection'),
      createRoomBtn: $('createRoomBtn'),
      loadingState: $('loadingState'),
      emptyState: $('emptyState'),
      roomsGrid: $('roomsGrid'),
      createRoomModal: $('createRoomModal'),
      createRoomForm: $('createRoomForm'),
      roomNameInput: $('roomNameInput'),
      roomPasswordInput: $('roomPasswordInput'),
      playerCountInput: $('playerCountInput'),
      allowSpectatorsInput: $('allowSpectatorsInput'),
      modalCloseBtn: $('modalCloseBtn'),
      modalCancelBtn: $('modalCancelBtn'),
      modalCreateBtn: $('modalCreateBtn'),
      // Join password modal elements
      joinPasswordModal: $('joinPasswordModal'),
      joinPasswordForm: $('joinPasswordForm'),
      joinPasswordInput: $('joinPasswordInput'),
      joinPasswordError: $('joinPasswordError'),
      joinPasswordCloseBtn: $('joinPasswordCloseBtn'),
      joinPasswordCancelBtn: $('joinPasswordCancelBtn'),
      // Create confirmation modal elements
      createConfirmModal: $('createConfirmModal'),
      createConfirmLoader: $('createConfirmLoader'),
      createConfirmMessage: $('createConfirmMessage'),
      createConfirmCloseBtn: $('createConfirmCloseBtn'),
      createConfirmCancelBtn: $('createConfirmCancelBtn'),
      createConfirmBtn: $('createConfirmBtn'),
      // Join confirmation modal elements
      joinConfirmModal: $('joinConfirmModal'),
      joinConfirmLoader: $('joinConfirmLoader'),
      joinConfirmMessage: $('joinConfirmMessage'),
      joinConfirmCloseBtn: $('joinConfirmCloseBtn'),
      joinConfirmCancelBtn: $('joinConfirmCancelBtn'),
      joinConfirmBtn: $('joinConfirmBtn'),
      // Game elements
      gameSection: $('gameSection'),
      waitingForAdmin: $('waitingForAdmin'),
      waitingPlayersList: $('waitingPlayersList'),
      adminLobby: $('adminLobby'),
      lobbyCount: $('lobbyCount'),
      lobbyPlayersList: $('lobbyPlayersList'),
      bannedPlayersSection: $('bannedPlayersSection'),
      bannedCount: $('bannedCount'),
      bannedPlayersList: $('bannedPlayersList'),
      waitingState: $('waitingState'),
      notInRoomState: $('notInRoomState'),
      enterRoomBtn: $('enterRoomBtn'),
      enterRoomBtnText: $('enterRoomBtnText'),
      notInRoomHint: $('notInRoomHint'),
      spectatorOptionContainer: $('spectatorOptionContainer'),
      joinAsSpectatorCheckbox: $('joinAsSpectatorCheckbox'),
      gameBoard: $('gameBoard'),
      turnIndicator: $('turnIndicator'),
      playersArea: $('playersArea'),
      diceContainer: $('diceContainer'),
      readyBtn: $('readyBtn'),
      actionButtons: $('actionButtons'),
      rollBtn: $('rollBtn'),
      autoPlayBtn: $('autoPlayBtn'),
      turnTimer: $('turnTimer'),
      turnTimerProgress: $('turnTimerProgress'),
      turnTimerText: $('turnTimerText'),
      readyTimer: $('readyTimer'),
      readyTimerProgress: $('readyTimerProgress'),
      readyTimerText: $('readyTimerText'),
      roundInfo: $('roundInfo'),
      leaveBtn: $('leaveBtn'),
      disconnectOverlay: $('disconnectOverlay'),
      resultOverlay: $('resultOverlay'),
      resultIcon: $('resultIcon'),
      resultTitle: $('resultTitle'),
      resultScore1: $('resultScore1'),
      resultLabel1: $('resultLabel1'),
      resultScore2: $('resultScore2'),
      resultLabel2: $('resultLabel2'),
      resultMessage: $('resultMessage'),
      resultContinueBtn: $('resultContinueBtn'),
      resultLeaveBtn: $('resultLeaveBtn'),
      // Spectator elements
      spectatorBanner: $('spectatorBanner'),
      requestToPlayBtn: $('requestToPlayBtn'),
      spectatorsPanel: $('spectatorsPanel'),
      spectatorsCount: $('spectatorsCount'),
      spectatorsList: $('spectatorsList'),
      gameFooter: $('gameFooter'),
      // Chat elements
      chatPanel: $('chatPanel'),
      chatTabLobby: $('chatTabLobby'),
      chatTabPlayers: $('chatTabPlayers'),
      chatTabSpectators: $('chatTabSpectators'),
      lobbyBadge: $('lobbyBadge'),
      playersBadge: $('playersBadge'),
      spectatorsBadge: $('spectatorsBadge'),
      chatToggle: $('chatToggle'),
      chatBody: $('chatBody'),
      chatMessages: $('chatMessages'),
      chatForm: $('chatForm'),
      chatInput: $('chatInput'),
      chatSend: $('chatSend'),
    };
  }

  bindEvents() {
    console.log('[BiggerDice] Binding events...');

    // Lobby events
    if (this.elements.createRoomBtn) {
      this.elements.createRoomBtn.addEventListener('click', () => {
        console.log('[BiggerDice] Create room button clicked');
        this.showCreateRoomModal();
      });
    }
    if (this.elements.modalCloseBtn) {
      this.elements.modalCloseBtn.addEventListener('click', () => {
        console.log('[BiggerDice] Modal close button clicked');
        this.hideCreateRoomModal();
      });
    }
    if (this.elements.modalCancelBtn) {
      this.elements.modalCancelBtn.addEventListener('click', () => {
        console.log('[BiggerDice] Modal cancel button clicked');
        this.hideCreateRoomModal();
      });
    }
    if (this.elements.createRoomForm) {
      this.elements.createRoomForm.addEventListener('submit', (e) => {
        console.log('[BiggerDice] Form submitted');
        e.preventDefault();
        e.stopPropagation();
        this.showCreateConfirmModal();
      });
    }
    // Also bind direct click on create button as fallback
    if (this.elements.modalCreateBtn) {
      this.elements.modalCreateBtn.addEventListener('click', (e) => {
        console.log('[BiggerDice] Create button clicked directly');
        e.preventDefault();
        e.stopPropagation();
        this.showCreateConfirmModal();
      });
    }
    if (this.elements.createRoomModal) {
      this.elements.createRoomModal.addEventListener('click', (e) => {
        if (e.target === this.elements.createRoomModal) {
          console.log('[BiggerDice] Modal overlay clicked');
          this.hideCreateRoomModal();
        }
      });
    }

    // Join password modal events
    if (this.elements.joinPasswordCloseBtn) {
      this.elements.joinPasswordCloseBtn.addEventListener('click', () => this.hideJoinPasswordModal());
    }
    if (this.elements.joinPasswordCancelBtn) {
      this.elements.joinPasswordCancelBtn.addEventListener('click', () => this.hideJoinPasswordModal());
    }
    if (this.elements.joinPasswordForm) {
      this.elements.joinPasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitJoinWithPassword();
      });
    }
    if (this.elements.joinPasswordModal) {
      this.elements.joinPasswordModal.addEventListener('click', (e) => {
        if (e.target === this.elements.joinPasswordModal) {
          this.hideJoinPasswordModal();
        }
      });
    }

    // Create confirmation modal events
    if (this.elements.createConfirmCloseBtn) {
      this.elements.createConfirmCloseBtn.addEventListener('click', () => this.hideCreateConfirmModal());
    }
    if (this.elements.createConfirmCancelBtn) {
      this.elements.createConfirmCancelBtn.addEventListener('click', () => this.hideCreateConfirmModal());
    }
    if (this.elements.createConfirmBtn) {
      this.elements.createConfirmBtn.addEventListener('click', () => {
        this.hideCreateConfirmModal();
        this.createRoom();
      });
    }
    if (this.elements.createConfirmModal) {
      this.elements.createConfirmModal.addEventListener('click', (e) => {
        if (e.target === this.elements.createConfirmModal) {
          this.hideCreateConfirmModal();
        }
      });
    }

    // Join confirmation modal events
    if (this.elements.joinConfirmCloseBtn) {
      this.elements.joinConfirmCloseBtn.addEventListener('click', () => this.hideJoinConfirmModal());
    }
    if (this.elements.joinConfirmCancelBtn) {
      this.elements.joinConfirmCancelBtn.addEventListener('click', () => this.hideJoinConfirmModal());
    }
    if (this.elements.joinConfirmBtn) {
      this.elements.joinConfirmBtn.addEventListener('click', () => {
        this.hideJoinConfirmModal();
        this.executeJoinRoom();
      });
    }
    if (this.elements.joinConfirmModal) {
      this.elements.joinConfirmModal.addEventListener('click', (e) => {
        if (e.target === this.elements.joinConfirmModal) {
          this.hideJoinConfirmModal();
        }
      });
    }

    // Game events
    if (this.elements.readyBtn) {
      this.elements.readyBtn.addEventListener('click', () => this.sendReady());
    }
    if (this.elements.rollBtn) {
      this.elements.rollBtn.addEventListener('click', () => this.sendRoll());
    }
    if (this.elements.autoPlayBtn) {
      this.elements.autoPlayBtn.addEventListener('click', () => this.sendEnableAutoPlay());
    }
    if (this.elements.leaveBtn) {
      this.elements.leaveBtn.addEventListener('click', () => this.leaveGame());
    }
    if (this.elements.resultContinueBtn) {
      this.elements.resultContinueBtn.addEventListener('click', () => this.hideResultOverlay());
    }
    if (this.elements.resultLeaveBtn) {
      this.elements.resultLeaveBtn.addEventListener('click', () => this.leaveGame());
    }

    // Enter Room button (for not-in-room state)
    if (this.elements.enterRoomBtn) {
      this.elements.enterRoomBtn.addEventListener('click', () => this.handleEnterRoomClick());
    }

    // Join as Spectator checkbox (for not-in-room state)
    if (this.elements.joinAsSpectatorCheckbox) {
      this.elements.joinAsSpectatorCheckbox.addEventListener('change', (e) => {
        this.wantsToSpectate = e.target.checked;
        this.updateEnterRoomButton();
      });
    }

    // Spectator "Request to Play" button
    if (this.elements.requestToPlayBtn) {
      this.elements.requestToPlayBtn.addEventListener('click', () => this.requestToPlay());
    }

    // Chat events
    if (this.elements.chatTabLobby) {
      this.elements.chatTabLobby.addEventListener('click', () => this.switchChatChannel('lobby'));
    }
    if (this.elements.chatTabPlayers) {
      this.elements.chatTabPlayers.addEventListener('click', () => this.switchChatChannel('players'));
    }
    if (this.elements.chatTabSpectators) {
      this.elements.chatTabSpectators.addEventListener('click', () => this.switchChatChannel('spectators'));
    }
    if (this.elements.chatToggle) {
      this.elements.chatToggle.addEventListener('click', () => this.toggleChat());
    }
    if (this.elements.chatForm) {
      this.elements.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.sendChatMessage();
      });
    }

    if (this.elements.playersArea) {
      this.elements.playersArea.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action="kick-disconnected"]');
        if (!button) return;
        const targetUserId = button.dataset.userId;
        if (targetUserId) {
          this.sendKickDisconnected(targetUserId);
        }
      });
    }
    if (this.elements.disconnectOverlay) {
      this.elements.disconnectOverlay.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action="kick-disconnected"]');
        if (!button) return;
        const targetUserId = button.dataset.userId;
        if (targetUserId) {
          this.sendKickDisconnected(targetUserId);
        }
      });
    }

    console.log('[BiggerDice] Events bound successfully');
  }

  bindWindowEvents() {
    if (this.windowEventsBound) return;

    this.handlePageHide = () => this.notifyDisconnectIntent();
    this.handleBeforeUnload = () => this.notifyDisconnectIntent();
    this.handleOffline = () => {
      this.notifyDisconnectIntent();
      this.ws?.close();
    };

    window.addEventListener('pagehide', this.handlePageHide);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    window.addEventListener('offline', this.handleOffline);
    this.windowEventsBound = true;
  }

  unbindWindowEvents() {
    if (!this.windowEventsBound) return;

    if (this.handlePageHide) {
      window.removeEventListener('pagehide', this.handlePageHide);
    }
    if (this.handleBeforeUnload) {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    if (this.handleOffline) {
      window.removeEventListener('offline', this.handleOffline);
    }

    this.handlePageHide = null;
    this.handleBeforeUnload = null;
    this.handleOffline = null;
    this.windowEventsBound = false;
  }

  notifyDisconnectIntent() {
    if (this.hasSentDisconnectIntent) return;
    if (!this.roomId) return;
    if (this.gameStatus !== GameStatus.PLAYING) return;
    if (!this.isPlayer || this.isSpectator) return;

    this.hasSentDisconnectIntent = true;
    this.send({
      type: 'games.command.leave_room',
      room_id: this.roomId
    });
  }

  setupModeUI() {
    if (this.mode === ComponentMode.LOBBY) {
      this.elements.lobbySection.classList.add('active');
      this.elements.gameSection.classList.remove('active');
      this.elements.headerTitle.textContent = 'Bigger Dice Lobby';
    } else {
      this.elements.lobbySection.classList.remove('active');
      this.elements.gameSection.classList.add('active');
      this.elements.headerTitle.textContent = this.roomName || 'Bigger Dice';
    }
  }

  // ============================================
  // WebSocket Connection
  // ============================================

  connect() {
    if (this.connectionState === ConnectionState.CONNECTING) return;

    this.setConnectionState(ConnectionState.CONNECTING);

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (e) => this.handleMessage(e);
      this.ws.onclose = (e) => this.handleClose(e);
      this.ws.onerror = (e) => this.handleError(e);
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.stopHeartbeat();
    this.stopDisconnectTickerIfNeeded();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState(ConnectionState.DISCONNECTED);
  }

  handleOpen() {
    console.log('BiggerDice: WebSocket connected');
    this.reconnectAttempts = 0;
    this.startHeartbeat();
  }

  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('BiggerDice: Received', message.type, message);

      switch (message.type) {
        case 'system.welcome':
          this.handleWelcome(message);
          break;
        case 'system.authenticated':
          this.handleAuthenticated(message);
          break;
        case 'system.heartbeat_ack':
          this.handleHeartbeatAck();
          break;
        case 'system.error':
          this.handleSystemError(message);
          break;

        // Lobby messages
        case 'room_list':
        case 'games.event.room_list':
          this.handleRoomList(message.rooms);
          break;
        // Room created - bigger_dice prefixed only
        case 'games.event.bigger_dice.room_created':
          this.handleRoomCreated(message);
          break;
        case 'games.event.bigger_dice.room_joined':
          this.handleRoomJoined(message);
          break;
        // Room removed - bigger_dice prefixed only
        case 'games.event.bigger_dice.room_removed':
          this.handleRoomRemoved(message);
          break;

        // Game messages - bigger_dice prefixed only
        case 'games.event.bigger_dice.room_state':
          this.handleRoomState(message.room);
          break;
        case 'games.event.bigger_dice.player_joined':
          this.handlePlayerJoined(message);
          break;
        // Player left - bigger_dice prefixed only
        case 'games.event.bigger_dice.player_left':
          this.handlePlayerLeft(message);
          break;
        case 'games.event.bigger_dice.player_disconnected':
          this.handlePlayerDisconnected(message);
          break;
        case 'games.event.bigger_dice.player_rejoined':
          this.handlePlayerRejoined(message);
          break;
        case 'games.event.bigger_dice.player_auto_enabled':
          this.handlePlayerAutoEnabled(message);
          break;
        case 'games.event.bigger_dice.player_auto_disabled':
          this.handlePlayerAutoDisabled(message);
          break;
        // Lobby events (admin/player selection system) - bigger_dice prefixed only
        case 'games.event.bigger_dice.lobby_joined':
          this.handleLobbyJoined(message);
          break;
        // Player selected - bigger_dice prefixed only
        case 'games.event.bigger_dice.player_selected':
          this.handlePlayerSelected(message);
          break;
        // Player kicked - bigger_dice prefixed only
        case 'games.event.bigger_dice.player_kicked':
          this.handlePlayerKicked(message);
          break;
        // Player banned - bigger_dice prefixed only
        case 'games.event.bigger_dice.player_banned':
          this.handlePlayerBanned(message);
          break;
        // Player unbanned - bigger_dice prefixed only
        case 'games.event.bigger_dice.player_unbanned':
          this.handlePlayerUnbanned(message);
          break;
        case 'games.event.bigger_dice.user_banned':
          this.handleUserBanned(message);
          break;
        case 'games.event.bigger_dice.lobby_updated':
          this.handleLobbyUpdated(message);
          break;
        // Game started - bigger_dice prefixed only
        case 'games.event.bigger_dice.game_started':
          this.handleGameStarted(message);
          break;
        // Player ready - bigger_dice prefixed only
        case 'games.event.bigger_dice.player_ready':
          this.handlePlayerReady(message);
          break;
        case 'games.event.bigger_dice.rolled':
          this.handleDiceRolled(message);
          break;
        case 'games.event.bigger_dice.state':
          this.handleBiggerDiceState(message);
          break;
        case 'games.event.bigger_dice.round_result':
          this.handleRoundResult(message);
          break;
        case 'games.event.bigger_dice.tiebreaker_started':
          this.handleTiebreakerStarted(message);
          break;
        case 'games.event.bigger_dice.turn_changed':
          this.handleTurnChanged(message);
          break;
        case 'games.event.bigger_dice.round_complete':
          this.handleRoundComplete(message);
          break;
        case 'games.event.bigger_dice.game_over':
          this.handleGameOver(message);
          break;
        case 'error':
        case 'games.event.error':
          this.handleGameError(message);
          break;
        case 'games.event.bigger_dice.not_in_room':
          this.handleNotInRoom(message);
          break;

        // Chat events - bigger_dice channel-specific
        case 'games.event.bigger_dice.lobby_chat':
          this.handleChatMessage(message, 'lobby');
          break;
        case 'games.event.bigger_dice.player_chat':
          this.handleChatMessage(message, 'players');
          break;
        case 'games.event.bigger_dice.spectator_chat':
          this.handleChatMessage(message, 'spectators');
          break;
        case 'games.event.bigger_dice.lobby_chat_history':
          this.handleChatHistory(message, 'lobby');
          break;
        case 'games.event.bigger_dice.player_chat_history':
          this.handleChatHistory(message, 'players');
          break;
        case 'games.event.bigger_dice.spectator_chat_history':
          this.handleChatHistory(message, 'spectators');
          break;
        // Legacy generic chat events (fallback)
        case 'games.event.bigger_dice.chat_message':
          this.handleChatMessage(message, message.channel || 'lobby');
          break;
        case 'games.event.bigger_dice.chat_history':
          this.handleChatHistory(message, message.channel || 'lobby');
          break;
        case 'games.event.bigger_dice.user_muted':
          // Server confirmed user was muted
          console.log('[Chat] User muted:', message.target_user_id);
          break;
        case 'games.event.bigger_dice.user_unmuted':
          // Server confirmed user was unmuted
          console.log('[Chat] User unmuted:', message.target_user_id);
          break;

        // Spectator events - bigger_dice prefixed only
        case 'games.event.bigger_dice.spectator_joined':
        case 'games.event.bigger_dice.spectator_data_joined':
          this.handleSpectatorJoined(message);
          break;
        case 'games.event.bigger_dice.spectator_left':
          this.handleSpectatorLeft(message);
          break;
        case 'games.event.bigger_dice.request_to_play_accepted':
          this.handleRequestToPlayAccepted(message);
          break;

        // Game transition events - bigger_dice prefixed only
        case 'games.event.bigger_dice.removed_from_game':
          this.handleRemovedFromGame(message);
          break;
        case 'games.event.bigger_dice.game_starting':
          this.handleGameStarting(message);
          break;

        default:
          console.warn('BiggerDice: Unknown message type', message.type);
      }
    } catch (error) {
      console.error('BiggerDice: Error parsing message', error);
    }
  }

  handleClose(event) {
    console.log('BiggerDice: WebSocket closed', event.code, event.reason);
    this.stopHeartbeat();
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.scheduleReconnect();
  }

  handleError(error) {
    console.error('BiggerDice: WebSocket error', error);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('BiggerDice: Max reconnect attempts reached');
      this.dispatchEvent(new CustomEvent('game-error', {
        detail: { message: 'Unable to connect to game server' }
      }));
      return;
    }

    this.setConnectionState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`BiggerDice: Reconnecting in ${delay}ms`);
    setTimeout(() => this.connect(), delay);
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('BiggerDice: WebSocket not connected');
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'system.heartbeat' });
        this.heartbeatTimeout = setTimeout(() => {
          console.warn('BiggerDice: Heartbeat timeout');
          this.ws?.close();
        }, 10000);
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  handleHeartbeatAck() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  setConnectionState(state) {
    this.connectionState = state;
    this.updateConnectionUI();
  }

  updateConnectionUI() {
    const dot = this.elements.connectionDot;
    const text = this.elements.connectionText;
    const status = this.elements.gameStatus;

    dot.classList.remove('connection-dot--connected', 'connection-dot--connecting');

    switch (this.connectionState) {
      case ConnectionState.CONNECTED:
        dot.classList.add('connection-dot--connected');
        text.textContent = 'Connected';
        break;
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        dot.classList.add('connection-dot--connecting');
        text.textContent = this.connectionState === ConnectionState.CONNECTING ? 'Connecting...' : 'Reconnecting...';
        break;
      default:
        text.textContent = 'Disconnected';
    }

    if (this.mode === ComponentMode.LOBBY) {
      status.textContent = this.connectionState === ConnectionState.CONNECTED ? 'Connected' : 'Connecting';
    }
  }

  // ============================================
  // Message Handlers
  // ============================================

  handleWelcome(message) {
    console.log('BiggerDice: Welcome received, authenticating');
    this.send({
      type: 'system.authenticate',
      user_id: String(this.userId),
      username: this.username || 'Guest',
      avatar_id: this.avatarId || null
    });
  }

  handleAuthenticated(message) {
    console.log('BiggerDice: Authenticated as', message.username);
    this.setConnectionState(ConnectionState.CONNECTED);

    if (this.mode === ComponentMode.LOBBY) {
      // Request room list
      this.requestRoomList();
    } else if (this.roomId) {
      // Join/rejoin the room - roomId from URL is the UUID
      this.send({
        type: 'games.command.rejoin_room',
        room_id: this.roomId
      });
    }
  }

  handleSystemError(message) {
    console.error('BiggerDice: System error', message.code, message.message);
    this.dispatchEvent(new CustomEvent('game-error', {
      detail: { code: message.code, message: message.message }
    }));
  }

  // ============================================
  // Lobby Handlers
  // ============================================

  requestRoomList() {
    this.send({ type: 'games.command.list_rooms', game_type: 'bigger_dice' });
  }

  handleRoomList(rooms) {
    this.availableRooms = (rooms || []).filter(r => r.game_type === 'bigger_dice');
    this.renderRoomList();
  }

  handleRoomCreated(message) {
    console.log('[BiggerDice] handleRoomCreated:', message);

    // Filter events that aren't for bigger_dice
    if (message.game_type && message.game_type !== 'bigger_dice') {
      console.log('[BiggerDice] Ignoring room_created for different game:', message.game_type);
      return;
    }

    // Normalize to strings for comparison
    const hostIdStr = String(message.host_id);
    const userIdStr = String(this.userId);

    // If we created the room, navigate to it
    if (hostIdStr === userIdStr) {
      console.log('[BiggerDice] We are the host, dispatching room-joined event');
      // Use room_id (UUID) for URL
      this.dispatchEvent(new CustomEvent('room-joined', {
        detail: { room_id: message.room_id, game_type: message.game_type || 'bigger_dice' },
        bubbles: true,
        composed: true
      }));
    } else {
      // Add the new room directly to the list for instant update
      console.log('[BiggerDice] Not the host, adding room to list');
      const newRoom = {
        room_id: message.room_id,
        room_name: message.room_name,
        game_type: message.game_type || 'bigger_dice',
        host_name: message.host_name || message.host_username || 'Unknown',
        status: 'waiting',
        // player_count here means "current number of players" (1 for newly created room)
        player_count: 1,
        spectator_count: 0,
        // max_players comes from backend's player_count field or message.max_players
        max_players: message.player_count || message.max_players || 2,
        allow_spectators: message.allow_spectators === true,
        is_password_protected: message.is_password_protected || false,
      };

      // Only add if we're in lobby mode and room doesn't already exist
      if (this.mode === ComponentMode.LOBBY) {
        const exists = this.availableRooms.some(r => r.room_id === newRoom.room_id);
        if (!exists) {
          this.availableRooms.unshift(newRoom); // Add at beginning (newest first)
          this.renderRoomList();
        }
      }
    }
  }

  handleRoomJoined(message) {
    // Close password modal if open
    if (this.pendingJoinRoomId) {
      this.hideJoinPasswordModal();
    }
    // Clear not-in-room state if we successfully joined
    this.notInRoomInfo = null;
    this.elements.notInRoomState.classList.add('hidden');

    // Reset chat state for new room
    this.chatHistoryRequested = { lobby: false, players: false, spectators: false };
    this.chatMessages = { lobby: [], players: [], spectators: [] };

    // Check if we are the player who joined
    const playerId = message.player?.user_id || message.player_id;
    if (playerId === this.userId || playerId === String(this.userId) || String(playerId) === this.userId) {
      // Navigate to the game room
      this.dispatchEvent(new CustomEvent('room-joined', {
        detail: { room_id: message.room_id, game_type: 'bigger_dice' }
      }));
    } else {
      // Another player joined, refresh room list
      this.requestRoomList();
    }
  }

  handleRoomRemoved(message) {
    console.log('[BiggerDice] handleRoomRemoved:', message);
    const roomId = message.room_id;
    const reason = message.reason || 'unknown';

    // Remove from availableRooms array
    const initialLength = this.availableRooms.length;
    this.availableRooms = this.availableRooms.filter(r => r.room_id !== roomId);

    if (this.availableRooms.length < initialLength) {
      console.log(`[BiggerDice] Room ${roomId} removed from list (reason: ${reason})`);
      // Re-render the room list if we're in lobby mode
      if (this.mode === ComponentMode.LOBBY) {
        this.renderRoomList();
      }
    }

    // If we're currently in this room and it's being removed, show closed message
    if (this.roomId === roomId && this.mode === ComponentMode.GAME) {
      this.showRoomClosedMessage();
    }
  }

  renderRoomList() {
    const grid = this.elements.roomsGrid;
    const loading = this.elements.loadingState;
    const empty = this.elements.emptyState;

    loading.classList.add('hidden');

    if (this.availableRooms.length === 0) {
      empty.classList.remove('hidden');
      grid.classList.add('hidden');
      return;
    }

    empty.classList.add('hidden');
    grid.classList.remove('hidden');

    grid.innerHTML = this.availableRooms.map(room => {
      const currentPlayers = room.players?.length || 0;
      // Support both player_count (room_state) and max_players (room_list) field names
      const maxPlayers = room.player_count || room.max_players || 2;
      const spectatorCount = room.spectator_count || 0;
      // Check allow_spectators - must be explicitly true to allow spectators
      const allowSpectators = room.allow_spectators === true;
      const isFull = currentPlayers >= maxPlayers;
      const canRejoin = room.can_rejoin === true;

      return `
      <div class="room-card" data-room-id="${room.room_id}">
        <div class="room-card__header">
          <span class="room-card__name">
            ${this.escapeHtml(room.room_name)}
            ${room.is_password_protected ? `
              <span class="room-card__lock" title="Password protected">
                <svg class="room-card__lock-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
            ` : ''}
          </span>
          <span class="room-card__status room-card__status--${room.status}">${this.formatStatus(room.status)}</span>
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
            <span class="player-badge ${p.is_ready ? 'player-badge--ready' : ''}">${this.escapeHtml(p.username || p.name)}</span>
          `).join('')}
          ${currentPlayers < maxPlayers ? '<span class="player-badge">Waiting...</span>' : ''}
        </div>
        <div class="room-card__actions">
          ${canRejoin ? `
            <button class="join-btn" data-action="rejoin" data-room-id="${room.room_id}">Rejoin</button>
          ` : ''}
          ${!canRejoin && room.status === 'waiting' && !isFull ? `
            <button class="join-btn" data-action="join" data-room-id="${room.room_id}" data-room-name="${this.escapeHtml(room.room_name)}" data-protected="${room.is_password_protected || false}">Join Game</button>
          ` : ''}
          ${!canRejoin && allowSpectators ? `
            <button class="spectate-btn" data-action="spectate" data-room-id="${room.room_id}">
              ${room.status === 'waiting' ? 'Spectate' : 'Watch'}
            </button>
          ` : ''}
        </div>
      </div>
    `}).join('');

    // Bind room card events
    grid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roomId = e.target.dataset.roomId;
        const action = e.target.dataset.action;

        if (action === 'join' || action === 'spectate' || action === 'rejoin') {
          // Navigate to the game page - actual join/spectate happens there via "Enter Room" button
          // Pass the spectate flag to indicate user preference
          this.dispatchEvent(new CustomEvent('room-joined', {
            detail: {
              room_id: roomId,
              game_type: 'bigger_dice',
              as_spectator: action === 'spectate'
            },
            bubbles: true,
            composed: true
          }));
        }
      });
    });
  }

  showCreateRoomModal() {
    console.log('[BiggerDice] showCreateRoomModal called');
    if (this.elements.createRoomModal) {
      this.elements.createRoomModal.classList.add('active');
      console.log('[BiggerDice] Modal should now be visible');
    } else {
      console.error('[BiggerDice] createRoomModal element not found');
    }
    if (this.elements.roomNameInput) {
      this.elements.roomNameInput.value = '';
      this.elements.roomNameInput.focus();
    }
    if (this.elements.roomPasswordInput) {
      this.elements.roomPasswordInput.value = '';
    }
    if (this.elements.playerCountInput) {
      this.elements.playerCountInput.value = '2';
    }
    if (this.elements.allowSpectatorsInput) {
      this.elements.allowSpectatorsInput.checked = true;
    }
  }

  hideCreateRoomModal() {
    console.log('[BiggerDice] hideCreateRoomModal called');
    if (this.elements.createRoomModal) {
      this.elements.createRoomModal.classList.remove('active');
      console.log('[BiggerDice] Modal hidden');
    }
  }

  // ============================================
  // Game Config Methods
  // ============================================

  /**
   * Fetch game configuration from API.
   * Updates gameConfig state and readyTimerDuration.
   */
  async fetchGameConfig() {
    try {
      const response = await fetch('/api/v1/games/config', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.bigger_dice) {
          this.gameConfig = {
            entry_fee_cents: data.bigger_dice.entry_fee_cents || 1000,
            ready_timeout_seconds: data.bigger_dice.ready_timeout_seconds || 30,
            winning_percentage: data.bigger_dice.winning_percentage || 60
          };
          // Update ready timer duration from config
          this.readyTimerDuration = this.gameConfig.ready_timeout_seconds;
          console.log('[BiggerDice] Game config loaded:', this.gameConfig);
        }
      }
    } catch (e) {
      console.error('[BiggerDice] Failed to fetch game config:', e);
      // Keep defaults on error
    }
  }

  /**
   * Get display cost in coins from entry fee in cents.
   * @returns {number} Cost in coins (cents / 100)
   */
  getDisplayCost() {
    return this.gameConfig.entry_fee_cents / 100;
  }

  // Create confirmation modal methods
  async showCreateConfirmModal() {
    console.log('[BiggerDice] showCreateConfirmModal called');

    // Show modal with loader
    if (this.elements.createConfirmModal) {
      this.elements.createConfirmModal.classList.add('active');
    }

    // Show loader, hide message and button
    if (this.elements.createConfirmLoader) {
      this.elements.createConfirmLoader.classList.remove('hidden');
    }
    if (this.elements.createConfirmMessage) {
      this.elements.createConfirmMessage.classList.add('hidden');
    }
    if (this.elements.createConfirmBtn) {
      this.elements.createConfirmBtn.classList.add('hidden');
    }

    try {
      // Fetch user balance from API
      const response = await fetch('/api/v1/user', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();
      const balance = data.user?.balance ?? 0;
      const requiredBalance = this.gameConfig.entry_fee_cents;
      const displayCost = this.getDisplayCost();
      const hasEnoughBalance = balance >= requiredBalance;

      console.log('[BiggerDice] User balance:', balance, 'Required:', requiredBalance, 'Has enough:', hasEnoughBalance);

      // Hide loader
      if (this.elements.createConfirmLoader) {
        this.elements.createConfirmLoader.classList.add('hidden');
      }

      // Show message
      const messageEl = this.elements.createConfirmMessage;
      if (messageEl) {
        if (hasEnoughBalance) {
          messageEl.textContent = `To create a room, you need at least ${displayCost} coins (${requiredBalance} balance). Creating the room is free, but if you are selected to play, it will cost ${displayCost} coins.`;
          messageEl.classList.remove('confirm-message--error');
        } else {
          messageEl.textContent = `You do not have enough credits to create a game. You need at least ${requiredBalance} balance (${displayCost} coins).`;
          messageEl.classList.add('confirm-message--error');
        }
        messageEl.classList.remove('hidden');
      }

      // Show/hide confirm button based on balance
      const confirmBtn = this.elements.createConfirmBtn;
      if (confirmBtn) {
        if (hasEnoughBalance) {
          confirmBtn.classList.remove('hidden');
        } else {
          confirmBtn.classList.add('hidden');
        }
      }

    } catch (error) {
      console.error('[BiggerDice] Error fetching balance:', error);

      // Hide loader
      if (this.elements.createConfirmLoader) {
        this.elements.createConfirmLoader.classList.add('hidden');
      }

      // Show error message
      if (this.elements.createConfirmMessage) {
        this.elements.createConfirmMessage.textContent = 'Failed to check balance. Please try again.';
        this.elements.createConfirmMessage.classList.add('confirm-message--error');
        this.elements.createConfirmMessage.classList.remove('hidden');
      }
    }
  }

  hideCreateConfirmModal() {
    console.log('[BiggerDice] hideCreateConfirmModal called');
    if (this.elements.createConfirmModal) {
      this.elements.createConfirmModal.classList.remove('active');
    }
  }

  // Join confirmation modal methods
  async showJoinConfirmModal(roomId, roomName, hasPassword = false) {
    console.log('[BiggerDice] showJoinConfirmModal called for room:', roomId);

    // Show modal with loader
    if (this.elements.joinConfirmModal) {
      this.elements.joinConfirmModal.classList.add('active');
    }

    // Show loader, hide message and button
    if (this.elements.joinConfirmLoader) {
      this.elements.joinConfirmLoader.classList.remove('hidden');
    }
    if (this.elements.joinConfirmMessage) {
      this.elements.joinConfirmMessage.classList.add('hidden');
    }
    if (this.elements.joinConfirmBtn) {
      this.elements.joinConfirmBtn.classList.add('hidden');
    }

    try {
      // Fetch user balance from API
      const response = await fetch('/api/v1/user', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();
      const balance = data.user?.balance ?? 0;
      const requiredBalance = this.gameConfig.entry_fee_cents;
      const displayCost = this.getDisplayCost();
      const hasEnoughBalance = balance >= requiredBalance;

      console.log('[BiggerDice] User balance:', balance, 'Required:', requiredBalance, 'Has enough:', hasEnoughBalance);

      // Hide loader
      if (this.elements.joinConfirmLoader) {
        this.elements.joinConfirmLoader.classList.add('hidden');
      }

      // Show message
      const messageEl = this.elements.joinConfirmMessage;
      if (messageEl) {
        if (hasEnoughBalance) {
          messageEl.textContent = `Joining the room is free. However, if the admin selects you to play, it will cost ${displayCost} coins (${requiredBalance} balance).`;
          messageEl.classList.remove('confirm-message--error');
        } else {
          messageEl.textContent = `You do not have enough credits to join this room. You need at least ${requiredBalance} balance (${displayCost} coins) to be eligible for selection.`;
          messageEl.classList.add('confirm-message--error');
        }
        messageEl.classList.remove('hidden');
      }

      // Show/hide confirm button based on balance
      const confirmBtn = this.elements.joinConfirmBtn;
      if (confirmBtn) {
        if (hasEnoughBalance) {
          confirmBtn.classList.remove('hidden');
        } else {
          confirmBtn.classList.add('hidden');
        }
      }

    } catch (error) {
      console.error('[BiggerDice] Error fetching balance:', error);

      // Hide loader
      if (this.elements.joinConfirmLoader) {
        this.elements.joinConfirmLoader.classList.add('hidden');
      }

      // Show error message
      if (this.elements.joinConfirmMessage) {
        this.elements.joinConfirmMessage.textContent = 'Failed to check balance. Please try again.';
        this.elements.joinConfirmMessage.classList.add('confirm-message--error');
        this.elements.joinConfirmMessage.classList.remove('hidden');
      }
    }
  }

  hideJoinConfirmModal() {
    console.log('[BiggerDice] hideJoinConfirmModal called');
    if (this.elements.joinConfirmModal) {
      this.elements.joinConfirmModal.classList.remove('active');
    }
  }

  createRoom() {
    console.log('[BiggerDice] createRoom called');
    const roomName = this.elements.roomNameInput?.value.trim() || `Room ${Date.now()}`;
    const password = this.elements.roomPasswordInput?.value.trim() || '';
    const playerCount = parseInt(this.elements.playerCountInput?.value || '2', 10);
    const allowSpectators = this.elements.allowSpectatorsInput?.checked ?? true;

    console.log('[BiggerDice] Creating room:', roomName, 'players:', playerCount, 'spectators:', allowSpectators);

    const message = {
      type: 'games.command.create_room',
      game_type: 'bigger_dice',
      room_name: roomName,
      max_players: playerCount,
      allow_spectators: allowSpectators
    };

    // Only include password if provided
    if (password) {
      message.password = password;
    }

    this.send(message);
    this.hideCreateRoomModal();
    console.log('[BiggerDice] Room creation message sent');
  }

  // Password modal methods
  showJoinPasswordModal(roomId, roomName, asSpectator = false) {
    this.pendingJoinRoomId = roomId;
    this.pendingJoinRoomName = roomName;
    this.pendingJoinAsSpectator = asSpectator;
    this.elements.joinPasswordInput.value = '';
    this.elements.joinPasswordError.classList.add('hidden');
    this.elements.joinPasswordModal.classList.add('active');
    this.elements.joinPasswordInput.focus();
  }

  hideJoinPasswordModal() {
    this.elements.joinPasswordModal.classList.remove('active');
    this.pendingJoinRoomId = null;
    this.pendingJoinRoomName = null;
    this.pendingJoinAsSpectator = false;
  }

  submitJoinWithPassword() {
    const password = this.elements.joinPasswordInput.value;
    if (!password) return;

    // Send appropriate join request with password based on join type
    if (this.pendingJoinAsSpectator) {
      this.send({
        type: 'games.command.join_as_spectator',
        room_name: this.pendingJoinRoomName,
        password: password
      });
    } else {
      this.send({
        type: 'games.command.join_room',
        room_name: this.pendingJoinRoomName,
        password: password
      });
    }
  }

  // ============================================
  // Chat Methods
  // ============================================

  switchChatChannel(channel) {
    // Determine if current user is a playing player (in players array)
    const amIAPlayer = this.players.some(p =>
      String(p.user_id || p.id) === String(this.myPlayerId)
    );

    console.log('[Chat] switchChatChannel called:', {
      channel,
      isPlayer: this.isPlayer,
      isSpectator: this.isSpectator,
      amIAPlayer,
      currentChannel: this.chatChannel,
      messagesInChannel: this.chatMessages[channel]?.length || 0
    });

    // THREE-CHAT SYSTEM ACCESS RULES:
    // Phase 1 (Lobby): Only lobby chat available
    // Phase 2 (Ready/Playing):
    //   - Players: Can access players chat only (not spectators chat)
    //   - Spectators: Can access both players chat (read-only) and spectators chat

    // Check if lobby chat is disabled (during ready/playing phase)
    if (channel === 'lobby' && this.isLobbyChatDisabled()) {
      console.log('[Chat] Lobby chat is disabled during ready/playing phase');
      return;
    }

    // Check if user can access players channel
    // Both players AND spectators can view players channel during game
    if (channel === 'players' && !this.isPlayer && !this.isSpectator && !amIAPlayer) {
      console.log('[Chat] Cannot access players channel - not a player or spectator');
      return;
    }

    // Check if user can access spectators channel
    // Only spectators (who are NOT players) can access spectators channel
    // Players CANNOT see spectators chat at all
    if (channel === 'spectators' && (amIAPlayer || !this.isSpectator)) {
      console.log('[Chat] Cannot access spectators channel - players cannot see spectator chat');
      return;
    }

    console.log('[Chat] Access granted, setting chatChannel to:', channel);
    this.chatChannel = channel;

    // Update tab styles
    this.elements.chatTabLobby?.classList.toggle('active', channel === 'lobby');
    this.elements.chatTabPlayers?.classList.toggle('active', channel === 'players');
    this.elements.chatTabSpectators?.classList.toggle('active', channel === 'spectators');

    // Clear unread count for this channel
    this.chatUnreadCounts[channel] = 0;
    this.updateChatBadges();

    // Render messages for this channel
    console.log('[Chat] About to renderChatMessages, chatChannel is:', this.chatChannel);
    this.renderChatMessages();

    // Update chat input visibility based on channel and role
    this.updateChatInputAccess();

    // Request chat history if we don't have any messages for this channel (only once per channel)
    if (!this.chatHistoryRequested[channel] && this.chatMessages[channel].length === 0 && this.roomId) {
      this.chatHistoryRequested[channel] = true;
      this.requestChatHistory(channel);
    }
  }

  isLobbyChatDisabled() {
    // Lobby chat is disabled when:
    // 1. Game is in progress or finished
    // 2. All player slots are filled (ready phase - players need to click ready)
    if (this.gameStatus === GameStatus.STARTING ||
      this.gameStatus === GameStatus.IN_PROGRESS ||
      this.gameStatus === GameStatus.PLAYING ||
      this.gameStatus === GameStatus.FINISHED) {
      return true;
    }

    // In WAITING status, check if all players are selected (ready phase)
    // When players are selected (in players array), lobby chat should be disabled
    if (this.gameStatus === GameStatus.WAITING && this.players.length >= this.maxPlayers) {
      return true;
    }

    return false;
  }

  updateChatInputAccess() {
    const chatForm = this.elements.chatForm;
    const chatInput = this.elements.chatInput;
    const sendBtn = this.elements.chatSend;

    // Determine if current user is a playing player
    const amIAPlayer = this.players.some(p =>
      String(p.user_id || p.id) === String(this.myPlayerId)
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

  toggleChat() {
    this.isChatCollapsed = !this.isChatCollapsed;
    this.elements.chatPanel?.classList.toggle('collapsed', this.isChatCollapsed);
  }

  sendChatMessage() {
    const content = this.elements.chatInput?.value.trim();
    if (!content || !this.roomId) return;

    this.send({
      type: 'games.command.send_chat',
      room_id: this.roomId,
      channel: this.chatChannel,
      content: content,
      avatar_id: this.avatarId || null
    });

    // Clear input
    if (this.elements.chatInput) {
      this.elements.chatInput.value = '';
    }
  }

  requestChatHistory(channel) {
    if (!this.roomId) return;

    this.send({
      type: 'games.command.get_chat_history',
      room_id: this.roomId,
      channel: channel,
      limit: 50
    });
  }

  handleChatMessage(message, channelOverride) {
    // Channel can come from parameter (channel-specific events) or message payload (legacy)
    const channel = channelOverride || message.channel || 'lobby';

    console.log('[Chat] handleChatMessage received:', {
      channel: channel,
      username: message.username,
      content: message.content?.substring(0, 50),
      currentChannel: this.chatChannel,
      isSpectator: this.isSpectator
    });

    const chatMsg = {
      id: message.message_id || Date.now(),
      userId: message.user_id,
      username: message.username || 'Unknown',
      avatarId: message.avatar_id,
      content: message.content,
      isSystem: message.is_system || false,
      isModerated: message.is_moderated || false,
      timestamp: message.created_at ? new Date(message.created_at) : new Date(),
    };

    // Add to messages array
    if (!this.chatMessages[channel]) {
      this.chatMessages[channel] = [];
    }
    this.chatMessages[channel].push(chatMsg);
    console.log('[Chat] Added message to channel', channel, '- now has', this.chatMessages[channel].length, 'messages');

    // Keep only last 100 messages per channel
    if (this.chatMessages[channel].length > 100) {
      this.chatMessages[channel] = this.chatMessages[channel].slice(-100);
    }

    // If this is the active channel, render
    if (channel === this.chatChannel) {
      console.log('[Chat] Channel matches current, rendering');
      this.renderChatMessages();
    } else {
      // Increment unread count for other channels
      console.log('[Chat] Channel does not match current (' + this.chatChannel + '), incrementing badge');
      this.chatUnreadCounts[channel]++;
      this.updateChatBadges();
    }
  }

  handleChatHistory(message, channelOverride) {
    // Channel can come from parameter (channel-specific events) or message payload (legacy)
    const channel = channelOverride || message.channel || 'lobby';
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
      isModerated: m.is_moderated || false,
      timestamp: m.created_at ? new Date(m.created_at) : new Date(),
    }));

    // Get existing real-time messages that arrived before history response
    const existingMessages = this.chatMessages[channel] || [];
    const existingIds = new Set(existingMessages.map(m => String(m.id)));

    // Merge: history messages + any real-time messages not in history (by ID)
    // This preserves real-time messages that arrived after history was requested
    const newMessagesFromHistory = historyMapped.filter(m => !existingIds.has(String(m.id)));
    const merged = [...newMessagesFromHistory, ...existingMessages];

    // Sort by timestamp (oldest first)
    merged.sort((a, b) => a.timestamp - b.timestamp);

    // Keep only last 100 messages
    const previousCount = existingMessages.length;
    this.chatMessages[channel] = merged.slice(-100);

    console.log('[Chat] handleChatHistory: merged', historyMapped.length, 'history +', existingMessages.length, 'existing =', this.chatMessages[channel].length, 'messages for channel', channel);

    // Render if this is the active channel
    if (channel === this.chatChannel) {
      console.log('[Chat] handleChatHistory: channel matches current, rendering');
      this.renderChatMessages();
    }
  }

  renderChatMessages() {
    const container = this.elements.chatMessages;
    console.log('[Chat] renderChatMessages called, chatChannel:', this.chatChannel, 'container exists:', !!container);
    if (!container) {
      console.log('[Chat] renderChatMessages: No container element, returning');
      return;
    }

    const messages = this.chatMessages[this.chatChannel] || [];
    console.log('[Chat] renderChatMessages: Found', messages.length, 'messages for channel', this.chatChannel);
    console.log('[Chat] All chatMessages state:', {
      lobby: this.chatMessages.lobby?.length || 0,
      players: this.chatMessages.players?.length || 0,
      spectators: this.chatMessages.spectators?.length || 0
    });

    if (messages.length === 0) {
      console.log('[Chat] renderChatMessages: No messages, showing empty state');
      container.innerHTML = '<div class="chat-empty">No messages yet. Say hello!</div>';
      return;
    }

    container.innerHTML = messages.map(msg => {
      const isMuted = this.mutedUsers.has(String(msg.userId));

      if (msg.isSystem) {
        return `<div class="chat-message chat-message--system">${this.escapeHtml(msg.content)}</div>`;
      }

      const initials = (msg.username || 'U').substring(0, 2).toUpperCase();
      const timeStr = msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="chat-message ${isMuted ? 'chat-message--muted' : ''}" data-user-id="${msg.userId}">
          <div class="chat-message__avatar">${initials}</div>
          <div class="chat-message__content">
            <div class="chat-message__header">
              <span class="chat-message__username">${this.escapeHtml(msg.username)}</span>
              <span class="chat-message__time">${timeStr}</span>
            </div>
            <div class="chat-message__text">${this.escapeHtml(msg.content)}</div>
          </div>
          ${String(msg.userId) !== String(this.userId) ? `
            <button class="chat-message__mute" data-user-id="${msg.userId}" title="${isMuted ? 'Unmute user' : 'Mute user'}">
              ${isMuted ? '🔊' : '🔇'}
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    console.log('[Chat] renderChatMessages: rendered', messages.length, 'messages to container');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;

    // Bind mute buttons
    container.querySelectorAll('.chat-message__mute').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.target.dataset.userId;
        this.toggleMuteUser(userId);
      });
    });
  }

  toggleMuteUser(userId) {
    const userIdStr = String(userId);
    if (this.mutedUsers.has(userIdStr)) {
      this.mutedUsers.delete(userIdStr);
      // Optionally send unmute command to server
      this.send({
        type: 'games.command.unmute_user',
        room_id: this.roomId,
        target_user_id: parseInt(userId, 10)
      });
    } else {
      this.mutedUsers.add(userIdStr);
      // Optionally send mute command to server
      this.send({
        type: 'games.command.mute_user',
        room_id: this.roomId,
        target_user_id: parseInt(userId, 10)
      });
    }
    this.renderChatMessages();
  }

  updateChatBadges() {
    const updateBadge = (badge, count) => {
      if (!badge) return;
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    };

    updateBadge(this.elements.lobbyBadge, this.chatUnreadCounts.lobby);
    updateBadge(this.elements.playersBadge, this.chatUnreadCounts.players);
    updateBadge(this.elements.spectatorsBadge, this.chatUnreadCounts.spectators);
  }

  updateChatTabAccess() {
    const lobbyTab = this.elements.chatTabLobby;
    const playersTab = this.elements.chatTabPlayers;
    const spectatorsTab = this.elements.chatTabSpectators;

    const lobbyChatDisabled = this.isLobbyChatDisabled();

    // Determine if current user is a playing player (in players array)
    const amIAPlayer = this.players.some(p =>
      String(p.user_id || p.id) === String(this.myPlayerId)
    );

    // THREE-CHAT SYSTEM:
    // Phase 1 (Lobby/Selecting): Single "Lobby Chat" visible to ALL users
    // Phase 2 (Ready/Playing):
    //   - Lobby chat REMOVED for all users
    //   - Players Chat: Players CAN see/send; Spectators CAN see (read-only) but CANNOT send
    //   - Spectators Chat: Spectators CAN see/send; Players CANNOT see at all

    // Lobby tab - visible during lobby/selecting phase, hidden during ready/playing phase
    if (lobbyTab) {
      if (lobbyChatDisabled) {
        lobbyTab.classList.add('hidden');
        lobbyTab.disabled = true;
      } else {
        lobbyTab.classList.remove('hidden');
        lobbyTab.disabled = false;
      }
    }

    // Players tab - visible during ready/playing phase for BOTH players and spectators
    // Players can send; Spectators can view (read-only)
    if (playersTab) {
      if (lobbyChatDisabled) {
        // Show players tab for both players and spectators
        playersTab.classList.remove('hidden');
        playersTab.classList.remove('disabled');
        playersTab.disabled = false;

        // Add visual indicator for spectators that this is read-only
        if (this.isSpectator && !amIAPlayer) {
          playersTab.setAttribute('title', 'View players chat (read-only)');
        } else {
          playersTab.removeAttribute('title');
        }
      } else {
        // During lobby phase: hide players tab (use lobby chat instead)
        playersTab.classList.add('hidden');
        playersTab.disabled = true;
      }
    }

    // Spectators tab - visible to spectators at ALL times (lobby phase and game phase)
    // Players CANNOT see this tab at all
    if (spectatorsTab) {
      if (this.isSpectator && !amIAPlayer) {
        // Spectators can always access spectators chat
        spectatorsTab.classList.remove('hidden');
        spectatorsTab.classList.remove('disabled');
        spectatorsTab.disabled = false;
      } else {
        // Players cannot see spectators tab at all
        spectatorsTab.classList.add('hidden');
        spectatorsTab.disabled = true;
      }
    }

    // If current channel is no longer accessible, switch to appropriate channel
    if (this.chatChannel === 'lobby' && lobbyChatDisabled) {
      // Lobby chat disabled - switch based on user role
      // Spectators default to spectators chat, players default to players chat
      console.log('[Chat] updateChatTabAccess: lobby disabled, auto-switching. isSpectator:', this.isSpectator, 'amIAPlayer:', amIAPlayer);
      if (this.isSpectator && !amIAPlayer) {
        console.log('[Chat] updateChatTabAccess: switching spectator to spectators channel');
        this.switchChatChannel('spectators');
      } else {
        console.log('[Chat] updateChatTabAccess: switching to players channel');
        this.switchChatChannel('players');
      }
    }

    // If spectators channel is selected but user is not a spectator (or is a player)
    if (this.chatChannel === 'spectators' && (!this.isSpectator || amIAPlayer)) {
      if (lobbyChatDisabled) {
        this.switchChatChannel('players');
      } else {
        this.switchChatChannel('lobby');
      }
    }

    // For spectators, also request players chat history so they can view it
    if (this.isSpectator && !amIAPlayer && lobbyChatDisabled) {
      if (!this.chatHistoryRequested['players'] && this.chatMessages['players'].length === 0 && this.roomId) {
        this.chatHistoryRequested['players'] = true;
        this.requestChatHistory('players');
      }
    }

    // Update input access for current channel
    this.updateChatInputAccess();
  }

  // ============================================
  // Spectator Methods
  // ============================================

  updateSpectatorUI() {
    // Update spectator banner (shown when user is a spectator)
    const banner = this.elements.spectatorBanner;
    const requestBtn = this.elements.requestToPlayBtn;
    if (banner) {
      if (this.isSpectator) {
        banner.classList.remove('hidden');
        // Show "Request to Play" button if room is not full and game is still waiting
        if (requestBtn) {
          const roomHasSpace = this.players.length < this.maxPlayers;
          const canRequestToPlay = roomHasSpace && this.gameStatus === GameStatus.WAITING;
          requestBtn.classList.toggle('hidden', !canRequestToPlay);
        }
      } else {
        banner.classList.add('hidden');
      }
    }

    // Update spectators panel (shows who's watching)
    this.renderSpectatorsList();
  }

  renderSpectatorsList() {
    const panel = this.elements.spectatorsPanel;
    const countEl = this.elements.spectatorsCount;
    const listEl = this.elements.spectatorsList;

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
    const myId = String(this.myPlayerId);
    listEl.innerHTML = this.spectators.map(spectator => {
      const initial = (spectator.username || 'U').charAt(0).toUpperCase();
      const isMe = String(spectator.user_id) === myId;
      return `
        <div class="spectator-item ${isMe ? 'spectator-item--me' : ''}" data-user-id="${spectator.user_id}">
          <span class="spectator-item__avatar">${initial}</span>
          <span class="spectator-item__name">${this.escapeHtml(spectator.username)}${isMe ? ' (you)' : ''}</span>
        </div>
      `;
    }).join('');
  }

  requestToPlay() {
    // Request to switch from spectator to player
    // This sends a request to join the lobby (host will need to select them)
    console.log('[BiggerDice] Requesting to play');
    this.send({
      type: 'games.command.request_to_play',
      room_id: this.roomId
    });

    // Disable the button while waiting for response
    if (this.elements.requestToPlayBtn) {
      this.elements.requestToPlayBtn.disabled = true;
      this.elements.requestToPlayBtn.textContent = 'Requested...';
    }
  }

  handleSpectatorJoined(message) {
    console.log('[BiggerDice] Spectator joined:', message);

    // Handle both formats: direct fields or nested spectator object
    const spectatorData = message.spectator || message;
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
    if (String(spectator.user_id) === String(this.myPlayerId)) {
      this.isSpectator = true;
      this.isPlayer = false;
      console.log('[BiggerDice] Current user joined as spectator, updating chat tabs and game UI');
      this.updateChatTabAccess();
      // Update game UI so spectator sees correct lobby view
      this.updateGameUI();
    }

    // Update spectator UI and admin lobby (to show spectator with badge)
    this.updateSpectatorUI();

    // Re-render admin lobby if admin is viewing it
    if (this.isAdmin && this.elements.adminLobby && !this.elements.adminLobby.classList.contains('hidden')) {
      this.renderAdminLobby();
    }
  }

  handleSpectatorLeft(message) {
    console.log('[BiggerDice] Spectator left:', message);
    const userId = String(message.user_id);

    // Remove from spectators list
    this.spectators = this.spectators.filter(s => String(s.user_id) !== userId);

    // Update spectator UI
    this.updateSpectatorUI();
  }

  handleRequestToPlayAccepted(message) {
    console.log('[BiggerDice] Request to play accepted:', message);

    // If this is about me, update my state
    if (String(message.user_id) === String(this.myPlayerId)) {
      this.isSpectator = false;
      // Note: The player will be added to lobby, so we'll get a lobby_joined event too
    }

    // Remove from spectators
    const userId = String(message.user_id);
    this.spectators = this.spectators.filter(s => String(s.user_id) !== userId);

    // Update UI
    this.updateSpectatorUI();
    this.updateChatTabAccess();
  }

  joinRoom(roomId, isProtected = false) {
    // Dispatch event to navigate to game page
    this.dispatchEvent(new CustomEvent('room-joined', {
      detail: { room_id: roomId, game_type: 'bigger_dice' }
    }));
  }

  // ============================================
  // Game Handlers
  // ============================================

  handleRoomState(room) {
    // Clear "not in room" state since we're now receiving room state
    this.notInRoomInfo = null;
    this.hasSentDisconnectIntent = false;
    if (this.elements.notInRoomState) {
      this.elements.notInRoomState.classList.add('hidden');
    }

    // Show chat panel now that user has joined the room
    if (this.elements.chatPanel) {
      this.elements.chatPanel.classList.remove('hidden');
    }

    // Close password modal if open (successful join)
    if (this.pendingJoinRoomId) {
      this.hideJoinPasswordModal();
    }

    this.roomId = room.room_id;
    this.roomName = room.room_name;
    // During ready phase (status=waiting, selected_players present), players are in lobby not players array
    // Check if we're in ready phase: lobby has players but players array is empty
    const isReadyPhase = room.status === 'waiting' &&
                         room.selected_players && room.selected_players.length > 0 &&
                         (!room.players || room.players.length === 0);

    if (isReadyPhase) {
      // In ready phase, selected players are in lobby - use them as players
      this.players = room.lobby || [];
      this.lobby = room.lobby || [];
      console.log(`[BiggerDice] handleRoomState: READY PHASE - using lobby as players, players.length=${this.players.length}`);
    } else {
      this.players = room.players || [];
      this.lobby = room.lobby || [];
    }

    this.hostId = room.host_id;
    this.isAdmin = String(room.host_id) === String(this.myPlayerId);
    // Backend sends player_count in room_state, but max_players in room_list
    // Support both field names for compatibility
    this.maxPlayers = room.player_count || room.max_players || 2;
    console.log(`[BiggerDice] handleRoomState: maxPlayers=${this.maxPlayers}, players.length=${this.players.length}, player_count=${room.player_count}, max_players=${room.max_players}, isReadyPhase=${isReadyPhase}`);
    this.allowSpectators = room.allow_spectators === true;
    this.gameStatus = room.status === 'in_progress' ? GameStatus.PLAYING : room.status;
    this.currentTurn = room.current_turn;
    this.round = room.round || room.turn_number || 0;

    // Initialize banned players from room state (now contains objects with user_id and username)
    if (room.banned_users && Array.isArray(room.banned_users)) {
      this.bannedPlayers = room.banned_users.map(banned => {
        // Handle both object format (new) and ID-only format (legacy)
        if (typeof banned === 'object' && banned !== null) {
          return {
            user_id: banned.user_id,
            username: banned.username || `User #${banned.user_id}`
          };
        }
        // Legacy: just an ID
        return {
          user_id: banned,
          username: `User #${banned}`
        };
      });
    } else {
      this.bannedPlayers = [];
    }

    // Initialize spectators from room state
    // Use spectators_data (full objects with user_id) instead of spectators (just IDs)
    this.spectators = room.spectators_data || room.spectators || [];
    this.autoPlayers = new Set((room.auto_players || []).map(id => String(id)));
    this.stopDisconnectTickerIfNeeded();

    // Determine if current user is a player or spectator
    // During waiting/selection phase, players are in lobby, not players array
    const userIdStr = String(this.myPlayerId);
    const inPlayers = this.players.some(p => String(p.id || p.user_id) === userIdStr);
    const inLobby = this.lobby.some(p => String(p.user_id) === userIdStr);
    this.isPlayer = inPlayers || inLobby;
    // Check spectators - handle both object format (spectators_data) and plain ID format (legacy)
    this.isSpectator = this.spectators.some(s => {
      if (typeof s === 'object' && s !== null) {
        return String(s.user_id || s.id) === userIdStr;
      }
      // Legacy format: spectators is just an array of user IDs
      return String(s) === userIdStr;
    });

    console.log('[BiggerDice] handleRoomState role check:', {
      myPlayerId: this.myPlayerId,
      userIdStr,
      inPlayers,
      inLobby,
      isPlayer: this.isPlayer,
      isSpectator: this.isSpectator,
      spectatorsCount: this.spectators.length,
      spectatorsFormat: this.spectators.length > 0 ? (typeof this.spectators[0]) : 'empty',
      spectatorIds: this.spectators.map(s => typeof s === 'object' ? (s.user_id || s.id) : s)
    });

    // Update chat tab access based on role
    this.updateChatTabAccess();

    // Update spectator UI (banner and list)
    this.updateSpectatorUI();

    // Request chat history for the lobby channel on initial room join (only once)
    if (!this.chatHistoryRequested.lobby && this.chatMessages.lobby.length === 0) {
      this.chatHistoryRequested.lobby = true;
      this.requestChatHistory('lobby');
    }

    // Request chat history for active game channels on rejoin
    const isGameActive = ['playing', 'in_progress', 'starting'].includes(
      (this.gameStatus || '').toLowerCase()
    );

    if (isGameActive) {
      // Request players chat history (both players and spectators can read)
      if (!this.chatHistoryRequested.players && this.chatMessages.players.length === 0) {
        this.chatHistoryRequested.players = true;
        this.requestChatHistory('players');
      }

      // Request spectators chat history (spectators only)
      if (this.isSpectator && !this.chatHistoryRequested.spectators && this.chatMessages.spectators.length === 0) {
        this.chatHistoryRequested.spectators = true;
        this.requestChatHistory('spectators');
      }
    }

    this.updateGameUI();
    this.applyDiceState();

    // IMPORTANT: Clear any queued events when receiving room_state.
    // The room_state contains the authoritative game state from the server,
    // including current scores. Any events that arrived before room_state
    // (e.g., for spectators joining mid-game) are already reflected in the
    // room_state's data. Processing them again would cause double-counting.
    if (this.rollEventQueue.length > 0) {
      console.log('[BiggerDice] handleRoomState: clearing event queue (room_state has authoritative state)');
      this.rollEventQueue = [];
      this.roundEndedWithWinner = false;
    }

    // Check if auto-roll is needed (in case an auto-player's turn when we receive state)
    this.checkAutoRollNeeded();
  }

  handlePlayerJoined(message) {
    const player = {
      id: message.player_id,
      name: message.player_name,
      score: 0,
      is_ready: false
    };

    if (!this.players.find(p => p.id === player.id)) {
      this.players.push(player);
    }

    this.updateGameUI();
  }

  handlePlayerLeft(message) {
    const leftPlayerId = String(message.player_id);

    // Check if admin left - show room closed message to remaining players
    if (leftPlayerId === String(this.hostId)) {
      // Admin left - room is closed
      this.showRoomClosedMessage();
      return;
    }

    // Remove from players list
    this.players = this.players.filter(p => String(p.id) !== leftPlayerId);

    // Remove from lobby list
    this.lobby = this.lobby.filter(p => String(p.user_id) !== leftPlayerId);
    this.disconnectedPlayers.delete(leftPlayerId);
    this.autoPlayers.delete(leftPlayerId);
    this.kickVotes.delete(leftPlayerId);
    this.stopDisconnectTickerIfNeeded();

    this.updateGameUI();
  }

  handlePlayerDisconnected(message) {
    const userId = String(message.user_id);
    const timeoutAt = message.timeout_at ? new Date(message.timeout_at) : null;

    if (timeoutAt && !Number.isNaN(timeoutAt.getTime())) {
      this.disconnectedPlayers.set(userId, { timeoutAt });
      this.kickVotes.delete(userId);
      this.startDisconnectTicker();
      this.updateGameUI();
    }
  }

  handlePlayerRejoined(message) {
    const userId = String(message.user_id);
    this.disconnectedPlayers.delete(userId);
    this.kickVotes.delete(userId);
    this.autoPlayers.delete(userId);
    this.stopDisconnectTickerIfNeeded();
    this.updateGameUI();
  }

  handlePlayerAutoEnabled(message) {
    console.log('[BiggerDice] handlePlayerAutoEnabled:', message);
    const userId = String(message.user_id);
    console.log('[BiggerDice] handlePlayerAutoEnabled: adding user to autoPlayers:', userId, 'currentTurn:', this.currentTurn);
    this.autoPlayers.add(userId);
    this.disconnectedPlayers.delete(userId);
    this.kickVotes.delete(userId);
    this.stopDisconnectTickerIfNeeded();
    this.updateGameUI();

    // Check if auto-roll is needed (in case it's already this player's turn)
    this.checkAutoRollNeeded();
  }

  handlePlayerAutoDisabled(message) {
    const userId = String(message.user_id);
    this.autoPlayers.delete(userId);
    this.updateGameUI();
  }

  showRoomClosedMessage() {
    // Hide all game states
    if (this.elements.waitingState) this.elements.waitingState.classList.add('hidden');
    if (this.elements.adminLobby) this.elements.adminLobby.classList.add('hidden');
    if (this.elements.gameBoard) this.elements.gameBoard.classList.add('hidden');
    if (this.elements.notInRoomState) this.elements.notInRoomState.classList.add('hidden');

    // Update waitingForAdmin element to show room closed message
    if (this.elements.waitingForAdmin) {
      const iconEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__icon');
      const titleEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__title');
      const messageEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__message');

      if (iconEl) iconEl.textContent = '🚪';
      if (titleEl) titleEl.textContent = 'Room Closed';
      if (messageEl) messageEl.textContent = 'This room has been closed. The admin has left the game.';

      this.elements.waitingForAdmin.classList.remove('hidden');
    }

    // Disable leave button since room is closed
    if (this.elements.leaveBtn) {
      this.elements.leaveBtn.textContent = 'Return to Lobby';
    }
  }

  // ============================================
  // Lobby Event Handlers (Admin/Player Selection)
  // ============================================

  handleLobbyJoined(message) {
    // A new player joined the lobby
    const player = message.player || {
      user_id: message.user_id,
      username: message.username,
      avatar_id: message.avatar_id,
      score: 0,
      is_ready: false
    };

    // Add to lobby if not already there
    const existingIdx = this.lobby.findIndex(p =>
      String(p.user_id) === String(player.user_id)
    );
    if (existingIdx === -1) {
      this.lobby.push(player);
    }

    this.updateGameUI();
  }

  handlePlayerSelected(message) {
    // A player was selected from lobby to play
    const player = message.player;
    console.log(`[BiggerDice] handlePlayerSelected: player=${player.username}, current players.length=${this.players.length}, maxPlayers=${this.maxPlayers}`);

    // Remove from lobby
    this.lobby = this.lobby.filter(p =>
      String(p.user_id) !== String(player.user_id)
    );

    // Add to players if not already there
    const existingIdx = this.players.findIndex(p =>
      String(p.user_id || p.id) === String(player.user_id)
    );
    if (existingIdx === -1) {
      this.players.push(player);
    }

    console.log(`[BiggerDice] handlePlayerSelected: after push, players.length=${this.players.length}, maxPlayers=${this.maxPlayers}, needsMore=${this.players.length < this.maxPlayers}`);

    // Recalculate isPlayer status - user is a player if in players array OR in lobby
    const userIdStr = String(this.myPlayerId);
    const inPlayers = this.players.some(p => String(p.id || p.user_id) === userIdStr);
    const inLobby = this.lobby.some(p => String(p.user_id) === userIdStr);
    this.isPlayer = inPlayers || inLobby;

    this.updateGameUI();

    // Start ready timer when all players are selected
    if (this.players.length === this.maxPlayers) {
      console.log('[BiggerDice] All players selected, starting ready timer');
      this.startReadyTimer();
    }
  }

  handlePlayerKicked(message) {
    // A player was kicked from the lobby
    const kickedUserId = message.player_id || message.user_id;
    const kickedPlayerName = message.player_name || 'Player';

    // Remove from lobby
    this.lobby = this.lobby.filter(p =>
      String(p.user_id) !== String(kickedUserId)
    );

    // Check if I was kicked
    if (String(kickedUserId) === String(this.myPlayerId)) {
      // Show kicked message before leaving
      this.showKickedMessage();
      return;
    }

    this.updateGameUI();
  }

  showKickedMessage() {
    // Hide all game states
    if (this.elements.waitingState) this.elements.waitingState.classList.add('hidden');
    if (this.elements.adminLobby) this.elements.adminLobby.classList.add('hidden');
    if (this.elements.gameBoard) this.elements.gameBoard.classList.add('hidden');
    if (this.elements.notInRoomState) this.elements.notInRoomState.classList.add('hidden');

    // Show kicked message using waitingForAdmin element
    if (this.elements.waitingForAdmin) {
      const iconEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__icon');
      const titleEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__title');
      const textEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__text');

      if (iconEl) iconEl.textContent = '🚫';
      if (titleEl) titleEl.textContent = 'You have been kicked';
      if (textEl) textEl.textContent = 'The host has kicked you from the lobby.';

      this.elements.waitingForAdmin.classList.remove('hidden');
    }

    // Redirect to lobby after a short delay
    setTimeout(() => {
      this.dispatchEvent(new CustomEvent('game-leave'));
    }, 3000);
  }

  handlePlayerBanned(message) {
    // A player was banned from the room
    const bannedUserId = message.player_id || message.user_id;
    const bannedUsername = message.player_name || message.username || 'Unknown';

    // Remove from lobby and players
    this.lobby = this.lobby.filter(p =>
      String(p.user_id) !== String(bannedUserId)
    );
    this.players = this.players.filter(p =>
      String(p.user_id || p.id) !== String(bannedUserId)
    );

    // Add to banned list (for admin view)
    if (!this.bannedPlayers.some(p => String(p.user_id) === String(bannedUserId))) {
      this.bannedPlayers.push({
        user_id: bannedUserId,
        username: bannedUsername
      });
    }

    // Check if I was banned
    if (String(bannedUserId) === String(this.myPlayerId)) {
      // Show banned message before leaving
      this.showBannedMessage();
      return;
    }

    this.updateGameUI();
  }

  handlePlayerUnbanned(message) {
    // A player was unbanned from the room
    const unbannedUserId = message.player_id || message.user_id;

    // Remove from banned list
    this.bannedPlayers = this.bannedPlayers.filter(p =>
      String(p.user_id) !== String(unbannedUserId)
    );

    this.updateGameUI();
  }

  handleUserBanned(message) {
    // Received when a banned user tries to join/rejoin
    // Show banned message instead of "Enter Room" button
    this.showUserBannedState(message.room_name);
  }

  showUserBannedState(roomName) {
    // Hide all other states
    if (this.elements.waitingState) this.elements.waitingState.classList.add('hidden');
    if (this.elements.adminLobby) this.elements.adminLobby.classList.add('hidden');
    if (this.elements.gameBoard) this.elements.gameBoard.classList.add('hidden');
    if (this.elements.waitingForAdmin) this.elements.waitingForAdmin.classList.add('hidden');

    // Show banned message in notInRoomState
    if (this.elements.notInRoomState) {
      const iconEl = this.elements.notInRoomState.querySelector('.not-in-room__icon');
      const titleEl = this.elements.notInRoomState.querySelector('.not-in-room__title');
      const textEl = this.elements.notInRoomState.querySelector('.not-in-room__text');
      const actionsEl = this.elements.notInRoomState.querySelector('.not-in-room__actions');

      if (iconEl) iconEl.textContent = '⛔';
      if (titleEl) titleEl.textContent = 'You are banned from this room';
      if (textEl) textEl.textContent = 'The host has banned you from this room. You cannot join it.';
      if (actionsEl) actionsEl.classList.add('hidden');

      this.elements.notInRoomState.classList.remove('hidden');
    }
  }

  showBannedMessage() {
    // Hide all game states
    if (this.elements.waitingState) this.elements.waitingState.classList.add('hidden');
    if (this.elements.adminLobby) this.elements.adminLobby.classList.add('hidden');
    if (this.elements.gameBoard) this.elements.gameBoard.classList.add('hidden');
    if (this.elements.notInRoomState) this.elements.notInRoomState.classList.add('hidden');

    // Show banned message using waitingForAdmin element
    if (this.elements.waitingForAdmin) {
      const iconEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__icon');
      const titleEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__title');
      const textEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__text');

      if (iconEl) iconEl.textContent = '⛔';
      if (titleEl) titleEl.textContent = 'You have been banned';
      if (textEl) textEl.textContent = 'The host has banned you from this room. You cannot rejoin.';

      this.elements.waitingForAdmin.classList.remove('hidden');
    }

    // Redirect to lobby after a short delay
    setTimeout(() => {
      this.dispatchEvent(new CustomEvent('game-leave'));
    }, 3000);
  }

  handleLobbyUpdated(message) {
    // Full lobby sync
    this.lobby = message.lobby || [];
    this.updateGameUI();
  }

  handleGameStarted(message) {
    console.log('[BiggerDice] Game started:', message);

    // Stop ready timer when game starts
    this.stopReadyTimer();

    this.gameStatus = GameStatus.PLAYING;
    this.players = message.players;
    this.currentTurn = message.first_turn;
    this.round = 1;
    this.roundHistory = []; // Reset round history for new game
    this.lastDiceState = null; // Clear dice state for new game - dice start at 0
    this.disconnectedPlayers.clear();
    this.kickVotes.clear();
    this.autoPlayers.clear();
    this.pendingAutoRoll = null;
    // Clear any pending auto-roll timeout (parallel games fix)
    if (this.autoRollTimeoutId) {
      clearTimeout(this.autoRollTimeoutId);
      this.autoRollTimeoutId = null;
    }
    this.roundEndedWithWinner = false;
    this.stopDisconnectTickerIfNeeded();

    // Reset player scores and ready states for new game/rematch
    this.players.forEach(p => {
      p.score = 0;
      p.is_ready = false;
    });

    // Update chat tabs - lobby chat disabled during game, switch to players/spectators chat
    this.updateChatTabAccess();

    this.updateGameUI();
  }

  handleGameStarting(message) {
    console.log('[BiggerDice] Game starting (ready phase):', message);
    console.log('[BiggerDice] handleGameStarting: message.players=', message.players);
    console.log('[BiggerDice] handleGameStarting: maxPlayers=', this.maxPlayers);

    // Game has transitioned to ready phase - selected players need to click ready
    // Update players list with the selected players
    this.players = message.players || [];
    this.lobby = message.players || []; // Selected players are now in ready phase
    this.gameStatus = GameStatus.WAITING; // Still waiting for ready clicks
    this.disconnectedPlayers.clear();
    this.kickVotes.clear();
    this.autoPlayers.clear();
    this.pendingAutoRoll = null;
    // Clear any pending auto-roll timeout (parallel games fix)
    if (this.autoRollTimeoutId) {
      clearTimeout(this.autoRollTimeoutId);
      this.autoRollTimeoutId = null;
    }
    this.roundEndedWithWinner = false;
    this.stopDisconnectTickerIfNeeded();

    console.log('[BiggerDice] handleGameStarting: After update - players.length=', this.players.length, 'needsMorePlayers=', this.players.length < this.maxPlayers);

    // Update chat tabs - lobby chat disabled during ready phase
    this.updateChatTabAccess();

    this.updateGameUI();
  }

  handleRemovedFromGame(message) {
    console.log('[BiggerDice] Removed from game:', message);

    // Clear game state
    this.players = [];
    this.lobby = [];
    this.spectators = [];

    // Show removed message
    this.showRemovedFromGameMessage(message.message || 'You were not selected to play.');
  }

  showRemovedFromGameMessage(messageText) {
    // Hide all game states
    if (this.elements.waitingState) this.elements.waitingState.classList.add('hidden');
    if (this.elements.adminLobby) this.elements.adminLobby.classList.add('hidden');
    if (this.elements.gameBoard) this.elements.gameBoard.classList.add('hidden');
    if (this.elements.notInRoomState) this.elements.notInRoomState.classList.add('hidden');
    if (this.elements.waitingForAdmin) this.elements.waitingForAdmin.classList.add('hidden');

    // Show removed message using waitingForAdmin element
    if (this.elements.waitingForAdmin) {
      const iconEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__icon');
      const titleEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__title');
      const textEl = this.elements.waitingForAdmin.querySelector('.waiting-for-admin__message');

      if (iconEl) iconEl.textContent = '👋';
      if (titleEl) titleEl.textContent = 'Not Selected for This Game';
      if (textEl) textEl.textContent = messageText;

      this.elements.waitingForAdmin.classList.remove('hidden');
    }

    // Redirect to lobby after a delay
    setTimeout(() => {
      this.dispatchEvent(new CustomEvent('game-leave'));
    }, 5000);
  }

  /**
   * Handle a dice rolled event from the server.
   * Queues roll events and processes them sequentially to ensure animations
   * play one at a time (fixing the issue where multiple rolls animate simultaneously).
   * @param {Object} message - The dice rolled message
   */
  handleDiceRolled(message) {
    const playerId = String(message.player_id);
    const roll = message.roll;

    console.log('[BiggerDice] handleDiceRolled:', {
      playerId,
      roll,
      isAnimating: this.isAnimating,
      queueLength: this.rollEventQueue.length,
      playersCount: this.players.length,
      diceElementsCount: this.diceElements.length
    });

    // Always persist the roll in lastDiceState so it survives UI re-renders
    this.updateLastDiceState(playerId, roll);

    // Create the roll event object
    const rollEvent = { playerId, roll, message };

    // If we don't have players or dice elements yet (spectator joined mid-game
    // and room_state hasn't been processed), queue the event to process later
    if (this.players.length === 0 || this.diceElements.length === 0) {
      console.log('[BiggerDice] handleDiceRolled: no players/dice elements yet, queuing event');
      this.rollEventQueue.push(rollEvent);
      return;
    }

    // If animation is in progress or queue has events, queue this event for later
    if (this.isAnimating || this.rollEventQueue.length > 0) {
      console.log('[BiggerDice] handleDiceRolled: animation/queue in progress, queuing event for player', playerId);
      this.rollEventQueue.push(rollEvent);
      return;
    }

    // No animation in progress and have dice elements, process this event immediately
    this.processRollEvent(rollEvent);
  }

  /**
   * Process a single roll event by animating the dice.
   * After animation completes, processes the next queued event or checks for auto-roll.
   * @param {Object} rollEvent - The roll event { playerId, roll, message }
   */
  processRollEvent(rollEvent) {
    const { playerId, roll } = rollEvent;

    console.log('[BiggerDice] processRollEvent:', {
      playerId,
      roll,
      queueLength: this.rollEventQueue.length
    });

    const playerIndex = this.players.findIndex(p =>
      String(p.id || p.user_id) === playerId
    );

    // Use dynamic dice elements array (supports N players)
    const diceEl = playerIndex >= 0 && playerIndex < this.diceElements.length
      ? this.diceElements[playerIndex]
      : null;

    if (diceEl) {
      // Store the animation promise so checkAutoRollNeeded can wait for it
      this.animationPromise = this.animateDiceRoll(diceEl, roll);

      // After animation completes, process next queued event or check auto-roll
      this.animationPromise.then(() => {
        console.log('[BiggerDice] processRollEvent: animation complete for player', playerId);
        this.processNextRollEvent();
      });
    } else {
      console.warn(`[BiggerDice] processRollEvent: No dice element for playerIndex=${playerIndex}`);
      // No dice element to animate, move to next event
      this.processNextRollEvent();
    }
  }

  /**
   * Process the next event in the queue (dice roll or round result).
   * If queue is empty, checks if auto-roll is needed for frontend fallback.
   * When a round just ended with a winner, adds a 1-second delay before processing
   * the next round's events to allow players to see the round result.
   */
  processNextRollEvent() {
    console.log('[BiggerDice] processNextRollEvent:', {
      queueLength: this.rollEventQueue.length,
      isAnimating: this.isAnimating,
      roundEndedWithWinner: this.roundEndedWithWinner
    });

    // If a round just ended with a winner, add a delay before continuing
    // This allows players to see the round result (winner highlighted, scores updated)
    // before the next round's dice start rolling
    if (this.roundEndedWithWinner) {
      this.roundEndedWithWinner = false;
      console.log('[BiggerDice] processNextRollEvent: round ended with winner, delaying 1 second before next round');

      // Refresh dice display to show final values
      this.applyDiceState();

      setTimeout(() => {
        // Re-check that we're still in a valid game state after the delay
        if (this.gameStatus !== GameStatus.PLAYING) {
          console.log('[BiggerDice] processNextRollEvent: game state changed during delay, aborting');
          return;
        }
        console.log('[BiggerDice] processNextRollEvent: delay complete, continuing');
        // Continue processing after delay
        this.processNextRollEventContinue();
      }, 1000);
      return;
    }

    // No delay needed, continue immediately
    this.processNextRollEventContinue();
  }

  /**
   * Continue processing the next event in the queue after any required delays.
   */
  processNextRollEventContinue() {
    // Check if there are queued events - process them
    if (this.rollEventQueue.length > 0) {
      const nextEvent = this.rollEventQueue.shift();

      // Handle different event types
      if (nextEvent.type === 'round_result') {
        console.log('[BiggerDice] processNextRollEventContinue: processing queued round result');
        this.processRoundResult(nextEvent.message);
        // After processing round result, continue to next event (with potential delay if winner)
        this.processNextRollEvent();
        return;
      }

      if (nextEvent.type === 'game_over') {
        console.log('[BiggerDice] processNextRollEventContinue: processing queued game_over');
        this.processGameOver(nextEvent.message);
        // Game is over, no need to continue processing
        return;
      }

      // It's a dice roll event
      console.log('[BiggerDice] processNextRollEventContinue: processing queued dice event for player', nextEvent.playerId);
      this.processRollEvent(nextEvent);
      return;
    }

    // No more queued events - all animations from this round are complete.
    // Trigger a dice area refresh since renderDiceArea() may have been skipped
    // during animation (to protect ongoing animations from being destroyed).
    console.log('[BiggerDice] processNextRollEventContinue: queue empty, refreshing dice area');
    this.applyDiceState();

    // Check if auto-roll is needed (frontend fallback)
    console.log('[BiggerDice] processNextRollEventContinue: checking for auto-roll');
    this.checkAutoRollNeeded();
  }

  /**
   * Update lastDiceState with a player's roll value.
   * This ensures dice values persist across UI re-renders.
   * @param {string} playerId - The player ID
   * @param {number} roll - The dice roll value (1-6)
   */
  updateLastDiceState(playerId, roll) {
    const playerIdStr = String(playerId);

    // Initialize lastDiceState if needed (N-player format)
    if (!this.lastDiceState) {
      this.lastDiceState = { players: [] };
    }

    // Ensure we're using the N-player format
    if (!this.lastDiceState.players) {
      // Convert legacy format to N-player format if needed
      const players = [];
      if (this.lastDiceState.player1_id && this.lastDiceState.player1_roll !== null) {
        players.push({ player_id: this.lastDiceState.player1_id, roll: this.lastDiceState.player1_roll });
      }
      if (this.lastDiceState.player2_id && this.lastDiceState.player2_roll !== null) {
        players.push({ player_id: this.lastDiceState.player2_id, roll: this.lastDiceState.player2_roll });
      }
      this.lastDiceState = { players };
    }

    // Find existing entry for this player or add new one
    const existingIndex = this.lastDiceState.players.findIndex(p => p.player_id === playerIdStr);
    if (existingIndex >= 0) {
      this.lastDiceState.players[existingIndex].roll = roll;
    } else {
      this.lastDiceState.players.push({ player_id: playerIdStr, roll: roll });
    }
  }

  handleBiggerDiceState(message) {
    console.log('[BiggerDice] Received dice state:', message);

    // Load round history from server if provided (for rejoining players)
    // This ensures rejoining players see complete game history in game over screen
    if (message.round_history && Array.isArray(message.round_history) && message.round_history.length > 0) {
      console.log(`[BiggerDice] Loading ${message.round_history.length} rounds from server history`);
      this.roundHistory = message.round_history;
    }

    // Support both legacy 2-player format and new N-player format
    if (message.current_rolls && Array.isArray(message.current_rolls)) {
      // New N-player format
      this.lastDiceState = {
        players: message.current_rolls.map(([playerId, roll]) => ({
          player_id: String(playerId),
          roll: roll
        }))
      };

      // Update round number if provided
      if (message.round_number) {
        this.round = message.round_number;
      }

      // Show tiebreaker indicator if in tiebreaker mode
      if (message.is_tiebreaker) {
        const pendingRollers = (message.pending_rollers || []).map(id => String(id));
        this.showTiebreakerMessage(pendingRollers);
      }
    } else {
      // Legacy 2-player format
      this.lastDiceState = {
        player1_id: message.player1_id ? String(message.player1_id) : null,
        player2_id: message.player2_id ? String(message.player2_id) : null,
        player1_roll: Number.isInteger(message.player1_roll) ? message.player1_roll : null,
        player2_roll: Number.isInteger(message.player2_roll) ? message.player2_roll : null
      };
    }

    this.applyDiceState();
  }

  applyDiceState() {
    if (!this.lastDiceState || this.players.length === 0) return;

    // Support N players - lastDiceState may have player1_id/player2_id (legacy)
    // or players array (new format for N players)
    if (this.lastDiceState.players && Array.isArray(this.lastDiceState.players)) {
      // New N-player format
      this.lastDiceState.players.forEach(({ player_id, roll }) => {
        if (!player_id) return;
        const index = this.players.findIndex(p => String(p.id || p.user_id) === String(player_id));
        const diceEl = index >= 0 && index < this.diceElements.length ? this.diceElements[index] : null;
        this.setDiceValue(diceEl, roll);
      });
    } else {
      // Legacy 2-player format
      const { player1_id, player2_id, player1_roll, player2_roll } = this.lastDiceState;
      const pairs = [
        { playerId: player1_id, roll: player1_roll },
        { playerId: player2_id, roll: player2_roll }
      ];

      pairs.forEach(({ playerId, roll }) => {
        if (!playerId) return;
        const index = this.players.findIndex(p => String(p.id || p.user_id) === playerId);
        const diceEl = index >= 0 && index < this.diceElements.length ? this.diceElements[index] : null;
        this.setDiceValue(diceEl, roll);
      });
    }
  }

  setDiceValue(diceEl, roll) {
    if (!diceEl) return;
    const value = Number.isInteger(roll) ? roll : 0;
    diceEl.dataset.value = String(value);
  }

  handlePlayerReady(message) {
    console.log('[BiggerDice] Player ready:', message);
    const userId = String(message.user_id);
    const username = message.username;

    // Update lobby player's ready state (for players waiting in lobby)
    const lobbyPlayer = this.lobby.find(p => String(p.user_id) === userId);
    if (lobbyPlayer) {
      lobbyPlayer.is_ready = true;
      console.log(`[BiggerDice] Lobby player ${username} is now ready`);
    }

    // Also update player's ready state (for selected players in game)
    const gamePlayer = this.players.find(p => String(p.user_id || p.id) === userId);
    if (gamePlayer) {
      gamePlayer.is_ready = true;
      console.log(`[BiggerDice] Game player ${username} is now ready`);
    }

    // Update UI to show player is ready
    this.updateGameUI();
  }

  handleRoundResult(message) {
    console.log('[BiggerDice] Round result:', message);
    console.log('[DEBUG] handleRoundResult ENTRY:', {
      isAnimating: this.isAnimating,
      queueLength: this.rollEventQueue.length,
      playersCount: this.players.length,
      diceElementsCount: this.diceElements.length
    });

    // If we don't have players or dice elements yet (spectator joined mid-game),
    // or animation is in progress, or queue has events - queue this round result
    if (this.players.length === 0 || this.diceElements.length === 0 ||
        this.isAnimating || this.rollEventQueue.length > 0) {
      console.log('[BiggerDice] handleRoundResult: queuing round result (waiting for dice/animation)');
      this.rollEventQueue.push({ type: 'round_result', message });
      return;
    }

    // Process the round result immediately
    this.processRoundResult(message);
  }

  /**
   * Process a round result event.
   * This can be called directly or from the queue after dice animations complete.
   * Uses server-provided authoritative scores to ensure all clients (players and spectators)
   * see synchronized scores regardless of animation timing.
   * @param {Object} message - The round result message
   */
  processRoundResult(message) {
    console.log('[BiggerDice] processRoundResult:', message);
    console.log('[DEBUG] processRoundResult ENTRY - scores before:', this.players.map(p => ({id: p.user_id || p.id, score: p.score})));

    // Support both legacy 2-player format and new N-player format
    const rolls = message.rolls || [];
    const winnerId = message.winner_id ? String(message.winner_id) : null;
    const isTiebreaker = message.is_tiebreaker || false;
    const tiebreakerPlayers = (message.tiebreaker_players || []).map(id => String(id));
    const hasTie = tiebreakerPlayers.length > 0;
    // Server-provided authoritative scores - ensures spectators and players are in sync
    const serverScores = message.scores || [];

    // Update dice display with all rolls and persist to lastDiceState
    rolls.forEach(([playerId, roll]) => {
      const playerIdStr = String(playerId);
      const playerIndex = this.players.findIndex(p =>
        String(p.id || p.user_id) === playerIdStr
      );

      // Persist roll in lastDiceState so it survives UI re-renders
      this.updateLastDiceState(playerIdStr, roll);

      if (playerIndex >= 0 && playerIndex < this.diceElements.length) {
        this.setDiceValue(this.diceElements[playerIndex], roll);
      }
    });

    // Apply authoritative scores from server (ensures spectator/player sync)
    if (serverScores.length > 0) {
      serverScores.forEach(([playerId, score]) => {
        const playerIdStr = String(playerId);
        const player = this.players.find(p => String(p.id || p.user_id) === playerIdStr);
        if (player) {
          const oldScore = player.score || 0;
          player.score = score;
          if (oldScore !== score) {
            console.log(`[BiggerDice] Score sync: ${player.username || player.name} ${oldScore} -> ${score}`);
          }
        }
      });
    }

    // Store round in history (only if there's a winner - ties go to tiebreaker)
    if (winnerId && !hasTie) {
      const winner = this.players.find(p => String(p.id || p.user_id) === winnerId);
      const winnerDisplayName = winner?.username || winner?.name || 'Unknown';

      const rollsData = rolls.map(([playerId, roll]) => {
        const player = this.players.find(p => String(p.id || p.user_id) === String(playerId));
        return {
          id: String(playerId),
          name: player?.name || player?.username || `Player`,
          roll: roll
        };
      });

      this.roundHistory.push({
        round: this.roundHistory.length + 1,
        rolls: rollsData,
        winnerId: winnerId,
        winnerName: winnerDisplayName,
        isTiebreaker: isTiebreaker
      });

      console.log(`[BiggerDice] ${winnerDisplayName} wins the round with score ${winner?.score || 0}`);
    }

    // Log the result
    if (hasTie) {
      const tiedNames = tiebreakerPlayers.map(id => {
        const p = this.players.find(p => String(p.id || p.user_id) === id);
        return p?.username || p?.name || id;
      }).join(', ');
      console.log(`[BiggerDice] Tie! ${tiedNames} go to tiebreaker!`);
      this.showTiebreakerMessage(tiebreakerPlayers);
    } else if (winnerId) {
      // Set flag to delay next round - allows players to see the round result
      this.roundEndedWithWinner = true;
    }

    // Update scores immediately - this ensures scores are visible even during rapid auto-play
    console.log('[DEBUG] processRoundResult - about to call updateGameUI, scores:', this.players.map(p => ({id: p.user_id || p.id, score: p.score})));

    // Update the game UI to reflect new state (renderPlayersArea uses this.players which now has updated scores)
    this.updateGameUI();

    // CRITICAL: Force synchronous layout/paint to ensure score is visible before next round
    // Without this, rapid auto-play can cause browser to batch DOM updates, making scores
    // appear to lag behind by several rounds.
    this.forceImmediateRender();

    console.log('[DEBUG] handleRoundResult EXIT - final scores:', this.players.map(p => ({id: p.user_id || p.id, score: p.score})));
  }

  /**
   * Force the browser to immediately render any pending DOM changes.
   * This is critical for rapid auto-play where multiple rounds happen quickly.
   * Without this, browsers may batch DOM updates and scores appear to lag.
   */
  forceImmediateRender() {
    const container = this.elements.playersArea;
    if (!container) return;

    // Reading offsetHeight forces the browser to perform synchronous layout calculation,
    // which ensures any pending DOM changes are flushed.
    void container.offsetHeight;

    // Additionally, find and highlight the score elements that changed
    // This provides visual feedback and forces the browser to repaint
    const scoreElements = container.querySelectorAll('.player-score');
    const MAX_ELEMENTS = 10; // Safety bound
    const count = Math.min(scoreElements.length, MAX_ELEMENTS);
    for (let i = 0; i < count; i++) {
      // Force style recalculation by reading computed style
      void window.getComputedStyle(scoreElements[i]).opacity;
    }
  }

  showTiebreakerMessage(tiebreakerPlayerIds) {
    // Show a brief message about tiebreaker
    const tiedNames = tiebreakerPlayerIds.map(id => {
      const p = this.players.find(p => String(p.id || p.user_id) === id);
      return p?.username || p?.name || 'Player';
    }).join(' vs ');

    // Update turn indicator to show tiebreaker
    const indicator = this.elements.turnIndicator;
    if (indicator) {
      indicator.textContent = `Tiebreaker: ${tiedNames}`;
      indicator.style.borderColor = 'var(--warning-color)';
    }
  }

  handleTiebreakerStarted(message) {
    console.log('[BiggerDice] Tiebreaker started:', message);

    const tiebreakerPlayers = (message.tiebreaker_players || []).map(id => String(id));
    const firstRoller = message.first_roller ? String(message.first_roller) : null;

    // Update current turn to the first tiebreaker roller
    if (firstRoller) {
      this.currentTurn = firstRoller;
    }

    // Show tiebreaker message
    this.showTiebreakerMessage(tiebreakerPlayers);

    // Keep dice values visible - they only reset when player rolls again
    // (handleDiceRolled will update the dice when player actually rolls)

    this.updateGameUI();

    // Check if auto-roll is needed (first roller might be an auto-player)
    this.checkAutoRollNeeded();
  }

  handleTurnChanged(message) {
    console.log('[BiggerDice] Turn changed:', message);
    console.log('[DEBUG] handleTurnChanged - current player scores:', this.players.map(p => ({id: p.user_id || p.id, score: p.score})));
    this.currentTurn = String(message.current_turn);
    this.round = message.turn_number || this.round;

    // Update UI to show whose turn it is
    this.updateTurnIndicator();
    this.updateButtons();

    // Start turn timer for manual players
    this.startTurnTimer();

    // Check if we need to trigger auto-roll for kicked players
    this.checkAutoRollNeeded();
  }

  /**
   * Check if the current turn player is an auto-player (kicked) and trigger auto-roll.
   * This is a frontend fallback mechanism to ensure kicked players' turns are handled
   * even if the backend auto-roll fails (e.g., due to cache miss).
   *
   * The backend normally handles auto-rolling, but this provides resilience for
   * games with 3+ players where a kicked player's turn may not be auto-rolled
   * if the backend's auto_players state is lost.
   *
   * IMPORTANT: This function waits for any ongoing dice animation to complete
   * before triggering the auto-roll, ensuring proper visual sequencing.
   */
  checkAutoRollNeeded() {
    console.log('[BiggerDice] checkAutoRollNeeded called:', {
      gameStatus: this.gameStatus,
      currentTurn: this.currentTurn,
      autoPlayers: [...this.autoPlayers],
      myPlayerId: this.myPlayerId,
      playersCount: this.players.length,
      isAnimating: this.isAnimating,
      queueLength: this.rollEventQueue.length
    });

    // Only check during active gameplay
    if (this.gameStatus !== GameStatus.PLAYING) {
      console.log('[BiggerDice] checkAutoRollNeeded: exiting - gameStatus not PLAYING:', this.gameStatus);
      return;
    }

    // Don't auto-roll if no current turn set
    if (!this.currentTurn) {
      console.log('[BiggerDice] checkAutoRollNeeded: exiting - no currentTurn');
      return;
    }

    const currentTurnStr = String(this.currentTurn);

    // Check if current turn player is in the auto-players set (kicked players)
    if (!this.autoPlayers.has(currentTurnStr)) {
      console.log('[BiggerDice] checkAutoRollNeeded: exiting - currentTurn not in autoPlayers:', currentTurnStr);
      return;
    }

    // Don't auto-roll for ourselves (shouldn't happen, but safety check)
    if (currentTurnStr === String(this.myPlayerId)) {
      console.log('[BiggerDice] checkAutoRollNeeded: exiting - currentTurn is myself');
      return;
    }

    // Note: We removed the check for auto-player being in this.players because:
    // 1. After handleGameStarted, players have .id property
    // 2. After handleRoomState, players have .user_id property
    // 3. This inconsistency caused the check to fail
    // 4. The autoPlayers set is the authoritative source for who needs auto-rolling
    // 5. The backend validates the auto-roll request anyway

    // Prevent duplicate auto-roll scheduling for the same player
    if (this.pendingAutoRoll === currentTurnStr) {
      console.log('[BiggerDice] checkAutoRollNeeded: exiting - auto-roll already pending for:', currentTurnStr);
      return;
    }

    // If animation is in progress or queue has events, wait for them to complete
    // This ensures proper visual sequencing: all animations complete -> auto-roll
    if (this.isAnimating || this.rollEventQueue.length > 0) {
      console.log('[BiggerDice] checkAutoRollNeeded: animation/queue in progress, deferring auto-roll');
      // The processNextRollEvent will call checkAutoRollNeeded when queue is empty
      return;
    }

    console.log('[BiggerDice] checkAutoRollNeeded: will auto-roll for kicked player:', currentTurnStr);
    this.pendingAutoRoll = currentTurnStr;

    // Clear any existing timeout to prevent multiple timers (parallel games fix)
    if (this.autoRollTimeoutId) {
      clearTimeout(this.autoRollTimeoutId);
      this.autoRollTimeoutId = null;
    }

    // Capture room ID for validation in callback (parallel games isolation)
    const capturedRoomId = this.roomId;

    // Use a small delay to avoid race conditions with backend auto-roll
    // The backend should handle this, but this is a fallback
    // Delay is 200ms since we already waited for animation to complete
    this.autoRollTimeoutId = setTimeout(() => {
      // Clear the timeout ID
      this.autoRollTimeoutId = null;

      // Clear the pending flag
      this.pendingAutoRoll = null;

      console.log('[BiggerDice] checkAutoRollNeeded setTimeout callback:', {
        gameStatus: this.gameStatus,
        currentTurn: this.currentTurn,
        expectedTurn: currentTurnStr,
        autoPlayers: [...this.autoPlayers],
        isAnimating: this.isAnimating,
        roomId: this.roomId,
        capturedRoomId: capturedRoomId
      });

      // Validate room ID hasn't changed (parallel games isolation)
      if (this.roomId !== capturedRoomId) {
        console.log('[BiggerDice] checkAutoRollNeeded setTimeout: exiting - roomId changed (parallel game switched)');
        return;
      }

      // Re-check conditions after delay (state may have changed)
      if (this.gameStatus !== GameStatus.PLAYING) {
        console.log('[BiggerDice] checkAutoRollNeeded setTimeout: exiting - gameStatus changed');
        return;
      }
      if (String(this.currentTurn) !== currentTurnStr) {
        // Turn already changed (backend handled it)
        console.log('[BiggerDice] checkAutoRollNeeded setTimeout: exiting - turn already changed (backend handled it)');
        return;
      }
      if (!this.autoPlayers.has(currentTurnStr)) {
        // Player is no longer auto
        console.log('[BiggerDice] checkAutoRollNeeded setTimeout: exiting - player no longer auto');
        return;
      }

      // Final check - if animation/queue is active during the delay, wait for them
      if (this.isAnimating || this.rollEventQueue.length > 0) {
        console.log('[BiggerDice] checkAutoRollNeeded setTimeout: animation/queue active during delay, re-queuing');
        // Re-queue the check - it will be called again when queue empties
        this.pendingAutoRoll = null; // Clear so we can re-schedule
        return;
      }

      // Send auto-roll command for the kicked player
      console.log('[BiggerDice] checkAutoRollNeeded setTimeout: sending auto-roll for:', currentTurnStr);
      this.sendAutoRoll(currentTurnStr);
    }, 200);
  }

  /**
   * Send an auto-roll command for a kicked player.
   * This triggers the backend to roll for the specified player.
   */
  sendAutoRoll(playerId) {
    console.log('[BiggerDice] Sending auto-roll for player:', playerId);
    this.send({
      type: 'games.command.bigger_dice.auto_roll',
      room_id: this.roomId,
      target_user_id: playerId
    });
  }

  handleRoundComplete(message) {
    if (message.scores) {
      const p1 = this.players.find(p => p.id === message.scores.player1_id);
      const p2 = this.players.find(p => p.id === message.scores.player2_id);
      if (p1) p1.score = message.scores.player1_score;
      if (p2) p2.score = message.scores.player2_score;
    }

    this.round = message.round;
    this.currentTurn = message.next_turn;

    this.showRoundResult(message);
    this.updateGameUI();

    // Check if auto-roll is needed (next turn might be an auto-player)
    this.checkAutoRollNeeded();
  }

  handleGameOver(message) {
    console.log('[BiggerDice] handleGameOver:', message);
    console.log('[DEBUG] handleGameOver ENTRY:', {
      isAnimating: this.isAnimating,
      queueLength: this.rollEventQueue.length,
      playersCount: this.players.length,
      diceElementsCount: this.diceElements.length
    });

    // If we don't have players/dice elements yet, or animation is in progress,
    // or queue has events - queue the game_over event
    if (this.players.length === 0 || this.diceElements.length === 0 ||
        this.isAnimating || this.rollEventQueue.length > 0) {
      console.log('[BiggerDice] handleGameOver: queuing game_over (waiting for dice/animation)');
      this.rollEventQueue.push({ type: 'game_over', message });
      return;
    }

    // Process the game over immediately
    this.processGameOver(message);
  }

  /**
   * Process a game over event.
   * This can be called directly or from the queue after all animations complete.
   * @param {Object} message - The game over message
   */
  processGameOver(message) {
    console.log('[BiggerDice] processGameOver:', message);
    this.gameStatus = GameStatus.FINISHED;

    // Clear any pending auto-roll timeout (parallel games fix)
    if (this.autoRollTimeoutId) {
      clearTimeout(this.autoRollTimeoutId);
      this.autoRollTimeoutId = null;
    }
    this.pendingAutoRoll = null;

    // Support new format with final_scores (array of [user_id, username, score])
    if (message.final_scores && Array.isArray(message.final_scores)) {
      message.final_scores.forEach(([userId, username, score]) => {
        const player = this.players.find(p =>
          String(p.id || p.user_id) === String(userId)
        );
        if (player) {
          player.score = score;
        }
      });
    }
    // Support legacy format with scores object
    else if (message.scores) {
      const p1 = this.players.find(p => p.id === message.scores.player1_id);
      const p2 = this.players.find(p => p.id === message.scores.player2_id);
      if (p1) p1.score = message.scores.player1_score;
      if (p2) p2.score = message.scores.player2_score;
    }

    // Hide chat panel and game footer when game ends
    this.elements.chatPanel?.classList.add('hidden');
    this.elements.gameFooter?.classList.add('hidden');

    // Stop turn timer if running
    this.stopTurnTimer();

    this.showGameOverResult(message);
    this.updateGameUI();
  }

  handleGameError(message) {
    // Check if this is a wrong_password error while password modal is open
    if (message.code === 'wrong_password' && this.pendingJoinRoomId) {
      // Show error in the password modal, allow retry
      this.elements.joinPasswordError.textContent = message.message || 'Incorrect password';
      this.elements.joinPasswordError.classList.remove('hidden');
      this.elements.joinPasswordInput.value = '';
      this.elements.joinPasswordInput.focus();
      return;
    }

    // Handle user_banned error - show toast message, stay on current view
    if (message.code === 'user_banned') {
      // Close password modal if open
      if (this.pendingJoinRoomId) {
        this.hideJoinPasswordModal();
      }
      // Show toast message - user stays on notInRoomState and can try again after unbanned
      this.dispatchEvent(new CustomEvent('game-error', {
        detail: {
          code: 'user_banned',
          message: 'You are banned from this room. Please contact the admin to unban you.'
        }
      }));
      return;
    }

    // For other errors, dispatch the error event
    this.dispatchEvent(new CustomEvent('game-error', {
      detail: { code: message.code, message: message.message || 'An error occurred' }
    }));
  }

  handleNotInRoom(message) {
    console.log('[BiggerDice] Not in room:', message);
    // Store the room info for the "Enter Room" button
    this.notInRoomInfo = {
      room_id: message.room_id,
      room_name: message.room_name,
      is_password_protected: message.is_password_protected,
      status: message.status,
      allow_spectators: message.allow_spectators === true
    };
    // Update the UI to show the not-in-room state
    this.showNotInRoomUI();
  }

  showNotInRoomUI() {
    if (!this.notInRoomInfo) return;

    // Hide all other views
    this.elements.waitingForAdmin.classList.add('hidden');
    this.elements.adminLobby.classList.add('hidden');
    this.elements.waitingState.classList.add('hidden');
    this.elements.gameBoard.classList.add('hidden');

    // Hide chat panel until user confirms joining
    if (this.elements.chatPanel) {
      this.elements.chatPanel.classList.add('hidden');
    }

    // Show not-in-room state
    this.elements.notInRoomState.classList.remove('hidden');

    // Show/hide spectator option based on allow_spectators setting
    if (this.notInRoomInfo.allow_spectators && this.elements.spectatorOptionContainer) {
      this.elements.spectatorOptionContainer.classList.remove('hidden');
      // Reset checkbox to match current wantsToSpectate state
      if (this.elements.joinAsSpectatorCheckbox) {
        this.elements.joinAsSpectatorCheckbox.checked = this.wantsToSpectate || false;
      }
    } else if (this.elements.spectatorOptionContainer) {
      this.elements.spectatorOptionContainer.classList.add('hidden');
      // If spectators not allowed, ensure wantsToSpectate is false
      this.wantsToSpectate = false;
    }

    // Update button text and hint based on spectate mode and password protection
    this.updateEnterRoomButton();

    // Update room name in title
    this.elements.headerTitle.textContent = this.notInRoomInfo.room_name || 'Bigger Dice';
    this.elements.gameStatus.textContent = this.formatStatus(this.notInRoomInfo.status);
  }

  updateEnterRoomButton() {
    if (!this.notInRoomInfo) return;

    if (this.wantsToSpectate) {
      if (this.notInRoomInfo.is_password_protected) {
        this.elements.enterRoomBtnText.textContent = 'Watch as Spectator (Password Required)';
        this.elements.notInRoomHint.textContent = 'This room is password protected. You will join as a spectator.';
      } else {
        this.elements.enterRoomBtnText.textContent = 'Watch as Spectator';
        this.elements.notInRoomHint.textContent = 'You will join as a spectator and watch the game.';
      }
    } else if (this.notInRoomInfo.is_password_protected) {
      this.elements.enterRoomBtnText.textContent = 'Enter Room (Password Required)';
      this.elements.notInRoomHint.textContent = 'This room is password protected.';
    } else {
      this.elements.enterRoomBtnText.textContent = 'Enter Room';
      this.elements.notInRoomHint.textContent = '';
    }
  }

  handleEnterRoomClick() {
    if (!this.notInRoomInfo) return;

    // Spectators don't need balance check - they can watch for free
    if (this.wantsToSpectate) {
      // But they still need password if room is protected
      if (this.notInRoomInfo.is_password_protected) {
        this.showJoinPasswordModal(
          this.notInRoomInfo.room_id,
          this.notInRoomInfo.room_name,
          true // asSpectator = true
        );
      } else {
        this.send({
          type: 'games.command.join_as_spectator',
          room_name: this.notInRoomInfo.room_name
        });
      }
      return;
    }

    // Players need balance check before joining
    this.showJoinConfirmModal(
      this.notInRoomInfo.room_id,
      this.notInRoomInfo.room_name,
      this.notInRoomInfo.is_password_protected
    );
  }

  // Called after user confirms they want to join (has enough balance)
  executeJoinRoom() {
    if (!this.notInRoomInfo) return;

    if (this.notInRoomInfo.is_password_protected) {
      // Password protected rooms require password
      this.showJoinPasswordModal(this.notInRoomInfo.room_id, this.notInRoomInfo.room_name);
    } else {
      // Send join command directly via WebSocket
      this.send({
        type: 'games.command.join_room',
        room_name: this.notInRoomInfo.room_name
      });
    }
  }

  // ============================================
  // Game Actions
  // ============================================

  sendReady() {
    // Stop ready timer when player manually clicks ready
    this.stopReadyTimer();

    this.send({
      type: 'games.command.ready',
      room_id: this.roomId
    });
    this.elements.readyBtn.disabled = true;
  }

  sendRoll() {
    // Stop the turn timer when player rolls
    this.stopTurnTimer();

    this.send({
      type: 'games.command.bigger_dice.roll',
      room_id: this.roomId
    });
    this.elements.rollBtn.disabled = true;
  }

  // ============================================
  // Turn Timer Methods (5 second auto-roll)
  // ============================================

  /**
   * Start the turn timer when it's the player's turn.
   * Only starts if player is not on auto-play.
   */
  startTurnTimer() {
    // Don't start timer if:
    // - Not playing
    // - Not my turn
    // - I'm on auto-play
    // - I'm a spectator
    if (this.gameStatus !== GameStatus.PLAYING) return;
    if (String(this.currentTurn) !== String(this.myPlayerId)) return;
    if (this.autoPlayers.has(String(this.myPlayerId))) return;
    if (this.isSpectator) return;

    // Stop any existing timer
    this.stopTurnTimer();

    // Initialize timer
    this.turnTimeRemaining = this.turnTimerDuration;
    this.updateTurnTimerUI();

    // Show timer
    this.elements.turnTimer?.classList.remove('hidden');

    // Start countdown
    this.turnTimer = setInterval(() => {
      this.turnTimeRemaining -= 0.1; // Decrement by 100ms for smooth progress

      if (this.turnTimeRemaining <= 0) {
        this.onTurnTimerExpired();
      } else {
        this.updateTurnTimerUI();
      }
    }, 100);

    console.log('[BiggerDice] Turn timer started');
  }

  /**
   * Stop the turn timer.
   */
  stopTurnTimer() {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
    this.turnTimeRemaining = 0;

    // Hide timer
    this.elements.turnTimer?.classList.add('hidden');
  }

  /**
   * Update the turn timer UI.
   */
  updateTurnTimerUI() {
    const progress = this.elements.turnTimerProgress;
    const text = this.elements.turnTimerText;
    const timer = this.elements.turnTimer;

    if (!progress || !text || !timer) return;

    // Update progress bar width
    const percentage = (this.turnTimeRemaining / this.turnTimerDuration) * 100;
    progress.style.width = `${Math.max(0, percentage)}%`;

    // Update text (show whole seconds)
    const seconds = Math.ceil(this.turnTimeRemaining);
    text.textContent = seconds;

    // Add warning class when time is low
    if (this.turnTimeRemaining <= 2) {
      timer.classList.add('turn-timer--warning');
    } else {
      timer.classList.remove('turn-timer--warning');
    }
  }

  /**
   * Handle turn timer expiration - auto-roll for the player.
   */
  onTurnTimerExpired() {
    console.log('[BiggerDice] Turn timer expired - auto-rolling');
    this.stopTurnTimer();

    // Double-check it's still my turn
    if (String(this.currentTurn) === String(this.myPlayerId) &&
        this.gameStatus === GameStatus.PLAYING &&
        !this.autoPlayers.has(String(this.myPlayerId))) {
      // Send roll command
      this.sendRoll();
    }
  }

  sendEnableAutoPlay() {
    if (!this.roomId) return;

    // Stop turn timer when enabling auto-play
    this.stopTurnTimer();

    this.send({
      type: 'games.command.bigger_dice.enable_auto_play',
      room_id: this.roomId
    });
    // Hide the button immediately after clicking (will be handled by server event)
    this.elements.autoPlayBtn?.classList.add('hidden');
  }

  // ============================================
  // Ready Timer Methods (auto-ready when all players selected)
  // ============================================

  /**
   * Start the ready timer when all players are selected.
   * Only starts if player is not already ready.
   */
  startReadyTimer() {
    // Don't start timer if:
    // - Game not in waiting state
    // - I'm a spectator
    // - I'm already ready
    if (this.gameStatus !== GameStatus.WAITING) return;
    if (this.isSpectator) return;

    // Check if I'm a selected player and not ready yet
    const myPlayer = this.players.find(p =>
      String(p.user_id || p.id) === String(this.myPlayerId)
    );
    if (!myPlayer) return; // Not a selected player
    if (myPlayer.is_ready) return; // Already ready

    // Stop any existing ready timer
    this.stopReadyTimer();

    // Initialize timer from config
    this.readyTimeRemaining = this.readyTimerDuration;
    this.updateReadyTimerUI();

    // Show timer
    this.elements.readyTimer?.classList.remove('hidden');

    // Start countdown
    this.readyTimer = setInterval(() => {
      this.readyTimeRemaining -= 0.1; // Decrement by 100ms for smooth progress

      if (this.readyTimeRemaining <= 0) {
        this.onReadyTimerExpired();
      } else {
        this.updateReadyTimerUI();
      }
    }, 100);

    console.log('[BiggerDice] Ready timer started, duration:', this.readyTimerDuration);
  }

  /**
   * Stop the ready timer.
   */
  stopReadyTimer() {
    if (this.readyTimer) {
      clearInterval(this.readyTimer);
      this.readyTimer = null;
    }
    this.readyTimeRemaining = 0;

    // Hide timer
    this.elements.readyTimer?.classList.add('hidden');
    this.elements.readyTimer?.classList.remove('ready-timer--warning');
  }

  /**
   * Update the ready timer UI.
   */
  updateReadyTimerUI() {
    const progress = this.elements.readyTimerProgress;
    const text = this.elements.readyTimerText;
    const timer = this.elements.readyTimer;

    if (!progress || !text || !timer) return;

    // Update progress bar width
    const percentage = (this.readyTimeRemaining / this.readyTimerDuration) * 100;
    progress.style.width = `${Math.max(0, percentage)}%`;

    // Update text (show whole seconds)
    const seconds = Math.ceil(this.readyTimeRemaining);
    text.textContent = seconds;

    // Add warning class when time is low (last 5 seconds)
    if (this.readyTimeRemaining <= 5) {
      timer.classList.add('ready-timer--warning');
    } else {
      timer.classList.remove('ready-timer--warning');
    }
  }

  /**
   * Handle ready timer expiration - auto-ready for the player.
   */
  onReadyTimerExpired() {
    console.log('[BiggerDice] Ready timer expired - auto-ready');
    this.stopReadyTimer();

    // Double-check conditions
    if (this.gameStatus !== GameStatus.WAITING || this.isSpectator) return;

    const myPlayer = this.players.find(p =>
      String(p.user_id || p.id) === String(this.myPlayerId)
    );
    if (!myPlayer || myPlayer.is_ready) return;

    // Send ready command
    this.sendReady();
  }

  leaveGame() {
    this.send({
      type: 'games.command.leave_room',
      room_id: this.roomId
    });

    // Reset chat state when leaving
    this.chatHistoryRequested = { lobby: false, players: false, spectators: false };
    this.chatMessages = { lobby: [], players: [], spectators: [] };

    this.dispatchEvent(new CustomEvent('game-leave'));
  }

  // Admin actions - only available to room host
  selectPlayer(userId) {
    if (!this.isAdmin) return;
    this.send({
      type: 'games.command.select_player',
      room_id: this.roomId,
      target_user_id: String(userId)
    });
  }

  kickPlayer(userId) {
    if (!this.isAdmin) return;
    this.send({
      type: 'games.command.kick_player',
      room_id: this.roomId,
      target_user_id: String(userId)
    });
  }

  banPlayer(userId) {
    if (!this.isAdmin) return;
    this.send({
      type: 'games.command.ban_player',
      room_id: this.roomId,
      target_user_id: String(userId)
    });
  }

  unbanPlayer(userId) {
    if (!this.isAdmin) return;
    this.send({
      type: 'games.command.unban_player',
      room_id: this.roomId,
      target_user_id: String(userId)
    });
  }

  // ============================================
  // UI Updates
  // ============================================

  updateGameUI() {
    const status = this.elements.gameStatus;
    const waitingForAdmin = this.elements.waitingForAdmin;
    const adminLobby = this.elements.adminLobby;
    const waitingState = this.elements.waitingState;
    const notInRoomState = this.elements.notInRoomState;
    const board = this.elements.gameBoard;

    // If we're in not-in-room state, don't update the game UI
    // The showNotInRoomUI method handles that state
    if (this.notInRoomInfo) {
      return;
    }

    // Update status badge
    status.textContent = this.formatStatus(this.gameStatus);
    status.className = `game-status game-status--${this.gameStatus}`;

    // Determine which view to show based on player count, role, and game status
    // Use maxPlayers (not hardcoded 2) to support N-player games
    const needsMorePlayers = this.players.length < this.maxPlayers;
    const amInLobby = this.lobby.some(p => String(p.user_id) === String(this.myPlayerId));
    const amAPlayer = this.players.some(p =>
      String(p.user_id || p.id) === String(this.myPlayerId)
    );

    console.log('[BiggerDice] updateGameUI: players.length=', this.players.length, 'maxPlayers=', this.maxPlayers, 'needsMorePlayers=', needsMorePlayers, 'isAdmin=', this.isAdmin, 'amInLobby=', amInLobby, 'amAPlayer=', amAPlayer);

    // Hide all views first
    waitingForAdmin.classList.add('hidden');
    adminLobby.classList.add('hidden');
    waitingState.classList.add('hidden');
    notInRoomState.classList.add('hidden');
    board.classList.add('hidden');

    if (needsMorePlayers) {
      // Still waiting for players to be selected
      if (this.isAdmin) {
        // Admin always sees the admin lobby interface (regardless of being in players or lobby)
        adminLobby.classList.remove('hidden');
        this.renderAdminLobby();
      } else if (amInLobby) {
        // Non-admin in lobby: waiting to be selected
        waitingForAdmin.classList.remove('hidden');
        this.renderWaitingPlayersList();
      } else if (this.isSpectator) {
        // Spectators see the same lobby view as players waiting to be selected
        waitingForAdmin.classList.remove('hidden');
        this.renderWaitingPlayersList();
      } else if (amAPlayer) {
        // Non-admin but is a player: waiting for more players
        waitingState.classList.remove('hidden');
      } else {
        // Unknown state, show generic waiting
        waitingState.classList.remove('hidden');
      }
    } else {
      // All players are selected, show the game board
      board.classList.remove('hidden');
    }

    // Render player cards and dice dynamically
    this.renderPlayersArea();
    this.renderDiceArea();
    this.renderDisconnectOverlay();

    // Update turn indicator
    this.updateTurnIndicator();

    // Update buttons
    this.updateButtons();

    // Update round info
    this.elements.roundInfo.textContent = `Round ${this.round} / First to 10`;
  }

  renderAdminLobby() {
    const listEl = this.elements.lobbyPlayersList;
    const countEl = this.elements.lobbyCount;

    // Combine lobby players and spectators for display
    const lobbyCount = this.lobby.length;
    const spectatorCount = this.spectators.length;
    const totalCount = lobbyCount + spectatorCount;

    // Update count - show both players and spectators
    countEl.textContent = spectatorCount > 0
      ? `${lobbyCount} waiting, ${spectatorCount} spectator${spectatorCount > 1 ? 's' : ''}`
      : `${lobbyCount} waiting`;

    // Render combined list (lobby players + spectators)
    if (totalCount === 0) {
      listEl.innerHTML = `
        <div class="lobby-empty">
          <div class="lobby-empty__icon">👥</div>
          <p>No players waiting. Share the room link to invite players!</p>
        </div>
      `;
    } else {
      // Render lobby players first
      const lobbyHtml = this.lobby.map(player => {
        const initial = (player.username || 'U').charAt(0).toUpperCase();
        const isReady = player.is_ready === true;
        const isHost = String(player.user_id) === String(this.hostId);
        const isMe = String(player.user_id) === String(this.myPlayerId);

        // Build badges
        let badges = '';
        if (isHost) {
          badges += '<span class="admin-badge">👑 Admin</span> ';
        }
        if (isReady) {
          badges += '<span class="ready-badge">✓ Ready</span>';
        } else {
          badges += '<span class="waiting-badge">Waiting...</span>';
        }

        // Build actions - admin has different options for themselves
        let actionsHtml = '';
        if (isMe) {
          // Admin's own entry - can select self or become spectator
          actionsHtml = `
            <button class="select-btn" data-action="select" data-user-id="${player.user_id}">Select Myself</button>
            ${this.allowSpectators ? `<button class="kick-btn" data-action="become-spectator" data-user-id="${player.user_id}">Become Spectator</button>` : ''}
          `;
        } else {
          // Other players - standard actions
          actionsHtml = `
            <button class="select-btn" data-action="select" data-user-id="${player.user_id}">Select</button>
            <button class="kick-btn" data-action="kick" data-user-id="${player.user_id}">Kick</button>
            <button class="ban-btn" data-action="ban" data-user-id="${player.user_id}">Ban</button>
          `;
        }

        return `
          <div class="lobby-player ${isReady ? 'lobby-player--ready' : ''} ${isHost ? 'lobby-player--admin' : ''}" data-user-id="${player.user_id}">
            <div class="lobby-player__info">
              <div class="lobby-player__avatar ${isHost ? 'lobby-player__avatar--admin' : ''}">${initial}</div>
              <div>
                <div class="lobby-player__name">${this.escapeHtml(player.username)} ${badges}</div>
                <div class="lobby-player__joined">${isReady ? 'Player is ready to start' : (isHost ? 'Room host - select players to start' : 'Waiting for player to ready up')}</div>
              </div>
            </div>
            <div class="lobby-player__actions">
              ${actionsHtml}
            </div>
          </div>
        `;
      }).join('');

      // Render spectators with spectator label - admin can select spectators to become players
      const spectatorsHtml = this.spectators.map(spectator => {
        const initial = (spectator.username || 'U').charAt(0).toUpperCase();
        const isHost = String(spectator.user_id) === String(this.hostId);
        const isMe = String(spectator.user_id) === String(this.myPlayerId);

        // Build badges
        let badges = '';
        if (isHost) {
          badges += '<span class="admin-badge">👑 Admin</span> ';
        }
        badges += '<span class="spectator-badge">👁 Spectator</span>';

        // Build actions
        let actionsHtml = '';
        if (isMe) {
          // Admin as spectator - can become player
          actionsHtml = `
            <button class="select-btn" data-action="become-player" data-user-id="${spectator.user_id}">Join as Player</button>
          `;
        } else {
          actionsHtml = `
            <button class="select-btn" data-action="select-spectator" data-user-id="${spectator.user_id}">Select to Play</button>
            <button class="kick-btn" data-action="kick-spectator" data-user-id="${spectator.user_id}">Remove</button>
            <button class="ban-btn" data-action="ban" data-user-id="${spectator.user_id}">Ban</button>
          `;
        }

        return `
          <div class="lobby-player lobby-player--spectator ${isHost ? 'lobby-player--admin' : ''}" data-user-id="${spectator.user_id}">
            <div class="lobby-player__info">
              <div class="lobby-player__avatar lobby-player__avatar--spectator ${isHost ? 'lobby-player__avatar--admin' : ''}">${initial}</div>
              <div>
                <div class="lobby-player__name">${this.escapeHtml(spectator.username)} ${badges}</div>
                <div class="lobby-player__joined">${isHost ? 'Room host - watching as spectator' : 'Watching the game (can be selected to play)'}</div>
              </div>
            </div>
            <div class="lobby-player__actions">
              ${actionsHtml}
            </div>
          </div>
        `;
      }).join('');

      listEl.innerHTML = lobbyHtml + spectatorsHtml;

      // Bind action buttons
      listEl.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          const userId = parseInt(e.target.dataset.userId, 10);

          if (action === 'select') {
            this.selectPlayer(userId);
          } else if (action === 'select-spectator') {
            this.selectSpectator(userId);
          } else if (action === 'kick') {
            this.kickPlayer(userId);
          } else if (action === 'kick-spectator') {
            this.kickSpectator(userId);
          } else if (action === 'ban') {
            this.banPlayer(userId);
          } else if (action === 'become-spectator') {
            this.becomeSpectator();
          } else if (action === 'become-player') {
            this.becomePlayer();
          }
        });
      });
    }

    // Render banned players list
    this.renderBannedPlayersList();
  }

  kickSpectator(userId) {
    console.log('[BiggerDice] Kicking spectator:', userId);
    this.send({
      type: 'games.command.kick_spectator',
      room_id: this.roomId,
      target_user_id: userId
    });
  }

  selectSpectator(userId) {
    console.log('[BiggerDice] Selecting spectator to play:', userId);
    this.send({
      type: 'games.command.select_spectator',
      room_id: this.roomId,
      target_user_id: userId
    });
  }

  becomeSpectator() {
    console.log('[BiggerDice] Admin becoming spectator');
    this.send({
      type: 'games.command.become_spectator',
      room_id: this.roomId
    });
  }

  becomePlayer() {
    console.log('[BiggerDice] Admin becoming player from spectator');
    this.send({
      type: 'games.command.become_player',
      room_id: this.roomId
    });
  }

  renderBannedPlayersList() {
    const sectionEl = this.elements.bannedPlayersSection;
    const countEl = this.elements.bannedCount;
    const listEl = this.elements.bannedPlayersList;

    if (!sectionEl || !listEl) return;

    const count = this.bannedPlayers.length;

    // Show/hide the section based on whether there are banned players
    if (count === 0) {
      sectionEl.classList.add('hidden');
      return;
    }

    sectionEl.classList.remove('hidden');
    countEl.textContent = `${count} banned`;

    // Render banned players list
    listEl.innerHTML = this.bannedPlayers.map(player => {
      const initial = (player.username || 'U').charAt(0).toUpperCase();
      return `
        <div class="banned-player" data-user-id="${player.user_id}">
          <div class="banned-player__info">
            <div class="banned-player__avatar">${initial}</div>
            <span class="banned-player__name">${this.escapeHtml(player.username)}</span>
          </div>
          <button class="unban-btn" data-action="unban" data-user-id="${player.user_id}">Unban</button>
        </div>
      `;
    }).join('');

    // Bind unban buttons
    listEl.querySelectorAll('[data-action="unban"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = parseInt(e.target.dataset.userId, 10);
        this.unbanPlayer(userId);
      });
    });
  }

  renderWaitingPlayersList() {
    const listEl = this.elements.waitingPlayersList;
    if (!listEl) return;

    // Show all lobby players with their ready state
    if (this.lobby.length === 0) {
      listEl.innerHTML = '';
      return;
    }

    listEl.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 0.5rem; font-size: 0.875rem;">Players in lobby:</div>
      ${this.lobby.map(player => {
      const isReady = player.is_ready === true;
      const isMe = String(player.user_id) === String(this.myPlayerId);
      const isHost = String(player.user_id) === String(this.hostId);

      // Build badges
      let badges = '';
      if (isHost) {
        badges += '<span class="admin-badge" style="margin-right: 0.25rem;">👑 Admin</span>';
      }
      if (isMe) {
        badges += '<span style="color: var(--primary-color);">(you)</span>';
      }

      return `
          <div class="waiting-player ${isReady ? 'waiting-player--ready' : ''} ${isHost ? 'waiting-player--admin' : ''}">
            <span class="waiting-player__name">${this.escapeHtml(player.username)} ${badges}</span>
            <span class="waiting-player__status ${isReady ? 'waiting-player__status--ready' : 'waiting-player__status--waiting'}">
              ${isReady ? '✓ Ready' : (isHost ? 'Host' : 'Waiting...')}
            </span>
          </div>
        `;
    }).join('')}
    `;
  }

  renderPlayersArea() {
    const container = this.elements.playersArea;
    if (!container) return;

    console.log('[DEBUG] renderPlayersArea - START, scores:', this.players.map(p => ({id: p.user_id || p.id, score: p.score})));

    // Build HTML for all player slots
    const playerCards = [];

    for (let i = 0; i < this.maxPlayers; i++) {
      const player = this.players[i];

      if (player) {
        const playerName = player.username || player.name || 'Player';
        const playerId = player.user_id || player.id;
        const playerIdStr = String(playerId);
        const isActive = String(this.currentTurn) === String(playerId);
        const isReady = player.is_ready === true;
        const score = player.score || 0;
        console.log('[DEBUG] renderPlayersArea - rendering player:', playerId, 'with score:', score);
        const initial = playerName.charAt(0)?.toUpperCase() || '?';
        const disconnectInfo = this.disconnectedPlayers.get(playerIdStr);
        const isDisconnected = Boolean(disconnectInfo);
        const isAuto = this.autoPlayers.has(playerIdStr);
        const disconnectSeconds = isDisconnected ? this.getDisconnectSecondsLeft(disconnectInfo.timeoutAt) : 0;
        const canKick = isDisconnected && this.canKickDisconnected(playerIdStr, disconnectInfo.timeoutAt);

        playerCards.push(`
          <div class="player-card ${isActive ? 'player-card--active' : ''} ${isDisconnected ? 'player-card--disconnected' : ''} ${isAuto ? 'player-card--auto' : ''}" data-player-id="${playerId}">
            <div class="player-avatar">${this.escapeHtml(initial)}</div>
            <div class="player-name">${this.escapeHtml(playerName)}</div>
            <div class="player-score">${score}</div>
            <div class="player-label">Points</div>
            <div class="player-ready ${isReady ? '' : 'hidden'}">Ready!</div>
            ${isAuto ? '<div class="player-card__auto">Auto</div>' : ''}
            ${isDisconnected ? `
              <div class="player-card__disconnect">
                <div class="disconnect-spinner" aria-hidden="true"></div>
                <div class="disconnect-timer">
                  ${disconnectSeconds > 0 ? `Reconnecting... ${disconnectSeconds}s` : 'Disconnected'}
                </div>
                ${canKick ? `
                  <button class="kick-btn" data-action="kick-disconnected" data-user-id="${playerIdStr}">Kick</button>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `);
      } else {
        // Empty slot
        playerCards.push(`
          <div class="player-card player-card--empty">
            <div class="player-avatar">?</div>
            <div class="player-name">Waiting...</div>
            <div class="player-score">0</div>
            <div class="player-label">Points</div>
            <div class="player-ready hidden">Ready!</div>
          </div>
        `);
      }

      // Add VS indicator between players (not after the last one)
      if (i < this.maxPlayers - 1) {
        playerCards.push('<div class="vs-indicator">VS</div>');
      }
    }

    container.innerHTML = playerCards.join('');
    console.log('[DEBUG] renderPlayersArea - END, innerHTML updated');
  }

  /**
   * Update only the score display elements without re-rendering the entire player area.
   * This is useful for incremental updates where a full re-render is not desired.
   * Note: Currently not used - handleRoundResult calls updateGameUI which does a full render.
   * Kept for potential future optimization use cases.
   */
  updateScoresOnly() {
    const container = this.elements.playersArea;
    if (!container) return;

    const MAX_PLAYERS = 10; // Safety bound for loop
    const playerCount = Math.min(this.players.length, MAX_PLAYERS);

    for (let i = 0; i < playerCount; i++) {
      const player = this.players[i];
      const playerId = player.user_id || player.id;
      const playerCard = container.querySelector(`.player-card[data-player-id="${playerId}"]`);
      if (playerCard) {
        const scoreEl = playerCard.querySelector('.player-score');
        if (scoreEl) {
          const newScore = player.score || 0;
          if (scoreEl.textContent !== String(newScore)) {
            scoreEl.textContent = newScore;
            // Add a brief highlight effect to indicate score change
            scoreEl.classList.add('score-updated');
            setTimeout(() => scoreEl.classList.remove('score-updated'), 300);
          }
        }
      }
    }
  }

  renderDiceArea() {
    const container = this.elements.diceContainer;
    if (!container) return;

    // IMPORTANT: Skip rendering if animation is in progress or queue has pending events.
    // Re-rendering during animation destroys the dice elements being animated,
    // which breaks the animation for the last player to roll.
    // The dice values are persisted in lastDiceState and will be restored after
    // animation completes via applyDiceState().
    if (this.isAnimating || this.rollEventQueue.length > 0) {
      console.log('[BiggerDice] renderDiceArea: skipping - animation in progress or queue not empty');
      return;
    }

    // Only render dice when we have players
    const playerCount = this.players.length;
    if (playerCount === 0) {
      container.innerHTML = '';
      this.diceElements = [];
      return;
    }

    // Build dice HTML for each player
    const diceHtml = this.players.map((player, index) => {
      const playerName = player.username || player.name || `Player ${index + 1}`;
      return `
        <div class="dice-wrapper" data-player-index="${index}">
          <div class="dice-label">${this.escapeHtml(playerName)}</div>
          <div class="dice dice--player-${index}" id="dice-${index}" data-value="0">
            <span class="dice-dot"></span>
            <span class="dice-dot"></span>
            <span class="dice-dot"></span>
            <span class="dice-dot"></span>
            <span class="dice-dot"></span>
            <span class="dice-dot"></span>
            <span class="dice-dot"></span>
            <span class="dice-dot"></span>
            <span class="dice-dot"></span>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = diceHtml;

    // Cache dice elements
    this.diceElements = this.players.map((_, index) =>
      container.querySelector(`#dice-${index}`)
    );

    console.log(`[BiggerDice] renderDiceArea: created ${this.diceElements.length} dice elements`);

    // Restore dice values from lastDiceState after re-rendering
    // This ensures dice values persist across UI updates
    this.applyDiceState();
  }

  renderDisconnectOverlay() {
    const overlay = this.elements.disconnectOverlay;
    if (!overlay) return;

    const myId = String(this.myPlayerId);
    const isPlayer = this.players.some(p => String(p.user_id || p.id) === myId);
    const pendingDisconnects = Array.from(this.disconnectedPlayers.entries())
      .filter(([userId]) => userId !== myId && !this.autoPlayers.has(userId));

    const shouldShow = this.gameStatus === GameStatus.PLAYING
      && isPlayer
      && !this.isSpectator
      && pendingDisconnects.length > 0;

    overlay.classList.toggle('active', shouldShow);
    overlay.setAttribute('aria-hidden', String(!shouldShow));

    if (!shouldShow) {
      return;
    }

    if (!overlay.querySelector('.disconnect-modal')) {
      overlay.innerHTML = `
        <div class="disconnect-modal" role="dialog" aria-modal="true" aria-label="Player disconnected">
          <div class="disconnect-modal__header">
            <div class="disconnect-spinner" aria-hidden="true"></div>
            <div>
              <div class="disconnect-modal__title">Player disconnected</div>
              <div class="disconnect-modal__subtitle">Waiting 30 seconds for reconnect</div>
            </div>
          </div>
          <div class="disconnect-list"></div>
          <div class="disconnect-hint">Game is paused until the player returns or is kicked.</div>
        </div>
      `;
    }

    const listEl = overlay.querySelector('.disconnect-list');
    if (!listEl) return;

    const newIds = new Set(pendingDisconnects.map(([userId]) => userId));
    const idsChanged = newIds.size !== this.disconnectOverlayIds.size
      || Array.from(newIds).some(id => !this.disconnectOverlayIds.has(id));

    if (idsChanged) {
      listEl.innerHTML = pendingDisconnects.map(([userId]) => {
        const player = this.players.find(p => String(p.user_id || p.id) === userId);
        const name = player?.username || player?.name || `User #${userId}`;

        return `
          <div class="disconnect-item" data-user-id="${userId}">
            <div class="disconnect-item__left">
              <div class="disconnect-item__name">${this.escapeHtml(name)}</div>
              <div class="disconnect-item__timer" data-role="timer">Disconnected</div>
            </div>
            <div data-role="action"></div>
          </div>
        `;
      }).join('');
      this.disconnectOverlayIds = newIds;
    }

    pendingDisconnects.forEach(([userId, info]) => {
      const item = listEl.querySelector(`.disconnect-item[data-user-id="${userId}"]`);
      if (!item) return;

      const timerEl = item.querySelector('[data-role="timer"]');
      const actionEl = item.querySelector('[data-role="action"]');
      const timeLeft = this.getDisconnectSecondsLeft(info.timeoutAt);
      const canKick = this.canKickDisconnected(userId, info.timeoutAt);
      const hasVoted = this.kickVotes.has(userId);

      if (timerEl) {
        timerEl.textContent = timeLeft > 0 ? `Reconnecting... ${timeLeft}s` : 'Disconnected';
      }

      if (!actionEl) return;

      if (timeLeft > 0) {
        actionEl.innerHTML = `<div class="disconnect-item__status">Waiting</div>`;
      } else if (hasVoted) {
        actionEl.innerHTML = `<div class="disconnect-voted">Vote sent</div>`;
      } else if (canKick) {
        actionEl.innerHTML = `<button class="kick-btn" data-action="kick-disconnected" data-user-id="${userId}">Kick disconnected</button>`;
      } else {
        actionEl.innerHTML = '';
      }
    });
  }

  updateTurnIndicator() {
    const indicator = this.elements.turnIndicator;

    if (this.gameStatus !== GameStatus.PLAYING) {
      indicator.classList.add('hidden');
      return;
    }

    indicator.classList.remove('hidden');

    if (String(this.currentTurn) === String(this.myPlayerId)) {
      indicator.textContent = 'Your turn - Roll the dice!';
      indicator.style.borderColor = 'var(--success-color)';
    } else {
      const opponent = this.players.find(p =>
        String(p.user_id || p.id) === String(this.currentTurn)
      );
      const opponentName = opponent?.username || opponent?.name || 'Opponent';
      indicator.textContent = `${opponentName}'s turn...`;
      indicator.style.borderColor = 'var(--primary-color)';
    }
  }

  updateButtons() {
    const readyBtn = this.elements.readyBtn;
    const rollBtn = this.elements.rollBtn;
    const autoPlayBtn = this.elements.autoPlayBtn;

    // Check if user is a spectator - spectators never see action buttons
    if (this.isSpectator || this.autoPlayers.has(String(this.myPlayerId))) {
      readyBtn?.classList.add('hidden');
      rollBtn?.classList.add('hidden');
      autoPlayBtn?.classList.add('hidden');
      return;
    }

    // Check if user is in the players array (selected to play)
    const myPlayerData = this.players.find(p =>
      String(p.user_id || p.id) === String(this.myPlayerId)
    );
    const amIAPlayer = !!myPlayerData;

    // If not a selected player, hide all action buttons
    if (!amIAPlayer) {
      readyBtn?.classList.add('hidden');
      rollBtn?.classList.add('hidden');
      autoPlayBtn?.classList.add('hidden');
      return;
    }

    // During WAITING phase: show ready button if not ready yet
    if (this.gameStatus === GameStatus.WAITING) {
      rollBtn?.classList.add('hidden');
      autoPlayBtn?.classList.add('hidden');

      // Show ready button only if player hasn't clicked ready
      if (myPlayerData && !myPlayerData.is_ready) {
        readyBtn?.classList.remove('hidden');
        readyBtn.disabled = false;
      } else {
        readyBtn?.classList.add('hidden');
      }
    }
    // During PLAYING phase: show roll button when it's my turn, auto-play button always
    else if (this.gameStatus === GameStatus.PLAYING) {
      readyBtn?.classList.add('hidden');
      rollBtn?.classList.remove('hidden');
      rollBtn.disabled = String(this.currentTurn) !== String(this.myPlayerId);

      // Show Auto Play button during game (allows player to go AFK)
      autoPlayBtn?.classList.remove('hidden');
    }
    // Hide all when game is finished or other states
    else {
      readyBtn?.classList.add('hidden');
      rollBtn?.classList.add('hidden');
      autoPlayBtn?.classList.add('hidden');
    }
  }

  startDisconnectTicker() {
    if (this.disconnectTicker) {
      return;
    }
    this.disconnectTicker = setInterval(() => {
      if (this.disconnectedPlayers.size === 0) {
        this.stopDisconnectTickerIfNeeded();
        return;
      }
      this.renderPlayersArea();
      this.renderDisconnectOverlay();
    }, 1000);
  }

  stopDisconnectTickerIfNeeded() {
    if (this.disconnectedPlayers.size === 0 && this.disconnectTicker) {
      clearInterval(this.disconnectTicker);
      this.disconnectTicker = null;
    }
  }

  getDisconnectSecondsLeft(timeoutAt) {
    if (!timeoutAt) return 0;
    const diffMs = timeoutAt.getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / 1000));
  }

  canKickDisconnected(userId, timeoutAt) {
    const userIdStr = String(userId);
    if (!this.isPlayer || this.isSpectator) return false;
    if (String(this.myPlayerId) === userIdStr) return false;
    if (this.kickVotes.has(userIdStr)) return false;
    if (this.gameStatus !== GameStatus.PLAYING) return false;
    const timeLeft = this.getDisconnectSecondsLeft(timeoutAt);
    return timeLeft === 0;
  }

  sendKickDisconnected(userId) {
    const userIdStr = String(userId);
    if (!this.roomId) return;
    if (this.kickVotes.has(userIdStr)) return;

    this.kickVotes.add(userIdStr);
    this.send({
      type: 'games.command.vote_kick_disconnected',
      room_id: this.roomId,
      target_user_id: userIdStr
    });
    this.updateGameUI();
  }

  /**
   * Animate a dice roll for a specific dice element.
   * Returns a Promise that resolves when the animation completes.
   * Only the specified dice element will animate - other dice remain static.
   * @param {HTMLElement} diceEl - The dice element to animate
   * @param {number} finalValue - The final dice value (1-6)
   * @returns {Promise<void>} Resolves when animation is complete
   */
  animateDiceRoll(diceEl, finalValue) {
    return new Promise((resolve) => {
      // Set animation flag
      this.isAnimating = true;

      // Add rolling class only to this specific dice
      diceEl.classList.add('dice--rolling');

      let rollCount = 0;
      const maxRolls = 10;
      const rollIntervalMs = 100;

      const rollInterval = setInterval(() => {
        const randomValue = Math.floor(Math.random() * 6) + 1;
        diceEl.dataset.value = randomValue;
        rollCount++;

        if (rollCount >= maxRolls) {
          clearInterval(rollInterval);
          diceEl.classList.remove('dice--rolling');
          diceEl.dataset.value = finalValue;

          // Clear animation flag
          this.isAnimating = false;

          // Resolve the promise - animation is complete
          resolve();
        }
      }, rollIntervalMs);
    });
  }

  showRoundResult(message) {
    const overlay = this.elements.resultOverlay;
    const p1 = this.players[0];
    const p2 = this.players[1];
    const p1Name = p1?.username || p1?.name || 'Player 1';
    const p2Name = p2?.username || p2?.name || 'Player 2';
    const isMyWin = String(message.winner_id) === String(this.myPlayerId);

    this.elements.resultIcon.textContent = isMyWin ? '🎉' : (message.winner_id ? '😢' : '🤝');
    this.elements.resultTitle.textContent = isMyWin ? 'You Won!' : (message.winner_id ? 'You Lost' : 'Tie!');
    this.elements.resultScore1.textContent = p1?.score || 0;
    this.elements.resultLabel1.textContent = p1Name;
    this.elements.resultScore2.textContent = p2?.score || 0;
    this.elements.resultLabel2.textContent = p2Name;
    this.elements.resultMessage.textContent = `Round ${this.round} complete`;

    overlay.classList.add('active');
  }

  showGameOverResult(message) {
    const board = this.elements.gameBoard;
    const myId = String(this.myPlayerId);

    // Find the winner's info
    const winnerId = message.winner_id || message.winner;
    const winner = this.players.find(p => String(p.id || p.user_id) === String(winnerId));
    const winnerName = message.winner_username || message.winner_name || winner?.username || winner?.name || 'Winner';
    const isWinner = String(winnerId) === myId;

    // Find the max score to determine winner(s)
    const maxScore = Math.max(...this.players.map(p => p.score || 0));

    // Generate player scores HTML for all players
    const playersScoreHtml = this.players.map((player, index) => {
      const playerName = player.username || player.name || `Player ${index + 1}`;
      const playerScore = player.score || 0;
      const isPlayerWinner = playerScore === maxScore && playerScore > 0;

      return `
        <div class="game-over__player ${isPlayerWinner ? 'game-over__player--winner' : ''}">
          <div class="game-over__player-name">${this.escapeHtml(playerName)}</div>
          <div class="game-over__player-score">${playerScore}</div>
        </div>
      `;
    }).join(this.players.length === 2 ? '<div class="game-over__vs">vs</div>' : '');

    // Generate round history HTML (simplified for multi-player)
    const roundHistoryHtml = this.roundHistory.length > 0 ? `
      <div class="game-over__history">
        <h4 class="game-over__history-title">Round Results</h4>
        <table class="game-over__table">
          <thead>
            <tr>
              <th>Round</th>
              ${this.players.map((p, i) => `<th>${this.escapeHtml(p.username || p.name || `P${i + 1}`)}</th>`).join('')}
              <th>Winner</th>
            </tr>
          </thead>
          <tbody>
            ${this.roundHistory.map(round => `
              <tr class="${round.winnerId === myId ? 'game-over__row--win' : ''}">
                <td>${round.round}</td>
                ${round.rolls ? this.players.map((player, i) => {
                  const playerId = String(player.user_id || player.id);
                  const rollData = round.rolls.find(r => String(r.id) === playerId);
                  const rollValue = rollData ? (rollData.roll !== undefined ? rollData.roll : rollData) : '-';
                  const isWinner = round.winnerId === playerId;
                  return `<td class="${isWinner ? 'game-over__cell--winner' : ''}">${rollValue}</td>`;
                }).join('') : `
                  <td class="${round.winnerId === round.player1?.id ? 'game-over__cell--winner' : ''}">${round.player1?.roll || '-'}</td>
                  <td class="${round.winnerId === round.player2?.id ? 'game-over__cell--winner' : ''}">${round.player2?.roll || '-'}</td>
                `}
                <td>${round.winnerName ? this.escapeHtml(round.winnerName) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    // Replace gameBoard content with game over screen
    board.innerHTML = `
      <div class="game-over">
        <div class="game-over__header">
          <div class="game-over__icon">${isWinner ? '🏆' : '🥈'}</div>
          <h2 class="game-over__title">${isWinner ? 'Victory!' : 'Game Over'}</h2>
          <p class="game-over__subtitle">${this.escapeHtml(winnerName)} wins the game!</p>
        </div>

        <div class="game-over__scores ${this.players.length > 2 ? 'game-over__scores--multi' : ''}">
          ${playersScoreHtml}
        </div>

        ${roundHistoryHtml}

        <div class="game-over__actions">
          <button class="game-over__btn game-over__btn--primary" id="returnToLobbyBtn">Return to Lobby</button>
        </div>
      </div>
    `;

    // Bind button events
    const returnToLobbyBtn = board.querySelector('#returnToLobbyBtn');

    if (returnToLobbyBtn) {
      returnToLobbyBtn.addEventListener('click', () => {
        this.leaveGame();
      });
    }

    // Make sure gameBoard is visible
    board.classList.remove('hidden');
  }

  hideResultOverlay() {
    this.elements.resultOverlay.classList.remove('active');
  }

  // ============================================
  // Utility Methods
  // ============================================

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  formatStatus(status) {
    const statuses = {
      'waiting': 'Waiting',
      'playing': 'Playing',
      'in_progress': 'In Progress',
      'finished': 'Finished',
      'abandoned': 'Abandoned'
    };
    return statuses[status] || status;
  }
}
