import { getCsrfHeaders, getCsrfToken } from '../../GLOBAL/src/js/csrf.js';

/**
 * GalleriesPage Controller
 *
 * Manages gallery listing, creation, editing, deletion, and picture management.
 */

export class GalleriesPage {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.galleriesGrid = config.galleriesGrid;
    this.loadingState = config.loadingState;
    this.errorState = config.errorState;
    this.emptyState = config.emptyState;
    this.showToast = config.showToast;

    this.galleries = [];
    this.currentGallery = null;
    this.currentGalleryForPictures = null;
    this.selectedFiles = [];
    this.fileMetadata = []; // Stores {title, description} for each file
    this.currentLightboxIndex = 0;
    this.selectedPictureIds = new Set();
    this.pendingPictureDeleteIds = [];
    this.currentPicturesList = [];

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.setupEventListeners();
    this.loadGalleries();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Create gallery button
    const createBtn = document.getElementById('createGalleryBtn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showGalleryModal());
    }

    // Empty state create button
    const emptyCreateBtns = document.querySelectorAll('.create-gallery-trigger');
    emptyCreateBtns.forEach(btn => {
      btn.addEventListener('click', () => this.showGalleryModal());
    });

    // Retry button
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.loadGalleries());
    }

    // Gallery form submission
    const galleryForm = document.getElementById('galleryForm');
    if (galleryForm) {
      galleryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleGallerySubmit();
      });
    }

    // Modal close buttons
    this.setupModalCloseListeners();

    // Delete confirmation
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', () => this.handleDelete());
    }

    // Add pictures button
    const addPictureBtn = document.getElementById('addPictureBtn');
    if (addPictureBtn) {
      addPictureBtn.addEventListener('click', () => this.handleAddPictures());
    }

    this.selectAllPicturesCheckbox = document.getElementById('selectAllPictures');
    if (this.selectAllPicturesCheckbox) {
      this.selectAllPicturesCheckbox.addEventListener('change', () => this.handleSelectAllPictures());
    }

    this.bulkDeletePicturesBtn = document.getElementById('bulkDeletePicturesBtn');
    if (this.bulkDeletePicturesBtn) {
      this.bulkDeletePicturesBtn.addEventListener('click', () => {
        const selected = Array.from(this.selectedPictureIds);
        if (selected.length > 0) {
          this.openPictureDeleteModal(selected);
        }
      });
    }

    this.selectedPicturesCount = document.getElementById('selectedPicturesCount');

    const confirmPictureDeleteBtn = document.getElementById('confirmPictureDeleteBtn');
    if (confirmPictureDeleteBtn) {
      confirmPictureDeleteBtn.addEventListener('click', () => this.handleConfirmPictureDelete());
    }

    // Upload controls
    const browseFilesBtn = document.getElementById('browseFilesBtn');
    if (browseFilesBtn) {
      browseFilesBtn.addEventListener('click', () => this.triggerFileInput());
    }

    const pictureFileInput = document.getElementById('pictureFileInput');
    if (pictureFileInput) {
      pictureFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    const uploadDropZone = document.getElementById('uploadDropZone');
    if (uploadDropZone) {
      uploadDropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
      uploadDropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
      uploadDropZone.addEventListener('drop', (e) => this.handleDrop(e));
    }

    const uploadFilesBtn = document.getElementById('uploadFilesBtn');
    if (uploadFilesBtn) {
      uploadFilesBtn.addEventListener('click', () => this.uploadAndAddPictures());
    }

    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    if (cancelUploadBtn) {
      cancelUploadBtn.addEventListener('click', () => this.cancelUpload());
    }

    // Lightbox controls
    const lightboxClose = document.querySelector('.image-lightbox__close');
    if (lightboxClose) {
      lightboxClose.addEventListener('click', () => this.closeLightbox());
    }

    const lightboxPrevBtn = document.getElementById('lightboxPrevBtn');
    if (lightboxPrevBtn) {
      lightboxPrevBtn.addEventListener('click', () => this.navigateLightbox(-1));
    }

    const lightboxNextBtn = document.getElementById('lightboxNextBtn');
    if (lightboxNextBtn) {
      lightboxNextBtn.addEventListener('click', () => this.navigateLightbox(1));
    }

    const lightboxForm = document.getElementById('lightboxForm');
    if (lightboxForm) {
      lightboxForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveLightboxMetadata();
      });
    }
  }

  /**
   * Set up modal close listeners
   */
  setupModalCloseListeners() {
    const closeButtons = document.querySelectorAll('.modal__close, .modal__overlay');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          this.closeModal(modal);
        }
      });
    });
  }

  /**
   * Load galleries from API
   */
  async loadGalleries() {
    this.showLoadingState();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/galleries`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ 'Accept': 'application/json' })
      });

      if (!response.ok) {
        throw new Error(`Failed to load galleries: ${response.statusText}`);
      }

      const data = await response.json();
      this.galleries = data.galleries || [];

      if (this.galleries.length === 0) {
        this.showEmptyState();
      } else {
        this.renderGalleries();
        this.showContentState();
      }
    } catch (error) {
      console.error('Failed to load galleries:', error);
      this.showErrorState(error.message);
    }
  }

  /**
   * Render galleries grid
   */
  renderGalleries() {
    this.galleriesGrid.innerHTML = '';

    this.galleries.forEach(gallery => {
      const card = this.createGalleryCard(gallery);
      this.galleriesGrid.appendChild(card);
    });
  }

  /**
   * Create a gallery card element
   * @param {Object} gallery - Gallery data
   * @returns {HTMLElement}
   */
  createGalleryCard(gallery) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.galleryId = gallery.id;

    const coverImage = gallery.cover_image_url || '/assets/img/gallery-placeholder.svg';
    const pictureCount = gallery.picture_count || 0;
    const visibility = gallery.is_public ? 'Public' : 'Private';

    card.innerHTML = `
      <div class="gallery-card__cover">
        <img src="${coverImage}" alt="${this.escapeHtml(gallery.name)}" class="gallery-card__image">
        <div class="gallery-card__overlay">
          <button class="gallery-card__action" data-action="view-pictures" aria-label="View pictures">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>
        </div>
      </div>
      <div class="gallery-card__content">
        <h3 class="gallery-card__title">${this.escapeHtml(gallery.name)}</h3>
        ${gallery.description ? `<p class="gallery-card__description">${this.escapeHtml(gallery.description)}</p>` : ''}
        <div class="gallery-card__meta">
          <span class="gallery-card__count">${pictureCount} ${pictureCount === 1 ? 'picture' : 'pictures'}</span>
          <span class="gallery-card__visibility">${visibility}</span>
        </div>
      </div>
      <div class="gallery-card__actions">
        <button class="btn btn--icon" data-action="edit" aria-label="Edit gallery">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="btn btn--icon btn--danger" data-action="delete" aria-label="Delete gallery">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Attach event listeners
    const viewBtn = card.querySelector('[data-action="view-pictures"]');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => this.showPicturesModal(gallery));
    }

    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn) {
      editBtn.addEventListener('click', () => this.showGalleryModal(gallery));
    }

    const deleteBtn = card.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.showDeleteModal(gallery));
    }

    return card;
  }

  /**
   * Show gallery modal (create or edit)
   * @param {Object|null} gallery - Gallery to edit, or null for create
   */
  showGalleryModal(gallery = null) {
    const modal = document.getElementById('galleryModal');
    const title = document.getElementById('galleryModalTitle');
    const form = document.getElementById('galleryForm');
    const saveBtn = document.getElementById('saveGalleryBtn');

    if (!modal || !form) return;

    this.currentGallery = gallery;

    // Update modal title and button
    if (gallery) {
      title.textContent = 'Edit Gallery';
      saveBtn.querySelector('.btn__text').textContent = 'Update Gallery';

      // Populate form
      document.getElementById('galleryName').value = gallery.name || '';
      document.getElementById('galleryDescription').value = gallery.description || '';
      document.getElementById('galleryIsPublic').checked = gallery.is_public || false;
      document.getElementById('galleryId').value = gallery.id;
    } else {
      title.textContent = 'Create Gallery';
      saveBtn.querySelector('.btn__text').textContent = 'Create Gallery';

      // Reset form
      form.reset();
      document.getElementById('galleryId').value = '';
    }

    // Clear errors
    this.clearFormErrors();

    // Show modal
    this.openModal(modal);
  }

  /**
   * Handle gallery form submission
   */
  async handleGallerySubmit() {
    const form = document.getElementById('galleryForm');
    const formData = new FormData(form);
    const galleryId = document.getElementById('galleryId').value;

    const data = {
      name: formData.get('name'),
      description: formData.get('description') || null,
      is_public: formData.get('is_public') === 'on'
    };

    // Validate
    this.clearFormErrors();
    if (!data.name || data.name.trim().length === 0) {
      this.showFieldError('nameError', 'Gallery name is required');
      return;
    }

    const saveBtn = document.getElementById('saveGalleryBtn');
    saveBtn.disabled = true;

    try {
      if (galleryId) {
        // Update existing gallery
        await this.updateGallery(galleryId, data);
      } else {
        // Create new gallery
        await this.createGallery(data);
      }

      const modal = document.getElementById('galleryModal');
      this.closeModal(modal);
      await this.loadGalleries();
    } catch (error) {
      console.error('Failed to save gallery:', error);
      this.showToast(error.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  }

  /**
   * Create a new gallery
   * @param {Object} data - Gallery data
   */
  async createGallery(data) {
    const response = await fetch(`${this.baseUrl}/api/v1/galleries`, {
      method: 'POST',
      credentials: 'include',
      headers: getCsrfHeaders({ 'Accept': 'application/json' }),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create gallery');
    }

    this.showToast('Gallery created successfully', 'success');
    return response.json();
  }

  /**
   * Update an existing gallery
   * @param {number} id - Gallery ID
   * @param {Object} data - Gallery data
   */
  async updateGallery(id, data) {
    const response = await fetch(`${this.baseUrl}/api/v1/galleries/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: getCsrfHeaders({ 'Accept': 'application/json' }),
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update gallery');
    }

    this.showToast('Gallery updated successfully', 'success');
    return response.json();
  }

  /**
   * Show delete confirmation modal
   * @param {Object} gallery - Gallery to delete
   */
  showDeleteModal(gallery) {
    this.currentGallery = gallery;

    const modal = document.getElementById('deleteModal');
    const message = document.getElementById('deleteMessage');

    if (!modal || !message) return;

    message.textContent = `Are you sure you want to delete "${gallery.name}"? This will also delete all pictures in this gallery. This action cannot be undone.`;

    this.openModal(modal);
  }

  /**
   * Handle delete confirmation
   */
  async handleDelete() {
    if (!this.currentGallery) return;

    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.disabled = true;

    try {
      await this.deleteGallery(this.currentGallery.id);

      const modal = document.getElementById('deleteModal');
      this.closeModal(modal);

      this.currentGallery = null;
      await this.loadGalleries();
    } catch (error) {
      console.error('Failed to delete gallery:', error);
      this.showToast(error.message, 'error');
    } finally {
      confirmBtn.disabled = false;
    }
  }

  /**
   * Delete a gallery
   * @param {number} id - Gallery ID
   */
  async deleteGallery(id) {
    const response = await fetch(`${this.baseUrl}/api/v1/galleries/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getCsrfHeaders({ 'Accept': 'application/json' })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete gallery');
    }

    this.showToast('Gallery deleted successfully', 'success');
  }

  /**
   * Show pictures modal for a gallery
   * @param {Object} gallery - Gallery to manage pictures for
   */
  showPicturesModal(gallery) {
    this.currentGalleryForPictures = gallery;
    this.selectedPictureIds.clear();
    this.pendingPictureDeleteIds = [];
    this.currentPicturesList = [];
    this.updateBulkSelectionUI();

    const modal = document.getElementById('picturesModal');
    const title = document.getElementById('picturesModalTitle');

    if (!modal || !title) return;

    title.textContent = `${gallery.name} - Pictures`;

    this.openModal(modal);
    this.loadGalleryPictures(gallery.id);
  }

  /**
   * Load pictures for a gallery
   * @param {number} galleryId - Gallery ID
   */
  async loadGalleryPictures(galleryId) {
    const picturesGrid = document.getElementById('picturesGrid');
    const picturesEmpty = document.getElementById('picturesEmpty');

    if (!picturesGrid || !picturesEmpty) return;

    // Show loading state
    picturesGrid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading pictures...</p></div>';
    picturesEmpty.style.display = 'none';

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/galleries/${galleryId}/pictures`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ 'Accept': 'application/json' })
      });

      if (!response.ok) {
        throw new Error('Failed to load pictures');
      }

      const data = await response.json();
      const pictures = data.pictures || [];

      if (pictures.length === 0) {
        picturesGrid.innerHTML = '';
        picturesEmpty.style.display = 'block';
        this.currentPicturesList = [];
        this.selectedPictureIds.clear();
        this.updateBulkSelectionUI();
      } else {
        this.renderPictures(pictures);
      }
    } catch (error) {
      console.error('Failed to load pictures:', error);
      picturesGrid.innerHTML = `<div class="error-state"><p>${error.message}</p></div>`;
    }
  }

  /**
   * Render pictures in the pictures modal
   * @param {Array} pictures - Pictures array
   */
  renderPictures(pictures) {
    const picturesGrid = document.getElementById('picturesGrid');
    if (!picturesGrid) return;

    picturesGrid.innerHTML = '';
    this.selectedPictureIds.clear();
    this.currentPicturesList = pictures;

    pictures.forEach(picture => {
      const card = document.createElement('div');
      card.className = 'picture-card';
      card.dataset.pictureId = picture.id;

      card.innerHTML = `
        <label class="picture-card__select" aria-label="Select picture">
          <input type="checkbox" class="picture-card__checkbox" data-picture-id="${picture.id}">
          <span class="picture-card__checkmark" aria-hidden="true"></span>
        </label>
        <div class="picture-card__image-wrapper" data-action="view-picture">
          <img src="${picture.urls.medium}" alt="${this.escapeHtml(picture.title || 'Picture')}" class="picture-card__image">
        </div>
        <div class="picture-card__content">
          <h4 class="picture-card__title">${this.escapeHtml(picture.title || 'Untitled')}</h4>
          ${picture.description ? `<p class="picture-card__description">${this.escapeHtml(picture.description)}</p>` : ''}
        </div>
        <div class="picture-card__actions">
          <button class="btn btn--icon" data-action="edit-picture" aria-label="Edit metadata">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn btn--icon btn--danger" data-action="remove-picture" aria-label="Remove from gallery">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      // View picture in lightbox
      const imageWrapper = card.querySelector('[data-action="view-picture"]');
      if (imageWrapper) {
        imageWrapper.style.cursor = 'pointer';
        imageWrapper.addEventListener('click', () => this.openPictureLightbox(pictures, pictures.indexOf(picture)));
      }

      const selectCheckbox = card.querySelector('.picture-card__checkbox');
      if (selectCheckbox) {
        selectCheckbox.addEventListener('click', (e) => {
          e.stopPropagation();
        });
        selectCheckbox.addEventListener('change', (e) => {
          e.stopPropagation();
          const isSelected = selectCheckbox.checked;
          card.classList.toggle('picture-card--selected', isSelected);
          this.togglePictureSelection(picture.id, isSelected);
        });
      }

      // Edit picture button
      const editBtn = card.querySelector('[data-action="edit-picture"]');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openPictureLightbox(pictures, pictures.indexOf(picture), true);
        });
      }

      // Remove picture button
      const removeBtn = card.querySelector('[data-action="remove-picture"]');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.openPictureDeleteModal([picture.id]);
        });
      }

      picturesGrid.appendChild(card);
    });

    this.updateBulkSelectionUI();
  }

  /**
   * Remove a picture from the gallery
   * @param {number} pictureId - Picture ID
   */
  async deletePicturesFromGallery(pictureIds) {
    if (!this.currentGalleryForPictures || pictureIds.length === 0) return;

    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/galleries/${this.currentGalleryForPictures.id}/pictures/bulk-delete`,
        {
          method: 'POST',
          credentials: 'include',
          headers: getCsrfHeaders({ 'Accept': 'application/json' }),
          body: JSON.stringify({ picture_ids: pictureIds })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove pictures');
      }

      this.showToast('Pictures removed successfully', 'success');
      this.selectedPictureIds.clear();
      this.updateBulkSelectionUI();

      if (this.currentGalleryForPictures) {
        this.loadGalleryPictures(this.currentGalleryForPictures.id);
      }
    } catch (error) {
      console.error('Failed to remove pictures:', error);
      this.showToast(error.message, 'error');
    }
  }

  /**
   * Update selection state for a picture
   * @param {number} pictureId - Picture ID
   * @param {boolean} isSelected - Selection state
   */
  togglePictureSelection(pictureId, isSelected) {
    if (isSelected) {
      this.selectedPictureIds.add(pictureId);
    } else {
      this.selectedPictureIds.delete(pictureId);
    }

    this.updateBulkSelectionUI();
  }

  /**
   * Select or deselect all pictures
   */
  handleSelectAllPictures() {
    const shouldSelectAll = this.selectAllPicturesCheckbox?.checked;
    const pictureIds = this.currentPicturesList.map((picture) => picture.id);

    this.selectedPictureIds = new Set(shouldSelectAll ? pictureIds : []);

    const checkboxes = document.querySelectorAll('.picture-card__checkbox');
    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldSelectAll;
      const card = checkbox.closest('.picture-card');
      if (card) {
        card.classList.toggle('picture-card--selected', shouldSelectAll);
      }
    });

    this.updateBulkSelectionUI();
  }

  /**
   * Refresh bulk selection UI state
   */
  updateBulkSelectionUI() {
    const selectedCount = this.selectedPictureIds.size;
    const totalCount = this.currentPicturesList.length;

    if (this.selectedPicturesCount) {
      this.selectedPicturesCount.textContent = `${selectedCount} selected`;
    }

    if (this.selectAllPicturesCheckbox) {
      this.selectAllPicturesCheckbox.disabled = totalCount === 0;
      this.selectAllPicturesCheckbox.checked = selectedCount > 0 && selectedCount === totalCount;
      this.selectAllPicturesCheckbox.indeterminate =
        selectedCount > 0 && selectedCount < totalCount;
    }

    if (this.bulkDeletePicturesBtn) {
      this.bulkDeletePicturesBtn.disabled = selectedCount === 0;
      this.bulkDeletePicturesBtn.classList.toggle('btn--hidden', selectedCount === 0);
    }
  }

  /**
   * Show picture delete confirmation modal
   * @param {number[]} pictureIds - Picture IDs to remove
   */
  openPictureDeleteModal(pictureIds) {
    this.pendingPictureDeleteIds = pictureIds;
    const modal = document.getElementById('pictureDeleteModal');
    const message = document.getElementById('pictureDeleteMessage');

    if (!modal || !message) return;

    const count = pictureIds.length;
    message.textContent =
      count === 1
        ? 'Remove this picture from the gallery?'
        : `Remove ${count} pictures from the gallery?`;

    this.openModal(modal);
  }

  /**
   * Handle picture delete confirmation
   */
  async handleConfirmPictureDelete() {
    const modal = document.getElementById('pictureDeleteModal');
    const confirmBtn = document.getElementById('confirmPictureDeleteBtn');

    if (!this.pendingPictureDeleteIds || this.pendingPictureDeleteIds.length === 0) {
      if (modal) {
        this.closeModal(modal);
      }
      return;
    }

    if (confirmBtn) {
      confirmBtn.disabled = true;
    }

    await this.deletePicturesFromGallery(this.pendingPictureDeleteIds);

    if (modal) {
      this.closeModal(modal);
    }

    if (confirmBtn) {
      confirmBtn.disabled = false;
    }

    this.pendingPictureDeleteIds = [];
  }

  /**
   * Open picture lightbox for viewing/editing
   * @param {Array} pictures - All pictures in gallery
   * @param {number} index - Index of picture to display
   * @param {boolean} editMode - Whether to open in edit mode
   */
  openPictureLightbox(pictures, index, editMode = false) {
    console.log('Opening picture lightbox', { picturesCount: pictures.length, index, editMode });

    this.currentPictures = pictures;
    this.currentPictureIndex = index;
    const picture = pictures[index];

    // Create lightbox if it doesn't exist
    let lightbox = document.getElementById('pictureLightbox');
    if (!lightbox) {
      console.log('Creating new lightbox');
      lightbox = document.createElement('div');
      lightbox.id = 'pictureLightbox';
      lightbox.className = 'image-lightbox';
      lightbox.innerHTML = `
        <div class="image-lightbox__container">
          <div class="image-lightbox__image-section">
            <img class="image-lightbox__image" src="" alt="">
            ${pictures.length > 1 ? `
              <button class="image-lightbox__nav image-lightbox__nav--prev" aria-label="Previous">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <button class="image-lightbox__nav image-lightbox__nav--next" aria-label="Next">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            ` : ''}
          </div>
          <div class="image-lightbox__meta-section">
            <div class="image-lightbox__header">
              <h3 class="image-lightbox__title">Picture Details</h3>
              <button class="image-lightbox__close" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="image-lightbox__body">
              <div class="lightbox-form" id="lightboxMetaView">
                <div class="form__group">
                  <h4 class="lightbox__meta-title" style="margin: 0 0 0.5rem 0; color: var(--text-primary);"></h4>
                  <p class="lightbox__meta-description" style="margin: 0; color: var(--text-secondary);"></p>
                  ${pictures.length > 1 ? '<p class="lightbox__counter" style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-tertiary);"></p>' : ''}
                </div>
              </div>
              <div class="lightbox-form" id="lightboxMetaEdit" style="display: none;">
                <div class="form__group">
                  <label class="form__label">Title</label>
                  <input type="text" class="form__input lightbox__title-input" placeholder="Enter title">
                </div>
                <div class="form__group">
                  <label class="form__label">Description</label>
                  <textarea class="form__textarea lightbox__description-input" placeholder="Enter description (optional)" rows="4"></textarea>
                </div>
              </div>
            </div>
            <div class="image-lightbox__footer" id="lightboxFooterView">
              <button class="btn btn--primary lightbox__edit-btn">Edit Metadata</button>
            </div>
            <div class="image-lightbox__footer" id="lightboxFooterEdit" style="display: none; gap: 0.5rem;">
              <button class="btn btn--secondary lightbox__cancel-edit">Cancel</button>
              <button class="btn btn--primary lightbox__save-edit">Save</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(lightbox);

      // Close button
      const closeBtn = lightbox.querySelector('.image-lightbox__close');
      closeBtn.addEventListener('click', () => {
        console.log('Close button clicked');
        this.closePictureLightbox();
      });

      // Backdrop click (click on image section background)
      const imageSection = lightbox.querySelector('.image-lightbox__image-section');
      imageSection.addEventListener('click', (e) => {
        if (e.target === imageSection) {
          console.log('Backdrop clicked');
          this.closePictureLightbox();
        }
      });

      // Navigation
      if (pictures.length > 1) {
        const prevBtn = lightbox.querySelector('.image-lightbox__nav--prev');
        const nextBtn = lightbox.querySelector('.image-lightbox__nav--next');
        prevBtn.addEventListener('click', () => {
          console.log('Previous button clicked');
          this.navigatePictureLightbox(-1);
        });
        nextBtn.addEventListener('click', () => {
          console.log('Next button clicked');
          this.navigatePictureLightbox(1);
        });
      }

      // Edit controls
      const editBtn = lightbox.querySelector('.lightbox__edit-btn');
      const cancelEditBtn = lightbox.querySelector('.lightbox__cancel-edit');
      const saveEditBtn = lightbox.querySelector('.lightbox__save-edit');

      editBtn.addEventListener('click', () => {
        console.log('Edit button clicked');
        this.togglePictureEditMode(true);
      });
      cancelEditBtn.addEventListener('click', () => {
        console.log('Cancel edit clicked');
        this.togglePictureEditMode(false);
      });
      saveEditBtn.addEventListener('click', () => {
        console.log('Save button clicked');
        this.savePictureMetadata();
      });

      // Keyboard navigation
      this.pictureLightboxKeyHandler = (e) => {
        if (e.key === 'Escape') {
          console.log('Escape key pressed');
          this.closePictureLightbox();
        } else if (e.key === 'ArrowLeft' && pictures.length > 1) {
          console.log('Left arrow key pressed');
          this.navigatePictureLightbox(-1);
        } else if (e.key === 'ArrowRight' && pictures.length > 1) {
          console.log('Right arrow key pressed');
          this.navigatePictureLightbox(1);
        }
      };
      document.addEventListener('keydown', this.pictureLightboxKeyHandler);
    }

    // Update lightbox content
    this.updatePictureLightbox(picture, editMode);

    // Show lightbox
    lightbox.classList.add('image-lightbox--open');
    document.body.style.overflow = 'hidden';
    console.log('Lightbox opened');
  }

  /**
   * Update picture lightbox content
   * @param {Object} picture - Picture data
   * @param {boolean} editMode - Whether to show edit mode
   */
  updatePictureLightbox(picture, editMode = false) {
    const lightbox = document.getElementById('pictureLightbox');
    if (!lightbox) return;

    const img = lightbox.querySelector('.image-lightbox__image');
    const metaTitle = lightbox.querySelector('.lightbox__meta-title');
    const metaDescription = lightbox.querySelector('.lightbox__meta-description');
    const counter = lightbox.querySelector('.lightbox__counter');
    const titleInput = lightbox.querySelector('.lightbox__title-input');
    const descriptionInput = lightbox.querySelector('.lightbox__description-input');

    img.src = picture.urls.large;
    img.alt = picture.title || 'Picture';

    metaTitle.textContent = picture.title || 'Untitled';
    metaDescription.textContent = picture.description || '';
    metaDescription.style.display = picture.description ? 'block' : 'none';

    if (counter && this.currentPictures.length > 1) {
      counter.textContent = `${this.currentPictureIndex + 1} / ${this.currentPictures.length}`;
    }

    // Set input values
    titleInput.value = picture.title || '';
    descriptionInput.value = picture.description || '';

    if (editMode) {
      this.togglePictureEditMode(true);
    }
  }

  /**
   * Toggle picture edit mode
   * @param {boolean} enabled - Whether edit mode is enabled
   */
  togglePictureEditMode(enabled) {
    const lightbox = document.getElementById('pictureLightbox');
    if (!lightbox) return;

    const viewSection = document.getElementById('lightboxMetaView');
    const editSection = document.getElementById('lightboxMetaEdit');
    const footerView = document.getElementById('lightboxFooterView');
    const footerEdit = document.getElementById('lightboxFooterEdit');

    if (enabled) {
      viewSection.style.display = 'none';
      editSection.style.display = 'block';
      footerView.style.display = 'none';
      footerEdit.style.display = 'flex';
    } else {
      viewSection.style.display = 'block';
      editSection.style.display = 'none';
      footerView.style.display = 'flex';
      footerEdit.style.display = 'none';

      // Reset inputs to current values
      const picture = this.currentPictures[this.currentPictureIndex];
      const titleInput = lightbox.querySelector('.lightbox__title-input');
      const descriptionInput = lightbox.querySelector('.lightbox__description-input');
      titleInput.value = picture.title || '';
      descriptionInput.value = picture.description || '';
    }
  }

  /**
   * Save picture metadata from lightbox
   */
  async savePictureMetadata() {
    const lightbox = document.getElementById('pictureLightbox');
    if (!lightbox) return;

    const titleInput = lightbox.querySelector('.lightbox__title-input');
    const descriptionInput = lightbox.querySelector('.lightbox__description-input');
    const picture = this.currentPictures[this.currentPictureIndex];

    const newTitle = titleInput.value.trim() || 'Untitled';
    const newDescription = descriptionInput.value.trim() || null;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/galleries/${this.currentGalleryForPictures.id}/pictures/${picture.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getCsrfHeaders({ 'Accept': 'application/json' }),
        body: JSON.stringify({
          title: newTitle,
          description: newDescription
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update picture');
      }

      // Update local data
      picture.title = newTitle;
      picture.description = newDescription;

      this.showToast('Picture updated successfully', 'success');
      this.togglePictureEditMode(false);
      this.updatePictureLightbox(picture, false);

      // Reload pictures to update the grid
      if (this.currentGalleryForPictures) {
        this.loadGalleryPictures(this.currentGalleryForPictures.id);
      }
    } catch (error) {
      console.error('Failed to update picture:', error);
      this.showToast(error.message, 'error');
    }
  }

  /**
   * Navigate picture lightbox
   * @param {number} direction - Direction to navigate (-1 or 1)
   */
  navigatePictureLightbox(direction) {
    const newIndex = this.currentPictureIndex + direction;
    if (newIndex >= 0 && newIndex < this.currentPictures.length) {
      this.currentPictureIndex = newIndex;
      const picture = this.currentPictures[newIndex];
      this.updatePictureLightbox(picture, false);
    }
  }

  /**
   * Close picture lightbox
   */
  closePictureLightbox() {
    console.log('Closing picture lightbox');
    const lightbox = document.getElementById('pictureLightbox');
    if (!lightbox) return;

    lightbox.classList.remove('image-lightbox--open');
    document.body.style.overflow = '';

    if (this.pictureLightboxKeyHandler) {
      document.removeEventListener('keydown', this.pictureLightboxKeyHandler);
      this.pictureLightboxKeyHandler = null;
    }

    this.currentPictures = null;
    this.currentPictureIndex = -1;
  }

  /**
   * Handle add pictures button click
   * Shows upload interface within the modal
   */
  handleAddPictures() {
    if (!this.currentGalleryForPictures) {
      this.showToast('No gallery selected', 'error');
      return;
    }

    // Show upload section, hide pictures grid
    const uploadSection = document.getElementById('uploadSection');
    const picturesGrid = document.getElementById('picturesGrid');
    const picturesEmpty = document.getElementById('picturesEmpty');
    const addPictureBtn = document.getElementById('addPictureBtn');

    if (uploadSection) uploadSection.style.display = 'block';
    if (picturesGrid) picturesGrid.style.display = 'none';
    if (picturesEmpty) picturesEmpty.style.display = 'none';
    if (addPictureBtn) addPictureBtn.style.display = 'none';
  }

  /**
   * Trigger file input click
   */
  triggerFileInput() {
    const fileInput = document.getElementById('pictureFileInput');
    if (fileInput) {
      fileInput.click();
    }
  }

  /**
   * Handle file selection from input
   * @param {Event} e - Change event
   */
  handleFileSelect(e) {
    const files = Array.from(e.target.files);
    this.processFiles(files);
  }

  /**
   * Handle drag over event
   * @param {DragEvent} e - Drag event
   */
  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('upload-drop-zone--active');
  }

  /**
   * Handle drag leave event
   * @param {DragEvent} e - Drag event
   */
  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('upload-drop-zone--active');
  }

  /**
   * Handle file drop event
   * @param {DragEvent} e - Drop event
   */
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('upload-drop-zone--active');

    const files = Array.from(e.dataTransfer.files);
    this.processFiles(files);
  }

  /**
   * Process selected files
   * @param {Array} files - Array of File objects
   */
  processFiles(files) {
    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      this.showToast('Please select valid image files', 'error');
      return;
    }

    // Check file sizes (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    const validFiles = imageFiles.filter(file => {
      if (file.size > maxSize) {
        this.showToast(`${file.name} exceeds 10MB limit`, 'error');
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    this.selectedFiles = validFiles;

    // Initialize metadata for each file with default title (filename without extension)
    this.fileMetadata = validFiles.map(file => ({
      title: file.name.replace(/\.[^/.]+$/, ''),
      description: ''
    }));

    this.showFilePreview();
  }

  /**
   * Show preview of selected files
   */
  showFilePreview() {
    const uploadDropZone = document.getElementById('uploadDropZone');
    const uploadPreview = document.getElementById('uploadPreview');
    const uploadActions = document.querySelector('.upload-actions');
    const uploadBtn = document.getElementById('uploadFilesBtn');

    if (uploadDropZone) uploadDropZone.style.display = 'none';
    if (uploadPreview) {
      uploadPreview.style.display = 'grid';
      uploadPreview.innerHTML = '';

      this.selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = document.createElement('div');
          preview.className = 'upload-preview__item';
          preview.dataset.index = index;
          preview.innerHTML = `
            <img src="${e.target.result}" alt="${this.escapeHtml(file.name)}" class="upload-preview__image">
            <div class="upload-preview__info">
              <span class="upload-preview__name">${this.escapeHtml(file.name)}</span>
              <span class="upload-preview__size">${this.formatFileSize(file.size)}</span>
            </div>
            <button type="button" class="upload-preview__edit" data-index="${index}" aria-label="Edit details">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button type="button" class="upload-preview__remove" data-index="${index}" aria-label="Remove file">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          `;

          // Add click to image for lightbox
          const img = preview.querySelector('.upload-preview__image');
          if (img) {
            img.addEventListener('click', () => this.openLightbox(index));
          }

          // Add edit button listener
          const editBtn = preview.querySelector('.upload-preview__edit');
          if (editBtn) {
            editBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.openLightbox(index);
            });
          }

          // Add remove button listener
          const removeBtn = preview.querySelector('.upload-preview__remove');
          if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.removeFile(index);
            });
          }

          uploadPreview.appendChild(preview);
        };
        reader.readAsDataURL(file);
      });
    }

    if (uploadActions) uploadActions.style.display = 'flex';
    if (uploadBtn) uploadBtn.disabled = false;
  }

  /**
   * Remove file from selection
   * @param {number} index - File index
   */
  removeFile(index) {
    this.selectedFiles.splice(index, 1);

    if (this.selectedFiles.length === 0) {
      this.cancelUpload();
    } else {
      this.showFilePreview();
    }
  }

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Cancel upload and reset UI
   */
  cancelUpload() {
    this.selectedFiles = [];
    this.fileMetadata = [];

    const uploadSection = document.getElementById('uploadSection');
    const uploadDropZone = document.getElementById('uploadDropZone');
    const uploadPreview = document.getElementById('uploadPreview');
    const uploadActions = document.querySelector('.upload-actions');
    const uploadBtn = document.getElementById('uploadFilesBtn');
    const progressContainer = document.getElementById('uploadProgress');
    const progressText = document.getElementById('uploadProgressText');
    const progressFill = document.getElementById('uploadProgressFill');
    const picturesGrid = document.getElementById('picturesGrid');
    const picturesEmpty = document.getElementById('picturesEmpty');
    const addPictureBtn = document.getElementById('addPictureBtn');
    const fileInput = document.getElementById('pictureFileInput');

    if (uploadSection) uploadSection.style.display = 'none';
    if (uploadDropZone) uploadDropZone.style.display = 'block';
    if (uploadPreview) {
      uploadPreview.style.display = 'none';
      uploadPreview.innerHTML = '';
    }
    if (uploadActions) uploadActions.style.display = 'none';
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.querySelector('.btn__text').textContent = 'Upload & Add to Gallery';
    }
    if (progressContainer && progressText && progressFill) {
      progressContainer.style.display = 'none';
      progressText.textContent = '0/0';
      progressFill.style.width = '0%';
    }
    if (picturesGrid) picturesGrid.style.display = 'grid';
    if (addPictureBtn) addPictureBtn.style.display = 'inline-flex';
    if (fileInput) fileInput.value = '';

    // Show empty state if no pictures
    if (this.currentGalleryForPictures) {
      this.loadGalleryPictures(this.currentGalleryForPictures.id);
    }
  }

  /**
   * Upload files and add them to the gallery
   */
  async uploadAndAddPictures() {
    if (!this.currentGalleryForPictures || this.selectedFiles.length === 0) {
      return;
    }

    const uploadBtn = document.getElementById('uploadFilesBtn');
    const progressContainer = document.getElementById('uploadProgress');
    const progressText = document.getElementById('uploadProgressText');
    const progressFill = document.getElementById('uploadProgressFill');
    const totalUploads = this.selectedFiles.length;

    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.querySelector('.btn__text').textContent = 'Uploading...';
    }

    if (progressContainer && progressText && progressFill) {
      progressContainer.style.display = 'flex';
      progressText.textContent = `0/${totalUploads}`;
      progressFill.style.width = '0%';
    }

    try {
      // Upload each file and add to gallery
      for (let i = 0; i < this.selectedFiles.length; i++) {
        const file = this.selectedFiles[i];
        const metadata = this.fileMetadata[i];

        // Upload file
        const uploadId = await this.uploadFile(file);

        // Add to gallery with metadata
        await this.addPictureToGallery(uploadId, metadata.title, metadata.description);

        const completed = i + 1;
        if (progressContainer && progressText && progressFill) {
          progressText.textContent = `${completed}/${totalUploads}`;
          progressFill.style.width = `${Math.round((completed / totalUploads) * 100)}%`;
        }
      }

      this.showToast(`${this.selectedFiles.length} picture(s) added successfully`, 'success');

      // Reset and reload
      this.cancelUpload();
      await this.loadGalleryPictures(this.currentGalleryForPictures.id);

      // Reload galleries list to update picture counts and cover images
      await this.loadGalleries();
    } catch (error) {
      console.error('Failed to upload pictures:', error);
      this.showToast(error.message, 'error');

      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.querySelector('.btn__text').textContent = 'Upload & Add to Gallery';
      }
    }
  }

  /**
   * Upload a single file
   * @param {File} file - File to upload
   * @returns {Promise<number>} Upload ID
   */
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-TOKEN'] = csrfToken;
    }

    const response = await fetch(`${this.baseUrl}/api/v1/upload/public`, {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload file');
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Add uploaded picture to gallery
   * @param {number} uploadId - Upload ID
   * @param {string} title - Picture title
   * @param {string} description - Picture description
   */
  async addPictureToGallery(uploadId, title, description) {
    const response = await fetch(`${this.baseUrl}/api/v1/galleries/${this.currentGalleryForPictures.id}/pictures`, {
      method: 'POST',
      credentials: 'include',
      headers: getCsrfHeaders({ 'Accept': 'application/json' }),
      body: JSON.stringify({
        upload_id: uploadId,
        title: title || 'Untitled',
        description: description || null
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add picture to gallery');
    }

    return response.json();
  }

  /**
   * Open a modal
   * @param {HTMLElement} modal - Modal element
   */
  openModal(modal) {
    modal.classList.add('modal--open');
    modal.setAttribute('aria-hidden', 'false');
  }

  /**
   * Close a modal
   * @param {HTMLElement} modal - Modal element
   */
  closeModal(modal) {
    modal.classList.remove('modal--open');
    modal.setAttribute('aria-hidden', 'true');

    // Reload galleries when pictures modal is closed to update counts
    if (modal && modal.id === 'picturesModal') {
      this.loadGalleries();
    }
  }

  /**
   * Show loading state
   */
  showLoadingState() {
    this.loadingState.style.display = 'block';
    this.errorState.style.display = 'none';
    this.emptyState.style.display = 'none';
    this.galleriesGrid.style.display = 'none';
  }

  /**
   * Show error state
   * @param {string} message - Error message
   */
  showErrorState(message) {
    this.loadingState.style.display = 'none';
    this.errorState.style.display = 'block';
    this.emptyState.style.display = 'none';
    this.galleriesGrid.style.display = 'none';

    const messageEl = this.errorState.querySelector('.error-state__message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.loadingState.style.display = 'none';
    this.errorState.style.display = 'none';
    this.emptyState.style.display = 'block';
    this.galleriesGrid.style.display = 'none';
  }

  /**
   * Show content state
   */
  showContentState() {
    this.loadingState.style.display = 'none';
    this.errorState.style.display = 'none';
    this.emptyState.style.display = 'none';
    this.galleriesGrid.style.display = 'grid';
  }

  /**
   * Clear form validation errors
   */
  clearFormErrors() {
    const errorElements = document.querySelectorAll('.form__error');
    errorElements.forEach(el => {
      el.textContent = '';
    });
  }

  /**
   * Show field error
   * @param {string} fieldId - Error element ID
   * @param {string} message - Error message
   */
  showFieldError(fieldId, message) {
    const errorEl = document.getElementById(fieldId);
    if (errorEl) {
      errorEl.textContent = message;
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Open lightbox to edit image metadata
   * @param {number} index - Index of the file in selectedFiles array
   */
  openLightbox(index) {
    if (index < 0 || index >= this.selectedFiles.length) return;

    this.currentLightboxIndex = index;
    const file = this.selectedFiles[index];
    const metadata = this.fileMetadata[index];

    // Set lightbox image
    const lightboxImage = document.getElementById('lightboxImage');
    if (lightboxImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        lightboxImage.src = e.target.result;
        lightboxImage.alt = file.name;
      };
      reader.readAsDataURL(file);
    }

    // Set form values
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDescription = document.getElementById('lightboxDescription');
    const lightboxFileIndex = document.getElementById('lightboxFileIndex');

    if (lightboxTitle) lightboxTitle.value = metadata.title;
    if (lightboxDescription) lightboxDescription.value = metadata.description || '';
    if (lightboxFileIndex) lightboxFileIndex.value = index;

    // Update navigation buttons
    this.updateLightboxNav();

    // Show lightbox
    const lightbox = document.getElementById('imageLightbox');
    if (lightbox) {
      lightbox.classList.add('image-lightbox--open');
      lightbox.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Close lightbox
   */
  closeLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    if (lightbox) {
      lightbox.classList.remove('image-lightbox--open');
      lightbox.setAttribute('aria-hidden', 'true');
    }

    // Clear form
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDescription = document.getElementById('lightboxDescription');
    if (lightboxTitle) lightboxTitle.value = '';
    if (lightboxDescription) lightboxDescription.value = '';

    this.currentLightboxIndex = 0;
  }

  /**
   * Navigate to previous or next image in lightbox
   * @param {number} direction - -1 for previous, 1 for next
   */
  navigateLightbox(direction) {
    const newIndex = this.currentLightboxIndex + direction;
    if (newIndex >= 0 && newIndex < this.selectedFiles.length) {
      // Save current metadata without validation (just save whatever is there)
      const lightboxTitle = document.getElementById('lightboxTitle');
      const lightboxDescription = document.getElementById('lightboxDescription');

      if (lightboxTitle && this.currentLightboxIndex >= 0 && this.currentLightboxIndex < this.fileMetadata.length) {
        this.fileMetadata[this.currentLightboxIndex] = {
          title: lightboxTitle.value.trim() || this.fileMetadata[this.currentLightboxIndex].title,
          description: lightboxDescription ? lightboxDescription.value.trim() : ''
        };
      }

      // Open lightbox at new index
      this.openLightbox(newIndex);
    }
  }

  /**
   * Update lightbox navigation button states
   */
  updateLightboxNav() {
    const prevBtn = document.getElementById('lightboxPrevBtn');
    const nextBtn = document.getElementById('lightboxNextBtn');

    if (prevBtn) {
      prevBtn.disabled = this.currentLightboxIndex === 0;
    }

    if (nextBtn) {
      nextBtn.disabled = this.currentLightboxIndex === this.selectedFiles.length - 1;
    }
  }

  /**
   * Save lightbox metadata
   * @param {boolean} close - Whether to close lightbox after saving (default: true)
   */
  saveLightboxMetadata(close = true) {
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDescription = document.getElementById('lightboxDescription');
    const lightboxFileIndex = document.getElementById('lightboxFileIndex');

    if (!lightboxTitle || !lightboxFileIndex) return;

    const index = parseInt(lightboxFileIndex.value, 10);
    if (isNaN(index) || index < 0 || index >= this.selectedFiles.length) return;

    const title = lightboxTitle.value.trim();

    // Validate title
    if (!title) {
      this.showFieldError('lightboxTitleError', 'Title is required');
      return;
    }

    // Clear errors
    this.clearFieldErrors();

    // Save metadata
    this.fileMetadata[index] = {
      title: title,
      description: lightboxDescription ? lightboxDescription.value.trim() : ''
    };

    // Update preview item name
    const previewItem = document.querySelector(`.upload-preview__item[data-index="${index}"]`);
    if (previewItem) {
      const nameEl = previewItem.querySelector('.upload-preview__name');
      if (nameEl) {
        nameEl.textContent = title;
      }
    }

    if (close) {
      this.showToast('Image details saved', 'success');
      this.closeLightbox();
    }
  }
}
