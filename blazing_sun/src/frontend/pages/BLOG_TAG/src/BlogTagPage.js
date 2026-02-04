/**
 * BlogTagPage Controller
 *
 * Displays posts with a specific tag.
 */

import { Pagination } from '../../BLOG_HOME/src/widgets/Pagination.js';
import { TagCloud } from '../../BLOG_HOME/src/widgets/TagCloud.js';
import { ArchiveWidget } from '../../BLOG_HOME/src/widgets/ArchiveWidget.js';
import { SearchBox } from '../../BLOG_HOME/src/widgets/SearchBox.js';

export class BlogTagPage {
  /**
   * @param {Object} options
   */
  constructor(options) {
    this.baseUrl = options.baseUrl || '';
    this.tagSlug = options.tagSlug || '';
    this.headerContainer = options.headerContainer;
    this.postsContainer = options.postsContainer;
    this.paginationContainer = options.paginationContainer;
    this.tagCloudContainer = options.tagCloudContainer;
    this.archiveContainer = options.archiveContainer;
    this.searchContainer = options.searchContainer;
    this.showToast = options.showToast || (() => {});

    this.tag = null;
    this.posts = [];
    this.relatedTags = [];
    this.currentPage = 1;
    this.postsPerPage = 9;
    this.totalPosts = 0;
    this.isLoading = false;

    this.pagination = null;
    this.tagCloud = null;
    this.archiveWidget = null;
    this.searchBox = null;

    this.init();
  }

  async init() {
    this.initWidgets();
    await this.loadInitialData();
  }

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

  async loadInitialData() {
    this.showLoading();

    try {
      await Promise.all([
        this.loadTag(),
        this.loadTags(),
        this.loadArchives()
      ]);

      if (this.tag) {
        await this.loadPosts(1);
      }
    } catch (error) {
      console.error('BlogTagPage: Error loading data:', error);
      this.showError('Failed to load tag data');
    }
  }

  async loadTag() {
    const response = await fetch(`${this.baseUrl}/api/v1/blog/tags/${this.tagSlug}`);

    if (!response.ok) {
      throw new Error('Tag not found');
    }

    const data = await response.json();
    this.tag = data.tag;
    this.relatedTags = data.related_tags || [];
    this.renderHeader();
  }

  async loadPosts(page = 1) {
    this.currentPage = page;
    this.isLoading = true;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: this.postsPerPage.toString(),
        tag: this.tagSlug,
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
      console.error('BlogTagPage: Error loading posts:', error);
      this.showToast('Failed to load posts', 'error');
      this.renderEmpty();
    } finally {
      this.isLoading = false;
    }
  }

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

  renderHeader() {
    if (!this.headerContainer || !this.tag) return;

    const relatedHtml = this.relatedTags.length > 0
      ? `
        <div class="related-tags">
          <span class="related-tags__title">Related tags:</span>
          <div class="related-tags__list">
            ${this.relatedTags.map(tag => `
              <a href="${this.baseUrl}/blog/tag/${tag.slug}" class="related-tags__link">
                ${this.escapeHtml(tag.name)}
              </a>
            `).join('')}
          </div>
        </div>
      `
      : '';

    this.headerContainer.innerHTML = `
      <div class="tag-header">
        <div class="tag-header__breadcrumb">
          <a href="${this.baseUrl}/blog">Blog</a>
          <span>/</span>
          <a href="${this.baseUrl}/blog/tags">Tags</a>
          <span>/</span>
          <span>${this.escapeHtml(this.tag.name)}</span>
        </div>
        <h1 class="tag-header__title">
          <svg class="tag-header__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <span class="tag-header__badge">#${this.escapeHtml(this.tag.name)}</span>
        </h1>
        ${this.tag.description ? `<p class="tag-header__description">${this.escapeHtml(this.tag.description)}</p>` : ''}
        <div class="tag-header__meta">
          <span class="tag-header__count">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            ${this.tag.post_count || 0} posts
          </span>
        </div>
        ${relatedHtml}
      </div>
    `;
  }

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
    if (!this.postsContainer) return;
    this.postsContainer.innerHTML = `
      <div class="blog-loading">
        <div class="blog-loading__spinner"></div>
        <p class="blog-loading__text">Loading posts...</p>
      </div>
    `;
  }

  renderEmpty() {
    if (!this.postsContainer) return;
    this.postsContainer.innerHTML = `
      <div class="blog-empty">
        <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
        <h3 class="blog-empty__title">No posts with this tag</h3>
        <p class="blog-empty__text">Check back later for new content.</p>
      </div>
    `;
  }

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
