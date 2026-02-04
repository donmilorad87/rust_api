import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * BlogCategoriesPage Controller
 *
 * Handles blog category management:
 * - Display categories in a hierarchical tree
 * - Create, edit, delete categories
 * - Drag-and-drop reordering
 * - Parent category selection
 */
export class BlogCategoriesPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;

    // DOM Elements
    this.categoryTree = document.getElementById('categoryTree');
    this.categoryModal = document.getElementById('categoryModal');
    this.confirmModal = document.getElementById('confirmModal');
    this.searchInput = document.getElementById('searchInput');
    this.addCategoryBtn = document.getElementById('addCategoryBtn');

    // State
    this.categories = [];
    this.flatCategories = [];
    this.editingCategory = null;
    this.pendingAction = null;
    this.expandedIds = new Set();

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.bindEvents();

    // Check if categories are already server-rendered (SSR)
    const hasServerRenderedCategories = this.categoryTree &&
      this.categoryTree.querySelectorAll('.category-item[data-id]').length > 0;

    if (!hasServerRenderedCategories) {
      this.loadCategories();
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Add category button
    if (this.addCategoryBtn) {
      this.addCategoryBtn.addEventListener('click', () => this.openModal());
    }

    // Search input
    if (this.searchInput) {
      let debounceTimer;
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.filterCategories(e.target.value);
        }, 300);
      });
    }

    // Category modal events
    if (this.categoryModal) {
      const closeBtn = this.categoryModal.querySelector('[data-action="close"]');
      const cancelBtn = this.categoryModal.querySelector('[data-action="cancel"]');
      const saveBtn = this.categoryModal.querySelector('[data-action="save"]');

      if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
      if (saveBtn) saveBtn.addEventListener('click', () => this.saveCategory());

      // Close on backdrop click
      this.categoryModal.addEventListener('click', (e) => {
        if (e.target === this.categoryModal) this.closeModal();
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

    // Delegated events for category tree
    if (this.categoryTree) {
      this.categoryTree.addEventListener('click', (e) => this.handleTreeClick(e));
    }
  }

  /**
   * Handle clicks in category tree
   * @param {Event} e - Click event
   */
  handleTreeClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const categoryId = target.dataset.id;

    switch (action) {
      case 'toggle':
        this.toggleCategory(categoryId);
        break;
      case 'edit':
        this.editCategory(categoryId);
        break;
      case 'delete':
        this.confirmDeleteCategory(categoryId);
        break;
      case 'add-child':
        this.openModal(categoryId);
        break;
    }
  }

  /**
   * Load categories from API
   */
  async loadCategories() {
    if (!this.categoryTree) return;

    this.renderLoading();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/categories`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.flatCategories = data.categories || [];
        this.categories = this.buildTree(this.flatCategories);
        this.renderTree();
      } else {
        throw new Error(data.message || 'Failed to load categories');
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      this.showToast('Failed to load categories', 'error');
      this.renderError();
    }
  }

  /**
   * Build hierarchical tree from flat list
   * @param {Array} items - Flat list of categories
   * @returns {Array} Tree structure
   */
  buildTree(items) {
    const map = new Map();
    const roots = [];

    // First pass: create map
    items.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    // Second pass: build tree
    items.forEach(item => {
      const node = map.get(item.id);
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort by position
    const sortByPosition = (a, b) => (a.position || 0) - (b.position || 0);
    roots.sort(sortByPosition);
    map.forEach(node => node.children.sort(sortByPosition));

    return roots;
  }

  /**
   * Render the category tree
   */
  renderTree() {
    if (!this.categoryTree) return;

    if (this.categories.length === 0) {
      this.categoryTree.innerHTML = `
        <div class="category-tree__empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <p>No categories yet. Create your first category!</p>
        </div>
      `;
      return;
    }

    this.categoryTree.innerHTML = `
      <ul class="category-tree__list">
        ${this.categories.map(cat => this.renderCategoryItem(cat, 0)).join('')}
      </ul>
    `;
  }

  /**
   * Render a single category item
   * @param {Object} category - Category data
   * @param {number} depth - Nesting depth
   * @returns {string} HTML string
   */
  renderCategoryItem(category, depth) {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = this.expandedIds.has(String(category.id));
    const postCount = category.post_count || 0;

    const childrenHtml = hasChildren
      ? `<ul class="category-item__children ${isExpanded ? '' : 'category-item__children--hidden'}">
           ${category.children.map(child => this.renderCategoryItem(child, depth + 1)).join('')}
         </ul>`
      : '';

    return `
      <li class="category-item" data-id="${category.id}">
        <div class="category-item__row">
          <button class="category-item__toggle ${isExpanded ? 'category-item__toggle--expanded' : ''} ${hasChildren ? '' : 'category-item__toggle--hidden'}"
                  data-action="toggle"
                  data-id="${category.id}"
                  aria-label="${isExpanded ? 'Collapse' : 'Expand'} category">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <div class="category-item__drag-handle">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
              <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
            </svg>
          </div>
          <div class="category-item__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="category-item__content">
            <div class="category-item__name">${this.escapeHtml(category.name)}</div>
            <div class="category-item__meta">
              <span class="category-item__count">${postCount} posts</span>
              ${category.slug ? `<span class="category-item__slug">/${category.slug}</span>` : ''}
            </div>
          </div>
          <div class="category-item__actions">
            <button class="btn btn--icon" data-action="add-child" data-id="${category.id}" title="Add subcategory">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="edit" data-id="${category.id}" title="Edit">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="delete" data-id="${category.id}" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        ${childrenHtml}
      </li>
    `;
  }

  /**
   * Toggle category expansion
   * @param {string} categoryId - Category ID
   */
  toggleCategory(categoryId) {
    if (this.expandedIds.has(categoryId)) {
      this.expandedIds.delete(categoryId);
    } else {
      this.expandedIds.add(categoryId);
    }
    this.renderTree();
  }

  /**
   * Filter categories by search term
   * @param {string} term - Search term
   */
  filterCategories(term) {
    if (!term) {
      this.categories = this.buildTree(this.flatCategories);
    } else {
      const lowerTerm = term.toLowerCase();
      const filtered = this.flatCategories.filter(cat =>
        cat.name.toLowerCase().includes(lowerTerm) ||
        (cat.slug && cat.slug.toLowerCase().includes(lowerTerm))
      );
      this.categories = this.buildTree(filtered);
      // Expand all when searching
      this.expandedIds = new Set(this.flatCategories.map(c => String(c.id)));
    }
    this.renderTree();
  }

  /**
   * Open category modal
   * @param {string|null} parentId - Parent category ID (for subcategories)
   */
  openModal(parentId = null) {
    if (!this.categoryModal) return;

    this.editingCategory = null;
    const titleEl = this.categoryModal.querySelector('.category-modal__title');
    const form = this.categoryModal.querySelector('form');
    const parentSelect = this.categoryModal.querySelector('#categoryParent');

    if (titleEl) titleEl.textContent = parentId ? 'Add Subcategory' : 'Add Category';
    if (form) form.reset();

    // Populate parent select
    if (parentSelect) {
      parentSelect.innerHTML = '<option value="">None (Root Category)</option>';
      this.flatCategories.forEach(cat => {
        parentSelect.innerHTML += `<option value="${cat.id}">${'  '.repeat(this.getCategoryDepth(cat.id))}${this.escapeHtml(cat.name)}</option>`;
      });
      if (parentId) parentSelect.value = parentId;
    }

    this.categoryModal.classList.add('category-modal--visible');
    this.categoryModal.setAttribute('aria-hidden', 'false');

    // Focus first input
    const firstInput = this.categoryModal.querySelector('input:not([type="hidden"])');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }

  /**
   * Edit a category
   * @param {string} categoryId - Category ID
   */
  editCategory(categoryId) {
    const category = this.flatCategories.find(c => String(c.id) === String(categoryId));
    if (!category) return;

    this.editingCategory = category;

    if (!this.categoryModal) return;

    const titleEl = this.categoryModal.querySelector('.category-modal__title');
    const nameInput = this.categoryModal.querySelector('#categoryName');
    const slugInput = this.categoryModal.querySelector('#categorySlug');
    const descInput = this.categoryModal.querySelector('#categoryDescription');
    const parentSelect = this.categoryModal.querySelector('#categoryParent');

    if (titleEl) titleEl.textContent = 'Edit Category';
    if (nameInput) nameInput.value = category.name || '';
    if (slugInput) slugInput.value = category.slug || '';
    if (descInput) descInput.value = category.description || '';

    // Populate parent select (excluding self and descendants)
    if (parentSelect) {
      const excludeIds = this.getDescendantIds(categoryId);
      excludeIds.add(String(categoryId));

      parentSelect.innerHTML = '<option value="">None (Root Category)</option>';
      this.flatCategories.forEach(cat => {
        if (!excludeIds.has(String(cat.id))) {
          parentSelect.innerHTML += `<option value="${cat.id}">${'  '.repeat(this.getCategoryDepth(cat.id))}${this.escapeHtml(cat.name)}</option>`;
        }
      });
      if (category.parent_id) parentSelect.value = category.parent_id;
    }

    this.categoryModal.classList.add('category-modal--visible');
    this.categoryModal.setAttribute('aria-hidden', 'false');
  }

  /**
   * Get all descendant IDs of a category
   * @param {string} categoryId - Category ID
   * @returns {Set} Set of descendant IDs
   */
  getDescendantIds(categoryId) {
    const descendants = new Set();
    const findDescendants = (parentId) => {
      this.flatCategories.forEach(cat => {
        if (String(cat.parent_id) === String(parentId)) {
          descendants.add(String(cat.id));
          findDescendants(cat.id);
        }
      });
    };
    findDescendants(categoryId);
    return descendants;
  }

  /**
   * Get depth of a category
   * @param {string} categoryId - Category ID
   * @returns {number} Depth
   */
  getCategoryDepth(categoryId) {
    let depth = 0;
    let category = this.flatCategories.find(c => String(c.id) === String(categoryId));
    while (category && category.parent_id) {
      depth++;
      category = this.flatCategories.find(c => String(c.id) === String(category.parent_id));
    }
    return depth;
  }

  /**
   * Close category modal
   */
  closeModal() {
    if (!this.categoryModal) return;
    this.categoryModal.classList.remove('category-modal--visible');
    this.categoryModal.setAttribute('aria-hidden', 'true');
    this.editingCategory = null;
  }

  /**
   * Save category (create or update)
   */
  async saveCategory() {
    const nameInput = this.categoryModal?.querySelector('#categoryName');
    const slugInput = this.categoryModal?.querySelector('#categorySlug');
    const descInput = this.categoryModal?.querySelector('#categoryDescription');
    const parentSelect = this.categoryModal?.querySelector('#categoryParent');

    if (!nameInput?.value.trim()) {
      this.showToast('Category name is required', 'error');
      return;
    }

    const payload = {
      name: nameInput.value.trim(),
      slug: slugInput?.value.trim() || null,
      description: descInput?.value.trim() || null,
      parent_id: parentSelect?.value ? parseInt(parentSelect.value, 10) : null
    };

    try {
      const isEditing = !!this.editingCategory;
      const url = isEditing
        ? `${this.baseUrl}/api/v1/admin/blog/categories/${this.editingCategory.id}`
        : `${this.baseUrl}/api/v1/admin/blog/categories`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save category');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast(`Category ${isEditing ? 'updated' : 'created'} successfully`, 'success');
        this.closeModal();
        this.loadCategories();
      } else {
        throw new Error(data.message || 'Failed to save category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      this.showToast(error.message || 'Failed to save category', 'error');
    }
  }

  /**
   * Confirm delete category
   * @param {string} categoryId - Category ID
   */
  confirmDeleteCategory(categoryId) {
    const category = this.flatCategories.find(c => String(c.id) === String(categoryId));
    if (!category) return;

    const hasChildren = this.flatCategories.some(c => String(c.parent_id) === String(categoryId));
    let message = `Are you sure you want to delete "${category.name}"?`;
    if (hasChildren) {
      message += ' This will also delete all subcategories.';
    }

    this.pendingAction = () => this.deleteCategory(categoryId);
    this.openConfirmModal('Delete Category', message);
  }

  /**
   * Delete a category
   * @param {string} categoryId - Category ID
   */
  async deleteCategory(categoryId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/categories/${categoryId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete category');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Category deleted successfully', 'success');
        this.loadCategories();
      } else {
        throw new Error(data.message || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      this.showToast('Failed to delete category', 'error');
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
   * Render loading state
   */
  renderLoading() {
    if (!this.categoryTree) return;
    this.categoryTree.innerHTML = `
      <div class="loading-spinner">
        <div class="loading-spinner__icon"></div>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError() {
    if (!this.categoryTree) return;
    this.categoryTree.innerHTML = `
      <div class="category-tree__empty">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>Failed to load categories. Please try again.</p>
      </div>
    `;
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
