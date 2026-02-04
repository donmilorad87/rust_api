import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * BlogAdminPage Controller
 *
 * Handles the blog admin dashboard:
 * - Display blog statistics (posts, categories, tags, views)
 * - Show recent posts
 * - Quick links to blog management sections
 */
export class BlogAdminPage {
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
    this.recentPostsList = document.getElementById('recentPostsList');

    // State
    this.stats = null;
    this.recentPosts = [];

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.loadDashboardData();
  }

  /**
   * Load all dashboard data
   */
  async loadDashboardData() {
    try {
      await Promise.all([
        this.loadStats(),
        this.loadRecentPosts()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  }

  /**
   * Load blog statistics
   */
  async loadStats() {
    if (!this.statsGrid) return;

    this.statsGrid.innerHTML = this.renderLoadingState();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/stats`, {
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
      } else {
        throw new Error(data.message || 'Failed to load stats');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      this.statsGrid.innerHTML = this.renderErrorState('Failed to load statistics');
    }
  }

  /**
   * Render statistics cards
   */
  renderStats() {
    if (!this.statsGrid || !this.stats) return;

    const statCards = [
      {
        icon: 'posts',
        value: this.stats.total_posts || 0,
        label: 'Total Posts',
        trend: this.stats.posts_trend
      },
      {
        icon: 'drafts',
        value: this.stats.draft_posts || 0,
        label: 'Drafts',
        trend: null
      },
      {
        icon: 'categories',
        value: this.stats.total_categories || 0,
        label: 'Categories',
        trend: null
      },
      {
        icon: 'tags',
        value: this.stats.total_tags || 0,
        label: 'Tags',
        trend: null
      },
      {
        icon: 'taxonomies',
        value: this.stats.total_taxonomies || 0,
        label: 'Taxonomies',
        trend: null
      },
      {
        icon: 'views',
        value: this.formatNumber(this.stats.total_views || 0),
        label: 'Total Views',
        trend: this.stats.views_trend
      }
    ];

    this.statsGrid.innerHTML = statCards.map(card => this.renderStatCard(card)).join('');
  }

  /**
   * Render a single stat card
   * @param {Object} card - Card data
   * @returns {string} HTML string
   */
  renderStatCard(card) {
    const trendHtml = card.trend
      ? `<div class="stat-card__trend stat-card__trend--${card.trend.direction}">
           ${this.getTrendIcon(card.trend.direction)}
           ${card.trend.value}%
         </div>`
      : '';

    return `
      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--${card.icon}">
          ${this.getStatIcon(card.icon)}
        </div>
        <div class="stat-card__value">${card.value}</div>
        <div class="stat-card__label">${card.label}</div>
        ${trendHtml}
      </div>
    `;
  }

  /**
   * Get stat icon SVG
   * @param {string} type - Icon type
   * @returns {string} SVG HTML
   */
  getStatIcon(type) {
    const icons = {
      posts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      drafts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
      categories: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      tags: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
      taxonomies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
      views: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
    };
    return icons[type] || icons.posts;
  }

  /**
   * Get trend icon
   * @param {string} direction - 'up' or 'down'
   * @returns {string} SVG HTML
   */
  getTrendIcon(direction) {
    if (direction === 'up') {
      return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>';
    }
    return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  }

  /**
   * Load recent posts
   */
  async loadRecentPosts() {
    if (!this.recentPostsList) return;

    this.recentPostsList.innerHTML = this.renderLoadingState();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/posts?limit=5&sort=created_at&order=desc`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load recent posts');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.recentPosts = data.posts || [];
        this.renderRecentPosts();
      } else {
        throw new Error(data.message || 'Failed to load recent posts');
      }
    } catch (error) {
      console.error('Error loading recent posts:', error);
      this.recentPostsList.innerHTML = this.renderEmptyState('No recent posts');
    }
  }

  /**
   * Render recent posts list
   */
  renderRecentPosts() {
    if (!this.recentPostsList) return;

    if (this.recentPosts.length === 0) {
      this.recentPostsList.innerHTML = this.renderEmptyState('No posts yet. Create your first post!');
      return;
    }

    this.recentPostsList.innerHTML = this.recentPosts.map(post => `
      <li class="recent-posts__item">
        <div class="recent-posts__info">
          <div class="recent-posts__title">${this.escapeHtml(post.title)}</div>
          <div class="recent-posts__meta">
            ${this.formatDate(post.created_at)} by ${this.escapeHtml(post.author_name || 'Unknown')}
          </div>
        </div>
        <span class="recent-posts__status recent-posts__status--${post.status}">
          ${post.status}
        </span>
      </li>
    `).join('');
  }

  /**
   * Render loading state
   * @returns {string} HTML string
   */
  renderLoadingState() {
    return `
      <div class="loading-spinner">
        <div class="loading-spinner__icon"></div>
      </div>
    `;
  }

  /**
   * Render error state
   * @param {string} message - Error message
   * @returns {string} HTML string
   */
  renderErrorState(message) {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;
  }

  /**
   * Render empty state
   * @param {string} message - Empty state message
   * @returns {string} HTML string
   */
  renderEmptyState(message) {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;
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
    if (!dateStr) return 'Unknown';
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
