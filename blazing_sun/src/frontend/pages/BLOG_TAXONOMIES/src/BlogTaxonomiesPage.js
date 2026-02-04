import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * BlogTaxonomiesPage Controller
 *
 * Handles blog taxonomy management:
 * - Display taxonomies in a list
 * - Create, edit, delete taxonomies
 * - Rule builder for taxonomy rules
 * - Multi-select for categories, tags, and posts
 */
export class BlogTaxonomiesPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;

    // DOM Elements
    this.taxonomyList = document.getElementById('taxonomyList');
    this.taxonomyModal = document.getElementById('taxonomyModal');
    this.confirmModal = document.getElementById('confirmModal');
    this.searchInput = document.getElementById('searchInput');
    this.addTaxonomyBtn = document.getElementById('addTaxonomyBtn');

    // State
    this.taxonomies = [];
    this.categories = [];
    this.tags = [];
    this.posts = [];
    this.editingTaxonomy = null;
    this.pendingAction = null;
    this.rules = [];

    // Rule types
    this.ruleTypes = [
      { value: 'require_categories', label: 'Require Categories' },
      { value: 'require_tags', label: 'Require Tags' },
      { value: 'include_posts', label: 'Include Posts' },
      { value: 'exclude_posts', label: 'Exclude Posts' },
      { value: 'min_word_count', label: 'Min Word Count' },
      { value: 'max_word_count', label: 'Max Word Count' }
    ];

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.bindEvents();
    this.loadTaxonomies();
    this.loadReferenceData();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Add taxonomy button
    if (this.addTaxonomyBtn) {
      this.addTaxonomyBtn.addEventListener('click', () => this.openModal());
    }

    // Search input
    if (this.searchInput) {
      let debounceTimer;
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.filterTaxonomies(e.target.value);
        }, 300);
      });
    }

    // Taxonomy modal events
    if (this.taxonomyModal) {
      const closeBtn = this.taxonomyModal.querySelector('[data-action="close"]');
      const cancelBtn = this.taxonomyModal.querySelector('[data-action="cancel"]');
      const saveBtn = this.taxonomyModal.querySelector('[data-action="save"]');
      const addRuleBtn = this.taxonomyModal.querySelector('[data-action="add-rule"]');

      if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());
      if (saveBtn) saveBtn.addEventListener('click', () => this.saveTaxonomy());
      if (addRuleBtn) addRuleBtn.addEventListener('click', () => this.addRule());

      // Close on backdrop click
      this.taxonomyModal.addEventListener('click', (e) => {
        if (e.target === this.taxonomyModal) this.closeModal();
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

    // Delegated events for taxonomy list
    if (this.taxonomyList) {
      this.taxonomyList.addEventListener('click', (e) => this.handleListClick(e));
    }
  }

  /**
   * Handle clicks in taxonomy list
   * @param {Event} e - Click event
   */
  handleListClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const taxonomyId = target.dataset.id;

    switch (action) {
      case 'edit':
        this.editTaxonomy(taxonomyId);
        break;
      case 'delete':
        this.confirmDeleteTaxonomy(taxonomyId);
        break;
      case 'duplicate':
        this.duplicateTaxonomy(taxonomyId);
        break;
    }
  }

  /**
   * Load taxonomies from API
   */
  async loadTaxonomies() {
    if (!this.taxonomyList) return;

    this.renderLoading();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/taxonomies`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load taxonomies');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.taxonomies = data.taxonomies || [];
        this.renderList();
      } else {
        throw new Error(data.message || 'Failed to load taxonomies');
      }
    } catch (error) {
      console.error('Error loading taxonomies:', error);
      this.showToast('Failed to load taxonomies', 'error');
      this.renderError();
    }
  }

  /**
   * Load reference data (categories, tags, posts) for rule builder
   */
  async loadReferenceData() {
    try {
      const [catResponse, tagResponse, postResponse] = await Promise.all([
        fetch(`${this.baseUrl}/api/v1/admin/blog/categories`, {
          method: 'GET',
          headers: getCsrfHeaders(),
          credentials: 'include'
        }),
        fetch(`${this.baseUrl}/api/v1/admin/blog/tags?limit=500`, {
          method: 'GET',
          headers: getCsrfHeaders(),
          credentials: 'include'
        }),
        fetch(`${this.baseUrl}/api/v1/admin/blog/posts?limit=100&status=published`, {
          method: 'GET',
          headers: getCsrfHeaders(),
          credentials: 'include'
        })
      ]);

      if (catResponse.ok) {
        const catData = await catResponse.json();
        if (catData.status === 'success') {
          this.categories = catData.categories || [];
        }
      }

      if (tagResponse.ok) {
        const tagData = await tagResponse.json();
        if (tagData.status === 'success') {
          this.tags = tagData.tags || [];
        }
      }

      if (postResponse.ok) {
        const postData = await postResponse.json();
        if (postData.status === 'success') {
          this.posts = postData.posts || [];
        }
      }
    } catch (error) {
      console.error('Error loading reference data:', error);
    }
  }

  /**
   * Render taxonomies list
   */
  renderList() {
    if (!this.taxonomyList) return;

    if (this.taxonomies.length === 0) {
      this.taxonomyList.innerHTML = `
        <div class="taxonomy-list__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          <p>No taxonomies yet. Create your first taxonomy!</p>
        </div>
      `;
      return;
    }

    this.taxonomyList.innerHTML = this.taxonomies.map(taxonomy => `
      <li class="taxonomy-item" data-id="${taxonomy.id}">
        <div class="taxonomy-item__row">
          <div class="taxonomy-item__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </div>
          <div class="taxonomy-item__content">
            <div class="taxonomy-item__name">${this.escapeHtml(taxonomy.name)}</div>
            <div class="taxonomy-item__description">${this.escapeHtml(taxonomy.description || 'No description')}</div>
          </div>
          <div class="taxonomy-item__meta">
            <div class="taxonomy-item__stat">
              <div class="taxonomy-item__stat-value">${taxonomy.rule_count || 0}</div>
              <div class="taxonomy-item__stat-label">Rules</div>
            </div>
            <div class="taxonomy-item__stat">
              <div class="taxonomy-item__stat-value">${taxonomy.post_count || 0}</div>
              <div class="taxonomy-item__stat-label">Posts</div>
            </div>
          </div>
          <div class="taxonomy-item__actions">
            <button class="btn btn--icon" data-action="edit" data-id="${taxonomy.id}" title="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="duplicate" data-id="${taxonomy.id}" title="Duplicate">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <button class="btn btn--icon" data-action="delete" data-id="${taxonomy.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </li>
    `).join('');
  }

  /**
   * Filter taxonomies by search term
   * @param {string} term - Search term
   */
  filterTaxonomies(term) {
    if (!this.taxonomyList) return;

    const items = this.taxonomyList.querySelectorAll('.taxonomy-item');
    const lowerTerm = term.toLowerCase();

    items.forEach(item => {
      const name = item.querySelector('.taxonomy-item__name')?.textContent.toLowerCase() || '';
      const desc = item.querySelector('.taxonomy-item__description')?.textContent.toLowerCase() || '';
      const matches = name.includes(lowerTerm) || desc.includes(lowerTerm);
      item.style.display = matches ? '' : 'none';
    });
  }

  /**
   * Open taxonomy modal
   */
  openModal() {
    if (!this.taxonomyModal) return;

    this.editingTaxonomy = null;
    this.rules = [];

    const titleEl = this.taxonomyModal.querySelector('.taxonomy-modal__title');
    const form = this.taxonomyModal.querySelector('form');

    if (titleEl) titleEl.textContent = 'Add Taxonomy';
    if (form) form.reset();

    this.renderRules();

    this.taxonomyModal.classList.add('taxonomy-modal--visible');
    this.taxonomyModal.setAttribute('aria-hidden', 'false');

    // Focus first input
    const firstInput = this.taxonomyModal.querySelector('input[type="text"]');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }

  /**
   * Edit a taxonomy
   * @param {string} taxonomyId - Taxonomy ID
   */
  async editTaxonomy(taxonomyId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/taxonomies/${taxonomyId}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load taxonomy');
      }

      const data = await response.json();

      if (data.status === 'success' && data.taxonomy) {
        this.editingTaxonomy = data.taxonomy;
        this.rules = data.taxonomy.rules || [];

        if (!this.taxonomyModal) return;

        const titleEl = this.taxonomyModal.querySelector('.taxonomy-modal__title');
        const nameInput = this.taxonomyModal.querySelector('#taxonomyName');
        const slugInput = this.taxonomyModal.querySelector('#taxonomySlug');
        const descInput = this.taxonomyModal.querySelector('#taxonomyDescription');

        if (titleEl) titleEl.textContent = 'Edit Taxonomy';
        if (nameInput) nameInput.value = data.taxonomy.name || '';
        if (slugInput) slugInput.value = data.taxonomy.slug || '';
        if (descInput) descInput.value = data.taxonomy.description || '';

        this.renderRules();

        this.taxonomyModal.classList.add('taxonomy-modal--visible');
        this.taxonomyModal.setAttribute('aria-hidden', 'false');
      } else {
        throw new Error(data.message || 'Failed to load taxonomy');
      }
    } catch (error) {
      console.error('Error loading taxonomy:', error);
      this.showToast('Failed to load taxonomy', 'error');
    }
  }

  /**
   * Close taxonomy modal
   */
  closeModal() {
    if (!this.taxonomyModal) return;
    this.taxonomyModal.classList.remove('taxonomy-modal--visible');
    this.taxonomyModal.setAttribute('aria-hidden', 'true');
    this.editingTaxonomy = null;
    this.rules = [];
  }

  /**
   * Add a new rule
   */
  addRule() {
    this.rules.push({
      id: Date.now(),
      type: 'require_categories',
      operator: 'any',
      values: []
    });
    this.renderRules();
  }

  /**
   * Remove a rule
   * @param {number} ruleId - Rule ID
   */
  removeRule(ruleId) {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this.renderRules();
  }

  /**
   * Render rules in the rule builder
   */
  renderRules() {
    const rulesContainer = this.taxonomyModal?.querySelector('#rulesContainer');
    if (!rulesContainer) return;

    if (this.rules.length === 0) {
      rulesContainer.innerHTML = '<p class="text-muted">No rules yet. Add a rule to define this taxonomy.</p>';
      return;
    }

    rulesContainer.innerHTML = this.rules.map(rule => this.renderRuleItem(rule)).join('');

    // Bind rule events
    rulesContainer.querySelectorAll('.rule-item').forEach((item, index) => {
      const rule = this.rules[index];

      // Type select
      const typeSelect = item.querySelector('.rule-item__type-select');
      if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
          rule.type = e.target.value;
          rule.values = [];
          this.renderRules();
        });
      }

      // Operator select
      const operatorSelect = item.querySelector('.rule-item__operator select');
      if (operatorSelect) {
        operatorSelect.addEventListener('change', (e) => {
          rule.operator = e.target.value;
        });
      }

      // Remove button
      const removeBtn = item.querySelector('.rule-item__remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => this.removeRule(rule.id));
      }

      // Values multi-select
      this.initRuleValuesSelect(item, rule);
    });
  }

  /**
   * Render a single rule item
   * @param {Object} rule - Rule data
   * @returns {string} HTML string
   */
  renderRuleItem(rule) {
    const typeOptions = this.ruleTypes.map(t =>
      `<option value="${t.value}" ${rule.type === t.value ? 'selected' : ''}>${t.label}</option>`
    ).join('');

    const showOperator = ['require_categories', 'require_tags'].includes(rule.type);
    const showValues = !['min_word_count', 'max_word_count'].includes(rule.type);
    const showNumberInput = ['min_word_count', 'max_word_count'].includes(rule.type);

    let valuesHtml = '';
    if (showValues) {
      valuesHtml = `
        <div class="rule-item__values">
          <div class="multi-select-chips__wrapper" data-rule-id="${rule.id}">
            <div class="multi-select-chips__container">
              ${rule.values.map(v => `
                <span class="multi-select-chips__chip" data-value="${v.id}">
                  ${this.escapeHtml(v.name)}
                  <button type="button" class="multi-select-chips__chip-remove" data-remove="${v.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              `).join('')}
              <input type="text" class="multi-select-chips__input" placeholder="Type to search...">
            </div>
            <div class="multi-select-chips__dropdown"></div>
          </div>
        </div>
      `;
    } else if (showNumberInput) {
      valuesHtml = `
        <div class="rule-item__values">
          <input type="number" class="form-group__input" value="${rule.values[0] || ''}" placeholder="Enter number" min="0">
        </div>
      `;
    }

    return `
      <div class="rule-item" data-rule-id="${rule.id}">
        <div class="rule-item__type">
          <select class="rule-item__type-select">${typeOptions}</select>
        </div>
        ${showOperator ? `
          <div class="rule-item__operator">
            <select>
              <option value="any" ${rule.operator === 'any' ? 'selected' : ''}>Any</option>
              <option value="all" ${rule.operator === 'all' ? 'selected' : ''}>All</option>
            </select>
          </div>
        ` : ''}
        ${valuesHtml}
        <button type="button" class="rule-item__remove" title="Remove rule">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * Initialize multi-select for rule values
   * @param {HTMLElement} ruleItem - Rule item element
   * @param {Object} rule - Rule data
   */
  initRuleValuesSelect(ruleItem, rule) {
    const wrapper = ruleItem.querySelector('.multi-select-chips__wrapper');
    if (!wrapper) return;

    const container = wrapper.querySelector('.multi-select-chips__container');
    const input = wrapper.querySelector('.multi-select-chips__input');
    const dropdown = wrapper.querySelector('.multi-select-chips__dropdown');

    if (!container || !input || !dropdown) return;

    // Get options based on rule type
    let options = [];
    switch (rule.type) {
      case 'require_categories':
        options = this.categories.map(c => ({ id: c.id, name: c.name }));
        break;
      case 'require_tags':
        options = this.tags.map(t => ({ id: t.id, name: t.name }));
        break;
      case 'include_posts':
      case 'exclude_posts':
        options = this.posts.map(p => ({ id: p.id, name: p.title }));
        break;
    }

    // Filter already selected
    const selectedIds = new Set(rule.values.map(v => v.id));

    // Input focus - show dropdown
    input.addEventListener('focus', () => {
      this.renderDropdown(dropdown, options, selectedIds, input.value, rule, wrapper);
      dropdown.classList.add('multi-select-chips__dropdown--visible');
    });

    // Input blur - hide dropdown (delayed to allow click)
    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.remove('multi-select-chips__dropdown--visible');
      }, 200);
    });

    // Input typing - filter options
    input.addEventListener('input', () => {
      this.renderDropdown(dropdown, options, selectedIds, input.value, rule, wrapper);
    });

    // Remove chip
    container.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const valueId = parseInt(btn.dataset.remove, 10);
        rule.values = rule.values.filter(v => v.id !== valueId);
        this.renderRules();
      });
    });

    // Handle number input for word count rules
    const numberInput = ruleItem.querySelector('.rule-item__values input[type="number"]');
    if (numberInput) {
      numberInput.addEventListener('change', (e) => {
        rule.values = [parseInt(e.target.value, 10) || 0];
      });
    }
  }

  /**
   * Render dropdown options
   */
  renderDropdown(dropdown, options, selectedIds, filterText, rule, wrapper) {
    const filtered = options.filter(opt =>
      !selectedIds.has(opt.id) &&
      opt.name.toLowerCase().includes(filterText.toLowerCase())
    );

    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="multi-select-chips__option">No options available</div>';
      return;
    }

    dropdown.innerHTML = filtered.slice(0, 20).map(opt => `
      <div class="multi-select-chips__option" data-id="${opt.id}" data-name="${this.escapeHtml(opt.name)}">
        ${this.escapeHtml(opt.name)}
      </div>
    `).join('');

    // Bind option click
    dropdown.querySelectorAll('.multi-select-chips__option').forEach(option => {
      option.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const id = parseInt(option.dataset.id, 10);
        const name = option.dataset.name;
        rule.values.push({ id, name });
        this.renderRules();
      });
    });
  }

  /**
   * Save taxonomy (create or update)
   */
  async saveTaxonomy() {
    const nameInput = this.taxonomyModal?.querySelector('#taxonomyName');
    const slugInput = this.taxonomyModal?.querySelector('#taxonomySlug');
    const descInput = this.taxonomyModal?.querySelector('#taxonomyDescription');

    if (!nameInput?.value.trim()) {
      this.showToast('Taxonomy name is required', 'error');
      return;
    }

    const payload = {
      name: nameInput.value.trim(),
      slug: slugInput?.value.trim() || null,
      description: descInput?.value.trim() || null,
      rules: this.rules.map(r => ({
        type: r.type,
        operator: r.operator || 'any',
        values: r.values
      }))
    };

    try {
      const isEditing = !!this.editingTaxonomy;
      const url = isEditing
        ? `${this.baseUrl}/api/v1/admin/blog/taxonomies/${this.editingTaxonomy.id}`
        : `${this.baseUrl}/api/v1/admin/blog/taxonomies`;

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save taxonomy');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast(`Taxonomy ${isEditing ? 'updated' : 'created'} successfully`, 'success');
        this.closeModal();
        this.loadTaxonomies();
      } else {
        throw new Error(data.message || 'Failed to save taxonomy');
      }
    } catch (error) {
      console.error('Error saving taxonomy:', error);
      this.showToast(error.message || 'Failed to save taxonomy', 'error');
    }
  }

  /**
   * Confirm delete taxonomy
   * @param {string} taxonomyId - Taxonomy ID
   */
  confirmDeleteTaxonomy(taxonomyId) {
    const taxonomy = this.taxonomies.find(t => String(t.id) === String(taxonomyId));
    if (!taxonomy) return;

    this.pendingAction = () => this.deleteTaxonomy(taxonomyId);
    this.openConfirmModal('Delete Taxonomy', `Are you sure you want to delete "${taxonomy.name}"?`);
  }

  /**
   * Delete a taxonomy
   * @param {string} taxonomyId - Taxonomy ID
   */
  async deleteTaxonomy(taxonomyId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/taxonomies/${taxonomyId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete taxonomy');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Taxonomy deleted successfully', 'success');
        this.loadTaxonomies();
      } else {
        throw new Error(data.message || 'Failed to delete taxonomy');
      }
    } catch (error) {
      console.error('Error deleting taxonomy:', error);
      this.showToast('Failed to delete taxonomy', 'error');
    }
  }

  /**
   * Duplicate a taxonomy
   * @param {string} taxonomyId - Taxonomy ID
   */
  async duplicateTaxonomy(taxonomyId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/blog/taxonomies/${taxonomyId}/duplicate`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to duplicate taxonomy');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Taxonomy duplicated successfully', 'success');
        this.loadTaxonomies();
      } else {
        throw new Error(data.message || 'Failed to duplicate taxonomy');
      }
    } catch (error) {
      console.error('Error duplicating taxonomy:', error);
      this.showToast('Failed to duplicate taxonomy', 'error');
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
    if (!this.taxonomyList) return;
    this.taxonomyList.innerHTML = `
      <div class="loading-spinner">
        <div class="loading-spinner__icon"></div>
      </div>
    `;
  }

  /**
   * Render error state
   */
  renderError() {
    if (!this.taxonomyList) return;
    this.taxonomyList.innerHTML = `
      <div class="taxonomy-list__empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p>Failed to load taxonomies. Please try again.</p>
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
