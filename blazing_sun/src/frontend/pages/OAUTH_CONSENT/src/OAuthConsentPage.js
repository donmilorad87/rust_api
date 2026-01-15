/**
 * OAuth Consent Page
 * Handles user consent for OAuth 2.0 authorization
 */
export default class OAuthConsentPage {
    constructor() {
        this.form = null;
        this.approveBtn = null;
        this.denyBtn = null;
        this.isSubmitting = false;
        this.loginModal = null;
        this.isLoggedIn = false;
    }

    /**
     * Initialize the consent page
     */
    init() {
        this.form = document.getElementById('consentForm');
        this.approveBtn = document.getElementById('approveBtn');
        this.denyBtn = document.getElementById('denyBtn');

        // Check if user is logged in (set by template)
        this.isLoggedIn = window.IS_LOGGED_IN === true;

        if (!this.form) {
            console.error('Consent form not found');
            return;
        }

        // If not logged in, show login modal
        if (!this.isLoggedIn) {
            this.initLoginModal();
        }

        this.setupEventListeners();
    }

    /**
     * Initialize login modal for unauthenticated users
     */
    initLoginModal() {
        // Wait for Blazing_Sun global to be ready
        const initModal = () => {
            if (window.Blazing_Sun?.LoginModal) {
                this.loginModal = new window.Blazing_Sun.LoginModal({
                    baseUrl: window.BASE_URL || '',
                    redirectAfterLogin: false,
                    onSuccess: () => {
                        // Reload page after login to show consent form properly
                        window.location.reload();
                    },
                    showToast: (msg, type) => {
                        console.log(`[${type}] ${msg}`);
                    }
                });

                // Show modal automatically
                this.loginModal.show();
            } else {
                // Retry after a short delay
                setTimeout(initModal, 100);
            }
        };

        if (document.readyState === 'complete') {
            initModal();
        } else {
            window.addEventListener('load', initModal);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Handle form submission via approve button
        this.approveBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.submitConsent(true);
        });

        // Handle form submission via deny button
        this.denyBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.submitConsent(false);
        });

        // Prevent double submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    }

    /**
     * Get form data as object
     */
    getFormData() {
        const formData = new FormData(this.form);
        const data = {};

        for (const [key, value] of formData.entries()) {
            data[key] = value;
        }

        return data;
    }

    /**
     * Get CSRF headers for fetch requests
     */
    getCsrfHeaders() {
        // Try to use global CSRF utility
        if (window.Blazing_Sun?.csrf?.getCsrfHeaders) {
            return window.Blazing_Sun.csrf.getCsrfHeaders();
        }

        // Fallback: get CSRF token from meta tag
        const metaTag = document.querySelector('meta[name="csrf-token"]');
        const token = metaTag?.getAttribute('content');

        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['X-CSRF-TOKEN'] = token;
        }

        return headers;
    }

    /**
     * Submit consent decision
     * @param {boolean} approved - Whether user approved the request
     */
    async submitConsent(approved) {
        if (this.isSubmitting) return;

        // If not logged in, show login modal instead
        if (!this.isLoggedIn) {
            if (this.loginModal) {
                this.loginModal.show();
            } else {
                this.initLoginModal();
            }
            return;
        }

        this.isSubmitting = true;
        this.setButtonsLoading(true);

        const formData = this.getFormData();

        const payload = {
            client_id: formData.client_id,
            redirect_uri: formData.redirect_uri,
            scope: formData.scope,
            state: formData.state || null,
            code_challenge: formData.code_challenge || null,
            code_challenge_method: formData.code_challenge_method || null,
            approved: approved,
        };

        try {
            const response = await fetch('/oauth/authorize', {
                method: 'POST',
                headers: this.getCsrfHeaders(),
                body: JSON.stringify(payload),
            });

            if (response.redirected) {
                // Follow the redirect to the callback URL
                if (!this.isValidRedirectUri(response.url)) {
                    this.showError('Invalid redirect URI. Please contact the application owner.');
                    return;
                }
                window.location.href = response.url;
                return;
            }

            // Handle JSON response (error cases)
            const data = await response.json();

            if (data.redirect_uri) {
                // Redirect with authorization code or error
                if (!this.isValidRedirectUri(data.redirect_uri)) {
                    this.showError('Invalid redirect URI. Please contact the application owner.');
                    return;
                }
                window.location.href = data.redirect_uri;
            } else if (data.error) {
                this.showError(this.buildErrorMessage(data));
            }
        } catch (error) {
            console.error('Consent submission error:', error);
            this.showError('An error occurred. Please try again.');
        } finally {
            this.isSubmitting = false;
            this.setButtonsLoading(false);
        }
    }

    /**
     * Set buttons loading state
     * @param {boolean} loading - Loading state
     */
    setButtonsLoading(loading) {
        if (this.approveBtn) {
            this.approveBtn.disabled = loading;
            this.approveBtn.textContent = loading ? 'Processing...' : 'Authorize';
        }
        if (this.denyBtn) {
            this.denyBtn.disabled = loading;
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.showToast(message, 'error');

        // Create or update error element
        let errorEl = document.querySelector('.oauth-consent__error');

        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'oauth-consent__error';
            this.form.insertBefore(errorEl, this.form.firstChild);
        }

        errorEl.textContent = message;
        errorEl.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    }

    /**
     * Build a human-friendly error message from API response
     * @param {Object} data
     */
    buildErrorMessage(data) {
        if (data?.error && data?.error_description) {
            return `${data.error}: ${data.error_description}`;
        }

        if (data?.error_description) {
            return data.error_description;
        }

        if (data?.error) {
            return data.error;
        }

        return 'Authorization failed. Please try again.';
    }

    /**
     * Show toast notification using Toastify if available
     * @param {string} message
     * @param {string} type
     */
    showToast(message, type = 'info') {
        const colors = {
            success: 'linear-gradient(to right, #00b09b, #96c93d)',
            error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
            info: 'linear-gradient(to right, #667eea, #764ba2)'
        };

        if (typeof Toastify !== 'undefined') {
            Toastify({
                text: message,
                duration: 5000,
                gravity: 'top',
                position: 'right',
                style: {
                    background: colors[type] || colors.info
                }
            }).showToast();
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Validate redirect URI scheme and host.
     * @param {string} redirectUri
     */
    isValidRedirectUri(redirectUri) {
        try {
            const parsed = new URL(redirectUri);
            const protocol = parsed.protocol.toLowerCase();
            const host = parsed.hostname.toLowerCase();

            if (protocol === 'https:') {
                return true;
            }

            if (protocol === 'http:') {
                return host === 'localhost' || host === '127.0.0.1' || host === '::1';
            }
        } catch (_) {
            return false;
        }

        return false;
    }
}
