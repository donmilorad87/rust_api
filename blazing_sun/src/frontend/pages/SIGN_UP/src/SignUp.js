import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';
import { FormValidator, PasswordToggle } from '../../GLOBAL/src/js/FormValidator.js';

/**
 * SignUp Page Controller
 * Handles user registration and account activation flow.
 *
 * Features:
 * - Rich reactive form validation
 * - Password visibility toggle
 * - Password confirmation matching
 *
 * Flow:
 * 1. User fills sign-up form
 * 2. Submit POST to /api/v1/auth/sign-up
 * 3. On success, show activation form
 * 4. User enters activation code from email
 * 5. Submit POST to /api/v1/account/activate-account
 * 6. On success, redirect to sign-in page
 */
export class SignUp {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
   * @param {HTMLElement} config.signupCard - Sign-up form card element
   * @param {HTMLElement} config.activationCard - Activation form card element
   * @param {HTMLFormElement} config.signupForm - Sign-up form element
   * @param {HTMLFormElement} config.activationForm - Activation form element
   * @param {Function} config.showToast - Toast notification function
   */
  constructor(config) {
    this.baseUrl = config.baseUrl || '';
    this.signupCard = config.signupCard;
    this.activationCard = config.activationCard;
    this.signupForm = config.signupForm;
    this.activationForm = config.activationForm;
    this.showToast = config.showToast || this.defaultToast.bind(this);

    this.userEmail = '';
    this.isSubmitting = false;
    this.validator = null;
    this.passwordToggle = null;
    this.confirmPasswordToggle = null;

    this.init();
  }

  /**
   * Initialize event listeners
   */
  init() {
    if (!this.signupForm || !this.activationForm) {
      console.error('SignUp: Required form elements not found');
      return;
    }

    // Initialize form validator
    this.initValidator();

    // Initialize password toggles
    this.initPasswordToggles();

    this.signupForm.addEventListener('submit', (e) => this.handleSignup(e));
    this.activationForm.addEventListener('submit', (e) => this.handleActivation(e));
  }

  /**
   * Initialize form validator with rich reactive validation
   */
  initValidator() {
    const firstNameInput = this.signupForm.querySelector('#first_name');
    const lastNameInput = this.signupForm.querySelector('#last_name');
    const emailInput = this.signupForm.querySelector('#email');
    const passwordInput = this.signupForm.querySelector('#password');
    const confirmPasswordInput = this.signupForm.querySelector('#confirm_password');

    const firstNameFeedback = document.getElementById('firstNameFeedback');
    const lastNameFeedback = document.getElementById('lastNameFeedback');
    const emailFeedback = document.getElementById('emailFeedback');
    const passwordFeedback = document.getElementById('passwordFeedback');
    const confirmPasswordFeedback = document.getElementById('confirmPasswordFeedback');

    this.validator = new FormValidator({ validateOnInput: true });

    if (firstNameInput && firstNameFeedback) {
      this.validator.bindInput(firstNameInput, 'first_name', firstNameFeedback);
    }

    if (lastNameInput && lastNameFeedback) {
      this.validator.bindInput(lastNameInput, 'last_name', lastNameFeedback);
    }

    if (emailInput && emailFeedback) {
      this.validator.bindInput(emailInput, 'email', emailFeedback);
    }

    if (passwordInput && passwordFeedback) {
      this.validator.bindInput(passwordInput, 'password', passwordFeedback);
    }

    if (confirmPasswordInput && passwordInput && confirmPasswordFeedback) {
      this.validator.bindPasswordConfirm(confirmPasswordInput, passwordInput, confirmPasswordFeedback);
    }
  }

  /**
   * Initialize password visibility toggles
   */
  initPasswordToggles() {
    const passwordInput = this.signupForm.querySelector('#password');
    const confirmPasswordInput = this.signupForm.querySelector('#confirm_password');
    const passwordToggleBtn = document.getElementById('passwordToggle');
    const confirmPasswordToggleBtn = document.getElementById('confirmPasswordToggle');

    if (passwordInput && passwordToggleBtn) {
      this.passwordToggle = new PasswordToggle(passwordInput, passwordToggleBtn);
    }

    if (confirmPasswordInput && confirmPasswordToggleBtn) {
      this.confirmPasswordToggle = new PasswordToggle(confirmPasswordInput, confirmPasswordToggleBtn);
    }
  }

  /**
   * Handle sign-up form submission
   * @param {Event} event
   */
  async handleSignup(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    // Use FormValidator for validation
    if (this.validator && !this.validator.validateAll()) {
      return;
    }

    const submitBtn = this.signupForm.querySelector('button[type="submit"]');
    const formData = this.getSignupFormData();

    this.setButtonLoading(submitBtn, true, 'Creating account...');
    this.isSubmitting = true;

    const result = await this.apiRequest('/api/v1/auth/sign-up', 'POST', formData);

    this.setButtonLoading(submitBtn, false, 'Sign Up');
    this.isSubmitting = false;

    if (result.ok) {
      this.showToast('Sign up successful! Please check your email for the activation code.', 'success');
      this.userEmail = formData.email;
      this.showActivationForm();
    } else {
      this.handleApiError(result);
    }
  }

  /**
   * Handle activation form submission
   * @param {Event} event
   */
  async handleActivation(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const submitBtn = this.activationForm.querySelector('button[type="submit"]');
    const codeInput = this.activationForm.querySelector('#activation_code');

    if (!codeInput || !codeInput.value.trim()) {
      this.showToast('Please enter the activation code', 'error');
      return;
    }

    const data = {
      code: codeInput.value.trim()
    };

    this.setButtonLoading(submitBtn, true, 'Activating...');
    this.isSubmitting = true;

    const result = await this.apiRequest('/api/v1/account/activate-account', 'POST', data);

    if (result.ok) {
      this.showToast('Account activated successfully! Redirecting to sign in...', 'success');
      this.setButtonLoading(submitBtn, false, 'Activated!');

      setTimeout(() => {
        window.location.href = '/sign-in';
      }, 2000);
    } else {
      this.setButtonLoading(submitBtn, false, 'Activate Account');
      this.isSubmitting = false;
      this.handleApiError(result);
    }
  }

  /**
   * Get form data from sign-up form
   * @returns {Object}
   */
  getSignupFormData() {
    return {
      first_name: this.signupForm.querySelector('#first_name')?.value.trim() || '',
      last_name: this.signupForm.querySelector('#last_name')?.value.trim() || '',
      email: this.signupForm.querySelector('#email')?.value.trim() || '',
      password: this.signupForm.querySelector('#password')?.value || '',
      confirm_password: this.signupForm.querySelector('#confirm_password')?.value || ''
    };
  }

  /**
   * Show activation form, hide sign-up form
   */
  showActivationForm() {
    if (this.signupCard && this.activationCard) {
      this.signupCard.classList.add('hidden');
      this.activationCard.classList.remove('hidden');

      const emailDisplay = this.activationCard.querySelector('#activation_email_display');
      if (emailDisplay) {
        emailDisplay.textContent = this.userEmail;
      }

      const codeInput = this.activationCard.querySelector('#activation_code');
      if (codeInput) {
        codeInput.focus();
      }
    }
  }

  /**
   * Set button loading state
   * @param {HTMLButtonElement} button
   * @param {boolean} isLoading
   * @param {string} text
   */
  setButtonLoading(button, isLoading, text) {
    if (!button) return;

    button.disabled = isLoading;
    button.textContent = text;

    if (isLoading) {
      button.classList.add('btn--loading');
    } else {
      button.classList.remove('btn--loading');
    }
  }

  /**
   * Handle API error response
   * @param {Object} result
   */
  handleApiError(result) {
    const message = result.data?.message || 'An error occurred. Please try again.';
    this.showToast(message, 'error');

    if (result.data?.errors) {
      for (const [field, errors] of Object.entries(result.data.errors)) {
        if (Array.isArray(errors)) {
          errors.forEach(err => this.showToast(`${field}: ${err}`, 'error'));
        }
      }
    }
  }

  /**
   * Make API request
   * @param {string} endpoint
   * @param {string} method
   * @param {Object|null} data
   * @returns {Promise<{ok: boolean, data: Object}>}
   */
  async apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
      method,
      headers: getCsrfHeaders()
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const result = await response.json();
      return { ok: response.ok, data: result };
    } catch (error) {
      console.error('API request failed:', error);
      return { ok: false, data: { message: 'Network error. Please try again.' } };
    }
  }

  /**
   * Default toast implementation (fallback)
   * @param {string} message
   * @param {string} type
   */
  defaultToast(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  }
}

export default SignUp;
