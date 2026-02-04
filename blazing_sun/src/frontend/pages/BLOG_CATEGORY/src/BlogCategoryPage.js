/**
 * BlogCategoryPage Controller
 *
 * Displays posts within a specific category.
 * Handles:
 * - Loading category info and posts
 * - Subcategories listing
 * - Pagination
 */

// Import shared widgets from BLOG_HOME
import { Pagination } from '../../BLOG_HOME/src/widgets/Pagination.js';
import { TagCloud } from '../../BLOG_HOME/src/widgets/TagCloud.js';
import { ArchiveWidget } from '../../BLOG_HOME/src/widgets/ArchiveWidget.js';
import { SearchBox } from '../../BLOG_HOME/src/widgets/SearchBox.js';

export class BlogCategoryPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {string} options.categorySlug - Category slug from URL
   * @param {HTMLElement} options.headerContainer - Container for category header
   * @param {HTMLElement} options.postsContainer - Container for posts grid
   * @param {HTMLElement} options.paginationContainer - Container for pagination
   * @param {HTMLElement} options.tagCloudContainer - Container for tag cloud widget
   * @param {HTMLElement} options.archiveContainer - Container for archive widget
   * @param {HTMLElement} options.searchContainer - Container for search widget
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl || '';
    this.categorySlug = options.categorySlug || '';
    this.headerContainer = options.headerContainer;
    this.postsContainer = options.postsContainer;
    this.paginationContainer = options.paginationContainer;
    this.tagCloudContainer = options.tagCloudContainer;
    this.archiveContainer = options.archiveContainer;
    this.searchContainer = options.searchContainer;
    this.showToast = options.showToast || (() => {});

    // State
    this.category = null;
    this.posts = [];
    this.currentPage = 1;
    this.postsPerPage = 9;
    this.totalPosts = 0;
    this.isLoading = false;

    // Widgets
    this.pagination = null;
    this.tagCloud = null;
    this.archiveWidget = null;
    this.searchBox = null;

    this.init();
  }

  /**
   * Initialize the page
   */
  async init() {
    this.initWidgets();
    await this.loadInitialData();
  }

  /**
   * Initialize widgets
   */
  initWidgets() {
    if (this.paginationContainer) {
      this.pagination = new Pagination(this.paginationContainer, {
        currentPage: this.currentPage,
        totalPages: 1,
        onPageChange: (page) => this.loadPosts(page)
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

    if (this.archiveContainer) {
      this.archiveWidget = new ArchiveWidget(this.archiveContainer, {
        archives: [],
        baseUrl: this.baseUrl
      });
    }
  }

  /**
   * Load initial data
   */
  async loadInitialData() {
    this.showLoading();

    try {
      await Promise.all([
        this.loadCategory(),
        this.loadTags(),
        this.loadArchives()
      ]);

      if (this.category) {
        await this.loadPosts(1);
      }
    } catch (error) {
      console.error('BlogCategoryPage: Error loading data:', error);
      this.showError('Failed to load category data');
    }
  }

  /**
   * Load category info
   */
  async loadCategory() {
    const response = await fetch(`${this.baseUrl}/api/v1/blog/categories/${this.categorySlug}`);

    if (!response.ok) {
      throw new Error('Category not found');
    }

    const data = await response.json();
    this.category = data.category;
    this.renderHeader();
  }

  /**
   * Load posts for category
   * @param {number} page
   */
  async loadPosts(page = 1) {
    this.currentPage = page;
    this.isLoading = true;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: this.postsPerPage.toString(),
        category: this.categorySlug,
        status: 'published'
      });

      const response = await fetch(`${this.baseUrl}/api/v1/blog/posts?${params}`);

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
      console.error('BlogCategoryPage: Error loading posts:', error);
      this.showToast('Failed to load posts', 'error');
      this.renderEmpty();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load tags
   */
  async loadTags() {
    if (!this.tagCloud) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/blog/tags?limit=30`);
      if (response.ok) {
        const data = await response.json();
        this.tagCloud.update(data.tags || []);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }

  /**
   * Load archives
   */
  async loadArchives() {
    if (!this.archiveWidget) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/blog/archives`);
      if (response.ok) {
        const data = await response.json();
        this.archiveWidget.update(data.archives || []);
      }
    } catch (error) {
      console.error('Error loading archives:', error);
    }
  }

  /**
   * Render category header
   */
  renderHeader() {
    if (!this.headerContainer || !this.category) return;

    const subcategoriesHtml = this.category.subcategories && this.category.subcategories.length > 0
      ? `
        <div class="subcategories">
          <span class="subcategories__title">Subcategories:</span>
          ${this.category.subcategories.map(sub => `
            <a href="${this.baseUrl}/blog/category/${sub.slug}" class="subcategories__link">
              ${this.escapeHtml(sub.name)}
            </a>
          `).join('')}
        </div>
      `
      : '';

    this.headerContainer.innerHTML = `
      <div class="category-header">
        <div class="category-header__breadcrumb">
          <a href="${this.baseUrl}/blog">Blog</a>
          <span>/</span>
          <span>${this.escapeHtml(this.category.name)}</span>
        </div>
        <h1 class="category-header__title">
          <svg class="category-header__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          ${this.escapeHtml(this.category.name)}
        </h1>
        ${this.category.description ? `<p class="category-header__description">${this.escapeHtml(this.category.description)}</p>` : ''}
        <div class="category-header__meta">
          <span class="category-header__count">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            ${this.category.post_count || 0} posts
          </span>
        </div>
        ${subcategoriesHtml}
      </div>
    `;
  }

  /**
   * Render posts
   */
  renderPosts() {
    if (!this.postsContainer) return;

    if (this.posts.length === 0) {
      this.renderEmpty();
      return;
    }

    const postsHtml = this.posts
      .map(post => this.renderPostCard(post))
      .join('');

    this.postsContainer.innerHTML = `
      <div class="posts-grid">
        ${postsHtml}
      </div>
    `;
  }

  /**
   * Render post card
   * @param {Object} post
   * @returns {string}
   */
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

  /**
   * Show loading state
   */
  showLoading() {
    if (!this.postsContainer) return;

    this.postsContainer.innerHTML = `
      <div class="blog-loading">
        <div class="blog-loading__spinner"></div>
        <p class="blog-loading__text">Loading posts...</p>
      </div>
    `;
  }

  /**
   * Render empty state
   */
  renderEmpty() {
    if (!this.postsContainer) return;

    this.postsContainer.innerHTML = `
      <div class="blog-empty">
        <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <h3 class="blog-empty__title">No posts in this category</h3>
        <p class="blog-empty__text">Check back later for new content.</p>
      </div>
    `;
  }

  /**
   * Show error state
   * @param {string} message
   */
  showError(message) {
    if (!this.postsContainer) return;

    this.postsContainer.innerHTML = `
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

  /**
   * Handle search
   * @param {string} query
   */
  handleSearch(query) {
    window.location.href = `${this.baseUrl}/blog/search?q=${encodeURIComponent(query)}`;
  }

  /**
   * Format date
   * @param {string} dateString
   * @returns {string}
   */
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Escape HTML
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
