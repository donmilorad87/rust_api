/**
 * AvatarUpload - Handles profile picture upload functionality
 * Features:
 * - Click to select file
 * - Preview before upload
 * - Upload to server
 * - Display current avatar or initials placeholder
 */
export class AvatarUpload {
  /**
   * @param {Object} config
   * @param {string} config.baseUrl - API base URL
   * @param {HTMLElement} config.avatarContainer - Avatar container element
   * @param {HTMLImageElement} config.avatarImage - Avatar image element
   * @param {HTMLElement} config.avatarPlaceholder - Placeholder element (initials)
   * @param {HTMLInputElement} config.fileInput - File input element
   * @param {HTMLElement} config.previewModal - Preview modal element
   * @param {HTMLImageElement} config.previewImage - Preview image element
   * @param {HTMLButtonElement} config.confirmBtn - Confirm upload button
   * @param {HTMLButtonElement} config.cancelBtn - Cancel button
   * @param {Function} config.showToast - Toast notification function
   * @param {Function} config.getAuthToken - Function to get JWT token
   */
  constructor(config) {
    this.baseUrl = config.baseUrl || '';
    this.avatarContainer = config.avatarContainer;
    this.avatarImage = config.avatarImage;
    this.avatarPlaceholder = config.avatarPlaceholder;
    this.fileInput = config.fileInput;
    this.previewModal = config.previewModal;
    this.previewImage = config.previewImage;
    this.confirmBtn = config.confirmBtn;
    this.cancelBtn = config.cancelBtn;
    this.showToast = config.showToast || this.defaultToast.bind(this);
    this.getAuthToken = config.getAuthToken || (() => null);
    this.onUploadSuccess = config.onUploadSuccess || (() => {});

    this.selectedFile = null;
    this.isUploading = false;
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    this.init();
  }

  /**
   * Initialize event listeners
   */
  init() {
    if (!this.fileInput || !this.avatarContainer) {
      console.error('AvatarUpload: Required elements not found');
      return;
    }

    // Click on avatar opens file picker
    const overlay = this.avatarContainer.querySelector('.avatar__overlay');
    if (overlay) {
      overlay.addEventListener('click', () => this.fileInput.click());
    }

    // File selection
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

    // Preview modal actions
    if (this.confirmBtn) {
      this.confirmBtn.addEventListener('click', () => this.uploadAvatar());
    }
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener('click', () => this.closePreview());
    }

    // Close modal on outside click
    if (this.previewModal) {
      this.previewModal.addEventListener('click', (e) => {
        if (e.target === this.previewModal) {
          this.closePreview();
        }
      });
    }
  }

  /**
   * Handle file selection
   * @param {Event} event
   */
  handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!this.allowedTypes.includes(file.type)) {
      this.showToast('Please select a valid image file (JPEG, PNG, GIF, or WebP)', 'error');
      this.fileInput.value = '';
      return;
    }

    // Validate file size
    if (file.size > this.maxFileSize) {
      this.showToast('Image must be smaller than 5MB', 'error');
      this.fileInput.value = '';
      return;
    }

    this.selectedFile = file;
    this.showPreview(file);
  }

  /**
   * Show preview modal with selected image
   * @param {File} file
   */
  showPreview(file) {
    if (!this.previewModal || !this.previewImage) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewImage.src = e.target.result;
      this.previewModal.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  /**
   * Close preview modal
   */
  closePreview() {
    if (this.previewModal) {
      this.previewModal.classList.add('hidden');
    }
    this.selectedFile = null;
    this.fileInput.value = '';
  }

  /**
   * Upload avatar to server
   * Uses POST /upload/avatar which creates an upload record and updates user's avatar_uuid
   */
  async uploadAvatar() {
    if (!this.selectedFile || this.isUploading) return;

    // NOTE: We don't check for a readable auth token here because the auth cookie
    // is HttpOnly for security. The server already validated authentication before
    // rendering this page, and the HttpOnly cookie will be sent automatically with
    // this request. If the user is not authenticated, the server will reject the request.

    this.isUploading = true;
    this.setButtonLoading(true);

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    try {
      // Upload avatar using dedicated endpoint
      // This creates an asset record and updates user's avatar_uuid in one step
      const response = await fetch(`${this.baseUrl}/api/v1/upload/avatar`, {
        method: 'POST',
        credentials: 'same-origin', // Ensure HttpOnly auth cookie is sent
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        // Avatar endpoint returns upload with URL
        const upload = result.upload;
        // Use 'small' variant (320px) for avatar display for better performance
        const imageUrl = `${upload.url}?variant=small`;

        this.updateAvatarDisplay(imageUrl);
        this.showToast('Profile picture updated!', 'success');
        this.closePreview();
        this.onUploadSuccess(upload);
      } else {
        this.showToast(result.message || 'Failed to upload profile picture', 'error');
      }
    } catch (error) {
      console.error('Avatar upload failed:', error);
      this.showToast('Network error. Please try again.', 'error');
    } finally {
      this.isUploading = false;
      this.setButtonLoading(false);
    }
  }

  /**
   * Update avatar display with new image
   * @param {string} imageUrl
   */
  updateAvatarDisplay(imageUrl) {
    if (this.avatarImage) {
      this.avatarImage.src = imageUrl;
      this.avatarImage.classList.remove('hidden');
    }
    if (this.avatarPlaceholder) {
      this.avatarPlaceholder.classList.add('hidden');
    }
  }

  /**
   * Set initial avatar from user data
   * @param {string|null} avatarUrl - URL of the avatar file (or full URL)
   * Note: Profile pictures are private and served via /api/v1/avatar/{uuid}
   */
  setAvatar(avatarUrl) {
    if (avatarUrl) {
      // Use 'small' variant (320px) for avatar display for better performance
      const variantUrl = avatarUrl.includes('?')
        ? `${avatarUrl}&variant=small`
        : `${avatarUrl}?variant=small`;
      this.updateAvatarDisplay(variantUrl);
    } else {
      // Show SVG placeholder
      if (this.avatarImage) {
        this.avatarImage.classList.add('hidden');
      }
      if (this.avatarPlaceholder) {
        this.avatarPlaceholder.classList.remove('hidden');
      }
    }
  }

  /**
   * Set button loading state
   * @param {boolean} isLoading
   */
  setButtonLoading(isLoading) {
    if (!this.confirmBtn) return;

    this.confirmBtn.disabled = isLoading;
    this.confirmBtn.textContent = isLoading ? 'Uploading...' : 'Save';

    if (isLoading) {
      this.confirmBtn.classList.add('btn--loading');
    } else {
      this.confirmBtn.classList.remove('btn--loading');
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

export default AvatarUpload;
