(function(){"use strict";const _=document.createElement("template");_.innerHTML=`
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
      gap: 3rem;
      align-items: center;
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

    .dice--player-1 {
      border: 3px solid var(--primary-color);
    }

    .dice--player-2 {
      border: 3px solid var(--warning-color);
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

    .ready-btn, .roll-btn {
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

    .game-over__ready-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
      padding: 0.375rem 0.75rem;
      background: var(--bg-color);
      border-radius: 1rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .game-over__ready-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
      animation: pulse 1.5s infinite;
    }

    .game-over__ready-indicator--ready .game-over__ready-dot {
      background: var(--success-color, #22c55e);
      animation: none;
    }

    .game-over__ready-indicator--ready .game-over__ready-text {
      color: var(--success-color, #22c55e);
      font-weight: 600;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
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
        <button class="create-room-btn" id="emptyCreateBtn">Create Room</button>
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
          <div class="dice-container">
            <div class="dice dice--player-1" id="dice1" data-value="0">
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
            <div class="dice dice--player-2" id="dice2" data-value="0">
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

          <button class="ready-btn hidden" id="readyBtn">Ready!</button>
          <button class="roll-btn hidden" id="rollBtn" disabled>Roll Dice</button>
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
            <button class="chat-tab" data-channel="players" id="chatTabPlayers">
              <span class="chat-tab__label">Players</span>
              <span class="chat-tab__badge hidden" id="playersBadge">0</span>
            </button>
            <button class="chat-tab" data-channel="spectators" id="chatTabSpectators">
              <span class="chat-tab__label">Spectators</span>
              <span class="chat-tab__badge hidden" id="spectatorsBadge">0</span>
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

      <footer class="game-footer">
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
`;const b={DISCONNECTED:"disconnected",CONNECTING:"connecting",CONNECTED:"connected",RECONNECTING:"reconnecting"},g={WAITING:"waiting",PLAYING:"playing",FINISHED:"finished"},y={LOBBY:"lobby",GAME:"game"};class w extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.shadowRoot.appendChild(_.content.cloneNode(!0)),this.mode=y.GAME,this.connectionState=b.DISCONNECTED,this.ws=null,this.reconnectAttempts=0,this.maxReconnectAttempts=5,this.reconnectDelay=1e3,this.heartbeatInterval=null,this.heartbeatTimeout=null,this.availableRooms=[],this.pendingJoinRoomId=null,this.pendingJoinRoomName=null,this.notInRoomInfo=null,this.wantsToSpectate=!1,this.roomId="",this.roomName="",this.players=[],this.lobby=[],this.bannedPlayers=[],this.spectators=[],this.hostId=null,this.isAdmin=!1,this.maxPlayers=2,this.allowSpectators=!0,this.gameStatus=g.WAITING,this.currentTurn=null,this.round=0,this.myPlayerId=null,this.roundHistory=[],this.lastDiceState=null,this.disconnectedPlayers=new Map,this.kickVotes=new Set,this.autoPlayers=new Set,this.disconnectTicker=null,this.disconnectOverlayIds=new Set,this.windowEventsBound=!1,this.hasSentDisconnectIntent=!1,this.handlePageHide=null,this.handleBeforeUnload=null,this.handleOffline=null,this.chatChannel="lobby",this.chatMessages={lobby:[],players:[],spectators:[]},this.chatHistoryRequested={lobby:!1,players:!1,spectators:!1},this.chatUnreadCounts={lobby:0,players:0,spectators:0},this.mutedUsers=new Set,this.isChatCollapsed=!1,this.isPlayer=!1,this.isSpectator=!1,this.cacheElements(),this.bindEvents()}static get observedAttributes(){return["data-ws-url","data-room-id","data-room-name","data-user-id","data-username","data-avatar-id","data-mode","data-spectate"]}connectedCallback(){this.wsUrl=this.dataset.wsUrl,this.roomId=this.dataset.roomId||"",this.roomName=this.dataset.roomName||"",this.userId=this.dataset.userId,this.username=this.dataset.username,this.avatarId=this.dataset.avatarId,this.myPlayerId=this.userId,this.mode=this.dataset.mode==="lobby"?y.LOBBY:y.GAME,this.wantsToSpectate=this.dataset.spectate==="true",this.setupModeUI(),this.bindWindowEvents(),this.wsUrl&&this.connect()}disconnectedCallback(){this.unbindWindowEvents(),this.disconnect()}cacheElements(){const e=t=>{const a=this.shadowRoot.getElementById(t);return a||console.warn(`[BiggerDice] Element not found: ${t}`),a};this.elements={headerTitle:e("headerTitle"),gameStatus:e("gameStatus"),connectionDot:e("connectionDot"),connectionText:e("connectionText"),lobbySection:e("lobbySection"),createRoomBtn:e("createRoomBtn"),emptyCreateBtn:e("emptyCreateBtn"),loadingState:e("loadingState"),emptyState:e("emptyState"),roomsGrid:e("roomsGrid"),createRoomModal:e("createRoomModal"),createRoomForm:e("createRoomForm"),roomNameInput:e("roomNameInput"),roomPasswordInput:e("roomPasswordInput"),playerCountInput:e("playerCountInput"),allowSpectatorsInput:e("allowSpectatorsInput"),modalCloseBtn:e("modalCloseBtn"),modalCancelBtn:e("modalCancelBtn"),modalCreateBtn:e("modalCreateBtn"),joinPasswordModal:e("joinPasswordModal"),joinPasswordForm:e("joinPasswordForm"),joinPasswordInput:e("joinPasswordInput"),joinPasswordError:e("joinPasswordError"),joinPasswordCloseBtn:e("joinPasswordCloseBtn"),joinPasswordCancelBtn:e("joinPasswordCancelBtn"),gameSection:e("gameSection"),waitingForAdmin:e("waitingForAdmin"),waitingPlayersList:e("waitingPlayersList"),adminLobby:e("adminLobby"),lobbyCount:e("lobbyCount"),lobbyPlayersList:e("lobbyPlayersList"),bannedPlayersSection:e("bannedPlayersSection"),bannedCount:e("bannedCount"),bannedPlayersList:e("bannedPlayersList"),waitingState:e("waitingState"),notInRoomState:e("notInRoomState"),enterRoomBtn:e("enterRoomBtn"),enterRoomBtnText:e("enterRoomBtnText"),notInRoomHint:e("notInRoomHint"),gameBoard:e("gameBoard"),turnIndicator:e("turnIndicator"),playersArea:e("playersArea"),dice1:e("dice1"),dice2:e("dice2"),readyBtn:e("readyBtn"),rollBtn:e("rollBtn"),roundInfo:e("roundInfo"),leaveBtn:e("leaveBtn"),disconnectOverlay:e("disconnectOverlay"),resultOverlay:e("resultOverlay"),resultIcon:e("resultIcon"),resultTitle:e("resultTitle"),resultScore1:e("resultScore1"),resultLabel1:e("resultLabel1"),resultScore2:e("resultScore2"),resultLabel2:e("resultLabel2"),resultMessage:e("resultMessage"),resultContinueBtn:e("resultContinueBtn"),resultLeaveBtn:e("resultLeaveBtn"),spectatorBanner:e("spectatorBanner"),requestToPlayBtn:e("requestToPlayBtn"),spectatorsPanel:e("spectatorsPanel"),spectatorsCount:e("spectatorsCount"),spectatorsList:e("spectatorsList"),chatPanel:e("chatPanel"),chatTabLobby:e("chatTabLobby"),chatTabPlayers:e("chatTabPlayers"),chatTabSpectators:e("chatTabSpectators"),lobbyBadge:e("lobbyBadge"),playersBadge:e("playersBadge"),spectatorsBadge:e("spectatorsBadge"),chatToggle:e("chatToggle"),chatBody:e("chatBody"),chatMessages:e("chatMessages"),chatForm:e("chatForm"),chatInput:e("chatInput"),chatSend:e("chatSend")}}bindEvents(){console.log("[BiggerDice] Binding events..."),this.elements.createRoomBtn&&this.elements.createRoomBtn.addEventListener("click",()=>{console.log("[BiggerDice] Create room button clicked"),this.showCreateRoomModal()}),this.elements.emptyCreateBtn&&this.elements.emptyCreateBtn.addEventListener("click",()=>{console.log("[BiggerDice] Empty create button clicked"),this.showCreateRoomModal()}),this.elements.modalCloseBtn&&this.elements.modalCloseBtn.addEventListener("click",()=>{console.log("[BiggerDice] Modal close button clicked"),this.hideCreateRoomModal()}),this.elements.modalCancelBtn&&this.elements.modalCancelBtn.addEventListener("click",()=>{console.log("[BiggerDice] Modal cancel button clicked"),this.hideCreateRoomModal()}),this.elements.createRoomForm&&this.elements.createRoomForm.addEventListener("submit",e=>{console.log("[BiggerDice] Form submitted"),e.preventDefault(),e.stopPropagation(),this.createRoom()}),this.elements.modalCreateBtn&&this.elements.modalCreateBtn.addEventListener("click",e=>{console.log("[BiggerDice] Create button clicked directly"),e.preventDefault(),e.stopPropagation(),this.createRoom()}),this.elements.createRoomModal&&this.elements.createRoomModal.addEventListener("click",e=>{e.target===this.elements.createRoomModal&&(console.log("[BiggerDice] Modal overlay clicked"),this.hideCreateRoomModal())}),this.elements.joinPasswordCloseBtn&&this.elements.joinPasswordCloseBtn.addEventListener("click",()=>this.hideJoinPasswordModal()),this.elements.joinPasswordCancelBtn&&this.elements.joinPasswordCancelBtn.addEventListener("click",()=>this.hideJoinPasswordModal()),this.elements.joinPasswordForm&&this.elements.joinPasswordForm.addEventListener("submit",e=>{e.preventDefault(),this.submitJoinWithPassword()}),this.elements.joinPasswordModal&&this.elements.joinPasswordModal.addEventListener("click",e=>{e.target===this.elements.joinPasswordModal&&this.hideJoinPasswordModal()}),this.elements.readyBtn&&this.elements.readyBtn.addEventListener("click",()=>this.sendReady()),this.elements.rollBtn&&this.elements.rollBtn.addEventListener("click",()=>this.sendRoll()),this.elements.leaveBtn&&this.elements.leaveBtn.addEventListener("click",()=>this.leaveGame()),this.elements.resultContinueBtn&&this.elements.resultContinueBtn.addEventListener("click",()=>this.hideResultOverlay()),this.elements.resultLeaveBtn&&this.elements.resultLeaveBtn.addEventListener("click",()=>this.leaveGame()),this.elements.enterRoomBtn&&this.elements.enterRoomBtn.addEventListener("click",()=>this.handleEnterRoomClick()),this.elements.requestToPlayBtn&&this.elements.requestToPlayBtn.addEventListener("click",()=>this.requestToPlay()),this.elements.chatTabLobby&&this.elements.chatTabLobby.addEventListener("click",()=>this.switchChatChannel("lobby")),this.elements.chatTabPlayers&&this.elements.chatTabPlayers.addEventListener("click",()=>this.switchChatChannel("players")),this.elements.chatTabSpectators&&this.elements.chatTabSpectators.addEventListener("click",()=>this.switchChatChannel("spectators")),this.elements.chatToggle&&this.elements.chatToggle.addEventListener("click",()=>this.toggleChat()),this.elements.chatForm&&this.elements.chatForm.addEventListener("submit",e=>{e.preventDefault(),this.sendChatMessage()}),this.elements.playersArea&&this.elements.playersArea.addEventListener("click",e=>{const t=e.target.closest('[data-action="kick-disconnected"]');if(!t)return;const a=t.dataset.userId;a&&this.sendKickDisconnected(a)}),this.elements.disconnectOverlay&&this.elements.disconnectOverlay.addEventListener("click",e=>{const t=e.target.closest('[data-action="kick-disconnected"]');if(!t)return;const a=t.dataset.userId;a&&this.sendKickDisconnected(a)}),console.log("[BiggerDice] Events bound successfully")}bindWindowEvents(){this.windowEventsBound||(this.handlePageHide=()=>this.notifyDisconnectIntent(),this.handleBeforeUnload=()=>this.notifyDisconnectIntent(),this.handleOffline=()=>{this.notifyDisconnectIntent(),this.ws?.close()},window.addEventListener("pagehide",this.handlePageHide),window.addEventListener("beforeunload",this.handleBeforeUnload),window.addEventListener("offline",this.handleOffline),this.windowEventsBound=!0)}unbindWindowEvents(){this.windowEventsBound&&(this.handlePageHide&&window.removeEventListener("pagehide",this.handlePageHide),this.handleBeforeUnload&&window.removeEventListener("beforeunload",this.handleBeforeUnload),this.handleOffline&&window.removeEventListener("offline",this.handleOffline),this.handlePageHide=null,this.handleBeforeUnload=null,this.handleOffline=null,this.windowEventsBound=!1)}notifyDisconnectIntent(){this.hasSentDisconnectIntent||this.roomId&&this.gameStatus===g.PLAYING&&(!this.isPlayer||this.isSpectator||(this.hasSentDisconnectIntent=!0,this.send({type:"games.command.leave_room",room_id:this.roomId})))}setupModeUI(){this.mode===y.LOBBY?(this.elements.lobbySection.classList.add("active"),this.elements.gameSection.classList.remove("active"),this.elements.headerTitle.textContent="Bigger Dice Lobby"):(this.elements.lobbySection.classList.remove("active"),this.elements.gameSection.classList.add("active"),this.elements.headerTitle.textContent=this.roomName||"Bigger Dice")}connect(){if(this.connectionState!==b.CONNECTING){this.setConnectionState(b.CONNECTING);try{this.ws=new WebSocket(this.wsUrl),this.ws.onopen=()=>this.handleOpen(),this.ws.onmessage=e=>this.handleMessage(e),this.ws.onclose=e=>this.handleClose(e),this.ws.onerror=e=>this.handleError(e)}catch(e){console.error("WebSocket connection error:",e),this.scheduleReconnect()}}}disconnect(){this.stopHeartbeat(),this.stopDisconnectTickerIfNeeded(),this.ws&&(this.ws.close(),this.ws=null),this.setConnectionState(b.DISCONNECTED)}handleOpen(){console.log("BiggerDice: WebSocket connected"),this.reconnectAttempts=0,this.startHeartbeat()}handleMessage(e){try{const t=JSON.parse(e.data);switch(console.log("BiggerDice: Received",t.type,t),t.type){case"system.welcome":this.handleWelcome(t);break;case"system.authenticated":this.handleAuthenticated(t);break;case"system.heartbeat_ack":this.handleHeartbeatAck();break;case"system.error":this.handleSystemError(t);break;case"room_list":case"games.event.room_list":this.handleRoomList(t.rooms);break;case"room_created":case"games.event.room_created":this.handleRoomCreated(t);break;case"room_joined":case"games.event.room_joined":this.handleRoomJoined(t);break;case"room_removed":case"games.event.room_removed":this.handleRoomRemoved(t);break;case"games.event.room_state":this.handleRoomState(t.room);break;case"games.event.player_joined":this.handlePlayerJoined(t);break;case"games.event.player_left":this.handlePlayerLeft(t);break;case"games.event.player_disconnected":this.handlePlayerDisconnected(t);break;case"games.event.player_rejoined":this.handlePlayerRejoined(t);break;case"games.event.player_auto_enabled":this.handlePlayerAutoEnabled(t);break;case"games.event.player_auto_disabled":this.handlePlayerAutoDisabled(t);break;case"lobby_joined":case"games.event.lobby_joined":this.handleLobbyJoined(t);break;case"player_selected":case"games.event.player_selected":this.handlePlayerSelected(t);break;case"player_kicked":case"games.event.player_kicked":this.handlePlayerKicked(t);break;case"player_banned":case"games.event.player_banned":this.handlePlayerBanned(t);break;case"player_unbanned":case"games.event.player_unbanned":this.handlePlayerUnbanned(t);break;case"user_banned":case"games.event.user_banned":this.handleUserBanned(t);break;case"lobby_updated":case"games.event.lobby_updated":this.handleLobbyUpdated(t);break;case"games.event.game_started":this.handleGameStarted(t);break;case"player_ready":case"games.event.player_ready":this.handlePlayerReady(t);break;case"games.event.bigger_dice.rolled":this.handleDiceRolled(t);break;case"games.event.bigger_dice.state":this.handleBiggerDiceState(t);break;case"games.event.bigger_dice.round_result":this.handleRoundResult(t);break;case"turn_changed":case"games.event.turn_changed":this.handleTurnChanged(t);break;case"games.event.round_complete":case"games.event.bigger_dice.round_complete":this.handleRoundComplete(t);break;case"games.event.game_over":case"games.event.bigger_dice.game_over":this.handleGameOver(t);break;case"error":case"games.event.error":this.handleGameError(t);break;case"games.event.not_in_room":this.handleNotInRoom(t);break;case"chat_message":case"games.event.chat_message":this.handleChatMessage(t);break;case"chat_history":case"games.event.chat_history":this.handleChatHistory(t);break;case"user_muted":case"games.event.user_muted":console.log("[Chat] User muted:",t.target_user_id);break;case"user_unmuted":case"games.event.user_unmuted":console.log("[Chat] User unmuted:",t.target_user_id);break;case"spectator_joined":case"games.event.spectator_joined":case"spectator_data_joined":case"games.event.spectator_data_joined":this.handleSpectatorJoined(t);break;case"spectator_left":case"games.event.spectator_left":this.handleSpectatorLeft(t);break;case"request_to_play_accepted":case"games.event.request_to_play_accepted":this.handleRequestToPlayAccepted(t);break;case"removed_from_game":case"games.event.removed_from_game":this.handleRemovedFromGame(t);break;case"game_starting":case"games.event.game_starting":this.handleGameStarting(t);break;default:console.warn("BiggerDice: Unknown message type",t.type)}}catch(t){console.error("BiggerDice: Error parsing message",t)}}handleClose(e){console.log("BiggerDice: WebSocket closed",e.code,e.reason),this.stopHeartbeat(),this.setConnectionState(b.DISCONNECTED),this.scheduleReconnect()}handleError(e){console.error("BiggerDice: WebSocket error",e)}scheduleReconnect(){if(this.reconnectAttempts>=this.maxReconnectAttempts){console.error("BiggerDice: Max reconnect attempts reached"),this.dispatchEvent(new CustomEvent("game-error",{detail:{message:"Unable to connect to game server"}}));return}this.setConnectionState(b.RECONNECTING),this.reconnectAttempts++;const e=this.reconnectDelay*Math.pow(2,this.reconnectAttempts-1);console.log(`BiggerDice: Reconnecting in ${e}ms`),setTimeout(()=>this.connect(),e)}send(e){this.ws&&this.ws.readyState===WebSocket.OPEN?this.ws.send(JSON.stringify(e)):console.warn("BiggerDice: WebSocket not connected")}startHeartbeat(){this.stopHeartbeat(),this.heartbeatInterval=setInterval(()=>{this.ws&&this.ws.readyState===WebSocket.OPEN&&(this.send({type:"system.heartbeat"}),this.heartbeatTimeout=setTimeout(()=>{console.warn("BiggerDice: Heartbeat timeout"),this.ws?.close()},1e4))},3e4)}stopHeartbeat(){this.heartbeatInterval&&(clearInterval(this.heartbeatInterval),this.heartbeatInterval=null),this.heartbeatTimeout&&(clearTimeout(this.heartbeatTimeout),this.heartbeatTimeout=null)}handleHeartbeatAck(){this.heartbeatTimeout&&(clearTimeout(this.heartbeatTimeout),this.heartbeatTimeout=null)}setConnectionState(e){this.connectionState=e,this.updateConnectionUI()}updateConnectionUI(){const e=this.elements.connectionDot,t=this.elements.connectionText,a=this.elements.gameStatus;switch(e.classList.remove("connection-dot--connected","connection-dot--connecting"),this.connectionState){case b.CONNECTED:e.classList.add("connection-dot--connected"),t.textContent="Connected";break;case b.CONNECTING:case b.RECONNECTING:e.classList.add("connection-dot--connecting"),t.textContent=this.connectionState===b.CONNECTING?"Connecting...":"Reconnecting...";break;default:t.textContent="Disconnected"}this.mode===y.LOBBY&&(a.textContent=this.connectionState===b.CONNECTED?"Connected":"Connecting")}handleWelcome(e){console.log("BiggerDice: Welcome received, authenticating"),this.send({type:"system.authenticate",user_id:String(this.userId),username:this.username||"Guest",avatar_id:this.avatarId||null})}handleAuthenticated(e){console.log("BiggerDice: Authenticated as",e.username),this.setConnectionState(b.CONNECTED),this.mode===y.LOBBY?this.requestRoomList():this.roomId&&this.send({type:"games.command.rejoin_room",room_id:this.roomId})}handleSystemError(e){console.error("BiggerDice: System error",e.code,e.message),this.dispatchEvent(new CustomEvent("game-error",{detail:{code:e.code,message:e.message}}))}requestRoomList(){this.send({type:"games.command.list_rooms",game_type:"bigger_dice"})}handleRoomList(e){this.availableRooms=(e||[]).filter(t=>t.game_type==="bigger_dice"),this.renderRoomList()}handleRoomCreated(e){console.log("[BiggerDice] handleRoomCreated:",e);const t=String(e.host_id),a=String(this.userId);if(t===a)console.log("[BiggerDice] We are the host, dispatching room-joined event"),this.dispatchEvent(new CustomEvent("room-joined",{detail:{room_id:e.room_id,game_type:e.game_type||"bigger_dice"},bubbles:!0,composed:!0}));else{console.log("[BiggerDice] Not the host, adding room to list");const s={room_id:e.room_id,room_name:e.room_name,game_type:e.game_type||"bigger_dice",host_name:e.host_name||e.host_username||"Unknown",status:"waiting",player_count:1,spectator_count:0,max_players:e.max_players||2,allow_spectators:e.allow_spectators===!0,is_password_protected:e.is_password_protected||!1};this.mode===y.LOBBY&&(this.availableRooms.some(o=>o.room_id===s.room_id)||(this.availableRooms.unshift(s),this.renderRoomList()))}}handleRoomJoined(e){this.pendingJoinRoomId&&this.hideJoinPasswordModal(),this.notInRoomInfo=null,this.elements.notInRoomState.classList.add("hidden"),this.chatHistoryRequested={lobby:!1,players:!1,spectators:!1},this.chatMessages={lobby:[],players:[],spectators:[]};const t=e.player?.user_id||e.player_id;t===this.userId||t===String(this.userId)||String(t)===this.userId?this.dispatchEvent(new CustomEvent("room-joined",{detail:{room_id:e.room_id,game_type:"bigger_dice"}})):this.requestRoomList()}handleRoomRemoved(e){console.log("[BiggerDice] handleRoomRemoved:",e);const t=e.room_id,a=e.reason||"unknown",s=this.availableRooms.length;this.availableRooms=this.availableRooms.filter(i=>i.room_id!==t),this.availableRooms.length<s&&(console.log(`[BiggerDice] Room ${t} removed from list (reason: ${a})`),this.mode===y.LOBBY&&this.renderRoomList()),this.roomId===t&&this.mode===y.GAME&&this.showRoomClosedMessage()}renderRoomList(){const e=this.elements.roomsGrid,t=this.elements.loadingState,a=this.elements.emptyState;if(t.classList.add("hidden"),this.availableRooms.length===0){a.classList.remove("hidden"),e.classList.add("hidden");return}a.classList.add("hidden"),e.classList.remove("hidden"),e.innerHTML=this.availableRooms.map(s=>{const i=s.players?.length||0,o=s.max_players||2,c=s.spectator_count||0,r=s.allow_spectators===!0,d=i>=o,n=s.can_rejoin===!0;return`
      <div class="room-card" data-room-id="${s.room_id}">
        <div class="room-card__header">
          <span class="room-card__name">
            ${this.escapeHtml(s.room_name)}
            ${s.is_password_protected?`
              <span class="room-card__lock" title="Password protected">
                <svg class="room-card__lock-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </span>
            `:""}
          </span>
          <span class="room-card__status room-card__status--${s.status}">${this.formatStatus(s.status)}</span>
        </div>
        <div class="room-card__info">
          <span class="room-card__info-item" title="Players">
            <svg class="room-card__info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            ${i}/${o}
          </span>
          ${r?`
            <span class="room-card__info-item" title="Spectators">
              <svg class="room-card__info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              ${c}
            </span>
          `:`
            <span class="room-card__no-spectators" title="Spectators not allowed">No spectators</span>
          `}
        </div>
        <div class="room-card__players">
          ${(s.players||[]).map(m=>`
            <span class="player-badge ${m.is_ready?"player-badge--ready":""}">${this.escapeHtml(m.username||m.name)}</span>
          `).join("")}
          ${i<o?'<span class="player-badge">Waiting...</span>':""}
        </div>
        <div class="room-card__actions">
          ${n?`
            <button class="join-btn" data-action="rejoin" data-room-id="${s.room_id}">Rejoin</button>
          `:""}
          ${!n&&s.status==="waiting"&&!d?`
            <button class="join-btn" data-action="join" data-room-id="${s.room_id}" data-room-name="${this.escapeHtml(s.room_name)}" data-protected="${s.is_password_protected||!1}">Join Game</button>
          `:""}
          ${!n&&r?`
            <button class="spectate-btn" data-action="spectate" data-room-id="${s.room_id}">
              ${s.status==="waiting"?"Spectate":"Watch"}
            </button>
          `:""}
        </div>
      </div>
    `}).join(""),e.querySelectorAll("[data-action]").forEach(s=>{s.addEventListener("click",i=>{const o=i.target.dataset.roomId,c=i.target.dataset.action;(c==="join"||c==="spectate"||c==="rejoin")&&this.dispatchEvent(new CustomEvent("room-joined",{detail:{room_id:o,game_type:"bigger_dice",as_spectator:c==="spectate"},bubbles:!0,composed:!0}))})})}showCreateRoomModal(){console.log("[BiggerDice] showCreateRoomModal called"),this.elements.createRoomModal?(this.elements.createRoomModal.classList.add("active"),console.log("[BiggerDice] Modal should now be visible")):console.error("[BiggerDice] createRoomModal element not found"),this.elements.roomNameInput&&(this.elements.roomNameInput.value="",this.elements.roomNameInput.focus()),this.elements.roomPasswordInput&&(this.elements.roomPasswordInput.value=""),this.elements.playerCountInput&&(this.elements.playerCountInput.value="2"),this.elements.allowSpectatorsInput&&(this.elements.allowSpectatorsInput.checked=!0)}hideCreateRoomModal(){console.log("[BiggerDice] hideCreateRoomModal called"),this.elements.createRoomModal&&(this.elements.createRoomModal.classList.remove("active"),console.log("[BiggerDice] Modal hidden"))}createRoom(){console.log("[BiggerDice] createRoom called");const e=this.elements.roomNameInput?.value.trim()||`Room ${Date.now()}`,t=this.elements.roomPasswordInput?.value.trim()||"",a=parseInt(this.elements.playerCountInput?.value||"2",10),s=this.elements.allowSpectatorsInput?.checked??!0;console.log("[BiggerDice] Creating room:",e,"players:",a,"spectators:",s);const i={type:"games.command.create_room",game_type:"bigger_dice",room_name:e,max_players:a,allow_spectators:s};t&&(i.password=t),this.send(i),this.hideCreateRoomModal(),console.log("[BiggerDice] Room creation message sent")}showJoinPasswordModal(e,t){this.pendingJoinRoomId=e,this.pendingJoinRoomName=t,this.elements.joinPasswordInput.value="",this.elements.joinPasswordError.classList.add("hidden"),this.elements.joinPasswordModal.classList.add("active"),this.elements.joinPasswordInput.focus()}hideJoinPasswordModal(){this.elements.joinPasswordModal.classList.remove("active"),this.pendingJoinRoomId=null,this.pendingJoinRoomName=null}submitJoinWithPassword(){const e=this.elements.joinPasswordInput.value;e&&this.send({type:"games.command.join_room",room_name:this.pendingJoinRoomName,password:e})}switchChatChannel(e){if(e==="lobby"&&this.isLobbyChatDisabled()){console.log("[Chat] Lobby chat is disabled during ready phase");return}if(e==="players"&&!this.isPlayer&&!this.isSpectator){console.log("[Chat] Cannot access players channel - not a player or spectator");return}if(e==="spectators"&&!this.isSpectator){console.log("[Chat] Cannot access spectators channel - not a spectator");return}this.chatChannel=e,this.elements.chatTabLobby?.classList.toggle("active",e==="lobby"),this.elements.chatTabPlayers?.classList.toggle("active",e==="players"),this.elements.chatTabSpectators?.classList.toggle("active",e==="spectators"),this.chatUnreadCounts[e]=0,this.updateChatBadges(),this.renderChatMessages(),this.updateChatInputAccess(),!this.chatHistoryRequested[e]&&this.chatMessages[e].length===0&&this.roomId&&(this.chatHistoryRequested[e]=!0,this.requestChatHistory(e))}isLobbyChatDisabled(){return this.gameStatus===g.STARTING||this.gameStatus===g.IN_PROGRESS||this.gameStatus===g.PLAYING||this.gameStatus===g.FINISHED||this.gameStatus===g.WAITING&&this.players.length>=this.maxPlayers}updateChatInputAccess(){const e=this.elements.chatInputArea,t=this.elements.chatInput,a=this.elements.chatSendBtn,s=this.isSpectator&&!this.isPlayer&&this.chatChannel==="players";e&&(s?(e.classList.add("chat-input--disabled"),t&&(t.disabled=!0,t.placeholder="Spectators cannot send messages in players chat"),a&&(a.disabled=!0)):(e.classList.remove("chat-input--disabled"),t&&(t.disabled=!1,t.placeholder="Type a message..."),a&&(a.disabled=!1)))}toggleChat(){this.isChatCollapsed=!this.isChatCollapsed,this.elements.chatPanel?.classList.toggle("collapsed",this.isChatCollapsed)}sendChatMessage(){const e=this.elements.chatInput?.value.trim();!e||!this.roomId||(this.send({type:"games.command.send_chat",room_id:this.roomId,channel:this.chatChannel,content:e,avatar_id:this.avatarId||null}),this.elements.chatInput&&(this.elements.chatInput.value=""))}requestChatHistory(e){this.roomId&&this.send({type:"games.command.get_chat_history",room_id:this.roomId,channel:e,limit:50})}handleChatMessage(e){const t={id:e.message_id||Date.now(),userId:e.user_id,username:e.username||"Unknown",avatarId:e.avatar_id,content:e.content,isSystem:e.is_system||!1,isModerated:e.is_moderated||!1,timestamp:e.created_at?new Date(e.created_at):new Date},a=e.channel||"lobby";this.chatMessages[a]||(this.chatMessages[a]=[]),this.chatMessages[a].push(t),this.chatMessages[a].length>100&&(this.chatMessages[a]=this.chatMessages[a].slice(-100)),a===this.chatChannel?this.renderChatMessages():(this.chatUnreadCounts[a]++,this.updateChatBadges())}handleChatHistory(e){const t=e.channel||"lobby",a=e.messages||[];this.chatMessages[t]=a.map(s=>({id:s.message_id||s._id||Date.now(),userId:s.user_id,username:s.username||"Unknown",avatarId:s.avatar_id,content:s.content,isSystem:s.is_system||!1,isModerated:s.is_moderated||!1,timestamp:s.created_at?new Date(s.created_at):new Date})),t===this.chatChannel&&this.renderChatMessages()}renderChatMessages(){const e=this.elements.chatMessages;if(!e)return;const t=this.chatMessages[this.chatChannel]||[];if(t.length===0){e.innerHTML='<div class="chat-empty">No messages yet. Say hello!</div>';return}e.innerHTML=t.map(a=>{const s=this.mutedUsers.has(String(a.userId));if(a.isSystem)return`<div class="chat-message chat-message--system">${this.escapeHtml(a.content)}</div>`;const i=(a.username||"U").substring(0,2).toUpperCase(),o=a.timestamp.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return`
        <div class="chat-message ${s?"chat-message--muted":""}" data-user-id="${a.userId}">
          <div class="chat-message__avatar">${i}</div>
          <div class="chat-message__content">
            <div class="chat-message__header">
              <span class="chat-message__username">${this.escapeHtml(a.username)}</span>
              <span class="chat-message__time">${o}</span>
            </div>
            <div class="chat-message__text">${this.escapeHtml(a.content)}</div>
          </div>
          ${String(a.userId)!==String(this.userId)?`
            <button class="chat-message__mute" data-user-id="${a.userId}" title="${s?"Unmute user":"Mute user"}">
              ${s?"🔊":"🔇"}
            </button>
          `:""}
        </div>
      `}).join(""),e.scrollTop=e.scrollHeight,e.querySelectorAll(".chat-message__mute").forEach(a=>{a.addEventListener("click",s=>{const i=s.target.dataset.userId;this.toggleMuteUser(i)})})}toggleMuteUser(e){const t=String(e);this.mutedUsers.has(t)?(this.mutedUsers.delete(t),this.send({type:"games.command.unmute_user",room_id:this.roomId,target_user_id:parseInt(e,10)})):(this.mutedUsers.add(t),this.send({type:"games.command.mute_user",room_id:this.roomId,target_user_id:parseInt(e,10)})),this.renderChatMessages()}updateChatBadges(){const e=(t,a)=>{t&&(a>0?(t.textContent=a>99?"99+":String(a),t.classList.remove("hidden")):t.classList.add("hidden"))};e(this.elements.lobbyBadge,this.chatUnreadCounts.lobby),e(this.elements.playersBadge,this.chatUnreadCounts.players),e(this.elements.spectatorsBadge,this.chatUnreadCounts.spectators)}updateChatTabAccess(){const e=this.elements.chatTabLobby,t=this.elements.chatTabPlayers,a=this.elements.chatTabSpectators,s=this.isLobbyChatDisabled(),i=this.spectators&&this.spectators.length>0,o=this.players.some(c=>String(c.user_id||c.id)===String(this.myPlayerId));e&&(s?(e.classList.add("hidden"),e.disabled=!0):(e.classList.remove("hidden"),e.disabled=!1)),t&&(s?(t.classList.remove("hidden"),t.classList.remove("disabled"),t.disabled=!1,this.isSpectator&&!o?t.setAttribute("title","View players chat (read-only)"):t.removeAttribute("title")):(t.classList.add("hidden"),t.disabled=!0)),a&&(s&&this.isSpectator&&i?(a.classList.remove("hidden"),a.classList.remove("disabled"),a.disabled=!1):(a.classList.add("hidden"),a.disabled=!0)),this.chatChannel==="lobby"&&s&&(o?this.switchChatChannel("players"):this.isSpectator&&(i?this.switchChatChannel("spectators"):this.switchChatChannel("players"))),this.chatChannel==="spectators"&&(!this.isSpectator||!i)&&(s?this.switchChatChannel("players"):this.switchChatChannel("lobby")),this.updateChatInputAccess()}updateSpectatorUI(){const e=this.elements.spectatorBanner,t=this.elements.requestToPlayBtn;if(e)if(this.isSpectator){if(e.classList.remove("hidden"),t){const s=this.players.length<this.maxPlayers&&this.gameStatus===g.WAITING;t.classList.toggle("hidden",!s)}}else e.classList.add("hidden");this.renderSpectatorsList()}renderSpectatorsList(){const e=this.elements.spectatorsPanel,t=this.elements.spectatorsCount,a=this.elements.spectatorsList;if(!e||!a)return;if(!this.allowSpectators||this.spectators.length===0){e.classList.add("hidden");return}e.classList.remove("hidden"),t&&(t.textContent=this.spectators.length);const s=String(this.myPlayerId);a.innerHTML=this.spectators.map(i=>{const o=(i.username||"U").charAt(0).toUpperCase(),c=String(i.user_id)===s;return`
        <div class="spectator-item ${c?"spectator-item--me":""}" data-user-id="${i.user_id}">
          <span class="spectator-item__avatar">${o}</span>
          <span class="spectator-item__name">${this.escapeHtml(i.username)}${c?" (you)":""}</span>
        </div>
      `}).join("")}requestToPlay(){console.log("[BiggerDice] Requesting to play"),this.send({type:"games.command.request_to_play",room_id:this.roomId}),this.elements.requestToPlayBtn&&(this.elements.requestToPlayBtn.disabled=!0,this.elements.requestToPlayBtn.textContent="Requested...")}handleSpectatorJoined(e){console.log("[BiggerDice] Spectator joined:",e);const t=e.spectator||e,a={user_id:t.user_id,username:t.username,avatar_id:t.avatar_id,joined_at:t.joined_at};this.spectators.find(s=>String(s.user_id)===String(a.user_id))||this.spectators.push(a),this.updateSpectatorUI(),this.isAdmin&&this.elements.adminLobby&&!this.elements.adminLobby.classList.contains("hidden")&&this.renderAdminLobby()}handleSpectatorLeft(e){console.log("[BiggerDice] Spectator left:",e);const t=String(e.user_id);this.spectators=this.spectators.filter(a=>String(a.user_id)!==t),this.updateSpectatorUI()}handleRequestToPlayAccepted(e){console.log("[BiggerDice] Request to play accepted:",e),String(e.user_id)===String(this.myPlayerId)&&(this.isSpectator=!1);const t=String(e.user_id);this.spectators=this.spectators.filter(a=>String(a.user_id)!==t),this.updateSpectatorUI(),this.updateChatTabAccess()}joinRoom(e,t=!1){this.dispatchEvent(new CustomEvent("room-joined",{detail:{room_id:e,game_type:"bigger_dice"}}))}handleRoomState(e){this.notInRoomInfo=null,this.hasSentDisconnectIntent=!1,this.elements.notInRoomState&&this.elements.notInRoomState.classList.add("hidden"),this.pendingJoinRoomId&&this.hideJoinPasswordModal(),this.roomId=e.room_id,this.roomName=e.room_name,this.players=e.players||[],this.lobby=e.lobby||[],this.hostId=e.host_id,this.isAdmin=String(e.host_id)===String(this.myPlayerId),this.maxPlayers=e.max_players||2,this.allowSpectators=e.allow_spectators===!0,this.gameStatus=e.status==="in_progress"?g.PLAYING:e.status,this.currentTurn=e.current_turn,this.round=e.round||e.turn_number||0,e.banned_users&&Array.isArray(e.banned_users)?this.bannedPlayers=e.banned_users.map(a=>typeof a=="object"&&a!==null?{user_id:a.user_id,username:a.username||`User #${a.user_id}`}:{user_id:a,username:`User #${a}`}):this.bannedPlayers=[],this.spectators=e.spectators||[],this.autoPlayers=new Set((e.auto_players||[]).map(a=>String(a))),this.stopDisconnectTickerIfNeeded();const t=String(this.myPlayerId);this.isPlayer=this.players.some(a=>String(a.id||a.user_id)===t),this.isSpectator=this.spectators.some(a=>String(a.user_id)===t),this.updateChatTabAccess(),this.updateSpectatorUI(),!this.chatHistoryRequested.lobby&&this.chatMessages.lobby.length===0&&(this.chatHistoryRequested.lobby=!0,this.requestChatHistory("lobby")),this.updateGameUI(),this.applyDiceState()}handlePlayerJoined(e){const t={id:e.player_id,name:e.player_name,score:0,is_ready:!1};this.players.find(a=>a.id===t.id)||this.players.push(t),this.updateGameUI()}handlePlayerLeft(e){const t=String(e.player_id);if(t===String(this.hostId)){this.showRoomClosedMessage();return}this.players=this.players.filter(a=>String(a.id)!==t),this.lobby=this.lobby.filter(a=>String(a.user_id)!==t),this.disconnectedPlayers.delete(t),this.autoPlayers.delete(t),this.kickVotes.delete(t),this.stopDisconnectTickerIfNeeded(),this.updateGameUI()}handlePlayerDisconnected(e){const t=String(e.user_id),a=e.timeout_at?new Date(e.timeout_at):null;a&&!Number.isNaN(a.getTime())&&(this.disconnectedPlayers.set(t,{timeoutAt:a}),this.kickVotes.delete(t),this.startDisconnectTicker(),this.updateGameUI())}handlePlayerRejoined(e){const t=String(e.user_id);this.disconnectedPlayers.delete(t),this.kickVotes.delete(t),this.autoPlayers.delete(t),this.stopDisconnectTickerIfNeeded(),this.updateGameUI()}handlePlayerAutoEnabled(e){const t=String(e.user_id);this.autoPlayers.add(t),this.disconnectedPlayers.delete(t),this.kickVotes.delete(t),this.stopDisconnectTickerIfNeeded(),this.updateGameUI()}handlePlayerAutoDisabled(e){const t=String(e.user_id);this.autoPlayers.delete(t),this.updateGameUI()}showRoomClosedMessage(){if(this.elements.waitingState&&this.elements.waitingState.classList.add("hidden"),this.elements.adminLobby&&this.elements.adminLobby.classList.add("hidden"),this.elements.gameBoard&&this.elements.gameBoard.classList.add("hidden"),this.elements.notInRoomState&&this.elements.notInRoomState.classList.add("hidden"),this.elements.waitingForAdmin){const e=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__icon"),t=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__title"),a=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__message");e&&(e.textContent="🚪"),t&&(t.textContent="Room Closed"),a&&(a.textContent="This room has been closed. The admin has left the game."),this.elements.waitingForAdmin.classList.remove("hidden")}this.elements.leaveBtn&&(this.elements.leaveBtn.textContent="Return to Lobby")}handleLobbyJoined(e){const t=e.player||{user_id:e.user_id,username:e.username,avatar_id:e.avatar_id,score:0,is_ready:!1};this.lobby.findIndex(s=>String(s.user_id)===String(t.user_id))===-1&&this.lobby.push(t),this.updateGameUI()}handlePlayerSelected(e){const t=e.player;this.lobby=this.lobby.filter(s=>String(s.user_id)!==String(t.user_id)),this.players.findIndex(s=>String(s.user_id||s.id)===String(t.user_id))===-1&&this.players.push(t),this.updateGameUI()}handlePlayerKicked(e){const t=e.player_id||e.user_id;if(e.player_name,this.lobby=this.lobby.filter(a=>String(a.user_id)!==String(t)),String(t)===String(this.myPlayerId)){this.showKickedMessage();return}this.updateGameUI()}showKickedMessage(){if(this.elements.waitingState&&this.elements.waitingState.classList.add("hidden"),this.elements.adminLobby&&this.elements.adminLobby.classList.add("hidden"),this.elements.gameBoard&&this.elements.gameBoard.classList.add("hidden"),this.elements.notInRoomState&&this.elements.notInRoomState.classList.add("hidden"),this.elements.waitingForAdmin){const e=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__icon"),t=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__title"),a=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__text");e&&(e.textContent="🚫"),t&&(t.textContent="You have been kicked"),a&&(a.textContent="The host has kicked you from the lobby."),this.elements.waitingForAdmin.classList.remove("hidden")}setTimeout(()=>{this.dispatchEvent(new CustomEvent("game-leave"))},3e3)}handlePlayerBanned(e){const t=e.player_id||e.user_id,a=e.player_name||e.username||"Unknown";if(this.lobby=this.lobby.filter(s=>String(s.user_id)!==String(t)),this.players=this.players.filter(s=>String(s.user_id||s.id)!==String(t)),this.bannedPlayers.some(s=>String(s.user_id)===String(t))||this.bannedPlayers.push({user_id:t,username:a}),String(t)===String(this.myPlayerId)){this.showBannedMessage();return}this.updateGameUI()}handlePlayerUnbanned(e){const t=e.player_id||e.user_id;this.bannedPlayers=this.bannedPlayers.filter(a=>String(a.user_id)!==String(t)),this.updateGameUI()}handleUserBanned(e){this.showUserBannedState(e.room_name)}showUserBannedState(e){if(this.elements.waitingState&&this.elements.waitingState.classList.add("hidden"),this.elements.adminLobby&&this.elements.adminLobby.classList.add("hidden"),this.elements.gameBoard&&this.elements.gameBoard.classList.add("hidden"),this.elements.waitingForAdmin&&this.elements.waitingForAdmin.classList.add("hidden"),this.elements.notInRoomState){const t=this.elements.notInRoomState.querySelector(".not-in-room__icon"),a=this.elements.notInRoomState.querySelector(".not-in-room__title"),s=this.elements.notInRoomState.querySelector(".not-in-room__text"),i=this.elements.notInRoomState.querySelector(".not-in-room__actions");t&&(t.textContent="⛔"),a&&(a.textContent="You are banned from this room"),s&&(s.textContent="The host has banned you from this room. You cannot join it."),i&&i.classList.add("hidden"),this.elements.notInRoomState.classList.remove("hidden")}}showBannedMessage(){if(this.elements.waitingState&&this.elements.waitingState.classList.add("hidden"),this.elements.adminLobby&&this.elements.adminLobby.classList.add("hidden"),this.elements.gameBoard&&this.elements.gameBoard.classList.add("hidden"),this.elements.notInRoomState&&this.elements.notInRoomState.classList.add("hidden"),this.elements.waitingForAdmin){const e=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__icon"),t=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__title"),a=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__text");e&&(e.textContent="⛔"),t&&(t.textContent="You have been banned"),a&&(a.textContent="The host has banned you from this room. You cannot rejoin."),this.elements.waitingForAdmin.classList.remove("hidden")}setTimeout(()=>{this.dispatchEvent(new CustomEvent("game-leave"))},3e3)}handleLobbyUpdated(e){this.lobby=e.lobby||[],this.updateGameUI()}handleGameStarted(e){console.log("[BiggerDice] Game started:",e),this.gameStatus=g.PLAYING,this.players=e.players,this.currentTurn=e.first_turn,this.round=1,this.roundHistory=[],this.disconnectedPlayers.clear(),this.kickVotes.clear(),this.autoPlayers.clear(),this.stopDisconnectTickerIfNeeded(),this.players.forEach(t=>{t.score=0,t.is_ready=!1}),this.updateChatTabAccess(),this.updateGameUI()}handleGameStarting(e){console.log("[BiggerDice] Game starting (ready phase):",e),this.players=e.players||[],this.lobby=e.players||[],this.gameStatus=g.WAITING,this.disconnectedPlayers.clear(),this.kickVotes.clear(),this.autoPlayers.clear(),this.stopDisconnectTickerIfNeeded(),this.updateChatTabAccess(),this.updateGameUI()}handleRemovedFromGame(e){console.log("[BiggerDice] Removed from game:",e),this.players=[],this.lobby=[],this.spectators=[],this.showRemovedFromGameMessage(e.message||"You were not selected to play.")}showRemovedFromGameMessage(e){if(this.elements.waitingState&&this.elements.waitingState.classList.add("hidden"),this.elements.adminLobby&&this.elements.adminLobby.classList.add("hidden"),this.elements.gameBoard&&this.elements.gameBoard.classList.add("hidden"),this.elements.notInRoomState&&this.elements.notInRoomState.classList.add("hidden"),this.elements.waitingForAdmin&&this.elements.waitingForAdmin.classList.add("hidden"),this.elements.waitingForAdmin){const t=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__icon"),a=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__title"),s=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__message");t&&(t.textContent="👋"),a&&(a.textContent="Not Selected for This Game"),s&&(s.textContent=e),this.elements.waitingForAdmin.classList.remove("hidden")}setTimeout(()=>{this.dispatchEvent(new CustomEvent("game-leave"))},5e3)}handleDiceRolled(e){const a=this.players.findIndex(s=>String(s.id||s.user_id)===String(e.player_id))===0?this.elements.dice1:this.elements.dice2;this.animateDiceRoll(a,e.roll)}handleBiggerDiceState(e){this.lastDiceState={player1_id:e.player1_id?String(e.player1_id):null,player2_id:e.player2_id?String(e.player2_id):null,player1_roll:Number.isInteger(e.player1_roll)?e.player1_roll:null,player2_roll:Number.isInteger(e.player2_roll)?e.player2_roll:null},this.applyDiceState()}applyDiceState(){if(!this.lastDiceState||this.players.length===0)return;const{player1_id:e,player2_id:t,player1_roll:a,player2_roll:s}=this.lastDiceState;[{playerId:e,roll:a},{playerId:t,roll:s}].forEach(({playerId:o,roll:c})=>{if(!o)return;const r=this.players.findIndex(n=>String(n.id||n.user_id)===o),d=r===0?this.elements.dice1:r===1?this.elements.dice2:null;this.setDiceValue(d,c)})}setDiceValue(e,t){if(!e)return;const a=Number.isInteger(t)?t:0;e.dataset.value=String(a)}handlePlayerReady(e){console.log("[BiggerDice] Player ready:",e);const t=String(e.user_id),a=e.username,s=this.lobby.find(o=>String(o.user_id)===t);s&&(s.is_ready=!0,console.log(`[BiggerDice] Lobby player ${a} is now ready`));const i=this.players.find(o=>String(o.user_id||o.id)===t);if(i&&(i.is_ready=!0,console.log(`[BiggerDice] Game player ${a} is now ready`)),this.gameStatus===g.FINISHED){const o=this.elements.gameBoard;if(o){const r=this.players.findIndex(d=>String(d.id||d.user_id)===t);if(r!==-1){const d=o.querySelector(`#player${r}ReadyIndicator`);if(d){d.classList.add("game-over__ready-indicator--ready");const n=d.querySelector(".game-over__ready-text");n&&(n.textContent="Ready!"),console.log(`[BiggerDice] Updated game over ready indicator for ${a} (player ${r})`)}}}this.players.every(r=>r.is_ready===!0)&&this.players.length>=this.maxPlayers&&console.log("[BiggerDice] All players ready for rematch! Waiting for server to restart game...");return}this.updateGameUI()}handleRoundResult(e){console.log("[BiggerDice] Round result:",e);const t=String(e.player1_id),a=String(e.player2_id),s=e.player1_roll,i=e.player2_roll,o=e.winner_id?String(e.winner_id):null,c=e.is_tie,r=this.players.find(n=>String(n.id||n.user_id)===t),d=this.players.find(n=>String(n.id||n.user_id)===a);if(c||this.roundHistory.push({round:this.roundHistory.length+1,player1:{id:t,name:r?.name||r?.username||"Player 1",roll:s},player2:{id:a,name:d?.name||d?.username||"Player 2",roll:i},winnerId:o,winnerName:o?String(r?.id||r?.user_id)===o?r?.name||r?.username:d?.name||d?.username:null}),c)console.log(`[BiggerDice] Tie! Both rolled ${s}. Roll again!`);else if(o){const n=r&&String(r.id||r.user_id)===o?r:d,m=n?n.name||n.username:"Unknown",h=String(r?.id||r?.user_id)===o?s:i;console.log(`[BiggerDice] ${m} wins the round with ${h}!`),n&&(n.score=(n.score||0)+1,console.log(`[BiggerDice] Updated ${m}'s score to ${n.score}`))}this.updateGameUI()}handleTurnChanged(e){console.log("[BiggerDice] Turn changed:",e),this.currentTurn=String(e.current_turn),this.round=e.turn_number||this.round,this.updateTurnIndicator(),this.updateButtons()}handleRoundComplete(e){if(e.scores){const t=this.players.find(s=>s.id===e.scores.player1_id),a=this.players.find(s=>s.id===e.scores.player2_id);t&&(t.score=e.scores.player1_score),a&&(a.score=e.scores.player2_score)}this.round=e.round,this.currentTurn=e.next_turn,this.showRoundResult(e),this.updateGameUI()}handleGameOver(e){if(this.gameStatus=g.FINISHED,e.scores){const t=this.players.find(s=>s.id===e.scores.player1_id),a=this.players.find(s=>s.id===e.scores.player2_id);t&&(t.score=e.scores.player1_score),a&&(a.score=e.scores.player2_score)}this.updateChatTabAccess(),this.showGameOverResult(e),this.updateGameUI()}handleGameError(e){if(e.code==="wrong_password"&&this.pendingJoinRoomId){this.elements.joinPasswordError.textContent=e.message||"Incorrect password",this.elements.joinPasswordError.classList.remove("hidden"),this.elements.joinPasswordInput.value="",this.elements.joinPasswordInput.focus();return}if(e.code==="user_banned"){this.pendingJoinRoomId&&this.hideJoinPasswordModal(),this.dispatchEvent(new CustomEvent("game-error",{detail:{code:"user_banned",message:"You are banned from this room. Please contact the admin to unban you."}}));return}this.dispatchEvent(new CustomEvent("game-error",{detail:{code:e.code,message:e.message||"An error occurred"}}))}handleNotInRoom(e){console.log("[BiggerDice] Not in room:",e),this.notInRoomInfo={room_id:e.room_id,room_name:e.room_name,is_password_protected:e.is_password_protected,status:e.status},this.showNotInRoomUI()}showNotInRoomUI(){this.notInRoomInfo&&(this.elements.waitingForAdmin.classList.add("hidden"),this.elements.adminLobby.classList.add("hidden"),this.elements.waitingState.classList.add("hidden"),this.elements.gameBoard.classList.add("hidden"),this.elements.notInRoomState.classList.remove("hidden"),this.wantsToSpectate?(this.elements.enterRoomBtnText.textContent="Watch as Spectator",this.elements.notInRoomHint.textContent="You will join as a spectator and watch the game."):this.notInRoomInfo.is_password_protected?(this.elements.enterRoomBtnText.textContent="Enter Room (Password Required)",this.elements.notInRoomHint.textContent="This room is password protected."):(this.elements.enterRoomBtnText.textContent="Enter Room",this.elements.notInRoomHint.textContent=""),this.elements.headerTitle.textContent=this.notInRoomInfo.room_name||"Bigger Dice",this.elements.gameStatus.textContent=this.formatStatus(this.notInRoomInfo.status))}handleEnterRoomClick(){if(this.notInRoomInfo)if(this.notInRoomInfo.is_password_protected&&!this.wantsToSpectate)this.showJoinPasswordModal(this.notInRoomInfo.room_id,this.notInRoomInfo.room_name);else{const e=this.wantsToSpectate?"games.command.join_as_spectator":"games.command.join_room";this.send({type:e,room_name:this.notInRoomInfo.room_name})}}sendReady(){this.send({type:"games.command.ready",room_id:this.roomId}),this.elements.readyBtn.disabled=!0}sendRoll(){this.send({type:"games.command.bigger_dice.roll",room_id:this.roomId}),this.elements.rollBtn.disabled=!0}leaveGame(){this.send({type:"games.command.leave_room",room_id:this.roomId}),this.chatHistoryRequested={lobby:!1,players:!1,spectators:!1},this.chatMessages={lobby:[],players:[],spectators:[]},this.dispatchEvent(new CustomEvent("game-leave"))}selectPlayer(e){this.isAdmin&&this.send({type:"games.command.select_player",room_id:this.roomId,target_user_id:String(e)})}kickPlayer(e){this.isAdmin&&this.send({type:"games.command.kick_player",room_id:this.roomId,target_user_id:String(e)})}banPlayer(e){this.isAdmin&&this.send({type:"games.command.ban_player",room_id:this.roomId,target_user_id:String(e)})}unbanPlayer(e){this.isAdmin&&this.send({type:"games.command.unban_player",room_id:this.roomId,target_user_id:String(e)})}updateGameUI(){const e=this.elements.gameStatus,t=this.elements.waitingForAdmin,a=this.elements.adminLobby,s=this.elements.waitingState,i=this.elements.notInRoomState,o=this.elements.gameBoard;if(this.notInRoomInfo)return;e.textContent=this.formatStatus(this.gameStatus),e.className=`game-status game-status--${this.gameStatus}`;const c=this.players.length<2,r=this.lobby.some(n=>String(n.user_id)===String(this.myPlayerId)),d=this.players.some(n=>String(n.user_id||n.id)===String(this.myPlayerId));t.classList.add("hidden"),a.classList.add("hidden"),s.classList.add("hidden"),i.classList.add("hidden"),o.classList.add("hidden"),c?this.isAdmin?(a.classList.remove("hidden"),this.renderAdminLobby()):r?(t.classList.remove("hidden"),this.renderWaitingPlayersList()):s.classList.remove("hidden"):o.classList.remove("hidden"),this.renderPlayersArea(),this.renderDisconnectOverlay(),this.updateTurnIndicator(),this.updateButtons(),this.elements.roundInfo.textContent=`Round ${this.round} / First to 10`}renderAdminLobby(){const e=this.elements.lobbyPlayersList,t=this.elements.lobbyCount,a=this.lobby.length,s=this.spectators.length,i=a+s;if(t.textContent=s>0?`${a} waiting, ${s} spectator${s>1?"s":""}`:`${a} waiting`,i===0)e.innerHTML=`
        <div class="lobby-empty">
          <div class="lobby-empty__icon">👥</div>
          <p>No players waiting. Share the room link to invite players!</p>
        </div>
      `;else{const o=this.lobby.map(r=>{const d=(r.username||"U").charAt(0).toUpperCase(),n=r.is_ready===!0,m=String(r.user_id)===String(this.hostId),h=String(r.user_id)===String(this.myPlayerId);let p="";m&&(p+='<span class="admin-badge">👑 Admin</span> '),n?p+='<span class="ready-badge">✓ Ready</span>':p+='<span class="waiting-badge">Waiting...</span>';let l="";return h?l=`
            <button class="select-btn" data-action="select" data-user-id="${r.user_id}">Select Myself</button>
            ${this.allowSpectators?`<button class="kick-btn" data-action="become-spectator" data-user-id="${r.user_id}">Become Spectator</button>`:""}
          `:l=`
            <button class="select-btn" data-action="select" data-user-id="${r.user_id}">Select</button>
            <button class="kick-btn" data-action="kick" data-user-id="${r.user_id}">Kick</button>
            <button class="ban-btn" data-action="ban" data-user-id="${r.user_id}">Ban</button>
          `,`
          <div class="lobby-player ${n?"lobby-player--ready":""} ${m?"lobby-player--admin":""}" data-user-id="${r.user_id}">
            <div class="lobby-player__info">
              <div class="lobby-player__avatar ${m?"lobby-player__avatar--admin":""}">${d}</div>
              <div>
                <div class="lobby-player__name">${this.escapeHtml(r.username)} ${p}</div>
                <div class="lobby-player__joined">${n?"Player is ready to start":m?"Room host - select players to start":"Waiting for player to ready up"}</div>
              </div>
            </div>
            <div class="lobby-player__actions">
              ${l}
            </div>
          </div>
        `}).join(""),c=this.spectators.map(r=>{const d=(r.username||"U").charAt(0).toUpperCase(),n=String(r.user_id)===String(this.hostId),m=String(r.user_id)===String(this.myPlayerId);let h="";n&&(h+='<span class="admin-badge">👑 Admin</span> '),h+='<span class="spectator-badge">👁 Spectator</span>';let p="";return m?p=`
            <button class="select-btn" data-action="become-player" data-user-id="${r.user_id}">Join as Player</button>
          `:p=`
            <button class="select-btn" data-action="select-spectator" data-user-id="${r.user_id}">Select to Play</button>
            <button class="kick-btn" data-action="kick-spectator" data-user-id="${r.user_id}">Remove</button>
            <button class="ban-btn" data-action="ban" data-user-id="${r.user_id}">Ban</button>
          `,`
          <div class="lobby-player lobby-player--spectator ${n?"lobby-player--admin":""}" data-user-id="${r.user_id}">
            <div class="lobby-player__info">
              <div class="lobby-player__avatar lobby-player__avatar--spectator ${n?"lobby-player__avatar--admin":""}">${d}</div>
              <div>
                <div class="lobby-player__name">${this.escapeHtml(r.username)} ${h}</div>
                <div class="lobby-player__joined">${n?"Room host - watching as spectator":"Watching the game (can be selected to play)"}</div>
              </div>
            </div>
            <div class="lobby-player__actions">
              ${p}
            </div>
          </div>
        `}).join("");e.innerHTML=o+c,e.querySelectorAll("[data-action]").forEach(r=>{r.addEventListener("click",d=>{const n=d.target.dataset.action,m=parseInt(d.target.dataset.userId,10);n==="select"?this.selectPlayer(m):n==="select-spectator"?this.selectSpectator(m):n==="kick"?this.kickPlayer(m):n==="kick-spectator"?this.kickSpectator(m):n==="ban"?this.banPlayer(m):n==="become-spectator"?this.becomeSpectator():n==="become-player"&&this.becomePlayer()})})}this.renderBannedPlayersList()}kickSpectator(e){console.log("[BiggerDice] Kicking spectator:",e),this.send({type:"games.command.kick_spectator",room_id:this.roomId,target_user_id:e})}selectSpectator(e){console.log("[BiggerDice] Selecting spectator to play:",e),this.send({type:"games.command.select_spectator",room_id:this.roomId,target_user_id:e})}becomeSpectator(){console.log("[BiggerDice] Admin becoming spectator"),this.send({type:"games.command.become_spectator",room_id:this.roomId})}becomePlayer(){console.log("[BiggerDice] Admin becoming player from spectator"),this.send({type:"games.command.become_player",room_id:this.roomId})}renderBannedPlayersList(){const e=this.elements.bannedPlayersSection,t=this.elements.bannedCount,a=this.elements.bannedPlayersList;if(!e||!a)return;const s=this.bannedPlayers.length;if(s===0){e.classList.add("hidden");return}e.classList.remove("hidden"),t.textContent=`${s} banned`,a.innerHTML=this.bannedPlayers.map(i=>{const o=(i.username||"U").charAt(0).toUpperCase();return`
        <div class="banned-player" data-user-id="${i.user_id}">
          <div class="banned-player__info">
            <div class="banned-player__avatar">${o}</div>
            <span class="banned-player__name">${this.escapeHtml(i.username)}</span>
          </div>
          <button class="unban-btn" data-action="unban" data-user-id="${i.user_id}">Unban</button>
        </div>
      `}).join(""),a.querySelectorAll('[data-action="unban"]').forEach(i=>{i.addEventListener("click",o=>{const c=parseInt(o.target.dataset.userId,10);this.unbanPlayer(c)})})}renderWaitingPlayersList(){const e=this.elements.waitingPlayersList;if(e){if(this.lobby.length===0){e.innerHTML="";return}e.innerHTML=`
      <div style="font-weight: 600; margin-bottom: 0.5rem; font-size: 0.875rem;">Players in lobby:</div>
      ${this.lobby.map(t=>{const a=t.is_ready===!0,s=String(t.user_id)===String(this.myPlayerId),i=String(t.user_id)===String(this.hostId);let o="";return i&&(o+='<span class="admin-badge" style="margin-right: 0.25rem;">👑 Admin</span>'),s&&(o+='<span style="color: var(--primary-color);">(you)</span>'),`
          <div class="waiting-player ${a?"waiting-player--ready":""} ${i?"waiting-player--admin":""}">
            <span class="waiting-player__name">${this.escapeHtml(t.username)} ${o}</span>
            <span class="waiting-player__status ${a?"waiting-player__status--ready":"waiting-player__status--waiting"}">
              ${a?"✓ Ready":i?"Host":"Waiting..."}
            </span>
          </div>
        `}).join("")}
    `}}renderPlayersArea(){const e=this.elements.playersArea;if(!e)return;const t=[];for(let a=0;a<this.maxPlayers;a++){const s=this.players[a];if(s){const i=s.username||s.name||"Player",o=s.user_id||s.id,c=String(o),r=String(this.currentTurn)===String(o),d=s.is_ready===!0,n=s.score||0,m=i.charAt(0)?.toUpperCase()||"?",h=this.disconnectedPlayers.get(c),p=!!h,l=this.autoPlayers.has(c),u=p?this.getDisconnectSecondsLeft(h.timeoutAt):0,v=p&&this.canKickDisconnected(c,h.timeoutAt);t.push(`
          <div class="player-card ${r?"player-card--active":""} ${p?"player-card--disconnected":""} ${l?"player-card--auto":""}" data-player-id="${o}">
            <div class="player-avatar">${this.escapeHtml(m)}</div>
            <div class="player-name">${this.escapeHtml(i)}</div>
            <div class="player-score">${n}</div>
            <div class="player-label">Points</div>
            <div class="player-ready ${d?"":"hidden"}">Ready!</div>
            ${l?'<div class="player-card__auto">Auto</div>':""}
            ${p?`
              <div class="player-card__disconnect">
                <div class="disconnect-spinner" aria-hidden="true"></div>
                <div class="disconnect-timer">
                  ${u>0?`Reconnecting... ${u}s`:"Disconnected"}
                </div>
                ${v?`
                  <button class="kick-btn" data-action="kick-disconnected" data-user-id="${c}">Kick</button>
                `:""}
              </div>
            `:""}
          </div>
        `)}else t.push(`
          <div class="player-card player-card--empty">
            <div class="player-avatar">?</div>
            <div class="player-name">Waiting...</div>
            <div class="player-score">0</div>
            <div class="player-label">Points</div>
            <div class="player-ready hidden">Ready!</div>
          </div>
        `);a<this.maxPlayers-1&&t.push('<div class="vs-indicator">VS</div>')}e.innerHTML=t.join("")}renderDisconnectOverlay(){const e=this.elements.disconnectOverlay;if(!e)return;const t=String(this.myPlayerId),a=this.players.some(d=>String(d.user_id||d.id)===t),s=Array.from(this.disconnectedPlayers.entries()).filter(([d])=>d!==t&&!this.autoPlayers.has(d)),i=this.gameStatus===g.PLAYING&&a&&!this.isSpectator&&s.length>0;if(e.classList.toggle("active",i),e.setAttribute("aria-hidden",String(!i)),!i)return;e.querySelector(".disconnect-modal")||(e.innerHTML=`
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
      `);const o=e.querySelector(".disconnect-list");if(!o)return;const c=new Set(s.map(([d])=>d));(c.size!==this.disconnectOverlayIds.size||Array.from(c).some(d=>!this.disconnectOverlayIds.has(d)))&&(o.innerHTML=s.map(([d])=>{const n=this.players.find(h=>String(h.user_id||h.id)===d),m=n?.username||n?.name||`User #${d}`;return`
          <div class="disconnect-item" data-user-id="${d}">
            <div class="disconnect-item__left">
              <div class="disconnect-item__name">${this.escapeHtml(m)}</div>
              <div class="disconnect-item__timer" data-role="timer">Disconnected</div>
            </div>
            <div data-role="action"></div>
          </div>
        `}).join(""),this.disconnectOverlayIds=c),s.forEach(([d,n])=>{const m=o.querySelector(`.disconnect-item[data-user-id="${d}"]`);if(!m)return;const h=m.querySelector('[data-role="timer"]'),p=m.querySelector('[data-role="action"]'),l=this.getDisconnectSecondsLeft(n.timeoutAt),u=this.canKickDisconnected(d,n.timeoutAt),v=this.kickVotes.has(d);h&&(h.textContent=l>0?`Reconnecting... ${l}s`:"Disconnected"),p&&(l>0?p.innerHTML='<div class="disconnect-item__status">Waiting</div>':v?p.innerHTML='<div class="disconnect-voted">Vote sent</div>':u?p.innerHTML=`<button class="kick-btn" data-action="kick-disconnected" data-user-id="${d}">Kick disconnected</button>`:p.innerHTML="")})}updateTurnIndicator(){const e=this.elements.turnIndicator;if(this.gameStatus!==g.PLAYING){e.classList.add("hidden");return}if(e.classList.remove("hidden"),String(this.currentTurn)===String(this.myPlayerId))e.textContent="Your turn - Roll the dice!",e.style.borderColor="var(--success-color)";else{const t=this.players.find(s=>String(s.user_id||s.id)===String(this.currentTurn)),a=t?.username||t?.name||"Opponent";e.textContent=`${a}'s turn...`,e.style.borderColor="var(--primary-color)"}}updateButtons(){const e=this.elements.readyBtn,t=this.elements.rollBtn;if(this.isSpectator||this.autoPlayers.has(String(this.myPlayerId))){e?.classList.add("hidden"),t?.classList.add("hidden");return}const a=this.players.find(i=>String(i.user_id||i.id)===String(this.myPlayerId));if(!!!a){e?.classList.add("hidden"),t?.classList.add("hidden");return}this.gameStatus===g.WAITING?(t?.classList.add("hidden"),a&&!a.is_ready?(e?.classList.remove("hidden"),e.disabled=!1):e?.classList.add("hidden")):this.gameStatus===g.PLAYING?(e?.classList.add("hidden"),t?.classList.remove("hidden"),t.disabled=String(this.currentTurn)!==String(this.myPlayerId)):(e?.classList.add("hidden"),t?.classList.add("hidden"))}startDisconnectTicker(){this.disconnectTicker||(this.disconnectTicker=setInterval(()=>{if(this.disconnectedPlayers.size===0){this.stopDisconnectTickerIfNeeded();return}this.renderPlayersArea(),this.renderDisconnectOverlay()},1e3))}stopDisconnectTickerIfNeeded(){this.disconnectedPlayers.size===0&&this.disconnectTicker&&(clearInterval(this.disconnectTicker),this.disconnectTicker=null)}getDisconnectSecondsLeft(e){if(!e)return 0;const t=e.getTime()-Date.now();return Math.max(0,Math.ceil(t/1e3))}canKickDisconnected(e,t){const a=String(e);return!this.isPlayer||this.isSpectator||String(this.myPlayerId)===a||this.kickVotes.has(a)||this.gameStatus!==g.PLAYING?!1:this.getDisconnectSecondsLeft(t)===0}sendKickDisconnected(e){const t=String(e);this.roomId&&(this.kickVotes.has(t)||(this.kickVotes.add(t),this.send({type:"games.command.vote_kick_disconnected",room_id:this.roomId,target_user_id:t}),this.updateGameUI()))}animateDiceRoll(e,t){e.classList.add("dice--rolling");let a=0;const s=10,i=setInterval(()=>{const o=Math.floor(Math.random()*6)+1;e.dataset.value=o,a++,a>=s&&(clearInterval(i),e.classList.remove("dice--rolling"),e.dataset.value=t)},100)}showRoundResult(e){const t=this.elements.resultOverlay,a=this.players[0],s=this.players[1],i=a?.username||a?.name||"Player 1",o=s?.username||s?.name||"Player 2",c=String(e.winner_id)===String(this.myPlayerId);this.elements.resultIcon.textContent=c?"🎉":e.winner_id?"😢":"🤝",this.elements.resultTitle.textContent=c?"You Won!":e.winner_id?"You Lost":"Tie!",this.elements.resultScore1.textContent=a?.score||0,this.elements.resultLabel1.textContent=i,this.elements.resultScore2.textContent=s?.score||0,this.elements.resultLabel2.textContent=o,this.elements.resultMessage.textContent=`Round ${this.round} complete`,t.classList.add("active")}showGameOverResult(e){const t=this.elements.gameBoard,a=String(this.myPlayerId),s=e.winner_id||e.winner,i=this.players.find(l=>String(l.id||l.user_id)===String(s)),o=e.winner_name||i?.username||i?.name||"Winner",c=String(s)===a,r=Math.max(...this.players.map(l=>l.score||0));this.players.forEach(l=>l.is_ready=!1);const d=this.players.findIndex(l=>String(l.user_id||l.id)===a),n=this.players.map((l,u)=>{const v=l.username||l.name||`Player ${u+1}`,f=l.score||0;return`
        <div class="game-over__player ${f===r&&f>0?"game-over__player--winner":""}">
          <div class="game-over__player-name">${this.escapeHtml(v)}</div>
          <div class="game-over__player-score">${f}</div>
          <div class="game-over__ready-indicator" id="player${u}ReadyIndicator">
            <span class="game-over__ready-dot"></span>
            <span class="game-over__ready-text">Waiting...</span>
          </div>
        </div>
      `}).join(this.players.length===2?'<div class="game-over__vs">vs</div>':""),m=this.roundHistory.length>0?`
      <div class="game-over__history">
        <h4 class="game-over__history-title">Round Results</h4>
        <table class="game-over__table">
          <thead>
            <tr>
              <th>Round</th>
              ${this.players.map((l,u)=>`<th>${this.escapeHtml(l.username||l.name||`P${u+1}`)}</th>`).join("")}
              <th>Winner</th>
            </tr>
          </thead>
          <tbody>
            ${this.roundHistory.map(l=>`
              <tr class="${l.winnerId===a?"game-over__row--win":""}">
                <td>${l.round}</td>
                ${l.rolls?l.rolls.map((u,v)=>`
                  <td class="${l.winnerId===String(this.players[v]?.id||this.players[v]?.user_id)?"game-over__cell--winner":""}">${u}</td>
                `).join(""):`
                  <td class="${l.winnerId===l.player1?.id?"game-over__cell--winner":""}">${l.player1?.roll||"-"}</td>
                  <td class="${l.winnerId===l.player2?.id?"game-over__cell--winner":""}">${l.player2?.roll||"-"}</td>
                `}
                <td>${l.winnerName?this.escapeHtml(l.winnerName):"-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `:"";t.innerHTML=`
      <div class="game-over">
        <div class="game-over__header">
          <div class="game-over__icon">${c?"🏆":"🥈"}</div>
          <h2 class="game-over__title">${c?"Victory!":"Game Over"}</h2>
          <p class="game-over__subtitle">${this.escapeHtml(o)} wins the game!</p>
        </div>

        <div class="game-over__scores ${this.players.length>2?"game-over__scores--multi":""}">
          ${n}
        </div>

        ${m}

        <div class="game-over__actions">
          <button class="game-over__btn game-over__btn--primary" id="playAgainBtn">Play Again</button>
          <button class="game-over__btn game-over__btn--secondary" id="returnToLobbyBtn">Return to Lobby</button>
        </div>
      </div>
    `;const h=t.querySelector("#playAgainBtn"),p=t.querySelector("#returnToLobbyBtn");h&&h.addEventListener("click",()=>{this.send({type:"games.command.ready",room_id:this.roomId});const l=this.players.find(u=>String(u.user_id||u.id)===a);if(l&&(l.is_ready=!0),h.disabled=!0,h.textContent=`Waiting for ${this.players.length-1} player(s)...`,d!==-1){const u=t.querySelector(`#player${d}ReadyIndicator`);u&&(u.classList.add("game-over__ready-indicator--ready"),u.querySelector(".game-over__ready-text").textContent="Ready!")}console.log("[BiggerDice] Sent play again ready signal")}),p&&p.addEventListener("click",()=>{this.leaveGame()}),t.classList.remove("hidden")}hideResultOverlay(){this.elements.resultOverlay.classList.remove("active")}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}formatStatus(e){return{waiting:"Waiting",playing:"Playing",in_progress:"In Progress",finished:"Finished",abandoned:"Abandoned"}[e]||e}}customElements.get("bigger-dice")||customElements.define("bigger-dice",w),console.log("[BIGGER_DICE] Web component registered")})();
