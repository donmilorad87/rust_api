import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';
import { FormValidator, PasswordToggle } from '../../GLOBAL/src/js/FormValidator.js';

/**
 * ForgotPassword Page Controller
 * Handles the 3-step password reset flow:
 * 1. Request reset code (email)
 * 2. Verify code (20-character code)
 * 3. Reset password (new password)
 */
export class ForgotPassword {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
   * @param {HTMLElement} config.requestCard - Step 1 card element
   * @param {HTMLElement} config.verifyCard - Step 2 card element
   * @param {HTMLElement} config.resetCard - Step 3 card element
   * @param {HTMLFormElement} config.requestForm - Step 1 form element
   * @param {HTMLFormElement} config.verifyForm - Step 2 form element
   * @param {HTMLFormElement} config.resetForm - Step 3 form element
   * @param {HTMLButtonElement} config.requestBtn - Step 1 submit button
   * @param {HTMLButtonElement} config.verifyBtn - Step 2 submit button
   * @param {HTMLButtonElement} config.resetBtn - Step 3 submit button
   * @param {Function} config.showToast - Toast notification function
   */
  constructor(config) {
    this.baseUrl = config.baseUrl || '';
    this.requestCard = config.requestCard;
    this.verifyCard = config.verifyCard;
    this.resetCard = config.resetCard;
    this.requestForm = config.requestForm;
    this.verifyForm = config.verifyForm;
    this.resetForm = config.resetForm;
    this.requestBtn = config.requestBtn;
    this.verifyBtn = config.verifyBtn;
    this.resetBtn = config.resetBtn;
    this.showToast = config.showToast || this.defaultToast.bind(this);

    this.currentStep = 1;
    this.isSubmitting = false;
    this.userEmail = '';
    this.verifiedCode = '';
    this.emailValidator = null;
    this.passwordValidator = null;
    this.newPasswordToggle = null;
    this.confirmPasswordToggle = null;

    this.init();
  }

  /**
   * Initialize event listeners
   */
  init() {
    if (!this.requestForm || !this.verifyForm || !this.resetForm) {
      console.error('ForgotPassword: Required form elements not found');
      return;
    }

    // Initialize validators
    this.initValidators();

    // Initialize password toggles
    this.initPasswordToggles();

    this.requestForm.addEventListener('submit', (e) => this.handleRequestCode(e));
    this.verifyForm.addEventListener('submit', (e) => this.handleVerifyCode(e));
    this.resetForm.addEventListener('submit', (e) => this.handleResetPassword(e));

    // Add input formatting for code field
    const codeInput = document.getElementById('reset_code');
    if (codeInput) {
      codeInput.addEventListener('input', (e) => this.formatCodeInput(e));
    }
  }

  /**
   * Initialize form validators with rich reactive validation
   */
  initValidators() {
    const emailInput = document.getElementById('email');
    const emailFeedback = document.getElementById('emailFeedback');

    const newPasswordInput = document.getElementById('new_password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const newPasswordFeedback = document.getElementById('newPasswordFeedback');
    const confirmPasswordFeedback = document.getElementById('confirmPasswordFeedback');

    // Email validator (step 1)
    this.emailValidator = new FormValidator({ validateOnInput: true });

    if (emailInput && emailFeedback) {
      this.emailValidator.bindInput(emailInput, 'email', emailFeedback);
    }

    // Password validator (step 3)
    this.passwordValidator = new FormValidator({ validateOnInput: true });

    if (newPasswordInput && newPasswordFeedback) {
      this.passwordValidator.bindInput(newPasswordInput, 'password', newPasswordFeedback);
    }

    if (confirmPasswordInput && newPasswordInput && confirmPasswordFeedback) {
      this.passwordValidator.bindPasswordConfirm(confirmPasswordInput, newPasswordInput, confirmPasswordFeedback);
    }
  }

  /**
   * Initialize password visibility toggles
   */
  initPasswordToggles() {
    const newPasswordInput = document.getElementById('new_password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const newPasswordToggleBtn = document.getElementById('newPasswordToggle');
    const confirmPasswordToggleBtn = document.getElementById('confirmPasswordToggle');

    if (newPasswordInput && newPasswordToggleBtn) {
      this.newPasswordToggle = new PasswordToggle(newPasswordInput, newPasswordToggleBtn);
    }

    if (confirmPasswordInput && confirmPasswordToggleBtn) {
      this.confirmPasswordToggle = new PasswordToggle(confirmPasswordInput, confirmPasswordToggleBtn);
    }
  }

  /**
   * Step 1: Handle request reset code submission
   * @param {Event} event
   */
  async handleRequestCode(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    // Use FormValidator for email validation
    if (this.emailValidator && !this.emailValidator.validateAll()) {
      return;
    }

    const email = this.requestForm.querySelector('#email')?.value.trim() || '';

    this.setButtonLoading(this.requestBtn, true, 'Sending...');
    this.isSubmitting = true;

    const result = await this.apiRequest('/api/v1/account/forgot-password', 'POST', { email });

    this.isSubmitting = false;

    if (result.ok) {
      this.userEmail = email;
      this.showToast('Reset code sent! Please check your email.', 'success');

      // Store email for later steps
      const verifyEmailInput = document.getElementById('verify_email');
      const resetEmailInput = document.getElementById('reset_email');
      if (verifyEmailInput) verifyEmailInput.value = email;
      if (resetEmailInput) resetEmailInput.value = email;

      this.goToStep(2);
    } else {
      this.setButtonLoading(this.requestBtn, false, 'Send Reset Code');
      this.handleApiError(result);
    }
  }

  /**
   * Step 2: Handle verify code submission
   * @param {Event} event
   */
  async handleVerifyCode(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const code = this.verifyForm.querySelector('#reset_code')?.value.trim() || '';
    const email = this.userEmail || document.getElementById('verify_email')?.value || '';

    if (!code || code.length < 20) {
      this.showToast('Please enter the 20 character code', 'error');
      return;
    }

    this.setButtonLoading(this.verifyBtn, true, 'Verifying...');
    this.isSubmitting = true;

    const result = await this.apiRequest('/api/v1/account/verify-hash', 'POST', {
      email,
      code
    });

    this.isSubmitting = false;

    if (result.ok) {
      this.showToast('Code verified! Please enter your new password.', 'success');

      // Store verified code for reset request
      this.verifiedCode = code;

      this.goToStep(3);
    } else {
      this.setButtonLoading(this.verifyBtn, false, 'Verify Code');
      this.handleApiError(result);
    }
  }

  /**
   * Step 3: Handle reset password submission
   * @param {Event} event
   */
  async handleResetPassword(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const code = this.verifiedCode;

    if (!code) {
      this.showToast('Verification code is missing. Please start over.', 'error');
      this.goToStep(1);
      return;
    }

    // Use FormValidator for password validation
    if (this.passwordValidator && !this.passwordValidator.validateAll()) {
      return;
    }

    const newPassword = this.resetForm.querySelector('#new_password')?.value || '';
    const confirmPassword = this.resetForm.querySelector('#confirm_password')?.value || '';

    this.setButtonLoading(this.resetBtn, true, 'Resetting...');
    this.isSubmitting = true;

    const result = await this.apiRequest('/api/v1/account/reset-password', 'POST', {
      code,
      password: newPassword,
      confirm_password: confirmPassword
    });

    this.isSubmitting = false;

    if (result.ok) {
      this.showToast('Password reset successful! Redirecting to sign in...', 'success');
      this.setButtonLoading(this.resetBtn, false, 'Redirecting...');

      setTimeout(() => {
        window.location.href = '/sign_in';
      }, 2000);
    } else {
      this.setButtonLoading(this.resetBtn, false, 'Reset Password');
      this.handleApiError(result);
    }
  }

  /**
   * Navigate to a specific step
   * @param {number} step
   */
  goToStep(step) {
    this.currentStep = step;

    // Hide all cards
    this.requestCard?.classList.add('hidden');
    this.verifyCard?.classList.add('hidden');
    this.resetCard?.classList.add('hidden');

    // Show target card
    const targetCard = this.getCardForStep(step);
    if (targetCard) {
      targetCard.classList.remove('hidden');

      // Focus first input in the new step
      const firstInput = targetCard.querySelector('input:not([type="hidden"])');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }

    // Reset button states
    this.setButtonLoading(this.requestBtn, false, 'Send Reset Code');
    this.setButtonLoading(this.verifyBtn, false, 'Verify Code');
    this.setButtonLoading(this.resetBtn, false, 'Reset Password');
  }

  /**
   * Get card element for step number
   * @param {number} step
   * @returns {HTMLElement|null}
   */
  getCardForStep(step) {
    switch (step) {
      case 1: return this.requestCard;
      case 2: return this.verifyCard;
      case 3: return this.resetCard;
      default: return null;
    }
  }

  /**
   * Format code input to only allow alphanumeric characters
   * @param {Event} event
   */
  formatCodeInput(event) {
    const input = event.target;
    input.value = input.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  }

  /**
   * Set button loading state
   * @param {HTMLButtonElement|null} button
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

export default ForgotPassword;
