/**
 * UploadsPage Controller
 *
 * Handles admin uploads management functionality:
 * - Display all uploads in grid or table view
 * - Filter/search uploads
 * - Delete uploads
 * - Edit metadata (title/description)
 * - Pagination
 */

import { AssetPreview } from './AssetPreview.js';
import { AssetInfoModal } from './AssetInfoModal.js';
import { ImageLightbox } from './ImageLightbox.js';
import { UploadModal } from './UploadModal.js';

export class UploadsPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {HTMLElement} options.uploadsTable - Table body element
   * @param {HTMLElement} options.uploadsGrid - Grid container element
   * @param {HTMLElement} options.pagination - Pagination container
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.uploadsTable = options.uploadsTable;
    this.uploadsGrid = options.uploadsGrid;
    this.pagination = options.pagination;
    this.showToast = options.showToast;

    // State
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.uploads = [];
    this.totalUploads = 0;
    this.viewMode = 'grid'; // 'grid' or 'table'

    // Initialize modals
    this.modal = new AssetInfoModal({
      baseUrl: this.baseUrl,
      showToast: this.showToast,
      onSave: () => this.loadUploads()
    });

    this.lightbox = new ImageLightbox();

    this.uploadModal = new UploadModal({
      baseUrl: this.baseUrl,
      showToast: this.showToast,
      onComplete: () => this.loadUploads()
    });

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.bindEvents();
    this.loadUploads();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Upload button
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.uploadModal.open();
      });
    }

    // View mode toggle
    const viewToggle = document.getElementById('viewToggle');
    if (viewToggle) {
      viewToggle.addEventListener('change', (e) => {
        this.viewMode = e.target.value;
        this.renderView();
      });
    }

    // Action buttons (delegated - table view)
    this.uploadsTable.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        const uuid = deleteBtn.dataset.uuid;
        this.confirmDelete(uuid);
      }

      const editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn) {
        const uuid = editBtn.dataset.uuid;
        const upload = this.uploads.find(u => u.uuid === uuid);
        if (upload) {
          this.modal.open(upload);
        }
      }
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.currentPage = 1;
          this.loadUploads(e.target.value);
        }, 300);
      });
    }

    // Filter select
    const filterSelect = document.getElementById('filterStorage');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        this.currentPage = 1;
        this.loadUploads();
      });
    }
  }

  /**
   * Load uploads from API
   * @param {string} search - Search term
   */
  async loadUploads(search = '') {
    try {
      const offset = (this.currentPage - 1) * this.itemsPerPage;
      const params = new URLSearchParams({
        limit: this.itemsPerPage,
        offset: offset
      });

      // Add storage type filter if not "all"
      const filterSelect = document.getElementById('filterStorage');
      if (filterSelect && filterSelect.value && filterSelect.value !== 'all') {
        params.append('storage_type', filterSelect.value);
      }

      // Add search term if provided
      const searchInput = document.getElementById('searchInput');
      const searchTerm = search || (searchInput ? searchInput.value : '');
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`${this.baseUrl}/api/v1/admin/uploads?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load uploads');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.uploads = data.uploads || [];
        this.totalUploads = data.total || 0;
        this.renderView();
        this.renderPagination();
      } else {
        throw new Error(data.message || 'Failed to load uploads');
      }
    } catch (error) {
      console.error('Error loading uploads:', error);
      this.showToast('Failed to load uploads', 'error');
      this.renderEmptyState();
    }
  }

  /**
   * Render view based on current mode
   */
  renderView() {
    if (this.uploads.length === 0) {
      this.renderEmptyState();
      return;
    }

    if (this.viewMode === 'grid') {
      this.renderGrid();
    } else {
      this.renderTable();
    }
  }

  /**
   * Render the uploads grid
   */
  renderGrid() {
    // Hide table, show grid
    if (this.uploadsTable.parentElement) {
      this.uploadsTable.parentElement.parentElement.style.display = 'none';
    }
    if (this.uploadsGrid) {
      this.uploadsGrid.style.display = 'grid';
      this.uploadsGrid.innerHTML = '';

      this.uploads.forEach(upload => {
        const preview = new AssetPreview(
          upload,
          this.baseUrl,
          (upload) => this.modal.open(upload),
          (uuid) => this.confirmDelete(uuid),
          (upload, downloadUrl) => this.handlePreviewClick(upload, downloadUrl)
        );
        this.uploadsGrid.appendChild(preview.render());
      });
    }
  }

  /**
   * Handle preview click - open images in lightbox, others in new tab
   * @param {Object} upload - Upload data
   * @param {string} downloadUrl - Download URL
   */
  handlePreviewClick(upload, downloadUrl) {
    // Check if it's an image
    if (upload.mime_type.startsWith('image/')) {
      // Open in lightbox
      const title = upload.title || upload.original_name;
      this.lightbox.open(downloadUrl, title);
    } else {
      // Open in new tab for non-images
      window.open(downloadUrl, '_blank');
    }
  }

  /**
   * Render the uploads table
   */
  renderTable() {
    // Hide grid, show table
    if (this.uploadsGrid) {
      this.uploadsGrid.style.display = 'none';
    }
    if (this.uploadsTable.parentElement) {
      this.uploadsTable.parentElement.parentElement.style.display = 'block';
    }

    const rows = this.uploads.map(upload => this.createRow(upload)).join('');
    this.uploadsTable.innerHTML = rows;

    // Add delegated click handlers for thumbnails
    this.uploadsTable.querySelectorAll('.thumbnail-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const uuid = e.currentTarget.dataset.uuid;
        const upload = this.uploads.find(u => u.uuid === uuid);
        if (upload) {
          const isPublic = upload.storage_type === 'public';
          const downloadUrl = isPublic
            ? `${this.baseUrl}/api/v1/upload/download/public/${upload.uuid}`
            : `${this.baseUrl}/api/v1/upload/private/${upload.uuid}`;
          this.handlePreviewClick(upload, downloadUrl);
        }
      });
    });
  }

  /**
   * Create a table row for an upload
   * @param {Object} upload - Upload data
   * @returns {string} HTML string
   */
  createRow(upload) {
    const isPublic = upload.storage_type === 'public';
    const downloadUrl = isPublic
      ? `${this.baseUrl}/api/v1/upload/download/public/${upload.uuid}`
      : `${this.baseUrl}/api/v1/upload/private/${upload.uuid}`;

    const sizeFormatted = this.formatBytes(upload.size_bytes);
    const dateFormatted = new Date(upload.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const statusClass = upload.upload_status === 'completed' ? 'status--success' : 'status--pending';

    // Determine if file is an image
    const isImage = upload.mime_type.startsWith('image/');
    // Use 'thumb' variant (100px) for table thumbnails for better performance
    const thumbnailUrl = isImage ? `${downloadUrl}?variant=thumb` : downloadUrl;
    const thumbnailHtml = isImage
      ? `<img src="${thumbnailUrl}" alt="${upload.original_name}" class="table-thumbnail" data-full-url="${downloadUrl}" />`
      : `<div class="table-thumbnail table-thumbnail--icon">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
             <polyline points="14 2 14 8 20 8"></polyline>
           </svg>
         </div>`;

    return `
      <tr class="uploads-table__row">
        <td class="uploads-table__cell uploads-table__cell--thumbnail" data-label="Preview">
          <a href="${downloadUrl}" data-uuid="${upload.uuid}" class="thumbnail-link">${thumbnailHtml}</a>
        </td>
        <td class="uploads-table__cell uploads-table__cell--uuid" data-label="UUID" title="${upload.uuid}">
          ${upload.uuid.substring(0, 8)}...
        </td>
        <td class="uploads-table__cell uploads-table__cell--name" data-label="Name" title="${upload.original_name}">
          ${this.truncate(upload.original_name, 30)}
        </td>
        <td class="uploads-table__cell uploads-table__cell--type" data-label="Storage">
          <span class="badge badge--${isPublic ? 'public' : 'private'}">
            ${upload.storage_type}
          </span>
        </td>
        <td class="uploads-table__cell uploads-table__cell--mime" data-label="Type">
          ${upload.mime_type}
        </td>
        <td class="uploads-table__cell uploads-table__cell--size" data-label="Size">
          ${sizeFormatted}
        </td>
        <td class="uploads-table__cell uploads-table__cell--status" data-label="Status">
          <span class="status ${statusClass}">${upload.upload_status}</span>
        </td>
        <td class="uploads-table__cell uploads-table__cell--user" data-label="User ID">
          ${upload.user_id || 'N/A'}
        </td>
        <td class="uploads-table__cell uploads-table__cell--date" data-label="Date">
          ${dateFormatted}
        </td>
        <td class="uploads-table__cell uploads-table__cell--actions" data-label="Actions">
          <button class="btn btn--icon btn--edit" data-action="edit" data-uuid="${upload.uuid}" title="Edit Info">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn btn--icon btn--delete" data-action="delete" data-uuid="${upload.uuid}" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    // Clear grid view
    if (this.uploadsGrid) {
      this.uploadsGrid.innerHTML = '';
    }

    // Clear table view and show empty state
    this.uploadsTable.innerHTML = `
      <tr>
        <td colspan="10" class="uploads-table__empty">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <p>No uploads found</p>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render pagination controls
   */
  renderPagination() {
    if (!this.pagination) return;

    const totalPages = Math.ceil(this.totalUploads / this.itemsPerPage);

    if (totalPages <= 1) {
      this.pagination.innerHTML = '';
      return;
    }

    let html = '<div class="pagination">';

    // Previous button
    html += `
      <button class="pagination__btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
        &laquo; Prev
      </button>
    `;

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      html += `
        <button class="pagination__btn ${i === this.currentPage ? 'pagination__btn--active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    }

    // Next button
    html += `
      <button class="pagination__btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">
        Next &raquo;
      </button>
    `;

    html += '</div>';

    this.pagination.innerHTML = html;

    // Bind pagination events
    this.pagination.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.loadUploads();
        }
      });
    });
  }

  /**
   * Confirm delete action
   * @param {string} uuid - Upload UUID
   */
  confirmDelete(uuid) {
    if (confirm('Are you sure you want to delete this upload? This action cannot be undone.')) {
      this.deleteUpload(uuid);
    }
  }

  /**
   * Delete an upload
   * @param {string} uuid - Upload UUID
   */
  async deleteUpload(uuid) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/upload/${uuid}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete upload');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Upload deleted successfully', 'success');

        // If this was the last item on the current page and we're not on page 1, go to previous page
        if (this.uploads.length === 1 && this.currentPage > 1) {
          this.currentPage--;
        }

        await this.loadUploads();
      } else {
        throw new Error(data.message || 'Failed to delete upload');
      }
    } catch (error) {
      console.error('Error deleting upload:', error);
      this.showToast('Failed to delete upload', 'error');
    }
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
}
