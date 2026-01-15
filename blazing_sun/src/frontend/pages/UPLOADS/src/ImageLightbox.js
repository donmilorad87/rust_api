/**
 * ImageLightbox Component
 *
 * Displays images in a fullscreen lightbox overlay
 */

export class ImageLightbox {
  constructor() {
    this.currentImage = null;
    this.lightboxEl = null;
  }

  /**
   * Open lightbox with an image
   * @param {string} imageUrl - URL of the image to display
   * @param {string} title - Image title/name
   */
  open(imageUrl, title = '') {
    this.currentImage = { url: imageUrl, title };
    this.render();
    document.body.style.overflow = 'hidden';
  }

  /**
   * Close the lightbox
   */
  close() {
    if (this.lightboxEl) {
      this.lightboxEl.remove();
      this.lightboxEl = null;
      document.body.style.overflow = '';
    }
  }

  /**
   * Render the lightbox
   */
  render() {
    // Remove existing lightbox if any
    this.close();

    // Create lightbox
    this.lightboxEl = document.createElement('div');
    this.lightboxEl.className = 'lightbox';
    this.lightboxEl.innerHTML = `
      <div class="lightbox__overlay"></div>
      <div class="lightbox__content">
        <button class="lightbox__close" title="Close (Esc)">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="lightbox__image-container">
          <img src="${this.currentImage.url}" alt="${this.escapeHtml(this.currentImage.title)}" class="lightbox__image">
        </div>
        ${this.currentImage.title ? `<div class="lightbox__title">${this.escapeHtml(this.currentImage.title)}</div>` : ''}
        <a href="${this.currentImage.url}" download class="lightbox__download" title="Download">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </a>
      </div>
    `;

    document.body.appendChild(this.lightboxEl);

    // Bind events
    this.bindEvents();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Close button
    const closeBtn = this.lightboxEl.querySelector('.lightbox__close');
    closeBtn.addEventListener('click', () => this.close());

    // Overlay click
    const overlay = this.lightboxEl.querySelector('.lightbox__overlay');
    overlay.addEventListener('click', () => this.close());

    // ESC key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Prevent closing when clicking on image
    const imageContainer = this.lightboxEl.querySelector('.lightbox__image-container');
    imageContainer.addEventListener('click', (e) => e.stopPropagation());
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
