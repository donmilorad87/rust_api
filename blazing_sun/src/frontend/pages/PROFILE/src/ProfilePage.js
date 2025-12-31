/**
 * ProfilePage - Main controller for the profile page
 * Manages profile details editing (first name, last name)
 * Coordinates with AvatarUpload, PasswordChange, and EmailChange components
 */
export class ProfilePage {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
   * @param {Object} config.userData - SSR user data (from window.USER_DATA)
   * @param {HTMLFormElement} config.profileForm - Profile details form
   * @param {HTMLInputElement} config.firstNameInput - First name input
   * @param {HTMLInputElement} config.lastNameInput - Last name input
   * @param {HTMLElement} config.displayName - Display name element
   * @param {HTMLElement} config.displayEmail - Display email element
   * @param {HTMLButtonElement} config.saveBtn - Save button
   * @param {Function} config.showToast - Toast notification function
   */
  constructor(config) {
    this.baseUrl = config.baseUrl || '';
    this.profileForm = config.profileForm;
    this.firstNameInput = config.firstNameInput;
    this.lastNameInput = config.lastNameInput;
    this.displayName = config.displayName;
    this.displayEmail = config.displayEmail;
    this.saveBtn = config.saveBtn;
    this.showToast = config.showToast || this.defaultToast.bind(this);

    this.isSubmitting = false;
    this.userData = config.userData || null;
    // Store original values for change detection (SSR values from inputs)
    this.originalFirstName = this.firstNameInput?.value || '';
    this.originalLastName = this.lastNameInput?.value || '';
    this.authToken = null;

    this.init();
  }

  /**
   * Initialize the profile page
   */
  init() {
    // Get auth token from cookie
    this.authToken = this.getTokenFromCookie();

    if (!this.authToken) {
      this.showToast('Please sign in to view your profile', 'error');
      setTimeout(() => {
        window.location.href = '/sign-in';
      }, 1500);
      return;
    }

    // User data comes from SSR (window.USER_DATA), no API call needed
    // Inputs are pre-filled via Tera template

    // Form submission
    if (this.profileForm) {
      this.profileForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    // Track changes for save button state
    if (this.firstNameInput) {
      this.firstNameInput.addEventListener('input', () => this.checkForChanges());
    }
    if (this.lastNameInput) {
      this.lastNameInput.addEventListener('input', () => this.checkForChanges());
    }

    // Disable save button initially (no changes yet)
    if (this.saveBtn) {
      this.saveBtn.disabled = true;
    }
  }

  /**
   * Get JWT token from cookie
   * @returns {string|null}
   */
  getTokenFromCookie() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token') {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  /**
   * Get auth token (for child components)
   * @returns {string|null}
   */
  getAuthToken() {
    return this.authToken;
  }

  /**
   * Check if form has unsaved changes
   * Compares current input values against original SSR values
   */
  checkForChanges() {
    if (!this.saveBtn) return;

    const currentFirstName = this.firstNameInput?.value || '';
    const currentLastName = this.lastNameInput?.value || '';

    const hasChanges =
      currentFirstName !== this.originalFirstName ||
      currentLastName !== this.originalLastName;

    this.saveBtn.disabled = !hasChanges;
  }

  /**
   * Handle profile form submission
   * @param {Event} event
   */
  async handleSubmit(event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const firstName = this.firstNameInput?.value.trim() || '';
    const lastName = this.lastNameInput?.value.trim() || '';

    // Validation
    if (!firstName) {
      this.showToast('First name is required', 'error');
      return;
    }
    if (!lastName) {
      this.showToast('Last name is required', 'error');
      return;
    }

    this.isSubmitting = true;
    this.setButtonLoading(true);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/user`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName
        })
      });

      const result = await response.json();

      if (response.ok) {
        // Update original values to new saved values (for change detection)
        this.originalFirstName = firstName;
        this.originalLastName = lastName;

        // Update local userData if present
        if (this.userData) {
          this.userData.first_name = firstName;
          this.userData.last_name = lastName;
        }

        // Update display
        if (this.displayName) {
          this.displayName.textContent = `${firstName} ${lastName}`;
        }

        this.showToast('Profile updated successfully!', 'success');
        this.saveBtn.disabled = true;
      } else {
        this.handleApiError(result);
      }
    } catch (error) {
      console.error('Profile update failed:', error);
      this.showToast('Network error. Please try again.', 'error');
    } finally {
      this.isSubmitting = false;
      this.setButtonLoading(false);
    }
  }

  /**
   * Update displayed email (called from EmailChange)
   * @param {string} newEmail
   */
  updateEmail(newEmail) {
    if (this.userData) {
      this.userData.email = newEmail;
    }
    if (this.displayEmail) {
      this.displayEmail.textContent = newEmail;
    }
  }

  /**
   * Get user initials for avatar placeholder
   * @returns {string}
   */
  getUserInitials() {
    if (!this.userData) return '?';
    const first = this.userData.first_name?.[0] || '';
    const last = this.userData.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  }

  /**
   * Get current user data
   * @returns {Object|null}
   */
  getUserData() {
    return this.userData;
  }

  /**
   * Set button loading state
   * @param {boolean} isLoading
   */
  setButtonLoading(isLoading) {
    if (!this.saveBtn) return;

    this.saveBtn.disabled = isLoading;
    this.saveBtn.textContent = isLoading ? 'Saving...' : 'Save Changes';

    if (isLoading) {
      this.saveBtn.classList.add('btn--loading');
    } else {
      this.saveBtn.classList.remove('btn--loading');
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

export default ProfilePage;
