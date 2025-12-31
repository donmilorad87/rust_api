/**
 * ImageSelector - Component for selecting logo/favicon from uploads
 * Features:
 * - Preview current selection
 * - Open modal to select from existing uploads
 * - Upload new image
 * - Remove selection
 */
export class ImageSelector {
  /**
   * @param {Object} config
   * @param {string} config.name - Identifier ('logo' or 'favicon')
   * @param {string} config.label - Display label
   * @param {string|null} config.currentUuid - Currently selected UUID
   * @param {HTMLElement} config.previewElement - Image preview element
   * @param {HTMLElement} config.placeholderElement - Placeholder element
   * @param {HTMLElement} config.selectButton - Select button element
   * @param {HTMLElement} config.removeButton - Remove button element
   * @param {Function} config.onSelect - Callback(uuid) when image selected
   * @param {Function} config.onRemove - Callback() when image removed
   * @param {Function} config.openModal - Function to open selection modal
   */
  constructor(config) {
    this.name = config.name;
    this.label = config.label;
    this.currentUuid = config.currentUuid || null;
    this.previewElement = config.previewElement;
    this.placeholderElement = config.placeholderElement;
    this.selectButton = config.selectButton;
    this.removeButton = config.removeButton;
    this.onSelect = config.onSelect || (() => {});
    this.onRemove = config.onRemove || (() => {});
    this.openModal = config.openModal || (() => {});

    this.init();
    this.updateDisplay();
  }

  /**
   * Initialize event listeners
   */
  init() {
    if (this.selectButton) {
      this.selectButton.addEventListener('click', () => {
        this.openModal(this.name);
      });
    }

    if (this.removeButton) {
      this.removeButton.addEventListener('click', () => {
        this.remove();
      });
    }
  }

  /**
   * Update the display based on current selection
   */
  updateDisplay() {
    if (this.currentUuid) {
      // Show preview
      if (this.previewElement) {
        this.previewElement.src = `/api/v1/upload/download/public/${this.currentUuid}`;
        this.previewElement.classList.remove('hidden');
      }
      if (this.placeholderElement) {
        this.placeholderElement.classList.add('hidden');
      }
      if (this.removeButton) {
        this.removeButton.classList.remove('hidden');
      }
    } else {
      // Show placeholder
      if (this.previewElement) {
        this.previewElement.classList.add('hidden');
      }
      if (this.placeholderElement) {
        this.placeholderElement.classList.remove('hidden');
      }
      if (this.removeButton) {
        this.removeButton.classList.add('hidden');
      }
    }
  }

  /**
   * Set selected image
   * @param {string} uuid
   */
  select(uuid) {
    this.currentUuid = uuid;
    this.updateDisplay();
    this.onSelect(uuid);
  }

  /**
   * Remove current selection
   */
  remove() {
    this.currentUuid = null;
    this.updateDisplay();
    this.onRemove();
  }

  /**
   * Get current UUID
   * @returns {string|null}
   */
  getUuid() {
    return this.currentUuid;
  }

  /**
   * Set UUID programmatically (without triggering callback)
   * @param {string|null} uuid
   */
  setUuid(uuid) {
    this.currentUuid = uuid;
    this.updateDisplay();
  }
}

export default ImageSelector;
