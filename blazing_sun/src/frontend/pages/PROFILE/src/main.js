/**
 * Profile Page - Main Entry Point
 * Initializes all profile page components
 */
import './styles/main.scss';
import { ProfilePage } from './ProfilePage.js';
import { AvatarUpload } from './AvatarUpload.js';
import { PasswordChange } from './PasswordChange.js';
import { EmailChange } from './EmailChange.js';

/**
 * Show toast notification using Toastify
 * @param {string} message
 * @param {string} type - 'success', 'error', 'warning', 'info'
 */
function showToast(message, type = 'info') {
  const colors = {
    success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    info: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  };

  if (typeof Toastify === 'function') {
    Toastify({
      text: message,
      duration: 4000,
      gravity: 'top',
      position: 'right',
      stopOnFocus: true,
      style: {
        background: colors[type] || colors.info,
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }
    }).showToast();
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

/**
 * Initialize all profile page components
 */
function initProfilePage() {
  const baseUrl = window.BASE_URL || '';
  // User data comes from SSR (set in template via window.USER_DATA)
  const userData = window.USER_DATA || null;

  // Initialize ProfilePage (main controller)
  const profilePage = new ProfilePage({
    baseUrl,
    userData,
    profileForm: document.getElementById('profileForm'),
    firstNameInput: document.getElementById('first_name'),
    lastNameInput: document.getElementById('last_name'),
    displayName: document.getElementById('displayName'),
    displayEmail: document.getElementById('displayEmail'),
    saveBtn: document.getElementById('saveProfileBtn'),
    showToast
  });

  // Initialize AvatarUpload
  const avatarUpload = new AvatarUpload({
    baseUrl,
    avatarContainer: document.getElementById('avatarContainer'),
    avatarImage: document.getElementById('avatarImage'),
    avatarPlaceholder: document.getElementById('avatarPlaceholder'),
    fileInput: document.getElementById('avatarInput'),
    previewModal: document.getElementById('avatarPreviewModal'),
    previewImage: document.getElementById('previewImage'),
    confirmBtn: document.getElementById('confirmAvatarBtn'),
    cancelBtn: document.getElementById('cancelAvatarBtn'),
    showToast,
    getAuthToken: () => profilePage.getAuthToken(),
    onUploadSuccess: (file) => {
      console.log('Avatar uploaded:', file);
    }
  });

  // Initialize PasswordChange
  const passwordChange = new PasswordChange({
    baseUrl,
    form: document.getElementById('passwordForm'),
    currentPasswordInput: document.getElementById('current_password'),
    newPasswordInput: document.getElementById('new_password'),
    confirmPasswordInput: document.getElementById('confirm_password'),
    strengthBar: document.querySelector('.password-strength__bar'),
    strengthText: document.querySelector('.password-strength-text'),
    submitBtn: document.getElementById('changePasswordBtn'),
    showToast,
    getAuthToken: () => profilePage.getAuthToken()
  });

  // Initialize EmailChange
  const emailChange = new EmailChange({
    baseUrl,
    step1Card: document.getElementById('emailStep1'),
    step2Card: document.getElementById('emailStep2'),
    step3Card: document.getElementById('emailStep3'),
    emailForm: document.getElementById('newEmailForm'),
    verifyForm: document.getElementById('verifyEmailForm'),
    newEmailInput: document.getElementById('new_email'),
    codeInput: document.getElementById('email_code'),
    emailBtn: document.getElementById('sendEmailCodeBtn'),
    verifyBtn: document.getElementById('verifyEmailBtn'),
    stepIndicators: Array.from(document.querySelectorAll('.email-step')),
    showToast,
    getAuthToken: () => profilePage.getAuthToken(),
    onEmailChanged: (newEmail) => {
      profilePage.updateEmail(newEmail);
    }
  });

  // Set initial avatar from SSR user data (no polling needed)
  if (userData && userData.avatar_url) {
    avatarUpload.setAvatar(userData.avatar_url);
  }

  // Make instances available globally for debugging
  window.profilePage = profilePage;
  window.avatarUpload = avatarUpload;
  window.passwordChange = passwordChange;
  window.emailChange = emailChange;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
  initProfilePage();
}
