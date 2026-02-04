/**
 * Pagination Component
 *
 * Reusable pagination widget with:
 * - First/Last/Prev/Next buttons
 * - Page number buttons (max 7 visible, active centered)
 * - Go to page input
 *
 * @example
 * const pagination = new Pagination(document.getElementById('pagination'), {
 *   currentPage: 1,
 *   totalPages: 10,
 *   onPageChange: (page) => loadPage(page)
 * });
 */
export class Pagination {
  /**
   * @param {HTMLElement} container - Container element for pagination
   * @param {Object} options - Configuration options
   * @param {number} options.currentPage - Current active page (1-indexed)
   * @param {number} options.totalPages - Total number of pages
   * @param {Function} options.onPageChange - Callback when page changes
   */
  constructor(container, options = {}) {
    if (!container) {
      console.error('Pagination: Container element required');
      return;
    }

    this.container = container;
    this.currentPage = options.currentPage || 1;
    this.totalPages = options.totalPages || 1;
    this.onPageChange = options.onPageChange || (() => {});

    this.render();
    this.bindEvents();
  }

  /**
   * Calculate which page numbers to display
   * Shows max 7 pages with active page centered when possible
   * @returns {{startPage: number, endPage: number}}
   */
  calculatePageWindow() {
    const maxVisible = 7;
    const halfWindow = 3;

    let startPage, endPage;

    if (this.totalPages <= maxVisible) {
      // Show all pages if total <= 7
      startPage = 1;
      endPage = this.totalPages;
    } else if (this.currentPage <= halfWindow + 1) {
      // Near start: show 1-7
      startPage = 1;
      endPage = maxVisible;
    } else if (this.currentPage >= this.totalPages - halfWindow) {
      // Near end: show last 7
      startPage = this.totalPages - maxVisible + 1;
      endPage = this.totalPages;
    } else {
      // Middle: center current page
      startPage = this.currentPage - halfWindow;
      endPage = this.currentPage + halfWindow;
    }

    return { startPage, endPage };
  }

  /**
   * Render the pagination HTML
   */
  render() {
    if (this.totalPages <= 1) {
      this.container.innerHTML = '';
      return;
    }

    const { startPage, endPage } = this.calculatePageWindow();

    // Build page buttons
    let pagesHtml = '';
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage;
      pagesHtml += `
        <button
          class="pagination__btn ${isActive ? 'pagination__btn--active' : ''}"
          data-page="${i}"
          ${isActive ? 'aria-current="page" disabled' : ''}
        >
          ${i}
        </button>
      `;
    }

    this.container.innerHTML = `
      <nav class="pagination" aria-label="Pagination">
        <button
          class="pagination__btn pagination__btn--first"
          data-page="1"
          ${this.currentPage === 1 ? 'disabled' : ''}
          aria-label="Go to first page"
        >
          First
        </button>
        <button
          class="pagination__btn pagination__btn--prev"
          data-page="${this.currentPage - 1}"
          ${this.currentPage === 1 ? 'disabled' : ''}
          aria-label="Go to previous page"
        >
          Prev
        </button>

        <div class="pagination__pages">${pagesHtml}</div>

        <button
          class="pagination__btn pagination__btn--next"
          data-page="${this.currentPage + 1}"
          ${this.currentPage === this.totalPages ? 'disabled' : ''}
          aria-label="Go to next page"
        >
          Next
        </button>
        <button
          class="pagination__btn pagination__btn--last"
          data-page="${this.totalPages}"
          ${this.currentPage === this.totalPages ? 'disabled' : ''}
          aria-label="Go to last page"
        >
          Last
        </button>

        <div class="pagination__goto">
          <input
            type="number"
            class="pagination__input"
            min="1"
            max="${this.totalPages}"
            placeholder="Page"
            aria-label="Go to page number"
          >
          <button class="pagination__btn pagination__btn--go" aria-label="Go to entered page">Go</button>
        </div>
      </nav>
    `;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Page button clicks
    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('.pagination__btn[data-page]');
      if (btn && !btn.disabled) {
        const page = parseInt(btn.dataset.page, 10);
        this.goToPage(page);
      }
    });

    // Go button click
    const goBtn = this.container.querySelector('.pagination__btn--go');
    const input = this.container.querySelector('.pagination__input');

    if (goBtn && input) {
      goBtn.addEventListener('click', () => {
        const page = parseInt(input.value, 10);
        if (page >= 1 && page <= this.totalPages) {
          this.goToPage(page);
        }
      });

      // Enter key in input
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const page = parseInt(input.value, 10);
          if (page >= 1 && page <= this.totalPages) {
            this.goToPage(page);
          }
        }
      });
    }
  }

  /**
   * Navigate to a specific page
   * @param {number} page - Page number to navigate to
   */
  goToPage(page) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.render();
    this.bindEvents();
    this.onPageChange(page);
  }

  /**
   * Update pagination state and re-render
   * @param {number} currentPage - New current page
   * @param {number} totalPages - New total pages
   */
  update(currentPage, totalPages) {
    this.currentPage = currentPage;
    this.totalPages = totalPages;
    this.render();
    this.bindEvents();
  }

  /**
   * Get current page
   * @returns {number}
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Get total pages
   * @returns {number}
   */
  getTotalPages() {
    return this.totalPages;
  }
}
