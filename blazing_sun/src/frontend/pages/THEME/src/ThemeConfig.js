/**
 * ThemeConfig - Main controller for theme configuration page
 * Coordinates color pickers, size pickers, and image selectors
 * Handles API communication and build triggering
 */
export class ThemeConfig {
  /**
   * @param {Object} config - Configuration object with DOM elements and utilities
   */
  constructor(config) {
    this.baseUrl = config.baseUrl || '';
    this.showToast = config.showToast || console.log;
    this.getAuthToken = config.getAuthToken || (() => null);

    // Store references
    this.tabButtons = config.tabButtons;
    this.tabPanels = config.tabPanels;

    // Logo elements (click on selector opens modal)
    this.logoSelector = config.logoSelector;
    this.logoPreview = config.logoPreview;
    this.logoPlaceholder = config.logoPlaceholder;

    // Favicon elements (click on selector opens modal)
    this.faviconSelector = config.faviconSelector;
    this.faviconPreview = config.faviconPreview;
    this.faviconPlaceholder = config.faviconPlaceholder;

    // Color containers
    this.lightColorsContainer = config.lightColorsContainer;
    this.darkColorsContainer = config.darkColorsContainer;

    // Size containers
    this.typographyContainer = config.typographyContainer;
    this.spacingContainer = config.spacingContainer;
    this.borderRadiusContainer = config.borderRadiusContainer;

    // Theme mode toggle (light/dark buttons)
    this.themeModeToggle = config.themeModeToggle;
    this.lightColorsSection = document.getElementById('lightColors');
    this.darkColorsSection = document.getElementById('darkColors');

    // Action buttons
    this.buildBtn = config.buildBtn;

    // Build overlay elements
    this.buildOverlay = config.buildOverlay;
    this.buildStatus = config.buildStatus;
    this.buildProgress = config.buildProgress;

    // Image modal elements
    this.imageModal = config.imageModal;
    this.imageModalTitle = config.imageModalTitle;
    this.imageGrid = config.imageGrid;
    this.imageFileInput = config.imageFileInput;
    this.removeImageBtn = config.removeImageBtn;

    // Schema modal elements
    this.schemaModal = config.schemaModal;
    this.schemaModalTitle = config.schemaModalTitle;
    this.schemaTypeSelect = config.schemaTypeSelect;
    this.schemaTypeDescription = config.schemaTypeDescription;
    this.schemaFields = config.schemaFields;
    this.schemaPreview = config.schemaPreview;
    this.schemaPreviewCode = config.schemaPreviewCode;
    this.saveSchemaBtn = config.saveSchemaBtn;
    this.togglePreviewBtn = config.togglePreviewBtn;
    this.addSchemaBtn = config.addSchemaBtn;
    this.schemasList = config.schemasList;
    this.schemasEmpty = config.schemasEmpty;

    // Component factories
    this.ColorPicker = config.ColorPicker;
    this.SizePicker = config.SizePicker;

    // Schema definitions
    this.SchemaDefinitions = config.SchemaDefinitions;

    // State
    this.originalConfig = null;
    this.currentConfig = null;
    this.colorPickers = [];
    this.sizePickers = [];
    this.hasUnsavedChanges = false;
    this.isBuilding = false;
    this.currentImageTarget = null; // 'logo', 'favicon', 'og_image', or 'twitter_image'
    this.logoUuid = null;
    this.faviconUuid = null;

    // SEO State
    this.seoPages = [];
    this.currentSeoPage = null;
    this.seoFormElements = null;

    // Schema State
    this.currentSchemaType = null;
    this.editingSchemaId = null;
    this.pageSchemas = [];

    // Identity State
    this.siteName = 'Blazing Sun';
    this.showSiteName = true;
    this.identityColorStart = '#3498db';
    this.identityColorEnd = '#764ba2';
    this.identitySize = '1.375rem';

    // Color pickers and angle pickers are now defined in HTML with data attributes
    // We initialize them from the DOM instead of creating programmatically
    this.domColorPickers = [];
    this.domAnglePickers = [];

    // SCSS variable definitions
    this.scssVariables = {
      typography: [
        { name: 'font-size-base', label: 'Base Font Size', unit: 'rem', min: 0.75, max: 1.5, step: 0.0625 },
        { name: 'font-size-sm', label: 'Small Font Size', unit: 'rem', min: 0.5, max: 1.25, step: 0.0625 },
        { name: 'font-size-lg', label: 'Large Font Size', unit: 'rem', min: 1, max: 2, step: 0.0625 },
        { name: 'font-size-xl', label: 'Extra Large Font Size', unit: 'rem', min: 1.25, max: 3, step: 0.125 },
        { name: 'font-size-2xl', label: '2X Large Font Size', unit: 'rem', min: 1.5, max: 4, step: 0.125 },
        { name: 'font-size-3xl', label: '3X Large Font Size', unit: 'rem', min: 2, max: 5, step: 0.25 }
      ],
      spacing: [
        { name: 'spacing-xs', label: 'Extra Small', unit: 'rem', min: 0.125, max: 0.5, step: 0.0625 },
        { name: 'spacing-sm', label: 'Small', unit: 'rem', min: 0.25, max: 1, step: 0.125 },
        { name: 'spacing-md', label: 'Medium', unit: 'rem', min: 0.5, max: 1.5, step: 0.125 },
        { name: 'spacing-lg', label: 'Large', unit: 'rem', min: 1, max: 2.5, step: 0.25 },
        { name: 'spacing-xl', label: 'Extra Large', unit: 'rem', min: 1.5, max: 4, step: 0.25 },
        { name: 'spacing-2xl', label: '2X Large', unit: 'rem', min: 2, max: 6, step: 0.5 }
      ],
      borderRadius: [
        { name: 'radius-sm', label: 'Small Radius', unit: 'rem', min: 0, max: 1, step: 0.0625 },
        { name: 'radius-md', label: 'Medium Radius', unit: 'rem', min: 0, max: 1.5, step: 0.125 },
        { name: 'radius-lg', label: 'Large Radius', unit: 'rem', min: 0, max: 2, step: 0.125 },
        { name: 'radius-xl', label: 'Extra Large Radius', unit: 'rem', min: 0, max: 3, step: 0.25 }
      ],
      colors: [
        { name: 'color-primary', label: 'Primary Color', type: 'color' },
        { name: 'color-primary-dark', label: 'Primary Dark', type: 'color' },
        { name: 'color-secondary', label: 'Secondary Color', type: 'color' }
      ]
    };

    this.init();
  }

  /**
   * Initialize all components and load config
   */
  async init() {
    console.log('ThemeConfig.init() starting...');
    this.setupTabs();
    this.setupThemeModeToggle();
    this.setupActionButtons();
    this.setupImageModal();
    this.setupSchemaModal();
    this.setupImageSelectors();
    this.setupIdentity();
    this.setupBeforeUnload();
    this.setupSEO();
    this.initializeDomColorPickers();
    this.initializeDomAnglePickers();
    this.initializeDomSizePickers();

    // Load current configuration from API
    console.log('Loading config...');
    await this.loadConfig();
    console.log('ThemeConfig.init() completed');
  }

  /**
   * Setup tab navigation
   */
  setupTabs() {
    if (!this.tabButtons) return;

    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        this.switchTab(tabId);
      });
    });
  }

  /**
   * Setup theme mode toggle (Light/Dark buttons in Colors panel)
   */
  setupThemeModeToggle() {
    if (!this.themeModeToggle) return;

    const buttons = this.themeModeToggle.querySelectorAll('.theme-mode-toggle__btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.switchThemeMode(mode);
      });
    });
  }

  /**
   * Switch between light and dark color editing mode
   * @param {string} mode - 'light' or 'dark'
   */
  switchThemeMode(mode) {
    if (!this.themeModeToggle) return;

    // Update button states
    const buttons = this.themeModeToggle.querySelectorAll('.theme-mode-toggle__btn');
    buttons.forEach(btn => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('theme-mode-toggle__btn--active', isActive);
    });

    // Toggle visibility of color sections
    if (this.lightColorsSection && this.darkColorsSection) {
      if (mode === 'light') {
        this.lightColorsSection.removeAttribute('hidden');
        this.darkColorsSection.setAttribute('hidden', '');
      } else {
        this.lightColorsSection.setAttribute('hidden', '');
        this.darkColorsSection.removeAttribute('hidden');
      }
    }
  }

  /**
   * Switch to a specific tab
   * @param {string} tabId
   */
  switchTab(tabId) {
    // Update button states
    this.tabButtons.forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('theme-tabs__tab--active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });

    // Update panel visibility - HTML uses `panel-{tabId}` format
    this.tabPanels.forEach(panel => {
      const isActive = panel.id === `panel-${tabId}`;
      panel.classList.toggle('theme-panel--active', isActive);
      if (isActive) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
  }

  /**
   * Setup action buttons (build, branding save, colors save)
   */
  setupActionButtons() {
    if (this.buildBtn) {
      this.buildBtn.addEventListener('click', () => this.triggerBuild());
    }

    // Branding save button - only saves logo/favicon, no theme build
    const brandingSaveBtn = document.getElementById('brandingSaveBtn');
    if (brandingSaveBtn) {
      brandingSaveBtn.addEventListener('click', () => this.saveBranding(brandingSaveBtn));
    }

    // Colors save button - saves theme colors and triggers SCSS build
    const colorsSaveBtn = document.getElementById('colorsSaveBtn');
    if (colorsSaveBtn) {
      colorsSaveBtn.addEventListener('click', () => this.saveColors(colorsSaveBtn));
    }

    // Typography save button - saves font sizes and triggers SCSS build
    const typographySaveBtn = document.getElementById('typographySaveBtn');
    if (typographySaveBtn) {
      typographySaveBtn.addEventListener('click', () => this.saveTypography(typographySaveBtn));
    }

    // Spacing save button - saves spacing/radius values and triggers SCSS build
    const spacingSaveBtn = document.getElementById('spacingSaveBtn');
    if (spacingSaveBtn) {
      spacingSaveBtn.addEventListener('click', () => this.saveSpacing(spacingSaveBtn));
    }
  }

  /**
   * Setup image selection modal
   */
  setupImageModal() {
    if (!this.imageModal) return;

    // Close on backdrop click
    this.imageModal.addEventListener('click', (e) => {
      if (e.target === this.imageModal || e.target.closest('[data-action="close"]')) {
        this.closeImageModal();
      }
    });

    // Handle file input change (upload new image)
    if (this.imageFileInput) {
      this.imageFileInput.addEventListener('change', (e) => this.handleImageUpload(e));
    }

    // Handle remove current image button
    if (this.removeImageBtn) {
      this.removeImageBtn.addEventListener('click', () => {
        this.removeCurrentImage();
        this.closeImageModal();
      });
    }
  }

  /**
   * Setup schema editor modal
   */
  setupSchemaModal() {
    if (!this.schemaModal) return;

    // Close on backdrop click
    this.schemaModal.addEventListener('click', (e) => {
      if (e.target === this.schemaModal || e.target.closest('[data-action="close"]')) {
        this.closeSchemaModal();
      }
    });

    // Populate schema type select with grouped options
    if (this.schemaTypeSelect && this.SchemaDefinitions) {
      this.populateSchemaTypeSelect();
    }

    // Handle schema type change
    if (this.schemaTypeSelect) {
      this.schemaTypeSelect.addEventListener('change', (e) => {
        this.onSchemaTypeChange(e.target.value);
      });
    }

    // Handle save schema button
    if (this.saveSchemaBtn) {
      this.saveSchemaBtn.addEventListener('click', () => this.saveCurrentSchema());
    }

    // Handle toggle preview button
    if (this.togglePreviewBtn) {
      this.togglePreviewBtn.addEventListener('click', () => this.toggleSchemaPreview());
    }

    // Handle add schema button (in schemas list)
    if (this.addSchemaBtn) {
      this.addSchemaBtn.addEventListener('click', () => this.openSchemaModal());
    }
  }

  /**
   * Populate schema type select with grouped options
   */
  populateSchemaTypeSelect() {
    if (!this.schemaTypeSelect || !this.SchemaDefinitions) return;

    const { SCHEMA_CATEGORIES, SCHEMA_TYPES } = this.SchemaDefinitions;

    // Clear existing options except first placeholder
    while (this.schemaTypeSelect.options.length > 1) {
      this.schemaTypeSelect.remove(1);
    }

    // Group schemas by category
    const grouped = {};
    SCHEMA_TYPES.forEach(schema => {
      if (!grouped[schema.category]) {
        grouped[schema.category] = [];
      }
      grouped[schema.category].push(schema);
    });

    // Create optgroups
    Object.entries(SCHEMA_CATEGORIES).forEach(([catKey, catInfo]) => {
      const schemas = grouped[catKey];
      if (!schemas || schemas.length === 0) return;

      const optgroup = document.createElement('optgroup');
      optgroup.label = catInfo.label;

      schemas.forEach(schema => {
        const option = document.createElement('option');
        option.value = schema.type;
        option.textContent = schema.label;
        option.dataset.description = schema.description;
        optgroup.appendChild(option);
      });

      this.schemaTypeSelect.appendChild(optgroup);
    });
  }

  /**
   * Handle schema type selection change
   * @param {string} schemaType - Selected schema type
   */
  onSchemaTypeChange(schemaType) {
    if (!schemaType) {
      // Reset state
      this.currentSchemaType = null;
      if (this.schemaFields) this.schemaFields.classList.add('hidden');
      if (this.schemaPreview) this.schemaPreview.classList.add('hidden');
      if (this.saveSchemaBtn) this.saveSchemaBtn.disabled = true;
      if (this.schemaTypeDescription) {
        this.schemaTypeDescription.textContent = 'Select a schema type to configure structured data';
      }
      return;
    }

    const schemaDef = this.SchemaDefinitions.getSchemaType(schemaType);
    if (!schemaDef) {
      this.showToast('Schema type not found', 'error');
      return;
    }

    this.currentSchemaType = schemaType;

    // Update description
    if (this.schemaTypeDescription) {
      this.schemaTypeDescription.textContent = schemaDef.description;
    }

    // Generate and show form fields
    this.generateSchemaFields(schemaDef);
    if (this.schemaFields) this.schemaFields.classList.remove('hidden');

    // Show preview
    if (this.schemaPreview) this.schemaPreview.classList.remove('hidden');
    this.updateSchemaPreview();

    // Enable save button
    if (this.saveSchemaBtn) this.saveSchemaBtn.disabled = false;
  }

  /**
   * Generate form fields for a schema type
   * @param {Object} schemaDef - Schema definition object
   */
  generateSchemaFields(schemaDef) {
    if (!this.schemaFields) return;

    this.schemaFields.innerHTML = '';

    schemaDef.fields.forEach(field => {
      if (field.type === 'hidden') return; // Skip hidden fields

      const fieldHtml = this.generateFieldHtml(field);
      this.schemaFields.insertAdjacentHTML('beforeend', fieldHtml);
    });

    // Setup event listeners for the generated fields
    this.setupSchemaFieldListeners();
  }

  /**
   * Generate HTML for a single schema field
   * @param {Object} field - Field definition
   * @param {string} prefix - Optional prefix for nested fields
   * @returns {string} HTML string
   */
  generateFieldHtml(field, prefix = '') {
    const fieldId = prefix ? `${prefix}_${field.name}` : `schema_${field.name}`;
    const isRequired = field.required ? 'form-group--required' : '';
    const placeholder = field.placeholder || '';
    const helpText = field.help || '';

    let inputHtml = '';

    switch (field.type) {
      case 'text':
      case 'url':
      case 'email':
      case 'tel':
        inputHtml = `<input type="${field.type}" id="${fieldId}" class="form-input schema-field"
          data-field="${field.name}" placeholder="${placeholder}">`;
        break;

      case 'number':
        inputHtml = `<input type="number" id="${fieldId}" class="form-input schema-field"
          data-field="${field.name}" placeholder="${placeholder}" step="any">`;
        break;

      case 'date':
        inputHtml = `<input type="date" id="${fieldId}" class="form-input schema-field"
          data-field="${field.name}">`;
        break;

      case 'datetime':
        inputHtml = `<input type="datetime-local" id="${fieldId}" class="form-input schema-field"
          data-field="${field.name}">`;
        break;

      case 'textarea':
        inputHtml = `<textarea id="${fieldId}" class="form-textarea schema-field"
          data-field="${field.name}" rows="3" placeholder="${placeholder}"></textarea>`;
        break;

      case 'select':
        const options = (field.options || []).map(opt =>
          `<option value="${opt.value}">${opt.label}</option>`
        ).join('');
        inputHtml = `<select id="${fieldId}" class="form-select schema-field" data-field="${field.name}">
          <option value="">-- Select --</option>
          ${options}
        </select>`;
        break;

      case 'boolean':
        inputHtml = `
          <label class="checkbox-label">
            <input type="checkbox" id="${fieldId}" class="form-checkbox schema-field"
              data-field="${field.name}">
            <span>${field.label}</span>
          </label>`;
        break;

      case 'array':
        inputHtml = this.generateArrayFieldHtml(field, fieldId);
        break;

      case 'nested':
        inputHtml = this.generateNestedFieldHtml(field, fieldId);
        break;

      default:
        inputHtml = `<input type="text" id="${fieldId}" class="form-input schema-field"
          data-field="${field.name}" placeholder="${placeholder}">`;
    }

    // Don't wrap boolean in form-group (already has label)
    if (field.type === 'boolean') {
      return `<div class="form-group ${isRequired}">${inputHtml}</div>`;
    }

    return `
      <div class="form-group ${isRequired}">
        <label for="${fieldId}" class="form-label">${field.label}</label>
        ${inputHtml}
        ${helpText ? `<p class="form-help">${helpText}</p>` : ''}
      </div>
    `;
  }

  /**
   * Generate HTML for an array field
   * @param {Object} field - Array field definition
   * @param {string} fieldId - Field ID
   * @returns {string} HTML string
   */
  generateArrayFieldHtml(field, fieldId) {
    return `
      <div class="schema-array" data-field="${field.name}" data-item-type="${field.itemType || 'text'}">
        <div class="schema-array__header">
          <span class="schema-array__title">${field.label}</span>
        </div>
        <div class="schema-array__items" id="${fieldId}_items">
          <!-- Items added dynamically -->
        </div>
        <button type="button" class="schema-array__add" data-array="${fieldId}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Item
        </button>
      </div>
    `;
  }

  /**
   * Generate HTML for a nested schema field
   * @param {Object} field - Nested field definition
   * @param {string} fieldId - Field ID
   * @returns {string} HTML string
   */
  generateNestedFieldHtml(field, fieldId) {
    const nestedFields = field.fields || [];
    const fieldsHtml = nestedFields
      .filter(f => f.type !== 'hidden')
      .map(f => this.generateFieldHtml(f, fieldId))
      .join('');

    return `
      <div class="schema-nested" data-field="${field.name}" data-schema="${field.schema || ''}">
        <div class="schema-nested__header">
          <span class="schema-nested__title">${field.label}</span>
        </div>
        <div class="schema-nested__fields">
          ${fieldsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners for dynamically generated schema fields
   */
  setupSchemaFieldListeners() {
    if (!this.schemaFields) return;

    // Listen for input changes to update preview
    this.schemaFields.addEventListener('input', () => {
      this.updateSchemaPreview();
    });

    this.schemaFields.addEventListener('change', () => {
      this.updateSchemaPreview();
    });

    // Handle array add buttons
    this.schemaFields.querySelectorAll('.schema-array__add').forEach(btn => {
      btn.addEventListener('click', () => {
        const arrayId = btn.dataset.array;
        this.addArrayItem(arrayId);
      });
    });
  }

  /**
   * Add an item to an array field
   * @param {string} arrayId - The array field ID
   */
  addArrayItem(arrayId) {
    const container = document.getElementById(`${arrayId}_items`);
    const arrayEl = container?.closest('.schema-array');
    if (!container || !arrayEl) return;

    const itemType = arrayEl.dataset.itemType || 'text';
    const index = container.children.length;
    const itemId = `${arrayId}_item_${index}`;

    const itemHtml = `
      <div class="schema-array__item" data-index="${index}">
        <input type="text" id="${itemId}" class="form-input schema-array-item" placeholder="Enter value...">
        <button type="button" class="schema-array__remove" data-remove="${itemId}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;

    container.insertAdjacentHTML('beforeend', itemHtml);

    // Setup remove button
    const removeBtn = container.querySelector(`[data-remove="${itemId}"]`);
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        removeBtn.closest('.schema-array__item')?.remove();
        this.updateSchemaPreview();
      });
    }

    // Focus new input
    document.getElementById(itemId)?.focus();
    this.updateSchemaPreview();
  }

  /**
   * Collect schema data from form fields
   * @returns {Object} Schema data object
   */
  collectSchemaData() {
    if (!this.schemaFields || !this.currentSchemaType) return null;

    const data = {};

    // Collect simple fields
    this.schemaFields.querySelectorAll('.schema-field').forEach(input => {
      const fieldName = input.dataset.field;
      if (!fieldName) return;

      let value;
      if (input.type === 'checkbox') {
        value = input.checked;
      } else if (input.type === 'number') {
        value = input.value ? parseFloat(input.value) : null;
      } else {
        value = input.value.trim();
      }

      if (value !== null && value !== '' && value !== false) {
        data[fieldName] = value;
      }
    });

    // Collect array fields
    this.schemaFields.querySelectorAll('.schema-array').forEach(arrayEl => {
      const fieldName = arrayEl.dataset.field;
      if (!fieldName) return;

      const items = [];
      arrayEl.querySelectorAll('.schema-array-item').forEach(input => {
        const value = input.value.trim();
        if (value) items.push(value);
      });

      if (items.length > 0) {
        data[fieldName] = items;
      }
    });

    // Collect nested fields
    this.schemaFields.querySelectorAll('.schema-nested').forEach(nestedEl => {
      const fieldName = nestedEl.dataset.field;
      const schemaType = nestedEl.dataset.schema;
      if (!fieldName) return;

      const nestedData = {};
      if (schemaType) {
        nestedData['@type'] = schemaType;
      }

      nestedEl.querySelectorAll('.schema-field').forEach(input => {
        const nestedFieldName = input.dataset.field;
        if (!nestedFieldName) return;

        let value;
        if (input.type === 'checkbox') {
          value = input.checked;
        } else if (input.type === 'number') {
          value = input.value ? parseFloat(input.value) : null;
        } else {
          value = input.value.trim();
        }

        if (value !== null && value !== '' && value !== false) {
          nestedData[nestedFieldName] = value;
        }
      });

      // Only add nested object if it has data beyond @type
      if (Object.keys(nestedData).length > 1) {
        data[fieldName] = nestedData;
      }
    });

    return data;
  }

  /**
   * Update the JSON-LD preview
   */
  updateSchemaPreview() {
    if (!this.schemaPreviewCode || !this.currentSchemaType) return;

    const data = this.collectSchemaData();
    const jsonLd = this.SchemaDefinitions.buildJsonLd(this.currentSchemaType, data || {});

    this.schemaPreviewCode.textContent = JSON.stringify(jsonLd, null, 2);
  }

  /**
   * Toggle schema preview visibility
   */
  toggleSchemaPreview() {
    if (!this.schemaPreview) return;

    const code = this.schemaPreview.querySelector('.schema-preview__code');
    if (code) {
      code.classList.toggle('hidden');
    }

    // Rotate toggle button icon
    if (this.togglePreviewBtn) {
      const svg = this.togglePreviewBtn.querySelector('svg');
      if (svg) {
        svg.style.transform = code?.classList.contains('hidden') ? 'rotate(-90deg)' : '';
      }
    }
  }

  /**
   * Close schema modal
   */
  closeSchemaModal() {
    if (this.schemaModal) {
      this.schemaModal.classList.add('hidden');
    }
    this.resetSchemaModal();
  }

  /**
   * Reset schema modal to initial state
   */
  resetSchemaModal() {
    this.currentSchemaType = null;
    this.editingSchemaId = null;

    if (this.schemaTypeSelect) {
      this.schemaTypeSelect.value = '';
    }
    if (this.schemaFields) {
      this.schemaFields.innerHTML = '';
      this.schemaFields.classList.add('hidden');
    }
    if (this.schemaPreview) {
      this.schemaPreview.classList.add('hidden');
    }
    if (this.schemaPreviewCode) {
      this.schemaPreviewCode.textContent = '{}';
    }
    if (this.saveSchemaBtn) {
      this.saveSchemaBtn.disabled = true;
    }
    if (this.schemaTypeDescription) {
      this.schemaTypeDescription.textContent = 'Select a schema type to configure structured data';
    }
    if (this.schemaModalTitle) {
      this.schemaModalTitle.textContent = 'Add Schema';
    }
  }

  /**
   * Save current schema
   */
  async saveCurrentSchema() {
    if (!this.currentSchemaType || !this.currentSeoPage) {
      this.showToast('Please select a schema type and SEO page first', 'error');
      return;
    }

    const data = this.collectSchemaData();
    if (!data || Object.keys(data).length === 0) {
      this.showToast('Please fill in at least one field', 'error');
      return;
    }

    const jsonLd = this.SchemaDefinitions.buildJsonLd(this.currentSchemaType, data);

    try {
      const endpoint = this.editingSchemaId
        ? `${this.baseUrl}/api/v1/admin/seo/schema/${this.editingSchemaId}`
        : `${this.baseUrl}/api/v1/admin/seo/page/${this.currentSeoPage.id}/schemas`;

      const method = this.editingSchemaId ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          schema_type: this.currentSchemaType,
          schema_data: jsonLd,
          is_active: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save schema');
      }

      const result = await response.json();
      if (result.status === 'success') {
        this.showToast(this.editingSchemaId ? 'Schema updated' : 'Schema added', 'success');
        this.closeSchemaModal();
        this.loadPageSchemas(this.currentSeoPage.id);
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Save schema error:', error);
      this.showToast(`Failed to save schema: ${error.message}`, 'error');
    }
  }

  /**
   * Load schemas for a page
   * @param {number} pageId - Page SEO ID
   */
  async loadPageSchemas(pageId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/page/${pageId}/schemas`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load schemas');
      }

      const result = await response.json();
      if (result.status === 'success') {
        this.pageSchemas = result.schemas || [];
        this.renderSchemasList();
      }
    } catch (error) {
      console.error('Load schemas error:', error);
      // Don't show error toast - schemas might not exist yet
      this.pageSchemas = [];
      this.renderSchemasList();
    }
  }

  /**
   * Render schemas list in the SEO panel
   */
  renderSchemasList() {
    if (!this.schemasList) return;

    // Clear existing cards (keep empty state element)
    this.schemasList.querySelectorAll('.schema-card').forEach(card => card.remove());

    if (this.pageSchemas.length === 0) {
      if (this.schemasEmpty) this.schemasEmpty.classList.remove('hidden');
      return;
    }

    if (this.schemasEmpty) this.schemasEmpty.classList.add('hidden');

    this.pageSchemas.forEach(schema => {
      const schemaDef = this.SchemaDefinitions?.getSchemaType(schema.schema_type);
      const label = schemaDef?.label || schema.schema_type;
      const description = schema.schema_data?.name || schema.schema_data?.title || schemaDef?.description || '';

      const cardHtml = `
        <div class="schema-card ${schema.is_active ? '' : 'schema-card--inactive'}" data-schema-id="${schema.id}">
          <div class="schema-card__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </div>
          <div class="schema-card__content">
            <div class="schema-card__type">${label}</div>
            <div class="schema-card__description">${description}</div>
          </div>
          <div class="schema-card__actions">
            <button type="button" class="schema-card__btn" data-action="edit" title="Edit schema">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="schema-card__btn schema-card__btn--danger" data-action="delete" title="Delete schema">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;

      this.schemasList.insertAdjacentHTML('beforeend', cardHtml);
    });

    // Setup card action handlers
    this.schemasList.querySelectorAll('.schema-card').forEach(card => {
      const schemaId = card.dataset.schemaId;

      card.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
        this.editSchema(schemaId);
      });

      card.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        this.deleteSchema(schemaId);
      });
    });
  }

  /**
   * Edit an existing schema
   * @param {string} schemaId - Schema ID
   */
  editSchema(schemaId) {
    const schema = this.pageSchemas.find(s => String(s.id) === String(schemaId));
    if (!schema) {
      this.showToast('Schema not found', 'error');
      return;
    }

    this.editingSchemaId = schemaId;
    this.openSchemaModal(schema);
  }

  /**
   * Delete a schema
   * @param {string} schemaId - Schema ID
   */
  async deleteSchema(schemaId) {
    if (!confirm('Are you sure you want to delete this schema?')) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/schema/${schemaId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete schema');
      }

      this.showToast('Schema deleted', 'success');
      this.loadPageSchemas(this.currentSeoPage.id);
    } catch (error) {
      console.error('Delete schema error:', error);
      this.showToast(`Failed to delete schema: ${error.message}`, 'error');
    }
  }

  /**
   * Setup logo and favicon selectors - click on container opens modal
   */
  setupImageSelectors() {
    if (this.logoSelector) {
      this.logoSelector.addEventListener('click', () => this.openImageModal('logo'));
      this.logoSelector.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openImageModal('logo');
        }
      });
    }
    if (this.faviconSelector) {
      this.faviconSelector.addEventListener('click', () => this.openImageModal('favicon'));
      this.faviconSelector.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openImageModal('favicon');
        }
      });
    }
  }

  /**
   * Setup site identity form elements (name, colors, size)
   */
  setupIdentity() {
    // Cache identity elements
    this.identityElements = {
      siteName: document.getElementById('siteName'),
      showSiteName: document.getElementById('showSiteName'),
      colorStart: document.getElementById('identityColorStart'),
      colorStartHex: document.getElementById('identityColorStartHex'),
      colorEnd: document.getElementById('identityColorEnd'),
      colorEndHex: document.getElementById('identityColorEndHex'),
      sizeRange: document.getElementById('identitySizeRange'),
      sizeValue: document.getElementById('identitySizeValue'),
      previewText: document.getElementById('identityPreviewText')
    };

    const el = this.identityElements;

    // Site name input
    if (el.siteName) {
      el.siteName.addEventListener('input', () => {
        this.siteName = el.siteName.value || 'Blazing Sun';
        this.updateIdentityPreview();
        this.markUnsaved();
      });
    }

    // Show site name checkbox
    if (el.showSiteName) {
      el.showSiteName.addEventListener('change', () => {
        this.showSiteName = el.showSiteName.checked;
        this.updateIdentityPreview();
        this.markUnsaved();
      });
    }

    // Color start - sync color picker and hex input
    if (el.colorStart && el.colorStartHex) {
      el.colorStart.addEventListener('input', () => {
        this.identityColorStart = el.colorStart.value;
        el.colorStartHex.value = el.colorStart.value;
        this.updateIdentityPreview();
        this.markUnsaved();
      });

      el.colorStartHex.addEventListener('input', () => {
        const hex = el.colorStartHex.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          this.identityColorStart = hex;
          el.colorStart.value = hex;
          this.updateIdentityPreview();
          this.markUnsaved();
        }
      });
    }

    // Color end - sync color picker and hex input
    if (el.colorEnd && el.colorEndHex) {
      el.colorEnd.addEventListener('input', () => {
        this.identityColorEnd = el.colorEnd.value;
        el.colorEndHex.value = el.colorEnd.value;
        this.updateIdentityPreview();
        this.markUnsaved();
      });

      el.colorEndHex.addEventListener('input', () => {
        const hex = el.colorEndHex.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          this.identityColorEnd = hex;
          el.colorEnd.value = hex;
          this.updateIdentityPreview();
          this.markUnsaved();
        }
      });
    }

    // Size - sync range slider and number input
    if (el.sizeRange && el.sizeValue) {
      el.sizeRange.addEventListener('input', () => {
        const value = el.sizeRange.value;
        this.identitySize = `${value}rem`;
        el.sizeValue.value = value;
        this.updateIdentityPreview();
        this.markUnsaved();
      });

      el.sizeValue.addEventListener('input', () => {
        const value = parseFloat(el.sizeValue.value);
        if (value >= 0.875 && value <= 2) {
          this.identitySize = `${value}rem`;
          el.sizeRange.value = value;
          this.updateIdentityPreview();
          this.markUnsaved();
        }
      });
    }
  }

  /**
   * Update identity preview display
   */
  updateIdentityPreview() {
    const el = this.identityElements;
    if (!el || !el.previewText) return;

    el.previewText.textContent = this.siteName || 'Blazing Sun';
    el.previewText.style.fontSize = this.identitySize;
    el.previewText.style.background = `linear-gradient(135deg, ${this.identityColorStart} 0%, ${this.identityColorEnd} 100%)`;
    el.previewText.style.webkitBackgroundClip = 'text';
    el.previewText.style.webkitTextFillColor = 'transparent';
    el.previewText.style.backgroundClip = 'text';
  }

  /**
   * Setup beforeunload warning for unsaved changes
   */
  setupBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /**
   * Initialize color pickers from DOM elements
   * Finds all .color-picker[data-var][data-type] and sets up handlers
   */
  initializeDomColorPickers() {
    const pickers = document.querySelectorAll('.color-picker[data-var][data-type]');
    pickers.forEach(picker => {
      const varName = picker.dataset.var;
      const themeType = picker.dataset.type;
      const colorInput = picker.querySelector('.color-picker__color');
      const hexInput = picker.querySelector('.color-picker__hex');

      if (!colorInput || !hexInput) return;

      // Store reference for later population
      this.domColorPickers.push({ element: picker, varName, themeType, colorInput, hexInput });

      // Sync color picker to hex input
      colorInput.addEventListener('input', () => {
        hexInput.value = colorInput.value;
        this.handleDomColorChange(themeType, varName, colorInput.value);
      });

      // Sync hex input to color picker
      hexInput.addEventListener('input', () => {
        const hex = hexInput.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
          colorInput.value = hex;
          this.handleDomColorChange(themeType, varName, hex);
        }
      });
    });
    console.log(`Initialized ${this.domColorPickers.length} DOM color pickers`);
  }

  /**
   * Initialize angle pickers from DOM elements
   * Finds all .angle-picker[data-var][data-type] and sets up handlers
   */
  initializeDomAnglePickers() {
    const pickers = document.querySelectorAll('.angle-picker[data-var][data-type]');
    pickers.forEach(picker => {
      const varName = picker.dataset.var;
      const themeType = picker.dataset.type;
      const rangeInput = picker.querySelector('.angle-picker__range');
      const numberInput = picker.querySelector('.angle-picker__number');

      if (!rangeInput || !numberInput) return;

      // Store reference for later population
      this.domAnglePickers.push({ element: picker, varName, themeType, rangeInput, numberInput });

      // Sync range to number
      rangeInput.addEventListener('input', () => {
        numberInput.value = rangeInput.value;
        this.handleDomAngleChange(themeType, varName, rangeInput.value);
      });

      // Sync number to range
      numberInput.addEventListener('input', () => {
        const value = parseInt(numberInput.value, 10);
        if (value >= 0 && value <= 360) {
          rangeInput.value = value;
          this.handleDomAngleChange(themeType, varName, value);
        }
      });
    });
    console.log(`Initialized ${this.domAnglePickers.length} DOM angle pickers`);
  }

  /**
   * Initialize size pickers from DOM elements
   * Finds all .size-picker[data-var][data-type] and sets up handlers
   */
  initializeDomSizePickers() {
    const pickers = document.querySelectorAll('.size-picker[data-var][data-type]');
    pickers.forEach(picker => {
      const varName = picker.dataset.var;
      const themeType = picker.dataset.type;
      const numberInput = picker.querySelector('.size-picker__number');
      const unitSelect = picker.querySelector('.size-picker__unit');
      const preview = picker.querySelector('.size-picker__preview, .radius-preview');

      if (!numberInput) return;

      // Store reference for later population
      const pickerData = { element: picker, varName, themeType, numberInput, unitSelect, preview };
      this.sizePickers.push(pickerData);

      // Handle number input change
      numberInput.addEventListener('input', () => {
        const value = parseFloat(numberInput.value);
        const unit = unitSelect ? unitSelect.value : 'rem';
        this.handleDomSizeChange(varName, value, unit);
        if (preview) {
          if (varName.includes('font')) {
            preview.style.fontSize = `${value}${unit}`;
          } else if (varName.includes('radius')) {
            preview.style.borderRadius = `${value}${unit}`;
          }
        }
      });

      // Handle unit change
      if (unitSelect) {
        unitSelect.addEventListener('change', () => {
          const value = parseFloat(numberInput.value);
          const unit = unitSelect.value;
          this.handleDomSizeChange(varName, value, unit);
        });
      }
    });
    console.log(`Initialized ${this.sizePickers.length} DOM size pickers`);
  }

  /**
   * Handle color change from DOM color picker
   * @param {string} themeType - 'light', 'dark', or 'scss'
   * @param {string} varName - Variable name (e.g., 'bg_gradient_start')
   * @param {string} value - Color value (hex)
   */
  handleDomColorChange(themeType, varName, value) {
    if (!this.currentConfig) return;

    console.log(`handleDomColorChange: ${themeType}, ${varName} = ${value}`);

    if (themeType === 'light') {
      if (!this.currentConfig.theme_light) this.currentConfig.theme_light = {};
      this.currentConfig.theme_light[varName] = value;
    } else if (themeType === 'dark') {
      if (!this.currentConfig.theme_dark) this.currentConfig.theme_dark = {};
      this.currentConfig.theme_dark[varName] = value;
    } else if (themeType === 'scss') {
      if (!this.currentConfig.scss_variables) this.currentConfig.scss_variables = {};
      this.currentConfig.scss_variables[varName] = value;
    }

    this.markUnsaved();
  }

  /**
   * Handle angle change from DOM angle picker
   * @param {string} themeType - 'light' or 'dark'
   * @param {string} varName - Variable name (e.g., 'bg_gradient_angle')
   * @param {number|string} value - Angle value in degrees
   */
  handleDomAngleChange(themeType, varName, value) {
    if (!this.currentConfig) return;

    console.log(`handleDomAngleChange: ${themeType}, ${varName} = ${value}`);

    if (themeType === 'light') {
      if (!this.currentConfig.theme_light) this.currentConfig.theme_light = {};
      this.currentConfig.theme_light[varName] = parseInt(value, 10);
    } else if (themeType === 'dark') {
      if (!this.currentConfig.theme_dark) this.currentConfig.theme_dark = {};
      this.currentConfig.theme_dark[varName] = parseInt(value, 10);
    }

    this.markUnsaved();
  }

  /**
   * Handle size change from DOM size picker
   * @param {string} varName - Variable name (e.g., 'font_size_base')
   * @param {number} value - Numeric value
   * @param {string} unit - Unit (rem, px, etc.)
   */
  handleDomSizeChange(varName, value, unit) {
    if (!this.currentConfig) return;
    if (!this.currentConfig.scss_variables) this.currentConfig.scss_variables = {};
    this.currentConfig.scss_variables[varName] = `${value}${unit}`;
    this.markUnsaved();
  }

  /**
   * Load current configuration from API
   */
  async loadConfig() {
    console.log('loadConfig() called, fetching from:', `${this.baseUrl}/api/v1/admin/theme`);
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/theme`, {
        credentials: 'include'
      });

      console.log('loadConfig response status:', response.status);

      if (!response.ok) {
        throw new Error('Failed to load theme configuration');
      }

      const result = await response.json();
      console.log('loadConfig result:', result);

      if (result.status === 'success') {
        this.originalConfig = JSON.parse(JSON.stringify(result.config));
        this.currentConfig = result.config;
        console.log('currentConfig.theme_light:', this.currentConfig.theme_light);
        console.log('currentConfig.theme_dark:', this.currentConfig.theme_dark);
        this.populateForm();
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      this.showToast('Failed to load theme configuration', 'error');
    }
  }

  /**
   * Populate form with current configuration
   */
  populateForm() {
    if (!this.currentConfig) return;

    // Logo and Favicon UUIDs
    this.logoUuid = this.currentConfig.logo_uuid;
    this.faviconUuid = this.currentConfig.favicon_uuid;
    this.updateImagePreview('logo', this.logoUuid);
    this.updateImagePreview('favicon', this.faviconUuid);

    // Identity fields
    this.siteName = this.currentConfig.site_name || 'Blazing Sun';
    this.showSiteName = this.currentConfig.show_site_name !== false;
    this.identityColorStart = this.currentConfig.identity_color_start || '#3498db';
    this.identityColorEnd = this.currentConfig.identity_color_end || '#764ba2';
    this.identitySize = this.currentConfig.identity_size || '1.375rem';

    // Populate identity form elements
    if (this.identityElements) {
      const el = this.identityElements;
      if (el.siteName) el.siteName.value = this.siteName;
      if (el.showSiteName) el.showSiteName.checked = this.showSiteName;
      if (el.colorStart) el.colorStart.value = this.identityColorStart;
      if (el.colorStartHex) el.colorStartHex.value = this.identityColorStart;
      if (el.colorEnd) el.colorEnd.value = this.identityColorEnd;
      if (el.colorEndHex) el.colorEndHex.value = this.identityColorEnd;
      // Parse size value (e.g., "1.375rem" -> 1.375)
      const sizeNum = parseFloat(this.identitySize);
      if (el.sizeRange) el.sizeRange.value = sizeNum;
      if (el.sizeValue) el.sizeValue.value = sizeNum;
    }
    this.updateIdentityPreview();

    // Populate DOM color pickers with values from API
    this.populateDomColorPickers();

    // Populate DOM angle pickers with values from API
    this.populateDomAnglePickers();

    // Populate DOM size pickers with values from API
    this.populateDomSizePickers();
  }

  /**
   * Populate DOM color pickers with values from API config
   */
  populateDomColorPickers() {
    const themeLight = this.currentConfig.theme_light || {};
    const themeDark = this.currentConfig.theme_dark || {};
    const scssVars = this.currentConfig.scss_variables || {};

    this.domColorPickers.forEach(({ varName, themeType, colorInput, hexInput }) => {
      let value = '#000000';

      if (themeType === 'light') {
        value = themeLight[varName] || '#000000';
      } else if (themeType === 'dark') {
        value = themeDark[varName] || '#000000';
      } else if (themeType === 'scss') {
        value = scssVars[varName] || '#667eea';
      }

      colorInput.value = value;
      hexInput.value = value;
    });

    console.log('Populated DOM color pickers with API values');
  }

  /**
   * Populate DOM angle pickers with values from API config
   */
  populateDomAnglePickers() {
    const themeLight = this.currentConfig.theme_light || {};
    const themeDark = this.currentConfig.theme_dark || {};

    this.domAnglePickers.forEach(({ varName, themeType, rangeInput, numberInput }) => {
      let value = 135; // Default angle

      if (themeType === 'light') {
        value = themeLight[varName] ?? 135;
      } else if (themeType === 'dark') {
        value = themeDark[varName] ?? 135;
      }

      rangeInput.value = value;
      numberInput.value = value;
    });

    console.log('Populated DOM angle pickers with API values');
  }

  /**
   * Populate DOM size pickers with values from API config
   */
  populateDomSizePickers() {
    const scssVars = this.currentConfig.scss_variables || {};

    this.sizePickers.forEach(({ varName, numberInput, unitSelect, preview }) => {
      const rawValue = scssVars[varName];
      if (!rawValue) return;

      // Parse value like "1rem" or "16px"
      const numericValue = parseFloat(rawValue);
      const unit = rawValue.replace(/[\d.-]/g, '') || 'rem';

      numberInput.value = numericValue;
      if (unitSelect) {
        // Try to set the unit in the select
        for (let i = 0; i < unitSelect.options.length; i++) {
          if (unitSelect.options[i].value === unit) {
            unitSelect.selectedIndex = i;
            break;
          }
        }
      }

      // Update preview
      if (preview) {
        if (varName.includes('font')) {
          preview.style.fontSize = rawValue;
        } else if (varName.includes('radius')) {
          preview.style.borderRadius = rawValue;
        }
      }
    });

    console.log('Populated DOM size pickers with API values');
  }

  /**
   * Update live preview (optional)
   */
  updatePreview() {
    // Could apply CSS custom properties to preview element
    // For now, just mark that changes exist
  }

  /**
   * Mark configuration as having unsaved changes
   */
  markUnsaved() {
    this.hasUnsavedChanges = true;
  }

  /**
   * Mark configuration as saved
   */
  markSaved() {
    this.hasUnsavedChanges = false;
  }

  /**
   * Open image selection modal
   * @param {string} target - 'logo', 'favicon', 'og_image', or 'twitter_image'
   */
  async openImageModal(target) {
    this.currentImageTarget = target;

    // Update modal title
    if (this.imageModalTitle) {
      const titles = {
        logo: 'Select Logo',
        favicon: 'Select Favicon',
        og_image: 'Select OG Image',
        twitter_image: 'Select Twitter Image'
      };
      this.imageModalTitle.textContent = titles[target] || 'Select Image';
    }

    // Show/hide remove button based on whether image is currently set
    let currentUuid = null;
    if (target === 'logo') {
      currentUuid = this.logoUuid;
    } else if (target === 'favicon') {
      currentUuid = this.faviconUuid;
    } else if (target === 'og_image') {
      currentUuid = this.currentSeoPage?.og_image_uuid;
    } else if (target === 'twitter_image') {
      currentUuid = this.currentSeoPage?.twitter_image_uuid;
    }

    if (this.removeImageBtn) {
      if (currentUuid) {
        this.removeImageBtn.classList.remove('hidden');
      } else {
        this.removeImageBtn.classList.add('hidden');
      }
    }

    // Load all user uploads (public and private - we'll handle private on selection)
    await this.loadUserUploads();

    if (this.imageModal) {
      this.imageModal.classList.remove('hidden');
    }
  }

  /**
   * Close image selection modal
   */
  closeImageModal() {
    if (this.imageModal) {
      this.imageModal.classList.add('hidden');
    }
    this.currentImageTarget = null;
  }

  /**
   * Load all user uploads (public and private) for image selection
   */
  async loadUserUploads() {
    if (!this.imageGrid) return;

    this.imageGrid.innerHTML = '<div class="loading">Loading images...</div>';

    try {
      // Get user's uploads (all images)
      const response = await fetch(`${this.baseUrl}/api/v1/upload/user`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load uploads');
      }

      const result = await response.json();
      const uploads = result.uploads || [];

      // Filter for images only (both public and private)
      const images = uploads.filter(u =>
        u.mime_type && u.mime_type.startsWith('image/')
      );

      if (images.length === 0) {
        this.imageGrid.innerHTML = '<div class="image-grid__empty">No images found. Upload one above!</div>';
        return;
      }

      this.imageGrid.innerHTML = '';
      images.forEach(upload => {
        const item = document.createElement('div');
        item.className = 'image-grid__item';

        // Use appropriate URL based on visibility
        const imgUrl = upload.visibility === 'public'
          ? `/api/v1/upload/download/public/${upload.uuid}`
          : `/api/v1/upload/private/${upload.uuid}`;

        // Show indicator for private images
        const privateIndicator = upload.visibility === 'private'
          ? '<span class="image-grid__private-badge" title="Private - will be copied to public">Private</span>'
          : '';

        item.innerHTML = `
          <img src="${imgUrl}" alt="${upload.original_name}">
          ${privateIndicator}
          <span class="image-grid__name">${upload.original_name}</span>
        `;
        item.addEventListener('click', () => this.selectImage(upload.uuid, upload.visibility));
        this.imageGrid.appendChild(item);
      });
    } catch (error) {
      console.error('Failed to load uploads:', error);
      this.imageGrid.innerHTML = '<div class="image-grid__error">Failed to load images</div>';
    }
  }

  /**
   * Select an image from the modal
   * @param {string} uuid
   * @param {string} visibility - 'public' or 'private'
   */
  async selectImage(uuid, visibility = 'public') {
    // If private, duplicate to public first
    if (visibility === 'private') {
      const publicUuid = await this.duplicateToPublic(uuid);
      if (!publicUuid) {
        this.showToast('Failed to make image public', 'error');
        return;
      }
      uuid = publicUuid;
    }

    if (this.currentImageTarget === 'logo') {
      this.logoUuid = uuid;
      this.updateImagePreview('logo', uuid);
      this.markUnsaved();
    } else if (this.currentImageTarget === 'favicon') {
      this.faviconUuid = uuid;
      this.updateImagePreview('favicon', uuid);
      this.markUnsaved();
    } else if (this.currentImageTarget === 'og_image') {
      if (this.currentSeoPage) {
        this.currentSeoPage.og_image_uuid = uuid;
        this.updateSeoImagePreview('og_image', uuid);
      }
    } else if (this.currentImageTarget === 'twitter_image') {
      if (this.currentSeoPage) {
        this.currentSeoPage.twitter_image_uuid = uuid;
        this.updateSeoImagePreview('twitter_image', uuid);
      }
    }

    this.closeImageModal();
  }

  /**
   * Duplicate a private image to public
   * @param {string} uuid - UUID of private image
   * @returns {Promise<string|null>} UUID of new public image or null on failure
   */
  async duplicateToPublic(uuid) {
    try {
      this.showToast('Copying image to public...', 'info');

      // Download the private image
      const downloadResponse = await fetch(`${this.baseUrl}/api/v1/upload/private/${uuid}`, {
        credentials: 'include'
      });

      if (!downloadResponse.ok) {
        throw new Error('Failed to download private image');
      }

      const blob = await downloadResponse.blob();
      const filename = downloadResponse.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'image.jpg';

      // Upload as public
      const formData = new FormData();
      formData.append('file', blob, filename);

      const uploadResponse = await fetch(`${this.baseUrl}/api/v1/upload/public`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const result = await uploadResponse.json();

      if (uploadResponse.ok && result.status === 'success' && result.upload?.uuid) {
        this.showToast('Image copied to public', 'success');
        return result.upload.uuid;
      }

      throw new Error(result.message || 'Failed to upload');
    } catch (error) {
      console.error('Failed to duplicate to public:', error);
      return null;
    }
  }

  /**
   * Remove the currently selected image
   */
  removeCurrentImage() {
    if (this.currentImageTarget === 'logo') {
      this.logoUuid = null;
      this.updateImagePreview('logo', null);
      this.markUnsaved();
    } else if (this.currentImageTarget === 'favicon') {
      this.faviconUuid = null;
      this.updateImagePreview('favicon', null);
      this.markUnsaved();
    } else if (this.currentImageTarget === 'og_image') {
      if (this.currentSeoPage) {
        this.currentSeoPage.og_image_uuid = null;
        this.updateSeoImagePreview('og_image', null);
      }
    } else if (this.currentImageTarget === 'twitter_image') {
      if (this.currentSeoPage) {
        this.currentSeoPage.twitter_image_uuid = null;
        this.updateSeoImagePreview('twitter_image', null);
      }
    }
  }


  /**
   * Update image preview display
   * @param {string} target - 'logo' or 'favicon'
   * @param {string|null} uuid
   */
  updateImagePreview(target, uuid) {
    let preview, placeholder;

    if (target === 'logo') {
      preview = this.logoPreview;
      placeholder = this.logoPlaceholder;
    } else {
      preview = this.faviconPreview;
      placeholder = this.faviconPlaceholder;
    }

    if (uuid && preview) {
      preview.src = `/api/v1/upload/download/public/${uuid}`;
      preview.classList.remove('hidden');
      if (placeholder) placeholder.classList.add('hidden');
    } else {
      if (preview) preview.classList.add('hidden');
      if (placeholder) placeholder.classList.remove('hidden');
    }
  }

  /**
   * Handle image upload from modal - always uploads as public
   * @param {Event} e
   */
  async handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith('image/')) {
      this.showToast('Please select an image file', 'error');
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      this.showToast('Uploading image...', 'info');

      // Upload as public (logo/favicon must be public)
      const response = await fetch(`${this.baseUrl}/api/v1/upload/public`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.status === 'success' && result.upload?.uuid) {
        this.showToast('Image uploaded successfully', 'success');
        // Auto-select the newly uploaded image
        await this.selectImage(result.upload.uuid, 'public');
      } else {
        this.showToast(result.message || 'Upload failed', 'error');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      this.showToast('Network error during upload', 'error');
    }

    // Reset file input
    e.target.value = '';
  }

  /**
   * Save changes to API (PUT triggers build automatically)
   * @param {HTMLElement} [triggerBtn] - Optional button that triggered the save (for loading state)
   * @returns {Promise<Object>} result with success status and build info
   */
  async saveChanges(triggerBtn = null) {
    if (!this.currentConfig) return { saved: false };

    const saveData = {
      logo_uuid: this.logoUuid,
      favicon_uuid: this.faviconUuid,
      scss_variables: this.currentConfig.scss_variables,
      theme_light: this.currentConfig.theme_light,
      theme_dark: this.currentConfig.theme_dark
    };

    try {
      if (triggerBtn) this.setButtonLoading(triggerBtn, true);
      this.showBuildOverlay('Saving and building theme...');

      const response = await fetch(`${this.baseUrl}/api/v1/admin/theme`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.originalConfig = JSON.parse(JSON.stringify(this.currentConfig));
        this.markSaved();

        // PUT endpoint returns build result - check if build succeeded
        if (result.success && result.new_version) {
          this.updateBuildStatus('Build successful!');
          // Update GLOBAL assets version in head to reload new CSS
          this.updateGlobalAssetsVersion(result.new_version);
          setTimeout(() => {
            this.hideBuildOverlay();
            this.showToast(`Theme saved and built! Version: ${result.new_version}`, 'success');
          }, 1000);
        } else if (result.success === false) {
          this.updateBuildStatus(`Build failed: ${result.error || 'Unknown error'}`);
          setTimeout(() => {
            this.hideBuildOverlay();
            this.showToast(result.error || 'Build failed', 'error');
          }, 2000);
        } else {
          // Fallback for responses without build info
          this.hideBuildOverlay();
          this.showToast('Theme configuration saved!', 'success');
        }

        return { saved: true, buildSuccess: result.success, version: result.new_version };
      } else {
        this.hideBuildOverlay();
        this.showToast(result.message || 'Failed to save', 'error');
        return { saved: false };
      }
    } catch (error) {
      console.error('Save failed:', error);
      this.hideBuildOverlay();
      this.showToast('Network error while saving', 'error');
      return { saved: false };
    } finally {
      if (triggerBtn) this.setButtonLoading(triggerBtn, false);
    }
  }

  /**
   * Save branding (logo, favicon, identity)
   * Uses PUT /api/v1/admin/theme/branding endpoint
   * Note: Changing identity colors or size triggers a theme rebuild
   * @param {HTMLElement} [triggerBtn] - Optional button for loading state
   * @returns {Promise<Object>} result with success status and optional build info
   */
  async saveBranding(triggerBtn = null) {
    const saveData = {
      logo_uuid: this.logoUuid || '',
      favicon_uuid: this.faviconUuid || '',
      site_name: this.siteName || 'Blazing Sun',
      show_site_name: this.showSiteName,
      identity_color_start: this.identityColorStart || '#3498db',
      identity_color_end: this.identityColorEnd || '#764ba2',
      identity_size: this.identitySize || '1.375rem'
    };

    // Check if this might trigger a rebuild (identity colors/size changed)
    const mightRebuild = this.currentConfig && (
      saveData.identity_color_start !== this.currentConfig.identity_color_start ||
      saveData.identity_color_end !== this.currentConfig.identity_color_end ||
      saveData.identity_size !== this.currentConfig.identity_size
    );

    try {
      if (triggerBtn) this.setButtonLoading(triggerBtn, true);
      if (mightRebuild) {
        this.showBuildOverlay('Saving branding and rebuilding theme...');
      }

      const response = await fetch(`${this.baseUrl}/api/v1/admin/theme/branding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        // Update local config state
        if (this.currentConfig) {
          this.currentConfig.site_name = saveData.site_name;
          this.currentConfig.show_site_name = saveData.show_site_name;
          this.currentConfig.identity_color_start = saveData.identity_color_start;
          this.currentConfig.identity_color_end = saveData.identity_color_end;
          this.currentConfig.identity_size = saveData.identity_size;
          this.currentConfig.logo_uuid = saveData.logo_uuid;
          this.currentConfig.favicon_uuid = saveData.favicon_uuid;
        }
        this.markSaved();

        // Immediately update navbar with new branding (live update)
        this.updateNavbarBranding(saveData);

        // Check if rebuild occurred (identity colors/size changed)
        if (result.success && result.new_version) {
          this.updateBuildStatus('Build successful!');
          this.updateGlobalAssetsVersion(result.new_version);
          setTimeout(() => {
            this.hideBuildOverlay();
            this.showToast(`Branding saved and theme rebuilt! Version: ${result.new_version}`, 'success');
          }, 1000);
          return { saved: true, buildSuccess: true, version: result.new_version };
        } else if (result.success === false && result.error) {
          // Build was attempted but failed
          this.updateBuildStatus(`Build failed: ${result.error}`);
          setTimeout(() => {
            this.hideBuildOverlay();
            this.showToast(result.error || 'Build failed', 'error');
          }, 2000);
          return { saved: true, buildSuccess: false };
        } else {
          // No rebuild needed (only logo/favicon/site_name changed)
          this.hideBuildOverlay();
          this.showToast('Branding saved successfully!', 'success');
          return { saved: true };
        }
      } else {
        this.hideBuildOverlay();
        this.showToast(result.message || 'Failed to save branding', 'error');
        return { saved: false };
      }
    } catch (error) {
      console.error('Save branding failed:', error);
      this.hideBuildOverlay();
      this.showToast('Network error while saving branding', 'error');
      return { saved: false };
    } finally {
      if (triggerBtn) this.setButtonLoading(triggerBtn, false);
    }
  }

  /**
   * Update navbar branding live (without page refresh)
   * @param {Object} branding - { site_name, show_site_name, identity_color_start, identity_color_end, identity_size }
   */
  updateNavbarBranding(branding) {
    // Find navbar logo text element
    const logoText = document.querySelector('.navbar__logo-text');
    if (logoText) {
      // Update text content
      logoText.textContent = branding.site_name || 'Blazing Sun';

      // Show/hide based on show_site_name
      logoText.style.display = branding.show_site_name ? '' : 'none';

      // Update gradient colors
      logoText.style.background = `linear-gradient(135deg, ${branding.identity_color_start} 0%, ${branding.identity_color_end} 100%)`;
      logoText.style.webkitBackgroundClip = 'text';
      logoText.style.webkitTextFillColor = 'transparent';
      logoText.style.backgroundClip = 'text';

      // Update font size
      logoText.style.fontSize = branding.identity_size;
    }
  }

  /**
   * Save theme colors (light/dark) and trigger SCSS build
   * Updates _theme.scss file and runs npm build
   * @param {HTMLElement} [triggerBtn] - Optional button for loading state
   * @returns {Promise<Object>} result with success status and build info
   */
  async saveColors(triggerBtn = null) {
    if (!this.currentConfig) {
      this.showToast('No configuration loaded', 'error');
      return { saved: false };
    }

    const saveData = {
      theme_light: this.currentConfig.theme_light || {},
      theme_dark: this.currentConfig.theme_dark || {}
    };

    // Debug logging
    console.log('saveColors called');
    console.log('theme_light:', JSON.stringify(saveData.theme_light, null, 2));
    console.log('theme_dark:', JSON.stringify(saveData.theme_dark, null, 2));

    try {
      if (triggerBtn) this.setButtonLoading(triggerBtn, true, 'Building...');
      this.showBuildOverlay('Saving colors and rebuilding theme...');

      const response = await fetch(`${this.baseUrl}/api/v1/admin/theme`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.markSaved();

        // Check build result
        if (result.success && result.new_version) {
          this.updateBuildStatus('Build successful!');
          // Update GLOBAL assets version in head to reload new CSS
          this.updateGlobalAssetsVersion(result.new_version);
          setTimeout(() => {
            this.hideBuildOverlay();
            this.showToast(`Colors saved and theme built! Version: ${result.new_version}`, 'success');
          }, 1000);
        } else if (result.success === false) {
          this.updateBuildStatus(`Build failed: ${result.error || 'Unknown error'}`);
          setTimeout(() => {
            this.hideBuildOverlay();
            this.showToast(result.error || 'Build failed', 'error');
          }, 2000);
        } else {
          this.hideBuildOverlay();
          this.showToast('Colors saved successfully!', 'success');
        }

        return { saved: true, buildSuccess: result.success, version: result.new_version };
      } else {
        this.hideBuildOverlay();
        this.showToast(result.message || 'Failed to save colors', 'error');
        return { saved: false };
      }
    } catch (error) {
      console.error('Save colors failed:', error);
      this.hideBuildOverlay();
      this.showToast('Network error while saving colors', 'error');
      return { saved: false };
    } finally {
      if (triggerBtn) this.setButtonLoading(triggerBtn, false);
    }
  }

  /**
   * Save typography SCSS variables (font sizes) and trigger rebuild
   * @param {HTMLElement} triggerBtn - The button that triggered the save
   */
  async saveTypography(triggerBtn = null) {
    if (!this.currentConfig) {
      this.showToast('No configuration loaded', 'error');
      return { saved: false };
    }

    // Filter scss_variables to only include typography-related keys
    const scssVars = this.currentConfig.scss_variables || {};
    const typographyVars = {};

    // Typography variable prefixes/patterns
    const typographyPatterns = ['font_size', 'font_weight', 'line_height', 'letter_spacing', 'font_family'];

    Object.keys(scssVars).forEach(key => {
      if (typographyPatterns.some(pattern => key.startsWith(pattern))) {
        typographyVars[key] = scssVars[key];
      }
    });

    const saveData = {
      scss_variables: typographyVars
    };

    console.log('saveTypography called');
    console.log('typography variables:', JSON.stringify(typographyVars, null, 2));

    try {
      if (triggerBtn) this.setButtonLoading(triggerBtn, true, 'Building...');
      this.showBuildOverlay('Saving typography and rebuilding theme...');

      const response = await fetch(`${this.baseUrl}/api/v1/admin/theme`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.markSaved();

        if (result.success && result.new_version) {
          this.updateBuildStatus('Build successful!');
          this.updateGlobalAssetsVersion(result.new_version);
          setTimeout(() => {
            this.hideBuildOverlay();
            this.showToast(`Typography saved and theme built! Version: ${result.new_version}`, 'success');
          }, 1000);
        } else if (result.success === false) {
          this.updateBuildStatus(`Build failed: ${result.error || 'Unknown error'}`);
          setTimeout(() => {
            this.hideBuildOverlay();
            this.showToast(result.error || 'Build failed', 'error');
          }, 2000);
        } else {
          this.hideBuildOverlay();
          this.showToast('Typography saved successfully!', 'success');
        }

        return { saved: true, buildSuccess: result.success, version: result.new_version };
      } else {
        this.hideBuildOverlay();
        this.showToast(result.message || 'Failed to save typography', 'error');
        return { saved: false };
      }
    } catch (error) {
      console.error('Save typography failed:', error);
      this.hideBuildOverlay();
      this.showToast('Network error while saving typography', 'error');
      return { saved: false };
    } finally {
      if (triggerBtn) this.setButtonLoading(triggerBtn, false);
    }
  }

  /**
   * Save spacing SCSS variables (spacing scale and border radius) and trigger rebuild
   * @param {HTMLElement} triggerBtn - The button that triggered the save
   */
  async saveSpacing(triggerBtn = null) {
    if (!this.currentConfig) {
      this.showToast('No configuration loaded', 'error');
      return { saved: false };
    }

    // Filter scss_variables to only include spacing-related keys
    const scssVars = this.currentConfig.scss_variables || {};
    const spacingVars = {};

    // Spacing variable prefixes/patterns
    const spacingPatterns = ['spacing', 'radius', 'padding', 'margin', 'gap'];

    Object.keys(scssVars).forEach(key => {
      if (spacingPatterns.some(pattern => key.startsWith(pattern))) {
        spacingVars[key] = scssVars[key];
      }
    });

    const saveData = {
      scss_variables: spacingVars
    };

    console.log('saveSpacing called');
    console.log('spacing variables:', JSON.stringify(spacingVars, null, 2));

    try {
      if (triggerBtn) this.setButtonLoading(triggerBtn, true, 'Building...');
      this.showBuildOverlay('Saving spacing and rebuilding theme...');

      const response = await fetch(`${this.baseUrl}/api/v1/admin/theme`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(saveData),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.markSaved();

        if (result.success && result.new_version) {
          this.updateBuildStatus('Build successful!');
          this.updateGlobalAssetsVersion(result.new_version);
          setTimeout(() => {
            this.hideBuildOverlay();
            this.showToast(`Spacing saved and theme built! Version: ${result.new_version}`, 'success');
          }, 1000);
        } else if (result.success === false) {
          this.updateBuildStatus(`Build failed: ${result.error || 'Unknown error'}`);
          setTimeout(() => {
            this.hideBuildOverlay();
            this.showToast(result.error || 'Build failed', 'error');
          }, 2000);
        } else {
          this.hideBuildOverlay();
          this.showToast('Spacing saved successfully!', 'success');
        }

        return { saved: true, buildSuccess: result.success, version: result.new_version };
      } else {
        this.hideBuildOverlay();
        this.showToast(result.message || 'Failed to save spacing', 'error');
        return { saved: false };
      }
    } catch (error) {
      console.error('Save spacing failed:', error);
      this.hideBuildOverlay();
      this.showToast('Network error while saving spacing', 'error');
      return { saved: false };
    } finally {
      if (triggerBtn) this.setButtonLoading(triggerBtn, false);
    }
  }

  /**
   * Trigger SCSS build
   * @param {boolean} skipUnsavedCheck - if true, skip the unsaved changes check
   */
  async triggerBuild(skipUnsavedCheck = false) {
    if (this.isBuilding) return;

    // Warn if unsaved (unless called from saveAndBuild)
    if (!skipUnsavedCheck && this.hasUnsavedChanges) {
      const proceed = confirm('You have unsaved changes. Save before building?');
      if (proceed) {
        await this.saveChanges();
      }
    }

    this.isBuilding = true;
    this.showBuildOverlay('Starting build...');

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/theme/build`, {
        method: 'POST',
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.updateBuildStatus('Build successful!');
        // Update GLOBAL assets version if returned
        if (result.new_version) {
          this.updateGlobalAssetsVersion(result.new_version);
        }
        setTimeout(() => {
          this.hideBuildOverlay();
          const versionMsg = result.new_version ? ` Version: ${result.new_version}` : '';
          this.showToast(`Theme built successfully!${versionMsg}`, 'success');
        }, 1500);
      } else {
        this.updateBuildStatus(`Build failed: ${result.message || 'Unknown error'}`);
        setTimeout(() => {
          this.hideBuildOverlay();
          this.showToast(result.message || 'Build failed', 'error');
        }, 3000);
      }
    } catch (error) {
      console.error('Build failed:', error);
      this.updateBuildStatus('Build failed: Network error');
      setTimeout(() => {
        this.hideBuildOverlay();
        this.showToast('Network error during build', 'error');
      }, 2000);
    } finally {
      this.isBuilding = false;
    }
  }

  /**
   * Show build overlay
   * @param {string} message
   */
  showBuildOverlay(message) {
    if (this.buildOverlay) {
      this.buildOverlay.classList.remove('hidden');
    }
    this.updateBuildStatus(message);
  }

  /**
   * Hide build overlay
   */
  hideBuildOverlay() {
    if (this.buildOverlay) {
      this.buildOverlay.classList.add('hidden');
    }
  }

  /**
   * Update build status text
   * @param {string} message
   */
  updateBuildStatus(message) {
    if (this.buildStatus) {
      this.buildStatus.textContent = message;
    }
  }

  /**
   * Set button loading state
   * @param {HTMLElement} btn
   * @param {boolean} isLoading
   * @param {string} [loadingText='Saving...'] - Optional custom loading text
   */
  setButtonLoading(btn, isLoading, loadingText = 'Saving...') {
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
      btn.dataset.originalText = btn.textContent;
      btn.textContent = loadingText;
      btn.classList.add('btn--loading');
    } else {
      btn.textContent = btn.dataset.originalText || 'Save';
      btn.classList.remove('btn--loading');
    }
  }

  /**
   * Update GLOBAL assets (CSS/JS) version in head to force browser reload
   * Called after successful theme build to apply changes without page refresh
   * @param {string} newVersion - The new assets version (e.g., "1.0.1")
   */
  updateGlobalAssetsVersion(newVersion) {
    if (!newVersion) return;

    // Find GLOBAL CSS link tag and update version
    const globalCss = document.querySelector('link[href*="/css/GLOBAL/"]');
    if (globalCss) {
      const currentHref = globalCss.getAttribute('href');
      // Replace existing version parameter or add new one
      const newHref = currentHref.includes('?v=')
        ? currentHref.replace(/\?v=[^&]+/, `?v=${newVersion}`)
        : `${currentHref}?v=${newVersion}`;
      globalCss.setAttribute('href', newHref);
      console.log('Updated GLOBAL CSS:', newHref);
    }

    // Find GLOBAL JS script tag and update version
    const globalJs = document.querySelector('script[src*="/js/GLOBAL/"]');
    if (globalJs) {
      const currentSrc = globalJs.getAttribute('src');
      // Replace existing version parameter or add new one
      const newSrc = currentSrc.includes('?v=')
        ? currentSrc.replace(/\?v=[^&]+/, `?v=${newVersion}`)
        : `${currentSrc}?v=${newVersion}`;

      // For scripts, we need to remove and re-add to force reload
      // But since GLOBAL JS mainly handles theme toggle, CSS reload is usually sufficient
      // Setting src will trigger a re-fetch if the browser honors the change
      globalJs.setAttribute('src', newSrc);
      console.log('Updated GLOBAL JS:', newSrc);
    }
  }

  // ============================================
  // SEO Tab Methods
  // ============================================

  /**
   * Setup SEO tab functionality
   */
  setupSEO() {
    // Cache SEO form elements
    this.seoFormElements = {
      pageList: document.getElementById('seoPageItems'),
      placeholder: document.getElementById('seoFormPlaceholder'),
      content: document.getElementById('seoContent'),
      form: document.getElementById('seoForm'),
      pageName: document.getElementById('seoPageName'),
      pagePath: document.getElementById('seoPagePath'),
      routeName: document.getElementById('seoRouteName'),
      // Sub-tabs
      subtabs: document.querySelectorAll('.seo-subtab'),
      subpanels: {
        metatags: document.getElementById('seo-subpanel-metatags'),
        schemas: document.getElementById('seo-subpanel-schemas'),
        hreflang: document.getElementById('seo-subpanel-hreflang')
      },
      // Schemas section
      schemasList: document.getElementById('schemasList'),
      schemasEmpty: document.getElementById('schemasEmpty'),
      addSchemaBtn: document.getElementById('addSchemaBtn'),
      // Basic SEO
      title: document.getElementById('seoTitle'),
      description: document.getElementById('seoDescription'),
      keywords: document.getElementById('seoKeywords'),
      robots: document.getElementById('seoRobots'),
      canonical: document.getElementById('seoCanonical'),
      // Open Graph
      ogTitle: document.getElementById('seoOgTitle'),
      ogDescription: document.getElementById('seoOgDescription'),
      ogType: document.getElementById('seoOgType'),
      ogImageSelector: document.getElementById('ogImageSelector'),
      ogImagePreview: document.getElementById('ogImagePreview'),
      ogImagePlaceholder: document.getElementById('ogImagePlaceholder'),
      ogImageUuid: document.getElementById('seoOgImageUuid'),
      // Twitter
      twitterCard: document.getElementById('seoTwitterCard'),
      twitterTitle: document.getElementById('seoTwitterTitle'),
      twitterDescription: document.getElementById('seoTwitterDescription'),
      twitterImageSelector: document.getElementById('twitterImageSelector'),
      twitterImagePreview: document.getElementById('twitterImagePreview'),
      twitterImagePlaceholder: document.getElementById('twitterImagePlaceholder'),
      twitterImageUuid: document.getElementById('seoTwitterImageUuid'),
      // Status
      isActive: document.getElementById('seoIsActive'),
      saveBtn: document.getElementById('seoSaveBtn')
    };

    // Setup form submit handler
    if (this.seoFormElements.form) {
      this.seoFormElements.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSeoPage();
      });
    }

    // Setup SEO sub-tabs
    this.setupSeoSubtabs();

    // Setup character counters
    this.setupSeoCharacterCounts();

    // Setup SEO image selectors
    this.setupSeoImageSelectors();

    // Load SEO pages
    this.loadSeoPages();
  }

  /**
   * Setup SEO sub-tabs switching
   */
  setupSeoSubtabs() {
    const f = this.seoFormElements;
    if (!f.subtabs || f.subtabs.length === 0) return;

    f.subtabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const subtabName = tab.dataset.subtab;
        this.switchSeoSubtab(subtabName);
      });
    });

    // Setup Add Schema button
    if (f.addSchemaBtn) {
      f.addSchemaBtn.addEventListener('click', () => {
        this.openSchemaModal();
      });
    }
  }

  /**
   * Switch to a different SEO sub-tab
   * @param {string} subtabName - The sub-tab to switch to (metatags, schemas, hreflang)
   */
  switchSeoSubtab(subtabName) {
    const f = this.seoFormElements;

    // Update tab buttons
    f.subtabs.forEach(tab => {
      const isActive = tab.dataset.subtab === subtabName;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update panels
    Object.entries(f.subpanels).forEach(([name, panel]) => {
      if (panel) {
        panel.classList.toggle('hidden', name !== subtabName);
      }
    });
  }

  /**
   * Open the schema selection/edit modal
   * @param {Object} existingSchema - Optional existing schema to edit
   */
  openSchemaModal(existingSchema = null) {
    if (!this.schemaModal) {
      this.showToast('Schema modal not available', 'error');
      return;
    }

    if (!this.currentSeoPage) {
      this.showToast('Please select a page first', 'error');
      return;
    }

    // Reset modal first
    this.resetSchemaModal();

    // If editing existing schema, populate the form
    if (existingSchema) {
      this.editingSchemaId = existingSchema.id;
      if (this.schemaModalTitle) {
        this.schemaModalTitle.textContent = 'Edit Schema';
      }

      // Set schema type and trigger change
      if (this.schemaTypeSelect && existingSchema.schema_type) {
        this.schemaTypeSelect.value = existingSchema.schema_type;
        this.onSchemaTypeChange(existingSchema.schema_type);

        // Populate form fields with existing data
        setTimeout(() => {
          this.populateSchemaFields(existingSchema.schema_data);
        }, 50);
      }
    }

    // Show modal
    this.schemaModal.classList.remove('hidden');
  }

  /**
   * Populate schema form fields with existing data
   * @param {Object} schemaData - Existing schema data
   */
  populateSchemaFields(schemaData) {
    if (!schemaData || !this.schemaFields) return;

    // Populate simple fields
    Object.entries(schemaData).forEach(([key, value]) => {
      if (key.startsWith('@')) return; // Skip @context, @type
      if (typeof value === 'object' && !Array.isArray(value)) return; // Skip nested objects for now

      const input = this.schemaFields.querySelector(`[data-field="${key}"]`);
      if (!input) return;

      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
      } else if (Array.isArray(value)) {
        // Handle array fields
        const arrayContainer = input.closest('.schema-array');
        if (arrayContainer) {
          const arrayId = arrayContainer.querySelector('.schema-array__add')?.dataset.array;
          if (arrayId) {
            value.forEach(item => {
              this.addArrayItem(arrayId);
              const items = document.getElementById(`${arrayId}_items`);
              const lastInput = items?.querySelector('.schema-array__item:last-child input');
              if (lastInput) lastInput.value = item;
            });
          }
        }
      } else {
        input.value = value;
      }
    });

    // Populate nested fields
    Object.entries(schemaData).forEach(([key, value]) => {
      if (key.startsWith('@')) return;
      if (typeof value !== 'object' || Array.isArray(value)) return;

      const nestedContainer = this.schemaFields.querySelector(`.schema-nested[data-field="${key}"]`);
      if (!nestedContainer) return;

      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        if (nestedKey.startsWith('@')) return;

        const input = nestedContainer.querySelector(`[data-field="${nestedKey}"]`);
        if (!input) return;

        if (input.type === 'checkbox') {
          input.checked = Boolean(nestedValue);
        } else {
          input.value = nestedValue;
        }
      });
    });

    // Update preview with populated data
    this.updateSchemaPreview();
  }

  /**
   * Setup character count displays for SEO fields
   */
  setupSeoCharacterCounts() {
    const fieldsWithCounts = [
      { id: 'seoTitle', max: 70 },
      { id: 'seoDescription', max: 160 },
      { id: 'seoOgTitle', max: 95 },
      { id: 'seoOgDescription', max: 200 },
      { id: 'seoTwitterTitle', max: 70 },
      { id: 'seoTwitterDescription', max: 200 }
    ];

    fieldsWithCounts.forEach(({ id, max }) => {
      const field = document.getElementById(id);
      const counter = document.querySelector(`.char-count[data-for="${id}"]`);

      if (field && counter) {
        const updateCount = () => {
          const len = field.value.length;
          counter.textContent = `${len}/${max}`;
          counter.classList.toggle('char-count--warning', len > max * 0.9);
          counter.classList.toggle('char-count--error', len >= max);
        };

        field.addEventListener('input', updateCount);
        updateCount();
      }
    });
  }

  /**
   * Setup SEO image selectors (OG and Twitter images)
   */
  setupSeoImageSelectors() {
    const { ogImageSelector, twitterImageSelector } = this.seoFormElements;

    if (ogImageSelector) {
      ogImageSelector.addEventListener('click', () => this.openImageModal('og_image'));
      ogImageSelector.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openImageModal('og_image');
        }
      });
    }

    if (twitterImageSelector) {
      twitterImageSelector.addEventListener('click', () => this.openImageModal('twitter_image'));
      twitterImageSelector.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openImageModal('twitter_image');
        }
      });
    }
  }

  /**
   * Load SEO pages from API
   */
  async loadSeoPages() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load SEO pages');
      }

      const result = await response.json();
      if (result.status === 'success') {
        this.seoPages = result.pages || [];
        this.renderSeoPageList();
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to load SEO pages:', error);
      this.showToast('Failed to load SEO pages', 'error');
    }
  }

  /**
   * Render the SEO page list
   */
  renderSeoPageList() {
    const { pageList } = this.seoFormElements;
    if (!pageList) return;

    pageList.innerHTML = '';

    this.seoPages.forEach(page => {
      const li = document.createElement('li');
      li.className = 'seo-page-list__item';
      li.dataset.routeName = page.route_name;

      const statusModifier = page.is_active ? 'seo-page-list__status--active' : 'seo-page-list__status--inactive';
      const statusText = page.is_active ? 'Active' : 'Inactive';

      li.innerHTML = `
        <div class="seo-page-list__info">
          <span class="seo-page-list__label">${this.escapeHtml(page.page_label)}</span>
          <span class="seo-page-list__path">${this.escapeHtml(page.page_path)}</span>
        </div>
        <span class="seo-page-list__status ${statusModifier}">${statusText}</span>
      `;

      li.addEventListener('click', () => this.selectSeoPage(page.route_name));
      pageList.appendChild(li);
    });
  }

  /**
   * Select a SEO page and load its details
   * @param {string} routeName
   */
  async selectSeoPage(routeName) {
    // Update active state in list
    const items = this.seoFormElements.pageList?.querySelectorAll('.seo-page-list__item');
    items?.forEach(item => {
      item.classList.toggle('seo-page-list__item--active', item.dataset.routeName === routeName);
    });

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/${encodeURIComponent(routeName)}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load SEO data');
      }

      const result = await response.json();
      if (result.status === 'success' && result.seo) {
        this.currentSeoPage = result.seo;
        this.populateSeoForm(result.seo);
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Failed to load SEO page:', error);
      this.showToast('Failed to load SEO data', 'error');
    }
  }

  /**
   * Populate SEO form with page data
   * @param {Object} seo - SEO data object
   */
  populateSeoForm(seo) {
    const f = this.seoFormElements;
    if (!f.form) return;

    // Show content container, hide placeholder
    f.placeholder?.classList.add('hidden');
    f.content?.classList.remove('hidden');

    // Reset to metatags sub-tab
    this.switchSeoSubtab('metatags');

    // Page info
    if (f.pageName) f.pageName.textContent = seo.page_label || '';
    if (f.pagePath) f.pagePath.textContent = seo.page_path || '';
    if (f.routeName) f.routeName.value = seo.route_name || '';

    // Basic SEO
    if (f.title) f.title.value = seo.title || '';
    if (f.description) f.description.value = seo.description || '';
    if (f.keywords) f.keywords.value = seo.keywords || '';
    if (f.robots) f.robots.value = seo.robots || 'index, follow';
    if (f.canonical) f.canonical.value = seo.canonical_url || '';

    // Open Graph
    if (f.ogTitle) f.ogTitle.value = seo.og_title || '';
    if (f.ogDescription) f.ogDescription.value = seo.og_description || '';
    if (f.ogType) f.ogType.value = seo.og_type || 'website';

    // OG Image
    this.currentSeoPage.og_image_uuid = seo.og_image_uuid;
    this.updateSeoImagePreview('og_image', seo.og_image_uuid);

    // Twitter
    if (f.twitterCard) f.twitterCard.value = seo.twitter_card || 'summary';
    if (f.twitterTitle) f.twitterTitle.value = seo.twitter_title || '';
    if (f.twitterDescription) f.twitterDescription.value = seo.twitter_description || '';

    // Twitter Image
    this.currentSeoPage.twitter_image_uuid = seo.twitter_image_uuid;
    this.updateSeoImagePreview('twitter_image', seo.twitter_image_uuid);

    // Status
    if (f.isActive) f.isActive.checked = seo.is_active !== false;

    // Update character counts
    this.updateAllSeoCharCounts();

    // Load schemas for this page
    if (this.currentSeoPage?.id) {
      this.loadPageSchemas(this.currentSeoPage.id);
    }
  }

  /**
   * Update character counts for all SEO fields
   */
  updateAllSeoCharCounts() {
    const fields = ['seoTitle', 'seoDescription', 'seoOgTitle', 'seoOgDescription', 'seoTwitterTitle', 'seoTwitterDescription'];
    fields.forEach(id => {
      const field = document.getElementById(id);
      if (field) {
        field.dispatchEvent(new Event('input'));
      }
    });
  }

  /**
   * Update SEO image preview
   * @param {string} target - 'og_image' or 'twitter_image'
   * @param {string|null} uuid
   */
  updateSeoImagePreview(target, uuid) {
    let preview, placeholder, hiddenInput;

    if (target === 'og_image') {
      preview = this.seoFormElements.ogImagePreview;
      placeholder = this.seoFormElements.ogImagePlaceholder;
      hiddenInput = this.seoFormElements.ogImageUuid;
    } else {
      preview = this.seoFormElements.twitterImagePreview;
      placeholder = this.seoFormElements.twitterImagePlaceholder;
      hiddenInput = this.seoFormElements.twitterImageUuid;
    }

    if (uuid && preview) {
      preview.src = `/api/v1/upload/download/public/${uuid}`;
      preview.classList.remove('hidden');
      if (placeholder) placeholder.classList.add('hidden');
    } else {
      if (preview) preview.classList.add('hidden');
      if (placeholder) placeholder.classList.remove('hidden');
    }

    if (hiddenInput) {
      hiddenInput.value = uuid || '';
    }
  }

  /**
   * Save SEO page settings
   */
  async saveSeoPage() {
    if (!this.currentSeoPage) return;

    const f = this.seoFormElements;
    const routeName = f.routeName?.value;
    if (!routeName) return;

    const seoData = {
      title: f.title?.value || null,
      description: f.description?.value || null,
      keywords: f.keywords?.value || null,
      robots: f.robots?.value || null,
      canonical_url: f.canonical?.value || null,
      og_title: f.ogTitle?.value || null,
      og_description: f.ogDescription?.value || null,
      og_type: f.ogType?.value || null,
      og_image_uuid: this.currentSeoPage.og_image_uuid || null,
      twitter_card: f.twitterCard?.value || null,
      twitter_title: f.twitterTitle?.value || null,
      twitter_description: f.twitterDescription?.value || null,
      twitter_image_uuid: this.currentSeoPage.twitter_image_uuid || null,
      is_active: f.isActive?.checked ?? true
    };

    try {
      this.setButtonLoading(f.saveBtn, true);

      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/${encodeURIComponent(routeName)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(seoData),
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.showToast('SEO settings saved', 'success');

        // Update local page list item status
        const pageIdx = this.seoPages.findIndex(p => p.route_name === routeName);
        if (pageIdx !== -1) {
          this.seoPages[pageIdx].is_active = seoData.is_active;
          this.seoPages[pageIdx].title = seoData.title;
          this.seoPages[pageIdx].description = seoData.description;
        }
        this.renderSeoPageList();

        // Re-select current page to show active state
        const item = this.seoFormElements.pageList?.querySelector(`[data-route-name="${routeName}"]`);
        item?.classList.add('seo-page-list__item--active');
      } else {
        this.showToast(result.message || 'Failed to save SEO settings', 'error');
      }
    } catch (error) {
      console.error('Failed to save SEO:', error);
      this.showToast('Network error while saving', 'error');
    } finally {
      this.setButtonLoading(f.saveBtn, false);
    }
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
}

export default ThemeConfig;
