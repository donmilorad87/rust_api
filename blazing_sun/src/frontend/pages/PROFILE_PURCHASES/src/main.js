/**
 * Profile Purchases Page - Main Entry Point
 * Initializes the purchases page controller
 */
import './styles/main.scss';
import { PurchasesPage } from './PurchasesPage.js';

/**
 * Show toast notification using Toastify
 * @param {string} message
 * @param {string} type - 'success', 'error', 'warning', 'info'
 */
function showToast(message, type = 'info') {
  const colors = {
    success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  };

  if (typeof Toastify === 'function') {
    Toastify({
      text: message,
      duration: 4000,
      gravity: 'top',
      position: 'right',
      stopOnFocus: true,
      style: {
        background: colors[type] || colors.info,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
    }).showToast();
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Initialize the purchases page
 */
function initPurchasesPage() {
  const baseUrl = window.BASE_URL || '';

  // Initialize PurchasesPage controller
  const purchasesPage = new PurchasesPage({
    baseUrl,
    loadingState: document.getElementById('loadingState'),
    emptyState: document.getElementById('emptyState'),
    purchasesGrid: document.getElementById('purchasesGrid'),
    pagination: document.getElementById('pagination'),
    purchaseModal: document.getElementById('purchaseModal'),
    confirmModal: document.getElementById('confirmModal'),
    showToast,
  });

  // Make instance available globally for debugging
  window.purchasesPage = purchasesPage;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPurchasesPage);
} else {
  initPurchasesPage();
}
