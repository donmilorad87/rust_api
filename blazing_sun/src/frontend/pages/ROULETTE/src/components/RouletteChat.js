/**
 * Roulette Chat Component
 *
 * Global chat for multiplayer roulette with:
 * - Message display with avatars
 * - System messages
 * - Opt-out toggle
 */

export class RouletteChat {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.messages = [];
        this.maxMessages = 100;
        this.optedOut = false;
        this.collapsed = false;

        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="roulette-chat ${this.collapsed ? 'roulette-chat--collapsed' : ''}">
                <div class="roulette-chat__header">
                    <div class="roulette-chat__title">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                        </svg>
                        Chat
                    </div>
                    <button
                        class="roulette-chat__toggle ${this.optedOut ? 'roulette-chat__toggle--opted-out' : ''}"
                        id="chat-opt-out-toggle"
                    >
                        ${this.optedOut ? 'Muted' : 'Mute'}
                    </button>
                </div>

                <div class="roulette-chat__messages" id="chat-messages">
                    ${this.messages.length === 0 ? '<div class="roulette-chat__empty">No messages yet</div>' : ''}
                </div>

                <div class="roulette-chat__input-area">
                    <input
                        type="text"
                        class="roulette-chat__input"
                        id="chat-input"
                        placeholder="Type a message..."
                        maxlength="500"
                        ${this.optedOut ? 'disabled' : ''}
                    />
                    <button class="roulette-chat__send" id="chat-send" ${this.optedOut ? 'disabled' : ''}>
                        Send
                    </button>
                </div>
            </div>
        `;

        this.messagesEl = document.getElementById('chat-messages');
        this.inputEl = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('chat-send');
        this.toggleBtn = document.getElementById('chat-opt-out-toggle');

        this.attachEventListeners();
    }

    attachEventListeners() {
        // Send message
        this.sendBtn?.addEventListener('click', () => this.sendMessage());

        // Enter key to send
        this.inputEl?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Toggle opt-out
        this.toggleBtn?.addEventListener('click', () => this.toggleOptOut());
    }

    sendMessage() {
        if (this.optedOut || !this.inputEl) return;

        const content = this.inputEl.value.trim();
        if (!content) return;

        // Clear input
        this.inputEl.value = '';

        // Notify parent
        if (this.options.onSendMessage) {
            this.options.onSendMessage(content);
        }
    }

    toggleOptOut() {
        this.optedOut = !this.optedOut;

        // Update UI
        if (this.toggleBtn) {
            this.toggleBtn.textContent = this.optedOut ? 'Muted' : 'Mute';
            this.toggleBtn.classList.toggle('roulette-chat__toggle--opted-out', this.optedOut);
        }

        if (this.inputEl) {
            this.inputEl.disabled = this.optedOut;
        }

        if (this.sendBtn) {
            this.sendBtn.disabled = this.optedOut;
        }

        // Notify parent
        if (this.options.onToggleOptOut) {
            this.options.onToggleOptOut(this.optedOut);
        }
    }

    addMessage(message) {
        // Remove empty state if present
        const emptyEl = this.messagesEl?.querySelector('.roulette-chat__empty');
        if (emptyEl) {
            emptyEl.remove();
        }

        // Add to messages array
        this.messages.push(message);

        // Trim old messages
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
            this.messagesEl?.querySelector('.roulette-chat__message')?.remove();
        }

        // Render message
        const messageHtml = this.renderMessage(message);
        this.messagesEl?.insertAdjacentHTML('beforeend', messageHtml);

        // Scroll to bottom
        this.scrollToBottom();
    }

    addSystemMessage(content) {
        this.addMessage({
            user_id: 0,
            username: 'System',
            avatar_id: null,
            content: content,
            timestamp: new Date().toISOString(),
            is_system: true,
        });
    }

    renderMessage(message) {
        const isSystem = message.is_system;
        const avatarContent = message.avatar_id
            ? `<img src="/api/v1/avatar/${message.avatar_id}" alt="${message.username}">`
            : this.getInitials(message.username);

        const time = this.formatTime(message.timestamp);

        return `
            <div class="roulette-chat__message ${isSystem ? 'roulette-chat__message--system' : ''}">
                <div class="roulette-chat__avatar">${avatarContent}</div>
                <div class="roulette-chat__content">
                    <div class="roulette-chat__username">${this.escapeHtml(message.username)}</div>
                    <div class="roulette-chat__text">${this.escapeHtml(message.content)}</div>
                    <div class="roulette-chat__time">${time}</div>
                </div>
            </div>
        `;
    }

    getInitials(name) {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    formatTime(timestamp) {
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        if (this.messagesEl) {
            this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        }
    }

    clear() {
        this.messages = [];
        if (this.messagesEl) {
            this.messagesEl.innerHTML = '<div class="roulette-chat__empty">No messages yet</div>';
        }
    }

    setOptedOut(optedOut) {
        this.optedOut = optedOut;
        this.render();
    }
}
