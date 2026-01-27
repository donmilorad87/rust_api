(function(){"use strict";const v=document.createElement("template");v.innerHTML=`
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
       LOBBY TABS STYLES
       ============================================ */

    .lobby-tabs {
      display: flex;
      gap: 0;
      margin-bottom: 1.5rem;
      border-bottom: 2px solid var(--border-color);
    }

    .lobby-tab {
      padding: 0.75rem 1.5rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border: none;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
    }

    .lobby-tab:hover {
      color: var(--text-color);
    }

    .lobby-tab.active {
      color: var(--primary-color);
      border-bottom-color: var(--primary-color);
    }

    .lobby-tab-content {
      display: none;
    }

    .lobby-tab-content.active {
      display: block;
    }

    /* ============================================
       GAME HISTORY STYLES
       ============================================ */

    .history-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .history-back-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 0.5rem;
      background: var(--card-bg);
      color: var(--text-color);
      cursor: pointer;
      transition: background 0.2s;
    }

    .history-back-btn:hover {
      background: var(--border-color);
    }

    .history-back-btn svg {
      width: 20px;
      height: 20px;
    }

    .history-title {
      font-size: 1.25rem;
      font-weight: 600;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .history-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 0.75rem;
      cursor: pointer;
      transition: border-color 0.2s, transform 0.2s;
    }

    .history-item:hover {
      border-color: var(--primary-color);
      transform: translateY(-1px);
    }

    .history-item__main {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .history-item__room {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .history-item__date {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .history-item__result {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .history-item__score {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text-color);
    }

    .history-item__badge {
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .history-item__badge--win {
      background: rgba(34, 197, 94, 0.15);
      color: var(--success-color);
    }

    .history-item__badge--loss {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger-color);
    }

    .history-item__badge--draw {
      background: rgba(148, 163, 184, 0.15);
      color: var(--text-muted);
    }

    .history-empty {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
    }

    .history-empty__icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .history-empty__title {
      font-size: 1.125rem;
      font-weight: 600;
      color: var(--text-color);
      margin-bottom: 0.5rem;
    }

    .history-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 1rem;
      gap: 1rem;
      color: var(--text-muted);
    }

    .history-pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    .history-pagination__btn {
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      font-weight: 500;
      border: 1px solid var(--border-color);
      border-radius: 0.375rem;
      background: transparent;
      color: var(--text-color);
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
      min-width: 2.5rem;
    }

    .history-pagination__btn:hover:not(:disabled) {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: #fff;
    }

    .history-pagination__btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .history-pagination__btn--active {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: #fff;
      cursor: default;
      pointer-events: none;
    }

    .history-pagination__pages {
      display: flex;
      gap: 0.25rem;
    }

    .history-pagination__goto {
      display: flex;
      gap: 0.25rem;
      margin-left: 0.5rem;
    }

    .history-pagination__input {
      width: 60px;
      padding: 0.5rem;
      font-size: 0.875rem;
      border: 1px solid var(--border-color);
      border-radius: 0.375rem;
      background: transparent;
      color: var(--text-color);
      text-align: center;
    }

    .history-pagination__input::-webkit-inner-spin-button,
    .history-pagination__input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .history-pagination__input[type=number] {
      -moz-appearance: textfield;
    }

    @media (max-width: 600px) {
      .history-pagination__btn--first,
      .history-pagination__btn--last {
        display: none;
      }
      .history-pagination__goto {
        width: 100%;
        justify-content: center;
        margin-top: 0.5rem;
        margin-left: 0;
      }
    }

    /* Game Details View */
    .history-details {
      display: none;
    }

    .history-details.active {
      display: block;
    }

    .history-details__summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: var(--card-bg);
      border-radius: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .history-details__players {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .history-details__player {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .history-details__player-name {
      font-size: 0.875rem;
      font-weight: 600;
    }

    .history-details__player-score {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .history-details__player--winner .history-details__player-score {
      color: var(--success-color);
    }

    .history-details__vs {
      font-size: 0.875rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .history-details__info {
      text-align: right;
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .history-rounds {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .history-rounds__title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    .history-round {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      background: var(--card-bg);
      border-radius: 0.5rem;
      gap: 1rem;
    }

    .history-round__number {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      min-width: 60px;
    }

    .history-round__rolls {
      flex: 1;
      display: flex;
      gap: 1rem;
    }

    .history-round__roll {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.875rem;
    }

    .history-round__roll-value {
      font-weight: 700;
      min-width: 20px;
      text-align: center;
    }

    .history-round__roll--winner {
      color: var(--success-color);
    }

    .history-round__winner {
      font-size: 0.75rem;
      color: var(--success-color);
      font-weight: 500;
    }

    .history-round--tiebreaker {
      border-left: 3px solid var(--warning-color);
    }

    .history-round__tiebreaker-badge {
      font-size: 0.625rem;
      padding: 0.125rem 0.375rem;
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning-color);
      border-radius: 0.25rem;
      text-transform: uppercase;
      font-weight: 600;
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
      <!-- Lobby Tabs -->
      <div class="lobby-tabs">
        <button class="lobby-tab active" data-tab="rooms" id="tabRooms">Game Lobby</button>
        <button class="lobby-tab" data-tab="history" id="tabHistory">Game History</button>
      </div>

      <!-- Tab Content: Game Lobby -->
      <div class="lobby-tab-content active" id="tabContentRooms">
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
      </div>

      <!-- Tab Content: Game History -->
      <div class="lobby-tab-content" id="tabContentHistory">
        <!-- History List View -->
        <div id="historyListView">
          <div class="history-header">
            <h2 class="history-title">Your Game History</h2>
          </div>

          <div id="historyLoading" class="history-loading">
            <div class="spinner"></div>
            <p>Loading game history...</p>
          </div>

          <div id="historyEmpty" class="history-empty hidden">
            <div class="history-empty__icon">📜</div>
            <h3 class="history-empty__title">No Games Yet</h3>
            <p>Play some games to see your history here!</p>
          </div>

          <div id="historyList" class="history-list hidden"></div>

          <nav id="historyPagination" class="history-pagination hidden" aria-label="Pagination">
            <button class="history-pagination__btn history-pagination__btn--first" id="historyFirstBtn" aria-label="Go to first page" disabled>First</button>
            <button class="history-pagination__btn history-pagination__btn--prev" id="historyPrevBtn" aria-label="Go to previous page" disabled>Prev</button>
            <div class="history-pagination__pages" id="historyPages"></div>
            <button class="history-pagination__btn history-pagination__btn--next" id="historyNextBtn" aria-label="Go to next page" disabled>Next</button>
            <button class="history-pagination__btn history-pagination__btn--last" id="historyLastBtn" aria-label="Go to last page" disabled>Last</button>
            <div class="history-pagination__goto">
              <input type="number" class="history-pagination__input" id="historyPageInput" min="1" placeholder="Page" aria-label="Go to page number">
              <button class="history-pagination__btn" id="historyGoBtn" aria-label="Go to entered page">Go</button>
            </div>
          </nav>
        </div>

        <!-- History Details View -->
        <div id="historyDetailsView" class="history-details">
          <div class="history-header">
            <button class="history-back-btn" id="historyBackBtn">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <h2 class="history-title">Game Details</h2>
          </div>

          <div id="historyDetailsSummary" class="history-details__summary"></div>

          <div class="history-rounds">
            <h3 class="history-rounds__title">Round Results</h3>
            <div id="historyRoundsList"></div>
          </div>
        </div>
      </div>
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
`;const y={DISCONNECTED:"disconnected",CONNECTING:"connecting",CONNECTED:"connected",RECONNECTING:"reconnecting"},g={WAITING:"waiting",PLAYING:"playing",FINISHED:"finished"},f={LOBBY:"lobby",GAME:"game"};class _ extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.shadowRoot.appendChild(v.content.cloneNode(!0)),this.mode=f.GAME,this.connectionState=y.DISCONNECTED,this.ws=null,this.reconnectAttempts=0,this.maxReconnectAttempts=5,this.reconnectDelay=1e3,this.heartbeatInterval=null,this.heartbeatTimeout=null,this.availableRooms=[],this.pendingJoinRoomId=null,this.pendingJoinRoomName=null,this.pendingJoinAsSpectator=!1,this.notInRoomInfo=null,this.wantsToSpectate=!1,this.roomId="",this.roomName="",this.players=[],this.lobby=[],this.bannedPlayers=[],this.spectators=[],this.hostId=null,this.isAdmin=!1,this.maxPlayers=2,this.allowSpectators=!0,this.gameStatus=g.WAITING,this.currentTurn=null,this.round=0,this.myPlayerId=null,this.roundHistory=[],this.lastDiceState=null,this.diceElements=[],this.disconnectedPlayers=new Map,this.kickVotes=new Set,this.autoPlayers=new Set,this.pendingAutoRoll=null,this.autoRollTimeoutId=null,this.isAnimating=!1,this.animationPromise=null,this.rollEventQueue=[],this.roundEndedWithWinner=!1,this.disconnectTicker=null,this.disconnectOverlayIds=new Set,this.windowEventsBound=!1,this.hasSentDisconnectIntent=!1,this.isNavigatingToOwnRoom=!1,this.handlePageHide=null,this.handleBeforeUnload=null,this.handleOffline=null,this.turnTimer=null,this.turnTimeRemaining=0,this.turnTimerDuration=5,this.gameConfig={entry_fee_cents:1e3,ready_timeout_seconds:30,winning_percentage:60},this.readyTimer=null,this.readyTimeRemaining=0,this.readyTimerDuration=30,this.chatChannel="lobby",this.chatMessages={lobby:[],players:[],spectators:[]},this.chatHistoryRequested={lobby:!1,players:!1,spectators:!1},this.chatUnreadCounts={lobby:0,players:0,spectators:0},this.mutedUsers=new Set,this.isChatCollapsed=!1,this.isPlayer=!1,this.isSpectator=!1,this.historyTab="rooms",this.historyView="list",this.historyGames=[],this.historyPage=1,this.historyTotalPages=1,this.historyLoading=!1,this.selectedHistoryGame=null,this.cacheElements(),this.bindEvents()}static get observedAttributes(){return["data-ws-url","data-room-id","data-room-name","data-user-id","data-username","data-avatar-id","data-balance","data-mode","data-spectate"]}connectedCallback(){this.wsUrl=this.dataset.wsUrl,this.roomId=this.dataset.roomId||"",this.roomName=this.dataset.roomName||"",this.userId=this.dataset.userId,this.username=this.dataset.username,this.avatarId=this.dataset.avatarId,this.myPlayerId=this.userId,this.mode=this.dataset.mode==="lobby"?f.LOBBY:f.GAME,this.wantsToSpectate=this.dataset.spectate==="true",this.fetchGameConfig(),this.setupModeUI(),this.bindWindowEvents(),this.wsUrl&&this.connect()}disconnectedCallback(){this.unbindWindowEvents(),this.disconnect(),this.autoRollTimeoutId&&(clearTimeout(this.autoRollTimeoutId),this.autoRollTimeoutId=null),this.pendingAutoRoll=null,this.stopReadyTimer()}cacheElements(){const e=t=>{const i=this.shadowRoot.getElementById(t);return i||console.warn(`[BiggerDice] Element not found: ${t}`),i};this.elements={headerTitle:e("headerTitle"),gameStatus:e("gameStatus"),connectionDot:e("connectionDot"),connectionText:e("connectionText"),lobbySection:e("lobbySection"),createRoomBtn:e("createRoomBtn"),loadingState:e("loadingState"),emptyState:e("emptyState"),roomsGrid:e("roomsGrid"),createRoomModal:e("createRoomModal"),createRoomForm:e("createRoomForm"),roomNameInput:e("roomNameInput"),roomPasswordInput:e("roomPasswordInput"),playerCountInput:e("playerCountInput"),allowSpectatorsInput:e("allowSpectatorsInput"),modalCloseBtn:e("modalCloseBtn"),modalCancelBtn:e("modalCancelBtn"),modalCreateBtn:e("modalCreateBtn"),joinPasswordModal:e("joinPasswordModal"),joinPasswordForm:e("joinPasswordForm"),joinPasswordInput:e("joinPasswordInput"),joinPasswordError:e("joinPasswordError"),joinPasswordCloseBtn:e("joinPasswordCloseBtn"),joinPasswordCancelBtn:e("joinPasswordCancelBtn"),createConfirmModal:e("createConfirmModal"),createConfirmLoader:e("createConfirmLoader"),createConfirmMessage:e("createConfirmMessage"),createConfirmCloseBtn:e("createConfirmCloseBtn"),createConfirmCancelBtn:e("createConfirmCancelBtn"),createConfirmBtn:e("createConfirmBtn"),joinConfirmModal:e("joinConfirmModal"),joinConfirmLoader:e("joinConfirmLoader"),joinConfirmMessage:e("joinConfirmMessage"),joinConfirmCloseBtn:e("joinConfirmCloseBtn"),joinConfirmCancelBtn:e("joinConfirmCancelBtn"),joinConfirmBtn:e("joinConfirmBtn"),gameSection:e("gameSection"),waitingForAdmin:e("waitingForAdmin"),waitingPlayersList:e("waitingPlayersList"),adminLobby:e("adminLobby"),lobbyCount:e("lobbyCount"),lobbyPlayersList:e("lobbyPlayersList"),bannedPlayersSection:e("bannedPlayersSection"),bannedCount:e("bannedCount"),bannedPlayersList:e("bannedPlayersList"),waitingState:e("waitingState"),notInRoomState:e("notInRoomState"),enterRoomBtn:e("enterRoomBtn"),enterRoomBtnText:e("enterRoomBtnText"),notInRoomHint:e("notInRoomHint"),spectatorOptionContainer:e("spectatorOptionContainer"),joinAsSpectatorCheckbox:e("joinAsSpectatorCheckbox"),gameBoard:e("gameBoard"),turnIndicator:e("turnIndicator"),playersArea:e("playersArea"),diceContainer:e("diceContainer"),readyBtn:e("readyBtn"),actionButtons:e("actionButtons"),rollBtn:e("rollBtn"),autoPlayBtn:e("autoPlayBtn"),turnTimer:e("turnTimer"),turnTimerProgress:e("turnTimerProgress"),turnTimerText:e("turnTimerText"),readyTimer:e("readyTimer"),readyTimerProgress:e("readyTimerProgress"),readyTimerText:e("readyTimerText"),roundInfo:e("roundInfo"),leaveBtn:e("leaveBtn"),disconnectOverlay:e("disconnectOverlay"),resultOverlay:e("resultOverlay"),resultIcon:e("resultIcon"),resultTitle:e("resultTitle"),resultScore1:e("resultScore1"),resultLabel1:e("resultLabel1"),resultScore2:e("resultScore2"),resultLabel2:e("resultLabel2"),resultMessage:e("resultMessage"),resultContinueBtn:e("resultContinueBtn"),resultLeaveBtn:e("resultLeaveBtn"),spectatorBanner:e("spectatorBanner"),requestToPlayBtn:e("requestToPlayBtn"),spectatorsPanel:e("spectatorsPanel"),spectatorsCount:e("spectatorsCount"),spectatorsList:e("spectatorsList"),gameFooter:e("gameFooter"),chatPanel:e("chatPanel"),chatTabLobby:e("chatTabLobby"),chatTabPlayers:e("chatTabPlayers"),chatTabSpectators:e("chatTabSpectators"),lobbyBadge:e("lobbyBadge"),playersBadge:e("playersBadge"),spectatorsBadge:e("spectatorsBadge"),chatToggle:e("chatToggle"),chatBody:e("chatBody"),chatMessages:e("chatMessages"),chatForm:e("chatForm"),chatInput:e("chatInput"),chatSend:e("chatSend"),tabRooms:e("tabRooms"),tabHistory:e("tabHistory"),tabContentRooms:e("tabContentRooms"),tabContentHistory:e("tabContentHistory"),historyListView:e("historyListView"),historyLoading:e("historyLoading"),historyEmpty:e("historyEmpty"),historyList:e("historyList"),historyPagination:e("historyPagination"),historyFirstBtn:e("historyFirstBtn"),historyPrevBtn:e("historyPrevBtn"),historyPages:e("historyPages"),historyNextBtn:e("historyNextBtn"),historyLastBtn:e("historyLastBtn"),historyPageInput:e("historyPageInput"),historyGoBtn:e("historyGoBtn"),historyDetailsView:e("historyDetailsView"),historyBackBtn:e("historyBackBtn"),historyDetailsSummary:e("historyDetailsSummary"),historyRoundsList:e("historyRoundsList")}}bindEvents(){console.log("[BiggerDice] Binding events..."),this.elements.createRoomBtn&&this.elements.createRoomBtn.addEventListener("click",()=>{console.log("[BiggerDice] Create room button clicked"),this.showCreateRoomModal()}),this.elements.modalCloseBtn&&this.elements.modalCloseBtn.addEventListener("click",()=>{console.log("[BiggerDice] Modal close button clicked"),this.hideCreateRoomModal()}),this.elements.modalCancelBtn&&this.elements.modalCancelBtn.addEventListener("click",()=>{console.log("[BiggerDice] Modal cancel button clicked"),this.hideCreateRoomModal()}),this.elements.createRoomForm&&this.elements.createRoomForm.addEventListener("submit",e=>{console.log("[BiggerDice] Form submitted"),e.preventDefault(),e.stopPropagation(),this.showCreateConfirmModal()}),this.elements.modalCreateBtn&&this.elements.modalCreateBtn.addEventListener("click",e=>{console.log("[BiggerDice] Create button clicked directly"),e.preventDefault(),e.stopPropagation(),this.showCreateConfirmModal()}),this.elements.createRoomModal&&this.elements.createRoomModal.addEventListener("click",e=>{e.target===this.elements.createRoomModal&&(console.log("[BiggerDice] Modal overlay clicked"),this.hideCreateRoomModal())}),this.elements.joinPasswordCloseBtn&&this.elements.joinPasswordCloseBtn.addEventListener("click",()=>this.hideJoinPasswordModal()),this.elements.joinPasswordCancelBtn&&this.elements.joinPasswordCancelBtn.addEventListener("click",()=>this.hideJoinPasswordModal()),this.elements.joinPasswordForm&&this.elements.joinPasswordForm.addEventListener("submit",e=>{e.preventDefault(),this.submitJoinWithPassword()}),this.elements.joinPasswordModal&&this.elements.joinPasswordModal.addEventListener("click",e=>{e.target===this.elements.joinPasswordModal&&this.hideJoinPasswordModal()}),this.elements.createConfirmCloseBtn&&this.elements.createConfirmCloseBtn.addEventListener("click",()=>this.hideCreateConfirmModal()),this.elements.createConfirmCancelBtn&&this.elements.createConfirmCancelBtn.addEventListener("click",()=>this.hideCreateConfirmModal()),this.elements.createConfirmBtn&&this.elements.createConfirmBtn.addEventListener("click",()=>{this.hideCreateConfirmModal(),this.createRoom()}),this.elements.createConfirmModal&&this.elements.createConfirmModal.addEventListener("click",e=>{e.target===this.elements.createConfirmModal&&this.hideCreateConfirmModal()}),this.elements.joinConfirmCloseBtn&&this.elements.joinConfirmCloseBtn.addEventListener("click",()=>this.hideJoinConfirmModal()),this.elements.joinConfirmCancelBtn&&this.elements.joinConfirmCancelBtn.addEventListener("click",()=>this.hideJoinConfirmModal()),this.elements.joinConfirmBtn&&this.elements.joinConfirmBtn.addEventListener("click",()=>{this.hideJoinConfirmModal(),this.executeJoinRoom()}),this.elements.joinConfirmModal&&this.elements.joinConfirmModal.addEventListener("click",e=>{e.target===this.elements.joinConfirmModal&&this.hideJoinConfirmModal()}),this.elements.readyBtn&&this.elements.readyBtn.addEventListener("click",()=>this.sendReady()),this.elements.rollBtn&&this.elements.rollBtn.addEventListener("click",()=>this.sendRoll()),this.elements.autoPlayBtn&&this.elements.autoPlayBtn.addEventListener("click",()=>this.sendEnableAutoPlay()),this.elements.leaveBtn&&this.elements.leaveBtn.addEventListener("click",()=>this.leaveGame()),this.elements.resultContinueBtn&&this.elements.resultContinueBtn.addEventListener("click",()=>this.hideResultOverlay()),this.elements.resultLeaveBtn&&this.elements.resultLeaveBtn.addEventListener("click",()=>this.leaveGame()),this.elements.enterRoomBtn&&this.elements.enterRoomBtn.addEventListener("click",()=>this.handleEnterRoomClick()),this.elements.joinAsSpectatorCheckbox&&this.elements.joinAsSpectatorCheckbox.addEventListener("change",e=>{this.wantsToSpectate=e.target.checked,this.updateEnterRoomButton()}),this.elements.requestToPlayBtn&&this.elements.requestToPlayBtn.addEventListener("click",()=>this.requestToPlay()),this.elements.tabRooms&&this.elements.tabRooms.addEventListener("click",()=>this.switchLobbyTab("rooms")),this.elements.tabHistory&&this.elements.tabHistory.addEventListener("click",()=>this.switchLobbyTab("history")),this.elements.historyBackBtn&&this.elements.historyBackBtn.addEventListener("click",()=>this.showHistoryList()),this.elements.historyFirstBtn&&this.elements.historyFirstBtn.addEventListener("click",()=>this.loadHistoryPage(1)),this.elements.historyPrevBtn&&this.elements.historyPrevBtn.addEventListener("click",()=>this.loadHistoryPage(this.historyPage-1)),this.elements.historyPages&&this.elements.historyPages.addEventListener("click",e=>{const t=e.target.closest(".history-pagination__btn[data-page]");if(t&&!t.disabled){const i=parseInt(t.dataset.page,10);this.loadHistoryPage(i)}}),this.elements.historyNextBtn&&this.elements.historyNextBtn.addEventListener("click",()=>this.loadHistoryPage(this.historyPage+1)),this.elements.historyLastBtn&&this.elements.historyLastBtn.addEventListener("click",()=>this.loadHistoryPage(this.historyTotalPages)),this.elements.historyGoBtn&&this.elements.historyGoBtn.addEventListener("click",()=>{const e=parseInt(this.elements.historyPageInput?.value,10);e>=1&&e<=this.historyTotalPages&&this.loadHistoryPage(e)}),this.elements.historyPageInput&&this.elements.historyPageInput.addEventListener("keydown",e=>{if(e.key==="Enter"){const t=parseInt(this.elements.historyPageInput?.value,10);t>=1&&t<=this.historyTotalPages&&this.loadHistoryPage(t)}}),this.elements.historyList&&this.elements.historyList.addEventListener("click",e=>{const t=e.target.closest(".history-item");t&&t.dataset.gameId&&this.showHistoryDetails(t.dataset.gameId)}),this.elements.chatTabLobby&&this.elements.chatTabLobby.addEventListener("click",()=>this.switchChatChannel("lobby")),this.elements.chatTabPlayers&&this.elements.chatTabPlayers.addEventListener("click",()=>this.switchChatChannel("players")),this.elements.chatTabSpectators&&this.elements.chatTabSpectators.addEventListener("click",()=>this.switchChatChannel("spectators")),this.elements.chatToggle&&this.elements.chatToggle.addEventListener("click",()=>this.toggleChat()),this.elements.chatForm&&this.elements.chatForm.addEventListener("submit",e=>{e.preventDefault(),this.sendChatMessage()}),this.elements.playersArea&&this.elements.playersArea.addEventListener("click",e=>{const t=e.target.closest('[data-action="kick-disconnected"]');if(!t)return;const i=t.dataset.userId;i&&this.sendKickDisconnected(i)}),this.elements.disconnectOverlay&&this.elements.disconnectOverlay.addEventListener("click",e=>{const t=e.target.closest('[data-action="kick-disconnected"]');if(!t)return;const i=t.dataset.userId;i&&this.sendKickDisconnected(i)}),console.log("[BiggerDice] Events bound successfully")}bindWindowEvents(){this.windowEventsBound||(this.handlePageHide=()=>this.notifyDisconnectIntent(),this.handleBeforeUnload=()=>this.notifyDisconnectIntent(),this.handleOffline=()=>{this.notifyDisconnectIntent(),this.ws?.close()},window.addEventListener("pagehide",this.handlePageHide),window.addEventListener("beforeunload",this.handleBeforeUnload),window.addEventListener("offline",this.handleOffline),this.windowEventsBound=!0)}unbindWindowEvents(){this.windowEventsBound&&(this.handlePageHide&&window.removeEventListener("pagehide",this.handlePageHide),this.handleBeforeUnload&&window.removeEventListener("beforeunload",this.handleBeforeUnload),this.handleOffline&&window.removeEventListener("offline",this.handleOffline),this.handlePageHide=null,this.handleBeforeUnload=null,this.handleOffline=null,this.windowEventsBound=!1)}notifyDisconnectIntent(){if(this.hasSentDisconnectIntent||!this.roomId)return;if(this.isNavigatingToOwnRoom){console.log("[BiggerDice] Skipping leave_room - navigating to own room");return}const e=this.lobby&&this.lobby.some(i=>String(i.user_id)===String(this.myPlayerId));(this.isSpectator||this.isPlayer||e)&&(this.hasSentDisconnectIntent=!0,console.log("[BiggerDice] Sending leave_room on navigation away",{isSpectator:this.isSpectator,isPlayer:this.isPlayer,isInLobby:e,roomId:this.roomId}),this.send({type:"games.command.leave_room",room_id:this.roomId}))}setupModeUI(){this.mode===f.LOBBY?(this.elements.lobbySection.classList.add("active"),this.elements.gameSection.classList.remove("active"),this.elements.headerTitle.textContent="Bigger Dice Lobby"):(this.elements.lobbySection.classList.remove("active"),this.elements.gameSection.classList.add("active"),this.elements.headerTitle.textContent=this.roomName||"Bigger Dice")}connect(){if(this.connectionState!==y.CONNECTING){this.setConnectionState(y.CONNECTING);try{this.ws=new WebSocket(this.wsUrl),this.ws.onopen=()=>this.handleOpen(),this.ws.onmessage=e=>this.handleMessage(e),this.ws.onclose=e=>this.handleClose(e),this.ws.onerror=e=>this.handleError(e)}catch(e){console.error("WebSocket connection error:",e),this.scheduleReconnect()}}}disconnect(){this.stopHeartbeat(),this.stopDisconnectTickerIfNeeded(),this.ws&&(this.ws.close(),this.ws=null),this.setConnectionState(y.DISCONNECTED)}handleOpen(){console.log("BiggerDice: WebSocket connected"),this.reconnectAttempts=0,this.startHeartbeat()}handleMessage(e){try{const t=JSON.parse(e.data);switch(console.log("BiggerDice: Received",t.type,t),t.type){case"system.welcome":this.handleWelcome(t);break;case"system.authenticated":this.handleAuthenticated(t);break;case"system.heartbeat_ack":this.handleHeartbeatAck();break;case"system.error":this.handleSystemError(t);break;case"room_list":case"games.event.room_list":this.handleRoomList(t.rooms);break;case"games.event.bigger_dice.room_created":this.handleRoomCreated(t);break;case"games.event.bigger_dice.room_joined":this.handleRoomJoined(t);break;case"games.event.bigger_dice.room_removed":this.handleRoomRemoved(t);break;case"games.event.bigger_dice.room_state":this.handleRoomState(t.room);break;case"games.event.bigger_dice.player_joined":this.handlePlayerJoined(t);break;case"games.event.bigger_dice.player_left":this.handlePlayerLeft(t);break;case"games.event.bigger_dice.player_disconnected":this.handlePlayerDisconnected(t);break;case"games.event.bigger_dice.player_rejoined":this.handlePlayerRejoined(t);break;case"games.event.bigger_dice.player_auto_enabled":this.handlePlayerAutoEnabled(t);break;case"games.event.bigger_dice.player_auto_disabled":this.handlePlayerAutoDisabled(t);break;case"games.event.bigger_dice.lobby_joined":this.handleLobbyJoined(t);break;case"games.event.bigger_dice.player_selected":this.handlePlayerSelected(t);break;case"games.event.bigger_dice.player_kicked":this.handlePlayerKicked(t);break;case"games.event.bigger_dice.player_banned":this.handlePlayerBanned(t);break;case"games.event.bigger_dice.player_unbanned":this.handlePlayerUnbanned(t);break;case"games.event.bigger_dice.user_banned":this.handleUserBanned(t);break;case"games.event.bigger_dice.lobby_updated":this.handleLobbyUpdated(t);break;case"games.event.bigger_dice.game_started":this.handleGameStarted(t);break;case"games.event.bigger_dice.player_ready":this.handlePlayerReady(t);break;case"games.event.bigger_dice.rolled":this.handleDiceRolled(t);break;case"games.event.bigger_dice.state":this.handleBiggerDiceState(t);break;case"games.event.bigger_dice.round_result":this.handleRoundResult(t);break;case"games.event.bigger_dice.tiebreaker_started":this.handleTiebreakerStarted(t);break;case"games.event.bigger_dice.turn_changed":this.handleTurnChanged(t);break;case"games.event.bigger_dice.round_complete":this.handleRoundComplete(t);break;case"games.event.bigger_dice.game_over":this.handleGameOver(t);break;case"error":case"games.event.error":this.handleGameError(t);break;case"games.event.bigger_dice.not_in_room":this.handleNotInRoom(t);break;case"games.event.bigger_dice.lobby_chat":this.handleChatMessage(t,"lobby");break;case"games.event.bigger_dice.player_chat":this.handleChatMessage(t,"players");break;case"games.event.bigger_dice.spectator_chat":this.handleChatMessage(t,"spectators");break;case"games.event.bigger_dice.lobby_chat_history":this.handleChatHistory(t,"lobby");break;case"games.event.bigger_dice.player_chat_history":this.handleChatHistory(t,"players");break;case"games.event.bigger_dice.spectator_chat_history":this.handleChatHistory(t,"spectators");break;case"games.event.bigger_dice.chat_message":this.handleChatMessage(t,t.channel||"lobby");break;case"games.event.bigger_dice.chat_history":this.handleChatHistory(t,t.channel||"lobby");break;case"games.event.bigger_dice.user_muted":console.log("[Chat] User muted:",t.target_user_id);break;case"games.event.bigger_dice.user_unmuted":console.log("[Chat] User unmuted:",t.target_user_id);break;case"games.event.bigger_dice.spectator_joined":case"games.event.bigger_dice.spectator_data_joined":this.handleSpectatorJoined(t);break;case"games.event.bigger_dice.spectator_left":this.handleSpectatorLeft(t);break;case"games.event.bigger_dice.spectator_kicked":this.handleSpectatorKicked(t);break;case"games.event.bigger_dice.request_to_play_accepted":this.handleRequestToPlayAccepted(t);break;case"games.event.bigger_dice.removed_from_game":this.handleRemovedFromGame(t);break;case"games.event.bigger_dice.game_starting":this.handleGameStarting(t);break;default:console.warn("BiggerDice: Unknown message type",t.type)}}catch(t){console.error("BiggerDice: Error parsing message",t)}}handleClose(e){console.log("BiggerDice: WebSocket closed",e.code,e.reason),this.stopHeartbeat(),this.setConnectionState(y.DISCONNECTED),this.scheduleReconnect()}handleError(e){console.error("BiggerDice: WebSocket error",e)}scheduleReconnect(){if(this.reconnectAttempts>=this.maxReconnectAttempts){console.error("BiggerDice: Max reconnect attempts reached"),this.dispatchEvent(new CustomEvent("game-error",{detail:{message:"Unable to connect to game server"}}));return}this.setConnectionState(y.RECONNECTING),this.reconnectAttempts++;const e=this.reconnectDelay*Math.pow(2,this.reconnectAttempts-1);console.log(`BiggerDice: Reconnecting in ${e}ms`),setTimeout(()=>this.connect(),e)}send(e){this.ws&&this.ws.readyState===WebSocket.OPEN?this.ws.send(JSON.stringify(e)):console.warn("BiggerDice: WebSocket not connected")}startHeartbeat(){this.stopHeartbeat(),this.heartbeatInterval=setInterval(()=>{this.ws&&this.ws.readyState===WebSocket.OPEN&&(this.send({type:"system.heartbeat"}),this.heartbeatTimeout=setTimeout(()=>{console.warn("BiggerDice: Heartbeat timeout"),this.ws?.close()},1e4))},3e4)}stopHeartbeat(){this.heartbeatInterval&&(clearInterval(this.heartbeatInterval),this.heartbeatInterval=null),this.heartbeatTimeout&&(clearTimeout(this.heartbeatTimeout),this.heartbeatTimeout=null)}handleHeartbeatAck(){this.heartbeatTimeout&&(clearTimeout(this.heartbeatTimeout),this.heartbeatTimeout=null)}setConnectionState(e){this.connectionState=e,this.updateConnectionUI()}updateConnectionUI(){const e=this.elements.connectionDot,t=this.elements.connectionText,i=this.elements.gameStatus;switch(e.classList.remove("connection-dot--connected","connection-dot--connecting"),this.connectionState){case y.CONNECTED:e.classList.add("connection-dot--connected"),t.textContent="Connected";break;case y.CONNECTING:case y.RECONNECTING:e.classList.add("connection-dot--connecting"),t.textContent=this.connectionState===y.CONNECTING?"Connecting...":"Reconnecting...";break;default:t.textContent="Disconnected"}this.mode===f.LOBBY&&(i.textContent=this.connectionState===y.CONNECTED?"Connected":"Connecting")}handleWelcome(e){console.log("BiggerDice: Welcome received, authenticating"),this.send({type:"system.authenticate",user_id:String(this.userId),username:this.username||"Guest",avatar_id:this.avatarId||null})}handleAuthenticated(e){console.log("BiggerDice: Authenticated as",e.username),this.setConnectionState(y.CONNECTED),this.mode===f.LOBBY?this.requestRoomList():this.roomId&&this.send({type:"games.command.rejoin_room",room_id:this.roomId})}handleSystemError(e){console.error("BiggerDice: System error",e.code,e.message),this.dispatchEvent(new CustomEvent("game-error",{detail:{code:e.code,message:e.message}}))}requestRoomList(){this.send({type:"games.command.list_rooms",game_type:"bigger_dice"})}handleRoomList(e){this.availableRooms=(e||[]).filter(t=>t.game_type==="bigger_dice"),this.renderRoomList()}handleRoomCreated(e){if(console.log("[BiggerDice] handleRoomCreated:",e),e.game_type&&e.game_type!=="bigger_dice"){console.log("[BiggerDice] Ignoring room_created for different game:",e.game_type);return}const t=String(e.host_id),i=String(this.userId);if(t===i)console.log("[BiggerDice] We are the host, dispatching room-joined event"),this.isNavigatingToOwnRoom=!0,this.dispatchEvent(new CustomEvent("room-joined",{detail:{room_id:e.room_id,game_type:e.game_type||"bigger_dice"},bubbles:!0,composed:!0}));else{console.log("[BiggerDice] Not the host, adding room to list");const s={room_id:e.room_id,room_name:e.room_name,game_type:e.game_type||"bigger_dice",host_name:e.host_name||e.host_username||"Unknown",status:"waiting",player_count:1,spectator_count:0,max_players:e.player_count||e.max_players||2,allow_spectators:e.allow_spectators===!0,is_password_protected:e.is_password_protected||!1};this.mode===f.LOBBY&&(this.availableRooms.some(o=>o.room_id===s.room_id)||(this.availableRooms.unshift(s),this.renderRoomList()))}}handleRoomJoined(e){this.pendingJoinRoomId&&this.hideJoinPasswordModal(),this.notInRoomInfo=null,this.elements.notInRoomState.classList.add("hidden"),this.chatHistoryRequested={lobby:!1,players:!1,spectators:!1},this.chatMessages={lobby:[],players:[],spectators:[]};const t=e.player?.user_id||e.player_id;t===this.userId||t===String(this.userId)||String(t)===this.userId?(this.isNavigatingToOwnRoom=!0,this.dispatchEvent(new CustomEvent("room-joined",{detail:{room_id:e.room_id,game_type:"bigger_dice"}}))):this.requestRoomList()}handleRoomRemoved(e){console.log("[BiggerDice] handleRoomRemoved:",e);const t=e.room_id,i=e.reason||"unknown",s=this.availableRooms.length;this.availableRooms=this.availableRooms.filter(a=>a.room_id!==t),this.availableRooms.length<s&&(console.log(`[BiggerDice] Room ${t} removed from list (reason: ${i})`),this.mode===f.LOBBY&&this.renderRoomList()),this.roomId===t&&this.mode===f.GAME&&i!=="game_started"&&this.showRoomClosedMessage()}renderRoomList(){const e=this.elements.roomsGrid,t=this.elements.loadingState,i=this.elements.emptyState;if(t.classList.add("hidden"),this.availableRooms.length===0){i.classList.remove("hidden"),e.classList.add("hidden");return}i.classList.add("hidden"),e.classList.remove("hidden"),e.innerHTML=this.availableRooms.map(s=>{const a=s.players?.length||0,o=s.player_count||s.max_players||2,r=s.spectator_count||0,n=s.allow_spectators===!0,d=a>=o,l=s.can_rejoin===!0;return`
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
            ${a}/${o}
          </span>
          ${n?`
            <span class="room-card__info-item" title="Spectators">
              <svg class="room-card__info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              ${r}
            </span>
          `:`
            <span class="room-card__no-spectators" title="Spectators not allowed">No spectators</span>
          `}
        </div>
        <div class="room-card__players">
          ${(s.players||[]).map(c=>`
            <span class="player-badge ${c.is_ready?"player-badge--ready":""}">${this.escapeHtml(c.username||c.name)}</span>
          `).join("")}
          ${a<o?'<span class="player-badge">Waiting...</span>':""}
        </div>
        <div class="room-card__actions">
          ${l?`
            <button class="join-btn" data-action="rejoin" data-room-id="${s.room_id}">Rejoin</button>
          `:""}
          ${!l&&s.status==="waiting"&&!d?`
            <button class="join-btn" data-action="join" data-room-id="${s.room_id}" data-room-name="${this.escapeHtml(s.room_name)}" data-protected="${s.is_password_protected||!1}">Join Game</button>
          `:""}
          ${!l&&n?`
            <button class="spectate-btn" data-action="spectate" data-room-id="${s.room_id}">
              ${s.status==="waiting"?"Spectate":"Watch"}
            </button>
          `:""}
        </div>
      </div>
    `}).join(""),e.querySelectorAll("[data-action]").forEach(s=>{s.addEventListener("click",a=>{const o=a.target.dataset.roomId,r=a.target.dataset.action;(r==="join"||r==="spectate"||r==="rejoin")&&this.dispatchEvent(new CustomEvent("room-joined",{detail:{room_id:o,game_type:"bigger_dice",as_spectator:r==="spectate"},bubbles:!0,composed:!0}))})})}showCreateRoomModal(){console.log("[BiggerDice] showCreateRoomModal called"),this.elements.createRoomModal?(this.elements.createRoomModal.classList.add("active"),console.log("[BiggerDice] Modal should now be visible")):console.error("[BiggerDice] createRoomModal element not found"),this.elements.roomNameInput&&(this.elements.roomNameInput.value="",this.elements.roomNameInput.focus()),this.elements.roomPasswordInput&&(this.elements.roomPasswordInput.value=""),this.elements.playerCountInput&&(this.elements.playerCountInput.value="2"),this.elements.allowSpectatorsInput&&(this.elements.allowSpectatorsInput.checked=!0)}hideCreateRoomModal(){console.log("[BiggerDice] hideCreateRoomModal called"),this.elements.createRoomModal&&(this.elements.createRoomModal.classList.remove("active"),console.log("[BiggerDice] Modal hidden"))}async fetchGameConfig(){try{const e=await fetch("/api/v1/games/config",{method:"GET",headers:{Accept:"application/json"}});if(e.ok){const t=await e.json();t.bigger_dice&&(this.gameConfig={entry_fee_cents:t.bigger_dice.entry_fee_cents||1e3,ready_timeout_seconds:t.bigger_dice.ready_timeout_seconds||30,winning_percentage:t.bigger_dice.winning_percentage||60},this.readyTimerDuration=this.gameConfig.ready_timeout_seconds,console.log("[BiggerDice] Game config loaded:",this.gameConfig))}}catch(e){console.error("[BiggerDice] Failed to fetch game config:",e)}}getDisplayCost(){return this.gameConfig.entry_fee_cents/100}async showCreateConfirmModal(){console.log("[BiggerDice] showCreateConfirmModal called"),this.elements.createConfirmModal&&this.elements.createConfirmModal.classList.add("active"),this.elements.createConfirmLoader&&this.elements.createConfirmLoader.classList.remove("hidden"),this.elements.createConfirmMessage&&this.elements.createConfirmMessage.classList.add("hidden"),this.elements.createConfirmBtn&&this.elements.createConfirmBtn.classList.add("hidden");try{const e=await fetch("/api/v1/user",{method:"GET",credentials:"include",headers:{Accept:"application/json"}});if(!e.ok)throw new Error("Failed to fetch user data");const i=(await e.json()).user?.balance??0,s=this.gameConfig.entry_fee_cents,a=this.getDisplayCost(),o=i>=s;console.log("[BiggerDice] User balance:",i,"Required:",s,"Has enough:",o),this.elements.createConfirmLoader&&this.elements.createConfirmLoader.classList.add("hidden");const r=this.elements.createConfirmMessage;r&&(o?(r.textContent=`To create a room, you need at least ${a} coins (${s} balance). Creating the room is free, but if you are selected to play, it will cost ${a} coins.`,r.classList.remove("confirm-message--error")):(r.textContent=`You do not have enough credits to create a game. You need at least ${s} balance (${a} coins).`,r.classList.add("confirm-message--error")),r.classList.remove("hidden"));const n=this.elements.createConfirmBtn;n&&(o?n.classList.remove("hidden"):n.classList.add("hidden"))}catch(e){console.error("[BiggerDice] Error fetching balance:",e),this.elements.createConfirmLoader&&this.elements.createConfirmLoader.classList.add("hidden"),this.elements.createConfirmMessage&&(this.elements.createConfirmMessage.textContent="Failed to check balance. Please try again.",this.elements.createConfirmMessage.classList.add("confirm-message--error"),this.elements.createConfirmMessage.classList.remove("hidden"))}}hideCreateConfirmModal(){console.log("[BiggerDice] hideCreateConfirmModal called"),this.elements.createConfirmModal&&this.elements.createConfirmModal.classList.remove("active")}async showJoinConfirmModal(e,t,i=!1){console.log("[BiggerDice] showJoinConfirmModal called for room:",e),this.elements.joinConfirmModal&&this.elements.joinConfirmModal.classList.add("active"),this.elements.joinConfirmLoader&&this.elements.joinConfirmLoader.classList.remove("hidden"),this.elements.joinConfirmMessage&&this.elements.joinConfirmMessage.classList.add("hidden"),this.elements.joinConfirmBtn&&this.elements.joinConfirmBtn.classList.add("hidden");try{const s=await fetch("/api/v1/user",{method:"GET",credentials:"include",headers:{Accept:"application/json"}});if(!s.ok)throw new Error("Failed to fetch user data");const o=(await s.json()).user?.balance??0,r=this.gameConfig.entry_fee_cents,n=this.getDisplayCost(),d=o>=r;console.log("[BiggerDice] User balance:",o,"Required:",r,"Has enough:",d),this.elements.joinConfirmLoader&&this.elements.joinConfirmLoader.classList.add("hidden");const l=this.elements.joinConfirmMessage;l&&(d?(l.textContent=`Joining the room is free. However, if the admin selects you to play, it will cost ${n} coins (${r} balance).`,l.classList.remove("confirm-message--error")):(l.textContent=`You do not have enough credits to join this room. You need at least ${r} balance (${n} coins) to be eligible for selection.`,l.classList.add("confirm-message--error")),l.classList.remove("hidden"));const c=this.elements.joinConfirmBtn;c&&(d?c.classList.remove("hidden"):c.classList.add("hidden"))}catch(s){console.error("[BiggerDice] Error fetching balance:",s),this.elements.joinConfirmLoader&&this.elements.joinConfirmLoader.classList.add("hidden"),this.elements.joinConfirmMessage&&(this.elements.joinConfirmMessage.textContent="Failed to check balance. Please try again.",this.elements.joinConfirmMessage.classList.add("confirm-message--error"),this.elements.joinConfirmMessage.classList.remove("hidden"))}}hideJoinConfirmModal(){console.log("[BiggerDice] hideJoinConfirmModal called"),this.elements.joinConfirmModal&&this.elements.joinConfirmModal.classList.remove("active")}createRoom(){console.log("[BiggerDice] createRoom called");const e=this.elements.roomNameInput?.value.trim()||`Room ${Date.now()}`,t=this.elements.roomPasswordInput?.value.trim()||"",i=parseInt(this.elements.playerCountInput?.value||"2",10),s=this.elements.allowSpectatorsInput?.checked??!0;console.log("[BiggerDice] Creating room:",e,"players:",i,"spectators:",s);const a={type:"games.command.create_room",game_type:"bigger_dice",room_name:e,max_players:i,allow_spectators:s};t&&(a.password=t),this.send(a),this.hideCreateRoomModal(),console.log("[BiggerDice] Room creation message sent")}showJoinPasswordModal(e,t,i=!1){this.pendingJoinRoomId=e,this.pendingJoinRoomName=t,this.pendingJoinAsSpectator=i,this.elements.joinPasswordInput.value="",this.elements.joinPasswordError.classList.add("hidden"),this.elements.joinPasswordModal.classList.add("active"),this.elements.joinPasswordInput.focus()}hideJoinPasswordModal(){this.elements.joinPasswordModal.classList.remove("active"),this.pendingJoinRoomId=null,this.pendingJoinRoomName=null,this.pendingJoinAsSpectator=!1}submitJoinWithPassword(){const e=this.elements.joinPasswordInput.value;e&&(this.pendingJoinAsSpectator?this.send({type:"games.command.join_as_spectator",room_name:this.pendingJoinRoomName,password:e}):this.send({type:"games.command.join_room",room_name:this.pendingJoinRoomName,password:e}))}switchChatChannel(e){const t=this.players.some(i=>String(i.user_id||i.id)===String(this.myPlayerId));if(console.log("[Chat] switchChatChannel called:",{channel:e,isPlayer:this.isPlayer,isSpectator:this.isSpectator,amIAPlayer:t,currentChannel:this.chatChannel,messagesInChannel:this.chatMessages[e]?.length||0}),e==="lobby"&&this.isLobbyChatDisabled()){console.log("[Chat] Lobby chat is disabled during ready/playing phase");return}if(e==="players"&&!this.isPlayer&&!this.isSpectator&&!t){console.log("[Chat] Cannot access players channel - not a player or spectator");return}if(e==="spectators"&&(t||!this.isSpectator)){console.log("[Chat] Cannot access spectators channel - players cannot see spectator chat");return}console.log("[Chat] Access granted, setting chatChannel to:",e),this.chatChannel=e,this.elements.chatTabLobby?.classList.toggle("active",e==="lobby"),this.elements.chatTabPlayers?.classList.toggle("active",e==="players"),this.elements.chatTabSpectators?.classList.toggle("active",e==="spectators"),this.chatUnreadCounts[e]=0,this.updateChatBadges(),console.log("[Chat] About to renderChatMessages, chatChannel is:",this.chatChannel),this.renderChatMessages(),this.updateChatInputAccess(),!this.chatHistoryRequested[e]&&this.chatMessages[e].length===0&&this.roomId&&(this.chatHistoryRequested[e]=!0,this.requestChatHistory(e))}isLobbyChatDisabled(){return this.gameStatus===g.STARTING||this.gameStatus===g.IN_PROGRESS||this.gameStatus===g.PLAYING||this.gameStatus===g.FINISHED||this.gameStatus===g.WAITING&&this.players.length>=this.maxPlayers}updateChatInputAccess(){const e=this.elements.chatForm,t=this.elements.chatInput,i=this.elements.chatSend,s=this.players.some(o=>String(o.user_id||o.id)===String(this.myPlayerId)),a=this.isSpectator&&!s&&this.chatChannel==="players";e&&(a?(e.classList.add("chat-input--disabled"),t&&(t.disabled=!0,t.placeholder="Spectators cannot send messages in players chat"),i&&(i.disabled=!0)):(e.classList.remove("chat-input--disabled"),t&&(t.disabled=!1,t.placeholder="Type a message..."),i&&(i.disabled=!1)))}toggleChat(){this.isChatCollapsed=!this.isChatCollapsed,this.elements.chatPanel?.classList.toggle("collapsed",this.isChatCollapsed)}sendChatMessage(){const e=this.elements.chatInput?.value.trim();!e||!this.roomId||(this.send({type:"games.command.send_chat",room_id:this.roomId,channel:this.chatChannel,content:e,avatar_id:this.avatarId||null}),this.elements.chatInput&&(this.elements.chatInput.value=""))}requestChatHistory(e){this.roomId&&this.send({type:"games.command.get_chat_history",room_id:this.roomId,channel:e,limit:50})}handleChatMessage(e,t){const i=t||e.channel||"lobby";console.log("[Chat] handleChatMessage received:",{channel:i,username:e.username,content:e.content?.substring(0,50),currentChannel:this.chatChannel,isSpectator:this.isSpectator});const s={id:e.message_id||Date.now(),userId:e.user_id,username:e.username||"Unknown",avatarId:e.avatar_id,content:e.content,isSystem:e.is_system||!1,isModerated:e.is_moderated||!1,timestamp:e.created_at?new Date(e.created_at):new Date};this.chatMessages[i]||(this.chatMessages[i]=[]),this.chatMessages[i].push(s),console.log("[Chat] Added message to channel",i,"- now has",this.chatMessages[i].length,"messages"),this.chatMessages[i].length>100&&(this.chatMessages[i]=this.chatMessages[i].slice(-100)),i===this.chatChannel?(console.log("[Chat] Channel matches current, rendering"),this.renderChatMessages()):(console.log("[Chat] Channel does not match current ("+this.chatChannel+"), incrementing badge"),this.chatUnreadCounts[i]++,this.updateChatBadges())}handleChatHistory(e,t){const i=t||e.channel||"lobby",s=e.messages||[];console.log("[Chat] handleChatHistory received for channel:",i,"messages count:",s.length);const a=s.map(l=>({id:l.message_id||l._id||Date.now(),userId:l.user_id,username:l.username||"Unknown",avatarId:l.avatar_id,content:l.content,isSystem:l.is_system||!1,isModerated:l.is_moderated||!1,timestamp:l.created_at?new Date(l.created_at):new Date})),o=this.chatMessages[i]||[],r=new Set(o.map(l=>String(l.id))),d=[...a.filter(l=>!r.has(String(l.id))),...o];d.sort((l,c)=>l.timestamp-c.timestamp),o.length,this.chatMessages[i]=d.slice(-100),console.log("[Chat] handleChatHistory: merged",a.length,"history +",o.length,"existing =",this.chatMessages[i].length,"messages for channel",i),i===this.chatChannel&&(console.log("[Chat] handleChatHistory: channel matches current, rendering"),this.renderChatMessages())}renderChatMessages(){const e=this.elements.chatMessages;if(console.log("[Chat] renderChatMessages called, chatChannel:",this.chatChannel,"container exists:",!!e),!e){console.log("[Chat] renderChatMessages: No container element, returning");return}const t=this.chatMessages[this.chatChannel]||[];if(console.log("[Chat] renderChatMessages: Found",t.length,"messages for channel",this.chatChannel),console.log("[Chat] All chatMessages state:",{lobby:this.chatMessages.lobby?.length||0,players:this.chatMessages.players?.length||0,spectators:this.chatMessages.spectators?.length||0}),t.length===0){console.log("[Chat] renderChatMessages: No messages, showing empty state"),e.innerHTML='<div class="chat-empty">No messages yet. Say hello!</div>';return}e.innerHTML=t.map(i=>{const s=this.mutedUsers.has(String(i.userId));if(i.isSystem)return`<div class="chat-message chat-message--system">${this.escapeHtml(i.content)}</div>`;const a=(i.username||"U").substring(0,2).toUpperCase(),o=i.timestamp.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return`
        <div class="chat-message ${s?"chat-message--muted":""}" data-user-id="${i.userId}">
          <div class="chat-message__avatar">${a}</div>
          <div class="chat-message__content">
            <div class="chat-message__header">
              <span class="chat-message__username">${this.escapeHtml(i.username)}</span>
              <span class="chat-message__time">${o}</span>
            </div>
            <div class="chat-message__text">${this.escapeHtml(i.content)}</div>
          </div>
          ${String(i.userId)!==String(this.userId)?`
            <button class="chat-message__mute" data-user-id="${i.userId}" title="${s?"Unmute user":"Mute user"}">
              ${s?"🔊":"🔇"}
            </button>
          `:""}
        </div>
      `}).join(""),console.log("[Chat] renderChatMessages: rendered",t.length,"messages to container"),e.scrollTop=e.scrollHeight,e.querySelectorAll(".chat-message__mute").forEach(i=>{i.addEventListener("click",s=>{const a=s.target.dataset.userId;this.toggleMuteUser(a)})})}toggleMuteUser(e){const t=String(e);this.mutedUsers.has(t)?(this.mutedUsers.delete(t),this.send({type:"games.command.unmute_user",room_id:this.roomId,target_user_id:parseInt(e,10)})):(this.mutedUsers.add(t),this.send({type:"games.command.mute_user",room_id:this.roomId,target_user_id:parseInt(e,10)})),this.renderChatMessages()}updateChatBadges(){const e=(t,i)=>{t&&(i>0?(t.textContent=i>99?"99+":String(i),t.classList.remove("hidden")):t.classList.add("hidden"))};e(this.elements.lobbyBadge,this.chatUnreadCounts.lobby),e(this.elements.playersBadge,this.chatUnreadCounts.players),e(this.elements.spectatorsBadge,this.chatUnreadCounts.spectators)}updateChatTabAccess(){const e=this.elements.chatTabLobby,t=this.elements.chatTabPlayers,i=this.elements.chatTabSpectators,s=this.isLobbyChatDisabled(),a=this.players.some(o=>String(o.user_id||o.id)===String(this.myPlayerId));e&&(s?(e.classList.add("hidden"),e.disabled=!0):(e.classList.remove("hidden"),e.disabled=!1)),t&&(s?(t.classList.remove("hidden"),t.classList.remove("disabled"),t.disabled=!1,this.isSpectator&&!a?t.setAttribute("title","View players chat (read-only)"):t.removeAttribute("title")):(t.classList.add("hidden"),t.disabled=!0)),i&&(this.isSpectator&&!a?(i.classList.remove("hidden"),i.classList.remove("disabled"),i.disabled=!1):(i.classList.add("hidden"),i.disabled=!0)),this.chatChannel==="lobby"&&s&&(console.log("[Chat] updateChatTabAccess: lobby disabled, auto-switching. isSpectator:",this.isSpectator,"amIAPlayer:",a),this.isSpectator&&!a?(console.log("[Chat] updateChatTabAccess: switching spectator to spectators channel"),this.switchChatChannel("spectators")):(console.log("[Chat] updateChatTabAccess: switching to players channel"),this.switchChatChannel("players"))),this.chatChannel==="spectators"&&(!this.isSpectator||a)&&(s?this.switchChatChannel("players"):this.switchChatChannel("lobby")),this.isSpectator&&!a&&s&&!this.chatHistoryRequested.players&&this.chatMessages.players.length===0&&this.roomId&&(this.chatHistoryRequested.players=!0,this.requestChatHistory("players")),this.updateChatInputAccess()}updateSpectatorUI(){const e=this.elements.spectatorBanner,t=this.elements.requestToPlayBtn;if(e)if(this.isSpectator){if(e.classList.remove("hidden"),t){const s=this.players.length<this.maxPlayers&&this.gameStatus===g.WAITING;t.classList.toggle("hidden",!s)}}else e.classList.add("hidden");this.renderSpectatorsList()}renderSpectatorsList(){const e=this.elements.spectatorsPanel,t=this.elements.spectatorsCount,i=this.elements.spectatorsList;if(!e||!i)return;if(!this.allowSpectators||this.spectators.length===0){e.classList.add("hidden");return}e.classList.remove("hidden"),t&&(t.textContent=this.spectators.length);const s=String(this.myPlayerId);i.innerHTML=this.spectators.map(a=>{const o=(a.username||"U").charAt(0).toUpperCase(),r=String(a.user_id)===s;return`
        <div class="spectator-item ${r?"spectator-item--me":""}" data-user-id="${a.user_id}">
          <span class="spectator-item__avatar">${o}</span>
          <span class="spectator-item__name">${this.escapeHtml(a.username)}${r?" (you)":""}</span>
        </div>
      `}).join("")}requestToPlay(){console.log("[BiggerDice] Requesting to play"),this.send({type:"games.command.request_to_play",room_id:this.roomId}),this.elements.requestToPlayBtn&&(this.elements.requestToPlayBtn.disabled=!0,this.elements.requestToPlayBtn.textContent="Requested...")}handleSpectatorJoined(e){console.log("[BiggerDice] Spectator joined:",e);const t=e.spectator||e,i={user_id:t.user_id,username:t.username,avatar_id:t.avatar_id,joined_at:t.joined_at};this.spectators.find(s=>String(s.user_id)===String(i.user_id))||this.spectators.push(i),String(i.user_id)===String(this.myPlayerId)&&(this.isSpectator=!0,this.isPlayer=!1,console.log("[BiggerDice] Current user joined as spectator, updating chat tabs and game UI"),this.updateChatTabAccess(),this.updateGameUI()),this.updateSpectatorUI(),this.isAdmin&&this.elements.adminLobby&&!this.elements.adminLobby.classList.contains("hidden")&&this.renderAdminLobby()}handleSpectatorLeft(e){console.log("[BiggerDice] Spectator left:",e);const t=String(e.user_id);this.spectators=this.spectators.filter(i=>String(i.user_id)!==t),this.updateSpectatorUI(),this.renderAdminLobby()}handleSpectatorKicked(e){console.log("[BiggerDice] Spectator kicked:",e);const t=String(e.user_id);if(t===String(this.myPlayerId)){this.showToast("You have been removed from this room by the admin","warning"),this.isSpectator=!1,this.roomId=null,setTimeout(()=>{window.location.href="/games/bigger-dice"},2e3);return}this.spectators=this.spectators.filter(i=>String(i.user_id)!==t),this.updateSpectatorUI(),this.renderAdminLobby()}handleRequestToPlayAccepted(e){console.log("[BiggerDice] Request to play accepted:",e),String(e.user_id)===String(this.myPlayerId)&&(this.isSpectator=!1);const t=String(e.user_id);this.spectators=this.spectators.filter(i=>String(i.user_id)!==t),this.updateSpectatorUI(),this.updateChatTabAccess()}joinRoom(e,t=!1){this.dispatchEvent(new CustomEvent("room-joined",{detail:{room_id:e,game_type:"bigger_dice"}}))}handleRoomState(e){this.notInRoomInfo=null,this.hasSentDisconnectIntent=!1,this.elements.notInRoomState&&this.elements.notInRoomState.classList.add("hidden"),this.elements.chatPanel&&this.elements.chatPanel.classList.remove("hidden"),this.pendingJoinRoomId&&this.hideJoinPasswordModal(),this.roomId=e.room_id,this.roomName=e.room_name;const t=e.status==="waiting"&&e.selected_players&&e.selected_players.length>0&&(!e.players||e.players.length===0);t?(this.players=e.lobby||[],this.lobby=e.lobby||[],console.log(`[BiggerDice] handleRoomState: READY PHASE - using lobby as players, players.length=${this.players.length}`)):(this.players=e.players||[],this.lobby=e.lobby||[]),this.hostId=e.host_id,this.isAdmin=String(e.host_id)===String(this.myPlayerId),this.maxPlayers=e.player_count||e.max_players||2,console.log(`[BiggerDice] handleRoomState: maxPlayers=${this.maxPlayers}, players.length=${this.players.length}, player_count=${e.player_count}, max_players=${e.max_players}, isReadyPhase=${t}`),this.allowSpectators=e.allow_spectators===!0,this.gameStatus=e.status==="in_progress"?g.PLAYING:e.status,this.currentTurn=e.current_turn,this.round=e.round||e.turn_number||0,e.banned_users&&Array.isArray(e.banned_users)?this.bannedPlayers=e.banned_users.map(r=>typeof r=="object"&&r!==null?{user_id:r.user_id,username:r.username||`User #${r.user_id}`}:{user_id:r,username:`User #${r}`}):this.bannedPlayers=[],this.spectators=e.spectators_data||e.spectators||[],this.autoPlayers=new Set((e.auto_players||[]).map(r=>String(r))),this.stopDisconnectTickerIfNeeded();const i=String(this.myPlayerId),s=this.players.some(r=>String(r.id||r.user_id)===i),a=this.lobby.some(r=>String(r.user_id)===i);this.isPlayer=s||a,this.isSpectator=this.spectators.some(r=>typeof r=="object"&&r!==null?String(r.user_id||r.id)===i:String(r)===i),console.log("[BiggerDice] handleRoomState role check:",{myPlayerId:this.myPlayerId,userIdStr:i,inPlayers:s,inLobby:a,isPlayer:this.isPlayer,isSpectator:this.isSpectator,spectatorsCount:this.spectators.length,spectatorsFormat:this.spectators.length>0?typeof this.spectators[0]:"empty",spectatorIds:this.spectators.map(r=>typeof r=="object"?r.user_id||r.id:r)}),this.updateChatTabAccess(),this.updateSpectatorUI(),!this.chatHistoryRequested.lobby&&this.chatMessages.lobby.length===0&&(this.chatHistoryRequested.lobby=!0,this.requestChatHistory("lobby")),["playing","in_progress","starting"].includes((this.gameStatus||"").toLowerCase())&&(!this.chatHistoryRequested.players&&this.chatMessages.players.length===0&&(this.chatHistoryRequested.players=!0,this.requestChatHistory("players")),this.isSpectator&&!this.chatHistoryRequested.spectators&&this.chatMessages.spectators.length===0&&(this.chatHistoryRequested.spectators=!0,this.requestChatHistory("spectators"))),this.updateGameUI(),this.applyDiceState(),this.rollEventQueue.length>0&&(console.log("[BiggerDice] handleRoomState: clearing event queue (room_state has authoritative state)"),this.rollEventQueue=[],this.roundEndedWithWinner=!1),this.checkAutoRollNeeded()}handlePlayerJoined(e){const t={id:e.player_id,name:e.player_name,score:0,is_ready:!1};this.players.find(i=>i.id===t.id)||this.players.push(t),this.updateGameUI()}handlePlayerLeft(e){const t=String(e.player_id);if(t===String(this.hostId)){this.showRoomClosedMessage();return}this.players=this.players.filter(i=>String(i.id)!==t),this.lobby=this.lobby.filter(i=>String(i.user_id)!==t),this.disconnectedPlayers.delete(t),this.autoPlayers.delete(t),this.kickVotes.delete(t),this.stopDisconnectTickerIfNeeded(),this.updateGameUI()}handlePlayerDisconnected(e){const t=String(e.user_id),i=e.timeout_at?new Date(e.timeout_at):null;i&&!Number.isNaN(i.getTime())&&(this.disconnectedPlayers.set(t,{timeoutAt:i}),this.kickVotes.delete(t),this.startDisconnectTicker(),this.updateGameUI())}handlePlayerRejoined(e){const t=String(e.user_id);this.disconnectedPlayers.delete(t),this.kickVotes.delete(t),this.autoPlayers.delete(t),this.stopDisconnectTickerIfNeeded(),this.updateGameUI()}handlePlayerAutoEnabled(e){console.log("[BiggerDice] handlePlayerAutoEnabled:",e);const t=String(e.user_id);console.log("[BiggerDice] handlePlayerAutoEnabled: adding user to autoPlayers:",t,"currentTurn:",this.currentTurn),this.autoPlayers.add(t),this.disconnectedPlayers.delete(t),this.kickVotes.delete(t),this.stopDisconnectTickerIfNeeded(),this.updateGameUI(),this.checkAutoRollNeeded()}handlePlayerAutoDisabled(e){const t=String(e.user_id);this.autoPlayers.delete(t),this.updateGameUI()}showRoomClosedMessage(){if(this.elements.waitingState&&this.elements.waitingState.classList.add("hidden"),this.elements.adminLobby&&this.elements.adminLobby.classList.add("hidden"),this.elements.gameBoard&&this.elements.gameBoard.classList.add("hidden"),this.elements.notInRoomState&&this.elements.notInRoomState.classList.add("hidden"),this.elements.waitingForAdmin){const e=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__icon"),t=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__title"),i=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__message");e&&(e.textContent="🚪"),t&&(t.textContent="Room Closed"),i&&(i.textContent="This room has been closed. The admin has left the game."),this.elements.waitingForAdmin.classList.remove("hidden")}this.elements.leaveBtn&&(this.elements.leaveBtn.textContent="Return to Lobby")}handleLobbyJoined(e){const t=e.player||{user_id:e.user_id,username:e.username,avatar_id:e.avatar_id,score:0,is_ready:!1};this.lobby.findIndex(s=>String(s.user_id)===String(t.user_id))===-1&&this.lobby.push(t),this.updateGameUI()}handlePlayerSelected(e){const t=e.player;console.log(`[BiggerDice] handlePlayerSelected: player=${t.username}, current players.length=${this.players.length}, maxPlayers=${this.maxPlayers}`),this.lobby=this.lobby.filter(r=>String(r.user_id)!==String(t.user_id)),this.players.findIndex(r=>String(r.user_id||r.id)===String(t.user_id))===-1&&this.players.push(t),console.log(`[BiggerDice] handlePlayerSelected: after push, players.length=${this.players.length}, maxPlayers=${this.maxPlayers}, needsMore=${this.players.length<this.maxPlayers}`);const s=String(this.myPlayerId),a=this.players.some(r=>String(r.id||r.user_id)===s),o=this.lobby.some(r=>String(r.user_id)===s);this.isPlayer=a||o,this.updateGameUI(),this.players.length===this.maxPlayers&&(console.log("[BiggerDice] All players selected, starting ready timer"),this.startReadyTimer())}handlePlayerKicked(e){const t=e.player_id||e.user_id;if(e.player_name,this.lobby=this.lobby.filter(i=>String(i.user_id)!==String(t)),String(t)===String(this.myPlayerId)){this.showKickedMessage();return}this.updateGameUI()}showKickedMessage(){if(this.elements.waitingState&&this.elements.waitingState.classList.add("hidden"),this.elements.adminLobby&&this.elements.adminLobby.classList.add("hidden"),this.elements.gameBoard&&this.elements.gameBoard.classList.add("hidden"),this.elements.notInRoomState&&this.elements.notInRoomState.classList.add("hidden"),this.elements.waitingForAdmin){const e=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__icon"),t=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__title"),i=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__text");e&&(e.textContent="🚫"),t&&(t.textContent="You have been kicked"),i&&(i.textContent="The host has kicked you from the lobby."),this.elements.waitingForAdmin.classList.remove("hidden")}setTimeout(()=>{this.dispatchEvent(new CustomEvent("game-leave"))},3e3)}handlePlayerBanned(e){const t=e.player_id||e.user_id,i=e.player_name||e.username||"Unknown";if(this.lobby=this.lobby.filter(s=>String(s.user_id)!==String(t)),this.players=this.players.filter(s=>String(s.user_id||s.id)!==String(t)),this.bannedPlayers.some(s=>String(s.user_id)===String(t))||this.bannedPlayers.push({user_id:t,username:i}),String(t)===String(this.myPlayerId)){this.showBannedMessage();return}this.updateGameUI()}handlePlayerUnbanned(e){const t=e.player_id||e.user_id;this.bannedPlayers=this.bannedPlayers.filter(i=>String(i.user_id)!==String(t)),this.updateGameUI()}handleUserBanned(e){this.showUserBannedState(e.room_name)}showUserBannedState(e){if(this.elements.waitingState&&this.elements.waitingState.classList.add("hidden"),this.elements.adminLobby&&this.elements.adminLobby.classList.add("hidden"),this.elements.gameBoard&&this.elements.gameBoard.classList.add("hidden"),this.elements.waitingForAdmin&&this.elements.waitingForAdmin.classList.add("hidden"),this.elements.notInRoomState){const t=this.elements.notInRoomState.querySelector(".not-in-room__icon"),i=this.elements.notInRoomState.querySelector(".not-in-room__title"),s=this.elements.notInRoomState.querySelector(".not-in-room__text"),a=this.elements.notInRoomState.querySelector(".not-in-room__actions");t&&(t.textContent="⛔"),i&&(i.textContent="You are banned from this room"),s&&(s.textContent="The host has banned you from this room. You cannot join it."),a&&a.classList.add("hidden"),this.elements.notInRoomState.classList.remove("hidden")}}showBannedMessage(){if(this.elements.waitingState&&this.elements.waitingState.classList.add("hidden"),this.elements.adminLobby&&this.elements.adminLobby.classList.add("hidden"),this.elements.gameBoard&&this.elements.gameBoard.classList.add("hidden"),this.elements.notInRoomState&&this.elements.notInRoomState.classList.add("hidden"),this.elements.waitingForAdmin){const e=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__icon"),t=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__title"),i=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__text");e&&(e.textContent="⛔"),t&&(t.textContent="You have been banned"),i&&(i.textContent="The host has banned you from this room. You cannot rejoin."),this.elements.waitingForAdmin.classList.remove("hidden")}setTimeout(()=>{this.dispatchEvent(new CustomEvent("game-leave"))},3e3)}handleLobbyUpdated(e){this.lobby=e.lobby||[],this.updateGameUI()}handleGameStarted(e){console.log("[BiggerDice] Game started:",e),this.stopReadyTimer(),this.gameStatus=g.PLAYING,this.players=e.players,this.currentTurn=e.first_turn,this.round=1,this.roundHistory=[],this.lastDiceState=null,this.disconnectedPlayers.clear(),this.kickVotes.clear(),this.autoPlayers.clear(),this.pendingAutoRoll=null,this.autoRollTimeoutId&&(clearTimeout(this.autoRollTimeoutId),this.autoRollTimeoutId=null),this.roundEndedWithWinner=!1,this.stopDisconnectTickerIfNeeded(),this.players.forEach(t=>{t.score=0,t.is_ready=!1}),this.updateChatTabAccess(),this.updateGameUI()}handleGameStarting(e){console.log("[BiggerDice] Game starting (ready phase):",e),console.log("[BiggerDice] handleGameStarting: message.players=",e.players),console.log("[BiggerDice] handleGameStarting: maxPlayers=",this.maxPlayers),this.players=e.players||[],this.lobby=e.players||[],this.gameStatus=g.WAITING,this.disconnectedPlayers.clear(),this.kickVotes.clear(),this.autoPlayers.clear(),this.pendingAutoRoll=null,this.autoRollTimeoutId&&(clearTimeout(this.autoRollTimeoutId),this.autoRollTimeoutId=null),this.roundEndedWithWinner=!1,this.stopDisconnectTickerIfNeeded(),console.log("[BiggerDice] handleGameStarting: After update - players.length=",this.players.length,"needsMorePlayers=",this.players.length<this.maxPlayers),this.updateChatTabAccess(),this.updateGameUI()}handleRemovedFromGame(e){console.log("[BiggerDice] Removed from game:",e),this.players=[],this.lobby=[],this.spectators=[],this.showRemovedFromGameMessage(e.message||"You were not selected to play.")}showRemovedFromGameMessage(e){if(this.elements.waitingState&&this.elements.waitingState.classList.add("hidden"),this.elements.adminLobby&&this.elements.adminLobby.classList.add("hidden"),this.elements.gameBoard&&this.elements.gameBoard.classList.add("hidden"),this.elements.notInRoomState&&this.elements.notInRoomState.classList.add("hidden"),this.elements.waitingForAdmin&&this.elements.waitingForAdmin.classList.add("hidden"),this.elements.waitingForAdmin){const t=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__icon"),i=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__title"),s=this.elements.waitingForAdmin.querySelector(".waiting-for-admin__message");t&&(t.textContent="👋"),i&&(i.textContent="Not Selected for This Game"),s&&(s.textContent=e),this.elements.waitingForAdmin.classList.remove("hidden")}setTimeout(()=>{this.dispatchEvent(new CustomEvent("game-leave"))},5e3)}handleDiceRolled(e){const t=String(e.player_id),i=e.roll;console.log("[BiggerDice] handleDiceRolled:",{playerId:t,roll:i,isAnimating:this.isAnimating,queueLength:this.rollEventQueue.length,playersCount:this.players.length,diceElementsCount:this.diceElements.length}),this.updateLastDiceState(t,i);const s={playerId:t,roll:i,message:e};if(this.players.length===0||this.diceElements.length===0){console.log("[BiggerDice] handleDiceRolled: no players/dice elements yet, queuing event"),this.rollEventQueue.push(s);return}if(this.isAnimating||this.rollEventQueue.length>0){console.log("[BiggerDice] handleDiceRolled: animation/queue in progress, queuing event for player",t),this.rollEventQueue.push(s);return}this.processRollEvent(s)}processRollEvent(e){const{playerId:t,roll:i}=e;console.log("[BiggerDice] processRollEvent:",{playerId:t,roll:i,queueLength:this.rollEventQueue.length});const s=this.players.findIndex(o=>String(o.id||o.user_id)===t),a=s>=0&&s<this.diceElements.length?this.diceElements[s]:null;a?(this.animationPromise=this.animateDiceRoll(a,i),this.animationPromise.then(()=>{console.log("[BiggerDice] processRollEvent: animation complete for player",t),this.processNextRollEvent()})):(console.warn(`[BiggerDice] processRollEvent: No dice element for playerIndex=${s}`),this.processNextRollEvent())}processNextRollEvent(){if(console.log("[BiggerDice] processNextRollEvent:",{queueLength:this.rollEventQueue.length,isAnimating:this.isAnimating,roundEndedWithWinner:this.roundEndedWithWinner}),this.roundEndedWithWinner){this.roundEndedWithWinner=!1,console.log("[BiggerDice] processNextRollEvent: round ended with winner, delaying 1 second before next round"),this.applyDiceState(),setTimeout(()=>{if(this.gameStatus!==g.PLAYING){console.log("[BiggerDice] processNextRollEvent: game state changed during delay, aborting");return}console.log("[BiggerDice] processNextRollEvent: delay complete, continuing"),this.processNextRollEventContinue()},1e3);return}this.processNextRollEventContinue()}processNextRollEventContinue(){if(this.rollEventQueue.length>0){const e=this.rollEventQueue.shift();if(e.type==="round_result"){console.log("[BiggerDice] processNextRollEventContinue: processing queued round result"),this.processRoundResult(e.message),this.processNextRollEvent();return}if(e.type==="game_over"){console.log("[BiggerDice] processNextRollEventContinue: processing queued game_over"),this.processGameOver(e.message);return}console.log("[BiggerDice] processNextRollEventContinue: processing queued dice event for player",e.playerId),this.processRollEvent(e);return}console.log("[BiggerDice] processNextRollEventContinue: queue empty, refreshing dice area"),this.applyDiceState(),console.log("[BiggerDice] processNextRollEventContinue: checking for auto-roll"),this.checkAutoRollNeeded()}updateLastDiceState(e,t){const i=String(e);if(this.lastDiceState||(this.lastDiceState={players:[]}),!this.lastDiceState.players){const a=[];this.lastDiceState.player1_id&&this.lastDiceState.player1_roll!==null&&a.push({player_id:this.lastDiceState.player1_id,roll:this.lastDiceState.player1_roll}),this.lastDiceState.player2_id&&this.lastDiceState.player2_roll!==null&&a.push({player_id:this.lastDiceState.player2_id,roll:this.lastDiceState.player2_roll}),this.lastDiceState={players:a}}const s=this.lastDiceState.players.findIndex(a=>a.player_id===i);s>=0?this.lastDiceState.players[s].roll=t:this.lastDiceState.players.push({player_id:i,roll:t})}handleBiggerDiceState(e){if(console.log("[BiggerDice] Received dice state:",e),e.round_history&&Array.isArray(e.round_history)&&e.round_history.length>0&&(console.log(`[BiggerDice] Loading ${e.round_history.length} rounds from server history`),this.roundHistory=e.round_history),e.current_rolls&&Array.isArray(e.current_rolls)){if(this.lastDiceState={players:e.current_rolls.map(([t,i])=>({player_id:String(t),roll:i}))},e.round_number&&(this.round=e.round_number),e.is_tiebreaker){const t=(e.pending_rollers||[]).map(i=>String(i));this.showTiebreakerMessage(t)}}else this.lastDiceState={player1_id:e.player1_id?String(e.player1_id):null,player2_id:e.player2_id?String(e.player2_id):null,player1_roll:Number.isInteger(e.player1_roll)?e.player1_roll:null,player2_roll:Number.isInteger(e.player2_roll)?e.player2_roll:null};this.applyDiceState()}applyDiceState(){if(!(!this.lastDiceState||this.players.length===0))if(this.lastDiceState.players&&Array.isArray(this.lastDiceState.players))this.lastDiceState.players.forEach(({player_id:e,roll:t})=>{if(!e)return;const i=this.players.findIndex(a=>String(a.id||a.user_id)===String(e)),s=i>=0&&i<this.diceElements.length?this.diceElements[i]:null;this.setDiceValue(s,t)});else{const{player1_id:e,player2_id:t,player1_roll:i,player2_roll:s}=this.lastDiceState;[{playerId:e,roll:i},{playerId:t,roll:s}].forEach(({playerId:o,roll:r})=>{if(!o)return;const n=this.players.findIndex(l=>String(l.id||l.user_id)===o),d=n>=0&&n<this.diceElements.length?this.diceElements[n]:null;this.setDiceValue(d,r)})}}setDiceValue(e,t){if(!e)return;const i=Number.isInteger(t)?t:0;e.dataset.value=String(i)}handlePlayerReady(e){console.log("[BiggerDice] Player ready:",e);const t=String(e.user_id),i=e.username,s=this.lobby.find(o=>String(o.user_id)===t);s&&(s.is_ready=!0,console.log(`[BiggerDice] Lobby player ${i} is now ready`));const a=this.players.find(o=>String(o.user_id||o.id)===t);a&&(a.is_ready=!0,console.log(`[BiggerDice] Game player ${i} is now ready`)),this.updateGameUI()}handleRoundResult(e){if(console.log("[BiggerDice] Round result:",e),console.log("[DEBUG] handleRoundResult ENTRY:",{isAnimating:this.isAnimating,queueLength:this.rollEventQueue.length,playersCount:this.players.length,diceElementsCount:this.diceElements.length}),this.players.length===0||this.diceElements.length===0||this.isAnimating||this.rollEventQueue.length>0){console.log("[BiggerDice] handleRoundResult: queuing round result (waiting for dice/animation)"),this.rollEventQueue.push({type:"round_result",message:e});return}this.processRoundResult(e)}processRoundResult(e){console.log("[BiggerDice] processRoundResult:",e),console.log("[DEBUG] processRoundResult ENTRY - scores before:",this.players.map(n=>({id:n.user_id||n.id,score:n.score})));const t=e.rolls||[],i=e.winner_id?String(e.winner_id):null,s=e.is_tiebreaker||!1,a=(e.tiebreaker_players||[]).map(n=>String(n)),o=a.length>0,r=e.scores||[];if(t.forEach(([n,d])=>{const l=String(n),c=this.players.findIndex(m=>String(m.id||m.user_id)===l);this.updateLastDiceState(l,d),c>=0&&c<this.diceElements.length&&this.setDiceValue(this.diceElements[c],d)}),r.length>0&&r.forEach(([n,d])=>{const l=String(n),c=this.players.find(m=>String(m.id||m.user_id)===l);if(c){const m=c.score||0;c.score=d,m!==d&&console.log(`[BiggerDice] Score sync: ${c.username||c.name} ${m} -> ${d}`)}}),i&&!o){const n=this.players.find(c=>String(c.id||c.user_id)===i),d=n?.username||n?.name||"Unknown",l=t.map(([c,m])=>{const h=this.players.find(p=>String(p.id||p.user_id)===String(c));return{id:String(c),name:h?.name||h?.username||"Player",roll:m}});this.roundHistory.push({round:this.roundHistory.length+1,rolls:l,winnerId:i,winnerName:d,isTiebreaker:s}),console.log(`[BiggerDice] ${d} wins the round with score ${n?.score||0}`)}if(o){const n=a.map(d=>{const l=this.players.find(c=>String(c.id||c.user_id)===d);return l?.username||l?.name||d}).join(", ");console.log(`[BiggerDice] Tie! ${n} go to tiebreaker!`),this.showTiebreakerMessage(a)}else i&&(this.roundEndedWithWinner=!0);console.log("[DEBUG] processRoundResult - about to call updateGameUI, scores:",this.players.map(n=>({id:n.user_id||n.id,score:n.score}))),this.updateGameUI(),this.forceImmediateRender(),console.log("[DEBUG] handleRoundResult EXIT - final scores:",this.players.map(n=>({id:n.user_id||n.id,score:n.score})))}forceImmediateRender(){const e=this.elements.playersArea;if(!e)return;e.offsetHeight;const t=e.querySelectorAll(".player-score"),s=Math.min(t.length,10);for(let a=0;a<s;a++)window.getComputedStyle(t[a]).opacity}showTiebreakerMessage(e){const t=e.map(s=>{const a=this.players.find(o=>String(o.id||o.user_id)===s);return a?.username||a?.name||"Player"}).join(" vs "),i=this.elements.turnIndicator;i&&(i.textContent=`Tiebreaker: ${t}`,i.style.borderColor="var(--warning-color)")}handleTiebreakerStarted(e){console.log("[BiggerDice] Tiebreaker started:",e);const t=(e.tiebreaker_players||[]).map(s=>String(s)),i=e.first_roller?String(e.first_roller):null;i&&(this.currentTurn=i),this.showTiebreakerMessage(t),this.updateGameUI(),this.checkAutoRollNeeded()}handleTurnChanged(e){console.log("[BiggerDice] Turn changed:",e),console.log("[DEBUG] handleTurnChanged - current player scores:",this.players.map(t=>({id:t.user_id||t.id,score:t.score}))),this.currentTurn=String(e.current_turn),this.round=e.turn_number||this.round,this.updateTurnIndicator(),this.updateButtons(),this.startTurnTimer(),this.checkAutoRollNeeded()}checkAutoRollNeeded(){if(console.log("[BiggerDice] checkAutoRollNeeded called:",{gameStatus:this.gameStatus,currentTurn:this.currentTurn,autoPlayers:[...this.autoPlayers],myPlayerId:this.myPlayerId,playersCount:this.players.length,isAnimating:this.isAnimating,queueLength:this.rollEventQueue.length}),this.gameStatus!==g.PLAYING){console.log("[BiggerDice] checkAutoRollNeeded: exiting - gameStatus not PLAYING:",this.gameStatus);return}if(!this.currentTurn){console.log("[BiggerDice] checkAutoRollNeeded: exiting - no currentTurn");return}const e=String(this.currentTurn);if(!this.autoPlayers.has(e)){console.log("[BiggerDice] checkAutoRollNeeded: exiting - currentTurn not in autoPlayers:",e);return}if(e===String(this.myPlayerId)){console.log("[BiggerDice] checkAutoRollNeeded: exiting - currentTurn is myself");return}if(this.pendingAutoRoll===e){console.log("[BiggerDice] checkAutoRollNeeded: exiting - auto-roll already pending for:",e);return}if(this.isAnimating||this.rollEventQueue.length>0){console.log("[BiggerDice] checkAutoRollNeeded: animation/queue in progress, deferring auto-roll");return}console.log("[BiggerDice] checkAutoRollNeeded: will auto-roll for kicked player:",e),this.pendingAutoRoll=e,this.autoRollTimeoutId&&(clearTimeout(this.autoRollTimeoutId),this.autoRollTimeoutId=null);const t=this.roomId;this.autoRollTimeoutId=setTimeout(()=>{if(this.autoRollTimeoutId=null,this.pendingAutoRoll=null,console.log("[BiggerDice] checkAutoRollNeeded setTimeout callback:",{gameStatus:this.gameStatus,currentTurn:this.currentTurn,expectedTurn:e,autoPlayers:[...this.autoPlayers],isAnimating:this.isAnimating,roomId:this.roomId,capturedRoomId:t}),this.roomId!==t){console.log("[BiggerDice] checkAutoRollNeeded setTimeout: exiting - roomId changed (parallel game switched)");return}if(this.gameStatus!==g.PLAYING){console.log("[BiggerDice] checkAutoRollNeeded setTimeout: exiting - gameStatus changed");return}if(String(this.currentTurn)!==e){console.log("[BiggerDice] checkAutoRollNeeded setTimeout: exiting - turn already changed (backend handled it)");return}if(!this.autoPlayers.has(e)){console.log("[BiggerDice] checkAutoRollNeeded setTimeout: exiting - player no longer auto");return}if(this.isAnimating||this.rollEventQueue.length>0){console.log("[BiggerDice] checkAutoRollNeeded setTimeout: animation/queue active during delay, re-queuing"),this.pendingAutoRoll=null;return}console.log("[BiggerDice] checkAutoRollNeeded setTimeout: sending auto-roll for:",e),this.sendAutoRoll(e)},200)}sendAutoRoll(e){console.log("[BiggerDice] Sending auto-roll for player:",e),this.send({type:"games.command.bigger_dice.auto_roll",room_id:this.roomId,target_user_id:e})}handleRoundComplete(e){if(e.scores){const t=this.players.find(s=>s.id===e.scores.player1_id),i=this.players.find(s=>s.id===e.scores.player2_id);t&&(t.score=e.scores.player1_score),i&&(i.score=e.scores.player2_score)}this.round=e.round,this.currentTurn=e.next_turn,this.showRoundResult(e),this.updateGameUI(),this.checkAutoRollNeeded()}handleGameOver(e){if(console.log("[BiggerDice] handleGameOver:",e),console.log("[DEBUG] handleGameOver ENTRY:",{isAnimating:this.isAnimating,queueLength:this.rollEventQueue.length,playersCount:this.players.length,diceElementsCount:this.diceElements.length}),this.players.length===0||this.diceElements.length===0||this.isAnimating||this.rollEventQueue.length>0){console.log("[BiggerDice] handleGameOver: queuing game_over (waiting for dice/animation)"),this.rollEventQueue.push({type:"game_over",message:e});return}this.processGameOver(e)}processGameOver(e){if(console.log("[BiggerDice] processGameOver:",e),this.gameStatus=g.FINISHED,this.autoRollTimeoutId&&(clearTimeout(this.autoRollTimeoutId),this.autoRollTimeoutId=null),this.pendingAutoRoll=null,e.final_scores&&Array.isArray(e.final_scores))e.final_scores.forEach(([t,i,s])=>{const a=this.players.find(o=>String(o.id||o.user_id)===String(t));a&&(a.score=s)});else if(e.scores){const t=this.players.find(s=>s.id===e.scores.player1_id),i=this.players.find(s=>s.id===e.scores.player2_id);t&&(t.score=e.scores.player1_score),i&&(i.score=e.scores.player2_score)}this.elements.chatPanel?.classList.add("hidden"),this.elements.gameFooter?.classList.add("hidden"),this.stopTurnTimer(),this.showGameOverResult(e),this.updateGameUI()}handleGameError(e){if(e.code==="wrong_password"&&this.pendingJoinRoomId){this.elements.joinPasswordError.textContent=e.message||"Incorrect password",this.elements.joinPasswordError.classList.remove("hidden"),this.elements.joinPasswordInput.value="",this.elements.joinPasswordInput.focus();return}if(e.code==="user_banned"){this.pendingJoinRoomId&&this.hideJoinPasswordModal(),this.dispatchEvent(new CustomEvent("game-error",{detail:{code:"user_banned",message:"You are banned from this room. Please contact the admin to unban you."}}));return}this.dispatchEvent(new CustomEvent("game-error",{detail:{code:e.code,message:e.message||"An error occurred"}}))}handleNotInRoom(e){console.log("[BiggerDice] Not in room:",e),this.notInRoomInfo={room_id:e.room_id,room_name:e.room_name,is_password_protected:e.is_password_protected,status:e.status,allow_spectators:e.allow_spectators===!0},this.showNotInRoomUI()}showNotInRoomUI(){this.notInRoomInfo&&(this.elements.waitingForAdmin.classList.add("hidden"),this.elements.adminLobby.classList.add("hidden"),this.elements.waitingState.classList.add("hidden"),this.elements.gameBoard.classList.add("hidden"),this.elements.chatPanel&&this.elements.chatPanel.classList.add("hidden"),this.elements.notInRoomState.classList.remove("hidden"),this.notInRoomInfo.allow_spectators&&this.elements.spectatorOptionContainer?(this.elements.spectatorOptionContainer.classList.remove("hidden"),this.elements.joinAsSpectatorCheckbox&&(this.elements.joinAsSpectatorCheckbox.checked=this.wantsToSpectate||!1)):this.elements.spectatorOptionContainer&&(this.elements.spectatorOptionContainer.classList.add("hidden"),this.wantsToSpectate=!1),this.updateEnterRoomButton(),this.elements.headerTitle.textContent=this.notInRoomInfo.room_name||"Bigger Dice",this.elements.gameStatus.textContent=this.formatStatus(this.notInRoomInfo.status))}updateEnterRoomButton(){this.notInRoomInfo&&(this.wantsToSpectate?this.notInRoomInfo.is_password_protected?(this.elements.enterRoomBtnText.textContent="Watch as Spectator (Password Required)",this.elements.notInRoomHint.textContent="This room is password protected. You will join as a spectator."):(this.elements.enterRoomBtnText.textContent="Watch as Spectator",this.elements.notInRoomHint.textContent="You will join as a spectator and watch the game."):this.notInRoomInfo.is_password_protected?(this.elements.enterRoomBtnText.textContent="Enter Room (Password Required)",this.elements.notInRoomHint.textContent="This room is password protected."):(this.elements.enterRoomBtnText.textContent="Enter Room",this.elements.notInRoomHint.textContent=""))}handleEnterRoomClick(){if(this.notInRoomInfo){if(this.wantsToSpectate){this.notInRoomInfo.is_password_protected?this.showJoinPasswordModal(this.notInRoomInfo.room_id,this.notInRoomInfo.room_name,!0):this.send({type:"games.command.join_as_spectator",room_name:this.notInRoomInfo.room_name});return}this.showJoinConfirmModal(this.notInRoomInfo.room_id,this.notInRoomInfo.room_name,this.notInRoomInfo.is_password_protected)}}executeJoinRoom(){this.notInRoomInfo&&(this.notInRoomInfo.is_password_protected?this.showJoinPasswordModal(this.notInRoomInfo.room_id,this.notInRoomInfo.room_name):this.send({type:"games.command.join_room",room_name:this.notInRoomInfo.room_name}))}sendReady(){this.stopReadyTimer(),this.send({type:"games.command.ready",room_id:this.roomId}),this.elements.readyBtn.disabled=!0}sendRoll(){this.stopTurnTimer(),this.send({type:"games.command.bigger_dice.roll",room_id:this.roomId}),this.elements.rollBtn.disabled=!0}startTurnTimer(){this.gameStatus===g.PLAYING&&String(this.currentTurn)===String(this.myPlayerId)&&(this.autoPlayers.has(String(this.myPlayerId))||this.isSpectator||(this.stopTurnTimer(),this.turnTimeRemaining=this.turnTimerDuration,this.updateTurnTimerUI(),this.elements.turnTimer?.classList.remove("hidden"),this.turnTimer=setInterval(()=>{this.turnTimeRemaining-=.1,this.turnTimeRemaining<=0?this.onTurnTimerExpired():this.updateTurnTimerUI()},100),console.log("[BiggerDice] Turn timer started")))}stopTurnTimer(){this.turnTimer&&(clearInterval(this.turnTimer),this.turnTimer=null),this.turnTimeRemaining=0,this.elements.turnTimer?.classList.add("hidden")}updateTurnTimerUI(){const e=this.elements.turnTimerProgress,t=this.elements.turnTimerText,i=this.elements.turnTimer;if(!e||!t||!i)return;const s=this.turnTimeRemaining/this.turnTimerDuration*100;e.style.width=`${Math.max(0,s)}%`;const a=Math.ceil(this.turnTimeRemaining);t.textContent=a,this.turnTimeRemaining<=2?i.classList.add("turn-timer--warning"):i.classList.remove("turn-timer--warning")}onTurnTimerExpired(){console.log("[BiggerDice] Turn timer expired - auto-rolling"),this.stopTurnTimer(),String(this.currentTurn)===String(this.myPlayerId)&&this.gameStatus===g.PLAYING&&!this.autoPlayers.has(String(this.myPlayerId))&&this.sendRoll()}sendEnableAutoPlay(){this.roomId&&(this.stopTurnTimer(),this.send({type:"games.command.bigger_dice.enable_auto_play",room_id:this.roomId}),this.elements.autoPlayBtn?.classList.add("hidden"))}startReadyTimer(){if(this.gameStatus!==g.WAITING||this.isSpectator)return;const e=this.players.find(t=>String(t.user_id||t.id)===String(this.myPlayerId));e&&(e.is_ready||(this.stopReadyTimer(),this.readyTimeRemaining=this.readyTimerDuration,this.updateReadyTimerUI(),this.elements.readyTimer?.classList.remove("hidden"),this.readyTimer=setInterval(()=>{this.readyTimeRemaining-=.1,this.readyTimeRemaining<=0?this.onReadyTimerExpired():this.updateReadyTimerUI()},100),console.log("[BiggerDice] Ready timer started, duration:",this.readyTimerDuration)))}stopReadyTimer(){this.readyTimer&&(clearInterval(this.readyTimer),this.readyTimer=null),this.readyTimeRemaining=0,this.elements.readyTimer?.classList.add("hidden"),this.elements.readyTimer?.classList.remove("ready-timer--warning")}updateReadyTimerUI(){const e=this.elements.readyTimerProgress,t=this.elements.readyTimerText,i=this.elements.readyTimer;if(!e||!t||!i)return;const s=this.readyTimeRemaining/this.readyTimerDuration*100;e.style.width=`${Math.max(0,s)}%`;const a=Math.ceil(this.readyTimeRemaining);t.textContent=a,this.readyTimeRemaining<=5?i.classList.add("ready-timer--warning"):i.classList.remove("ready-timer--warning")}onReadyTimerExpired(){if(console.log("[BiggerDice] Ready timer expired - auto-ready"),this.stopReadyTimer(),this.gameStatus!==g.WAITING||this.isSpectator)return;const e=this.players.find(t=>String(t.user_id||t.id)===String(this.myPlayerId));!e||e.is_ready||this.sendReady()}leaveGame(){this.send({type:"games.command.leave_room",room_id:this.roomId}),this.chatHistoryRequested={lobby:!1,players:!1,spectators:!1},this.chatMessages={lobby:[],players:[],spectators:[]},this.dispatchEvent(new CustomEvent("game-leave"))}selectPlayer(e){this.isAdmin&&this.send({type:"games.command.select_player",room_id:this.roomId,target_user_id:String(e)})}kickPlayer(e){this.isAdmin&&this.send({type:"games.command.kick_player",room_id:this.roomId,target_user_id:String(e)})}banPlayer(e){this.isAdmin&&this.send({type:"games.command.ban_player",room_id:this.roomId,target_user_id:String(e)})}unbanPlayer(e){this.isAdmin&&this.send({type:"games.command.unban_player",room_id:this.roomId,target_user_id:String(e)})}updateGameUI(){const e=this.elements.gameStatus,t=this.elements.waitingForAdmin,i=this.elements.adminLobby,s=this.elements.waitingState,a=this.elements.notInRoomState,o=this.elements.gameBoard;if(this.notInRoomInfo)return;e.textContent=this.formatStatus(this.gameStatus),e.className=`game-status game-status--${this.gameStatus}`;const r=this.players.length<this.maxPlayers,n=this.lobby.some(l=>String(l.user_id)===String(this.myPlayerId)),d=this.players.some(l=>String(l.user_id||l.id)===String(this.myPlayerId));console.log("[BiggerDice] updateGameUI: players.length=",this.players.length,"maxPlayers=",this.maxPlayers,"needsMorePlayers=",r,"isAdmin=",this.isAdmin,"amInLobby=",n,"amAPlayer=",d),t.classList.add("hidden"),i.classList.add("hidden"),s.classList.add("hidden"),a.classList.add("hidden"),o.classList.add("hidden"),r?this.isAdmin?(i.classList.remove("hidden"),this.renderAdminLobby()):n?(t.classList.remove("hidden"),this.renderWaitingPlayersList()):this.isSpectator?(t.classList.remove("hidden"),this.renderWaitingPlayersList()):s.classList.remove("hidden"):o.classList.remove("hidden"),this.renderPlayersArea(),this.renderDiceArea(),this.renderDisconnectOverlay(),this.updateTurnIndicator(),this.updateButtons(),this.elements.roundInfo.textContent=`Round ${this.round} / First to 10`}renderAdminLobby(){const e=this.elements.lobbyPlayersList,t=this.elements.lobbyCount,i=this.lobby.length,s=this.spectators.length,a=i+s;if(t.textContent=s>0?`${i} waiting, ${s} spectator${s>1?"s":""}`:`${i} waiting`,a===0)e.innerHTML=`
        <div class="lobby-empty">
          <div class="lobby-empty__icon">👥</div>
          <p>No players waiting. Share the room link to invite players!</p>
        </div>
      `;else{const o=this.lobby.map(n=>{const d=(n.username||"U").charAt(0).toUpperCase(),l=n.is_ready===!0,c=String(n.user_id)===String(this.hostId),m=String(n.user_id)===String(this.myPlayerId);let h="";c&&(h+='<span class="admin-badge">👑 Admin</span> '),l?h+='<span class="ready-badge">✓ Ready</span>':h+='<span class="waiting-badge">Waiting...</span>';let p="";return m?p=`
            <button class="select-btn" data-action="select" data-user-id="${n.user_id}">Select Myself</button>
            ${this.allowSpectators?`<button class="kick-btn" data-action="become-spectator" data-user-id="${n.user_id}">Become Spectator</button>`:""}
          `:p=`
            <button class="select-btn" data-action="select" data-user-id="${n.user_id}">Select</button>
            <button class="kick-btn" data-action="kick" data-user-id="${n.user_id}">Kick</button>
            <button class="ban-btn" data-action="ban" data-user-id="${n.user_id}">Ban</button>
          `,`
          <div class="lobby-player ${l?"lobby-player--ready":""} ${c?"lobby-player--admin":""}" data-user-id="${n.user_id}">
            <div class="lobby-player__info">
              <div class="lobby-player__avatar ${c?"lobby-player__avatar--admin":""}">${d}</div>
              <div>
                <div class="lobby-player__name">${this.escapeHtml(n.username)} ${h}</div>
                <div class="lobby-player__joined">${l?"Player is ready to start":c?"Room host - select players to start":"Waiting for player to ready up"}</div>
              </div>
            </div>
            <div class="lobby-player__actions">
              ${p}
            </div>
          </div>
        `}).join(""),r=this.spectators.map(n=>{const d=(n.username||"U").charAt(0).toUpperCase(),l=String(n.user_id)===String(this.hostId),c=String(n.user_id)===String(this.myPlayerId);let m="";l&&(m+='<span class="admin-badge">👑 Admin</span> '),m+='<span class="spectator-badge">👁 Spectator</span>';let h="";return c?h=`
            <button class="select-btn" data-action="become-player" data-user-id="${n.user_id}">Join as Player</button>
          `:h=`
            <button class="select-btn" data-action="select-spectator" data-user-id="${n.user_id}">Select to Play</button>
            <button class="kick-btn" data-action="kick-spectator" data-user-id="${n.user_id}">Kick</button>
            <button class="ban-btn" data-action="ban" data-user-id="${n.user_id}">Ban</button>
          `,`
          <div class="lobby-player lobby-player--spectator ${l?"lobby-player--admin":""}" data-user-id="${n.user_id}">
            <div class="lobby-player__info">
              <div class="lobby-player__avatar lobby-player__avatar--spectator ${l?"lobby-player__avatar--admin":""}">${d}</div>
              <div>
                <div class="lobby-player__name">${this.escapeHtml(n.username)} ${m}</div>
                <div class="lobby-player__joined">${l?"Room host - watching as spectator":"Watching the game (can be selected to play)"}</div>
              </div>
            </div>
            <div class="lobby-player__actions">
              ${h}
            </div>
          </div>
        `}).join("");e.innerHTML=o+r,e.querySelectorAll("[data-action]").forEach(n=>{n.addEventListener("click",d=>{const l=d.target.dataset.action,c=parseInt(d.target.dataset.userId,10);l==="select"?this.selectPlayer(c):l==="select-spectator"?this.selectSpectator(c):l==="kick"?this.kickPlayer(c):l==="kick-spectator"?this.kickSpectator(c):l==="ban"?this.banPlayer(c):l==="become-spectator"?this.becomeSpectator():l==="become-player"&&this.becomePlayer()})})}this.renderBannedPlayersList()}kickSpectator(e){console.log("[BiggerDice] Kicking spectator:",e),this.send({type:"games.command.kick_spectator",room_id:this.roomId,target_user_id:e})}selectSpectator(e){console.log("[BiggerDice] Selecting spectator to play:",e),this.send({type:"games.command.select_spectator",room_id:this.roomId,target_user_id:e})}becomeSpectator(){console.log("[BiggerDice] Admin becoming spectator"),this.send({type:"games.command.become_spectator",room_id:this.roomId})}becomePlayer(){console.log("[BiggerDice] Admin becoming player from spectator"),this.send({type:"games.command.become_player",room_id:this.roomId})}renderBannedPlayersList(){const e=this.elements.bannedPlayersSection,t=this.elements.bannedCount,i=this.elements.bannedPlayersList;if(!e||!i)return;const s=this.bannedPlayers.length;if(s===0){e.classList.add("hidden");return}e.classList.remove("hidden"),t.textContent=`${s} banned`,i.innerHTML=this.bannedPlayers.map(a=>{const o=(a.username||"U").charAt(0).toUpperCase();return`
        <div class="banned-player" data-user-id="${a.user_id}">
          <div class="banned-player__info">
            <div class="banned-player__avatar">${o}</div>
            <span class="banned-player__name">${this.escapeHtml(a.username)}</span>
          </div>
          <button class="unban-btn" data-action="unban" data-user-id="${a.user_id}">Unban</button>
        </div>
      `}).join(""),i.querySelectorAll('[data-action="unban"]').forEach(a=>{a.addEventListener("click",o=>{const r=parseInt(o.target.dataset.userId,10);this.unbanPlayer(r)})})}renderWaitingPlayersList(){const e=this.elements.waitingPlayersList;if(e){if(this.lobby.length===0){e.innerHTML="";return}e.innerHTML=`
      <div style="font-weight: 600; margin-bottom: 0.5rem; font-size: 0.875rem;">Players in lobby:</div>
      ${this.lobby.map(t=>{const i=t.is_ready===!0,s=String(t.user_id)===String(this.myPlayerId),a=String(t.user_id)===String(this.hostId);let o="";return a&&(o+='<span class="admin-badge" style="margin-right: 0.25rem;">👑 Admin</span>'),s&&(o+='<span style="color: var(--primary-color);">(you)</span>'),`
          <div class="waiting-player ${i?"waiting-player--ready":""} ${a?"waiting-player--admin":""}">
            <span class="waiting-player__name">${this.escapeHtml(t.username)} ${o}</span>
            <span class="waiting-player__status ${i?"waiting-player__status--ready":"waiting-player__status--waiting"}">
              ${i?"✓ Ready":a?"Host":"Waiting..."}
            </span>
          </div>
        `}).join("")}
    `}}renderPlayersArea(){const e=this.elements.playersArea;if(!e)return;console.log("[DEBUG] renderPlayersArea - START, scores:",this.players.map(i=>({id:i.user_id||i.id,score:i.score})));const t=[];for(let i=0;i<this.maxPlayers;i++){const s=this.players[i];if(s){const a=s.username||s.name||"Player",o=s.user_id||s.id,r=String(o),n=String(this.currentTurn)===String(o),d=s.is_ready===!0,l=s.score||0;console.log("[DEBUG] renderPlayersArea - rendering player:",o,"with score:",l);const c=a.charAt(0)?.toUpperCase()||"?",m=this.disconnectedPlayers.get(r),h=!!m,p=this.autoPlayers.has(r),b=h?this.getDisconnectSecondsLeft(m.timeoutAt):0,u=h&&this.canKickDisconnected(r,m.timeoutAt);t.push(`
          <div class="player-card ${n?"player-card--active":""} ${h?"player-card--disconnected":""} ${p?"player-card--auto":""}" data-player-id="${o}">
            <div class="player-avatar">${this.escapeHtml(c)}</div>
            <div class="player-name">${this.escapeHtml(a)}</div>
            <div class="player-score">${l}</div>
            <div class="player-label">Points</div>
            <div class="player-ready ${d?"":"hidden"}">Ready!</div>
            ${p?'<div class="player-card__auto">Auto</div>':""}
            ${h?`
              <div class="player-card__disconnect">
                <div class="disconnect-spinner" aria-hidden="true"></div>
                <div class="disconnect-timer">
                  ${b>0?`Reconnecting... ${b}s`:"Disconnected"}
                </div>
                ${u?`
                  <button class="kick-btn" data-action="kick-disconnected" data-user-id="${r}">Kick</button>
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
        `);i<this.maxPlayers-1&&t.push('<div class="vs-indicator">VS</div>')}e.innerHTML=t.join(""),console.log("[DEBUG] renderPlayersArea - END, innerHTML updated")}updateScoresOnly(){const e=this.elements.playersArea;if(!e)return;const i=Math.min(this.players.length,10);for(let s=0;s<i;s++){const a=this.players[s],o=a.user_id||a.id,r=e.querySelector(`.player-card[data-player-id="${o}"]`);if(r){const n=r.querySelector(".player-score");if(n){const d=a.score||0;n.textContent!==String(d)&&(n.textContent=d,n.classList.add("score-updated"),setTimeout(()=>n.classList.remove("score-updated"),300))}}}}renderDiceArea(){const e=this.elements.diceContainer;if(!e)return;if(this.isAnimating||this.rollEventQueue.length>0){console.log("[BiggerDice] renderDiceArea: skipping - animation in progress or queue not empty");return}if(this.players.length===0){e.innerHTML="",this.diceElements=[];return}const i=this.players.map((s,a)=>{const o=s.username||s.name||`Player ${a+1}`;return`
        <div class="dice-wrapper" data-player-index="${a}">
          <div class="dice-label">${this.escapeHtml(o)}</div>
          <div class="dice dice--player-${a}" id="dice-${a}" data-value="0">
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
      `}).join("");e.innerHTML=i,this.diceElements=this.players.map((s,a)=>e.querySelector(`#dice-${a}`)),console.log(`[BiggerDice] renderDiceArea: created ${this.diceElements.length} dice elements`),this.applyDiceState()}renderDisconnectOverlay(){const e=this.elements.disconnectOverlay;if(!e)return;const t=String(this.myPlayerId),i=this.players.some(d=>String(d.user_id||d.id)===t),s=Array.from(this.disconnectedPlayers.entries()).filter(([d])=>d!==t&&!this.autoPlayers.has(d)),a=this.gameStatus===g.PLAYING&&i&&!this.isSpectator&&s.length>0;if(e.classList.toggle("active",a),e.setAttribute("aria-hidden",String(!a)),!a)return;e.querySelector(".disconnect-modal")||(e.innerHTML=`
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
      `);const o=e.querySelector(".disconnect-list");if(!o)return;const r=new Set(s.map(([d])=>d));(r.size!==this.disconnectOverlayIds.size||Array.from(r).some(d=>!this.disconnectOverlayIds.has(d)))&&(o.innerHTML=s.map(([d])=>{const l=this.players.find(m=>String(m.user_id||m.id)===d),c=l?.username||l?.name||`User #${d}`;return`
          <div class="disconnect-item" data-user-id="${d}">
            <div class="disconnect-item__left">
              <div class="disconnect-item__name">${this.escapeHtml(c)}</div>
              <div class="disconnect-item__timer" data-role="timer">Disconnected</div>
            </div>
            <div data-role="action"></div>
          </div>
        `}).join(""),this.disconnectOverlayIds=r),s.forEach(([d,l])=>{const c=o.querySelector(`.disconnect-item[data-user-id="${d}"]`);if(!c)return;const m=c.querySelector('[data-role="timer"]'),h=c.querySelector('[data-role="action"]'),p=this.getDisconnectSecondsLeft(l.timeoutAt),b=this.canKickDisconnected(d,l.timeoutAt),u=this.kickVotes.has(d);m&&(m.textContent=p>0?`Reconnecting... ${p}s`:"Disconnected"),h&&(p>0?h.innerHTML='<div class="disconnect-item__status">Waiting</div>':u?h.innerHTML='<div class="disconnect-voted">Vote sent</div>':b?h.innerHTML=`<button class="kick-btn" data-action="kick-disconnected" data-user-id="${d}">Kick disconnected</button>`:h.innerHTML="")})}updateTurnIndicator(){const e=this.elements.turnIndicator;if(this.gameStatus!==g.PLAYING){e.classList.add("hidden");return}if(e.classList.remove("hidden"),String(this.currentTurn)===String(this.myPlayerId))e.textContent="Your turn - Roll the dice!",e.style.borderColor="var(--success-color)";else{const t=this.players.find(s=>String(s.user_id||s.id)===String(this.currentTurn)),i=t?.username||t?.name||"Opponent";e.textContent=`${i}'s turn...`,e.style.borderColor="var(--primary-color)"}}updateButtons(){const e=this.elements.readyBtn,t=this.elements.rollBtn,i=this.elements.autoPlayBtn;if(this.isSpectator||this.autoPlayers.has(String(this.myPlayerId))){e?.classList.add("hidden"),t?.classList.add("hidden"),i?.classList.add("hidden");return}const s=this.players.find(o=>String(o.user_id||o.id)===String(this.myPlayerId));if(!!!s){e?.classList.add("hidden"),t?.classList.add("hidden"),i?.classList.add("hidden");return}this.gameStatus===g.WAITING?(t?.classList.add("hidden"),i?.classList.add("hidden"),s&&!s.is_ready?(e?.classList.remove("hidden"),e.disabled=!1):e?.classList.add("hidden")):this.gameStatus===g.PLAYING?(e?.classList.add("hidden"),t?.classList.remove("hidden"),t.disabled=String(this.currentTurn)!==String(this.myPlayerId),i?.classList.remove("hidden")):(e?.classList.add("hidden"),t?.classList.add("hidden"),i?.classList.add("hidden"))}startDisconnectTicker(){this.disconnectTicker||(this.disconnectTicker=setInterval(()=>{if(this.disconnectedPlayers.size===0){this.stopDisconnectTickerIfNeeded();return}this.renderPlayersArea(),this.renderDisconnectOverlay()},1e3))}stopDisconnectTickerIfNeeded(){this.disconnectedPlayers.size===0&&this.disconnectTicker&&(clearInterval(this.disconnectTicker),this.disconnectTicker=null)}getDisconnectSecondsLeft(e){if(!e)return 0;const t=e.getTime()-Date.now();return Math.max(0,Math.ceil(t/1e3))}canKickDisconnected(e,t){const i=String(e);return!this.isPlayer||this.isSpectator||String(this.myPlayerId)===i||this.kickVotes.has(i)||this.gameStatus!==g.PLAYING?!1:this.getDisconnectSecondsLeft(t)===0}sendKickDisconnected(e){const t=String(e);this.roomId&&(this.kickVotes.has(t)||(this.kickVotes.add(t),this.send({type:"games.command.vote_kick_disconnected",room_id:this.roomId,target_user_id:t}),this.updateGameUI()))}animateDiceRoll(e,t){return new Promise(i=>{this.isAnimating=!0,e.classList.add("dice--rolling");let s=0;const a=10,r=setInterval(()=>{const n=Math.floor(Math.random()*6)+1;e.dataset.value=n,s++,s>=a&&(clearInterval(r),e.classList.remove("dice--rolling"),e.dataset.value=t,this.isAnimating=!1,i())},100)})}showRoundResult(e){const t=this.elements.resultOverlay,i=this.players[0],s=this.players[1],a=i?.username||i?.name||"Player 1",o=s?.username||s?.name||"Player 2",r=String(e.winner_id)===String(this.myPlayerId);this.elements.resultIcon.textContent=r?"🎉":e.winner_id?"😢":"🤝",this.elements.resultTitle.textContent=r?"You Won!":e.winner_id?"You Lost":"Tie!",this.elements.resultScore1.textContent=i?.score||0,this.elements.resultLabel1.textContent=a,this.elements.resultScore2.textContent=s?.score||0,this.elements.resultLabel2.textContent=o,this.elements.resultMessage.textContent=`Round ${this.round} complete`,t.classList.add("active")}showGameOverResult(e){const t=this.elements.gameBoard,i=String(this.myPlayerId),s=e.winner_id||e.winner,a=this.players.find(m=>String(m.id||m.user_id)===String(s)),o=e.winner_username||e.winner_name||a?.username||a?.name||"Winner",r=String(s)===i,n=Math.max(...this.players.map(m=>m.score||0)),d=this.players.map((m,h)=>{const p=m.username||m.name||`Player ${h+1}`,b=m.score||0;return`
        <div class="game-over__player ${b===n&&b>0?"game-over__player--winner":""}">
          <div class="game-over__player-name">${this.escapeHtml(p)}</div>
          <div class="game-over__player-score">${b}</div>
        </div>
      `}).join(this.players.length===2?'<div class="game-over__vs">vs</div>':""),l=this.roundHistory.length>0?`
      <div class="game-over__history">
        <h4 class="game-over__history-title">Round Results</h4>
        <table class="game-over__table">
          <thead>
            <tr>
              <th>Round</th>
              ${this.players.map((m,h)=>`<th>${this.escapeHtml(m.username||m.name||`P${h+1}`)}</th>`).join("")}
              <th>Winner</th>
            </tr>
          </thead>
          <tbody>
            ${this.roundHistory.map(m=>`
              <tr class="${m.winnerId===i?"game-over__row--win":""}">
                <td>${m.round}</td>
                ${m.rolls?this.players.map((h,p)=>{const b=String(h.user_id||h.id),u=m.rolls.find(x=>String(x.id)===b),w=u?u.roll!==void 0?u.roll:u:"-";return`<td class="${m.winnerId===b?"game-over__cell--winner":""}">${w}</td>`}).join(""):`
                  <td class="${m.winnerId===m.player1?.id?"game-over__cell--winner":""}">${m.player1?.roll||"-"}</td>
                  <td class="${m.winnerId===m.player2?.id?"game-over__cell--winner":""}">${m.player2?.roll||"-"}</td>
                `}
                <td>${m.winnerName?this.escapeHtml(m.winnerName):"-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `:"";t.innerHTML=`
      <div class="game-over">
        <div class="game-over__header">
          <div class="game-over__icon">${r?"🏆":"🥈"}</div>
          <h2 class="game-over__title">${r?"Victory!":"Game Over"}</h2>
          <p class="game-over__subtitle">${this.escapeHtml(o)} wins the game!</p>
        </div>

        <div class="game-over__scores ${this.players.length>2?"game-over__scores--multi":""}">
          ${d}
        </div>

        ${l}

        <div class="game-over__actions">
          <button class="game-over__btn game-over__btn--primary" id="returnToLobbyBtn">Return to Lobby</button>
        </div>
      </div>
    `;const c=t.querySelector("#returnToLobbyBtn");c&&c.addEventListener("click",()=>{this.leaveGame()}),t.classList.remove("hidden")}hideResultOverlay(){this.elements.resultOverlay.classList.remove("active")}escapeHtml(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}formatStatus(e){return{waiting:"Waiting",playing:"Playing",in_progress:"In Progress",finished:"Finished",abandoned:"Abandoned"}[e]||e}switchLobbyTab(e){this.historyTab!==e&&(this.historyTab=e,this.elements.tabRooms?.classList.toggle("active",e==="rooms"),this.elements.tabHistory?.classList.toggle("active",e==="history"),this.elements.tabContentRooms?.classList.toggle("active",e==="rooms"),this.elements.tabContentHistory?.classList.toggle("active",e==="history"),e==="history"&&this.historyGames.length===0&&this.loadHistoryPage(1))}async loadHistoryPage(e){if(!(this.historyLoading||e<1)){this.historyLoading=!0,this.historyPage=e,this.elements.historyLoading?.classList.remove("hidden"),this.elements.historyEmpty?.classList.add("hidden"),this.elements.historyList?.classList.add("hidden"),this.elements.historyPagination?.classList.add("hidden");try{const t=await fetch(`/api/v1/games/bigger_dice/history?page=${e}&limit=16`);if(!t.ok)throw new Error(`HTTP ${t.status}`);const i=await t.json();this.historyGames=i.games||[],this.historyTotalPages=i.pagination?.total_pages||1,this.historyPage=i.pagination?.page||1,this.renderHistoryList()}catch(t){console.error("[BiggerDice] Failed to load game history:",t),this.historyGames=[],this.renderHistoryList()}finally{this.historyLoading=!1,this.elements.historyLoading?.classList.add("hidden")}}}renderHistoryList(){const e=this.elements.historyList,t=this.elements.historyEmpty,i=this.elements.historyPagination;if(this.historyGames.length===0){t?.classList.remove("hidden"),e?.classList.add("hidden"),i?.classList.add("hidden");return}if(t?.classList.add("hidden"),e?.classList.remove("hidden"),e.innerHTML=this.historyGames.map(s=>{const a=s.players?.find(c=>String(c.user_id)===String(this.userId)),o=a?.is_winner?"win":s.winner_id?"loss":"draw",r=a?.final_score||0,n=s.players?.find(c=>String(c.user_id)!==String(this.userId))?.final_score||0,d=new Date(s.played_at||s.finished_at),l=d.toLocaleDateString()+" "+d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});return`
        <div class="history-item" data-game-id="${s.game_id}">
          <div class="history-item__main">
            <div class="history-item__room">${this.escapeHtml(s.room_name)}</div>
            <div class="history-item__date">${l}</div>
          </div>
          <div class="history-item__result">
            <span class="history-item__score">${r} - ${n}</span>
            <span class="history-item__badge history-item__badge--${o}">${o}</span>
          </div>
        </div>
      `}).join(""),this.historyTotalPages>1){i?.classList.remove("hidden"),this.elements.historyFirstBtn.disabled=this.historyPage<=1,this.elements.historyPrevBtn.disabled=this.historyPage<=1,this.elements.historyNextBtn.disabled=this.historyPage>=this.historyTotalPages,this.elements.historyLastBtn.disabled=this.historyPage>=this.historyTotalPages,this.elements.historyPageInput&&(this.elements.historyPageInput.max=this.historyTotalPages,this.elements.historyPageInput.value="");const{startPage:s,endPage:a}=this.calculatePageWindow(this.historyPage,this.historyTotalPages);let o="";for(let r=s;r<=a;r++){const n=r===this.historyPage;o+=`
          <button class="history-pagination__btn ${n?"history-pagination__btn--active":""}"
                  data-page="${r}"
                  ${n?'aria-current="page" disabled':""}>
            ${r}
          </button>
        `}this.elements.historyPages&&(this.elements.historyPages.innerHTML=o)}else i?.classList.add("hidden")}calculatePageWindow(e,t){let a,o;return t<=7?(a=1,o=t):e<=4?(a=1,o=7):e>=t-3?(a=t-7+1,o=t):(a=e-3,o=e+3),{startPage:a,endPage:o}}async showHistoryDetails(e){try{const t=await fetch(`/api/v1/games/bigger_dice/history/${e}`,{credentials:"include"});if(t.ok){const i=await t.json();this.selectedHistoryGame=i.game||i}else{console.error("[BiggerDice] Failed to fetch game details:",t.status);const i=this.historyGames.find(s=>s.game_id===e);if(i)this.selectedHistoryGame=i;else return}}catch(t){console.error("[BiggerDice] Failed to fetch game details:",t);const i=this.historyGames.find(s=>s.game_id===e);if(i)this.selectedHistoryGame=i;else return}this.historyView="details",this.renderHistoryDetails(),this.elements.historyListView?.classList.add("hidden"),this.elements.historyDetailsView?.classList.add("active")}showHistoryList(){this.historyView="list",this.selectedHistoryGame=null,this.elements.historyDetailsView?.classList.remove("active"),this.elements.historyListView?.classList.remove("hidden")}renderHistoryDetails(){const e=this.selectedHistoryGame;if(!e)return;const t=this.elements.historyDetailsSummary,i=this.elements.historyRoundsList,s=e.players||[];s.find(n=>n.is_winner);const a=new Date(e.played_at||e.finished_at),o=a.toLocaleDateString()+" "+a.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});t.innerHTML=`
      <div class="history-details__players">
        ${s.map(n=>`
          <div class="history-details__player ${n.is_winner?"history-details__player--winner":""}">
            <span class="history-details__player-name">${this.escapeHtml(n.username)}</span>
            <span class="history-details__player-score">${n.final_score}</span>
          </div>
        `).join('<span class="history-details__vs">vs</span>')}
      </div>
      <div class="history-details__info">
        <div>${o}</div>
        <div>${e.duration_seconds?Math.floor(e.duration_seconds/60)+" min":""}</div>
      </div>
    `;const r=e.rounds||[];if(r.length===0){i.innerHTML='<p style="color: var(--text-muted); padding: 1rem;">No round data available</p>';return}i.innerHTML=r.map(n=>{const d=n.rolls||{},l=Object.entries(d),c=Math.max(...l.map(([,m])=>m));return`
        <div class="history-round ${n.is_tiebreaker?"history-round--tiebreaker":""}">
          <span class="history-round__number">
            Round ${n.round_number}
            ${n.is_tiebreaker?'<span class="history-round__tiebreaker-badge">Tiebreaker</span>':""}
          </span>
          <div class="history-round__rolls">
            ${l.map(([m,h])=>{const p=s.find(u=>String(u.user_id)===String(m));return`
                <span class="history-round__roll ${h===c&&l.filter(([,u])=>u===c).length===1?"history-round__roll--winner":""}">
                  ${this.escapeHtml(p?.username||"Player")}:
                  <span class="history-round__roll-value">${h}</span>
                </span>
              `}).join("")}
          </div>
          ${n.winner_id?'<span class="history-round__winner">Winner</span>':""}
        </div>
      `}).join("")}}customElements.get("bigger-dice")||customElements.define("bigger-dice",_),console.log("[BIGGER_DICE] Web component registered")})();
