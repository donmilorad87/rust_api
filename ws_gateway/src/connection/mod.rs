//! Connection management for WebSocket Gateway

mod manager;
mod session;

pub use manager::ConnectionManager;
pub use session::{Connection, ConnectionState};

use std::sync::Arc;

/// Shared connection manager
pub type SharedConnectionManager = Arc<ConnectionManager>;
