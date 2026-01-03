/**
 * PasswordChange - Handles password change functionality
 * Features:
 * - Current password verification
 * - New password with strength indicator
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
   * @param {HTMLElement} config.strengthBar - Password strength bar element
   * @param {HTMLElement} config.strengthText - Password strength text element
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
    this.strengthBar = config.strengthBar;
    this.strengthText = config.strengthText;
    this.submitBtn = config.submitBtn;
    this.showToast = config.showToast || this.defaultToast.bind(this);
    this.getAuthToken = config.getAuthToken || (() => null);

    this.isSubmitting = false;

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

    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Password strength indicator
    if (this.newPasswordInput) {
      this.newPasswordInput.addEventListener('input', (e) => {
        this.updatePasswordStrength(e.target.value);
      });
    }
  }

  /**
   * Handle form submission
   * @param {Event} event
   */
  async handleSubmit(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const currentPassword = this.currentPasswordInput?.value || '';
    const newPassword = this.newPasswordInput?.value || '';
    const confirmPassword = this.confirmPasswordInput?.value || '';

    // Validation
    if (!this.validatePasswords(currentPassword, newPassword, confirmPassword)) {
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
      const headers = {
        'Content-Type': 'application/json'
      };

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
        this.updatePasswordStrength('');

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
   * Validate password inputs
   * @param {string} currentPassword
   * @param {string} newPassword
   * @param {string} confirmPassword
   * @returns {boolean}
   */
  validatePasswords(currentPassword, newPassword, confirmPassword) {
    if (!currentPassword) {
      this.showToast('Current password is required', 'error');
      return false;
    }

    if (!newPassword) {
      this.showToast('New password is required', 'error');
      return false;
    }

    if (newPassword.length < 8) {
      this.showToast('Password must be at least 8 characters', 'error');
      return false;
    }

    if (!/[A-Z]/.test(newPassword)) {
      this.showToast('Password must contain at least one uppercase letter', 'error');
      return false;
    }

    if (!/[a-z]/.test(newPassword)) {
      this.showToast('Password must contain at least one lowercase letter', 'error');
      return false;
    }

    if (!/[0-9]/.test(newPassword)) {
      this.showToast('Password must contain at least one digit', 'error');
      return false;
    }

    if (!/[^\p{L}\p{N}]/u.test(newPassword)) {
      this.showToast('Password must contain at least one special character', 'error');
      return false;
    }

    if (newPassword !== confirmPassword) {
      this.showToast('Passwords do not match', 'error');
      return false;
    }

    if (currentPassword === newPassword) {
      this.showToast('New password must be different from current password', 'error');
      return false;
    }

    return true;
  }

  /**
   * Update password strength indicator
   * @param {string} password
   */
  updatePasswordStrength(password) {
    if (!this.strengthBar || !this.strengthText) return;

    const strength = this.calculatePasswordStrength(password);

    // Remove all strength classes
    this.strengthBar.classList.remove(
      'password-strength__bar--weak',
      'password-strength__bar--fair',
      'password-strength__bar--good',
      'password-strength__bar--strong'
    );

    if (password.length === 0) {
      this.strengthBar.style.width = '0';
      this.strengthText.textContent = '';
      return;
    }

    if (strength < 2) {
      this.strengthBar.classList.add('password-strength__bar--weak');
      this.strengthText.textContent = 'Weak';
    } else if (strength < 3) {
      this.strengthBar.classList.add('password-strength__bar--fair');
      this.strengthText.textContent = 'Fair';
    } else if (strength < 4) {
      this.strengthBar.classList.add('password-strength__bar--good');
      this.strengthText.textContent = 'Good';
    } else {
      this.strengthBar.classList.add('password-strength__bar--strong');
      this.strengthText.textContent = 'Strong';
    }
  }

  /**
   * Calculate password strength score (0-5)
   * @param {string} password
   * @returns {number}
   */
  calculatePasswordStrength(password) {
    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    return Math.min(score, 5);
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
