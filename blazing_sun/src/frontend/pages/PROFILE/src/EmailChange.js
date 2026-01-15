import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';
import { FormValidator } from '../../GLOBAL/src/js/FormValidator.js';

/**
 * EmailChange - Handles email change functionality with 4-step verification flow
 * Steps:
 * 1. Enter new email address
 * 2. Verify code sent to OLD email
 * 3. Verify code sent to NEW email
 * 4. Email changed successfully (auto-redirect to sign-in)
 */
export class EmailChange {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
   * @param {HTMLElement} config.step1Card - Step 1 card element
   * @param {HTMLElement} config.step2Card - Step 2 card element
   * @param {HTMLElement} config.step3Card - Step 3 card element
   * @param {HTMLElement} config.step4Card - Step 4 card element (success)
   * @param {HTMLFormElement} config.newEmailForm - New email form
   * @param {HTMLFormElement} config.verifyOldEmailForm - Old email verification form
   * @param {HTMLFormElement} config.verifyNewEmailForm - New email verification form
   * @param {HTMLInputElement} config.newEmailInput - New email input
   * @param {HTMLInputElement} config.oldEmailCodeInput - Old email code input
   * @param {HTMLInputElement} config.newEmailCodeInput - New email code input
   * @param {HTMLButtonElement} config.sendEmailCodeBtn - Send code button
   * @param {HTMLButtonElement} config.verifyOldEmailBtn - Verify old email button
   * @param {HTMLButtonElement} config.verifyNewEmailBtn - Verify new email button
   * @param {HTMLElement} config.stepIndicators - Step indicator elements
   * @param {HTMLElement} config.currentEmailDisplay - Display element for current email
   * @param {HTMLElement} config.newEmailDisplay - Display element for new email
   * @param {Function} config.showToast - Toast notification function
   * @param {Function} config.getAuthToken - Function to get JWT token
   * @param {string} config.currentEmail - Current user email
   */
  constructor(config) {
    this.baseUrl = config.baseUrl || '';
    this.step1Card = config.step1Card;
    this.step2Card = config.step2Card;
    this.step3Card = config.step3Card;
    this.step4Card = config.step4Card;
    this.newEmailForm = config.newEmailForm;
    this.verifyOldEmailForm = config.verifyOldEmailForm;
    this.verifyNewEmailForm = config.verifyNewEmailForm;
    this.newEmailInput = config.newEmailInput;
    this.oldEmailCodeInput = config.oldEmailCodeInput;
    this.newEmailCodeInput = config.newEmailCodeInput;
    this.sendEmailCodeBtn = config.sendEmailCodeBtn;
    this.verifyOldEmailBtn = config.verifyOldEmailBtn;
    this.verifyNewEmailBtn = config.verifyNewEmailBtn;
    this.stepIndicators = config.stepIndicators || [];
    this.currentEmailDisplay = config.currentEmailDisplay;
    this.newEmailDisplay = config.newEmailDisplay;
    this.showToast = config.showToast || this.defaultToast.bind(this);
    this.getAuthToken = config.getAuthToken || (() => null);
    this.currentEmail = config.currentEmail || '';

    this.currentStep = 1;
    this.isSubmitting = false;
    this.newEmail = '';
    this.validator = null;

    this.init();
  }

  /**
   * Initialize event listeners
   */
  init() {
    // Initialize form validator
    this.initValidator();

    // Step 1: New email form
    if (this.newEmailForm) {
      this.newEmailForm.addEventListener('submit', (e) => this.handleNewEmailSubmit(e));
    }

    // Step 2: Verify old email form
    if (this.verifyOldEmailForm) {
      this.verifyOldEmailForm.addEventListener('submit', (e) => this.handleVerifyOldEmailSubmit(e));
    }

    // Step 3: Verify new email form
    if (this.verifyNewEmailForm) {
      this.verifyNewEmailForm.addEventListener('submit', (e) => this.handleVerifyNewEmailSubmit(e));
    }

    // Format code inputs
    if (this.oldEmailCodeInput) {
      this.oldEmailCodeInput.addEventListener('input', (e) => this.formatCodeInput(e));
    }
    if (this.newEmailCodeInput) {
      this.newEmailCodeInput.addEventListener('input', (e) => this.formatCodeInput(e));
    }

    // Cancel buttons
    document.querySelectorAll('[data-action="cancel"]').forEach(btn => {
      btn.addEventListener('click', () => this.goToStep(1));
    });
  }

  /**
   * Initialize form validator with rich reactive validation
   */
  initValidator() {
    const newEmailFeedback = document.getElementById('newEmailFeedback');

    this.validator = new FormValidator({ validateOnInput: true });

    if (this.newEmailInput && newEmailFeedback) {
      this.validator.bindInput(this.newEmailInput, 'email', newEmailFeedback);
    }
  }

  /**
   * Step 1: Handle new email submission
   * @param {Event} event
   */
  async handleNewEmailSubmit(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    // Use FormValidator for validation
    if (this.validator && !this.validator.validateAll()) {
      return;
    }

    const email = this.newEmailInput?.value.trim() || '';

    // Check if new email is same as current email
    if (email.toLowerCase() === this.currentEmail.toLowerCase()) {
      this.showToast('New email cannot be the same as your current email', 'error');
      return;
    }

    // NOTE: HttpOnly cookie authentication - token sent automatically
    this.isSubmitting = true;
    this.setButtonLoading(this.sendEmailCodeBtn, true, 'Sending...');

    const headers = getCsrfHeaders();

    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // Request email change - sends code to OLD email
      const response = await fetch(`${this.baseUrl}/api/v1/email/request-change`, {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin',
        body: JSON.stringify({ new_email: email })
      });

      const result = await response.json();

      if (response.ok) {
        this.newEmail = email;
        this.showToast('Verification code sent to your current email!', 'success');

        // Update display elements
        if (this.currentEmailDisplay) {
          this.currentEmailDisplay.textContent = this.currentEmail;
        }

        this.goToStep(2);
      } else {
        this.showToast(result.message || 'Failed to send verification code', 'error');
        this.setButtonLoading(this.sendEmailCodeBtn, false, 'Request Email Change');
      }
    } catch (error) {
      console.error('Email change request failed:', error);
      this.showToast('Network error. Please try again.', 'error');
      this.setButtonLoading(this.sendEmailCodeBtn, false, 'Request Email Change');
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Step 2: Handle old email verification
   * @param {Event} event
   */
  async handleVerifyOldEmailSubmit(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const code = this.oldEmailCodeInput?.value.trim() || '';

    if (!code || code.length < 32) {
      this.showToast('Please enter the verification code from your current email', 'error');
      return;
    }

    this.isSubmitting = true;
    this.setButtonLoading(this.verifyOldEmailBtn, true, 'Verifying...');

    const headers = getCsrfHeaders();

    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/email/verify-old-email`, {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin',
        body: JSON.stringify({ code: code })
      });

      const result = await response.json();

      if (response.ok) {
        this.showToast('Old email verified! Check your new email for the next code.', 'success');

        // Update display element
        if (this.newEmailDisplay) {
          this.newEmailDisplay.textContent = this.newEmail;
        }

        this.goToStep(3);
      } else {
        this.showToast(result.message || 'Invalid or expired verification code', 'error');
        this.setButtonLoading(this.verifyOldEmailBtn, false, 'Verify Old Email');
      }
    } catch (error) {
      console.error('Old email verification failed:', error);
      this.showToast('Network error. Please try again.', 'error');
      this.setButtonLoading(this.verifyOldEmailBtn, false, 'Verify Old Email');
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Step 3: Handle new email verification
   * @param {Event} event
   */
  async handleVerifyNewEmailSubmit(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const code = this.newEmailCodeInput?.value.trim() || '';

    if (!code || code.length < 32) {
      this.showToast('Please enter the verification code from your new email', 'error');
      return;
    }

    this.isSubmitting = true;
    this.setButtonLoading(this.verifyNewEmailBtn, true, 'Completing...');

    const headers = getCsrfHeaders();

    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/email/verify-new-email`, {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin',
        body: JSON.stringify({ code: code })
      });

      const result = await response.json();

      if (response.ok) {
        this.showToast('Email changed successfully!', 'success');
        this.goToStep(4);
        this.startRedirectCountdown();
      } else {
        this.showToast(result.message || 'Invalid or expired verification code', 'error');
        this.setButtonLoading(this.verifyNewEmailBtn, false, 'Complete Email Change');
      }
    } catch (error) {
      console.error('New email verification failed:', error);
      this.showToast('Network error. Please try again.', 'error');
      this.setButtonLoading(this.verifyNewEmailBtn, false, 'Complete Email Change');
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Start countdown and redirect to sign-in page
   */
  startRedirectCountdown() {
    let countdown = 5;
    const countdownElement = document.getElementById('redirectCountdown');

    const interval = setInterval(() => {
      countdown--;
      if (countdownElement) {
        countdownElement.textContent = countdown;
      }

      if (countdown <= 0) {
        clearInterval(interval);
        window.location.href = '/sign_in';
      }
    }, 1000);
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
    this.step4Card?.classList.add('hidden');

    // Show target card
    const targetCard = this.getCardForStep(step);
    if (targetCard) {
      targetCard.classList.remove('hidden');

      // Focus first input (except for success step)
      if (step < 4) {
        const firstInput = targetCard.querySelector('input:not([type="hidden"])');
        if (firstInput) {
          setTimeout(() => firstInput.focus(), 100);
        }
      }
    }

    // Update step indicators
    this.updateStepIndicators(step);

    // Reset button states
    this.setButtonLoading(this.sendEmailCodeBtn, false, 'Request Email Change');
    this.setButtonLoading(this.verifyOldEmailBtn, false, 'Verify Old Email');
    this.setButtonLoading(this.verifyNewEmailBtn, false, 'Complete Email Change');

    // Reset forms when going back to step 1
    if (step === 1) {
      this.newEmailForm?.reset();
      this.verifyOldEmailForm?.reset();
      this.verifyNewEmailForm?.reset();
      this.newEmail = '';
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
      case 4: return this.step4Card;
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
   * Format code input to only allow alphanumeric
   * @param {Event} event
   */
  formatCodeInput(event) {
    const input = event.target;
    input.value = input.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
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
