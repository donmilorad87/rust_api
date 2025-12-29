/**
 * Navbar - Navigation bar functionality
 *
 * Features:
 * - Mobile menu toggle (future)
 * - Active link highlighting
 * - Scroll behavior
 */
export class Navbar {
  constructor() {
    this.navbar = document.querySelector('.navbar');
    this.links = document.querySelectorAll('.navbar__link');

    this.init();
  }

  /**
   * Initialize navbar
   */
  init() {
    this.highlightActiveLink();
    this.setupScrollBehavior();
  }

  /**
   * Highlight the active navigation link based on current URL
   */
  highlightActiveLink() {
    const currentPath = window.location.pathname;

    this.links.forEach((link) => {
      const linkPath = new URL(link.href).pathname;

      if (linkPath === currentPath) {
        link.classList.add('navbar__link--active');
      } else {
        link.classList.remove('navbar__link--active');
      }
    });
  }

  /**
   * Setup scroll behavior for navbar
   * Adds shadow when scrolled
   */
  setupScrollBehavior() {
    if (!this.navbar) return;

    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll > 10) {
        this.navbar.classList.add('navbar--scrolled');
      } else {
        this.navbar.classList.remove('navbar--scrolled');
      }

      lastScroll = currentScroll;
    }, { passive: true });
  }
}

export default Navbar;
