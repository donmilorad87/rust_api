/**
 * AssetPreview Component
 *
 * Renders asset preview cards with thumbnails for images/videos
 * and appropriate icons for other file types.
 */

export class AssetPreview {
  /**
   * @param {Object} upload - Upload data
   * @param {string} baseUrl - Base URL for API requests
   * @param {Function} onEditClick - Callback when Asset Info button is clicked
   * @param {Function} onDeleteClick - Callback when Delete button is clicked
   * @param {Function} onPreviewClick - Callback when preview is clicked
   */
  constructor(
    upload,
    baseUrl,
    onEditClick,
    onDeleteClick,
    onPreviewClick,
    onSelectToggle,
    isSelected = false
  ) {
    this.upload = upload;
    this.baseUrl = baseUrl;
    this.onEditClick = onEditClick;
    this.onDeleteClick = onDeleteClick;
    this.onPreviewClick = onPreviewClick;
    this.onSelectToggle = onSelectToggle;
    this.isSelected = isSelected;
  }

  /**
   * Render the asset card
   * @returns {HTMLElement}
   */
  render() {
    const card = document.createElement('div');
    card.className = `asset-card${this.isSelected ? ' asset-card--selected' : ''}`;
    card.dataset.uuid = this.upload.uuid;

    const isImage = this.isImageType(this.upload.mime_type);
    const isVideo = this.isVideoType(this.upload.mime_type);
    const isPDF = this.upload.mime_type === 'application/pdf';

    const isPublic = this.upload.storage_type === 'public';
    const downloadUrl = isPublic
      ? `${this.baseUrl}/api/v1/upload/download/public/${this.upload.uuid}`
      : `${this.baseUrl}/api/v1/upload/private/${this.upload.uuid}`;

    // Preview section
    const previewHtml = this.renderPreview(isImage, isVideo, isPDF, downloadUrl);

    // Info section
    const title = this.upload.title || this.upload.original_name;
    const description = this.upload.description || '';
    const sizeFormatted = this.formatBytes(this.upload.size_bytes);

    card.innerHTML = `
      <div class="asset-card__preview">
        <label class="asset-card__select" aria-label="Select upload">
          <input type="checkbox" class="asset-card__checkbox" ${this.isSelected ? 'checked' : ''}>
          <span class="asset-card__checkmark" aria-hidden="true"></span>
        </label>
        ${previewHtml}
        <div class="asset-card__overlay">
          <div class="asset-card__actions">
            <button class="btn btn--icon btn--edit" title="Asset Info">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn btn--icon btn--delete" title="Delete">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="asset-card__info">
        <h3 class="asset-card__title" title="${this.escapeHtml(title)}">
          ${this.escapeHtml(this.truncate(title, 30))}
        </h3>
        ${description ? `<p class="asset-card__description" title="${this.escapeHtml(description)}">${this.escapeHtml(this.truncate(description, 50))}</p>` : ''}
        <div class="asset-card__meta">
          <span class="badge badge--${isPublic ? 'public' : 'private'}">
            ${this.upload.storage_type}
          </span>
          <span class="asset-card__size">${sizeFormatted}</span>
          <span class="asset-card__extension">.${this.upload.extension}</span>
        </div>
      </div>
    `;

    // Bind events
    const editBtn = card.querySelector('.btn--edit');
    const deleteBtn = card.querySelector('.btn--delete');
    const checkbox = card.querySelector('.asset-card__checkbox');
    const selectLabel = card.querySelector('.asset-card__select');

    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onEditClick(this.upload);
    });

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onDeleteClick(this.upload.uuid);
    });

    if (selectLabel) {
      selectLabel.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    if (checkbox) {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        card.classList.toggle('asset-card--selected', checkbox.checked);
        if (this.onSelectToggle) {
          this.onSelectToggle(this.upload.uuid, checkbox.checked);
        }
      });
    }

    // Click on card preview to open image
    const preview = card.querySelector('.asset-card__preview');
    preview.addEventListener('click', (e) => {
      if (!e.target.closest('.btn') && !e.target.closest('.asset-card__select')) {
        if (this.onPreviewClick) {
          // For images, use full variant in lightbox; for others use base URL
          const isImage = this.isImageType(this.upload.mime_type);
          const fullUrl = isImage ? `${downloadUrl}?variant=full` : downloadUrl;
          this.onPreviewClick(this.upload, fullUrl);
        } else {
          window.open(downloadUrl, '_blank');
        }
      }
    });

    return card;
  }

  /**
   * Render preview based on file type
   */
  renderPreview(isImage, isVideo, isPDF, downloadUrl) {
    if (isImage) {
      // Use 'small' variant (320px) for grid thumbnails for better performance
      const thumbnailUrl = `${downloadUrl}?variant=small`;
      return `<img src="${thumbnailUrl}" alt="${this.escapeHtml(this.upload.title || this.upload.original_name)}" class="asset-card__image" data-full-url="${downloadUrl}">`;
    } else if (isVideo) {
      return `
        <video class="asset-card__video" controls>
          <source src="${downloadUrl}" type="${this.upload.mime_type}">
          Your browser does not support the video tag.
        </video>
      `;
    } else if (isPDF) {
      return `
        <div class="asset-card__icon asset-card__icon--pdf">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <text x="12" y="17" text-anchor="middle" font-size="6" font-weight="bold" fill="currentColor">PDF</text>
          </svg>
        </div>
      `;
    } else {
      // Generic file icon
      const ext = this.upload.extension.toUpperCase();
      return `
        <div class="asset-card__icon asset-card__icon--file">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="asset-card__icon-text">${ext}</span>
        </div>
      `;
    }
  }

  /**
   * Check if MIME type is an image
   */
  isImageType(mimeType) {
    return mimeType.startsWith('image/');
  }

  /**
   * Check if MIME type is a video
   */
  isVideoType(mimeType) {
    return mimeType.startsWith('video/');
  }

  /**
   * Format bytes to human readable size
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Truncate string with ellipsis
   * @param {string} str
   * @param {number} maxLen
   * @returns {string}
   */
  truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
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
