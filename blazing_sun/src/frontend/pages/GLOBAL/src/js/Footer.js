/**
 * Footer - Site footer functionality
 *
 * Features:
 * - Back to top smooth scroll
 * - Year auto-update
 * - Link hover effects
 */
export class Footer {
  constructor() {
    this.footer = document.querySelector('.footer');
    this.backToTopBtn = document.querySelector('.footer__back-to-top');
    this.yearElement = document.querySelector('.footer__year');

    this.init();
  }

  /**
   * Initialize footer
   */
  init() {
    this.updateYear();
    this.setupBackToTop();
  }

  /**
   * Update the current year in the footer
   */
  updateYear() {
    if (this.yearElement) {
      this.yearElement.textContent = new Date().getFullYear();
    }
  }

  /**
   * Setup back to top button functionality
   */
  setupBackToTop() {
    if (!this.backToTopBtn) return;

    this.backToTopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
}

export default Footer;
