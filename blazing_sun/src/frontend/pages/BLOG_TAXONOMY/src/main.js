/**
 * BLOG_TAXONOMY Page Entry Point
 */

import './styles/main.scss';
import { BlogTaxonomyPage } from './BlogTaxonomyPage.js';

function initPage() {
  const categoriesContainer = document.getElementById('categoriesContainer');
  const tagsContainer = document.getElementById('tagsContainer');
  const searchContainer = document.getElementById('searchWidget');

  const baseUrl = window.BASE_URL || '';

  const showToast = createToastFunction();

  const controller = new BlogTaxonomyPage({
    baseUrl,
    categoriesContainer,
    tagsContainer,
    searchContainer,
    showToast
  });

  if (typeof window !== 'undefined') {
    window.blogTaxonomyController = controller;
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
