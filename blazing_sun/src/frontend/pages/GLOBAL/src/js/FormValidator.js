/**
 * FormValidator - Reusable form validation with rich reactive feedback
 *
 * Features:
 * - Real-time validation on input
 * - Password strength rules with visual indicators
 * - Email format validation
 * - Password visibility toggle
 */
export class FormValidator {
    constructor(options = {}) {
        this.options = {
            showIcons: true,
            validateOnInput: true,
            ...options
        };

        this.validationRules = {
            email: [
                { test: (v) => v.length > 0, message: 'Email is required', key: 'required' },
                { test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'Must be a valid email format', key: 'format' }
            ],
            password: [
                { test: (v) => v.length > 0, message: 'Password is required', key: 'required' },
                { test: (v) => v.length >= 8, message: 'Minimum 8 characters', key: 'minLength' },
                { test: (v) => /[A-Z]/.test(v), message: 'At least one uppercase letter', key: 'uppercase' },
                { test: (v) => /[a-z]/.test(v), message: 'At least one lowercase letter', key: 'lowercase' },
                { test: (v) => /[0-9]/.test(v), message: 'At least one number', key: 'number' },
                { test: (v) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(v), message: 'At least one special character', key: 'special' }
            ],
            first_name: [
                { test: (v) => v.length > 0, message: 'First name is required', key: 'required' },
                { test: (v) => v.length >= 2, message: 'Minimum 2 characters', key: 'minLength' },
                { test: (v) => /^[a-zA-Z\s'-]+$/.test(v) || v.length === 0, message: 'Letters only (no special characters)', key: 'letters' }
            ],
            last_name: [
                { test: (v) => v.length > 0, message: 'Last name is required', key: 'required' },
                { test: (v) => v.length >= 2, message: 'Minimum 2 characters', key: 'minLength' },
                { test: (v) => /^[a-zA-Z\s'-]+$/.test(v) || v.length === 0, message: 'Letters only (no special characters)', key: 'letters' }
            ],
            current_password: [
                { test: (v) => v.length > 0, message: 'Current password is required', key: 'required' }
            ],
            new_password: [
                { test: (v) => v.length > 0, message: 'New password is required', key: 'required' },
                { test: (v) => v.length >= 8, message: 'Minimum 8 characters', key: 'minLength' },
                { test: (v) => /[A-Z]/.test(v), message: 'At least one uppercase letter', key: 'uppercase' },
                { test: (v) => /[a-z]/.test(v), message: 'At least one lowercase letter', key: 'lowercase' },
                { test: (v) => /[0-9]/.test(v), message: 'At least one number', key: 'number' },
                { test: (v) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(v), message: 'At least one special character', key: 'special' }
            ]
        };

        this.boundInputs = new Map();

        // Store for password confirmation matching
        this.passwordConfirmPairs = new Map();
    }

    /**
     * Bind password confirmation to match another password input
     * @param {HTMLInputElement} confirmInput - The confirmation input
     * @param {HTMLInputElement} passwordInput - The original password input
     * @param {HTMLElement} feedbackContainer - Container for feedback
     */
    bindPasswordConfirm(confirmInput, passwordInput, feedbackContainer) {
        if (!confirmInput || !passwordInput) return;

        const state = {
            input: confirmInput,
            type: 'password_confirm',
            feedbackContainer,
            isValid: false,
            touched: false,
            passwordInput
        };

        this.boundInputs.set(confirmInput, state);
        this.passwordConfirmPairs.set(confirmInput, passwordInput);

        // Create feedback element
        if (feedbackContainer) {
            feedbackContainer.innerHTML = '';
            feedbackContainer.className = 'validation-feedback';

            const item = document.createElement('div');
            item.className = 'validation-item';
            item.dataset.rule = 'match';
            item.innerHTML = `
                <span class="validation-icon"></span>
                <span class="validation-text">Passwords must match</span>
            `;
            feedbackContainer.appendChild(item);
        }

        // Bind events
        if (this.options.validateOnInput) {
            confirmInput.addEventListener('input', () => this.validatePasswordConfirm(state));
            confirmInput.addEventListener('blur', () => {
                state.touched = true;
                this.validatePasswordConfirm(state);
            });
            // Also validate when original password changes
            passwordInput.addEventListener('input', () => {
                if (confirmInput.value.length > 0) {
                    this.validatePasswordConfirm(state);
                }
            });
        }
    }

    /**
     * Validate password confirmation matches
     * @param {Object} state - Input state
     */
    validatePasswordConfirm(state) {
        const { input, feedbackContainer, touched, passwordInput } = state;
        const value = input.value;
        const passwordValue = passwordInput.value;
        const isValid = value.length > 0 && value === passwordValue;

        state.isValid = isValid;

        if (feedbackContainer) {
            const item = feedbackContainer.querySelector('[data-rule="match"]');
            if (item) {
                item.classList.remove('valid', 'invalid');
                if (value.length > 0 || touched) {
                    item.classList.add(isValid ? 'valid' : 'invalid');
                }
            }
        }

        // Update input styling
        input.classList.remove('input--valid', 'input--invalid');
        if (value.length > 0 || touched) {
            input.classList.add(isValid ? 'input--valid' : 'input--invalid');
        }

        return isValid;
    }

    /**
     * Bind validation to an input element
     * @param {HTMLInputElement} input - The input element
     * @param {string} type - Validation type ('email' or 'password')
     * @param {HTMLElement} feedbackContainer - Container for validation feedback
     */
    bindInput(input, type, feedbackContainer) {
        if (!input || !this.validationRules[type]) {
            return;
        }

        const state = {
            input,
            type,
            feedbackContainer,
            isValid: false,
            touched: false
        };

        this.boundInputs.set(input, state);

        // Create feedback elements
        this.createFeedbackElements(state);

        // Bind events
        if (this.options.validateOnInput) {
            input.addEventListener('input', () => this.validateInput(state));
            input.addEventListener('blur', () => {
                state.touched = true;
                this.validateInput(state);
            });
        }

        // Initial validation (hidden)
        this.validateInput(state, false);
    }

    /**
     * Create validation feedback elements
     * @param {Object} state - Input state
     */
    createFeedbackElements(state) {
        const { feedbackContainer, type } = state;
        if (!feedbackContainer) return;

        feedbackContainer.innerHTML = '';
        feedbackContainer.className = 'validation-feedback';

        const rules = this.validationRules[type];
        rules.forEach(rule => {
            const item = document.createElement('div');
            item.className = 'validation-item';
            item.dataset.rule = rule.key;
            item.innerHTML = `
                <span class="validation-icon"></span>
                <span class="validation-text">${rule.message}</span>
            `;
            feedbackContainer.appendChild(item);
        });
    }

    /**
     * Validate an input and update feedback
     * @param {Object} state - Input state
     * @param {boolean} showFeedback - Whether to show feedback
     */
    validateInput(state, showFeedback = true) {
        const { input, type, feedbackContainer, touched } = state;
        const value = input.value;
        const rules = this.validationRules[type];

        let allValid = true;

        rules.forEach(rule => {
            const isValid = rule.test(value);
            if (!isValid) allValid = false;

            if (feedbackContainer && (showFeedback || touched)) {
                const item = feedbackContainer.querySelector(`[data-rule="${rule.key}"]`);
                if (item) {
                    item.classList.remove('valid', 'invalid');
                    if (value.length > 0 || touched) {
                        item.classList.add(isValid ? 'valid' : 'invalid');
                    }
                }
            }
        });

        state.isValid = allValid;

        // Update input styling
        input.classList.remove('input--valid', 'input--invalid');
        if ((value.length > 0 || touched) && showFeedback) {
            input.classList.add(allValid ? 'input--valid' : 'input--invalid');
        }

        return allValid;
    }

    /**
     * Validate all bound inputs
     * @returns {boolean} - Whether all inputs are valid
     */
    validateAll() {
        let allValid = true;

        this.boundInputs.forEach((state) => {
            state.touched = true;
            if (state.type === 'password_confirm') {
                if (!this.validatePasswordConfirm(state)) {
                    allValid = false;
                }
            } else {
                if (!this.validateInput(state, true)) {
                    allValid = false;
                }
            }
        });

        return allValid;
    }

    /**
     * Check if all inputs are valid without triggering validation display
     * @returns {boolean}
     */
    isValid() {
        let allValid = true;
        this.boundInputs.forEach((state) => {
            if (!state.isValid) allValid = false;
        });
        return allValid;
    }

    /**
     * Reset all validation states
     */
    reset() {
        this.boundInputs.forEach((state) => {
            state.touched = false;
            state.isValid = false;
            state.input.classList.remove('input--valid', 'input--invalid');

            if (state.feedbackContainer) {
                const items = state.feedbackContainer.querySelectorAll('.validation-item');
                items.forEach(item => item.classList.remove('valid', 'invalid'));
            }
        });
    }

    /**
     * Get validation errors for all inputs
     * @returns {Object} - Object with field names as keys and error arrays as values
     */
    getErrors() {
        const errors = {};

        this.boundInputs.forEach((state, input) => {
            const value = input.value;
            const rules = this.validationRules[state.type];
            const fieldErrors = [];

            rules.forEach(rule => {
                if (!rule.test(value)) {
                    fieldErrors.push(rule.message);
                }
            });

            if (fieldErrors.length > 0) {
                errors[input.name || input.id || state.type] = fieldErrors;
            }
        });

        return errors;
    }
}

/**
 * PasswordToggle - Add show/hide functionality to password inputs
 */
export class PasswordToggle {
    /**
     * @param {HTMLInputElement} input - Password input element
     * @param {HTMLElement} toggleBtn - Toggle button element
     */
    constructor(input, toggleBtn) {
        this.input = input;
        this.toggleBtn = toggleBtn;
        this.isVisible = false;

        if (this.input && this.toggleBtn) {
            this.init();
        }
    }

    init() {
        this.toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggle();
        });

        // Update icon on init
        this.updateIcon();
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.input.type = this.isVisible ? 'text' : 'password';
        this.updateIcon();
    }

    updateIcon() {
        // Eye icon SVGs
        const eyeOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        const eyeClosed = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

        this.toggleBtn.innerHTML = this.isVisible ? eyeClosed : eyeOpen;
        this.toggleBtn.setAttribute('aria-label', this.isVisible ? 'Hide password' : 'Show password');
    }
}

export default { FormValidator, PasswordToggle };
