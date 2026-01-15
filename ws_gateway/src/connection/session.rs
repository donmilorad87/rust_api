//! WebSocket connection session

use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use chrono::{DateTime, Utc};
use tokio::sync::mpsc;
use uuid::Uuid;

use crate::auth::AuthenticatedUser;
use crate::protocol::ServerMessage;

/// Connection state
#[derive(Debug, Clone, PartialEq)]
pub enum ConnectionState {
    /// Just connected, awaiting authentication
    Anonymous,
    /// Successfully authenticated
    Authenticated,
    /// Connection closed
    Closed,
}

/// Rate limiter for a connection
pub struct RateLimiter {
    tokens: AtomicU64,
    max_tokens: u64,
    refill_rate: u64,
    last_refill: std::sync::Mutex<std::time::Instant>,
}

impl RateLimiter {
    pub fn new(max_tokens: u64, refill_rate: u64) -> Self {
        Self {
            tokens: AtomicU64::new(max_tokens),
            max_tokens,
            refill_rate,
            last_refill: std::sync::Mutex::new(std::time::Instant::now()),
        }
    }

    /// Try to consume a token, returns true if allowed
    pub fn try_consume(&self) -> bool {
        // Refill tokens based on elapsed time
        let mut last = self.last_refill.lock().unwrap();
        let elapsed = last.elapsed().as_secs();
        if elapsed > 0 {
            let refill = elapsed * self.refill_rate;
            let current = self.tokens.load(Ordering::Relaxed);
            let new_tokens = (current + refill).min(self.max_tokens);
            self.tokens.store(new_tokens, Ordering::Relaxed);
            *last = std::time::Instant::now();
        }

        // Try to consume a token
        loop {
            let current = self.tokens.load(Ordering::Relaxed);
            if current == 0 {
                return false;
            }
            if self.tokens.compare_exchange(
                current,
                current - 1,
                Ordering::SeqCst,
                Ordering::Relaxed,
            ).is_ok() {
                return true;
            }
        }
    }
}

/// Represents a single WebSocket connection
pub struct Connection {
    /// Unique connection ID
    pub id: String,

    /// Remote address
    pub addr: SocketAddr,

    /// Connection state
    pub state: ConnectionState,

    /// Authenticated user (if authenticated)
    pub user: Option<AuthenticatedUser>,

    /// Connected timestamp
    pub connected_at: DateTime<Utc>,

    /// Last activity timestamp
    pub last_activity: DateTime<Utc>,

    /// Sender for outgoing messages
    pub tx: mpsc::UnboundedSender<ServerMessage>,

    /// Rate limiter
    rate_limiter: RateLimiter,

    /// Rooms this connection is subscribed to
    pub rooms: Vec<String>,
}

impl Connection {
    /// Create a new anonymous connection
    pub fn new(
        addr: SocketAddr,
        tx: mpsc::UnboundedSender<ServerMessage>,
        rate_limit_per_sec: u32,
        rate_limit_burst: u32,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4().to_string(),
            addr,
            state: ConnectionState::Anonymous,
            user: None,
            connected_at: now,
            last_activity: now,
            tx,
            rate_limiter: RateLimiter::new(rate_limit_burst as u64, rate_limit_per_sec as u64),
            rooms: Vec::new(),
        }
    }

    /// Get connection ID
    pub fn id(&self) -> &str {
        &self.id
    }

    /// Check if connection is authenticated
    pub fn is_authenticated(&self) -> bool {
        self.state == ConnectionState::Authenticated
    }

    /// Get user ID if authenticated
    pub fn user_id(&self) -> Option<&str> {
        self.user.as_ref().map(|u| u.user_id.as_str())
    }

    /// Get username if authenticated
    pub fn username(&self) -> Option<&str> {
        self.user.as_ref().map(|u| u.username.as_str())
    }

    /// Authenticate the connection
    pub fn authenticate(&mut self, user: AuthenticatedUser) {
        self.user = Some(user);
        self.state = ConnectionState::Authenticated;
        self.last_activity = Utc::now();
    }

    /// Update last activity
    pub fn touch(&mut self) {
        self.last_activity = Utc::now();
    }

    /// Close the connection
    pub fn close(&mut self) {
        self.state = ConnectionState::Closed;
    }

    /// Check rate limit
    pub fn check_rate_limit(&self) -> bool {
        self.rate_limiter.try_consume()
    }

    /// Send a message to this connection
    pub fn send(&self, message: ServerMessage) -> bool {
        self.tx.send(message).is_ok()
    }

    /// Join a room
    pub fn join_room(&mut self, room_id: &str) {
        if !self.rooms.contains(&room_id.to_string()) {
            self.rooms.push(room_id.to_string());
        }
    }

    /// Leave a room
    pub fn leave_room(&mut self, room_id: &str) {
        self.rooms.retain(|r| r != room_id);
    }

    /// Check if connection is in a room
    pub fn is_in_room(&self, room_id: &str) -> bool {
        self.rooms.contains(&room_id.to_string())
    }
}
