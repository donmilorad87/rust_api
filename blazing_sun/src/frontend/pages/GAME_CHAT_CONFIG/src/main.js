/**
 * GAME_CHAT_CONFIG Admin Page Entry Point
 *
 * This file is the entry point for the Game Chat Config admin page Vite build.
 * It imports styles and initializes the GameChatConfigPage controller.
 */

// Import styles
import './styles/main.scss';

// Import GameChatConfigPage controller
import { GameChatConfigPage } from './GameChatConfigPage.js';

/**
 * Initialize the page when DOM is ready
 */
function initPage() {
  // Get required elements
  const configForm = document.getElementById('configForm');
  const loadingIndicator = document.getElementById('loadingIndicator');

  // Check if elements exist
  if (!configForm || !loadingIndicator) {
    console.error('GameChatConfigPage: Required DOM elements not found');
    return;
  }

  // Get base URL from global variable (set by Tera template)
  const baseUrl = window.BASE_URL || '';

  // Get toast function (if Toastify is available)
  const showToast = createToastFunction();

  // Initialize GameChatConfigPage controller
  const configController = new GameChatConfigPage({
    baseUrl,
    configForm,
    loadingIndicator,
    showToast
  });

  // Store reference globally for debugging
  if (typeof window !== 'undefined') {
    window.gameChatConfigController = configController;
  }
}

/**
 * Create toast notification function
 * Uses Toastify if available, falls back to console/alert
 * @returns {Function}
 */
function createToastFunction() {
  const colors = {
    success: 'linear-gradient(to right, #00b09b, #96c93d)',
    error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
    info: 'linear-gradient(to right, #667eea, #764ba2)',
    warning: 'linear-gradient(to right, #f093fb, #f5576c)'
  };

  return function showToast(message, type = 'success') {
    if (typeof Toastify !== 'undefined') {
      Toastify({
        text: message,
        duration: 4000,
        gravity: 'top',
        position: 'right',
        style: {
          background: colors[type] || colors.info
        }
      }).showToast();
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
