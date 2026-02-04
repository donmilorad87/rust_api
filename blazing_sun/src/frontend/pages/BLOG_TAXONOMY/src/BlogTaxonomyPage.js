/**
 * BlogTaxonomyPage Controller
 *
 * Lists all categories and tags.
 */

import { SearchBox } from '../../BLOG_HOME/src/widgets/SearchBox.js';

export class BlogTaxonomyPage {
  /**
   * @param {Object} options
   */
  constructor(options) {
    this.baseUrl = options.baseUrl || '';
    this.categoriesContainer = options.categoriesContainer;
    this.tagsContainer = options.tagsContainer;
    this.searchContainer = options.searchContainer;
    this.showToast = options.showToast || (() => {});

    this.categories = [];
    this.tags = [];
    this.isLoading = false;

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
  }

  async loadData() {
    this.showLoading();

    try {
      await Promise.all([
        this.loadCategories(),
        this.loadTags()
      ]);
    } catch (error) {
      console.error('BlogTaxonomyPage: Error loading data:', error);
      this.showError('Failed to load taxonomy data');
    }
  }

  async loadCategories() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/blog/categories`);

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const data = await response.json();
      this.categories = data.categories || [];
      this.renderCategories();
    } catch (error) {
      console.error('Error loading categories:', error);
      this.renderCategoriesError();
    }
  }

  async loadTags() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/blog/tags?limit=100`);

      if (!response.ok) {
        throw new Error('Failed to load tags');
      }

      const data = await response.json();
      this.tags = data.tags || [];
      this.renderTags();
    } catch (error) {
      console.error('Error loading tags:', error);
      this.renderTagsError();
    }
  }

  renderCategories() {
    if (!this.categoriesContainer) return;

    if (this.categories.length === 0) {
      this.categoriesContainer.innerHTML = `
        <div class="blog-empty">
          <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          <h3 class="blog-empty__title">No categories yet</h3>
          <p class="blog-empty__text">Categories will appear here once created.</p>
        </div>
      `;
      return;
    }

    const cardsHtml = this.categories
      .map(category => this.renderCategoryCard(category))
      .join('');

    this.categoriesContainer.innerHTML = `
      <section class="taxonomy-section">
        <h2 class="taxonomy-section__title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          Categories
        </h2>
        <div class="categories-grid">
          ${cardsHtml}
        </div>
      </section>
    `;
  }

  renderCategoryCard(category) {
    return `
      <a href="${this.baseUrl}/blog/category/${category.slug}" class="category-card">
        <div class="category-card__icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h3 class="category-card__name">${this.escapeHtml(category.name)}</h3>
        ${category.description ? `<p class="category-card__description">${this.escapeHtml(category.description)}</p>` : ''}
        <div class="category-card__meta">
          <span class="category-card__count">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            ${category.post_count || 0} posts
          </span>
        </div>
      </a>
    `;
  }

  renderTags() {
    if (!this.tagsContainer) return;

    if (this.tags.length === 0) {
      this.tagsContainer.innerHTML = `
        <div class="blog-empty">
          <svg class="blog-empty__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          <h3 class="blog-empty__title">No tags yet</h3>
          <p class="blog-empty__text">Tags will appear here once created.</p>
        </div>
      `;
      return;
    }

    // Calculate size classes
    const counts = this.tags.map(t => t.post_count || 0);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts);

    const tagsHtml = this.tags
      .map(tag => {
        const sizeClass = this.getSizeClass(tag.post_count || 0, minCount, maxCount);
        return `
          <a href="${this.baseUrl}/blog/tag/${tag.slug}" class="tags-cloud-large__tag tags-cloud-large__tag--${sizeClass}">
            #${this.escapeHtml(tag.name)}
            <span class="tags-cloud-large__count">(${tag.post_count || 0})</span>
          </a>
        `;
      })
      .join('');

    this.tagsContainer.innerHTML = `
      <section class="taxonomy-section">
        <h2 class="taxonomy-section__title">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          Tags
        </h2>
        <div class="tags-cloud-large">
          ${tagsHtml}
        </div>
      </section>
    `;
  }

  getSizeClass(count, minCount, maxCount) {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'];
    if (maxCount === minCount) return 'md';
    const normalized = (count - minCount) / (maxCount - minCount);
    const index = Math.min(Math.floor(normalized * sizes.length), sizes.length - 1);
    return sizes[index];
  }

  showLoading() {
    const loadingHtml = `
      <div class="blog-loading">
        <div class="blog-loading__spinner"></div>
        <p class="blog-loading__text">Loading...</p>
      </div>
    `;

    if (this.categoriesContainer) {
      this.categoriesContainer.innerHTML = loadingHtml;
    }
    if (this.tagsContainer) {
      this.tagsContainer.innerHTML = '';
    }
  }

  renderCategoriesError() {
    if (!this.categoriesContainer) return;
    this.categoriesContainer.innerHTML = `
      <div class="blog-empty">
        <h3 class="blog-empty__title">Failed to load categories</h3>
      </div>
    `;
  }

  renderTagsError() {
    if (!this.tagsContainer) return;
    this.tagsContainer.innerHTML = `
      <div class="blog-empty">
        <h3 class="blog-empty__title">Failed to load tags</h3>
      </div>
    `;
  }

  showError(message) {
    if (this.categoriesContainer) {
      this.categoriesContainer.innerHTML = `
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

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
