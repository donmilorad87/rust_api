import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * BlogTagsPage Controller
 *
 * Handles blog tag management:
 * - Display tags in a table with inline editing
 * - Create, edit, delete tags
 * - Tag cloud preview
 * - Color customization
 * - Pagination
 */
export class BlogTagsPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;

    // DOM Elements
    this.tagsTable = document.getElementById('tagsTableBody');
    this.tagCloud = document.getElementById('tagCloud');
    this.tagModal = document.getElementById('tagModal');
    this.confirmModal = document.getElementById('confirmModal');
    this.searchInput = document.getElementById('searchInput');
    this.addTagBtn = document.getElementById('addTagBtn');
    this.pagination = document.getElementById('pagination');

    // State
    this.tags = [];
    this.totalTags = 0;
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.editingTag = null;
    this.editingInlineId = null;
    this.pendingAction = null;
    this.searchTerm = '';

    // Color presets
    this.colorPresets = [
      '#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1'
    ];

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.bindEvents();

    // Check if tags are already server-rendered (SSR)
    const hasServerRenderedTags = this.tagsTable &&
      this.tagsTable.querySelectorAll('tr[data-id]').length > 0;

    if (!hasServerRenderedTags) {
      this.loadTags();
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Add tag button
    if (this.addTagBtn) {
      this.addTagBtn.addEventListener('click', () => this.openModal());
    }

    // Search input
    if (this.searchInput) {
      let debounceTimer;
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchTerm = e.target.value;
          this.currentPage = 1;
          this.loadTags();
        }, 300);
      });
    }

    // Tag modal events
    if (this.tagModal) {
      const closeBtn = this.tagModal.querySelector('[data-action="close"]');
      const cancelBtn = this.tagModal.querySelector('[data-action="cancel"]');
      const saveBtn = this.tagModal.querySelector('[data-action="save"]');

      if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
      if (saveBtn) saveBtn.addEventListener('click', () => this.saveTag());

      // Color preset selection
      this.tagModal.querySelectorAll('[data-color]').forEach(preset => {
        preset.addEventListener('click', (e) => {
          const color = e.target.dataset.color;
          const colorInput = this.tagModal.querySelector('#tagColor');
          if (colorInput) colorInput.value = color;
          this.updateColorPresetSelection(color);
        });
      });

      // Color input change
      const colorInput = this.tagModal.querySelector('#tagColor');
      if (colorInput) {
        colorInput.addEventListener('input', (e) => {
          this.updateColorPresetSelection(e.target.value);
        });
      }

      // Close on backdrop click
      this.tagModal.addEventListener('click', (e) => {
        if (e.target === this.tagModal) this.closeModal();
      });
    }

    // Confirm modal events
    if (this.confirmModal) {
      const confirmBtn = this.confirmModal.querySelector('[data-action="confirm"]');
      const cancelBtn = this.confirmModal.querySelector('[data-action="cancel"]');

      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          if (this.pendingAction) {
            this.pendingAction();
            this.pendingAction = null;
          }
          this.closeConfirmModal();
        });
      }
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeConfirmModal());

      this.confirmModal.addEventListener('click', (e) => {
        if (e.target === this.confirmModal) this.closeConfirmModal();
      });
    }

    // Delegated events for tags table
    if (this.tagsTable) {
      this.tagsTable.addEventListener('click', (e) => this.handleTableClick(e));
      this.tagsTable.addEventListener('keydown', (e) => this.handleInlineKeydown(e));
    }

    // Refresh tag cloud button
    const refreshCloudBtn = document.querySelector('[data-action="refresh-cloud"]');
    if (refreshCloudBtn) {
      refreshCloudBtn.addEventListener('click', () => this.renderTagCloud());
    }
  }

  /**
   * Handle clicks in tags table
   * @param {Event} e - Click event
   */
  handleTableClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) {
      // Check if clicking on tag name for inline edit
      const nameEl = e.target.closest('.tag-cell__name');
      if (nameEl) {
        const tagId = nameEl.closest('tr')?.dataset.id;
        if (tagId) this.startInlineEdit(tagId);
      }
      return;
    }

    const action = target.dataset.action;
    const tagId = target.dataset.id || target.closest('tr')?.dataset.id;

    switch (action) {
      case 'edit':
        this.editTag(tagId);
        break;
      case 'delete':
        this.confirmDeleteTag(tagId);
        break;
      case 'inline-save':
        this.saveInlineEdit(tagId);
        break;
      case 'inline-cancel':
        this.cancelInlineEdit(tagId);
        break;
    }
  }

  /**
   * Handle keydown in inline edit input
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleInlineKeydown(e) {
    if (!this.editingInlineId) return;

    const input = e.target.closest('.tag-cell__input');
    if (!input) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      this.saveInlineEdit(this.editingInlineId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelInlineEdit(this.editingInlineId);
    }
  }

  /**
   * Load tags from API
   */
  async loadTags() {
    if (!this.tagsTable) return;

    this.renderLoading();

    try {
      const offset = (this.currentPage - 1) * this.itemsPerPage;
      const params = new URLSearchParams({
        limit: this.itemsPerPage,
        offset: offset
      });

      if (this.searchTerm) {
        params.append('search', this.searchTerm);
      }

      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/tags?${params}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load tags');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.tags = data.tags || [];
        this.totalTags = data.total || 0;
        this.renderTable();
        this.renderPagination();
        this.renderTagCloud();
      } else {
        throw new Error(data.message || 'Failed to load tags');
      }
    } catch (error) {
      console.error('Error loading tags:', error);
      this.showToast('Failed to load tags', 'error');
      this.renderError();
    }
  }

  /**
   * Render tags table
   */
  renderTable() {
    if (!this.tagsTable) return;

    if (this.tags.length === 0) {
      this.tagsTable.innerHTML = `
        <tr>
          <td colspan="5" class="tags-table__empty">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            <p>No tags yet. Create your first tag!</p>
          </td>
        </tr>
      `;
      return;
    }

    this.tagsTable.innerHTML = this.tags.map(tag => this.renderTagRow(tag)).join('');
  }

  /**
   * Render a single tag row
   * @param {Object} tag - Tag data
   * @returns {string} HTML string
   */
  renderTagRow(tag) {
    const isEditing = this.editingInlineId === String(tag.id);
    const tagColor = tag.color || '#667eea';
    const postCount = tag.post_count || 0;

    return `
      <tr data-id="${tag.id}">
        <td>
          <div class="tag-cell ${isEditing ? 'tag-cell--editing' : ''}">
            <div class="tag-cell__display">
              <span class="tag-cell__color" style="background-color: ${tagColor}"></span>
              <span class="tag-cell__name">${this.escapeHtml(tag.name)}</span>
            </div>
            <div class="tag-cell__edit">
              <input type="text" class="tag-cell__input" value="${this.escapeHtml(tag.name)}" />
              <button class="btn btn--icon btn--xs" data-action="inline-save" title="Save">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
              <button class="btn btn--icon btn--xs" data-action="inline-cancel" title="Cancel">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </td>
        <td>${this.escapeHtml(tag.slug || '')}</td>
        <td>${postCount}</td>
        <td>${this.formatDate(tag.created_at)}</td>
        <td>
          <div class="tag-actions">
            <button class="btn btn--icon" data-action="edit" data-id="${tag.id}" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="delete" data-id="${tag.id}" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render tag cloud preview
   */
  renderTagCloud() {
    if (!this.tagCloud) return;

    if (this.tags.length === 0) {
      this.tagCloud.innerHTML = '<div class="tag-cloud__empty">No tags to display</div>';
      return;
    }

    // Calculate size class based on post count
    const maxCount = Math.max(...this.tags.map(t => t.post_count || 0), 1);

    this.tagCloud.innerHTML = this.tags.map(tag => {
      const count = tag.post_count || 0;
      const ratio = count / maxCount;
      let sizeClass = 'xs';
      if (ratio > 0.8) sizeClass = 'xl';
      else if (ratio > 0.6) sizeClass = 'lg';
      else if (ratio > 0.4) sizeClass = 'md';
      else if (ratio > 0.2) sizeClass = 'sm';

      return `
        <span class="tag-cloud-item tag-cloud-item--${sizeClass}" style="border-color: ${tag.color || '#667eea'}20">
          ${this.escapeHtml(tag.name)}
          <span class="tag-cloud-item__count">(${count})</span>
        </span>
      `;
    }).join('');
  }

  /**
   * Start inline editing
   * @param {string} tagId - Tag ID
   */
  startInlineEdit(tagId) {
    if (this.editingInlineId) {
      this.cancelInlineEdit(this.editingInlineId);
    }

    this.editingInlineId = String(tagId);
    this.renderTable();

    // Focus input
    const row = this.tagsTable.querySelector(`tr[data-id="${tagId}"]`);
    const input = row?.querySelector('.tag-cell__input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  /**
   * Save inline edit
   * @param {string} tagId - Tag ID
   */
  async saveInlineEdit(tagId) {
    const row = this.tagsTable.querySelector(`tr[data-id="${tagId}"]`);
    const input = row?.querySelector('.tag-cell__input');
    const newName = input?.value.trim();

    if (!newName) {
      this.showToast('Tag name cannot be empty', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/tags/${tagId}`, {
        method: 'PUT',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({ name: newName })
      });

      if (!response.ok) {
        throw new Error('Failed to update tag');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Tag updated successfully', 'success');
        this.editingInlineId = null;
        this.loadTags();
      } else {
        throw new Error(data.message || 'Failed to update tag');
      }
    } catch (error) {
      console.error('Error updating tag:', error);
      this.showToast('Failed to update tag', 'error');
    }
  }

  /**
   * Cancel inline edit
   * @param {string} tagId - Tag ID
   */
  cancelInlineEdit(tagId) {
    this.editingInlineId = null;
    this.renderTable();
  }

  /**
   * Open tag modal
   */
  openModal() {
    if (!this.tagModal) return;

    this.editingTag = null;
    const titleEl = this.tagModal.querySelector('.tag-modal__title');
    const form = this.tagModal.querySelector('form');
    const colorInput = this.tagModal.querySelector('#tagColor');

    if (titleEl) titleEl.textContent = 'Add Tag';
    if (form) form.reset();
    if (colorInput) colorInput.value = this.colorPresets[0];
    this.updateColorPresetSelection(this.colorPresets[0]);

    this.tagModal.classList.add('tag-modal--visible');
    this.tagModal.setAttribute('aria-hidden', 'false');

    // Focus first input
    const firstInput = this.tagModal.querySelector('input[type="text"]');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }

  /**
   * Edit a tag
   * @param {string} tagId - Tag ID
   */
  editTag(tagId) {
    const tag = this.tags.find(t => String(t.id) === String(tagId));
    if (!tag) return;

    this.editingTag = tag;

    if (!this.tagModal) return;

    const titleEl = this.tagModal.querySelector('.tag-modal__title');
    const nameInput = this.tagModal.querySelector('#tagName');
    const slugInput = this.tagModal.querySelector('#tagSlug');
    const descriptionInput = this.tagModal.querySelector('#tagDescription');
    const colorInput = this.tagModal.querySelector('#tagColor');

    if (titleEl) titleEl.textContent = 'Edit Tag';
    if (nameInput) nameInput.value = tag.name || '';
    if (slugInput) slugInput.value = tag.slug || '';
    if (descriptionInput) descriptionInput.value = tag.description || '';
    if (colorInput) colorInput.value = tag.color || this.colorPresets[0];
    this.updateColorPresetSelection(tag.color || this.colorPresets[0]);

    this.tagModal.classList.add('tag-modal--visible');
    this.tagModal.setAttribute('aria-hidden', 'false');
  }

  /**
   * Update color preset selection visual
   * @param {string} color - Selected color
   */
  updateColorPresetSelection(color) {
    if (!this.tagModal) return;

    this.tagModal.querySelectorAll('[data-color]').forEach(preset => {
      preset.classList.toggle(
        'form-group__color-preset--active',
        preset.dataset.color.toLowerCase() === color.toLowerCase()
      );
    });
  }

  /**
   * Close tag modal
   */
  closeModal() {
    if (!this.tagModal) return;
    this.tagModal.classList.remove('tag-modal--visible');
    this.tagModal.setAttribute('aria-hidden', 'true');
    this.editingTag = null;
  }

  /**
   * Generate a slug from a string
   * @param {string} str - String to slugify
   * @returns {string} Slug
   */
  generateSlug(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Save tag (create or update)
   */
  async saveTag() {
    const nameInput = this.tagModal?.querySelector('#tagName');
    const slugInput = this.tagModal?.querySelector('#tagSlug');
    const descriptionInput = this.tagModal?.querySelector('#tagDescription');

    if (!nameInput?.value.trim()) {
      this.showToast('Tag name is required', 'error');
      return;
    }

    const name = nameInput.value.trim();
    const slug = slugInput?.value.trim() || this.generateSlug(name);

    const payload = {
      name: name,
      slug: slug,
      description: descriptionInput?.value.trim() || null
    };

    try {
      const isEditing = !!this.editingTag;
      const url = isEditing
        ? `${this.baseUrl}/api/v1/admin/blog/tags/${this.editingTag.id}`
        : `${this.baseUrl}/api/v1/admin/blog/tags`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save tag');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast(`Tag ${isEditing ? 'updated' : 'created'} successfully`, 'success');
        this.closeModal();
        this.loadTags();
      } else {
        throw new Error(data.message || 'Failed to save tag');
      }
    } catch (error) {
      console.error('Error saving tag:', error);
      this.showToast(error.message || 'Failed to save tag', 'error');
    }
  }

  /**
   * Confirm delete tag
   * @param {string} tagId - Tag ID
   */
  confirmDeleteTag(tagId) {
    const tag = this.tags.find(t => String(t.id) === String(tagId));
    if (!tag) return;

    this.pendingAction = () => this.deleteTag(tagId);
    this.openConfirmModal('Delete Tag', `Are you sure you want to delete "${tag.name}"?`);
  }

  /**
   * Delete a tag
   * @param {string} tagId - Tag ID
   */
  async deleteTag(tagId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/tags/${tagId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete tag');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Tag deleted successfully', 'success');
        this.loadTags();
      } else {
        throw new Error(data.message || 'Failed to delete tag');
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
      this.showToast('Failed to delete tag', 'error');
    }
  }

  /**
   * Open confirm modal
   * @param {string} title - Modal title
   * @param {string} message - Modal message
   */
  openConfirmModal(title, message) {
    if (!this.confirmModal) return;

    const titleEl = this.confirmModal.querySelector('.confirm-modal__title');
    const messageEl = this.confirmModal.querySelector('.confirm-modal__message');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    this.confirmModal.classList.add('confirm-modal--visible');
  }

  /**
   * Close confirm modal
   */
  closeConfirmModal() {
    if (!this.confirmModal) return;
    this.confirmModal.classList.remove('confirm-modal--visible');
    this.pendingAction = null;
  }

  /**
   * Render pagination
   */
  renderPagination() {
    if (!this.pagination) return;

    const totalPages = Math.ceil(this.totalTags / this.itemsPerPage);

    if (totalPages <= 1) {
      this.pagination.innerHTML = '';
      return;
    }

    const { startPage, endPage } = this.calculatePageWindow(this.currentPage, totalPages);

    let html = '<nav class="pagination" aria-label="Pagination">';

    // First button
    html += `<button class="pagination__btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="1">First</button>`;

    // Previous button
    html += `<button class="pagination__btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">Prev</button>`;

    // Page numbers
    html += '<div class="pagination__pages">';
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === this.currentPage;
      html += `<button class="pagination__btn ${isActive ? 'pagination__btn--active' : ''}" data-page="${i}" ${isActive ? 'disabled' : ''}>${i}</button>`;
    }
    html += '</div>';

    // Next button
    html += `<button class="pagination__btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">Next</button>`;

    // Last button
    html += `<button class="pagination__btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${totalPages}">Last</button>`;

    // Go to page
    html += `
      <div class="pagination__goto">
        <input type="number" class="pagination__input" min="1" max="${totalPages}" placeholder="Page">
        <button class="pagination__btn" data-action="goto">Go</button>
      </div>
    `;

    html += '</nav>';

    this.pagination.innerHTML = html;

    // Bind pagination events
    this.pagination.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.loadTags();
        }
      });
    });

    // Go button
    const goBtn = this.pagination.querySelector('[data-action="goto"]');
    const input = this.pagination.querySelector('.pagination__input');
    if (goBtn && input) {
      goBtn.addEventListener('click', () => {
        const page = parseInt(input.value, 10);
        if (page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.loadTags();
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const page = parseInt(input.value, 10);
          if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.loadTags();
          }
        }
      });
    }
  }

  /**
   * Calculate page window for pagination
   * @param {number} currentPage
   * @param {number} totalPages
   * @returns {{startPage: number, endPage: number}}
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
   * Render loading state
   */
  renderLoading() {
    if (!this.tagsTable) return;
    this.tagsTable.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="loading-spinner">
            <div class="loading-spinner__icon"></div>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render error state
   */
  renderError() {
    if (!this.tagsTable) return;
    this.tagsTable.innerHTML = `
      <tr>
        <td colspan="5" class="tags-table__empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <p>Failed to load tags. Please try again.</p>
        </td>
      </tr>
    `;
  }

  /**
   * Format date
   * @param {string} dateStr - Date string
   * @returns {string} Formatted date
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
