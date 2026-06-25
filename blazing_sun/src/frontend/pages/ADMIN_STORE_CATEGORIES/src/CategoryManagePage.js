import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * CategoryManagePage Controller
 *
 * Handles admin store category management functionality:
 * - Display all categories in a draggable table
 * - Create/Edit/Delete categories
 * - Drag-to-reorder functionality
 * - Toggle active status
 */

import { CategoryModal } from './CategoryModal.js';
import { ConfirmModal } from './ConfirmModal.js';
import { ImagePickerModal } from './ImagePickerModal.js';

export class CategoryManagePage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {HTMLElement} options.categoriesTable - Table body element
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.categoriesTable = options.categoriesTable;
    this.showToast = options.showToast;

    // State
    this.categories = [];
    this.loading = false;
    this.draggedRow = null;
    this.draggedIndex = null;

    // Initialize modals
    this.categoryModal = new CategoryModal({
      baseUrl: this.baseUrl,
      showToast: this.showToast,
      onSave: () => this.loadCategories(),
      onImageSelect: (callback) => this.imagePicker.open(callback)
    });

    this.confirmModal = new ConfirmModal({
      showToast: this.showToast
    });

    this.imagePicker = new ImagePickerModal({
      baseUrl: this.baseUrl,
      showToast: this.showToast
    });

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.bindEvents();
    this.loadCategories();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Create button
    const createBtn = document.getElementById('createCategoryBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        this.categoryModal.open();
      });
    }

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.filterCategories(e.target.value);
        }, 300);
      });
    }

    // Delegated event handlers for table actions
    this.categoriesTable.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn) {
        const id = parseInt(editBtn.dataset.id, 10);
        const category = this.categories.find(c => c.id === id);
        if (category) {
          this.categoryModal.open(category);
        }
        return;
      }

      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        const id = parseInt(deleteBtn.dataset.id, 10);
        const category = this.categories.find(c => c.id === id);
        if (category) {
          this.confirmDelete(category);
        }
        return;
      }

      const toggleBtn = e.target.closest('[data-action="toggle"]');
      if (toggleBtn) {
        const id = parseInt(toggleBtn.dataset.id, 10);
        const category = this.categories.find(c => c.id === id);
        if (category) {
          this.toggleActive(category);
        }
        return;
      }
    });

    // Drag and drop events
    this.categoriesTable.addEventListener('dragstart', (e) => this.handleDragStart(e));
    this.categoriesTable.addEventListener('dragend', (e) => this.handleDragEnd(e));
    this.categoriesTable.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.categoriesTable.addEventListener('drop', (e) => this.handleDrop(e));
    this.categoriesTable.addEventListener('dragleave', (e) => this.handleDragLeave(e));
  }

  /**
   * Load categories from API
   */
  async loadCategories() {
    this.loading = true;
    this.renderLoading();

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
        this.renderTable();
      } else {
        throw new Error(data.message || 'Failed to load categories');
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      this.showToast('Failed to load categories', 'error');
      this.renderError();
    } finally {
      this.loading = false;
    }
  }

  /**
   * Filter categories by search term
   * @param {string} searchTerm
   */
  filterCategories(searchTerm) {
    const term = searchTerm.toLowerCase().trim();

    if (!term) {
      this.renderTable();
      return;
    }

    const filtered = this.categories.filter(category =>
      category.name.toLowerCase().includes(term) ||
      category.slug.toLowerCase().includes(term) ||
      (category.description && category.description.toLowerCase().includes(term))
    );

    this.renderTable(filtered);
  }

  /**
   * Render the categories table
   * @param {Array} categories - Optional filtered categories
   */
  renderTable(categories = null) {
    const data = categories || this.categories;

    if (data.length === 0) {
      this.renderEmpty();
      return;
    }

    const rows = data.map((category, index) => this.createRow(category, index)).join('');
    this.categoriesTable.innerHTML = rows;
  }

  /**
   * Create a table row for a category
   * @param {Object} category - Category data
   * @param {number} index - Row index for drag data
   * @returns {string} HTML string
   */
  createRow(category, index) {
    const coverHtml = category.cover_image_url
      ? `<img src="${category.cover_image_url}?variant=thumb" alt="${category.name}" class="cover-thumbnail">`
      : `<div class="cover-thumbnail cover-thumbnail--placeholder">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
             <circle cx="8.5" cy="8.5" r="1.5"></circle>
             <polyline points="21 15 16 10 5 21"></polyline>
           </svg>
         </div>`;

    const statusClass = category.is_active ? 'status-badge--active' : 'status-badge--inactive';
    const statusText = category.is_active ? 'Active' : 'Inactive';
    const toggleIcon = category.is_active
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';

    const description = category.description
      ? this.truncate(category.description, 50)
      : '<span style="color: var(--text-muted)">No description</span>';

    return `
      <tr class="categories-table__row" draggable="true" data-id="${category.id}" data-index="${index}">
        <td class="categories-table__cell categories-table__cell--drag" data-label="Order">
          <span class="drag-handle" title="Drag to reorder">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="5" r="1"></circle>
              <circle cx="9" cy="12" r="1"></circle>
              <circle cx="9" cy="19" r="1"></circle>
              <circle cx="15" cy="5" r="1"></circle>
              <circle cx="15" cy="12" r="1"></circle>
              <circle cx="15" cy="19" r="1"></circle>
            </svg>
          </span>
        </td>
        <td class="categories-table__cell categories-table__cell--cover" data-label="Cover">
          ${coverHtml}
        </td>
        <td class="categories-table__cell categories-table__cell--name" data-label="Name">
          ${this.escapeHtml(category.name)}
        </td>
        <td class="categories-table__cell categories-table__cell--slug" data-label="Slug">
          ${this.escapeHtml(category.slug)}
        </td>
        <td class="categories-table__cell categories-table__cell--description" data-label="Description" title="${this.escapeHtml(category.description || '')}">
          ${description}
        </td>
        <td class="categories-table__cell categories-table__cell--count" data-label="Products">
          ${category.product_count || 0}
        </td>
        <td class="categories-table__cell categories-table__cell--status" data-label="Status">
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>
        <td class="categories-table__cell categories-table__cell--actions" data-label="Actions">
          <div class="action-buttons">
            <button class="btn btn--icon btn--edit" data-action="edit" data-id="${category.id}" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn btn--icon btn--toggle" data-action="toggle" data-id="${category.id}" title="${category.is_active ? 'Deactivate' : 'Activate'}">
              ${toggleIcon}
            </button>
            <button class="btn btn--icon btn--delete" data-action="delete" data-id="${category.id}" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
   * Render empty state
   */
  renderEmpty() {
    this.categoriesTable.innerHTML = `
      <tr>
        <td colspan="8" class="categories-table__empty">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <p>No categories found</p>
            <div class="empty-state__action">
              <button class="btn btn--primary" id="emptyCreateBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create First Category
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;

    // Bind empty state create button
    const emptyCreateBtn = document.getElementById('emptyCreateBtn');
    if (emptyCreateBtn) {
      emptyCreateBtn.addEventListener('click', () => {
        this.categoryModal.open();
      });
    }
  }

  /**
   * Render loading state
   */
  renderLoading() {
    this.categoriesTable.innerHTML = `
      <tr>
        <td colspan="8" class="categories-table__empty">
          <div class="loading-state">
            <div class="loading-state__spinner"></div>
            <p>Loading categories...</p>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render error state
   */
  renderError() {
    this.categoriesTable.innerHTML = `
      <tr>
        <td colspan="8" class="categories-table__empty">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>Failed to load categories</p>
            <div class="empty-state__action">
              <button class="btn btn--ghost" onclick="location.reload()">
                Retry
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Confirm and delete a category
   * @param {Object} category
   */
  async confirmDelete(category) {
    const hasProducts = category.product_count && category.product_count > 0;
    const otherCategories = this.categories.filter(c => c.id !== category.id);

    this.confirmModal.open({
      title: 'Delete Category',
      message: `Are you sure you want to delete "${category.name}"?`,
      confirmLabel: 'Delete',
      confirmClass: 'btn--danger',
      showWarning: hasProducts,
      warningMessage: `This category has ${category.product_count} product(s). They will become uncategorized.`,
      showTransfer: hasProducts && otherCategories.length > 0,
      transferOptions: otherCategories,
      onConfirm: async (transferToId) => {
        await this.deleteCategory(category.id, transferToId);
      }
    });
  }

  /**
   * Delete a category
   * @param {number} categoryId
   * @param {number|null} transferToId - Optional category ID to transfer products to
   */
  async deleteCategory(categoryId, transferToId = null) {
    try {
      const url = transferToId
        ? `${this.baseUrl}/api/v1/admin/store/categories/${categoryId}?transfer_to=${transferToId}`
        : `${this.baseUrl}/api/v1/admin/store/categories/${categoryId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete category');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Category deleted successfully', 'success');
        await this.loadCategories();
      } else {
        throw new Error(data.message || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      this.showToast(error.message || 'Failed to delete category', 'error');
    }
  }

  /**
   * Toggle category active status
   * @param {Object} category
   */
  async toggleActive(category) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/categories/${category.id}`, {
        method: 'PUT',
        headers: {
          ...getCsrfHeaders(),
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          is_active: !category.is_active
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast(
          `Category ${category.is_active ? 'deactivated' : 'activated'} successfully`,
          'success'
        );
        await this.loadCategories();
      } else {
        throw new Error(data.message || 'Failed to update category');
      }
    } catch (error) {
      console.error('Error toggling category:', error);
      this.showToast('Failed to update category', 'error');
    }
  }

  // ==========================================
  // Drag and Drop Handlers
  // ==========================================

  handleDragStart(e) {
    const row = e.target.closest('.categories-table__row');
    if (!row) return;

    this.draggedRow = row;
    this.draggedIndex = parseInt(row.dataset.index, 10);
    row.classList.add('categories-table__row--dragging');

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.id);
  }

  handleDragEnd(e) {
    const row = e.target.closest('.categories-table__row');
    if (row) {
      row.classList.remove('categories-table__row--dragging');
    }

    // Remove drag-over class from all rows
    this.categoriesTable.querySelectorAll('.categories-table__row--drag-over').forEach(r => {
      r.classList.remove('categories-table__row--drag-over');
    });

    this.draggedRow = null;
    this.draggedIndex = null;
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const row = e.target.closest('.categories-table__row');
    if (!row || row === this.draggedRow) return;

    // Remove drag-over from other rows
    this.categoriesTable.querySelectorAll('.categories-table__row--drag-over').forEach(r => {
      if (r !== row) r.classList.remove('categories-table__row--drag-over');
    });

    row.classList.add('categories-table__row--drag-over');
  }

  handleDragLeave(e) {
    const row = e.target.closest('.categories-table__row');
    if (row && !row.contains(e.relatedTarget)) {
      row.classList.remove('categories-table__row--drag-over');
    }
  }

  async handleDrop(e) {
    e.preventDefault();

    const dropRow = e.target.closest('.categories-table__row');
    if (!dropRow || !this.draggedRow || dropRow === this.draggedRow) return;

    dropRow.classList.remove('categories-table__row--drag-over');

    const dropIndex = parseInt(dropRow.dataset.index, 10);
    const draggedId = parseInt(this.draggedRow.dataset.id, 10);

    if (isNaN(dropIndex) || isNaN(draggedId)) return;

    // Reorder the categories array locally first for visual feedback
    const draggedCategory = this.categories.find(c => c.id === draggedId);
    if (!draggedCategory) return;

    // Remove from old position
    this.categories = this.categories.filter(c => c.id !== draggedId);

    // Insert at new position
    this.categories.splice(dropIndex, 0, draggedCategory);

    // Re-render immediately for visual feedback
    this.renderTable();

    // Send reorder request to API
    await this.saveReorder();
  }

  /**
   * Save the new category order to the API
   */
  async saveReorder() {
    try {
      const categoryIds = this.categories.map(c => c.id);

      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/categories/reorder`, {
        method: 'POST',
        headers: {
          ...getCsrfHeaders(),
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ category_ids: categoryIds })
      });

      if (!response.ok) {
        throw new Error('Failed to save order');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Category order updated', 'success');
      } else {
        throw new Error(data.message || 'Failed to save order');
      }
    } catch (error) {
      console.error('Error saving order:', error);
      this.showToast('Failed to save category order', 'error');
      // Reload to restore server order
      await this.loadCategories();
    }
  }

  // ==========================================
  // Utility Methods
  // ==========================================

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
   * Truncate string with ellipsis
   * @param {string} str
   * @param {number} maxLen
   * @returns {string}
   */
  truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  }
}
