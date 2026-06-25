import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * ImagePickerModal
 *
 * Modal for selecting an image from uploads or uploading a new one.
 */
export class ImagePickerModal {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;

    // State
    this.images = [];
    this.selectedUuid = null;
    this.selectedUrl = null;
    this.onSelect = null;
    this.loading = false;
    this.uploading = false;

    // Create modal DOM
    this.createModal();
    this.bindEvents();
  }

  /**
   * Create modal DOM structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'image-picker-modal modal';
    this.modal.id = 'imagePickerModal';
    this.modal.setAttribute('aria-hidden', 'true');

    this.modal.innerHTML = `
      <div class="modal__backdrop" data-action="close"></div>
      <div class="image-picker-modal__dialog modal__dialog" role="dialog" aria-modal="true" aria-labelledby="imagePickerTitle">
        <header class="modal__header">
          <h2 id="imagePickerTitle" class="modal__title">Select Image</h2>
          <button type="button" class="modal__close" data-action="close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        <div class="modal__body">
          <div id="imagePickerContent" class="image-picker-modal__grid">
            <!-- Images will be loaded here -->
          </div>
        </div>
        <footer class="modal__footer">
          <button type="button" class="btn btn--ghost" data-action="close">Cancel</button>
          <button type="button" class="btn btn--primary" id="selectImageBtn" disabled>Select Image</button>
        </footer>
      </div>
      <input type="file" id="imagePickerUpload" accept="image/*" style="display: none;">
    `;

    document.body.appendChild(this.modal);

    // Cache elements
    this.contentEl = document.getElementById('imagePickerContent');
    this.selectBtn = document.getElementById('selectImageBtn');
    this.fileInput = document.getElementById('imagePickerUpload');
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

    // Image selection
    this.contentEl.addEventListener('click', (e) => {
      const item = e.target.closest('.image-picker-modal__item');
      if (item) {
        if (item.classList.contains('image-picker-modal__upload')) {
          this.fileInput.click();
        } else {
          this.selectImage(item);
        }
      }
    });

    // Select button
    this.selectBtn.addEventListener('click', () => {
      this.confirmSelection();
    });

    // File upload
    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.uploadImage(e.target.files[0]);
      }
    });
  }

  /**
   * Open the modal
   * @param {Function} onSelect - Callback when image is selected (uuid, url)
   */
  open(onSelect) {
    this.onSelect = onSelect;
    this.selectedUuid = null;
    this.selectedUrl = null;
    this.selectBtn.disabled = true;

    this.modal.classList.add('modal--visible');
    this.modal.setAttribute('aria-hidden', 'false');

    this.loadImages();
  }

  /**
   * Close the modal
   */
  close() {
    this.modal.classList.remove('modal--visible');
    this.modal.setAttribute('aria-hidden', 'true');
    this.onSelect = null;
  }

  /**
   * Load images from API
   */
  async loadImages() {
    this.loading = true;
    this.contentEl.innerHTML = `
      <div class="image-picker-modal__loading">
        <div class="loading-state__spinner"></div>
        <span>Loading images...</span>
      </div>
    `;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/uploads?storage_type=public&limit=50`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load images');
      }

      const data = await response.json();

      if (data.status === 'success') {
        // Filter to only images
        this.images = (data.uploads || []).filter(u =>
          u.mime_type && u.mime_type.startsWith('image/')
        );
        this.renderImages();
      } else {
        throw new Error(data.message || 'Failed to load images');
      }
    } catch (error) {
      console.error('Error loading images:', error);
      this.contentEl.innerHTML = `
        <div class="image-picker-modal__empty">
          <p>Failed to load images</p>
          <button class="btn btn--ghost" onclick="this.closest('.image-picker-modal').querySelector('.modal__close').click()">Close</button>
        </div>
      `;
    } finally {
      this.loading = false;
    }
  }

  /**
   * Render the images grid
   */
  renderImages() {
    if (this.images.length === 0) {
      this.contentEl.innerHTML = `
        <div class="image-picker-modal__item image-picker-modal__upload">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Upload Image</span>
        </div>
        <div class="image-picker-modal__empty" style="grid-column: span 3;">
          <p>No images available</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="image-picker-modal__item image-picker-modal__upload">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>Upload</span>
      </div>
    `;

    this.images.forEach(image => {
      const url = `${this.baseUrl}/api/v1/upload/download/public/${image.uuid}`;
      const isSelected = this.selectedUuid === image.uuid;
      html += `
        <div class="image-picker-modal__item ${isSelected ? 'image-picker-modal__item--selected' : ''}"
             data-uuid="${image.uuid}"
             data-url="${url}">
          <img src="${url}?variant=thumb" alt="${image.original_name || 'Image'}" loading="lazy">
        </div>
      `;
    });

    this.contentEl.innerHTML = html;
  }

  /**
   * Select an image
   * @param {HTMLElement} item
   */
  selectImage(item) {
    // Deselect all
    this.contentEl.querySelectorAll('.image-picker-modal__item--selected').forEach(el => {
      el.classList.remove('image-picker-modal__item--selected');
    });

    // Select this one
    item.classList.add('image-picker-modal__item--selected');
    this.selectedUuid = item.dataset.uuid;
    this.selectedUrl = item.dataset.url;
    this.selectBtn.disabled = false;
  }

  /**
   * Confirm the selection
   */
  confirmSelection() {
    if (!this.selectedUuid || !this.selectedUrl) return;

    if (typeof this.onSelect === 'function') {
      this.onSelect(this.selectedUuid, this.selectedUrl);
    }

    this.close();
  }

  /**
   * Upload a new image
   * @param {File} file
   */
  async uploadImage(file) {
    if (this.uploading) return;

    this.uploading = true;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('storage_type', 'public');

      // Get CSRF token
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';

      const response = await fetch(`${this.baseUrl}/api/v1/upload`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken
        },
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Image uploaded successfully', 'success');
        // Reload images and auto-select the new one
        await this.loadImages();

        // Auto-select the newly uploaded image
        if (data.upload && data.upload.uuid) {
          const newItem = this.contentEl.querySelector(`[data-uuid="${data.upload.uuid}"]`);
          if (newItem) {
            this.selectImage(newItem);
          }
        }
      } else {
        throw new Error(data.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      this.showToast('Failed to upload image', 'error');
    } finally {
      this.uploading = false;
      this.fileInput.value = '';
    }
  }
}
