//! Bigger Dice game logic
//!
//! Rules:
//! - 2 players take turns rolling a single die (1-6)
//! - Each round, both players roll once
//! - Higher roll wins the round and gets 1 point
//! - Ties: both players re-roll until there's a winner
//! - First to reach 10 points wins the game

use super::types::{GameEvent, GameRoom, GameTurn, RoomStatus};
use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};
use tracing::info;

/// Win score for Bigger Dice
pub const WIN_SCORE: i32 = 10;

/// Bigger Dice round state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiggerDiceRoundState {
    pub round_number: i32,
    pub player1_roll: Option<i32>,
    pub player2_roll: Option<i32>,
    pub waiting_for_player: Option<i64>,
    pub last_player1_roll: Option<i32>,
    pub last_player2_roll: Option<i32>,
}

impl Default for BiggerDiceRoundState {
    fn default() -> Self {
        Self {
            round_number: 1,
            player1_roll: None,
            player2_roll: None,
            waiting_for_player: None,
            last_player1_roll: None,
            last_player2_roll: None,
        }
    }
}

/// Roll a die (1-6)
pub fn roll_die() -> i32 {
    let mut rng = rand::thread_rng();
    rng.gen_range(1..=6)
}

/// Process a dice roll for a player
/// Returns (events, game_ended)
pub fn process_roll(
    room: &mut GameRoom,
    round_state: &mut BiggerDiceRoundState,
    player_id: i64,
) -> (Vec<GameEvent>, bool) {
    let mut events = Vec::new();

    // Validate it's this player's turn
    if room.current_turn != Some(player_id) {
        return (events, false);
    }

    // Roll the die
    let roll = roll_die();

    // Get player info
    let player = room.get_player_mut(player_id);
    if player.is_none() {
        return (events, false);
    }

    // Record the roll
    let is_player1 = room.players.get(0).map(|p| p.user_id) == Some(player_id);
    let player_username = room.get_player(player_id).map(|p| p.username.clone()).unwrap_or_default();

    if is_player1 {
        round_state.player1_roll = Some(roll);
        round_state.last_player1_roll = Some(roll);
    } else {
        round_state.player2_roll = Some(roll);
        round_state.last_player2_roll = Some(roll);
    }

    // Emit roll event
    events.push(GameEvent::BiggerDiceRolled {
        room_id: room.room_id.clone(),
        player_id,
        player_username: player_username.clone(),
        roll,
        new_score: room.get_player(player_id).map(|p| p.score).unwrap_or(0),
    });

    info!(
        room_id = %room.room_id,
        player_id = %player_id,
        roll = %roll,
        "Bigger Dice: Player rolled"
    );

    // Check if both players have rolled
    if round_state.player1_roll.is_some() && round_state.player2_roll.is_some() {
        let p1_roll = round_state.player1_roll.unwrap();
        let p2_roll = round_state.player2_roll.unwrap();
        let player1_id = room.players.get(0).map(|p| p.user_id).unwrap_or(0);
        let player2_id = room.players.get(1).map(|p| p.user_id).unwrap_or(0);

        let (winner_id, is_tie) = if p1_roll > p2_roll {
            (Some(player1_id), false)
        } else if p2_roll > p1_roll {
            (Some(player2_id), false)
        } else {
            (None, true)
        };

        // Emit round result
        events.push(GameEvent::BiggerDiceRoundResult {
            room_id: room.room_id.clone(),
            player1_id,
            player1_roll: p1_roll,
            player2_id,
            player2_roll: p2_roll,
            winner_id,
            is_tie,
        });

        if let Some(winner) = winner_id {
            // Award point to winner
            if let Some(p) = room.get_player_mut(winner) {
                p.score += 1;
            }

            // Check for game end
            let winner_score = room.get_player(winner).map(|p| p.score).unwrap_or(0);
            if winner_score >= WIN_SCORE {
                // Game over!
                room.status = RoomStatus::Finished;
                room.winner_id = Some(winner);
                room.finished_at = Some(Utc::now());

                let winner_username = room.get_player(winner).map(|p| p.username.clone()).unwrap_or_default();
                let final_scores: Vec<(i64, String, i32)> = room.players
                    .iter()
                    .map(|p| (p.user_id, p.username.clone(), p.score))
                    .collect();

                events.push(GameEvent::GameEnded {
                    room_id: room.room_id.clone(),
                    winner_id: winner,
                    winner_username,
                    final_scores,
                });

                return (events, true);
            }

            // Start new round - winner goes first
            round_state.round_number += 1;
            round_state.player1_roll = None;
            round_state.player2_roll = None;
            round_state.waiting_for_player = None;

            room.turn_number += 1;
            room.current_turn = Some(player1_id); // Player 1 always starts each round

            events.push(GameEvent::TurnChanged {
                room_id: room.room_id.clone(),
                current_turn: player1_id,
                turn_number: room.turn_number,
            });
        } else {
            // Tie - both players re-roll
            round_state.player1_roll = None;
            round_state.player2_roll = None;
            round_state.waiting_for_player = None;

            room.current_turn = Some(player1_id);

            events.push(GameEvent::TurnChanged {
                room_id: room.room_id.clone(),
                current_turn: player1_id,
                turn_number: room.turn_number,
            });
        }
    } else {
        // Switch to other player
        let other_player = if is_player1 {
            room.players.get(1).map(|p| p.user_id)
        } else {
            room.players.get(0).map(|p| p.user_id)
        };

        if let Some(other_id) = other_player {
            room.current_turn = Some(other_id);
            round_state.waiting_for_player = Some(other_id);

            events.push(GameEvent::TurnChanged {
                room_id: room.room_id.clone(),
                current_turn: other_id,
                turn_number: room.turn_number,
            });
        }
    }

    (events, false)
}

/// Start a new Bigger Dice game
pub fn start_game(room: &mut GameRoom) -> Vec<GameEvent> {
    let mut events = Vec::new();

    if room.players.len() != 2 {
        return events;
    }

    // Reset scores
    for player in &mut room.players {
        player.score = 0;
    }

    room.status = RoomStatus::InProgress;
    room.started_at = Some(Utc::now());
    room.turn_number = 1;

    // Randomly pick who goes first
    let mut rng = rand::thread_rng();
    let first_player_idx = rng.gen_range(0..2);
    let first_player = room.players[first_player_idx].user_id;
    room.current_turn = Some(first_player);

    events.push(GameEvent::GameStarted {
        room_id: room.room_id.clone(),
        players: room.players.clone(),
        first_turn: first_player,
    });

    events.push(GameEvent::TurnChanged {
        room_id: room.room_id.clone(),
        current_turn: first_player,
        turn_number: 1,
    });

    info!(
        room_id = %room.room_id,
        first_player = %first_player,
        "Bigger Dice game started"
    );

    events
}

/// Create a game turn record for history
pub fn create_turn_record(
    turn_number: i32,
    player_id: i64,
    roll: i32,
    round_result: Option<&str>,
) -> GameTurn {
    GameTurn {
        turn_number,
        player_id,
        action: serde_json::json!({
            "type": "roll",
            "roll": roll,
            "round_result": round_result,
        }),
        timestamp: Utc::now(),
    }
}
