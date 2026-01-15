/**
 * BALANCE Page Entry Point
 */

import './styles/main.scss';
import { BalancePage } from './BalancePage.js';

function initPage() {
  const form = document.getElementById('balanceForm');
  const amountInput = document.getElementById('amount');
  const submitBtn = document.getElementById('balanceSubmit');
  const statusEl = document.getElementById('balanceStatus');
  const summaryEl = document.getElementById('amountSummary');
  const walletTab = document.getElementById('balanceWalletTab');
  const transactionsTab = document.getElementById('balanceTransactionsTab');
  const walletPanel = document.getElementById('balanceWalletPanel');
  const transactionsPanel = document.getElementById('balanceTransactionsPanel');
  const transactionsList = document.getElementById('balanceTransactionsList');
  const transactionsLoading = document.getElementById('balanceTransactionsLoading');
  const transactionsEmpty = document.getElementById('balanceTransactionsEmpty');
  const transactionsError = document.getElementById('balanceTransactionsError');

  if (!form || !amountInput || !submitBtn) {
    console.error('Balance page: Required DOM elements not found');
    return;
  }

  const baseUrl = window.BASE_URL || '';

  const page = new BalancePage({
    baseUrl,
    form,
    amountInput,
    submitBtn,
    statusEl,
    summaryEl,
    walletTab,
    transactionsTab,
    walletPanel,
    transactionsPanel,
    transactionsList,
    transactionsLoading,
    transactionsEmpty,
    transactionsError
  });

  if (typeof window !== 'undefined') {
    window.balancePage = page;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
