//! Games module
//!
//! This module handles game functionality including:
//! - Game room management (via WebSocket gateway + Redis)
//! - Game state transitions
//! - Game history (stored in MongoDB)
//! - Game chat (stored in MongoDB with channel separation)
//! - Kafka handlers for game commands from WebSocket gateway
//! - Roulette game logic and history

pub mod bigger_dice;
pub mod mongodb_game_chat;
pub mod mongodb_games;
pub mod mongodb_roulette;
pub mod mongodb_roulette_multiplayer;
pub mod roulette;
pub mod roulette_types;
pub mod tic_tac_toe;
pub mod types;
