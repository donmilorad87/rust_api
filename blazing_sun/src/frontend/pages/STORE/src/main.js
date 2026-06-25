/**
 * STORE Page Entry Point
 *
 * This file is the entry point for the STORE page Vite build.
 * It routes to the correct controller based on page type:
 * - StorePage: Main store listing
 * - ProductDetailPage: Individual product view
 * - CategoryPage: Category-filtered listing
 */

// Import styles
import './styles/main.scss';

// Import page controllers
import { StorePage } from './StorePage.js';
import { ProductDetailPage } from './ProductDetailPage.js';
import { CategoryPage } from './CategoryPage.js';

/**
 * Initialize the page when DOM is ready
 */
function initPage() {
  // Get base URL from global variable (set by Tera template)
  const baseUrl = window.BASE_URL || '';

  // Get toast function (if Toastify is available)
  const showToast = createToastFunction();

  // Determine page type from global variable
  const pageType = window.STORE_PAGE_TYPE || 'store';

  if (pageType === 'product') {
    // Product detail page
    const productSlug = window.PRODUCT_SLUG || '';
    if (!productSlug) {
      console.error('ProductDetailPage: No product slug provided');
      return;
    }

    const productController = new ProductDetailPage({
      baseUrl,
      productSlug,
      showToast
    });

    if (typeof window !== 'undefined') {
      window.productController = productController;
    }
  } else if (pageType === 'category') {
    // Category page
    const categorySlug = window.CATEGORY_SLUG || '';
    if (!categorySlug) {
      console.error('CategoryPage: No category slug provided');
      return;
    }

    const categoryController = new CategoryPage({
      baseUrl,
      categorySlug,
      showToast
    });

    if (typeof window !== 'undefined') {
      window.categoryController = categoryController;
    }
  } else {
    // Default: Main store page
    const productsGrid = document.getElementById('productsGrid');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const emptyState = document.getElementById('emptyState');

    if (!productsGrid || !loadingState || !errorState || !emptyState) {
      console.error('StorePage: Required DOM elements not found');
      return;
    }

    const storeController = new StorePage({
      baseUrl,
      productsGrid,
      loadingState,
      errorState,
      emptyState,
      showToast
    });

    if (typeof window !== 'undefined') {
      window.storeController = storeController;
    }
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
