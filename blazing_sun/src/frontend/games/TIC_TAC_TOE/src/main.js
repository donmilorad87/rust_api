/**
 * TIC_TAC_TOE Game Entry Point
 *
 * This file bootstraps the TicTacToe web component.
 * The component is self-contained with its own WebSocket handling,
 * game state management, and UI.
 */

import './styles/main.scss';
import { TicTacToe } from './TicTacToe.js';

// Register the web component if not already registered
if (!customElements.get('tic-tac-toe')) {
    customElements.define('tic-tac-toe', TicTacToe);
}

// Log registration for debugging
console.log('[TIC_TAC_TOE] Web component registered');
