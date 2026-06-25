/**
 * ADMIN_STORE_PRODUCTS Page Entry Point
 *
 * This file is the entry point for the admin store products page Vite build.
 * It imports styles and initializes the appropriate controller based on the page.
 */

// Import styles
import './styles/main.scss';

// Import page controllers
import { ProductListPage } from './ProductListPage.js';
import { ProductCreatePage } from './ProductCreatePage.js';
import { ProductEditPage } from './ProductEditPage.js';

/**
 * Initialize the page when DOM is ready
 */
function initPage() {
  // Get base URL from global variable (set by Tera template)
  const baseUrl = window.BASE_URL || '';

  // Get toast function
  const showToast = createToastFunction();

  // Determine which page to initialize based on body data attribute
  const pageType = document.body.dataset.pageType || 'list';

  let controller = null;

  switch (pageType) {
    case 'create':
      controller = new ProductCreatePage({ baseUrl, showToast });
      break;
    case 'edit':
      controller = new ProductEditPage({ baseUrl, showToast });
      break;
    case 'list':
    default:
      controller = new ProductListPage({ baseUrl, showToast });
      break;
  }

  // Store reference globally for debugging
  if (typeof window !== 'undefined') {
    window.storeProductsController = controller;
  }
}

/**
 * Create toast notification function
 * Uses Toastify if available, falls back to console
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
