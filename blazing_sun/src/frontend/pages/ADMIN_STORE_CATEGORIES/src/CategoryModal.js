import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * CategoryModal
 *
 * Modal for creating and editing store categories.
 */
export class CategoryModal {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   * @param {Function} options.onSave - Callback after successful save
   * @param {Function} options.onImageSelect - Callback to open image picker
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;
    this.onSave = options.onSave;
    this.onImageSelect = options.onImageSelect;

    // State
    this.category = null; // null = create mode, object = edit mode
    this.selectedImageUuid = null;
    this.saving = false;

    // Create modal DOM
    this.createModal();
    this.bindEvents();
  }

  /**
   * Create modal DOM structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'modal';
    this.modal.id = 'categoryModal';
    this.modal.setAttribute('aria-hidden', 'true');

    this.modal.innerHTML = `
      <div class="modal__backdrop" data-action="close"></div>
      <div class="modal__dialog" role="dialog" aria-modal="true" aria-labelledby="categoryModalTitle">
        <header class="modal__header">
          <h2 id="categoryModalTitle" class="modal__title">Create Category</h2>
          <button type="button" class="modal__close" data-action="close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        <form id="categoryForm" class="modal__body">
          <div class="form-group">
            <label class="form-label" for="categoryName">Name <span style="color: var(--color-error)">*</span></label>
            <input type="text" id="categoryName" class="form-input" required maxlength="100" placeholder="Enter category name">
            <span class="form-error" id="categoryNameError"></span>
          </div>

          <div class="form-group">
            <label class="form-label" for="categorySlug">Slug</label>
            <input type="text" id="categorySlug" class="form-input" maxlength="100" placeholder="auto-generated-from-name">
            <span class="form-hint">Leave empty to auto-generate from name</span>
            <span class="form-error" id="categorySlugError"></span>
          </div>

          <div class="form-group">
            <label class="form-label" for="categoryDescription">Description</label>
            <textarea id="categoryDescription" class="form-textarea" rows="3" maxlength="500" placeholder="Enter category description (optional)"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label">Cover Image</label>
            <div class="image-selector" id="coverImageSelector">
              <div class="image-selector__preview" id="coverImagePreview">
                <img src="" alt="Cover preview" class="image-selector__image" id="coverImage" style="display: none;">
                <div class="image-selector__placeholder" id="coverPlaceholder">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <span>No image</span>
                </div>
                <button type="button" class="image-selector__remove" id="removeCoverBtn" style="display: none;" aria-label="Remove image">
                  &times;
                </button>
              </div>
              <div class="image-selector__actions">
                <button type="button" class="image-selector__btn" id="selectCoverBtn">Browse Images</button>
              </div>
            </div>
            <input type="hidden" id="coverImageUuid" name="cover_image_uuid">
          </div>

          <div class="form-group">
            <label class="form-checkbox">
              <input type="checkbox" id="categoryActive" class="form-checkbox__input" checked>
              <span class="form-checkbox__label">Active</span>
            </label>
            <span class="form-hint">Inactive categories won't be visible in the store</span>
          </div>
        </form>
        <footer class="modal__footer">
          <button type="button" class="btn btn--ghost" data-action="close">Cancel</button>
          <button type="button" class="btn btn--primary" id="saveCategoryBtn">
            <span id="saveBtnText">Create Category</span>
            <span id="saveBtnSpinner" style="display: none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
            </span>
          </button>
        </footer>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Cache elements
    this.form = document.getElementById('categoryForm');
    this.titleEl = document.getElementById('categoryModalTitle');
    this.nameInput = document.getElementById('categoryName');
    this.slugInput = document.getElementById('categorySlug');
    this.descriptionInput = document.getElementById('categoryDescription');
    this.activeCheckbox = document.getElementById('categoryActive');
    this.coverImageUuidInput = document.getElementById('coverImageUuid');
    this.coverImage = document.getElementById('coverImage');
    this.coverPlaceholder = document.getElementById('coverPlaceholder');
    this.removeCoverBtn = document.getElementById('removeCoverBtn');
    this.saveBtn = document.getElementById('saveCategoryBtn');
    this.saveBtnText = document.getElementById('saveBtnText');
    this.saveBtnSpinner = document.getElementById('saveBtnSpinner');
    this.nameError = document.getElementById('categoryNameError');
    this.slugError = document.getElementById('categorySlugError');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Close modal
    this.modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('modal--visible')) {
        this.close();
      }
    });

    // Auto-generate slug from name
    this.nameInput.addEventListener('input', () => {
      if (!this.category && !this.slugInput.value) {
        // Only auto-generate for new categories if slug is empty
        this.slugInput.placeholder = this.generateSlug(this.nameInput.value) || 'auto-generated-from-name';
      }
    });

    // Select cover image
    document.getElementById('selectCoverBtn').addEventListener('click', () => {
      if (typeof this.onImageSelect === 'function') {
        this.onImageSelect((uuid, url) => {
          this.setSelectedImage(uuid, url);
        });
      }
    });

    // Remove cover image
    this.removeCoverBtn.addEventListener('click', () => {
      this.clearSelectedImage();
    });

    // Save button
    this.saveBtn.addEventListener('click', () => {
      this.save();
    });

    // Form submission
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });
  }

  /**
   * Open the modal
   * @param {Object|null} category - Category to edit, or null for create
   */
  open(category = null) {
    this.category = category;
    this.resetForm();

    if (category) {
      // Edit mode
      this.titleEl.textContent = 'Edit Category';
      this.saveBtnText.textContent = 'Update Category';
      this.nameInput.value = category.name || '';
      this.slugInput.value = category.slug || '';
      this.descriptionInput.value = category.description || '';
      this.activeCheckbox.checked = category.is_active !== false;

      if (category.cover_image_uuid && category.cover_image_url) {
        this.setSelectedImage(category.cover_image_uuid, category.cover_image_url);
      }
    } else {
      // Create mode
      this.titleEl.textContent = 'Create Category';
      this.saveBtnText.textContent = 'Create Category';
    }

    this.modal.classList.add('modal--visible');
    this.modal.setAttribute('aria-hidden', 'false');
    this.nameInput.focus();
  }

  /**
   * Close the modal
   */
  close() {
    this.modal.classList.remove('modal--visible');
    this.modal.setAttribute('aria-hidden', 'true');
    this.category = null;
  }

  /**
   * Reset form to default state
   */
  resetForm() {
    this.form.reset();
    this.clearSelectedImage();
    this.clearErrors();
    this.activeCheckbox.checked = true;
    this.slugInput.placeholder = 'auto-generated-from-name';
  }

  /**
   * Set selected cover image
   * @param {string} uuid
   * @param {string} url
   */
  setSelectedImage(uuid, url) {
    this.selectedImageUuid = uuid;
    this.coverImageUuidInput.value = uuid;
    this.coverImage.src = url + '?variant=thumb';
    this.coverImage.style.display = 'block';
    this.coverPlaceholder.style.display = 'none';
    this.removeCoverBtn.style.display = 'flex';
    this.modal.querySelector('.image-selector__preview').classList.add('image-selector__preview--has-image');
  }

  /**
   * Clear selected cover image
   */
  clearSelectedImage() {
    this.selectedImageUuid = null;
    this.coverImageUuidInput.value = '';
    this.coverImage.src = '';
    this.coverImage.style.display = 'none';
    this.coverPlaceholder.style.display = 'flex';
    this.removeCoverBtn.style.display = 'none';
    this.modal.querySelector('.image-selector__preview').classList.remove('image-selector__preview--has-image');
  }

  /**
   * Clear validation errors
   */
  clearErrors() {
    this.nameError.textContent = '';
    this.slugError.textContent = '';
    this.nameInput.classList.remove('form-input--error');
    this.slugInput.classList.remove('form-input--error');
  }

  /**
   * Show validation error
   * @param {string} field
   * @param {string} message
   */
  showError(field, message) {
    if (field === 'name') {
      this.nameError.textContent = message;
      this.nameInput.classList.add('form-input--error');
    } else if (field === 'slug') {
      this.slugError.textContent = message;
      this.slugInput.classList.add('form-input--error');
    }
  }

  /**
   * Generate slug from text
   * @param {string} text
   * @returns {string}
   */
  generateSlug(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Validate form
   * @returns {boolean}
   */
  validate() {
    this.clearErrors();
    let valid = true;

    const name = this.nameInput.value.trim();
    if (!name) {
      this.showError('name', 'Name is required');
      valid = false;
    } else if (name.length < 2) {
      this.showError('name', 'Name must be at least 2 characters');
      valid = false;
    }

    const slug = this.slugInput.value.trim();
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      this.showError('slug', 'Slug must contain only lowercase letters, numbers, and hyphens');
      valid = false;
    }

    return valid;
  }

  /**
   * Save the category
   */
  async save() {
    if (this.saving) return;

    if (!this.validate()) return;

    this.saving = true;
    this.saveBtn.disabled = true;
    this.saveBtnText.style.display = 'none';
    this.saveBtnSpinner.style.display = 'inline-flex';

    try {
      const payload = {
        name: this.nameInput.value.trim(),
        slug: this.slugInput.value.trim() || null,
        description: this.descriptionInput.value.trim() || null,
        cover_image_uuid: this.selectedImageUuid || null,
        is_active: this.activeCheckbox.checked
      };

      const url = this.category
        ? `${this.baseUrl}/api/v1/admin/store/categories/${this.category.id}`
        : `${this.baseUrl}/api/v1/admin/store/categories`;

      const method = this.category ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          ...getCsrfHeaders(),
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors from server
        if (data.errors) {
          if (data.errors.name) {
            this.showError('name', data.errors.name);
          }
          if (data.errors.slug) {
            this.showError('slug', data.errors.slug);
          }
          return;
        }
        throw new Error(data.message || 'Failed to save category');
      }

      if (data.status === 'success') {
        this.showToast(
          this.category ? 'Category updated successfully' : 'Category created successfully',
          'success'
        );
        this.close();
        if (typeof this.onSave === 'function') {
          this.onSave();
        }
      } else {
        throw new Error(data.message || 'Failed to save category');
      }
    } catch (error) {
      console.error('Error saving category:', error);
      this.showToast(error.message || 'Failed to save category', 'error');
    } finally {
      this.saving = false;
      this.saveBtn.disabled = false;
      this.saveBtnText.style.display = 'inline';
      this.saveBtnSpinner.style.display = 'none';
    }
  }
}
