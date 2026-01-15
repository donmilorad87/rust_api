/**
 * GamesPage Controller (Lobby Only)
 *
 * Manages the games lobby via WebSocket connection.
 * Individual games are loaded on separate pages as web components.
 */

/**
 * WebSocket connection states
 */
const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting'
};

export class GamesPage {
  /**
   * Initialize the GamesPage controller
   * @param {Object} options Configuration options
   */
  constructor(options) {
    this.baseUrl = options.baseUrl;
    this.wsUrl = options.wsUrl;
    this.userId = options.userId;
    this.username = options.username;
    this.avatarId = options.avatarId;
    this.gamesContainer = options.gamesContainer;
    this.lobbySection = options.lobbySection;
    this.connectionStatus = options.connectionStatus;
    this.showToast = options.showToast || console.log;

    // Connection state
    this.connectionState = ConnectionState.DISCONNECTED;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;

    // Heartbeat
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.heartbeatIntervalMs = 30000;
    this.heartbeatTimeoutMs = 10000;

    // Room state
    this.availableRooms = [];

    // Bind methods
    this.handleMessage = this.handleMessage.bind(this);
    this.handleOpen = this.handleOpen.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);

    // Initialize
    this.init();
  }

  /**
   * Initialize the controller
   */
  init() {
    this.setupEventListeners();
    this.connect();
  }

  /**
   * Setup DOM event listeners
   */
  setupEventListeners() {
    // Create room button
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
      createRoomBtn.addEventListener('click', () => this.showCreateRoomModal());
    }

    // Empty state create button
    document.querySelectorAll('.create-room-trigger').forEach(btn => {
      btn.addEventListener('click', () => this.showCreateRoomModal());
    });

    // Retry connection button
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.reconnectAttempts = 0;
        this.connect();
      });
    }

    // Create room modal
    const createRoomModal = document.getElementById('createRoomModal');
    if (createRoomModal) {
      const createRoomForm = document.getElementById('createRoomForm');
      if (createRoomForm) {
        createRoomForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.createRoom();
        });
      }

      createRoomModal.querySelectorAll('.modal__close').forEach(btn => {
        btn.addEventListener('click', () => this.hideCreateRoomModal());
      });

      const overlay = createRoomModal.querySelector('.modal__overlay');
      if (overlay) {
        overlay.addEventListener('click', () => this.hideCreateRoomModal());
      }
    }
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.connectionState === ConnectionState.CONNECTING) {
      return;
    }

    this.setConnectionState(ConnectionState.CONNECTING);

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = this.wsUrl || `${wsProtocol}//${window.location.host}`;
      const url = `${wsHost}/ws/games`;

      this.ws = new WebSocket(url);
      this.ws.onopen = this.handleOpen;
      this.ws.onmessage = this.handleMessage;
      this.ws.onclose = this.handleClose;
      this.ws.onerror = this.handleError;
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open event
   */
  handleOpen() {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;
    this.startHeartbeat();
  }

  /**
   * Handle system welcome message
   */
  handleSystemWelcome(data) {
    console.log('Received welcome, connection_id:', data.connection_id);
    this.send({
      type: 'system.authenticate',
      user_id: String(this.userId),
      username: this.username || 'Guest',
      avatar_id: this.avatarId || null
    });
  }

  /**
   * Handle system authenticated message
   */
  handleSystemAuthenticated(data) {
    console.log('Authenticated as:', data.username);
    this.setConnectionState(ConnectionState.CONNECTED);
    this.requestRoomList();
    this.showToast('Connected to game server', 'success');
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'system.heartbeat' });
        this.heartbeatTimeout = setTimeout(() => {
          console.warn('Heartbeat timeout - closing connection');
          this.ws?.close();
        }, this.heartbeatTimeoutMs);
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Handle heartbeat response
   */
  handlePong() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  /**
   * Handle WebSocket message event
   */
  handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.log('Received:', message);

      switch (message.type) {
        case 'system.welcome':
          this.handleSystemWelcome(message);
          break;
        case 'system.authenticated':
          this.handleSystemAuthenticated(message);
          break;
        case 'system.error':
          this.handleError(message);
          break;
        case 'system.heartbeat_ack':
        case 'system.pong':
        case 'pong':
          this.handlePong();
          break;

        // Room messages
        case 'room_list':
        case 'games.event.room_list':
          this.handleRoomList(message.rooms);
          break;
        case 'room_created':
        case 'games.event.room_created':
          this.handleRoomCreated(message);
          break;
        case 'error':
        case 'games.event.error':
          this.handleError(message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  handleClose(event) {
    console.log('WebSocket closed:', event.code, event.reason);
    this.stopHeartbeat();
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.scheduleReconnect();
  }

  /**
   * Handle WebSocket error
   */
  handleError(error) {
    if (error.message) {
      this.showToast(error.message, 'error');
    } else {
      console.error('WebSocket error:', error);
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showToast('Unable to connect to game server', 'error');
      return;
    }

    this.setConnectionState(ConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => this.connect(), delay);
  }

  /**
   * Send a message to the WebSocket server
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  /**
   * Set connection state and update UI
   */
  setConnectionState(state) {
    this.connectionState = state;
    this.updateConnectionStatus();
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus() {
    if (!this.connectionStatus) return;

    const statusText = this.connectionStatus.querySelector('.connection-status__text');

    this.connectionStatus.classList.remove(
      'connection-status--disconnected',
      'connection-status--connecting',
      'connection-status--connected',
      'connection-status--reconnecting'
    );

    this.connectionStatus.classList.add(`connection-status--${this.connectionState}`);

    if (statusText) {
      const texts = {
        [ConnectionState.DISCONNECTED]: 'Disconnected',
        [ConnectionState.CONNECTING]: 'Connecting...',
        [ConnectionState.CONNECTED]: 'Connected',
        [ConnectionState.RECONNECTING]: 'Reconnecting...'
      };
      statusText.textContent = texts[this.connectionState] || 'Unknown';
    }

    this.updateLobbyUIState();
  }

  /**
   * Update lobby UI state (loading, error, empty, rooms)
   */
  updateLobbyUIState() {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const emptyState = document.getElementById('emptyState');
    const roomsGrid = document.getElementById('roomsGrid');

    if (loadingState) loadingState.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
    if (roomsGrid) roomsGrid.style.display = 'none';

    switch (this.connectionState) {
      case ConnectionState.CONNECTING:
      case ConnectionState.RECONNECTING:
        if (loadingState) loadingState.style.display = '';
        break;
      case ConnectionState.DISCONNECTED:
        if (errorState) errorState.style.display = '';
        break;
      case ConnectionState.CONNECTED:
        if (this.availableRooms.length === 0) {
          if (emptyState) emptyState.style.display = '';
        } else {
          if (roomsGrid) roomsGrid.style.display = '';
        }
        break;
    }
  }

  // ============================================
  // Room Management
  // ============================================

  /**
   * Request room list from server
   */
  requestRoomList() {
    this.send({ type: 'games.command.list_rooms' });
  }

  /**
   * Handle room list response
   */
  handleRoomList(rooms) {
    this.availableRooms = rooms || [];
    this.renderRoomList();
    this.updateLobbyUIState();
  }

  /**
   * Render the room list
   */
  renderRoomList() {
    const roomsGrid = document.getElementById('roomsGrid');
    if (!roomsGrid) return;

    if (this.availableRooms.length === 0) {
      roomsGrid.innerHTML = '';
      return;
    }

    roomsGrid.innerHTML = this.availableRooms.map(room => `
      <div class="room-card" data-room-id="${room.room_id}">
        <div class="room-card__header">
          <h3 class="room-card__name">${this.escapeHtml(room.room_name)}</h3>
          <span class="room-card__status room-card__status--${room.status}">${this.formatStatus(room.status)}</span>
        </div>
        <div class="room-card__info">
          <span class="room-card__game-type">${this.formatGameType(room.game_type)}</span>
          <span class="room-card__player-count">${room.players?.length || 0}/${room.max_players || 2} players</span>
        </div>
        <div class="room-card__players">
          ${(room.players || []).map(p => `
            <span class="player-badge ${p.is_ready ? 'player-badge--ready' : ''}">${this.escapeHtml(p.username)}</span>
          `).join('')}
        </div>
        <div class="room-card__actions">
          ${room.status === 'waiting' && (room.players?.length || 0) < (room.max_players || 2) ? `
            <button class="btn btn--primary btn--small" onclick="window.gamesController.joinRoom('${room.room_id}', '${room.game_type}')">
              Join Game
            </button>
          ` : ''}
          <button class="btn btn--secondary btn--small" onclick="window.gamesController.goToGame('${room.room_id}', '${room.game_type}')">
            ${room.status === 'waiting' ? 'Spectate' : 'Watch'}
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Show create room modal
   */
  showCreateRoomModal() {
    const modal = document.getElementById('createRoomModal');
    if (modal) {
      modal.classList.add('modal--active');
      modal.setAttribute('aria-hidden', 'false');

      const roomNameInput = document.getElementById('roomName');
      if (roomNameInput) {
        roomNameInput.value = '';
        roomNameInput.focus();
      }
    }
  }

  /**
   * Hide create room modal
   */
  hideCreateRoomModal() {
    const modal = document.getElementById('createRoomModal');
    if (modal) {
      modal.classList.remove('modal--active');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Create a new room
   */
  createRoom() {
    const roomNameInput = document.getElementById('roomName');
    const gameTypeSelect = document.getElementById('gameType');

    const roomName = roomNameInput?.value.trim() || `Room ${Date.now()}`;
    const gameType = gameTypeSelect?.value || 'bigger_dice';

    this.send({
      type: 'games.command.create_room',
      game_type: gameType,
      room_name: roomName
    });

    this.hideCreateRoomModal();
  }

  /**
   * Handle room created event
   */
  handleRoomCreated(data) {
    this.showToast(`Room "${data.room_name}" created!`, 'success');

    // If we created the room, navigate to the game page
    if (data.host_id === this.userId) {
      this.goToGame(data.room_id, data.game_type);
    }

    // Refresh room list
    this.requestRoomList();
  }

  /**
   * Join an existing room (navigate to game page)
   */
  joinRoom(roomId, gameType) {
    this.goToGame(roomId, gameType);
  }

  /**
   * Navigate to the game page
   */
  goToGame(roomId, gameType) {
    // Get the current language from the URL
    const pathParts = window.location.pathname.split('/').filter(p => p);
    const lang = pathParts[0] || 'en';

    // Map game type to route
    const gameRoutes = {
      'bigger_dice': 'bigger-dice'
    };

    const gameRoute = gameRoutes[gameType] || gameType;

    // Navigate to the game page
    window.location.href = `/${lang}/games/${gameRoute}/${roomId}`;
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Format game type for display
   */
  formatGameType(type) {
    const types = {
      'bigger_dice': 'Bigger Dice'
    };
    return types[type] || type;
  }

  /**
   * Format room status for display
   */
  formatStatus(status) {
    const statuses = {
      'waiting': 'Waiting',
      'in_progress': 'In Progress',
      'finished': 'Finished',
      'abandoned': 'Abandoned'
    };
    return statuses[status] || status;
  }
}
