/**
 * SchemaFormBuilder - Dynamic form generator for Schema.org types
 *
 * Generates form fields based on schema definitions fetched from the API.
 * Handles multi-type properties with radio selectors and nested entity forms.
 */
export class SchemaFormBuilder {
  /**
   * @param {Object} config - Configuration object
   * @param {HTMLElement} config.container - Container element for the form
   * @param {string} config.baseUrl - API base URL
   * @param {Function} config.onChange - Callback when form data changes
   * @param {Object} config.csrfHeaders - CSRF headers for API calls
   * @param {number} config.maxNestingDepth - Max depth for nested forms (default: 20, use Infinity for unlimited)
   * @param {number} config.currentDepth - Current nesting depth (default: 0)
   * @param {Map} config.sharedCache - Shared cache for schema definitions
   * @param {string} config.langCode - Language code for entity queries (default: 'en')
   */
  constructor(config) {
    this.container = config.container;
    this.baseUrl = config.baseUrl || '';
    this.onChange = config.onChange || (() => {});
    this.csrfHeaders = config.csrfHeaders || {};
    this.maxNestingDepth = config.maxNestingDepth !== undefined ? config.maxNestingDepth : 20; // Allow deep nesting
    this.currentDepth = config.currentDepth || 0;
    this.langCode = config.langCode || 'en';

    // State
    this.schemaType = null;
    this.schemaDefinition = null;
    this.formData = {};
    this.nestedForms = new Map(); // Map of property name -> nested SchemaFormBuilder
    this.entitySelectorPopup = null; // Currently open entity selector popup

    // Cache for schema definitions (shared across nested builders)
    this.schemaCache = config.sharedCache || new Map();
    // Cache for existing entities by type
    this.entityCache = config.entityCache || new Map();
  }

  /**
   * Fetch schema definition from API
   * @param {string} typeName - Schema type name
   */
  async fetchSchema(typeName) {
    // Check cache first
    if (this.schemaCache.has(typeName)) {
      return this.schemaCache.get(typeName);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/schemas/${encodeURIComponent(typeName)}`, {
        headers: {
          'Accept': 'application/json',
          ...this.csrfHeaders
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch schema for ${typeName}`);
      }

      const data = await response.json();
      if (data.status === 'success' && data.schema) {
        this.schemaCache.set(typeName, data.schema);
        return data.schema;
      }
    } catch (error) {
      console.error(`Error fetching schema ${typeName}:`, error);
    }
    return null;
  }

  /**
   * Fetch existing entities of a specific type from the API
   * @param {string} schemaType - Schema type to fetch (e.g., 'PostalAddress')
   * @param {string} search - Optional search query
   * @returns {Promise<Array>} Array of entities
   */
  async fetchExistingEntities(schemaType, search = '') {
    const cacheKey = `${schemaType}:${this.langCode}:${search}`;

    // Check cache first (only if no search query)
    if (!search && this.entityCache.has(cacheKey)) {
      return this.entityCache.get(cacheKey);
    }

    try {
      const params = new URLSearchParams({
        lang_code: this.langCode,
        schema_type: schemaType,
        limit: '50'
      });

      if (search) {
        params.append('q', search);
      }

      const response = await fetch(`${this.baseUrl}/api/v1/admin/seo/entities?${params}`, {
        headers: {
          'Accept': 'application/json',
          ...this.csrfHeaders
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch entities for ${schemaType}`);
      }

      const data = await response.json();
      if (data.status === 'success' && Array.isArray(data.entities)) {
        // Cache only if no search query
        if (!search) {
          this.entityCache.set(cacheKey, data.entities);
        }
        return data.entities;
      }
    } catch (error) {
      console.error(`Error fetching entities ${schemaType}:`, error);
    }
    return [];
  }

  /**
   * Load and render a schema type
   * @param {string} typeName - Schema type name
   * @param {Object} initialData - Initial form data (optional)
   */
  async loadSchema(typeName, initialData = {}) {
    this.container.innerHTML = '<div class="schema-form__loading">Loading schema...</div>';

    const schema = await this.fetchSchema(typeName);
    if (!schema) {
      this.container.innerHTML = '<div class="schema-form__error">Failed to load schema definition.</div>';
      return;
    }

    this.schemaType = typeName;
    this.schemaDefinition = schema;
    this.formData = { '@type': typeName, ...initialData };
    this.nestedForms.clear();

    // Render with the current depth
    this.render(this.currentDepth);
  }

  /**
   * Render the form
   * @param {number} depth - Current nesting depth
   */
  render(depth = 0) {
    if (!this.schemaDefinition) {
      this.container.innerHTML = '<div class="schema-form__empty">No schema loaded.</div>';
      return;
    }

    const { properties } = this.schemaDefinition;

    // Separate own vs inherited properties
    const ownProps = properties.filter(p => !p.is_inherited);
    const inheritedProps = properties.filter(p => p.is_inherited);

    // Get current @id value if any
    const currentId = this.formData['@id'] || '';

    this.container.innerHTML = `
      <div class="schema-form" data-depth="${depth}">
        <div class="schema-form__header">
          <span class="schema-form__type-badge">${this.schemaType}</span>
          <span class="schema-form__path">${this.schemaDefinition.path?.join(' > ') || ''}</span>
        </div>

        <!-- @id field - required for every entity -->
        <div class="schema-form__id-section">
          <div class="schema-form__field schema-form__field--id">
            <label class="schema-form__label" for="schema-id-${depth}">
              <span class="schema-form__label-text">@id</span>
              <span class="schema-form__required-badge">Required</span>
            </label>
            <div class="schema-form__description">
              Unique identifier for this ${this.schemaType}. Use format: <code>urn:{lang}:${this.schemaType.toLowerCase()}:your-unique-id</code>
            </div>
            <input type="text"
                   id="schema-id-${depth}"
                   name="@id"
                   value="${this.escapeHtml(currentId)}"
                   class="schema-form__input schema-form__input--id form-input"
                   placeholder="urn:en:${this.schemaType.toLowerCase()}:unique-identifier"
                   data-entity-id="true">
          </div>
        </div>

        ${ownProps.length > 0 ? `
          <fieldset class="schema-form__section">
            <legend class="schema-form__section-title">Properties of ${this.schemaType}</legend>
            <div class="schema-form__fields schema-form__fields--own">
              ${ownProps.map(prop => this.renderPropertyField(prop, depth)).join('')}
            </div>
          </fieldset>
        ` : ''}

        ${inheritedProps.length > 0 ? `
          <fieldset class="schema-form__section schema-form__section--inherited">
            <legend class="schema-form__section-title">
              <button type="button" class="schema-form__toggle-inherited" aria-expanded="false">
                Inherited Properties (${inheritedProps.length})
                <span class="schema-form__toggle-icon">+</span>
              </button>
            </legend>
            <div class="schema-form__fields schema-form__fields--inherited" style="display: none;">
              ${inheritedProps.map(prop => this.renderPropertyField(prop, depth)).join('')}
            </div>
          </fieldset>
        ` : ''}
      </div>
    `;

    // Bind event listeners
    this.bindEventListeners(depth);
  }

  /**
   * Render a single property field
   * @param {Object} prop - Property definition
   * @param {number} depth - Current nesting depth
   */
  renderPropertyField(prop, depth) {
    const { name, label, description, expected_types, defined_on, is_inherited } = prop;
    const fieldId = `schema-field-${name}-${depth}`;
    const currentValue = this.formData[name] || '';

    // Determine if this property has multiple expected types
    const hasMultipleTypes = expected_types && expected_types.length > 1;
    const hasEntityTypes = expected_types?.some(t => t.kind === 'entity');
    const hasDataTypes = expected_types?.some(t => t.kind === 'data_type');

    return `
      <div class="schema-form__field" data-property="${name}">
        <label class="schema-form__label" for="${fieldId}">
          <span class="schema-form__label-text">${label || name}</span>
          ${is_inherited ? `<span class="schema-form__inherited-badge" title="Inherited from ${defined_on}">${defined_on}</span>` : ''}
        </label>

        ${description ? `<div class="schema-form__description">${this.formatDescription(description)}</div>` : ''}

        ${hasMultipleTypes ? this.renderMultiTypeSelector(prop, fieldId, depth) : this.renderSingleTypeInput(prop, fieldId, currentValue, depth)}
      </div>
    `;
  }

  /**
   * Render multi-type selector (radio buttons for expected types)
   * @param {Object} prop - Property definition
   * @param {string} fieldId - Field ID prefix
   * @param {number} depth - Current nesting depth
   */
  renderMultiTypeSelector(prop, fieldId, depth) {
    const { name, expected_types } = prop;
    const selectedType = this.formData[`${name}__type`] || '';

    // Sort: data types first, then entities
    const sortedTypes = [...expected_types].sort((a, b) => {
      if (a.kind === 'data_type' && b.kind === 'entity') return -1;
      if (a.kind === 'entity' && b.kind === 'data_type') return 1;
      return a.type.localeCompare(b.type);
    });

    return `
      <div class="schema-form__type-selector">
        <div class="schema-form__type-options">
          ${sortedTypes.map((type, idx) => `
            <label class="schema-form__type-option">
              <input type="radio"
                     name="${name}__type"
                     value="${type.type}"
                     class="schema-form__type-radio"
                     data-kind="${type.kind}"
                     ${selectedType === type.type ? 'checked' : ''}>
              <span class="schema-form__type-label">
                ${type.type}
                <span class="schema-form__type-kind schema-form__type-kind--${type.kind}">${type.kind === 'data_type' ? 'text' : 'entity'}</span>
              </span>
            </label>
          `).join('')}
        </div>

        <div class="schema-form__type-input" data-property="${name}">
          ${selectedType ? this.renderTypeInput(prop, selectedType, expected_types.find(t => t.type === selectedType), fieldId, depth) : '<p class="schema-form__hint">Select a type above</p>'}
        </div>
      </div>
    `;
  }

  /**
   * Render input for a specific type
   * @param {Object} prop - Property definition
   * @param {string} typeName - Selected type name
   * @param {Object} typeInfo - Type info { type, kind }
   * @param {string} fieldId - Field ID
   * @param {number} depth - Current nesting depth
   */
  renderTypeInput(prop, typeName, typeInfo, fieldId, depth) {
    if (!typeInfo) return '';

    const { name } = prop;
    const currentValue = this.formData[name] || '';

    if (typeInfo.kind === 'data_type') {
      // Data type - render appropriate input
      return this.renderDataTypeInput(name, typeName, fieldId, currentValue);
    } else {
      // Entity type - render @id input + optional nested form
      return this.renderEntityTypeInput(name, typeName, fieldId, currentValue, depth);
    }
  }

  /**
   * Render input for data types (Text, URL, Number, Date, etc.)
   * @param {string} propName - Property name
   * @param {string} typeName - Type name (Text, URL, Number, etc.)
   * @param {string} fieldId - Field ID
   * @param {string} currentValue - Current value
   */
  renderDataTypeInput(propName, typeName, fieldId, currentValue) {
    const inputType = this.getInputTypeForDataType(typeName);
    const placeholder = this.getPlaceholderForDataType(typeName);

    return `
      <input type="${inputType}"
             id="${fieldId}"
             name="${propName}"
             value="${this.escapeHtml(currentValue)}"
             class="schema-form__input form-input"
             placeholder="${placeholder}"
             data-data-type="${typeName}">
    `;
  }

  /**
   * Render input for entity types (with @id and optional inline form)
   * @param {string} propName - Property name
   * @param {string} typeName - Entity type name
   * @param {string} fieldId - Field ID
   * @param {*} currentValue - Current value (string @id or object)
   * @param {number} depth - Current nesting depth
   */
  renderEntityTypeInput(propName, typeName, fieldId, currentValue, depth) {
    const isInlineMode = typeof currentValue === 'object' && currentValue !== null && !currentValue['@id'];
    const idValue = typeof currentValue === 'string' ? currentValue : (currentValue?.['@id'] || '');
    const canNest = depth < this.maxNestingDepth;
    const nestedDepth = depth + 1;

    return `
      <div class="schema-form__entity-input" data-entity-depth="${depth}">
        <div class="schema-form__entity-options">
          <div class="schema-form__entity-option schema-form__entity-option--ref ${!isInlineMode ? 'schema-form__entity-option--active' : ''}">
            <div class="schema-form__entity-option-header">
              <label class="schema-form__radio-label">
                <input type="radio"
                       name="${propName}__mode"
                       value="reference"
                       class="schema-form__mode-radio"
                       data-property="${propName}"
                       ${!isInlineMode ? 'checked' : ''}>
                <span class="schema-form__option-title">Reference existing ${typeName}</span>
              </label>
            </div>
            <div class="schema-form__entity-ref-content" ${isInlineMode ? 'style="display: none;"' : ''}>
              <div class="schema-form__entity-ref-input-row">
                <input type="text"
                       id="${fieldId}-id"
                       name="${propName}__id"
                       value="${this.escapeHtml(idValue)}"
                       class="schema-form__input form-input schema-form__entity-id-input"
                       placeholder="@id: urn:${this.langCode}:${typeName.toLowerCase()}:example-id"
                       ${isInlineMode ? 'disabled' : ''}>
                <button type="button"
                        class="schema-form__browse-btn btn btn-secondary"
                        data-property="${propName}"
                        data-entity-type="${typeName}"
                        title="Browse existing ${typeName} entities">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  Browse
                </button>
              </div>
              <small class="schema-form__hint">Enter @id manually or browse existing ${typeName} entities</small>
            </div>
          </div>

          ${canNest ? `
            <div class="schema-form__entity-option schema-form__entity-option--inline ${isInlineMode ? 'schema-form__entity-option--active' : ''}">
              <div class="schema-form__entity-option-header">
                <label class="schema-form__radio-label">
                  <input type="radio"
                         name="${propName}__mode"
                         value="inline"
                         class="schema-form__mode-radio"
                         data-property="${propName}"
                         data-entity-type="${typeName}"
                         ${isInlineMode ? 'checked' : ''}>
                  <span class="schema-form__option-title">Create new ${typeName} inline</span>
                  <span class="schema-form__depth-badge" title="Nesting level ${nestedDepth}">Level ${nestedDepth}</span>
                </label>
              </div>
              <div class="schema-form__nested-form"
                   data-property="${propName}"
                   data-entity-type="${typeName}"
                   style="${isInlineMode ? '' : 'display: none;'}">
                <!-- Nested form will be rendered here -->
              </div>
            </div>
          ` : `
            <div class="schema-form__entity-option schema-form__entity-option--disabled">
              <p class="schema-form__depth-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                Maximum nesting depth (${this.maxNestingDepth}) reached. Use @id reference above.
              </p>
            </div>
          `}
        </div>
      </div>
    `;
  }

  /**
   * Render single-type input (when property has only one expected type)
   * @param {Object} prop - Property definition
   * @param {string} fieldId - Field ID
   * @param {string} currentValue - Current value
   * @param {number} depth - Current nesting depth
   */
  renderSingleTypeInput(prop, fieldId, currentValue, depth = 0) {
    const { name, expected_types } = prop;

    if (!expected_types || expected_types.length === 0) {
      // No expected types - default to text input
      return `
        <input type="text"
               id="${fieldId}"
               name="${name}"
               value="${this.escapeHtml(currentValue)}"
               class="schema-form__input form-input"
               placeholder="Enter value...">
      `;
    }

    const type = expected_types[0];

    if (type.kind === 'data_type') {
      return this.renderDataTypeInput(name, type.type, fieldId, currentValue);
    } else {
      return this.renderEntityTypeInput(name, type.type, fieldId, currentValue, depth);
    }
  }

  /**
   * Get HTML input type for a Schema.org data type
   * @param {string} dataType - Schema.org data type
   */
  getInputTypeForDataType(dataType) {
    const typeMap = {
      'Text': 'text',
      'URL': 'url',
      'Number': 'number',
      'Integer': 'number',
      'Float': 'number',
      'Date': 'date',
      'DateTime': 'datetime-local',
      'Time': 'time',
      'Boolean': 'checkbox',
      'Email': 'email',
      'Telephone': 'tel'
    };
    return typeMap[dataType] || 'text';
  }

  /**
   * Get placeholder for a Schema.org data type
   * @param {string} dataType - Schema.org data type
   */
  getPlaceholderForDataType(dataType) {
    const placeholderMap = {
      'Text': 'Enter text...',
      'URL': 'https://example.com',
      'Number': '0',
      'Integer': '0',
      'Float': '0.00',
      'Date': 'YYYY-MM-DD',
      'DateTime': 'YYYY-MM-DDTHH:MM',
      'Time': 'HH:MM',
      'Boolean': '',
      'Email': 'email@example.com',
      'Telephone': '+1-555-123-4567'
    };
    return placeholderMap[dataType] || 'Enter value...';
  }

  /**
   * Bind event listeners for the form
   * @param {number} depth - Current nesting depth
   */
  bindEventListeners(depth) {
    // Find the schema-form element at this specific depth level
    const schemaForm = this.container.querySelector(`.schema-form[data-depth="${depth}"]`);
    if (!schemaForm) {
      console.warn(`[SchemaFormBuilder] Could not find schema-form at depth ${depth}`);
      return;
    }

    // Helper to check if an element is inside a DIFFERENT nested form (not our container)
    // This allows binding events in nested forms while preventing double-binding
    const isInDifferentNestedForm = (element) => {
      const nestedParent = element.closest('.schema-form__nested-form');
      // If the element is in a nested form that's different from our container, skip it
      return nestedParent && nestedParent !== this.container;
    };

    // Toggle inherited properties - only bind to the toggle at THIS depth level
    // Use :scope to query only within the schemaForm, and exclude nested .schema-form elements
    const toggleBtn = schemaForm.querySelector(':scope > .schema-form__section--inherited .schema-form__toggle-inherited');
    if (toggleBtn) {
      // Remove any existing listener by cloning
      const newToggleBtn = toggleBtn.cloneNode(true);
      toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

      newToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling to parent forms
        const isExpanded = newToggleBtn.getAttribute('aria-expanded') === 'true';
        newToggleBtn.setAttribute('aria-expanded', !isExpanded);
        newToggleBtn.querySelector('.schema-form__toggle-icon').textContent = isExpanded ? '+' : '-';

        // Find inherited fields at this depth only (sibling of the legend)
        const inheritedFields = newToggleBtn.closest('.schema-form__section--inherited')?.querySelector('.schema-form__fields--inherited');
        if (inheritedFields) {
          inheritedFields.style.display = isExpanded ? 'none' : 'block';
        }
      });
    }

    // @id input field - bind at this depth level
    const idInput = schemaForm.querySelector(':scope > .schema-form__id-section .schema-form__input--id');
    if (idInput) {
      idInput.addEventListener('input', (e) => this.handleIdChange(e));
      idInput.addEventListener('change', (e) => this.handleIdChange(e));
    }

    // Type radio buttons - only at this depth level (not in deeper nested forms)
    schemaForm.querySelectorAll(':scope > .schema-form__section .schema-form__type-radio').forEach(radio => {
      // Check if this radio is inside a different nested form
      if (isInDifferentNestedForm(radio)) return;

      radio.addEventListener('change', (e) => this.handleTypeChange(e, depth));
    });

    // Input fields - only at this depth level
    schemaForm.querySelectorAll(':scope > .schema-form__section .schema-form__input').forEach(input => {
      // Check if this input is inside a different nested form
      if (isInDifferentNestedForm(input)) return;

      input.addEventListener('input', (e) => this.handleInputChange(e));
      input.addEventListener('change', (e) => this.handleInputChange(e));
    });

    // Mode radio buttons - only at this depth level (for entity reference vs inline)
    schemaForm.querySelectorAll(':scope > .schema-form__section .schema-form__mode-radio').forEach(radio => {
      // Check if this radio is inside a different nested form
      if (isInDifferentNestedForm(radio)) return;

      radio.addEventListener('change', (e) => this.handleModeChange(e, depth));
    });

    // Browse existing entity buttons - only at this depth level
    schemaForm.querySelectorAll(':scope > .schema-form__section .schema-form__browse-btn').forEach(btn => {
      // Check if this button is inside a different nested form
      if (isInDifferentNestedForm(btn)) return;

      btn.addEventListener('click', (e) => this.handleBrowseEntities(e));
    });

    // Legacy: Inline checkboxes - only at this depth level (for backward compatibility)
    schemaForm.querySelectorAll(':scope > .schema-form__section .schema-form__inline-checkbox').forEach(checkbox => {
      // Check if this checkbox is inside a different nested form
      if (isInDifferentNestedForm(checkbox)) return;

      checkbox.addEventListener('change', (e) => this.handleInlineToggle(e, depth));
    });
  }

  /**
   * Handle mode radio button change (reference vs inline)
   * @param {Event} e - Change event
   * @param {number} depth - Current nesting depth
   */
  async handleModeChange(e, depth) {
    const radio = e.target;
    const propName = radio.dataset.property;
    const mode = radio.value;
    const entityType = radio.dataset.entityType;

    console.log(`[SchemaFormBuilder] handleModeChange: ${propName} -> ${mode} at depth ${depth}`);

    // Find the entity options container
    const entityOptions = radio.closest('.schema-form__entity-options');
    if (!entityOptions) return;

    // Toggle option active states
    entityOptions.querySelectorAll('.schema-form__entity-option').forEach(opt => {
      opt.classList.remove('schema-form__entity-option--active');
    });
    const activeOption = radio.closest('.schema-form__entity-option');
    if (activeOption) {
      activeOption.classList.add('schema-form__entity-option--active');
    }

    // Toggle content visibility
    const refContent = entityOptions.querySelector('.schema-form__entity-ref-content');
    const nestedContainer = entityOptions.querySelector(`.schema-form__nested-form[data-property="${propName}"]`);
    const idInput = entityOptions.querySelector(`input[name="${propName}__id"]`);

    if (mode === 'reference') {
      // Show reference input, hide nested form
      if (refContent) refContent.style.display = '';
      if (nestedContainer) nestedContainer.style.display = 'none';
      if (idInput) idInput.disabled = false;
    } else if (mode === 'inline' && nestedContainer) {
      // Hide reference input, show nested form
      if (refContent) refContent.style.display = 'none';
      if (idInput) idInput.disabled = true;
      nestedContainer.style.display = 'block';

      // Load nested form if not already loaded
      const existingBuilder = this.nestedForms.get(propName);
      const needsNewBuilder = !existingBuilder || existingBuilder.schemaType !== entityType;

      if (needsNewBuilder) {
        nestedContainer.innerHTML = '<div class="schema-form__loading">Loading schema...</div>';

        const nestedDepth = depth + 1;
        console.log(`[SchemaFormBuilder] Creating nested form for ${entityType} at depth ${nestedDepth}`);

        const nestedBuilder = new SchemaFormBuilder({
          container: nestedContainer,
          baseUrl: this.baseUrl,
          csrfHeaders: this.csrfHeaders,
          maxNestingDepth: this.maxNestingDepth,
          currentDepth: nestedDepth,
          sharedCache: this.schemaCache,
          entityCache: this.entityCache,
          langCode: this.langCode,
          onChange: () => this.notifyChange()
        });

        try {
          await nestedBuilder.loadSchema(entityType, this.formData[propName] || {});
          this.nestedForms.set(propName, nestedBuilder);
          console.log(`[SchemaFormBuilder] Successfully loaded nested schema for ${entityType}`);
        } catch (error) {
          console.error(`[SchemaFormBuilder] Failed to load nested schema for ${entityType}:`, error);
          nestedContainer.innerHTML = `<div class="schema-form__error">Failed to load ${entityType} schema.</div>`;
        }
      } else {
        // Reuse existing builder
        console.log(`[SchemaFormBuilder] Reusing cached nested form for ${entityType}`);
        existingBuilder.container = nestedContainer;
        existingBuilder.render(depth + 1);
      }
    }

    this.notifyChange();
  }

  /**
   * Handle type radio button change
   * @param {Event} e - Change event
   * @param {number} depth - Current nesting depth
   */
  handleTypeChange(e, depth) {
    const radio = e.target;
    const propName = radio.name.replace('__type', '');
    const typeName = radio.value;
    const kind = radio.dataset.kind;

    console.log(`[SchemaFormBuilder] handleTypeChange: ${propName} -> ${typeName} (${kind}) at depth ${depth}`);

    // Store selected type
    this.formData[`${propName}__type`] = typeName;

    // Clear any existing nested form for this property since the type changed
    // The nested form was created for a different entity type
    if (this.nestedForms.has(propName)) {
      console.log(`[SchemaFormBuilder] Type changed for ${propName}, clearing old nested form`);
      this.nestedForms.delete(propName);
      // Also clear the form data for this property
      delete this.formData[propName];
    }

    // Find the type info
    const prop = this.schemaDefinition.properties.find(p => p.name === propName);
    const typeInfo = prop?.expected_types?.find(t => t.type === typeName);

    console.log(`[SchemaFormBuilder] Found prop:`, prop?.name, 'typeInfo:', typeInfo);

    // Re-render the input area for this property - search from the radio's context first
    const typeSelector = radio.closest('.schema-form__type-selector');
    let inputContainer = typeSelector?.querySelector(`.schema-form__type-input[data-property="${propName}"]`);

    // Fallback to searching in container
    if (!inputContainer) {
      inputContainer = this.container.querySelector(`.schema-form__type-input[data-property="${propName}"]`);
    }

    if (inputContainer && typeInfo) {
      console.log(`[SchemaFormBuilder] Rendering type input for ${typeName}`);
      inputContainer.innerHTML = this.renderTypeInput(prop, typeName, typeInfo, `schema-field-${propName}-${depth}`, depth);

      // Rebind listeners for new elements
      inputContainer.querySelectorAll('.schema-form__input').forEach(input => {
        input.addEventListener('input', (e) => this.handleInputChange(e));
        input.addEventListener('change', (e) => this.handleInputChange(e));
      });

      // Bind mode radio buttons for entity reference vs inline
      inputContainer.querySelectorAll('.schema-form__mode-radio').forEach(radio => {
        console.log(`[SchemaFormBuilder] Binding mode radio for ${radio.dataset.property} (${radio.dataset.entityType})`);
        radio.addEventListener('change', (e) => this.handleModeChange(e, depth));
      });

      // Bind browse buttons for entity selection
      inputContainer.querySelectorAll('.schema-form__browse-btn').forEach(btn => {
        console.log(`[SchemaFormBuilder] Binding browse button for ${btn.dataset.property} (${btn.dataset.entityType})`);
        btn.addEventListener('click', (e) => this.handleBrowseEntities(e));
      });

      // Legacy: Bind inline checkboxes (for backward compatibility)
      inputContainer.querySelectorAll('.schema-form__inline-checkbox').forEach(checkbox => {
        console.log(`[SchemaFormBuilder] Binding inline checkbox for ${checkbox.dataset.property} (${checkbox.dataset.entityType})`);
        checkbox.addEventListener('change', (e) => this.handleInlineToggle(e, depth));
      });
    } else {
      console.warn(`[SchemaFormBuilder] Could not find inputContainer for ${propName} or missing typeInfo`);
    }

    this.notifyChange();
  }

  /**
   * Handle @id input change for the entity itself
   * @param {Event} e - Input event
   */
  handleIdChange(e) {
    const input = e.target;
    const value = input.value.trim();

    if (value) {
      this.formData['@id'] = value;
    } else {
      delete this.formData['@id'];
    }

    this.notifyChange();
  }

  /**
   * Handle input change
   * @param {Event} e - Input event
   */
  handleInputChange(e) {
    const input = e.target;
    const propName = input.name.replace('__id', '');

    if (input.type === 'checkbox') {
      this.formData[propName] = input.checked;
    } else {
      this.formData[propName] = input.value;
    }

    this.notifyChange();
  }

  /**
   * Handle inline form toggle
   * @param {Event} e - Change event
   * @param {number} depth - Current nesting depth
   */
  async handleInlineToggle(e, depth) {
    const checkbox = e.target;
    const propName = checkbox.dataset.property;
    const entityType = checkbox.dataset.entityType;

    console.log(`[SchemaFormBuilder] handleInlineToggle called for ${propName} (${entityType}) at depth ${depth}`);

    // Find the nested container that is a sibling to this checkbox's parent
    // The checkbox is inside .schema-form__entity-inline, and the nested-form is also inside it
    const entityInline = checkbox.closest('.schema-form__entity-inline');
    let nestedContainer = entityInline?.querySelector(`.schema-form__nested-form[data-property="${propName}"]`);

    // Fallback: search in the whole container
    if (!nestedContainer) {
      nestedContainer = this.container.querySelector(`.schema-form__nested-form[data-property="${propName}"][data-entity-type="${entityType}"]`);
    }

    if (!nestedContainer) {
      console.error(`[SchemaFormBuilder] Could not find nested container for property: ${propName}, entityType: ${entityType}`);
      console.log('[SchemaFormBuilder] Container HTML:', this.container.innerHTML.substring(0, 500));
      return;
    }

    console.log(`[SchemaFormBuilder] Found nested container for ${propName}`);

    // Toggle @id input - find it near the checkbox, not globally
    const entityRef = entityInline?.closest('.schema-form__entity-input')?.querySelector('.schema-form__entity-ref');
    const idInput = entityRef?.querySelector(`input[name="${propName}__id"]`) ||
                    this.container.querySelector(`input[name="${propName}__id"]`);
    if (idInput) {
      idInput.disabled = checkbox.checked;
      console.log(`[SchemaFormBuilder] ${checkbox.checked ? 'Disabled' : 'Enabled'} @id input for ${propName}`);
    }

    if (checkbox.checked) {
      // Show nested form container
      nestedContainer.style.display = 'block';
      nestedContainer.innerHTML = '<div class="schema-form__loading">Loading nested schema...</div>';

      // Check if we have a cached nested form AND if it's for the correct entity type
      const existingBuilder = this.nestedForms.get(propName);
      const needsNewBuilder = !existingBuilder || existingBuilder.schemaType !== entityType;

      if (needsNewBuilder) {
        // Clear old builder if it exists but is for a different type
        if (existingBuilder) {
          console.log(`[SchemaFormBuilder] Entity type mismatch for ${propName}: cached=${existingBuilder.schemaType}, requested=${entityType}`);
          this.nestedForms.delete(propName);
        }

        const nestedDepth = depth + 1;
        console.log(`[SchemaFormBuilder] Creating nested form for ${entityType} at depth ${nestedDepth}`);

        const nestedBuilder = new SchemaFormBuilder({
          container: nestedContainer,
          baseUrl: this.baseUrl,
          csrfHeaders: this.csrfHeaders,
          maxNestingDepth: this.maxNestingDepth,
          currentDepth: nestedDepth,
          sharedCache: this.schemaCache, // Share the cache
          entityCache: this.entityCache,
          langCode: this.langCode,
          onChange: () => this.notifyChange()
        });

        try {
          console.log(`[SchemaFormBuilder] Loading nested schema ${entityType} into container:`, nestedContainer);
          await nestedBuilder.loadSchema(entityType, this.formData[propName] || {});
          this.nestedForms.set(propName, nestedBuilder);
          console.log(`[SchemaFormBuilder] Successfully loaded nested schema for ${entityType}`);
          console.log(`[SchemaFormBuilder] Nested builder container now has ${nestedContainer.children.length} children`);
        } catch (error) {
          console.error(`[SchemaFormBuilder] Failed to load nested schema for ${entityType}:`, error);
          nestedContainer.innerHTML = `<div class="schema-form__error">Failed to load ${entityType} schema.</div>`;
        }
      } else {
        // Re-render existing nested form (type matches)
        console.log(`[SchemaFormBuilder] Reusing cached nested form for ${entityType}`);
        existingBuilder.container = nestedContainer; // Update container reference
        existingBuilder.render(depth + 1);
      }
    } else {
      // Hide nested form and clear contents
      nestedContainer.style.display = 'none';
      // Keep the nested form in memory for quick re-display if user toggles back
    }

    this.notifyChange();
  }

  /**
   * Handle browse entities button click
   * @param {Event} e - Click event
   */
  async handleBrowseEntities(e) {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.currentTarget;
    const propName = btn.dataset.property;
    const entityType = btn.dataset.entityType;

    console.log(`[SchemaFormBuilder] Browse entities for ${propName} (${entityType})`);

    // Close any existing popup
    this.closeEntitySelector();

    // Show loading state on button
    btn.classList.add('loading');
    btn.disabled = true;

    try {
      // Fetch existing entities
      const entities = await this.fetchExistingEntities(entityType);

      // Create and show popup
      this.showEntitySelector(btn, propName, entityType, entities);
    } catch (error) {
      console.error(`[SchemaFormBuilder] Error fetching entities:`, error);
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  /**
   * Show entity selector popup
   * @param {HTMLElement} anchorBtn - Button that triggered the popup
   * @param {string} propName - Property name
   * @param {string} entityType - Entity type
   * @param {Array} entities - Array of entities
   */
  showEntitySelector(anchorBtn, propName, entityType, entities) {
    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'schema-form__entity-selector';
    popup.dataset.property = propName;

    const hasEntities = entities && entities.length > 0;

    popup.innerHTML = `
      <div class="schema-form__entity-selector-header">
        <span class="schema-form__entity-selector-title">Select ${entityType}</span>
        <button type="button" class="schema-form__entity-selector-close" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="schema-form__entity-selector-search">
        <input type="text"
               class="schema-form__entity-selector-input form-input"
               placeholder="Search by @id..."
               data-entity-type="${entityType}">
      </div>
      <div class="schema-form__entity-selector-list">
        ${hasEntities ? this.renderEntityList(entities) : `
          <div class="schema-form__entity-selector-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p>No ${entityType} entities found.</p>
            <small>Create one using the schema form first.</small>
          </div>
        `}
      </div>
    `;

    // Position popup near the button - align right edges
    const btnRect = anchorBtn.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    popup.style.position = 'absolute';
    popup.style.top = `${btnRect.bottom - containerRect.top + 5}px`;
    // Align right edge of popup with right edge of button
    popup.style.right = `${containerRect.right - btnRect.right}px`;
    popup.style.left = 'auto';
    popup.style.zIndex = '1000';

    // Add to container
    this.container.style.position = 'relative';
    this.container.appendChild(popup);
    this.entitySelectorPopup = popup;

    // Bind popup events
    this.bindEntitySelectorEvents(popup, propName, entityType);

    // Focus search input
    const searchInput = popup.querySelector('.schema-form__entity-selector-input');
    if (searchInput) {
      searchInput.focus();
    }

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 0);
  }

  /**
   * Render entity list HTML
   * @param {Array} entities - Array of entities
   * @returns {string} HTML string
   */
  renderEntityList(entities) {
    return entities.map(entity => {
      const schemaId = entity.schema_id || '';
      const schemaType = entity.schema_type || '';
      const schemaData = entity.schema_data || {};

      // Try to get a display name from schema_data
      const displayName = schemaData.name ||
                          schemaData.addressLocality ||
                          schemaData.streetAddress ||
                          schemaData.givenName ||
                          schemaData.familyName ||
                          schemaData.title ||
                          schemaId;

      return `
        <div class="schema-form__entity-selector-item"
             data-schema-id="${this.escapeHtml(schemaId)}"
             data-schema-type="${this.escapeHtml(schemaType)}"
             tabindex="0">
          <div class="schema-form__entity-selector-item-main">
            <span class="schema-form__entity-selector-item-id">${this.escapeHtml(schemaId)}</span>
            ${displayName !== schemaId ? `<span class="schema-form__entity-selector-item-name">${this.escapeHtml(displayName)}</span>` : ''}
          </div>
          <span class="schema-form__entity-selector-item-type">${this.escapeHtml(schemaType)}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Bind events for entity selector popup
   * @param {HTMLElement} popup - Popup element
   * @param {string} propName - Property name
   * @param {string} entityType - Entity type
   */
  bindEntitySelectorEvents(popup, propName, entityType) {
    // Close button
    const closeBtn = popup.querySelector('.schema-form__entity-selector-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeEntitySelector());
    }

    // Search input
    const searchInput = popup.querySelector('.schema-form__entity-selector-input');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', async (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
          const query = e.target.value.trim();
          const entities = await this.fetchExistingEntities(entityType, query);
          const listContainer = popup.querySelector('.schema-form__entity-selector-list');
          if (listContainer) {
            if (entities && entities.length > 0) {
              listContainer.innerHTML = this.renderEntityList(entities);
              this.bindEntityItemEvents(popup, propName);
            } else {
              listContainer.innerHTML = `
                <div class="schema-form__entity-selector-empty">
                  <p>No results for "${this.escapeHtml(query)}"</p>
                </div>
              `;
            }
          }
        }, 300);
      });

      // Keyboard navigation
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeEntitySelector();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const firstItem = popup.querySelector('.schema-form__entity-selector-item');
          if (firstItem) firstItem.focus();
        }
      });
    }

    // Entity item clicks
    this.bindEntityItemEvents(popup, propName);
  }

  /**
   * Bind click events for entity items in the list
   * @param {HTMLElement} popup - Popup element
   * @param {string} propName - Property name
   */
  bindEntityItemEvents(popup, propName) {
    popup.querySelectorAll('.schema-form__entity-selector-item').forEach(item => {
      item.addEventListener('click', () => {
        const schemaId = item.dataset.schemaId;
        this.selectEntity(propName, schemaId);
      });

      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const schemaId = item.dataset.schemaId;
          this.selectEntity(propName, schemaId);
        } else if (e.key === 'Escape') {
          this.closeEntitySelector();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = item.nextElementSibling;
          if (next && next.classList.contains('schema-form__entity-selector-item')) {
            next.focus();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = item.previousElementSibling;
          if (prev && prev.classList.contains('schema-form__entity-selector-item')) {
            prev.focus();
          } else {
            const searchInput = popup.querySelector('.schema-form__entity-selector-input');
            if (searchInput) searchInput.focus();
          }
        }
      });
    });
  }

  /**
   * Select an entity and populate the @id input
   * @param {string} propName - Property name
   * @param {string} schemaId - Selected schema ID
   */
  selectEntity(propName, schemaId) {
    console.log(`[SchemaFormBuilder] Selected entity: ${schemaId} for ${propName}`);

    // Find the @id input for this property
    const idInput = this.container.querySelector(`input[name="${propName}__id"]`);
    if (idInput) {
      idInput.value = schemaId;
      // Trigger change event
      idInput.dispatchEvent(new Event('input', { bubbles: true }));
      idInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Update form data
    this.formData[propName] = schemaId;

    // Close popup
    this.closeEntitySelector();
    this.notifyChange();
  }

  /**
   * Close entity selector popup
   */
  closeEntitySelector() {
    if (this.entitySelectorPopup) {
      this.entitySelectorPopup.remove();
      this.entitySelectorPopup = null;
    }
    document.removeEventListener('click', this.handleOutsideClick);
  }

  /**
   * Handle outside click to close popup
   * @param {Event} e - Click event
   */
  handleOutsideClick = (e) => {
    if (this.entitySelectorPopup && !this.entitySelectorPopup.contains(e.target)) {
      // Check if click was on the browse button (it might trigger new popup)
      if (!e.target.closest('.schema-form__browse-btn')) {
        this.closeEntitySelector();
      }
    }
  }

  /**
   * Notify parent of form data change
   */
  notifyChange() {
    this.onChange(this.getData());
  }

  /**
   * Get form data as JSON-LD compatible object
   */
  getData() {
    const data = {
      '@type': this.schemaType
    };

    // Include @id if set (entity's own identifier)
    if (this.formData['@id']) {
      data['@id'] = this.formData['@id'];
    }

    // Collect values from own form
    this.container.querySelectorAll('.schema-form__input:not([disabled])').forEach(input => {
      let name = input.name.replace('__id', '');
      let value = input.type === 'checkbox' ? input.checked : input.value;

      // Skip the entity's own @id input (already handled above)
      if (input.dataset.entityId === 'true') {
        return;
      }

      if (value !== '' && value !== false) {
        // Check if this is an @id reference to another entity
        if (input.name.endsWith('__id')) {
          data[name] = { '@id': value };
        } else if (!input.name.includes('__')) {
          data[name] = value;
        }
      }
    });

    // Collect values from nested forms
    this.nestedForms.forEach((builder, propName) => {
      const nestedData = builder.getData();
      if (Object.keys(nestedData).length > 1) { // More than just @type
        data[propName] = nestedData;
      }
    });

    return data;
  }

  /**
   * Set form data
   * @param {Object} data - Form data object
   */
  async setData(data) {
    this.formData = { ...data };

    if (data['@type'] && data['@type'] !== this.schemaType) {
      await this.loadSchema(data['@type'], data);
    } else {
      this.render(this.currentDepth);
    }
  }

  /**
   * Clear the form
   */
  clear() {
    this.schemaType = null;
    this.schemaDefinition = null;
    this.formData = {};
    this.nestedForms.clear();
    this.container.innerHTML = '<div class="schema-form__empty">Select a schema type to begin.</div>';
  }

  /**
   * Reset the form (alias for clear)
   */
  reset() {
    this.clear();
  }

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   */
  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Format description text with markdown-like rendering
   * Converts:
   * - \n\n to paragraph breaks
   * - [text](url) to clickable links
   * - [[Type]] to clickable links to schema.org type pages
   * - *text* to italic
   * @param {string} description - Raw description text
   * @returns {string} HTML formatted description
   */
  formatDescription(description) {
    if (typeof description !== 'string' || !description) return '';

    // First, escape HTML to prevent XSS
    let html = this.escapeHtml(description);

    // Convert markdown links [text](url) to <a> tags
    // Must be done before escaping breaks the URLs
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="schema-form__link">$1</a>'
    );

    // Convert wiki-style links [[Type]] to clickable links to schema.org
    // e.g., [[URL]] becomes a link to https://schema.org/URL
    html = html.replace(
      /\[\[([^\]]+)\]\]/g,
      '<a href="https://schema.org/$1" target="_blank" rel="noopener noreferrer" class="schema-form__schema-link">$1</a>'
    );

    // Convert *text* to italic (emphasis)
    html = html.replace(
      /\*([^*]+)\*/g,
      '<em>$1</em>'
    );

    // Convert double newlines to paragraph breaks
    html = html.replace(/\\n\\n/g, '</p><p class="schema-form__description-para">');
    html = html.replace(/\n\n/g, '</p><p class="schema-form__description-para">');

    // Convert single newlines to line breaks
    html = html.replace(/\\n/g, '<br>');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if we added paragraph breaks
    if (html.includes('</p><p')) {
      html = '<p class="schema-form__description-para">' + html + '</p>';
    }

    return html;
  }
}

export default SchemaFormBuilder;
