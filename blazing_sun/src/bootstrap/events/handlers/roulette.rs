//! Multiplayer Roulette event handler
//!
//! Processes roulette commands from the WebSocket gateway and publishes roulette events back.
//! - Handles tick events from ws_gateway for countdown/spin cycle
//! - Processes user commands (join, leave, broadcast_bets, chat)
//! - Calculates payouts when spin completes
//! - Stores bets and results in MongoDB

use crate::app::db_query::mutations::user as user_mutations;
use crate::app::db_query::read::user as user_read;
use crate::app::games::mongodb_roulette_multiplayer::MongoRouletteMultiplayerClient;
use crate::app::games::roulette::{
    calculate_total_stake, calculate_winnings, determine_color, determine_parity, spin_wheel,
    validate_bet,
};
use crate::app::games::roulette_types::{
    BetResultInfo, ConnectedUser, CurrentSpinState, RouletteCommand, RouletteEvent, RoulettePhase,
    RouletteTick, CYCLE_DURATION_SECONDS,
    HISTORY_BAR_SIZE,
};
use crate::app::games::types::{Audience, EventEnvelope};
use crate::events::consumer::{EventHandler, EventHandlerError};
use crate::events::producer::EventProducer;
use crate::events::topics::topic;
use crate::events::types::DomainEvent;
use async_trait::async_trait;
use chrono::Utc;
use mongodb::Database;
use sqlx::{Pool, Postgres};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Handler for multiplayer roulette commands from WebSocket gateway
pub struct RouletteCommandHandler {
    db: Arc<Mutex<Pool<Postgres>>>,
    mongodb: Option<Arc<Database>>,
    producer: Option<Arc<EventProducer>>,
    /// Current spin state (in-memory)
    current_spin: Arc<Mutex<Option<CurrentSpinState>>>,
    /// Connected users (user_id -> ConnectedUser)
    connected_users: Arc<Mutex<HashMap<i64, ConnectedUser>>>,
    /// Users who opted out of chat
    chat_opt_out: Arc<Mutex<std::collections::HashSet<i64>>>,
}

impl RouletteCommandHandler {
    /// Create a new roulette command handler
    pub fn new(
        db: Arc<Mutex<Pool<Postgres>>>,
        mongodb: Option<Arc<Database>>,
        producer: Option<Arc<EventProducer>>,
    ) -> Self {
        Self {
            db,
            mongodb,
            producer,
            current_spin: Arc::new(Mutex::new(None)),
            connected_users: Arc::new(Mutex::new(HashMap::new())),
            chat_opt_out: Arc::new(Mutex::new(std::collections::HashSet::new())),
        }
    }

    /// Get MongoDB client
    fn mongo_client(&self) -> Option<MongoRouletteMultiplayerClient> {
        self.mongodb.as_ref().map(|db| MongoRouletteMultiplayerClient::new(db.clone()))
    }

    /// Publish an event to ws_gateway
    async fn publish_event(&self, event: &RouletteEvent, audience: Audience) {
        let Some(producer) = &self.producer else {
            warn!("No producer available for roulette events");
            return;
        };

        let envelope = EventEnvelope {
            event_id: Uuid::new_v4().to_string(),
            event_type: format!("roulette.event.{}", event.event_type_name()),
            timestamp: Utc::now().to_rfc3339(),
            correlation_id: None,
            producer: "blazing_sun".to_string(),
            actor: crate::app::games::types::Actor {
                user_id: 0,
                username: "system".to_string(),
                socket_id: String::new(),
                roles: vec![],
            },
            audience,
            payload: serde_json::to_value(event).unwrap_or_default(),
        };

        let payload = match serde_json::to_vec(&envelope) {
            Ok(p) => p,
            Err(e) => {
                error!("Failed to serialize roulette event: {}", e);
                return;
            }
        };
        if let Err(e) = producer.send_raw(topic::ROULETTE_EVENTS, None, &payload).await {
            error!("Failed to publish roulette event: {}", e);
        }
    }

    /// Publish an event to a specific user
    async fn publish_to_user(&self, event: &RouletteEvent, user_id: i64) {
        self.publish_event(event, Audience::user(user_id)).await;
    }

    /// Broadcast an event to all users in the roulette room
    async fn broadcast_event(&self, event: &RouletteEvent) {
        self.publish_event(event, Audience::room("roulette")).await;
    }

    /// Get connected user count
    async fn connected_count(&self) -> u32 {
        self.connected_users.lock().await.len() as u32
    }

    /// Handle a tick event from ws_gateway
    async fn handle_tick(&self, tick: RouletteTick) -> Result<(), EventHandlerError> {
        let mut spin_guard = self.current_spin.lock().await;

        // Initialize new spin if needed
        if spin_guard.is_none() || spin_guard.as_ref().unwrap().spin_id != tick.spin_id {
            info!(spin_id = %tick.spin_id, "Starting new roulette spin cycle");
            *spin_guard = Some(CurrentSpinState::new(&tick.spin_id));
        }

        let spin_state = spin_guard.as_mut().unwrap();
        spin_state.update_from_tick(&tick);

        let connected = self.connected_count().await;

        // Use should_block_bets() which respects result_announced state
        let block_bets = spin_state.should_block_bets();

        // Broadcast tick to all connected users
        let event = RouletteEvent::Tick {
            spin_id: tick.spin_id.clone(),
            seconds_remaining: tick.seconds_remaining,
            phase: tick.phase.clone(),
            block_bets,
            connected_count: connected,
        };

        drop(spin_guard);
        self.broadcast_event(&event).await;

        // If we hit 0 seconds and haven't processed the result yet, spin the wheel
        if tick.seconds_remaining == 0 {
            let mut spin_guard = self.current_spin.lock().await;
            if let Some(ref mut state) = *spin_guard {
                if !state.result_processed {
                    drop(spin_guard);
                    self.process_spin_result(&tick.spin_id).await?;
                }
            }
        }

        Ok(())
    }

    /// Process spin result when countdown reaches 0
    async fn process_spin_result(&self, spin_id: &str) -> Result<(), EventHandlerError> {
        info!(spin_id = %spin_id, "Processing roulette spin result");

        // Spin the wheel
        let winning_number = spin_wheel();
        let winning_color = determine_color(&winning_number);
        let winning_parity = determine_parity(&winning_number);

        // Update spin state
        {
            let mut spin_guard = self.current_spin.lock().await;
            if let Some(ref mut state) = *spin_guard {
                state.result_processed = true;
                state.winning_number = Some(winning_number.clone());
                state.winning_color = Some(winning_color.clone());
                state.phase = RoulettePhase::Payout;
            }
        }

        // Get pending bets from MongoDB
        let mongo_client = match self.mongo_client() {
            Some(c) => c,
            None => {
                warn!("No MongoDB available for roulette");
                return Ok(());
            }
        };

        let pending_bets = match mongo_client.get_pending_bets_for_spin(spin_id).await {
            Ok(bets) => bets,
            Err(e) => {
                error!("Failed to get pending bets: {}", e);
                vec![]
            }
        };

        let mut total_bets_amount: i64 = 0;
        let mut total_payouts: i64 = 0;
        let bet_count = pending_bets.len() as i32;

        // Process each user's bets
        let db = self.db.lock().await;
        for bet_record in &pending_bets {
            total_bets_amount += bet_record.total_amount;

            // Calculate winnings
            let (payout, bet_results) = calculate_winnings(&bet_record.bets, &winning_number);
            total_payouts += payout;

            // Credit winnings to user balance
            if payout > 0 {
                if let Err(e) = user_mutations::add_balance(&db, bet_record.user_id, payout).await {
                    error!(
                        "Failed to credit roulette winnings to user {}: {}",
                        bet_record.user_id, e
                    );
                }
            }

            // Mark bet as processed
            if let Err(e) = mongo_client
                .mark_bets_processed(spin_id, bet_record.user_id, payout)
                .await
            {
                error!("Failed to mark bet as processed: {}", e);
            }

            // Get updated balance
            let new_balance = match user_read::get_by_id(&db, bet_record.user_id).await {
                Ok(u) => u.balance,
                Err(_) => 0,
            };

            // Send payout event to user
            let bet_results_info: Vec<BetResultInfo> = bet_results
                .iter()
                .map(|r| BetResultInfo {
                    bet_type: r.bet_type.clone(),
                    numbers: r.numbers.clone(),
                    amount: r.amount,
                    won: r.won,
                    payout: r.payout,
                })
                .collect();

            let payout_event = RouletteEvent::Payout {
                user_id: bet_record.user_id,
                spin_id: spin_id.to_string(),
                payout_amount: payout,
                new_balance,
                bet_results: bet_results_info,
            };

            self.publish_to_user(&payout_event, bet_record.user_id).await;
        }
        drop(db);

        // Save spin result to MongoDB
        if let Err(e) = mongo_client
            .save_spin(
                spin_id,
                &winning_number,
                &winning_color,
                &winning_parity,
                total_bets_amount,
                total_payouts,
                bet_count,
            )
            .await
        {
            error!("Failed to save spin result: {}", e);
        }

        // Broadcast spin result to all users
        let result_event = RouletteEvent::SpinResult {
            spin_id: spin_id.to_string(),
            winning_number,
            winning_color,
            winning_parity,
            total_bets_amount,
            total_payouts,
        };

        self.broadcast_event(&result_event).await;

        // Mark result as announced - board should now be unblocked for next round
        {
            let mut spin_guard = self.current_spin.lock().await;
            if let Some(ref mut state) = *spin_guard {
                state.result_announced = true;
            }
        }

        info!(
            spin_id = %spin_id,
            bet_count = %bet_count,
            total_bets = %total_bets_amount,
            total_payouts = %total_payouts,
            "Roulette spin completed"
        );

        Ok(())
    }

    /// Handle a command from a client
    async fn handle_command(&self, command: RouletteCommand) -> Result<(), EventHandlerError> {
        match command {
            RouletteCommand::Join {
                user_id,
                username,
                avatar_id,
                socket_id,
            } => {
                self.handle_join(user_id, &username, avatar_id, &socket_id)
                    .await
            }
            RouletteCommand::Leave { user_id, socket_id } => {
                self.handle_leave(user_id, &socket_id).await
            }
            RouletteCommand::BroadcastBets {
                user_id,
                username,
                spin_id,
                bets,
                socket_id,
            } => {
                self.handle_broadcast_bets(user_id, &username, &spin_id, bets, &socket_id)
                    .await
            }
            RouletteCommand::Chat {
                user_id,
                username,
                avatar_id,
                content,
                socket_id,
            } => {
                self.handle_chat(user_id, &username, avatar_id, &content, &socket_id)
                    .await
            }
            RouletteCommand::ToggleChat {
                user_id,
                opt_out,
                socket_id,
            } => self.handle_toggle_chat(user_id, opt_out, &socket_id).await,
            RouletteCommand::GetState { user_id, socket_id } => {
                self.handle_get_state(user_id, &socket_id).await
            }
        }
    }

    /// Handle user joining the roulette table
    async fn handle_join(
        &self,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        info!(user_id = %user_id, username = %username, "User joining roulette table");

        let user = ConnectedUser::new(user_id, username, avatar_id, socket_id);

        {
            let mut users = self.connected_users.lock().await;
            users.insert(user_id, user);
        }

        let connected = self.connected_count().await;

        // Broadcast join event
        let event = RouletteEvent::UserJoined {
            user_id,
            username: username.to_string(),
            avatar_id,
            connected_count: connected,
        };
        self.broadcast_event(&event).await;

        // Send current state to the joining user
        self.handle_get_state(user_id, socket_id).await?;

        Ok(())
    }

    /// Handle user leaving the roulette table
    async fn handle_leave(&self, user_id: i64, _socket_id: &str) -> Result<(), EventHandlerError> {
        let username = {
            let mut users = self.connected_users.lock().await;
            if let Some(user) = users.remove(&user_id) {
                user.username
            } else {
                return Ok(());
            }
        };

        let connected = self.connected_count().await;

        info!(user_id = %user_id, username = %username, "User left roulette table");

        let event = RouletteEvent::UserLeft {
            user_id,
            username,
            connected_count: connected,
        };
        self.broadcast_event(&event).await;

        Ok(())
    }

    /// Handle bet broadcast from user
    async fn handle_broadcast_bets(
        &self,
        user_id: i64,
        username: &str,
        spin_id: &str,
        bets: Vec<crate::app::games::roulette::RouletteBet>,
        _socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Validate spin_id matches current spin
        let current_spin_id = {
            let spin = self.current_spin.lock().await;
            spin.as_ref().map(|s| s.spin_id.clone())
        };

        if current_spin_id.as_deref() != Some(spin_id) {
            let event = RouletteEvent::BetRejected {
                user_id,
                spin_id: spin_id.to_string(),
                reason: "Invalid spin ID".to_string(),
            };
            self.publish_to_user(&event, user_id).await;
            return Ok(());
        }

        // Check if betting is still allowed (should be blocked at 5 seconds)
        let is_betting_allowed = {
            let spin = self.current_spin.lock().await;
            spin.as_ref()
                .map(|s| s.seconds_remaining > 0)
                .unwrap_or(false)
        };

        if !is_betting_allowed {
            let event = RouletteEvent::BetRejected {
                user_id,
                spin_id: spin_id.to_string(),
                reason: "Betting is closed".to_string(),
            };
            self.publish_to_user(&event, user_id).await;
            return Ok(());
        }

        // Validate bets
        if bets.is_empty() {
            let event = RouletteEvent::BetRejected {
                user_id,
                spin_id: spin_id.to_string(),
                reason: "No bets provided".to_string(),
            };
            self.publish_to_user(&event, user_id).await;
            return Ok(());
        }

        for bet in &bets {
            if let Err(e) = validate_bet(bet) {
                let event = RouletteEvent::BetRejected {
                    user_id,
                    spin_id: spin_id.to_string(),
                    reason: format!("Invalid bet: {}", e),
                };
                self.publish_to_user(&event, user_id).await;
                return Ok(());
            }
        }

        // Calculate total stake
        let total_amount = calculate_total_stake(&bets);

        // Deduct balance
        let db = self.db.lock().await;
        match user_mutations::deduct_balance_if_sufficient(&db, user_id, total_amount).await {
            Ok(_) => {}
            Err(user_mutations::DeductBalanceError::InsufficientBalance { current, required }) => {
                warn!(
                    user_id = %user_id,
                    current = %current,
                    required = %required,
                    "Insufficient balance for roulette bet"
                );
                let event = RouletteEvent::BetRejected {
                    user_id,
                    spin_id: spin_id.to_string(),
                    reason: format!(
                        "Insufficient balance. Required: {}, Available: {}",
                        required, current
                    ),
                };
                self.publish_to_user(&event, user_id).await;
                return Ok(());
            }
            Err(user_mutations::DeductBalanceError::UserNotFound) => {
                let event = RouletteEvent::BetRejected {
                    user_id,
                    spin_id: spin_id.to_string(),
                    reason: "User not found".to_string(),
                };
                self.publish_to_user(&event, user_id).await;
                return Ok(());
            }
            Err(e) => {
                error!("Failed to deduct balance: {}", e);
                let event = RouletteEvent::BetRejected {
                    user_id,
                    spin_id: spin_id.to_string(),
                    reason: "Failed to process bet".to_string(),
                };
                self.publish_to_user(&event, user_id).await;
                return Ok(());
            }
        }

        // Get new balance
        let new_balance = match user_read::get_by_id(&db, user_id).await {
            Ok(u) => u.balance,
            Err(_) => 0,
        };
        drop(db);

        // Save bet to MongoDB
        if let Some(mongo_client) = self.mongo_client() {
            if let Err(e) = mongo_client
                .save_bet(user_id, username, spin_id, &bets, total_amount)
                .await
            {
                error!("Failed to save bet to MongoDB: {}", e);
            }
        }

        info!(
            user_id = %user_id,
            spin_id = %spin_id,
            amount = %total_amount,
            "Roulette bet confirmed"
        );

        // Send confirmation to user
        let event = RouletteEvent::BetConfirmed {
            user_id,
            spin_id: spin_id.to_string(),
            total_amount,
            new_balance,
        };
        self.publish_to_user(&event, user_id).await;

        Ok(())
    }

    /// Handle chat message
    async fn handle_chat(
        &self,
        user_id: i64,
        username: &str,
        avatar_id: Option<i64>,
        content: &str,
        _socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        // Sanitize content (basic XSS prevention)
        let sanitized = content
            .chars()
            .take(500) // Limit message length
            .collect::<String>()
            .replace('<', "&lt;")
            .replace('>', "&gt;");

        // Save to MongoDB
        if let Some(mongo_client) = self.mongo_client() {
            if let Err(e) = mongo_client
                .save_chat_message(user_id, username, avatar_id, &sanitized, false)
                .await
            {
                error!("Failed to save chat message: {}", e);
            }
        }

        // Broadcast to users who haven't opted out
        let chat_opt_out = self.chat_opt_out.lock().await;
        let connected_users = self.connected_users.lock().await;

        let recipients: Vec<i64> = connected_users
            .keys()
            .filter(|uid| !chat_opt_out.contains(uid))
            .copied()
            .collect();

        drop(connected_users);
        drop(chat_opt_out);

        if !recipients.is_empty() {
            let event = RouletteEvent::Chat {
                user_id,
                username: username.to_string(),
                avatar_id,
                content: sanitized,
                timestamp: Utc::now().to_rfc3339(),
                is_system: false,
            };

            self.publish_event(&event, Audience::users(recipients)).await;
        }

        Ok(())
    }

    /// Handle chat opt-out toggle
    async fn handle_toggle_chat(
        &self,
        user_id: i64,
        opt_out: bool,
        _socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        let mut chat_opt_out = self.chat_opt_out.lock().await;

        if opt_out {
            chat_opt_out.insert(user_id);
            info!(user_id = %user_id, "User opted out of roulette chat");
        } else {
            chat_opt_out.remove(&user_id);
            info!(user_id = %user_id, "User opted in to roulette chat");
        }

        Ok(())
    }

    /// Handle get state request (for reconnection)
    async fn handle_get_state(
        &self,
        user_id: i64,
        _socket_id: &str,
    ) -> Result<(), EventHandlerError> {
        let spin_guard = self.current_spin.lock().await;

        let (spin_id, seconds_remaining, phase, block_bets) = if let Some(ref spin) = *spin_guard {
            (
                spin.spin_id.clone(),
                spin.seconds_remaining,
                spin.phase.clone(),
                spin.should_block_bets(),
            )
        } else {
            (
                String::new(),
                CYCLE_DURATION_SECONDS,
                RoulettePhase::Betting,
                false,
            )
        };

        drop(spin_guard);

        // Get history from MongoDB
        let history = if let Some(mongo_client) = self.mongo_client() {
            match mongo_client.get_recent_spins(HISTORY_BAR_SIZE as i64).await {
                Ok(spins) => {
                    info!("Loaded {} spins from MongoDB for user {}", spins.len(), user_id);
                    spins
                }
                Err(e) => {
                    error!("Failed to load spins from MongoDB: {}", e);
                    vec![]
                }
            }
        } else {
            warn!("No MongoDB client available for loading history");
            vec![]
        };

        // Get user's pending bets for current spin
        let pending_bets = if !spin_id.is_empty() {
            if let Some(mongo_client) = self.mongo_client() {
                if let Ok(Some(bet_record)) =
                    mongo_client.get_user_bet_for_spin(user_id, &spin_id).await
                {
                    Some(bet_record.bets)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        // Get user balance
        let balance = {
            let db = self.db.lock().await;
            match user_read::get_by_id(&db, user_id).await {
                Ok(u) => u.balance,
                Err(_) => 0,
            }
        };

        let connected = self.connected_count().await;

        let event = RouletteEvent::State {
            spin_id,
            seconds_remaining,
            phase,
            block_bets,
            connected_count: connected,
            history,
            pending_bets,
            balance,
        };

        self.publish_to_user(&event, user_id).await;

        Ok(())
    }
}

#[async_trait]
impl EventHandler for RouletteCommandHandler {
    async fn handle(&self, event: &DomainEvent) -> Result<(), EventHandlerError> {
        // Parse the event payload
        let payload = &event.payload;

        // Debug: Log the incoming event
        info!(
            event_type = %event.event_type,
            payload = %serde_json::to_string_pretty(payload).unwrap_or_default(),
            "Roulette handler received event"
        );

        // Check if this is a tick event by checking both DomainEvent and payload event_type
        let event_type_str = event.event_type.to_string();
        let payload_event_type = payload
            .get("event_type")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if event_type_str.contains("roulette.tick")
            || event_type_str.contains("tick")
            || payload_event_type.contains("roulette.tick")
        {
            if let Ok(tick) = serde_json::from_value::<RouletteTick>(payload.clone()) {
                return self.handle_tick(tick).await;
            }
        }

        // Try to parse as a command (check payload event_type for command types)
        if payload_event_type.starts_with("roulette.") {
            if let Ok(command) = serde_json::from_value::<RouletteCommand>(payload.clone()) {
                return self.handle_command(command).await;
            }
        }

        // Check if this is an EventEnvelope from ws_gateway
        if let Ok(envelope) = serde_json::from_value::<EventEnvelope>(payload.clone()) {
            // Try to parse tick from envelope payload
            if envelope.event_type.contains("tick") {
                if let Ok(tick) = serde_json::from_value::<RouletteTick>(envelope.payload.clone()) {
                    return self.handle_tick(tick).await;
                }
            }

            // Try to parse command from envelope payload
            if let Ok(command) = serde_json::from_value::<RouletteCommand>(envelope.payload.clone())
            {
                return self.handle_command(command).await;
            }

            // For commands where payload is empty, construct from envelope actor
            let user_id = envelope.actor.user_id;
            let username = envelope.actor.username.clone();
            let socket_id = envelope.actor.socket_id.clone();

            let command = match envelope.event_type.as_str() {
                "roulette.join" => Some(RouletteCommand::Join {
                    user_id,
                    username,
                    avatar_id: None,
                    socket_id,
                }),
                "roulette.leave" => Some(RouletteCommand::Leave {
                    user_id,
                    socket_id,
                }),
                "roulette.get_state" => Some(RouletteCommand::GetState {
                    user_id,
                    socket_id,
                }),
                "roulette.toggle_chat" => {
                    let opt_out = envelope.payload.get("opt_out")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    Some(RouletteCommand::ToggleChat {
                        user_id,
                        opt_out,
                        socket_id,
                    })
                },
                "roulette.chat" => {
                    let content = envelope.payload.get("content")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    Some(RouletteCommand::Chat {
                        user_id,
                        username,
                        avatar_id: None,
                        content,
                        socket_id,
                    })
                },
                "roulette.broadcast_bets" => {
                    let spin_id = envelope.payload.get("spin_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let bets = envelope.payload.get("bets")
                        .and_then(|v| serde_json::from_value(v.clone()).ok())
                        .unwrap_or_default();
                    Some(RouletteCommand::BroadcastBets {
                        user_id,
                        username,
                        spin_id,
                        bets,
                        socket_id,
                    })
                },
                _ => None,
            };

            if let Some(cmd) = command {
                info!(
                    command_type = envelope.event_type.as_str(),
                    user_id = %user_id,
                    "Constructed command from envelope"
                );
                return self.handle_command(cmd).await;
            }
        }

        // Not a roulette event, skip
        Err(EventHandlerError::Skip)
    }

    fn topics(&self) -> Vec<&'static str> {
        vec![topic::ROULETTE_TICKS, topic::ROULETTE_COMMANDS]
    }

    fn name(&self) -> &'static str {
        "RouletteCommandHandler"
    }
}
