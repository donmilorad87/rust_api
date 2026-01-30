/**
 * Bet Manager Component
 *
 * Manages bet placement and tracking.
 * Users can place bets until 5 seconds remaining.
 * Tracks all 12 bet types supported by the roulette game.
 */

export class BetManager {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.balance = options.balance || 0;
        this.bets = [];
        this.currentBetAmount = 100; // Default bet: 1 coin = 100 balance
        this.disabled = false;

        // All 37 numbers (0, 00, 1-36 for American roulette)
        this.numbers = ['0', '00', ...Array.from({ length: 36 }, (_, i) => String(i + 1))];

        // Number colors
        this.redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        this.blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="bet-manager ${this.disabled ? 'bet-manager--disabled' : ''}">
                <div class="bet-manager__controls">
                    <div class="bet-manager__amount-selector">
                        <button class="bet-manager__chip" data-amount="100">1</button>
                        <button class="bet-manager__chip bet-manager__chip--selected" data-amount="500">5</button>
                        <button class="bet-manager__chip" data-amount="1000">10</button>
                        <button class="bet-manager__chip" data-amount="2500">25</button>
                        <button class="bet-manager__chip" data-amount="5000">50</button>
                        <button class="bet-manager__chip" data-amount="10000">100</button>
                    </div>
                    <button class="bet-manager__clear" id="clear-bets">Clear All</button>
                </div>

                <div class="bet-manager__table">
                    <!-- Quick bets row -->
                    <div class="bet-manager__quick-bets">
                        <button class="bet-manager__quick-bet" data-bet-type="red">Red</button>
                        <button class="bet-manager__quick-bet" data-bet-type="black">Black</button>
                        <button class="bet-manager__quick-bet" data-bet-type="odd">Odd</button>
                        <button class="bet-manager__quick-bet" data-bet-type="even">Even</button>
                        <button class="bet-manager__quick-bet" data-bet-type="low">1-18</button>
                        <button class="bet-manager__quick-bet" data-bet-type="high">19-36</button>
                    </div>

                    <!-- Dozens row -->
                    <div class="bet-manager__dozens">
                        <button class="bet-manager__dozen" data-bet-type="first_dozen">1st 12</button>
                        <button class="bet-manager__dozen" data-bet-type="second_dozen">2nd 12</button>
                        <button class="bet-manager__dozen" data-bet-type="third_dozen">3rd 12</button>
                    </div>

                    <!-- Columns row -->
                    <div class="bet-manager__columns">
                        <button class="bet-manager__column" data-bet-type="first_column">2:1</button>
                        <button class="bet-manager__column" data-bet-type="second_column">2:1</button>
                        <button class="bet-manager__column" data-bet-type="third_column">2:1</button>
                    </div>

                    <!-- Numbers grid -->
                    <div class="bet-manager__numbers-grid">
                        <button class="bet-manager__number bet-manager__number--green" data-number="0">0</button>
                        <button class="bet-manager__number bet-manager__number--green" data-number="00">00</button>
                        ${this.renderNumberButtons()}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderNumberButtons() {
        return Array.from({ length: 36 }, (_, i) => {
            const num = i + 1;
            const colorClass = this.redNumbers.includes(num) ? 'red' : 'black';
            return `<button class="bet-manager__number bet-manager__number--${colorClass}" data-number="${num}">${num}</button>`;
        }).join('');
    }

    attachEventListeners() {
        // Chip selection
        this.container.querySelectorAll('.bet-manager__chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                if (this.disabled) return;
                this.selectChip(e.target, parseInt(e.target.dataset.amount));
            });
        });

        // Clear bets
        document.getElementById('clear-bets')?.addEventListener('click', () => {
            if (this.disabled) return;
            this.clearBets();
        });

        // Quick bets
        this.container.querySelectorAll('.bet-manager__quick-bet').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.disabled) return;
                this.placeQuickBet(e.target.dataset.betType);
            });
        });

        // Dozen bets
        this.container.querySelectorAll('.bet-manager__dozen').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.disabled) return;
                this.placeBet(e.target.dataset.betType, this.getDozenNumbers(e.target.dataset.betType));
            });
        });

        // Column bets
        this.container.querySelectorAll('.bet-manager__column').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.disabled) return;
                this.placeBet(e.target.dataset.betType, this.getColumnNumbers(e.target.dataset.betType));
            });
        });

        // Number bets
        this.container.querySelectorAll('.bet-manager__number').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (this.disabled) return;
                this.placeBet('straight', [e.target.dataset.number]);
            });
        });
    }

    selectChip(element, amount) {
        this.container.querySelectorAll('.bet-manager__chip').forEach(chip => {
            chip.classList.remove('bet-manager__chip--selected');
        });
        element.classList.add('bet-manager__chip--selected');
        this.currentBetAmount = amount;
    }

    placeQuickBet(type) {
        let numbers = [];
        switch (type) {
            case 'red':
                numbers = this.redNumbers.map(String);
                break;
            case 'black':
                numbers = this.blackNumbers.map(String);
                break;
            case 'odd':
                numbers = Array.from({ length: 18 }, (_, i) => String(i * 2 + 1));
                break;
            case 'even':
                numbers = Array.from({ length: 18 }, (_, i) => String((i + 1) * 2));
                break;
            case 'low':
                numbers = Array.from({ length: 18 }, (_, i) => String(i + 1));
                break;
            case 'high':
                numbers = Array.from({ length: 18 }, (_, i) => String(i + 19));
                break;
        }
        this.placeBet(type, numbers);
    }

    getDozenNumbers(type) {
        switch (type) {
            case 'first_dozen':
                return Array.from({ length: 12 }, (_, i) => String(i + 1));
            case 'second_dozen':
                return Array.from({ length: 12 }, (_, i) => String(i + 13));
            case 'third_dozen':
                return Array.from({ length: 12 }, (_, i) => String(i + 25));
            default:
                return [];
        }
    }

    getColumnNumbers(type) {
        switch (type) {
            case 'first_column':
                return [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map(String);
            case 'second_column':
                return [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map(String);
            case 'third_column':
                return [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].map(String);
            default:
                return [];
        }
    }

    placeBet(betType, numbers) {
        // Check balance
        if (this.currentBetAmount > this.balance - this.getTotalBetAmount()) {
            this.showError('Insufficient balance');
            return;
        }

        // Check if bet already exists for same type and numbers
        const existingBetIndex = this.bets.findIndex(
            b => b.bet_type === betType && JSON.stringify(b.numbers.sort()) === JSON.stringify(numbers.sort())
        );

        if (existingBetIndex >= 0) {
            // Add to existing bet
            this.bets[existingBetIndex].amount += this.currentBetAmount;
        } else {
            // Create new bet
            this.bets.push({
                bet_type: betType,
                numbers: numbers,
                amount: this.currentBetAmount,
            });
        }

        this.notifyBetsChange();
    }

    clearBets() {
        this.bets = [];
        this.notifyBetsChange();
    }

    getBets() {
        return this.bets;
    }

    getTotalBetAmount() {
        return this.bets.reduce((total, bet) => total + bet.amount, 0);
    }

    setBalance(balance) {
        this.balance = balance;
    }

    setPendingBets(bets) {
        this.bets = bets || [];
        this.notifyBetsChange();
    }

    confirmBet(totalAmount) {
        // Bets are confirmed, disable further changes for this spin
        this.disable();
    }

    reset() {
        this.bets = [];
        this.notifyBetsChange();
    }

    enable() {
        this.disabled = false;
        this.container.querySelector('.bet-manager')?.classList.remove('bet-manager--disabled');
    }

    disable() {
        this.disabled = true;
        this.container.querySelector('.bet-manager')?.classList.add('bet-manager--disabled');
    }

    notifyBetsChange() {
        if (this.options.onBetsChange) {
            this.options.onBetsChange(this.bets);
        }
    }

    showError(message) {
        // Could show toast/notification here
        console.warn(message);
    }
}
