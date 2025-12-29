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

    // State
    this.currentPage = 1;
    this.itemsPerPage = 20;
    this.users = [];
    this.totalUsers = 0;

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
    this.bindEvents();
    this.loadUsers();
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Table action buttons (delegated)
    this.usersTable.addEventListener('click', (e) => {
      const deleteAvatarBtn = e.target.closest('[data-action="delete-avatar"]');
      if (deleteAvatarBtn) {
        const userId = deleteAvatarBtn.dataset.userId;
        this.confirmDeleteAvatar(userId);
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
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.users = data.users || [];
        this.totalUsers = data.total || 0;
        this.renderTable();
        this.renderPagination();
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

    const permissionOptions = this.permissionLevels.map(p =>
      `<option value="${p.value}" ${user.permissions === p.value ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    const hasAvatar = user.avatar_uuid !== null;

    return `
      <tr class="users-table__row">
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
          ${hasAvatar ? `
            <button class="btn btn--icon btn--delete" data-action="delete-avatar" data-user-id="${user.id}" title="Delete Avatar">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="15"></line>
                <line x1="15" y1="9" x2="9" y2="15"></line>
              </svg>
            </button>
          ` : `
            <span class="text-muted fs-xs">No avatar</span>
          `}
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
        <td colspan="8" class="users-table__empty">
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
   * Confirm delete avatar action
   * @param {string} userId - User ID
   */
  confirmDeleteAvatar(userId) {
    if (confirm('Are you sure you want to delete this user\'s avatar?')) {
      this.deleteUserAvatar(userId);
    }
  }

  /**
   * Delete a user's avatar
   * @param {string} userId - User ID
   */
  async deleteUserAvatar(userId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/users/${userId}/avatar`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
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
   * Update user permission level
   * @param {string} userId - User ID
   * @param {number} permission - New permission level
   */
  async updatePermission(userId, permission) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/users/${userId}/permissions`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
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
