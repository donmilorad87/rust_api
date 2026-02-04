/**
 * BLOG_HOME Page Entry Point
 *
 * This file is the entry point for the blog home page Vite build.
 * It imports styles and initializes the BlogHomePage controller.
 */

// Import styles
import './styles/main.scss';

// Import BlogHomePage controller
import { BlogHomePage } from './BlogHomePage.js';

/**
 * Initialize the page when DOM is ready
 */
function initPage() {
  // Get required elements
  const postsContainer = document.getElementById('postsContainer');
  const paginationContainer = document.getElementById('pagination');
  const tagCloudContainer = document.getElementById('tagCloudWidget');
  const archiveContainer = document.getElementById('archiveWidget');
  const searchContainer = document.getElementById('searchWidget');
  const featuredContainer = document.getElementById('featuredPosts');

  // Check if main element exists
  if (!postsContainer) {
    console.error('BlogHomePage: Posts container element not found');
    return;
  }

  // Get base URL from global variable (set by Tera template)
  const baseUrl = window.BASE_URL || '';

  // Get toast function (if Toastify is available)
  const showToast = createToastFunction();

  // Initialize BlogHomePage controller
  const blogController = new BlogHomePage({
    baseUrl,
    postsContainer,
    paginationContainer,
    tagCloudContainer,
    archiveContainer,
    searchContainer,
    featuredContainer,
    showToast
  });

  // Store reference globally for debugging
  if (typeof window !== 'undefined') {
    window.blogController = blogController;
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
