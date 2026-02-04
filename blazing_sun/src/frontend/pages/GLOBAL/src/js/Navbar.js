/**
 * Navbar - Navigation bar functionality
 *
 * Features:
 * - Mobile menu toggle (future)
 * - Active link highlighting
 * - Scroll behavior
 * - Submenu overflow detection (auto-flip to left when near right edge)
 */
export class Navbar {
  constructor() {
    this.navbar = document.querySelector('.navbar');
    this.links = document.querySelectorAll('.navbar__link');
    this.submenus = document.querySelectorAll('.navbar__dropdown-submenu');

    this.init();
  }

  /**
   * Initialize navbar
   */
  init() {
    this.highlightActiveLink();
    this.setupScrollBehavior();
    this.setupSubmenuOverflowDetection();
  }

  /**
   * Highlight the active navigation link based on current URL
   */
  highlightActiveLink() {
    const currentPath = window.location.pathname;

    this.links.forEach((link) => {
      // Skip links without valid href
      if (!link.href || link.href === '#' || !link.href.startsWith('http')) {
        return;
      }

      try {
        const linkPath = new URL(link.href).pathname;

        if (linkPath === currentPath) {
          link.classList.add('navbar__link--active');
        } else {
          link.classList.remove('navbar__link--active');
        }
      } catch (e) {
        // Skip invalid URLs
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

  /**
   * Setup submenu overflow detection
   * Automatically flips submenus to the left when they would overflow the right edge
   */
  setupSubmenuOverflowDetection() {
    if (!this.submenus || this.submenus.length === 0) return;

    this.submenus.forEach((submenuContainer) => {
      const submenu = submenuContainer.querySelector('.navbar__submenu');
      if (!submenu) return;

      // Check position on hover
      submenuContainer.addEventListener('mouseenter', () => {
        this.checkSubmenuOverflow(submenuContainer, submenu);
      });

      // Also check on window resize
      window.addEventListener('resize', () => {
        // Reset and recheck if submenu is visible
        if (submenuContainer.matches(':hover')) {
          this.checkSubmenuOverflow(submenuContainer, submenu);
        }
      }, { passive: true });
    });
  }

  /**
   * Check if submenu would overflow and flip to left if needed
   * @param {HTMLElement} container - The submenu container
   * @param {HTMLElement} submenu - The submenu panel
   */
  checkSubmenuOverflow(container, submenu) {
    // Reset position class first
    submenu.classList.remove('navbar__submenu--left');

    // Get the container's position (the parent dropdown item)
    const containerRect = container.getBoundingClientRect();
    const submenuWidth = submenu.offsetWidth || 180; // Default min-width from CSS
    const viewportWidth = window.innerWidth;

    // Calculate where the submenu would end if opened to the right
    const rightEdge = containerRect.right + submenuWidth;

    // Add some padding (20px) from viewport edge
    const safetyMargin = 20;

    // If submenu would overflow, flip it to the left
    if (rightEdge > viewportWidth - safetyMargin) {
      submenu.classList.add('navbar__submenu--left');
    }
  }
}

export default Navbar;
