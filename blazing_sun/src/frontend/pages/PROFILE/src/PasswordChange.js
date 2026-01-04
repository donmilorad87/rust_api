import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';
import { FormValidator, PasswordToggle } from '../../GLOBAL/src/js/FormValidator.js';

/**
 * PasswordChange - Handles password change functionality
 * Features:
 * - Rich reactive form validation
 * - Password visibility toggle
 * - Current password verification
 * - New password validation
 * - Confirm password matching
 */
export class PasswordChange {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
   * @param {HTMLFormElement} config.form - Password change form
   * @param {HTMLInputElement} config.currentPasswordInput - Current password input
   * @param {HTMLInputElement} config.newPasswordInput - New password input
   * @param {HTMLInputElement} config.confirmPasswordInput - Confirm password input
   * @param {HTMLButtonElement} config.submitBtn - Submit button
   * @param {Function} config.showToast - Toast notification function
   * @param {Function} config.getAuthToken - Function to get JWT token
   */
  constructor(config) {
    this.baseUrl = config.baseUrl || '';
    this.form = config.form;
    this.currentPasswordInput = config.currentPasswordInput;
    this.newPasswordInput = config.newPasswordInput;
    this.confirmPasswordInput = config.confirmPasswordInput;
    this.submitBtn = config.submitBtn;
    this.showToast = config.showToast || this.defaultToast.bind(this);
    this.getAuthToken = config.getAuthToken || (() => null);

    this.isSubmitting = false;
    this.validator = null;
    this.currentPasswordToggle = null;
    this.newPasswordToggle = null;
    this.confirmPasswordToggle = null;

    this.init();
  }

  /**
   * Initialize event listeners
   */
  init() {
    if (!this.form) {
      console.error('PasswordChange: Form element not found');
      return;
    }

    // Initialize form validator
    this.initValidator();

    // Initialize password toggles
    this.initPasswordToggles();

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  /**
   * Initialize form validator with rich reactive validation
   */
  initValidator() {
    const currentPasswordFeedback = document.getElementById('currentPasswordFeedback');
    const newPasswordFeedback = document.getElementById('newPasswordFeedback');
    const confirmPasswordFeedback = document.getElementById('confirmPasswordFeedback');

    this.validator = new FormValidator({ validateOnInput: true });

    if (this.currentPasswordInput && currentPasswordFeedback) {
      this.validator.bindInput(this.currentPasswordInput, 'current_password', currentPasswordFeedback);
    }

    if (this.newPasswordInput && newPasswordFeedback) {
      this.validator.bindInput(this.newPasswordInput, 'new_password', newPasswordFeedback);
    }

    if (this.confirmPasswordInput && this.newPasswordInput && confirmPasswordFeedback) {
      this.validator.bindPasswordConfirm(this.confirmPasswordInput, this.newPasswordInput, confirmPasswordFeedback);
    }
  }

  /**
   * Initialize password visibility toggles
   */
  initPasswordToggles() {
    const currentPasswordToggleBtn = document.getElementById('currentPasswordToggle');
    const newPasswordToggleBtn = document.getElementById('newPasswordToggle');
    const confirmPasswordToggleBtn = document.getElementById('confirmPasswordToggle');

    if (this.currentPasswordInput && currentPasswordToggleBtn) {
      this.currentPasswordToggle = new PasswordToggle(this.currentPasswordInput, currentPasswordToggleBtn);
    }

    if (this.newPasswordInput && newPasswordToggleBtn) {
      this.newPasswordToggle = new PasswordToggle(this.newPasswordInput, newPasswordToggleBtn);
    }

    if (this.confirmPasswordInput && confirmPasswordToggleBtn) {
      this.confirmPasswordToggle = new PasswordToggle(this.confirmPasswordInput, confirmPasswordToggleBtn);
    }
  }

  /**
   * Handle form submission
   * @param {Event} event
   */
  async handleSubmit(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    // Use FormValidator for validation
    if (this.validator && !this.validator.validateAll()) {
      return;
    }

    const currentPassword = this.currentPasswordInput?.value || '';
    const newPassword = this.newPasswordInput?.value || '';
    const confirmPassword = this.confirmPasswordInput?.value || '';

    // Additional check: new password must be different from current
    if (currentPassword === newPassword) {
      this.showToast('New password must be different from current password', 'error');
      return;
    }

    // NOTE: We don't check for a readable auth token here because the auth cookie
    // is HttpOnly for security. The server already validated authentication before
    // rendering this page, and the HttpOnly cookie will be sent automatically with
    // this request. If the user is not authenticated, the server will reject the request.

    this.isSubmitting = true;
    this.setButtonLoading(true);

    try {
      // Build headers - include Authorization only if we have a readable token
      // Otherwise, rely on HttpOnly cookie being sent automatically
      const headers = getCsrfHeaders();

      const token = this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}/api/v1/password/change-password`, {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin', // Ensure HttpOnly auth cookie is sent
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      const result = await response.json();

      if (response.ok) {
        this.showToast('Password changed successfully! Redirecting to sign in...', 'success');
        this.form.reset();

        // Backend clears the HttpOnly auth cookie in the response
        // Redirect to sign-in page for re-authentication
        setTimeout(() => {
          window.location.href = '/sign-in';
        }, 1500);
      } else {
        this.handleApiError(result);
      }
    } catch (error) {
      console.error('Password change failed:', error);
      this.showToast('Network error. Please try again.', 'error');
    } finally {
      this.isSubmitting = false;
      this.setButtonLoading(false);
    }
  }

  /**
   * Set button loading state
   * @param {boolean} isLoading
   */
  setButtonLoading(isLoading) {
    if (!this.submitBtn) return;

    this.submitBtn.disabled = isLoading;
    this.submitBtn.textContent = isLoading ? 'Changing...' : 'Change Password';

    if (isLoading) {
      this.submitBtn.classList.add('btn--loading');
    } else {
      this.submitBtn.classList.remove('btn--loading');
    }
  }

  /**
   * Handle API error response
   * @param {Object} result
   */
  handleApiError(result) {
    const message = result.message || 'An error occurred. Please try again.';
    this.showToast(message, 'error');

    if (result.errors) {
      for (const [field, errors] of Object.entries(result.errors)) {
        if (Array.isArray(errors)) {
          errors.forEach(err => this.showToast(`${field}: ${err}`, 'error'));
        }
      }
    }
  }

  /**
   * Default toast implementation
   * @param {string} message
   * @param {string} type
   */
  defaultToast(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  }
}

export default PasswordChange;
