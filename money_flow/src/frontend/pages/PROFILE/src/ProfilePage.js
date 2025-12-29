/**
 * ProfilePage - Main controller for the profile page
 * Manages profile details editing (first name, last name)
 * Coordinates with AvatarUpload, PasswordChange, and EmailChange components
 */
export class ProfilePage {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
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
    this.userData = null;
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

    // Load user data
    this.loadUserData();

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
   * Load user data from API
   */
  async loadUserData() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.showToast('Session expired. Please sign in again.', 'error');
          setTimeout(() => {
            window.location.href = '/sign-in';
          }, 1500);
          return;
        }
        throw new Error('Failed to load user data');
      }

      const result = await response.json();
      // Handle different API response structures
      this.userData = result.data?.user || result.user || result.data || result;
      this.populateForm();
    } catch (error) {
      console.error('Failed to load user data:', error);
      this.showToast('Failed to load profile data', 'error');
    }
  }

  /**
   * Populate form with user data
   */
  populateForm() {
    if (!this.userData) return;

    if (this.firstNameInput) {
      this.firstNameInput.value = this.userData.first_name || '';
    }
    if (this.lastNameInput) {
      this.lastNameInput.value = this.userData.last_name || '';
    }
    if (this.displayName) {
      const fullName = `${this.userData.first_name || ''} ${this.userData.last_name || ''}`.trim();
      this.displayName.textContent = fullName || 'User';
    }
    if (this.displayEmail) {
      this.displayEmail.textContent = this.userData.email || '';
    }

    // Disable save button initially (no changes)
    if (this.saveBtn) {
      this.saveBtn.disabled = true;
    }
  }

  /**
   * Check if form has unsaved changes
   */
  checkForChanges() {
    if (!this.userData || !this.saveBtn) return;

    const currentFirstName = this.firstNameInput?.value || '';
    const currentLastName = this.lastNameInput?.value || '';
    const originalFirstName = this.userData.first_name || '';
    const originalLastName = this.userData.last_name || '';

    const hasChanges =
      currentFirstName !== originalFirstName ||
      currentLastName !== originalLastName;

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
        // Update local data
        this.userData.first_name = firstName;
        this.userData.last_name = lastName;

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
