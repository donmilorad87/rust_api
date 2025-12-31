/**
 * Blazing Sun Global Assets
 *
 * This module is loaded on every page and provides:
 * - Theme system (light/dark mode)
 * - Navigation functionality
 * - Base utilities
 */

// Import styles
import './styles/main.scss';

// Import modules
import { ThemeManager } from './js/ThemeManager.js';
import { Navbar } from './js/Navbar.js';

// Initialize global modules when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme manager
  window.Blazing_Sun = window.Blazing_Sun || {};
  window.Blazing_Sun.theme = new ThemeManager();
  window.Blazing_Sun.navbar = new Navbar();
});

// Export for use in other modules
export { ThemeManager, Navbar };
