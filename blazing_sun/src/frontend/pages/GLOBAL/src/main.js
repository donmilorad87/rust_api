/**
 * Blazing Sun Global Assets
 *
 * This module is loaded on every page and provides:
 * - Theme system (light/dark mode)
 * - Navigation functionality
 * - Form validation utilities
 * - Login modal component
 * - Base utilities
 */

// Import styles
import './styles/main.scss';

// Import modules
import { ThemeManager } from './js/ThemeManager.js';
import { Navbar } from './js/Navbar.js';
import { getCsrfToken, getCsrfHeaders } from './js/csrf.js';
import { FormValidator, PasswordToggle } from './js/FormValidator.js';
import { LoginModal } from './js/LoginModal.js';

// Initialize global modules when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme manager
  window.Blazing_Sun = window.Blazing_Sun || {};
  window.Blazing_Sun.theme = new ThemeManager();
  window.Blazing_Sun.navbar = new Navbar();
  window.Blazing_Sun.csrf = { getCsrfToken, getCsrfHeaders };
  window.Blazing_Sun.FormValidator = FormValidator;
  window.Blazing_Sun.PasswordToggle = PasswordToggle;
  window.Blazing_Sun.LoginModal = LoginModal;
});

// Export for use in other modules
export { ThemeManager, Navbar, getCsrfToken, getCsrfHeaders, FormValidator, PasswordToggle, LoginModal };
