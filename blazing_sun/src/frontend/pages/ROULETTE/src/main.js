/**
 * Multiplayer Roulette - Main Entry Point
 *
 * Initializes the multiplayer roulette game with:
 * - WebSocket connection for real-time updates
 * - Countdown timer with circular progress
 * - Spin history bar
 * - Bet management
 * - Wheel animation
 * - Global chat
 */

import './styles/main.scss';
import { RouletteGame } from './components/RouletteGame.js';

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('roulette-multiplayer');

    if (container) {
        window.rouletteGame = new RouletteGame(container);
    }
});
