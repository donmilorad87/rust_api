/**
 * LanguageDropdown - Language selection dropdown component
 *
 * Features:
 * - Reads available languages from #languagesTable element
 * - Supports hreflang navigation (SEO-friendly language switching)
 * - Falls back to client-side translation via LocalizationManager
 * - Accessible keyboard navigation
 * - Responsive design with flag icons support
 */
export class LanguageDropdown {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.containerId - ID of the dropdown container element
   * @param {string} options.languagesTableId - ID of the languages data element (default: 'languagesTable')
   * @param {LocalizationManager} options.localizationManager - Reference to LocalizationManager
   * @param {Function} options.onLanguageChange - Callback when language changes
   */
  constructor(options = {}) {
    this.containerId = options.containerId || 'languageDropdown';
    this.languagesTableId = options.languagesTableId || 'languagesTable';
    this.localizationManager = options.localizationManager || window.Blazing_Sun?.localization;
    this.onLanguageChange = options.onLanguageChange || null;

    this.container = null;
    this.languages = [];
    this.hreflangs = new Map();
    this.currentLanguage = null;
    this.isOpen = false;

    this.init();
  }

  /**
   * Initialize the dropdown
   */
  init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.warn(`[LanguageDropdown] Container #${this.containerId} not found`);
      return;
    }

    this.loadLanguages();
    this.loadHreflangs();
    this.detectCurrentLanguage();
    this.render();
    this.bindEvents();
  }

  /**
   * Load languages from the languagesTable element
   * Expected format: JSON array or data attributes
   */
  loadLanguages() {
    const table = document.getElementById(this.languagesTableId);
    if (!table) {
      console.warn(`[LanguageDropdown] Languages table #${this.languagesTableId} not found`);
      // Provide default languages if table not found
      this.languages = [
        { code: 'en_US', name: 'English', nativeName: 'English', flag: 'us' },
        { code: 'es_ES', name: 'Spanish', nativeName: 'Español', flag: 'es' },
        { code: 'de_DE', name: 'German', nativeName: 'Deutsch', flag: 'de' },
        { code: 'fr_FR', name: 'French', nativeName: 'Français', flag: 'fr' }
      ];
      return;
    }

    // Try to parse as JSON (if element contains JSON data)
    try {
      const jsonContent = table.textContent?.trim();
      if (jsonContent && jsonContent.startsWith('[')) {
        this.languages = JSON.parse(jsonContent);
        return;
      }
    } catch (e) {
      // Not JSON, try other formats
    }

    // Try to read from data attributes
    if (table.dataset.languages) {
      try {
        this.languages = JSON.parse(table.dataset.languages);
        return;
      } catch (e) {
        console.error('[LanguageDropdown] Failed to parse data-languages:', e);
      }
    }

    // Try to read from table rows (if it's an actual HTML table)
    if (table.tagName === 'TABLE') {
      const rows = table.querySelectorAll('tbody tr');
      this.languages = Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        return {
          code: cells[0]?.textContent?.trim() || row.dataset.code,
          name: cells[1]?.textContent?.trim() || row.dataset.name,
          nativeName: cells[2]?.textContent?.trim() || row.dataset.nativeName,
          flag: cells[3]?.textContent?.trim() || row.dataset.flag
        };
      }).filter(lang => lang.code);
      return;
    }

    // Try to read from list items
    if (table.tagName === 'UL' || table.tagName === 'OL') {
      const items = table.querySelectorAll('li');
      this.languages = Array.from(items).map(item => ({
        code: item.dataset.code || item.dataset.locale,
        name: item.dataset.name || item.textContent?.trim(),
        nativeName: item.dataset.nativeName || item.dataset.native,
        flag: item.dataset.flag || item.dataset.country,
        iconUrl: item.dataset.iconUrl, // Image URL from database
        selected: item.dataset.selected === 'true' // Pre-selected from server
      })).filter(lang => lang.code);
      return;
    }

    // Try to read from select options
    if (table.tagName === 'SELECT') {
      const options = table.querySelectorAll('option');
      this.languages = Array.from(options)
        .filter(opt => opt.value)
        .map(opt => ({
          code: opt.value,
          name: opt.textContent?.trim(),
          nativeName: opt.dataset.nativeName || opt.textContent?.trim(),
          flag: opt.dataset.flag
        }));
      return;
    }

    console.warn('[LanguageDropdown] Could not parse languages from table');
  }

  /**
   * Load hreflang links from page head
   * These are used for SEO-friendly language navigation
   */
  loadHreflangs() {
    const hreflangLinks = document.querySelectorAll('link[rel="alternate"][hreflang]');
    hreflangLinks.forEach(link => {
      const hreflang = link.getAttribute('hreflang');
      const href = link.getAttribute('href');
      if (hreflang && href) {
        // Normalize hreflang to match our locale format (e.g., 'en' -> 'en_US', 'en-US' -> 'en_US')
        const normalizedCode = this.normalizeLocaleCode(hreflang);
        this.hreflangs.set(normalizedCode, href);

        // Also store the original short code
        const shortCode = hreflang.split('-')[0];
        if (!this.hreflangs.has(shortCode)) {
          this.hreflangs.set(shortCode, href);
        }
      }
    });
  }

  /**
   * Normalize locale code to consistent format
   * @param {string} code - Locale code (e.g., 'en', 'en-US', 'en_US')
   * @returns {string} Normalized code (e.g., 'en_US')
   */
  normalizeLocaleCode(code) {
    if (!code) return '';
    // Convert hyphens to underscores and handle common patterns
    return code.replace('-', '_');
  }

  /**
   * Detect the current language from various sources
   */
  detectCurrentLanguage() {
    // Try server-side selected language first (from data-selected attribute)
    const serverSelected = this.languages.find(l => l.selected);
    if (serverSelected) {
      this.currentLanguage = serverSelected;
      return;
    }

    // Try LocalizationManager
    if (this.localizationManager?.currentLocale) {
      this.currentLanguage = this.findLanguageByCode(this.localizationManager.currentLocale);
      if (this.currentLanguage) return;
    }

    // Try HTML lang attribute
    const htmlLang = document.documentElement.lang;
    if (htmlLang) {
      this.currentLanguage = this.findLanguageByCode(htmlLang);
      if (this.currentLanguage) return;
    }

    // Try cookie
    const cookieLang = this.getCookieLocale();
    if (cookieLang) {
      this.currentLanguage = this.findLanguageByCode(cookieLang);
      if (this.currentLanguage) return;
    }

    // Fall back to first language or English
    this.currentLanguage = this.languages.find(l => l.code.startsWith('en')) || this.languages[0];
  }

  /**
   * Find a language by its code (fuzzy matching)
   * @param {string} code - Language code to find
   * @returns {Object|null} Language object or null
   */
  findLanguageByCode(code) {
    if (!code) return null;
    const normalized = this.normalizeLocaleCode(code);
    const shortCode = code.split(/[-_]/)[0].toLowerCase();

    // Exact match
    let lang = this.languages.find(l => l.code === normalized || l.code === code);
    if (lang) return lang;

    // Case-insensitive match
    lang = this.languages.find(l => l.code.toLowerCase() === normalized.toLowerCase());
    if (lang) return lang;

    // Short code match (e.g., 'en' matches 'en_US')
    lang = this.languages.find(l => l.code.toLowerCase().startsWith(shortCode));
    return lang || null;
  }

  /**
   * Get locale from cookie
   * @returns {string|null} Locale code or null
   */
  getCookieLocale() {
    const cookieName = this.localizationManager?.cookieName || 'blazing_sun_locale';
    const match = document.cookie.match(new RegExp(`${cookieName}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  /**
   * Render the dropdown HTML
   */
  render() {
    if (!this.container) return;

    const current = this.currentLanguage || this.languages[0];
    if (!current) return;

    this.container.innerHTML = `
      <div class="language-dropdown">
        <button class="language-dropdown__trigger"
                type="button"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-label="Select language">
          ${this.renderFlag(current.flag, current.iconUrl)}
          <span class="language-dropdown__current">${current.nativeName || current.name}</span>
          <svg class="language-dropdown__arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <ul class="language-dropdown__menu" role="listbox" aria-label="Available languages">
          ${this.languages.map(lang => this.renderLanguageOption(lang, current)).join('')}
        </ul>
      </div>
    `;

    this.dropdownEl = this.container.querySelector('.language-dropdown');
    this.triggerEl = this.container.querySelector('.language-dropdown__trigger');
    this.menuEl = this.container.querySelector('.language-dropdown__menu');
  }

  /**
   * Render a flag icon (image or emoji fallback)
   * @param {string} flag - Flag code (e.g., 'us', 'es') for emoji fallback
   * @param {string} iconUrl - Optional image URL from database
   * @returns {string} HTML for flag
   */
  renderFlag(flag, iconUrl) {
    // Prefer image URL from database if available
    if (iconUrl) {
      return `<img src="${iconUrl}" alt="" class="language-dropdown__flag language-dropdown__flag--image" aria-hidden="true" loading="lazy">`;
    }

    // Fallback to emoji flags
    if (flag) {
      const flagEmoji = this.getFlagEmoji(flag);
      if (flagEmoji) {
        return `<span class="language-dropdown__flag" aria-hidden="true">${flagEmoji}</span>`;
      }
    }

    return '';
  }

  /**
   * Convert country code to flag emoji
   * @param {string} countryCode - Two-letter country code
   * @returns {string} Flag emoji or empty string
   */
  getFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '';
    const code = countryCode.toUpperCase();
    // Convert to regional indicator symbols
    const offset = 127397;
    return String.fromCodePoint(...[...code].map(c => c.charCodeAt(0) + offset));
  }

  /**
   * Render a language option
   * @param {Object} lang - Language object
   * @param {Object} current - Current language
   * @returns {string} HTML for option
   */
  renderLanguageOption(lang, current) {
    const isSelected = lang.code === current?.code;
    const hreflangUrl = this.getHreflangUrl(lang.code);

    return `
      <li class="language-dropdown__item ${isSelected ? 'language-dropdown__item--selected' : ''}"
          role="option"
          aria-selected="${isSelected}"
          data-code="${lang.code}"
          ${hreflangUrl ? `data-href="${hreflangUrl}"` : ''}
          tabindex="0">
        ${this.renderFlag(lang.flag, lang.iconUrl)}
        <span class="language-dropdown__name">${lang.nativeName || lang.name}</span>
        ${isSelected ? '<svg class="language-dropdown__check" width="16" height="16" viewBox="0 0 16 16"><path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>' : ''}
      </li>
    `;
  }

  /**
   * Get hreflang URL for a language code
   * @param {string} code - Language code (e.g., "en_US", "sr_RS")
   * @returns {string|null} URL or null
   */
  getHreflangUrl(code) {
    // Try exact match
    if (this.hreflangs.has(code)) {
      return this.hreflangs.get(code);
    }

    // Try normalized
    const normalized = this.normalizeLocaleCode(code);
    if (this.hreflangs.has(normalized)) {
      return this.hreflangs.get(normalized);
    }

    // Try short code (e.g., "en_US" -> "en")
    const shortCode = code.split(/[-_]/)[0].toLowerCase();
    if (this.hreflangs.has(shortCode)) {
      return this.hreflangs.get(shortCode);
    }

    // Fallback: Construct URL by replacing language segment in current path
    // URL pattern: /{lang}/... where lang is short code like "en" or "sr"
    return this.constructLanguageUrl(shortCode);
  }

  /**
   * Construct a language URL by replacing the language segment in the current URL
   * @param {string} langCode - Short language code (e.g., "en", "sr")
   * @returns {string} Constructed URL
   */
  constructLanguageUrl(langCode) {
    const currentPath = window.location.pathname;
    const pathParts = currentPath.split('/').filter(p => p);

    // Check if first segment is a language code (2-letter code)
    if (pathParts.length > 0 && /^[a-z]{2}$/i.test(pathParts[0])) {
      // Replace existing language code
      pathParts[0] = langCode;
    } else {
      // Prepend language code
      pathParts.unshift(langCode);
    }

    const newPath = '/' + pathParts.join('/');
    return window.location.origin + newPath + window.location.search;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    if (!this.triggerEl || !this.menuEl) return;

    // Toggle dropdown on click
    this.triggerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.container?.contains(e.target)) {
        this.close();
      }
    });

    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Language selection
    this.menuEl.querySelectorAll('.language-dropdown__item').forEach(item => {
      item.addEventListener('click', () => this.selectLanguage(item));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectLanguage(item);
        }
      });
    });
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeydown(e) {
    switch (e.key) {
      case 'Escape':
        this.close();
        this.triggerEl?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!this.isOpen) {
          this.open();
        } else {
          this.focusNextItem();
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (this.isOpen) {
          this.focusPrevItem();
        }
        break;
      case 'Home':
        if (this.isOpen) {
          e.preventDefault();
          this.focusFirstItem();
        }
        break;
      case 'End':
        if (this.isOpen) {
          e.preventDefault();
          this.focusLastItem();
        }
        break;
    }
  }

  /**
   * Focus management helpers
   */
  focusNextItem() {
    const items = Array.from(this.menuEl?.querySelectorAll('.language-dropdown__item') || []);
    const current = document.activeElement;
    const index = items.indexOf(current);
    const next = items[(index + 1) % items.length];
    next?.focus();
  }

  focusPrevItem() {
    const items = Array.from(this.menuEl?.querySelectorAll('.language-dropdown__item') || []);
    const current = document.activeElement;
    const index = items.indexOf(current);
    const prev = items[(index - 1 + items.length) % items.length];
    prev?.focus();
  }

  focusFirstItem() {
    const first = this.menuEl?.querySelector('.language-dropdown__item');
    first?.focus();
  }

  focusLastItem() {
    const items = this.menuEl?.querySelectorAll('.language-dropdown__item');
    items?.[items.length - 1]?.focus();
  }

  /**
   * Toggle dropdown visibility
   */
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  /**
   * Open dropdown
   */
  open() {
    if (!this.dropdownEl) return;
    this.isOpen = true;
    this.dropdownEl.classList.add('language-dropdown--open');
    this.triggerEl?.setAttribute('aria-expanded', 'true');

    // Focus selected item or first item
    const selected = this.menuEl?.querySelector('.language-dropdown__item--selected');
    (selected || this.menuEl?.querySelector('.language-dropdown__item'))?.focus();
  }

  /**
   * Close dropdown
   */
  close() {
    if (!this.dropdownEl) return;
    this.isOpen = false;
    this.dropdownEl.classList.remove('language-dropdown--open');
    this.triggerEl?.setAttribute('aria-expanded', 'false');
  }

  /**
   * Select a language
   * @param {HTMLElement} item - Selected item element
   */
  selectLanguage(item) {
    const code = item.dataset.code;
    const hrefUrl = item.dataset.href;

    if (!code) return;

    // If hreflang URL exists, navigate to it
    if (hrefUrl) {
      window.location.href = hrefUrl;
      return;
    }

    // Otherwise, use client-side translation
    this.currentLanguage = this.findLanguageByCode(code);

    // Update LocalizationManager
    if (this.localizationManager) {
      this.localizationManager.setLocale(code);
    }

    // Update UI
    this.render();
    this.bindEvents();

    // Call callback if provided
    if (this.onLanguageChange) {
      this.onLanguageChange(code, this.currentLanguage);
    }

    // Dispatch custom event
    this.container?.dispatchEvent(new CustomEvent('languagechange', {
      bubbles: true,
      detail: { code, language: this.currentLanguage }
    }));

    // Trigger page translation
    this.translatePage();
  }

  /**
   * Translate the page using the translate() function
   */
  translatePage() {
    // Find all elements with data-translate attribute
    const translatableElements = document.querySelectorAll('[data-translate]');
    translatableElements.forEach(el => {
      const key = el.dataset.translate;
      const form = el.dataset.translateForm || 'singular';
      const args = el.dataset.translateArgs ? JSON.parse(el.dataset.translateArgs) : {};

      const translated = window.translate?.(key, args, form) || key;

      // Update text content or specific attribute
      if (el.dataset.translateAttr) {
        el.setAttribute(el.dataset.translateAttr, translated);
      } else {
        el.textContent = translated;
      }
    });

    // Translate placeholders
    document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
      const key = el.dataset.translatePlaceholder;
      el.placeholder = window.translate?.(key) || key;
    });

    // Translate titles
    document.querySelectorAll('[data-translate-title]').forEach(el => {
      const key = el.dataset.translateTitle;
      el.title = window.translate?.(key) || key;
    });
  }

  /**
   * Manually set the current language
   * @param {string} code - Language code
   */
  setLanguage(code) {
    const item = this.menuEl?.querySelector(`[data-code="${code}"]`);
    if (item) {
      this.selectLanguage(item);
    }
  }

  /**
   * Get current language code
   * @returns {string|null} Current language code
   */
  getCurrentLanguage() {
    return this.currentLanguage?.code || null;
  }

  /**
   * Check if hreflangs are available
   * @returns {boolean} True if hreflangs exist
   */
  hasHreflangs() {
    return this.hreflangs.size > 0;
  }

  /**
   * Refresh the dropdown (re-read languages and re-render)
   */
  refresh() {
    this.loadLanguages();
    this.loadHreflangs();
    this.detectCurrentLanguage();
    this.render();
    this.bindEvents();
  }
}

export default LanguageDropdown;
