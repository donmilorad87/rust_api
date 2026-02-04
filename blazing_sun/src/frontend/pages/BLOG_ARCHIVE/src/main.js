/**
 * BLOG_ARCHIVE Page Entry Point
 */

import './styles/main.scss';
import { BlogArchivePage } from './BlogArchivePage.js';

function initPage() {
  const headerContainer = document.getElementById('archiveHeader');
  const archiveNavContainer = document.getElementById('archiveNav');
  const postsContainer = document.getElementById('postsContainer');
  const paginationContainer = document.getElementById('pagination');
  const tagCloudContainer = document.getElementById('tagCloudWidget');
  const searchContainer = document.getElementById('searchWidget');

  const baseUrl = window.BASE_URL || '';

  // Get year/month from window globals (set by Tera template)
  const year = window.ARCHIVE_YEAR ? parseInt(window.ARCHIVE_YEAR, 10) : null;
  const month = window.ARCHIVE_MONTH ? parseInt(window.ARCHIVE_MONTH, 10) : null;

  const showToast = createToastFunction();

  const controller = new BlogArchivePage({
    baseUrl,
    year,
    month,
    headerContainer,
    archiveNavContainer,
    postsContainer,
    paginationContainer,
    tagCloudContainer,
    searchContainer,
    showToast
  });

  if (typeof window !== 'undefined') {
    window.blogArchiveController = controller;
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
