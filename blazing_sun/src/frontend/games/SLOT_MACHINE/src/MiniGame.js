/**
 * MiniGame - Keno-style number betting for Slot Machine bonus round
 *
 * Game Rules:
 * - Player picks numbers from pool 1-30 (each number only once)
 * - Player assigns a bet amount to each picked number
 * - Bet amounts: 10, 50, 100, 200, 300, 500, 1000 coins
 * - 12 random numbers are drawn
 * - Each matched number pays: bet × 2.5 (40% probability)
 */
export default class MiniGame {
  // Payout odds (40% probability = 2.5x fair odds)
  static PAYOUT_ODDS = 2.5;
  static MATCH_PROBABILITY = 40;

  // Valid bet amounts
  static BET_AMOUNTS = [10, 50, 100, 200, 300, 500, 1000];

  constructor(shadowRoot, userCoins, onComplete) {
    this.shadowRoot = shadowRoot;
    this.userCoins = userCoins;
    this.onComplete = onComplete;

    // Game state
    this.numberBets = new Map(); // Map<number, betAmount>
    this.selectedBetAmount = 100; // Default bet amount
    this.drawnNumbers = [];
    this.results = null;
    this.isPlaying = false;

    // DOM references
    this.overlay = null;
  }

  /**
   * Show the mini-game overlay
   */
  show() {
    this.createOverlay();
    this.render();
  }

  /**
   * Hide and cleanup the mini-game
   */
  hide() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;

    if (this.onComplete) {
      this.onComplete(this.results);
    }
  }

  /**
   * Get total bet amount
   */
  getTotalBet() {
    let total = 0;
    for (const bet of this.numberBets.values()) {
      total += bet;
    }
    return total;
  }

  /**
   * Get remaining coins
   */
  getRemainingCoins() {
    return this.userCoins - this.getTotalBet();
  }

  /**
   * Create the overlay container
   */
  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'mini-game-overlay';
    this.overlay.innerHTML = `
      <div class="mini-game-header">
        <h1>MINI GAME BONUS</h1>
        <p>Izaberite brojeve (1-30) i postavite opklade. Svaki broj moze biti izabran samo jednom.</p>
        <div class="odds-info">
          <span class="probability">Verovatnoca: ${MiniGame.MATCH_PROBABILITY}%</span>
          <span class="multiplier">Isplata: ${MiniGame.PAYOUT_ODDS}x</span>
        </div>
      </div>
      <div class="mini-game-container">
        <div class="mini-game-left">
          <div class="balance-section">
            <div class="balance-display">
              <span class="label">Vasi novcici:</span>
              <span class="value" id="userCoinsDisplay">${this.userCoins}</span>
            </div>
            <div class="bet-display">
              <span class="label">Ukupna opklada:</span>
              <span class="value" id="totalBetDisplay">0</span>
            </div>
            <div class="remaining-display">
              <span class="label">Preostalo:</span>
              <span class="value" id="remainingCoinsDisplay">${this.userCoins}</span>
            </div>
          </div>
          <div class="drawn-numbers-section">
            <h3>Izvuceni brojevi (12)</h3>
            <div class="drawn-numbers" id="drawnNumbers"></div>
          </div>
          <div class="selected-numbers-section">
            <h3>Vasi izbori</h3>
            <div class="selected-numbers" id="selectedNumbers"></div>
          </div>
        </div>
        <div class="mini-game-right">
          <div class="bet-selector-section">
            <h3>Iznos opklade</h3>
            <div class="bet-chips" id="betChips"></div>
          </div>
          <div class="number-pool-section">
            <h3>Izaberite brojeve</h3>
            <div class="number-pool" id="numberPool"></div>
          </div>
          <div class="actions-section">
            <button class="mini-game-btn" id="clearAllBtn">Obrisi sve</button>
            <button class="mini-game-btn primary" id="playGameBtn" disabled>Zapocni Izvlacenje</button>
          </div>
        </div>
      </div>
      <div class="mini-game-results" id="resultsSection" style="display: none;">
        <div class="results-content" id="resultsContent"></div>
        <button class="mini-game-btn primary" id="continueBtn">Nastavi Igru</button>
      </div>
    `;

    // Add styles
    this.addStyles();

    // Find the slot machine container and append overlay
    const slotContainer = this.shadowRoot.querySelector('.slot-machine-container') ||
                          this.shadowRoot.querySelector('.slot-container') ||
                          this.shadowRoot.host;

    if (slotContainer) {
      slotContainer.appendChild(this.overlay);
    } else {
      this.shadowRoot.appendChild(this.overlay);
    }

    this.bindEvents();
  }

  /**
   * Add mini-game specific styles
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .mini-game-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        padding: 20px;
        overflow-y: auto;
        color: white;
        font-family: "Lucida Sans Unicode", "Lucida Grande", sans-serif;
      }

      .mini-game-header {
        text-align: center;
        margin-bottom: 20px;
      }

      .mini-game-header h1 {
        font-size: 2rem;
        color: #ffd700;
        margin-bottom: 10px;
        text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
      }

      .mini-game-header p {
        color: #ccc;
        font-size: 0.9rem;
      }

      .odds-info {
        display: flex;
        justify-content: center;
        gap: 30px;
        margin-top: 10px;
      }

      .odds-info span {
        background: linear-gradient(135deg, #667eea, #764ba2);
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.85rem;
      }

      .mini-game-container {
        display: grid;
        grid-template-columns: 350px 1fr;
        gap: 20px;
        max-width: 1200px;
        margin: 0 auto;
        flex: 1;
      }

      .mini-game-left, .mini-game-right {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }

      /* Balance Section */
      .balance-section {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 15px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .balance-display, .bet-display, .remaining-display {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .balance-display .label, .bet-display .label, .remaining-display .label {
        color: #aaa;
        font-size: 0.9rem;
      }

      .balance-display .value {
        color: #4ade80;
        font-size: 1.2rem;
        font-weight: bold;
      }

      .bet-display .value {
        color: #fbbf24;
        font-size: 1.2rem;
        font-weight: bold;
      }

      .remaining-display .value {
        color: #60a5fa;
        font-size: 1.2rem;
        font-weight: bold;
      }

      .remaining-display .value.warning {
        color: #f87171;
      }

      /* Bet Selector */
      .bet-selector-section h3, .number-pool-section h3,
      .drawn-numbers-section h3, .selected-numbers-section h3 {
        color: #ffd700;
        margin-bottom: 10px;
        font-size: 1rem;
      }

      .bet-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .bet-chip {
        background: linear-gradient(135deg, #1f2937, #374151);
        border: 2px solid #4b5563;
        border-radius: 20px;
        padding: 10px 18px;
        color: white;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.9rem;
      }

      .bet-chip:hover {
        background: linear-gradient(135deg, #374151, #4b5563);
        transform: translateY(-2px);
      }

      .bet-chip.selected {
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-color: #818cf8;
        box-shadow: 0 0 15px rgba(102, 126, 234, 0.5);
      }

      .bet-chip.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      /* Number Pool */
      .number-pool {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 8px;
      }

      .number-circle {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        background: linear-gradient(135deg, #1f2937, #374151);
        border: 2px solid #4b5563;
        color: white;
        font-size: 1rem;
      }

      .number-circle:hover:not(.selected):not(.disabled) {
        background: linear-gradient(135deg, #374151, #4b5563);
        transform: scale(1.1);
      }

      .number-circle.selected {
        background: linear-gradient(135deg, #10b981, #059669);
        border-color: #34d399;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
      }

      .number-circle.disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      .number-circle.drawn {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        border-color: #fcd34d;
      }

      .number-circle.matched {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        border-color: #4ade80;
        animation: pulse 0.5s;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
      }

      /* Selected Numbers */
      .selected-numbers {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        min-height: 50px;
        padding: 10px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 10px;
      }

      .selected-number-item {
        display: flex;
        align-items: center;
        gap: 5px;
        background: linear-gradient(135deg, #10b981, #059669);
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 0.85rem;
      }

      .selected-number-item .number {
        font-weight: bold;
      }

      .selected-number-item .bet {
        color: #fcd34d;
        font-size: 0.8rem;
      }

      .selected-number-item .remove {
        cursor: pointer;
        color: #fca5a5;
        font-weight: bold;
        margin-left: 5px;
      }

      .selected-number-item .remove:hover {
        color: #ef4444;
      }

      .selected-number-item.matched {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
      }

      /* Drawn Numbers */
      .drawn-numbers {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .drawn-circle {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid #4b5563;
        color: #666;
        font-size: 0.9rem;
      }

      .drawn-circle.revealed {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        border-color: #fcd34d;
        color: #1f2937;
      }

      .drawn-circle.animate {
        animation: popIn 0.3s ease-out;
      }

      @keyframes popIn {
        0% { transform: scale(0); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }

      /* Actions */
      .actions-section {
        display: flex;
        gap: 10px;
        margin-top: auto;
      }

      .mini-game-btn {
        flex: 1;
        padding: 15px 20px;
        border: none;
        border-radius: 10px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 1rem;
      }

      .mini-game-btn:not(.primary) {
        background: linear-gradient(135deg, #374151, #4b5563);
        color: white;
      }

      .mini-game-btn.primary {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
      }

      .mini-game-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
      }

      .mini-game-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      /* Results */
      .mini-game-results {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        padding: 30px;
        border-radius: 20px;
        border: 2px solid #ffd700;
        max-width: 500px;
        width: 90%;
        text-align: center;
      }

      .results-content h2 {
        color: #ffd700;
        margin-bottom: 20px;
      }

      .results-summary {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin-bottom: 20px;
      }

      .result-stat {
        background: rgba(255, 255, 255, 0.1);
        padding: 15px;
        border-radius: 10px;
      }

      .result-stat .label {
        color: #aaa;
        font-size: 0.85rem;
        margin-bottom: 5px;
      }

      .result-stat .value {
        font-size: 1.3rem;
        font-weight: bold;
      }

      .result-stat .value.positive {
        color: #4ade80;
      }

      .result-stat .value.negative {
        color: #f87171;
      }

      .result-stat .value.neutral {
        color: white;
      }

      .matched-numbers {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin: 20px 0;
      }

      .matched-number {
        background: linear-gradient(135deg, #22c55e, #16a34a);
        padding: 8px 15px;
        border-radius: 20px;
        font-weight: bold;
      }

      .matched-number .payout {
        color: #fcd34d;
        font-size: 0.85rem;
        margin-left: 5px;
      }

      @media (max-width: 768px) {
        .mini-game-container {
          grid-template-columns: 1fr;
        }

        .number-pool {
          grid-template-columns: repeat(5, 1fr);
        }

        .number-circle {
          width: 45px;
          height: 45px;
        }
      }
    `;
    this.overlay.appendChild(style);
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    const clearAllBtn = this.overlay.querySelector('#clearAllBtn');
    const playGameBtn = this.overlay.querySelector('#playGameBtn');
    const continueBtn = this.overlay.querySelector('#continueBtn');

    clearAllBtn.addEventListener('click', () => this.clearAll());
    playGameBtn.addEventListener('click', () => this.playGame());
    continueBtn.addEventListener('click', () => this.hide());
  }

  /**
   * Render the complete UI
   */
  render() {
    this.renderBetChips();
    this.renderNumberPool();
    this.renderSelectedNumbers();
    this.renderDrawnNumbers();
    this.updateDisplays();
  }

  /**
   * Render bet amount chips
   */
  renderBetChips() {
    const chipsContainer = this.overlay.querySelector('#betChips');
    chipsContainer.innerHTML = '';

    MiniGame.BET_AMOUNTS.forEach(amount => {
      const chip = document.createElement('div');
      chip.className = 'bet-chip';
      chip.textContent = amount;
      chip.dataset.amount = amount;

      if (amount === this.selectedBetAmount) {
        chip.classList.add('selected');
      }

      // Disable if user can't afford this bet
      if (amount > this.getRemainingCoins()) {
        chip.classList.add('disabled');
      } else {
        chip.addEventListener('click', () => this.selectBetAmount(amount));
      }

      chipsContainer.appendChild(chip);
    });
  }

  /**
   * Select a bet amount
   */
  selectBetAmount(amount) {
    if (this.isPlaying) return;
    if (amount > this.getRemainingCoins()) return;

    this.selectedBetAmount = amount;
    this.renderBetChips();
  }

  /**
   * Render the number pool (1-30)
   */
  renderNumberPool() {
    const poolContainer = this.overlay.querySelector('#numberPool');
    poolContainer.innerHTML = '';

    for (let num = 1; num <= 30; num++) {
      const circle = document.createElement('div');
      circle.className = 'number-circle';
      circle.textContent = num;
      circle.dataset.number = num;

      // Check if number is already selected
      if (this.numberBets.has(num)) {
        circle.classList.add('selected');
      }

      // Check if drawn
      if (this.drawnNumbers.includes(num)) {
        circle.classList.add('drawn');
        if (this.numberBets.has(num)) {
          circle.classList.add('matched');
        }
      }

      // Disable if can't afford any bet or already playing
      if (!this.isPlaying && !this.numberBets.has(num)) {
        const canAfford = this.selectedBetAmount <= this.getRemainingCoins();
        if (!canAfford) {
          circle.classList.add('disabled');
        } else {
          circle.addEventListener('click', () => this.toggleNumber(num));
        }
      } else if (!this.isPlaying && this.numberBets.has(num)) {
        circle.addEventListener('click', () => this.toggleNumber(num));
      }

      poolContainer.appendChild(circle);
    }
  }

  /**
   * Toggle number selection
   */
  toggleNumber(num) {
    if (this.isPlaying) return;

    if (this.numberBets.has(num)) {
      // Remove the bet
      this.numberBets.delete(num);
    } else {
      // Add new bet with selected amount
      if (this.selectedBetAmount <= this.getRemainingCoins()) {
        this.numberBets.set(num, this.selectedBetAmount);
      }
    }

    this.render();
  }

  /**
   * Render selected numbers with bets
   */
  renderSelectedNumbers() {
    const container = this.overlay.querySelector('#selectedNumbers');
    container.innerHTML = '';

    if (this.numberBets.size === 0) {
      container.innerHTML = '<span style="color: #666;">Nema izabranih brojeva</span>';
      return;
    }

    // Sort by number
    const sorted = Array.from(this.numberBets.entries()).sort((a, b) => a[0] - b[0]);

    sorted.forEach(([num, bet]) => {
      const item = document.createElement('div');
      item.className = 'selected-number-item';

      // Check if matched
      if (this.drawnNumbers.includes(num)) {
        item.classList.add('matched');
      }

      item.innerHTML = `
        <span class="number">${num}</span>
        <span class="bet">${bet}</span>
        ${!this.isPlaying ? '<span class="remove">×</span>' : ''}
      `;

      if (!this.isPlaying) {
        const removeBtn = item.querySelector('.remove');
        if (removeBtn) {
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.numberBets.delete(num);
            this.render();
          });
        }
      }

      container.appendChild(item);
    });
  }

  /**
   * Render the drawn numbers section (12 circles)
   */
  renderDrawnNumbers() {
    const drawnContainer = this.overlay.querySelector('#drawnNumbers');
    drawnContainer.innerHTML = '';

    for (let i = 0; i < 12; i++) {
      const circle = document.createElement('div');
      circle.className = 'drawn-circle';
      circle.id = `drawn-${i}`;

      if (this.drawnNumbers[i] !== undefined) {
        circle.textContent = this.drawnNumbers[i];
        circle.classList.add('revealed');
      }

      drawnContainer.appendChild(circle);
    }
  }

  /**
   * Update display values
   */
  updateDisplays() {
    const totalBetDisplay = this.overlay.querySelector('#totalBetDisplay');
    const remainingDisplay = this.overlay.querySelector('#remainingCoinsDisplay');
    const playBtn = this.overlay.querySelector('#playGameBtn');

    const totalBet = this.getTotalBet();
    const remaining = this.getRemainingCoins();

    totalBetDisplay.textContent = totalBet;
    remainingDisplay.textContent = remaining;

    // Add warning class if low on coins
    if (remaining < 100) {
      remainingDisplay.classList.add('warning');
    } else {
      remainingDisplay.classList.remove('warning');
    }

    // Enable play button if we have bets
    playBtn.disabled = this.numberBets.size === 0 || this.isPlaying;
  }

  /**
   * Clear all selections
   */
  clearAll() {
    if (this.isPlaying) return;
    this.numberBets.clear();
    this.render();
  }

  /**
   * Play the mini-game - send request to backend
   */
  async playGame() {
    if (this.isPlaying) return;
    if (this.numberBets.size === 0) {
      alert('Morate izabrati bar jedan broj!');
      return;
    }

    this.isPlaying = true;

    // Disable buttons during play
    const clearBtn = this.overlay.querySelector('#clearAllBtn');
    const playBtn = this.overlay.querySelector('#playGameBtn');
    clearBtn.disabled = true;
    playBtn.disabled = true;
    playBtn.textContent = 'Izvlacenje u toku...';

    try {
      const response = await this.sendRequest();

      if (response.success && response.data) {
        this.results = response.data;
        await this.animateDrawing(response.data.drawn_numbers);
        this.showResults(response.data);
      } else {
        throw new Error(response.message || 'Mini-game failed');
      }
    } catch (error) {
      console.error('[MiniGame] Error:', error);
      alert('Desila se greska: ' + error.message);
      this.isPlaying = false;
      clearBtn.disabled = false;
      playBtn.disabled = false;
      playBtn.textContent = 'Zapocni Izvlacenje';
    }
  }

  /**
   * Send mini-game request to backend
   */
  async sendRequest() {
    // Build bets array
    const bets = Array.from(this.numberBets.entries()).map(([number, bet]) => ({
      number,
      bet
    }));

    const payload = {
      action: 'slot_minigame',
      bets,
      user_coins: this.userCoins
    };

    const response = await fetch('/api/games/slot-machine', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    return response.json();
  }

  /**
   * Animate the drawing of 12 numbers
   */
  async animateDrawing(numbers) {
    const drawnContainer = this.overlay.querySelector('#drawnNumbers');

    for (let i = 0; i < numbers.length; i++) {
      await this.delay(600);

      const num = numbers[i];
      this.drawnNumbers.push(num);

      // Update the drawn circle
      const circle = drawnContainer.querySelector(`#drawn-${i}`);
      if (circle) {
        circle.textContent = num;
        circle.classList.add('revealed', 'animate');
      }

      // Highlight in number pool
      const poolCircle = this.overlay.querySelector(`.number-pool .number-circle[data-number="${num}"]`);
      if (poolCircle) {
        poolCircle.classList.add('drawn');
        if (this.numberBets.has(num)) {
          poolCircle.classList.add('matched');
        }
      }

      // Update selected numbers
      this.renderSelectedNumbers();
    }
  }

  /**
   * Show the results section
   */
  showResults(data) {
    const resultsSection = this.overlay.querySelector('#resultsSection');
    const resultsContent = this.overlay.querySelector('#resultsContent');

    // Update user coins display
    this.userCoins = data.new_balance;
    const coinsDisplay = this.overlay.querySelector('#userCoinsDisplay');
    if (coinsDisplay) {
      coinsDisplay.textContent = data.new_balance;
    }

    // Update balance display in parent (if available)
    const balanceDisplay = this.shadowRoot.querySelector('#kreditOkvir') ||
                           this.shadowRoot.querySelector('.balance-display');
    if (balanceDisplay) {
      balanceDisplay.textContent = data.new_balance;
    }

    // Build results HTML
    const netClass = data.net_result > 0 ? 'positive' : (data.net_result < 0 ? 'negative' : 'neutral');

    let matchedHtml = '';
    if (data.number_results) {
      const matched = data.number_results.filter(r => r.matched);
      if (matched.length > 0) {
        matchedHtml = `
          <div class="matched-numbers">
            ${matched.map(r => `
              <span class="matched-number">
                ${r.number} <span class="payout">+${r.payout}</span>
              </span>
            `).join('')}
          </div>
        `;
      }
    }

    resultsContent.innerHTML = `
      <h2>Rezultati</h2>
      <div class="results-summary">
        <div class="result-stat">
          <div class="label">Ukupna opklada</div>
          <div class="value neutral">${data.total_bet}</div>
        </div>
        <div class="result-stat">
          <div class="label">Ukupan dobitak</div>
          <div class="value positive">${data.total_payout}</div>
        </div>
        <div class="result-stat">
          <div class="label">Pogodjeno</div>
          <div class="value neutral">${data.matches_count} / ${this.numberBets.size}</div>
        </div>
        <div class="result-stat">
          <div class="label">Neto rezultat</div>
          <div class="value ${netClass}">${data.net_result > 0 ? '+' : ''}${data.net_result}</div>
        </div>
      </div>
      ${matchedHtml}
      <p style="color: #aaa; margin-top: 15px;">Novo stanje: <strong style="color: #4ade80;">${data.new_balance}</strong> novcica</p>
    `;

    resultsSection.style.display = 'block';
  }

  /**
   * Helper: delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get odds for display (static method)
   */
  static getOdds() {
    return {
      probability: this.MATCH_PROBABILITY,
      odds: this.PAYOUT_ODDS
    };
  }
}
