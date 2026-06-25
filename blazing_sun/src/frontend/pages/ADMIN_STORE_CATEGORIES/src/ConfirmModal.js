/**
 * ConfirmModal
 *
 * Generic confirmation modal with optional warning and transfer selection.
 */
export class ConfirmModal {
  /**
   * @param {Object} options
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.showToast = options.showToast;

    // State
    this.onConfirm = null;
    this.processing = false;

    // Create modal DOM
    this.createModal();
    this.bindEvents();
  }

  /**
   * Create modal DOM structure
   */
  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'confirm-modal';
    this.modal.id = 'confirmModal';
    this.modal.setAttribute('aria-hidden', 'true');

    this.modal.innerHTML = `
      <div class="modal__backdrop" data-action="close"></div>
      <div class="confirm-modal__dialog modal__dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmModalTitle">
        <header class="modal__header">
          <h2 id="confirmModalTitle" class="modal__title">Confirm Action</h2>
          <button type="button" class="modal__close" data-action="close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>
        <div class="modal__body">
          <p id="confirmModalMessage" class="confirm-modal__message">Are you sure?</p>
          <div id="confirmModalWarning" class="confirm-modal__warning" style="display: none;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span id="confirmModalWarningText"></span>
          </div>
          <div id="confirmModalTransfer" class="confirm-modal__select" style="display: none;">
            <label class="form-label" for="transferSelect">Transfer products to:</label>
            <select id="transferSelect" class="form-input">
              <option value="">Don't transfer (leave uncategorized)</option>
            </select>
          </div>
        </div>
        <footer class="confirm-modal__actions">
          <button type="button" class="btn btn--ghost" data-action="close">Cancel</button>
          <button type="button" class="btn btn--danger" id="confirmModalBtn">
            <span id="confirmBtnText">Confirm</span>
            <span id="confirmBtnSpinner" style="display: none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
            </span>
          </button>
        </footer>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Cache elements
    this.titleEl = document.getElementById('confirmModalTitle');
    this.messageEl = document.getElementById('confirmModalMessage');
    this.warningEl = document.getElementById('confirmModalWarning');
    this.warningTextEl = document.getElementById('confirmModalWarningText');
    this.transferEl = document.getElementById('confirmModalTransfer');
    this.transferSelect = document.getElementById('transferSelect');
    this.confirmBtn = document.getElementById('confirmModalBtn');
    this.confirmBtnText = document.getElementById('confirmBtnText');
    this.confirmBtnSpinner = document.getElementById('confirmBtnSpinner');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Close modal
    this.modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('modal--visible')) {
        this.close();
      }
    });

    // Confirm button
    this.confirmBtn.addEventListener('click', async () => {
      await this.confirm();
    });
  }

  /**
   * Open the modal
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string} options.message - Confirmation message
   * @param {string} options.confirmLabel - Confirm button text
   * @param {string} options.confirmClass - Confirm button class
   * @param {boolean} options.showWarning - Show warning section
   * @param {string} options.warningMessage - Warning text
   * @param {boolean} options.showTransfer - Show transfer dropdown
   * @param {Array} options.transferOptions - Array of categories for transfer
   * @param {Function} options.onConfirm - Callback when confirmed
   */
  open(options) {
    this.titleEl.textContent = options.title || 'Confirm Action';
    this.messageEl.textContent = options.message || 'Are you sure?';
    this.confirmBtnText.textContent = options.confirmLabel || 'Confirm';
    this.onConfirm = options.onConfirm;

    // Reset button class
    this.confirmBtn.className = 'btn';
    this.confirmBtn.classList.add(options.confirmClass || 'btn--primary');

    // Show/hide warning
    if (options.showWarning && options.warningMessage) {
      this.warningTextEl.textContent = options.warningMessage;
      this.warningEl.style.display = 'flex';
    } else {
      this.warningEl.style.display = 'none';
    }

    // Show/hide transfer
    if (options.showTransfer && options.transferOptions && options.transferOptions.length > 0) {
      this.transferSelect.innerHTML = '<option value="">Don\'t transfer (leave uncategorized)</option>';
      options.transferOptions.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        this.transferSelect.appendChild(option);
      });
      this.transferEl.style.display = 'block';
    } else {
      this.transferEl.style.display = 'none';
    }

    this.modal.classList.add('modal--visible');
    this.modal.setAttribute('aria-hidden', 'false');
    this.confirmBtn.focus();
  }

  /**
   * Close the modal
   */
  close() {
    if (this.processing) return;

    this.modal.classList.remove('modal--visible');
    this.modal.setAttribute('aria-hidden', 'true');
    this.onConfirm = null;
  }

  /**
   * Handle confirmation
   */
  async confirm() {
    if (this.processing || typeof this.onConfirm !== 'function') return;

    this.processing = true;
    this.confirmBtn.disabled = true;
    this.confirmBtnText.style.display = 'none';
    this.confirmBtnSpinner.style.display = 'inline-flex';

    try {
      const transferToId = this.transferSelect.value
        ? parseInt(this.transferSelect.value, 10)
        : null;

      await this.onConfirm(transferToId);
      this.close();
    } catch (error) {
      console.error('Confirm action error:', error);
    } finally {
      this.processing = false;
      this.confirmBtn.disabled = false;
      this.confirmBtnText.style.display = 'inline';
      this.confirmBtnSpinner.style.display = 'none';
    }
  }
}
