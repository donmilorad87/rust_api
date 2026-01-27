/**
 * ROULETTE Game Entry Point
 *
 * This file bootstraps the MiniRoulette web component.
 * The component is self-contained with its own game state management and UI.
 */

import './styles/main.scss';
import { MiniRouletteGame } from './MiniRoulette.js';

// Register the web component if not already registered
if (!customElements.get('mini-roulette')) {
    customElements.define('mini-roulette', MiniRouletteGame);
}

// Log registration for debugging
console.log('[ROULETTE] Web component registered');
