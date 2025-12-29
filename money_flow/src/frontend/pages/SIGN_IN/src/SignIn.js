/**
 * SignIn Page Controller
 * Handles user authentication and redirects to homepage on success.
 *
 * Flow:
 * 1. User fills sign-in form (email, password)
 * 2. Submit POST to /api/v1/auth/sign-in
 * 3. On success, store JWT token in cookie
 * 4. Redirect to homepage
 */
export class SignIn {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
   * @param {HTMLFormElement} config.signinForm - Sign-in form element
   * @param {HTMLButtonElement} config.signinBtn - Submit button element
   * @param {Function} config.showToast - Toast notification function
   */
  constructor(config) {
    this.baseUrl = config.baseUrl || '';
    this.signinForm = config.signinForm;
    this.signinBtn = config.signinBtn;
    this.showToast = config.showToast || this.defaultToast.bind(this);

    this.isSubmitting = false;

    this.init();
  }

  /**
   * Initialize event listeners
   */
  init() {
    if (!this.signinForm) {
      console.error('SignIn: Required form element not found');
      return;
    }

    this.signinForm.addEventListener('submit', (e) => this.handleSignin(e));
  }

  /**
   * Handle sign-in form submission
   * @param {Event} event
   */
  async handleSignin(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const formData = this.getFormData();

    if (!this.validateFormData(formData)) {
      return;
    }

    this.setButtonLoading(true, 'Signing in...');
    this.isSubmitting = true;

    const result = await this.apiRequest('/api/v1/auth/sign-in', 'POST', formData);

    this.isSubmitting = false;

    if (result.ok) {
      this.showToast('Sign in successful!', 'success');

      // Store token in cookie for server-side auth
      if (result.data.token) {
        this.setAuthCookie(result.data.token);
      }

      // Redirect to homepage after brief delay
      this.setButtonLoading(false, 'Redirecting...');
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } else {
      this.setButtonLoading(false, 'Sign In');
      this.handleApiError(result);
    }
  }

  /**
   * Get form data from sign-in form
   * @returns {Object}
   */
  getFormData() {
    return {
      email: this.signinForm.querySelector('#email')?.value.trim() || '',
      password: this.signinForm.querySelector('#password')?.value || ''
    };
  }

  /**
   * Validate form data
   * @param {Object} data
   * @returns {boolean}
   */
  validateFormData(data) {
    if (!data.email) {
      this.showToast('Email is required', 'error');
      return false;
    }

    if (!this.isValidEmail(data.email)) {
      this.showToast('Please enter a valid email address', 'error');
      return false;
    }

    if (!data.password) {
      this.showToast('Password is required', 'error');
      return false;
    }

    return true;
  }

  /**
   * Validate email format
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Set auth cookie with JWT token
   * @param {string} token
   */
  setAuthCookie(token) {
    // Cookie expires in 7 days
    const maxAge = 60 * 60 * 24 * 7;
    document.cookie = `auth_token=${token}; path=/; max-age=${maxAge}; SameSite=Strict`;
  }

  /**
   * Set button loading state
   * @param {boolean} isLoading
   * @param {string} text
   */
  setButtonLoading(isLoading, text) {
    if (!this.signinBtn) return;

    this.signinBtn.disabled = isLoading;
    this.signinBtn.textContent = text;

    if (isLoading) {
      this.signinBtn.classList.add('btn--loading');
    } else {
      this.signinBtn.classList.remove('btn--loading');
    }
  }

  /**
   * Handle API error response
   * @param {Object} result
   */
  handleApiError(result) {
    const message = result.data?.message || 'Sign in failed. Please check your credentials.';
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
      headers: {
        'Content-Type': 'application/json'
      }
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

export default SignIn;
