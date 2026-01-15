//! Chat module
//!
//! This module handles chat functionality including:
//! - Private messages (stored in MongoDB)
//! - Public lobby messages (stored in PostgreSQL)
//! - Kafka command handlers for WebSocket gateway

pub mod mongodb_chat;
pub mod types;
