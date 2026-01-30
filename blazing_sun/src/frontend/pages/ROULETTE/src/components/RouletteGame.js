/**
 * Multiplayer Roulette - Main Game Controller
 *
 * Orchestrates all components and manages WebSocket communication
 */

import { CountdownTimer } from './CountdownTimer.js';
import { SpinHistory } from './SpinHistory.js';
import { BetManager } from './BetManager.js';
import { WheelAnimation } from './WheelAnimation.js';
import { RouletteChat } from './RouletteChat.js';

export class RouletteGame {
    constructor(container) {
        this.container = container;
        this.ws = null;
        this.state = {
            spinId: null,
            secondsRemaining: 120,
            phase: 'betting',
            blockBets: false,
            connectedCount: 0,
            balance: 0,
            history: [],
            pendingBets: [],
        };

        this.components = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        this.init();
    }

    async init() {
        this.showLoading();
        await this.fetchInitialState();
        this.render();
        this.initComponents();
        this.connectWebSocket();
    }

    showLoading() {
        this.container.innerHTML = `
            <div class="roulette-loading">
                <div class="roulette-loading__spinner"></div>
                <div class="roulette-loading__text">Connecting to table...</div>
            </div>
        `;
    }

    async fetchInitialState() {
        try {
            const response = await fetch('/api/v1/roulette/multiplayer/state', {
                headers: {
                    'Authorization': `Bearer ${this.getToken()}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    this.state.history = data.data.history || [];
                    this.state.balance = data.data.balance || 0;
                }
            }
        } catch (error) {
            console.error('Failed to fetch initial state:', error);
        }
    }

    getToken() {
        // Get JWT token from storage
        return localStorage.getItem('jwt_token') || sessionStorage.getItem('jwt_token') || '';
    }

    render() {
        this.container.innerHTML = `
            <div class="roulette-multiplayer__header">
                <h1 class="roulette-multiplayer__title">Multiplayer Roulette</h1>
                <div class="roulette-multiplayer__balance">
                    <span class="balance-icon">&#9679;</span>
                    <span class="balance-amount">${this.formatBalance(this.state.balance)}</span>
                </div>
            </div>

            <div class="roulette-multiplayer__main">
                <div class="roulette-multiplayer__game-area">
                    <div id="spin-history"></div>
                    <div id="countdown-timer"></div>
                    <div id="status-message"></div>
                    <div class="roulette-multiplayer__betting-area">
                        <div id="betting-table"></div>
                        <div class="roulette-multiplayer__current-bets">
                            <div class="roulette-multiplayer__current-bets-header">
                                <span class="roulette-multiplayer__current-bets-title">Your Bets</span>
                                <span class="roulette-multiplayer__current-bets-total">Total: <span id="bet-total">0</span></span>
                            </div>
                            <div id="current-bets-list" class="roulette-multiplayer__current-bets-list"></div>
                        </div>
                    </div>
                </div>

                <div class="roulette-multiplayer__sidebar">
                    <div class="roulette-multiplayer__connected">
                        <span id="connected-count">${this.state.connectedCount}</span> players online
                    </div>
                    <div id="roulette-chat"></div>
                </div>
            </div>

            <div id="wheel-animation" class="wheel-animation"></div>
        `;
    }

    initComponents() {
        // Initialize countdown timer
        this.components.countdown = new CountdownTimer(
            document.getElementById('countdown-timer'),
            {
                onComplete: () => this.onCountdownComplete(),
            }
        );

        // Initialize spin history
        this.components.history = new SpinHistory(
            document.getElementById('spin-history'),
            this.state.history
        );

        // Initialize bet manager
        this.components.betManager = new BetManager(
            document.getElementById('betting-table'),
            {
                onBetsChange: (bets) => this.onBetsChange(bets),
                balance: this.state.balance,
            }
        );

        // Initialize wheel animation
        this.components.wheelAnimation = new WheelAnimation(
            document.getElementById('wheel-animation')
        );

        // Initialize chat
        this.components.chat = new RouletteChat(
            document.getElementById('roulette-chat'),
            {
                onSendMessage: (content) => this.sendChatMessage(content),
                onToggleOptOut: (optOut) => this.toggleChatOptOut(optOut),
            }
        );
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/roulette?token=${this.getToken()}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.sendCommand({ type: 'roulette.join' });
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Failed to parse message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.connectWebSocket(), delay);
        } else {
            this.showError('Connection lost. Please refresh the page.');
        }
    }

    sendCommand(command) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(command));
        }
    }

    handleMessage(data) {
        const type = data.type || data.event_type;

        switch (type) {
            case 'roulette.tick':
                this.handleTick(data);
                break;
            case 'roulette.state':
                this.handleState(data);
                break;
            case 'roulette.user_joined':
                this.handleUserJoined(data);
                break;
            case 'roulette.user_left':
                this.handleUserLeft(data);
                break;
            case 'roulette.bet_confirmed':
                this.handleBetConfirmed(data);
                break;
            case 'roulette.bet_rejected':
                this.handleBetRejected(data);
                break;
            case 'roulette.spin_result':
                this.handleSpinResult(data);
                break;
            case 'roulette.payout':
                this.handlePayout(data);
                break;
            case 'roulette.chat':
                this.handleChatMessage(data);
                break;
            case 'roulette.error':
                this.handleError(data);
                break;
        }
    }

    handleTick(data) {
        this.state.spinId = data.spin_id;
        this.state.secondsRemaining = data.seconds_remaining;
        this.state.phase = data.phase;
        this.state.blockBets = data.block_bets;
        this.state.connectedCount = data.connected_count;

        this.components.countdown.update(data.seconds_remaining, data.phase, data.block_bets);
        this.updateConnectedCount(data.connected_count);

        // Block betting UI when bets are blocked
        if (data.block_bets) {
            this.components.betManager.disable();
        }
    }

    handleState(data) {
        this.state.spinId = data.spin_id;
        this.state.secondsRemaining = data.seconds_remaining;
        this.state.phase = data.phase;
        this.state.blockBets = data.block_bets;
        this.state.connectedCount = data.connected_count;
        this.state.history = data.history || [];
        this.state.pendingBets = data.pending_bets || [];
        this.state.balance = data.balance;

        this.components.countdown.update(data.seconds_remaining, data.phase, data.block_bets);
        this.components.history.setHistory(data.history);
        this.components.betManager.setBalance(data.balance);
        this.updateConnectedCount(data.connected_count);
        this.updateBalanceDisplay(data.balance);

        if (data.pending_bets) {
            this.components.betManager.setPendingBets(data.pending_bets);
        }
    }

    handleUserJoined(data) {
        this.updateConnectedCount(data.connected_count);
        this.components.chat.addSystemMessage(`${data.username} joined the table`);
    }

    handleUserLeft(data) {
        this.updateConnectedCount(data.connected_count);
        this.components.chat.addSystemMessage(`${data.username} left the table`);
    }

    handleBetConfirmed(data) {
        this.showStatus('Bet confirmed!', 'success');
        this.updateBalanceDisplay(data.new_balance);
        this.components.betManager.confirmBet(data.total_amount);
    }

    handleBetRejected(data) {
        this.showStatus(`Bet rejected: ${data.reason}`, 'error');
        this.components.betManager.enable();
    }

    handleSpinResult(data) {
        // Add to history
        this.components.history.addSpin({
            spin_id: data.spin_id,
            winning_number: data.winning_number,
            winning_color: data.winning_color,
        });

        // Show wheel animation
        this.components.wheelAnimation.spin(
            data.winning_number,
            data.winning_color,
            () => {
                // Animation complete - reset for next round
                this.components.betManager.reset();
                this.components.betManager.enable();
            }
        );
    }

    handlePayout(data) {
        this.updateBalanceDisplay(data.new_balance);
        if (data.payout_amount > 0) {
            this.showStatus(`You won ${this.formatBalance(data.payout_amount)}!`, 'success');
        }
    }

    handleChatMessage(data) {
        this.components.chat.addMessage({
            user_id: data.user_id,
            username: data.username,
            avatar_id: data.avatar_id,
            content: data.content,
            timestamp: data.timestamp,
            is_system: data.is_system,
        });
    }

    handleError(data) {
        this.showError(data.message);
    }

    onCountdownComplete() {
        // Automatically broadcast bets when countdown completes
        if (!this.state.blockBets) {
            this.broadcastBets();
        }
    }

    onBetsChange(bets) {
        this.updateCurrentBetsDisplay(bets);
    }

    broadcastBets() {
        const bets = this.components.betManager.getBets();
        if (bets.length > 0) {
            this.sendCommand({
                type: 'roulette.broadcast_bets',
                spin_id: this.state.spinId,
                bets: bets,
            });
        }
    }

    sendChatMessage(content) {
        this.sendCommand({
            type: 'roulette.chat',
            content: content,
        });
    }

    toggleChatOptOut(optOut) {
        this.sendCommand({
            type: 'roulette.toggle_chat',
            opt_out: optOut,
        });
    }

    updateConnectedCount(count) {
        const el = document.getElementById('connected-count');
        if (el) {
            el.textContent = count;
        }
    }

    updateBalanceDisplay(balance) {
        this.state.balance = balance;
        const el = this.container.querySelector('.balance-amount');
        if (el) {
            el.textContent = this.formatBalance(balance);
        }
        this.components.betManager.setBalance(balance);
    }

    updateCurrentBetsDisplay(bets) {
        const list = document.getElementById('current-bets-list');
        const total = document.getElementById('bet-total');

        if (!list || !total) return;

        if (bets.length === 0) {
            list.innerHTML = '<div class="roulette-multiplayer__current-bets-empty">No bets placed</div>';
            total.textContent = '0';
            return;
        }

        let totalAmount = 0;
        list.innerHTML = bets.map(bet => {
            totalAmount += bet.amount;
            return `
                <div class="roulette-multiplayer__current-bets-item">
                    <span>${bet.bet_type}: ${bet.numbers.join(', ')}</span>
                    <span>${this.formatBalance(bet.amount)}</span>
                </div>
            `;
        }).join('');

        total.textContent = this.formatBalance(totalAmount);
    }

    showStatus(message, type = 'info') {
        const el = document.getElementById('status-message');
        if (el) {
            el.innerHTML = `<div class="roulette-status roulette-status--${type}">${message}</div>`;
            setTimeout(() => {
                el.innerHTML = '';
            }, 5000);
        }
    }

    showError(message) {
        this.showStatus(message, 'error');
    }

    formatBalance(amount) {
        // 100 balance = 1 coin
        const coins = amount / 100;
        return coins.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    destroy() {
        if (this.ws) {
            this.ws.close();
        }
    }
}
