//! WebSocket Server implementation

use std::net::SocketAddr;
use std::sync::Arc;
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use tracing::{debug, error, info, warn};
use chrono::Utc;

use crate::auth::{create_validator, SharedJwtValidator};
use crate::config::Config;
use crate::connection::{Connection, ConnectionManager, ConnectionState, SharedConnectionManager};
use crate::error::{GatewayError, GatewayResult};
use crate::kafka::{KafkaConsumer, KafkaProducer, SharedKafkaProducer};
use crate::protocol::{
    Actor, Audience, AudienceType, ClientMessage, EventEnvelope, ServerMessage,
};
use crate::redis_client::{RedisManager, SharedRedisManager};

/// WebSocket Server
pub struct WebSocketServer {
    config: Config,
    connections: SharedConnectionManager,
    redis: SharedRedisManager,
    kafka_producer: SharedKafkaProducer,
    jwt_validator: SharedJwtValidator,
}

impl WebSocketServer {
    /// Create a new WebSocket server
    pub async fn new(config: Config) -> GatewayResult<Self> {
        info!("Initializing WebSocket Server...");

        // Initialize Redis
        let redis = Arc::new(RedisManager::new(&config.redis_url).await?);
        info!("Redis connection established");

        // Initialize Kafka producer
        let kafka_producer = Arc::new(KafkaProducer::new(&config.kafka_brokers)?);
        info!("Kafka producer initialized");

        // Initialize JWT validator
        let jwt_validator = create_validator(&config.jwt_public_key_path)?;
        info!("JWT validator initialized");

        // Initialize connection manager
        let connections = Arc::new(ConnectionManager::new());

        // Start Kafka consumer in background
        let (consumer, mut event_rx) = KafkaConsumer::new(
            &config.kafka_brokers,
            &config.kafka_consumer_group,
        )?;

        let connections_clone = connections.clone();
        let redis_clone = redis.clone();

        tokio::spawn(async move {
            // Handle events from Kafka
            tokio::spawn(async move {
                while let Ok(event) = event_rx.recv().await {
                    Self::handle_kafka_event(&connections_clone, &redis_clone, event).await;
                }
            });

            // Start consuming
            if let Err(e) = consumer.start().await {
                error!("Kafka consumer error: {}", e);
            }
        });

        info!("WebSocket Server initialized");

        Ok(Self {
            config,
            connections,
            redis,
            kafka_producer,
            jwt_validator,
        })
    }

    /// Handle an incoming connection
    pub async fn handle_connection(
        &self,
        stream: TcpStream,
        addr: SocketAddr,
    ) -> GatewayResult<()> {
        debug!("New connection from {}", addr);

        // Upgrade to WebSocket
        let ws_stream = accept_async(stream).await?;
        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

        // Create message channel for this connection
        let (tx, mut rx) = mpsc::unbounded_channel::<ServerMessage>();

        // Create connection object
        let mut connection = Connection::new(
            addr,
            tx.clone(),
            self.config.rate_limit_messages_per_sec,
            self.config.rate_limit_burst,
        );

        let connection_id = connection.id().to_string();
        info!("WebSocket connected: {} from {}", connection_id, addr);

        // Register connection
        self.connections.register(&connection_id, None, tx);

        // Send welcome message
        let welcome = ServerMessage::Welcome {
            connection_id: connection_id.clone(),
            timestamp: Utc::now(),
        };
        if let Err(e) = ws_sender.send(Message::Text(serde_json::to_string(&welcome)?)).await {
            error!("Failed to send welcome: {}", e);
            self.connections.unregister(&connection_id, None);
            return Err(GatewayError::WebSocket(e));
        }

        // Spawn task to forward outgoing messages
        let mut outgoing_rx = rx;
        let send_task = tokio::spawn(async move {
            while let Some(msg) = outgoing_rx.recv().await {
                if let Ok(json) = serde_json::to_string(&msg) {
                    if ws_sender.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
            }
        });

        // Process incoming messages
        let result = self
            .process_messages(&mut connection, &mut ws_receiver)
            .await;

        // Cleanup
        let user_id = connection.user_id().map(String::from);
        self.connections.unregister(&connection_id, user_id.as_deref());

        if let Some(uid) = &user_id {
            let rooms = connection.rooms.clone();
            if !rooms.is_empty() {
                for room_id in rooms {
                    if room_id.starts_with("spectators:") {
                        continue;
                    }
                    let envelope = EventEnvelope::new(
                        "games.command.player_disconnected",
                        Actor {
                            user_id: uid.clone(),
                            username: connection.username().map(String::from),
                            roles: connection.user.as_ref().map(|u| u.roles.clone()).unwrap_or_default(),
                        },
                        Audience {
                            audience_type: AudienceType::Room,
                            user_ids: vec![],
                            room_id: Some(room_id.clone()),
                            game_id: None,
                        },
                        serde_json::json!({
                            "room_id": room_id,
                        }),
                    );

                    if let Err(e) = self.kafka_producer.publish_games_command(&room_id, &envelope).await {
                        warn!("Failed to publish disconnect command: {}", e);
                    }
                }
            }

            if let Err(e) = self.redis.unregister_socket(&connection_id).await {
                warn!("Failed to unregister socket from Redis: {}", e);
            }

            // Publish disconnect event
            let envelope = EventEnvelope::new(
                "system.event.user_disconnected",
                Actor {
                    user_id: uid.clone(),
                    username: connection.username().map(String::from),
                    roles: connection.user.as_ref().map(|u| u.roles.clone()).unwrap_or_default(),
                },
                Audience {
                    audience_type: AudienceType::Broadcast,
                    user_ids: vec![],
                    room_id: None,
                    game_id: None,
                },
                serde_json::json!({
                    "connection_id": connection_id,
                }),
            );

            if let Err(e) = self.kafka_producer.publish_system_event(uid, &envelope).await {
                warn!("Failed to publish disconnect event: {}", e);
            }
        }

        // Abort send task
        send_task.abort();

        info!("WebSocket disconnected: {} from {}", connection_id, addr);

        result
    }

    /// Process incoming messages from a connection
    async fn process_messages(
        &self,
        connection: &mut Connection,
        receiver: &mut futures_util::stream::SplitStream<
            tokio_tungstenite::WebSocketStream<TcpStream>,
        >,
    ) -> GatewayResult<()> {
        while let Some(msg) = receiver.next().await {
            match msg {
                Ok(Message::Text(text)) => {
                    // Check rate limit
                    if !connection.check_rate_limit() {
                        let error = ServerMessage::Error {
                            code: "RATE_LIMIT".to_string(),
                            message: "Rate limit exceeded".to_string(),
                        };
                        connection.send(error);
                        continue;
                    }

                    // Parse and handle message
                    match serde_json::from_str::<ClientMessage>(&text) {
                        Ok(client_msg) => {
                            if let Err(e) = self.handle_client_message(connection, client_msg).await {
                                warn!("Error handling message: {}", e);
                                let error = ServerMessage::Error {
                                    code: "MESSAGE_ERROR".to_string(),
                                    message: e.to_string(),
                                };
                                connection.send(error);
                            }
                        }
                        Err(e) => {
                            warn!("Invalid message format: {}", e);
                            let error = ServerMessage::Error {
                                code: "INVALID_FORMAT".to_string(),
                                message: "Invalid message format".to_string(),
                            };
                            connection.send(error);
                        }
                    }
                }
                Ok(Message::Ping(data)) => {
                    // Respond to ping with pong
                    connection.touch();
                }
                Ok(Message::Close(_)) => {
                    debug!("Connection {} closing", connection.id());
                    break;
                }
                Err(e) => {
                    error!("WebSocket error: {}", e);
                    break;
                }
                _ => {}
            }
        }

        Ok(())
    }

    /// Handle a client message
    async fn handle_client_message(
        &self,
        connection: &mut Connection,
        message: ClientMessage,
    ) -> GatewayResult<()> {
        connection.touch();

        match message {
            ClientMessage::Authenticate { token, user_id, username, avatar_id } => {
                self.handle_authenticate(connection, token, user_id, username, avatar_id).await
            }
            ClientMessage::Heartbeat => {
                self.handle_heartbeat(connection).await
            }
            ClientMessage::SyncState => {
                self.handle_sync_state(connection).await
            }
            // All other messages require authentication
            _ => {
                if !connection.is_authenticated() {
                    return Err(GatewayError::NotAuthenticated);
                }

                match message {
                    // Chat commands
                    ClientMessage::ChatSendMessage { recipient_id, content } => {
                        self.forward_chat_command(connection, "chat.command.send_message", serde_json::json!({
                            "recipient_id": recipient_id,
                            "content": content,
                        })).await
                    }
                    ClientMessage::ChatSendLobbyMessage { lobby_id, content } => {
                        self.forward_chat_command(connection, "chat.command.send_lobby_message", serde_json::json!({
                            "lobby_id": lobby_id,
                            "content": content,
                        })).await
                    }
                    ClientMessage::ChatTyping { recipient_id } => {
                        self.forward_chat_command(connection, "chat.command.typing", serde_json::json!({
                            "recipient_id": recipient_id,
                        })).await
                    }
                    ClientMessage::ChatMarkRead { message_ids } => {
                        self.forward_chat_command(connection, "chat.command.mark_read", serde_json::json!({
                            "message_ids": message_ids,
                        })).await
                    }

                    // Game commands
                    ClientMessage::GameCreateRoom { game_type, room_name, password, max_players, allow_spectators } => {
                        let mut payload = serde_json::json!({
                            "game_type": game_type,
                            "room_name": room_name,
                        });
                        if let Some(pwd) = password {
                            payload["password"] = serde_json::json!(pwd);
                        }
                        if let Some(mp) = max_players {
                            payload["max_players"] = serde_json::json!(mp);
                        }
                        if let Some(as_) = allow_spectators {
                            payload["allow_spectators"] = serde_json::json!(as_);
                        }
                        self.forward_games_command(connection, "games.command.create_room", payload).await
                    }
                    ClientMessage::GameJoinRoom { room_name, password } => {
                        let mut payload = serde_json::json!({
                            "room_name": room_name,
                        });
                        if let Some(pwd) = password {
                            payload["password"] = serde_json::json!(pwd);
                        }
                        self.forward_games_command(connection, "games.command.join_room", payload).await
                    }
                    ClientMessage::GameLeaveRoom { room_id } => {
                        self.forward_games_command(connection, "games.command.leave_room", serde_json::json!({
                            "room_id": room_id,
                        })).await
                    }
                    ClientMessage::GameSpectate { room_id } => {
                        self.forward_games_command(connection, "games.command.spectate", serde_json::json!({
                            "room_id": room_id,
                        })).await
                    }
                    ClientMessage::GameStopSpectating { room_id } => {
                        self.forward_games_command(connection, "games.command.stop_spectating", serde_json::json!({
                            "room_id": room_id,
                        })).await
                    }
                    ClientMessage::GamePlayerChat { room_id, content } => {
                        self.forward_games_command(connection, "games.command.player_chat", serde_json::json!({
                            "room_id": room_id,
                            "content": content,
                        })).await
                    }
                    ClientMessage::GameSpectatorChat { room_id, content } => {
                        self.forward_games_command(connection, "games.command.spectator_chat", serde_json::json!({
                            "room_id": room_id,
                            "content": content,
                        })).await
                    }

                    // Admin/host player management commands
                    ClientMessage::GameSelectPlayer { room_id, target_user_id } => {
                        self.forward_games_command(connection, "games.command.select_player", serde_json::json!({
                            "room_id": room_id,
                            "target_user_id": target_user_id,
                        })).await
                    }
                    ClientMessage::GameKickPlayer { room_id, target_user_id } => {
                        self.forward_games_command(connection, "games.command.kick_player", serde_json::json!({
                            "room_id": room_id,
                            "target_user_id": target_user_id,
                        })).await
                    }
                    ClientMessage::GameVoteKickDisconnected { room_id, target_user_id } => {
                        self.forward_games_command(connection, "games.command.vote_kick_disconnected", serde_json::json!({
                            "room_id": room_id,
                            "target_user_id": target_user_id,
                        })).await
                    }
                    ClientMessage::GameBanPlayer { room_id, target_user_id } => {
                        self.forward_games_command(connection, "games.command.ban_player", serde_json::json!({
                            "room_id": room_id,
                            "target_user_id": target_user_id,
                        })).await
                    }
                    ClientMessage::GameUnbanPlayer { room_id, target_user_id } => {
                        self.forward_games_command(connection, "games.command.unban_player", serde_json::json!({
                            "room_id": room_id,
                            "target_user_id": target_user_id,
                        })).await
                    }

                    // Bigger Dice commands
                    ClientMessage::BiggerDiceRoll { room_id } => {
                        self.forward_games_command(connection, "games.command.bigger_dice.roll", serde_json::json!({
                            "room_id": room_id,
                        })).await
                    }

                    // Auto-roll for kicked player (frontend fallback)
                    ClientMessage::BiggerDiceAutoRoll { room_id, target_user_id } => {
                        self.forward_games_command(connection, "games.command.bigger_dice.auto_roll", serde_json::json!({
                            "room_id": room_id,
                            "target_user_id": target_user_id,
                        })).await
                    }

                    // Enable auto-play for self (voluntary)
                    ClientMessage::BiggerDiceEnableAutoPlay { room_id } => {
                        self.forward_games_command(connection, "games.command.bigger_dice.enable_auto_play", serde_json::json!({
                            "room_id": room_id,
                        })).await
                    }

                    // Tic Tac Toe commands
                    ClientMessage::TicTacToeMove { room_id, position } => {
                        self.forward_games_command(connection, "games.command.tic_tac_toe.move", serde_json::json!({
                            "room_id": room_id,
                            "position": position,
                        })).await
                    }

                    // List rooms command - forward to blazing_sun via Kafka
                    ClientMessage::GameListRooms { game_type } => {
                        self.forward_games_command(connection, "games.command.list_rooms", serde_json::json!({
                            "game_type": game_type,
                        })).await
                    }

                    // Ready command
                    ClientMessage::GameReady { room_id } => {
                        self.forward_games_command(connection, "games.command.ready", serde_json::json!({
                            "room_id": room_id,
                        })).await
                    }

                    // Rejoin room command
                    ClientMessage::GameRejoinRoom { room_id, room_name } => {
                        let mut payload = serde_json::json!({});
                        if let Some(id) = room_id {
                            payload["room_id"] = serde_json::json!(id);
                        }
                        if let Some(name) = room_name {
                            payload["room_name"] = serde_json::json!(name);
                        }
                        self.forward_games_command(connection, "games.command.rejoin_room", payload).await
                    }

                    // ========== Enhanced Game Room Commands ==========

                    // Send chat message
                    ClientMessage::GameSendChat { room_id, channel, content } => {
                        self.forward_games_command(connection, "games.command.send_chat", serde_json::json!({
                            "room_id": room_id,
                            "channel": channel,
                            "content": content,
                        })).await
                    }

                    // Get chat history
                    ClientMessage::GameGetChatHistory { room_id, channel, limit } => {
                        self.forward_games_command(connection, "games.command.get_chat_history", serde_json::json!({
                            "room_id": room_id,
                            "channel": channel,
                            "limit": limit,
                        })).await
                    }

                    // Set ready status
                    ClientMessage::GameSetReady { room_id, is_ready } => {
                        self.forward_games_command(connection, "games.command.set_ready", serde_json::json!({
                            "room_id": room_id,
                            "is_ready": is_ready,
                        })).await
                    }

                    // Start game
                    ClientMessage::GameStartGame { room_id } => {
                        self.forward_games_command(connection, "games.command.start_game", serde_json::json!({
                            "room_id": room_id,
                        })).await
                    }

                    // Deselect player
                    ClientMessage::GameDeselectPlayer { room_id, target_user_id } => {
                        self.forward_games_command(connection, "games.command.deselect_player", serde_json::json!({
                            "room_id": room_id,
                            "target_user_id": target_user_id,
                        })).await
                    }

                    // Designate admin spectator
                    ClientMessage::GameDesignateAdminSpectator { room_id, target_user_id } => {
                        self.forward_games_command(connection, "games.command.designate_admin_spectator", serde_json::json!({
                            "room_id": room_id,
                            "target_user_id": target_user_id,
                        })).await
                    }

                    // Join as spectator
                    ClientMessage::GameJoinAsSpectator { room_name, password } => {
                        let mut payload = serde_json::json!({
                            "room_name": room_name,
                        });
                        if let Some(pwd) = password {
                            payload["password"] = serde_json::json!(pwd);
                        }
                        self.forward_games_command(connection, "games.command.join_as_spectator", payload).await
                    }

                    // Mute user
                    ClientMessage::GameMuteUser { room_id, target_user_id } => {
                        self.forward_games_command(connection, "games.command.mute_user", serde_json::json!({
                            "room_id": room_id,
                            "target_user_id": target_user_id,
                        })).await
                    }

                    // Unmute user
                    ClientMessage::GameUnmuteUser { room_id, target_user_id } => {
                        self.forward_games_command(connection, "games.command.unmute_user", serde_json::json!({
                            "room_id": room_id,
                            "target_user_id": target_user_id,
                        })).await
                    }

                    _ => Ok(())
                }
            }
        }
    }

    /// Handle authentication
    async fn handle_authenticate(
        &self,
        connection: &mut Connection,
        token: Option<String>,
        user_id_opt: Option<String>,
        username_opt: Option<String>,
        _avatar_id: Option<String>,
    ) -> GatewayResult<()> {
        debug!("Authenticating connection {}", connection.id());

        let (user_id, username, roles): (String, String, Vec<String>);

        // Try token-based auth first
        if let Some(token) = token {
            if !token.is_empty() {
                let user = self.jwt_validator.validate(&token)?;
                user_id = user.user_id.clone();
                username = user.username.clone();
                roles = user.roles.clone();

                // Update connection state
                connection.authenticate(user);
            } else {
                return Err(GatewayError::NotAuthenticated);
            }
        }
        // Fall back to credential-based auth (development mode)
        else if let (Some(uid), Some(uname)) = (user_id_opt, username_opt) {
            if uid.is_empty() || uid == "0" {
                return Err(GatewayError::NotAuthenticated);
            }

            user_id = uid;
            username = uname;
            roles = vec!["user".to_string()];

            // Create a basic user for credential-based auth
            let user = crate::auth::AuthenticatedUser {
                user_id: user_id.clone(),
                username: username.clone(),
                email: None,
                roles: roles.clone(),
                permission_level: 1,
            };
            connection.authenticate(user);
        } else {
            return Err(GatewayError::NotAuthenticated);
        }

        // Update connection manager
        self.connections.set_user(connection.id(), &user_id);

        // Register in Redis
        self.redis
            .register_socket(connection.id(), &user_id, &username, roles.clone())
            .await?;

        // Send authenticated response
        let response = ServerMessage::Authenticated {
            user_id: user_id.clone(),
            username: username.clone(),
            roles: roles.clone(),
            timestamp: Utc::now(),
        };
        connection.send(response);

        // Publish connect event
        let envelope = EventEnvelope::new(
            "system.event.user_connected",
            Actor {
                user_id: user_id.clone(),
                username: Some(username.clone()),
                roles: roles.clone(),
            },
            Audience {
                audience_type: AudienceType::Broadcast,
                user_ids: vec![],
                room_id: None,
                game_id: None,
            },
            serde_json::json!({
                "connection_id": connection.id(),
            }),
        );

        self.kafka_producer.publish_system_event(&user_id, &envelope).await?;

        info!("Connection {} authenticated as user {} ({})", connection.id(), user_id, username);
        Ok(())
    }

    /// Handle list rooms request - returns empty list for now
    /// The game service will push room updates via Kafka events
    async fn handle_list_rooms(
        &self,
        connection: &mut Connection,
        _game_type: Option<String>,
    ) -> GatewayResult<()> {
        // For now, return an empty room list
        // In a full implementation, this would query Redis or a game service
        let response = ServerMessage::GameRoomList {
            rooms: vec![],
        };
        connection.send(response);
        Ok(())
    }

    /// Handle heartbeat
    async fn handle_heartbeat(&self, connection: &mut Connection) -> GatewayResult<()> {
        connection.touch();

        if connection.is_authenticated() {
            self.redis.update_heartbeat(connection.id()).await?;
        }

        let response = ServerMessage::HeartbeatAck {
            timestamp: Utc::now(),
        };
        connection.send(response);

        Ok(())
    }

    /// Handle state sync request
    async fn handle_sync_state(&self, connection: &mut Connection) -> GatewayResult<()> {
        if !connection.is_authenticated() {
            return Err(GatewayError::NotAuthenticated);
        }

        // TODO: Implement full state sync
        // For now, send empty state
        let response = ServerMessage::StateSnapshot {
            active_rooms: connection.rooms.clone(),
            game_states: serde_json::json!({}),
            unread_messages: 0,
        };
        connection.send(response);

        Ok(())
    }

    /// Forward a chat command to Kafka
    async fn forward_chat_command(
        &self,
        connection: &mut Connection,
        command_type: &str,
        payload: serde_json::Value,
    ) -> GatewayResult<()> {
        let user = connection.user.as_ref().ok_or(GatewayError::NotAuthenticated)?;

        let envelope = EventEnvelope::new(
            command_type,
            Actor {
                user_id: user.user_id.clone(),
                username: Some(user.username.clone()),
                roles: user.roles.clone(),
            },
            Audience {
                audience_type: AudienceType::User,
                user_ids: vec![],
                room_id: None,
                game_id: None,
            },
            payload,
        );

        self.kafka_producer.publish_chat_command(&user.user_id, &envelope).await
    }

    /// Forward a games command to Kafka
    async fn forward_games_command(
        &self,
        connection: &mut Connection,
        command_type: &str,
        payload: serde_json::Value,
    ) -> GatewayResult<()> {
        let user = connection.user.as_ref().ok_or(GatewayError::NotAuthenticated)?;

        // Extract room_id from payload for partitioning (clone to avoid borrow issues)
        let room_id = payload.get("room_id")
            .and_then(|v| v.as_str())
            .map(String::from);

        let key = room_id.as_deref().unwrap_or(&user.user_id);

        let envelope = EventEnvelope::new(
            command_type,
            Actor {
                user_id: user.user_id.clone(),
                username: Some(user.username.clone()),
                roles: user.roles.clone(),
            },
            Audience {
                audience_type: AudienceType::Room,
                user_ids: vec![],
                room_id: room_id.clone(),
                game_id: None,
            },
            payload,
        );

        self.kafka_producer.publish_games_command(key, &envelope).await
    }

    /// Handle an event received from Kafka
    async fn handle_kafka_event(
        connections: &ConnectionManager,
        _redis: &RedisManager,
        event: crate::kafka::KafkaEvent,
    ) {
        let envelope = event.envelope;

        debug!(
            "Processing Kafka event: type={}, audience={:?}, user_ids={:?}",
            envelope.event_type, envelope.audience.audience_type, envelope.audience.user_ids
        );

        // Route based on audience
        match envelope.audience.audience_type {
            AudienceType::User => {
                // Send to specific users
                if envelope.audience.user_ids.is_empty() {
                    warn!("User audience but no user_ids specified for event: {}", envelope.event_type);
                }
                for user_id in &envelope.audience.user_ids {
                    debug!("Attempting to send {} to user {}", envelope.event_type, user_id);
                    if let Ok(Some(message)) = Self::envelope_to_server_message(&envelope) {
                        // Register user connections in room for room_state, room_created, lobby_joined events
                        // Support both unprefixed and game-prefixed event types
                        let is_join_event = envelope.event_type == "games.event.room_state"
                            || envelope.event_type.ends_with(".room_state")
                            || envelope.event_type == "games.event.room_created"
                            || envelope.event_type.ends_with(".room_created")
                            || envelope.event_type == "games.event.player_rejoined"
                            || envelope.event_type.ends_with(".player_rejoined")
                            || envelope.event_type == "games.event.lobby_joined"
                            || envelope.event_type.ends_with(".lobby_joined")
                            || envelope.event_type == "games.event.spectator_data_joined"
                            || envelope.event_type.ends_with(".spectator_data_joined");

                        if is_join_event {
                            // Extract room_id from payload
                            let room_id = if envelope.event_type == "games.event.room_state"
                                || envelope.event_type.ends_with(".room_state")
                            {
                                envelope.payload.get("room")
                                    .and_then(|r| r.get("room_id"))
                                    .and_then(|v| v.as_str())
                            } else {
                                envelope.payload.get("room_id").and_then(|v| v.as_str())
                            };

                            if let Some(room_id) = room_id {
                                // Get user's connections and register them in the room
                                let user_connections = connections.get_user_connections(user_id);
                                for conn_id in user_connections {
                                    connections.join_room(&conn_id, room_id);
                                    debug!("Registered connection {} in room {} for user {}", conn_id, room_id, user_id);
                                }

                                // For spectators, also register in the spectators room
                                // Check if user is a spectator in room_state
                                let user_id_i64: i64 = user_id.parse().unwrap_or(0);
                                let is_spectator = if envelope.event_type == "games.event.room_state"
                                    || envelope.event_type.ends_with(".room_state")
                                {
                                    // Check spectators_data array for user_id
                                    envelope.payload.get("room")
                                        .and_then(|r| r.get("spectators_data"))
                                        .and_then(|s| s.as_array())
                                        .map(|arr| arr.iter().any(|spec| {
                                            spec.get("user_id")
                                                .and_then(|id| id.as_i64())
                                                .map(|id| id == user_id_i64)
                                                .unwrap_or(false)
                                        }))
                                        .unwrap_or(false)
                                } else if envelope.event_type == "games.event.spectator_data_joined"
                                    || envelope.event_type.ends_with(".spectator_data_joined")
                                {
                                    // This event is sent when someone joins as spectator
                                    envelope.payload.get("spectator")
                                        .and_then(|s| s.get("user_id"))
                                        .and_then(|id| id.as_i64())
                                        .map(|id| id == user_id_i64)
                                        .unwrap_or(false)
                                } else {
                                    false
                                };

                                if is_spectator {
                                    let spectator_room = format!("spectators:{}", room_id);
                                    for conn_id in connections.get_user_connections(user_id) {
                                        connections.join_room(&conn_id, &spectator_room);
                                        debug!("Registered spectator connection {} in spectators room {} for user {}", conn_id, spectator_room, user_id);
                                    }
                                }
                            }
                        }
                        // Handle room leave events - remove user connections from room tracking
                        // Support both unprefixed and game-prefixed event types
                        let is_leave_event = envelope.event_type == "games.event.player_left"
                            || envelope.event_type.ends_with(".player_left")
                            || envelope.event_type == "games.event.player_kicked"
                            || envelope.event_type.ends_with(".player_kicked")
                            || envelope.event_type == "games.event.player_banned"
                            || envelope.event_type.ends_with(".player_banned")
                            || envelope.event_type == "games.event.removed_from_game"
                            || envelope.event_type.ends_with(".removed_from_game");

                        if is_leave_event {
                            if let Some(room_id) = envelope.payload.get("room_id").and_then(|v| v.as_str()) {
                                // Extract the leaving player's user_id from the event payload
                                let leaving_user_id = envelope.payload.get("user_id")
                                    .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
                                    .map(|id| id.to_string());

                                if let Some(leaving_id) = leaving_user_id {
                                    // Remove the leaving user's connections from this room
                                    let user_connections = connections.get_user_connections(&leaving_id);
                                    for conn_id in user_connections {
                                        connections.leave_room(&conn_id, room_id);
                                        // Also remove from spectators room if exists
                                        let spectator_room = format!("spectators:{}", room_id);
                                        connections.leave_room(&conn_id, &spectator_room);
                                        debug!("Removed connection {} from room {} for user {} ({})",
                                            conn_id, room_id, leaving_id, envelope.event_type);
                                    }
                                }
                            }
                        }

                        let sent = connections.send_to_user(user_id, message);
                        debug!("Sent {} to user {}: {} connection(s)", envelope.event_type, user_id, sent);
                    } else {
                        warn!("Failed to convert envelope to server message for event: {}", envelope.event_type);
                    }
                }
            }
            AudienceType::Room => {
                // Send to room members
                if let Some(room_id) = &envelope.audience.room_id {
                    // Handle room leave events - remove user connections from room tracking
                    // This must happen BEFORE sending the message so the leaving user still receives it
                    // Support both unprefixed and game-prefixed event types
                    let is_leave_event = envelope.event_type == "games.event.player_left"
                        || envelope.event_type.ends_with(".player_left")
                        || envelope.event_type == "games.event.player_kicked"
                        || envelope.event_type.ends_with(".player_kicked")
                        || envelope.event_type == "games.event.player_banned"
                        || envelope.event_type.ends_with(".player_banned")
                        || envelope.event_type == "games.event.removed_from_game"
                        || envelope.event_type.ends_with(".removed_from_game");

                    if is_leave_event {
                        // Extract the leaving player's user_id from the event payload
                        let leaving_user_id = envelope.payload.get("user_id")
                            .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
                            .map(|id| id.to_string());

                        // Send the message FIRST so the leaving user sees the event
                        if let Ok(Some(message)) = Self::envelope_to_server_message(&envelope) {
                            connections.send_to_room(room_id, message);
                        }

                        // THEN remove them from room tracking
                        if let Some(leaving_id) = leaving_user_id {
                            let user_connections = connections.get_user_connections(&leaving_id);
                            for conn_id in user_connections {
                                connections.leave_room(&conn_id, room_id);
                                // Also remove from spectators room if exists
                                let spectator_room = format!("spectators:{}", room_id);
                                connections.leave_room(&conn_id, &spectator_room);
                                debug!("Removed connection {} from room {} for user {} (room audience, {})",
                                    conn_id, room_id, leaving_id, envelope.event_type);
                            }
                        }
                    } else {
                        if let Ok(Some(message)) = Self::envelope_to_server_message(&envelope) {
                            connections.send_to_room(room_id, message);
                        }
                    }
                }
            }
            AudienceType::Players => {
                // Send only to players in a game room (not spectators)
                if let Some(room_id) = &envelope.audience.room_id {
                    // Get player socket IDs from Redis and send
                    if let Ok(Some(message)) = Self::envelope_to_server_message(&envelope) {
                        connections.send_to_room(room_id, message);
                    }
                }
            }
            AudienceType::Spectators => {
                // Send only to spectators in a game room
                if let Some(game_id) = &envelope.audience.game_id {
                    let spectator_room = format!("spectators:{}", game_id);
                    if let Ok(Some(message)) = Self::envelope_to_server_message(&envelope) {
                        connections.send_to_room(&spectator_room, message);
                    }
                }
            }
            AudienceType::Broadcast => {
                // Send to all connected users
                if let Ok(Some(message)) = Self::envelope_to_server_message(&envelope) {
                    connections.broadcast(message);
                }
            }
        }
    }

    /// Convert Kafka envelope to server message
    fn envelope_to_server_message(envelope: &EventEnvelope) -> GatewayResult<Option<ServerMessage>> {
        // Parse the event type and construct appropriate ServerMessage
        // This is a simplified version - full implementation would map all event types

        let event_type = &envelope.event_type;
        let payload = &envelope.payload;

        // For now, we'll construct messages based on event type
        // The full implementation would have a comprehensive mapping
        match event_type.as_str() {
            "chat.event.message_sent" | "chat.event.message_received" => {
                Ok(Some(ServerMessage::ChatMessageReceived {
                    message_id: payload.get("message_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    sender_id: envelope.actor.user_id.clone(),
                    sender_name: envelope.actor.username.clone().unwrap_or_default(),
                    content: payload.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    sent_at: envelope.timestamp,
                }))
            }
            "chat.event.lobby_message" => {
                Ok(Some(ServerMessage::ChatLobbyMessage {
                    lobby_id: payload.get("lobby_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    message_id: payload.get("message_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    sender_id: envelope.actor.user_id.clone(),
                    sender_name: envelope.actor.username.clone().unwrap_or_default(),
                    content: payload.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    sent_at: envelope.timestamp,
                }))
            }
            "presence.event.user_online" => {
                Ok(Some(ServerMessage::UserOnline {
                    user_id: envelope.actor.user_id.clone(),
                    username: envelope.actor.username.clone().unwrap_or_default(),
                }))
            }
            "presence.event.user_offline" => {
                Ok(Some(ServerMessage::UserOffline {
                    user_id: envelope.actor.user_id.clone(),
                    username: envelope.actor.username.clone().unwrap_or_default(),
                }))
            }
            // Game events - support both unprefixed and game-prefixed event types
            // room_created - game-specific variants
            "games.event.tic_tac_toe.room_created" => {
                Ok(Some(ServerMessage::TicTacToeRoomCreated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    room_name: payload.get("room_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    game_type: "tic_tac_toe".to_string(),
                    host_id: payload.get("host_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    host_name: payload.get("host_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_password_protected: payload.get("is_password_protected").and_then(|v| v.as_bool()).unwrap_or(false),
                    player_count: payload.get("player_count").and_then(|v| v.as_i64()).unwrap_or(2) as i32,
                    allow_spectators: payload.get("allow_spectators").and_then(|v| v.as_bool()).unwrap_or(false),
                }))
            }
            "games.event.bigger_dice.room_created" => {
                Ok(Some(ServerMessage::BiggerDiceRoomCreated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    room_name: payload.get("room_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    game_type: "bigger_dice".to_string(),
                    host_id: payload.get("host_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    host_name: payload.get("host_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_password_protected: payload.get("is_password_protected").and_then(|v| v.as_bool()).unwrap_or(false),
                    player_count: payload.get("player_count").and_then(|v| v.as_i64()).unwrap_or(2) as i32,
                    allow_spectators: payload.get("allow_spectators").and_then(|v| v.as_bool()).unwrap_or(false),
                }))
            }
            // room_created - generic fallback
            "games.event.room_created" => {
                Ok(Some(ServerMessage::GameRoomCreated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    room_name: payload.get("room_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    game_type: payload.get("game_type").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    host_id: payload.get("host_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    host_name: payload.get("host_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_password_protected: payload.get("is_password_protected").and_then(|v| v.as_bool()).unwrap_or(false),
                    player_count: payload.get("player_count").and_then(|v| v.as_i64()).unwrap_or(2) as i32,
                    allow_spectators: payload.get("allow_spectators").and_then(|v| v.as_bool()).unwrap_or(false),
                }))
            }
            "games.event.error" => {
                Ok(Some(ServerMessage::Error {
                    code: payload.get("code").and_then(|v| v.as_str()).unwrap_or("game_error").to_string(),
                    message: payload.get("message").and_then(|v| v.as_str()).unwrap_or("Unknown error").to_string(),
                }))
            }
            // room_state - game-specific variants
            "games.event.tic_tac_toe.room_state" => {
                Ok(Some(ServerMessage::TicTacToeRoomState {
                    room: payload.get("room").cloned().unwrap_or(serde_json::json!({})),
                }))
            }
            "games.event.bigger_dice.room_state" => {
                Ok(Some(ServerMessage::BiggerDiceRoomState {
                    room: payload.get("room").cloned().unwrap_or(serde_json::json!({})),
                }))
            }
            // room_state - generic fallback
            "games.event.room_state" => {
                Ok(Some(ServerMessage::GameRoomState {
                    room: payload.get("room").cloned().unwrap_or(serde_json::json!({})),
                }))
            }
            // player_disconnected - game-specific variants
            "games.event.tic_tac_toe.player_disconnected" => {
                let timeout_at = payload.get("timeout_at")
                    .and_then(|v| v.as_str())
                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or(envelope.timestamp);

                Ok(Some(ServerMessage::TicTacToePlayerDisconnected {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    timeout_at,
                }))
            }
            "games.event.bigger_dice.player_disconnected" => {
                let timeout_at = payload.get("timeout_at")
                    .and_then(|v| v.as_str())
                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or(envelope.timestamp);

                Ok(Some(ServerMessage::BiggerDicePlayerDisconnected {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    timeout_at,
                }))
            }
            // player_disconnected - generic fallback
            "games.event.player_disconnected" => {
                let timeout_at = payload.get("timeout_at")
                    .and_then(|v| v.as_str())
                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc))
                    .unwrap_or(envelope.timestamp);

                Ok(Some(ServerMessage::GamePlayerDisconnected {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    timeout_at,
                }))
            }
            // player_rejoined - game-specific variants
            "games.event.tic_tac_toe.player_rejoined" => {
                Ok(Some(ServerMessage::TicTacToePlayerRejoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.player_rejoined" => {
                Ok(Some(ServerMessage::BiggerDicePlayerRejoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_rejoined - generic fallback
            "games.event.player_rejoined" => {
                Ok(Some(ServerMessage::GamePlayerRejoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_auto_enabled - generic fallback
            "games.event.player_auto_enabled" => {
                Ok(Some(ServerMessage::GamePlayerAutoEnabled {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_auto_disabled - generic fallback
            "games.event.player_auto_disabled" => {
                Ok(Some(ServerMessage::GamePlayerAutoDisabled {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_auto_enabled - bigger_dice specific
            "games.event.bigger_dice.player_auto_enabled" => {
                Ok(Some(ServerMessage::BiggerDicePlayerAutoEnabled {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_auto_disabled - bigger_dice specific
            "games.event.bigger_dice.player_auto_disabled" => {
                Ok(Some(ServerMessage::BiggerDicePlayerAutoDisabled {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // not_in_room - game-specific variants
            "games.event.tic_tac_toe.not_in_room" => {
                Ok(Some(ServerMessage::TicTacToeNotInRoom {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    room_name: payload.get("room_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_password_protected: payload.get("is_password_protected").and_then(|v| v.as_bool()).unwrap_or(false),
                    status: payload.get("status").and_then(|v| v.as_str()).unwrap_or("waiting").to_string(),
                    allow_spectators: payload.get("allow_spectators").and_then(|v| v.as_bool()).unwrap_or(false),
                }))
            }
            "games.event.bigger_dice.not_in_room" => {
                Ok(Some(ServerMessage::BiggerDiceNotInRoom {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    room_name: payload.get("room_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_password_protected: payload.get("is_password_protected").and_then(|v| v.as_bool()).unwrap_or(false),
                    status: payload.get("status").and_then(|v| v.as_str()).unwrap_or("waiting").to_string(),
                    allow_spectators: payload.get("allow_spectators").and_then(|v| v.as_bool()).unwrap_or(false),
                }))
            }
            // not_in_room - generic fallback
            "games.event.not_in_room" => {
                Ok(Some(ServerMessage::GameNotInRoom {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    room_name: payload.get("room_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_password_protected: payload.get("is_password_protected").and_then(|v| v.as_bool()).unwrap_or(false),
                    status: payload.get("status").and_then(|v| v.as_str()).unwrap_or("waiting").to_string(),
                    allow_spectators: payload.get("allow_spectators").and_then(|v| v.as_bool()).unwrap_or(false),
                }))
            }
            // lobby_joined - game-specific variants
            "games.event.tic_tac_toe.lobby_joined" => {
                let player_json = payload.get("player").cloned().unwrap_or(serde_json::json!({}));
                let player = crate::protocol::LobbyPlayer {
                    user_id: player_json.get("user_id")
                        .and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string())))
                        .unwrap_or_default(),
                    username: player_json.get("username")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    avatar_id: player_json.get("avatar_id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    score: 0,
                    is_ready: false,
                };
                Ok(Some(ServerMessage::TicTacToeLobbyJoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player,
                }))
            }
            "games.event.bigger_dice.lobby_joined" => {
                let player_json = payload.get("player").cloned().unwrap_or(serde_json::json!({}));
                let player = crate::protocol::LobbyPlayer {
                    user_id: player_json.get("user_id")
                        .and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string())))
                        .unwrap_or_default(),
                    username: player_json.get("username")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    avatar_id: player_json.get("avatar_id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    score: 0,
                    is_ready: false,
                };
                Ok(Some(ServerMessage::BiggerDiceLobbyJoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player,
                }))
            }
            // lobby_joined - generic fallback
            "games.event.lobby_joined" => {
                let player_json = payload.get("player").cloned().unwrap_or(serde_json::json!({}));
                let player = crate::protocol::LobbyPlayer {
                    user_id: player_json.get("user_id")
                        .and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string())))
                        .unwrap_or_default(),
                    username: player_json.get("username")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    avatar_id: player_json.get("avatar_id")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    score: 0,
                    is_ready: false,
                };
                Ok(Some(ServerMessage::GameLobbyJoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player,
                }))
            }
            // player_left - game-specific variants
            "games.event.tic_tac_toe.player_left" => {
                Ok(Some(ServerMessage::TicTacToePlayerLeft {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.player_left" => {
                Ok(Some(ServerMessage::BiggerDicePlayerLeft {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_left - generic fallback
            "games.event.player_left" => {
                Ok(Some(ServerMessage::GamePlayerLeft {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_ready - game-specific variants
            "games.event.tic_tac_toe.player_ready" => {
                Ok(Some(ServerMessage::TicTacToePlayerReady {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.player_ready" => {
                Ok(Some(ServerMessage::BiggerDicePlayerReady {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_ready - generic fallback
            "games.event.player_ready" => {
                Ok(Some(ServerMessage::GamePlayerReady {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // removed_from_game - game-specific variants
            "games.event.tic_tac_toe.removed_from_game" => {
                Ok(Some(ServerMessage::TicTacToeRemovedFromGame {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    reason: payload.get("reason").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    message: payload.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.removed_from_game" => {
                Ok(Some(ServerMessage::BiggerDiceRemovedFromGame {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    reason: payload.get("reason").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    message: payload.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // removed_from_game - generic fallback
            "games.event.removed_from_game" => {
                Ok(Some(ServerMessage::GameRemovedFromGame {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    reason: payload.get("reason").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    message: payload.get("message").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // game_starting - game-specific variants
            "games.event.tic_tac_toe.game_starting" => {
                Ok(Some(ServerMessage::TicTacToeGameStarting {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    players: payload.get("players").cloned().unwrap_or(serde_json::json!([])),
                }))
            }
            "games.event.bigger_dice.game_starting" => {
                Ok(Some(ServerMessage::BiggerDiceGameStarting {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    players: payload.get("players").cloned().unwrap_or(serde_json::json!([])),
                }))
            }
            // game_starting - generic fallback
            "games.event.game_starting" => {
                Ok(Some(ServerMessage::GameGameStarting {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    players: payload.get("players").cloned().unwrap_or(serde_json::json!([])),
                }))
            }
            // player_selected - game-specific variants
            "games.event.tic_tac_toe.player_selected" => {
                let player_json = payload.get("player").cloned().unwrap_or(serde_json::json!({}));
                let player = crate::protocol::LobbyPlayer {
                    user_id: player_json.get("user_id")
                        .and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string())))
                        .unwrap_or_default(),
                    username: player_json.get("username")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    avatar_id: player_json.get("avatar_id")
                        .and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))),
                    score: player_json.get("score").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                    is_ready: player_json.get("is_ready").and_then(|v| v.as_bool()).unwrap_or(false),
                };
                Ok(Some(ServerMessage::TicTacToePlayerSelected {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player,
                }))
            }
            "games.event.bigger_dice.player_selected" => {
                let player_json = payload.get("player").cloned().unwrap_or(serde_json::json!({}));
                let player = crate::protocol::LobbyPlayer {
                    user_id: player_json.get("user_id")
                        .and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string())))
                        .unwrap_or_default(),
                    username: player_json.get("username")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    avatar_id: player_json.get("avatar_id")
                        .and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))),
                    score: player_json.get("score").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                    is_ready: player_json.get("is_ready").and_then(|v| v.as_bool()).unwrap_or(false),
                };
                Ok(Some(ServerMessage::BiggerDicePlayerSelected {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player,
                }))
            }
            // player_selected - generic fallback
            "games.event.player_selected" => {
                let player_json = payload.get("player").cloned().unwrap_or(serde_json::json!({}));
                let player = crate::protocol::LobbyPlayer {
                    user_id: player_json.get("user_id")
                        .and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string())))
                        .unwrap_or_default(),
                    username: player_json.get("username")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    avatar_id: player_json.get("avatar_id")
                        .and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))),
                    score: player_json.get("score").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                    is_ready: player_json.get("is_ready").and_then(|v| v.as_bool()).unwrap_or(false),
                };
                Ok(Some(ServerMessage::GamePlayerSelected {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player,
                }))
            }
            // player_kicked - game-specific variants
            "games.event.tic_tac_toe.player_kicked" => {
                Ok(Some(ServerMessage::TicTacToePlayerKicked {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.player_kicked" => {
                Ok(Some(ServerMessage::BiggerDicePlayerKicked {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_kicked - generic fallback
            "games.event.player_kicked" => {
                Ok(Some(ServerMessage::GamePlayerKicked {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_banned - game-specific variants
            "games.event.tic_tac_toe.player_banned" => {
                Ok(Some(ServerMessage::TicTacToePlayerBanned {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.player_banned" => {
                Ok(Some(ServerMessage::BiggerDicePlayerBanned {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_banned - generic fallback
            "games.event.player_banned" => {
                Ok(Some(ServerMessage::GamePlayerBanned {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_unbanned - game-specific variants
            "games.event.tic_tac_toe.player_unbanned" => {
                Ok(Some(ServerMessage::TicTacToePlayerUnbanned {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.player_unbanned" => {
                Ok(Some(ServerMessage::BiggerDicePlayerUnbanned {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_unbanned - generic fallback
            "games.event.player_unbanned" => {
                Ok(Some(ServerMessage::GamePlayerUnbanned {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.user_banned" => {
                // Forward as an error message to the banned user
                Ok(Some(ServerMessage::Error {
                    code: "user_banned".to_string(),
                    message: "You are banned from this room".to_string(),
                }))
            }
            // turn_changed - game-specific variants
            "games.event.tic_tac_toe.turn_changed" => {
                Ok(Some(ServerMessage::TicTacToeTurnChanged {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    current_turn: payload.get("current_turn").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    turn_number: payload.get("turn_number").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                }))
            }
            "games.event.bigger_dice.turn_changed" => {
                Ok(Some(ServerMessage::BiggerDiceTurnChanged {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    current_turn: payload.get("current_turn").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    turn_number: payload.get("turn_number").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                }))
            }
            // turn_changed - generic fallback
            "games.event.turn_changed" => {
                Ok(Some(ServerMessage::GameTurnChanged {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    current_turn: payload.get("current_turn").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    turn_number: payload.get("turn_number").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                }))
            }
            "games.event.bigger_dice.round_result" => {
                // N-player round result - parse rolls array
                let rolls_json = payload.get("rolls").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let rolls: Vec<(String, i32)> = rolls_json.iter().filter_map(|r| {
                    let arr = r.as_array()?;
                    let player_id = arr.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))?.to_string();
                    let roll = arr.get(1).and_then(|v| v.as_i64())? as i32;
                    Some((player_id, roll))
                }).collect();

                let tiebreaker_players_json = payload.get("tiebreaker_players").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let tiebreaker_players: Vec<String> = tiebreaker_players_json.iter().filter_map(|v| {
                    v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())).map(|n| n.to_string())
                }).collect();

                // Parse authoritative scores array
                let scores_json = payload.get("scores").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let scores: Vec<(String, i32)> = scores_json.iter().filter_map(|s| {
                    let arr = s.as_array()?;
                    let player_id = arr.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))?.to_string();
                    let score = arr.get(1).and_then(|v| v.as_i64())? as i32;
                    Some((player_id, score))
                }).collect();

                Ok(Some(ServerMessage::BiggerDiceRoundResult {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    rolls,
                    winner_id: payload.get("winner_id").and_then(|v| {
                        if v.is_null() { None } else { v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())).map(|n| n.to_string()) }
                    }),
                    is_tie: payload.get("is_tie").and_then(|v| v.as_bool()).unwrap_or(false),
                    is_tiebreaker: payload.get("is_tiebreaker").and_then(|v| v.as_bool()).unwrap_or(false),
                    tiebreaker_players,
                    scores,
                }))
            }
            "games.event.bigger_dice.tiebreaker_started" => {
                let tied_players_json = payload.get("tied_players").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let tied_players: Vec<String> = tied_players_json.iter().filter_map(|v| {
                    v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())).map(|n| n.to_string())
                }).collect();

                Ok(Some(ServerMessage::BiggerDiceTiebreakerStarted {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    tied_players,
                    tied_roll: payload.get("tied_roll").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                }))
            }
            "games.event.bigger_dice.state" => {
                // N-player state - parse current_rolls array
                let current_rolls_json = payload.get("current_rolls").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let current_rolls: Vec<(String, i32)> = current_rolls_json.iter().filter_map(|r| {
                    let arr = r.as_array()?;
                    let player_id = arr.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))?.to_string();
                    let roll = arr.get(1).and_then(|v| v.as_i64())? as i32;
                    Some((player_id, roll))
                }).collect();

                let pending_rollers_json = payload.get("pending_rollers").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let pending_rollers: Vec<String> = pending_rollers_json.iter().filter_map(|v| {
                    v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())).map(|n| n.to_string())
                }).collect();

                Ok(Some(ServerMessage::BiggerDiceState {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    round_number: payload.get("round_number").and_then(|v| v.as_i64()).unwrap_or(1) as i32,
                    current_rolls,
                    pending_rollers,
                    is_tiebreaker: payload.get("is_tiebreaker").and_then(|v| v.as_bool()).unwrap_or(false),
                }))
            }
            // game_started - game-specific variants
            "games.event.tic_tac_toe.game_started" => {
                let players_json = payload.get("players").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let players: Vec<crate::protocol::PlayerInfo> = players_json.iter().map(|p| {
                    crate::protocol::PlayerInfo {
                        id: p.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                        name: p.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    }
                }).collect();
                Ok(Some(ServerMessage::TicTacToeGameStarted {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    players,
                    first_turn: payload.get("first_turn").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    game_type: "tic_tac_toe".to_string(),
                }))
            }
            "games.event.bigger_dice.game_started" => {
                let players_json = payload.get("players").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let players: Vec<crate::protocol::PlayerInfo> = players_json.iter().map(|p| {
                    crate::protocol::PlayerInfo {
                        id: p.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                        name: p.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    }
                }).collect();
                Ok(Some(ServerMessage::BiggerDiceGameStarted {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    players,
                    first_turn: payload.get("first_turn").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    game_type: "bigger_dice".to_string(),
                }))
            }
            // game_started - generic fallback
            "games.event.game_started" => {
                let players_json = payload.get("players").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let players: Vec<crate::protocol::PlayerInfo> = players_json.iter().map(|p| {
                    crate::protocol::PlayerInfo {
                        id: p.get("user_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                        name: p.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    }
                }).collect();
                Ok(Some(ServerMessage::GameStarted {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    players,
                    first_turn: payload.get("first_turn").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    game_type: payload.get("game_type").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                }))
            }
            "games.event.room_list" => {
                let rooms_json = payload.get("rooms").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let rooms: Vec<crate::protocol::RoomInfo> = rooms_json.iter().map(|r| {
                    crate::protocol::RoomInfo {
                        room_id: r.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        room_name: r.get("room_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        game_type: r.get("game_type").and_then(|v| v.as_str()).unwrap_or("bigger_dice").to_string(),
                        host_name: r.get("host_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        status: r.get("status").and_then(|v| v.as_str()).unwrap_or("waiting").to_string(),
                        player_count: r.get("player_count").and_then(|v| v.as_u64()).unwrap_or(0) as u8,
                        spectator_count: r.get("spectator_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                        is_password_protected: r.get("is_password_protected").and_then(|v| v.as_bool()).unwrap_or(false),
                        players: r.get("players").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                        lobby: r.get("lobby").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                        max_players: r.get("max_players").and_then(|v| v.as_u64()).unwrap_or(0) as u8,
                        allow_spectators: r.get("allow_spectators").and_then(|v| v.as_bool()).unwrap_or(false),
                        can_rejoin: r.get("can_rejoin").and_then(|v| v.as_bool()).unwrap_or(false),
                        rejoin_role: r.get("rejoin_role").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    }
                }).collect();
                Ok(Some(ServerMessage::GameRoomList { rooms }))
            }
            // room_removed - game-specific variants
            "games.event.tic_tac_toe.room_removed" => {
                Ok(Some(ServerMessage::TicTacToeRoomRemoved {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    room_name: payload.get("room_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    reason: payload.get("reason").and_then(|v| v.as_str()).unwrap_or("host_left").to_string(),
                }))
            }
            "games.event.bigger_dice.room_removed" => {
                Ok(Some(ServerMessage::BiggerDiceRoomRemoved {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    room_name: payload.get("room_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    reason: payload.get("reason").and_then(|v| v.as_str()).unwrap_or("host_left").to_string(),
                }))
            }
            // room_removed - generic fallback
            "games.event.room_removed" => {
                Ok(Some(ServerMessage::GameRoomRemoved {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    room_name: payload.get("room_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    reason: payload.get("reason").and_then(|v| v.as_str()).unwrap_or("host_left").to_string(),
                }))
            }
            "games.event.bigger_dice.rolled" => {
                Ok(Some(ServerMessage::BiggerDiceRolled {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("player_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_name: payload.get("player_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    roll: payload.get("roll").and_then(|v| v.as_u64()).unwrap_or(0) as u8,
                    is_first_roll: true,
                }))
            }
            // games.event.game_ended - generic fallback (deprecated)
            "games.event.game_ended" => {
                let final_scores = payload.get("final_scores").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let (p1_id, p1_score, p2_id, p2_score) = if final_scores.len() >= 2 {
                    let p1 = &final_scores[0];
                    let p2 = &final_scores[1];
                    (
                        p1.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                        p1.get(2).and_then(|v| v.as_u64()).unwrap_or(0) as u8,
                        p2.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                        p2.get(2).and_then(|v| v.as_u64()).unwrap_or(0) as u8,
                    )
                } else {
                    ("0".to_string(), 0, "0".to_string(), 0)
                };
                Ok(Some(ServerMessage::BiggerDiceGameOver {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    winner: payload.get("winner_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    winner_name: payload.get("winner_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    final_scores: crate::protocol::Scores {
                        player1_id: p1_id,
                        player1_score: p1_score,
                        player2_id: p2_id,
                        player2_score: p2_score,
                    },
                }))
            }
            // games.event.bigger_dice.game_over - game-specific (N-player)
            "games.event.bigger_dice.game_over" => {
                let final_scores = payload.get("final_scores").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let (p1_id, p1_score, p2_id, p2_score) = if final_scores.len() >= 2 {
                    let p1 = &final_scores[0];
                    let p2 = &final_scores[1];
                    (
                        p1.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                        p1.get(2).and_then(|v| v.as_u64()).unwrap_or(0) as u8,
                        p2.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                        p2.get(2).and_then(|v| v.as_u64()).unwrap_or(0) as u8,
                    )
                } else {
                    ("0".to_string(), 0, "0".to_string(), 0)
                };
                Ok(Some(ServerMessage::BiggerDiceGameOver {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    winner: payload.get("winner_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    winner_name: payload.get("winner_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    final_scores: crate::protocol::Scores {
                        player1_id: p1_id,
                        player1_score: p1_score,
                        player2_id: p2_id,
                        player2_score: p2_score,
                    },
                }))
            }

            // ========== Tic Tac Toe Events ==========

            "games.event.tic_tac_toe.moved" => {
                let board = payload.get("board").and_then(|v| v.as_array()).map(|arr| {
                    arr.iter().map(|v| {
                        v.as_str().and_then(|s| s.chars().next())
                    }).collect()
                }).unwrap_or_else(|| vec![None; 9]);

                Ok(Some(ServerMessage::TicTacToeMoved {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("player_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_username: payload.get("player_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    position: payload.get("position").and_then(|v| v.as_u64()).unwrap_or(0) as u8,
                    mark: payload.get("mark").and_then(|v| v.as_str()).and_then(|s| s.chars().next()).unwrap_or('?'),
                    board,
                }))
            }
            "games.event.tic_tac_toe.game_result" => {
                let scores_json = payload.get("scores").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let scores: Vec<(String, i32)> = scores_json.iter().filter_map(|r| {
                    let arr = r.as_array()?;
                    let player_id = arr.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))?.to_string();
                    let score = arr.get(1).and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    Some((player_id, score))
                }).collect();

                let winning_line = payload.get("winning_line").and_then(|v| v.as_array()).map(|arr| {
                    arr.iter().filter_map(|v| v.as_u64().map(|n| n as u8)).collect()
                });

                Ok(Some(ServerMessage::TicTacToeGameResult {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    winner_id: payload.get("winner_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).map(|n| n.to_string()),
                    winner_username: payload.get("winner_username").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    winning_line,
                    is_draw: payload.get("is_draw").and_then(|v| v.as_bool()).unwrap_or(false),
                    scores,
                    game_number: payload.get("game_number").and_then(|v| v.as_i64()).unwrap_or(1) as i32,
                    next_first_player: payload.get("next_first_player").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                }))
            }
            "games.event.tic_tac_toe.match_ended" => {
                let final_scores_json = payload.get("final_scores").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let final_scores: Vec<(String, String, i32)> = final_scores_json.iter().filter_map(|r| {
                    let arr = r.as_array()?;
                    let player_id = arr.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))?.to_string();
                    let username = arr.get(1).and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let score = arr.get(2).and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    Some((player_id, username, score))
                }).collect();

                Ok(Some(ServerMessage::TicTacToeMatchEnded {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    winner_id: payload.get("winner_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    winner_username: payload.get("winner_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    final_scores,
                    prize_amount: payload.get("prize_amount").and_then(|v| v.as_i64()).unwrap_or(0),
                }))
            }
            "games.event.tic_tac_toe.state" => {
                let board = payload.get("board").and_then(|v| v.as_array()).map(|arr| {
                    arr.iter().map(|v| {
                        v.as_str().and_then(|s| s.chars().next())
                    }).collect()
                }).unwrap_or_else(|| vec![None; 9]);

                let scores_json = payload.get("scores").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let scores: Vec<(String, i32)> = scores_json.iter().filter_map(|r| {
                    let arr = r.as_array()?;
                    let player_id = arr.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))?.to_string();
                    let score = arr.get(1).and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    Some((player_id, score))
                }).collect();

                Ok(Some(ServerMessage::TicTacToeState {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    board,
                    player_x_id: payload.get("player_x_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_o_id: payload.get("player_o_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    current_turn: payload.get("current_turn").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    scores,
                    game_number: payload.get("game_number").and_then(|v| v.as_i64()).unwrap_or(1) as i32,
                    move_deadline: payload.get("move_deadline").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    is_paused: payload.get("is_paused").and_then(|v| v.as_bool()).unwrap_or(false),
                    disconnected_player: payload.get("disconnected_player").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).map(|n| n.to_string()),
                }))
            }
            "games.event.tic_tac_toe.turn_timeout" => {
                let scores_json = payload.get("scores").and_then(|v| v.as_array()).cloned().unwrap_or_default();
                let scores: Vec<(String, i32)> = scores_json.iter().filter_map(|r| {
                    let arr = r.as_array()?;
                    let player_id = arr.get(0).and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))?.to_string();
                    let score = arr.get(1).and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    Some((player_id, score))
                }).collect();

                Ok(Some(ServerMessage::TicTacToeTurnTimeout {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    player_id: payload.get("player_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    player_username: payload.get("player_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    winner_id: payload.get("winner_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    winner_username: payload.get("winner_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    scores,
                    game_number: payload.get("game_number").and_then(|v| v.as_i64()).unwrap_or(1) as i32,
                }))
            }
            "games.event.tic_tac_toe.match_cancelled" => {
                Ok(Some(ServerMessage::TicTacToeMatchCancelled {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    reason: payload.get("reason").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    refund_amount: payload.get("refund_amount").and_then(|v| v.as_i64()).unwrap_or(0),
                }))
            }
            "games.event.tic_tac_toe.game_paused" => {
                Ok(Some(ServerMessage::TicTacToeGamePaused {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    disconnected_player_id: payload.get("disconnected_player_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    disconnected_player_username: payload.get("disconnected_player_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    timeout_at: payload.get("timeout_at").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.tic_tac_toe.game_resumed" => {
                Ok(Some(ServerMessage::TicTacToeGameResumed {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    reconnected_player_id: payload.get("reconnected_player_id").and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok()))).unwrap_or(0).to_string(),
                    reconnected_player_username: payload.get("reconnected_player_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }

            // ========== Enhanced Game Room Events ==========

            // chat_message - game-specific variants
            "games.event.tic_tac_toe.chat_message" => {
                Ok(Some(ServerMessage::TicTacToeChatMessage {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    channel: payload.get("channel").and_then(|v| v.as_str()).unwrap_or("lobby").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    avatar_id: payload.get("avatar_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))),
                    content: payload.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_system: payload.get("is_system").and_then(|v| v.as_bool()).unwrap_or(false),
                    timestamp: payload.get("timestamp").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.chat_message" => {
                Ok(Some(ServerMessage::BiggerDiceChatMessage {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    channel: payload.get("channel").and_then(|v| v.as_str()).unwrap_or("lobby").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    avatar_id: payload.get("avatar_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))),
                    content: payload.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_system: payload.get("is_system").and_then(|v| v.as_bool()).unwrap_or(false),
                    timestamp: payload.get("timestamp").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // chat_message - generic fallback
            "games.event.chat_message" => {
                Ok(Some(ServerMessage::GameChatMessage {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    channel: payload.get("channel").and_then(|v| v.as_str()).unwrap_or("lobby").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    avatar_id: payload.get("avatar_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))),
                    content: payload.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_system: payload.get("is_system").and_then(|v| v.as_bool()).unwrap_or(false),
                    timestamp: payload.get("timestamp").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // chat_history - game-specific variants
            "games.event.tic_tac_toe.chat_history" => {
                Ok(Some(ServerMessage::TicTacToeChatHistory {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    channel: payload.get("channel").and_then(|v| v.as_str()).unwrap_or("lobby").to_string(),
                    messages: payload.get("messages").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                }))
            }
            "games.event.bigger_dice.chat_history" => {
                Ok(Some(ServerMessage::BiggerDiceChatHistory {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    channel: payload.get("channel").and_then(|v| v.as_str()).unwrap_or("lobby").to_string(),
                    messages: payload.get("messages").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                }))
            }
            // Bigger Dice channel-specific chat events
            "games.event.bigger_dice.lobby_chat" => {
                Ok(Some(ServerMessage::BiggerDiceLobbyChat {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    avatar_id: payload.get("avatar_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))),
                    content: payload.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_system: payload.get("is_system").and_then(|v| v.as_bool()).unwrap_or(false),
                    timestamp: payload.get("timestamp").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.player_chat" => {
                Ok(Some(ServerMessage::BiggerDicePlayerChat {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    avatar_id: payload.get("avatar_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))),
                    content: payload.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_system: payload.get("is_system").and_then(|v| v.as_bool()).unwrap_or(false),
                    timestamp: payload.get("timestamp").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.spectator_chat" => {
                Ok(Some(ServerMessage::BiggerDiceSpectatorChat {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    avatar_id: payload.get("avatar_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))),
                    content: payload.get("content").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_system: payload.get("is_system").and_then(|v| v.as_bool()).unwrap_or(false),
                    timestamp: payload.get("timestamp").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.lobby_chat_history" => {
                Ok(Some(ServerMessage::BiggerDiceLobbyChatHistory {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    messages: payload.get("messages").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                }))
            }
            "games.event.bigger_dice.player_chat_history" => {
                Ok(Some(ServerMessage::BiggerDicePlayerChatHistory {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    messages: payload.get("messages").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                }))
            }
            "games.event.bigger_dice.spectator_chat_history" => {
                Ok(Some(ServerMessage::BiggerDiceSpectatorChatHistory {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    messages: payload.get("messages").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                }))
            }
            // chat_history - generic fallback
            "games.event.chat_history" => {
                Ok(Some(ServerMessage::GameChatHistory {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    channel: payload.get("channel").and_then(|v| v.as_str()).unwrap_or("lobby").to_string(),
                    messages: payload.get("messages").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                }))
            }
            // player_ready_changed - game-specific variants
            "games.event.tic_tac_toe.player_ready_changed" => {
                Ok(Some(ServerMessage::TicTacToePlayerReadyChanged {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_ready: payload.get("is_ready").and_then(|v| v.as_bool()).unwrap_or(false),
                }))
            }
            "games.event.bigger_dice.player_ready_changed" => {
                Ok(Some(ServerMessage::BiggerDicePlayerReadyChanged {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_ready: payload.get("is_ready").and_then(|v| v.as_bool()).unwrap_or(false),
                }))
            }
            // player_ready_changed - generic fallback
            "games.event.player_ready_changed" => {
                Ok(Some(ServerMessage::GamePlayerReadyChanged {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    is_ready: payload.get("is_ready").and_then(|v| v.as_bool()).unwrap_or(false),
                }))
            }
            // player_deselected - game-specific variants
            "games.event.tic_tac_toe.player_deselected" => {
                Ok(Some(ServerMessage::TicTacToePlayerDeselected {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.player_deselected" => {
                Ok(Some(ServerMessage::BiggerDicePlayerDeselected {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // player_deselected - generic fallback
            "games.event.player_deselected" => {
                Ok(Some(ServerMessage::GamePlayerDeselected {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // selected_players_updated - game-specific variants
            "games.event.tic_tac_toe.selected_players_updated" => {
                let selected: Vec<String> = payload.get("selected_players")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().map(|v| {
                        v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string())).unwrap_or_default()
                    }).collect())
                    .unwrap_or_default();
                Ok(Some(ServerMessage::TicTacToeSelectedPlayersUpdated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    selected_players: selected,
                }))
            }
            "games.event.bigger_dice.selected_players_updated" => {
                let selected: Vec<String> = payload.get("selected_players")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().map(|v| {
                        v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string())).unwrap_or_default()
                    }).collect())
                    .unwrap_or_default();
                Ok(Some(ServerMessage::BiggerDiceSelectedPlayersUpdated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    selected_players: selected,
                }))
            }
            // selected_players_updated - generic fallback
            "games.event.selected_players_updated" => {
                let selected: Vec<String> = payload.get("selected_players")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().map(|v| {
                        v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string())).unwrap_or_default()
                    }).collect())
                    .unwrap_or_default();
                Ok(Some(ServerMessage::GameSelectedPlayersUpdated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    selected_players: selected,
                }))
            }
            "games.event.admin_spectator_designated" => {
                Ok(Some(ServerMessage::GameAdminSpectatorDesignated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.user_muted" => {
                Ok(Some(ServerMessage::GameUserMuted {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    target_user_id: payload.get("target_user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    target_username: payload.get("target_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.user_unmuted" => {
                Ok(Some(ServerMessage::GameUserUnmuted {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    target_user_id: payload.get("target_user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    target_username: payload.get("target_username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.spectators_updated" => {
                Ok(Some(ServerMessage::GameSpectatorsUpdated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    spectators: payload.get("spectators").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                }))
            }
            // lobby_updated - game-specific variants
            "games.event.tic_tac_toe.lobby_updated" => {
                Ok(Some(ServerMessage::TicTacToeLobbyUpdated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    lobby: payload.get("lobby").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                }))
            }
            "games.event.bigger_dice.lobby_updated" => {
                Ok(Some(ServerMessage::BiggerDiceLobbyUpdated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    lobby: payload.get("lobby").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                }))
            }
            // lobby_updated - generic fallback
            "games.event.lobby_updated" => {
                Ok(Some(ServerMessage::GameLobbyUpdated {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    lobby: payload.get("lobby").and_then(|v| v.as_array()).cloned().unwrap_or_default(),
                }))
            }
            // spectator_joined - game-specific variants
            "games.event.tic_tac_toe.spectator_joined" => {
                Ok(Some(ServerMessage::TicTacToeSpectatorJoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    spectator_id: payload.get("spectator_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    spectator_name: payload.get("spectator_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    spectator_count: payload.get("spectator_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                }))
            }
            "games.event.bigger_dice.spectator_joined" => {
                Ok(Some(ServerMessage::BiggerDiceSpectatorJoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    spectator_id: payload.get("spectator_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    spectator_name: payload.get("spectator_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    spectator_count: payload.get("spectator_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                }))
            }
            // spectator_joined - generic fallback
            "games.event.spectator_joined" => {
                Ok(Some(ServerMessage::GameSpectatorJoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    spectator_id: payload.get("spectator_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    spectator_name: payload.get("spectator_name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    spectator_count: payload.get("spectator_count").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                }))
            }
            // spectator_left - game-specific variants
            "games.event.tic_tac_toe.spectator_left" => {
                Ok(Some(ServerMessage::TicTacToeSpectatorLeft {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            "games.event.bigger_dice.spectator_left" => {
                Ok(Some(ServerMessage::BiggerDiceSpectatorLeft {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // spectator_left - generic fallback
            "games.event.spectator_left" => {
                Ok(Some(ServerMessage::GameSpectatorLeft {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    user_id: payload.get("user_id").and_then(|v| v.as_i64().map(|n| n.to_string()).or_else(|| v.as_str().map(|s| s.to_string()))).unwrap_or_default(),
                    username: payload.get("username").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                }))
            }
            // spectator_data_joined - generic fallback
            "games.event.spectator_data_joined" => {
                // Forward spectator joined event with full spectator data
                Ok(Some(ServerMessage::GameSpectatorDataJoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    spectator: payload.get("spectator").cloned().unwrap_or(serde_json::Value::Null),
                }))
            }
            // spectator_data_joined - bigger_dice specific
            "games.event.bigger_dice.spectator_data_joined" => {
                Ok(Some(ServerMessage::BiggerDiceSpectatorDataJoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    spectator: payload.get("spectator").cloned().unwrap_or(serde_json::Value::Null),
                }))
            }
            // spectator_data_joined - tic_tac_toe specific
            "games.event.tic_tac_toe.spectator_data_joined" => {
                Ok(Some(ServerMessage::TicTacToeSpectatorDataJoined {
                    room_id: payload.get("room_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    spectator: payload.get("spectator").cloned().unwrap_or(serde_json::Value::Null),
                }))
            }

            // Add more event mappings as needed
            _ => {
                debug!("Unhandled event type: {}", event_type);
                Ok(None)
            }
        }
    }

    /// Shutdown the server gracefully
    pub async fn shutdown(&self) {
        info!("Shutting down WebSocket Server...");

        // Get stats before shutdown
        let stats = self.connections.stats();
        info!(
            "Final stats: {} connections, {} users, {} rooms",
            stats.total_connections, stats.unique_users, stats.active_rooms
        );

        // TODO: Send disconnect messages to all clients
        // TODO: Clean up Redis state

        info!("WebSocket Server shutdown complete");
    }
}
