import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * ProductCreatePage Controller
 *
 * Handles the product creation wizard:
 * - Step 1: Choose product type (single_image, gallery, bundle)
 * - Step 2: Select content (galleries and pictures)
 * - Step 3: Product details (title, slug, description, price, category)
 * - Step 4: Metadata (location, camera, tags, etc.)
 * - Step 5: Review & Create
 */
export class ProductCreatePage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.showToast = options.showToast;

    // State
    this.currentStep = 1;
    this.totalSteps = 5;
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

    // Loaded data
    this.galleries = [];
    this.galleryPictures = {};
    this.categories = [];
    this.selectedGallery = null;

    // DOM Elements
    this.wizardForm = document.getElementById('productWizardForm');
    this.stepIndicators = document.querySelectorAll('.step-indicator');
    this.stepPanels = document.querySelectorAll('.wizard-step');
    this.prevBtn = document.getElementById('prevStepBtn');
    this.nextBtn = document.getElementById('nextStepBtn');
    this.submitBtn = document.getElementById('submitBtn');

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.bindEvents();
    this.loadInitialData();
    this.updateStepUI();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Navigation buttons
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.goToPreviousStep());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.goToNextStep());
    }
    if (this.submitBtn) {
      this.submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.submitForm();
      });
    }

    // Step 1: Product type selection
    document.querySelectorAll('[name="product_type"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.formData.product_type = e.target.value;
        this.resetContentSelection();
        this.updateStepUI();
      });
    });

    // Title auto-slug
    const titleInput = document.getElementById('productTitle');
    const slugInput = document.getElementById('productSlug');
    if (titleInput && slugInput) {
      titleInput.addEventListener('input', (e) => {
        this.formData.title = e.target.value;
        if (!slugInput.dataset.manualEdit) {
          const slug = this.generateSlug(e.target.value);
          slugInput.value = slug;
          this.formData.slug = slug;
        }
      });
      slugInput.addEventListener('input', (e) => {
        slugInput.dataset.manualEdit = 'true';
        this.formData.slug = e.target.value;
      });
    }
  }

  /**
   * Load initial data (galleries, categories)
   */
  async loadInitialData() {
    try {
      await Promise.all([
        this.loadGalleries(),
        this.loadCategories()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      this.showToast('Failed to load data', 'error');
    }
  }

  /**
   * Load galleries for selection
   */
  async loadGalleries() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/galleries`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to load galleries');

      const data = await response.json();
      if (data.status === 'success') {
        this.galleries = data.galleries || [];
        this.renderGalleryList();
      }
    } catch (error) {
      console.error('Error loading galleries:', error);
    }
  }

  /**
   * Load categories for dropdown
   */
  async loadCategories() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/categories`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to load categories');

      const data = await response.json();
      if (data.status === 'success') {
        this.categories = data.categories || [];
        this.renderCategoryDropdown();
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  /**
   * Render gallery list for step 2
   */
  renderGalleryList() {
    const container = document.getElementById('galleryList');
    if (!container) return;

    if (this.galleries.length === 0) {
      container.innerHTML = '<p class="empty-state">No galleries available.</p>';
      return;
    }

    const html = this.galleries.map(gallery => `
      <div class="gallery-card ${this.formData.gallery_ids.includes(gallery.id) ? 'gallery-card--selected' : ''}"
           data-gallery-id="${gallery.id}"
           role="button"
           tabindex="0"
           aria-pressed="${this.formData.gallery_ids.includes(gallery.id)}">
        <div class="gallery-card__thumb">
          ${gallery.cover_image_url
            ? `<img src="${gallery.cover_image_url}" alt="${this.escapeHtml(gallery.name)}">`
            : '<div class="gallery-card__placeholder"></div>'}
        </div>
        <div class="gallery-card__info">
          <h4 class="gallery-card__name">${this.escapeHtml(gallery.name)}</h4>
          <p class="gallery-card__count">${gallery.picture_count || 0} pictures</p>
        </div>
        <div class="gallery-card__check">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.gallery-card').forEach(card => {
      card.addEventListener('click', () => this.handleGallerySelect(card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleGallerySelect(card);
        }
      });
    });
  }

  /**
   * Handle gallery selection
   */
  async handleGallerySelect(card) {
    const galleryId = parseInt(card.dataset.galleryId, 10);

    if (this.formData.product_type === 'single_image') {
      // Single image: select one gallery at a time
      this.formData.gallery_ids = [galleryId];
      this.selectedGallery = galleryId;
      this.formData.picture_ids = [];
      this.formData.cover_picture_id = null;
      await this.loadGalleryPictures(galleryId);
    } else if (this.formData.product_type === 'gallery') {
      // Gallery: select one gallery
      this.formData.gallery_ids = [galleryId];
      this.selectedGallery = galleryId;
      await this.loadGalleryPictures(galleryId);
    } else if (this.formData.product_type === 'bundle') {
      // Bundle: select multiple galleries
      const index = this.formData.gallery_ids.indexOf(galleryId);
      if (index === -1) {
        this.formData.gallery_ids.push(galleryId);
        await this.loadGalleryPictures(galleryId);
      } else {
        this.formData.gallery_ids.splice(index, 1);
        // Remove pictures from this gallery
        if (this.galleryPictures[galleryId]) {
          const pictureIds = this.galleryPictures[galleryId].map(p => p.id);
          this.formData.picture_ids = this.formData.picture_ids.filter(id => !pictureIds.includes(id));
        }
      }
    }

    this.renderGalleryList();
    this.renderPictureGrid();
    this.updateStepUI();
  }

  /**
   * Load pictures for a gallery
   */
  async loadGalleryPictures(galleryId) {
    if (this.galleryPictures[galleryId]) return; // Already loaded

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/galleries/${galleryId}/pictures`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to load pictures');

      const data = await response.json();
      if (data.status === 'success') {
        this.galleryPictures[galleryId] = data.pictures || [];
        this.renderPictureGrid();
      }
    } catch (error) {
      console.error('Error loading pictures:', error);
    }
  }

  /**
   * Render picture grid for selection
   */
  renderPictureGrid() {
    const container = document.getElementById('pictureGrid');
    if (!container) return;

    // Collect all pictures from selected galleries
    let pictures = [];
    for (const galleryId of this.formData.gallery_ids) {
      if (this.galleryPictures[galleryId]) {
        pictures = pictures.concat(this.galleryPictures[galleryId]);
      }
    }

    if (pictures.length === 0) {
      container.innerHTML = '<p class="empty-state">Select a gallery to see pictures.</p>';
      return;
    }

    const isSingleImage = this.formData.product_type === 'single_image';
    const isBundle = this.formData.product_type === 'bundle';

    const html = pictures.map(picture => `
      <div class="picture-card ${this.formData.picture_ids.includes(picture.id) ? 'picture-card--selected' : ''} ${this.formData.cover_picture_id === picture.id ? 'picture-card--cover' : ''}"
           data-picture-id="${picture.id}"
           role="button"
           tabindex="0"
           aria-pressed="${this.formData.picture_ids.includes(picture.id)}">
        <div class="picture-card__thumb">
          ${picture.thumbnail_url
            ? `<img src="${picture.thumbnail_url}" alt="${this.escapeHtml(picture.title || 'Picture')}">`
            : '<div class="picture-card__placeholder"></div>'}
        </div>
        ${this.formData.picture_ids.includes(picture.id) ? `
          <button type="button" class="picture-card__cover-btn ${this.formData.cover_picture_id === picture.id ? 'picture-card__cover-btn--active' : ''}"
                  data-picture-id="${picture.id}"
                  aria-label="Set as cover image"
                  title="Set as cover">
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
    `).join('');

    container.innerHTML = html;

    // Bind click events
    container.querySelectorAll('.picture-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Check if clicking cover button
        if (e.target.closest('.picture-card__cover-btn')) {
          this.handleSetCover(card);
        } else {
          this.handlePictureSelect(card, isSingleImage, isBundle);
        }
      });
    });

    // Bind cover button events
    container.querySelectorAll('.picture-card__cover-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pictureId = parseInt(btn.dataset.pictureId, 10);
        this.formData.cover_picture_id = pictureId;
        this.renderPictureGrid();
      });
    });
  }

  /**
   * Handle picture selection
   */
  handlePictureSelect(card, isSingleImage, isBundle) {
    const pictureId = parseInt(card.dataset.pictureId, 10);

    if (isSingleImage) {
      // Single image: select exactly one
      this.formData.picture_ids = [pictureId];
      this.formData.cover_picture_id = pictureId;
    } else if (isBundle) {
      // Bundle: select multiple
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
    } else {
      // Gallery: all pictures are included, just set cover
      this.formData.cover_picture_id = pictureId;
    }

    this.renderPictureGrid();
    this.updateStepUI();
  }

  /**
   * Handle set cover
   */
  handleSetCover(card) {
    const pictureId = parseInt(card.dataset.pictureId, 10);
    this.formData.cover_picture_id = pictureId;
    this.renderPictureGrid();
  }

  /**
   * Render category dropdown
   */
  renderCategoryDropdown() {
    const select = document.getElementById('productCategory');
    if (!select) return;

    const options = ['<option value="">Select a category</option>'];
    for (const category of this.categories) {
      options.push(`<option value="${category.id}">${this.escapeHtml(category.name)}</option>`);
    }
    select.innerHTML = options.join('');

    select.addEventListener('change', (e) => {
      this.formData.category_id = e.target.value ? parseInt(e.target.value, 10) : null;
    });
  }

  /**
   * Reset content selection when product type changes
   */
  resetContentSelection() {
    this.formData.gallery_ids = [];
    this.formData.picture_ids = [];
    this.formData.cover_picture_id = null;
    this.selectedGallery = null;
    this.renderGalleryList();
    this.renderPictureGrid();
  }

  /**
   * Go to previous step
   */
  goToPreviousStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStepUI();
    }
  }

  /**
   * Go to next step
   */
  goToNextStep() {
    if (!this.validateCurrentStep()) {
      return;
    }

    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.updateStepUI();

      // If moving to review step, render the review
      if (this.currentStep === 5) {
        this.renderReview();
      }
    }
  }

  /**
   * Validate current step
   */
  validateCurrentStep() {
    switch (this.currentStep) {
      case 1:
        if (!this.formData.product_type) {
          this.showToast('Please select a product type', 'warning');
          return false;
        }
        break;
      case 2:
        if (this.formData.gallery_ids.length === 0) {
          this.showToast('Please select at least one gallery', 'warning');
          return false;
        }
        if (this.formData.product_type === 'single_image' && this.formData.picture_ids.length !== 1) {
          this.showToast('Please select exactly one picture', 'warning');
          return false;
        }
        if (this.formData.product_type === 'bundle' && this.formData.picture_ids.length === 0) {
          this.showToast('Please select at least one picture for the bundle', 'warning');
          return false;
        }
        break;
      case 3:
        this.collectFormData();
        if (!this.formData.title.trim()) {
          this.showToast('Please enter a product title', 'warning');
          return false;
        }
        if (!this.formData.price_euros || parseFloat(this.formData.price_euros) <= 0) {
          this.showToast('Please enter a valid price', 'warning');
          return false;
        }
        break;
      case 4:
        this.collectMetadata();
        break;
    }
    return true;
  }

  /**
   * Collect form data from step 3
   */
  collectFormData() {
    this.formData.title = document.getElementById('productTitle')?.value || '';
    this.formData.slug = document.getElementById('productSlug')?.value || '';
    this.formData.description = document.getElementById('productDescription')?.value || '';
    this.formData.price_euros = document.getElementById('productPrice')?.value || '';
    const categorySelect = document.getElementById('productCategory');
    this.formData.category_id = categorySelect?.value ? parseInt(categorySelect.value, 10) : null;
  }

  /**
   * Collect metadata from step 4
   */
  collectMetadata() {
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
   * Update step UI (indicators and panels)
   */
  updateStepUI() {
    // Update step indicators
    this.stepIndicators.forEach((indicator, index) => {
      const stepNum = index + 1;
      indicator.classList.remove('step-indicator--active', 'step-indicator--completed');
      if (stepNum < this.currentStep) {
        indicator.classList.add('step-indicator--completed');
      } else if (stepNum === this.currentStep) {
        indicator.classList.add('step-indicator--active');
      }
    });

    // Update step panels
    this.stepPanels.forEach((panel, index) => {
      const stepNum = index + 1;
      panel.hidden = stepNum !== this.currentStep;
    });

    // Update navigation buttons
    if (this.prevBtn) {
      this.prevBtn.style.display = this.currentStep === 1 ? 'none' : 'inline-flex';
    }
    if (this.nextBtn) {
      this.nextBtn.style.display = this.currentStep === this.totalSteps ? 'none' : 'inline-flex';
    }
    if (this.submitBtn) {
      this.submitBtn.style.display = this.currentStep === this.totalSteps ? 'inline-flex' : 'none';
    }

    // Step 2: Update content selection UI based on product type
    if (this.currentStep === 2) {
      this.updateContentSelectionUI();
    }
  }

  /**
   * Update content selection UI based on product type
   */
  updateContentSelectionUI() {
    const singleImageHint = document.getElementById('singleImageHint');
    const galleryHint = document.getElementById('galleryHint');
    const bundleHint = document.getElementById('bundleHint');
    const pictureSection = document.getElementById('pictureSelectionSection');

    // Hide all hints
    [singleImageHint, galleryHint, bundleHint].forEach(el => {
      if (el) el.hidden = true;
    });

    // Show appropriate hint
    switch (this.formData.product_type) {
      case 'single_image':
        if (singleImageHint) singleImageHint.hidden = false;
        if (pictureSection) pictureSection.hidden = false;
        break;
      case 'gallery':
        if (galleryHint) galleryHint.hidden = false;
        if (pictureSection) pictureSection.hidden = false;
        break;
      case 'bundle':
        if (bundleHint) bundleHint.hidden = false;
        if (pictureSection) pictureSection.hidden = false;
        break;
    }
  }

  /**
   * Render review step
   */
  renderReview() {
    const container = document.getElementById('reviewContent');
    if (!container) return;

    const category = this.categories.find(c => c.id === this.formData.category_id);
    const priceEuros = parseFloat(this.formData.price_euros) || 0;

    let contentInfo = '';
    if (this.formData.product_type === 'single_image') {
      contentInfo = `<p><strong>Content:</strong> 1 image selected</p>`;
    } else if (this.formData.product_type === 'gallery') {
      const gallery = this.galleries.find(g => g.id === this.formData.gallery_ids[0]);
      contentInfo = `<p><strong>Content:</strong> Entire gallery "${this.escapeHtml(gallery?.name || 'Unknown')}"</p>`;
    } else if (this.formData.product_type === 'bundle') {
      contentInfo = `<p><strong>Content:</strong> ${this.formData.picture_ids.length} images from ${this.formData.gallery_ids.length} galleries</p>`;
    }

    container.innerHTML = `
      <div class="review-section">
        <h3>Basic Information</h3>
        <div class="review-grid">
          <p><strong>Title:</strong> ${this.escapeHtml(this.formData.title)}</p>
          <p><strong>Slug:</strong> /${this.escapeHtml(this.formData.slug)}</p>
          <p><strong>Type:</strong> ${this.getProductTypeLabel(this.formData.product_type)}</p>
          <p><strong>Category:</strong> ${category ? this.escapeHtml(category.name) : 'None'}</p>
          <p><strong>Price:</strong> ${this.formatPrice(priceEuros * 100)}</p>
          ${contentInfo}
        </div>
        ${this.formData.description ? `<p><strong>Description:</strong> ${this.escapeHtml(this.formData.description)}</p>` : ''}
      </div>

      ${this.renderMetadataReview()}
    `;
  }

  /**
   * Render metadata review section
   */
  renderMetadataReview() {
    const hasMetadata = this.formData.author || this.formData.city || this.formData.country ||
      this.formData.camera_model || this.formData.tags.length > 0;

    if (!hasMetadata) {
      return '<p class="review-note">No additional metadata provided.</p>';
    }

    const fields = [];
    if (this.formData.author) fields.push(`<p><strong>Author:</strong> ${this.escapeHtml(this.formData.author)}</p>`);
    if (this.formData.city || this.formData.country) {
      const location = [this.formData.city, this.formData.region, this.formData.country].filter(Boolean).join(', ');
      fields.push(`<p><strong>Location:</strong> ${this.escapeHtml(location)}</p>`);
    }
    if (this.formData.nearest_mountain) fields.push(`<p><strong>Nearest Mountain:</strong> ${this.escapeHtml(this.formData.nearest_mountain)}</p>`);
    if (this.formData.nearest_river) fields.push(`<p><strong>Nearest River:</strong> ${this.escapeHtml(this.formData.nearest_river)}</p>`);
    if (this.formData.natural_park) fields.push(`<p><strong>Natural Park:</strong> ${this.escapeHtml(this.formData.natural_park)}</p>`);
    if (this.formData.altitude_meters) fields.push(`<p><strong>Altitude:</strong> ${this.formData.altitude_meters}m</p>`);
    if (this.formData.season) fields.push(`<p><strong>Season:</strong> ${this.escapeHtml(this.formData.season)}</p>`);
    if (this.formData.weather_conditions) fields.push(`<p><strong>Weather:</strong> ${this.escapeHtml(this.formData.weather_conditions)}</p>`);
    if (this.formData.camera_model) fields.push(`<p><strong>Camera:</strong> ${this.escapeHtml(this.formData.camera_model)}</p>`);
    if (this.formData.camera_settings) fields.push(`<p><strong>Camera Settings:</strong> ${this.escapeHtml(this.formData.camera_settings)}</p>`);
    if (this.formData.date_taken) fields.push(`<p><strong>Date Taken:</strong> ${this.formData.date_taken}</p>`);
    if (this.formData.gps_latitude && this.formData.gps_longitude) {
      fields.push(`<p><strong>GPS:</strong> ${this.formData.gps_latitude}, ${this.formData.gps_longitude}</p>`);
    }
    if (this.formData.tags.length > 0) {
      const tagsHtml = this.formData.tags.map(t => `<span class="tag">${this.escapeHtml(t)}</span>`).join('');
      fields.push(`<p><strong>Tags:</strong> ${tagsHtml}</p>`);
    }

    return `
      <div class="review-section">
        <h3>Metadata</h3>
        <div class="review-grid">${fields.join('')}</div>
      </div>
    `;
  }

  /**
   * Submit the form
   */
  async submitForm() {
    this.collectFormData();
    this.collectMetadata();

    // Prepare payload
    const priceCents = Math.round(parseFloat(this.formData.price_euros) * 100);
    const payload = {
      product_type: this.formData.product_type,
      title: this.formData.title.trim(),
      slug: this.formData.slug.trim() || null,
      description: this.formData.description.trim() || null,
      price_cents: priceCents,
      category_id: this.formData.category_id,
      gallery_ids: this.formData.gallery_ids,
      picture_ids: this.formData.product_type === 'gallery' ? [] : this.formData.picture_ids,
      cover_picture_id: this.formData.cover_picture_id,
      // Metadata
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
      this.submitBtn.innerHTML = '<span class="spinner"></span> Creating...';
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/store/products`, {
        method: 'POST',
        headers: {
          ...getCsrfHeaders(),
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create product');
      }

      if (data.status === 'success') {
        this.showToast('Product created successfully!', 'success');
        // Redirect to product list
        setTimeout(() => {
          window.location.href = `${this.baseUrl}/admin/store/products`;
        }, 1500);
      } else {
        throw new Error(data.message || 'Failed to create product');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      this.showToast(error.message || 'Failed to create product', 'error');
    } finally {
      if (this.submitBtn) {
        this.submitBtn.disabled = false;
        this.submitBtn.innerHTML = 'Create Product';
      }
    }
  }

  /**
   * Generate slug from title
   */
  generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
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
   * Format price from cents
   */
  formatPrice(cents) {
    if (cents == null) return '-';
    const euros = cents / 100;
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR'
    }).format(euros);
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
