/**
 * BlogPostPage Controller
 *
 * Single post view with:
 * - Full article content
 * - Author bio
 * - Related posts
 * - Share buttons
 * - Post navigation (prev/next)
 */

import { TagCloud } from '../../BLOG_HOME/src/widgets/TagCloud.js';
import { ArchiveWidget } from '../../BLOG_HOME/src/widgets/ArchiveWidget.js';
import { SearchBox } from '../../BLOG_HOME/src/widgets/SearchBox.js';

export class BlogPostPage {
  /**
   * @param {Object} options
   */
  constructor(options) {
    this.baseUrl = options.baseUrl || '';
    this.postSlug = options.postSlug || '';
    this.articleContainer = options.articleContainer;
    this.relatedContainer = options.relatedContainer;
    this.tagCloudContainer = options.tagCloudContainer;
    this.archiveContainer = options.archiveContainer;
    this.searchContainer = options.searchContainer;
    this.showToast = options.showToast || (() => {});

    this.post = null;
    this.relatedPosts = [];
    this.isLoading = false;

    this.tagCloud = null;
    this.archiveWidget = null;
    this.searchBox = null;

    this.init();
  }

  async init() {
    this.initWidgets();
    await this.loadData();
  }

  initWidgets() {
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

  async loadData() {
    this.showLoading();

    try {
      await Promise.all([
        this.loadPost(),
        this.loadTags(),
        this.loadArchives()
      ]);

      if (this.post) {
        await this.loadRelatedPosts();
      }
    } catch (error) {
      console.error('BlogPostPage: Error loading data:', error);
      this.showError('Post not found', 'The post you are looking for does not exist.');
    }
  }

  async loadPost() {
    const response = await fetch(`${this.baseUrl}/api/v1/blog/posts/${this.postSlug}`);

    if (!response.ok) {
      throw new Error('Post not found');
    }

    const data = await response.json();
    this.post = data.post;
    this.renderArticle();
  }

  async loadRelatedPosts() {
    if (!this.relatedContainer || !this.post) return;

    try {
      const params = new URLSearchParams({
        limit: '3',
        exclude: this.post.id.toString(),
        category: this.post.category?.slug || ''
      });

      const response = await fetch(`${this.baseUrl}/api/v1/blog/posts/related?${params}`);

      if (response.ok) {
        const data = await response.json();
        this.relatedPosts = data.posts || [];
        this.renderRelatedPosts();
      }
    } catch (error) {
      console.error('Error loading related posts:', error);
    }
  }

  async loadTags() {
    if (!this.tagCloud) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/blog/tags?limit=20`);
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

  renderArticle() {
    if (!this.articleContainer || !this.post) return;

    const post = this.post;
    const dateFormatted = this.formatDate(post.published_at || post.created_at);
    const readTime = post.read_time_minutes || this.estimateReadTime(post.content);

    // Featured image
    const featuredImageHtml = post.featured_image_url
      ? `<img src="${this.escapeHtml(post.featured_image_url)}" alt="${this.escapeHtml(post.title)}" class="article__featured-image">`
      : '';

    // Category
    const categoryHtml = post.category
      ? `<a href="${this.baseUrl}/blog/category/${post.category.slug}" class="article__category">${this.escapeHtml(post.category.name)}</a>`
      : '';

    // Author
    const authorHtml = post.author
      ? `
        <div class="article__author">
          ${post.author.avatar_url ? `<img src="${this.escapeHtml(post.author.avatar_url)}" alt="${this.escapeHtml(post.author.display_name || '')}">` : ''}
          <div class="article__author-info">
            <span class="article__author-name">${this.escapeHtml(post.author.display_name || post.author.first_name || 'Anonymous')}</span>
          </div>
        </div>
      `
      : '';

    // Tags
    const tagsHtml = post.tags && post.tags.length > 0
      ? `
        <div class="article__tags">
          <span class="article__tags-label">Tags:</span>
          ${post.tags.map(tag => `
            <a href="${this.baseUrl}/blog/tag/${tag.slug}" class="article__tag">#${this.escapeHtml(tag.name)}</a>
          `).join('')}
        </div>
      `
      : '';

    // Share buttons
    const shareUrl = encodeURIComponent(window.location.href);
    const shareTitle = encodeURIComponent(post.title);

    this.articleContainer.innerHTML = `
      <article class="article">
        ${featuredImageHtml}
        <header class="article__header">
          <div class="article__breadcrumb">
            <a href="${this.baseUrl}/blog">Blog</a>
            <span>/</span>
            ${post.category ? `<a href="${this.baseUrl}/blog/category/${post.category.slug}">${this.escapeHtml(post.category.name)}</a><span>/</span>` : ''}
            <span>${this.escapeHtml(this.truncateText(post.title, 30))}</span>
          </div>
          ${categoryHtml}
          <h1 class="article__title">${this.escapeHtml(post.title)}</h1>
          <div class="article__meta">
            ${authorHtml}
            <div class="article__date">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <time datetime="${post.published_at || post.created_at}">${dateFormatted}</time>
            </div>
            <div class="article__read-time">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>${readTime} min read</span>
            </div>
          </div>
        </header>

        <div class="article__content">
          ${post.content}
        </div>

        <footer class="article__footer">
          ${tagsHtml}
          <div class="article__share">
            <span class="article__share-label">Share:</span>
            <a href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}" target="_blank" rel="noopener noreferrer" class="article__share-btn" title="Share on Twitter">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
              </svg>
            </a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener noreferrer" class="article__share-btn" title="Share on Facebook">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </a>
            <a href="https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}&title=${shareTitle}" target="_blank" rel="noopener noreferrer" class="article__share-btn" title="Share on LinkedIn">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                <rect x="2" y="9" width="4" height="12"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            </a>
          </div>
        </footer>
      </article>

      ${this.renderAuthorBio()}
      ${this.renderPostNavigation()}
    `;
  }

  renderAuthorBio() {
    if (!this.post?.author?.bio) return '';

    const author = this.post.author;
    return `
      <div class="author-bio">
        ${author.avatar_url ? `<img src="${this.escapeHtml(author.avatar_url)}" alt="" class="author-bio__avatar">` : ''}
        <div class="author-bio__content">
          <h3 class="author-bio__name">${this.escapeHtml(author.display_name || author.first_name || 'Anonymous')}</h3>
          <p class="author-bio__bio">${this.escapeHtml(author.bio)}</p>
        </div>
      </div>
    `;
  }

  renderPostNavigation() {
    const prev = this.post?.previous_post;
    const next = this.post?.next_post;

    if (!prev && !next) return '';

    return `
      <nav class="post-navigation">
        ${prev ? `
          <a href="${this.baseUrl}/blog/${prev.slug}" class="post-navigation__link post-navigation__link--prev">
            <span class="post-navigation__label">Previous</span>
            <span class="post-navigation__title">${this.escapeHtml(prev.title)}</span>
          </a>
        ` : '<div></div>'}
        ${next ? `
          <a href="${this.baseUrl}/blog/${next.slug}" class="post-navigation__link post-navigation__link--next">
            <span class="post-navigation__label">Next</span>
            <span class="post-navigation__title">${this.escapeHtml(next.title)}</span>
          </a>
        ` : '<div></div>'}
      </nav>
    `;
  }

  renderRelatedPosts() {
    if (!this.relatedContainer || this.relatedPosts.length === 0) return;

    const postsHtml = this.relatedPosts
      .map(post => this.renderRelatedPostCard(post))
      .join('');

    this.relatedContainer.innerHTML = `
      <section class="related-posts">
        <h2 class="related-posts__title">Related Posts</h2>
        <div class="related-posts__grid">
          ${postsHtml}
        </div>
      </section>
    `;
  }

  renderRelatedPostCard(post) {
    const imageHtml = post.featured_image_url
      ? `<img src="${this.escapeHtml(post.featured_image_url)}" alt="${this.escapeHtml(post.title)}" loading="lazy">`
      : `<div class="post-card__image-placeholder">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>`;

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
        </div>
      </article>
    `;
  }

  showLoading() {
    if (!this.articleContainer) return;
    this.articleContainer.innerHTML = `
      <div class="blog-loading">
        <div class="blog-loading__spinner"></div>
        <p class="blog-loading__text">Loading post...</p>
      </div>
    `;
  }

  showError(title, message) {
    if (!this.articleContainer) return;
    this.articleContainer.innerHTML = `
      <div class="blog-error">
        <svg class="blog-error__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h2 class="blog-error__title">${this.escapeHtml(title)}</h2>
        <p class="blog-error__text">${this.escapeHtml(message)}</p>
        <a href="${this.baseUrl}/blog" class="blog-error__btn">Back to Blog</a>
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
      month: 'long',
      day: 'numeric'
    });
  }

  estimateReadTime(content) {
    if (!content) return 1;
    const text = content.replace(/<[^>]*>/g, '');
    const words = text.split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
