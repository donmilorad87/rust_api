/**
 * BLOG_POSTS Page Entry Point
 *
 * This file is the entry point for the BLOG_POSTS page Vite build.
 * It imports styles and initializes the appropriate controller based on the page type:
 * - PostEditorPage: For the dedicated post editor (/admin/blog/posts/new, /admin/blog/posts/{id}/edit)
 * - BlogPostsPage: For the posts list view (/admin/blog/posts)
 *
 * NOTE: TinyMCE must be included via CDN in the Tera template for editor pages:
 * <script src="https://cdn.tiny.cloud/1/no-api-key/tinymce/6/tinymce.min.js" referrerpolicy="origin"></script>
 */

// Import styles
import './styles/main.scss';

// Import controllers
import { BlogPostsPage } from './BlogPostsPage.js';
import { PostEditorPage } from './PostEditorPage.js';

/**
 * Initialize the page when DOM is ready
 */
function initPage() {
  // Get base URL from global variable (set by Tera template)
  const baseUrl = window.BASE_URL || '';

  // Get toast function (if Toastify is available)
  const showToast = createToastFunction();

  // Detect page type by looking for specific elements
  const isEditorPage = document.getElementById('postForm') !== null;
  const isListPage = document.getElementById('postsTableBody') !== null;

  if (isEditorPage) {
    // Initialize PostEditorPage controller for the editor
    const postEditorController = new PostEditorPage({
      baseUrl,
      showToast
    });

    // Store reference globally for debugging
    if (typeof window !== 'undefined') {
      window.postEditorController = postEditorController;
    }
  } else if (isListPage) {
    // Initialize BlogPostsPage controller for the list view
    const blogPostsController = new BlogPostsPage({
      baseUrl,
      showToast
    });

    // Store reference globally for debugging
    if (typeof window !== 'undefined') {
      window.blogPostsController = blogPostsController;
    }
  } else {
    console.warn('BLOG_POSTS: Could not detect page type. No controller initialized.');
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
