/**
 * SignUp Page Controller
 * Handles user registration and account activation flow.
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

    this.signupForm.addEventListener('submit', (e) => this.handleSignup(e));
    this.activationForm.addEventListener('submit', (e) => this.handleActivation(e));

    this.setupInputValidation();
  }

  /**
   * Setup real-time input validation
   */
  setupInputValidation() {
    const passwordInput = this.signupForm.querySelector('#password');
    const confirmInput = this.signupForm.querySelector('#confirm_password');

    if (passwordInput && confirmInput) {
      confirmInput.addEventListener('input', () => {
        this.validatePasswordMatch(passwordInput, confirmInput);
      });

      passwordInput.addEventListener('input', () => {
        if (confirmInput.value) {
          this.validatePasswordMatch(passwordInput, confirmInput);
        }
      });
    }
  }

  /**
   * Validate password confirmation matches
   * @param {HTMLInputElement} passwordInput
   * @param {HTMLInputElement} confirmInput
   */
  validatePasswordMatch(passwordInput, confirmInput) {
    if (confirmInput.value && passwordInput.value !== confirmInput.value) {
      confirmInput.classList.add('form-group__input--error');
    } else {
      confirmInput.classList.remove('form-group__input--error');
    }
  }

  /**
   * Handle sign-up form submission
   * @param {Event} event
   */
  async handleSignup(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const submitBtn = this.signupForm.querySelector('button[type="submit"]');
    const formData = this.getSignupFormData();

    if (!this.validateSignupData(formData)) {
      return;
    }

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
   * Validate sign-up form data
   * @param {Object} data
   * @returns {boolean}
   */
  validateSignupData(data) {
    if (!data.first_name) {
      this.showToast('First name is required', 'error');
      return false;
    }

    if (!data.last_name) {
      this.showToast('Last name is required', 'error');
      return false;
    }

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

    if (data.password.length < 8) {
      this.showToast('Password must be at least 8 characters', 'error');
      return false;
    }

    if (data.password !== data.confirm_password) {
      this.showToast('Passwords do not match', 'error');
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

export default SignUp;
