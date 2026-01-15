/**
 * LoginModal - Reusable login modal with rich validation
 *
 * Features:
 * - Email/password fields with validation
 * - Password visibility toggle
 * - "Keep me logged in" checkbox
 * - CSRF token support
 * - Success callback for post-login actions
 */
import { FormValidator, PasswordToggle } from './FormValidator.js';
import { getCsrfHeaders } from './csrf.js';

export class LoginModal {
    /**
     * @param {Object} options
     * @param {string} options.baseUrl - API base URL
     * @param {Function} options.onSuccess - Callback on successful login
     * @param {Function} options.onError - Callback on login error
     * @param {Function} options.showToast - Toast notification function
     * @param {boolean} options.redirectAfterLogin - Whether to redirect after login
     * @param {string} options.redirectUrl - URL to redirect to after login
     */
    constructor(options = {}) {
        this.options = {
            baseUrl: '',
            onSuccess: null,
            onError: null,
            showToast: null,
            redirectAfterLogin: false,
            redirectUrl: '/',
            ...options
        };

        this.modal = null;
        this.form = null;
        this.validator = null;
        this.passwordToggle = null;
        this.isSubmitting = false;

        this.createModal();
        this.init();
    }

    /**
     * Create the modal HTML structure
     */
    createModal() {
        // Check if modal already exists
        if (document.getElementById('loginModal')) {
            this.modal = document.getElementById('loginModal');
            return;
        }

        const modalHtml = `
            <div id="loginModal" class="login-modal" role="dialog" aria-modal="true" aria-labelledby="loginModalTitle">
                <div class="login-modal__backdrop" data-action="close"></div>
                <div class="login-modal__content">
                    <button type="button" class="login-modal__close" data-action="close" aria-label="Close login modal">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>

                    <header class="login-modal__header">
                        <h2 id="loginModalTitle" class="login-modal__title">Sign In</h2>
                        <p class="login-modal__subtitle">Enter your credentials to continue</p>
                    </header>

                    <form id="loginModalForm" class="login-modal__form" novalidate>
                        <!-- Email Field -->
                        <div class="form-group">
                            <label for="loginEmail">Email</label>
                            <div class="input-wrapper">
                                <input
                                    type="email"
                                    id="loginEmail"
                                    name="email"
                                    autocomplete="email"
                                    aria-required="true"
                                    aria-describedby="loginEmailFeedback"
                                    placeholder="you@example.com"
                                >
                            </div>
                            <div id="loginEmailFeedback" class="validation-feedback" aria-live="polite"></div>
                        </div>

                        <!-- Password Field -->
                        <div class="form-group">
                            <label for="loginPassword">Password</label>
                            <div class="input-wrapper input-wrapper--password">
                                <input
                                    type="password"
                                    id="loginPassword"
                                    name="password"
                                    autocomplete="current-password"
                                    aria-required="true"
                                    aria-describedby="loginPasswordFeedback"
                                    placeholder="Enter your password"
                                >
                                <button type="button" class="password-toggle" id="loginPasswordToggle" aria-label="Show password">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                            </div>
                            <div id="loginPasswordFeedback" class="validation-feedback" aria-live="polite"></div>
                        </div>

                        <!-- Remember Me -->
                        <div class="form-group form-group--checkbox">
                            <label class="checkbox-label">
                                <input type="checkbox" id="loginRemember" name="remember" value="1">
                                <span class="checkbox-custom"></span>
                                <span class="checkbox-text">Keep me logged in</span>
                            </label>
                        </div>

                        <!-- Error Message -->
                        <div id="loginModalError" class="login-modal__error" role="alert" aria-live="polite"></div>

                        <!-- Submit Button -->
                        <button type="submit" class="btn btn--primary btn--full" id="loginModalBtn">
                            Sign In
                        </button>
                    </form>

                    <footer class="login-modal__footer">
                        <a href="/forgot_password" class="link">Forgot password?</a>
                        <span class="login-modal__divider">|</span>
                        <a href="/sign_up" class="link">Create account</a>
                    </footer>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.modal = document.getElementById('loginModal');
    }

    /**
     * Initialize the modal
     */
    init() {
        this.form = this.modal.querySelector('#loginModalForm');
        const emailInput = this.modal.querySelector('#loginEmail');
        const passwordInput = this.modal.querySelector('#loginPassword');
        const emailFeedback = this.modal.querySelector('#loginEmailFeedback');
        const passwordFeedback = this.modal.querySelector('#loginPasswordFeedback');
        const passwordToggleBtn = this.modal.querySelector('#loginPasswordToggle');

        // Initialize form validator
        this.validator = new FormValidator({ validateOnInput: true });
        this.validator.bindInput(emailInput, 'email', emailFeedback);
        this.validator.bindInput(passwordInput, 'password', passwordFeedback);

        // Initialize password toggle
        this.passwordToggle = new PasswordToggle(passwordInput, passwordToggleBtn);

        // Event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button and backdrop
        this.modal.addEventListener('click', (e) => {
            if (e.target.closest('[data-action="close"]')) {
                this.hide();
            }
        });

        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.hide();
            }
        });

        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    /**
     * Handle form submission
     * @param {Event} e
     */
    async handleSubmit(e) {
        e.preventDefault();

        if (this.isSubmitting) return;

        // Validate all fields
        if (!this.validator.validateAll()) {
            return;
        }

        this.isSubmitting = true;
        this.setLoading(true);
        this.hideError();

        const formData = {
            email: this.form.querySelector('#loginEmail').value.trim(),
            password: this.form.querySelector('#loginPassword').value,
            remember: this.form.querySelector('#loginRemember').checked
        };

        try {
            const response = await fetch(`${this.options.baseUrl}/api/v1/auth/sign-in`, {
                method: 'POST',
                headers: getCsrfHeaders(),
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                // Store token in cookie
                if (data.token) {
                    const maxAge = formData.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7; // 30 days if remember, else 7
                    document.cookie = `auth_token=${data.token}; path=/; max-age=${maxAge}; SameSite=Strict`;
                }

                // Show success
                if (this.options.showToast) {
                    this.options.showToast('Sign in successful!', 'success');
                }

                // Callback
                if (this.options.onSuccess) {
                    this.options.onSuccess(data);
                }

                // Redirect or reload
                if (this.options.redirectAfterLogin) {
                    setTimeout(() => {
                        window.location.href = this.options.redirectUrl;
                    }, 500);
                } else {
                    // Reload current page to refresh auth state
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                }

                this.hide();
            } else {
                this.showError(data.message || 'Sign in failed. Please check your credentials.');

                if (this.options.onError) {
                    this.options.onError(data);
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please try again.');

            if (this.options.onError) {
                this.options.onError({ message: 'Network error' });
            }
        } finally {
            this.isSubmitting = false;
            this.setLoading(false);
        }
    }

    /**
     * Show loading state
     * @param {boolean} loading
     */
    setLoading(loading) {
        const btn = this.form.querySelector('#loginModalBtn');
        if (btn) {
            btn.disabled = loading;
            btn.textContent = loading ? 'Signing in...' : 'Sign In';
        }
    }

    /**
     * Show error message
     * @param {string} message
     */
    showError(message) {
        const errorEl = this.modal.querySelector('#loginModalError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorEl = this.modal.querySelector('#loginModalError');
        if (errorEl) {
            errorEl.style.display = 'none';
        }
    }

    /**
     * Show the modal
     */
    show() {
        this.modal.classList.add('login-modal--visible');
        document.body.style.overflow = 'hidden';

        // Focus first input
        setTimeout(() => {
            const firstInput = this.form.querySelector('input');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    /**
     * Hide the modal
     */
    hide() {
        this.modal.classList.remove('login-modal--visible');
        document.body.style.overflow = '';

        // Reset form
        this.form.reset();
        this.validator.reset();
        this.hideError();
    }

    /**
     * Check if modal is visible
     * @returns {boolean}
     */
    isVisible() {
        return this.modal.classList.contains('login-modal--visible');
    }

    /**
     * Destroy the modal
     */
    destroy() {
        if (this.modal) {
            this.modal.remove();
        }
    }
}

export default LoginModal;
