/**
 * BLOG_SEARCH Page Entry Point
 */

import './styles/main.scss';
import { BlogSearchPage } from './BlogSearchPage.js';

function initPage() {
  // Use existing template elements
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchQuery');
  const categorySelect = document.getElementById('filterCategory');
  const resultsContainer = document.getElementById('postsGrid');
  const paginationContainer = document.getElementById('pagination');
  const searchMetaContainer = document.querySelector('.blog-page__meta .blog-page__count');

  const baseUrl = window.BASE_URL || '';

  // Get initial query and category from URL
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q') || '';
  const category = urlParams.get('category') || '';

  // Set initial category value in select if provided
  if (category && categorySelect) {
    categorySelect.value = category;
  }

  const showToast = createToastFunction();

  const controller = new BlogSearchPage({
    baseUrl,
    query,
    category,
    searchForm,
    searchInput,
    categorySelect,
    resultsContainer,
    paginationContainer,
    searchMetaContainer,
    showToast
  });

  if (typeof window !== 'undefined') {
    window.blogSearchController = controller;
  }
}

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
        style: { background: colors[type] || colors.info }
      }).showToast();
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
