//! Bigger Dice game logic
//!
//! Rules:
//! - N players (2-10) take turns rolling a single die (1-6)
//! - Each round, all active players roll once
//! - After all players roll, compare all rolls to find highest
//! - If ONE player has highest roll, they get 1 point and new round starts
//! - If MULTIPLE players tie for highest, only those players enter a tiebreaker
//! - In tiebreaker, only tied players roll again
//! - Repeat tiebreaker until one clear winner emerges
//! - Award the point to the tiebreaker winner
//! - First to reach 10 points wins the game

use super::types::{GameEvent, GameRoom, GameTurn, RoomStatus};
use chrono::Utc;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::info;

/// Win score for Bigger Dice
pub const WIN_SCORE: i32 = 10;

/// Maximum number of tiebreaker iterations to prevent infinite loops
const MAX_TIEBREAKER_ITERATIONS: i32 = 100;

/// Bigger Dice round state for N players
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiggerDiceRoundState {
    /// Current round number (increments after each point is awarded)
    pub round_number: i32,
    /// Rolls for current round: player_id -> roll value
    pub current_round_rolls: HashMap<i64, i32>,
    /// Players who need to roll in this round (all players or tiebreaker subset)
    pub active_rollers: Vec<i64>,
    /// Index of current roller in active_rollers
    pub current_roller_index: usize,
    /// Whether we are in a tiebreaker sub-round
    pub is_tiebreaker: bool,
    /// Tiebreaker iteration count (for safety limit)
    pub tiebreaker_iteration: i32,
    /// Last completed round's rolls for display (player_id -> roll)
    pub last_round_rolls: HashMap<i64, i32>,
}

impl Default for BiggerDiceRoundState {
    fn default() -> Self {
        Self {
            round_number: 1,
            current_round_rolls: HashMap::new(),
            active_rollers: Vec::new(),
            current_roller_index: 0,
            is_tiebreaker: false,
            tiebreaker_iteration: 0,
            last_round_rolls: HashMap::new(),
        }
    }
}

impl BiggerDiceRoundState {
    /// Initialize round state with all players as active rollers
    pub fn initialize(&mut self, players: &[i64]) {
        self.current_round_rolls.clear();
        self.active_rollers = players.to_vec();
        self.current_roller_index = 0;
        self.is_tiebreaker = false;
        self.tiebreaker_iteration = 0;
    }

    /// Start a new round (after point is awarded)
    pub fn start_new_round(&mut self, players: &[i64]) {
        self.round_number += 1;
        self.last_round_rolls = self.current_round_rolls.clone();
        self.current_round_rolls.clear();
        self.active_rollers = players.to_vec();
        self.current_roller_index = 0;
        self.is_tiebreaker = false;
        self.tiebreaker_iteration = 0;
    }

    /// Start a tiebreaker with only the tied players
    pub fn start_tiebreaker(&mut self, tied_players: Vec<i64>) {
        self.last_round_rolls = self.current_round_rolls.clone();
        self.current_round_rolls.clear();
        self.active_rollers = tied_players;
        self.current_roller_index = 0;
        self.is_tiebreaker = true;
        self.tiebreaker_iteration += 1;
    }

    /// Get current roller (the player whose turn it is)
    pub fn current_roller(&self) -> Option<i64> {
        self.active_rollers.get(self.current_roller_index).copied()
    }

    /// Record a roll and advance to next roller
    pub fn record_roll(&mut self, player_id: i64, roll: i32) {
        self.current_round_rolls.insert(player_id, roll);
        self.current_roller_index += 1;
    }

    /// Check if all active rollers have rolled
    pub fn all_rolled(&self) -> bool {
        self.current_roller_index >= self.active_rollers.len()
    }

    /// Check if tiebreaker safety limit exceeded
    pub fn tiebreaker_limit_exceeded(&self) -> bool {
        self.tiebreaker_iteration >= MAX_TIEBREAKER_ITERATIONS
    }
}

/// Roll a die (1-6)
pub fn roll_die() -> i32 {
    let mut rng = rand::thread_rng();
    rng.gen_range(1..=6)
}

/// Find players with the highest roll from a set of rolls
/// Returns (highest_roll, vec of player_ids who rolled that value)
/// The returned players are in the same order as `roll_order` (original roll sequence)
fn find_highest_rollers(rolls: &HashMap<i64, i32>, roll_order: &[i64]) -> (i32, Vec<i64>) {
    if rolls.is_empty() {
        return (0, Vec::new());
    }

    let max_roll = rolls.values().copied().max().unwrap_or(0);

    // Filter players who have the highest roll, preserving original roll order
    let highest_players: Vec<i64> = roll_order
        .iter()
        .filter(|&player_id| rolls.get(player_id).copied() == Some(max_roll))
        .copied()
        .collect();

    (max_roll, highest_players)
}

/// Process a dice roll for a player in N-player mode
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

    // Validate player is in active rollers
    if !round_state.active_rollers.contains(&player_id) {
        return (events, false);
    }

    // Get player info
    let player_username = match room.get_player(player_id) {
        Some(p) => p.username.clone(),
        None => return (events, false),
    };

    // Roll the die
    let roll = roll_die();

    // Record the roll
    round_state.record_roll(player_id, roll);

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
        is_tiebreaker = %round_state.is_tiebreaker,
        active_rollers = ?round_state.active_rollers,
        rolls_so_far = ?round_state.current_round_rolls,
        "Bigger Dice: Player rolled"
    );

    // Check if all active rollers have rolled
    if round_state.all_rolled() {
        // Evaluate the round
        let (round_events, game_ended) = evaluate_round(room, round_state);
        events.extend(round_events);

        if game_ended {
            return (events, true);
        }
    } else {
        // Move to next roller
        if let Some(next_roller) = round_state.current_roller() {
            room.current_turn = Some(next_roller);
            room.turn_number += 1;

            events.push(GameEvent::TurnChanged {
                room_id: room.room_id.clone(),
                current_turn: next_roller,
                turn_number: room.turn_number,
            });
        }
    }

    (events, false)
}

/// Evaluate the round after all active rollers have rolled
/// Returns (events, game_ended)
fn evaluate_round(
    room: &mut GameRoom,
    round_state: &mut BiggerDiceRoundState,
) -> (Vec<GameEvent>, bool) {
    let mut events = Vec::new();

    // Find the highest rollers (preserving original roll order for tiebreakers)
    let (highest_roll, highest_players) = find_highest_rollers(
        &round_state.current_round_rolls,
        &round_state.active_rollers,
    );

    // Build rolls data for the event
    let rolls: Vec<(i64, i32)> = round_state
        .current_round_rolls
        .iter()
        .map(|(&pid, &roll)| (pid, roll))
        .collect();

    // Determine result
    let is_tie = highest_players.len() > 1;
    let winner_id = if highest_players.len() == 1 {
        Some(highest_players[0])
    } else {
        None
    };

    // If there's a single winner, award the point BEFORE creating the event
    // This ensures the scores in the event reflect the updated state
    if let Some(winner) = winner_id {
        if let Some(p) = room.get_player_mut(winner) {
            p.score += 1;
        }
    }

    // Build authoritative scores for all players (after point is awarded)
    let scores: Vec<(i64, i32)> = room
        .players
        .iter()
        .map(|p| (p.user_id, p.score))
        .collect();

    // Emit round result event with authoritative scores
    events.push(GameEvent::BiggerDiceRoundResult {
        room_id: room.room_id.clone(),
        rolls: rolls.clone(),
        winner_id,
        is_tie,
        is_tiebreaker: round_state.is_tiebreaker,
        tiebreaker_players: if is_tie { highest_players.clone() } else { Vec::new() },
        scores,
    });

    info!(
        room_id = %room.room_id,
        highest_roll = %highest_roll,
        highest_players = ?highest_players,
        is_tie = %is_tie,
        is_tiebreaker = %round_state.is_tiebreaker,
        "Bigger Dice: Round evaluated"
    );

    if let Some(winner) = winner_id {
        // Point was already awarded before creating the round result event
        let winner_score = room.get_player(winner).map(|p| p.score).unwrap_or(0);

        info!(
            room_id = %room.room_id,
            winner_id = %winner,
            winner_score = %winner_score,
            "Bigger Dice: Point awarded"
        );

        // Check for game end
        if winner_score >= WIN_SCORE {
            // Game over
            room.status = RoomStatus::Finished;
            room.winner_id = Some(winner);
            room.finished_at = Some(Utc::now());

            let winner_username = room
                .get_player(winner)
                .map(|p| p.username.clone())
                .unwrap_or_default();
            let final_scores: Vec<(i64, String, i32)> = room
                .players
                .iter()
                .map(|p| (p.user_id, p.username.clone(), p.score))
                .collect();

            events.push(GameEvent::BiggerDiceGameOver {
                room_id: room.room_id.clone(),
                winner_id: winner,
                winner_username,
                final_scores,
            });

            return (events, true);
        }

        // Start new round with all players
        let all_players: Vec<i64> = room.players.iter().map(|p| p.user_id).collect();
        round_state.start_new_round(&all_players);

        // First player in list starts the new round
        if let Some(first_roller) = round_state.current_roller() {
            room.current_turn = Some(first_roller);
            room.turn_number += 1;

            events.push(GameEvent::TurnChanged {
                room_id: room.room_id.clone(),
                current_turn: first_roller,
                turn_number: room.turn_number,
            });
        }
    } else {
        // Tie - start tiebreaker with only the tied players
        if round_state.tiebreaker_limit_exceeded() {
            // Safety limit exceeded - pick random winner from tied players
            let random_winner = highest_players[0]; // Just pick first one
            if let Some(p) = room.get_player_mut(random_winner) {
                p.score += 1;
            }

            info!(
                room_id = %room.room_id,
                random_winner = %random_winner,
                "Bigger Dice: Tiebreaker limit exceeded, random winner selected"
            );

            // Start new round
            let all_players: Vec<i64> = room.players.iter().map(|p| p.user_id).collect();
            round_state.start_new_round(&all_players);

            if let Some(first_roller) = round_state.current_roller() {
                room.current_turn = Some(first_roller);
                room.turn_number += 1;

                events.push(GameEvent::TurnChanged {
                    room_id: room.room_id.clone(),
                    current_turn: first_roller,
                    turn_number: room.turn_number,
                });
            }
        } else {
            // Start tiebreaker
            events.push(GameEvent::BiggerDiceTiebreakerStarted {
                room_id: room.room_id.clone(),
                tied_players: highest_players.clone(),
                tied_roll: highest_roll,
            });

            round_state.start_tiebreaker(highest_players);

            // First tied player rolls
            if let Some(first_roller) = round_state.current_roller() {
                room.current_turn = Some(first_roller);
                room.turn_number += 1;

                events.push(GameEvent::TurnChanged {
                    room_id: room.room_id.clone(),
                    current_turn: first_roller,
                    turn_number: room.turn_number,
                });
            }
        }
    }

    (events, false)
}

/// Start a new Bigger Dice game
/// Returns (events, round_state) - caller must store the round_state
pub fn start_game(room: &mut GameRoom) -> (Vec<GameEvent>, BiggerDiceRoundState) {
    let mut events = Vec::new();
    let mut round_state = BiggerDiceRoundState::default();

    // Require minimum 2 players to start (supports 2+ players)
    if room.players.len() < 2 {
        return (events, round_state);
    }

    // Reset scores
    for player in &mut room.players {
        player.score = 0;
    }

    room.status = RoomStatus::InProgress;
    room.started_at = Some(Utc::now());
    room.turn_number = 1;

    // Initialize round state with all players
    let all_player_ids: Vec<i64> = room.players.iter().map(|p| p.user_id).collect();
    round_state.initialize(&all_player_ids);

    // First player in list goes first
    let first_player = round_state.current_roller().unwrap_or(all_player_ids[0]);
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
        num_players = %room.players.len(),
        "Bigger Dice game started with N players"
    );

    (events, round_state)
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
