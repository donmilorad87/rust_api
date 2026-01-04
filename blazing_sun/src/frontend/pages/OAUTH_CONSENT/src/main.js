/**
 * OAuth Consent Page - Entry Point
 * ES6 Module - No window globals
 */

import './styles/style.scss';
import OAuthConsentPage from './OAuthConsentPage.js';

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const page = new OAuthConsentPage();
    page.init();
});
