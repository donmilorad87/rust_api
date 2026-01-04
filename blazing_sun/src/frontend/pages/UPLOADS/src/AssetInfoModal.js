import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * AssetInfoModal Component
 *
 * Modal dialog for editing asset title and description.
 * Title is used for aria-title attribute.
 * Description is used for alt attribute.
 */

export class AssetInfoModal {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   * @param {Function} options.onSave - Callback when metadata is saved
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;
    this.onSave = options.onSave;

    this.modal = null;
    this.currentUpload = null;

    this.createModal();
  }

  /**
   * Create the modal structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'modal';
    this.modal.id = 'assetInfoModal';
    this.modal.style.display = 'none';

    this.modal.innerHTML = `
      <div class="modal__overlay"></div>
      <div class="modal__content">
        <div class="modal__header">
          <h2 class="modal__title">Asset Information</h2>
          <button class="modal__close" type="button" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal__body">
          <form id="assetInfoForm" class="asset-info-form">
            <div class="form-group">
              <label for="assetTitle" class="form-label">
                Title
                <span class="form-hint">(Used for aria-title attribute)</span>
              </label>
              <input
                type="text"
                id="assetTitle"
                name="title"
                class="form-input"
                maxlength="255"
                placeholder="Enter asset title"
              >
              <small class="form-help">Leave empty to use filename</small>
            </div>

            <div class="form-group">
              <label for="assetDescription" class="form-label">
                Description
                <span class="form-hint">(Used for alt attribute)</span>
              </label>
              <textarea
                id="assetDescription"
                name="description"
                class="form-textarea"
                rows="4"
                maxlength="500"
                placeholder="Enter asset description"
              ></textarea>
              <small class="form-help">Describe what this asset shows or represents</small>
            </div>

            <div class="form-group">
              <label class="form-label">
                Storage Type
              </label>
              <div class="toggle-group">
                <label class="toggle-option">
                  <input type="radio" name="storageType" value="public" id="storagePublic">
                  <span class="toggle-option__label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 6v6l4 2"></path>
                    </svg>
                    Public
                  </span>
                  <small class="toggle-option__hint">Accessible via direct URL</small>
                </label>
                <label class="toggle-option">
                  <input type="radio" name="storageType" value="private" id="storagePrivate">
                  <span class="toggle-option__label">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Private
                  </span>
                  <small class="toggle-option__hint">Requires authentication</small>
                </label>
              </div>
            </div>

            <div class="asset-info-form__preview">
              <strong>File:</strong> <span id="assetFileName"></span>
            </div>
            <div class="asset-info-form__preview">
              <strong>Type:</strong> <span id="assetFileType"></span>
            </div>
            <div class="asset-info-form__preview">
              <strong>UUID:</strong> <span id="assetUUID"></span>
            </div>
          </form>
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--secondary modal__cancel">Cancel</button>
          <button type="submit" form="assetInfoForm" class="btn btn--primary">
            Save Changes
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);
    this.bindEvents();
  }

  /**
   * Bind modal events
   */
  bindEvents() {
    const overlay = this.modal.querySelector('.modal__overlay');
    const closeBtn = this.modal.querySelector('.modal__close');
    const cancelBtn = this.modal.querySelector('.modal__cancel');
    const form = this.modal.querySelector('#assetInfoForm');

    // Close modal on overlay click
    overlay.addEventListener('click', () => this.close());

    // Close modal on close button click
    closeBtn.addEventListener('click', () => this.close());

    // Close modal on cancel button click
    cancelBtn.addEventListener('click', () => this.close());

    // Handle form submission
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.style.display === 'flex') {
        this.close();
      }
    });
  }

  /**
   * Open modal with upload data
   * @param {Object} upload - Upload data
   */
  open(upload) {
    this.currentUpload = upload;

    // Populate form fields
    document.getElementById('assetTitle').value = upload.title || '';
    document.getElementById('assetDescription').value = upload.description || '';
    document.getElementById('assetFileName').textContent = upload.original_name;
    document.getElementById('assetFileType').textContent = upload.mime_type;
    document.getElementById('assetUUID').textContent = upload.uuid;

    // Set storage type radio button
    if (upload.storage_type === 'public') {
      document.getElementById('storagePublic').checked = true;
    } else {
      document.getElementById('storagePrivate').checked = true;
    }

    // Show modal
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scroll

    // Focus title input
    setTimeout(() => {
      document.getElementById('assetTitle').focus();
    }, 100);
  }

  /**
   * Close modal
   */
  close() {
    this.modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scroll
    this.currentUpload = null;

    // Clear form
    document.getElementById('assetInfoForm').reset();
  }

  /**
   * Save metadata changes
   */
  async save() {
    if (!this.currentUpload) return;

    const title = document.getElementById('assetTitle').value.trim();
    const description = document.getElementById('assetDescription').value.trim();
    const storageType = document.querySelector('input[name="storageType"]:checked').value;

    const payload = {
      title: title || null,
      description: description || null,
      storage_type: storageType
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/admin/uploads/${this.currentUpload.uuid}/metadata`,
        {
          method: 'PATCH',
          headers: getCsrfHeaders(),
          credentials: 'include',
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update asset metadata');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Asset metadata updated successfully', 'success');
        this.close();

        // Call onSave callback to refresh the list
        if (this.onSave) {
          this.onSave();
        }
      } else {
        throw new Error(data.message || 'Failed to update asset metadata');
      }
    } catch (error) {
      console.error('Error updating asset metadata:', error);
      this.showToast(error.message || 'Failed to update asset metadata', 'error');
    }
  }

  /**
   * Destroy modal and remove from DOM
   */
  destroy() {
    if (this.modal && this.modal.parentElement) {
      this.modal.parentElement.removeChild(this.modal);
    }
    this.modal = null;
    this.currentUpload = null;
  }
}
