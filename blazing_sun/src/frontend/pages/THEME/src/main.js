/**
 * Theme Configuration Page - Main Entry Point
 * Initializes all theme configuration components
 */
import './styles/main.scss';
import { ThemeConfig } from './ThemeConfig.js';
import { ColorPicker } from './components/ColorPicker.js';
import { SizePicker } from './components/SizePicker.js';
import { ImageSelector } from './components/ImageSelector.js';
import SchemaDefinitions from './SchemaDefinitions.js';

/**
 * Show toast notification using Toastify
 * @param {string} message
 * @param {string} type - 'success', 'error', 'warning', 'info'
 */
function showToast(message, type = 'info') {
  const colors = {
    success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  };

  if (typeof Toastify === 'function') {
    Toastify({
      text: message,
      duration: 4000,
      gravity: 'top',
      position: 'right',
      stopOnFocus: true,
      style: {
        background: colors[type] || colors.info,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }
    }).showToast();
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Get auth token from cookie
 * @returns {string|null}
 */
function getAuthToken() {
  const match = document.cookie.match(/auth_token=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Initialize all theme configuration components
 */
function initThemePage() {
  const baseUrl = window.BASE_URL || '';

  // Initialize ThemeConfig (main controller)
  const themeConfig = new ThemeConfig({
    baseUrl,
    showToast,
    getAuthToken,

    // Tabs - HTML uses .theme-tabs__tab and .theme-panel
    tabButtons: document.querySelectorAll('.theme-tabs__tab'),
    tabPanels: document.querySelectorAll('.theme-panel'),

    // Logo selector (click on container opens modal)
    logoSelector: document.getElementById('logoSelector'),
    logoPreview: document.getElementById('logoPreview'),
    logoPlaceholder: document.getElementById('logoPlaceholder'),

    // Favicon selector (click on container opens modal)
    faviconSelector: document.getElementById('faviconSelector'),
    faviconPreview: document.getElementById('faviconPreview'),
    faviconPlaceholder: document.getElementById('faviconPlaceholder'),

    // Color pickers container
    lightColorsContainer: document.getElementById('lightColors'),
    darkColorsContainer: document.getElementById('darkColors'),

    // Typography pickers container
    typographyContainer: document.getElementById('typographyPickers'),

    // Spacing pickers container
    spacingContainer: document.getElementById('spacingPickers'),

    // Border radius pickers container
    borderRadiusContainer: document.getElementById('borderRadiusPickers'),

    // Theme toggle (light/dark mode buttons in colors panel)
    themeModeToggle: document.querySelector('.theme-mode-toggle'),

    // Action buttons (each section has its own save button)
    buildBtn: null,

    // Build overlay
    buildOverlay: document.getElementById('buildOverlay'),
    buildStatus: document.getElementById('buildStatus'),
    buildProgress: document.getElementById('buildProgress'),

    // Image selection modal
    imageModal: document.getElementById('imageModal'),
    imageModalTitle: document.getElementById('imageModalTitle'),
    imageGrid: document.getElementById('imageGrid'),
    imageFileInput: document.getElementById('imageFileInput'),
    removeImageBtn: document.getElementById('removeImageBtn'),

    // Schema editor modal
    schemaModal: document.getElementById('schemaModal'),
    schemaModalTitle: document.getElementById('schemaModalTitle'),
    schemaTypeSelect: document.getElementById('schemaTypeSelect'),
    schemaTypeDescription: document.getElementById('schemaTypeDescription'),
    schemaFields: document.getElementById('schemaFields'),
    schemaPreview: document.getElementById('schemaPreview'),
    schemaPreviewCode: document.getElementById('schemaPreviewCode'),
    saveSchemaBtn: document.getElementById('saveSchemaBtn'),
    togglePreviewBtn: document.getElementById('togglePreviewBtn'),
    addSchemaBtn: document.getElementById('addSchemaBtn'),
    schemasList: document.getElementById('schemasList'),
    schemasEmpty: document.getElementById('schemasEmpty'),

    // Component factories
    ColorPicker,
    SizePicker,
    ImageSelector,

    // Schema definitions
    SchemaDefinitions
  });

  // Make instance available globally for debugging
  window.themeConfig = themeConfig;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemePage);
} else {
  initThemePage();
}
