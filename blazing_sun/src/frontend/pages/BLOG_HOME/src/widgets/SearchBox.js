/**
 * SearchBox Component
 *
 * Search input with live search results preview.
 * Fetches real search results as user types using debounce.
 *
 * Supports progressive enhancement:
 * - If container has an existing form/input, enhances it with live search
 * - If not, renders its own search form
 *
 * @example
 * const searchBox = new SearchBox(document.getElementById('searchWidget'), {
 *   baseUrl: '',
 *   placeholder: 'Search posts...',
 *   onSearch: (query) => performSearch(query),
 *   onSuggestionClick: (post) => navigateToPost(post)
 * });
 */
export class SearchBox {
  /**
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration options
   * @param {string} options.baseUrl - Base URL for API calls
   * @param {string} options.placeholder - Input placeholder text
   * @param {number} options.debounceMs - Debounce delay in milliseconds
   * @param {number} options.minChars - Minimum characters before fetching results
   * @param {number} options.previewLimit - Max results to show in preview
   * @param {Function} options.onSearch - Callback when search is submitted
   * @param {Function} options.onSuggestionClick - Callback when suggestion is clicked
   */
  constructor(container, options = {}) {
    if (!container) {
      console.error('SearchBox: Container element required');
      return;
    }

    this.container = container;
    this.baseUrl = options.baseUrl || '';
    this.placeholder = options.placeholder || 'Search...';
    this.debounceMs = options.debounceMs || 300;
    this.minChars = options.minChars || 2;
    this.previewLimit = options.previewLimit || 5;
    this.onSearch = options.onSearch || null;
    this.onSuggestionClick = options.onSuggestionClick || null;

    // State
    this.suggestions = [];
    this.totalResults = 0;
    this.activeIndex = -1;
    this.debounceTimer = null;
    this.isLoading = false;
    this.currentQuery = '';

    this.enhance();
    this.bindEvents();
  }

  /**
   * Enhance existing form or render new one (progressive enhancement)
   */
  enhance() {
    // Try to find existing form and input
    this.form = this.container.querySelector('form');
    this.input = this.container.querySelector('input[type="search"], input[name="q"]');

    if (this.form && this.input) {
      // Progressive enhancement: use existing form
      // Make the form/input wrapper position relative for dropdown
      const formParent = this.form.parentElement;
      if (formParent && formParent !== this.container) {
        formParent.style.position = 'relative';
      } else {
        this.form.style.position = 'relative';
      }

      // Add suggestions dropdown after form
      this.suggestionsEl = document.createElement('div');
      this.suggestionsEl.className = 'search-widget__suggestions';
      this.suggestionsEl.setAttribute('role', 'listbox');
      this.suggestionsEl.setAttribute('aria-label', 'Search results');
      this.form.insertAdjacentElement('afterend', this.suggestionsEl);

      // Add autocomplete="off" to prevent browser suggestions
      this.input.setAttribute('autocomplete', 'off');
    } else {
      // No existing form, render our own
      this.render();
    }
  }

  /**
   * Render the search box (fallback if no existing form)
   */
  render() {
    this.container.innerHTML = `
      <div class="search-widget">
        <form class="search-widget__form" role="search">
          <input
            type="search"
            class="search-widget__input"
            placeholder="${this.escapeHtml(this.placeholder)}"
            aria-label="Search"
            autocomplete="off"
          >
          <button type="submit" class="search-widget__btn" aria-label="Search">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </form>
        <div class="search-widget__suggestions" role="listbox" aria-label="Search results"></div>
      </div>
    `;

    // Cache DOM references
    this.form = this.container.querySelector('.search-widget__form');
    this.input = this.container.querySelector('.search-widget__input');
    this.suggestionsEl = this.container.querySelector('.search-widget__suggestions');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Form submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitSearch();
    });

    // Input changes
    this.input.addEventListener('input', () => {
      this.handleInput();
    });

    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });

    // Focus/blur
    this.input.addEventListener('focus', () => {
      if (this.suggestions.length > 0) {
        this.showSuggestions();
      }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.hideSuggestions();
      }
    });

    // Result clicks - let links navigate naturally, but also support callback
    this.suggestionsEl.addEventListener('click', (e) => {
      const resultEl = e.target.closest('.search-widget__result');
      if (resultEl) {
        const index = parseInt(resultEl.dataset.index, 10);
        if (!isNaN(index) && this.onSuggestionClick) {
          // If callback provided, let it handle navigation
          e.preventDefault();
          this.selectSuggestion(index);
        }
        // Otherwise, the link will navigate naturally
        this.hideSuggestions();
      }
    });
  }

  /**
   * Handle input changes with debounce
   */
  handleInput() {
    clearTimeout(this.debounceTimer);

    const query = this.input.value.trim();

    if (query.length < this.minChars) {
      this.suggestions = [];
      this.hideSuggestions();
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.fetchSuggestions(query);
    }, this.debounceMs);
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} e
   */
  handleKeydown(e) {
    const suggestionCount = this.suggestions.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (suggestionCount > 0) {
          this.activeIndex = Math.min(this.activeIndex + 1, suggestionCount - 1);
          this.updateActiveSuggestion();
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (suggestionCount > 0) {
          this.activeIndex = Math.max(this.activeIndex - 1, -1);
          this.updateActiveSuggestion();
        }
        break;

      case 'Enter':
        if (this.activeIndex >= 0 && this.activeIndex < suggestionCount) {
          e.preventDefault();
          this.selectSuggestion(this.activeIndex);
        }
        break;

      case 'Escape':
        this.hideSuggestions();
        this.input.blur();
        break;
    }
  }

  /**
   * Fetch search results from API (live search)
   * @param {string} query
   */
  async fetchSuggestions(query) {
    this.isLoading = true;
    this.currentQuery = query;

    // Show loading state
    this.suggestionsEl.innerHTML = `
      <div class="search-widget__loading">
        <span class="search-widget__loading-spinner"></span>
        Searching...
      </div>
    `;
    this.showSuggestions();

    try {
      const params = new URLSearchParams({
        q: query,
        per_page: this.previewLimit.toString(),
        page: '1'
      });
      const response = await fetch(`${this.baseUrl}/api/v1/blog/search?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch search results');
      }

      const data = await response.json();
      this.suggestions = (data.results || []).map(r => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt,
        category: r.categories && r.categories[0] ? r.categories[0].name : null,
        categorySlug: r.categories && r.categories[0] ? r.categories[0].slug : null,
        published_at: r.published_at,
        highlights: r.highlights
      }));
      this.totalResults = data.pagination?.total || 0;
      this.activeIndex = -1;
      this.renderSuggestions();
    } catch (error) {
      console.error('SearchBox: Error fetching search results:', error);
      this.suggestions = [];
      this.suggestionsEl.innerHTML = `
        <div class="search-widget__error">
          Search unavailable
        </div>
      `;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Render suggestions dropdown with search results
   */
  renderSuggestions() {
    if (this.suggestions.length === 0) {
      // No results found
      this.suggestionsEl.innerHTML = `
        <div class="search-widget__no-results">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
          <span>No results found for "${this.escapeHtml(this.currentQuery)}"</span>
        </div>
      `;
      this.showSuggestions();
      return;
    }

    const query = this.input.value.trim().toLowerCase();

    const resultsHtml = this.suggestions
      .map((suggestion, index) => {
        // Use highlighted title if available, otherwise highlight manually
        let title = suggestion.highlights?.title?.[0] || this.highlightMatch(suggestion.title, query);

        // Get excerpt - use highlighted version if available
        let excerpt = '';
        if (suggestion.highlights?.content?.[0]) {
          excerpt = suggestion.highlights.content[0];
        } else if (suggestion.highlights?.excerpt?.[0]) {
          excerpt = suggestion.highlights.excerpt[0];
        } else if (suggestion.excerpt) {
          excerpt = this.truncateText(suggestion.excerpt, 80);
        }

        return `
          <a
            href="${this.baseUrl}/blog/${suggestion.slug}"
            class="search-widget__result ${index === this.activeIndex ? 'search-widget__result--active' : ''}"
            data-index="${index}"
            role="option"
            aria-selected="${index === this.activeIndex}"
          >
            <div class="search-widget__result-content">
              <span class="search-widget__result-title">${title}</span>
              ${excerpt ? `<span class="search-widget__result-excerpt">${excerpt}</span>` : ''}
            </div>
            ${suggestion.category ? `<span class="search-widget__result-category">${this.escapeHtml(suggestion.category)}</span>` : ''}
          </a>
        `;
      })
      .join('');

    // Add "View all results" link if there are more results
    const viewAllHtml = this.totalResults > this.previewLimit
      ? `
        <a href="${this.baseUrl}/blog/search?q=${encodeURIComponent(this.currentQuery)}" class="search-widget__view-all">
          View all ${this.totalResults} results
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </a>
      `
      : '';

    this.suggestionsEl.innerHTML = `
      <div class="search-widget__results-header">
        ${this.totalResults} result${this.totalResults === 1 ? '' : 's'} found
      </div>
      ${resultsHtml}
      ${viewAllHtml}
    `;

    this.showSuggestions();
  }

  /**
   * Truncate text to specified length
   * @param {string} text
   * @param {number} maxLength
   * @returns {string}
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    const stripped = text.replace(/<[^>]*>/g, '');
    if (stripped.length <= maxLength) return this.escapeHtml(stripped);
    return this.escapeHtml(stripped.substring(0, maxLength).trim()) + '...';
  }

  /**
   * Highlight matching text in suggestion
   * @param {string} text
   * @param {string} query
   * @returns {string}
   */
  highlightMatch(text, query) {
    if (!query) return this.escapeHtml(text);

    const escaped = this.escapeHtml(text);
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Update active suggestion visual state
   */
  updateActiveSuggestion() {
    const items = this.suggestionsEl.querySelectorAll('.search-widget__result');
    items.forEach((item, index) => {
      const isActive = index === this.activeIndex;
      item.classList.toggle('search-widget__result--active', isActive);
      item.setAttribute('aria-selected', isActive);
    });

    // Scroll active item into view
    if (this.activeIndex >= 0) {
      items[this.activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Select a suggestion
   * @param {number} index
   */
  selectSuggestion(index) {
    const suggestion = this.suggestions[index];
    if (!suggestion) return;

    this.input.value = suggestion.title;
    this.hideSuggestions();

    if (this.onSuggestionClick) {
      this.onSuggestionClick(suggestion);
    }
  }

  /**
   * Submit the search
   */
  submitSearch() {
    const query = this.input.value.trim();
    if (!query) return;

    this.hideSuggestions();

    if (this.onSearch) {
      this.onSearch(query);
    } else {
      // Default: navigate to search page
      window.location.href = `${this.baseUrl}/blog/search?q=${encodeURIComponent(query)}`;
    }
  }

  /**
   * Show suggestions dropdown
   */
  showSuggestions() {
    this.suggestionsEl.classList.add('search-widget__suggestions--visible');
  }

  /**
   * Hide suggestions dropdown
   */
  hideSuggestions() {
    this.suggestionsEl.classList.remove('search-widget__suggestions--visible');
    this.activeIndex = -1;
  }

  /**
   * Set input value
   * @param {string} value
   */
  setValue(value) {
    this.input.value = value;
  }

  /**
   * Get current input value
   * @returns {string}
   */
  getValue() {
    return this.input.value.trim();
  }

  /**
   * Focus the input
   */
  focus() {
    this.input.focus();
  }

  /**
   * Clear the input
   */
  clear() {
    this.input.value = '';
    this.suggestions = [];
    this.hideSuggestions();
  }

  /**
   * Escape HTML
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape regex special characters
   * @param {string} text
   * @returns {string}
   */
  escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
