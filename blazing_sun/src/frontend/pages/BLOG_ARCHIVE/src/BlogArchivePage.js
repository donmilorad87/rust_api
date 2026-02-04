/**
 * BlogArchivePage Controller
 *
 * Archive navigation and monthly post listings.
 * Features:
 * - Year/month tree navigation
 * - Calendar grid view
 * - Posts listing for specific month
 */

import { Pagination } from '../../BLOG_HOME/src/widgets/Pagination.js';
import { TagCloud } from '../../BLOG_HOME/src/widgets/TagCloud.js';
import { SearchBox } from '../../BLOG_HOME/src/widgets/SearchBox.js';

export class BlogArchivePage {
  /**
   * @param {Object} options
   */
  constructor(options) {
    this.baseUrl = options.baseUrl || '';
    this.year = options.year || null;
    this.month = options.month || null;
    this.headerContainer = options.headerContainer;
    this.archiveNavContainer = options.archiveNavContainer;
    this.postsContainer = options.postsContainer;
    this.paginationContainer = options.paginationContainer;
    this.tagCloudContainer = options.tagCloudContainer;
    this.searchContainer = options.searchContainer;
    this.showToast = options.showToast || (() => {});

    this.archives = [];
    this.posts = [];
    this.currentPage = 1;
    this.postsPerPage = 9;
    this.totalPosts = 0;
    this.expandedYears = new Set();

    this.monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    this.pagination = null;
    this.tagCloud = null;
    this.searchBox = null;

    this.init();
  }

  async init() {
    this.initWidgets();
    await this.loadArchives();

    if (this.year && this.month) {
      await this.loadPostsForMonth(this.year, this.month, 1);
    }

    await this.loadSidebarData();
  }

  initWidgets() {
    if (this.paginationContainer) {
      this.pagination = new Pagination(this.paginationContainer, {
        currentPage: this.currentPage,
        totalPages: 1,
        onPageChange: (page) => {
          if (this.year && this.month) {
            this.loadPostsForMonth(this.year, this.month, page);
          }
        }
      });
    }

    if (this.searchContainer) {
      this.searchBox = new SearchBox(this.searchContainer, {
        baseUrl: this.baseUrl,
        placeholder: 'Search posts...',
        onSearch: (query) => this.handleSearch(query)
      });
    }

    if (this.tagCloudContainer) {
      this.tagCloud = new TagCloud(this.tagCloudContainer, {
        tags: [],
        baseUrl: this.baseUrl
      });
    }
  }

  async loadArchives() {
    this.showLoading();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/blog/archive`);

      if (!response.ok) {
        throw new Error('Failed to load archives');
      }

      const data = await response.json();
      this.archives = data.archive || [];

      this.renderHeader();
      this.renderArchiveNav();
    } catch (error) {
      console.error('BlogArchivePage: Error loading archives:', error);
      this.showError('Failed to load archive data');
    }
  }

  async loadPostsForMonth(year, month, page = 1) {
    this.currentPage = page;

    if (this.postsContainer) {
      this.postsContainer.innerHTML = `
        <div class="blog-loading">
          <div class="blog-loading__spinner"></div>
          <p class="blog-loading__text">Loading posts...</p>
        </div>
      `;
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: this.postsPerPage.toString()
      });

      const monthStr = month.toString().padStart(2, '0');
      const response = await fetch(`${this.baseUrl}/api/v1/blog/archive/${year}/${monthStr}?${params}`);

      if (!response.ok) {
        throw new Error('Failed to load posts');
      }

      const data = await response.json();
      this.posts = data.posts || [];
      this.totalPosts = data.pagination?.total || 0;

      this.renderPosts();

      if (this.pagination) {
        const totalPages = Math.ceil(this.totalPosts / this.postsPerPage);
        this.pagination.update(this.currentPage, totalPages);
      }
    } catch (error) {
      console.error('BlogArchivePage: Error loading posts:', error);
      this.showToast('Failed to load posts', 'error');
      this.renderPostsEmpty();
    }
  }

  async loadSidebarData() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/blog/tags?limit=20`);
      if (response.ok && this.tagCloud) {
        const data = await response.json();
        this.tagCloud.update(data.tags || []);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  groupByYear() {
    const grouped = new Map();

    this.archives.forEach(item => {
      if (!grouped.has(item.year)) {
        grouped.set(item.year, []);
      }
      grouped.get(item.year).push({
        month: item.month,
        post_count: item.post_count
      });
    });

    grouped.forEach((months) => {
      months.sort((a, b) => b.month - a.month);
    });

    return new Map([...grouped.entries()].sort((a, b) => b[0] - a[0]));
  }

  getTotalPosts() {
    return this.archives.reduce((sum, item) => sum + (item.post_count || 0), 0);
  }

  renderHeader() {
    if (!this.headerContainer) return;

    const title = this.year && this.month
      ? `${this.monthNames[this.month - 1]} ${this.year}`
      : 'Archives';

    const description = this.year && this.month
      ? `Posts from ${this.monthNames[this.month - 1]} ${this.year}`
      : 'Browse posts by date';

    const totalPosts = this.year && this.month
      ? this.totalPosts
      : this.getTotalPosts();

    this.headerContainer.innerHTML = `
      <div class="archive-header">
        <div class="archive-header__breadcrumb">
          <a href="${this.baseUrl}/blog">Blog</a>
          <span>/</span>
          ${this.year && this.month
            ? `<a href="${this.baseUrl}/blog/archive">Archives</a><span>/</span><span>${this.monthNames[this.month - 1]} ${this.year}</span>`
            : '<span>Archives</span>'
          }
        </div>
        <h1 class="archive-header__title">
          <svg class="archive-header__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          ${title}
        </h1>
        <p class="archive-header__description">${description}</p>
        <div class="archive-header__meta">
          <span class="archive-header__count">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            ${totalPosts} posts
          </span>
        </div>
      </div>
    `;
  }

  renderArchiveNav() {
    if (!this.archiveNavContainer) return;

    if (this.archives.length === 0) {
      this.archiveNavContainer.innerHTML = `
        <div class="blog-empty">
          <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <h3 class="blog-empty__title">No archives yet</h3>
          <p class="blog-empty__text">Posts will appear here once published.</p>
        </div>
      `;
      return;
    }

    const grouped = this.groupByYear();
    let timelineHtml = '';

    grouped.forEach((months, year) => {
      const isExpanded = this.expandedYears.has(year) || (this.year === year);
      const yearTotal = months.reduce((sum, m) => sum + (m.post_count || 0), 0);

      const monthsHtml = months.map(m => {
        const isActive = this.year === year && this.month === m.month;
        return `
          <a href="${this.baseUrl}/blog/archive/${year}/${String(m.month).padStart(2, '0')}"
             class="archive-month ${isActive ? 'archive-month--active' : ''}">
            <span class="archive-month__name">${this.monthNames[m.month - 1]}</span>
            <span class="archive-month__count">${m.post_count || 0}</span>
          </a>
        `;
      }).join('');

      timelineHtml += `
        <div class="archive-year" data-year="${year}">
          <div class="archive-year__header" data-action="toggle">
            <span class="archive-year__label">${year}</span>
            <span class="archive-year__count">${yearTotal} posts</span>
            <svg class="archive-year__toggle ${isExpanded ? 'archive-year__toggle--expanded' : ''}"
                 xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="archive-year__months ${isExpanded ? 'archive-year__months--expanded' : ''}">
            <div class="archive-months">${monthsHtml}</div>
          </div>
        </div>
      `;
    });

    this.archiveNavContainer.innerHTML = `
      <nav class="archive-nav" aria-label="Archive navigation">
        <h2 class="archive-nav__title">Browse by Date</h2>
        <div class="archive-timeline">${timelineHtml}</div>
      </nav>
    `;

    this.bindNavEvents();
  }

  bindNavEvents() {
    if (!this.archiveNavContainer) return;

    this.archiveNavContainer.querySelectorAll('[data-action="toggle"]').forEach(header => {
      header.addEventListener('click', () => {
        const yearEl = header.closest('.archive-year');
        const year = parseInt(yearEl.dataset.year, 10);
        this.toggleYear(year);
      });
    });
  }

  toggleYear(year) {
    if (this.expandedYears.has(year)) {
      this.expandedYears.delete(year);
    } else {
      this.expandedYears.add(year);
    }
    this.renderArchiveNav();
  }

  renderPosts() {
    if (!this.postsContainer) return;

    if (this.posts.length === 0) {
      this.renderPostsEmpty();
      return;
    }

    const postsHtml = this.posts
      .map(post => this.renderPostCard(post))
      .join('');

    this.postsContainer.innerHTML = `
      <section class="archive-posts">
        <div class="archive-posts__header">
          <h2 class="archive-posts__title">Posts from ${this.monthNames[this.month - 1]} ${this.year}</h2>
          <a href="${this.baseUrl}/blog/archive" class="archive-posts__back">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Back to all archives
          </a>
        </div>
        <div class="posts-grid">${postsHtml}</div>
      </section>
    `;
  }

  renderPostCard(post) {
    const imageHtml = post.featured_image_url
      ? `<img src="${this.escapeHtml(post.featured_image_url)}" alt="${this.escapeHtml(post.title)}" loading="lazy">`
      : `<div class="post-card__image-placeholder">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>`;

    const dateFormatted = this.formatDate(post.published_at || post.created_at);

    return `
      <article class="post-card">
        <a href="${this.baseUrl}/blog/${post.slug}" class="post-card__image">
          ${imageHtml}
        </a>
        <div class="post-card__content">
          <h3 class="post-card__title">
            <a href="${this.baseUrl}/blog/${post.slug}">${this.escapeHtml(post.title)}</a>
          </h3>
          <p class="post-card__excerpt">${this.escapeHtml(post.excerpt || '')}</p>
          <div class="post-card__meta">
            <div class="post-card__date">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <time datetime="${post.published_at || post.created_at}">${dateFormatted}</time>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  showLoading() {
    if (this.archiveNavContainer) {
      this.archiveNavContainer.innerHTML = `
        <div class="blog-loading">
          <div class="blog-loading__spinner"></div>
          <p class="blog-loading__text">Loading archives...</p>
        </div>
      `;
    }
  }

  renderPostsEmpty() {
    if (!this.postsContainer) return;
    this.postsContainer.innerHTML = `
      <div class="blog-empty">
        <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <h3 class="blog-empty__title">No posts found</h3>
        <p class="blog-empty__text">No posts were published in this period.</p>
      </div>
    `;
  }

  showError(message) {
    if (this.archiveNavContainer) {
      this.archiveNavContainer.innerHTML = `
        <div class="blog-empty">
          <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <h3 class="blog-empty__title">Error</h3>
          <p class="blog-empty__text">${this.escapeHtml(message)}</p>
        </div>
      `;
    }
  }

  handleSearch(query) {
    window.location.href = `${this.baseUrl}/blog/search?q=${encodeURIComponent(query)}`;
  }

  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
