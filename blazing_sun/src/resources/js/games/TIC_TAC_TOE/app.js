(function(){"use strict";const p=document.createElement("template");p.innerHTML=`
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
`;class g extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.shadowRoot.appendChild(p.content.cloneNode(!0)),this.ws=null,this.wsUrl="",this.userId="",this.username="",this.avatarId="",this.roomId="",this.roomName="",this.mode="lobby",this.wsConnected=!1,this.isSpectator=!1,this.board=Array(9).fill(null),this.playerXId=null,this.playerOId=null,this.currentTurn=null,this.scores={},this.gameNumber=1,this.moveDeadline=null,this.isGamePaused=!1,this.winningLine=null,this.timerInterval=null,this.timeRemaining=60,this.rooms=[],this.players=[],this.selectedPlayers=[],this.isReady=!1,this.isHost=!1,this.roomToJoin=null,this.lobby=[],this.bannedPlayers=[],this.spectators=[],this.hostId=null,this.isAdmin=!1,this.notInRoomInfo=null,this.wantsToSpectate=!1,this.maxPlayers=2,this.allowSpectators=!0,this.chatChannel="lobby",this.chatMessages={lobby:[],players:[],spectators:[]},this.chatHistoryRequested={lobby:!1,players:!1,spectators:!1},this.chatUnreadCounts={lobby:0,players:0,spectators:0},this.mutedUsers=new Set,this.isChatCollapsed=!1,this.isPlayer=!1,this.windowEventsBound=!1,this.hasSentDisconnectIntent=!1,this._handlePageHide=null,this._handleBeforeUnload=null,this._handleOffline=null,this.els={},this._bindElements(),this._bindEvents()}connectedCallback(){this.wsUrl=this.dataset.wsUrl||"",this.userId=this.dataset.userId||"",this.username=this.dataset.username||"",this.avatarId=this.dataset.avatarId||"",this.roomId=this.dataset.roomId||"",this.roomName=this.dataset.roomName||"",this.mode=this.dataset.mode||"lobby",this._bindWindowEvents(),this._connect()}disconnectedCallback(){this._unbindWindowEvents(),this._disconnect()}_bindElements(){const e=this.shadowRoot;this.els={headerTitle:e.querySelector("#headerTitle"),gameStatus:e.querySelector("#gameStatus"),connectionDot:e.querySelector("#connectionDot"),connectionText:e.querySelector("#connectionText"),lobbySection:e.querySelector("#lobbySection"),gameSection:e.querySelector("#gameSection"),gameBoard:e.querySelector("#gameBoard"),roomsGrid:e.querySelector("#roomsGrid"),loadingState:e.querySelector("#loadingState"),emptyState:e.querySelector("#emptyState"),createRoomBtn:e.querySelector("#createRoomBtn"),createRoomModal:e.querySelector("#createRoomModal"),createRoomForm:e.querySelector("#createRoomForm"),roomNameInput:e.querySelector("#roomNameInput"),roomPasswordInput:e.querySelector("#roomPasswordInput"),allowSpectatorsInput:e.querySelector("#allowSpectatorsInput"),modalCloseBtn:e.querySelector("#modalCloseBtn"),modalCancelBtn:e.querySelector("#modalCancelBtn"),joinPasswordModal:e.querySelector("#joinPasswordModal"),joinPasswordForm:e.querySelector("#joinPasswordForm"),joinPasswordInput:e.querySelector("#joinPasswordInput"),joinPasswordError:e.querySelector("#joinPasswordError"),joinPasswordCloseBtn:e.querySelector("#joinPasswordCloseBtn"),joinPasswordCancelBtn:e.querySelector("#joinPasswordCancelBtn"),createConfirmModal:e.querySelector("#createConfirmModal"),createConfirmLoader:e.querySelector("#createConfirmLoader"),createConfirmMessage:e.querySelector("#createConfirmMessage"),createConfirmCloseBtn:e.querySelector("#createConfirmCloseBtn"),createConfirmCancelBtn:e.querySelector("#createConfirmCancelBtn"),createConfirmBtn:e.querySelector("#createConfirmBtn"),joinConfirmModal:e.querySelector("#joinConfirmModal"),joinConfirmLoader:e.querySelector("#joinConfirmLoader"),joinConfirmMessage:e.querySelector("#joinConfirmMessage"),joinConfirmCloseBtn:e.querySelector("#joinConfirmCloseBtn"),joinConfirmCancelBtn:e.querySelector("#joinConfirmCancelBtn"),joinConfirmBtn:e.querySelector("#joinConfirmBtn"),actionButtons:e.querySelector("#actionButtons"),readyBtn:e.querySelector("#readyBtn"),waitingForAdmin:e.querySelector("#waitingForAdmin"),waitingPlayersList:e.querySelector("#waitingPlayersList"),adminLobby:e.querySelector("#adminLobby"),lobbyCount:e.querySelector("#lobbyCount"),lobbyPlayersList:e.querySelector("#lobbyPlayersList"),bannedPlayersSection:e.querySelector("#bannedPlayersSection"),bannedCount:e.querySelector("#bannedCount"),bannedPlayersList:e.querySelector("#bannedPlayersList"),waitingState:e.querySelector("#waitingState"),notInRoomState:e.querySelector("#notInRoomState"),enterRoomBtn:e.querySelector("#enterRoomBtn"),enterRoomBtnText:e.querySelector("#enterRoomBtnText"),notInRoomHint:e.querySelector("#notInRoomHint"),spectatorOptionContainer:e.querySelector("#spectatorOptionContainer"),joinAsSpectatorCheckbox:e.querySelector("#joinAsSpectatorCheckbox"),spectatorBanner:e.querySelector("#spectatorBanner"),requestToPlayBtn:e.querySelector("#requestToPlayBtn"),spectatorsPanel:e.querySelector("#spectatorsPanel"),spectatorsCount:e.querySelector("#spectatorsCount"),spectatorsList:e.querySelector("#spectatorsList"),gameFooter:e.querySelector("#gameFooter"),roundInfo:e.querySelector("#roundInfo"),leaveBtn:e.querySelector("#leaveBtn"),board:e.querySelector(".board"),cells:e.querySelectorAll(".cell"),player1Score:e.querySelector(".player-score--player1"),player2Score:e.querySelector(".player-score--player2"),gameNumber:e.querySelector(".game-number"),turnIndicator:e.querySelector("#turnIndicator"),turnIndicatorText:e.querySelector(".turn-indicator__text"),turnTimer:e.querySelector("#turnTimer"),turnTimerProgress:e.querySelector("#turnTimerProgress"),turnTimerText:e.querySelector("#turnTimerText"),pausedOverlay:e.querySelector(".paused-overlay"),gameResult:e.querySelector(".game-result"),gameResultTitle:e.querySelector(".game-result__title"),gameResultMessage:e.querySelector(".game-result__message"),gameResultPrize:e.querySelector(".game-result__prize"),gameResultBtn:e.querySelector(".game-result__btn"),chatPanel:e.querySelector("#chatPanel"),chatTabLobby:e.querySelector("#chatTabLobby"),chatTabPlayers:e.querySelector("#chatTabPlayers"),chatTabSpectators:e.querySelector("#chatTabSpectators"),lobbyBadge:e.querySelector("#lobbyBadge"),playersBadge:e.querySelector("#playersBadge"),spectatorsBadge:e.querySelector("#spectatorsBadge"),chatToggle:e.querySelector("#chatToggle"),chatBody:e.querySelector("#chatBody"),chatMessages:e.querySelector("#chatMessages"),chatForm:e.querySelector("#chatForm"),chatInput:e.querySelector("#chatInput"),chatSend:e.querySelector("#chatSend"),chatSendBtn:e.querySelector(".chat-send-btn"),toastContainer:e.querySelector("#toastContainer")}}_bindEvents(){this.els.createRoomBtn.addEventListener("click",()=>this._showCreateRoomModal()),this.els.modalCloseBtn.addEventListener("click",()=>this._hideCreateRoomModal()),this.els.modalCancelBtn.addEventListener("click",()=>this._hideCreateRoomModal()),this.els.createRoomForm.addEventListener("submit",e=>{e.preventDefault(),this._createRoom()}),this.els.joinPasswordCloseBtn.addEventListener("click",()=>this._hideJoinRoomModal()),this.els.joinPasswordCancelBtn.addEventListener("click",()=>this._hideJoinRoomModal()),this.els.joinPasswordForm.addEventListener("submit",e=>{e.preventDefault(),this._confirmJoinRoom()}),this.els.createRoomModal.addEventListener("click",e=>{e.target===this.els.createRoomModal&&this._hideCreateRoomModal()}),this.els.joinPasswordModal.addEventListener("click",e=>{e.target===this.els.joinPasswordModal&&this._hideJoinRoomModal()}),this.els.createConfirmCloseBtn.addEventListener("click",()=>this._hideCreateConfirmModal()),this.els.createConfirmCancelBtn.addEventListener("click",()=>this._hideCreateConfirmModal()),this.els.createConfirmBtn.addEventListener("click",()=>{this._hideCreateConfirmModal(),this._executeCreateRoom()}),this.els.createConfirmModal.addEventListener("click",e=>{e.target===this.els.createConfirmModal&&this._hideCreateConfirmModal()}),this.els.joinConfirmCloseBtn.addEventListener("click",()=>this._hideJoinConfirmModal()),this.els.joinConfirmCancelBtn.addEventListener("click",()=>this._hideJoinConfirmModal()),this.els.joinConfirmBtn.addEventListener("click",()=>{this._hideJoinConfirmModal(),this._executeJoinRoom()}),this.els.joinConfirmModal.addEventListener("click",e=>{e.target===this.els.joinConfirmModal&&this._hideJoinConfirmModal()}),this.els.readyBtn.addEventListener("click",()=>this._toggleReady()),this.els.leaveBtn.addEventListener("click",()=>this._leaveRoom()),this.els.cells.forEach(e=>{e.addEventListener("click",()=>this._handleCellClick(e))}),this.els.gameResultBtn.addEventListener("click",()=>this._backToLobby()),this.els.chatTabLobby&&this.els.chatTabLobby.addEventListener("click",()=>this._switchChatChannel("lobby")),this.els.chatTabPlayers&&this.els.chatTabPlayers.addEventListener("click",()=>this._switchChatChannel("players")),this.els.chatTabSpectators&&this.els.chatTabSpectators.addEventListener("click",()=>this._switchChatChannel("spectators")),this.els.chatToggle&&this.els.chatToggle.addEventListener("click",()=>this._toggleChat()),this.els.chatForm&&this.els.chatForm.addEventListener("submit",e=>{e.preventDefault(),this._sendChatMessage()}),this.els.chatSend&&this.els.chatSend.addEventListener("click",()=>this._sendChatMessage()),this.els.chatInput&&this.els.chatInput.addEventListener("keypress",e=>{e.key==="Enter"&&this._sendChatMessage()}),this.els.enterRoomBtn&&this.els.enterRoomBtn.addEventListener("click",()=>this._handleEnterRoomClick()),this.els.joinAsSpectatorCheckbox&&this.els.joinAsSpectatorCheckbox.addEventListener("change",e=>{this.wantsToSpectate=e.target.checked,this._updateEnterRoomButton()}),this.els.requestToPlayBtn&&this.els.requestToPlayBtn.addEventListener("click",()=>this._requestToPlay()),this.els.leaveBtn&&this.els.leaveBtn.addEventListener("click",()=>this._leaveRoom())}_connect(){this.wsUrl&&(this._updateConnectionStatus("connecting"),this.ws=new WebSocket(this.wsUrl),this.ws.onopen=()=>{console.log("[TicTacToe] WebSocket connected"),this._updateConnectionStatus("connected"),this._authenticate()},this.ws.onmessage=e=>{try{const t=JSON.parse(e.data);this._handleMessage(t)}catch(t){console.error("[TicTacToe] Failed to parse message:",t)}},this.ws.onclose=()=>{console.log("[TicTacToe] WebSocket closed"),this._updateConnectionStatus("disconnected"),setTimeout(()=>this._connect(),3e3)},this.ws.onerror=e=>{console.error("[TicTacToe] WebSocket error:",e)})}_disconnect(){this.ws&&(this.ws.close(),this.ws=null),this._stopTimer()}_bindWindowEvents(){this.windowEventsBound||(this._handlePageHide=()=>this._notifyDisconnectIntent(),this._handleBeforeUnload=()=>this._notifyDisconnectIntent(),this._handleOffline=()=>{this._notifyDisconnectIntent(),this.ws?.close()},window.addEventListener("pagehide",this._handlePageHide),window.addEventListener("beforeunload",this._handleBeforeUnload),window.addEventListener("offline",this._handleOffline),this.windowEventsBound=!0)}_unbindWindowEvents(){this.windowEventsBound&&(this._handlePageHide&&window.removeEventListener("pagehide",this._handlePageHide),this._handleBeforeUnload&&window.removeEventListener("beforeunload",this._handleBeforeUnload),this._handleOffline&&window.removeEventListener("offline",this._handleOffline),this._handlePageHide=null,this._handleBeforeUnload=null,this._handleOffline=null,this.windowEventsBound=!1)}_notifyDisconnectIntent(){this.hasSentDisconnectIntent||this.roomId&&this.mode!=="lobby"&&(this.isSpectator||(this.hasSentDisconnectIntent=!0,this._send({type:"games.command.leave_room",room_id:this.roomId})))}_send(e){this.ws&&this.ws.readyState===WebSocket.OPEN&&this.ws.send(JSON.stringify(e))}_authenticate(){this._send({type:"system.authenticate",user_id:this.userId,username:this.username,avatar_id:this.avatarId||null})}_updateConnectionStatus(e){this.wsConnected=e==="connected",this.els.connectionDot&&(this.els.connectionDot.className="connection-dot",e==="connected"?this.els.connectionDot.classList.add("connection-dot--connected"):e==="connecting"&&this.els.connectionDot.classList.add("connection-dot--connecting")),this.els.connectionText&&(e==="connected"?this.els.connectionText.textContent="Connected":e==="connecting"?this.els.connectionText.textContent="Connecting...":this.els.connectionText.textContent="Disconnected")}_updateGameStatus(e){if(this.els.gameStatus)switch(this.els.gameStatus.className="game-status",e){case"waiting":this.els.gameStatus.classList.add("game-status--waiting"),this.els.gameStatus.textContent="Waiting";break;case"playing":this.els.gameStatus.classList.add("game-status--playing"),this.els.gameStatus.textContent="Playing";break;case"finished":this.els.gameStatus.classList.add("game-status--finished"),this.els.gameStatus.textContent="Finished";break;default:this.els.gameStatus.classList.add("game-status--waiting"),this.els.gameStatus.textContent="Waiting"}}_updateHeaderTitle(e){this.els.headerTitle&&(this.els.headerTitle.textContent=e||"Tic Tac Toe")}_handleMessage(e){switch(console.log("[TicTacToe] Message:",e.type,e),e.type){case"system.authenticated":this._onAuthenticated(e);break;case"games.event.room_list":this._onRoomList(e);break;case"games.event.tic_tac_toe.room_created":this._onRoomCreated(e);break;case"games.event.tic_tac_toe.room_removed":this._onRoomRemoved(e);break;case"games.event.tic_tac_toe.room_state":this._onRoomState(e);break;case"games.event.tic_tac_toe.player_selected":case"games.event.tic_tac_toe.lobby_joined":case"games.event.tic_tac_toe.player_ready_changed":case"games.event.tic_tac_toe.selected_players_updated":this._onWaitingRoomUpdate(e);break;case"games.event.tic_tac_toe.game_started":this._onGameStarted(e);break;case"games.event.tic_tac_toe.turn_changed":this._onTurnChanged(e);break;case"games.event.tic_tac_toe.moved":this._onMoveMade(e);break;case"games.event.tic_tac_toe.game_result":this._onGameResult(e);break;case"games.event.tic_tac_toe.match_ended":this._onMatchEnded(e);break;case"games.event.tic_tac_toe.state":this._onStateSync(e);break;case"games.event.tic_tac_toe.turn_timeout":this._onTurnTimeout(e);break;case"games.event.tic_tac_toe.game_paused":this._onGamePaused(e);break;case"games.event.tic_tac_toe.game_resumed":this._onGameResumed(e);break;case"games.event.tic_tac_toe.chat_message":this._handleChatMessage(e);break;case"games.event.tic_tac_toe.chat_history":this._handleChatHistory(e);break;case"games.event.tic_tac_toe.player_left":this._onPlayerLeft(e);break;case"games.event.tic_tac_toe.lobby_updated":this._onLobbyUpdated(e);break;case"games.event.tic_tac_toe.player_kicked":this._onPlayerKicked(e);break;case"games.event.tic_tac_toe.player_banned":this._onPlayerBanned(e);break;case"games.event.tic_tac_toe.player_unbanned":this._onPlayerUnbanned(e);break;case"games.event.tic_tac_toe.not_in_room":this._onNotInRoom(e);break;case"games.event.tic_tac_toe.spectator_joined":this._onSpectatorJoined(e);break;case"games.event.tic_tac_toe.spectator_left":this._onSpectatorLeft(e);break;case"games.event.tic_tac_toe.request_to_play_accepted":this._onRequestToPlayAccepted(e);break;case"system.error":this._onError(e);break}}_onAuthenticated(e){console.log("[TicTacToe] Authenticated as",e.username),this.mode==="lobby"?(this._showLobby(),this._listRooms()):this.roomId&&this._send({type:"games.command.rejoin_room",room_id:this.roomId})}_listRooms(){this._send({type:"games.command.list_rooms",game_type:"tic_tac_toe"})}_onRoomList(e){console.log("[TicTacToe] Rooms list received:",e.rooms),this.rooms=e.rooms||[],this._renderRooms()}_escapeHtml(e){return e?String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"):""}_formatStatus(e){return e==="waiting"?"Waiting":e==="in_progress"?"In Progress":e}_renderRooms(){const e=this.rooms.filter(t=>!(t.game_type!=="tic_tac_toe"||this.roomId&&t.room_id===this.roomId));if(this.els.loadingState.classList.add("hidden"),e.length===0){this.els.roomsGrid.classList.add("hidden"),this.els.emptyState.classList.remove("hidden");return}this.els.emptyState.classList.add("hidden"),this.els.roomsGrid.classList.remove("hidden"),this.els.roomsGrid.innerHTML=e.map(t=>{const o=t.players?.length||0,s=t.player_count||t.max_players||2,a=t.spectator_count||0,i=t.allow_spectators===!0,n=o>=s,l=t.can_rejoin===!0;return`
            <div class="room-card" data-room-id="${t.room_id}">
                <div class="room-card__header">
                    <span class="room-card__name">
                        ${this._escapeHtml(t.room_name)}
                        ${t.is_password_protected?`
                            <span class="room-card__lock" title="Password protected">
                                <svg class="room-card__lock-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </span>
                        `:""}
                    </span>
                    <span class="room-card__status room-card__status--${t.status}">${this._formatStatus(t.status)}</span>
                </div>
                <div class="room-card__info">
                    <span class="room-card__info-item" title="Players">
                        <svg class="room-card__info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        ${o}/${s}
                    </span>
                    ${i?`
                        <span class="room-card__info-item" title="Spectators">
                            <svg class="room-card__info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                            ${a}
                        </span>
                    `:`
                        <span class="room-card__no-spectators" title="Spectators not allowed">No spectators</span>
                    `}
                </div>
                <div class="room-card__players">
                    ${(t.players||[]).map(r=>`
                        <span class="player-badge ${r.is_ready?"player-badge--ready":""}">${this._escapeHtml(r.username||r.name)}</span>
                    `).join("")}
                    ${o<s?'<span class="player-badge">Waiting...</span>':""}
                </div>
                <div class="room-card__actions">
                    ${l?`
                        <button class="join-btn" data-action="rejoin" data-room-id="${t.room_id}" data-room-name="${this._escapeHtml(t.room_name)}" data-protected="${t.is_password_protected||!1}">Rejoin</button>
                    `:""}
                    ${!l&&t.status==="waiting"&&!n?`
                        <button class="join-btn" data-action="join" data-room-id="${t.room_id}" data-room-name="${this._escapeHtml(t.room_name)}" data-protected="${t.is_password_protected||!1}">Join Game</button>
                    `:""}
                    ${!l&&i?`
                        <button class="spectate-btn" data-action="spectate" data-room-id="${t.room_id}">
                            ${t.status==="waiting"?"Spectate":"Watch"}
                        </button>
                    `:""}
                </div>
            </div>
        `}).join(""),this.els.roomsGrid.querySelectorAll("[data-action]").forEach(t=>{t.addEventListener("click",o=>{o.stopPropagation();const s=o.target.dataset.roomId;o.target.dataset.roomName;const a=o.target.dataset.action;o.target.dataset.protected,a==="rejoin"?this._rejoinRoom(s):a==="join"?this._showNotInRoomView(s):a==="spectate"&&this._spectateRoom(s)})})}_rejoinRoom(e){this._send({type:"games.command.rejoin_room",room_id:e})}_joinRoomByName(e){if(this.roomName===e&&this.roomId){console.log("[TicTacToe] Already in this room, requesting room state instead"),this._send({type:"games.command.get_room_state",room_name:e});return}this._pendingJoinData={roomName:e,password:null},this._showJoinConfirmModal()}_spectateRoom(e){this._send({type:"games.command.spectate",room_id:e})}_showLobby(){this.mode="lobby",this.els.lobbySection.classList.add("active"),this.els.gameSection.classList.remove("active"),this._hideAllGameSubViews(),this._updateHeaderTitle("Tic Tac Toe"),this._updateGameStatus("waiting"),this.roomId=null,this.roomName=null,this.isHost=!1,this.isAdmin=!1,this.hostId=null,this.lobby=[],this.players=[],this.spectators=[],this.bannedPlayers=[],this.notInRoomInfo=null,this.wantsToSpectate=!1}_showWaitingRoom(){this.mode="room",this.els.lobbySection.classList.remove("active"),this.els.gameSection.classList.add("active"),this._hideAllGameSubViews()}_showGame(){this.mode="game",this.els.lobbySection.classList.remove("active"),this.els.gameSection.classList.add("active"),this._hideAllGameSubViews(),this.els.gameBoard.classList.remove("hidden")}_hideAllGameSubViews(){this.els.waitingForAdmin&&this.els.waitingForAdmin.classList.add("hidden"),this.els.adminLobby&&this.els.adminLobby.classList.add("hidden"),this.els.waitingState&&this.els.waitingState.classList.add("hidden"),this.els.notInRoomState&&this.els.notInRoomState.classList.add("hidden"),this.els.gameBoard&&this.els.gameBoard.classList.add("hidden")}_showCreateRoomModal(){this.els.createRoomModal.classList.add("active"),this.els.roomNameInput.value="",this.els.roomPasswordInput.value="",this.els.allowSpectatorsInput.checked=!0,this.els.roomNameInput.focus()}_hideCreateRoomModal(){this.els.createRoomModal.classList.remove("active")}_createRoom(){const e=this.els.roomNameInput.value.trim();if(!e){this.els.roomNameInput.focus();return}this._pendingRoomData={roomName:e,password:this.els.roomPasswordInput.value||null,allowSpectators:this.els.allowSpectatorsInput.checked},this._hideCreateRoomModal(),this._showCreateConfirmModal()}async _showCreateConfirmModal(){console.log("[TicTacToe] showCreateConfirmModal called"),this.els.createConfirmModal.classList.add("active"),this.els.createConfirmLoader.classList.remove("hidden"),this.els.createConfirmMessage.classList.add("hidden"),this.els.createConfirmBtn.classList.add("hidden");try{const e=await fetch("/api/v1/user",{method:"GET",credentials:"include",headers:{"Content-Type":"application/json"}});if(!e.ok)throw new Error("Failed to fetch user data");const o=(await e.json()).user?.balance??0,s=o>=1e3;console.log("[TicTacToe] User balance:",o,"Has enough:",s),this.els.createConfirmLoader.classList.add("hidden"),s?(this.els.createConfirmMessage.textContent="Creating this game will cost 1000 coins. Are you sure you want to proceed?",this.els.createConfirmMessage.classList.remove("confirm-message--error"),this.els.createConfirmBtn.classList.remove("hidden")):(this.els.createConfirmMessage.textContent="You do not have enough balance to create a game. You need at least 1000 coins.",this.els.createConfirmMessage.classList.add("confirm-message--error"),this.els.createConfirmBtn.classList.add("hidden")),this.els.createConfirmMessage.classList.remove("hidden")}catch(e){console.error("[TicTacToe] Error fetching balance:",e),this.els.createConfirmLoader.classList.add("hidden"),this.els.createConfirmMessage.textContent="Failed to check balance. Please try again.",this.els.createConfirmMessage.classList.add("confirm-message--error"),this.els.createConfirmMessage.classList.remove("hidden"),this.els.createConfirmBtn.classList.add("hidden")}}_hideCreateConfirmModal(){console.log("[TicTacToe] hideCreateConfirmModal called"),this.els.createConfirmModal.classList.remove("active")}_executeCreateRoom(){if(!this._pendingRoomData)return;const{roomName:e,password:t,allowSpectators:o}=this._pendingRoomData;this._send({type:"games.command.create_room",game_type:"tic_tac_toe",room_name:e,password:t,max_players:2,allow_spectators:o}),this._pendingRoomData=null}_onRoomCreated(e){if(console.log("[TicTacToe] Room created:",e),e.game_type&&e.game_type!=="tic_tac_toe"){console.log("[TicTacToe] Ignoring room_created for different game:",e.game_type);return}const t=String(e.host_id),o=String(this.userId);if(t===o)console.log("[TicTacToe] We are the host, entering room"),this.roomId=e.room_id,this.roomName=e.room_name,this.isHost=!0,this.isAdmin=!0,this.hostId=e.host_id,this.allowSpectators=e.allow_spectators===!0,this.maxPlayers=e.player_count||e.max_players||2,this.lobby=[{user_id:this.userId,username:this.username,is_ready:!1}],this.players=[],this.spectators=[],this.bannedPlayers=[],this._updateHeaderTitle(e.room_name||`Room ${e.room_id}`),this._updateGameStatus("waiting"),this._showWaitingRoom(),this._updateGameUI();else{console.log("[TicTacToe] Not the host, adding room to lobby list");const s={room_id:e.room_id,room_name:e.room_name,game_type:e.game_type||"tic_tac_toe",host_name:e.host_name||e.host_username||"Unknown",status:"waiting",players:[{user_id:e.host_id,username:e.host_username}],player_count:e.player_count||2,max_players:e.player_count||e.max_players||2,spectator_count:0,allow_spectators:e.allow_spectators===!0,is_password_protected:e.is_password_protected||!1};this.mode==="lobby"&&(this.rooms.some(i=>i.room_id===s.room_id)||(this.rooms.unshift(s),this._renderRooms()))}}_onRoomRemoved(e){console.log("[TicTacToe] Room removed:",e);const t=e.room_id,o=e.reason||"unknown",s=this.rooms.length;this.rooms=this.rooms.filter(a=>a.room_id!==t),this.rooms.length<s&&(console.log(`[TicTacToe] Room ${t} removed from list (reason: ${o})`),this.mode==="lobby"&&this._renderRooms()),this.roomId===t&&this.mode!=="lobby"&&o!=="game_started"&&(this._showToast("Room has been closed","info"),this.mode="lobby",this._showLobby(),this._listRooms())}_showJoinRoomModal(){this.els.joinPasswordModal.classList.add("active"),this.els.joinPasswordInput.value="",this.els.joinPasswordError.classList.add("hidden"),this.els.joinPasswordInput.focus()}_hideJoinRoomModal(){this.els.joinPasswordModal.classList.remove("active"),this.roomToJoin=null}_confirmJoinRoom(){const e=this.els.joinPasswordInput.value;this._pendingJoinData={roomName:this.roomToJoin.roomName,password:e},this._hideJoinRoomModal(),this._showJoinConfirmModal()}async _showJoinConfirmModal(){console.log("[TicTacToe] showJoinConfirmModal called"),this.els.joinConfirmModal.classList.add("active"),this.els.joinConfirmLoader.classList.remove("hidden"),this.els.joinConfirmMessage.classList.add("hidden"),this.els.joinConfirmBtn.classList.add("hidden");try{const e=await fetch("/api/v1/user",{method:"GET",credentials:"include",headers:{"Content-Type":"application/json"}});if(!e.ok)throw new Error("Failed to fetch user data");const o=(await e.json()).user?.balance??0,s=o>=1e3;console.log("[TicTacToe] User balance:",o,"Has enough:",s),this.els.joinConfirmLoader.classList.add("hidden"),s?(this.els.joinConfirmMessage.textContent="Joining this game will cost 1000 coins. Are you sure you want to proceed?",this.els.joinConfirmMessage.classList.remove("confirm-message--error"),this.els.joinConfirmBtn.classList.remove("hidden")):(this.els.joinConfirmMessage.textContent="You do not have enough balance to join this game. You need at least 1000 coins.",this.els.joinConfirmMessage.classList.add("confirm-message--error"),this.els.joinConfirmBtn.classList.add("hidden")),this.els.joinConfirmMessage.classList.remove("hidden")}catch(e){console.error("[TicTacToe] Error fetching balance:",e),this.els.joinConfirmLoader.classList.add("hidden"),this.els.joinConfirmMessage.textContent="Failed to check balance. Please try again.",this.els.joinConfirmMessage.classList.add("confirm-message--error"),this.els.joinConfirmMessage.classList.remove("hidden"),this.els.joinConfirmBtn.classList.add("hidden")}}_hideJoinConfirmModal(){console.log("[TicTacToe] hideJoinConfirmModal called"),this.els.joinConfirmModal.classList.remove("active")}_executeJoinRoom(){if(!this._pendingJoinData)return;const{roomName:e,password:t,isPasswordProtected:o,asSpectator:s}=this._pendingJoinData;if(this.roomName===e&&this.roomId){console.log("[TicTacToe] Already in this room, requesting room state instead"),this._send({type:"games.command.get_room_state",room_name:e}),this._pendingJoinData=null;return}if(o&&!t){this.roomToJoin={roomId:null,roomName:e},this._showJoinRoomModal();return}s?this._send({type:"games.command.join_as_spectator",room_name:e,password:t}):this._send({type:"games.command.join_room",room_name:e,password:t}),this._pendingJoinData=null}_joinRoom(e,t=null){if(this.roomName===e&&this.roomId){console.log("[TicTacToe] Already in this room, requesting room state instead"),this._send({type:"games.command.get_room_state",room_name:e});return}this._send({type:"games.command.join_room",room_name:e,password:t})}_onRoomState(e){const t=e.room;console.log("[TicTacToe] Room state received:",t),this.hasSentDisconnectIntent=!1,this.notInRoomInfo=null,this.els.notInRoomState&&this.els.notInRoomState.classList.add("hidden"),this.els.chatPanel&&this.els.chatPanel.classList.remove("hidden"),this.roomId=t.room_id,this.roomName=t.room_name,this.hostId=t.host_id,this.isHost=t.host_id==this.userId,this.isAdmin=this.isHost,this.maxPlayers=t.player_count||t.max_players||2,this.allowSpectators=t.allow_spectators===!0,this.lobby=t.lobby||[],this.players=t.players||[],this.selectedPlayers=t.selected_players||[],t.banned_users&&Array.isArray(t.banned_users)?this.bannedPlayers=t.banned_users.map(i=>typeof i=="object"&&i!==null?{user_id:i.user_id,username:i.username||`User #${i.user_id}`}:{user_id:i,username:`User #${i}`}):this.bannedPlayers=[],this.spectators=t.spectators_data||t.spectators||[];const o=String(this.userId),s=this.players.some(i=>String(i.id||i.user_id)===o),a=this.lobby.some(i=>String(i.user_id)===o);this.isPlayer=s||a,this.isSpectator=this.spectators.some(i=>typeof i=="object"&&i!==null?String(i.user_id||i.id)===o:String(i)===o),console.log("[TicTacToe] Role check:",{userId:this.userId,isAdmin:this.isAdmin,isPlayer:this.isPlayer,isSpectator:this.isSpectator,lobbyCount:this.lobby.length,playersCount:this.players.length,spectatorsCount:this.spectators.length}),this._updateChatTabAccess(),this._updateSpectatorUI(),!this.chatHistoryRequested.lobby&&this.chatMessages.lobby.length===0&&(this.chatHistoryRequested.lobby=!0,this._requestChatHistory("lobby")),this._updateHeaderTitle(t.room_name||`Room ${t.room_id}`),t.status==="waiting"?(this._updateGameStatus("waiting"),this._showWaitingRoom(),this._updateGameUI()):t.status==="in_progress"&&(this._updateGameStatus("playing"),this._showGame())}_onWaitingRoomUpdate(e){if(e.type==="games.event.tic_tac_toe.lobby_joined"){const t=e.player||{user_id:e.user_id,username:e.username,avatar_id:e.avatar_id,score:0,is_ready:!1};this.lobby.findIndex(s=>String(s.user_id)===String(t.user_id))===-1&&(this.lobby.push(t),console.log("[TicTacToe] Player joined lobby:",t.username))}else if(e.type==="games.event.tic_tac_toe.player_ready_changed"){const t=this.lobby.find(o=>o.user_id==e.user_id);t&&(t.is_ready=e.is_ready)}else if(e.type==="games.event.tic_tac_toe.player_selected"){const t=e.player||{user_id:e.user_id,username:e.username,avatar_id:e.avatar_id,score:0,is_ready:!1},o=String(t.user_id);console.log("[TicTacToe] Player selected:",t.username,o);const s=this.lobby.findIndex(i=>String(i.user_id)===o);s!==-1&&this.lobby.splice(s,1),this.selectedPlayers.some(i=>String(i.user_id)===o)||(this.selectedPlayers.push(t),console.log("[TicTacToe] Selected players count:",this.selectedPlayers.length)),this.selectedPlayers.length>=this.maxPlayers&&console.log("[TicTacToe] All players selected, waiting for game to start")}else e.type==="games.event.tic_tac_toe.selected_players_updated"&&e.selected_players&&(this.selectedPlayers=e.selected_players,console.log("[TicTacToe] Selected players updated:",this.selectedPlayers.length));this._updateGameUI()}_updateGameUI(){this.isAdmin?(this._renderAdminLobby(),this.els.adminLobby&&this.els.adminLobby.classList.remove("hidden"),this.els.waitingForAdmin&&this.els.waitingForAdmin.classList.add("hidden")):(this._renderWaitingPlayersList(),this.els.waitingForAdmin&&this.els.waitingForAdmin.classList.remove("hidden"),this.els.adminLobby&&this.els.adminLobby.classList.add("hidden"));const e=this.lobby.find(t=>t.user_id==this.userId);this.isReady=e?.is_ready||!1,this.els.readyBtn&&(this.els.readyBtn.textContent=this.isReady?"Not Ready":"Ready")}_renderAdminLobby(){const e=this.els.lobbyPlayersList,t=this.els.lobbyCount;e&&(t&&(t.textContent=`${this.lobby.length} waiting`),this.lobby.length===0?e.innerHTML=`
                <div class="lobby-empty">
                    <div class="lobby-empty__icon">👥</div>
                    <p>No players waiting. Share the room link to invite players!</p>
                </div>
            `:(e.innerHTML=this.lobby.map(o=>{const s=String(o.user_id)===String(this.userId),a=String(o.user_id)===String(this.hostId),i=this.spectators.some(u=>String(u.user_id||u)===String(o.user_id)),n=o.is_ready,l=(o.username||"U").charAt(0).toUpperCase();let r="",d="lobby-player__avatar";a?(r="lobby-player--admin",d+=" lobby-player__avatar--admin"):i?(r="lobby-player--spectator",d+=" lobby-player__avatar--spectator"):n&&(r="lobby-player--ready");let c="";a&&(c+='<span class="admin-badge">👑 Admin</span> '),n?c+='<span class="ready-badge">✓ Ready</span>':c+='<span class="waiting-badge">Waiting...</span>',i&&(c+=' <span class="spectator-badge">👁 Spectator</span>');let m="";a?m="Room host - select players to start":n?m="Player is ready to start":m="Waiting for admin selection";let h="";return s&&a?h=`
                        <button class="select-btn" data-action="select" data-user-id="${o.user_id}">Select Myself</button>
                        ${this.allowSpectators?`<button class="kick-btn" data-action="become-spectator" data-user-id="${o.user_id}">Become Spectator</button>`:""}
                    `:s||(h=`
                        <button class="select-btn" data-action="select" data-user-id="${o.user_id}">Select</button>
                        <button class="kick-btn" data-action="kick" data-user-id="${o.user_id}">Kick</button>
                        <button class="ban-btn" data-action="ban" data-user-id="${o.user_id}">Ban</button>
                    `),`
                    <div class="lobby-player ${r}" data-user-id="${o.user_id}">
                        <div class="lobby-player__info">
                            <div class="${d}">${l}</div>
                            <div>
                                <div class="lobby-player__name">
                                    ${this._escapeHtml(o.username)}${s?" (you)":""}
                                    ${c}
                                </div>
                                <div class="lobby-player__joined">${m}</div>
                            </div>
                        </div>
                        <div class="lobby-player__actions">
                            ${h}
                        </div>
                    </div>
                `}).join(""),this._bindAdminLobbyActions()),this._renderBannedPlayersList())}_renderWaitingPlayersList(){const e=this.els.waitingPlayersList;e&&(e.innerHTML=this.lobby.map(t=>{const o=String(t.user_id)===String(this.userId),s=String(t.user_id)===String(this.hostId);let a="",i="";return s?(a="waiting-player--admin",i='<span class="waiting-player__status">Admin</span>'):t.is_ready?(a="waiting-player--ready",i='<span class="waiting-player__status waiting-player__status--ready">Ready</span>'):i='<span class="waiting-player__status waiting-player__status--waiting">Waiting</span>',`
                <div class="waiting-player ${a}">
                    <span class="waiting-player__name">${this._escapeHtml(t.username)}${o?" (you)":""}</span>
                    ${i}
                </div>
            `}).join(""))}_renderBannedPlayersList(){const e=this.els.bannedPlayersSection,t=this.els.bannedPlayersList,o=this.els.bannedCount;if(!(!e||!t)){if(this.bannedPlayers.length===0){e.classList.add("hidden");return}e.classList.remove("hidden"),o&&(o.textContent=`${this.bannedPlayers.length} banned`),t.innerHTML=this.bannedPlayers.map(s=>{const a=(s.username||"U").charAt(0).toUpperCase();return`
                <div class="banned-player" data-user-id="${s.user_id}">
                    <div class="banned-player__info">
                        <div class="banned-player__avatar">${a}</div>
                        <span class="banned-player__name">${this._escapeHtml(s.username)}</span>
                    </div>
                    <button class="unban-btn" data-user-id="${s.user_id}">Unban</button>
                </div>
            `}).join(""),t.querySelectorAll(".unban-btn").forEach(s=>{s.addEventListener("click",a=>{const i=parseInt(a.target.dataset.userId,10);this._unbanPlayer(i)})})}}_bindAdminLobbyActions(){const e=this.els.lobbyPlayersList;e&&e.querySelectorAll("button[data-action]").forEach(t=>{t.addEventListener("click",o=>{const s=o.target.dataset.action,a=parseInt(o.target.dataset.userId,10);s==="select"?this._selectPlayer(a):s==="kick"?this._kickPlayer(a):s==="ban"?this._banPlayer(a):s==="become-spectator"&&this._becomeSpectator()})})}_selectPlayer(e){console.log("[TicTacToe] Selecting player:",e),this._send({type:"games.command.select_player",room_id:this.roomId,target_user_id:String(e)})}_kickPlayer(e){this.isAdmin&&(console.log("[TicTacToe] Kicking player:",e),this._send({type:"games.command.kick_player",room_id:this.roomId,target_user_id:String(e)}))}_banPlayer(e){this.isAdmin&&(console.log("[TicTacToe] Banning player:",e),this._send({type:"games.command.ban_player",room_id:this.roomId,target_user_id:String(e)}))}_unbanPlayer(e){this.isAdmin&&(console.log("[TicTacToe] Unbanning player:",e),this._send({type:"games.command.unban_player",room_id:this.roomId,target_user_id:String(e)}))}_becomeSpectator(){console.log("[TicTacToe] Admin becoming spectator"),this._send({type:"games.command.become_spectator",room_id:this.roomId})}_onLobbyUpdated(e){console.log("[TicTacToe] Lobby updated:",e),this.lobby=e.lobby||[],this._updateGameUI()}_onPlayerKicked(e){console.log("[TicTacToe] Player kicked:",e);const t=String(e.player_id||e.user_id),o=e.player_name||e.username||"Player";if(this.lobby=this.lobby.filter(s=>String(s.user_id)!==t),t===String(this.userId)){this._showKickedMessage();return}this._updateGameUI(),this._addSystemMessage(`${o} was kicked from the room`)}_showKickedMessage(){if(this.roomName,this.roomId=null,this.roomName=null,this.isHost=!1,this.isAdmin=!1,this.hostId=null,this.lobby=[],this.players=[],this.els.waitingState&&this.els.waitingState.classList.add("hidden"),this.els.adminLobby&&this.els.adminLobby.classList.add("hidden"),this.els.gameBoard&&this.els.gameBoard.classList.add("hidden"),this.els.notInRoomState&&this.els.notInRoomState.classList.add("hidden"),this.els.waitingForAdmin){const e=this.els.waitingForAdmin.querySelector(".waiting-for-admin__icon"),t=this.els.waitingForAdmin.querySelector(".waiting-for-admin__title"),o=this.els.waitingForAdmin.querySelector(".waiting-for-admin__text");e&&(e.textContent="🚫"),t&&(t.textContent="You have been kicked"),o&&(o.textContent="The host has kicked you from the lobby."),this.els.waitingForAdmin.classList.remove("hidden")}setTimeout(()=>{this.mode="lobby",this._showLobby(),this._listRooms()},3e3)}_onPlayerBanned(e){console.log("[TicTacToe] Player banned:",e);const t=String(e.player_id||e.user_id),o=e.player_name||e.username||"Player";if(this.lobby=this.lobby.filter(s=>String(s.user_id)!==t),this.bannedPlayers.push({user_id:t,username:o}),t===String(this.userId)){this._showBannedMessage();return}this._updateGameUI(),this._addSystemMessage(`${o} was banned from the room`)}_showBannedMessage(){if(this.roomId=null,this.roomName=null,this.isHost=!1,this.isAdmin=!1,this.hostId=null,this.lobby=[],this.players=[],this.els.waitingState&&this.els.waitingState.classList.add("hidden"),this.els.adminLobby&&this.els.adminLobby.classList.add("hidden"),this.els.gameBoard&&this.els.gameBoard.classList.add("hidden"),this.els.notInRoomState&&this.els.notInRoomState.classList.add("hidden"),this.els.waitingForAdmin){const e=this.els.waitingForAdmin.querySelector(".waiting-for-admin__icon"),t=this.els.waitingForAdmin.querySelector(".waiting-for-admin__title"),o=this.els.waitingForAdmin.querySelector(".waiting-for-admin__text");e&&(e.textContent="🚫"),t&&(t.textContent="You have been banned"),o&&(o.textContent="The host has banned you from this room. You cannot rejoin."),this.els.waitingForAdmin.classList.remove("hidden")}setTimeout(()=>{this.mode="lobby",this._showLobby(),this._listRooms()},3e3)}_onPlayerUnbanned(e){console.log("[TicTacToe] Player unbanned:",e);const t=String(e.player_id||e.user_id),o=e.player_name||e.username||"Player";this.bannedPlayers=this.bannedPlayers.filter(s=>String(s.user_id)!==t),this._updateGameUI(),this._addSystemMessage(`${o} was unbanned`)}_showNotInRoomView(e){const t=this.rooms.find(o=>o.room_id===e);if(!t){console.error("[TicTacToe] Room not found:",e),this._showToast("Room not found","error");return}console.log("[TicTacToe] Showing not-in-room view for room:",t.room_name),this._onNotInRoom({room_id:t.room_id,room_name:t.room_name,is_password_protected:t.is_password_protected||!1,status:t.status||"waiting",allow_spectators:t.allow_spectators===!0,is_banned:!1,is_full:!1,message:'Click "Enter Room" to join this game.'})}_onNotInRoom(e){if(console.log("[TicTacToe] Not in room:",e),this.notInRoomInfo={room_id:e.room_id,room_name:e.room_name,is_password_protected:e.is_password_protected||!1,status:e.status,allow_spectators:e.allow_spectators===!0,is_banned:e.is_banned||!1,is_full:e.is_full||!1},this._updateHeaderTitle(e.room_name||"Tic Tac Toe"),this._updateGameStatus(e.status||"waiting"),this.mode="not_in_room",this.els.lobbySection.classList.remove("active"),this.els.gameSection.classList.add("active"),this._hideAllGameSubViews(),this.els.chatPanel&&this.els.chatPanel.classList.add("hidden"),this.els.notInRoomState){this.els.notInRoomState.classList.remove("hidden");const t=this.els.notInRoomState.querySelector(".not-in-room__title"),o=this.els.notInRoomState.querySelector(".not-in-room__text"),s=this.els.notInRoomHint,a=this.els.spectatorOptionContainer;t&&(t.textContent="You are not in this room"),o&&(o.textContent=e.message||"This room already has players."),a&&(this.notInRoomInfo.allow_spectators?(a.classList.remove("hidden"),this.els.joinAsSpectatorCheckbox&&(this.els.joinAsSpectatorCheckbox.checked=this.wantsToSpectate||!1)):(a.classList.add("hidden"),this.wantsToSpectate=!1)),s&&(this.notInRoomInfo.is_banned?s.textContent="You have been banned from this room.":s.textContent=""),this._updateEnterRoomButton()}}_handleEnterRoomClick(){if(this.notInRoomInfo){if(this.wantsToSpectate){this.notInRoomInfo.is_password_protected?(this.roomToJoin={roomId:this.notInRoomInfo.room_id,roomName:this.notInRoomInfo.room_name},this._pendingJoinData={roomName:this.notInRoomInfo.room_name,asSpectator:!0},this._showJoinRoomModal()):this._send({type:"games.command.join_as_spectator",room_name:this.notInRoomInfo.room_name});return}this._pendingJoinData={roomName:this.notInRoomInfo.room_name,password:null,isPasswordProtected:this.notInRoomInfo.is_password_protected},this._showJoinConfirmModal()}}_updateEnterRoomButton(){!this.els.enterRoomBtnText||!this.notInRoomInfo||(this.wantsToSpectate?this.notInRoomInfo.is_password_protected?(this.els.enterRoomBtnText.textContent="Watch as Spectator (Password Required)",this.els.notInRoomHint&&(this.els.notInRoomHint.textContent="This room is password protected. You will join as a spectator.")):(this.els.enterRoomBtnText.textContent="Watch as Spectator",this.els.notInRoomHint&&(this.els.notInRoomHint.textContent="You will join as a spectator and watch the game.")):this.notInRoomInfo.is_password_protected?(this.els.enterRoomBtnText.textContent="Enter Room (Password Required)",this.els.notInRoomHint&&(this.els.notInRoomHint.textContent="This room is password protected.")):(this.els.enterRoomBtnText.textContent="Enter Room",this.els.notInRoomHint&&(this.els.notInRoomHint.textContent="")))}_toggleReady(){this._send({type:"games.command.ready",room_id:this.roomId}),this.els.readyBtn.disabled=!0}_leaveRoom(){const e=this.roomId,t=this.roomName;this._send({type:"games.command.leave_room",room_id:e}),this.notInRoomInfo=null,this.chatMessages={lobby:[],players:[],spectators:[]},this.chatUnreadCounts={lobby:0,players:0,spectators:0},this.mode="lobby",this._showLobby(),setTimeout(()=>{this._listRooms()},300),this.dispatchEvent(new CustomEvent("game-leave",{detail:{roomId:e,roomName:t}}))}_onGameStarted(e){console.log("[TicTacToe] Game started:",e),this._updateGameStatus("playing"),this._showGame(),this._resetBoard()}_onStateSync(e){console.log("[TicTacToe] State sync:",e),this.board=e.board||Array(9).fill(null),this.playerXId=e.player_x_id,this.playerOId=e.player_o_id,this.currentTurn=e.current_turn,this.gameNumber=e.game_number||1,this.isGamePaused=e.is_paused||!1,e.scores&&(this.scores={},e.scores.forEach(([t,o])=>{this.scores[t]=o})),e.move_deadline&&(this.moveDeadline=new Date(e.move_deadline),this._startTimer()),this._renderBoard(),this._updateMatchInfo(),this._updateTurnIndicator(),this.isGamePaused&&this.els.pausedOverlay.classList.add("active"),this._showGame()}_onTurnChanged(e){this.currentTurn=e.current_turn,this._startTimer(),this._updateTurnIndicator()}_onMoveMade(e){console.log("[TicTacToe] Move made:",e),this.board=e.board||this.board,this.board[e.position]=e.mark,this._renderBoard()}_onGameResult(e){console.log("[TicTacToe] Game result:",e),e.scores&&(this.scores={},e.scores.forEach(([t,o])=>{this.scores[t]=o})),e.winning_line&&(this.winningLine=e.winning_line,this._highlightWinningLine()),this.gameNumber=e.game_number+1,this._updateMatchInfo(),setTimeout(()=>{this.winningLine=null,this._resetBoard(),this._updateMatchInfo()},2e3)}_onMatchEnded(e){console.log("[TicTacToe] Match ended:",e),this._stopTimer();const t=e.winner_id==this.userId;this.els.gameResultTitle.textContent=t?"You Won!":"You Lost",this.els.gameResultTitle.className="game-result__title "+(t?"game-result__title--win":"game-result__title--lose"),this.els.gameResultMessage.textContent=`Final score: ${e.final_scores.map(([o,s,a])=>`${s}: ${a}`).join(" - ")}`,this.els.gameResultPrize.textContent=t?`Prize: ${(e.prize_amount/100).toFixed(0)} coins`:"",this.els.gameResult.classList.add("active")}_onTurnTimeout(e){console.log("[TicTacToe] Turn timeout:",e),e.scores&&(this.scores={},e.scores.forEach(([t,o])=>{this.scores[t]=o})),this._updateMatchInfo(),this._addSystemMessage(`${e.player_username} timed out! ${e.winner_username} wins this game.`),setTimeout(()=>{this._resetBoard()},2e3)}_onGamePaused(e){console.log("[TicTacToe] Game paused:",e),this.isGamePaused=!0,this.els.pausedOverlay.classList.add("active"),this._stopTimer(),this._addSystemMessage(`${e.disconnected_player_username} disconnected. Waiting for reconnection...`)}_onGameResumed(e){console.log("[TicTacToe] Game resumed:",e),this.isGamePaused=!1,this.els.pausedOverlay.classList.remove("active"),this._startTimer(),this._addSystemMessage(`${e.reconnected_player_username} reconnected!`)}_onPlayerLeft(e){console.log("[TicTacToe] Player left:",e);const t=String(e.player_id);if(t===String(this.hostId)){console.log("[TicTacToe] Host left, room is closed"),this._addSystemMessage("Room host has left. The room is now closed."),this._showLobby(),this._listRooms();return}this.players=this.players.filter(o=>String(o.user_id||o.id)!==t),this.lobby=this.lobby.filter(o=>String(o.user_id)!==t),this._updateGameUI(),this._renderWaitingRoom()}_switchChatChannel(e){const t=this.players.some(o=>String(o.user_id||o.id)===String(this.userId))||this.lobby.some(o=>String(o.user_id)===String(this.userId));if(console.log("[Chat] switchChatChannel called:",{channel:e,isPlayer:this.isPlayer,isSpectator:this.isSpectator,amIAPlayer:t,currentChannel:this.chatChannel}),e==="lobby"&&this._isLobbyChatDisabled()){console.log("[Chat] Lobby chat is disabled during game");return}if(e==="players"&&!this.isPlayer&&!this.isSpectator&&!t){console.log("[Chat] Cannot access players channel - not a player or spectator");return}if(e==="spectators"&&(t||!this.isSpectator)){console.log("[Chat] Cannot access spectators channel - players cannot see spectator chat");return}console.log("[Chat] Access granted, setting chatChannel to:",e),this.chatChannel=e,this.els.chatTabLobby&&this.els.chatTabLobby.classList.toggle("active",e==="lobby"),this.els.chatTabPlayers&&this.els.chatTabPlayers.classList.toggle("active",e==="players"),this.els.chatTabSpectators&&this.els.chatTabSpectators.classList.toggle("active",e==="spectators"),this.chatUnreadCounts[e]=0,this._updateChatBadges(),this._renderChatMessages(),this._updateChatInputAccess(),!this.chatHistoryRequested[e]&&this.chatMessages[e].length===0&&this.roomId&&(this.chatHistoryRequested[e]=!0,this._requestChatHistory(e))}_isLobbyChatDisabled(){return this.mode!=="lobby"&&(this.players.length>=this.maxPlayers||this.selectedPlayers.length>=this.maxPlayers)}_updateChatInputAccess(){const e=this.els.chatForm,t=this.els.chatInput,o=this.els.chatSend,s=this.players.some(i=>String(i.user_id||i.id)===String(this.userId)),a=this.isSpectator&&!s&&this.chatChannel==="players";e&&(a?(e.classList.add("chat-input--disabled"),t&&(t.disabled=!0,t.placeholder="Spectators cannot send messages in players chat"),o&&(o.disabled=!0)):(e.classList.remove("chat-input--disabled"),t&&(t.disabled=!1,t.placeholder="Type a message..."),o&&(o.disabled=!1)))}_toggleChat(){this.isChatCollapsed=!this.isChatCollapsed,this.els.chatPanel&&this.els.chatPanel.classList.toggle("collapsed",this.isChatCollapsed)}_sendChatMessage(){const e=this.els.chatInput?.value.trim();!e||!this.roomId||(this._send({type:"games.command.send_chat",room_id:this.roomId,channel:this.chatChannel,content:e,avatar_id:this.avatarId||null}),this.els.chatInput&&(this.els.chatInput.value=""))}_requestChatHistory(e){this.roomId&&this._send({type:"games.command.get_chat_history",room_id:this.roomId,channel:e,limit:50})}_handleChatMessage(e){console.log("[Chat] handleChatMessage received:",{channel:e.channel,username:e.username,content:e.content?.substring(0,50)});const t={id:e.message_id||Date.now(),userId:e.user_id,username:e.username||"Unknown",avatarId:e.avatar_id,content:e.content,isSystem:e.is_system||!1,timestamp:e.created_at?new Date(e.created_at):new Date},o=e.channel||"lobby";this.chatMessages[o]||(this.chatMessages[o]=[]),this.chatMessages[o].push(t),this.chatMessages[o].length>100&&(this.chatMessages[o]=this.chatMessages[o].slice(-100)),o===this.chatChannel?this._renderChatMessages():(this.chatUnreadCounts[o]++,this._updateChatBadges())}_handleChatHistory(e){const t=e.channel||"lobby",o=e.messages||[];console.log("[Chat] handleChatHistory received for channel:",t,"messages count:",o.length);const s=o.map(r=>({id:r.message_id||r._id||Date.now(),userId:r.user_id,username:r.username||"Unknown",avatarId:r.avatar_id,content:r.content,isSystem:r.is_system||!1,timestamp:r.created_at?new Date(r.created_at):new Date})),a=this.chatMessages[t]||[],i=new Set(a.map(r=>String(r.id))),l=[...s.filter(r=>!i.has(String(r.id))),...a];l.sort((r,d)=>r.timestamp-d.timestamp),this.chatMessages[t]=l.slice(-100),t===this.chatChannel&&this._renderChatMessages()}_renderChatMessages(){const e=this.els.chatMessages;if(!e)return;const t=this.chatMessages[this.chatChannel]||[];if(t.length===0){e.innerHTML='<div class="chat-empty">No messages yet. Say hello!</div>';return}e.innerHTML=t.map(o=>{const s=this.mutedUsers.has(String(o.userId));if(o.isSystem)return`<div class="chat-message chat-message--system">${this._escapeHtml(o.content)}</div>`;const a=(o.username||"U").substring(0,2).toUpperCase(),i=o.timestamp.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return`
                <div class="chat-message ${s?"chat-message--muted":""}" data-user-id="${o.userId}">
                    <div class="chat-message__avatar">${a}</div>
                    <div class="chat-message__content">
                        <div class="chat-message__header">
                            <span class="chat-message__username">${this._escapeHtml(o.username)}</span>
                            <span class="chat-message__time">${i}</span>
                        </div>
                        <div class="chat-message__text">${this._escapeHtml(o.content)}</div>
                    </div>
                    ${String(o.userId)!==String(this.userId)?`
                        <button class="chat-message__mute" data-user-id="${o.userId}" title="${s?"Unmute user":"Mute user"}">
                            ${s?"🔊":"🔇"}
                        </button>
                    `:""}
                </div>
            `}).join(""),e.scrollTop=e.scrollHeight,e.querySelectorAll(".chat-message__mute").forEach(o=>{o.addEventListener("click",s=>{const a=s.target.dataset.userId;this._toggleMuteUser(a)})})}_toggleMuteUser(e){const t=String(e);this.mutedUsers.has(t)?this.mutedUsers.delete(t):this.mutedUsers.add(t),this._renderChatMessages()}_updateChatBadges(){const e=(t,o)=>{t&&(o>0?(t.textContent=o>99?"99+":String(o),t.classList.remove("hidden")):t.classList.add("hidden"))};e(this.els.lobbyBadge,this.chatUnreadCounts.lobby),e(this.els.playersBadge,this.chatUnreadCounts.players),e(this.els.spectatorsBadge,this.chatUnreadCounts.spectators)}_updateChatTabAccess(){const e=this.els.chatTabLobby,t=this.els.chatTabPlayers,o=this.els.chatTabSpectators,s=this._isLobbyChatDisabled(),a=this.players.some(i=>String(i.user_id||i.id)===String(this.userId));e&&(s?(e.classList.add("hidden"),e.disabled=!0):(e.classList.remove("hidden"),e.disabled=!1)),t&&(s?(t.classList.remove("hidden"),t.classList.remove("disabled"),t.disabled=!1,this.isSpectator&&!a?t.setAttribute("title","View players chat (read-only)"):t.removeAttribute("title")):(t.classList.add("hidden"),t.disabled=!0)),o&&(this.isSpectator&&!a?(o.classList.remove("hidden"),o.classList.remove("disabled"),o.disabled=!1):(o.classList.add("hidden"),o.disabled=!0)),this.chatChannel==="lobby"&&s&&(this.isSpectator&&!a?this._switchChatChannel("spectators"):this._switchChatChannel("players")),this.chatChannel==="spectators"&&(!this.isSpectator||a)&&(s?this._switchChatChannel("players"):this._switchChatChannel("lobby")),this._updateChatInputAccess()}_addSystemMessage(e){const t={id:Date.now(),userId:0,username:"System",content:e,isSystem:!0,timestamp:new Date},o=this._isLobbyChatDisabled()?"players":"lobby";this.chatMessages[o]||(this.chatMessages[o]=[]),this.chatMessages[o].push(t),o===this.chatChannel?this._renderChatMessages():(this.chatUnreadCounts[o]++,this._updateChatBadges())}_updateSpectatorUI(){const e=this.els.spectatorBanner,t=this.els.requestToPlayBtn;if(e)if(this.isSpectator){if(e.classList.remove("hidden"),t){const o=this.lobby.length<this.maxPlayers;t.classList.toggle("hidden",!o)}}else e.classList.add("hidden");this._renderSpectatorsList()}_renderSpectatorsList(){const e=this.els.spectatorsPanel,t=this.els.spectatorsCount,o=this.els.spectatorsList;if(!e||!o)return;if(!this.allowSpectators||this.spectators.length===0){e.classList.add("hidden");return}e.classList.remove("hidden"),t&&(t.textContent=this.spectators.length);const s=String(this.userId);o.innerHTML=this.spectators.map(a=>{const i=(a.username||"U").charAt(0).toUpperCase(),n=String(a.user_id)===s;return`
                <div class="spectator-item ${n?"spectator-item--me":""}" data-user-id="${a.user_id}">
                    <span class="spectator-item__avatar">${i}</span>
                    <span class="spectator-item__name">${this._escapeHtml(a.username)}${n?" (you)":""}</span>
                </div>
            `}).join("")}_requestToPlay(){console.log("[TicTacToe] Requesting to play"),this._send({type:"games.command.request_to_play",room_id:this.roomId}),this.els.requestToPlayBtn&&(this.els.requestToPlayBtn.disabled=!0,this.els.requestToPlayBtn.textContent="Requested...")}_onSpectatorJoined(e){console.log("[TicTacToe] Spectator joined:",e);const t=e.spectator||e,o={user_id:t.user_id,username:t.username,avatar_id:t.avatar_id,joined_at:t.joined_at};this.spectators.find(s=>String(s.user_id)===String(o.user_id))||this.spectators.push(o),String(o.user_id)===String(this.userId)&&(this.isSpectator=!0,this.isPlayer=!1,console.log("[TicTacToe] Current user joined as spectator, updating chat tabs"),this._updateChatTabAccess()),this._updateSpectatorUI(),this.isAdmin&&this.els.adminLobby&&!this.els.adminLobby.classList.contains("hidden")&&this._renderAdminLobby()}_onSpectatorLeft(e){console.log("[TicTacToe] Spectator left:",e);const t=String(e.user_id);this.spectators=this.spectators.filter(o=>String(o.user_id)!==t),this._updateSpectatorUI()}_onRequestToPlayAccepted(e){console.log("[TicTacToe] Request to play accepted:",e),String(e.user_id)===String(this.userId)&&(this.isSpectator=!1);const t=String(e.user_id);this.spectators=this.spectators.filter(o=>String(o.user_id)!==t),this._updateSpectatorUI(),this._updateChatTabAccess()}_renderWaitingRoom(){this._updateGameUI()}_handleCellClick(e){if(this.isSpectator||this.currentTurn!=this.userId||this.isGamePaused)return;const t=parseInt(e.dataset.position);this.board[t]===null&&this._send({type:"games.command.tic_tac_toe.move",room_id:this.roomId,position:t})}_resetBoard(){this.board=Array(9).fill(null),this.winningLine=null,this._renderBoard()}_renderBoard(){this.els.cells.forEach((e,t)=>{const o=this.board[t];e.textContent=o||"",e.className="cell",o==="X"?e.classList.add("cell--x"):o==="O"&&e.classList.add("cell--o"),(this.currentTurn!=this.userId||o!==null||this.isGamePaused)&&e.classList.add("cell--disabled")})}_highlightWinningLine(){this.winningLine&&this.winningLine.forEach(e=>{this.els.cells[e].classList.add("cell--winning")})}_updateMatchInfo(){const e={id:this.playerXId,score:this.scores[this.playerXId]||0},t={id:this.playerOId,score:this.scores[this.playerOId]||0},o=e.id==this.userId?this.username:"Opponent",s=t.id==this.userId?this.username:"Opponent";this.els.player1Score.querySelector(".player-score__name").textContent=o,this.els.player1Score.querySelector(".player-score__value").textContent=e.score,this.els.player1Score.classList.toggle("player-score--active",this.currentTurn==e.id),this.els.player2Score.querySelector(".player-score__name").textContent=s,this.els.player2Score.querySelector(".player-score__value").textContent=t.score,this.els.player2Score.classList.toggle("player-score--active",this.currentTurn==t.id),this.els.gameNumber.textContent=`Game ${this.gameNumber} of 9 (First to 5 wins)`}_updateTurnIndicator(){const e=this.currentTurn==this.userId,t=this.playerXId==this.userId?"X":"O";this.els.turnIndicator.classList.toggle("turn-indicator--your-turn",e),this.els.turnIndicatorText.textContent=e?`Your turn (${t})`:"Opponent's turn"}_startTimer(){if(this._stopTimer(),this.timeRemaining=60,this.moveDeadline){const e=new Date;this.timeRemaining=Math.max(0,Math.floor((this.moveDeadline-e)/1e3))}this._updateTimerDisplay(),this.timerInterval=setInterval(()=>{this.timeRemaining=Math.max(0,this.timeRemaining-1),this._updateTimerDisplay(),this.timeRemaining<=0&&this._stopTimer()},1e3)}_stopTimer(){this.timerInterval&&(clearInterval(this.timerInterval),this.timerInterval=null)}_updateTimerDisplay(){this.els.turnTimerValue.textContent=this.timeRemaining,this.els.turnTimerValue.className="turn-timer__value",this.timeRemaining<=10?this.els.turnTimerValue.classList.add("turn-timer__value--danger"):this.timeRemaining<=20&&this.els.turnTimerValue.classList.add("turn-timer__value--warning")}_backToLobby(){this.els.gameResult.classList.remove("active"),this.mode="lobby",this._showLobby(),this._listRooms(),this.dispatchEvent(new CustomEvent("game-leave",{detail:{roomId:this.roomId}}))}_onError(e){if(console.error("[TicTacToe] Error:",e),e.code==="already_in_room"){console.log("[TicTacToe] Already in room, requesting room state...");const t=this._pendingJoinData?.roomName||e.room_name||this.roomName,o=e.room_id||this.roomId;if(t)this._send({type:"games.command.get_room_state",room_name:t}),this._showToast("Rejoining room...","info");else if(o){const s=this.rooms.find(a=>a.room_id===o);s?(this._send({type:"games.command.get_room_state",room_name:s.room_name}),this._showToast("Rejoining room...","info")):(this._showToast("Already in a room. Refreshing...","info"),this._listRooms())}else this._showToast("Already in a room","info");return}this._showToast(e.message,"error"),this.dispatchEvent(new CustomEvent("game-error",{detail:{code:e.code,message:e.message}}))}_showToast(e,t="error"){const o=document.createElement("div");o.className=`toast toast--${t}`,o.innerHTML=`<span class="toast__message">${this._escapeHtml(e)}</span>`,this.els.toastContainer.appendChild(o),setTimeout(()=>{o.style.animation="toastSlideOut 0.3s ease forwards",setTimeout(()=>{o.remove()},300)},5e3)}}customElements.get("tic-tac-toe")||customElements.define("tic-tac-toe",g),console.log("[TIC_TAC_TOE] Web component registered")})();
