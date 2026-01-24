import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

export class BalancePage {
  constructor({
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
  }) {
    const normalizedBaseUrl = (baseUrl || '').replace(/\/$/, '');
    this.baseUrl = normalizedBaseUrl;
    this.checkoutBaseUrl = normalizedBaseUrl ? `${normalizedBaseUrl}/checkout` : '/checkout';
    this.form = form;
    this.amountInput = amountInput;
    this.submitBtn = submitBtn;
    this.statusEl = statusEl;
    this.summaryEl = summaryEl;
    this.walletTab = walletTab;
    this.transactionsTab = transactionsTab;
    this.walletPanel = walletPanel;
    this.transactionsPanel = transactionsPanel;
    this.transactionsList = transactionsList;
    this.transactionsLoading = transactionsLoading;
    this.transactionsEmpty = transactionsEmpty;
    this.transactionsError = transactionsError;
    this.isSubmitting = false;
    this.transactionsLoaded = false;
    this.isLoadingTransactions = false;

    this.init();
  }

  init() {
    this.form.addEventListener('submit', (event) => this.handleSubmit(event));
    this.amountInput.addEventListener('input', () => this.updateSummary());
    this.updateSummary();
    this.showStatusFromQuery();
    this.initTabs();
  }

  showStatusFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');

    if (status === 'success') {
      this.showStatus('Payment completed. Coins will appear shortly.', 'success');
    } else if (status === 'cancel') {
      this.showStatus('Payment canceled. You can try again.', 'warning');
    }
  }

  initTabs() {
    if (!this.walletTab || !this.transactionsTab || !this.walletPanel || !this.transactionsPanel) {
      return;
    }

    this.walletTab.addEventListener('click', () => this.activateTab('wallet'));
    this.transactionsTab.addEventListener('click', () => this.activateTab('transactions'));
  }

  activateTab(tab) {
    const isWallet = tab === 'wallet';

    if (this.walletTab && this.transactionsTab) {
      this.walletTab.classList.toggle('balance__tab--active', isWallet);
      this.transactionsTab.classList.toggle('balance__tab--active', !isWallet);
      this.walletTab.setAttribute('aria-selected', isWallet ? 'true' : 'false');
      this.transactionsTab.setAttribute('aria-selected', isWallet ? 'false' : 'true');
    }

    if (this.walletPanel && this.transactionsPanel) {
      this.walletPanel.hidden = !isWallet;
      this.transactionsPanel.hidden = isWallet;
      this.walletPanel.classList.toggle('balance__panel--active', isWallet);
      this.transactionsPanel.classList.toggle('balance__panel--active', !isWallet);
    }

    if (!isWallet && !this.transactionsLoaded) {
      this.loadTransactions();
    }
  }

  updateSummary() {
    if (!this.summaryEl) return;

    const amount = this.getAmount();
    if (!amount) {
      this.summaryEl.textContent = '';
      this.amountInput.classList.remove('balance__input--error');
      return;
    }

    const balanceCents = amount * 100;
    this.summaryEl.textContent = `You are adding ${amount} coins (${balanceCents} balance).`;
    this.amountInput.classList.remove('balance__input--error');
  }

  getAmount() {
    const value = Number.parseInt(this.amountInput.value, 10);
    if (!Number.isInteger(value) || value < 1) {
      return null;
    }
    return value;
  }

  async handleSubmit(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const amount = this.getAmount();
    if (!amount) {
      this.amountInput.classList.add('balance__input--error');
      this.showToast('Enter a whole number of coins (minimum 1).', 'error');
      return;
    }

    this.setLoading(true, 'Creating checkout...');
    this.isSubmitting = true;

    const result = await this.createCheckoutSession(amount);
    if (!result.ok) {
      this.setLoading(false, 'Continue to Stripe');
      this.isSubmitting = false;
      this.showToast(result.message || 'Checkout failed. Please try again.', 'error');
      return;
    }

    const redirectUrl = result.data?.url;

    if (redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }

    this.setLoading(false, 'Continue to Stripe');
    this.isSubmitting = false;
    this.showToast('Stripe checkout could not start.', 'error');
  }

  async createCheckoutSession(amount) {
    try {
      const headers = getCsrfHeaders();
      const token = this.getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Call checkout service directly to create Stripe session
      // DB row is only created when payment completes (via webhook)
      const response = await fetch(`${this.checkoutBaseUrl}/sessions`, {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify({ amount })
      });

      const data = await response.json().catch(() => ({}));

      return {
        ok: response.ok,
        data,
        message: data?.message
      };
    } catch (error) {
      console.error('Checkout request failed:', error);
      return { ok: false, message: 'Network error. Please try again.' };
    }
  }

  getAuthToken() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token') {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  setTransactionsState(state, message) {
    if (this.transactionsLoading) {
      this.transactionsLoading.classList.toggle(
        'balance__transactions-state--hidden',
        state !== 'loading'
      );
    }

    if (this.transactionsEmpty) {
      this.transactionsEmpty.classList.toggle(
        'balance__transactions-state--hidden',
        state !== 'empty'
      );
    }

    if (this.transactionsError) {
      if (message) {
        this.transactionsError.textContent = message;
      }
      this.transactionsError.classList.toggle(
        'balance__transactions-state--hidden',
        state !== 'error'
      );
    }

    if (this.transactionsList) {
      this.transactionsList.classList.toggle(
        'balance__transactions-list--hidden',
        state !== 'list'
      );
    }
  }

  async loadTransactions() {
    if (this.isLoadingTransactions || !this.transactionsList) return;

    this.isLoadingTransactions = true;
    this.setTransactionsState('loading');

    const result = await this.fetchTransactions();
    if (!result.ok) {
      this.setTransactionsState(
        'error',
        result.message || 'Unable to load transactions.'
      );
      this.isLoadingTransactions = false;
      return;
    }

    const transactions = Array.isArray(result.data?.transactions)
      ? result.data.transactions
      : [];

    if (transactions.length === 0) {
      this.setTransactionsState('empty');
    } else {
      this.renderTransactions(transactions);
      this.setTransactionsState('list');
      this.transactionsLoaded = true;
    }

    this.isLoadingTransactions = false;
  }

  async fetchTransactions() {
    try {
      const headers = getCsrfHeaders({ Accept: 'application/json' });
      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.checkoutBaseUrl}/transactions?limit=50`, {
        method: 'GET',
        headers,
        credentials: 'same-origin'
      });

      const data = await response.json().catch(() => ({}));

      return {
        ok: response.ok,
        data,
        message: data?.message
      };
    } catch (error) {
      console.error('Transactions request failed:', error);
      return { ok: false, message: 'Network error. Please try again.' };
    }
  }

  renderTransactions(transactions) {
    if (!this.transactionsList) return;

    this.transactionsList.innerHTML = '';

    transactions.forEach((transaction) => {
      const amountCents = Number(transaction.amount_cents || 0);
      const coins = amountCents / 100;
      const absCoins = Math.abs(coins);
      const coinsLabel = Number.isInteger(absCoins) ? absCoins.toString() : absCoins.toFixed(2);
      const amountPrefix = amountCents >= 0 ? '+' : '-';
      const purpose = this.formatPurpose(transaction.purpose);
      const { label: statusLabel, className: statusClass } = this.formatStatus(
        transaction.status
      );
      const checkoutId = this.formatCheckoutId(transaction.checkout_id);
      const dateLabel = this.formatDate(transaction.completed_at || transaction.created_at);

      const row = document.createElement('div');
      row.className = 'balance__transactions-row';
      row.innerHTML = `
        <div class="balance__transactions-main">
          <div class="balance__transactions-amount">${amountPrefix}${coinsLabel} coins</div>
          <div class="balance__transactions-meta">${purpose} · ${amountCents} balance</div>
          ${checkoutId ? `<div class="balance__transactions-id">Checkout ${checkoutId}</div>` : ''}
        </div>
        <div class="balance__transactions-side">
          <span class="balance__transactions-status balance__transactions-status--${statusClass}">
            ${statusLabel}
          </span>
          <span class="balance__transactions-date">${dateLabel}</span>
        </div>
      `;

      this.transactionsList.appendChild(row);
    });
  }

  formatPurpose(purpose) {
    if (!purpose) return 'Top up';
    const normalized = purpose.replace(/_/g, ' ');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  formatCheckoutId(checkoutId) {
    if (!checkoutId) return null;
    if (checkoutId.length <= 8) return checkoutId;
    return checkoutId.slice(-8);
  }

  formatStatus(status) {
    switch (status) {
      case 'payment_succeeded':
        return { label: 'Paid', className: 'success' };
      case 'payment_failed':
      case 'session_failed':
        return { label: 'Failed', className: 'failed' };
      case 'session_created':
        return { label: 'Pending', className: 'pending' };
      case 'game_participation':
        return { label: 'Game', className: 'success' };
      case 'game_prize_won':
        return { label: 'Won', className: 'success' };
      default:
        return { label: 'Unknown', className: 'pending' };
    }
  }

  formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  }

  setLoading(isLoading, label) {
    if (!this.submitBtn) return;

    this.submitBtn.disabled = isLoading;
    this.submitBtn.textContent = label;
    this.submitBtn.classList.toggle('balance__submit--loading', isLoading);
  }

  showStatus(message, type) {
    if (!this.statusEl) return;

    this.statusEl.textContent = message;
    this.statusEl.classList.remove(
      'balance__status--success',
      'balance__status--warning',
      'balance__status--error'
    );
    this.statusEl.classList.add(`balance__status--${type}`);
  }

  showToast(message, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }

    console.log(`[${type}] ${message}`);
  }
}
