import { getCsrfHeaders } from '../../GLOBAL/src/js/csrf.js';

/**
 * UsersPage Controller
 *
 * Handles super admin user management functionality:
 * - Display all users in a table
 * - Filter/search users
 * - Update user permissions
 * - Delete user avatars
 * - Pagination
 */

export class UsersPage {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl - Base URL for API requests
   * @param {HTMLElement} options.usersTable - Table body element
   * @param {HTMLElement} options.pagination - Pagination container
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.usersTable = options.usersTable;
    this.pagination = options.pagination;
    this.showToast = options.showToast;
    this.confirmModal = document.getElementById('confirmModal');
    this.confirmTitle = document.getElementById('confirmModalTitle');
    this.confirmMessage = document.getElementById('confirmModalMessage');
    this.confirmButton = document.querySelector('[data-action="confirm-modal"]');
    this.cancelButton = document.querySelector('[data-action="cancel-modal"]');
    this.bulkActionSelect = document.getElementById('bulkActionSelect');
    this.bulkPermissionSelect = document.getElementById('bulkPermissionSelect');
    this.bulkApplyBtn = document.getElementById('bulkApplyBtn');
    this.selectAllCheckbox = document.getElementById('selectAllUsers');

    // State
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.users = [];
    this.totalUsers = 0;
    this.pendingAction = null;
    this.selectedUserIds = new Set();

    // Permission levels
    this.permissionLevels = [
      { value: 1, label: 'Basic' },
      { value: 10, label: 'Admin' },
      { value: 50, label: 'Affiliate' },
      { value: 100, label: 'Super Admin' }
    ];

    this.init();
  }

  /**
   * Initialize the page
   */
  init() {
    this.initModal();
    this.bindEvents();
    this.loadUsers();
  }

  /**
   * Initialize confirmation modal
   */
  initModal() {
    if (!this.confirmModal || !this.confirmButton || !this.cancelButton) {
      return;
    }

    this.confirmModal.addEventListener('click', (e) => {
      const closeAction = e.target.closest('[data-action="close-modal"]');
      const cancelAction = e.target.closest('[data-action="cancel-modal"]');
      if (closeAction || cancelAction) {
        this.closeConfirmModal();
      }
    });

    this.confirmButton.addEventListener('click', () => {
      if (typeof this.pendingAction === 'function') {
        this.pendingAction();
      }
      this.closeConfirmModal();
    });
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Table action buttons (delegated)
    this.usersTable.addEventListener('click', (e) => {
      const deleteUserBtn = e.target.closest('[data-action="delete-user"]');
      if (deleteUserBtn) {
        const userId = deleteUserBtn.dataset.userId;
        const userEmail = deleteUserBtn.dataset.userEmail || 'this user';
        const userName = deleteUserBtn.dataset.userName || '';
        this.confirmDeleteUser(userId, userEmail, userName);
        return;
      }

      const deleteAvatarBtn = e.target.closest('[data-action="delete-avatar"]');
      if (deleteAvatarBtn) {
        const userId = deleteAvatarBtn.dataset.userId;
        const userEmail = deleteAvatarBtn.dataset.userEmail || 'this user';
        const userName = deleteAvatarBtn.dataset.userName || '';
        this.confirmDeleteAvatar(userId, userEmail, userName);
      }
    });

    // Table checkbox changes (delegated)
    this.usersTable.addEventListener('change', (e) => {
      const rowCheckbox = e.target.closest('[data-action="select-user"]');
      if (rowCheckbox) {
        const userId = parseInt(rowCheckbox.dataset.userId, 10);
        if (rowCheckbox.checked) {
          this.selectedUserIds.add(userId);
        } else {
          this.selectedUserIds.delete(userId);
        }
        this.updateSelectAllState();
        this.updateBulkActionsState();
      }
    });

    // Permission change (delegated)
    this.usersTable.addEventListener('change', (e) => {
      const permSelect = e.target.closest('[data-action="change-permission"]');
      if (permSelect) {
        const userId = permSelect.dataset.userId;
        const newPermission = parseInt(permSelect.value, 10);
        this.updatePermission(userId, newPermission);
      }
    });

    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.addEventListener('change', () => {
        const checkboxes = this.usersTable.querySelectorAll('[data-action="select-user"]');
        checkboxes.forEach((checkbox) => {
          checkbox.checked = this.selectAllCheckbox.checked;
          const userId = parseInt(checkbox.dataset.userId, 10);
          if (checkbox.checked) {
            this.selectedUserIds.add(userId);
          } else {
            this.selectedUserIds.delete(userId);
          }
        });
        this.updateBulkActionsState();
      });
    }

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.currentPage = 1;
          this.loadUsers(e.target.value);
        }, 300);
      });
    }

    if (this.bulkActionSelect) {
      this.bulkActionSelect.addEventListener('change', () => {
        this.handleBulkActionChange();
      });
    }

    if (this.bulkPermissionSelect) {
      this.bulkPermissionSelect.addEventListener('change', () => {
        this.updateBulkActionsState();
      });
    }

    if (this.bulkApplyBtn) {
      this.bulkApplyBtn.addEventListener('click', () => {
        this.handleBulkApply();
      });
    }
  }

  /**
   * Load users from API
   * @param {string} search - Search term
   */
  async loadUsers(search = '') {
    try {
      const offset = (this.currentPage - 1) * this.itemsPerPage;
      const params = new URLSearchParams({
        limit: this.itemsPerPage,
        offset: offset
      });

      const response = await fetch(`${this.baseUrl}/api/v1/admin/users?${params}`, {
        method: 'GET',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.users = data.users || [];
        this.totalUsers = data.total || 0;
        this.selectedUserIds.clear();
        if (this.selectAllCheckbox) {
          this.selectAllCheckbox.checked = false;
        }
        this.renderTable();
        this.renderPagination();
        this.updateBulkActionsState();
      } else {
        throw new Error(data.message || 'Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      this.showToast('Failed to load users', 'error');
      this.renderEmptyState();
    }
  }

  /**
   * Render the users table
   */
  renderTable() {
    if (this.users.length === 0) {
      this.renderEmptyState();
      return;
    }

    const rows = this.users.map(user => this.createRow(user)).join('');
    this.usersTable.innerHTML = rows;
  }

  /**
   * Create a table row for a user
   * @param {Object} user - User data
   * @returns {string} HTML string
   */
  createRow(user) {
    const dateFormatted = new Date(user.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    const activatedClass = user.activated === 1 ? 'status--success' : 'status--pending';
    const activatedText = user.activated === 1 ? 'Active' : 'Inactive';
    const fullName = `${user.first_name} ${user.last_name}`;

    const permissionOptions = this.permissionLevels.map(p =>
      `<option value="${p.value}" ${user.permissions === p.value ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    const hasAvatar = user.avatar_uuid !== null;

    return `
      <tr class="users-table__row">
        <td class="users-table__cell users-table__cell--select">
          <input type="checkbox" class="table-checkbox" data-action="select-user" data-user-id="${user.id}" aria-label="Select user ${user.email}">
        </td>
        <td class="users-table__cell users-table__cell--id">
          ${user.id}
        </td>
        <td class="users-table__cell users-table__cell--email">
          ${user.email}
        </td>
        <td class="users-table__cell users-table__cell--name">
          ${user.first_name} ${user.last_name}
        </td>
        <td class="users-table__cell users-table__cell--permission">
          <select class="permission-select" data-action="change-permission" data-user-id="${user.id}" aria-label="User permission level">
            ${permissionOptions}
          </select>
        </td>
        <td class="users-table__cell users-table__cell--status">
          <span class="status ${activatedClass}">${activatedText}</span>
        </td>
        <td class="users-table__cell users-table__cell--balance">
          ${this.formatBalance(user.balance)}
        </td>
        <td class="users-table__cell users-table__cell--date">
          ${dateFormatted}
        </td>
        <td class="users-table__cell users-table__cell--actions">
          <div class="actions-group">
            ${hasAvatar ? `
              <button class="btn btn--icon btn--delete" data-action="delete-avatar" data-user-id="${user.id}" data-user-email="${user.email}" data-user-name="${fullName}" title="Delete Avatar">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                </svg>
              </button>
            ` : `
              <span class="text-muted fs-xs">No avatar</span>
            `}
            <button class="btn btn--icon btn--danger" data-action="delete-user" data-user-id="${user.id}" data-user-email="${user.email}" data-user-name="${fullName}" title="Delete User">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18"></path>
                <path d="M8 6v12"></path>
                <path d="M16 6v12"></path>
                <path d="M5 6l1-2h12l1 2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    this.usersTable.innerHTML = `
      <tr>
        <td colspan="9" class="users-table__empty">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <p>No users found</p>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Render pagination controls
   */
  renderPagination() {
    if (!this.pagination) return;

    const totalPages = Math.ceil(this.totalUsers / this.itemsPerPage);

    if (totalPages <= 1) {
      this.pagination.innerHTML = '';
      return;
    }

    let html = '<div class="pagination">';

    // Previous button
    html += `
      <button class="pagination__btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
        &laquo; Prev
      </button>
    `;

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      html += `
        <button class="pagination__btn ${i === this.currentPage ? 'pagination__btn--active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    }

    // Next button
    html += `
      <button class="pagination__btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">
        Next &raquo;
      </button>
    `;

    html += '</div>';

    this.pagination.innerHTML = html;

    // Bind pagination events
    this.pagination.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page, 10);
        if (page >= 1 && page <= totalPages) {
          this.currentPage = page;
          this.loadUsers();
        }
      });
    });
  }

  /**
   * Handle bulk action selection changes
   */
  handleBulkActionChange() {
    if (!this.bulkActionSelect || !this.bulkPermissionSelect || !this.bulkApplyBtn) {
      return;
    }

    if (this.bulkActionSelect.value === 'set_permissions') {
      this.bulkPermissionSelect.classList.remove('bulk-actions__select--hidden');
    } else {
      this.bulkPermissionSelect.classList.add('bulk-actions__select--hidden');
      this.bulkPermissionSelect.value = '';
    }

    this.updateBulkActionsState();
  }

  /**
   * Update bulk action button state
   */
  updateBulkActionsState() {
    if (!this.bulkActionSelect || !this.bulkApplyBtn) {
      return;
    }

    const action = this.bulkActionSelect.value;
    const hasSelection = this.selectedUserIds.size > 0;
    const needsPermissions = action === 'set_permissions';
    const hasPermissionValue = !needsPermissions || (this.bulkPermissionSelect && this.bulkPermissionSelect.value);

    if (action) {
      this.bulkApplyBtn.classList.remove('btn--hidden');
    } else {
      this.bulkApplyBtn.classList.add('btn--hidden');
    }

    this.bulkApplyBtn.disabled = !(action && hasSelection && hasPermissionValue);
  }

  /**
   * Update select-all checkbox based on row selection
   */
  updateSelectAllState() {
    if (!this.selectAllCheckbox) {
      return;
    }

    const checkboxes = this.usersTable.querySelectorAll('[data-action="select-user"]');
    if (!checkboxes.length) {
      this.selectAllCheckbox.checked = false;
      return;
    }

    const allChecked = Array.from(checkboxes).every((checkbox) => checkbox.checked);
    this.selectAllCheckbox.checked = allChecked;
  }

  /**
   * Handle bulk apply action
   */
  handleBulkApply() {
    if (!this.bulkActionSelect) {
      return;
    }

    const action = this.bulkActionSelect.value;
    if (!action) {
      return;
    }

    if (this.selectedUserIds.size === 0) {
      this.showToast('Select at least one user', 'error');
      return;
    }

    if (action === 'delete') {
      this.openConfirmModal({
        title: 'Delete Users',
        message: `Delete ${this.selectedUserIds.size} user(s)? This cannot be undone.`,
        confirmLabel: 'Delete Users',
        onConfirm: () => this.applyBulkDelete()
      });
      return;
    }

    if (action === 'set_permissions') {
      const permissionValue = this.bulkPermissionSelect?.value;
      if (!permissionValue) {
        this.showToast('Select a permission level', 'error');
        return;
      }

      this.openConfirmModal({
        title: 'Change Permissions',
        message: `Change permissions for ${this.selectedUserIds.size} user(s)?`,
        confirmLabel: 'Update Permissions',
        onConfirm: () => this.applyBulkPermissions(parseInt(permissionValue, 10))
      });
    }
  }

  /**
   * Apply bulk delete
   */
  async applyBulkDelete() {
    await this.performBulkAction({
      action: 'delete',
      user_ids: Array.from(this.selectedUserIds),
      permissions: null
    });
  }

  /**
   * Apply bulk permission update
   * @param {number} permission
   */
  async applyBulkPermissions(permission) {
    await this.performBulkAction({
      action: 'set_permissions',
      user_ids: Array.from(this.selectedUserIds),
      permissions: permission
    });
  }

  /**
   * Perform bulk action request
   * @param {Object} payload
   */
  async performBulkAction(payload) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/users/bulk`, {
        method: 'POST',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Bulk action failed');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Bulk action completed', 'success');
        this.loadUsers();
      } else {
        throw new Error(data.message || 'Bulk action failed');
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      this.showToast('Bulk action failed', 'error');
    }
  }

  /**
   * Confirm delete avatar action
   * @param {string} userId - User ID
   */
  confirmDeleteAvatar(userId, userEmail, userName) {
    const label = userName ? `${userName} (${userEmail})` : userEmail;
    this.openConfirmModal({
      title: 'Delete Avatar',
      message: `Delete avatar for ${label}? This cannot be undone.`,
      confirmLabel: 'Delete Avatar',
      onConfirm: () => this.deleteUserAvatar(userId)
    });
  }

  /**
   * Delete a user's avatar
   * @param {string} userId - User ID
   */
  async deleteUserAvatar(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/users/${userId}/avatar`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete avatar');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Avatar deleted successfully', 'success');
        this.loadUsers();
      } else {
        throw new Error(data.message || 'Failed to delete avatar');
      }
    } catch (error) {
      console.error('Error deleting avatar:', error);
      this.showToast('Failed to delete avatar', 'error');
    }
  }

  /**
   * Confirm delete user action
   * @param {string} userId - User ID
   * @param {string} userEmail - User email
   * @param {string} userName - User name
   */
  confirmDeleteUser(userId, userEmail, userName) {
    const label = userName ? `${userName} (${userEmail})` : userEmail;
    this.openConfirmModal({
      title: 'Delete User',
      message: `Delete ${label}? This action removes the user permanently.`,
      confirmLabel: 'Delete User',
      onConfirm: () => this.deleteUser(userId)
    });
  }

  /**
   * Delete a user
   * @param {string} userId - User ID
   */
  async deleteUser(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getCsrfHeaders(),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('User deleted successfully', 'success');
        this.loadUsers();
      } else {
        throw new Error(data.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      this.showToast('Failed to delete user', 'error');
    }
  }

  /**
   * Open confirmation modal
   * @param {Object} options
   */
  openConfirmModal(options) {
    if (!this.confirmModal || !this.confirmTitle || !this.confirmMessage || !this.confirmButton) {
      return;
    }

    this.confirmTitle.textContent = options.title || 'Confirm action';
    this.confirmMessage.textContent = options.message || 'Are you sure?';
    this.confirmButton.textContent = options.confirmLabel || 'Confirm';
    this.pendingAction = options.onConfirm || null;

    this.confirmModal.classList.add('confirm-modal--visible');
    this.confirmModal.setAttribute('aria-hidden', 'false');
  }

  /**
   * Close confirmation modal
   */
  closeConfirmModal() {
    if (!this.confirmModal) {
      return;
    }

    this.confirmModal.classList.remove('confirm-modal--visible');
    this.confirmModal.setAttribute('aria-hidden', 'true');
    this.pendingAction = null;
  }

  /**
   * Update user permission level
   * @param {string} userId - User ID
   * @param {number} permission - New permission level
   */
  async updatePermission(userId, permission) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/users/${userId}/permissions`, {
        method: 'PATCH',
        headers: getCsrfHeaders(),
        credentials: 'include',
        body: JSON.stringify({ permissions: permission })
      });

      if (!response.ok) {
        throw new Error('Failed to update permission');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Permission updated successfully', 'success');
      } else {
        throw new Error(data.message || 'Failed to update permission');
      }
    } catch (error) {
      console.error('Error updating permission:', error);
      this.showToast('Failed to update permission', 'error');
      // Reload to restore original state
      this.loadUsers();
    }
  }

  /**
   * Format balance from cents to dollars
   * @param {number} cents
   * @returns {string}
   */
  formatBalance(cents) {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(dollars);
  }
}
