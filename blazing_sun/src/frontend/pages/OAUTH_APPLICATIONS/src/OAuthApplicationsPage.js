/**
 * OAuth Applications Page Manager
 *
 * Google Cloud Platform-style OAuth 2.0 application management.
 * Handles creating, editing, managing OAuth applications with API enablement.
 */

import Toastify from 'toastify-js';
import 'toastify-js/src/toastify.css';

export default class OAuthApplicationsPage {
    constructor() {
        this.currentClientId = null;
        this.currentClientName = null;
        this.redirectUris = [];
        this.grantedScopes = [];
        // Pending API operation tracking (for modals)
        this.pendingApiProductId = null;
        this.pendingApiName = null;
        // Track expanded accordions (by API product ID)
        this.expandedAccordions = new Set();
        // Authorized apps (third-party apps user has granted access to)
        this.authorizedApps = [];
        this.authorizedAppsLoaded = false;
        // Active tab
        this.activeTab = 'my-apps';
    }

    /**
     * Initialize the page
     */
    init() {
        this.setupEventListeners();
        this.setupTabNavigation();
        this.loadApplications();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Create Application Buttons (header + empty state)
        document.getElementById('createAppBtn')?.addEventListener('click', () => {
            this.showCreateModal();
        });

        document.getElementById('createAppFromEmpty')?.addEventListener('click', () => {
            this.showCreateModal();
        });

        // Retry Button
        document.getElementById('retryBtn')?.addEventListener('click', () => {
            this.loadApplications();
        });

        // Create Application Form
        document.getElementById('oauthAppForm')?.addEventListener('submit', (e) => {
            this.handleCreateApp(e);
        });

        // Cancel Button
        document.getElementById('cancelBtn')?.addEventListener('click', () => {
            this.hideCreateModal();
        });

        // Modal Close Buttons
        document.getElementById('modalCloseBtn')?.addEventListener('click', () => {
            this.hideCreateModal();
        });

        document.getElementById('detailsModalCloseBtn')?.addEventListener('click', () => {
            this.hideDetailsModal();
        });

        // Close modal on overlay click
        document.querySelector('#appModal .modal__overlay')?.addEventListener('click', () => {
            this.hideCreateModal();
        });

        document.querySelector('#appDetailsModal .modal__overlay')?.addEventListener('click', () => {
            this.hideDetailsModal();
        });

        // Delete Application Button
        document.getElementById('deleteApplicationBtn')?.addEventListener('click', () => {
            this.showDeleteConfirmModal();
        });

        // Delete Confirmation Modal
        document.getElementById('deleteConfirmCloseBtn')?.addEventListener('click', () => {
            this.hideDeleteConfirmModal();
        });

        document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
            this.hideDeleteConfirmModal();
        });

        document.querySelector('#deleteConfirmModal .modal__overlay')?.addEventListener('click', () => {
            this.hideDeleteConfirmModal();
        });

        document.getElementById('deleteConfirmForm')?.addEventListener('submit', (e) => {
            this.handleDeleteConfirm(e);
        });

        // Client Secret Modal
        document.getElementById('clientSecretCloseBtn')?.addEventListener('click', () => {
            this.hideClientSecretModal();
        });

        document.getElementById('clientSecretContinueBtn')?.addEventListener('click', () => {
            this.handleClientSecretContinue();
        });

        document.querySelector('#clientSecretModal .modal__overlay')?.addEventListener('click', () => {
            this.hideClientSecretModal();
        });

        // Copy client secret button
        document.getElementById('copyClientSecretBtn')?.addEventListener('click', () => {
            const secret = document.getElementById('newClientSecret').textContent;
            this.copyToClipboard('newClientSecret');
        });

        // SSO URL Modal
        document.getElementById('ssoUrlCloseBtn')?.addEventListener('click', () => {
            this.hideSsoUrlModal();
        });

        document.querySelector('#ssoUrlModal .modal__overlay')?.addEventListener('click', () => {
            this.hideSsoUrlModal();
        });

        // Copy SSO URL button
        document.getElementById('copySsoUrlBtn')?.addEventListener('click', () => {
            this.copyToClipboard('ssoUrlDisplay');
        });

        // Enable API Modal
        document.getElementById('enableApiCloseBtn')?.addEventListener('click', () => {
            this.hideEnableApiModal();
        });

        document.getElementById('cancelEnableApiBtn')?.addEventListener('click', () => {
            this.hideEnableApiModal();
        });

        document.querySelector('#enableApiModal .modal__overlay')?.addEventListener('click', () => {
            this.hideEnableApiModal();
        });

        document.getElementById('confirmEnableApiBtn')?.addEventListener('click', () => {
            this.confirmEnableApi();
        });

        // Disable API Modal
        document.getElementById('disableApiCloseBtn')?.addEventListener('click', () => {
            this.hideDisableApiModal();
        });

        document.getElementById('cancelDisableApiBtn')?.addEventListener('click', () => {
            this.hideDisableApiModal();
        });

        document.querySelector('#disableApiModal .modal__overlay')?.addEventListener('click', () => {
            this.hideDisableApiModal();
        });

        document.getElementById('confirmDisableApiBtn')?.addEventListener('click', () => {
            this.confirmDisableApi();
        });

        // Event delegation for dynamically rendered elements in details modal
        this.setupEventDelegation();
    }

    /**
     * Setup event delegation for dynamically rendered content
     */
    setupEventDelegation() {
        const detailsModal = document.getElementById('appDetailsModal');
        if (!detailsModal) return;

        // Click delegation
        detailsModal.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const id = parseInt(target.dataset.id, 10);
            const name = target.dataset.name;

            switch (action) {
                case 'delete-redirect-uri':
                    this.deleteRedirectUri(id);
                    break;
                case 'delete-origin':
                    this.deleteAuthorizedOrigin(id);
                    break;
                case 'enable-api':
                    this.enableApi(id, name);
                    break;
                case 'disable-api':
                    this.disableApi(id, name);
                    break;
                case 'toggle-accordion':
                    this.toggleAccordion(target, id);
                    break;
                case 'add-redirect-uri':
                    this.addRedirectUriInput();
                    break;
                case 'add-origin':
                    this.addOriginInput();
                    break;
                case 'remove-input':
                    target.closest('.add-uri-form')?.remove();
                    break;
                case 'copy-to-clipboard':
                    this.copyToClipboard(target.dataset.target);
                    break;
                case 'show-sso-url-modal':
                    this.showSsoUrlModal();
                    break;
                case 'hide-sso-url-modal':
                    this.hideSsoUrlModal();
                    break;
                case 'save-all-redirect-uris':
                    this.saveAllRedirectUris();
                    break;
                case 'save-all-origins':
                    this.saveAllOrigins();
                    break;
            }
        });

        // Change delegation for scope checkboxes
        detailsModal.addEventListener('change', (e) => {
            const target = e.target;
            if (target.classList.contains('scope-checkbox') && !target.disabled) {
                const scopeId = parseInt(target.dataset.scopeId, 10);
                const scopeName = target.dataset.scopeName;
                this.toggleScope(scopeId, scopeName, target.checked);
            }
        });

        // Change delegation for SSO redirect URI select
        const ssoRedirectUriSelect = document.getElementById('ssoRedirectUriSelect');
        if (ssoRedirectUriSelect) {
            ssoRedirectUriSelect.addEventListener('change', () => {
                this.updateSsoUrl();
            });
        }

        // Event delegation for SSO URL modal (separate modal)
        const ssoUrlModal = document.getElementById('ssoUrlModal');
        if (ssoUrlModal) {
            ssoUrlModal.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;

                const action = target.dataset.action;
                if (action === 'hide-sso-url-modal') {
                    this.hideSsoUrlModal();
                } else if (action === 'copy-to-clipboard') {
                    this.copyToClipboard(target.dataset.target);
                }
            });
        }
    }

    /**
     * Setup tab navigation
     */
    setupTabNavigation() {
        const myAppsTab = document.getElementById('myAppsTab');
        const authorizedAppsTab = document.getElementById('authorizedAppsTab');

        myAppsTab?.addEventListener('click', () => {
            this.switchTab('my-apps');
        });

        authorizedAppsTab?.addEventListener('click', () => {
            this.switchTab('authorized-apps');
        });

        // Authorized apps retry button
        document.getElementById('authorizedRetryBtn')?.addEventListener('click', () => {
            this.loadAuthorizedApps();
        });
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        this.activeTab = tabName;

        // Update tab buttons
        const myAppsTab = document.getElementById('myAppsTab');
        const authorizedAppsTab = document.getElementById('authorizedAppsTab');

        if (tabName === 'my-apps') {
            myAppsTab?.classList.add('oauth-tabs__tab--active');
            authorizedAppsTab?.classList.remove('oauth-tabs__tab--active');
        } else {
            myAppsTab?.classList.remove('oauth-tabs__tab--active');
            authorizedAppsTab?.classList.add('oauth-tabs__tab--active');
        }

        // Update tab content
        const myAppsContent = document.getElementById('myAppsContent');
        const authorizedAppsContent = document.getElementById('authorizedAppsContent');

        if (tabName === 'my-apps') {
            myAppsContent.style.display = 'block';
            myAppsContent.classList.add('oauth-tab-content--active');
            authorizedAppsContent.style.display = 'none';
            authorizedAppsContent.classList.remove('oauth-tab-content--active');
        } else {
            myAppsContent.style.display = 'none';
            myAppsContent.classList.remove('oauth-tab-content--active');
            authorizedAppsContent.style.display = 'block';
            authorizedAppsContent.classList.add('oauth-tab-content--active');

            // Load authorized apps if not already loaded
            if (!this.authorizedAppsLoaded) {
                this.loadAuthorizedApps();
            }
        }
    }

    /**
     * Load applications list
     */
    /**
     * Get CSRF token from meta tag
     */
    getCsrfToken() {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : '';
    }

    /**
     * Show success toast notification
     */
    showSuccess(message) {
        Toastify({
            text: message,
            duration: 3000,
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(to right, #00b09b, #96c93d)",
            }
        }).showToast();
    }

    /**
     * Show error toast notification
     */
    showError(message) {
        Toastify({
            text: message,
            duration: 4000,
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(to right, #ff5f6d, #ffc371)",
            }
        }).showToast();
    }

    async loadApplications() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const errorState = document.getElementById('errorState');
        const container = document.getElementById('appsListContainer');

        // Show loading, hide everything else
        if (loadingState) loadingState.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (container) container.style.display = 'none';

        try {
            const response = await fetch('/api/v1/oauth/clients', {
                credentials: 'include',
                headers: {
                    'X-CSRF-Token': this.getCsrfToken()
                }
            });

            // If authentication required or no apps, show empty state
            if (response.status === 401 || response.status === 403) {
                if (loadingState) loadingState.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to load applications');
            }

            const data = await response.json();
            const apps = data.clients || [];

            // Hide loading
            if (loadingState) loadingState.style.display = 'none';

            if (apps.length === 0) {
                // Show empty state
                if (emptyState) emptyState.style.display = 'block';
            } else {
                // Show apps list
                if (container) {
                    container.innerHTML = apps.map(app => this.renderAppCard(app)).join('');
                    container.style.display = 'block';

                    // Add click handlers for each app card
                    apps.forEach(app => {
                        document.getElementById(`app-card-${app.id}`)?.addEventListener('click', () => {
                            this.showAppDetails(app.client_id, app.id, app.client_name);
                        });
                    });
                }
            }

        } catch (error) {
            console.error('Error loading applications:', error);

            // Hide loading, show error
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) {
                errorState.style.display = 'block';
                const errorMessage = errorState.querySelector('.error-state__message');
                if (errorMessage) {
                    errorMessage.textContent = error.message || 'An unexpected error occurred';
                }
            }
        }
    }

    /**
     * Render application card
     */
    renderAppCard(app) {
        return `
            <div class="app-card" id="app-card-${app.id}">
                <div class="app-card__header">
                    <div>
                        <h3 class="app-card__title">${this.escapeHtml(app.client_name)}</h3>
                        ${app.description ? `<p style="color: #6b7280; margin-top: 0.25rem;">${this.escapeHtml(app.description)}</p>` : ''}
                    </div>
                    <span class="app-card__type">${app.client_type === 'confidential' ? 'Confidential' : 'Public'}</span>
                </div>
                <div class="app-card__client-id">Client ID: ${this.escapeHtml(app.client_id)}</div>
            </div>
        `;
    }

    /**
     * Show create application modal
     */
    showCreateModal() {
        const modal = document.getElementById('appModal');
        document.getElementById('modalTitle').textContent = 'Create OAuth Application';
        document.getElementById('saveOAuthAppBtn').querySelector('.btn__text').textContent = 'Create Application';
        document.getElementById('oauthAppForm').reset();
        modal.setAttribute('aria-hidden', 'false');
    }

    /**
     * Hide create application modal
     */
    hideCreateModal() {
        const modal = document.getElementById('appModal');
        modal.setAttribute('aria-hidden', 'true');
    }

    /**
     * Handle create application
     */
    async handleCreateApp(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const data = {
            client_name: formData.get('client_name'),
            description: formData.get('description') || null,
            client_type: formData.get('client_type'),
            homepage_url: formData.get('homepage_url') || null,
            privacy_policy_url: formData.get('privacy_policy_url') || null,
            terms_of_service_url: formData.get('terms_of_service_url') || null,
        };

        const submitBtn = document.getElementById('saveOAuthAppBtn');
        submitBtn.disabled = true;
        submitBtn.querySelector('.btn__text').textContent = 'Creating...';

        try {
            const response = await fetch('/api/v1/oauth/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCsrfToken()
                },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || result.message || 'Failed to create application');
            }

            this.showSuccess('OAuth application created successfully!');
            this.hideCreateModal();
            await this.loadApplications();

            // If client secret was generated, show it first
            if (result.client_secret) {
                this.showClientSecretModal(result.client_secret, result.client_id, result.id, data.client_name);
            } else {
                // Show the details of the newly created app
                if (result.client_id && result.id) {
                    this.showAppDetails(result.client_id, result.id, data.client_name);
                }
            }

        } catch (error) {
            console.error('Error creating OAuth application:', error);
            this.showError(`Failed to create application: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn__text').textContent = 'Create Application';
        }
    }

    /**
     * Show application details modal
     */
    async showAppDetails(clientId, clientDbId, clientName) {
        this.currentClientId = clientId;
        this.currentClientName = clientName;

        const modal = document.getElementById('appDetailsModal');
        modal.setAttribute('aria-hidden', 'false');
        document.getElementById('detailsModalTitle').textContent = clientName || 'Application Details';

        // Load application details (use clientId string for all routes)
        await Promise.all([
            this.loadCredentials(clientId),
            this.loadRedirectUris(clientId),
            this.loadAuthorizedOrigins(clientId),
            this.loadEnabledApis(clientId)
        ]);
    }

    /**
     * Hide details modal
     */
    hideDetailsModal() {
        const modal = document.getElementById('appDetailsModal');
        modal.setAttribute('aria-hidden', 'true');
        this.currentClientId = null;
        this.currentClientName = null;
    }

    /**
     * Show client secret modal after creation
     */
    showClientSecretModal(clientSecret, clientId, clientDbId, clientName) {
        const modal = document.getElementById('clientSecretModal');

        // Display the secret
        document.getElementById('newClientSecret').textContent = clientSecret;

        // Store details for "Continue" button
        modal.dataset.clientId = clientId;
        modal.dataset.clientDbId = clientDbId;
        modal.dataset.clientName = clientName;

        // Show modal
        modal.setAttribute('aria-hidden', 'false');
    }

    /**
     * Hide client secret modal
     */
    hideClientSecretModal() {
        const modal = document.getElementById('clientSecretModal');
        modal.setAttribute('aria-hidden', 'true');

        // Clear stored data
        delete modal.dataset.clientId;
        delete modal.dataset.clientDbId;
        delete modal.dataset.clientName;
    }

    /**
     * Handle continue from client secret modal
     */
    handleClientSecretContinue() {
        const modal = document.getElementById('clientSecretModal');
        const clientId = modal.dataset.clientId;
        const clientDbId = modal.dataset.clientDbId;
        const clientName = modal.dataset.clientName;

        this.hideClientSecretModal();

        // Show the details modal
        if (clientId && clientDbId) {
            this.showAppDetails(clientId, clientDbId, clientName);
        }
    }

    /**
     * Load application credentials
     */
    async loadCredentials(clientId) {
        try {
            const response = await fetch(`/api/v1/oauth/clients/${clientId}`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to load credentials');

            const data = await response.json();

            document.getElementById('detailClientId').textContent = data.client_id;

            // Show client secret if available (for confidential clients)
            if (data.secrets && data.secrets.length > 0) {
                document.getElementById('clientSecretSection').style.display = 'block';
                document.getElementById('detailClientSecret').textContent = data.secrets[0].secret_value || '(already hashed - not shown)';
            } else {
                document.getElementById('clientSecretSection').style.display = 'none';
            }

        } catch (error) {
            console.error('Error loading credentials:', error);
        }
    }

    /**
     * Load redirect URIs
     */
    async loadRedirectUris(clientId) {
        const container = document.getElementById('redirectUrisList');

        try {
            const response = await fetch(`/api/v1/oauth/clients/${clientId}/redirect-uris`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to load redirect URIs');

            const data = await response.json();
            const uris = data.redirect_uris || [];

            if (uris.length === 0) {
                container.innerHTML = '<p style="color: #6b7280;">No redirect URIs configured yet.</p>';
            } else {
                container.innerHTML = uris.map(uri => `
                    <div class="uri-item">
                        <code>${this.escapeHtml(uri.redirect_uri)}</code>
                        <button type="button" class="btn-delete" data-action="delete-redirect-uri" data-id="${uri.id}">Delete</button>
                    </div>
                `).join('');
            }

        } catch (error) {
            console.error('Error loading redirect URIs:', error);
            container.innerHTML = '<p style="color: #dc2626;">Failed to load redirect URIs.</p>';
        }
    }

    /**
     * Load authorized origins
     */
    async loadAuthorizedOrigins(clientId) {
        const container = document.getElementById('authorizedOriginsList');

        try {
            const response = await fetch(`/api/v1/oauth/clients/${clientId}/authorized-domains`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to load authorized origins');

            const data = await response.json();
            const origins = data.authorized_domains || [];

            if (origins.length === 0) {
                container.innerHTML = '<p style="color: #6b7280;">No authorized origins configured yet.</p>';
            } else {
                container.innerHTML = origins.map(origin => `
                    <div class="origin-item">
                        <code>${this.escapeHtml(origin.domain)}</code>
                        <button type="button" class="btn-delete" data-action="delete-origin" data-id="${origin.id}">Delete</button>
                    </div>
                `).join('');
            }

        } catch (error) {
            console.error('Error loading authorized origins:', error);
            container.innerHTML = '<p style="color: #dc2626;">Failed to load authorized origins.</p>';
        }
    }

    /**
     * Load enabled APIs (Google Cloud Platform style)
     */
    async loadEnabledApis(clientId) {
        const container = document.getElementById('enabledApisList');

        try {
            // First, get all available API products with their scopes
            const apiProductsResponse = await fetch(`/api/v1/oauth/clients/${clientId}/api-products`, {
                credentials: 'include'
            });

            if (!apiProductsResponse.ok) throw new Error('Failed to load API products');

            const apiProductsData = await apiProductsResponse.json();
            const allApis = apiProductsData.api_products || [];

            // Then, get enabled APIs for this client with their granted scopes
            const enabledResponse = await fetch(`/api/v1/oauth/clients/${clientId}/enabled-apis`, {
                credentials: 'include'
            });

            if (!enabledResponse.ok) throw new Error('Failed to load enabled APIs');

            const enabledData = await enabledResponse.json();
            // Convert to integers for consistent comparison (prevents string/number mismatch)
            // Note: enabled_apis returns `id` (which is the api_product_id)
            const enabledApiIds = (enabledData.enabled_apis || []).map(api => parseInt(api.id, 10));

            // Get the granted scopes for this client (from enabled APIs response)
            const grantedScopes = new Set();
            (enabledData.enabled_apis || []).forEach(api => {
                (api.scopes || []).forEach(scope => {
                    grantedScopes.add(parseInt(scope.id, 10));
                });
            });

            // Debug logging for troubleshooting
            console.log('Enabled API IDs:', enabledApiIds);
            console.log('Granted scope IDs:', [...grantedScopes]);
            console.log('All APIs:', allApis.map(a => ({ id: a.id, name: a.product_name })));

            // Render all APIs
            if (allApis.length === 0) {
                container.innerHTML = '<p style="color: #6b7280;">No APIs available yet.</p>';
            } else {
                container.innerHTML = allApis.map(api => {
                    const apiId = parseInt(api.id, 10);
                    const isEnabled = enabledApiIds.includes(apiId);
                    console.log(`API ${api.product_name} (id: ${apiId}): isEnabled=${isEnabled}`);
                    return this.renderApiCard(api, isEnabled, grantedScopes);
                }).join('');

                // Restore expanded accordion state
                this.restoreAccordionState();
            }

        } catch (error) {
            console.error('Error loading APIs:', error);
            container.innerHTML = '<p style="color: #dc2626;">Failed to load APIs.</p>';
        }
    }

    /**
     * Restore accordion expanded state after re-render
     */
    restoreAccordionState() {
        this.expandedAccordions.forEach(apiId => {
            const accordion = document.querySelector(`.api-card__accordion[data-api-id="${apiId}"]`);
            if (accordion) {
                const button = accordion.querySelector('.api-card__accordion-header');
                const content = accordion.querySelector('.api-card__accordion-content');
                const icon = button.querySelector('.api-card__accordion-icon');

                if (button && content && icon) {
                    button.setAttribute('aria-expanded', 'true');
                    content.setAttribute('aria-hidden', 'false');
                    content.style.maxHeight = content.scrollHeight + 'px';
                    icon.textContent = '▼';
                }
            }
        });
    }

    /**
     * Render API card (Google Cloud Platform style)
     *
     * When API is enabled:
     * - Shows "Disable API" button
     * - Shows scope checkboxes
     * - `galleries.read` is always checked and disabled (can't uncheck)
     * - `galleries.write`, `galleries.edit`, `galleries.delete` are optional
     */
    renderApiCard(api, isEnabled, grantedScopes) {
        const scopes = api.scopes || [];
        const grantedCount = scopes.filter(s => grantedScopes.has(parseInt(s.id, 10)) || s.scope_name === 'galleries.read').length;

        return `
            <div class="api-card ${isEnabled ? 'api-card--enabled' : ''}">
                <div class="api-card__header">
                    <div>
                        <div class="api-card__title-row">
                            <h4 class="api-card__title">${this.escapeHtml(api.product_name || api.name)}</h4>
                            ${isEnabled ? '<span class="api-card__status api-card__status--enabled">API Enabled</span>' : ''}
                        </div>
                        <p class="api-card__desc">${this.escapeHtml(api.product_description || api.description || 'No description available')}</p>
                    </div>
                    <button
                        type="button"
                        class="btn btn--${isEnabled ? 'danger' : 'primary'} btn--small"
                        data-action="${isEnabled ? 'disable-api' : 'enable-api'}"
                        data-id="${api.id}"
                        data-name="${this.escapeHtml(api.product_name || api.name)}"
                    >
                        ${isEnabled ? 'Disable API' : 'Enable API'}
                    </button>
                </div>
                ${isEnabled && scopes.length > 0 ? `
                    <div class="api-card__accordion" data-api-id="${api.id}">
                        <button
                            type="button"
                            class="api-card__accordion-header"
                            data-action="toggle-accordion"
                            data-id="${api.id}"
                            aria-expanded="false"
                        >
                            <span class="api-card__accordion-title">
                                <span class="api-card__accordion-icon">▶</span>
                                Scope Permissions
                                <span class="api-card__accordion-badge">${grantedCount}/${scopes.length} enabled</span>
                            </span>
                        </button>
                        <div class="api-card__accordion-content" aria-hidden="true">
                            <p class="api-card__scopes-subtitle">Select which operations this OAuth client can perform on galleries.</p>
                            ${scopes.map(scope => {
                                const scopeId = parseInt(scope.id, 10);
                                const isGranted = grantedScopes.has(scopeId);
                                const isReadScope = scope.scope_name === 'galleries.read';
                                const scopeLabel = this.getScopeLabel(scope.scope_name);
                                const scopeIcon = this.getScopeIcon(scope.scope_name);

                                return `
                                    <label class="scope-checkbox ${isReadScope ? 'scope-checkbox--required' : ''} ${isGranted ? 'scope-checkbox--granted' : ''}">
                                        <input
                                            type="checkbox"
                                            class="scope-checkbox"
                                            data-scope-id="${scope.id}"
                                            data-scope-name="${this.escapeHtml(scope.scope_name)}"
                                            ${isGranted || isReadScope ? 'checked' : ''}
                                            ${isReadScope ? 'disabled' : ''}
                                        />
                                        <span class="scope-checkbox__label">
                                            <span class="scope-icon">${scopeIcon}</span>
                                            <span class="scope-info">
                                                <strong>${scopeLabel}</strong>
                                                <span class="scope-desc">${this.escapeHtml(scope.scope_description || '')}</span>
                                                ${isReadScope ? '<span class="scope-required-badge">Required</span>' : ''}
                                                ${scope.sensitive ? '<span class="scope-sensitive-badge">🔒 Sensitive</span>' : ''}
                                            </span>
                                        </span>
                                    </label>
                                `;
                            }).join('')}
                            <p class="api-card__scopes-note">
                                <strong>Note:</strong> Write, Edit, and Delete operations only apply to galleries owned by the user who authorized this application.
                            </p>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Toggle accordion open/closed
     */
    toggleAccordion(button, apiProductId) {
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        const content = button.nextElementSibling;
        const icon = button.querySelector('.api-card__accordion-icon');

        button.setAttribute('aria-expanded', !isExpanded);
        content.setAttribute('aria-hidden', isExpanded);

        // Track expanded state
        if (!isExpanded) {
            content.style.maxHeight = content.scrollHeight + 'px';
            icon.textContent = '▼';
            this.expandedAccordions.add(apiProductId);
        } else {
            content.style.maxHeight = '0';
            icon.textContent = '▶';
            this.expandedAccordions.delete(apiProductId);
        }
    }

    /**
     * Get human-readable label for scope
     */
    getScopeLabel(scopeName) {
        const labels = {
            'galleries.read': 'Read Galleries',
            'galleries.write': 'Create Galleries',
            'galleries.edit': 'Edit Galleries',
            'galleries.delete': 'Delete Galleries'
        };
        return labels[scopeName] || scopeName;
    }

    /**
     * Get icon for scope
     */
    getScopeIcon(scopeName) {
        const icons = {
            'galleries.read': '👁️',
            'galleries.write': '✏️',
            'galleries.edit': '📝',
            'galleries.delete': '🗑️'
        };
        return icons[scopeName] || '🔑';
    }

    /**
     * Enable API - shows confirmation modal
     */
    enableApi(apiProductId, apiName) {
        this.showEnableApiModal(apiProductId, apiName);
    }

    /**
     * Show enable API confirmation modal
     */
    showEnableApiModal(apiProductId, apiName) {
        this.pendingApiProductId = apiProductId;
        this.pendingApiName = apiName;

        document.getElementById('enableApiNameDisplay').textContent = apiName;

        const modal = document.getElementById('enableApiModal');
        modal.setAttribute('aria-hidden', 'false');
    }

    /**
     * Hide enable API confirmation modal
     */
    hideEnableApiModal() {
        const modal = document.getElementById('enableApiModal');
        modal.setAttribute('aria-hidden', 'true');
        this.pendingApiProductId = null;
        this.pendingApiName = null;
    }

    /**
     * Confirm enable API (called from modal)
     */
    async confirmEnableApi() {
        const apiProductId = this.pendingApiProductId;
        const apiName = this.pendingApiName;

        if (!apiProductId) {
            this.hideEnableApiModal();
            return;
        }

        const confirmBtn = document.getElementById('confirmEnableApiBtn');
        confirmBtn.disabled = true;
        confirmBtn.querySelector('.btn__text').textContent = 'Enabling...';

        try {
            const response = await fetch(`/api/v1/oauth/clients/${this.currentClientId}/enable-api`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCsrfToken()
                },
                body: JSON.stringify({ api_product_id: apiProductId }),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to enable API');
            }

            this.hideEnableApiModal();
            this.showSuccess(`${apiName} enabled successfully!`);
            await this.loadEnabledApis(this.currentClientId);

        } catch (error) {
            console.error('Error enabling API:', error);
            this.showError(`Failed to enable API: ${error.message}`);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.querySelector('.btn__text').textContent = 'Enable API';
        }
    }

    /**
     * Disable API - shows confirmation modal
     */
    disableApi(apiProductId, apiName) {
        this.showDisableApiModal(apiProductId, apiName);
    }

    /**
     * Show disable API confirmation modal
     */
    showDisableApiModal(apiProductId, apiName) {
        this.pendingApiProductId = apiProductId;
        this.pendingApiName = apiName;

        document.getElementById('disableApiNameDisplay').textContent = apiName;

        const modal = document.getElementById('disableApiModal');
        modal.setAttribute('aria-hidden', 'false');
    }

    /**
     * Hide disable API confirmation modal
     */
    hideDisableApiModal() {
        const modal = document.getElementById('disableApiModal');
        modal.setAttribute('aria-hidden', 'true');
        this.pendingApiProductId = null;
        this.pendingApiName = null;
    }

    /**
     * Confirm disable API (called from modal)
     */
    async confirmDisableApi() {
        const apiProductId = this.pendingApiProductId;
        const apiName = this.pendingApiName;

        if (!apiProductId) {
            this.hideDisableApiModal();
            return;
        }

        const confirmBtn = document.getElementById('confirmDisableApiBtn');
        confirmBtn.disabled = true;
        confirmBtn.querySelector('.btn__text').textContent = 'Disabling...';

        try {
            const response = await fetch(`/api/v1/oauth/clients/${this.currentClientId}/enabled-apis/${apiProductId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-Token': this.getCsrfToken()
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to disable API');
            }

            this.hideDisableApiModal();
            this.showSuccess(`${apiName} disabled successfully!`);
            await this.loadEnabledApis(this.currentClientId);

        } catch (error) {
            console.error('Error disabling API:', error);
            this.showError(`Failed to disable API: ${error.message}`);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.querySelector('.btn__text').textContent = 'Disable API';
        }
    }

    /**
     * Toggle scope (grant or revoke)
     */
    async toggleScope(scopeId, scopeName, isChecked) {
        try {
            if (isChecked) {
                // Grant scope
                const response = await fetch(`/api/v1/oauth/clients/${this.currentClientId}/scopes`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this.getCsrfToken()
                    },
                    body: JSON.stringify({ scope_id: scopeId }),
                    credentials: 'include'
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to grant scope');
                }

                this.showSuccess(`Scope '${scopeName}' granted successfully!`);

            } else {
                // Revoke scope
                const response = await fetch(`/api/v1/oauth/clients/${this.currentClientId}/scopes/${scopeId}`, {
                    method: 'DELETE',
                    headers: {
                        'X-CSRF-Token': this.getCsrfToken()
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Failed to revoke scope');
                }

                this.showSuccess(`Scope '${scopeName}' revoked successfully!`);
            }

            // Update UI without full re-render to preserve scroll position
            await this.updateScopeUI(scopeId, isChecked);

        } catch (error) {
            console.error('Error toggling scope:', error);
            this.showError(`Failed to ${isChecked ? 'grant' : 'revoke'} scope: ${error.message}`);
            // Revert checkbox state on error
            const checkbox = document.querySelector(`[data-scope-id="${scopeId}"]`);
            if (checkbox) {
                checkbox.checked = !isChecked;
            }
        }
    }

    /**
     * Update scope UI (counter) without full re-render
     */
    updateScopeUI(scopeId, isChecked) {
        // Update granted scopes tracking
        if (isChecked) {
            if (!this.grantedScopes.includes(scopeId)) {
                this.grantedScopes.push(scopeId);
            }
        } else {
            this.grantedScopes = this.grantedScopes.filter(id => id !== scopeId);
        }

        // Find the accordion for this scope's API and update the counter
        const accordion = document.querySelector('.api-card__accordion');
        if (accordion) {
            const headerBtn = accordion.querySelector('.api-card__accordion-header');
            const counter = headerBtn?.querySelector('.api-card__accordion-badge');
            if (counter) {
                // Count enabled scopes (checked checkboxes that are not disabled)
                const checkboxes = accordion.querySelectorAll('input.scope-checkbox:not(:disabled)');
                const enabledCount = Array.from(checkboxes).filter(cb => cb.checked).length;
                const totalCount = checkboxes.length + 1; // +1 for the required read scope
                counter.textContent = `${enabledCount + 1}/${totalCount} enabled`; // +1 for required scope
            }
        }
    }

    /**
     * Add a new redirect URI input field
     */
    addRedirectUriInput() {
        const container = document.getElementById('redirectUriInputs');
        const newInputGroup = document.createElement('div');
        newInputGroup.className = 'add-uri-form';
        newInputGroup.innerHTML = `
            <input type="text" placeholder="https://example.com/callback" class="form__input form__input--full redirect-uri-input" />
            <button type="button" class="btn-remove-uri" title="Remove this input" data-action="remove-input">-</button>
        `;
        container.appendChild(newInputGroup);
    }

    /**
     * Save all redirect URIs at once
     */
    async saveAllRedirectUris() {
        const inputs = document.querySelectorAll('.redirect-uri-input');
        const uris = [];

        // Collect all non-empty URIs
        inputs.forEach(input => {
            const value = input.value.trim();
            if (value) {
                uris.push(value);
            }
        });

        if (uris.length === 0) {
            this.showError('Please enter at least one redirect URI');
            return;
        }

        // Save each URI
        let successCount = 0;
        let errorCount = 0;

        for (const uri of uris) {
            try {
                const response = await fetch(`/api/v1/oauth/clients/${this.currentClientId}/redirect-uris`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this.getCsrfToken()
                    },
                    body: JSON.stringify({ redirect_uri: uri }),
                    credentials: 'include'
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }

            } catch (error) {
                console.error('Error adding redirect URI:', error);
                errorCount++;
            }
        }

        // Clear all inputs and reset to single input
        const container = document.getElementById('redirectUriInputs');
        container.innerHTML = `
            <div class="add-uri-form">
                <input type="text" placeholder="https://example.com/callback" class="form__input form__input--full redirect-uri-input" />
                <button type="button" class="btn-add-uri" title="Add Another Redirect URI" data-action="add-redirect-uri">+</button>
            </div>
        `;

        // Show result
        if (successCount > 0) {
            this.showSuccess(`${successCount} redirect URI(s) added successfully!`);
        }
        if (errorCount > 0) {
            this.showError(`Failed to add ${errorCount} redirect URI(s)`);
        }

        // Reload the list
        await this.loadRedirectUris(this.currentClientId);
    }

    /**
     * Delete redirect URI
     */
    async deleteRedirectUri(uriId) {
        if (!confirm('Delete this redirect URI?')) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/oauth/clients/${this.currentClientId}/redirect-uris/${uriId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-Token': this.getCsrfToken()
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete redirect URI');
            }

            this.showSuccess('Redirect URI deleted successfully!');
            await this.loadRedirectUris(this.currentClientId);

        } catch (error) {
            console.error('Error deleting redirect URI:', error);
            this.showError(`Failed to delete redirect URI: ${error.message}`);
        }
    }

    /**
     * Add a new authorized origin input field
     */
    addOriginInput() {
        const container = document.getElementById('authorizedOriginInputs');
        const newInputGroup = document.createElement('div');
        newInputGroup.className = 'add-uri-form';
        newInputGroup.innerHTML = `
            <input type="text" placeholder="https://example.com" class="form__input form__input--full origin-input" />
            <button type="button" class="btn-remove-uri" title="Remove this input" data-action="remove-input">-</button>
        `;
        container.appendChild(newInputGroup);
    }

    /**
     * Save all authorized origins at once
     */
    async saveAllOrigins() {
        const inputs = document.querySelectorAll('.origin-input');
        const origins = [];

        // Collect all non-empty origins
        inputs.forEach(input => {
            const value = input.value.trim();
            if (value) {
                origins.push(value);
            }
        });

        if (origins.length === 0) {
            this.showError('Please enter at least one authorized origin');
            return;
        }

        // Save each origin
        let successCount = 0;
        let errorCount = 0;

        for (const domain of origins) {
            try {
                const response = await fetch(`/api/v1/oauth/clients/${this.currentClientId}/authorized-domains`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': this.getCsrfToken()
                    },
                    body: JSON.stringify({ domain }),
                    credentials: 'include'
                });

                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }

            } catch (error) {
                console.error('Error adding authorized origin:', error);
                errorCount++;
            }
        }

        // Clear all inputs and reset to single input
        const container = document.getElementById('authorizedOriginInputs');
        container.innerHTML = `
            <div class="add-uri-form">
                <input type="text" placeholder="https://example.com" class="form__input form__input--full origin-input" />
                <button type="button" class="btn-add-uri" title="Add Another Origin" data-action="add-origin">+</button>
            </div>
        `;

        // Show result
        if (successCount > 0) {
            this.showSuccess(`${successCount} authorized origin(s) added successfully!`);
        }
        if (errorCount > 0) {
            this.showError(`Failed to add ${errorCount} authorized origin(s)`);
        }

        // Reload the list
        await this.loadAuthorizedOrigins(this.currentClientId);
    }

    /**
     * Delete authorized origin
     */
    async deleteAuthorizedOrigin(domainId) {
        if (!confirm('Delete this authorized origin?')) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/oauth/clients/${this.currentClientId}/authorized-domains/${domainId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-Token': this.getCsrfToken()
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete authorized origin');
            }

            this.showSuccess('Authorized origin deleted successfully!');
            await this.loadAuthorizedOrigins(this.currentClientId);

        } catch (error) {
            console.error('Error deleting authorized origin:', error);
            this.showError(`Failed to delete authorized origin: ${error.message}`);
        }
    }

    /**
     * Show delete confirmation modal
     */
    showDeleteConfirmModal() {
        if (!this.currentClientId || !this.currentClientName) {
            this.showError('No application selected');
            return;
        }

        // Display application name in the modal
        document.getElementById('deleteAppNameDisplay').textContent = this.currentClientName;

        // Clear previous input and error
        document.getElementById('deleteConfirmInput').value = '';
        document.getElementById('deleteConfirmError').textContent = '';

        // Show modal
        const modal = document.getElementById('deleteConfirmModal');
        modal.setAttribute('aria-hidden', 'false');
    }

    /**
     * Hide delete confirmation modal
     */
    hideDeleteConfirmModal() {
        const modal = document.getElementById('deleteConfirmModal');
        modal.setAttribute('aria-hidden', 'true');

        // Clear input
        document.getElementById('deleteConfirmInput').value = '';
        document.getElementById('deleteConfirmError').textContent = '';
    }

    /**
     * Handle delete confirmation form submission
     */
    async handleDeleteConfirm(event) {
        event.preventDefault();

        const input = document.getElementById('deleteConfirmInput');
        const errorSpan = document.getElementById('deleteConfirmError');
        const submitBtn = document.getElementById('confirmDeleteBtn');
        const typedName = input.value.trim();

        // Clear previous error
        errorSpan.textContent = '';

        // Validate that typed name matches application name
        if (typedName !== this.currentClientName) {
            errorSpan.textContent = 'Application name does not match. Please type the exact name.';
            input.focus();
            return;
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.querySelector('.btn__text').textContent = 'Deleting...';

        try {
            const response = await fetch(`/api/v1/oauth/clients/${this.currentClientId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-Token': this.getCsrfToken()
                },
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to delete application');
            }

            this.showSuccess(`Application "${this.currentClientName}" deleted successfully!`);
            this.hideDeleteConfirmModal();
            this.hideDetailsModal();
            await this.loadApplications();

        } catch (error) {
            console.error('Error deleting application:', error);
            errorSpan.textContent = error.message;
            this.showError(`Failed to delete application: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.querySelector('.btn__text').textContent = 'Delete Application';
        }
    }

    /**
     * Show SSO URL generator modal
     */
    async showSsoUrlModal() {
        if (!this.currentClientId) {
            this.showError('No application selected');
            return;
        }

        // Load redirect URIs if not already loaded
        await this.loadRedirectUrisForModal(this.currentClientId);

        // Load granted scopes
        await this.loadGrantedScopesForModal(this.currentClientId);

        // Show modal
        const modal = document.getElementById('ssoUrlModal');
        modal.setAttribute('aria-hidden', 'false');

        // Clear previous URL
        document.getElementById('ssoUrlDisplay').textContent = 'Select a redirect URI to generate the URL';
        document.getElementById('copySsoUrlBtn').disabled = true;
    }

    /**
     * Hide SSO URL modal
     */
    hideSsoUrlModal() {
        const modal = document.getElementById('ssoUrlModal');
        modal.setAttribute('aria-hidden', 'true');

        // Clear dropdown
        const select = document.getElementById('ssoRedirectUriSelect');
        select.innerHTML = '<option value="">-- Select a redirect URI --</option>';
    }

    /**
     * Load redirect URIs for modal dropdown
     */
    async loadRedirectUrisForModal(clientId) {
        const select = document.getElementById('ssoRedirectUriSelect');

        try {
            const response = await fetch(`/api/v1/oauth/clients/${clientId}/redirect-uris`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to load redirect URIs');

            const data = await response.json();
            this.redirectUris = data.redirect_uris || [];

            // Populate dropdown
            select.innerHTML = '<option value="">-- Select a redirect URI --</option>';
            this.redirectUris.forEach(uri => {
                const option = document.createElement('option');
                option.value = uri.redirect_uri;
                option.textContent = uri.redirect_uri;
                select.appendChild(option);
            });

            if (this.redirectUris.length === 0) {
                select.innerHTML = '<option value="">No redirect URIs configured</option>';
            }

        } catch (error) {
            console.error('Error loading redirect URIs:', error);
            select.innerHTML = '<option value="">Failed to load redirect URIs</option>';
        }
    }

    /**
     * Load granted scopes for OAuth URL
     */
    async loadGrantedScopesForModal(clientId) {
        try {
            const response = await fetch(`/api/v1/oauth/clients/${clientId}/enabled-apis`, {
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to load granted scopes');

            const data = await response.json();
            const enabledApis = data.enabled_apis || [];

            // Collect all granted scope names
            this.grantedScopes = [];
            enabledApis.forEach(api => {
                (api.scopes || []).forEach(scope => {
                    this.grantedScopes.push(scope.scope_name);
                });
            });

        } catch (error) {
            console.error('Error loading granted scopes:', error);
            this.grantedScopes = [];
        }
    }

    /**
     * Update SSO URL when redirect URI is selected
     */
    updateSsoUrl() {
        const select = document.getElementById('ssoRedirectUriSelect');
        const redirectUri = select.value;
        const display = document.getElementById('ssoUrlDisplay');
        const copyBtn = document.getElementById('copySsoUrlBtn');

        if (!redirectUri) {
            display.textContent = 'Select a redirect URI to generate the URL';
            copyBtn.disabled = true;
            return;
        }

        // Construct OAuth authorization URL
        const baseUrl = window.location.origin;
        const authUrl = new URL('/oauth/authorize', baseUrl);

        authUrl.searchParams.set('client_id', this.currentClientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');

        // Add scopes if any are granted
        if (this.grantedScopes.length > 0) {
            authUrl.searchParams.set('scope', this.grantedScopes.join(' '));
        }

        // Optional: Add state parameter placeholder (user should replace with actual CSRF token)
        authUrl.searchParams.set('state', 'YOUR_STATE_TOKEN_HERE');

        // Display URL
        display.textContent = authUrl.toString();
        copyBtn.disabled = false;
    }

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const text = element.textContent;

        try {
            await navigator.clipboard.writeText(text);
            this.showSuccess('Copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy:', error);

            // Fallback method
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();

            try {
                document.execCommand('copy');
                this.showSuccess('Copied to clipboard!');
            } catch (err) {
                this.showError('Failed to copy to clipboard');
            }

            document.body.removeChild(textArea);
        }
    }

    // ============================================================================
    // AUTHORIZED APPS SECTION
    // ============================================================================

    /**
     * Load authorized apps (apps the user has granted access to)
     */
    async loadAuthorizedApps() {
        const loadingState = document.getElementById('authorizedLoadingState');
        const emptyState = document.getElementById('authorizedEmptyState');
        const errorState = document.getElementById('authorizedErrorState');
        const container = document.getElementById('authorizedAppsListContainer');
        const badge = document.getElementById('authorizedAppsBadge');

        // Show loading, hide everything else
        if (loadingState) loadingState.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (container) container.style.display = 'none';

        try {
            const response = await fetch('/api/v1/oauth/authorized-apps', {
                credentials: 'include',
                headers: {
                    'X-CSRF-Token': this.getCsrfToken()
                }
            });

            // If authentication required, show empty state
            if (response.status === 401 || response.status === 403) {
                if (loadingState) loadingState.style.display = 'none';
                if (emptyState) emptyState.style.display = 'block';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to load authorized apps');
            }

            const data = await response.json();
            this.authorizedApps = data.apps || [];
            this.authorizedAppsLoaded = true;

            // Update badge
            if (badge) {
                if (this.authorizedApps.length > 0) {
                    badge.textContent = this.authorizedApps.length;
                    badge.style.display = 'inline-flex';
                } else {
                    badge.style.display = 'none';
                }
            }

            // Hide loading
            if (loadingState) loadingState.style.display = 'none';

            if (this.authorizedApps.length === 0) {
                // Show empty state
                if (emptyState) emptyState.style.display = 'block';
            } else {
                // Show authorized apps list
                if (container) {
                    container.innerHTML = this.authorizedApps.map(app => this.renderAuthorizedAppCard(app)).join('');
                    container.style.display = 'block';

                    // Add click handlers for revoke buttons
                    this.authorizedApps.forEach(app => {
                        document.getElementById(`revoke-btn-${app.consent_id}`)?.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.revokeAuthorization(app.client_db_id, app.client_name);
                        });
                    });
                }
            }

        } catch (error) {
            console.error('Error loading authorized apps:', error);

            // Hide loading, show error
            if (loadingState) loadingState.style.display = 'none';
            if (errorState) {
                errorState.style.display = 'block';
                const errorMessage = errorState.querySelector('.error-state__message');
                if (errorMessage) {
                    errorMessage.textContent = error.message || 'An unexpected error occurred';
                }
            }
        }
    }

    /**
     * Render authorized app card
     */
    renderAuthorizedAppCard(app) {
        const authorizedDate = new Date(app.authorized_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const lastUsedDate = new Date(app.last_used_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Format scopes for display
        const scopeLabels = (app.granted_scopes || []).map(scope => {
            const labels = {
                'galleries.read': 'Read Galleries',
                'galleries.write': 'Create Galleries',
                'galleries.edit': 'Edit Galleries',
                'galleries.delete': 'Delete Galleries'
            };
            return labels[scope] || scope;
        });

        return `
            <div class="authorized-app-card" id="authorized-app-${app.consent_id}">
                <div class="authorized-app-card__header">
                    <div class="authorized-app-card__info">
                        ${app.logo_url ? `
                            <img src="${this.escapeHtml(app.logo_url)}" alt="${this.escapeHtml(app.client_name)} logo" class="authorized-app-card__logo">
                        ` : `
                            <div class="authorized-app-card__logo authorized-app-card__logo--placeholder">
                                ${this.escapeHtml(app.client_name.charAt(0).toUpperCase())}
                            </div>
                        `}
                        <div>
                            <h3 class="authorized-app-card__title">${this.escapeHtml(app.client_name)}</h3>
                            ${app.client_description ? `<p class="authorized-app-card__desc">${this.escapeHtml(app.client_description)}</p>` : ''}
                        </div>
                    </div>
                    <button
                        type="button"
                        class="btn btn--danger btn--small"
                        id="revoke-btn-${app.consent_id}"
                        title="Revoke access"
                    >
                        Revoke Access
                    </button>
                </div>

                <div class="authorized-app-card__meta">
                    <div class="authorized-app-card__meta-item">
                        <span class="authorized-app-card__meta-label">Authorized:</span>
                        <span class="authorized-app-card__meta-value">${authorizedDate}</span>
                    </div>
                    <div class="authorized-app-card__meta-item">
                        <span class="authorized-app-card__meta-label">Last used:</span>
                        <span class="authorized-app-card__meta-value">${lastUsedDate}</span>
                    </div>
                </div>

                ${scopeLabels.length > 0 ? `
                    <div class="authorized-app-card__scopes">
                        <span class="authorized-app-card__scopes-label">Permissions:</span>
                        <div class="authorized-app-card__scopes-list">
                            ${scopeLabels.map(label => `<span class="scope-badge">${this.escapeHtml(label)}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                ${app.homepage_url || app.privacy_policy_url ? `
                    <div class="authorized-app-card__links">
                        ${app.homepage_url ? `<a href="${this.escapeHtml(app.homepage_url)}" target="_blank" rel="noopener noreferrer" class="authorized-app-card__link">🌐 Website</a>` : ''}
                        ${app.privacy_policy_url ? `<a href="${this.escapeHtml(app.privacy_policy_url)}" target="_blank" rel="noopener noreferrer" class="authorized-app-card__link">🔒 Privacy Policy</a>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Revoke authorization for an app
     */
    async revokeAuthorization(clientDbId, clientName) {
        if (!confirm(`Are you sure you want to revoke access for "${clientName}"?\n\nThis app will no longer be able to access your data.`)) {
            return;
        }

        try {
            const response = await fetch('/api/v1/oauth/authorized-apps/revoke', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': this.getCsrfToken()
                },
                body: JSON.stringify({ client_db_id: clientDbId }),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to revoke authorization');
            }

            this.showSuccess(`Access revoked for "${clientName}"`);

            // Reset loaded flag and reload
            this.authorizedAppsLoaded = false;
            await this.loadAuthorizedApps();

        } catch (error) {
            console.error('Error revoking authorization:', error);
            this.showError(`Failed to revoke access: ${error.message}`);
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
