/**
 * ColorPicker - Color input component with hex text sync
 * Features:
 * - Native color picker input
 * - Hex text input with validation
 * - Synchronized state between color and text inputs
 * - Debounced change callback
 */
export class ColorPicker {
  /**
   * @param {Object} config
   * @param {string} config.name - CSS property name (e.g., '--bg-gradient-start')
   * @param {string} config.label - Display label
   * @param {string} config.value - Initial hex color value
   * @param {string} config.themeType - 'light', 'dark', or 'scss'
   * @param {Function} config.onChange - Callback(name, value)
   */
  constructor(config) {
    this.name = config.name;
    this.label = config.label;
    this.value = this.normalizeColor(config.value);
    this.themeType = config.themeType || 'light';
    this.onChange = config.onChange || (() => {});

    this.debounceTimer = null;
    this.debounceDelay = 100;

    this.element = this.createElement();
    this.colorInput = this.element.querySelector('.color-picker__color');
    this.textInput = this.element.querySelector('.color-picker__text');

    this.init();
  }

  /**
   * Normalize color value to hex format
   * @param {string} color
   * @returns {string}
   */
  normalizeColor(color) {
    if (!color) return '#000000';

    // If it's already a valid hex
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return color.toLowerCase();
    }

    // Handle 3-digit hex
    if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
      const r = color[1];
      const g = color[2];
      const b = color[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }

    // Handle rgb/rgba
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }

    return '#000000';
  }

  /**
   * Create the component DOM element
   * @returns {HTMLElement}
   */
  createElement() {
    const wrapper = document.createElement('div');
    wrapper.className = 'color-picker';
    wrapper.dataset.name = this.name;

    wrapper.innerHTML = `
      <label class="color-picker__label">${this.label}</label>
      <div class="color-picker__inputs">
        <input type="color" class="color-picker__color" value="${this.value}">
        <input type="text" class="color-picker__text" value="${this.value}" maxlength="7" pattern="^#[0-9A-Fa-f]{6}$">
      </div>
      <span class="color-picker__preview" style="background-color: ${this.value}"></span>
    `;

    return wrapper;
  }

  /**
   * Initialize event listeners
   */
  init() {
    // Color picker change
    this.colorInput.addEventListener('input', (e) => {
      this.value = e.target.value;
      this.textInput.value = this.value;
      this.updatePreview();
      this.emitChange();
    });

    // Text input change
    this.textInput.addEventListener('input', (e) => {
      let val = e.target.value;

      // Auto-add # prefix
      if (val && !val.startsWith('#')) {
        val = '#' + val;
        e.target.value = val;
      }

      // Validate hex format
      if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
        this.value = val.toLowerCase();
        this.colorInput.value = this.value;
        this.updatePreview();
        this.emitChange();
        this.textInput.classList.remove('invalid');
      } else {
        this.textInput.classList.add('invalid');
      }
    });

    // On blur, reset invalid input to last valid value
    this.textInput.addEventListener('blur', () => {
      if (this.textInput.classList.contains('invalid')) {
        this.textInput.value = this.value;
        this.textInput.classList.remove('invalid');
      }
    });
  }

  /**
   * Update the preview swatch
   */
  updatePreview() {
    const preview = this.element.querySelector('.color-picker__preview');
    if (preview) {
      preview.style.backgroundColor = this.value;
    }
  }

  /**
   * Emit change with debounce
   */
  emitChange() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.onChange(this.name, this.value);
    }, this.debounceDelay);
  }

  /**
   * Get current value
   * @returns {string}
   */
  getValue() {
    return this.value;
  }

  /**
   * Set value programmatically
   * @param {string} color
   */
  setValue(color) {
    this.value = this.normalizeColor(color);
    this.colorInput.value = this.value;
    this.textInput.value = this.value;
    this.updatePreview();
  }
}

export default ColorPicker;
