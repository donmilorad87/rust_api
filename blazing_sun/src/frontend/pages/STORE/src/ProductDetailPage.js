import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * ProductDetailPage Controller
 *
 * Manages the product detail page with image gallery, lightbox, and checkout.
 */
export class ProductDetailPage {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.productSlug = config.productSlug;
    this.showToast = config.showToast;

    // State
    this.product = null;
    this.images = [];
    this.currentImageIndex = 0;

    // DOM Elements
    this.loadingState = document.getElementById('loadingState');
    this.errorState = document.getElementById('errorState');
    this.productContent = document.getElementById('productContent');

    // Gallery elements
    this.mainImage = document.getElementById('mainImage');
    this.thumbnailStrip = document.getElementById('thumbnailStrip');
    this.lightboxBtn = document.getElementById('lightboxBtn');
    this.soldBadge = document.getElementById('soldBadge');

    // Lightbox elements
    this.lightboxModal = document.getElementById('lightboxModal');
    this.lightboxImage = document.getElementById('lightboxImage');
    this.lightboxPrev = document.getElementById('lightboxPrev');
    this.lightboxNext = document.getElementById('lightboxNext');
    this.lightboxCounter = document.getElementById('lightboxCounter');

    // Product info elements
    this.productTitle = document.getElementById('productTitle');
    this.productAuthor = document.getElementById('productAuthor');
    this.productPrice = document.getElementById('productPrice');
    this.productCategory = document.getElementById('productCategory');
    this.productTags = document.getElementById('productTags');
    this.productDescription = document.getElementById('productDescription');

    // Buy button
    this.buyNowBtn = document.getElementById('buyNowBtn');
    this.buyBtnText = document.getElementById('buyBtnText');
    this.buyBtnSpinner = document.getElementById('buyBtnSpinner');

    this.init();
  }

  /**
   * Initialize the page
   */
  async init() {
    if (!this.productSlug) {
      this.showError('Product not found');
      return;
    }

    this.setupEventListeners();
    await this.loadProduct();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Lightbox open
    if (this.lightboxBtn) {
      this.lightboxBtn.addEventListener('click', () => this.openLightbox());
    }

    // Lightbox close
    const lightboxClose = this.lightboxModal?.querySelector('.lightbox__close');
    if (lightboxClose) {
      lightboxClose.addEventListener('click', () => this.closeLightbox());
    }

    // Lightbox navigation
    if (this.lightboxPrev) {
      this.lightboxPrev.addEventListener('click', () => this.prevImage());
    }
    if (this.lightboxNext) {
      this.lightboxNext.addEventListener('click', () => this.nextImage());
    }

    // Lightbox keyboard navigation
    document.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Lightbox backdrop click
    if (this.lightboxModal) {
      this.lightboxModal.addEventListener('click', (e) => {
        if (e.target === this.lightboxModal) {
          this.closeLightbox();
        }
      });
    }

    // Buy button
    if (this.buyNowBtn) {
      this.buyNowBtn.addEventListener('click', () => this.handleBuyClick());
    }

    // Main image click to open lightbox
    if (this.mainImage) {
      this.mainImage.addEventListener('click', () => this.openLightbox());
      this.mainImage.style.cursor = 'zoom-in';
    }
  }

  /**
   * Handle keyboard events
   */
  handleKeydown(e) {
    if (this.lightboxModal?.style.display !== 'none') {
      if (e.key === 'Escape') {
        this.closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        this.prevImage();
      } else if (e.key === 'ArrowRight') {
        this.nextImage();
      }
    }
  }

  /**
   * Load product details from API
   */
  async loadProduct() {
    this.showLoading();

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/store/products/${this.productSlug}`, {
        method: 'GET',
        credentials: 'include',
        headers: getCsrfHeaders({ 'Accept': 'application/json' })
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.showError('Product not found');
          return;
        }
        throw new Error('Failed to load product');
      }

      const data = await response.json();
      this.product = data.product;

      // Build images array
      this.images = [];
      if (this.product.cover_image_url) {
        this.images.push({
          url: this.product.cover_image_url,
          fullUrl: this.product.cover_image_full_url || this.product.cover_image_url
        });
      }
      if (this.product.additional_images && this.product.additional_images.length > 0) {
        this.product.additional_images.forEach(img => {
          this.images.push({
            url: img.url,
            fullUrl: img.full_url || img.url
          });
        });
      }

      this.renderProduct();
      this.showContent();
    } catch (error) {
      console.error('Failed to load product:', error);
      this.showError(error.message);
    }
  }

  /**
   * Render product details
   */
  renderProduct() {
    const product = this.product;

    // Set title and update page title
    if (this.productTitle) {
      this.productTitle.textContent = product.title;
    }
    document.title = `${product.title} - Photo Store`;

    // Author
    if (product.author_name && this.productAuthor) {
      this.productAuthor.textContent = `by ${product.author_name}`;
      this.productAuthor.style.display = 'block';
    }

    // Price
    if (this.productPrice) {
      this.productPrice.textContent = this.formatPrice(product.price);
    }

    // Category
    if (product.category_name && this.productCategory) {
      const link = this.productCategory.querySelector('a');
      if (link) {
        link.textContent = product.category_name;
        link.href = `/store/category/${product.category_slug || ''}`;
      }
      this.productCategory.style.display = 'block';
    }

    // Tags
    this.renderTags();

    // Description
    if (product.description && this.productDescription) {
      this.productDescription.textContent = product.description;
    }

    // Metadata
    this.renderMetadata();

    // Gallery
    this.renderGallery();

    // Sold state
    if (product.is_sold) {
      this.showSoldState();
    }
  }

  /**
   * Render tags as clickable pills
   */
  renderTags() {
    if (!this.productTags || !this.product.tags || this.product.tags.length === 0) {
      return;
    }

    const tags = this.product.tags;
    this.productTags.innerHTML = tags.map(tag =>
      `<a href="/store?tag=${encodeURIComponent(tag)}" class="product-tag">${this.escapeHtml(tag)}</a>`
    ).join('');
  }

  /**
   * Render metadata section
   */
  renderMetadata() {
    const product = this.product;
    const metadata = document.getElementById('productMetadata');
    let hasMetadata = false;

    // Location (city, region, country)
    const locationParts = [];
    if (product.city) locationParts.push(product.city);
    if (product.region) locationParts.push(product.region);
    if (product.country) locationParts.push(product.country);
    if (locationParts.length > 0) {
      this.setMetaField('metaLocation', 'metaLocationValue', locationParts.join(', '));
      hasMetadata = true;
    }

    // Geography (mountain, river, natural_park)
    const geographyParts = [];
    if (product.mountain) geographyParts.push(product.mountain);
    if (product.river) geographyParts.push(product.river);
    if (product.natural_park) geographyParts.push(product.natural_park);
    if (geographyParts.length > 0) {
      this.setMetaField('metaGeography', 'metaGeographyValue', geographyParts.join(', '));
      hasMetadata = true;
    }

    // Altitude
    if (product.altitude !== null && product.altitude !== undefined) {
      this.setMetaField('metaAltitude', 'metaAltitudeValue', `${product.altitude}m`);
      hasMetadata = true;
    }

    // Season
    if (product.season) {
      this.setMetaField('metaSeason', 'metaSeasonValue', this.capitalizeFirst(product.season));
      hasMetadata = true;
    }

    // Weather
    if (product.weather) {
      this.setMetaField('metaWeather', 'metaWeatherValue', this.capitalizeFirst(product.weather));
      hasMetadata = true;
    }

    // Camera
    const cameraParts = [];
    if (product.camera_brand) cameraParts.push(product.camera_brand);
    if (product.camera_model) cameraParts.push(product.camera_model);
    if (cameraParts.length > 0) {
      this.setMetaField('metaCamera', 'metaCameraValue', cameraParts.join(' '));
      hasMetadata = true;
    }

    // Date Taken
    if (product.date_taken) {
      const date = new Date(product.date_taken);
      const formatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      this.setMetaField('metaDateTaken', 'metaDateTakenValue', formatted);
      hasMetadata = true;
    }

    // Hide metadata section if no data
    if (!hasMetadata && metadata) {
      metadata.style.display = 'none';
    }
  }

  /**
   * Set a metadata field value
   */
  setMetaField(containerId, valueId, value) {
    const container = document.getElementById(containerId);
    const valueEl = document.getElementById(valueId);
    if (container && valueEl) {
      valueEl.textContent = value;
      container.style.display = 'flex';
    }
  }

  /**
   * Render image gallery
   */
  renderGallery() {
    if (this.images.length === 0) {
      // Use placeholder
      if (this.mainImage) {
        this.mainImage.src = '/assets/img/product-placeholder.svg';
        this.mainImage.alt = this.product.title;
      }
      return;
    }

    // Set main image
    if (this.mainImage) {
      this.mainImage.src = this.images[0].url;
      this.mainImage.alt = this.product.title;
    }

    // Render thumbnails if multiple images
    if (this.images.length > 1 && this.thumbnailStrip) {
      this.thumbnailStrip.innerHTML = this.images.map((img, index) =>
        `<button type="button" class="thumbnail ${index === 0 ? 'thumbnail--active' : ''}"
                data-index="${index}" aria-label="View image ${index + 1}">
          <img src="${this.escapeHtml(img.url)}" alt="" loading="lazy">
        </button>`
      ).join('');

      // Add click handlers
      this.thumbnailStrip.querySelectorAll('.thumbnail').forEach(thumb => {
        thumb.addEventListener('click', () => {
          const index = parseInt(thumb.dataset.index, 10);
          this.selectImage(index);
        });
      });
    }
  }

  /**
   * Select an image by index
   */
  selectImage(index) {
    if (index < 0 || index >= this.images.length) return;

    this.currentImageIndex = index;

    // Update main image
    if (this.mainImage) {
      this.mainImage.src = this.images[index].url;
    }

    // Update thumbnail active state
    if (this.thumbnailStrip) {
      this.thumbnailStrip.querySelectorAll('.thumbnail').forEach((thumb, i) => {
        thumb.classList.toggle('thumbnail--active', i === index);
      });
    }

    // Update lightbox if open
    if (this.lightboxModal?.style.display !== 'none') {
      this.updateLightbox();
    }
  }

  /**
   * Open lightbox modal
   */
  openLightbox() {
    if (!this.lightboxModal || this.images.length === 0) return;

    this.lightboxModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    this.updateLightbox();
  }

  /**
   * Close lightbox modal
   */
  closeLightbox() {
    if (!this.lightboxModal) return;

    this.lightboxModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  /**
   * Update lightbox image and counter
   */
  updateLightbox() {
    if (this.lightboxImage) {
      const img = this.images[this.currentImageIndex];
      this.lightboxImage.src = img.fullUrl || img.url;
      this.lightboxImage.alt = this.product.title;
    }

    if (this.lightboxCounter && this.images.length > 1) {
      this.lightboxCounter.textContent = `${this.currentImageIndex + 1} / ${this.images.length}`;
      this.lightboxCounter.style.display = 'block';
    }

    // Show/hide navigation buttons
    if (this.lightboxPrev) {
      this.lightboxPrev.style.display = this.images.length > 1 ? 'flex' : 'none';
    }
    if (this.lightboxNext) {
      this.lightboxNext.style.display = this.images.length > 1 ? 'flex' : 'none';
    }
  }

  /**
   * Navigate to previous image
   */
  prevImage() {
    if (this.images.length <= 1) return;
    const newIndex = (this.currentImageIndex - 1 + this.images.length) % this.images.length;
    this.selectImage(newIndex);
  }

  /**
   * Navigate to next image
   */
  nextImage() {
    if (this.images.length <= 1) return;
    const newIndex = (this.currentImageIndex + 1) % this.images.length;
    this.selectImage(newIndex);
  }

  /**
   * Show sold state
   */
  showSoldState() {
    if (this.soldBadge) {
      this.soldBadge.style.display = 'flex';
    }
    if (this.buyNowBtn) {
      this.buyNowBtn.disabled = true;
      this.buyBtnText.textContent = 'Sold Out';
      this.buyNowBtn.classList.add('product-actions__buy-btn--sold');
    }
  }

  /**
   * Handle buy button click
   */
  async handleBuyClick() {
    if (!this.product || this.product.is_sold) return;

    this.setBuyButtonLoading(true);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/store/checkout/${this.product.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: getCsrfHeaders({
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to initiate checkout');
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      this.showToast(error.message || 'Failed to initiate checkout. Please try again.', 'error');
      this.setBuyButtonLoading(false);
    }
  }

  /**
   * Set buy button loading state
   */
  setBuyButtonLoading(loading) {
    if (this.buyNowBtn) {
      this.buyNowBtn.disabled = loading;
    }
    if (this.buyBtnText) {
      this.buyBtnText.style.display = loading ? 'none' : 'inline';
    }
    if (this.buyBtnSpinner) {
      this.buyBtnSpinner.style.display = loading ? 'inline-block' : 'none';
    }
  }

  /**
   * Format price from cents to currency string
   */
  formatPrice(cents) {
    const euros = cents / 100;
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR'
    }).format(euros);
  }

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show loading state
   */
  showLoading() {
    if (this.loadingState) this.loadingState.style.display = 'block';
    if (this.errorState) this.errorState.style.display = 'none';
    if (this.productContent) this.productContent.style.display = 'none';
  }

  /**
   * Show error state
   */
  showError(message) {
    if (this.loadingState) this.loadingState.style.display = 'none';
    if (this.errorState) {
      this.errorState.style.display = 'block';
      const msgEl = this.errorState.querySelector('.error-state__message');
      if (msgEl && message) {
        msgEl.textContent = message;
      }
    }
    if (this.productContent) this.productContent.style.display = 'none';
  }

  /**
   * Show content state
   */
  showContent() {
    if (this.loadingState) this.loadingState.style.display = 'none';
    if (this.errorState) this.errorState.style.display = 'none';
    if (this.productContent) this.productContent.style.display = 'grid';
  }
}
