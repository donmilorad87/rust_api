import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * StorePage Controller
 *
 * Manages the store landing page with product listing, filtering, search, and pagination.
 */
export class StorePage {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.productsGrid = config.productsGrid;
    this.loadingState = config.loadingState;
    this.errorState = config.errorState;
    this.emptyState = config.emptyState;
    this.showToast = config.showToast;

    // State
    this.products = [];
    this.featuredProducts = [];
    this.categories = [];
    this.tags = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.totalProducts = 0;
    this.limit = 12;

    // Filters
    this.filters = {
      search: '',
      category_id: null,
      tags: [],
      price_min: null,
      price_max: null,
      country: '',
      region: '',
      season: ''
    };

    // Debounce timer for search
    this.searchDebounceTimer = null;

    this.init();
  }

  /**
   * Initialize the page
   */
  async init() {
    this.setupEventListeners();

    // Load initial data in parallel
    await Promise.all([
      this.loadCategories(),
      this.loadTags(),
      this.loadFeaturedProducts(),
      this.loadProducts()
    ]);
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.handleSearchInput(e));
    }

    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => this.handleCategoryChange(e));
    }

    // Price range inputs
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');
    if (priceMin) {
      priceMin.addEventListener('change', () => this.handlePriceChange());
    }
    if (priceMax) {
      priceMax.addEventListener('change', () => this.handlePriceChange());
    }

    // Country filter
    const countryFilter = document.getElementById('countryFilter');
    if (countryFilter) {
      countryFilter.addEventListener('change', (e) => this.handleCountryChange(e));
    }

    // Region filter
    const regionFilter = document.getElementById('regionFilter');
    if (regionFilter) {
      regionFilter.addEventListener('change', (e) => this.handleRegionChange(e));
    }

    // Season filter
    const seasonFilter = document.getElementById('seasonFilter');
    if (seasonFilter) {
      seasonFilter.addEventListener('change', (e) => this.handleSeasonChange(e));
    }

    // Clear filters button
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => this.clearFilters());
    }

    // Retry button
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadProducts());
    }

    // Mobile filter toggle
    const filterToggleBtn = document.getElementById('filterToggleBtn');
    if (filterToggleBtn) {
      filterToggleBtn.addEventListener('click', () => this.toggleMobileFilters());
    }
  }

  /**
   * Handle search input with debounce
   */
  handleSearchInput(e) {
    const query = e.target.value.trim();

    // Clear previous timer
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    // Set new timer (300ms debounce)
    this.searchDebounceTimer = setTimeout(() => {
      this.filters.search = query;
      this.currentPage = 1;
      this.loadProducts();
    }, 300);
  }

  /**
   * Handle category filter change
   */
  handleCategoryChange(e) {
    const value = e.target.value;
    this.filters.category_id = value ? parseInt(value, 10) : null;
    this.currentPage = 1;
    this.loadProducts();
  }

  /**
   * Handle price range change
   */
  handlePriceChange() {
    const priceMin = document.getElementById('priceMin');
    const priceMax = document.getElementById('priceMax');

    const minValue = priceMin ? priceMin.value : '';
    const maxValue = priceMax ? priceMax.value : '';

    // Convert to cents for API (prices stored in cents)
    this.filters.price_min = minValue ? Math.round(parseFloat(minValue) * 100) : null;
    this.filters.price_max = maxValue ? Math.round(parseFloat(maxValue) * 100) : null;
    this.currentPage = 1;
    this.loadProducts();
  }

  /**
   * Handle country filter change
   */
  handleCountryChange(e) {
    this.filters.country = e.target.value;
    this.currentPage = 1;
    this.loadProducts();
  }

  /**
   * Handle region filter change
   */
  handleRegionChange(e) {
    this.filters.region = e.target.value;
    this.currentPage = 1;
    this.loadProducts();
  }

  /**
   * Handle season filter change
   */
  handleSeasonChange(e) {
    this.filters.season = e.target.value;
    this.currentPage = 1;
    this.loadProducts();
  }

  /**
   * Handle tag click
   */
  handleTagClick(tag) {
    const tagIndex = this.filters.tags.indexOf(tag);
    if (tagIndex === -1) {
      this.filters.tags.push(tag);
    } else {
      this.filters.tags.splice(tagIndex, 1);
    }
    this.currentPage = 1;
    this.updateTagsUI();
    this.loadProducts();
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this.filters = {
      search: '',
      category_id: null,
      tags: [],
      price_min: null,
      price_max: null,
      country: '',
      region: '',
      season: ''
    };
    this.currentPage = 1;

    // Reset form inputs
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) categoryFilter.value = '';

    const priceMin = document.getElementById('priceMin');
    if (priceMin) priceMin.value = '';

    const priceMax = document.getElementById('priceMax');
    if (priceMax) priceMax.value = '';

    const countryFilter = document.getElementById('countryFilter');
    if (countryFilter) countryFilter.value = '';

    const regionFilter = document.getElementById('regionFilter');
    if (regionFilter) regionFilter.value = '';

    const seasonFilter = document.getElementById('seasonFilter');
    if (seasonFilter) seasonFilter.value = '';

    this.updateTagsUI();
    this.loadProducts();
  }

  /**
   * Toggle mobile filters visibility
   */
  toggleMobileFilters() {
    const sidebar = document.getElementById('filtersSidebar');
    if (sidebar) {
      sidebar.classList.toggle('store-sidebar--open');
    }
  }

  /**
   * Load categories from API
   */
  async loadCategories() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/store/categories`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ 'Accept': 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const data = await response.json();
      this.categories = data.categories || [];
      this.renderCategories();
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  /**
   * Render categories in the dropdown
   */
  renderCategories() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    // Clear existing options except the first "All Categories" option
    categoryFilter.innerHTML = '<option value="">All Categories</option>';

    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = `${category.name} (${category.product_count || 0})`;
      categoryFilter.appendChild(option);
    });
  }

  /**
   * Load tags from API
   */
  async loadTags() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/store/products/tags`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ 'Accept': 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load tags');
      }

      const data = await response.json();
      this.tags = data.tags || [];
      this.renderTags();
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  }

  /**
   * Render tags as clickable pills
   */
  renderTags() {
    const tagsContainer = document.getElementById('tagsContainer');
    if (!tagsContainer) return;

    tagsContainer.innerHTML = '';

    this.tags.forEach(tag => {
      const tagEl = document.createElement('button');
      tagEl.type = 'button';
      tagEl.className = 'tag-pill';
      if (this.filters.tags.includes(tag.name)) {
        tagEl.classList.add('tag-pill--active');
      }
      tagEl.textContent = `${tag.name} (${tag.count})`;
      tagEl.addEventListener('click', () => this.handleTagClick(tag.name));
      tagsContainer.appendChild(tagEl);
    });
  }

  /**
   * Update tags UI to reflect current selection
   */
  updateTagsUI() {
    const tagsContainer = document.getElementById('tagsContainer');
    if (!tagsContainer) return;

    const tagPills = tagsContainer.querySelectorAll('.tag-pill');
    tagPills.forEach(pill => {
      const tagName = pill.textContent.split(' (')[0];
      if (this.filters.tags.includes(tagName)) {
        pill.classList.add('tag-pill--active');
      } else {
        pill.classList.remove('tag-pill--active');
      }
    });
  }

  /**
   * Load featured products from API
   */
  async loadFeaturedProducts() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/store/products/featured?limit=4`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ 'Accept': 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load featured products');
      }

      const data = await response.json();
      this.featuredProducts = data.products || [];
      this.renderFeaturedProducts();
    } catch (error) {
      console.error('Failed to load featured products:', error);
    }
  }

  /**
   * Render featured products section
   */
  renderFeaturedProducts() {
    const featuredGrid = document.getElementById('featuredGrid');
    if (!featuredGrid) return;

    if (this.featuredProducts.length === 0) {
      const featuredSection = document.getElementById('featuredSection');
      if (featuredSection) {
        featuredSection.style.display = 'none';
      }
      return;
    }

    featuredGrid.innerHTML = '';

    this.featuredProducts.forEach(product => {
      const card = this.createProductCard(product, true);
      featuredGrid.appendChild(card);
    });
  }

  /**
   * Load products from API with current filters
   */
  async loadProducts() {
    this.showLoadingState();

    try {
      // Build query params
      const params = new URLSearchParams();
      params.append('page', this.currentPage.toString());
      params.append('limit', this.limit.toString());

      if (this.filters.search) {
        params.append('search', this.filters.search);
      }
      if (this.filters.category_id) {
        params.append('category_id', this.filters.category_id.toString());
      }
      if (this.filters.tags.length > 0) {
        params.append('tags', this.filters.tags.join(','));
      }
      if (this.filters.price_min !== null) {
        params.append('price_min', this.filters.price_min.toString());
      }
      if (this.filters.price_max !== null) {
        params.append('price_max', this.filters.price_max.toString());
      }
      if (this.filters.country) {
        params.append('country', this.filters.country);
      }
      if (this.filters.region) {
        params.append('region', this.filters.region);
      }
      if (this.filters.season) {
        params.append('season', this.filters.season);
      }

      const response = await fetch(`${this.baseUrl}/api/v1/store/products?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ 'Accept': 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load products');
      }

      const data = await response.json();
      this.products = data.products || [];
      this.totalPages = data.pagination?.total_pages || 1;
      this.totalProducts = data.pagination?.total || 0;
      this.currentPage = data.pagination?.page || 1;

      if (this.products.length === 0) {
        this.showEmptyState();
      } else {
        this.renderProducts();
        this.renderPagination();
        this.showContentState();
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      this.showErrorState(error.message);
    }
  }

  /**
   * Render products grid
   */
  renderProducts() {
    this.productsGrid.innerHTML = '';

    this.products.forEach(product => {
      const card = this.createProductCard(product, false);
      this.productsGrid.appendChild(card);
    });

    // Update results count
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
      resultsCount.textContent = `${this.totalProducts} product${this.totalProducts !== 1 ? 's' : ''} found`;
    }
  }

  /**
   * Create a product card element
   * @param {Object} product - Product data
   * @param {boolean} isFeatured - Whether this is a featured product card
   * @returns {HTMLElement}
   */
  createProductCard(product, isFeatured = false) {
    const card = document.createElement('article');
    card.className = isFeatured ? 'product-card product-card--featured' : 'product-card';
    card.dataset.productId = product.id;

    const coverImage = product.cover_image_url || '/assets/img/product-placeholder.svg';
    const priceFormatted = this.formatPrice(product.price);
    const isSold = product.is_sold;

    card.innerHTML = `
      <a href="/store/product/${this.escapeHtml(product.slug)}" class="product-card__link">
        <div class="product-card__image-container">
          <img src="${this.escapeHtml(coverImage)}" alt="${this.escapeHtml(product.title)}" class="product-card__image" loading="lazy">
          ${isSold ? '<div class="product-card__sold-overlay"><span>SOLD</span></div>' : ''}
          ${product.category_name ? `<span class="product-card__category">${this.escapeHtml(product.category_name)}</span>` : ''}
        </div>
        <div class="product-card__content">
          <h3 class="product-card__title">${this.escapeHtml(product.title)}</h3>
          ${product.author_name ? `<p class="product-card__author">by ${this.escapeHtml(product.author_name)}</p>` : ''}
          <div class="product-card__footer">
            <span class="product-card__price ${isSold ? 'product-card__price--sold' : ''}">${priceFormatted}</span>
            ${!isSold ? '<button type="button" class="product-card__buy-btn" aria-label="Buy now">Buy</button>' : ''}
          </div>
        </div>
      </a>
    `;

    // Prevent link navigation when clicking buy button
    const buyBtn = card.querySelector('.product-card__buy-btn');
    if (buyBtn) {
      buyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleBuyClick(product);
      });
    }

    return card;
  }

  /**
   * Handle buy button click
   */
  handleBuyClick(product) {
    // Navigate to product detail page
    window.location.href = `/store/product/${product.slug}`;
  }

  /**
   * Format price from cents to currency string
   * @param {number} cents - Price in cents
   * @returns {string}
   */
  formatPrice(cents) {
    const euros = cents / 100;
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR'
    }).format(euros);
  }

  /**
   * Render pagination controls
   */
  renderPagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;

    if (this.totalPages <= 1) {
      paginationContainer.style.display = 'none';
      return;
    }

    paginationContainer.style.display = 'flex';
    paginationContainer.innerHTML = '';

    // Calculate page window (max 7 pages, centered on current)
    const { startPage, endPage } = this.calculatePageWindow();

    // First button
    const firstBtn = this.createPaginationButton('First', 1, this.currentPage === 1);
    paginationContainer.appendChild(firstBtn);

    // Previous button
    const prevBtn = this.createPaginationButton('Prev', this.currentPage - 1, this.currentPage === 1);
    paginationContainer.appendChild(prevBtn);

    // Page numbers container
    const pagesContainer = document.createElement('div');
    pagesContainer.className = 'pagination__pages';

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = this.createPaginationButton(i.toString(), i, false, i === this.currentPage);
      pagesContainer.appendChild(pageBtn);
    }

    paginationContainer.appendChild(pagesContainer);

    // Next button
    const nextBtn = this.createPaginationButton('Next', this.currentPage + 1, this.currentPage === this.totalPages);
    paginationContainer.appendChild(nextBtn);

    // Last button
    const lastBtn = this.createPaginationButton('Last', this.totalPages, this.currentPage === this.totalPages);
    paginationContainer.appendChild(lastBtn);

    // Go to page input
    const gotoContainer = document.createElement('div');
    gotoContainer.className = 'pagination__goto';
    gotoContainer.innerHTML = `
      <input type="number" class="pagination__input" min="1" max="${this.totalPages}" placeholder="Page" aria-label="Go to page number">
      <button type="button" class="pagination__btn pagination__btn--go" aria-label="Go to entered page">Go</button>
    `;

    const gotoInput = gotoContainer.querySelector('.pagination__input');
    const gotoBtn = gotoContainer.querySelector('.pagination__btn--go');

    gotoBtn.addEventListener('click', () => {
      const page = parseInt(gotoInput.value, 10);
      if (page >= 1 && page <= this.totalPages) {
        this.goToPage(page);
      }
    });

    gotoInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const page = parseInt(gotoInput.value, 10);
        if (page >= 1 && page <= this.totalPages) {
          this.goToPage(page);
        }
      }
    });

    paginationContainer.appendChild(gotoContainer);
  }

  /**
   * Calculate page window for pagination
   * @returns {{ startPage: number, endPage: number }}
   */
  calculatePageWindow() {
    const maxVisible = 7;
    const halfWindow = 3;

    let startPage, endPage;

    if (this.totalPages <= maxVisible) {
      startPage = 1;
      endPage = this.totalPages;
    } else if (this.currentPage <= halfWindow + 1) {
      startPage = 1;
      endPage = maxVisible;
    } else if (this.currentPage >= this.totalPages - halfWindow) {
      startPage = this.totalPages - maxVisible + 1;
      endPage = this.totalPages;
    } else {
      startPage = this.currentPage - halfWindow;
      endPage = this.currentPage + halfWindow;
    }

    return { startPage, endPage };
  }

  /**
   * Create a pagination button
   * @param {string} text - Button text
   * @param {number} page - Page number
   * @param {boolean} disabled - Whether button is disabled
   * @param {boolean} active - Whether button is active (current page)
   * @returns {HTMLElement}
   */
  createPaginationButton(text, page, disabled = false, active = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pagination__btn';
    btn.textContent = text;
    btn.dataset.page = page;

    if (disabled) {
      btn.disabled = true;
    }

    if (active) {
      btn.classList.add('pagination__btn--active');
      btn.setAttribute('aria-current', 'page');
      btn.disabled = true;
    }

    if (!disabled && !active) {
      btn.addEventListener('click', () => this.goToPage(page));
    }

    return btn;
  }

  /**
   * Navigate to a specific page
   * @param {number} page - Page number
   */
  goToPage(page) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }
    this.currentPage = page;
    this.loadProducts();

    // Scroll to top of products grid
    const mainContent = document.getElementById('storeMain');
    if (mainContent) {
      mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    this.loadingState.style.display = 'block';
    this.errorState.style.display = 'none';
    this.emptyState.style.display = 'none';
    this.productsGrid.style.display = 'none';

    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
      paginationContainer.style.display = 'none';
    }
  }

  /**
   * Show error state
   * @param {string} message - Error message
   */
  showErrorState(message) {
    this.loadingState.style.display = 'none';
    this.errorState.style.display = 'block';
    this.emptyState.style.display = 'none';
    this.productsGrid.style.display = 'none';

    const messageEl = this.errorState.querySelector('.error-state__message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.loadingState.style.display = 'none';
    this.errorState.style.display = 'none';
    this.emptyState.style.display = 'block';
    this.productsGrid.style.display = 'none';

    const paginationContainer = document.getElementById('paginationContainer');
    if (paginationContainer) {
      paginationContainer.style.display = 'none';
    }

    // Update results count
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
      resultsCount.textContent = '0 products found';
    }
  }

  /**
   * Show content state
   */
  showContentState() {
    this.loadingState.style.display = 'none';
    this.errorState.style.display = 'none';
    this.emptyState.style.display = 'none';
    this.productsGrid.style.display = 'grid';
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string}
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
