/**
 * BLOG_CATEGORY Page Entry Point
 */

import './styles/main.scss';
import { BlogCategoryPage } from './BlogCategoryPage.js';

function initPage() {
  const headerContainer = document.getElementById('categoryHeader');
  const postsContainer = document.getElementById('postsContainer');
  const paginationContainer = document.getElementById('pagination');
  const tagCloudContainer = document.getElementById('tagCloudWidget');
  const archiveContainer = document.getElementById('archiveWidget');
  const searchContainer = document.getElementById('searchWidget');

  if (!postsContainer) {
    console.error('BlogCategoryPage: Posts container not found');
    return;
  }

  const baseUrl = window.BASE_URL || '';
  const categorySlug = window.CATEGORY_SLUG || '';

  const showToast = createToastFunction();

  const controller = new BlogCategoryPage({
    baseUrl,
    categorySlug,
    headerContainer,
    postsContainer,
    paginationContainer,
    tagCloudContainer,
    archiveContainer,
    searchContainer,
    showToast
  });

  if (typeof window !== 'undefined') {
    window.blogCategoryController = controller;
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
