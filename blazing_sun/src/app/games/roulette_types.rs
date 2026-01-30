//! Multiplayer Roulette Types
//!
//! Type definitions for the multiplayer roulette game:
//! - Tick events from ws_gateway (countdown, phase changes)
//! - Commands from clients (bets, join, leave, chat)
//! - Events to clients (confirmations, results, payouts)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::roulette::RouletteBet;
use super::types::{deserialize_i64_from_string, serialize_i64_as_string, Audience, EventEnvelope};

// =============================================================================
// Constants
// =============================================================================

/// Duration of a full betting cycle in seconds
pub const CYCLE_DURATION_SECONDS: u32 = 120;

/// Seconds remaining when betting is blocked (animation starts)
pub const BLOCK_BETS_AT_SECONDS: u32 = 5;

/// Number of recent spins to show in history bar
pub const HISTORY_BAR_SIZE: usize = 30;

/// Balance unit: 100 balance = 1 coin
pub const BALANCE_TO_COIN_RATIO: i64 = 100;

// =============================================================================
// Tick Phase
// =============================================================================

/// Current phase of the roulette cycle
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RoulettePhase {
    /// Users can place bets freely (120-6 seconds remaining)
    Betting,
    /// Bets blocked, animation playing (5-1 seconds remaining)
    Animation,
    /// Ball released, determining winner (0 seconds)
    Spinning,
    /// Results being calculated and paid out
    Payout,
}

impl Default for RoulettePhase {
    fn default() -> Self {
        RoulettePhase::Betting
    }
}

// =============================================================================
// Tick Events (from ws_gateway)
// =============================================================================

/// Tick event from ws_gateway
/// Sent every second during the betting cycle
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteTick {
    /// Event type identifier for routing
    #[serde(default = "default_tick_event_type")]
    pub event_type: String,
    /// Current spin ID (UUID for this cycle)
    pub spin_id: String,
    /// Seconds remaining in this cycle (120 -> 0)
    pub seconds_remaining: u32,
    /// Current phase
    pub phase: RoulettePhase,
    /// Whether betting is blocked
    pub block_bets: bool,
    /// Timestamp of this tick
    pub timestamp: DateTime<Utc>,
}

fn default_tick_event_type() -> String {
    "roulette.tick".to_string()
}

impl RouletteTick {
    /// Create a new tick
    pub fn new(spin_id: &str, seconds_remaining: u32) -> Self {
        let phase = if seconds_remaining > BLOCK_BETS_AT_SECONDS {
            RoulettePhase::Betting
        } else if seconds_remaining > 0 {
            RoulettePhase::Animation
        } else {
            RoulettePhase::Spinning
        };

        let block_bets = seconds_remaining <= BLOCK_BETS_AT_SECONDS;

        Self {
            event_type: "roulette.tick".to_string(),
            spin_id: spin_id.to_string(),
            seconds_remaining,
            phase,
            block_bets,
            timestamp: Utc::now(),
        }
    }
}

// =============================================================================
// Commands (from clients via ws_gateway)
// =============================================================================

/// A single bet number entry with amount
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BetNumber {
    /// The number being bet on (0-36, or "00")
    pub number: String,
    /// Amount bet on this number (in balance units, 1000 = 1 coin)
    pub amount: i64,
}

/// Client command for multiplayer roulette
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RouletteCommand {
    /// User joins the roulette table
    #[serde(rename = "roulette.join")]
    Join {
        #[serde(
            serialize_with = "serialize_i64_as_string",
            deserialize_with = "deserialize_i64_from_string"
        )]
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        socket_id: String,
    },

    /// User leaves the roulette table
    #[serde(rename = "roulette.leave")]
    Leave {
        #[serde(
            serialize_with = "serialize_i64_as_string",
            deserialize_with = "deserialize_i64_from_string"
        )]
        user_id: i64,
        socket_id: String,
    },

    /// User broadcasts their bets (at 5 seconds remaining)
    /// Bets are validated, balance deducted, and stored
    #[serde(rename = "roulette.broadcast_bets")]
    BroadcastBets {
        #[serde(
            serialize_with = "serialize_i64_as_string",
            deserialize_with = "deserialize_i64_from_string"
        )]
        user_id: i64,
        username: String,
        /// Current spin ID (must match server's current spin)
        spin_id: String,
        /// The bets being placed (using existing RouletteBet structure)
        bets: Vec<RouletteBet>,
        socket_id: String,
    },

    /// User sends a chat message
    #[serde(rename = "roulette.chat")]
    Chat {
        #[serde(
            serialize_with = "serialize_i64_as_string",
            deserialize_with = "deserialize_i64_from_string"
        )]
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        content: String,
        socket_id: String,
    },

    /// User toggles chat opt-out (won't receive chat messages)
    #[serde(rename = "roulette.toggle_chat")]
    ToggleChat {
        #[serde(
            serialize_with = "serialize_i64_as_string",
            deserialize_with = "deserialize_i64_from_string"
        )]
        user_id: i64,
        /// true = opt out of chat, false = opt in
        opt_out: bool,
        socket_id: String,
    },

    /// Request current state (for reconnection)
    #[serde(rename = "roulette.get_state")]
    GetState {
        #[serde(
            serialize_with = "serialize_i64_as_string",
            deserialize_with = "deserialize_i64_from_string"
        )]
        user_id: i64,
        socket_id: String,
    },
}

// =============================================================================
// Events (to clients via ws_gateway)
// =============================================================================

/// Connected user info (for state sync)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteUser {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub chat_opt_out: bool,
}

/// Spin result summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpinResultSummary {
    pub spin_id: String,
    pub winning_number: String,
    pub winning_color: String,
    pub timestamp: DateTime<Utc>,
}

/// Event to send to clients via ws_gateway
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RouletteEvent {
    /// Tick event broadcast to all connected users
    #[serde(rename = "roulette.tick")]
    Tick {
        spin_id: String,
        seconds_remaining: u32,
        phase: RoulettePhase,
        block_bets: bool,
        connected_count: u32,
    },

    /// User joined the table
    #[serde(rename = "roulette.user_joined")]
    UserJoined {
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        connected_count: u32,
    },

    /// User left the table
    #[serde(rename = "roulette.user_left")]
    UserLeft {
        user_id: i64,
        username: String,
        connected_count: u32,
    },

    /// Bet confirmed (sent to the user who placed it)
    #[serde(rename = "roulette.bet_confirmed")]
    BetConfirmed {
        user_id: i64,
        spin_id: String,
        total_amount: i64,
        new_balance: i64,
    },

    /// Bet rejected (sent to the user who tried to place it)
    #[serde(rename = "roulette.bet_rejected")]
    BetRejected {
        user_id: i64,
        spin_id: String,
        reason: String,
    },

    /// Spin result (broadcast to all users)
    #[serde(rename = "roulette.spin_result")]
    SpinResult {
        spin_id: String,
        winning_number: String,
        winning_color: String,
        winning_parity: String,
        /// Total bets placed across all users
        total_bets_amount: i64,
        /// Total payouts across all users
        total_payouts: i64,
    },

    /// Individual payout (sent to users who won)
    #[serde(rename = "roulette.payout")]
    Payout {
        user_id: i64,
        spin_id: String,
        /// Total amount won
        payout_amount: i64,
        /// New balance after payout
        new_balance: i64,
        /// Breakdown by bet
        bet_results: Vec<BetResultInfo>,
    },

    /// Chat message
    #[serde(rename = "roulette.chat")]
    Chat {
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        content: String,
        timestamp: String,
        is_system: bool,
    },

    /// Current state (sent on join/reconnect)
    #[serde(rename = "roulette.state")]
    State {
        spin_id: String,
        seconds_remaining: u32,
        phase: RoulettePhase,
        block_bets: bool,
        connected_count: u32,
        /// Recent spin history (last 20)
        history: Vec<SpinResultSummary>,
        /// User's pending bets for current spin (if any)
        pending_bets: Option<Vec<RouletteBet>>,
        /// User's balance
        balance: i64,
    },

    /// Error event (sent to specific user)
    #[serde(rename = "roulette.error")]
    Error {
        code: String,
        message: String,
        socket_id: String,
    },
}

/// Bet result info for payout breakdown
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BetResultInfo {
    pub bet_type: String,
    pub numbers: Vec<String>,
    pub amount: i64,
    pub won: bool,
    pub payout: i64,
}

impl RouletteEvent {
    /// Get the event type name for envelope
    pub fn event_type_name(&self) -> &'static str {
        match self {
            RouletteEvent::Tick { .. } => "roulette.tick",
            RouletteEvent::UserJoined { .. } => "roulette.user_joined",
            RouletteEvent::UserLeft { .. } => "roulette.user_left",
            RouletteEvent::BetConfirmed { .. } => "roulette.bet_confirmed",
            RouletteEvent::BetRejected { .. } => "roulette.bet_rejected",
            RouletteEvent::SpinResult { .. } => "roulette.spin_result",
            RouletteEvent::Payout { .. } => "roulette.payout",
            RouletteEvent::Chat { .. } => "roulette.chat",
            RouletteEvent::State { .. } => "roulette.state",
            RouletteEvent::Error { .. } => "roulette.error",
        }
    }

    /// Create an EventEnvelope for this event
    pub fn to_envelope(
        &self,
        event_id: &str,
        actor_user_id: i64,
        actor_username: &str,
        actor_socket_id: &str,
        audience: Audience,
    ) -> EventEnvelope {
        EventEnvelope {
            event_id: event_id.to_string(),
            event_type: format!("roulette.event.{}", self.event_type_name()),
            timestamp: Utc::now().to_rfc3339(),
            correlation_id: None,
            producer: "blazing_sun".to_string(),
            actor: super::types::Actor {
                user_id: actor_user_id,
                username: actor_username.to_string(),
                socket_id: actor_socket_id.to_string(),
                roles: vec![],
            },
            audience,
            payload: serde_json::to_value(self).unwrap_or_default(),
        }
    }
}

// =============================================================================
// State Management
// =============================================================================

/// Current spin state (in-memory, not persisted)
#[derive(Debug, Clone)]
pub struct CurrentSpinState {
    /// Unique ID for this spin cycle
    pub spin_id: String,
    /// Seconds remaining (countdown from 120 to 0)
    pub seconds_remaining: u32,
    /// Current phase
    pub phase: RoulettePhase,
    /// Whether we've already processed the spin result
    pub result_processed: bool,
    /// Whether the result has been announced and board should be unblocked
    pub result_announced: bool,
    /// Winning number (set when spin completes)
    pub winning_number: Option<String>,
    /// Winning color (set when spin completes)
    pub winning_color: Option<String>,
    /// When this spin started
    pub started_at: DateTime<Utc>,
}

impl CurrentSpinState {
    /// Create a new spin state
    pub fn new(spin_id: &str) -> Self {
        Self {
            spin_id: spin_id.to_string(),
            seconds_remaining: CYCLE_DURATION_SECONDS,
            phase: RoulettePhase::Betting,
            result_processed: false,
            result_announced: false,
            winning_number: None,
            winning_color: None,
            started_at: Utc::now(),
        }
    }

    /// Update state based on tick
    pub fn update_from_tick(&mut self, tick: &RouletteTick) {
        self.seconds_remaining = tick.seconds_remaining;
        self.phase = tick.phase.clone();
    }

    /// Check if betting is currently allowed
    pub fn is_betting_allowed(&self) -> bool {
        matches!(self.phase, RoulettePhase::Betting) && self.seconds_remaining > BLOCK_BETS_AT_SECONDS
    }

    /// Check if bets should be blocked
    /// Returns false (unblocked) if result has been announced
    /// Returns true (blocked) if seconds_remaining <= 5 and result not yet announced
    pub fn should_block_bets(&self) -> bool {
        if self.result_announced {
            // After result is announced, board is unblocked for next round betting
            false
        } else {
            // Block bets at 5 seconds or less
            self.seconds_remaining <= BLOCK_BETS_AT_SECONDS
        }
    }
}

/// Connected user state (in-memory)
#[derive(Debug, Clone)]
pub struct ConnectedUser {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub socket_id: String,
    pub chat_opt_out: bool,
    pub connected_at: DateTime<Utc>,
}

impl ConnectedUser {
    pub fn new(user_id: i64, username: &str, avatar_id: Option<i64>, socket_id: &str) -> Self {
        Self {
            user_id,
            username: username.to_string(),
            avatar_id,
            socket_id: socket_id.to_string(),
            chat_opt_out: false,
            connected_at: Utc::now(),
        }
    }
}

// =============================================================================
// MongoDB Types
// =============================================================================

/// Roulette bet record (stored in MongoDB)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteBetRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<mongodb::bson::oid::ObjectId>,
    /// User who placed the bet
    pub user_id: i64,
    /// Username for display
    pub username: String,
    /// Spin ID this bet belongs to
    pub spin_id: String,
    /// The bets placed
    pub bets: Vec<RouletteBet>,
    /// Total amount of all bets
    pub total_amount: i64,
    /// When the bet was placed
    pub created_at: DateTime<Utc>,
    /// Whether this bet has been processed
    pub processed: bool,
    /// Payout amount (set after spin)
    pub payout: Option<i64>,
}

/// Roulette spin record (stored in MongoDB)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteSpinRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<mongodb::bson::oid::ObjectId>,
    /// Unique spin ID
    pub spin_id: String,
    /// Winning number
    pub winning_number: String,
    /// Winning color
    pub winning_color: String,
    /// Winning parity (odd/even/none)
    pub winning_parity: String,
    /// Total amount bet across all users
    pub total_bets_amount: i64,
    /// Total payouts across all users
    pub total_payouts: i64,
    /// Number of users who bet
    pub bet_count: i32,
    /// When the spin occurred
    pub created_at: DateTime<Utc>,
}

/// Roulette chat message record (stored in MongoDB)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteChatRecord {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<mongodb::bson::oid::ObjectId>,
    /// User who sent the message
    pub user_id: i64,
    /// Username
    pub username: String,
    /// Avatar ID
    pub avatar_id: Option<i64>,
    /// Message content
    pub content: String,
    /// Whether this is a system message
    pub is_system: bool,
    /// When the message was sent
    pub created_at: DateTime<Utc>,
}

// =============================================================================
// Kafka Payment Events
// =============================================================================

/// Event for bet payment (balance deducted)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouletteBetPayedEvent {
    pub user_id: i64,
    pub spin_id: String,
    pub amount: i64,
    pub timestamp: DateTime<Utc>,
}

/// Event for payout (winnings credited)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoulettePayoutEvent {
    pub user_id: i64,
    pub spin_id: String,
    pub bet_amount: i64,
    pub payout_amount: i64,
    pub winning_number: String,
    pub timestamp: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tick_phase_betting() {
        let tick = RouletteTick::new("test-spin", 60);
        assert_eq!(tick.phase, RoulettePhase::Betting);
        assert!(!tick.block_bets);
    }

    #[test]
    fn test_tick_phase_animation() {
        let tick = RouletteTick::new("test-spin", 5);
        assert_eq!(tick.phase, RoulettePhase::Animation);
        assert!(tick.block_bets);
    }

    #[test]
    fn test_tick_phase_spinning() {
        let tick = RouletteTick::new("test-spin", 0);
        assert_eq!(tick.phase, RoulettePhase::Spinning);
        assert!(tick.block_bets);
    }

    #[test]
    fn test_spin_state_betting_allowed() {
        let mut state = CurrentSpinState::new("test");
        state.seconds_remaining = 60;
        state.phase = RoulettePhase::Betting;
        assert!(state.is_betting_allowed());

        state.seconds_remaining = 5;
        assert!(!state.is_betting_allowed());
    }

    #[test]
    fn test_command_serialization() {
        let cmd = RouletteCommand::Join {
            user_id: 123,
            username: "testuser".to_string(),
            avatar_id: Some(1),
            socket_id: "sock-1".to_string(),
        };

        let json = serde_json::to_string(&cmd).unwrap();
        assert!(json.contains("roulette.join"));
        assert!(json.contains("testuser"));
    }

    #[test]
    fn test_event_type_name() {
        let event = RouletteEvent::Tick {
            spin_id: "test".to_string(),
            seconds_remaining: 60,
            phase: RoulettePhase::Betting,
            block_bets: false,
            connected_count: 5,
        };
        assert_eq!(event.event_type_name(), "roulette.tick");
    }
}
