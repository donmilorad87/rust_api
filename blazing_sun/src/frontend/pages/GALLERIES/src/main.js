/**
 * GALLERIES Page Entry Point
 *
 * This file is the entry point for the GALLERIES page Vite build.
 * It imports styles and initializes the GalleriesPage controller.
 */

// Import styles
import './styles/main.scss';

// Import GalleriesPage controller
import { GalleriesPage } from './GalleriesPage.js';

/**
 * Initialize the page when DOM is ready
 */
function initPage() {
  // Get required elements
  const galleriesGrid = document.getElementById('galleriesGrid');
  const loadingState = document.getElementById('loadingState');
  const errorState = document.getElementById('errorState');
  const emptyState = document.getElementById('emptyState');

  // Check if elements exist
  if (!galleriesGrid || !loadingState || !errorState || !emptyState) {
    console.error('GalleriesPage: Required DOM elements not found');
    return;
  }

  // Get base URL from global variable (set by Tera template)
  const baseUrl = window.BASE_URL || '';

  // Get toast function (if Toastify is available)
  const showToast = createToastFunction();

  // Initialize GalleriesPage controller
  const galleriesController = new GalleriesPage({
    baseUrl,
    galleriesGrid,
    loadingState,
    errorState,
    emptyState,
    showToast
  });

  // Store reference globally for debugging
  if (typeof window !== 'undefined') {
    window.galleriesController = galleriesController;
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
