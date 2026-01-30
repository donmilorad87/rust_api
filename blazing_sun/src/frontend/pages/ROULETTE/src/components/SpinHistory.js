/**
 * Spin History Component
 *
 * Displays a horizontal bar showing the last 20 winning numbers.
 * Each number is color-coded (red, black, green).
 */

export class SpinHistory {
    constructor(container, initialHistory = []) {
        this.container = container;
        this.history = initialHistory.slice(0, 20);
        this.maxItems = 20;

        this.render();
    }

    render() {
        const isEmpty = this.history.length === 0;

        this.container.innerHTML = `
            <div class="spin-history ${isEmpty ? 'spin-history--empty' : ''}">
                <div class="spin-history__header">
                    <span class="spin-history__title">Recent Results</span>
                    <span class="spin-history__count">${this.history.length} / ${this.maxItems}</span>
                </div>
                <div class="spin-history__bar" id="history-bar">
                    ${isEmpty ? this.renderEmpty() : this.renderItems()}
                </div>
            </div>
        `;

        this.barEl = document.getElementById('history-bar');
    }

    renderEmpty() {
        return '<span class="spin-history__empty-text">No spins yet</span>';
    }

    renderItems() {
        return this.history.map(spin => this.renderItem(spin)).join('');
    }

    renderItem(spin, isNew = false) {
        const colorClass = this.getColorClass(spin.winning_color);
        return `
            <div class="spin-history__item spin-history__item--${colorClass} ${isNew ? 'spin-history__item--new' : ''}"
                 title="${spin.winning_color}"
                 data-spin-id="${spin.spin_id}">
                ${spin.winning_number}
            </div>
        `;
    }

    getColorClass(color) {
        switch (color?.toLowerCase()) {
            case 'red':
                return 'red';
            case 'black':
                return 'black';
            case 'green':
                return 'green';
            default:
                return 'black';
        }
    }

    addSpin(spin) {
        // Add to beginning of array
        this.history.unshift(spin);

        // Keep only last maxItems
        if (this.history.length > this.maxItems) {
            this.history.pop();
        }

        // Update DOM
        if (this.barEl) {
            const isEmpty = this.barEl.querySelector('.spin-history__empty-text');
            if (isEmpty) {
                this.barEl.innerHTML = '';
            }

            // Insert new item at the beginning
            const newItemHtml = this.renderItem(spin, true);
            this.barEl.insertAdjacentHTML('afterbegin', newItemHtml);

            // Remove excess items
            const items = this.barEl.querySelectorAll('.spin-history__item');
            if (items.length > this.maxItems) {
                items[items.length - 1].remove();
            }

            // Update count
            const countEl = this.container.querySelector('.spin-history__count');
            if (countEl) {
                countEl.textContent = `${this.history.length} / ${this.maxItems}`;
            }
        }
    }

    setHistory(history) {
        this.history = history.slice(0, this.maxItems);
        this.render();
    }

    getHistory() {
        return this.history;
    }

    clear() {
        this.history = [];
        this.render();
    }
}
