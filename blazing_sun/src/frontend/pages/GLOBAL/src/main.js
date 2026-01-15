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
import { LocalizationManager } from './js/Localization.js';
import { LanguageDropdown } from './js/LanguageDropdown.js';

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
  window.Blazing_Sun.localization = new LocalizationManager({ defaultLocale: 'en_US' });
  window.Blazing_Sun.localization.loadLocale();
  window.translate = (...args) => window.Blazing_Sun.localization.translate(...args);

  // Initialize language dropdown if container exists
  const langDropdownContainer = document.getElementById('languageDropdown');
  if (langDropdownContainer) {
    window.Blazing_Sun.languageDropdown = new LanguageDropdown({
      containerId: 'languageDropdown',
      languagesTableId: 'languageDropdownData',  // Uses separate ID to avoid conflict with admin languagesTable
      localizationManager: window.Blazing_Sun.localization,
      onLanguageChange: (code, language) => {
        console.log(`[LanguageDropdown] Language changed to: ${code}`, language);
      }
    });
  }

  // Export LanguageDropdown class for manual initialization
  window.Blazing_Sun.LanguageDropdown = LanguageDropdown;
});

// Export for use in other modules
export { ThemeManager, Navbar, getCsrfToken, getCsrfHeaders, FormValidator, PasswordToggle, LoginModal, LocalizationManager, LanguageDropdown };
