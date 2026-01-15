/**
 * COMPETITIONS Page Entry Point
 */
import './styles/main.scss';
import { CompetitionsPage } from './CompetitionsPage.js';

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

function initPage() {
  const pageEl = document.getElementById('competitionsPage');
  const listEl = document.getElementById('competitionsList');
  const emptyState = document.getElementById('competitionsEmptyState');
  const createForm = document.getElementById('competitionCreateForm');

  if (!listEl || !emptyState) {
    console.error('CompetitionsPage: Required DOM elements not found');
    return;
  }

  const baseUrl = window.BASE_URL || '';
  const isAdmin = pageEl?.dataset?.isAdmin === 'true';
  const isLogged = pageEl?.dataset?.isLogged === 'true';
  const showToast = createToastFunction();

  const page = new CompetitionsPage({
    baseUrl,
    listEl,
    emptyState,
    createForm,
    isAdmin,
    isLogged,
    showToast
  });

  if (typeof window !== 'undefined') {
    window.competitionsPage = page;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
