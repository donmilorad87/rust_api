/**
 * BlogHomePage Controller
 *
 * Main controller for the blog homepage.
 * Handles:
 * - Loading and displaying posts grid
 * - Sidebar widgets (tag cloud, archive, search)
 * - Pagination
 * - Featured posts section
 */

import { Pagination } from './widgets/Pagination.js';
import { TagCloud } from './widgets/TagCloud.js';
import { ArchiveWidget } from './widgets/ArchiveWidget.js';
import { SearchBox } from './widgets/SearchBox.js';

export class BlogHomePage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {HTMLElement} options.postsContainer - Container for posts grid
   * @param {HTMLElement} options.paginationContainer - Container for pagination
   * @param {HTMLElement} options.tagCloudContainer - Container for tag cloud widget
   * @param {HTMLElement} options.archiveContainer - Container for archive widget
   * @param {HTMLElement} options.searchContainer - Container for search widget
   * @param {HTMLElement} options.featuredContainer - Container for featured posts
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl || '';
    this.postsContainer = options.postsContainer;
    this.paginationContainer = options.paginationContainer;
    this.tagCloudContainer = options.tagCloudContainer;
    this.archiveContainer = options.archiveContainer;
    this.searchContainer = options.searchContainer;
    this.featuredContainer = options.featuredContainer;
    this.showToast = options.showToast || (() => {});

    // State
    this.currentPage = 1;
    this.postsPerPage = 9;
    this.totalPosts = 0;
    this.posts = [];
    this.featuredPosts = [];
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
   * Initialize sidebar widgets
   */
  initWidgets() {
    // Pagination
    if (this.paginationContainer) {
      this.pagination = new Pagination(this.paginationContainer, {
        currentPage: this.currentPage,
        totalPages: 1,
        onPageChange: (page) => this.loadPosts(page)
      });
    }

    // Search box
    if (this.searchContainer) {
      this.searchBox = new SearchBox(this.searchContainer, {
        baseUrl: this.baseUrl,
        placeholder: 'Search posts...',
        onSearch: (query) => this.handleSearch(query),
        onSuggestionClick: (post) => this.navigateToPost(post)
      });
    }

    // Tag cloud (will be populated after API call)
    if (this.tagCloudContainer) {
      this.tagCloud = new TagCloud(this.tagCloudContainer, {
        tags: [],
        baseUrl: this.baseUrl
      });
    }

    // Archive widget (will be populated after API call)
    if (this.archiveContainer) {
      this.archiveWidget = new ArchiveWidget(this.archiveContainer, {
        archives: [],
        baseUrl: this.baseUrl
      });
    }
  }

  /**
   * Load initial page data
   */
  async loadInitialData() {
    this.showLoading();

    try {
      // Load all data in parallel
      await Promise.all([
        this.loadPosts(1),
        this.loadFeaturedPosts(),
        this.loadTags(),
        this.loadArchives()
      ]);
    } catch (error) {
      console.error('BlogHomePage: Error loading initial data:', error);
      this.showError('Failed to load blog data. Please try again.');
    }
  }

  /**
   * Load posts for a specific page
   * @param {number} page
   */
  async loadPosts(page = 1) {
    this.currentPage = page;
    this.isLoading = true;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: this.postsPerPage.toString(),
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

      // Update pagination
      if (this.pagination) {
        const totalPages = Math.ceil(this.totalPosts / this.postsPerPage);
        this.pagination.update(this.currentPage, totalPages);
      }
    } catch (error) {
      console.error('BlogHomePage: Error loading posts:', error);
      this.showToast('Failed to load posts', 'error');
      this.renderEmpty();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Load featured posts
   */
  async loadFeaturedPosts() {
    if (!this.featuredContainer) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/blog/posts/featured?limit=2`);

      if (!response.ok) {
        throw new Error('Failed to load featured posts');
      }

      const data = await response.json();
      this.featuredPosts = data.posts || [];
      this.renderFeaturedPosts();
    } catch (error) {
      console.error('BlogHomePage: Error loading featured posts:', error);
      // Don't show error, just hide featured section
      this.featuredContainer.style.display = 'none';
    }
  }

  /**
   * Load tags for tag cloud
   */
  async loadTags() {
    if (!this.tagCloud) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/blog/tags?limit=30`);

      if (!response.ok) {
        throw new Error('Failed to load tags');
      }

      const data = await response.json();
      this.tagCloud.update(data.tags || []);
    } catch (error) {
      console.error('BlogHomePage: Error loading tags:', error);
    }
  }

  /**
   * Load archives for archive widget
   */
  async loadArchives() {
    if (!this.archiveWidget) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/blog/archives`);

      if (!response.ok) {
        throw new Error('Failed to load archives');
      }

      const data = await response.json();
      this.archiveWidget.update(data.archives || []);
    } catch (error) {
      console.error('BlogHomePage: Error loading archives:', error);
    }
  }

  /**
   * Render posts grid
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
   * Render featured posts
   */
  renderFeaturedPosts() {
    if (!this.featuredContainer) return;

    if (this.featuredPosts.length === 0) {
      this.featuredContainer.style.display = 'none';
      return;
    }

    const postsHtml = this.featuredPosts
      .map(post => this.renderPostCard(post, true))
      .join('');

    this.featuredContainer.innerHTML = `
      <section class="featured-posts">
        <h2 class="section-title">Featured Posts</h2>
        <div class="posts-grid">
          ${postsHtml}
        </div>
      </section>
    `;
  }

  /**
   * Render a single post card
   * @param {Object} post
   * @param {boolean} isFeatured
   * @returns {string}
   */
  renderPostCard(post, isFeatured = false) {
    const imageHtml = post.featured_image_url
      ? `<img src="${this.escapeHtml(post.featured_image_url)}" alt="${this.escapeHtml(post.title)}" loading="lazy">`
      : `
        <div class="post-card__image-placeholder">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>
      `;

    const categoryHtml = post.category
      ? `<a href="${this.baseUrl}/blog/category/${post.category.slug}" class="post-card__category">${this.escapeHtml(post.category.name)}</a>`
      : '';

    const tagsHtml = post.tags && post.tags.length > 0
      ? `
        <div class="post-card__tags">
          ${post.tags.slice(0, 3).map(tag => `
            <a href="${this.baseUrl}/blog/tag/${tag.slug}" class="post-card__tag">${this.escapeHtml(tag.name)}</a>
          `).join('')}
        </div>
      `
      : '';

    const dateFormatted = this.formatDate(post.published_at || post.created_at);
    const readTime = post.read_time_minutes || this.estimateReadTime(post.content);

    return `
      <article class="post-card ${isFeatured ? 'post-card--featured' : ''}">
        <a href="${this.baseUrl}/blog/${post.slug}" class="post-card__image">
          ${imageHtml}
        </a>
        <div class="post-card__content">
          ${categoryHtml}
          <h3 class="post-card__title">
            <a href="${this.baseUrl}/blog/${post.slug}">${this.escapeHtml(post.title)}</a>
          </h3>
          <p class="post-card__excerpt">${this.escapeHtml(post.excerpt || this.truncateText(post.content, 150))}</p>
          ${tagsHtml}
          <div class="post-card__meta">
            ${post.author ? `
              <div class="post-card__author">
                ${post.author.avatar_url ? `<img src="${this.escapeHtml(post.author.avatar_url)}" alt="" class="post-card__author-avatar">` : ''}
                <span>${this.escapeHtml(post.author.display_name || post.author.first_name || 'Anonymous')}</span>
              </div>
            ` : ''}
            <div class="post-card__date">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <time datetime="${post.published_at || post.created_at}">${dateFormatted}</time>
            </div>
            <div class="post-card__read-time">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>${readTime} min read</span>
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
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <h3 class="blog-empty__title">No posts yet</h3>
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
      <div class="blog-error">
        <svg class="blog-error__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3 class="blog-error__title">Something went wrong</h3>
        <p class="blog-error__text">${this.escapeHtml(message)}</p>
        <button class="blog-error__btn" data-action="retry">Try Again</button>
      </div>
    `;

    // Bind retry button
    this.postsContainer.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      this.loadInitialData();
    });
  }

  /**
   * Handle search
   * @param {string} query
   */
  handleSearch(query) {
    window.location.href = `${this.baseUrl}/blog/search?q=${encodeURIComponent(query)}`;
  }

  /**
   * Navigate to a post
   * @param {Object} post
   */
  navigateToPost(post) {
    if (post.slug) {
      window.location.href = `${this.baseUrl}/blog/${post.slug}`;
    }
  }

  /**
   * Format date for display
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
   * Estimate read time based on content
   * @param {string} content
   * @returns {number}
   */
  estimateReadTime(content) {
    if (!content) return 1;

    // Strip HTML tags if present
    const text = content.replace(/<[^>]*>/g, '');
    // Average reading speed: 200 words per minute
    const words = text.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  /**
   * Truncate text to specified length
   * @param {string} text
   * @param {number} maxLength
   * @returns {string}
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    // Strip HTML
    const stripped = text.replace(/<[^>]*>/g, '');
    if (stripped.length <= maxLength) return stripped;
    return stripped.substring(0, maxLength).trim() + '...';
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
