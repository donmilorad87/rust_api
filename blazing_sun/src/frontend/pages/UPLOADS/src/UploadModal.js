import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * UploadModal Component
 *
 * Two-step upload process:
 * 1. Select and upload file
 * 2. Fill in metadata (title, description, storage type)
 */

export class UploadModal {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   * @param {Function} options.onComplete - Callback when upload completes
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;
    this.onComplete = options.onComplete;
    this.modalEl = null;
    this.uploadedFile = null;
    this.currentStep = 1; // 1: upload, 2: metadata
  }

  /**
   * Open the modal
   */
  open() {
    this.currentStep = 1;
    this.uploadedFile = null;
    this.render();
  }

  /**
   * Close the modal
   */
  close() {
    if (this.modalEl) {
      this.modalEl.remove();
      this.modalEl = null;
    }
  }

  /**
   * Render the modal
   */
  render() {
    // Remove existing modal if any
    this.close();

    // Create modal
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal';
    this.modalEl.innerHTML = `
      <div class="modal__overlay"></div>
      <div class="modal__content">
        <div class="modal__header">
          <h2 class="modal__title">${this.currentStep === 1 ? 'Upload File' : 'File Metadata'}</h2>
          <button class="modal__close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal__body">
          ${this.currentStep === 1 ? this.renderUploadStep() : this.renderMetadataStep()}
        </div>
      </div>
    `;

    document.body.appendChild(this.modalEl);

    // Bind events
    this.bindEvents();
  }

  /**
   * Render upload step
   * @returns {string} HTML string
   */
  renderUploadStep() {
    return `
      <div class="upload-step">
        <div class="file-dropzone" id="fileDropzone">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p class="file-dropzone__text">
            <strong>Click to browse</strong> or drag and drop your file here
          </p>
          <p class="file-dropzone__hint">Supported: Images, PDFs, Documents</p>
          <input type="file" id="fileInput" class="file-dropzone__input" accept="image/*,application/pdf,.doc,.docx,.txt">
        </div>
        <div id="uploadProgress" class="upload-progress" style="display: none;">
          <div class="upload-progress__bar">
            <div class="upload-progress__fill" id="progressFill"></div>
          </div>
          <p class="upload-progress__text" id="progressText">Uploading...</p>
        </div>
      </div>
    `;
  }

  /**
   * Render metadata step
   * @returns {string} HTML string
   */
  renderMetadataStep() {
    // Generate preview URL for the uploaded file
    const isPublic = this.uploadedFile.storage_type === 'public';
    const previewUrl = isPublic
      ? `${this.baseUrl}/api/v1/upload/download/public/${this.uploadedFile.uuid}`
      : `${this.baseUrl}/api/v1/upload/private/${this.uploadedFile.uuid}`;

    // Check if file is an image
    const isImage = this.uploadedFile.mime_type && this.uploadedFile.mime_type.startsWith('image/');

    return `
      <form class="upload-metadata-form" id="metadataForm">
        <div class="upload-metadata-form__preview">
          ${isImage ? `
            <div class="upload-preview-image">
              <img src="${previewUrl}" alt="${this.escapeHtml(this.uploadedFile.original_name)}" />
            </div>
          ` : `
            <div class="upload-preview-file">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
          `}
          <div class="upload-preview-info">
            <strong>File:</strong> ${this.escapeHtml(this.uploadedFile.original_name)}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="uploadTitle">
            Title <span class="form-hint">(optional)</span>
          </label>
          <input
            type="text"
            id="uploadTitle"
            class="form-input"
            placeholder="Enter a descriptive title"
            value="${this.escapeHtml(this.uploadedFile.original_name)}"
          >
        </div>

        <div class="form-group">
          <label class="form-label" for="uploadDescription">
            Description <span class="form-hint">(optional)</span>
          </label>
          <textarea
            id="uploadDescription"
            class="form-textarea"
            placeholder="Enter a description or alt text"
            rows="3"
          ></textarea>
          <small class="form-help">Used for accessibility and SEO</small>
        </div>

        <div class="form-group">
          <label class="form-label">
            Storage Type
          </label>
          <div class="toggle-group">
            <label class="toggle-option">
              <input type="radio" name="storageType" value="public" checked>
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
              <input type="radio" name="storageType" value="private">
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

        <div class="modal__footer">
          <button type="button" class="btn btn--secondary" id="cancelMetadata">Cancel</button>
          <button type="submit" class="btn btn--primary">Save & Finish</button>
        </div>
      </form>
    `;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Close button
    const closeBtn = this.modalEl.querySelector('.modal__close');
    closeBtn.addEventListener('click', () => this.close());

    // Overlay click
    const overlay = this.modalEl.querySelector('.modal__overlay');
    overlay.addEventListener('click', () => this.close());

    if (this.currentStep === 1) {
      this.bindUploadStepEvents();
    } else {
      this.bindMetadataStepEvents();
    }
  }

  /**
   * Bind upload step events
   */
  bindUploadStepEvents() {
    const dropzone = this.modalEl.querySelector('#fileDropzone');
    const fileInput = this.modalEl.querySelector('#fileInput');

    // Click to browse
    dropzone.addEventListener('click', () => fileInput.click());

    // File selection
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.uploadFile(e.target.files[0]);
      }
    });

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('file-dropzone--dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('file-dropzone--dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('file-dropzone--dragover');

      if (e.dataTransfer.files.length > 0) {
        this.uploadFile(e.dataTransfer.files[0]);
      }
    });
  }

  /**
   * Bind metadata step events
   */
  bindMetadataStepEvents() {
    const form = this.modalEl.querySelector('#metadataForm');
    const cancelBtn = this.modalEl.querySelector('#cancelMetadata');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveMetadata();
    });

    cancelBtn.addEventListener('click', () => this.close());
  }

  /**
   * Upload file to server
   * @param {File} file
   */
  async uploadFile(file) {
    const dropzone = this.modalEl.querySelector('#fileDropzone');
    const progress = this.modalEl.querySelector('#uploadProgress');
    const progressFill = this.modalEl.querySelector('#progressFill');
    const progressText = this.modalEl.querySelector('#progressText');

    dropzone.style.display = 'none';
    progress.style.display = 'block';

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('storage_type', 'public'); // Default, can be changed in step 2

      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          progressFill.style.width = percent + '%';
          progressText.textContent = `Uploading... ${Math.round(percent)}%`;
        }
      });

      // Response handling
      xhr.addEventListener('load', () => {
        if (xhr.status === 200 || xhr.status === 201) {
          const response = JSON.parse(xhr.responseText);
          if (response.status === 'success') {
            this.uploadedFile = response.upload;
            this.currentStep = 2;
            this.showToast('File uploaded successfully!', 'success');
            this.render();
          } else {
            throw new Error(response.message || 'Upload failed');
          }
        } else {
          throw new Error('Upload failed');
        }
      });

      xhr.addEventListener('error', () => {
        throw new Error('Network error during upload');
      });

      xhr.open('POST', `${this.baseUrl}/api/v1/upload/public`);
      xhr.withCredentials = true;
      xhr.send(formData);

    } catch (error) {
      console.error('Upload error:', error);
      this.showToast(error.message || 'Failed to upload file', 'error');
      dropzone.style.display = 'flex';
      progress.style.display = 'none';
    }
  }

  /**
   * Save metadata and finish
   */
  async saveMetadata() {
    const title = this.modalEl.querySelector('#uploadTitle').value.trim();
    const description = this.modalEl.querySelector('#uploadDescription').value.trim();
    const storageType = this.modalEl.querySelector('input[name="storageType"]:checked').value;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/uploads/${this.uploadedFile.uuid}/metadata`, {
        method: 'PATCH',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          title: title || null,
          description: description || null,
          storage_type: storageType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save metadata');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Upload completed successfully!', 'success');
        this.close();
        if (this.onComplete) {
          this.onComplete();
        }
      } else {
        throw new Error(data.message || 'Failed to save metadata');
      }
    } catch (error) {
      console.error('Save metadata error:', error);
      this.showToast('Failed to save metadata', 'error');
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
