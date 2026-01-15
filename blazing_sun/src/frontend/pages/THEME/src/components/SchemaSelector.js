/**
 * SchemaSelector - Hierarchical Schema.org type selector using API
 *
 * Provides progressive selection: Category -> Subcategory -> ... -> Leaf
 * Fetches schema hierarchy from backend API.
 */
export class SchemaSelector {
  /**
   * @param {Object} config - Configuration object
   * @param {HTMLElement} config.container - Container element for the selector
   * @param {string} config.baseUrl - API base URL
   * @param {Function} config.onSelect - Callback when a schema type is selected
   * @param {Function} config.onPathChange - Callback when path changes
   * @param {Object} config.csrfHeaders - CSRF headers for API calls
   */
  constructor(config) {
    this.container = config.container;
    this.baseUrl = config.baseUrl || '';
    this.onSelect = config.onSelect || (() => {});
    this.onPathChange = config.onPathChange || (() => {});
    this.csrfHeaders = config.csrfHeaders || {};

    // State
    this.path = []; // Array of { type, label, hasChildren }
    this.currentChildren = [];
    this.isLoading = false;
    this.selectedType = null;

    // Cache for children responses
    this.childrenCache = new Map();

    // Initialize
    this.render();
  }

  /**
   * Fetch schema categories (top-level types under Thing)
   */
  async fetchCategories() {
    try {
      this.isLoading = true;
      this.renderLoading();

      const response = await fetch(`${this.baseUrl}/api/v1/schemas/categories`, {
        headers: {
          'Accept': 'application/json',
          ...this.csrfHeaders
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch schema categories');
      }

      const data = await response.json();
      if (data.status === 'success' && data.categories) {
        this.currentChildren = data.categories.map(cat => ({
          type: cat.type,
          label: cat.label,
          description: cat.description,
          hasChildren: cat.has_children
        }));
      }
    } catch (error) {
      console.error('Error fetching schema categories:', error);
      this.currentChildren = [];
    } finally {
      this.isLoading = false;
      this.renderDropdown();
    }
  }

  /**
   * Fetch children of a schema type
   * @param {string} typeName - Parent type name
   */
  async fetchChildren(typeName) {
    // Check cache first
    if (this.childrenCache.has(typeName)) {
      return this.childrenCache.get(typeName);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/schemas/children/${encodeURIComponent(typeName)}`, {
        headers: {
          'Accept': 'application/json',
          ...this.csrfHeaders
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch children for ${typeName}`);
      }

      const data = await response.json();
      if (data.status === 'success' && data.children) {
        const children = data.children.map(child => ({
          type: child.type,
          label: child.label,
          description: child.description,
          hasChildren: child.has_children
        }));
        this.childrenCache.set(typeName, children);
        return children;
      }
    } catch (error) {
      console.error(`Error fetching children for ${typeName}:`, error);
    }
    return [];
  }

  /**
   * Navigate to a schema type
   * @param {Object} item - Schema type item { type, label, hasChildren }
   */
  async navigateTo(item) {
    this.path.push({
      type: item.type,
      label: item.label,
      hasChildren: item.hasChildren
    });

    this.selectedType = item.type;
    this.onPathChange(this.path);

    if (item.hasChildren) {
      this.isLoading = true;
      this.renderLoading();
      this.currentChildren = await this.fetchChildren(item.type);
      this.isLoading = false;
      this.renderDropdown();
    } else {
      // Leaf node - no more children
      this.currentChildren = [];
      this.renderDropdown();
    }

    // Always notify selection
    this.onSelect(item.type, this.path);
  }

  /**
   * Navigate back to a specific level in the path
   * @param {number} index - Path index to navigate to (-1 for root)
   */
  async navigateToLevel(index) {
    if (index < 0) {
      // Go back to root (categories)
      this.path = [];
      this.selectedType = null;
      this.onPathChange(this.path);
      this.onSelect(null, this.path);
      await this.fetchCategories();
      return;
    }

    // Truncate path to index + 1
    this.path = this.path.slice(0, index + 1);
    const currentItem = this.path[index];
    this.selectedType = currentItem.type;
    this.onPathChange(this.path);
    this.onSelect(currentItem.type, this.path);

    if (currentItem.hasChildren) {
      this.isLoading = true;
      this.renderLoading();
      this.currentChildren = await this.fetchChildren(currentItem.type);
      this.isLoading = false;
      this.renderDropdown();
    } else {
      this.currentChildren = [];
      this.renderDropdown();
    }
  }

  /**
   * Reset selector to initial state
   */
  async reset() {
    this.path = [];
    this.selectedType = null;
    this.currentChildren = [];
    this.onPathChange(this.path);
    this.onSelect(null, this.path);
    await this.fetchCategories();
  }

  /**
   * Set the selector to a specific type (for editing)
   * @param {string} typeName - Type name to select
   * @param {Array<string>} pathArray - Full path array
   */
  async setSelection(typeName, pathArray = []) {
    // Build path from array
    this.path = [];
    for (let i = 0; i < pathArray.length; i++) {
      const type = pathArray[i];
      const children = i === 0
        ? await this.fetchCategories().then(() => this.currentChildren)
        : await this.fetchChildren(pathArray[i - 1]);

      const item = children?.find(c => c.type === type);
      if (item) {
        this.path.push({
          type: item.type,
          label: item.label,
          hasChildren: item.hasChildren
        });
      }
    }

    this.selectedType = typeName;

    // Load children of current selection
    const lastItem = this.path[this.path.length - 1];
    if (lastItem?.hasChildren) {
      this.currentChildren = await this.fetchChildren(lastItem.type);
    } else {
      this.currentChildren = [];
    }

    this.renderDropdown();
    this.onPathChange(this.path);
  }

  /**
   * Render the component
   */
  render() {
    this.container.innerHTML = `
      <div class="schema-selector">
        <div class="schema-selector__breadcrumb"></div>
        <div class="schema-selector__dropdown-container">
          <select class="schema-selector__dropdown form-select" aria-label="Select schema type">
            <option value="">Select a category...</option>
          </select>
        </div>
        <div class="schema-selector__description"></div>
      </div>
    `;

    this.breadcrumbEl = this.container.querySelector('.schema-selector__breadcrumb');
    this.dropdownEl = this.container.querySelector('.schema-selector__dropdown');
    this.descriptionEl = this.container.querySelector('.schema-selector__description');

    // Event listeners
    this.dropdownEl.addEventListener('change', (e) => this.handleDropdownChange(e));

    // Initial load
    this.fetchCategories();
  }

  /**
   * Render loading state
   */
  renderLoading() {
    this.dropdownEl.innerHTML = '<option value="">Loading...</option>';
    this.dropdownEl.disabled = true;
  }

  /**
   * Render breadcrumb navigation
   */
  renderBreadcrumb() {
    if (this.path.length === 0) {
      this.breadcrumbEl.innerHTML = '';
      return;
    }

    const items = this.path.map((item, index) => {
      const isLast = index === this.path.length - 1;
      return `
        <span class="schema-selector__breadcrumb-item ${isLast ? 'schema-selector__breadcrumb-item--active' : ''}"
              data-index="${index}"
              ${!isLast ? 'role="button" tabindex="0"' : ''}>
          ${item.label}
        </span>
      `;
    }).join('<span class="schema-selector__breadcrumb-separator">/</span>');

    this.breadcrumbEl.innerHTML = `
      <span class="schema-selector__breadcrumb-item schema-selector__breadcrumb-item--root"
            role="button" tabindex="0" data-index="-1">
        Thing
      </span>
      <span class="schema-selector__breadcrumb-separator">/</span>
      ${items}
    `;

    // Add click handlers for breadcrumb items
    this.breadcrumbEl.querySelectorAll('[role="button"]').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.dataset.index, 10);
        this.navigateToLevel(index);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const index = parseInt(el.dataset.index, 10);
          this.navigateToLevel(index);
        }
      });
    });
  }

  /**
   * Render the dropdown with current children
   */
  renderDropdown() {
    this.renderBreadcrumb();
    this.dropdownEl.disabled = false;

    if (this.currentChildren.length === 0) {
      if (this.path.length > 0) {
        // Leaf node selected
        this.dropdownEl.innerHTML = '<option value="">No subtypes available</option>';
        const lastItem = this.path[this.path.length - 1];
        this.descriptionEl.innerHTML = `
          <div class="schema-selector__selected">
            <strong>Selected:</strong> ${lastItem.label}
            <span class="schema-selector__use-btn" role="button" tabindex="0">Use this schema</span>
          </div>
        `;

        // Add click handler for use button
        const useBtn = this.descriptionEl.querySelector('.schema-selector__use-btn');
        if (useBtn) {
          useBtn.addEventListener('click', () => {
            this.onSelect(lastItem.type, this.path, true); // true = confirmed selection
          });
        }
      } else {
        this.dropdownEl.innerHTML = '<option value="">Select a category...</option>';
        this.descriptionEl.innerHTML = '';
      }
      return;
    }

    // Build dropdown options
    const placeholder = this.path.length === 0
      ? 'Select a category...'
      : 'Select a subtype...';

    const options = this.currentChildren.map(child => {
      const hasChildrenIndicator = child.hasChildren ? ' >' : '';
      return `<option value="${child.type}" data-description="${this.escapeHtml(child.description || '')}" data-has-children="${child.hasChildren}">${child.label}${hasChildrenIndicator}</option>`;
    });

    this.dropdownEl.innerHTML = `
      <option value="">${placeholder}</option>
      ${options.join('')}
    `;

    // Show description of current selection
    if (this.path.length > 0) {
      const lastItem = this.path[this.path.length - 1];
      this.descriptionEl.innerHTML = `
        <div class="schema-selector__selected">
          <strong>Current:</strong> ${lastItem.label}
          <span class="schema-selector__use-btn" role="button" tabindex="0">Use this schema</span>
        </div>
      `;

      const useBtn = this.descriptionEl.querySelector('.schema-selector__use-btn');
      if (useBtn) {
        useBtn.addEventListener('click', () => {
          this.onSelect(lastItem.type, this.path, true);
        });
      }
    } else {
      this.descriptionEl.innerHTML = '';
    }
  }

  /**
   * Handle dropdown selection change
   * @param {Event} e - Change event
   */
  handleDropdownChange(e) {
    const selectedValue = e.target.value;
    if (!selectedValue) return;

    const selectedOption = e.target.querySelector(`option[value="${selectedValue}"]`);
    const description = selectedOption?.dataset.description || '';
    const hasChildren = selectedOption?.dataset.hasChildren === 'true';

    const item = this.currentChildren.find(c => c.type === selectedValue);
    if (item) {
      this.navigateTo(item);
    }
  }

  /**
   * Escape HTML special characters
   * @param {string} str - String to escape
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Get the current selection
   * @returns {Object} Current selection { type, path }
   */
  getSelection() {
    return {
      type: this.selectedType,
      path: this.path.map(p => p.type)
    };
  }
}

export default SchemaSelector;
