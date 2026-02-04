import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * BlogAnalyticsPage Controller
 *
 * Handles blog search analytics dashboard:
 * - Display search statistics
 * - Top queries chart
 * - Zero-result queries
 * - Search trends over time
 * - Click-through rates
 * - Export functionality
 */
export class BlogAnalyticsPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;

    // DOM Elements
    this.statsGrid = document.getElementById('statsGrid');
    this.topQueriesChart = document.getElementById('topQueriesChart');
    this.zeroResultsList = document.getElementById('zeroResultsList');
    this.trendsChart = document.getElementById('trendsChart');
    this.queriesTable = document.getElementById('queriesTableBody');
    this.pagination = document.getElementById('pagination');
    this.startDateInput = document.getElementById('startDate');
    this.endDateInput = document.getElementById('endDate');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.exportBtn = document.getElementById('exportBtn');
    this.exportDropdown = document.getElementById('exportDropdown');

    // Tabs
    this.tabButtons = document.querySelectorAll('[data-tab]');
    this.tabContents = document.querySelectorAll('[data-tab-content]');

    // State
    this.stats = null;
    this.topQueries = [];
    this.zeroResultQueries = [];
    this.trendsData = [];
    this.allQueries = [];
    this.totalQueries = 0;
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.dateRange = this.getDefaultDateRange();

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.setDefaultDates();
    this.bindEvents();
    this.loadAllData();
  }

  /**
   * Get default date range (last 30 days)
   * @returns {{start: string, end: string}}
   */
  getDefaultDateRange() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  /**
   * Set default dates in inputs
   */
  setDefaultDates() {
    if (this.startDateInput) this.startDateInput.value = this.dateRange.start;
    if (this.endDateInput) this.endDateInput.value = this.dateRange.end;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Date range change
    if (this.startDateInput) {
      this.startDateInput.addEventListener('change', () => this.handleDateChange());
    }
    if (this.endDateInput) {
      this.endDateInput.addEventListener('change', () => this.handleDateChange());
    }

    // Refresh button
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => this.loadAllData());
    }

    // Export dropdown
    if (this.exportBtn && this.exportDropdown) {
      this.exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.exportDropdown.classList.toggle('export-dropdown__menu--visible');
      });

      // Close dropdown on outside click
      document.addEventListener('click', () => {
        this.exportDropdown.classList.remove('export-dropdown__menu--visible');
      });

      // Export actions
      this.exportDropdown.querySelectorAll('[data-export]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const format = btn.dataset.export;
          this.exportData(format);
          this.exportDropdown.classList.remove('export-dropdown__menu--visible');
        });
      });
    }

    // Tabs
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });
  }

  /**
   * Handle date range change
   */
  handleDateChange() {
    const start = this.startDateInput?.value;
    const end = this.endDateInput?.value;

    if (start && end && new Date(start) <= new Date(end)) {
      this.dateRange = { start, end };
      this.currentPage = 1;
      this.loadAllData();
    }
  }

  /**
   * Switch tab
   * @param {string} tabId - Tab identifier
   */
  switchTab(tabId) {
    // Update button states
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('tabs__tab--active', btn.dataset.tab === tabId);
    });

    // Update content visibility
    this.tabContents.forEach(content => {
      content.classList.toggle('tab-content--active', content.dataset.tabContent === tabId);
    });
  }

  /**
   * Load all analytics data
   */
  async loadAllData() {
    await Promise.all([
      this.loadStats(),
      this.loadTopQueries(),
      this.loadZeroResultQueries(),
      this.loadTrendsData(),
      this.loadAllQueries()
    ]);
  }

  /**
   * Load analytics statistics
   */
  async loadStats() {
    if (!this.statsGrid) return;

    try {
      const params = new URLSearchParams({
        start_date: this.dateRange.start,
        end_date: this.dateRange.end
      });

      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/analytics/stats?${params}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load stats');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.stats = data.stats;
        this.renderStats();
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      this.renderStatsError();
    }
  }

  /**
   * Render statistics cards
   */
  renderStats() {
    if (!this.statsGrid || !this.stats) return;

    const cards = [
      {
        icon: 'searches',
        value: this.formatNumber(this.stats.total_searches || 0),
        label: 'Total Searches',
        trend: this.stats.searches_trend
      },
      {
        icon: 'zero-results',
        value: this.formatNumber(this.stats.zero_result_searches || 0),
        label: 'Zero Results',
        trend: this.stats.zero_results_trend
      },
      {
        icon: 'clicks',
        value: this.formatNumber(this.stats.total_clicks || 0),
        label: 'Result Clicks',
        trend: this.stats.clicks_trend
      },
      {
        icon: 'ctr',
        value: `${this.stats.click_through_rate || 0}%`,
        label: 'Click-Through Rate',
        trend: this.stats.ctr_trend
      }
    ];

    this.statsGrid.innerHTML = cards.map(card => `
      <div class="stat-card">
        <div class="stat-card__header">
          <div class="stat-card__icon stat-card__icon--${card.icon}">
            ${this.getStatIcon(card.icon)}
          </div>
          ${card.trend ? this.renderTrend(card.trend) : ''}
        </div>
        <div class="stat-card__value">${card.value}</div>
        <div class="stat-card__label">${card.label}</div>
      </div>
    `).join('');
  }

  /**
   * Render trend indicator
   * @param {Object} trend - Trend data
   * @returns {string} HTML string
   */
  renderTrend(trend) {
    if (!trend) return '';
    const icon = trend.direction === 'up'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';

    return `<div class="stat-card__trend stat-card__trend--${trend.direction}">${icon}${trend.value}%</div>`;
  }

  /**
   * Get stat icon SVG
   * @param {string} type - Icon type
   * @returns {string} SVG HTML
   */
  getStatIcon(type) {
    const icons = {
      searches: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      'zero-results': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      clicks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
      ctr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>'
    };
    return icons[type] || icons.searches;
  }

  /**
   * Render stats error state
   */
  renderStatsError() {
    if (!this.statsGrid) return;
    this.statsGrid.innerHTML = '<p class="text-center text-muted">Failed to load statistics</p>';
  }

  /**
   * Load top search queries
   */
  async loadTopQueries() {
    if (!this.topQueriesChart) return;

    try {
      const params = new URLSearchParams({
        start_date: this.dateRange.start,
        end_date: this.dateRange.end,
        limit: 10
      });

      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/analytics/top-queries?${params}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load top queries');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.topQueries = data.queries || [];
        this.renderTopQueries();
      }
    } catch (error) {
      console.error('Error loading top queries:', error);
      this.topQueriesChart.innerHTML = '<p class="text-center text-muted">Failed to load data</p>';
    }
  }

  /**
   * Render top queries bar chart
   */
  renderTopQueries() {
    if (!this.topQueriesChart) return;

    if (this.topQueries.length === 0) {
      this.topQueriesChart.innerHTML = '<p class="text-center text-muted">No search data available</p>';
      return;
    }

    const maxCount = Math.max(...this.topQueries.map(q => q.count));

    this.topQueriesChart.innerHTML = `
      <div class="bar-chart__bars">
        ${this.topQueries.map(query => {
          const width = (query.count / maxCount) * 100;
          return `
            <div class="bar-chart__item">
              <span class="bar-chart__label" title="${this.escapeHtml(query.query)}">${this.escapeHtml(query.query)}</span>
              <div class="bar-chart__bar-container">
                <div class="bar-chart__bar bar-chart__bar--primary" style="width: ${width}%"></div>
              </div>
              <span class="bar-chart__value">${this.formatNumber(query.count)}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Load zero-result queries
   */
  async loadZeroResultQueries() {
    if (!this.zeroResultsList) return;

    try {
      const params = new URLSearchParams({
        start_date: this.dateRange.start,
        end_date: this.dateRange.end,
        limit: 10
      });

      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/analytics/zero-results?${params}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load zero-result queries');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.zeroResultQueries = data.queries || [];
        this.renderZeroResultQueries();
      }
    } catch (error) {
      console.error('Error loading zero-result queries:', error);
      this.zeroResultsList.innerHTML = '<p class="zero-results-panel__empty">Failed to load data</p>';
    }
  }

  /**
   * Render zero-result queries list
   */
  renderZeroResultQueries() {
    if (!this.zeroResultsList) return;

    if (this.zeroResultQueries.length === 0) {
      this.zeroResultsList.innerHTML = '<p class="zero-results-panel__empty">No zero-result queries. Great!</p>';
      return;
    }

    this.zeroResultsList.innerHTML = this.zeroResultQueries.map(query => `
      <div class="zero-results-panel__item">
        <span class="zero-results-panel__query">${this.escapeHtml(query.query)}</span>
        <span class="zero-results-panel__count">${this.formatNumber(query.count)} searches</span>
      </div>
    `).join('');
  }

  /**
   * Load trends data
   */
  async loadTrendsData() {
    if (!this.trendsChart) return;

    try {
      const params = new URLSearchParams({
        start_date: this.dateRange.start,
        end_date: this.dateRange.end
      });

      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/analytics/trends?${params}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load trends');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.trendsData = data.trends || [];
        this.renderTrendsChart();
      }
    } catch (error) {
      console.error('Error loading trends:', error);
      this.trendsChart.innerHTML = '<p class="line-chart__empty">Failed to load data</p>';
    }
  }

  /**
   * Render trends chart (simple CSS-based bar chart)
   */
  renderTrendsChart() {
    if (!this.trendsChart) return;

    if (this.trendsData.length === 0) {
      this.trendsChart.innerHTML = '<p class="line-chart__empty">No trend data available</p>';
      return;
    }

    const maxValue = Math.max(...this.trendsData.map(d => d.count));

    this.trendsChart.innerHTML = `
      <div class="line-chart">
        ${this.trendsData.map(day => {
          const height = maxValue > 0 ? (day.count / maxValue) * 100 : 0;
          const date = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return `
            <div class="line-chart__bar" style="height: ${Math.max(height, 2)}%">
              <div class="line-chart__tooltip">${date}: ${this.formatNumber(day.count)} searches</div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="line-chart-legend">
        <span>Daily Search Volume</span>
      </div>
    `;
  }

  /**
   * Load all queries for table
   */
  async loadAllQueries() {
    if (!this.queriesTable) return;

    this.renderTableLoading();

    try {
      const offset = (this.currentPage - 1) * this.itemsPerPage;
      const params = new URLSearchParams({
        start_date: this.dateRange.start,
        end_date: this.dateRange.end,
        limit: this.itemsPerPage,
        offset: offset
      });

      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/analytics/queries?${params}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load queries');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.allQueries = data.queries || [];
        this.totalQueries = data.total || 0;
        this.renderQueriesTable();
        this.renderPagination();
      }
    } catch (error) {
      console.error('Error loading queries:', error);
      this.renderTableError();
    }
  }

  /**
   * Render queries table
   */
  renderQueriesTable() {
    if (!this.queriesTable) return;

    if (this.allQueries.length === 0) {
      this.queriesTable.innerHTML = '<tr><td colspan="5" class="queries-table__empty">No search data available</td></tr>';
      return;
    }

    this.queriesTable.innerHTML = this.allQueries.map(query => `
      <tr>
        <td class="queries-table__query">${this.escapeHtml(query.query)}</td>
        <td class="queries-table__count">${this.formatNumber(query.count)}</td>
        <td>${this.formatNumber(query.clicks || 0)}</td>
        <td>${query.ctr || 0}%</td>
        <td>${this.formatDate(query.last_searched)}</td>
      </tr>
    `).join('');
  }

  /**
   * Render table loading state
   */
  renderTableLoading() {
    if (!this.queriesTable) return;
    this.queriesTable.innerHTML = '<tr><td colspan="5"><div class="loading-spinner"><div class="loading-spinner__icon"></div></div></td></tr>';
  }

  /**
   * Render table error state
   */
  renderTableError() {
    if (!this.queriesTable) return;
    this.queriesTable.innerHTML = '<tr><td colspan="5" class="queries-table__empty">Failed to load data</td></tr>';
  }

  /**
   * Render pagination
   */
  renderPagination() {
    if (!this.pagination) return;

    const totalPages = Math.ceil(this.totalQueries / this.itemsPerPage);

    if (totalPages <= 1) {
      this.pagination.innerHTML = '';
      return;
    }

    const { startPage, endPage } = this.calculatePageWindow(this.currentPage, totalPages);

    let html = '<nav class="pagination" aria-label="Pagination">';
    html += `<button class="pagination__btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="1">First</button>`;
    html += `<button class="pagination__btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">Prev</button>`;

    html += '<div class="pagination__pages">';
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage;
      html += `<button class="pagination__btn ${isActive ? 'pagination__btn--active' : ''}" data-page="${i}" ${isActive ? 'disabled' : ''}>${i}</button>`;
    }
    html += '</div>';

    html += `<button class="pagination__btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">Next</button>`;
    html += `<button class="pagination__btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${totalPages}">Last</button>`;

    html += `<div class="pagination__goto"><input type="number" class="pagination__input" min="1" max="${totalPages}" placeholder="Page"><button class="pagination__btn" data-action="goto">Go</button></div>`;
    html += '</nav>';

    this.pagination.innerHTML = html;

    // Bind events
    this.pagination.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.loadAllQueries();
        }
      });
    });

    const goBtn = this.pagination.querySelector('[data-action="goto"]');
    const input = this.pagination.querySelector('.pagination__input');
    if (goBtn && input) {
      goBtn.addEventListener('click', () => {
        const page = parseInt(input.value, 10);
        if (page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.loadAllQueries();
        }
      });
    }
  }

  /**
   * Calculate page window for pagination
   */
  calculatePageWindow(currentPage, totalPages) {
    const maxVisible = 7;
    const halfWindow = 3;

    let startPage, endPage;

    if (totalPages <= maxVisible) {
      startPage = 1;
      endPage = totalPages;
    } else if (currentPage <= halfWindow + 1) {
      startPage = 1;
      endPage = maxVisible;
    } else if (currentPage >= totalPages - halfWindow) {
      startPage = totalPages - maxVisible + 1;
      endPage = totalPages;
    } else {
      startPage = currentPage - halfWindow;
      endPage = currentPage + halfWindow;
    }

    return { startPage, endPage };
  }

  /**
   * Export data
   * @param {string} format - Export format (csv, json)
   */
  async exportData(format) {
    try {
      const params = new URLSearchParams({
        start_date: this.dateRange.start,
        end_date: this.dateRange.end,
        format: format
      });

      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/analytics/export?${params}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-analytics-${this.dateRange.start}-to-${this.dateRange.end}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.showToast('Export completed', 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.showToast('Export failed', 'error');
    }
  }

  /**
   * Format number with K/M suffix
   * @param {number} num - Number to format
   * @returns {string} Formatted number
   */
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Format date
   * @param {string} dateStr - Date string
   * @returns {string} Formatted date
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
