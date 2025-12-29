/**
 * FORGOT_PASSWORD Page Entry Point
 *
 * This file is the entry point for the FORGOT_PASSWORD page Vite build.
 * It imports styles and initializes the ForgotPassword controller.
 */

// Import styles
import './styles/main.scss';

// Import ForgotPassword controller
import { ForgotPassword } from './ForgotPassword.js';

/**
 * Initialize the page when DOM is ready
 */
function initPage() {
  // Get required elements
  const requestCard = document.getElementById('requestCard');
  const verifyCard = document.getElementById('verifyCard');
  const resetCard = document.getElementById('resetCard');
  const requestForm = document.getElementById('requestForm');
  const verifyForm = document.getElementById('verifyForm');
  const resetForm = document.getElementById('resetForm');
  const requestBtn = document.getElementById('requestBtn');
  const verifyBtn = document.getElementById('verifyBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Check if elements exist
  if (!requestCard || !verifyCard || !resetCard) {
    console.error('ForgotPassword page: Required card elements not found');
    return;
  }

  if (!requestForm || !verifyForm || !resetForm) {
    console.error('ForgotPassword page: Required form elements not found');
    return;
  }

  // Get base URL from global variable (set by Tera template)
  const baseUrl = window.BASE_URL || '';

  // Get toast function (if Toastify is available)
  const showToast = createToastFunction();

  // Initialize ForgotPassword controller
  const forgotPasswordController = new ForgotPassword({
    baseUrl,
    requestCard,
    verifyCard,
    resetCard,
    requestForm,
    verifyForm,
    resetForm,
    requestBtn,
    verifyBtn,
    resetBtn,
    showToast
  });

  // Store reference globally for debugging
  if (typeof window !== 'undefined') {
    window.forgotPasswordController = forgotPasswordController;
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
    info: 'linear-gradient(to right, #667eea, #764ba2)'
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
