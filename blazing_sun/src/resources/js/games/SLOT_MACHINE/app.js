(function(){"use strict";const p=document.createElement("template");p.innerHTML=`
  <style>
    :host {
      display: block;
      font-family: "Lucida Sans Unicode", "Lucida Grande", sans-serif;
      /* Blazing Sun Theme Colors */
      --primary-color: var(--color-accent, #667eea);
      --primary-light: var(--color-accent-light, #818cf8);
      --primary-dark: var(--color-accent-dark, #4f46e5);
      --success-color: var(--color-success, #10b981);
      --danger-color: var(--color-error, #ef4444);
      --warning-color: var(--color-warning, #f59e0b);
      --info-color: var(--color-info, #3b82f6);
      /* Text Colors */
      --slot-text-primary: var(--text-primary, #333333);
      --slot-text-secondary: var(--text-secondary, #555555);
      --slot-text-muted: var(--text-muted, #666666);
      /* Background Colors */
      --slot-card-bg: var(--card-bg, #ffffff);
      --slot-input-bg: var(--input-bg, #ffffff);
      --slot-border-color: var(--input-border, #e0e0e0);
      --bg-gradient: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
      /* Carousel Cell Colors (theme-aware) */
      --slot-cell-border: var(--card-bg, #ffffff);
      --slot-cell-shadow-light: var(--cell-shadow-light, rgba(255, 255, 255, 0.5));
      --slot-cell-shadow-dark: var(--cell-shadow-dark, rgba(0, 0, 0, 1));
      --slot-cell-shadow-gray: var(--cell-shadow-gray, gray);
      --slot-cell-inset-border: var(--card-bg, #ffffff);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .slot-game {
      background: var(--bg-gradient);
      background-attachment: fixed;
      border-radius: 1rem;
      padding: 1.5rem;
      user-select: none;
      -webkit-user-select: none;
    }

    /* Top Controls Row */
    .slot-top-controls {
      display: grid;
      grid-template-columns: 180px 1fr 180px;
      gap: 1rem;
      margin-bottom: 3rem;
      align-items: center;
    }

    .slot-top-controls-center {
      display: flex;
      justify-content: center;
      align-items: stretch;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .slot-controls-wrapper {
      display: flex;
      align-items: stretch;
      gap: 0.5rem;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
    }

    .slot-right-column {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      color: var(--slot-text-primary);
    }

    .spins-counter {
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      font-size: 0.875rem;
      text-align: center;
      color: var(--slot-text-primary);
    }

    /* Buttons */
    button {
      display: inline-block;
      padding: 8px 20px;
      cursor: pointer;
      border: 1px solid #bbb;
      overflow: visible;
      font: bold 13px arial, helvetica, sans-serif;
      text-decoration: none;
      color: #555;
      background-color: #ddd;
      background-image: linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0));
      background-clip: padding-box;
      border-radius: 3px;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3), 0 2px 2px -1px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(255, 255, 255, 0.3) inset;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
    }

    button:hover { background-color: #eee; }
    button:active {
      background: #e9e9e9;
      position: relative;
      top: 1px;
      text-shadow: none;
      box-shadow: 0 1px 1px rgba(0, 0, 0, 0.3) inset;
    }

    button[disabled] {
      border-color: #eaeaea;
      background: #fafafa;
      cursor: default;
      position: static;
      color: #999;
      box-shadow: none !important;
      text-shadow: none !important;
    }

    .disabled {
      pointer-events: none;
      opacity: 0.5;
      cursor: default;
    }

    /* Blazing Sun Theme Buttons (same style as control-group) */
    .btn-primary,
    .btn-secondary {
      padding: 0.625rem 1.25rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      color: var(--slot-text-primary);
      cursor: pointer;
      min-width: 100px;
      height: 96px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
    }

    .btn-primary:hover,
    .btn-secondary:hover {
      background: color-mix(in srgb, var(--primary-color) 60%, transparent);
      color: white;
      border-color: var(--primary-color);
    }

    .btn-primary:active,
    .btn-secondary:active {
      box-shadow: 0 2px rgba(0,0,0,0.3);
      transform: translateY(2px);
    }

    .btn-primary.active,
    .btn-secondary.active {
      background: color-mix(in srgb, var(--success-color) 60%, transparent);
      color: white;
    }

    /* Progress Bar Container */
    .progress-container {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      flex-direction: column;
      gap: 4px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 6px 20px 1rem 20px;
      width: 200px;
      height: 96px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
    }

    .progress-label {
      font-size: 0.75rem;
      color: var(--slot-text-secondary);
      font-weight: bold;
      display: none;
    }

    progress {
      display: block;
      width: 160px;
      height: 25px;
      padding: 4px;
      border: 0 none;
      background: #444;
      border-radius: 14px;
      box-shadow: inset 0 1px 1px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.2);
    }

    progress::-webkit-progress-bar {
      background: transparent;
    }
    progress::-webkit-progress-value {
      border-radius: 12px;
      background: #fff;
      box-shadow: inset 0 -2px 4px rgba(0,0,0,0.4), 0 2px 5px rgba(0,0,0,0.3);
    }
    progress::-moz-progress-bar {
      border-radius: 12px;
      background: #fff;
    }

    /* Main Game Layout */
    .slot-layout {
      display: grid;
      grid-template-columns: 180px 1fr 180px;
      gap: 1rem;
      align-items: start;
    }

    @media (max-width: 900px) {
      .slot-layout {
        grid-template-columns: 1fr;
      }
      .slot-sidebar { order: 2; }
      .slot-center { order: 1; }
      .slot-options { order: 3; }
    }

    /* Center Column */
    .slot-center {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    /* Sidebars */
    .slot-sidebar,
    .slot-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .slot-options,
    .slot-sidebar {
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
      align-self: start;
    }

    .nav-div {
      background: color-mix(in srgb, var(--slot-input-bg) 60%, transparent);
      padding: 8px;
      border-radius: 6px;
      border: 2px solid var(--slot-border-color);
      box-shadow: 0 4px rgba(0,0,0,0.3);
    }

    .nav-div button {
      width: 100%;
      margin-bottom: 8px;
      min-height: 80px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      color: var(--slot-text-primary);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      cursor: pointer;
      font-size: 0.9375rem;
      font-weight: 500;
    }

    .nav-div button:hover {
      background: color-mix(in srgb, var(--primary-color) 60%, transparent);
      color: white;
      border-color: var(--primary-color);
    }

    .slot-options button,
    .slot-sidebar button {
      width: 100%;
      width: -webkit-fill-available;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      margin: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      padding: 1%;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      color: var(--slot-text-primary);
      cursor: pointer;
    }

    .slot-options button:hover,
    .slot-sidebar button:hover {
      background: color-mix(in srgb, var(--primary-color) 60%, transparent);
      color: white;
      border-color: var(--primary-color);
    }

    .slot-options .control-group,
    .slot-sidebar .control-group {
      width: 100%;
      width: -webkit-fill-available;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      margin: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      padding: 1%;
      text-align: center;
    }

    /* Stronger borders for all clickable elements */
    .slot-controls-wrapper button,
    .slot-controls-wrapper .btn-primary,
    .slot-controls-wrapper .btn-secondary,
    .slot-sidebar button,
    .slot-sidebar .control-group,
    .slot-options button,
    .slot-options .control-group {
      border-width: 2px;
    }

    .control-group {
      width: 100%;
      border: 2px solid var(--slot-border-color);
      margin-bottom: 4px;
      padding: 4px 8px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      cursor: pointer;
      color: var(--slot-text-secondary);

    }

    .control-group:hover {
      background: color-mix(in srgb, var(--primary-color) 60%, transparent);
      color: white;
      border-color: var(--primary-color);
    }

    .control-group label,
    .control-group input {
      pointer-events: none;
      cursor: pointer;
    }

    .control-group.active {
      background: color-mix(in srgb, var(--success-color) 60%, transparent);
      color: white;
    }

    .control-group.active:hover {
      background: color-mix(in srgb, var(--success-color) 80%, transparent);
    }

    /* Joker Container & Lines Container */
    .joker-container,
    .lines-container {
      display: none;
      flex-direction: column;
      gap: 0.5rem;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 8px;
      margin: 8px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
    }

    .joker-hint {
      font-size: 9px;
      padding: 5px 0;
      margin: 4px 0 0;
    }

    /* Lines Container */
    .lines-container > div {
      display: flex;
      justify-content: center;
      align-items: center;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      width: 100%;
      padding: 6px 8px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      box-shadow: 0 4px rgba(0,0,0,0.3);
      cursor: pointer;
      color: var(--slot-text-secondary);
      transition: all 0.2s;
    }

    .lines-container > div:hover {
      background: color-mix(in srgb, var(--primary-color) 60%, transparent);
      color: white;
      border-color: var(--primary-color);
    }

    .lines-container > div.active {
      background: color-mix(in srgb, var(--success-color) 60%, transparent);
      color: white;
    }

    .lines-container > div.active:hover {
      background: color-mix(in srgb, var(--success-color) 80%, transparent);
    }

    .lines-container > div.disabled {
      pointer-events: none;
      opacity: 0.6;
    }

    .lines-container label {
      cursor: pointer;
    }

    /* Reels/Spinners */
    .spinners {
      display: flex;
      overflow: visible;
      padding: 10px;
      position: relative;
      border-radius: 8px;
      transform: translateY(20px);
    }

    .scene {
      transition: 0.3s;
      margin: 100px 0;
      position: relative;
      width: 100%;
      height: 120px;
    }

    .carousel {
      transform: translateZ(-220px);
      height: 100%;
      transform-style: preserve-3d;
      transition-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .carousel__cell {
      position: absolute;
      width: 100%;
      height: 120px;
    }

    .carousel__cell p {
      color: white;
      will-change: auto;
      height: 100%;
      font-size: 4rem;
      font-weight: bold;
      height: -webkit-fill-available;
      width: 100%;
      width: -webkit-fill-available;
      margin: 0;
      box-shadow:
        0px -1px 2px var(--slot-cell-shadow-gray) inset,
        0px 0px 0px 3px var(--slot-cell-inset-border) inset,
        0px 1px 5px 2px var(--slot-cell-shadow-dark) inset,
        0px 15px 0px 3px var(--slot-cell-shadow-light) inset,
        0px -8px 15px 0px var(--slot-cell-shadow-dark) inset;
      border: 10px solid var(--slot-cell-border);
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .carousel__cell:nth-child(1) p { background: hsla(0, 100%, 50%, 1); }
    .carousel__cell:nth-child(2) p { background: hsla(40, 100%, 50%, 1); }
    .carousel__cell:nth-child(3) p { background: hsla(80, 100%, 50%, 1); }
    .carousel__cell:nth-child(4) p { background: hsla(120, 100%, 50%, 1); }
    .carousel__cell:nth-child(5) p { background: hsla(160, 100%, 50%, 1); }
    .carousel__cell:nth-child(6) p { background: hsla(200, 100%, 50%, 1); }
    .carousel__cell:nth-child(7) p { background: hsla(0, 100%, 50%, 1); }
    .carousel__cell:nth-child(8) p { background: hsla(40, 100%, 50%, 1); }
    .carousel__cell:nth-child(9) p { background: hsla(80, 100%, 50%, 1); }
    .carousel__cell:nth-child(10) p { background: hsla(120, 100%, 50%, 1); }
    .carousel__cell:nth-child(11) p { background: hsla(160, 100%, 50%, 1); }
    .carousel__cell:nth-child(12) p { background: hsla(200, 100%, 50%, 1); }

    .canvas-overlay {
      border: solid var(--primary-color);
      width: 100%;
      position: absolute;
      top: 0;
      height: 100%;
      border-width: 8px;
      left: 0;
      z-index: 9;
      border-radius: 8px;
      pointer-events: none;
    }

    .canvas-overlay.joker-active {
      pointer-events: auto;
      cursor: pointer;
    }

    .canvas-overlay.single-line-mode {
      border-color: #5B2D8F;
      top: 33.33%;
      height: 33.33%;
    }

    /* Info Panel */
    .info-panel {
      width: 100%;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      display: flex;
      overflow: hidden;
      padding: 0.75rem;
      flex-wrap: wrap;
      gap: 0.5rem;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
      margin-top: 3rem;
    }

    .info-panel > div {
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 4px 8px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      font-size: 0.875rem;
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
    }

    /* Odds Tables */
    .odds-container {
      width: 100%;
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.75rem;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      box-shadow: 0 4px rgba(0,0,0,0.3);
      color: var(--slot-text-primary);
    }

    .odds-table {
      flex: 1;
      min-width: 150px;
      border-collapse: separate;
      border-spacing: 2px;
      background: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      border: 2px solid var(--slot-border-color);
      border-radius: 6px;
      padding: 4px;
      box-shadow: 0 4px rgba(0,0,0,0.3);
    }

    .odds-table caption {
      font-size: 14px;
      margin-bottom: 4px;
      font-weight: bold;
      color: var(--slot-text-primary);
    }

    .odds-table td {
      font-size: 10px;
      height: 16px;
      background-color: color-mix(in srgb, var(--slot-card-bg) 60%, transparent);
      text-align: center;
      vertical-align: middle;
      padding: 4px 6px;
      color: var(--slot-text-primary);
      border-radius: 4px;
      border: 1px solid var(--slot-border-color);
      box-shadow: 0 2px rgba(0,0,0,0.2);
    }

    .odds-table td:empty,
    .odds-table .empty-cell {
      background-color: transparent;
      border-color: transparent;
      box-shadow: none;
    }

    .odds-value {
      background-color: color-mix(in srgb, var(--success-color) 60%, transparent) !important;
      color: white !important;
      font-weight: bold;
    }

    .line-label {
      background-color: color-mix(in srgb, var(--slot-input-bg) 60%, transparent) !important;
      font-weight: bold;
      font-size: 9px;
      white-space: nowrap;
    }

    /* Win Overlay */
    .win-overlay {
      padding: 20px;
      background: rgba(255,255,255,0.95);
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 100001;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      min-width: 300px;
    }

    .win-overlay h1 {
      margin: 10px 0;
      color: var(--success-color);
    }

    .win-overlay h2 {
      margin: 10px 0;
      color: #333;
    }

    .win-overlay button {
      margin: 10px 5px;
      padding: 10px 30px;
    }

    /* Bingo Mini Game Overlay */
    .minigame-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 100002;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
      box-sizing: border-box;
    }

    .minigame-container {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 16px;
      padding: 20px;
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      border: 2px solid var(--slot-border-color);
    }

    .minigame-header {
      text-align: center;
      margin-bottom: 20px;
      color: #fff;
    }

    .minigame-header h2 {
      margin: 0 0 10px 0;
      font-size: 1.5rem;
      color: var(--primary-color);
    }

    .minigame-header p {
      margin: 5px 0;
      font-size: 0.9rem;
      color: #aaa;
    }

    .minigame-prize {
      font-size: 1.2rem;
      color: var(--success-color);
      font-weight: bold;
    }

    .minigame-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    @media (max-width: 600px) {
      .minigame-layout {
        grid-template-columns: 1fr;
      }
    }

    .minigame-numbers {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 15px;
      border: 2px solid var(--slot-border-color);
    }

    .minigame-numbers h3 {
      margin: 0 0 15px 0;
      color: #fff;
      font-size: 1rem;
      text-align: center;
    }

    .number-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
    }

    .number-btn {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 50%;
      border: 2px solid var(--slot-border-color);
      background: linear-gradient(145deg, #2a2a4a, #1a1a3a);
      color: #fff;
      font-weight: bold;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .number-btn:hover:not(.selected):not(.disabled) {
      background: linear-gradient(145deg, var(--primary-color), #3a3a6a);
      transform: scale(1.1);
    }

    .number-btn.selected {
      background: linear-gradient(145deg, var(--success-color), #1a8a3a);
      border-color: var(--success-color);
      transform: scale(1.05);
    }

    .number-btn.disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .number-btn.drawn {
      background: linear-gradient(145deg, #ff6b6b, #c92a2a);
      border-color: #ff6b6b;
      animation: pulse 0.5s ease-out;
    }

    .number-btn.matched {
      background: linear-gradient(145deg, #ffd700, #ffa500);
      border-color: #ffd700;
      animation: glow 1s ease-in-out infinite;
    }

    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }

    @keyframes glow {
      0%, 100% { box-shadow: 0 0 5px #ffd700; }
      50% { box-shadow: 0 0 20px #ffd700; }
    }

    .minigame-tickets {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 15px;
      border: 2px solid var(--slot-border-color);
    }

    .minigame-tickets h3 {
      margin: 0 0 15px 0;
      color: #fff;
      font-size: 1rem;
      text-align: center;
    }

    .tickets-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .ticket {
      background: rgba(255,255,255,0.05);
      border: 2px solid var(--slot-border-color);
      border-radius: 8px;
      padding: 10px;
      min-height: 50px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .ticket.active {
      border-color: var(--primary-color);
      background: rgba(var(--primary-color-rgb), 0.1);
    }

    .ticket-label {
      font-size: 0.8rem;
      color: #888;
      min-width: 60px;
    }

    .ticket-numbers {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      flex: 1;
    }

    .ticket-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(145deg, var(--primary-color), #3a3a6a);
      color: #fff;
      font-size: 0.8rem;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ticket-number:hover {
      transform: scale(1.1);
      background: #c92a2a;
    }

    .ticket-number.matched {
      background: linear-gradient(145deg, #ffd700, #ffa500);
    }

    .ticket-result {
      font-size: 0.75rem;
      color: #aaa;
      margin-left: auto;
      text-align: right;
    }

    .ticket-result.win {
      color: var(--success-color);
      font-weight: bold;
    }

    .minigame-controls {
      margin-top: 20px;
      display: flex;
      justify-content: center;
      gap: 15px;
      flex-wrap: wrap;
    }

    .minigame-btn {
      padding: 12px 30px;
      border-radius: 8px;
      border: 2px solid var(--slot-border-color);
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
    }

    .minigame-btn-primary {
      background: linear-gradient(145deg, var(--primary-color), #3a3a6a);
      color: #fff;
    }

    .minigame-btn-primary:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 5px 20px rgba(var(--primary-color-rgb), 0.4);
    }

    .minigame-btn-secondary {
      background: linear-gradient(145deg, #444, #333);
      color: #fff;
    }

    .minigame-btn-secondary:hover:not(:disabled) {
      background: linear-gradient(145deg, #555, #444);
    }

    .minigame-btn-success {
      background: linear-gradient(145deg, var(--success-color), #1a8a3a);
      color: #fff;
    }

    .minigame-btn-success:hover:not(:disabled) {
      transform: scale(1.05);
      box-shadow: 0 5px 20px rgba(40, 167, 69, 0.4);
    }

    .minigame-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .minigame-drawn {
      margin-top: 20px;
      text-align: center;
    }

    .minigame-drawn h3 {
      color: #fff;
      margin: 0 0 15px 0;
    }

    .drawn-numbers {
      display: flex;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .drawn-number {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(145deg, #ff6b6b, #c92a2a);
      color: #fff;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: popIn 0.3s ease-out;
    }

    @keyframes popIn {
      0% { transform: scale(0); opacity: 0; }
      70% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }

    .minigame-result {
      margin-top: 20px;
      text-align: center;
      padding: 20px;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      border: 2px solid var(--slot-border-color);
    }

    .minigame-result h2 {
      color: var(--success-color);
      margin: 0 0 10px 0;
    }

    .minigame-result p {
      color: #fff;
      margin: 5px 0;
    }

    .minigame-result .total-win {
      font-size: 1.5rem;
      color: #ffd700;
      font-weight: bold;
    }

    .minigame-info {
      margin-top: 15px;
      padding: 10px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
      font-size: 0.8rem;
      color: #888;
      text-align: center;
    }

    /* Odds Table Section */
    .minigame-odds {
      margin-top: 20px;
      padding: 15px;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
    }

    .minigame-odds h3 {
      color: #ffd700;
      margin-bottom: 10px;
      font-size: 0.9rem;
      text-align: center;
    }

    .odds-table-container {
      max-height: 200px;
      overflow-y: auto;
    }

    .odds-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.75rem;
    }

    .odds-table th, .odds-table td {
      padding: 6px 8px;
      text-align: center;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .odds-table th {
      background: rgba(255,215,0,0.2);
      color: #ffd700;
      font-weight: bold;
    }

    .odds-table td {
      color: #ddd;
    }

    .odds-table tr:hover {
      background: rgba(255,255,255,0.05);
    }

    /* Number button states */
    .number-btn.used-other {
      background: linear-gradient(145deg, #3a3a6a, #2a2a4a);
      border-color: #666;
      color: #aaa;
    }

    .number-btn.used-other::after {
      content: '';
      position: absolute;
      top: 2px;
      right: 2px;
      width: 6px;
      height: 6px;
      background: #ffd700;
      border-radius: 50%;
    }

    /* Removable ticket numbers */
    .ticket-number.removable {
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .ticket-number.removable:hover {
      background: #ff4444;
      border-color: #ff6666;
      transform: scale(1.1);
    }

    .ticket-number.removable:hover::after {
      content: '×';
      position: absolute;
      top: -5px;
      right: -5px;
      width: 14px;
      height: 14px;
      background: #ff0000;
      color: white;
      font-size: 10px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Stake display in header */
    .minigame-stake {
      color: #4CAF50;
      font-weight: bold;
    }
  </style>

  <div class="slot-game">
    <!-- Top Controls -->
    <div class="slot-top-controls">
      <div></div>
      <div class="slot-top-controls-center">
        <div class="slot-controls-wrapper">
          <button class="btn-primary" id="startBtn">Pokreni Igru</button>
          <div class="progress-container" id="progressContainer">
            <span class="progress-label" id="progressLabel">5 sec</span>
            <progress value="0" max="5" id="progressBar"></progress>
          </div>
          <button class="btn-secondary" id="stopBtn">Zaustavi</button>
        </div>
      </div>
      <div class="spins-counter">Odigrano spinova: <span id="spinsCount">0</span></div>
    </div>

    <!-- Main Layout -->
    <div class="slot-layout">
      <!-- Left Sidebar: Bet & Lines -->
      <div class="slot-sidebar">
        <div class="nav-div">
          <button id="ulogBtn">Ulog</button>
          <div id="betOptions"></div>
          <div class="joker-container" id="jokerContainer">
            <input type="checkbox" id="jokerCheckbox" name="joker">
            <label for="jokerCheckbox">Kupi Dzokera</label>
            <p class="joker-hint">Dzoker kosta 5x ulog.</p>
          </div>
          <div class="lines-container" id="linesContainer"></div>
        </div>
      </div>

      <!-- Center: Reels -->
      <div class="slot-center">
        <div class="spinners" id="spinners"></div>

        <!-- Info Panel -->
        <div class="info-panel">
          <div>Ulog: <span id="currentBet">2</span> $</div>
          <div>Tip: <span id="gameType">Brojevi</span></div>
          <div>Dzoker: <span id="jokerStatus">NE (0 $)</span></div>
          <div>Linija: <span id="lineCount">1</span></div>
          <div>Ukupno: <span id="totalBet">2</span> $</div>
          <div>Krediti: <span id="credits">0</span> $</div>
        </div>

        <!-- Odds Tables -->
        <div class="odds-container" id="oddsContainer"></div>
      </div>

      <!-- Right Sidebar: Game Options -->
      <div class="slot-right-column">
        <div class="slot-options">
          <div class="nav-div">
            <button id="tipIgreBtn">Tip Igre</button>
            <div id="gameTypeOptions"></div>
            <button id="nacinNagradjivanjaBtn">Nacin nagradjivanja</button>
            <div id="rewardModeOptions"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;class g{constructor(e,t,r){this.winAmount=e,this.shadowRoot=t,this.onComplete=r,this.currentTicket=0,this.tickets=[[],[],[],[],[]],this.maxNumbersPerTicket=5,this.maxTickets=5,this.totalNumbers=30,this.drawnNumbers=[],this.drawCount=12,this.isPlaying=!1,this.gameFinished=!1,this.oddsTable=[{played:1,matches:1,odds:2.5,prob:40},{played:2,matches:1,odds:.62,prob:49.66},{played:2,matches:2,odds:6.59,prob:15.17},{played:3,matches:1,odds:.27,prob:45.22},{played:3,matches:2,odds:2.89,prob:29.26},{played:3,matches:3,odds:18.45,prob:5.42},{played:4,matches:1,odds:.15,prob:35.73},{played:4,matches:2,odds:1.64,prob:36.85},{played:4,matches:3,odds:10.64,prob:14.45},{played:4,matches:4,odds:55.36,prob:1.81},{played:5,matches:1,odds:.1,prob:25.77},{played:5,matches:2,odds:1.05,prob:37.79},{played:5,matches:3,odds:7.33,prob:23.62},{played:5,matches:4,odds:35.43,prob:6.25},{played:5,matches:5,odds:179.94,prob:.56}],this.betMultipliers={1:20,2:40,3:60,4:80,5:100},this.render()}render(){const e=document.createElement("div");e.className="minigame-overlay",e.id="minigameOverlay",e.innerHTML=`
      <div class="minigame-container">
        <div class="minigame-header">
          <h2>BINGO BONUS IGRA</h2>
          <p>Osvojili ste: <span class="minigame-prize">${this.winAmount} $</span></p>
          <p>Ulog iz slot igre: <span class="minigame-stake">${this.winAmount} $</span></p>
          <p>Izaberite brojeve za tikete. Isti brojevi se mogu koristiti na vise tiketa!</p>
        </div>

        <div class="minigame-layout">
          <div class="minigame-numbers">
            <h3>Izaberite brojeve (1-30)</h3>
            <div class="number-grid" id="numberGrid">
              ${this.renderNumberGrid()}
            </div>
          </div>

          <div class="minigame-tickets">
            <h3>Vasi tiketi (kliknite broj da ga obrisete)</h3>
            <div class="tickets-container" id="ticketsContainer">
              ${this.renderTickets()}
            </div>
          </div>
        </div>

        <div class="minigame-odds">
          <h3>Tabela kvota</h3>
          <div class="odds-table-container">
            ${this.renderOddsTable()}
          </div>
        </div>

        <div class="minigame-drawn" id="drawnSection" style="display: none;">
          <h3>Izvuceni brojevi (12)</h3>
          <div class="drawn-numbers" id="drawnNumbers"></div>
        </div>

        <div class="minigame-result" id="resultSection" style="display: none;">
          <h2>Rezultat</h2>
          <p id="resultText"></p>
          <p class="total-win" id="totalWin"></p>
        </div>

        <div class="minigame-controls">
          <button class="minigame-btn minigame-btn-secondary" id="nextTicketBtn">Sledeci tiket</button>
          <button class="minigame-btn minigame-btn-primary" id="playBtn" disabled>Zapocni izvlacenje</button>
          <button class="minigame-btn minigame-btn-success" id="collectBtn" style="display: none;">Preuzmi dobitak</button>
          <button class="minigame-btn minigame-btn-secondary" id="skipBtn">Preskoci</button>
        </div>

        <div class="minigame-info">
          Kliknite na broj (1-30) da ga dodate u aktivan tiket. Kliknite na broj u tiketu da ga obrisete.
          <br>Isti broj mozete koristiti na vise tiketa! Izvlaci se 12 od 30 brojeva.
        </div>
      </div>
    `,this.shadowRoot.appendChild(e),this.overlay=e,this.bindEvents(),this.updateUI()}renderOddsTable(){let e='<table class="odds-table"><thead><tr><th>Brojeva</th><th>Pogodaka</th><th>Kvota</th><th>Verovatnoca</th></tr></thead><tbody>';for(const t of this.oddsTable)e+=`<tr><td>${t.played}</td><td>${t.matches}</td><td>${t.odds}x</td><td>${t.prob}%</td></tr>`;return e+="</tbody></table>",e}renderNumberGrid(){let e="";for(let t=1;t<=this.totalNumbers;t++)e+=`<button class="number-btn" data-number="${t}">${t}</button>`;return e}renderTickets(){let e="";for(let t=0;t<this.maxTickets;t++){const r=t===this.currentTicket;e+=`
        <div class="ticket ${r?"active":""}" data-ticket="${t}">
          <span class="ticket-label">Tiket ${t+1}:</span>
          <div class="ticket-numbers" id="ticketNumbers${t}"></div>
          <span class="ticket-result" id="ticketResult${t}"></span>
        </div>
      `}return e}bindEvents(){this.overlay.querySelectorAll(".number-btn").forEach(e=>{e.addEventListener("click",()=>{if(this.isPlaying||this.gameFinished)return;const t=parseInt(e.dataset.number);this.selectNumber(t,e)})}),this.overlay.querySelectorAll(".ticket").forEach(e=>{e.addEventListener("click",()=>{if(this.isPlaying||this.gameFinished)return;const t=parseInt(e.dataset.ticket);this.switchTicket(t)})}),this.overlay.querySelector("#nextTicketBtn").addEventListener("click",()=>{this.isPlaying||this.gameFinished||this.nextTicket()}),this.overlay.querySelector("#playBtn").addEventListener("click",()=>{!this.isPlaying&&!this.gameFinished&&this.play()}),this.overlay.querySelector("#collectBtn").addEventListener("click",()=>{this.collect()}),this.overlay.querySelector("#skipBtn").addEventListener("click",()=>{this.skip()})}selectNumber(e,t){const r=this.tickets[this.currentTicket],i=r.indexOf(e);i!==-1?r.splice(i,1):r.length<this.maxNumbersPerTicket&&(r.push(e),r.sort((s,o)=>s-o)),this.updateUI()}removeNumberFromTicket(e,t){if(this.isPlaying||this.gameFinished)return;const r=this.tickets[e],i=r.indexOf(t);i!==-1&&(r.splice(i,1),this.updateUI())}switchTicket(e){this.currentTicket=e,this.updateUI()}nextTicket(){for(let e=0;e<this.maxTickets;e++){const t=(this.currentTicket+1+e)%this.maxTickets;if(this.tickets[t].length<this.maxNumbersPerTicket){this.currentTicket=t;break}}this.updateUI()}updateUI(){this.overlay.querySelectorAll(".ticket").forEach((i,s)=>{i.classList.toggle("active",s===this.currentTicket);const o=this.tickets[s].length,a=o>0?this.betMultipliers[o]*this.winAmount:0,n=i.querySelector(".ticket-bet");n&&(n.textContent=o>0?`Ulog: ${a}$`:"")});for(let i=0;i<this.maxTickets;i++){const s=this.overlay.querySelector(`#ticketNumbers${i}`),o=this.tickets[i].length>0?this.betMultipliers[this.tickets[i].length]*this.winAmount:0;s.innerHTML=this.tickets[i].map(n=>`<span class="ticket-number removable" data-ticket="${i}" data-num="${n}" title="Kliknite za brisanje">${n}</span>`).join("");const a=this.overlay.querySelector(`#ticketResult${i}`);a&&!this.gameFinished&&(a.textContent=o>0?`Ulog: ${o}$`:""),s.querySelectorAll(".ticket-number").forEach(n=>{n.addEventListener("click",l=>{if(this.isPlaying||this.gameFinished)return;l.stopPropagation();const d=parseInt(n.dataset.ticket),c=parseInt(n.dataset.num);this.removeNumberFromTicket(d,c)})})}const e=this.tickets[this.currentTicket];this.overlay.querySelectorAll(".number-btn").forEach(i=>{const s=parseInt(i.dataset.number),o=e.includes(s),a=this.tickets.some((n,l)=>l!==this.currentTicket&&n.includes(s));i.classList.toggle("selected",o),i.classList.toggle("used-other",a&&!o)});const t=this.tickets.some(i=>i.length>0);this.overlay.querySelector("#playBtn").disabled=!t||this.isPlaying;const r=this.tickets[this.currentTicket].length>=this.maxNumbersPerTicket;this.overlay.querySelector("#nextTicketBtn").disabled=r&&this.tickets.every(i=>i.length>=this.maxNumbersPerTicket)||this.isPlaying}async play(){this.isPlaying=!0,this.overlay.querySelector("#playBtn").disabled=!0,this.overlay.querySelector("#playBtn").textContent="Izvlacenje...",this.overlay.querySelector("#nextTicketBtn").disabled=!0,this.overlay.querySelector("#skipBtn").style.display="none",this.overlay.querySelectorAll(".number-btn").forEach(e=>e.classList.add("disabled")),this.overlay.querySelector("#drawnSection").style.display="block";try{const t=await(await fetch("/api/games/slot-machine",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"slot_minigame",tickets:this.tickets,stake:this.winAmount})})).json();if(t.success&&t.data)this.drawnNumbers=t.data.drawn_numbers,this.serverResults=t.data,this.animateDraw(0);else throw new Error(t.message||"Mini-game request failed")}catch(e){console.error("[BingoMiniGame] API Error:",e),alert("Greska pri pokretanju mini igre: "+e.message),this.isPlaying=!1,this.overlay.querySelector("#playBtn").disabled=!1,this.overlay.querySelector("#playBtn").textContent="Zapocni izvlacenje",this.overlay.querySelector("#nextTicketBtn").disabled=!1,this.overlay.querySelector("#skipBtn").style.display="inline-block",this.overlay.querySelectorAll(".number-btn").forEach(t=>t.classList.remove("disabled")),this.overlay.querySelector("#drawnSection").style.display="none"}}animateDraw(e){if(e>=this.drawnNumbers.length){this.showResults();return}const t=this.drawnNumbers[e],r=this.overlay.querySelector("#drawnNumbers"),i=document.createElement("span");i.className="drawn-number",i.textContent=t,r.appendChild(i);const s=this.overlay.querySelector(`.number-btn[data-number="${t}"]`);s&&(s.classList.add("drawn"),s.classList.contains("selected")&&s.classList.add("matched")),this.tickets.forEach((o,a)=>{o.includes(t)&&this.overlay.querySelectorAll(`#ticketNumbers${a} .ticket-number`).forEach(l=>{parseInt(l.dataset.num)===t&&l.classList.add("matched")})}),setTimeout(()=>this.animateDraw(e+1),500)}showResults(){this.gameFinished=!0;let e=0;if(this.serverResults&&this.serverResults.ticket_results)this.serverResults.ticket_results.forEach((i,s)=>{if(i.numbers_played===0)return;const o=i.payout||0;e+=o;const a=this.overlay.querySelector(`#ticketResult${s}`);a.textContent=`${i.matches}/${i.numbers_played} = ${o.toFixed(2)}$`,o>0&&a.classList.add("win")}),e=this.serverResults.total_payout||e;else for(let i=0;i<this.maxTickets;i++){const s=this.tickets[i];if(s.length===0)continue;const o=s.length,a=s.filter(h=>this.drawnNumbers.includes(h)).length,n=this.payoutTable[o]?.[a]||0,l=this.betMultipliers[o],d=n*l;e+=d;const c=this.overlay.querySelector(`#ticketResult${i}`);c.textContent=`${a}/${o} = ${d.toFixed(2)}$`,d>0&&c.classList.add("win")}const t=this.winAmount+e,r=this.overlay.querySelector("#resultSection");if(r.style.display="block",this.overlay.querySelector("#resultText").innerHTML=`
      Originalni dobitak: ${this.winAmount}$<br>
      Bonus iz mini igre: ${e.toFixed(2)}$
    `,this.overlay.querySelector("#totalWin").textContent=`Ukupno: ${t.toFixed(2)}$`,this.serverResults&&this.serverResults.new_balance!==void 0){const i=document.querySelector("#kreditOkvir")||document.querySelector(".balance-display");i&&(i.textContent=this.serverResults.new_balance)}this.overlay.querySelector("#playBtn").style.display="none",this.overlay.querySelector("#collectBtn").style.display="inline-block",this.totalWin=t}collect(){this.overlay.remove(),this.onComplete&&this.onComplete(this.totalWin||this.winAmount)}skip(){this.overlay.remove(),this.onComplete&&this.onComplete(this.winAmount)}}class u extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.shadowRoot.appendChild(p.content.cloneNode(!0)),this.credits=0,this.bet=2,this.kvote=[100,50,30,5,50,30,20,4,30,20,10,3],this.spinsCount=0,this.stopArray=[],this.linez=[1,0,0,0,0,0,0],this.jokerAdded=!1,this.jokerPosition=0,this.jokerCost=0,this.rewardMode=2,this.gameTypeValue=1,this.progressInterval=null,this.isSpinning=!1,this.jwtToken="",this.carousels=[],this.scenes=[],this.spinDirections=[-1,-1,-1,-1,-1],this.currentRotations=[0,0,0,0,0],this.canvas=null,this.ctx=null,this.canvasWidth=0,this.halfStep=0,this.middle=0,this.down=0}connectedCallback(){this.credits=parseInt(this.getAttribute("data-balance"))||0,this.jwtToken=this.getAttribute("data-jwt-token")||"",this.kockice=new Array(15).fill(0),this.pomocniNiz=[],this.kkk1=0,this.kkk2=0,this.img=new Image,this.halfStepW=0,this.spinnerPaddingLeft=0,this.spinnerPaddingTop=0,this.lineColor="rgba(60, 0, 129, 0.4)",this.boundCanvasClick=this.handleCanvasClick.bind(this),this.initializeUI(),this.bindEvents(),this.updateDisplay()}initializeUI(){this.updateBetOptions();const e=this.shadowRoot.getElementById("linesContainer");for(let o=0;o<7;o++){const a=document.createElement("div");a.className=o===0?"active":"",a.dataset.line=o,a.innerHTML=`<label>Linija ${o+1}</label>`,a.addEventListener("click",()=>this.toggleLine(o,a)),e.appendChild(a)}const t=this.shadowRoot.getElementById("gameTypeOptions");["Brojevi","Rimski","Vockice","Zivotinje","Smajlici"].forEach((o,a)=>{const n=document.createElement("div");n.className="control-group"+(a===0?" active":""),n.dataset.value=a+1,n.innerHTML=`<label>${o}</label>`,n.addEventListener("click",()=>this.selectGameType(a+1,o,n)),t.appendChild(n)});const r=this.shadowRoot.getElementById("rewardModeOptions");[{value:2,label:"1x5 Srednja"},{value:1,label:"3x5 Vise linija"}].forEach((o,a)=>{const n=document.createElement("div");n.className="control-group"+(a===0?" active":""),n.dataset.value=o.value,n.innerHTML=`<label>${o.label}</label>`,n.addEventListener("click",()=>this.selectRewardMode(o.value,n)),r.appendChild(n)});const i=this.shadowRoot.getElementById("spinners"),s=[1,2,3,4,5,6,1,2,3,4,5,6];for(let o=0;o<5;o++){const a=document.createElement("div");a.className="scene",a.style.perspective="1000px";const n=document.createElement("div");n.className="carousel",s.forEach((l,d)=>{const c=document.createElement("div");c.className="carousel__cell",c.style.transform=`rotateX(${d*30}deg) translateZ(220px)`,c.innerHTML=`<p>${l}</p>`,n.appendChild(c)}),a.appendChild(n),i.appendChild(a),this.scenes.push(a),this.carousels.push(n)}this.canvas=document.createElement("canvas"),this.canvas.className="canvas-overlay single-line-mode",i.appendChild(this.canvas),setTimeout(()=>{this.initCanvas(),this.createOddsTables(),this.rewardMode===2&&this.setCanvasMiddleRow()},100)}initCanvas(){this.ctx=this.canvas.getContext("2d");const e=this.shadowRoot.getElementById("spinners"),t=getComputedStyle(e);this.spinnerPaddingLeft=parseFloat(t.paddingLeft)||0,this.spinnerPaddingTop=parseFloat(t.paddingTop)||0,this.canvasWidth=e.offsetWidth,this.canvas.width=this.canvasWidth,this.canvas.height=e.offsetHeight;const r=e.clientWidth-this.spinnerPaddingLeft*2,i=e.clientHeight-this.spinnerPaddingTop*2;this.halfStep=i/3/2,this.halfStepW=r/5/2,this.middle=this.spinnerPaddingTop+3*this.halfStep,this.down=this.spinnerPaddingTop+5*this.halfStep,this.ctx.lineWidth=10,this.ctx.font="20px Arial",this.ctx.strokeStyle=this.lineColor,console.log("[SLOT_MACHINE] initCanvas:",{offsetWidth:e.offsetWidth,offsetHeight:e.offsetHeight,clientWidth:e.clientWidth,clientHeight:e.clientHeight,paddingLeft:this.spinnerPaddingLeft,paddingTop:this.spinnerPaddingTop,contentWidth:r,contentHeight:i,halfStep:this.halfStep,halfStepW:this.halfStepW,middle:this.middle,down:this.down}),this.lineCheck()}createOddsTables(){const e=[1,2,3,4,5,6,1,2,3,4,5,6],t=[100,50,30,5,50,30,20,4,30,20,10,3];this.updateOddsTables(e,t)}bindEvents(){this.shadowRoot.getElementById("startBtn").addEventListener("click",()=>this.startSpin()),this.shadowRoot.getElementById("stopBtn").addEventListener("click",()=>this.stopSpin()),this.shadowRoot.getElementById("jokerCheckbox").addEventListener("change",e=>this.toggleJoker(e.target.checked)),this.shadowRoot.getElementById("tipIgreBtn").addEventListener("click",()=>this.cycleGameType()),this.shadowRoot.getElementById("nacinNagradjivanjaBtn").addEventListener("click",()=>this.cycleRewardMode()),this.shadowRoot.getElementById("ulogBtn").addEventListener("click",()=>this.cycleBet())}cycleGameType(){const t=this.shadowRoot.getElementById("gameTypeOptions").querySelectorAll(".control-group"),i=(Array.from(t).findIndex(n=>n.classList.contains("active"))+1)%t.length,s=t[i],o=parseInt(s.dataset.value),a=s.querySelector("label").textContent;this.selectGameType(o,a,s)}cycleRewardMode(){const t=this.shadowRoot.getElementById("rewardModeOptions").querySelectorAll(".control-group"),i=(Array.from(t).findIndex(a=>a.classList.contains("active"))+1)%t.length,s=t[i],o=parseInt(s.dataset.value);this.selectRewardMode(o,s)}cycleBet(){const t=this.shadowRoot.getElementById("betOptions").querySelectorAll(".control-group"),i=(Array.from(t).findIndex(a=>a.classList.contains("active"))+1)%t.length,s=t[i],o=parseInt(s.dataset.value);this.selectBet(o,s)}updateBetOptions(){const e={1:[2,3,4,5,6],2:[1,2,3,4,5],3:[5,6,7,8,9],4:[4,5,6,7,8],5:[3,4,5,6,7]},t=e[this.gameTypeValue]||e[1],r=this.shadowRoot.getElementById("betOptions");r.innerHTML="",t.forEach((i,s)=>{const o=document.createElement("div");o.className="control-group"+(s===0?" active":""),o.dataset.value=i,o.innerHTML=`<label>${i} $</label>`,o.addEventListener("click",()=>this.selectBet(i,o)),r.appendChild(o)}),this.bet=t[0],this.updateDisplay()}selectBet(e,t){this.bet=e,t.parentElement.querySelectorAll(".control-group").forEach(r=>r.classList.remove("active")),t.classList.add("active"),this.updateDisplay()}selectGameType(e,t,r){this.gameTypeValue=e,r.parentElement.querySelectorAll(".control-group").forEach(i=>i.classList.remove("active")),r.classList.add("active"),this.shadowRoot.getElementById("gameType").textContent=t,this.updateSymbols()}selectRewardMode(e,t){this.rewardMode=e,t.parentElement.querySelectorAll(".control-group").forEach(s=>s.classList.remove("active")),t.classList.add("active");const r=this.shadowRoot.getElementById("spinners"),i=this.shadowRoot.querySelector(".info-panel");e===1?(this.scenes.forEach(s=>s.style.perspective="initial"),this.shadowRoot.getElementById("linesContainer").style.display="flex",this.shadowRoot.getElementById("jokerContainer").style.display="block",r.style.overflow="hidden",r.style.transform="translateY(0)",i.style.marginTop="0.5rem",this.setCanvasFullHeight()):(this.scenes.forEach(s=>s.style.perspective="1000px"),this.shadowRoot.getElementById("linesContainer").style.display="none",this.shadowRoot.getElementById("jokerContainer").style.display="none",r.style.overflow="visible",r.style.transform="translateY(20px)",i.style.marginTop="3rem",this.setCanvasMiddleRow()),this.drawLines(),this.updateDisplay()}setCanvasFullHeight(){this.canvas&&(this.canvas.classList.remove("single-line-mode"),this.canvas.style.top="0",this.canvas.style.height="100%")}setCanvasMiddleRow(){if(!this.canvas||!this.halfStep)return;this.canvas.classList.add("single-line-mode");const e=this.spinnerPaddingTop+this.halfStep*2,t=this.halfStep*2;this.canvas.style.top=`${e}px`,this.canvas.style.height=`${t}px`}toggleLine(e,t){const r=this.shadowRoot.getElementById("linesContainer");if(t.classList.contains("active")&&this.linez.filter(n=>n===1).length<=1)return;const s=t.classList.toggle("active");this.linez[e]=s?1:0,this.linez.filter(a=>a===1).length===1?r.querySelectorAll("div.active").forEach(a=>{a.classList.add("last-active")}):r.querySelectorAll("div.last-active").forEach(a=>{a.classList.remove("last-active")}),this.clearCanvas(),s&&this.nacrtajLiniju(e),this.lineCheck(),this.jokerAdded&&this.jokerPosition>0&&(this.getLinjesForPosition(this.jokerPosition-1).filter(l=>this.linez[l-1]===1).length===0?this.removeJoker():this.drawJokerAtPosition(this.kkk1,this.kkk2)),this.updateDisplay()}toggleJoker(e){if(e)this.brojacKockica(),this.brojacLinija(),this.crtacKockica(),this.shadowRoot.getElementById("linesContainer").style.display="none";else{this.jokerPosition=0,this.jokerCost=0,this.jokerAdded=!1,this.removeCanvasClickListener(),this.clearCanvas(),this.lineCheck(),this.shadowRoot.getElementById("linesContainer").style.display="flex",this.shadowRoot.getElementById("jokerStatus").textContent="NE (0 $)";const t=this.shadowRoot.getElementById("snimiDzokera"),r=this.shadowRoot.getElementById("izbrisiDzokera");t&&t.remove(),r&&r.remove()}this.updateDisplay()}brojacKockica(){this.kockice=new Array(15).fill(0);const e=[[5,6,7,8,9],[0,1,2,3,4],[10,11,12,13,14],[3,5,7,9,11],[1,5,7,9,13],[0,4,6,8,12],[2,6,8,10,14]];for(let t=0;t<7;t++)if(this.linez[t]===1)for(let r=0;r<5;r++)this.kockice[e[t][r]]=1}brojacLinija(){let e=0;return this.linez.forEach(t=>{t===1&&e++}),this.shadowRoot.getElementById("lineCount").textContent=e,e}crtacKockica(){(!this.ctx||!this.halfStep||!this.halfStepW)&&this.initCanvas(),this.clearCanvas(),this.ctx.strokeStyle="#3c0081",this.ctx.shadowColor="black",this.ctx.shadowBlur=18,this.ctx.shadowOffsetX=0,this.ctx.shadowOffsetY=0;const e=this.spinnerPaddingLeft||0,t=this.spinnerPaddingTop||0;console.log("[SLOT_MACHINE] crtacKockica:",{padX:e,padY:t,halfStepW:this.halfStepW,halfStep:this.halfStep,kockice:this.kockice});for(let r=0;r<15;r++)if(this.kockice[r]===1){let i,s;r<5?(i=e+this.halfStepW*2*r,s=t):r<10?(i=e+this.halfStepW*2*(r-5),s=t+this.halfStep*2):(i=e+this.halfStepW*2*(r-10),s=t+this.halfStep*4),console.log("[SLOT_MACHINE] Drawing box at:",{i:r,x:i,y:s,width:this.halfStepW*2,height:this.halfStep*2}),this.ctx.beginPath(),this.ctx.rect(i,s,this.halfStepW*2,this.halfStep*2),this.ctx.stroke()}this.ctx.shadowBlur=0,this.addCanvasClickListener(),this.ctx.strokeStyle=this.lineColor}addCanvasClickListener(){this.canvas.classList.add("joker-active"),this.canvas.addEventListener("click",this.boundCanvasClick)}removeCanvasClickListener(){this.canvas.classList.remove("joker-active"),this.canvas.removeEventListener("click",this.boundCanvasClick)}handleCanvasClick(e){const t=this.canvas.getBoundingClientRect(),r=8,i=e.clientX-t.left-r,s=e.clientY-t.top-r,o=i-this.spinnerPaddingLeft,a=s-this.spinnerPaddingTop,n=Math.floor(a/(2*this.halfStep)),l=Math.floor(o/(this.halfStepW*2));if(console.log("[SLOT_MACHINE] Canvas click:",{rawMouseX:i,rawMouseY:s,contentMouseX:o,contentMouseY:a,row:n,col:l,halfStep:this.halfStep,halfStepW:this.halfStepW}),n<0||n>2||l<0||l>4)return;const d=n*5+l;if(console.log("[SLOT_MACHINE] Grid position:",d,"Valid:",this.kockice[d]),this.kockice[d]===1){const c=d+1;if(this.jokerPosition!==c){const h=this.shadowRoot.getElementById("snimiDzokera");h&&h.remove(),this.jokerPosition=c,this.pomocniNiz=[];const m=this.spinnerPaddingLeft+this.halfStepW*2*l,b=this.spinnerPaddingTop+n*this.halfStep*2;this.kkk1=m,this.kkk2=b,this.redrawWithJoker(m,b),this.pomocniNiz=this.getLinjesForPosition(d)}}}redrawWithJoker(e,t){this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);const r=this.spinnerPaddingLeft||0,i=this.spinnerPaddingTop||0;this.ctx.strokeStyle="#3c0081",this.ctx.shadowColor="black",this.ctx.shadowBlur=18;for(let s=0;s<15;s++)if(this.kockice[s]===1){let o,a;s<5?(o=r+this.halfStepW*2*s,a=i):s<10?(o=r+this.halfStepW*2*(s-5),a=i+this.halfStep*2):(o=r+this.halfStepW*2*(s-10),a=i+this.halfStep*4),this.ctx.beginPath(),this.ctx.rect(o,a,this.halfStepW*2,this.halfStep*2),this.ctx.stroke()}this.ctx.shadowBlur=0,this.ctx.strokeStyle=this.lineColor,this.drawJokerAtPosition(e,t)}getLinjesForPosition(e){return[[2,6],[2,5],[2,7],[2,4],[2,6],[1,4,5],[1,6,7],[1,4,5],[1,6,7],[1,4,5],[3,7],[3,4],[3,5],[3,6],[3,7]][e]||[]}drawJokerAtPosition(e,t){this.img.src="data:image/png;base64,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",this.img.onload=()=>{const r=this.img.width,i=this.img.height,s=Math.min(2*this.halfStepW/r,2*this.halfStep/i);let o,a;if(this.halfStepW>this.halfStep?(o=e+(2*this.halfStepW-r*s)/2,a=t):(o=e,a=t+(2*this.halfStep-i*s)/2),this.ctx.drawImage(this.img,o,a,r*s,i*s),!this.shadowRoot.getElementById("snimiDzokera")&&!this.shadowRoot.getElementById("izbrisiDzokera")){const n=this.shadowRoot.getElementById("jokerCheckbox");if(n&&n.checked){const l=document.createElement("button");l.textContent="Snimi Dzokera",l.id="snimiDzokera",l.style.marginTop="8px",l.style.width="100%",l.addEventListener("click",()=>this.confirmJoker()),this.shadowRoot.getElementById("jokerContainer").appendChild(l)}}}}confirmJoker(){this.jokerAdded=!0,this.jokerCost=this.bet*5,this.shadowRoot.getElementById("jokerStatus").textContent=`DA (${this.jokerCost} $)`;const e=this.shadowRoot.getElementById("snimiDzokera");e&&e.remove(),this.removeCanvasClickListener(),this.clearCanvas(),this.lineCheck(),this.drawJokerAtPosition(this.kkk1,this.kkk2);const t=document.createElement("button");t.textContent="Izbrisi Dzokera",t.id="izbrisiDzokera",t.style.marginTop="8px",t.style.width="100%",t.addEventListener("click",()=>this.removeJoker()),this.shadowRoot.getElementById("jokerContainer").appendChild(t),this.shadowRoot.getElementById("jokerCheckbox").disabled=!0,this.shadowRoot.getElementById("linesContainer").style.display="flex",this.updateDisplay()}removeJoker(){this.jokerPosition=0,this.jokerCost=0,this.jokerAdded=!1,this.shadowRoot.getElementById("jokerStatus").textContent="NE (0 $)",this.clearCanvas(),this.lineCheck();const e=this.shadowRoot.getElementById("izbrisiDzokera");e&&e.remove();const t=this.shadowRoot.getElementById("jokerCheckbox");t.disabled=!1,t.checked=!1,this.updateDisplay()}updateSymbols(){const e={1:[1,2,3,4,5,6,1,2,3,4,5,6],2:["I","II","III","IV","V","VI","I","II","III","IV","V","VI"],3:["🍏","🍐","🍊","🍋","🍌","🍉","🍏","🍐","🍊","🍋","🍌","🍉"],4:["🐶","🐱","🐭","🐹","🐰","🦊","🐶","🐱","🐭","🐹","🐰","🦊"],5:["😀","😁","😂","🤣","😅","😎","😀","😁","😂","🤣","😅","😎"]},t={1:[100,50,30,5,50,30,20,4,30,20,10,3],2:[90,40,28,4,40,28,18,3,28,18,8,2],3:[200,100,60,8,100,60,40,7,60,40,20,6],4:[150,70,40,7,70,40,30,6,40,30,15,5],5:[120,60,35,6,60,35,25,5,35,25,12,4]},r=e[this.gameTypeValue]||e[1],i=t[this.gameTypeValue]||t[1];this.carousels.forEach((s,o)=>{s.querySelectorAll(".carousel__cell p").forEach((a,n)=>{a.textContent=r[n]}),this.currentRotations[o]=0,s.style.cssText="transform: translateZ(-220px) rotateX(0deg); transition: 0.1s;"}),this.updateOddsTables(r,i),this.updateBetOptions()}updateOddsTables(e,t){const r=this.shadowRoot.getElementById("oddsContainer");if(!r)return;r.innerHTML="",[{symbols:[e[4],e[5]],odds:[t[0],t[1],t[2],t[3]]},{symbols:[e[2],e[3]],odds:[t[4],t[5],t[6],t[7]]},{symbols:[e[0],e[1]],odds:[t[8],t[9],t[10],t[11]]}].forEach(s=>{const o=`${s.symbols[0]} || ${s.symbols[1]}`,a=document.createElement("table");a.className="odds-table",a.innerHTML=`
        <caption>Kvota za ${o}</caption>
        <tbody>
          ${s.odds.map((n,l)=>{const d=5-l,c=l;return`
            <tr>
              <td class="line-label">${`${d} in line`}</td>
              ${Array(d).fill(`<td>${o}</td>`).join("")}
              ${Array(c).fill('<td class="empty-cell"></td>').join("")}
              <td class="odds-value">${n}</td>
            </tr>
          `}).join("")}
        </tbody>
      `,r.appendChild(a)})}updateDisplay(){this.shadowRoot.getElementById("credits").textContent=this.credits,this.shadowRoot.getElementById("currentBet").textContent=this.bet;const e=this.rewardMode===2?1:this.linez.filter(r=>r===1).length;this.shadowRoot.getElementById("lineCount").textContent=e;const t=this.rewardMode===2?this.bet:e*this.bet+this.jokerCost;this.shadowRoot.getElementById("totalBet").textContent=t,this.shadowRoot.getElementById("spinsCount").textContent=this.spinsCount}clearCanvas(){this.ctx&&(this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height),this.img=new Image)}lineCheck(){if(this.ctx&&this.rewardMode===1)for(let e=0;e<7;e++)this.linez[e]===1&&this.nacrtajLiniju(e)}nacrtajLiniju(e){if(!this.ctx)return;const t=this.spinnerPaddingLeft||0,i=(this.spinnerPaddingTop||0)+this.halfStep,s=[[[[t,this.middle],[this.canvasWidth-t,this.middle]],[[t+2*this.halfStepW,this.middle],[t+4*this.halfStepW-1,this.middle],[t+6*this.halfStepW-1,this.middle],[t+8*this.halfStepW-1,this.middle]]],[[[t,i],[this.canvasWidth-t,i]],[[t+2*this.halfStepW,i],[t+4*this.halfStepW-1,i],[t+6*this.halfStepW-1,i],[t+8*this.halfStepW-1,i]]],[[[t,this.down],[this.canvasWidth-t,this.down]],[[t+2*this.halfStepW,this.down],[t+4*this.halfStepW-1,this.down],[t+6*this.halfStepW-1,this.down],[t+8*this.halfStepW-1,this.down]]],[[[t,this.middle],[t+this.halfStepW,this.middle],[t+3*this.halfStepW,this.down],[t+7*this.halfStepW,i],[t+9*this.halfStepW,this.middle],[this.canvasWidth-t,this.middle]],[[t+2*this.halfStepW,this.middle+this.halfStep],[t+4*this.halfStepW,this.middle+this.halfStep],[t+6*this.halfStepW,this.middle-this.halfStep],[t+8*this.halfStepW,this.middle-this.halfStep]]],[[[t,this.middle],[t+this.halfStepW,this.middle],[t+3*this.halfStepW,i],[t+7*this.halfStepW,this.down],[t+9*this.halfStepW,this.middle],[this.canvasWidth-t,this.middle]],[[t+2*this.halfStepW,this.middle-this.halfStep],[t+4*this.halfStepW,this.middle-this.halfStep],[t+6*this.halfStepW,this.middle+this.halfStep],[t+8*this.halfStepW,this.middle+this.halfStep]]],[[[t,i],[t+this.halfStepW,i],[t+5*this.halfStepW,this.down],[t+9*this.halfStepW,i],[this.canvasWidth-t,i]],[[t+this.halfStepW,i],[t+3*this.halfStepW,this.middle],[t+5*this.halfStepW,this.down],[t+7*this.halfStepW,this.middle],[t+9*this.halfStepW,i]]],[[[t,this.down],[t+this.halfStepW,this.down],[t+5*this.halfStepW,i],[t+9*this.halfStepW,this.down],[this.canvasWidth-t,this.down]],[[t+this.halfStepW,this.down],[t+3*this.halfStepW,this.middle],[t+5*this.halfStepW,i],[t+7*this.halfStepW,this.middle],[t+9*this.halfStepW,this.down]]]];this.ctx.strokeStyle=this.lineColor,this.ctx.lineWidth=10,this.ctx.beginPath();for(let o=0;o<s[e][0].length;o++)o===0?this.ctx.moveTo(s[e][0][o][0],s[e][0][o][1]):this.ctx.lineTo(s[e][0][o][0],s[e][0][o][1]);this.ctx.stroke();for(let o=0;o<s[e][1].length;o++)this.ctx.lineWidth=1,this.ctx.beginPath(),this.ctx.arc(s[e][1][o][0],s[e][1][o][1],10,0,2*Math.PI),this.ctx.fillStyle="white",this.ctx.fill(),this.ctx.stroke(),this.ctx.fillStyle="black",this.ctx.fillText(e+1,s[e][1][o][0]-6,s[e][1][o][1]+7);this.ctx.lineWidth=10}drawLines(){this.clearCanvas(),this.lineCheck(),this.jokerAdded&&this.jokerPosition>0&&this.drawJokerAtPosition(this.kkk1,this.kkk2)}getTotalBet(){return this.rewardMode===2?this.bet:this.linez.filter(e=>e===1).length*this.bet+this.jokerCost}setButtonsEnabled(e){["startBtn","ulogBtn","tipIgreBtn","nacinNagradjivanjaBtn"].forEach(s=>{const o=this.shadowRoot.getElementById(s);o&&(o.disabled=!e,e?o.classList.remove("disabled"):o.classList.add("disabled"))});const r=this.shadowRoot.querySelector(".slot-options");r&&r.querySelectorAll(".control-group").forEach(s=>{e?s.classList.remove("disabled"):s.classList.add("disabled")});const i=this.shadowRoot.querySelector(".slot-sidebar");if(i){const s=i.querySelector(".lines-container");s&&s.querySelectorAll("div").forEach(a=>{e?a.classList.remove("disabled"):a.classList.add("disabled")});const o=i.querySelector(".joker-container");o&&(e?o.classList.remove("disabled"):o.classList.add("disabled")),i.querySelectorAll(".control-group").forEach(a=>{e?a.classList.remove("disabled"):a.classList.add("disabled")})}}setStopButtonEnabled(e){const t=this.shadowRoot.getElementById("stopBtn");t&&(t.disabled=!e)}async startSpin(){if(this.isSpinning)return;const e=this.getTotalBet();if(this.credits<e){alert("Nemate dovoljno kredita!");return}this.isSpinning=!0,this.credits-=e,this.updateDisplay(),this.setButtonsEnabled(!1),this.setStopButtonEnabled(!0),this.rotateReels([360,360,360,360,360]);try{const t=await this.callSpinAPI();this.spinsCount++,this.stopArray=t,this.rotateReels(t,!0),this.startProgressTimer(t)}catch(t){console.error("Spin error:",t),this.credits+=e,this.isSpinning=!1,this.setButtonsEnabled(!0),this.setStopButtonEnabled(!0),this.updateDisplay()}}async callSpinAPI(){const e=this.rewardMode===2?[1,0,0,0,0,0,0]:this.linez,t={action:"slot_spin",ulog:parseInt(this.bet),igra:this.gameTypeValue,kvote:this.kvote,brojLinija:e,dzoker:this.rewardMode===2?0:this.jokerPosition,vrednostDzokera:this.rewardMode===2?0:this.jokerCost,nacin:this.rewardMode,brojKredita:this.credits+this.getTotalBet()},i=await(await fetch("/api/games/slot-machine",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${this.jwtToken}`},body:JSON.stringify(t)})).json();if(i.success&&i.data&&i.data.result)return i.data.result;throw new Error(i.message||"Spin failed")}rotateReels(e,t=!1){t||(this.spinDirections=this.carousels.map(()=>this.rewardMode===1&&Math.random()<.5?1:-1)),t?this.carousels.forEach((r,i)=>{const s=this.spinDirections[i],o=this.currentRotations[i],a=-(e[i]-1)*30,n=360*(8+Math.floor(Math.random()*4)+i);let l=a+s*n;for(;s===-1&&l>o;)l-=360;for(;s===1&&l<o;)l+=360;this.currentRotations[i]=l,r.style.transition=`transform ${4.5+i*.3}s cubic-bezier(0.12, 0.8, 0.32, 1) ${i*.15}s`,r.style.transform=`translateZ(-220px) rotateX(${l}deg)`}):this.carousels.forEach((r,i)=>{const s=this.spinDirections[i],o=this.currentRotations[i],a=360*(Math.floor(Math.random()*5)+8),n=o+s*a;this.currentRotations[i]=n,r.style.transition=`transform 1s linear ${i*.1}s`,r.style.transform=`translateZ(-220px) rotateX(${n}deg)`})}startProgressTimer(e){let t=5;const r=this.shadowRoot.getElementById("progressBar"),i=this.shadowRoot.getElementById("progressLabel");this.progressInterval=setInterval(()=>{t<=0?(clearInterval(this.progressInterval),this.finishSpin(e)):(i.textContent=`${t} sec`,r.value=5-t,t--)},1e3)}finishSpin(e){const t=this.shadowRoot.getElementById("progressLabel"),r=this.shadowRoot.getElementById("progressBar");t.textContent="5 sec",r.value=0,this.carousels.forEach(i=>{i.style.transition="none"}),e[8]!==void 0&&(this.credits=e[8]),e[7]&&e[7]>0&&this.showWin(e),this.isSpinning=!1,this.setButtonsEnabled(!0),this.setStopButtonEnabled(!0),this.updateDisplay()}showWin(e){const t=document.createElement("div");t.className="win-overlay";let r=2;try{r=JSON.parse(e[5]).nacin}catch(s){console.warn("Could not parse request JSON:",s)}let i="<h1>Cestitamo!</h1>";if(r===1&&Array.isArray(e[10]))for(let s=0;s<e[10].length;s++){const o=e[10][s];if(Array.isArray(o)&&o.length>=6){const a=o[5]+1;i+=`<p>Pogodak na liniji ${a}!</p>`}}else i+="<p>Svaka cast imate pogodak!</p>";i+=`<h2>Dobitak: ${e[7]} $</h2>`,e[9]===1&&(i+='<button id="miniGameBtn">Mini Game</button>'),i+='<button id="continueBtn">Nastavi</button>',t.innerHTML=i,this.shadowRoot.appendChild(t),t.querySelector("#continueBtn").addEventListener("click",()=>t.remove()),t.querySelector("#miniGameBtn")?.addEventListener("click",()=>{t.remove();const s=e[7];new g(s,this.shadowRoot,o=>{const a=o-s;a>0&&(this.credits+=a,this.updateDisplay())})})}stopSpin(){if(this.progressInterval){clearInterval(this.progressInterval),this.setStopButtonEnabled(!1);const e=this.shadowRoot.getElementById("progressLabel"),t=this.shadowRoot.getElementById("progressBar");e.textContent="5 sec",t.value=0,this.carousels.forEach((r,i)=>{const o=-(this.stopArray[i]-1)*30;this.currentRotations[i]=o,r.style.transition="transform 0.01s ease-out",r.style.transform=`translateZ(-220px) rotateX(${o}deg)`}),setTimeout(()=>{const r=this.stopArray;r[8]!==void 0&&(this.credits=r[8]),r[7]&&r[7]>0&&this.showWin(r),this.isSpinning=!1,this.setButtonsEnabled(!0),this.setStopButtonEnabled(!0),this.updateDisplay()},50)}}}customElements.get("slot-machine")||customElements.define("slot-machine",u),console.log("[SLOT_MACHINE] Web component registered")})();
