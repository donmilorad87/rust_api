import { getCsrfHeaders, getCsrfToken } from '../../GLOBAL/src/js/csrf.js';

const MAX_ENTITY_DEPTH = 2;
const ENTITY_MODE_INLINE = 'inline';
const ENTITY_MODE_REFERENCE = 'reference';
const SCHEMA_CATEGORY_WHITELIST = new Set([
  'Action',
  'BioChemEntity',
  'CreativeWork',
  'Event',
  'Intangible',
  'MedicalEntity',
  'Organization',
  'Person',
  'Place',
  'Product',
  'Taxon'
]);

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
    this.schemaModalTabs = config.schemaModalTabs;
    this.schemaCreatePanel = config.schemaCreatePanel;
    this.schemaAssignPanel = config.schemaAssignPanel;
    this.schemaAssignmentContainer = config.schemaAssignmentContainer;
    this.schemaSelectorContainer = config.schemaSelectorContainer;
    this.schemaFormContainer = config.schemaFormContainer;
    this.schemaFormBuilderContainer = config.schemaFormBuilderContainer;
    this.schemaPreview = config.schemaPreview;
    this.schemaPreviewCode = config.schemaPreviewCode;
    this.saveSchemaBtn = config.saveSchemaBtn;
    this.togglePreviewBtn = config.togglePreviewBtn;
    this.addSchemaBtn = config.addSchemaBtn;
    this.schemasList = config.schemasList;
    this.schemasEmpty = config.schemasEmpty;
    this.assignedSchemasList = config.assignedSchemasList;
    this.assignedSchemasEmpty = config.assignedSchemasEmpty;

    // Localization DOM elements
    this.languageForm = config.languageForm;
    this.languageResetBtn = config.languageResetBtn;
    this.languageIconFile = config.languageIconFile;
    this.languageIconPreview = config.languageIconPreview;
    this.languageIconClear = config.languageIconClear;
    this.languagesTableBody = config.languagesTableBody;
    this.localeForm = config.localeForm;
    this.localeResetBtn = config.localeResetBtn;
    this.localeLanguageSelect = config.localeLanguageSelect;
    this.localesTableBody = config.localesTableBody;
    this.localizationForm = config.localizationForm;
    this.localizationResetBtn = config.localizationResetBtn;
    this.localizationNewBtn = config.localizationNewBtn;
    this.localizationKeysTableBody = config.localizationKeysTableBody;
    this.translationInputs = config.translationInputs;
    this.localizationModal = config.localizationModal;
    this.localizationModalTitle = config.localizationModalTitle;
    this.localizationLocaleTabs = config.localizationLocaleTabs;
    this.localizationCancelBtn = config.localizationCancelBtn;
    this.seoLanguageTabs = config.seoLanguageTabs;
    this.seoAddPageBtn = config.seoAddPageBtn;
    this.seoPageModal = config.seoPageModal;
    this.seoPageModalTitle = config.seoPageModalTitle;
    this.seoPageForm = config.seoPageForm;
    this.seoPageRouteName = config.seoPageRouteName;
    this.seoPageLabel = config.seoPageLabel;
    this.seoPageSaveBtn = config.seoPageSaveBtn;
    this.seoPageCancelBtn = config.seoPageCancelBtn;
    this.hreflangForm = config.hreflangForm;
    this.hreflangIdInput = config.hreflangIdInput;
    this.hreflangCodeInput = config.hreflangCodeInput;
    this.hreflangUrlInput = config.hreflangUrlInput;
    this.hreflangDefaultInput = config.hreflangDefaultInput;
    this.hreflangCancelBtn = config.hreflangCancelBtn;
    this.hreflangTableBody = config.hreflangTableBody;

    // Component factories
    this.ColorPicker = config.ColorPicker;
    this.SizePicker = config.SizePicker;
    this.SchemaSelector = config.SchemaSelector;
    this.SchemaFormBuilder = config.SchemaFormBuilder;
    this.PageSchemaAssignment = config.PageSchemaAssignment;

    // Schema definitions (fallback for offline mode)
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
    this.logoStorageType = 'public';
    this.faviconStorageType = 'public';

    // SEO State
    this.seoPages = [];
    this.currentSeoPage = null;
    this.seoFormElements = null;

    // Schema State
    this.currentSchemaType = null;
    this.currentSchemaPath = [];
    this.editingSchemaId = null;
    this.editingSchemaEntityId = null; // For editing schema entities
    this.pageSchemas = []; // Schemas assigned to current page
    this.availableSchemas = []; // All schemas from schema_entities table
    this.schemaSelectorInstance = null;
    this.schemaFormBuilderInstance = null;
    this.pageSchemaAssignmentInstance = null;
    this.schemaModalMode = 'create'; // 'create' or 'assign'
    this.schemaDefinitionCache = new Map(); // Cache for schema definitions

    // Localization state
    this.languages = [];
    this.locales = [];
    this.localizationKeys = [];
    this.editingLanguageId = null;
    this.editingLocaleId = null;
    this.editingLocalizationKeyId = null;
    this.localizationTranslations = {};
    this.activeLocalizationLocale = null;

    // SEO language state
    this.seoLanguages = [];
    this.activeSeoLanguage = 'en';
    this.seoTranslations = {};
    this.currentSeoTranslation = null;
    this.hreflangEntries = [];

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
    this.setupLocalization();
    this.initializeDomColorPickers();
    this.initializeDomAnglePickers();
    this.initializeDomSizePickers();

    // Load current configuration from API
    console.log('Loading config...');
    await this.loadConfig();
    await this.loadLocalizationData();
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
   * Setup schema editor modal with SchemaSelector and SchemaFormBuilder components
   */
  setupSchemaModal() {
    if (!this.schemaModal) return;

    // Close on backdrop click
    this.schemaModal.addEventListener('click', (e) => {
      if (e.target === this.schemaModal || e.target.closest('[data-action="close"]')) {
        this.closeSchemaModal();
      }
    });

    // Initialize SchemaSelector component
    if (this.schemaSelectorContainer && this.SchemaSelector) {
      this.schemaSelectorInstance = new this.SchemaSelector({
        container: this.schemaSelectorContainer,
        baseUrl: this.baseUrl,
        csrfHeaders: {},
        onSelect: (typeName, path, confirmed) => {
          this.currentSchemaType = typeName;
          this.currentSchemaPath = path.map(p => p.type || p);
          if (typeName) {
            this.onSchemaTypeSelected(typeName, confirmed);
          } else {
            this.hideSchemaForm();
          }
        },
        onPathChange: (path) => {
          this.currentSchemaPath = path.map(p => p.type || p);
        }
      });
    }

    // Initialize SchemaFormBuilder component
    if (this.schemaFormBuilderContainer && this.SchemaFormBuilder) {
      this.schemaFormBuilderInstance = new this.SchemaFormBuilder({
        container: this.schemaFormBuilderContainer,
        baseUrl: this.baseUrl,
        csrfHeaders: {},
        maxDepth: 2,
        onChange: () => {
          this.updateSchemaPreview();
          if (this.saveSchemaBtn) {
            this.saveSchemaBtn.disabled = false;
          }
        }
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
      this.addSchemaBtn.addEventListener('click', () => void this.openSchemaModal());
    }

    // Setup schema modal tabs (Create New / Use Existing)
    this.setupSchemaModalTabs();
  }

  /**
   * Handle schema type selection from SchemaSelector
   * @param {string} typeName - Selected schema type
   * @param {boolean} confirmed - Whether user clicked "Use this schema"
   */
  async onSchemaTypeSelected(typeName, confirmed = false) {
    if (!typeName) {
      this.hideSchemaForm();
      return;
    }

    // Load the schema in the form builder
    if (this.schemaFormBuilderInstance) {
      await this.schemaFormBuilderInstance.loadSchema(typeName);
    }

    // Show the form container
    this.showSchemaForm();

    // Update preview
    this.updateSchemaPreview();

    // Enable save button
    if (this.saveSchemaBtn) {
      this.saveSchemaBtn.disabled = false;
    }
  }

  /**
   * Show the schema form container
   */
  showSchemaForm() {
    if (this.schemaFormContainer) {
      this.schemaFormContainer.classList.remove('hidden');
    }
    if (this.schemaPreview) {
      this.schemaPreview.classList.remove('hidden');
    }
  }

  /**
   * Hide the schema form container
   */
  hideSchemaForm() {
    if (this.schemaFormContainer) {
      this.schemaFormContainer.classList.add('hidden');
    }
    if (this.schemaPreview) {
      this.schemaPreview.classList.add('hidden');
    }
    if (this.saveSchemaBtn) {
      this.saveSchemaBtn.disabled = true;
    }
  }

  /**
   * Setup localization modal
   */
  setupLocalizationModal() {
    if (!this.localizationModal) return;

    this.localizationModal.addEventListener('click', (e) => {
      if (e.target === this.localizationModal || e.target.closest('[data-action="close"]')) {
        this.closeLocalizationModal();
      }
    });

    if (this.localizationCancelBtn) {
      this.localizationCancelBtn.addEventListener('click', () => this.closeLocalizationModal());
    }
  }

  openLocalizationModal(localizationKey = null) {
    if (!this.localizationModal) return;

    if (localizationKey) {
      this.populateLocalizationForm(localizationKey);
      if (this.localizationModalTitle) {
        this.localizationModalTitle.textContent = 'Edit Localization Key';
      }
    } else {
      this.resetLocalizationForm();
      if (this.localizationModalTitle) {
        this.localizationModalTitle.textContent = 'New Localization Key';
      }
    }

    this.localizationModal.classList.remove('hidden');
  }

  closeLocalizationModal() {
    if (!this.localizationModal) return;
    this.localizationModal.classList.add('hidden');
    this.resetLocalizationForm();
  }

  async loadSchemaCategories() {
    if (!this.schemaCategorySelect || this.schemaCategoryPopulated) return;

    let categoriesLoaded = false;
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/schemas/categories`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to load schema categories');
      }
      const payload = await response.json();
      this.schemaCategories = payload.categories || [];
      categoriesLoaded = Array.isArray(this.schemaCategories) && this.schemaCategories.length > 0;
    } catch (error) {
      console.error('Failed to load schema categories', error);
    }

    if (!categoriesLoaded && this.applySchemaCategoryFallback()) {
      this.showToast('Using offline schema catalog for categories', 'warning');
    }

    if (!this.schemaCategories.length) {
      this.showToast('Failed to load schema categories', 'error');
      return;
    }

    this.renderSchemaCategorySelect();
    this.schemaCategoryPopulated = true;
  }

  applySchemaCategoryFallback() {
    if (!this.SchemaDefinitions || !this.SchemaDefinitions.SCHEMA_CATEGORIES) return false;

    const categories = Object.keys(this.SchemaDefinitions.SCHEMA_CATEGORIES)
      .filter((type) => SCHEMA_CATEGORY_WHITELIST.has(type))
      .map((type) => {
        const entry = this.SchemaDefinitions.SCHEMA_CATEGORIES[type] || {};
        const hasChildren =
          typeof this.SchemaDefinitions.hasSchemaChildren === 'function'
            ? this.SchemaDefinitions.hasSchemaChildren(type)
            : false;
        return {
          type,
          label: entry.label || type,
          description: entry.description || '',
          has_children: hasChildren
        };
      })
      .filter((category) => category.label);

    if (!categories.length) {
      return false;
    }

    this.schemaCategories = categories;
    return true;
  }

  renderSchemaCategorySelect() {
    if (!this.schemaCategorySelect) return;
    while (this.schemaCategorySelect.options.length > 1) {
      this.schemaCategorySelect.remove(1);
    }

    const fragment = document.createDocumentFragment();
    this.schemaCategories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.type;
      option.textContent = category.label || category.type;
      fragment.appendChild(option);
    });
    this.schemaCategorySelect.appendChild(fragment);
  }

  async loadSchemaChildren(typeName) {
    if (!typeName) return [];
    if (this.schemaChildrenCache.has(typeName)) {
      return this.schemaChildrenCache.get(typeName);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/schemas/children/${encodeURIComponent(typeName)}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`Failed to load schema children for ${typeName}`);
      }
      const payload = await response.json();
      const children = payload.children || [];
      this.schemaChildrenCache.set(typeName, children);
      return children;
    } catch (error) {
      console.error(`Failed to load schema children for ${typeName}`, error);
      const fallbackChildren = this.getSchemaChildrenFallback(typeName);
      if (fallbackChildren.length) {
        this.schemaChildrenCache.set(typeName, fallbackChildren);
        return fallbackChildren;
      }
      throw error;
    }
  }

  getSchemaChildrenFallback(typeName) {
    if (!typeName || !this.SchemaDefinitions || typeof this.SchemaDefinitions.getSchemaChildren !== 'function') {
      return [];
    }
    return this.SchemaDefinitions.getSchemaChildren(typeName);
  }

  clearSchemaHierarchy() {
    if (this.schemaHierarchyContainer) {
      this.schemaHierarchyContainer.innerHTML = '';
    }
  }

  async renderSchemaLevel(parentType, depth, selectedType = '') {
    if (!this.schemaHierarchyContainer) return;
    let children = [];
    try {
      children = await this.loadSchemaChildren(parentType);
    } catch (error) {
      this.showToast('Failed to load schema children', 'error');
      console.error(error);
      return;
    }

    if (!children.length) {
      await this.onSchemaTypeChange(parentType);
      return;
    }

    const select = document.createElement('select');
    select.className = 'form-select schema-hierarchy__select';
    select.dataset.depth = String(depth);
    select.dataset.parent = parentType;
    select.innerHTML = '<option value=\"\">-- Select a schema type --</option>';

    children.forEach(child => {
      const option = document.createElement('option');
      option.value = child.type;
      option.textContent = child.label || child.type;
      select.appendChild(option);
    });

    select.addEventListener('change', (event) => {
      const value = event.target.value;
      this.trimSchemaHierarchy(depth);
      if (value) {
        void this.renderSchemaLevel(value, depth + 1);
      } else {
        void this.onSchemaTypeChange('');
      }
    });

    this.schemaHierarchyContainer.appendChild(select);
    if (selectedType) {
      select.value = selectedType;
      if (selectedType) {
        void this.renderSchemaLevel(selectedType, depth + 1);
      }
    }
  }

  trimSchemaHierarchy(depth) {
    if (!this.schemaHierarchyContainer) return;
    const selects = Array.from(this.schemaHierarchyContainer.querySelectorAll('.schema-hierarchy__select'));
    selects.forEach(select => {
      const selectDepth = parseInt(select.dataset.depth || '0', 10);
      if (selectDepth > depth) {
        select.remove();
      }
    });
  }

  async onSchemaTypeChange(schemaType) {
    if (!schemaType) {
      this.currentSchemaType = null;
      if (this.schemaFields) this.schemaFields.classList.add('hidden');
      if (this.schemaPreview) this.schemaPreview.classList.add('hidden');
      if (this.saveSchemaBtn) this.saveSchemaBtn.disabled = true;
      if (this.schemaTypeDescription) {
        this.schemaTypeDescription.textContent = 'Select a schema type to configure structured data';
      }
      return;
    }

    let schemaDef;
    try {
      schemaDef = await this.fetchSchemaDefinition(schemaType);
    } catch (error) {
      this.showToast('Schema type not found', 'error');
      console.error(error);
      return;
    }

    this.currentSchemaType = schemaType;

    if (this.schemaTypeDescription) {
      this.schemaTypeDescription.textContent = schemaDef.description || 'Schema definition loaded.';
    }

    const fieldDefs = this.buildFieldsFromSchemaDefinition(schemaDef);
    this.generateSchemaFields({ type: schemaType, fields: fieldDefs });
    if (this.schemaFields) this.schemaFields.classList.remove('hidden');

    if (this.schemaPreview) this.schemaPreview.classList.remove('hidden');
    this.updateSchemaPreview();

    if (this.saveSchemaBtn) this.saveSchemaBtn.disabled = false;
  }

  /**
   * Build the default schema @id value (URN format)
   * @param {string} schemaType - Schema.org @type value
   * @returns {string} Default schema @id
   */
  buildSchemaIdDefault(schemaType) {
    const lang = (this.activeSeoLanguage || 'en').toLowerCase();
    const type = (schemaType || 'entity').toLowerCase();
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
    return `urn:${lang}:entity:${type}:${uuid}`;
  }

  /**
   * Generate form fields for a schema type
   * @param {Object} schemaDef - Schema definition object
   */
  generateSchemaFields(schemaDef) {
    if (!this.schemaFields) return;

    this.schemaFields.innerHTML = '';

    const schemaIdField = {
      name: '@id',
      type: 'text',
      label: '@id',
      help: 'Defaults to urn:language:entity:type:uuid (editable).',
      value: this.buildSchemaIdDefault(schemaDef.type)
    };

    const schemaFields = schemaDef.fields.some(field => field.name === '@id')
      ? schemaDef.fields
      : [schemaIdField, ...schemaDef.fields];

    schemaFields.forEach(field => {
      if (field.type === 'hidden') return; // Skip hidden fields

      const fieldHtml = this.generateFieldHtml(field, '', 0);
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
  generateFieldHtml(field, prefix = '', depth = 0) {
    const fieldId = prefix ? `${prefix}_${field.name}` : `schema_${field.name}`;
    const isRequired = field.required ? 'form-group--required' : '';
    const placeholder = field.placeholder || '';
    const helpText = field.help || '';
    const defaultValue = field.value === undefined || field.value === null ? '' : String(field.value);
    const safeValue = this.escapeHtml(defaultValue);
    const valueAttr = safeValue ? ` value="${safeValue}"` : '';

    let inputHtml = '';

    switch (field.type) {
      case 'text':
      case 'url':
      case 'email':
      case 'tel':
        inputHtml = `<input type="${field.type}" id="${fieldId}" class="form-input schema-field"
          data-field="${field.name}" placeholder="${placeholder}"${valueAttr}>`;
        break;

      case 'number':
        inputHtml = `<input type="number" id="${fieldId}" class="form-input schema-field"
          data-field="${field.name}" placeholder="${placeholder}" step="any"${valueAttr}>`;
        break;

      case 'date':
        inputHtml = `<input type="date" id="${fieldId}" class="form-input schema-field"
          data-field="${field.name}"${valueAttr}>`;
        break;

      case 'datetime':
        inputHtml = `<input type="datetime-local" id="${fieldId}" class="form-input schema-field"
          data-field="${field.name}"${valueAttr}>`;
        break;

      case 'textarea':
        inputHtml = `<textarea id="${fieldId}" class="form-textarea schema-field"
          data-field="${field.name}" rows="3" placeholder="${placeholder}">${safeValue}</textarea>`;
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
        inputHtml = this.generateNestedFieldHtml(field, fieldId, depth);
        break;

      case 'entity':
        inputHtml = this.generateEntityFieldHtml(field, fieldId, depth);
        break;

      case 'mixed':
        inputHtml = this.generateMixedFieldHtml(field, fieldId, depth);
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
  generateNestedFieldHtml(field, fieldId, depth = 0) {
    const nestedFields = field.fields || [];
    const fieldsHtml = nestedFields
      .filter(f => f.type !== 'hidden')
      .map(f => this.generateFieldHtml(f, fieldId, depth + 1))
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

  getDataInputType(dataTypes, fieldName) {
    const types = new Set(dataTypes || []);
    if (types.has('Boolean')) return 'boolean';
    if (types.has('DateTime')) return 'datetime';
    if (types.has('Date')) return 'date';
    if (types.has('Number') || types.has('Float') || types.has('Integer')) return 'number';
    if (types.has('URL')) return 'url';
    if (fieldName.toLowerCase().includes('description')) return 'textarea';
    return 'text';
  }

  mapDataTypeToFieldType(dataType, fieldName) {
    const inputType = this.getDataInputType([dataType], fieldName);
    if (inputType === 'textarea') return 'textarea';
    if (inputType === 'datetime') return 'datetime';
    if (inputType === 'date') return 'date';
    if (inputType === 'number') return 'number';
    if (inputType === 'boolean') return 'boolean';
    if (inputType === 'url') return 'url';
    return 'text';
  }

  async fetchSchemaDefinition(typeName) {
    if (!typeName) {
      throw new Error('Schema type is required');
    }
    if (this.schemaDefinitionCache.has(typeName)) {
      return this.schemaDefinitionCache.get(typeName);
    }

    const response = await fetch(`${this.baseUrl}/api/v1/schemas/${encodeURIComponent(typeName)}`, {
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`Schema type ${typeName} not found`);
    }
    const payload = await response.json();
    const schema = payload.schema || payload;
    this.schemaDefinitionCache.set(typeName, schema);
    return schema;
  }

  buildFieldsFromSchemaDefinition(schemaDef) {
    const properties = schemaDef?.properties || [];
    return properties.map(prop => {
      const expected = prop.expected_types || [];
      const dataTypes = expected.filter(item => item.kind === 'data_type').map(item => item.type);
      const entityTypes = expected.filter(item => item.kind !== 'data_type').map(item => item.type);
      const field = {
        name: prop.name,
        label: prop.label || prop.name,
        help: prop.description || '',
        dataTypes,
        entityTypes
      };

      if (entityTypes.length && dataTypes.length) {
        return { ...field, type: 'mixed' };
      }
      if (entityTypes.length) {
        return { ...field, type: 'entity' };
      }
      if (dataTypes.length > 1) {
        return { ...field, type: 'mixed' };
      }
      if (dataTypes.length === 1) {
        return { ...field, type: this.mapDataTypeToFieldType(dataTypes[0], prop.name) };
      }
      return { ...field, type: 'text' };
    });
  }

  buildInlineEntityFields(schemaType, prefix, depth) {
    const schemaDef = this.schemaDefinitionCache.get(schemaType);
    if (!schemaDef) {
      return `<p class="form-help">Schema type not available yet.</p>`;
    }

    const schemaIdField = {
      name: '@id',
      type: 'text',
      label: '@id',
      help: 'Defaults to urn:language:entity:type:uuid (editable).',
      value: this.buildSchemaIdDefault(schemaType)
    };

    const baseFields = this.buildFieldsFromSchemaDefinition(schemaDef);
    const fields = baseFields.some(field => field.name === '@id')
      ? baseFields
      : [schemaIdField, ...baseFields];

    return fields
      .filter(field => field.type !== 'hidden')
      .map(field => this.generateFieldHtml(field, prefix, depth))
      .join('');
  }

  generateEntityFieldHtml(field, fieldId, depth = 0) {
    const entityTypes = field.entityTypes || [];
    const defaultType = entityTypes[0] || 'Thing';
    const allowInline = depth < MAX_ENTITY_DEPTH;
    const defaultMode = ENTITY_MODE_REFERENCE;
    const typeLabel = entityTypes.length ? entityTypes.join(' or ') : 'entity';
    const inlineFields = allowInline
      ? this.buildInlineEntityFields(defaultType, fieldId, depth + 1)
      : '<p class="form-help">Inline editing is disabled at this depth. Use @id reference.</p>';
    const typeOptions = entityTypes.map((type, index) => `
        <label class="schema-radio">
          <input type="radio" class="schema-entity__type-radio" name="${fieldId}_type"
            value="${type}"${index === 0 ? ' checked' : ''}>
          <span>${type}</span>
        </label>
      `).join('');

    return `
      <div class="schema-entity" data-field="${field.name}" data-mode="${defaultMode}" data-prefix="${fieldId}" data-depth="${depth}">
        <div class="schema-entity__header">
          <span class="schema-entity__title">${field.label}</span>
          ${allowInline ? `
            <label class="schema-entity__toggle">
              <input type="checkbox" class="schema-entity__toggle-input" data-action="inline-toggle">
              Enter manually
            </label>
          ` : ''}
        </div>
        ${entityTypes.length > 1 ? `
          <div class="schema-entity__types">
            ${typeOptions}
          </div>
        ` : entityTypes.length === 1 ? `
          <div class="schema-entity__types">
            ${typeOptions}
          </div>
        ` : ''}
        <div class="schema-entity__reference${defaultMode === ENTITY_MODE_REFERENCE ? '' : ' hidden'}">
          <input type="text" class="form-input schema-entity__ref" placeholder="urn:language:entity:type:uuid">
          <p class="form-help">Use @id to reference existing ${typeLabel}, or enable manual entry.</p>
        </div>
        <div class="schema-entity__inline${defaultMode === ENTITY_MODE_INLINE ? '' : ' hidden'}">
          <div class="schema-entity__inline-fields">
            ${inlineFields}
          </div>
        </div>
      </div>
    `;
  }

  generateMixedFieldHtml(field, fieldId, depth = 0) {
    const dataTypes = field.dataTypes || [];
    const entityTypes = field.entityTypes || [];
    const defaultDataType = dataTypes[0] || 'Text';
    const defaultEntityType = entityTypes[0] || 'Thing';
    const allowInline = depth < MAX_ENTITY_DEPTH;
    const inputType = this.getDataInputType(dataTypes, field.name);

    const inlineFields = allowInline
      ? this.buildInlineEntityFields(defaultEntityType, fieldId, depth + 1)
      : '<p class="form-help">Inline editing is disabled at this depth. Use reference.</p>';

    const dataTypeOptions = dataTypes.map((type, index) => `
        <label class="schema-radio">
          <input type="radio" class="schema-mixed__type-radio" name="${fieldId}_expected_type"
            data-kind="data" value="${type}"${index === 0 && !entityTypes.length ? ' checked' : ''}>
          <span>${type}</span>
        </label>
      `).join('');
    const entityTypeOptions = entityTypes.map((type, index) => `
        <label class="schema-radio">
          <input type="radio" class="schema-mixed__type-radio" name="${fieldId}_expected_type"
            data-kind="entity" value="${type}"${index === 0 && !dataTypes.length ? ' checked' : ''}>
          <span>${type}</span>
        </label>
      `).join('');

    const hasMixedTypes = dataTypes.length && entityTypes.length;

    return `
      <div class="schema-mixed" data-field="${field.name}" data-prefix="${fieldId}" data-depth="${depth}">
        <div class="schema-mixed__header">
          <span class="schema-mixed__title">${field.label}</span>
        </div>
        <div class="schema-mixed__types">
          ${dataTypeOptions}
          ${entityTypeOptions}
        </div>
        <div class="schema-mixed__data${entityTypes.length && !dataTypes.length ? ' hidden' : ''}${hasMixedTypes ? ' hidden' : ''}">
          ${inputType === 'textarea'
            ? `<textarea class="form-textarea schema-mixed__data-input" rows="3" placeholder="Enter value..."></textarea>`
            : `<input type="${inputType}" class="form-input schema-mixed__data-input" placeholder="Enter value...">`}
        </div>
        <div class="schema-mixed__entity schema-entity${dataTypes.length ? ' hidden' : ''}${hasMixedTypes ? ' hidden' : ''}" data-mode="${ENTITY_MODE_REFERENCE}" data-prefix="${fieldId}" data-depth="${depth}">
          <div class="schema-entity__header">
            <span class="schema-entity__title">Entity</span>
            ${allowInline ? `
              <label class="schema-entity__toggle">
                <input type="checkbox" class="schema-entity__toggle-input" data-action="inline-toggle">
                Enter manually
              </label>
            ` : ''}
          </div>
          <div class="schema-entity__reference">
            <input type="text" class="form-input schema-entity__ref" placeholder="urn:language:entity:type:uuid">
            <p class="form-help">Use @id to reference an entity, or enable manual entry.</p>
          </div>
          <div class="schema-entity__inline hidden">
            <div class="schema-entity__inline-fields">
              ${inlineFields}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners for dynamically generated schema fields
   */
  setupSchemaFieldListeners() {
    if (!this.schemaFields) return;
    if (this.schemaFieldListenersBound) return;
    this.schemaFieldListenersBound = true;

    // Listen for input changes to update preview
    this.schemaFields.addEventListener('input', () => {
      this.updateSchemaPreview();
    });

    this.schemaFields.addEventListener('change', () => {
      this.updateSchemaPreview();
    });

    this.schemaFields.addEventListener('click', (event) => {
      const addButton = event.target.closest('.schema-array__add');
      if (addButton) {
        const arrayId = addButton.dataset.array;
        this.addArrayItem(arrayId);
        return;
      }

      const toggleInput = event.target.closest('.schema-entity__toggle-input');
      if (toggleInput) {
        const container = toggleInput.closest('.schema-entity');
        if (!container) return;
        const mode = toggleInput.checked ? ENTITY_MODE_INLINE : ENTITY_MODE_REFERENCE;
        this.setEntityMode(container, mode);
      }
    });

    this.schemaFields.addEventListener('change', (event) => {
      const entityTypeRadio = event.target.closest('.schema-entity__type-radio');
      if (entityTypeRadio) {
        const container = entityTypeRadio.closest('.schema-entity');
        if (!container) return;
        void this.updateEntityInlineFields(container);
        return;
      }

      const mixedTypeRadio = event.target.closest('.schema-mixed__type-radio');
      if (mixedTypeRadio) {
        const container = mixedTypeRadio.closest('.schema-mixed');
        if (!container) return;
        this.updateMixedField(container);
      }
    });
  }

  setEntityMode(container, mode) {
    container.dataset.mode = mode;
    const inline = container.querySelector('.schema-entity__inline');
    const reference = container.querySelector('.schema-entity__reference');
    const toggle = container.querySelector('.schema-entity__toggle-input');

    if (inline) inline.classList.toggle('hidden', mode !== ENTITY_MODE_INLINE);
    if (reference) reference.classList.toggle('hidden', mode !== ENTITY_MODE_REFERENCE);
    if (toggle) toggle.checked = mode === ENTITY_MODE_INLINE;
    if (mode === ENTITY_MODE_INLINE) {
      void this.updateEntityInlineFields(container);
    }
    this.updateSchemaPreview();
  }

  async updateEntityInlineFields(container) {
    const inlineFields = container.querySelector('.schema-entity__inline-fields');
    if (!inlineFields) return;
    if (container.dataset.mode !== ENTITY_MODE_INLINE) return;

    const typeRadio = container.querySelector('.schema-entity__type-radio:checked');
    let schemaType = typeRadio?.value;
    if (!schemaType) {
      const mixedParent = container.closest('.schema-mixed');
      const mixedRadio = mixedParent?.querySelector('.schema-mixed__type-radio[data-kind="entity"]:checked');
      schemaType = mixedRadio?.value;
    }
    if (!schemaType) {
      schemaType = 'Thing';
    }
    const fieldId = container.dataset.prefix || `${container.dataset.field}_entity`;
    const depth = parseInt(container.dataset.depth || '0', 10) + 1;

    try {
      await this.fetchSchemaDefinition(schemaType);
      inlineFields.innerHTML = this.buildInlineEntityFields(schemaType, fieldId, depth);
    } catch (error) {
      inlineFields.innerHTML = '<p class="form-help">Failed to load schema type.</p>';
      console.error(error);
    }
    this.updateSchemaPreview();
  }

  updateMixedField(container) {
    const typeRadio = container.querySelector('.schema-mixed__type-radio:checked');
    if (!typeRadio) return;

    const value = typeRadio.value || '';
    const kind = typeRadio.dataset.kind || 'data';
    const dataSection = container.querySelector('.schema-mixed__data');
    const entitySection = container.querySelector('.schema-mixed__entity');

    if (kind === 'entity') {
      if (dataSection) dataSection.classList.add('hidden');
      if (entitySection) entitySection.classList.remove('hidden');
      if (entitySection) {
        entitySection.dataset.selectedType = value;
        this.setEntityMode(entitySection, ENTITY_MODE_REFERENCE);
      }
      return;
    }

    if (dataSection) dataSection.classList.remove('hidden');
    if (entitySection) entitySection.classList.add('hidden');

    if (dataSection) {
      const dataType = value;
      const fieldName = container.dataset.field || '';
      const inputType = this.getDataInputType([dataType], fieldName);
      const existingInput = dataSection.querySelector('.schema-mixed__data-input');
      if (existingInput) {
        if (inputType === 'textarea') {
          if (existingInput.tagName.toLowerCase() !== 'textarea') {
            dataSection.innerHTML = `<textarea class="form-textarea schema-mixed__data-input" rows="3" placeholder="Enter value..."></textarea>`;
          }
        } else {
          if (existingInput.tagName.toLowerCase() !== 'input' || existingInput.type !== inputType) {
            dataSection.innerHTML = `<input type="${inputType}" class="form-input schema-mixed__data-input" placeholder="Enter value...">`;
          }
        }
      }
    }
    this.updateSchemaPreview();
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
    if (!this.currentSchemaType) return null;

    // Use SchemaFormBuilder's getData method if available
    if (this.schemaFormBuilderInstance) {
      return this.schemaFormBuilderInstance.getData();
    }

    // For entity edit form, collect from simple fields
    if (this.editingSchemaEntityId && this.schemaFields) {
      return this.collectEntityEditFormData();
    }

    return null;
  }

  /**
   * Collect data from the entity edit form (simple key-value fields)
   * @returns {Object} Schema data object
   */
  collectEntityEditFormData() {
    if (!this.schemaFields) return {};

    const data = {};

    this.schemaFields.querySelectorAll('.schema-form__field-group').forEach(fieldGroup => {
      const fieldName = fieldGroup.dataset.fieldName;
      if (!fieldName) return;

      const input = fieldGroup.querySelector('input, textarea');
      if (!input) return;

      let value = input.value;

      // Parse JSON for object fields
      if (input.dataset.type === 'object') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          // Keep as string if invalid JSON
        }
      } else if (input.type === 'number') {
        value = value ? parseFloat(value) : null;
      } else {
        value = value.trim();
      }

      // Only include non-empty values
      if (value !== null && value !== '' && value !== undefined) {
        data[fieldName] = value;
      }
    });

    return data;
  }

  collectSchemaDataFromContainer(container) {
    if (!container) return {};
    const data = {};

    container.querySelectorAll('.schema-field').forEach(input => {
      const fieldName = input.dataset.field;
      if (!fieldName) return;
      if (input.closest('.schema-nested, .schema-entity, .schema-mixed') && input.closest('.schema-nested, .schema-entity, .schema-mixed') !== container) {
        return;
      }

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

    container.querySelectorAll('.schema-array').forEach(arrayEl => {
      if (arrayEl.closest('.schema-nested, .schema-entity, .schema-mixed') && arrayEl.closest('.schema-nested, .schema-entity, .schema-mixed') !== container) {
        return;
      }

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

    container.querySelectorAll('.schema-nested').forEach(nestedEl => {
      if (nestedEl.closest('.schema-entity, .schema-mixed') && nestedEl.closest('.schema-entity, .schema-mixed') !== container) {
        return;
      }

      const fieldName = nestedEl.dataset.field;
      const schemaType = nestedEl.dataset.schema;
      if (!fieldName) return;

      const nestedData = this.collectSchemaDataFromContainer(nestedEl);
      if (schemaType) {
        nestedData['@type'] = schemaType;
      }

      if (Object.keys(nestedData).length > 1) {
        data[fieldName] = nestedData;
      }
    });

    container.querySelectorAll('.schema-entity').forEach(entityEl => {
      if (entityEl.closest('.schema-entity, .schema-mixed') && entityEl.closest('.schema-entity, .schema-mixed') !== container) {
        return;
      }

      const fieldName = entityEl.dataset.field;
      if (!fieldName) return;

      const mode = entityEl.dataset.mode || ENTITY_MODE_INLINE;
      if (mode === ENTITY_MODE_REFERENCE) {
        const refInput = entityEl.querySelector('.schema-entity__ref');
        const refValue = refInput?.value.trim();
        if (refValue) {
          data[fieldName] = { '@id': refValue };
        }
        return;
      }

      const typeRadio = entityEl.querySelector('.schema-entity__type-radio:checked');
      const schemaType = typeRadio?.value;
      const inlineContainer = entityEl.querySelector('.schema-entity__inline');
      const inlineData = this.collectSchemaDataFromContainer(inlineContainer);
      if (schemaType) {
        inlineData['@type'] = schemaType;
      }

      if (Object.keys(inlineData).length > 1) {
        data[fieldName] = inlineData;
      }
    });

    container.querySelectorAll('.schema-mixed').forEach(mixedEl => {
      if (mixedEl.closest('.schema-mixed') && mixedEl.closest('.schema-mixed') !== container) {
        return;
      }

      const fieldName = mixedEl.dataset.field;
      if (!fieldName) return;

      const typeRadio = mixedEl.querySelector('.schema-mixed__type-radio:checked');
      const selected = typeRadio?.value || '';
      const kind = typeRadio?.dataset.kind || 'data';

      if (kind === 'entity') {
        const entityContainer = mixedEl.querySelector('.schema-mixed__entity');
        if (!entityContainer) return;
        const mode = entityContainer.dataset.mode || ENTITY_MODE_INLINE;

        if (mode === ENTITY_MODE_REFERENCE) {
          const refInput = entityContainer.querySelector('.schema-entity__ref');
          const refValue = refInput?.value.trim();
          if (refValue) {
            data[fieldName] = { '@id': refValue };
          }
          return;
        }

        const schemaType = selected || entityContainer.dataset.selectedType;
        const inlineContainer = entityContainer.querySelector('.schema-entity__inline');
        const inlineData = this.collectSchemaDataFromContainer(inlineContainer);
        if (schemaType) {
          inlineData['@type'] = schemaType;
        }
        if (Object.keys(inlineData).length > 1) {
          data[fieldName] = inlineData;
        }
        return;
      }

      const dataInput = mixedEl.querySelector('.schema-mixed__data-input');
      if (!dataInput) return;

      let value;
      if (dataInput.type === 'checkbox') {
        value = dataInput.checked;
      } else if (dataInput.type === 'number') {
        value = dataInput.value ? parseFloat(dataInput.value) : null;
      } else {
        value = dataInput.value.trim();
      }

      if (value !== null && value !== '' && value !== false) {
        data[fieldName] = value;
      }
    });

    return data;
  }

  buildJsonLd(schemaType, data) {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': schemaType,
      ...data
    };

    Object.keys(jsonLd).forEach(key => {
      if (jsonLd[key] === '' || jsonLd[key] === null || jsonLd[key] === undefined) {
        delete jsonLd[key];
      }
      if (Array.isArray(jsonLd[key]) && jsonLd[key].length === 0) {
        delete jsonLd[key];
      }
    });

    return jsonLd;
  }

  /**
   * Update the JSON-LD preview
   */
  updateSchemaPreview() {
    if (!this.schemaPreviewCode || !this.currentSchemaType) return;

    const data = this.collectSchemaData();
    const jsonLd = this.buildJsonLd(this.currentSchemaType, data || {});

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
    this.currentSchemaPath = [];
    this.editingSchemaId = null;
    this.editingSchemaEntityId = null;
    this.schemaModalMode = 'create';

    // Show tabs and reset to default state (Create New)
    if (this.schemaModalTabs) {
      this.schemaModalTabs.classList.remove('hidden');
    }
    this.switchSchemaModalTab('create');

    // Reset SchemaSelector component
    if (this.schemaSelectorInstance) {
      void this.schemaSelectorInstance.reset();
    }

    // Reset SchemaFormBuilder component
    if (this.schemaFormBuilderInstance) {
      this.schemaFormBuilderInstance.reset();
    }

    // Hide form and preview containers
    this.hideSchemaForm();

    if (this.schemaPreviewCode) {
      this.schemaPreviewCode.textContent = '{}';
    }

    if (this.schemaModalTitle) {
      this.schemaModalTitle.textContent = 'Add Schema';
    }
  }

  /**
   * Switch between schema modal tabs (create / assign)
   * @param {string} tabName - Tab name ('create' or 'assign')
   */
  switchSchemaModalTab(tabName) {
    this.schemaModalMode = tabName;

    // Update tab buttons
    if (this.schemaModalTabs) {
      this.schemaModalTabs.querySelectorAll('.schema-modal-tabs__tab').forEach(tab => {
        if (tab.dataset.tab === tabName) {
          tab.classList.add('schema-modal-tabs__tab--active');
        } else {
          tab.classList.remove('schema-modal-tabs__tab--active');
        }
      });
    }

    // Show/hide panels
    if (this.schemaCreatePanel) {
      this.schemaCreatePanel.classList.toggle('hidden', tabName !== 'create');
    }
    if (this.schemaAssignPanel) {
      this.schemaAssignPanel.classList.toggle('hidden', tabName !== 'assign');
    }

    // Show/hide save button based on mode
    if (this.saveSchemaBtn) {
      this.saveSchemaBtn.classList.toggle('hidden', tabName === 'assign');
    }

    // Initialize assignment component when switching to assign tab
    if (tabName === 'assign' && this.schemaAssignmentContainer) {
      this.initPageSchemaAssignment();
    }
  }

  /**
   * Initialize PageSchemaAssignment component
   */
  initPageSchemaAssignment() {
    // Only initialize once per session, or reinit with new language
    if (!this.pageSchemaAssignmentInstance && this.PageSchemaAssignment) {
      this.pageSchemaAssignmentInstance = new this.PageSchemaAssignment({
        container: this.schemaAssignmentContainer,
        baseUrl: this.baseUrl,
        showToast: this.showToast,
        csrfHeaders: getCsrfHeaders(),
        langCode: this.activeSeoLanguage,
        onAssign: (entityData) => this.handleEntityAssignment(entityData)
      });
      this.pageSchemaAssignmentInstance.init();
    } else if (this.pageSchemaAssignmentInstance) {
      // Update language code if changed
      this.pageSchemaAssignmentInstance.setLangCode(this.activeSeoLanguage);
    }
  }

  /**
   * Handle entity assignment from PageSchemaAssignment component
   * @param {Object} entityData - Entity data to assign
   */
  async handleEntityAssignment(entityData) {
    if (!this.currentSeoPage) {
      this.showToast('Please select a page first', 'error');
      return;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/admin/seo/page/${this.currentSeoPage.id}/schemas`,
        {
          method: 'POST',
          headers: getCsrfHeaders(),
          credentials: 'include',
          body: JSON.stringify({
            lang_code: this.activeSeoLanguage,
            schema_type: entityData.schema_type,
            schema_data: entityData.schema_data,
            is_active: true
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to assign schema');
      }

      const result = await response.json();
      if (result.status === 'success') {
        this.showToast('Schema assigned to page', 'success');
        this.closeSchemaModal();
        this.loadPageSchemas(this.currentSeoPage.id);
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Assign schema error:', error);
      this.showToast(`Failed to assign schema: ${error.message}`, 'error');
    }
  }

  /**
   * Setup schema modal tab click handlers
   */
  setupSchemaModalTabs() {
    if (this.schemaModalTabs) {
      this.schemaModalTabs.querySelectorAll('.schema-modal-tabs__tab').forEach(tab => {
        tab.addEventListener('click', () => {
          const tabName = tab.dataset.tab;
          if (tabName) {
            this.switchSchemaModalTab(tabName);
          }
        });
      });
    }
  }

  /**
   * Save current schema
   */
  async saveCurrentSchema() {
    if (!this.currentSchemaType) {
      this.showToast('Please select a schema type first', 'error');
      return;
    }

    // For page schemas, we need a page selected
    if (!this.editingSchemaEntityId && !this.currentSeoPage) {
      this.showToast('Please select an SEO page first', 'error');
      return;
    }

    const data = this.collectSchemaData();
    if (!data || Object.keys(data).length === 0) {
      this.showToast('Please fill in at least one field', 'error');
      return;
    }

    const jsonLd = this.buildJsonLd(this.currentSchemaType, data);

    try {
      // Check if we're editing a schema entity (from Available Schemas)
      if (this.editingSchemaEntityId) {
        // Update the schema entity
        const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/entities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getCsrfHeaders()
          },
          credentials: 'include',
          body: JSON.stringify({
            lang_code: this.activeSeoLanguage,
            schema_id: this.editingSchemaEntityId,
            schema_type: this.currentSchemaType,
            schema_data: jsonLd
          })
        });

        if (!response.ok) {
          throw new Error('Failed to update schema entity');
        }

        const result = await response.json();
        if (result.status === 'success') {
          this.showToast('Schema entity updated', 'success');
          this.closeSchemaModal();
          // Reload available schemas to show updated data
          await this.loadAvailableSchemas();
        } else {
          throw new Error(result.message || 'Unknown error');
        }
      } else {
        // Creating/updating a page schema
        const endpoint = this.editingSchemaId
          ? `${this.baseUrl}/api/v1/admin/seo/schema/${this.editingSchemaId}`
          : `${this.baseUrl}/api/v1/admin/seo/page/${this.currentSeoPage.id}/schemas`;

        const method = this.editingSchemaId ? 'PUT' : 'POST';

        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...getCsrfHeaders()
          },
          credentials: 'include',
          body: JSON.stringify({
            lang_code: this.activeSeoLanguage,
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
    console.log('[loadPageSchemas] Loading schemas for page:', pageId, 'lang:', this.activeSeoLanguage);
    try {
      const url = `${this.baseUrl}/api/v1/admin/seo/page/${pageId}/schemas?lang_code=${encodeURIComponent(this.activeSeoLanguage)}`;
      console.log('[loadPageSchemas] Fetching:', url);

      const response = await fetch(url, {
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      console.log('[loadPageSchemas] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[loadPageSchemas] Error response:', errorText);
        throw new Error('Failed to load schemas');
      }

      const result = await response.json();
      console.log('[loadPageSchemas] Result:', result);

      if (result.status === 'success') {
        this.pageSchemas = result.schemas || [];
        console.log('[loadPageSchemas] Loaded schemas:', this.pageSchemas.length, this.pageSchemas);
        this.renderAssignedSchemasList();
      }
    } catch (error) {
      console.error('[loadPageSchemas] Load schemas error:', error);
      // Don't show error toast - schemas might not exist yet
      this.pageSchemas = [];
      this.renderAssignedSchemasList();
    }

    // Also load available schemas
    await this.loadAvailableSchemas();
  }

  /**
   * Load all available schemas from schema_entities table
   */
  async loadAvailableSchemas() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/entities?lang_code=${encodeURIComponent(this.activeSeoLanguage)}&limit=200`, {
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load available schemas');
      }

      const result = await response.json();
      if (result.status === 'success') {
        this.availableSchemas = result.entities || [];
        this.renderAvailableSchemasList();
      }
    } catch (error) {
      console.error('Load available schemas error:', error);
      this.availableSchemas = [];
      this.renderAvailableSchemasList();
    }
  }

  /**
   * Render available schemas list (left panel - all schemas from database)
   */
  renderAvailableSchemasList() {
    if (!this.schemasList) return;

    // Clear existing cards (keep empty state element)
    this.schemasList.querySelectorAll('.schema-card').forEach(card => card.remove());

    if (this.availableSchemas.length === 0) {
      if (this.schemasEmpty) this.schemasEmpty.classList.remove('hidden');
      return;
    }

    if (this.schemasEmpty) this.schemasEmpty.classList.add('hidden');

    this.availableSchemas.forEach(schema => {
      // Check if this schema is already assigned to the current page
      // Compare by @id in schema_data since pageSchemas stores copied data
      const isAssigned = this.pageSchemas.some(ps => {
        const psId = ps.schema_data?.['@id'];
        return psId && psId === schema.schema_id;
      });

      const label = schema.schema_type || 'Unknown';
      const schemaData = schema.schema_data || {};
      const description = schemaData.name || schemaData.title || schemaData['@id'] || schema.schema_id || '';

      const cardHtml = `
        <div class="schema-card ${isAssigned ? 'schema-card--assigned' : ''}" data-schema-id="${this.escapeHtml(schema.schema_id)}" data-entity-id="${schema.id}">
          <div class="schema-card__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </div>
          <div class="schema-card__content">
            <div class="schema-card__type">${this.escapeHtml(label)}</div>
            <div class="schema-card__description">${this.escapeHtml(description)}</div>
          </div>
          <div class="schema-card__actions">
            <button type="button" class="schema-card__btn schema-card__btn--assign ${isAssigned ? 'hidden' : ''}" data-action="assign" title="Add to this page">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <span class="schema-card__assigned-badge ${isAssigned ? '' : 'hidden'}">Assigned</span>
            <button type="button" class="schema-card__btn schema-card__btn--delete" data-action="delete" title="Delete schema">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
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

      // Click on card to edit
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking on action buttons
        if (e.target.closest('.schema-card__actions')) return;
        this.openSchemaEntityForEdit(schemaId);
      });

      // Add cursor pointer style
      card.style.cursor = 'pointer';

      card.querySelector('[data-action="assign"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.assignSchemaToCurrentPage(schemaId);
      });

      card.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSchemaEntity(schemaId);
      });
    });
  }

  /**
   * Delete a schema entity from the database
   * This will also cascade delete all page_schemas that reference it
   * @param {string} schemaId - The schema_id from schema_entities table
   */
  async deleteSchemaEntity(schemaId) {
    const schemaEntity = this.availableSchemas.find(s => s.schema_id === schemaId);
    const label = schemaEntity?.schema_type || 'this schema';

    if (!confirm(`Delete "${label}"?\n\nThis will also remove it from all pages where it is assigned.`)) {
      return;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/admin/seo/entities/${encodeURIComponent(schemaId)}?lang_code=${encodeURIComponent(this.activeSeoLanguage)}`,
        {
          method: 'DELETE',
          headers: getCsrfHeaders(),
          credentials: 'include'
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete schema');
      }

      const result = await response.json();
      if (result.status === 'success') {
        this.showToast('Schema deleted', 'success');
        // Reload both lists to reflect changes
        await this.loadAvailableSchemas();
        if (this.currentSeoPage) {
          await this.loadPageSchemas(this.currentSeoPage.id);
        }
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Delete schema error:', error);
      this.showToast(`Failed to delete schema: ${error.message}`, 'error');
    }
  }

  /**
   * Assign a schema entity to the current page
   * @param {string} schemaId - The schema_id from schema_entities table
   */
  async assignSchemaToCurrentPage(schemaId) {
    if (!this.currentSeoPage) {
      this.showToast('Please select a page first', 'error');
      return;
    }

    try {
      // First, find the schema entity in our cached list
      const schemaEntity = this.availableSchemas.find(s => s.schema_id === schemaId);
      if (!schemaEntity) {
        throw new Error('Schema entity not found');
      }

      // Create page schema using the entity's data
      const response = await fetch(
        `${this.baseUrl}/api/v1/admin/seo/page/${this.currentSeoPage.id}/schemas`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getCsrfHeaders()
          },
          credentials: 'include',
          body: JSON.stringify({
            lang_code: this.activeSeoLanguage,
            schema_type: schemaEntity.schema_type,
            schema_data: schemaEntity.schema_data,
            is_active: true
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to assign schema');
      }

      const result = await response.json();
      if (result.status === 'success') {
        this.showToast('Schema assigned to page', 'success');
        // Reload both lists
        await this.loadPageSchemas(this.currentSeoPage.id);
        this.renderAvailableSchemasList(); // Re-render to update assigned state
      } else {
        throw new Error(result.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Assign schema error:', error);
      this.showToast(`Failed to assign schema: ${error.message}`, 'error');
    }
  }

  /**
   * Open schema entity for editing in modal
   * @param {string} schemaId - The schema_id from schema_entities table
   */
  async openSchemaEntityForEdit(schemaId) {
    // Find the schema entity in our cached list
    const schemaEntity = this.availableSchemas.find(s => s.schema_id === schemaId);
    if (!schemaEntity) {
      this.showToast('Schema entity not found', 'error');
      return;
    }

    // Set editing state
    this.editingSchemaEntityId = schemaId;
    this.editingSchemaId = null; // Not editing a page schema

    // Open simpler edit modal for schema entities
    await this.openSchemaEntityEditModal(schemaEntity);
  }

  /**
   * Open a simpler modal for editing schema entities (direct JSON-LD editing)
   * @param {Object} schemaEntity - The schema entity object
   */
  async openSchemaEntityEditModal(schemaEntity) {
    if (!this.schemaModal) {
      this.showToast('Schema modal not available', 'error');
      return;
    }

    // Reset modal state
    this.currentSchemaType = schemaEntity.schema_type;
    this.schemaModalMode = 'edit';

    // Update modal title
    if (this.schemaModalTitle) {
      this.schemaModalTitle.textContent = `Edit Schema: ${schemaEntity.schema_type}`;
    }

    // Hide tabs when editing
    if (this.schemaModalTabs) {
      this.schemaModalTabs.classList.add('hidden');
    }

    // Show create panel (where form will be)
    if (this.schemaCreatePanel) {
      this.schemaCreatePanel.classList.remove('hidden');
    }
    if (this.schemaAssignPanel) {
      this.schemaAssignPanel.classList.add('hidden');
    }

    // Build form directly from schema data
    this.buildSchemaEntityEditForm(schemaEntity);

    // Show modal
    this.schemaModal.classList.remove('hidden');
  }

  /**
   * Build edit form directly from schema entity data
   * @param {Object} schemaEntity - The schema entity with schema_type and schema_data
   */
  buildSchemaEntityEditForm(schemaEntity) {
    if (!this.schemaFormBuilderContainer) return;

    const schemaData = schemaEntity.schema_data || {};
    const schemaType = schemaEntity.schema_type || 'Thing';

    // Clear existing form
    this.schemaFormBuilderContainer.innerHTML = '';

    // Create form container
    const formHtml = `
      <div class="schema-form schema-form--entity-edit">
        <div class="schema-form__header">
          <div class="schema-form__type-badge">${this.escapeHtml(schemaType)}</div>
          <p class="schema-form__hint">Edit the JSON-LD properties below</p>
        </div>
        <div class="schema-form__fields" id="schemaEntityFields"></div>
      </div>
    `;
    this.schemaFormBuilderContainer.innerHTML = formHtml;

    const fieldsContainer = document.getElementById('schemaEntityFields');
    if (!fieldsContainer) return;

    // Build fields from existing data
    this.buildFieldsFromJsonLd(fieldsContainer, schemaData, schemaType);

    // Store reference for collecting data later
    this.schemaFields = fieldsContainer;

    // Show preview and save button
    if (this.schemaPreview) this.schemaPreview.classList.remove('hidden');
    if (this.saveSchemaBtn) this.saveSchemaBtn.disabled = false;

    // Update preview
    this.updateSchemaPreview();
  }

  /**
   * Build form fields from existing JSON-LD data
   * @param {HTMLElement} container - Container to add fields to
   * @param {Object} data - JSON-LD data object
   * @param {string} schemaType - The schema type
   */
  buildFieldsFromJsonLd(container, data, schemaType) {
    if (!container || !data) return;

    // Standard fields to skip (handled separately or internal)
    const skipFields = new Set(['@context', '@type']);

    Object.entries(data).forEach(([key, value]) => {
      if (skipFields.has(key)) return;

      const fieldHtml = this.createFieldFromValue(key, value);
      container.insertAdjacentHTML('beforeend', fieldHtml);
    });

    // Add button to add new field
    const addFieldHtml = `
      <div class="schema-form__add-field">
        <button type="button" class="schema-form__add-field-btn" id="addSchemaFieldBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Field
        </button>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', addFieldHtml);

    // Setup add field button
    document.getElementById('addSchemaFieldBtn')?.addEventListener('click', () => {
      this.addNewSchemaField(container);
    });

    // Setup remove buttons
    container.querySelectorAll('.schema-form__remove-field-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fieldGroup = e.target.closest('.schema-form__field-group');
        if (fieldGroup) {
          fieldGroup.remove();
          this.updateSchemaPreview();
        }
      });
    });

    // Setup value change listeners
    container.querySelectorAll('input, textarea').forEach(input => {
      input.addEventListener('input', () => this.updateSchemaPreview());
    });
  }

  /**
   * Create a form field from a JSON-LD value
   * @param {string} key - The property name
   * @param {*} value - The property value
   * @returns {string} HTML string for the field
   */
  createFieldFromValue(key, value) {
    const isUrl = typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
    const isMultiline = typeof value === 'string' && value.length > 100;
    const inputType = isUrl ? 'url' : (typeof value === 'number' ? 'number' : 'text');

    let inputHtml;
    if (typeof value === 'object' && value !== null) {
      // For objects, show as JSON textarea
      inputHtml = `<textarea class="schema-form__input schema-form__textarea" data-field="${this.escapeHtml(key)}" data-type="object" rows="4">${this.escapeHtml(JSON.stringify(value, null, 2))}</textarea>`;
    } else if (isMultiline) {
      inputHtml = `<textarea class="schema-form__input schema-form__textarea" data-field="${this.escapeHtml(key)}" rows="3">${this.escapeHtml(String(value || ''))}</textarea>`;
    } else {
      inputHtml = `<input type="${inputType}" class="schema-form__input" data-field="${this.escapeHtml(key)}" value="${this.escapeHtml(String(value || ''))}">`;
    }

    return `
      <div class="schema-form__field-group" data-field-name="${this.escapeHtml(key)}">
        <div class="schema-form__field-header">
          <label class="schema-form__label">${this.escapeHtml(key)}</label>
          <button type="button" class="schema-form__remove-field-btn" title="Remove field">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        ${inputHtml}
      </div>
    `;
  }

  /**
   * Add a new field to the schema form
   * @param {HTMLElement} container - The fields container
   */
  addNewSchemaField(container) {
    const fieldName = prompt('Enter field name (e.g., "name", "description", "url"):');
    if (!fieldName || !fieldName.trim()) return;

    const cleanName = fieldName.trim();

    // Check if field already exists
    if (container.querySelector(`[data-field-name="${cleanName}"]`)) {
      this.showToast('Field already exists', 'warning');
      return;
    }

    const fieldHtml = this.createFieldFromValue(cleanName, '');
    const addFieldBtn = container.querySelector('.schema-form__add-field');
    if (addFieldBtn) {
      addFieldBtn.insertAdjacentHTML('beforebegin', fieldHtml);
    } else {
      container.insertAdjacentHTML('beforeend', fieldHtml);
    }

    // Setup new field's remove button and input listener
    const newField = container.querySelector(`[data-field-name="${cleanName}"]`);
    if (newField) {
      newField.querySelector('.schema-form__remove-field-btn')?.addEventListener('click', () => {
        newField.remove();
        this.updateSchemaPreview();
      });
      newField.querySelector('input, textarea')?.addEventListener('input', () => this.updateSchemaPreview());
    }

    this.updateSchemaPreview();
  }

  /**
   * Unassign a schema from the current page
   * @param {number} pageSchemaId - The ID from page_schemas table
   */
  async unassignSchemaFromPage(pageSchemaId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/schema/${pageSchemaId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to remove schema');
      }

      this.showToast('Schema removed from page', 'success');
      // Reload both lists
      await this.loadPageSchemas(this.currentSeoPage.id);
      this.renderAvailableSchemasList(); // Re-render to update assigned state
    } catch (error) {
      console.error('Unassign schema error:', error);
      this.showToast(`Failed to remove schema: ${error.message}`, 'error');
    }
  }

  /**
   * Render assigned schemas list (right panel - schemas assigned to current page)
   */
  renderAssignedSchemasList() {
    console.log('[renderAssignedSchemasList] Called, element exists:', !!this.assignedSchemasList);
    console.log('[renderAssignedSchemasList] pageSchemas:', this.pageSchemas);

    if (!this.assignedSchemasList) {
      console.warn('[renderAssignedSchemasList] assignedSchemasList element not found');
      return;
    }

    // Clear existing cards (keep empty state element)
    this.assignedSchemasList.querySelectorAll('.schema-card').forEach(card => card.remove());

    if (!this.pageSchemas || this.pageSchemas.length === 0) {
      console.log('[renderAssignedSchemasList] No schemas, showing empty state');
      if (this.assignedSchemasEmpty) this.assignedSchemasEmpty.classList.remove('hidden');
      return;
    }

    console.log('[renderAssignedSchemasList] Rendering', this.pageSchemas.length, 'schemas');
    if (this.assignedSchemasEmpty) this.assignedSchemasEmpty.classList.add('hidden');

    this.pageSchemas.forEach(schema => {
      // Use cached schema definition if available, otherwise use schema_type directly
      const schemaDef = this.schemaDefinitionCache?.get(schema.schema_type);
      const label = schemaDef?.label || schema.schema_type || 'Unknown';
      const schemaId = schema.schema_data?.['@id'] || schema.entity_schema_id || '';
      const description = schema.schema_data?.name || schema.schema_data?.title || schemaId || '';

      const cardHtml = `
        <div class="schema-card" data-page-schema-id="${schema.id}" data-schema-id="${this.escapeHtml(schemaId)}">
          <div class="schema-card__icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
          </div>
          <div class="schema-card__content">
            <div class="schema-card__type">${this.escapeHtml(label)}</div>
            <div class="schema-card__description">${this.escapeHtml(description)}</div>
          </div>
          <div class="schema-card__actions">
            <button type="button" class="schema-card__btn schema-card__btn--danger" data-action="remove" title="Remove from this page">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      `;

      this.assignedSchemasList.insertAdjacentHTML('beforeend', cardHtml);
    });

    // Setup card action handlers
    this.assignedSchemasList.querySelectorAll('.schema-card').forEach(card => {
      const pageSchemaId = card.dataset.pageSchemaId;

      card.querySelector('[data-action="remove"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.unassignSchemaFromPage(pageSchemaId);
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
    void this.openSchemaModal(schema);
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
        headers: getCsrfHeaders(),
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
        headers: getCsrfHeaders(),
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

    // Logo and Favicon UUIDs with storage types
    this.logoUuid = this.currentConfig.logo_uuid;
    this.logoStorageType = this.currentConfig.logo_storage_type || 'public';
    this.faviconUuid = this.currentConfig.favicon_uuid;
    this.faviconStorageType = this.currentConfig.favicon_storage_type || 'public';
    this.updateImagePreview('logo', this.logoUuid, this.logoStorageType);
    this.updateImagePreview('favicon', this.faviconUuid, this.faviconStorageType);

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
      currentUuid = this.currentSeoTranslation?.og_image_uuid;
    } else if (target === 'twitter_image') {
      currentUuid = this.currentSeoTranslation?.twitter_image_uuid;
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
        headers: getCsrfHeaders(),
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

        // Use appropriate URL based on storage_type with thumb variant for fast grid loading
        const imgUrl = upload.storage_type === 'public'
          ? `/api/v1/upload/download/public/${upload.uuid}?variant=thumb`
          : `/api/v1/upload/private/${upload.uuid}?variant=thumb`;

        // Show indicator for private images
        const privateIndicator = upload.storage_type === 'private'
          ? '<span class="image-grid__private-badge" title="Private - will be copied to public">Private</span>'
          : '';

        item.innerHTML = `
          <img src="${imgUrl}" alt="${upload.original_name}">
          ${privateIndicator}
          <span class="image-grid__name">${upload.original_name}</span>
        `;
        item.addEventListener('click', () => this.selectImage(upload.uuid, upload.storage_type));
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
   * @param {string} storage_type - 'public' or 'private'
   */
  async selectImage(uuid, storage_type = 'public') {
    // Store both UUID and storage_type for preview and saving
    // No need to duplicate private images - backend handles both types

    if (this.currentImageTarget === 'logo') {
      this.logoUuid = uuid;
      this.logoStorageType = storage_type;
      this.updateImagePreview('logo', uuid, storage_type);
      this.markUnsaved();
    } else if (this.currentImageTarget === 'favicon') {
      this.faviconUuid = uuid;
      this.faviconStorageType = storage_type;
      this.updateImagePreview('favicon', uuid, storage_type);
      this.markUnsaved();
    } else if (this.currentImageTarget === 'og_image') {
      if (this.currentSeoTranslation) {
        this.currentSeoTranslation.og_image_uuid = uuid;
        this.currentSeoTranslation.og_image_storage_type = storage_type;
        this.updateSeoImagePreview('og_image', uuid, storage_type);
      }
    } else if (this.currentImageTarget === 'twitter_image') {
      if (this.currentSeoTranslation) {
        this.currentSeoTranslation.twitter_image_uuid = uuid;
        this.currentSeoTranslation.twitter_image_storage_type = storage_type;
        this.updateSeoImagePreview('twitter_image', uuid, storage_type);
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
        headers: getCsrfHeaders(),
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

      const headers = {};
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-TOKEN'] = csrfToken;
      }

      const uploadResponse = await fetch(`${this.baseUrl}/api/v1/upload/public`, {
        method: 'POST',
        headers: headers,
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
      if (this.currentSeoTranslation) {
        this.currentSeoTranslation.og_image_uuid = null;
        this.updateSeoImagePreview('og_image', null);
      }
    } else if (this.currentImageTarget === 'twitter_image') {
      if (this.currentSeoTranslation) {
        this.currentSeoTranslation.twitter_image_uuid = null;
        this.updateSeoImagePreview('twitter_image', null);
      }
    }
  }


  /**
   * Update image preview display
   * @param {string} target - 'logo' or 'favicon'
   * @param {string|null} uuid
   * @param {string} storage_type - 'public' or 'private'
   */
  updateImagePreview(target, uuid, storage_type = 'public') {
    let preview, placeholder;

    if (target === 'logo') {
      preview = this.logoPreview;
      placeholder = this.logoPlaceholder;
    } else {
      preview = this.faviconPreview;
      placeholder = this.faviconPlaceholder;
    }

    if (uuid && preview) {
      // Generate correct URL based on storage_type (matches backend asset_by_id() format)
      // Always request 'medium' variant for preview to ensure file exists
      const imgUrl = storage_type === 'public'
        ? `/api/v1/upload/download/public/${uuid}?variant=medium`
        : `/api/v1/upload/private/${uuid}?variant=medium`;

      preview.src = imgUrl;
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
      const headers = {};
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRF-TOKEN'] = csrfToken;
      }

      const response = await fetch(`${this.baseUrl}/api/v1/upload/public`, {
        method: 'POST',
        headers: headers,
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
        headers: getCsrfHeaders(),
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
        headers: getCsrfHeaders(),
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
        headers: getCsrfHeaders(),
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
        headers: getCsrfHeaders(),
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
        headers: getCsrfHeaders(),
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
        headers: getCsrfHeaders(),
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
      languageTabs: document.getElementById('seoLanguageTabs'),
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
      assignedSchemasList: document.getElementById('assignedSchemasList'),
      assignedSchemasEmpty: document.getElementById('assignedSchemasEmpty'),
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

    this.setupSeoPageModal();
    this.setupHreflangForm();

    this.loadSeoLanguages();

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
        void this.openSchemaModal();
      });
    }
  }

  async loadSeoLanguages() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/localizations/languages`, {
        headers: getCsrfHeaders(),
        credentials: 'include'
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.seoLanguages = (result.languages || []).map(lang => ({
          code: (lang.iso2 || '').toLowerCase(),
          label: lang.native_name || lang.iso2
        })).filter(lang => lang.code);
      } else {
        this.seoLanguages = [];
      }
    } catch (error) {
      console.error('Failed to load SEO languages:', error);
      this.seoLanguages = [];
    }

    if (!this.seoLanguages.find(lang => lang.code === 'en')) {
      this.seoLanguages.unshift({ code: 'en', label: 'English' });
    }
    if (!this.seoLanguages.find(lang => lang.code === 'sr')) {
      this.seoLanguages.push({ code: 'sr', label: 'Srpski' });
    }

    this.renderSeoLanguageTabs();
  }

  renderSeoLanguageTabs() {
    const tabsContainer = this.seoFormElements?.languageTabs || this.seoLanguageTabs;
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';
    this.seoLanguages.forEach(lang => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'seo-language-tab';
      if (lang.code === this.activeSeoLanguage) {
        button.classList.add('is-active');
      }
      button.textContent = `${lang.label} (${lang.code.toUpperCase()})`;
      button.addEventListener('click', () => {
        this.setActiveSeoLanguage(lang.code);
      });
      tabsContainer.appendChild(button);
    });
  }

  setActiveSeoLanguage(langCode) {
    this.activeSeoLanguage = langCode;
    this.renderSeoLanguageTabs();
    if (this.currentSeoPage) {
      this.populateSeoForm(this.currentSeoPage);
      if (this.currentSeoPage.id) {
        this.loadPageSchemas(this.currentSeoPage.id);
      }
    }
  }

  normalizeSeoTranslations(translations = []) {
    const map = {};
    translations.forEach(entry => {
      if (!entry.lang_code) return;
      map[entry.lang_code.toLowerCase()] = { ...entry };
    });
    return map;
  }

  getSeoTranslation(langCode) {
    if (!this.seoTranslations) return {};
    return this.seoTranslations[langCode] || this.seoTranslations.en || {};
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
  async openSchemaModal(existingSchema = null) {
    if (!this.schemaModal) {
      this.showToast('Schema modal not available', 'error');
      return;
    }

    // Allow editing schema entities without a page selected
    // But require page for creating/editing page schemas
    const isEditingSchemaEntity = this.editingSchemaEntityId !== null;
    if (!isEditingSchemaEntity && !this.currentSeoPage) {
      this.showToast('Please select a page first', 'error');
      return;
    }

    // Preserve editingSchemaEntityId before reset if set
    const preservedEntityId = this.editingSchemaEntityId;

    // Reset modal first
    this.resetSchemaModal();

    // Restore editingSchemaEntityId if we're editing an entity
    if (preservedEntityId) {
      this.editingSchemaEntityId = preservedEntityId;
    }

    await this.loadSchemaCategories();

    // If editing existing schema, populate the form and hide tabs
    if (existingSchema) {
      // Only set editingSchemaId for page schemas (has numeric id)
      if (existingSchema.id && typeof existingSchema.id === 'number') {
        this.editingSchemaId = existingSchema.id;
      }
      if (this.schemaModalTitle) {
        // Different title for schema entities vs page schemas
        this.schemaModalTitle.textContent = this.editingSchemaEntityId ? 'Edit Schema Entity' : 'Edit Schema';
      }
      // Hide tabs when editing (only show create panel)
      if (this.schemaModalTabs) {
        this.schemaModalTabs.classList.add('hidden');
      }

      if (existingSchema.schema_type) {
        try {
          const schemaDef = await this.fetchSchemaDefinition(existingSchema.schema_type);
          const path = schemaDef.path || [existingSchema.schema_type];
          const normalizedPath = path[0] === 'Thing' ? path.slice(1) : path;
          const category = normalizedPath[0] || '';

          if (this.schemaCategorySelect) {
            this.schemaCategorySelect.value = category;
          }
          this.clearSchemaHierarchy();
          if (category) {
            await this.renderSchemaLevel(category, 0, normalizedPath[1] || '');
          }

          await this.onSchemaTypeChange(existingSchema.schema_type);
          setTimeout(() => {
            this.populateSchemaFields(existingSchema.schema_data);
          }, 50);
        } catch (error) {
          this.showToast('Failed to load schema definition', 'error');
          console.error(error);
        }
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

    this.populateFieldsFromData(this.schemaFields, schemaData);

    // Update preview with populated data
    this.updateSchemaPreview();
  }

  populateFieldsFromData(container, data) {
    if (!container || !data || typeof data !== 'object') return;

    Object.entries(data).forEach(([key, value]) => {
      if (key.startsWith('@')) return;

      if (Array.isArray(value)) {
        const arrayContainer = container.querySelector(`.schema-array[data-field="${key}"]`);
        if (arrayContainer) {
          const arrayId = arrayContainer.querySelector('.schema-array__add')?.dataset.array;
          if (arrayId) {
            value.forEach(item => {
              if (item && typeof item === 'object') return;
              this.addArrayItem(arrayId);
              const items = document.getElementById(`${arrayId}_items`);
              const lastInput = items?.querySelector('.schema-array__item:last-child input');
              if (lastInput) lastInput.value = item;
            });
          }
        }
        return;
      }

      if (value && typeof value === 'object') {
        const entityContainer = container.querySelector(`.schema-entity[data-field="${key}"]`);
        if (entityContainer) {
          this.populateEntityContainer(entityContainer, value);
          return;
        }

        const mixedContainer = container.querySelector(`.schema-mixed[data-field="${key}"]`);
        if (mixedContainer) {
          this.populateMixedContainer(mixedContainer, value);
          return;
        }

        const nestedContainer = container.querySelector(`.schema-nested[data-field="${key}"]`);
        if (nestedContainer) {
          this.populateFieldsFromData(nestedContainer, value);
        }
        return;
      }

      const input = container.querySelector(`[data-field="${key}"]`);
      if (!input) return;

      if (input.type === 'checkbox') {
        input.checked = Boolean(value);
      } else {
        input.value = value;
      }
    });
  }

  populateEntityContainer(container, value) {
    if (!container || !value || typeof value !== 'object') return;

    const keys = Object.keys(value);
    const hasOnlyId = keys.length === 1 && value['@id'];
    if (hasOnlyId) {
      this.setEntityMode(container, ENTITY_MODE_REFERENCE);
      const refInput = container.querySelector('.schema-entity__ref');
      if (refInput) refInput.value = value['@id'];
      return;
    }

    this.setEntityMode(container, ENTITY_MODE_INLINE);
    const typeRadio = container.querySelector(`.schema-entity__type-radio[value="${value['@type']}"]`);
    const fallbackRadio = container.querySelector('.schema-entity__type-radio');
    if (typeRadio && value['@type']) {
      typeRadio.checked = true;
      void this.updateEntityInlineFields(container);
    } else if (fallbackRadio) {
      fallbackRadio.checked = true;
      void this.updateEntityInlineFields(container);
    }

    const inlineContainer = container.querySelector('.schema-entity__inline');
    if (!inlineContainer) return;
    const copy = { ...value };
    delete copy['@type'];
    this.populateFieldsFromData(inlineContainer, copy);
  }

  populateMixedContainer(container, value) {
    if (!container) return;

    const dataSection = container.querySelector('.schema-mixed__data');
    const entitySection = container.querySelector('.schema-mixed__entity');

    if (value && typeof value === 'object') {
      const hasOnlyId = Object.keys(value).length === 1 && value['@id'];
      const radio = container.querySelector(`.schema-mixed__type-radio[data-kind="entity"][value="${value['@type']}"]`);
      const fallbackRadio = container.querySelector('.schema-mixed__type-radio[data-kind="entity"]');
      if (radio) {
        radio.checked = true;
      } else if (fallbackRadio) {
        fallbackRadio.checked = true;
      }
      this.updateMixedField(container);
      if (entitySection) {
        this.populateEntityContainer(entitySection, value);
      }
      if (hasOnlyId && entitySection) {
        const refInput = entitySection.querySelector('.schema-entity__ref');
        if (refInput) refInput.value = value['@id'];
      }
      return;
    }

    const defaultRadio = container.querySelector('.schema-mixed__type-radio[data-kind="data"]');
    if (defaultRadio) {
      defaultRadio.checked = true;
    }
    if (dataSection) dataSection.classList.remove('hidden');
    if (entitySection) entitySection.classList.add('hidden');

    const dataInput = container.querySelector('.schema-mixed__data-input');
    if (dataInput) dataInput.value = value ?? '';
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
   * Setup SEO page modal actions
   */
  setupSeoPageModal() {
    if (this.seoAddPageBtn) {
      this.seoAddPageBtn.addEventListener('click', () => this.openSeoPageModal());
    }

    if (this.seoPageModal) {
      this.seoPageModal.addEventListener('click', event => {
        if (event.target === this.seoPageModal || event.target.closest('[data-action="close"]')) {
          this.closeSeoPageModal();
        }
      });
    }

    if (this.seoPageForm) {
      this.seoPageForm.addEventListener('submit', event => {
        event.preventDefault();
        this.createSeoPage();
      });
    }

    if (this.seoPageCancelBtn) {
      this.seoPageCancelBtn.addEventListener('click', () => this.closeSeoPageModal());
    }
  }

  openSeoPageModal() {
    this.resetSeoPageModalForm();
    if (this.seoPageModalTitle) {
      this.seoPageModalTitle.textContent = 'Add SEO Page';
    }
    this.seoPageModal?.classList.remove('hidden');
    this.seoPageRouteName?.focus();
  }

  closeSeoPageModal() {
    this.seoPageModal?.classList.add('hidden');
    this.resetSeoPageModalForm();
  }

  resetSeoPageModalForm() {
    if (this.seoPageForm) {
      this.seoPageForm.reset();
    }
  }

  async createSeoPage() {
    if (!this.seoPageRouteName) return;
    const routeName = this.seoPageRouteName.value.trim();
    const pageLabel = this.seoPageLabel?.value.trim();

    if (!routeName) {
      this.showToast('Route name is required', 'error');
      return;
    }

    try {
      this.setButtonLoading(this.seoPageSaveBtn, true, 'Saving...');
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify({
          route_name: routeName,
          page_label: pageLabel || null
        }),
        credentials: 'include'
      });

      const result = await response.json();
      if (response.ok && result.status === 'success') {
        this.showToast('SEO page created', 'success');
        this.closeSeoPageModal();
        await this.loadSeoPages();
        this.selectSeoPage(routeName);
      } else {
        this.showToast(result.message || 'Failed to create SEO page', 'error');
      }
    } catch (error) {
      console.error('Failed to create SEO page:', error);
      this.showToast('Network error while creating SEO page', 'error');
    } finally {
      this.setButtonLoading(this.seoPageSaveBtn, false);
    }
  }

  /**
   * Setup hreflang form actions
   */
  setupHreflangForm() {
    if (this.hreflangForm) {
      this.hreflangForm.addEventListener('submit', event => {
        event.preventDefault();
        this.saveHreflangEntry();
      });
    }

    if (this.hreflangCancelBtn) {
      this.hreflangCancelBtn.addEventListener('click', () => this.resetHreflangForm());
    }
  }

  resetHreflangForm() {
    if (this.hreflangForm) {
      this.hreflangForm.reset();
    }
    if (this.hreflangIdInput) {
      this.hreflangIdInput.value = '';
    }
  }

  async loadHreflangEntries(pageId) {
    if (!pageId) return;
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/page/${pageId}/hreflang`, {
        headers: getCsrfHeaders(),
        credentials: 'include'
      });
      const result = await response.json();
      if (response.ok && result.status === 'success') {
        this.hreflangEntries = result.entries || [];
        this.renderHreflangTable();
      } else {
        this.hreflangEntries = [];
        this.renderHreflangTable();
      }
    } catch (error) {
      console.error('Failed to load hreflang entries:', error);
      this.hreflangEntries = [];
      this.renderHreflangTable();
    }
  }

  renderHreflangTable() {
    if (!this.hreflangTableBody) return;
    this.hreflangTableBody.innerHTML = '';

    if (!this.hreflangEntries.length) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="4" class="hreflang-table__empty">No hreflang entries yet.</td>';
      this.hreflangTableBody.appendChild(row);
      return;
    }

    this.hreflangEntries.forEach(entry => {
      const row = document.createElement('tr');
      row.className = 'hreflang-row';
      row.innerHTML = `
        <td>${this.escapeHtml(entry.lang_code || '')}</td>
        <td>${this.escapeHtml(entry.href || '')}</td>
        <td>${entry.is_default ? 'Yes' : 'No'}</td>
        <td class="hreflang-actions">
          <button type="button" class="btn btn--secondary btn--xs" data-action="edit" data-id="${entry.id}">Edit</button>
          <button type="button" class="btn btn--danger btn--xs" data-action="delete" data-id="${entry.id}">Delete</button>
        </td>
      `;

      row.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          if (action === 'edit') {
            this.populateHreflangForm(entry);
          } else if (action === 'delete') {
            this.deleteHreflangEntry(entry.id);
          }
        });
      });

      this.hreflangTableBody.appendChild(row);
    });
  }

  populateHreflangForm(entry) {
    if (!entry) return;
    if (this.hreflangIdInput) this.hreflangIdInput.value = entry.id || '';
    if (this.hreflangCodeInput) this.hreflangCodeInput.value = entry.lang_code || '';
    if (this.hreflangUrlInput) this.hreflangUrlInput.value = entry.href || '';
    if (this.hreflangDefaultInput) this.hreflangDefaultInput.checked = !!entry.is_default;
  }

  async saveHreflangEntry() {
    if (!this.currentSeoPage?.id) {
      this.showToast('Select a page first', 'error');
      return;
    }

    const langCode = this.hreflangCodeInput?.value.trim();
    const href = this.hreflangUrlInput?.value.trim();
    const id = this.hreflangIdInput?.value.trim();
    const isDefault = !!this.hreflangDefaultInput?.checked;

    if (!langCode || !href) {
      this.showToast('Language code and URL are required', 'error');
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/page/${this.currentSeoPage.id}/hreflang`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify({
          id: id || null,
          lang_code: langCode,
          href,
          is_default: isDefault
        }),
        credentials: 'include'
      });
      const result = await response.json();
      if (response.ok && result.status === 'success') {
        this.showToast('Hreflang entry saved', 'success');
        this.resetHreflangForm();
        await this.loadHreflangEntries(this.currentSeoPage.id);
      } else {
        this.showToast(result.message || 'Failed to save hreflang entry', 'error');
      }
    } catch (error) {
      console.error('Failed to save hreflang entry:', error);
      this.showToast('Network error while saving hreflang entry', 'error');
    }
  }

  async deleteHreflangEntry(entryId) {
    if (!entryId) return;
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/hreflang/${entryId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });
      const result = await response.json();
      if (response.ok && result.status === 'success') {
        this.showToast('Hreflang entry deleted', 'success');
        if (this.currentSeoPage?.id) {
          await this.loadHreflangEntries(this.currentSeoPage.id);
        }
      } else {
        this.showToast(result.message || 'Failed to delete hreflang entry', 'error');
      }
    } catch (error) {
      console.error('Failed to delete hreflang entry:', error);
      this.showToast('Network error while deleting hreflang entry', 'error');
    }
  }

  /**
   * Load SEO pages from API
   */
  async loadSeoPages() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo`, {
        headers: getCsrfHeaders(),
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
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load SEO data');
      }

      const result = await response.json();
      if (result.status === 'success' && result.seo) {
        this.currentSeoPage = result.seo;
        this.seoTranslations = this.normalizeSeoTranslations(result.seo.translations || []);
        if (!this.seoTranslations[this.activeSeoLanguage]) {
          this.activeSeoLanguage = this.seoTranslations.en ? 'en' : Object.keys(this.seoTranslations)[0] || 'en';
        }
        this.renderSeoLanguageTabs();
        this.populateSeoForm(result.seo);
        this.resetHreflangForm();
        this.loadHreflangEntries(result.seo.id);
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

    const translation = this.getSeoTranslation(this.activeSeoLanguage);
    this.currentSeoTranslation = { ...translation };

    // Basic SEO
    if (f.title) f.title.value = translation.title || '';
    if (f.description) f.description.value = translation.description || '';
    if (f.keywords) f.keywords.value = translation.keywords || '';
    if (f.robots) f.robots.value = translation.robots || 'index, follow';
    if (f.canonical) f.canonical.value = translation.canonical_url || '';

    // Open Graph
    if (f.ogTitle) f.ogTitle.value = translation.og_title || '';
    if (f.ogDescription) f.ogDescription.value = translation.og_description || '';
    if (f.ogType) f.ogType.value = translation.og_type || 'website';

    // OG Image
    this.currentSeoTranslation.og_image_uuid = translation.og_image_uuid || null;
    this.updateSeoImagePreview('og_image', translation.og_image_uuid || null);

    // Twitter
    if (f.twitterCard) f.twitterCard.value = translation.twitter_card || 'summary';
    if (f.twitterTitle) f.twitterTitle.value = translation.twitter_title || '';
    if (f.twitterDescription) f.twitterDescription.value = translation.twitter_description || '';

    // Twitter Image
    this.currentSeoTranslation.twitter_image_uuid = translation.twitter_image_uuid || null;
    this.updateSeoImagePreview('twitter_image', translation.twitter_image_uuid || null);

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
   * @param {string} storage_type - 'public' or 'private'
   */
  updateSeoImagePreview(target, uuid, storage_type = 'public') {
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
      // Generate correct URL based on storage_type (matches backend asset_by_id() format)
      // Always request 'medium' variant for preview to ensure file exists
      const imgUrl = storage_type === 'public'
        ? `/api/v1/upload/download/public/${uuid}?variant=medium`
        : `/api/v1/upload/private/${uuid}?variant=medium`;

      preview.src = imgUrl;
      preview.classList.remove('hidden');
      if (placeholder) placeholder.classList.add('hidden');
    } else {
      if (preview) preview.classList.add('hidden');
      if (placeholder) placeholder.classList.remove('hidden');
    }

    if (hiddenInput) {
      hiddenInput.value = uuid || '';
    }

    if (this.currentSeoTranslation) {
      if (target === 'og_image') {
        this.currentSeoTranslation.og_image_uuid = uuid || null;
      } else {
        this.currentSeoTranslation.twitter_image_uuid = uuid || null;
      }
      this.seoTranslations[this.activeSeoLanguage] = { ...this.currentSeoTranslation };
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
      lang_code: this.activeSeoLanguage,
      title: f.title?.value || null,
      description: f.description?.value || null,
      keywords: f.keywords?.value || null,
      robots: f.robots?.value || null,
      canonical_url: f.canonical?.value || null,
      og_title: f.ogTitle?.value || null,
      og_description: f.ogDescription?.value || null,
      og_type: f.ogType?.value || null,
      og_image_uuid: this.currentSeoTranslation?.og_image_uuid || null,
      twitter_card: f.twitterCard?.value || null,
      twitter_title: f.twitterTitle?.value || null,
      twitter_description: f.twitterDescription?.value || null,
      twitter_image_uuid: this.currentSeoTranslation?.twitter_image_uuid || null,
      is_active: f.isActive?.checked ?? true
    };

    try {
      this.setButtonLoading(f.saveBtn, true);

      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/${encodeURIComponent(routeName)}`, {
        method: 'PUT',
        headers: getCsrfHeaders(),
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
          if (this.activeSeoLanguage === 'en') {
            this.seoPages[pageIdx].title = seoData.title;
            this.seoPages[pageIdx].description = seoData.description;
          }
        }
        this.renderSeoPageList();

        this.seoTranslations[this.activeSeoLanguage] = {
          ...this.currentSeoTranslation,
          ...seoData
        };

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
   * Setup localization management (languages + translations)
   */
  setupLocalization() {
    this.setupLocalizationModal();

    if (this.languageForm) {
      this.languageForm.addEventListener('submit', event => {
        event.preventDefault();
        this.saveLanguage();
      });
    }

    if (this.languageResetBtn) {
      this.languageResetBtn.addEventListener('click', () => this.resetLanguageForm());
    }

    if (this.languageIconFile) {
      this.languageIconFile.addEventListener('change', event => {
        this.uploadLanguageIcon(event.target.files?.[0] || null);
      });
    }

    if (this.languageIconClear) {
      this.languageIconClear.addEventListener('click', () => {
        this.setLanguageIcon(null);
      });
    }

    if (this.localeForm) {
      this.localeForm.addEventListener('submit', event => {
        event.preventDefault();
        this.saveLocale();
      });
    }

    if (this.localeResetBtn) {
      this.localeResetBtn.addEventListener('click', () => this.resetLocaleForm());
    }

    if (this.localizationForm) {
      this.localizationForm.addEventListener('submit', event => {
        event.preventDefault();
        this.saveLocalizationKey();
      });
    }

    if (this.localizationResetBtn) {
      this.localizationResetBtn.addEventListener('click', () => this.openLocalizationModal());
    }

    if (this.localizationNewBtn) {
      this.localizationNewBtn.addEventListener('click', () => this.openLocalizationModal());
    }
  }

  /**
   * Load localization data from API
   */
  async loadLocalizationData() {
    await Promise.all([
      this.loadLanguages(),
      this.loadLocales(),
      this.loadLocalizationKeys()
    ]);
  }

  async loadLanguages() {
    if (!this.languagesTableBody) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/localizations/languages`, {
        headers: getCsrfHeaders(),
        credentials: 'include'
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.languages = result.languages || [];
        this.renderLanguages();
      } else {
        this.showToast(result.message || 'Failed to load languages', 'error');
      }
    } catch (error) {
      console.error('Failed to load languages:', error);
      this.showToast('Failed to load languages', 'error');
    }
  }

  async loadLocales() {
    if (!this.localesTableBody) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/localizations/locales`, {
        headers: getCsrfHeaders(),
        credentials: 'include'
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.locales = result.locales || [];
        this.renderLocales();
        this.renderLocalizationTabs();
        this.renderTranslationInputs();
      } else {
        this.showToast(result.message || 'Failed to load locales', 'error');
      }
    } catch (error) {
      console.error('Failed to load locales:', error);
      this.showToast('Failed to load locales', 'error');
    }
  }

  async loadLocalizationKeys() {
    if (!this.localizationKeysTableBody) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/localizations/keys`, {
        headers: getCsrfHeaders(),
        credentials: 'include'
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.localizationKeys = result.keys || [];
        this.renderLocalizationKeys();
      } else {
        this.showToast(result.message || 'Failed to load localization keys', 'error');
      }
    } catch (error) {
      console.error('Failed to load localization keys:', error);
      this.showToast('Failed to load localization keys', 'error');
    }
  }

  renderLanguages() {
    if (!this.languagesTableBody) return;

    this.languagesTableBody.innerHTML = '';
    this.languages.forEach(language => {
      const row = document.createElement('tr');
      const icon = language.icon_uuid
        ? `<img src="/api/v1/upload/download/public/${this.escapeHtml(language.icon_uuid)}" alt="" class="language-icon__preview">`
        : '-';

      row.innerHTML = `
        <td>${icon}</td>
        <td>${this.escapeHtml(language.native_name)}</td>
        <td>${this.escapeHtml(language.iso2)}</td>
        <td>${this.escapeHtml(language.iso3)}</td>
        <td>${(language.locales || []).map(value => this.escapeHtml(value)).join(', ') || '-'}</td>
        <td>
          <div class="localization-actions">
            <button type="button" class="btn btn--ghost btn--xs" data-action="edit">Edit</button>
            <button type="button" class="btn btn--ghost btn--xs btn--danger" data-action="delete">Delete</button>
          </div>
        </td>
      `;

      row.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
        this.editLanguage(language);
      });
      row.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        this.deleteLanguage(language.id);
      });

      this.languagesTableBody.appendChild(row);
    });

    this.populateLanguageSelect();
  }

  populateLanguageSelect() {
    if (!this.localeLanguageSelect) return;
    this.localeLanguageSelect.innerHTML = '';
    this.languages.forEach(language => {
      const option = document.createElement('option');
      option.value = language.id;
      option.textContent = `${language.native_name} (${language.iso2})`;
      this.localeLanguageSelect.appendChild(option);
    });
  }

  renderLocales() {
    if (!this.localesTableBody) return;
    this.localesTableBody.innerHTML = '';

    this.locales.forEach(locale => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${this.escapeHtml(locale.locale_code)}</td>
        <td>${this.escapeHtml(locale.language_iso2)}</td>
        <td>
          <div class="localization-actions">
            <button type="button" class="btn btn--ghost btn--xs" data-action="edit">Edit</button>
            <button type="button" class="btn btn--ghost btn--xs btn--danger" data-action="delete">Delete</button>
          </div>
        </td>
      `;

      row.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
        this.editLocale(locale);
      });
      row.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        this.deleteLocale(locale.id);
      });

      this.localesTableBody.appendChild(row);
    });
  }

  renderLocalizationKeys() {
    if (!this.localizationKeysTableBody) return;
    this.localizationKeysTableBody.innerHTML = '';

    this.localizationKeys.forEach(key => {
      const localesCount = key.translations ? key.translations.length : 0;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${this.escapeHtml(key.key)}</td>
        <td>${this.escapeHtml(key.context || '')}</td>
        <td>${localesCount}</td>
        <td>
          <div class="localization-actions">
            <button type="button" class="btn btn--ghost btn--xs" data-action="edit">Edit</button>
            <button type="button" class="btn btn--ghost btn--xs btn--danger" data-action="delete">Delete</button>
          </div>
        </td>
      `;

      row.querySelector('[data-action="edit"]')?.addEventListener('click', () => {
        this.openLocalizationModal(key);
      });
      row.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
        this.deleteLocalizationKey(key.id);
      });

      this.localizationKeysTableBody.appendChild(row);
    });
  }

  initializeLocalizationTranslations(translations = []) {
    this.localizationTranslations = {};
    this.activeLocalizationLocale = this.locales[0]?.locale_code || null;

    this.locales.forEach(locale => {
      const existing = translations.find(item => item.locale_code === locale.locale_code);
      this.localizationTranslations[locale.locale_code] = {
        singular: existing?.singular || '',
        plural: existing?.plural || ''
      };
    });
  }

  renderLocalizationTabs() {
    if (!this.localizationLocaleTabs) return;
    this.localizationLocaleTabs.innerHTML = '';

    if (!this.locales.length) {
      this.localizationLocaleTabs.innerHTML = '<p class="form-help">Add locales to start translating.</p>';
      return;
    }

    this.locales.forEach(locale => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'localization-locale-tab';
      if (locale.locale_code === this.activeLocalizationLocale) {
        tab.classList.add('is-active');
      }
      tab.textContent = locale.locale_code;
      tab.addEventListener('click', () => {
        this.activeLocalizationLocale = locale.locale_code;
        this.renderLocalizationTabs();
        this.renderTranslationInputs();
      });
      this.localizationLocaleTabs.appendChild(tab);
    });
  }

  renderTranslationInputs() {
    if (!this.translationInputs) return;

    this.translationInputs.innerHTML = '';
    if (!this.locales.length) {
      this.translationInputs.innerHTML = '<p class="form-help">Add locales to start translating.</p>';
      return;
    }

    if (!this.activeLocalizationLocale) {
      this.activeLocalizationLocale = this.locales[0]?.locale_code || null;
    }

    const locale = this.activeLocalizationLocale;
    const translation = this.localizationTranslations[locale] || { singular: '', plural: '' };
    this.localizationTranslations[locale] = translation;

    const row = document.createElement('div');
    row.className = 'translation-row translation-row--single';
    row.innerHTML = `
      <div class="translation-row__header">${this.escapeHtml(locale)}</div>
      <div class="translation-row__fields">
        <div class="form-group">
          <label class="form-label">Singular</label>
          <input type="text" class="form-input" data-field="singular" value="${this.escapeHtml(translation.singular || '')}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Plural</label>
          <input type="text" class="form-input" data-field="plural" value="${this.escapeHtml(translation.plural || '')}" required>
        </div>
      </div>
    `;

    this.translationInputs.appendChild(row);
    row.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', () => {
        const field = input.dataset.field;
        this.localizationTranslations[locale][field] = input.value;
      });
    });
  }

  editLanguage(language) {
    this.editingLanguageId = language.id;
    const nameInput = document.getElementById('languageNativeName');
    const iso2Input = document.getElementById('languageIso2');
    const iso3Input = document.getElementById('languageIso3');
    const idInput = document.getElementById('languageId');

    if (nameInput) nameInput.value = language.native_name;
    if (iso2Input) iso2Input.value = language.iso2;
    if (iso3Input) iso3Input.value = language.iso3;
    if (idInput) idInput.value = language.id;
    this.setLanguageIcon(language.icon_uuid);
  }

  resetLanguageForm() {
    this.editingLanguageId = null;
    this.languageForm?.reset();
    const idInput = document.getElementById('languageId');
    if (idInput) idInput.value = '';
    this.setLanguageIcon(null);
  }

  setLanguageIcon(iconUuid) {
    const iconInput = document.getElementById('languageIconUuid');
    if (iconInput) iconInput.value = iconUuid || '';
    if (this.languageIconPreview) {
      if (iconUuid) {
        this.languageIconPreview.src = `/api/v1/upload/download/public/${iconUuid}`;
        this.languageIconPreview.classList.remove('hidden');
      } else {
        this.languageIconPreview.classList.add('hidden');
      }
    }
  }

  async uploadLanguageIcon(file) {
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const csrfToken = getCsrfToken();
      const response = await fetch(`${this.baseUrl}/api/v1/upload/public`, {
        method: 'POST',
        headers: csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {},
        body: formData,
        credentials: 'include'
      });

      const result = await response.json();
      if (response.ok && result.status === 'success' && result.upload?.uuid) {
        this.setLanguageIcon(result.upload.uuid);
        this.showToast('Icon uploaded', 'success');
      } else {
        this.showToast(result.message || 'Failed to upload icon', 'error');
      }
    } catch (error) {
      console.error('Failed to upload icon:', error);
      this.showToast('Failed to upload icon', 'error');
    } finally {
      if (this.languageIconFile) this.languageIconFile.value = '';
    }
  }

  async saveLanguage() {
    const nameInput = document.getElementById('languageNativeName');
    const iso2Input = document.getElementById('languageIso2');
    const iso3Input = document.getElementById('languageIso3');
    const iconInput = document.getElementById('languageIconUuid');

    if (!nameInput || !iso2Input || !iso3Input) return;
    const payload = {
      native_name: nameInput.value.trim(),
      iso2: iso2Input.value.trim(),
      iso3: iso3Input.value.trim(),
      icon_uuid: iconInput?.value || null
    };

    if (!payload.native_name || !payload.iso2 || !payload.iso3) {
      this.showToast('Please fill in all required fields', 'error');
      return;
    }

    const method = this.editingLanguageId ? 'PUT' : 'POST';
    const url = this.editingLanguageId
      ? `${this.baseUrl}/api/v1/admin/localizations/languages/${this.editingLanguageId}`
      : `${this.baseUrl}/api/v1/admin/localizations/languages`;

    try {
      const response = await fetch(url, {
        method,
        headers: getCsrfHeaders(),
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.showToast(result.message || 'Language saved', 'success');
        this.resetLanguageForm();
        await this.loadLanguages();
      } else {
        this.showToast(result.message || 'Failed to save language', 'error');
      }
    } catch (error) {
      console.error('Failed to save language:', error);
      this.showToast('Failed to save language', 'error');
    }
  }

  async deleteLanguage(languageId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/localizations/languages/${languageId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.showToast('Language deleted', 'success');
        await this.loadLanguages();
        await this.loadLocales();
        await this.loadLocalizationKeys();
      } else {
        this.showToast(result.message || 'Failed to delete language', 'error');
      }
    } catch (error) {
      console.error('Failed to delete language:', error);
      this.showToast('Failed to delete language', 'error');
    }
  }

  editLocale(locale) {
    this.editingLocaleId = locale.id;
    const localeIdInput = document.getElementById('localeId');
    const localeCodeInput = document.getElementById('localeCode');
    if (localeIdInput) localeIdInput.value = locale.id;
    if (localeCodeInput) localeCodeInput.value = locale.locale_code;
    if (this.localeLanguageSelect) this.localeLanguageSelect.value = locale.language_id;
  }

  resetLocaleForm() {
    this.editingLocaleId = null;
    this.localeForm?.reset();
    const localeIdInput = document.getElementById('localeId');
    if (localeIdInput) localeIdInput.value = '';
  }

  async saveLocale() {
    if (!this.localeLanguageSelect) return;
    const localeCodeInput = document.getElementById('localeCode');
    if (!localeCodeInput) return;

    const payload = {
      language_id: parseInt(this.localeLanguageSelect.value, 10),
      locale_code: localeCodeInput.value.trim()
    };

    if (!payload.language_id || !payload.locale_code) {
      this.showToast('Language and locale code are required', 'error');
      return;
    }

    const method = this.editingLocaleId ? 'PUT' : 'POST';
    const url = this.editingLocaleId
      ? `${this.baseUrl}/api/v1/admin/localizations/locales/${this.editingLocaleId}`
      : `${this.baseUrl}/api/v1/admin/localizations/locales`;

    try {
      const response = await fetch(url, {
        method,
        headers: getCsrfHeaders(),
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.showToast(result.message || 'Locale saved', 'success');
        this.resetLocaleForm();
        await this.loadLocales();
      } else {
        this.showToast(result.message || 'Failed to save locale', 'error');
      }
    } catch (error) {
      console.error('Failed to save locale:', error);
      this.showToast('Failed to save locale', 'error');
    }
  }

  async deleteLocale(localeId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/localizations/locales/${localeId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.showToast('Locale deleted', 'success');
        await this.loadLocales();
        await this.loadLocalizationKeys();
      } else {
        this.showToast(result.message || 'Failed to delete locale', 'error');
      }
    } catch (error) {
      console.error('Failed to delete locale:', error);
      this.showToast('Failed to delete locale', 'error');
    }
  }

  populateLocalizationForm(key) {
    this.editingLocalizationKeyId = key.id;
    const keyInput = document.getElementById('localizationKeyName');
    const contextInput = document.getElementById('localizationKeyContext');
    const idInput = document.getElementById('localizationKeyId');

    if (keyInput) keyInput.value = key.key;
    if (contextInput) contextInput.value = key.context || '';
    if (idInput) idInput.value = key.id;
    this.initializeLocalizationTranslations(key.translations || []);
    this.renderLocalizationTabs();
    this.renderTranslationInputs();
  }

  resetLocalizationForm() {
    this.editingLocalizationKeyId = null;
    this.localizationForm?.reset();
    const idInput = document.getElementById('localizationKeyId');
    if (idInput) idInput.value = '';
    this.initializeLocalizationTranslations();
    this.renderLocalizationTabs();
    this.renderTranslationInputs();
  }

  collectTranslations() {
    if (!this.locales.length) return [];
    return this.locales.map(locale => {
      const translation = this.localizationTranslations[locale.locale_code] || { singular: '', plural: '' };
      return {
        locale_code: locale.locale_code,
        singular: (translation.singular || '').trim(),
        plural: (translation.plural || '').trim()
      };
    });
  }

  async saveLocalizationKey() {
    const keyInput = document.getElementById('localizationKeyName');
    if (!keyInput) return;
    const contextInput = document.getElementById('localizationKeyContext');

    if (!this.locales.length) {
      this.showToast('Add at least one locale before creating keys', 'error');
      return;
    }

    const translations = this.collectTranslations();
    const missing = translations.find(item => !item.singular || !item.plural);
    if (missing) {
      this.showToast('Singular and plural values are required for all locales', 'error');
      return;
    }

    const payload = {
      key: keyInput.value.trim(),
      context: contextInput?.value.trim() || null,
      translations
    };

    if (!payload.key) {
      this.showToast('Key is required', 'error');
      return;
    }

    const method = this.editingLocalizationKeyId ? 'PUT' : 'POST';
    const url = this.editingLocalizationKeyId
      ? `${this.baseUrl}/api/v1/admin/localizations/keys/${this.editingLocalizationKeyId}`
      : `${this.baseUrl}/api/v1/admin/localizations/keys`;

    try {
      const response = await fetch(url, {
        method,
        headers: getCsrfHeaders(),
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.showToast(result.message || 'Localization key saved', 'success');
        this.resetLocalizationForm();
        this.closeLocalizationModal();
        await this.loadLocalizationKeys();
      } else {
        this.showToast(result.message || 'Failed to save localization key', 'error');
      }
    } catch (error) {
      console.error('Failed to save localization key:', error);
      this.showToast('Failed to save localization key', 'error');
    }
  }

  async deleteLocalizationKey(keyId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/localizations/keys/${keyId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        this.showToast('Localization key deleted', 'success');
        await this.loadLocalizationKeys();
      } else {
        this.showToast(result.message || 'Failed to delete localization key', 'error');
      }
    } catch (error) {
      console.error('Failed to delete localization key:', error);
      this.showToast('Failed to delete localization key', 'error');
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
