/**
 * ThemeManager - Handles light/dark theme switching
 *
 * Features:
 * - Persists theme preference in cookies (server-readable)
 * - Server renders correct theme on initial load (no flash)
 * - Provides API for programmatic theme control
 */
export class ThemeManager {
  constructor() {
    this.COOKIE_NAME = 'blazing_sun_theme';
    this.DARK_THEME = 'dark';
    this.LIGHT_THEME = 'light';
    this.COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds

    this.toggleButton = document.getElementById('themeToggle');

    this.init();
  }

  /**
   * Initialize theme manager
   */
  init() {
    const storedTheme = this.getStoredTheme();
    if (storedTheme) {
      this.applyTheme(storedTheme);
    } else {
      this.applyTheme(this.getSystemTheme());
    }

    // Bind toggle button
    if (this.toggleButton) {
      this.toggleButton.addEventListener('click', () => this.toggle());
    }
  }

  /**
   * Get current theme from cookie
   * @returns {string} 'light' or 'dark'
   */
  getTheme() {
    return this.getStoredTheme() || this.LIGHT_THEME;
  }

  /**
   * Get theme from cookie when present.
   * @returns {string|null} 'light', 'dark', or null
   */
  getStoredTheme() {
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith(this.COOKIE_NAME + '='));

    if (!cookie) {
      return null;
    }

    const value = cookie.split('=')[1];
    if (value === this.DARK_THEME || value === this.LIGHT_THEME) {
      return value;
    }

    return null;
  }

  /**
   * Detect system theme preference.
   * @returns {string} 'light' or 'dark'
   */
  getSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return this.DARK_THEME;
    }

    return this.LIGHT_THEME;
  }

  /**
   * Save theme to cookie
   * @param {string} theme - 'light' or 'dark'
   */
  saveToCookie(theme) {
    document.cookie = `${this.COOKIE_NAME}=${theme}; path=/; max-age=${this.COOKIE_MAX_AGE}; SameSite=Lax`;
  }

  /**
   * Apply theme to document
   * @param {string} theme - 'light' or 'dark'
   */
  applyTheme(theme) {
    if (theme === this.DARK_THEME) {
      document.documentElement.setAttribute('data-theme', this.DARK_THEME);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    this.saveToCookie(theme);
  }

  /**
   * Toggle between light and dark themes
   */
  toggle() {
    const currentTheme = this.getTheme();
    const newTheme = currentTheme === this.DARK_THEME ? this.LIGHT_THEME : this.DARK_THEME;
    this.applyTheme(newTheme);
  }

  /**
   * Set theme programmatically
   * @param {string} theme - 'light' or 'dark'
   */
  setTheme(theme) {
    if (theme === this.DARK_THEME || theme === this.LIGHT_THEME) {
      this.applyTheme(theme);
    }
  }

  /**
   * Check if dark theme is active
   * @returns {boolean}
   */
  isDark() {
    return this.getTheme() === this.DARK_THEME;
  }
}

export default ThemeManager;
