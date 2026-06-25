/**
 * ADMIN STORE CATEGORIES Page Entry Point
 *
 * This file is the entry point for the admin store categories page Vite build.
 * It imports styles and initializes the CategoryManagePage controller.
 */

// Import styles
import './styles/main.scss';

// Import CategoryManagePage controller
import { CategoryManagePage } from './CategoryManagePage.js';

/**
 * Initialize the page when DOM is ready
 */
function initPage() {
  // Get required elements
  const categoriesTable = document.getElementById('categoriesTable');

  // Check if elements exist
  if (!categoriesTable) {
    console.error('CategoryManagePage: Required DOM elements not found');
    return;
  }

  // Get base URL from global variable (set by Tera template)
  const baseUrl = window.BASE_URL || '';

  // Get toast function (if Toastify is available)
  const showToast = createToastFunction();

  // Initialize CategoryManagePage controller
  const categoriesController = new CategoryManagePage({
    baseUrl,
    categoriesTable,
    showToast
  });

  // Store reference globally for debugging
  if (typeof window !== 'undefined') {
    window.categoriesController = categoriesController;
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
