/**
 * BIGGER_DICE Game Entry Point
 *
 * This file bootstraps the BiggerDice web component.
 * The component is self-contained with its own WebSocket handling,
 * game state management, and UI.
 */

import './styles/main.scss';
import { BiggerDice } from './BiggerDice.js';

// Register the web component if not already registered
if (!customElements.get('bigger-dice')) {
    customElements.define('bigger-dice', BiggerDice);
}

// Log registration for debugging
console.log('[BIGGER_DICE] Web component registered');
