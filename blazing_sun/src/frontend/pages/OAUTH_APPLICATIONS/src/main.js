/**
 * OAuth Applications Page
 *
 * Entry point for OAuth 2.0 application management page.
 * Handles creating, editing, and managing OAuth applications.
 */

import './styles/main.scss';
import OAuthApplicationsPage from './OAuthApplicationsPage.js';

// Initialize OAuth Applications page
document.addEventListener('DOMContentLoaded', () => {
    const page = new OAuthApplicationsPage();
    page.init();
});
