/**
 * EmailChange - Handles email change functionality with 3-step flow
 * Steps:
 * 1. Enter new email (check if available)
 * 2. Verify code sent to new email
 * 3. Email changed successfully
 */
export class EmailChange {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
   * @param {HTMLElement} config.step1Card - Step 1 card element
   * @param {HTMLElement} config.step2Card - Step 2 card element
   * @param {HTMLElement} config.step3Card - Step 3 card element (success)
   * @param {HTMLFormElement} config.emailForm - New email form
   * @param {HTMLFormElement} config.verifyForm - Verification form
   * @param {HTMLInputElement} config.newEmailInput - New email input
   * @param {HTMLInputElement} config.codeInput - Verification code input
   * @param {HTMLButtonElement} config.emailBtn - Send code button
   * @param {HTMLButtonElement} config.verifyBtn - Verify code button
   * @param {HTMLElement} config.stepIndicators - Step indicator elements
   * @param {Function} config.showToast - Toast notification function
   * @param {Function} config.getAuthToken - Function to get JWT token
   * @param {Function} config.onEmailChanged - Callback when email is changed
   */
  constructor(config) {
    this.baseUrl = config.baseUrl || '';
    this.step1Card = config.step1Card;
    this.step2Card = config.step2Card;
    this.step3Card = config.step3Card;
    this.emailForm = config.emailForm;
    this.verifyForm = config.verifyForm;
    this.newEmailInput = config.newEmailInput;
    this.codeInput = config.codeInput;
    this.emailBtn = config.emailBtn;
    this.verifyBtn = config.verifyBtn;
    this.stepIndicators = config.stepIndicators || [];
    this.showToast = config.showToast || this.defaultToast.bind(this);
    this.getAuthToken = config.getAuthToken || (() => null);
    this.onEmailChanged = config.onEmailChanged || (() => {});

    this.currentStep = 1;
    this.isSubmitting = false;
    this.newEmail = '';
    this.verificationCode = '';

    this.init();
  }

  /**
   * Initialize event listeners
   */
  init() {
    if (this.emailForm) {
      this.emailForm.addEventListener('submit', (e) => this.handleEmailSubmit(e));
    }

    if (this.verifyForm) {
      this.verifyForm.addEventListener('submit', (e) => this.handleVerifySubmit(e));
    }

    // Format code input
    if (this.codeInput) {
      this.codeInput.addEventListener('input', (e) => this.formatCodeInput(e));
    }

    // Start over button in step 3
    const startOverBtn = this.step3Card?.querySelector('[data-action="start-over"]');
    if (startOverBtn) {
      startOverBtn.addEventListener('click', () => this.goToStep(1));
    }
  }

  /**
   * Step 1: Handle new email submission
   * @param {Event} event
   */
  async handleEmailSubmit(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const email = this.newEmailInput?.value.trim() || '';

    if (!this.validateEmail(email)) {
      return;
    }

    const token = this.getAuthToken();
    if (!token) {
      this.showToast('Please sign in to change email', 'error');
      return;
    }

    this.isSubmitting = true;
    this.setButtonLoading(this.emailBtn, true, 'Checking...');

    try {
      // First, check if email is available
      const checkResponse = await fetch(`${this.baseUrl}/api/v1/email/check-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });

      const checkResult = await checkResponse.json();

      if (!checkResponse.ok) {
        if (checkResult.message?.toLowerCase().includes('already')) {
          this.showToast('This email is already in use', 'error');
        } else {
          this.showToast(checkResult.message || 'Could not verify email availability', 'error');
        }
        this.setButtonLoading(this.emailBtn, false, 'Send Verification Code');
        this.isSubmitting = false;
        return;
      }

      // Send verification code to new email
      const sendResponse = await fetch(`${this.baseUrl}/api/v1/email/request-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ new_email: email })
      });

      const sendResult = await sendResponse.json();

      if (sendResponse.ok) {
        this.newEmail = email;
        this.showToast('Verification code sent to your new email!', 'success');
        this.goToStep(2);
      } else {
        this.showToast(sendResult.message || 'Failed to send verification code', 'error');
        this.setButtonLoading(this.emailBtn, false, 'Send Verification Code');
      }
    } catch (error) {
      console.error('Email check failed:', error);
      this.showToast('Network error. Please try again.', 'error');
      this.setButtonLoading(this.emailBtn, false, 'Send Verification Code');
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Step 2: Handle verification code submission
   * @param {Event} event
   */
  async handleVerifySubmit(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const code = this.codeInput?.value.trim() || '';

    if (!code || code.length < 20) {
      this.showToast('Please enter the 20 character verification code', 'error');
      return;
    }

    const token = this.getAuthToken();
    if (!token) {
      this.showToast('Please sign in to change email', 'error');
      return;
    }

    this.isSubmitting = true;
    this.setButtonLoading(this.verifyBtn, true, 'Verifying...');

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/email/verify-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: code,
          new_email: this.newEmail
        })
      });

      const result = await response.json();

      if (response.ok) {
        this.showToast('Email changed successfully!', 'success');
        this.goToStep(3);
        this.onEmailChanged(this.newEmail);
      } else {
        this.showToast(result.message || 'Invalid verification code', 'error');
        this.setButtonLoading(this.verifyBtn, false, 'Verify & Change Email');
      }
    } catch (error) {
      console.error('Email verification failed:', error);
      this.showToast('Network error. Please try again.', 'error');
      this.setButtonLoading(this.verifyBtn, false, 'Verify & Change Email');
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Navigate to a specific step
   * @param {number} step
   */
  goToStep(step) {
    this.currentStep = step;

    // Hide all cards
    this.step1Card?.classList.add('hidden');
    this.step2Card?.classList.add('hidden');
    this.step3Card?.classList.add('hidden');

    // Show target card
    const targetCard = this.getCardForStep(step);
    if (targetCard) {
      targetCard.classList.remove('hidden');

      // Focus first input
      const firstInput = targetCard.querySelector('input:not([type="hidden"])');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }

    // Update step indicators
    this.updateStepIndicators(step);

    // Reset button states
    this.setButtonLoading(this.emailBtn, false, 'Send Verification Code');
    this.setButtonLoading(this.verifyBtn, false, 'Verify & Change Email');

    // Reset forms when going back to step 1
    if (step === 1) {
      this.emailForm?.reset();
      this.verifyForm?.reset();
      this.newEmail = '';
      this.verificationCode = '';
    }
  }

  /**
   * Get card element for step number
   * @param {number} step
   * @returns {HTMLElement|null}
   */
  getCardForStep(step) {
    switch (step) {
      case 1: return this.step1Card;
      case 2: return this.step2Card;
      case 3: return this.step3Card;
      default: return null;
    }
  }

  /**
   * Update step indicator visuals
   * @param {number} currentStep
   */
  updateStepIndicators(currentStep) {
    this.stepIndicators.forEach((indicator, index) => {
      const stepNum = index + 1;
      indicator.classList.remove('email-step--active', 'email-step--completed');

      if (stepNum < currentStep) {
        indicator.classList.add('email-step--completed');
      } else if (stepNum === currentStep) {
        indicator.classList.add('email-step--active');
      }
    });
  }

  /**
   * Validate email format
   * @param {string} email
   * @returns {boolean}
   */
  validateEmail(email) {
    if (!email) {
      this.showToast('Email is required', 'error');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.showToast('Please enter a valid email address', 'error');
      return false;
    }

    return true;
  }

  /**
   * Format code input to only allow alphanumeric
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
   * Default toast implementation
   * @param {string} message
   * @param {string} type
   */
  defaultToast(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
  }
}

export default EmailChange;
