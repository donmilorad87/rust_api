/**
 * SizePicker - Numeric input with unit selector
 * Features:
 * - Number input with min/max/step
 * - Unit selector (rem/px/em)
 * - Visual preview bar
 * - Debounced change callback
 */
export class SizePicker {
  /**
   * @param {Object} config
   * @param {string} config.name - SCSS variable name (e.g., 'font-size-base')
   * @param {string} config.label - Display label
   * @param {number} config.value - Initial numeric value
   * @param {string} config.unit - Unit (rem, px, em)
   * @param {number} config.min - Minimum value
   * @param {number} config.max - Maximum value
   * @param {number} config.step - Step increment
   * @param {Function} config.onChange - Callback(name, value, unit)
   */
  constructor(config) {
    this.name = config.name;
    this.label = config.label;
    this.value = config.value || 1;
    this.unit = config.unit || 'rem';
    this.min = config.min || 0;
    this.max = config.max || 10;
    this.step = config.step || 0.125;
    this.onChange = config.onChange || (() => {});

    this.debounceTimer = null;
    this.debounceDelay = 150;

    this.element = this.createElement();
    this.numberInput = this.element.querySelector('.size-picker__number');
    this.unitSelect = this.element.querySelector('.size-picker__unit');
    this.previewBar = this.element.querySelector('.size-picker__preview-bar');
    this.valueDisplay = this.element.querySelector('.size-picker__value-display');

    this.init();
    this.updatePreview();
  }

  /**
   * Create the component DOM element
   * @returns {HTMLElement}
   */
  createElement() {
    const wrapper = document.createElement('div');
    wrapper.className = 'size-picker';
    wrapper.dataset.name = this.name;

    // Calculate preview percentage
    const percent = this.calculatePercent();

    wrapper.innerHTML = `
      <label class="size-picker__label">${this.label}</label>
      <div class="size-picker__inputs">
        <input type="number"
               class="size-picker__number"
               value="${this.value}"
               min="${this.min}"
               max="${this.max}"
               step="${this.step}">
        <select class="size-picker__unit">
          <option value="rem" ${this.unit === 'rem' ? 'selected' : ''}>rem</option>
          <option value="px" ${this.unit === 'px' ? 'selected' : ''}>px</option>
          <option value="em" ${this.unit === 'em' ? 'selected' : ''}>em</option>
        </select>
      </div>
      <div class="size-picker__preview">
        <div class="size-picker__preview-bar" style="width: ${percent}%"></div>
      </div>
      <span class="size-picker__value-display">${this.value}${this.unit}</span>
    `;

    return wrapper;
  }

  /**
   * Calculate preview bar percentage
   * @returns {number}
   */
  calculatePercent() {
    const range = this.max - this.min;
    if (range === 0) return 50;
    return ((this.value - this.min) / range) * 100;
  }

  /**
   * Initialize event listeners
   */
  init() {
    // Number input change
    this.numberInput.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);

      // Clamp value
      if (isNaN(val)) val = this.min;
      if (val < this.min) val = this.min;
      if (val > this.max) val = this.max;

      this.value = val;
      this.updatePreview();
      this.emitChange();
    });

    // Unit select change
    this.unitSelect.addEventListener('change', (e) => {
      this.unit = e.target.value;
      this.updatePreview();
      this.emitChange();
    });

    // Keyboard arrow increment
    this.numberInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Browser handles this, but we ensure preview updates
        setTimeout(() => {
          this.value = parseFloat(this.numberInput.value);
          this.updatePreview();
          this.emitChange();
        }, 0);
      }
    });
  }

  /**
   * Update the preview bar and value display
   */
  updatePreview() {
    const percent = this.calculatePercent();

    if (this.previewBar) {
      this.previewBar.style.width = `${percent}%`;
    }

    if (this.valueDisplay) {
      this.valueDisplay.textContent = `${this.value}${this.unit}`;
    }
  }

  /**
   * Emit change with debounce
   */
  emitChange() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.onChange(this.name, this.value, this.unit);
    }, this.debounceDelay);
  }

  /**
   * Get current value with unit
   * @returns {string}
   */
  getValue() {
    return `${this.value}${this.unit}`;
  }

  /**
   * Get numeric value
   * @returns {number}
   */
  getNumericValue() {
    return this.value;
  }

  /**
   * Get unit
   * @returns {string}
   */
  getUnit() {
    return this.unit;
  }

  /**
   * Set value programmatically
   * @param {number} value
   * @param {string} unit
   */
  setValue(value, unit) {
    this.value = value;
    if (unit) this.unit = unit;

    this.numberInput.value = this.value;
    this.unitSelect.value = this.unit;
    this.updatePreview();
  }
}

export default SizePicker;
