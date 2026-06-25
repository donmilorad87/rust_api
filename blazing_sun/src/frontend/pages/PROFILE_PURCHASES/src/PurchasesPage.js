import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * PurchasesPage - Main controller for the purchases page
 * Displays user's completed purchases and allows downloading images
 *
 * Features:
 * - Paginated list of purchases
 * - Modal detail view with download options
 * - Download individual images or all as ZIP
 */
export class PurchasesPage {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
   * @param {HTMLElement} config.loadingState - Loading state element
   * @param {HTMLElement} config.emptyState - Empty state element
   * @param {HTMLElement} config.purchasesGrid - Purchases grid container
   * @param {HTMLElement} config.pagination - Pagination container
   * @param {HTMLElement} config.purchaseModal - Purchase detail modal
   * @param {HTMLElement} config.confirmModal - Confirm download modal
   * @param {Function} config.showToast - Toast notification function
   */
  constructor(config) {
    this.baseUrl = config.baseUrl || '';
    this.loadingState = config.loadingState;
    this.emptyState = config.emptyState;
    this.purchasesGrid = config.purchasesGrid;
    this.pagination = config.pagination;
    this.purchaseModal = config.purchaseModal;
    this.confirmModal = config.confirmModal;
    this.showToast = config.showToast || this.defaultToast.bind(this);

    // State
    this.currentPage = 1;
    this.totalPages = 1;
    this.purchases = [];
    this.currentPurchase = null;
    this.downloadablePictures = [];
    this.isLoading = false;

    this.init();
  }

  /**
   * Initialize the purchases page
   */
  init() {
    this.bindEvents();
    this.loadPurchases(1);
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Modal close buttons
    if (this.purchaseModal) {
      this.purchaseModal.querySelectorAll('[data-action="close"]').forEach((btn) => {
        btn.addEventListener('click', () => this.closePurchaseModal());
      });
      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !this.purchaseModal.classList.contains('hidden')) {
          this.closePurchaseModal();
        }
      });
    }

    if (this.confirmModal) {
      this.confirmModal.querySelectorAll('[data-action="close"]').forEach((btn) => {
        btn.addEventListener('click', () => this.closeConfirmModal());
      });
      const confirmBtn = this.confirmModal.querySelector('#confirmDownloadBtn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => this.handleDownloadAll());
      }
    }

    // Download All button in modal
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
      downloadAllBtn.addEventListener('click', () => this.showDownloadAllConfirm());
    }

    // Pagination clicks (delegated)
    if (this.pagination) {
      this.pagination.addEventListener('click', (e) => {
        const btn = e.target.closest('.pagination__btn[data-page]');
        if (btn && !btn.disabled) {
          const page = parseInt(btn.dataset.page, 10);
          this.loadPurchases(page);
        }
      });

      // Go to page input
      this.pagination.addEventListener('click', (e) => {
        const goBtn = e.target.closest('.pagination__btn--go');
        if (goBtn) {
          const input = this.pagination.querySelector('.pagination__input');
          if (input) {
            const page = parseInt(input.value, 10);
            if (page >= 1 && page <= this.totalPages) {
              this.loadPurchases(page);
            }
          }
        }
      });

      this.pagination.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('pagination__input')) {
          const page = parseInt(e.target.value, 10);
          if (page >= 1 && page <= this.totalPages) {
            this.loadPurchases(page);
          }
        }
      });
    }

    // Purchase grid clicks (delegated)
    if (this.purchasesGrid) {
      this.purchasesGrid.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('[data-action="view-purchase"]');
        if (viewBtn) {
          const purchaseId = viewBtn.dataset.purchaseId;
          this.openPurchaseModal(purchaseId);
        }
      });
    }
  }

  /**
   * Load purchases from API
   * @param {number} page - Page number
   */
  async loadPurchases(page = 1) {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoadingState();

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/store/purchases?page=${page}&limit=12`,
        {
          method: 'GET',
          headers: getCsrfHeaders(),
          credentials: 'same-origin',
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/sign-in';
          return;
        }
        throw new Error('Failed to load purchases');
      }

      const data = await response.json();
      this.purchases = data.items || [];
      this.currentPage = data.pagination?.page || 1;
      this.totalPages = data.pagination?.total_pages || 1;

      this.renderPurchases();
      this.renderPagination();
    } catch (error) {
      console.error('Failed to load purchases:', error);
      this.showToast('Failed to load purchases. Please try again.', 'error');
      this.showEmptyState();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    if (this.loadingState) this.loadingState.classList.remove('hidden');
    if (this.emptyState) this.emptyState.classList.add('hidden');
    if (this.purchasesGrid) this.purchasesGrid.classList.add('hidden');
    if (this.pagination) this.pagination.classList.add('hidden');
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    if (this.loadingState) this.loadingState.classList.add('hidden');
    if (this.emptyState) this.emptyState.classList.remove('hidden');
    if (this.purchasesGrid) this.purchasesGrid.classList.add('hidden');
    if (this.pagination) this.pagination.classList.add('hidden');
  }

  /**
   * Show purchases grid
   */
  showPurchasesGrid() {
    if (this.loadingState) this.loadingState.classList.add('hidden');
    if (this.emptyState) this.emptyState.classList.add('hidden');
    if (this.purchasesGrid) this.purchasesGrid.classList.remove('hidden');
    if (this.pagination && this.totalPages > 1) {
      this.pagination.classList.remove('hidden');
    }
  }

  /**
   * Render purchases grid
   */
  renderPurchases() {
    if (!this.purchasesGrid) return;

    if (this.purchases.length === 0) {
      this.showEmptyState();
      return;
    }

    this.purchasesGrid.innerHTML = this.purchases.map((purchase) => this.renderPurchaseCard(purchase)).join('');
    this.showPurchasesGrid();
  }

  /**
   * Render a single purchase card
   * @param {Object} purchase
   * @returns {string} HTML string
   */
  renderPurchaseCard(purchase) {
    const coverImage = purchase.product?.cover_image_url;
    const imageCount = purchase.item_count || 0;
    const formattedDate = this.formatDate(purchase.created_at);
    const formattedAmount = this.formatCurrency(purchase.total_amount_cents);

    return `
      <article class="purchase-card" role="listitem">
        <div class="purchase-card__image-wrapper">
          ${
            coverImage
              ? `<img class="purchase-card__image" src="${this.escapeHtml(coverImage)}" alt="${this.escapeHtml(purchase.product?.title || 'Product')}" loading="lazy">`
              : `<div class="purchase-card__placeholder">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>`
          }
          <span class="purchase-card__badge">${imageCount} image${imageCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="purchase-card__content">
          <h2 class="purchase-card__title">${this.escapeHtml(purchase.product?.title || 'Untitled Product')}</h2>
          <div class="purchase-card__meta">
            <span class="purchase-card__date">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              ${formattedDate}
            </span>
            <span class="purchase-card__images-count">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
              ${imageCount} image${imageCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div class="purchase-card__amount">${formattedAmount}</div>
          <div class="purchase-card__actions">
            <button type="button" class="btn btn--success btn--full" data-action="view-purchase" data-purchase-id="${purchase.id}">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              View & Download
            </button>
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Render pagination
   */
  renderPagination() {
    if (!this.pagination || this.totalPages <= 1) {
      if (this.pagination) this.pagination.classList.add('hidden');
      return;
    }

    const { startPage, endPage } = this.calculatePageWindow();
    let pagesHtml = '';

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage;
      pagesHtml += `
        <button class="pagination__btn ${isActive ? 'pagination__btn--active' : ''}"
                data-page="${i}"
                ${isActive ? 'aria-current="page" disabled' : ''}>
          ${i}
        </button>
      `;
    }

    this.pagination.innerHTML = `
      <button class="pagination__btn pagination__btn--first" data-page="1" ${this.currentPage === 1 ? 'disabled' : ''}>First</button>
      <button class="pagination__btn pagination__btn--prev" data-page="${this.currentPage - 1}" ${this.currentPage === 1 ? 'disabled' : ''}>Prev</button>
      <div class="pagination__pages">${pagesHtml}</div>
      <button class="pagination__btn pagination__btn--next" data-page="${this.currentPage + 1}" ${this.currentPage === this.totalPages ? 'disabled' : ''}>Next</button>
      <button class="pagination__btn pagination__btn--last" data-page="${this.totalPages}" ${this.currentPage === this.totalPages ? 'disabled' : ''}>Last</button>
      <div class="pagination__goto">
        <input type="number" class="pagination__input" min="1" max="${this.totalPages}" placeholder="Page" aria-label="Go to page number">
        <button class="pagination__btn pagination__btn--go" aria-label="Go to entered page">Go</button>
      </div>
    `;

    this.pagination.classList.remove('hidden');
  }

  /**
   * Calculate page window for pagination (max 7 visible)
   * @returns {{startPage: number, endPage: number}}
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
   * Open purchase detail modal
   * @param {string|number} purchaseId
   */
  async openPurchaseModal(purchaseId) {
    if (!this.purchaseModal) return;

    // Show modal with loading state
    this.purchaseModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const modalLoading = this.purchaseModal.querySelector('#modalLoading');
    const modalContent = this.purchaseModal.querySelector('#modalContent');

    if (modalLoading) modalLoading.style.display = 'flex';
    if (modalContent) modalContent.classList.add('hidden');

    try {
      // Fetch purchase details and downloadable images
      const [purchaseRes, downloadsRes] = await Promise.all([
        fetch(`${this.baseUrl}/api/v1/store/purchases/${purchaseId}`, {
          method: 'GET',
          headers: getCsrfHeaders(),
          credentials: 'same-origin',
        }),
        fetch(`${this.baseUrl}/api/v1/store/purchases/${purchaseId}/downloads`, {
          method: 'GET',
          headers: getCsrfHeaders(),
          credentials: 'same-origin',
        }),
      ]);

      if (!purchaseRes.ok || !downloadsRes.ok) {
        throw new Error('Failed to load purchase details');
      }

      this.currentPurchase = await purchaseRes.json();
      const downloadsData = await downloadsRes.json();
      this.downloadablePictures = downloadsData.pictures || [];

      this.renderPurchaseModal();
    } catch (error) {
      console.error('Failed to load purchase details:', error);
      this.showToast('Failed to load purchase details. Please try again.', 'error');
      this.closePurchaseModal();
    }
  }

  /**
   * Render purchase modal content
   */
  renderPurchaseModal() {
    const modalLoading = this.purchaseModal.querySelector('#modalLoading');
    const modalContent = this.purchaseModal.querySelector('#modalContent');

    if (modalLoading) modalLoading.style.display = 'none';
    if (modalContent) modalContent.classList.remove('hidden');

    // Update modal title
    const modalTitle = this.purchaseModal.querySelector('#modalTitle');
    if (modalTitle) {
      modalTitle.textContent = this.currentPurchase.product?.title || 'Purchase Details';
    }

    // Update product info
    const productImage = this.purchaseModal.querySelector('#modalProductImage');
    const productTitle = this.purchaseModal.querySelector('#modalProductTitle');
    const productDescription = this.purchaseModal.querySelector('#modalProductDescription');
    const purchaseDate = this.purchaseModal.querySelector('#modalPurchaseDate');
    const purchaseAmount = this.purchaseModal.querySelector('#modalPurchaseAmount');

    if (productImage) {
      productImage.src = this.currentPurchase.product?.cover_image_url || '';
      productImage.alt = this.currentPurchase.product?.title || '';
    }
    if (productTitle) {
      productTitle.textContent = this.currentPurchase.product?.title || 'Untitled Product';
    }
    if (productDescription) {
      productDescription.textContent = this.currentPurchase.product?.description || '';
    }
    if (purchaseDate) {
      purchaseDate.textContent = `Purchased on ${this.formatDate(this.currentPurchase.created_at)}`;
    }
    if (purchaseAmount) {
      purchaseAmount.textContent = this.formatCurrency(this.currentPurchase.total_amount_cents);
    }

    // Update Download All button
    const downloadAllBtn = this.purchaseModal.querySelector('#downloadAllBtn');
    if (downloadAllBtn) {
      const count = this.downloadablePictures.length;
      downloadAllBtn.querySelector('span').textContent = `Download All (${count} image${count !== 1 ? 's' : ''})`;
      downloadAllBtn.disabled = count === 0;
    }

    // Render images list
    const imagesList = this.purchaseModal.querySelector('#modalImagesList');
    if (imagesList) {
      imagesList.innerHTML = this.downloadablePictures
        .map((pic) => this.renderImageItem(pic))
        .join('');

      // Bind download buttons
      imagesList.querySelectorAll('[data-action="download"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pictureId = btn.dataset.pictureId;
          this.downloadImage(pictureId);
        });
      });
    }
  }

  /**
   * Render a single image item
   * @param {Object} picture
   * @returns {string} HTML string
   */
  renderImageItem(picture) {
    return `
      <div class="purchase-image-item" role="listitem">
        <img class="purchase-image-item__thumbnail"
             src="${this.escapeHtml(picture.thumbnail_url || picture.url || '')}"
             alt="${this.escapeHtml(picture.title || 'Image')}"
             loading="lazy">
        <div class="purchase-image-item__info">
          <h5 class="purchase-image-item__title">${this.escapeHtml(picture.title || 'Untitled')}</h5>
          ${picture.download_count !== undefined ? `<p class="purchase-image-item__meta">Downloaded ${picture.download_count} time${picture.download_count !== 1 ? 's' : ''}</p>` : ''}
        </div>
        <div class="purchase-image-item__download">
          <button type="button" class="btn btn--success btn--sm" data-action="download" data-picture-id="${picture.id}">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            Download
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Close purchase modal
   */
  closePurchaseModal() {
    if (this.purchaseModal) {
      this.purchaseModal.classList.add('hidden');
      document.body.style.overflow = '';
    }
    this.currentPurchase = null;
    this.downloadablePictures = [];
  }

  /**
   * Show download all confirmation modal
   */
  showDownloadAllConfirm() {
    if (!this.confirmModal || this.downloadablePictures.length === 0) return;

    const message = this.confirmModal.querySelector('#confirmModalMessage');
    if (message) {
      const count = this.downloadablePictures.length;
      message.textContent = `This will download ${count} image${count !== 1 ? 's' : ''} as a ZIP file. Continue?`;
    }

    this.confirmModal.classList.remove('hidden');
  }

  /**
   * Close confirm modal
   */
  closeConfirmModal() {
    if (this.confirmModal) {
      this.confirmModal.classList.add('hidden');
    }
  }

  /**
   * Download a single image
   * @param {string|number} pictureId
   */
  async downloadImage(pictureId) {
    if (!this.currentPurchase) return;

    try {
      const downloadUrl = `${this.baseUrl}/api/v1/store/downloads/${this.currentPurchase.id}/${pictureId}`;

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.showToast('Download started!', 'success');
    } catch (error) {
      console.error('Download failed:', error);
      this.showToast('Download failed. Please try again.', 'error');
    }
  }

  /**
   * Handle download all images
   */
  async handleDownloadAll() {
    this.closeConfirmModal();

    if (!this.currentPurchase || this.downloadablePictures.length === 0) return;

    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
      downloadAllBtn.disabled = true;
      downloadAllBtn.classList.add('btn--loading');
      downloadAllBtn.querySelector('span').textContent = 'Preparing download...';
    }

    try {
      // Download each image sequentially
      // Note: A proper implementation would have a backend endpoint that creates a ZIP
      // For now, we download them one by one
      for (const pic of this.downloadablePictures) {
        await this.downloadImage(pic.id);
        // Small delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      this.showToast(`${this.downloadablePictures.length} images downloaded!`, 'success');
    } catch (error) {
      console.error('Download all failed:', error);
      this.showToast('Some downloads failed. Please try again.', 'error');
    } finally {
      if (downloadAllBtn) {
        downloadAllBtn.disabled = false;
        downloadAllBtn.classList.remove('btn--loading');
        const count = this.downloadablePictures.length;
        downloadAllBtn.querySelector('span').textContent = `Download All (${count} image${count !== 1 ? 's' : ''})`;
      }
    }
  }

  /**
   * Format date string
   * @param {string} dateStr
   * @returns {string}
   */
  formatDate(dateStr) {
    if (!dateStr) return 'Unknown date';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Format currency (cents to EUR)
   * @param {number} cents
   * @returns {string}
   */
  formatCurrency(cents) {
    if (cents === undefined || cents === null) return '0.00';
    const euros = cents / 100;
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR',
    }).format(euros);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Default toast implementation
   * @param {string} message
   * @param {string} type
   */
  defaultToast(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

export default PurchasesPage;
