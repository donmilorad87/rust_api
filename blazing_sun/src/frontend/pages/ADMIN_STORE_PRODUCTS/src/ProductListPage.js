import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * ProductListPage Controller
 *
 * Handles the admin product list page:
 * - Display products in a table with pagination
 * - Filter by status, category, and search
 * - Actions: toggle feature, toggle active, delete
 */
export class ProductListPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;

    // State
    this.products = [];
    this.categories = [];
    this.pagination = {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0
    };
    this.filters = {
      status: 'all',
      category_id: null,
      search: ''
    };

    // DOM Elements
    this.tableBody = document.getElementById('productsTableBody');
    this.statusFilter = document.getElementById('statusFilter');
    this.categoryFilter = document.getElementById('categoryFilter');
    this.searchInput = document.getElementById('searchInput');
    this.paginationContainer = document.getElementById('paginationContainer');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.confirmModal = document.getElementById('confirmModal');
    this.confirmModalTitle = document.getElementById('confirmModalTitle');
    this.confirmModalMessage = document.getElementById('confirmModalMessage');
    this.confirmModalBtn = document.getElementById('confirmModalBtn');
    this.cancelModalBtn = document.getElementById('cancelModalBtn');

    // Bind methods
    this.handleStatusFilterChange = this.handleStatusFilterChange.bind(this);
    this.handleCategoryFilterChange = this.handleCategoryFilterChange.bind(this);
    this.handleSearchInput = this.handleSearchInput.bind(this);
    this.handleTableActions = this.handleTableActions.bind(this);

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.bindEvents();
    this.loadCategories();
    this.loadProducts();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    if (this.statusFilter) {
      this.statusFilter.addEventListener('change', this.handleStatusFilterChange);
    }
    if (this.categoryFilter) {
      this.categoryFilter.addEventListener('change', this.handleCategoryFilterChange);
    }
    if (this.searchInput) {
      let searchTimeout;
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => this.handleSearchInput(e), 300);
      });
    }
    if (this.tableBody) {
      this.tableBody.addEventListener('click', this.handleTableActions);
    }
    if (this.cancelModalBtn) {
      this.cancelModalBtn.addEventListener('click', () => this.hideConfirmModal());
    }
    if (this.confirmModal) {
      this.confirmModal.addEventListener('click', (e) => {
        if (e.target === this.confirmModal) {
          this.hideConfirmModal();
        }
      });
    }
  }

  /**
   * Handle status filter change
   */
  handleStatusFilterChange(e) {
    this.filters.status = e.target.value;
    this.pagination.page = 1;
    this.loadProducts();
  }

  /**
   * Handle category filter change
   */
  handleCategoryFilterChange(e) {
    this.filters.category_id = e.target.value || null;
    this.pagination.page = 1;
    this.loadProducts();
  }

  /**
   * Handle search input
   */
  handleSearchInput(e) {
    this.filters.search = e.target.value.trim();
    this.pagination.page = 1;
    this.loadProducts();
  }

  /**
   * Handle table action button clicks
   */
  handleTableActions(e) {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const productId = actionBtn.dataset.productId;

    switch (action) {
      case 'edit':
        window.location.href = `${this.baseUrl}/admin/store/products/${productId}/edit`;
        break;
      case 'toggle-feature':
        this.toggleFeature(productId);
        break;
      case 'toggle-active':
        this.toggleActive(productId);
        break;
      case 'delete':
        this.showDeleteConfirmation(productId);
        break;
    }
  }

  /**
   * Load categories for filter dropdown
   */
  async loadCategories() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/categories`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const data = await response.json();
      if (data.status === 'success') {
        this.categories = data.categories || [];
        this.renderCategoryFilter();
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  /**
   * Render category filter options
   */
  renderCategoryFilter() {
    if (!this.categoryFilter) return;

    const options = ['<option value="">All Categories</option>'];
    for (const category of this.categories) {
      options.push(`<option value="${category.id}">${this.escapeHtml(category.name)}</option>`);
    }
    this.categoryFilter.innerHTML = options.join('');
  }

  /**
   * Load products with current filters and pagination
   */
  async loadProducts() {
    this.showLoading();

    try {
      const params = new URLSearchParams({
        page: this.pagination.page.toString(),
        limit: this.pagination.limit.toString()
      });

      if (this.filters.status && this.filters.status !== 'all') {
        params.append('status', this.filters.status);
      }
      if (this.filters.category_id) {
        params.append('category_id', this.filters.category_id);
      }
      if (this.filters.search) {
        params.append('search', this.filters.search);
      }

      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/products?${params}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load products');
      }

      const data = await response.json();
      if (data.status === 'success') {
        this.products = data.products || [];
        this.pagination = {
          page: data.pagination?.page || 1,
          limit: data.pagination?.limit || 20,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.total_pages || 1
        };
        this.renderProducts();
        this.renderPagination();
      } else {
        throw new Error(data.message || 'Failed to load products');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      this.showToast('Failed to load products', 'error');
      this.renderEmptyState('Error loading products. Please try again.');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Render products table
   */
  renderProducts() {
    if (!this.tableBody) return;

    if (this.products.length === 0) {
      this.renderEmptyState('No products found.');
      return;
    }

    const rows = this.products.map(product => this.renderProductRow(product));
    this.tableBody.innerHTML = rows.join('');
  }

  /**
   * Render a single product row
   */
  renderProductRow(product) {
    const typeLabel = this.getProductTypeLabel(product.product_type);
    const statusBadges = this.renderStatusBadges(product);
    const coverImage = product.cover_image_url
      ? `<img src="${product.cover_image_url}" alt="${this.escapeHtml(product.title)}" class="product-thumb">`
      : `<div class="product-thumb product-thumb--placeholder">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
             <circle cx="8.5" cy="8.5" r="1.5"></circle>
             <polyline points="21 15 16 10 5 21"></polyline>
           </svg>
         </div>`;

    return `
      <tr data-product-id="${product.id}">
        <td class="table-cell--image">${coverImage}</td>
        <td class="table-cell--title">
          <span class="product-title">${this.escapeHtml(product.title)}</span>
          ${product.slug ? `<span class="product-slug">/${this.escapeHtml(product.slug)}</span>` : ''}
        </td>
        <td class="table-cell--type">
          <span class="type-badge type-badge--${product.product_type}">${typeLabel}</span>
        </td>
        <td class="table-cell--category">${product.category_name ? this.escapeHtml(product.category_name) : '<span class="text-muted">-</span>'}</td>
        <td class="table-cell--price">${this.formatPrice(product.price_cents)}</td>
        <td class="table-cell--status">${statusBadges}</td>
        <td class="table-cell--actions">
          <div class="action-buttons">
            <button type="button" class="btn-icon btn-icon--edit" data-action="edit" data-product-id="${product.id}" aria-label="Edit product" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="btn-icon btn-icon--feature ${product.is_featured ? 'btn-icon--active' : ''}" data-action="toggle-feature" data-product-id="${product.id}" aria-label="${product.is_featured ? 'Remove from featured' : 'Add to featured'}" title="${product.is_featured ? 'Remove from featured' : 'Add to featured'}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${product.is_featured ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </button>
            <button type="button" class="btn-icon btn-icon--toggle ${product.is_active ? 'btn-icon--active' : ''}" data-action="toggle-active" data-product-id="${product.id}" aria-label="${product.is_active ? 'Deactivate' : 'Activate'}" title="${product.is_active ? 'Deactivate' : 'Activate'}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${product.is_active
                  ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
                  : '<circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>'}
              </svg>
            </button>
            <button type="button" class="btn-icon btn-icon--delete" data-action="delete" data-product-id="${product.id}" aria-label="Delete product" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render status badges
   */
  renderStatusBadges(product) {
    const badges = [];

    if (product.is_active) {
      badges.push('<span class="status-badge status-badge--active">Active</span>');
    } else {
      badges.push('<span class="status-badge status-badge--inactive">Inactive</span>');
    }

    if (product.is_sold) {
      badges.push('<span class="status-badge status-badge--sold">Sold</span>');
    }

    if (product.is_featured) {
      badges.push('<span class="status-badge status-badge--featured">Featured</span>');
    }

    return badges.join('');
  }

  /**
   * Render empty state
   */
  renderEmptyState(message) {
    if (!this.tableBody) return;

    this.tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </div>
          <p class="empty-state__message">${message}</p>
          <a href="${this.baseUrl}/admin/store/products/create" class="btn btn--primary">Create First Product</a>
        </td>
      </tr>
    `;
  }

  /**
   * Render pagination
   */
  renderPagination() {
    if (!this.paginationContainer) return;

    if (this.pagination.totalPages <= 1) {
      this.paginationContainer.innerHTML = '';
      return;
    }

    const { page, totalPages } = this.pagination;
    const { startPage, endPage } = this.calculatePageWindow(page, totalPages);

    let pagesHtml = '';
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === page;
      pagesHtml += `
        <button class="pagination__btn ${isActive ? 'pagination__btn--active' : ''}"
                data-page="${i}"
                ${isActive ? 'aria-current="page" disabled' : ''}>
          ${i}
        </button>
      `;
    }

    this.paginationContainer.innerHTML = `
      <nav class="pagination" aria-label="Products pagination">
        <button class="pagination__btn pagination__btn--first" data-page="1" ${page === 1 ? 'disabled' : ''} aria-label="Go to first page">First</button>
        <button class="pagination__btn pagination__btn--prev" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Go to previous page">Prev</button>
        <div class="pagination__pages">${pagesHtml}</div>
        <button class="pagination__btn pagination__btn--next" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''} aria-label="Go to next page">Next</button>
        <button class="pagination__btn pagination__btn--last" data-page="${totalPages}" ${page === totalPages ? 'disabled' : ''} aria-label="Go to last page">Last</button>
        <div class="pagination__goto">
          <input type="number" class="pagination__input" min="1" max="${totalPages}" placeholder="Page" aria-label="Go to page number">
          <button class="pagination__btn pagination__btn--go" aria-label="Go to entered page">Go</button>
        </div>
      </nav>
    `;

    // Bind pagination events
    this.paginationContainer.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetPage = parseInt(e.currentTarget.dataset.page, 10);
        if (targetPage >= 1 && targetPage <= totalPages && targetPage !== page) {
          this.pagination.page = targetPage;
          this.loadProducts();
        }
      });
    });

    const goBtn = this.paginationContainer.querySelector('.pagination__btn--go');
    const gotoInput = this.paginationContainer.querySelector('.pagination__input');
    if (goBtn && gotoInput) {
      goBtn.addEventListener('click', () => {
        const targetPage = parseInt(gotoInput.value, 10);
        if (targetPage >= 1 && targetPage <= totalPages) {
          this.pagination.page = targetPage;
          this.loadProducts();
        }
      });
      gotoInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const targetPage = parseInt(gotoInput.value, 10);
          if (targetPage >= 1 && targetPage <= totalPages) {
            this.pagination.page = targetPage;
            this.loadProducts();
          }
        }
      });
    }
  }

  /**
   * Calculate page window for pagination
   */
  calculatePageWindow(currentPage, totalPages) {
    const maxVisible = 7;
    const halfWindow = 3;

    let startPage, endPage;

    if (totalPages <= maxVisible) {
      startPage = 1;
      endPage = totalPages;
    } else if (currentPage <= halfWindow + 1) {
      startPage = 1;
      endPage = maxVisible;
    } else if (currentPage >= totalPages - halfWindow) {
      startPage = totalPages - maxVisible + 1;
      endPage = totalPages;
    } else {
      startPage = currentPage - halfWindow;
      endPage = currentPage + halfWindow;
    }

    return { startPage, endPage };
  }

  /**
   * Toggle featured status
   */
  async toggleFeature(productId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/products/${productId}/feature`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to toggle featured status');
      }

      const data = await response.json();
      if (data.status === 'success') {
        this.showToast(data.message || 'Featured status updated', 'success');
        // Update the product in local state
        const product = this.products.find(p => p.id === parseInt(productId, 10));
        if (product) {
          product.is_featured = data.product?.is_featured ?? !product.is_featured;
        }
        this.renderProducts();
      } else {
        throw new Error(data.message || 'Failed to toggle featured status');
      }
    } catch (error) {
      console.error('Error toggling featured:', error);
      this.showToast('Failed to update featured status', 'error');
    }
  }

  /**
   * Toggle active status
   */
  async toggleActive(productId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/products/${productId}/activate`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to toggle active status');
      }

      const data = await response.json();
      if (data.status === 'success') {
        this.showToast(data.message || 'Active status updated', 'success');
        // Update the product in local state
        const product = this.products.find(p => p.id === parseInt(productId, 10));
        if (product) {
          product.is_active = data.product?.is_active ?? !product.is_active;
        }
        this.renderProducts();
      } else {
        throw new Error(data.message || 'Failed to toggle active status');
      }
    } catch (error) {
      console.error('Error toggling active:', error);
      this.showToast('Failed to update active status', 'error');
    }
  }

  /**
   * Show delete confirmation modal
   */
  showDeleteConfirmation(productId) {
    const product = this.products.find(p => p.id === parseInt(productId, 10));
    if (!product) return;

    if (this.confirmModalTitle) {
      this.confirmModalTitle.textContent = 'Delete Product';
    }
    if (this.confirmModalMessage) {
      this.confirmModalMessage.textContent = `Are you sure you want to delete "${product.title}"? This action cannot be undone.`;
    }
    if (this.confirmModalBtn) {
      this.confirmModalBtn.onclick = () => this.deleteProduct(productId);
    }

    this.showConfirmModal();
  }

  /**
   * Delete product
   */
  async deleteProduct(productId) {
    this.hideConfirmModal();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/products/${productId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      const data = await response.json();
      if (data.status === 'success') {
        this.showToast('Product deleted successfully', 'success');
        this.loadProducts();
      } else {
        throw new Error(data.message || 'Failed to delete product');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      this.showToast('Failed to delete product', 'error');
    }
  }

  /**
   * Show confirm modal
   */
  showConfirmModal() {
    if (this.confirmModal) {
      this.confirmModal.classList.add('modal--visible');
      this.confirmModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Hide confirm modal
   */
  hideConfirmModal() {
    if (this.confirmModal) {
      this.confirmModal.classList.remove('modal--visible');
      this.confirmModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }

  /**
   * Show loading overlay
   */
  showLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add('loading--visible');
    }
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove('loading--visible');
    }
  }

  /**
   * Get product type label
   */
  getProductTypeLabel(type) {
    const labels = {
      single_image: 'Single Image',
      gallery: 'Gallery',
      bundle: 'Bundle'
    };
    return labels[type] || type;
  }

  /**
   * Format price from cents to display
   */
  formatPrice(cents) {
    if (cents == null) return '-';
    const euros = cents / 100;
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR'
    }).format(euros);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
