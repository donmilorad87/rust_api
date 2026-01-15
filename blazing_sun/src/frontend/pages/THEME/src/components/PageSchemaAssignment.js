/**
 * PageSchemaAssignment - Component for assigning existing schema entities to pages
 *
 * Allows users to browse existing schema entities and assign them to pages
 * without creating new inline schemas.
 */
export class PageSchemaAssignment {
  /**
   * @param {Object} config - Configuration object
   * @param {HTMLElement} config.container - Container element
   * @param {string} config.baseUrl - API base URL
   * @param {Function} config.onAssign - Callback when entity is assigned
   * @param {Function} config.showToast - Toast notification function
   * @param {Object} config.csrfHeaders - CSRF headers for API calls
   * @param {string} config.langCode - Current language code
   */
  constructor(config) {
    this.container = config.container;
    this.baseUrl = config.baseUrl || '';
    this.onAssign = config.onAssign || (() => {});
    this.showToast = config.showToast || console.log;
    this.csrfHeaders = config.csrfHeaders || {};
    this.langCode = config.langCode || 'en';

    // State
    this.entityTypes = [];
    this.selectedType = null;
    this.entities = [];
    this.searchQuery = '';
    this.isLoading = false;

    // DOM cache
    this.elements = {};
  }

  /**
   * Initialize and render the component
   */
  async init() {
    this.render();
    await this.loadEntityTypes();
  }

  /**
   * Render the component skeleton
   */
  render() {
    this.container.innerHTML = `
      <div class="schema-assignment">
        <div class="schema-assignment__header">
          <h4 class="schema-assignment__title">Assign Existing Schema</h4>
          <p class="schema-assignment__desc">Select from previously created schema entities to add to this page.</p>
        </div>

        <div class="schema-assignment__filters">
          <div class="form-group">
            <label class="form-label" for="entityTypeSelect">Schema Type</label>
            <select class="form-select" id="entityTypeSelect">
              <option value="">Select a type...</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="entitySearch">Search</label>
            <div class="input-group">
              <input type="text" class="form-input" id="entitySearch" placeholder="Search entities...">
              <button type="button" class="btn btn--secondary" id="entitySearchBtn">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="schema-assignment__content">
          <div class="schema-assignment__loading hidden" id="entityLoading">
            <div class="loading-spinner"></div>
            <span>Loading entities...</span>
          </div>
          <div class="schema-assignment__empty" id="entityEmpty">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            </svg>
            <p>Select a schema type to browse entities</p>
          </div>
          <div class="schema-assignment__list" id="entityList"></div>
        </div>
      </div>
    `;

    // Cache DOM elements
    this.elements = {
      typeSelect: this.container.querySelector('#entityTypeSelect'),
      searchInput: this.container.querySelector('#entitySearch'),
      searchBtn: this.container.querySelector('#entitySearchBtn'),
      loading: this.container.querySelector('#entityLoading'),
      empty: this.container.querySelector('#entityEmpty'),
      list: this.container.querySelector('#entityList')
    };

    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Type selection
    this.elements.typeSelect.addEventListener('change', () => {
      this.selectedType = this.elements.typeSelect.value || null;
      this.searchQuery = '';
      this.elements.searchInput.value = '';
      if (this.selectedType) {
        this.loadEntities();
      } else {
        this.showEmptyState('Select a schema type to browse entities');
      }
    });

    // Search
    this.elements.searchBtn.addEventListener('click', () => {
      this.searchQuery = this.elements.searchInput.value.trim();
      if (this.selectedType) {
        this.loadEntities();
      }
    });

    this.elements.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.searchQuery = this.elements.searchInput.value.trim();
        if (this.selectedType) {
          this.loadEntities();
        }
      }
    });
  }

  /**
   * Load available entity types
   */
  async loadEntityTypes() {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/admin/seo/entity-types?lang_code=${encodeURIComponent(this.langCode)}`,
        {
          headers: {
            'Accept': 'application/json',
            ...this.csrfHeaders
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load entity types');
      }

      const data = await response.json();
      if (data.status === 'success' && Array.isArray(data.types)) {
        this.entityTypes = data.types;
        this.renderTypeOptions();
      }
    } catch (error) {
      console.error('Error loading entity types:', error);
      this.entityTypes = [];
      this.renderTypeOptions();
    }
  }

  /**
   * Render type select options
   */
  renderTypeOptions() {
    const select = this.elements.typeSelect;
    select.innerHTML = '<option value="">Select a type...</option>';

    if (this.entityTypes.length === 0) {
      select.innerHTML = '<option value="">No entities available</option>';
      return;
    }

    this.entityTypes.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      select.appendChild(option);
    });
  }

  /**
   * Load entities for selected type
   */
  async loadEntities() {
    if (!this.selectedType) return;

    this.showLoading();

    try {
      const params = new URLSearchParams({
        lang_code: this.langCode,
        schema_type: this.selectedType,
        limit: '100'
      });

      if (this.searchQuery) {
        params.append('q', this.searchQuery);
      }

      const response = await fetch(
        `${this.baseUrl}/api/v1/admin/seo/entities?${params}`,
        {
          headers: {
            'Accept': 'application/json',
            ...this.csrfHeaders
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load entities');
      }

      const data = await response.json();
      if (data.status === 'success' && Array.isArray(data.entities)) {
        this.entities = data.entities;
        this.renderEntities();
      }
    } catch (error) {
      console.error('Error loading entities:', error);
      this.showEmptyState('Failed to load entities');
    }
  }

  /**
   * Render entity list
   */
  renderEntities() {
    this.hideLoading();

    if (this.entities.length === 0) {
      this.showEmptyState(
        this.searchQuery
          ? 'No entities found matching your search'
          : `No ${this.selectedType} entities available`
      );
      return;
    }

    this.elements.empty.classList.add('hidden');
    this.elements.list.innerHTML = '';

    this.entities.forEach(entity => {
      const card = this.createEntityCard(entity);
      this.elements.list.appendChild(card);
    });
  }

  /**
   * Create entity card element
   * @param {Object} entity - Entity data
   * @returns {HTMLElement}
   */
  createEntityCard(entity) {
    const card = document.createElement('div');
    card.className = 'entity-card';
    card.dataset.schemaId = entity.schema_id;

    // Extract display info from entity
    const name = entity.schema_data?.name ||
                 entity.schema_data?.title ||
                 entity.schema_data?.headline ||
                 entity.schema_id;
    const description = entity.schema_data?.description ||
                       entity.schema_data?.address?.streetAddress ||
                       '';

    card.innerHTML = `
      <div class="entity-card__icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        </svg>
      </div>
      <div class="entity-card__content">
        <div class="entity-card__name">${this.escapeHtml(name)}</div>
        <div class="entity-card__type">${entity.schema_type}</div>
        ${description ? `<div class="entity-card__desc">${this.escapeHtml(description.substring(0, 100))}${description.length > 100 ? '...' : ''}</div>` : ''}
      </div>
      <div class="entity-card__actions">
        <button type="button" class="btn btn--sm btn--primary entity-card__assign" title="Assign to page">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Assign
        </button>
        <button type="button" class="btn btn--sm btn--ghost entity-card__preview" title="Preview schema">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>
    `;

    // Assign button handler
    card.querySelector('.entity-card__assign').addEventListener('click', () => {
      this.assignEntity(entity);
    });

    // Preview button handler
    card.querySelector('.entity-card__preview').addEventListener('click', () => {
      this.previewEntity(entity);
    });

    return card;
  }

  /**
   * Assign entity to current page
   * @param {Object} entity - Entity to assign
   */
  assignEntity(entity) {
    // Call the onAssign callback with the entity data
    this.onAssign({
      schema_type: entity.schema_type,
      schema_data: entity.schema_data,
      schema_id: entity.schema_id
    });
  }

  /**
   * Preview entity schema
   * @param {Object} entity - Entity to preview
   */
  previewEntity(entity) {
    // Create preview modal
    const modal = document.createElement('div');
    modal.className = 'modal modal--preview';
    modal.innerHTML = `
      <div class="modal__backdrop" data-action="close"></div>
      <div class="modal__content">
        <header class="modal__header">
          <h3 class="modal__title">Schema Preview: ${this.escapeHtml(entity.schema_type)}</h3>
          <button type="button" class="modal__close" data-action="close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        <div class="modal__body">
          <pre class="schema-preview__code">${this.escapeHtml(JSON.stringify(entity.schema_data, null, 2))}</pre>
        </div>
        <footer class="modal__footer">
          <button type="button" class="btn btn--secondary" data-action="close">Close</button>
          <button type="button" class="btn btn--primary" data-action="assign">Assign to Page</button>
        </footer>
      </div>
    `;

    document.body.appendChild(modal);

    // Event handlers
    const closeModal = () => {
      modal.remove();
    };

    modal.querySelectorAll('[data-action="close"]').forEach(el => {
      el.addEventListener('click', closeModal);
    });

    modal.querySelector('[data-action="assign"]').addEventListener('click', () => {
      this.assignEntity(entity);
      closeModal();
    });

    // Show modal
    requestAnimationFrame(() => {
      modal.classList.add('modal--visible');
    });
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.elements.loading.classList.remove('hidden');
    this.elements.empty.classList.add('hidden');
    this.elements.list.innerHTML = '';
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    this.elements.loading.classList.add('hidden');
  }

  /**
   * Show empty state with message
   * @param {string} message - Message to display
   */
  showEmptyState(message) {
    this.hideLoading();
    this.elements.list.innerHTML = '';
    this.elements.empty.classList.remove('hidden');
    this.elements.empty.querySelector('p').textContent = message;
  }

  /**
   * Set language code
   * @param {string} langCode - Language code
   */
  setLangCode(langCode) {
    this.langCode = langCode;
    this.loadEntityTypes();
    if (this.selectedType) {
      this.loadEntities();
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string}
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Destroy component
   */
  destroy() {
    this.container.innerHTML = '';
    this.entityTypes = [];
    this.entities = [];
    this.elements = {};
  }
}
