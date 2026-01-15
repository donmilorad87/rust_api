/**
 * Game Chat Configuration Page Controller
 *
 * Handles game chat configuration management including:
 * - Rate limiting settings
 * - Message length limits
 * - Profanity filter with word list
 * - Global mute toggle
 */
export class GameChatConfigPage {
  /**
   * Create a new GameChatConfigPage instance
   * @param {Object} options - Configuration options
   * @param {string} options.baseUrl - Base URL for API calls
   * @param {HTMLElement} options.configForm - The configuration form element
   * @param {HTMLElement} options.loadingIndicator - Loading indicator element
   * @param {Function} options.showToast - Toast notification function
   */
  constructor(options) {
    this.baseUrl = options.baseUrl || '';
    this.configForm = options.configForm;
    this.loadingIndicator = options.loadingIndicator;
    this.showToast = options.showToast || console.log;

    // Current configuration state
    this.config = {
      rate_limit_messages: 10,
      rate_limit_window_seconds: 60,
      max_message_length: 500,
      profanity_filter_enabled: true,
      profanity_word_list: [],
      global_mute_enabled: false
    };

    // Cache DOM elements
    this.cacheElements();

    // Bind event handlers
    this.bindEvents();

    // Load initial configuration
    this.loadConfig();
  }

  /**
   * Cache frequently accessed DOM elements
   */
  cacheElements() {
    this.elements = {
      // Rate limiting
      rateLimitMessages: document.getElementById('rateLimitMessages'),
      rateLimitWindow: document.getElementById('rateLimitWindow'),
      previewMessages: document.getElementById('previewMessages'),
      previewWindow: document.getElementById('previewWindow'),

      // Message settings
      maxMessageLength: document.getElementById('maxMessageLength'),

      // Profanity filter
      profanityFilterEnabled: document.getElementById('profanityFilterEnabled'),
      profanitySection: document.getElementById('profanitySection'),
      addWordInput: document.getElementById('addWordInput'),
      addWordBtn: document.getElementById('addWordBtn'),
      wordList: document.getElementById('wordList'),
      wordListEmpty: document.getElementById('wordListEmpty'),
      wordCount: document.getElementById('wordCount'),

      // Global mute
      globalMuteBtn: document.getElementById('globalMuteBtn'),
      globalMuteModal: document.getElementById('globalMuteModal'),
      closeGlobalMuteModal: document.getElementById('closeGlobalMuteModal'),
      cancelGlobalMute: document.getElementById('cancelGlobalMute'),
      confirmGlobalMute: document.getElementById('confirmGlobalMute'),
      globalMuteModalText: document.getElementById('globalMuteModalText'),
      confirmGlobalMuteText: document.getElementById('confirmGlobalMuteText'),

      // Form actions
      saveBtn: document.getElementById('saveBtn')
    };
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Form submission
    this.configForm.addEventListener('submit', (e) => this.handleSubmit(e));

    // Rate limit preview updates
    this.elements.rateLimitMessages.addEventListener('input', () => this.updateRateLimitPreview());
    this.elements.rateLimitWindow.addEventListener('input', () => this.updateRateLimitPreview());

    // Profanity filter toggle
    this.elements.profanityFilterEnabled.addEventListener('change', () => this.toggleProfanitySection());

    // Add word handlers
    this.elements.addWordBtn.addEventListener('click', () => this.addWord());
    this.elements.addWordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.addWord();
      }
    });

    // Global mute handlers
    this.elements.globalMuteBtn.addEventListener('click', () => this.showGlobalMuteModal());
    this.elements.closeGlobalMuteModal.addEventListener('click', () => this.hideGlobalMuteModal());
    this.elements.cancelGlobalMute.addEventListener('click', () => this.hideGlobalMuteModal());
    this.elements.confirmGlobalMute.addEventListener('click', () => this.toggleGlobalMute());

    // Close modal on backdrop click
    this.elements.globalMuteModal.addEventListener('click', (e) => {
      if (e.target === this.elements.globalMuteModal) {
        this.hideGlobalMuteModal();
      }
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.elements.globalMuteModal.classList.contains('hidden')) {
        this.hideGlobalMuteModal();
      }
    });
  }

  /**
   * Load configuration from API
   */
  async loadConfig() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/game-chat/config`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.config) {
        this.config = data.config;
        this.populateForm();
      } else {
        throw new Error(data.message || 'Failed to load configuration');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      this.showToast('Failed to load configuration', 'error');
    } finally {
      // Hide loading, show form
      this.loadingIndicator.classList.add('hidden');
      this.configForm.classList.remove('hidden');
    }
  }

  /**
   * Populate form with current config values
   */
  populateForm() {
    // Rate limiting
    this.elements.rateLimitMessages.value = this.config.rate_limit_messages;
    this.elements.rateLimitWindow.value = this.config.rate_limit_window_seconds;
    this.updateRateLimitPreview();

    // Message settings
    this.elements.maxMessageLength.value = this.config.max_message_length;

    // Profanity filter
    this.elements.profanityFilterEnabled.checked = this.config.profanity_filter_enabled;
    this.toggleProfanitySection();
    this.renderWordList();

    // Global mute button state
    this.updateGlobalMuteButton();
  }

  /**
   * Update rate limit preview text
   */
  updateRateLimitPreview() {
    const messages = this.elements.rateLimitMessages.value || 10;
    const window = this.elements.rateLimitWindow.value || 60;

    this.elements.previewMessages.textContent = messages;
    this.elements.previewWindow.textContent = window;
  }

  /**
   * Toggle profanity section visibility
   */
  toggleProfanitySection() {
    const enabled = this.elements.profanityFilterEnabled.checked;
    this.elements.profanitySection.style.opacity = enabled ? '1' : '0.5';
    this.elements.profanitySection.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  /**
   * Render the word list
   */
  renderWordList() {
    const words = this.config.profanity_word_list || [];
    const container = this.elements.wordList;

    // Clear existing words (keep the empty message)
    const existingWords = container.querySelectorAll('.word-tag');
    existingWords.forEach(el => el.remove());

    // Show/hide empty message
    this.elements.wordListEmpty.classList.toggle('hidden', words.length > 0);

    // Render words
    words.forEach(word => {
      const tag = this.createWordTag(word);
      container.appendChild(tag);
    });

    // Update count
    this.elements.wordCount.textContent = words.length;
  }

  /**
   * Create a word tag element
   * @param {string} word - The word to display
   * @returns {HTMLElement}
   */
  createWordTag(word) {
    const tag = document.createElement('span');
    tag.className = 'word-tag';
    tag.innerHTML = `
      <span class="word-tag__text">${this.escapeHtml(word)}</span>
      <button type="button" class="word-tag__remove" aria-label="Remove ${this.escapeHtml(word)}" data-word="${this.escapeHtml(word)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    // Bind remove handler
    tag.querySelector('.word-tag__remove').addEventListener('click', () => this.removeWord(word));

    return tag;
  }

  /**
   * Add a word to the profanity filter
   */
  async addWord() {
    const input = this.elements.addWordInput;
    const word = input.value.trim().toLowerCase();

    if (!word) {
      return;
    }

    // Check if already in list
    if (this.config.profanity_word_list.includes(word)) {
      this.showToast('Word already in filter list', 'warning');
      input.value = '';
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/game-chat/profanity/add`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ word })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Add to local list and re-render
        this.config.profanity_word_list.push(word);
        this.renderWordList();
        input.value = '';
        this.showToast('Word added to filter', 'success');
      } else {
        throw new Error(data.message || 'Failed to add word');
      }
    } catch (error) {
      console.error('Failed to add word:', error);
      this.showToast(error.message || 'Failed to add word', 'error');
    }
  }

  /**
   * Remove a word from the profanity filter
   * @param {string} word - The word to remove
   */
  async removeWord(word) {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/game-chat/profanity/remove`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ word })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Remove from local list and re-render
        const index = this.config.profanity_word_list.indexOf(word);
        if (index > -1) {
          this.config.profanity_word_list.splice(index, 1);
        }
        this.renderWordList();
        this.showToast('Word removed from filter', 'success');
      } else {
        throw new Error(data.message || 'Failed to remove word');
      }
    } catch (error) {
      console.error('Failed to remove word:', error);
      this.showToast(error.message || 'Failed to remove word', 'error');
    }
  }

  /**
   * Handle form submission
   * @param {Event} e - Submit event
   */
  async handleSubmit(e) {
    e.preventDefault();

    // Gather form values
    const updateData = {
      rate_limit_messages: parseInt(this.elements.rateLimitMessages.value, 10),
      rate_limit_window_seconds: parseInt(this.elements.rateLimitWindow.value, 10),
      max_message_length: parseInt(this.elements.maxMessageLength.value, 10),
      profanity_filter_enabled: this.elements.profanityFilterEnabled.checked
    };

    // Validate
    if (updateData.rate_limit_messages < 1 || updateData.rate_limit_messages > 1000) {
      this.showToast('Rate limit messages must be between 1 and 1000', 'error');
      return;
    }

    if (updateData.rate_limit_window_seconds < 1 || updateData.rate_limit_window_seconds > 3600) {
      this.showToast('Rate limit window must be between 1 and 3600 seconds', 'error');
      return;
    }

    if (updateData.max_message_length < 1 || updateData.max_message_length > 10000) {
      this.showToast('Max message length must be between 1 and 10000', 'error');
      return;
    }

    // Disable button during save
    this.elements.saveBtn.disabled = true;
    this.elements.saveBtn.textContent = 'Saving...';

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/game-chat/config`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Update local config
        if (data.config) {
          this.config = data.config;
        } else {
          Object.assign(this.config, updateData);
        }
        this.showToast('Configuration saved successfully', 'success');
      } else {
        throw new Error(data.message || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      this.showToast(error.message || 'Failed to save configuration', 'error');
    } finally {
      this.elements.saveBtn.disabled = false;
      this.elements.saveBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        Save Changes
      `;
    }
  }

  /**
   * Update global mute button state
   */
  updateGlobalMuteButton() {
    const isMuted = this.config.global_mute_enabled;
    const btn = this.elements.globalMuteBtn;

    btn.classList.toggle('global-mute-btn--active', isMuted);
    btn.querySelector('.global-mute-btn__text').textContent = isMuted ? 'Mute Active' : 'Global Mute';
  }

  /**
   * Show the global mute confirmation modal
   */
  showGlobalMuteModal() {
    const willEnable = !this.config.global_mute_enabled;

    // Update modal text
    if (willEnable) {
      this.elements.globalMuteModalText.textContent = 'Are you sure you want to enable global mute? This will immediately disable chat in ALL game rooms.';
      this.elements.confirmGlobalMuteText.textContent = 'Enable Global Mute';
      this.elements.confirmGlobalMute.classList.remove('btn--success');
      this.elements.confirmGlobalMute.classList.add('btn--danger');
    } else {
      this.elements.globalMuteModalText.textContent = 'Are you sure you want to disable global mute? Chat will be re-enabled in all game rooms.';
      this.elements.confirmGlobalMuteText.textContent = 'Disable Global Mute';
      this.elements.confirmGlobalMute.classList.remove('btn--danger');
      this.elements.confirmGlobalMute.classList.add('btn--success');
    }

    this.elements.globalMuteModal.classList.remove('hidden');
    this.elements.confirmGlobalMute.focus();
  }

  /**
   * Hide the global mute confirmation modal
   */
  hideGlobalMuteModal() {
    this.elements.globalMuteModal.classList.add('hidden');
    this.elements.globalMuteBtn.focus();
  }

  /**
   * Toggle global mute via API
   */
  async toggleGlobalMute() {
    const willEnable = !this.config.global_mute_enabled;

    // Disable confirm button
    this.elements.confirmGlobalMute.disabled = true;
    this.elements.confirmGlobalMuteText.textContent = 'Processing...';

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/game-chat/global-mute`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ enabled: willEnable })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.config.global_mute_enabled = willEnable;
        this.updateGlobalMuteButton();
        this.hideGlobalMuteModal();

        const action = willEnable ? 'enabled' : 'disabled';
        this.showToast(`Global mute ${action}`, willEnable ? 'warning' : 'success');
      } else {
        throw new Error(data.message || 'Failed to toggle global mute');
      }
    } catch (error) {
      console.error('Failed to toggle global mute:', error);
      this.showToast(error.message || 'Failed to toggle global mute', 'error');
    } finally {
      this.elements.confirmGlobalMute.disabled = false;
      this.elements.confirmGlobalMuteText.textContent = willEnable ? 'Disable Global Mute' : 'Enable Global Mute';
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string}
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
