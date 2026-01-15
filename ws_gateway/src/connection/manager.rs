//! Connection manager for WebSocket Gateway
//!
//! Manages all active WebSocket connections and provides lookup functionality.

use dashmap::DashMap;
use std::collections::HashSet;
use std::sync::atomic::{AtomicUsize, Ordering};
use tracing::{debug, info};

use crate::protocol::ServerMessage;

use super::Connection;

/// Manages all active WebSocket connections
pub struct ConnectionManager {
    /// Map of connection ID to connection sender
    connections: DashMap<String, tokio::sync::mpsc::UnboundedSender<ServerMessage>>,

    /// Map of user ID to set of connection IDs
    user_connections: DashMap<String, HashSet<String>>,

    /// Map of room ID to set of connection IDs
    room_connections: DashMap<String, HashSet<String>>,

    /// Total connection count
    connection_count: AtomicUsize,
}

impl ConnectionManager {
    /// Create a new connection manager
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            user_connections: DashMap::new(),
            room_connections: DashMap::new(),
            connection_count: AtomicUsize::new(0),
        }
    }

    /// Register a new connection
    pub fn register(
        &self,
        connection_id: &str,
        user_id: Option<&str>,
        tx: tokio::sync::mpsc::UnboundedSender<ServerMessage>,
    ) {
        // Store connection sender
        self.connections.insert(connection_id.to_string(), tx);
        self.connection_count.fetch_add(1, Ordering::Relaxed);

        // Map user to connection if authenticated
        if let Some(uid) = user_id {
            self.user_connections
                .entry(uid.to_string())
                .or_insert_with(HashSet::new)
                .insert(connection_id.to_string());
        }

        debug!(
            "Registered connection {}, total: {}",
            connection_id,
            self.connection_count.load(Ordering::Relaxed)
        );
    }

    /// Update user mapping for a connection (after authentication)
    pub fn set_user(&self, connection_id: &str, user_id: &str) {
        self.user_connections
            .entry(user_id.to_string())
            .or_insert_with(HashSet::new)
            .insert(connection_id.to_string());

        debug!("Mapped connection {} to user {}", connection_id, user_id);
    }

    /// Unregister a connection
    pub fn unregister(&self, connection_id: &str, user_id: Option<&str>) {
        // Remove connection sender
        self.connections.remove(connection_id);
        self.connection_count.fetch_sub(1, Ordering::Relaxed);

        // Remove from user mapping
        if let Some(uid) = user_id {
            if let Some(mut entry) = self.user_connections.get_mut(uid) {
                entry.remove(connection_id);
                if entry.is_empty() {
                    drop(entry);
                    self.user_connections.remove(uid);
                }
            }
        }

        // Remove from all rooms
        self.room_connections.iter_mut().for_each(|mut entry| {
            entry.remove(connection_id);
        });

        debug!(
            "Unregistered connection {}, total: {}",
            connection_id,
            self.connection_count.load(Ordering::Relaxed)
        );
    }

    /// Add connection to a room
    pub fn join_room(&self, connection_id: &str, room_id: &str) {
        self.room_connections
            .entry(room_id.to_string())
            .or_insert_with(HashSet::new)
            .insert(connection_id.to_string());

        debug!("Connection {} joined room {}", connection_id, room_id);
    }

    /// Remove connection from a room
    pub fn leave_room(&self, connection_id: &str, room_id: &str) {
        if let Some(mut entry) = self.room_connections.get_mut(room_id) {
            entry.remove(connection_id);
            if entry.is_empty() {
                drop(entry);
                self.room_connections.remove(room_id);
            }
        }

        debug!("Connection {} left room {}", connection_id, room_id);
    }

    /// Send message to a specific connection
    pub fn send_to_connection(&self, connection_id: &str, message: ServerMessage) -> bool {
        if let Some(tx) = self.connections.get(connection_id) {
            tx.send(message).is_ok()
        } else {
            false
        }
    }

    /// Send message to all connections of a user
    pub fn send_to_user(&self, user_id: &str, message: ServerMessage) -> usize {
        let mut sent = 0;
        if let Some(connections) = self.user_connections.get(user_id) {
            for conn_id in connections.iter() {
                if self.send_to_connection(conn_id, message.clone()) {
                    sent += 1;
                }
            }
        }
        sent
    }

    /// Send message to all connections in a room
    pub fn send_to_room(&self, room_id: &str, message: ServerMessage) -> usize {
        let mut sent = 0;
        if let Some(connections) = self.room_connections.get(room_id) {
            for conn_id in connections.iter() {
                if self.send_to_connection(conn_id, message.clone()) {
                    sent += 1;
                }
            }
        }
        sent
    }

    /// Send message to all connections in a room except one
    pub fn send_to_room_except(
        &self,
        room_id: &str,
        message: ServerMessage,
        except_connection: &str,
    ) -> usize {
        let mut sent = 0;
        if let Some(connections) = self.room_connections.get(room_id) {
            for conn_id in connections.iter() {
                if conn_id != except_connection {
                    if self.send_to_connection(conn_id, message.clone()) {
                        sent += 1;
                    }
                }
            }
        }
        sent
    }

    /// Broadcast message to all connections
    pub fn broadcast(&self, message: ServerMessage) -> usize {
        let mut sent = 0;
        for entry in self.connections.iter() {
            if entry.send(message.clone()).is_ok() {
                sent += 1;
            }
        }
        sent
    }

    /// Get all connection IDs for a user
    pub fn get_user_connections(&self, user_id: &str) -> Vec<String> {
        self.user_connections
            .get(user_id)
            .map(|entry| entry.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Get all connection IDs in a room
    pub fn get_room_connections(&self, room_id: &str) -> Vec<String> {
        self.room_connections
            .get(room_id)
            .map(|entry| entry.iter().cloned().collect())
            .unwrap_or_default()
    }

    /// Get total connection count
    pub fn connection_count(&self) -> usize {
        self.connection_count.load(Ordering::Relaxed)
    }

    /// Get count of connections in a room
    pub fn room_connection_count(&self, room_id: &str) -> usize {
        self.room_connections
            .get(room_id)
            .map(|entry| entry.len())
            .unwrap_or(0)
    }

    /// Check if a connection exists
    pub fn has_connection(&self, connection_id: &str) -> bool {
        self.connections.contains_key(connection_id)
    }

    /// Check if a user is connected
    pub fn is_user_connected(&self, user_id: &str) -> bool {
        self.user_connections
            .get(user_id)
            .map(|entry| !entry.is_empty())
            .unwrap_or(false)
    }

    /// Get statistics
    pub fn stats(&self) -> ConnectionStats {
        ConnectionStats {
            total_connections: self.connection_count.load(Ordering::Relaxed),
            unique_users: self.user_connections.len(),
            active_rooms: self.room_connections.len(),
        }
    }
}

impl Default for ConnectionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Connection statistics
#[derive(Debug, Clone)]
pub struct ConnectionStats {
    pub total_connections: usize,
    pub unique_users: usize,
    pub active_rooms: usize,
}
