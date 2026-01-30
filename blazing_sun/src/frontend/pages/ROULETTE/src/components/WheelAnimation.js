/**
 * Wheel Animation Component
 *
 * Displays a spinning wheel animation when the spin result is determined.
 * Shows the winning number with color indication.
 */

export class WheelAnimation {
    constructor(container) {
        this.container = container;
        this.isSpinning = false;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="wheel-animation__wheel" id="wheel"></div>
            <div class="wheel-animation__ball" id="ball"></div>
            <div class="wheel-animation__result" id="result">
                <div class="wheel-animation__number" id="result-number"></div>
                <div class="wheel-animation__color" id="result-color"></div>
            </div>
        `;

        this.wheelEl = document.getElementById('wheel');
        this.ballEl = document.getElementById('ball');
        this.resultEl = document.getElementById('result');
        this.numberEl = document.getElementById('result-number');
        this.colorEl = document.getElementById('result-color');
    }

    spin(winningNumber, winningColor, onComplete) {
        if (this.isSpinning) return;
        this.isSpinning = true;

        // Show overlay
        this.container.classList.add('wheel-animation--active');

        // Calculate spin angle based on winning number
        const numberAngle = this.getNumberAngle(winningNumber);
        const totalSpins = 5; // Number of full rotations
        const finalAngle = (totalSpins * 360) + numberAngle;

        // Start wheel spin
        if (this.wheelEl) {
            this.wheelEl.style.transform = `rotate(${finalAngle}deg)`;
        }

        // Show result after animation
        setTimeout(() => {
            this.showResult(winningNumber, winningColor);
        }, 5000);

        // Complete and hide after showing result
        setTimeout(() => {
            this.hide();
            this.isSpinning = false;
            if (onComplete) onComplete();
        }, 8000);
    }

    getNumberAngle(number) {
        // American roulette wheel order
        const wheelOrder = [
            '0', '28', '9', '26', '30', '11', '7', '20', '32', '17', '5', '22',
            '34', '15', '3', '24', '36', '13', '1', '00', '27', '10', '25', '29',
            '12', '8', '19', '31', '18', '6', '21', '33', '16', '4', '23', '35',
            '14', '2'
        ];

        const index = wheelOrder.indexOf(String(number));
        if (index === -1) return 0;

        // Each pocket is 360/38 degrees
        const pocketAngle = 360 / 38;
        return index * pocketAngle;
    }

    showResult(number, color) {
        if (this.numberEl) {
            this.numberEl.textContent = number;
            this.numberEl.className = 'wheel-animation__number';

            if (color?.toLowerCase() === 'red') {
                this.numberEl.classList.add('wheel-animation__number--red');
            } else if (color?.toLowerCase() === 'green') {
                this.numberEl.classList.add('wheel-animation__number--green');
            }
        }

        if (this.colorEl) {
            this.colorEl.textContent = color || '';
        }

        if (this.resultEl) {
            this.resultEl.classList.add('wheel-animation__result--visible');
        }
    }

    hide() {
        this.container.classList.remove('wheel-animation--active');

        if (this.resultEl) {
            this.resultEl.classList.remove('wheel-animation__result--visible');
        }

        // Reset wheel rotation for next spin
        if (this.wheelEl) {
            this.wheelEl.style.transition = 'none';
            this.wheelEl.style.transform = 'rotate(0deg)';
            // Force reflow
            this.wheelEl.offsetHeight;
            this.wheelEl.style.transition = '';
        }
    }

    showPreview(number, color) {
        // For testing - show result without animation
        this.container.classList.add('wheel-animation--active');
        this.showResult(number, color);
    }
}
