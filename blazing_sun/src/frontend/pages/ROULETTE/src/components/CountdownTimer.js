/**
 * Countdown Timer Component
 *
 * Displays countdown with circular progress indicator.
 * - Large number showing seconds (120...0)
 * - Circular progress that depletes
 * - At 5 seconds: turns red, shows "NO MORE BETS"
 */

export class CountdownTimer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
        this.totalSeconds = 120;
        this.currentSeconds = 120;
        this.phase = 'betting';
        this.blockBets = false;
        this.circumference = 2 * Math.PI * 80; // radius = 80

        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="countdown-timer">
                <div class="countdown-timer__circle">
                    <svg viewBox="0 0 180 180">
                        <circle
                            class="countdown-timer__track"
                            cx="90"
                            cy="90"
                            r="80"
                        />
                        <circle
                            id="countdown-progress"
                            class="countdown-timer__progress"
                            cx="90"
                            cy="90"
                            r="80"
                            stroke-dasharray="${this.circumference}"
                            stroke-dashoffset="0"
                        />
                    </svg>
                    <div class="countdown-timer__content">
                        <div id="countdown-seconds" class="countdown-timer__seconds">${this.currentSeconds}</div>
                        <div id="countdown-label" class="countdown-timer__label">seconds</div>
                        <div id="countdown-blocked" class="countdown-timer__blocked-text" style="display: none;">NO MORE BETS</div>
                        <div id="countdown-phase" class="countdown-timer__phase">${this.getPhaseLabel()}</div>
                    </div>
                </div>
            </div>
        `;

        this.progressEl = document.getElementById('countdown-progress');
        this.secondsEl = document.getElementById('countdown-seconds');
        this.labelEl = document.getElementById('countdown-label');
        this.blockedEl = document.getElementById('countdown-blocked');
        this.phaseEl = document.getElementById('countdown-phase');
    }

    update(seconds, phase, blockBets) {
        this.currentSeconds = seconds;
        this.phase = phase;
        this.blockBets = blockBets;

        // Update seconds display
        if (this.secondsEl) {
            this.secondsEl.textContent = seconds;

            // Add danger class when blocking
            if (blockBets) {
                this.secondsEl.classList.add('countdown-timer__seconds--danger');
            } else {
                this.secondsEl.classList.remove('countdown-timer__seconds--danger');
            }
        }

        // Update progress circle
        if (this.progressEl) {
            const progress = seconds / this.totalSeconds;
            const offset = this.circumference * (1 - progress);
            this.progressEl.style.strokeDashoffset = offset;

            // Update color based on time remaining
            this.progressEl.classList.remove(
                'countdown-timer__progress--warning',
                'countdown-timer__progress--danger'
            );

            if (blockBets) {
                this.progressEl.classList.add('countdown-timer__progress--danger');
            } else if (seconds <= 30) {
                this.progressEl.classList.add('countdown-timer__progress--warning');
            }
        }

        // Show/hide blocked text
        if (this.blockedEl) {
            this.blockedEl.style.display = blockBets ? 'block' : 'none';
        }

        if (this.labelEl) {
            this.labelEl.style.display = blockBets ? 'none' : 'block';
        }

        // Update phase label
        if (this.phaseEl) {
            this.phaseEl.textContent = this.getPhaseLabel();
        }

        // Trigger callback when countdown completes
        if (seconds === 5 && this.options.onComplete) {
            this.options.onComplete();
        }
    }

    getPhaseLabel() {
        switch (this.phase) {
            case 'betting':
                return 'Place your bets';
            case 'animation':
                return 'No more bets';
            case 'spinning':
                return 'Spinning...';
            case 'payout':
                return 'Calculating payouts';
            default:
                return '';
        }
    }

    reset() {
        this.update(this.totalSeconds, 'betting', false);
    }
}
