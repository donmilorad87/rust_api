/**
 * BlogSearchPage Controller
 *
 * Handles client-side search functionality for blog posts.
 * Works with the existing server-rendered template.
 */

export class BlogSearchPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API calls
   * @param {string} options.query - Initial search query
   * @param {HTMLFormElement} options.searchForm - The search form element
   * @param {HTMLInputElement} options.searchInput - The search input element
   * @param {HTMLSelectElement} options.categorySelect - Category filter select element
   * @param {HTMLElement} options.resultsContainer - Container for search results
   * @param {HTMLElement} options.paginationContainer - Container for pagination
   * @param {HTMLElement} options.searchMetaContainer - Container for result count
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl || '';
    this.initialQuery = options.query || '';
    this.searchForm = options.searchForm;
    this.searchInput = options.searchInput;
    this.categorySelect = options.categorySelect;
    this.resultsContainer = options.resultsContainer;
    this.paginationContainer = options.paginationContainer;
    this.searchMetaContainer = options.searchMetaContainer;
    this.showToast = options.showToast || (() => {});

    this.query = this.initialQuery;
    this.category = options.category || '';
    this.results = [];
    this.currentPage = 1;
    this.resultsPerPage = 16;
    this.totalResults = 0;
    this.totalPages = 0;
    this.isLoading = false;

    // Debounce configuration
    this.debounceTimeout = null;
    this.debounceDelay = 300; // milliseconds
    this.minQueryLength = 2; // minimum characters to trigger search

    this.init();
  }

  async init() {
    this.bindFormEvents();

    // If there's an initial query, perform search
    if (this.query) {
      await this.search(this.query, 1);
    }
  }

  bindFormEvents() {
    if (this.searchForm && this.searchInput) {
      // Form submit handler
      this.searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Clear any pending debounce
        if (this.debounceTimeout) {
          clearTimeout(this.debounceTimeout);
          this.debounceTimeout = null;
        }
        const newQuery = this.searchInput.value.trim();
        if (newQuery) {
          this.query = newQuery;
          this.category = this.categorySelect?.value || '';
          this.search(newQuery, 1);
          this.updateUrl();
        }
      });

      // Live search with debounce - triggers as user types
      this.searchInput.addEventListener('input', (e) => {
        const newQuery = e.target.value.trim();

        // Clear previous timeout
        if (this.debounceTimeout) {
          clearTimeout(this.debounceTimeout);
        }

        // If query is too short, show prompt or clear results
        if (newQuery.length < this.minQueryLength) {
          if (newQuery.length === 0) {
            this.renderSearchPrompt();
          }
          return;
        }

        // Debounce the search
        this.debounceTimeout = setTimeout(() => {
          this.query = newQuery;
          this.search(newQuery, 1);
          this.updateUrl();
        }, this.debounceDelay);
      });

      // Also handle paste events immediately
      this.searchInput.addEventListener('paste', (e) => {
        // Small delay to get the pasted value
        setTimeout(() => {
          const newQuery = this.searchInput.value.trim();
          if (newQuery.length >= this.minQueryLength) {
            if (this.debounceTimeout) {
              clearTimeout(this.debounceTimeout);
            }
            this.query = newQuery;
            this.search(newQuery, 1);
            this.updateUrl();
          }
        }, 10);
      });
    }

    // Category filter change handler
    if (this.categorySelect) {
      this.categorySelect.addEventListener('change', (e) => {
        this.category = e.target.value;
        // Re-search with new category if we have a query
        if (this.query && this.query.length >= this.minQueryLength) {
          this.search(this.query, 1);
          this.updateUrl();
        }
      });
    }
  }

  updateUrl() {
    const url = new URL(window.location);
    if (this.query) {
      url.searchParams.set('q', this.query);
    } else {
      url.searchParams.delete('q');
    }
    if (this.category) {
      url.searchParams.set('category', this.category);
    } else {
      url.searchParams.delete('category');
    }
    window.history.replaceState({}, '', url);
  }

  renderSearchPrompt() {
    if (!this.resultsContainer) return;
    this.resultsContainer.innerHTML = `
      <div class="search-prompt" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3>Enter a search term</h3>
        <p>Type at least ${this.minQueryLength} characters to search posts.</p>
      </div>
    `;
    if (this.paginationContainer) {
      this.paginationContainer.innerHTML = '';
    }
    if (this.searchMetaContainer) {
      this.searchMetaContainer.textContent = '';
    }
  }

  async search(query, page = 1) {
    if (!query || query.trim().length === 0) {
      return;
    }

    this.query = query.trim();
    this.currentPage = page;
    this.isLoading = true;
    this.showLoading();

    try {
      const params = new URLSearchParams({
        q: this.query,
        page: page.toString(),
        per_page: this.resultsPerPage.toString()
      });

      // Add category filter if selected
      if (this.category) {
        params.set('category', this.category);
      }

      const response = await fetch(`${this.baseUrl}/api/v1/blog/search?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 503) {
          // Elasticsearch not available
          this.renderSearchUnavailable();
          return;
        }
        throw new Error(errorData.message || 'Search failed');
      }

      const data = await response.json();

      // API returns 'results' not 'posts'
      this.results = data.results || [];
      this.totalResults = data.pagination?.total || 0;
      this.totalPages = data.pagination?.total_pages || Math.ceil(this.totalResults / this.resultsPerPage);
      this.currentPage = data.pagination?.page || page;

      this.updateSearchMeta();
      this.renderResults();
      this.renderPagination();

    } catch (error) {
      console.error('BlogSearchPage: Search error:', error);
      this.showToast('Search failed. Please try again.', 'error');
      this.renderError(error.message);
    } finally {
      this.isLoading = false;
    }
  }

  updateSearchMeta() {
    if (!this.searchMetaContainer) return;

    if (this.totalResults > 0) {
      this.searchMetaContainer.textContent = `Found ${this.totalResults} ${this.totalResults === 1 ? 'result' : 'results'}`;
    } else {
      this.searchMetaContainer.textContent = `No results found`;
    }
  }

  showLoading() {
    if (!this.resultsContainer) return;
    this.resultsContainer.innerHTML = `
      <div class="blog-loading" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <div class="blog-loading__spinner" style="
          width: 40px;
          height: 40px;
          border: 3px solid var(--border-color, #e5e7eb);
          border-top-color: var(--primary, #4f46e5);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 1rem;
        "></div>
        <p class="blog-loading__text">Searching...</p>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
  }

  renderResults() {
    if (!this.resultsContainer) return;

    if (this.results.length === 0) {
      this.renderEmpty();
      return;
    }

    const resultsHtml = this.results
      .map(post => this.renderResultItem(post))
      .join('');

    this.resultsContainer.innerHTML = resultsHtml;
  }

  renderResultItem(post) {
    // Use highlights from Elasticsearch if available
    const titleHtml = post.highlights?.title?.[0]
      ? post.highlights.title[0]
      : this.escapeHtml(post.title);

    const excerptHtml = post.highlights?.excerpt?.[0]
      ? post.highlights.excerpt[0]
      : (post.highlights?.content?.[0]
        ? post.highlights.content[0]
        : this.escapeHtml(post.excerpt || ''));

    // Get first category for display
    const category = post.categories?.[0];
    const categoryHtml = category
      ? `<span class="post-card__category">${this.escapeHtml(category.name)}</span>`
      : '';

    const dateFormatted = this.formatDate(post.published_at);

    // Relevance score as percentage (Elasticsearch scores vary, normalize to 0-100)
    const relevancePercent = Math.min(100, Math.round(post.score * 10));

    // Tags (show first 3)
    const tagsHtml = post.tags?.slice(0, 3).map(tag =>
      `<span class="post-card__tag">${this.escapeHtml(tag.name)}</span>`
    ).join('') || '';

    return `
      <article class="post-card post-card--horizontal" aria-label="Search result">
        <a href="/blog/${this.escapeHtml(post.slug)}" class="post-card__link">
          <div class="post-card__image post-card__image--placeholder">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="post-card__content">
            ${categoryHtml}
            <h3 class="post-card__title">${titleHtml}</h3>
            <p class="post-card__excerpt">${excerptHtml}</p>
            <div class="post-card__meta">
              <time datetime="${post.published_at || ''}">${dateFormatted}</time>
              <span class="post-card__relevance" title="Relevance score">
                ${relevancePercent}% match
              </span>
            </div>
            ${tagsHtml ? `<div class="post-card__tags">${tagsHtml}</div>` : ''}
          </div>
        </a>
      </article>
    `;
  }

  renderEmpty() {
    if (!this.resultsContainer) return;
    this.resultsContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
        <h3>No results found</h3>
        <p>We couldn't find any posts matching "<strong>${this.escapeHtml(this.query)}</strong>"</p>
        <div class="empty-state__suggestions">
          <p>Suggestions:</p>
          <ul>
            <li>Check your spelling</li>
            <li>Try more general terms</li>
            <li>Try different keywords</li>
          </ul>
        </div>
      </div>
    `;
    if (this.paginationContainer) {
      this.paginationContainer.innerHTML = '';
    }
  }

  renderSearchUnavailable() {
    if (!this.resultsContainer) return;
    this.resultsContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Search unavailable</h3>
        <p>Search is currently unavailable. Please try again later.</p>
      </div>
    `;
    if (this.paginationContainer) {
      this.paginationContainer.innerHTML = '';
    }
  }

  renderError(message) {
    if (!this.resultsContainer) return;
    this.resultsContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Search failed</h3>
        <p>${message || 'Something went wrong. Please try again.'}</p>
      </div>
    `;
    if (this.paginationContainer) {
      this.paginationContainer.innerHTML = '';
    }
  }

  renderPagination() {
    if (!this.paginationContainer) return;

    if (this.totalPages <= 1) {
      this.paginationContainer.innerHTML = '';
      return;
    }

    const pages = this.getPaginationRange();

    let html = `<ul class="pagination__list">`;

    // Previous button
    if (this.currentPage > 1) {
      html += `
        <li class="pagination__item">
          <button class="pagination__btn pagination__btn--prev" data-page="${this.currentPage - 1}" aria-label="Previous page">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </li>
      `;
    }

    // Page numbers
    pages.forEach(page => {
      if (page === '...') {
        html += `<li class="pagination__item"><span class="pagination__ellipsis">...</span></li>`;
      } else {
        const isActive = page === this.currentPage;
        html += `
          <li class="pagination__item">
            <button
              class="pagination__btn ${isActive ? 'pagination__btn--active' : ''}"
              data-page="${page}"
              ${isActive ? 'aria-current="page"' : ''}
            >
              ${page}
            </button>
          </li>
        `;
      }
    });

    // Next button
    if (this.currentPage < this.totalPages) {
      html += `
        <li class="pagination__item">
          <button class="pagination__btn pagination__btn--next" data-page="${this.currentPage + 1}" aria-label="Next page">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </li>
      `;
    }

    html += `</ul>`;
    this.paginationContainer.innerHTML = html;

    // Bind click events
    this.paginationContainer.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (page !== this.currentPage) {
          this.search(this.query, page);
          // Scroll to top of results
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  getPaginationRange() {
    const total = this.totalPages;
    const current = this.currentPage;
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    let prev = null;
    for (const i of range) {
      if (prev) {
        if (i - prev === 2) {
          rangeWithDots.push(prev + 1);
        } else if (i - prev !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      prev = i;
    }

    return rangeWithDots;
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
