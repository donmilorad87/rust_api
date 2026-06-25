import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * ProductEditPage Controller
 *
 * Handles the product edit page:
 * - Load existing product data
 * - Same form as create but pre-filled
 * - Cannot change product type after creation
 * - Update product via PUT request
 */
export class ProductEditPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;

    // Get product ID from URL or data attribute
    this.productId = this.getProductIdFromUrl();

    // State
    this.product = null;
    this.categories = [];
    this.galleries = [];
    this.galleryPictures = {};

    // Form data
    this.formData = {
      product_type: null,
      gallery_ids: [],
      picture_ids: [],
      cover_picture_id: null,
      title: '',
      slug: '',
      description: '',
      price_euros: '',
      category_id: null,
      // Metadata
      author: '',
      city: '',
      country: '',
      region: '',
      nearest_mountain: '',
      nearest_river: '',
      natural_park: '',
      altitude_meters: null,
      season: '',
      weather_conditions: '',
      camera_model: '',
      camera_settings: '',
      date_taken: '',
      gps_latitude: null,
      gps_longitude: null,
      tags: []
    };

    // DOM Elements
    this.editForm = document.getElementById('productEditForm');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.submitBtn = document.getElementById('updateProductBtn');
    this.cancelBtn = document.getElementById('cancelBtn');

    this.init();
  }

  /**
   * Get product ID from URL
   */
  getProductIdFromUrl() {
    // URL pattern: /admin/store/products/{id}/edit
    const pathParts = window.location.pathname.split('/');
    const editIndex = pathParts.indexOf('edit');
    if (editIndex > 0) {
      return parseInt(pathParts[editIndex - 1], 10);
    }
    return null;
  }

  /**
   * Initialize the page
   */
  async init() {
    if (!this.productId) {
      this.showToast('Invalid product ID', 'error');
      return;
    }

    this.bindEvents();
    this.showLoading();

    try {
      await Promise.all([
        this.loadProduct(),
        this.loadCategories(),
        this.loadGalleries()
      ]);

      this.populateForm();
    } catch (error) {
      console.error('Error initializing edit page:', error);
      this.showToast('Failed to load product data', 'error');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    if (this.editForm) {
      this.editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitForm();
      });
    }

    if (this.submitBtn) {
      this.submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitForm();
      });
    }

    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => {
        window.location.href = `${this.baseUrl}/admin/store/products`;
      });
    }

    // Title auto-slug (only if slug hasn't been manually edited)
    const titleInput = document.getElementById('productTitle');
    const slugInput = document.getElementById('productSlug');
    if (titleInput && slugInput) {
      titleInput.addEventListener('input', (e) => {
        this.formData.title = e.target.value;
        // Don't auto-generate slug for existing products
      });
      slugInput.addEventListener('input', (e) => {
        this.formData.slug = e.target.value;
      });
    }
  }

  /**
   * Load product data
   */
  async loadProduct() {
    const response = await fetch(`${this.baseUrl}/api/v1/admin/store/products/${this.productId}`, {
      method: 'GET',
      headers: getCsrfHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to load product');
    }

    const data = await response.json();
    if (data.status === 'success') {
      this.product = data.product;
      this.mapProductToFormData();
    } else {
      throw new Error(data.message || 'Failed to load product');
    }
  }

  /**
   * Map product data to form data
   */
  mapProductToFormData() {
    if (!this.product) return;

    this.formData.product_type = this.product.product_type;
    this.formData.gallery_ids = this.product.gallery_ids || [];
    this.formData.picture_ids = this.product.picture_ids || [];
    this.formData.cover_picture_id = this.product.cover_picture_id;
    this.formData.title = this.product.title || '';
    this.formData.slug = this.product.slug || '';
    this.formData.description = this.product.description || '';
    this.formData.price_euros = this.product.price_cents ? (this.product.price_cents / 100).toFixed(2) : '';
    this.formData.category_id = this.product.category_id;

    // Metadata
    const meta = this.product.metadata || {};
    this.formData.author = meta.author || '';
    this.formData.city = meta.city || '';
    this.formData.country = meta.country || '';
    this.formData.region = meta.region || '';
    this.formData.nearest_mountain = meta.nearest_mountain || '';
    this.formData.nearest_river = meta.nearest_river || '';
    this.formData.natural_park = meta.natural_park || '';
    this.formData.altitude_meters = meta.altitude_meters;
    this.formData.season = meta.season || '';
    this.formData.weather_conditions = meta.weather_conditions || '';
    this.formData.camera_model = meta.camera_model || '';
    this.formData.camera_settings = meta.camera_settings || '';
    this.formData.date_taken = meta.date_taken || '';
    this.formData.gps_latitude = meta.gps_latitude;
    this.formData.gps_longitude = meta.gps_longitude;
    this.formData.tags = this.product.tags || [];
  }

  /**
   * Load categories
   */
  async loadCategories() {
    const response = await fetch(`${this.baseUrl}/api/v1/admin/store/categories`, {
      method: 'GET',
      headers: getCsrfHeaders(),
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to load categories');

    const data = await response.json();
    if (data.status === 'success') {
      this.categories = data.categories || [];
    }
  }

  /**
   * Load galleries
   */
  async loadGalleries() {
    const response = await fetch(`${this.baseUrl}/api/v1/admin/store/galleries`, {
      method: 'GET',
      headers: getCsrfHeaders(),
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to load galleries');

    const data = await response.json();
    if (data.status === 'success') {
      this.galleries = data.galleries || [];
    }
  }

  /**
   * Populate form with product data
   */
  populateForm() {
    // Product type (disabled - cannot change)
    const typeDisplay = document.getElementById('productTypeDisplay');
    if (typeDisplay) {
      typeDisplay.textContent = this.getProductTypeLabel(this.formData.product_type);
    }

    // Basic info
    this.setInputValue('productTitle', this.formData.title);
    this.setInputValue('productSlug', this.formData.slug);
    this.setInputValue('productDescription', this.formData.description);
    this.setInputValue('productPrice', this.formData.price_euros);

    // Category dropdown
    this.renderCategoryDropdown();

    // Render content section (read-only for type)
    this.renderContentSection();

    // Metadata
    this.setInputValue('metaAuthor', this.formData.author);
    this.setInputValue('metaCity', this.formData.city);
    this.setInputValue('metaCountry', this.formData.country);
    this.setInputValue('metaRegion', this.formData.region);
    this.setInputValue('metaMountain', this.formData.nearest_mountain);
    this.setInputValue('metaRiver', this.formData.nearest_river);
    this.setInputValue('metaPark', this.formData.natural_park);
    this.setInputValue('metaAltitude', this.formData.altitude_meters);
    this.setInputValue('metaSeason', this.formData.season);
    this.setInputValue('metaWeather', this.formData.weather_conditions);
    this.setInputValue('metaCamera', this.formData.camera_model);
    this.setInputValue('metaCameraSettings', this.formData.camera_settings);
    this.setInputValue('metaDateTaken', this.formData.date_taken);
    this.setInputValue('metaLatitude', this.formData.gps_latitude);
    this.setInputValue('metaLongitude', this.formData.gps_longitude);
    this.setInputValue('metaTags', this.formData.tags.join(', '));
  }

  /**
   * Set input value helper
   */
  setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input && value != null) {
      input.value = value;
    }
  }

  /**
   * Render category dropdown
   */
  renderCategoryDropdown() {
    const select = document.getElementById('productCategory');
    if (!select) return;

    const options = ['<option value="">Select a category</option>'];
    for (const category of this.categories) {
      const selected = category.id === this.formData.category_id ? 'selected' : '';
      options.push(`<option value="${category.id}" ${selected}>${this.escapeHtml(category.name)}</option>`);
    }
    select.innerHTML = options.join('');

    select.addEventListener('change', (e) => {
      this.formData.category_id = e.target.value ? parseInt(e.target.value, 10) : null;
    });
  }

  /**
   * Render content section (galleries/pictures)
   */
  async renderContentSection() {
    const container = document.getElementById('contentSection');
    if (!container) return;

    // Load pictures for selected galleries
    for (const galleryId of this.formData.gallery_ids) {
      await this.loadGalleryPictures(galleryId);
    }

    let contentHtml = '';

    if (this.formData.product_type === 'single_image' || this.formData.product_type === 'bundle') {
      contentHtml = this.renderPictureSelector();
    } else if (this.formData.product_type === 'gallery') {
      contentHtml = this.renderGallerySelector();
    }

    container.innerHTML = contentHtml;
    this.bindContentEvents();
  }

  /**
   * Load gallery pictures
   */
  async loadGalleryPictures(galleryId) {
    if (this.galleryPictures[galleryId]) return;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/galleries/${galleryId}/pictures`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          this.galleryPictures[galleryId] = data.pictures || [];
        }
      }
    } catch (error) {
      console.error('Error loading pictures:', error);
    }
  }

  /**
   * Render picture selector
   */
  renderPictureSelector() {
    let pictures = [];
    for (const galleryId of this.formData.gallery_ids) {
      if (this.galleryPictures[galleryId]) {
        pictures = pictures.concat(this.galleryPictures[galleryId]);
      }
    }

    if (pictures.length === 0) {
      return '<p class="empty-state">No pictures available.</p>';
    }

    const isSingleImage = this.formData.product_type === 'single_image';

    return `
      <div class="content-selector">
        <h3>${isSingleImage ? 'Selected Image' : 'Selected Images'}</h3>
        <p class="content-hint">${isSingleImage ? 'The selected image for this product.' : 'Click images to add/remove from bundle. Star icon sets cover image.'}</p>
        <div class="picture-grid" id="pictureGrid">
          ${pictures.map(picture => `
            <div class="picture-card ${this.formData.picture_ids.includes(picture.id) ? 'picture-card--selected' : ''} ${this.formData.cover_picture_id === picture.id ? 'picture-card--cover' : ''}"
                 data-picture-id="${picture.id}"
                 role="button"
                 tabindex="0">
              <div class="picture-card__thumb">
                ${picture.thumbnail_url
                  ? `<img src="${picture.thumbnail_url}" alt="${this.escapeHtml(picture.title || 'Picture')}">`
                  : '<div class="picture-card__placeholder"></div>'}
              </div>
              ${!isSingleImage && this.formData.picture_ids.includes(picture.id) ? `
                <button type="button" class="picture-card__cover-btn ${this.formData.cover_picture_id === picture.id ? 'picture-card__cover-btn--active' : ''}"
                        data-picture-id="${picture.id}"
                        aria-label="Set as cover image">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${this.formData.cover_picture_id === picture.id ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                </button>
              ` : ''}
              <div class="picture-card__check">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render gallery selector
   */
  renderGallerySelector() {
    const selectedGallery = this.galleries.find(g => this.formData.gallery_ids.includes(g.id));

    return `
      <div class="content-selector">
        <h3>Selected Gallery</h3>
        <p class="content-hint">This product includes all images from the selected gallery.</p>
        ${selectedGallery ? `
          <div class="selected-gallery">
            <div class="gallery-card gallery-card--selected">
              <div class="gallery-card__thumb">
                ${selectedGallery.cover_image_url
                  ? `<img src="${selectedGallery.cover_image_url}" alt="${this.escapeHtml(selectedGallery.name)}">`
                  : '<div class="gallery-card__placeholder"></div>'}
              </div>
              <div class="gallery-card__info">
                <h4 class="gallery-card__name">${this.escapeHtml(selectedGallery.name)}</h4>
                <p class="gallery-card__count">${selectedGallery.picture_count || 0} pictures</p>
              </div>
            </div>
          </div>
        ` : '<p class="text-muted">No gallery selected.</p>'}

        ${this.formData.product_type === 'gallery' ? `
          <h4 style="margin-top: 1.5rem;">Select Cover Image</h4>
          <div class="picture-grid" id="pictureGrid">
            ${this.renderGalleryPicturesForCover()}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render gallery pictures for cover selection
   */
  renderGalleryPicturesForCover() {
    let pictures = [];
    for (const galleryId of this.formData.gallery_ids) {
      if (this.galleryPictures[galleryId]) {
        pictures = pictures.concat(this.galleryPictures[galleryId]);
      }
    }

    return pictures.map(picture => `
      <div class="picture-card ${this.formData.cover_picture_id === picture.id ? 'picture-card--cover' : ''}"
           data-picture-id="${picture.id}"
           data-action="set-cover"
           role="button"
           tabindex="0">
        <div class="picture-card__thumb">
          ${picture.thumbnail_url
            ? `<img src="${picture.thumbnail_url}" alt="${this.escapeHtml(picture.title || 'Picture')}">`
            : '<div class="picture-card__placeholder"></div>'}
        </div>
        <div class="picture-card__check">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${this.formData.cover_picture_id === picture.id ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </div>
      </div>
    `).join('');
  }

  /**
   * Bind content section events
   */
  bindContentEvents() {
    const pictureGrid = document.getElementById('pictureGrid');
    if (!pictureGrid) return;

    pictureGrid.querySelectorAll('.picture-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Check if clicking cover button
        if (e.target.closest('.picture-card__cover-btn')) {
          const pictureId = parseInt(e.target.closest('.picture-card__cover-btn').dataset.pictureId, 10);
          this.formData.cover_picture_id = pictureId;
          this.renderContentSection();
          return;
        }

        const pictureId = parseInt(card.dataset.pictureId, 10);

        if (card.dataset.action === 'set-cover') {
          // Gallery type: just set cover
          this.formData.cover_picture_id = pictureId;
        } else if (this.formData.product_type === 'single_image') {
          // Single image: select one
          this.formData.picture_ids = [pictureId];
          this.formData.cover_picture_id = pictureId;
        } else if (this.formData.product_type === 'bundle') {
          // Bundle: toggle selection
          const index = this.formData.picture_ids.indexOf(pictureId);
          if (index === -1) {
            this.formData.picture_ids.push(pictureId);
            if (!this.formData.cover_picture_id) {
              this.formData.cover_picture_id = pictureId;
            }
          } else {
            this.formData.picture_ids.splice(index, 1);
            if (this.formData.cover_picture_id === pictureId) {
              this.formData.cover_picture_id = this.formData.picture_ids[0] || null;
            }
          }
        }

        this.renderContentSection();
      });
    });
  }

  /**
   * Collect form data before submit
   */
  collectFormData() {
    this.formData.title = document.getElementById('productTitle')?.value || '';
    this.formData.slug = document.getElementById('productSlug')?.value || '';
    this.formData.description = document.getElementById('productDescription')?.value || '';
    this.formData.price_euros = document.getElementById('productPrice')?.value || '';
    const categorySelect = document.getElementById('productCategory');
    this.formData.category_id = categorySelect?.value ? parseInt(categorySelect.value, 10) : null;

    // Metadata
    this.formData.author = document.getElementById('metaAuthor')?.value || '';
    this.formData.city = document.getElementById('metaCity')?.value || '';
    this.formData.country = document.getElementById('metaCountry')?.value || '';
    this.formData.region = document.getElementById('metaRegion')?.value || '';
    this.formData.nearest_mountain = document.getElementById('metaMountain')?.value || '';
    this.formData.nearest_river = document.getElementById('metaRiver')?.value || '';
    this.formData.natural_park = document.getElementById('metaPark')?.value || '';
    const altitude = document.getElementById('metaAltitude')?.value;
    this.formData.altitude_meters = altitude ? parseInt(altitude, 10) : null;
    this.formData.season = document.getElementById('metaSeason')?.value || '';
    this.formData.weather_conditions = document.getElementById('metaWeather')?.value || '';
    this.formData.camera_model = document.getElementById('metaCamera')?.value || '';
    this.formData.camera_settings = document.getElementById('metaCameraSettings')?.value || '';
    this.formData.date_taken = document.getElementById('metaDateTaken')?.value || '';
    const lat = document.getElementById('metaLatitude')?.value;
    const lng = document.getElementById('metaLongitude')?.value;
    this.formData.gps_latitude = lat ? parseFloat(lat) : null;
    this.formData.gps_longitude = lng ? parseFloat(lng) : null;

    // Tags
    const tagsInput = document.getElementById('metaTags');
    if (tagsInput) {
      this.formData.tags = tagsInput.value
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
    }
  }

  /**
   * Submit the form
   */
  async submitForm() {
    this.collectFormData();

    // Validate
    if (!this.formData.title.trim()) {
      this.showToast('Please enter a product title', 'warning');
      return;
    }
    if (!this.formData.price_euros || parseFloat(this.formData.price_euros) <= 0) {
      this.showToast('Please enter a valid price', 'warning');
      return;
    }

    const priceCents = Math.round(parseFloat(this.formData.price_euros) * 100);
    const payload = {
      title: this.formData.title.trim(),
      slug: this.formData.slug.trim() || null,
      description: this.formData.description.trim() || null,
      price_cents: priceCents,
      category_id: this.formData.category_id,
      picture_ids: this.formData.product_type === 'gallery' ? [] : this.formData.picture_ids,
      cover_picture_id: this.formData.cover_picture_id,
      metadata: {
        author: this.formData.author || null,
        city: this.formData.city || null,
        country: this.formData.country || null,
        region: this.formData.region || null,
        nearest_mountain: this.formData.nearest_mountain || null,
        nearest_river: this.formData.nearest_river || null,
        natural_park: this.formData.natural_park || null,
        altitude_meters: this.formData.altitude_meters,
        season: this.formData.season || null,
        weather_conditions: this.formData.weather_conditions || null,
        camera_model: this.formData.camera_model || null,
        camera_settings: this.formData.camera_settings || null,
        date_taken: this.formData.date_taken || null,
        gps_latitude: this.formData.gps_latitude,
        gps_longitude: this.formData.gps_longitude
      },
      tags: this.formData.tags
    };

    // Show loading state
    if (this.submitBtn) {
      this.submitBtn.disabled = true;
      this.submitBtn.innerHTML = '<span class="spinner"></span> Updating...';
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/products/${this.productId}`, {
        method: 'PUT',
        headers: {
          ...getCsrfHeaders(),
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update product');
      }

      if (data.status === 'success') {
        this.showToast('Product updated successfully!', 'success');
        // Redirect back to product list
        setTimeout(() => {
          window.location.href = `${this.baseUrl}/admin/store/products`;
        }, 1500);
      } else {
        throw new Error(data.message || 'Failed to update product');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      this.showToast(error.message || 'Failed to update product', 'error');
    } finally {
      if (this.submitBtn) {
        this.submitBtn.disabled = false;
        this.submitBtn.innerHTML = 'Update Product';
      }
    }
  }

  /**
   * Show loading overlay
   */
  showLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add('loading--visible');
    }
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.remove('loading--visible');
    }
  }

  /**
   * Get product type label
   */
  getProductTypeLabel(type) {
    const labels = {
      single_image: 'Single Image',
      gallery: 'Entire Gallery',
      bundle: 'Bundle'
    };
    return labels[type] || type;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
