//! Tic Tac Toe game logic
//!
//! Rules:
//! - 2 players compete in a best-of-9 match (first to 5 wins)
//! - First game: Random player gets X, X always goes first
//! - After each game (win or draw): Turn order reverses
//! - Draw: No points awarded, move to next game
//! - Turn timer: 60 seconds per move
//! - Timer expiry: Player forfeits that game (opponent +1 point)
//! - Entry fee: 1000 coins per player
//! - Winner prize: 60% of pool (1200 coins)
//!
//! Disconnection handling:
//! - Game pauses when a player disconnects
//! - 10-minute timeout for reconnection
//! - One player disconnected 10+ min: Other player wins
//! - Both players disconnected 10+ min: Both refunded 990 coins

use super::types::{GameEvent, GameRoom, GameTurn, RoomStatus};
use chrono::{DateTime, Duration, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::info;

/// Win score for Tic Tac Toe match (first to 5)
pub const WIN_SCORE: i32 = 5;

/// Turn timer in seconds
pub const TURN_TIMER_SECONDS: i64 = 60;

/// Disconnection timeout in minutes
pub const DISCONNECT_TIMEOUT_MINUTES: i64 = 10;

/// Entry fee in cents (1000 coins)
pub const ENTRY_FEE_CENTS: i64 = 100000;

/// Winning percentage (60%)
pub const WINNING_PERCENTAGE: i64 = 60;

/// Winning lines (indices that form a line)
const WINNING_LINES: [[usize; 3]; 8] = [
    [0, 1, 2], // Top row
    [3, 4, 5], // Middle row
    [6, 7, 8], // Bottom row
    [0, 3, 6], // Left column
    [1, 4, 7], // Middle column
    [2, 5, 8], // Right column
    [0, 4, 8], // Diagonal top-left to bottom-right
    [2, 4, 6], // Diagonal top-right to bottom-left
];

/// Tic Tac Toe match state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicTacToeMatchState {
    /// Current board state: None = empty, Some('X') or Some('O')
    pub board: [Option<char>; 9],
    /// Player who is X in this game
    pub player_x_id: i64,
    /// Player who is O in this game
    pub player_o_id: i64,
    /// Whose turn it is (player_id)
    pub current_turn: i64,
    /// Match scores: player_id -> game wins
    pub scores: HashMap<i64, i32>,
    /// Current game number in match (1-9)
    pub game_number: i32,
    /// Player who went first this game (for tracking reversal)
    pub first_player_this_game: i64,
    /// Deadline for current move (60 seconds from turn start)
    pub move_deadline: Option<DateTime<Utc>>,
    /// Players who are disconnected and when they disconnected
    pub disconnected_at: HashMap<i64, DateTime<Utc>>,
    /// Is the game currently paused due to disconnect?
    pub is_paused: bool,
}

impl Default for TicTacToeMatchState {
    fn default() -> Self {
        Self {
            board: [None; 9],
            player_x_id: 0,
            player_o_id: 0,
            current_turn: 0,
            scores: HashMap::new(),
            game_number: 1,
            first_player_this_game: 0,
            move_deadline: None,
            disconnected_at: HashMap::new(),
            is_paused: false,
        }
    }
}

impl TicTacToeMatchState {
    /// Initialize a new match with two players
    /// Randomly assigns X to one player
    pub fn initialize(player1_id: i64, player2_id: i64) -> Self {
        let mut rng = rand::thread_rng();

        // Randomly decide who gets X
        let (player_x, player_o) = if rng.gen_bool(0.5) {
            (player1_id, player2_id)
        } else {
            (player2_id, player1_id)
        };

        let mut scores = HashMap::new();
        scores.insert(player1_id, 0);
        scores.insert(player2_id, 0);

        let now = Utc::now();
        let deadline = now + Duration::seconds(TURN_TIMER_SECONDS);

        Self {
            board: [None; 9],
            player_x_id: player_x,
            player_o_id: player_o,
            current_turn: player_x, // X always goes first
            scores,
            game_number: 1,
            first_player_this_game: player_x,
            move_deadline: Some(deadline),
            disconnected_at: HashMap::new(),
            is_paused: false,
        }
    }

    /// Get the mark (X or O) for a player
    pub fn get_player_mark(&self, player_id: i64) -> Option<char> {
        if player_id == self.player_x_id {
            Some('X')
        } else if player_id == self.player_o_id {
            Some('O')
        } else {
            None
        }
    }

    /// Get the opponent's player ID
    pub fn get_opponent(&self, player_id: i64) -> i64 {
        if player_id == self.player_x_id {
            self.player_o_id
        } else {
            self.player_x_id
        }
    }

    /// Make a move on the board
    /// Returns Ok(()) if move is valid, Err with reason if invalid
    pub fn make_move(&mut self, player_id: i64, position: u8) -> Result<(), &'static str> {
        // Validate it's this player's turn
        if self.current_turn != player_id {
            return Err("Not your turn");
        }

        // Validate game is not paused
        if self.is_paused {
            return Err("Game is paused");
        }

        // Validate position
        if position > 8 {
            return Err("Invalid position");
        }

        let pos = position as usize;

        // Validate cell is empty
        if self.board[pos].is_some() {
            return Err("Cell already occupied");
        }

        // Place the mark
        let mark = self.get_player_mark(player_id).ok_or("Player not in game")?;
        self.board[pos] = Some(mark);

        // Switch turn
        self.current_turn = self.get_opponent(player_id);

        // Reset move deadline
        self.move_deadline = Some(Utc::now() + Duration::seconds(TURN_TIMER_SECONDS));

        Ok(())
    }

    /// Check if there's a winner
    /// Returns (winner_id, winning_line) if someone won, None otherwise
    pub fn check_winner(&self) -> Option<(i64, Vec<u8>)> {
        for line in WINNING_LINES.iter() {
            let a = self.board[line[0]];
            let b = self.board[line[1]];
            let c = self.board[line[2]];

            if let (Some(mark_a), Some(mark_b), Some(mark_c)) = (a, b, c) {
                if mark_a == mark_b && mark_b == mark_c {
                    let winner_id = if mark_a == 'X' {
                        self.player_x_id
                    } else {
                        self.player_o_id
                    };
                    let winning_line = line.iter().map(|&i| i as u8).collect();
                    return Some((winner_id, winning_line));
                }
            }
        }
        None
    }

    /// Check if the board is full (draw if no winner)
    pub fn is_board_full(&self) -> bool {
        self.board.iter().all(|cell| cell.is_some())
    }

    /// Start a new game within the match (after a game ends)
    /// Reverses turn order (who was O becomes X and goes first)
    pub fn start_new_game(&mut self) {
        // Clear board
        self.board = [None; 9];

        // Swap X and O (turn order reversal)
        std::mem::swap(&mut self.player_x_id, &mut self.player_o_id);

        // X goes first
        self.current_turn = self.player_x_id;
        self.first_player_this_game = self.player_x_id;

        // Increment game number
        self.game_number += 1;

        // Reset timer
        self.move_deadline = Some(Utc::now() + Duration::seconds(TURN_TIMER_SECONDS));
    }

    /// Award a point to a player
    pub fn award_point(&mut self, player_id: i64) {
        *self.scores.entry(player_id).or_insert(0) += 1;
    }

    /// Check if a player has won the match (first to 5)
    pub fn has_match_winner(&self) -> Option<i64> {
        for (&player_id, &score) in &self.scores {
            if score >= WIN_SCORE {
                return Some(player_id);
            }
        }
        None
    }

    /// Pause the game (on disconnect)
    pub fn pause_game(&mut self, player_id: i64) {
        if !self.disconnected_at.contains_key(&player_id) {
            self.disconnected_at.insert(player_id, Utc::now());
        }
        self.is_paused = true;
        self.move_deadline = None;
    }

    /// Resume the game (on reconnect)
    pub fn resume_game(&mut self, player_id: i64) {
        self.disconnected_at.remove(&player_id);
        if self.disconnected_at.is_empty() {
            self.is_paused = false;
            // Reset timer for current player
            self.move_deadline = Some(Utc::now() + Duration::seconds(TURN_TIMER_SECONDS));
        }
    }

    /// Check if a player's disconnect has expired (10+ minutes)
    pub fn is_disconnect_expired(&self, player_id: i64) -> bool {
        if let Some(&disconnect_time) = self.disconnected_at.get(&player_id) {
            Utc::now() - disconnect_time >= Duration::minutes(DISCONNECT_TIMEOUT_MINUTES)
        } else {
            false
        }
    }

    /// Get the board as a Vec for serialization
    pub fn board_as_vec(&self) -> Vec<Option<char>> {
        self.board.to_vec()
    }

    /// Get scores as a Vec for serialization
    pub fn scores_as_vec(&self) -> Vec<(i64, i32)> {
        self.scores.iter().map(|(&id, &score)| (id, score)).collect()
    }
}

/// Process a move in Tic Tac Toe
/// Returns (events, game_ended, match_ended)
pub fn process_move(
    room: &mut GameRoom,
    state: &mut TicTacToeMatchState,
    player_id: i64,
    position: u8,
) -> (Vec<GameEvent>, bool, bool) {
    let mut events = Vec::new();

    // Get player info
    let player_username = match room.get_player(player_id) {
        Some(p) => p.username.clone(),
        None => return (events, false, false),
    };

    // Attempt the move
    if let Err(e) = state.make_move(player_id, position) {
        info!(
            room_id = %room.room_id,
            player_id = %player_id,
            position = %position,
            error = %e,
            "Tic Tac Toe: Invalid move"
        );
        return (events, false, false);
    }

    let mark = state.get_player_mark(player_id).unwrap_or('?');

    // Emit move event
    events.push(GameEvent::TicTacToeMoved {
        room_id: room.room_id.clone(),
        player_id,
        player_username: player_username.clone(),
        position,
        mark,
        board: state.board_as_vec(),
    });

    info!(
        room_id = %room.room_id,
        player_id = %player_id,
        position = %position,
        mark = %mark,
        "Tic Tac Toe: Move made"
    );

    // Check for game end
    if let Some((winner_id, winning_line)) = state.check_winner() {
        // Award point
        state.award_point(winner_id);

        let winner_username = room
            .get_player(winner_id)
            .map(|p| p.username.clone())
            .unwrap_or_default();

        // Check for match end
        if let Some(match_winner) = state.has_match_winner() {
            let match_winner_username = room
                .get_player(match_winner)
                .map(|p| p.username.clone())
                .unwrap_or_default();

            let final_scores: Vec<(i64, String, i32)> = room
                .players
                .iter()
                .map(|p| (p.user_id, p.username.clone(), *state.scores.get(&p.user_id).unwrap_or(&0)))
                .collect();

            // Calculate prize (60% of pool)
            let total_pool = ENTRY_FEE_CENTS * 2;
            let prize = (total_pool * WINNING_PERCENTAGE) / 100;

            room.status = RoomStatus::Finished;
            room.winner_id = Some(match_winner);
            room.finished_at = Some(Utc::now());

            events.push(GameEvent::TicTacToeMatchEnded {
                room_id: room.room_id.clone(),
                winner_id: match_winner,
                winner_username: match_winner_username,
                final_scores,
                prize_amount: prize,
            });

            info!(
                room_id = %room.room_id,
                winner_id = %match_winner,
                "Tic Tac Toe: Match ended"
            );

            return (events, true, true);
        }

        // Game ended but match continues
        let next_first = state.get_opponent(state.first_player_this_game);

        events.push(GameEvent::TicTacToeGameResult {
            room_id: room.room_id.clone(),
            winner_id: Some(winner_id),
            winner_username: Some(winner_username),
            winning_line: Some(winning_line),
            is_draw: false,
            scores: state.scores_as_vec(),
            game_number: state.game_number,
            next_first_player: next_first,
        });

        // Start new game
        state.start_new_game();

        // Emit turn changed
        events.push(GameEvent::TurnChanged {
            room_id: room.room_id.clone(),
            current_turn: state.current_turn,
            turn_number: room.turn_number + 1,
        });
        room.turn_number += 1;
        room.current_turn = Some(state.current_turn);

        return (events, true, false);
    }

    // Check for draw
    if state.is_board_full() {
        let next_first = state.get_opponent(state.first_player_this_game);

        events.push(GameEvent::TicTacToeGameResult {
            room_id: room.room_id.clone(),
            winner_id: None,
            winner_username: None,
            winning_line: None,
            is_draw: true,
            scores: state.scores_as_vec(),
            game_number: state.game_number,
            next_first_player: next_first,
        });

        // Start new game (no points awarded for draw)
        state.start_new_game();

        // Emit turn changed
        events.push(GameEvent::TurnChanged {
            room_id: room.room_id.clone(),
            current_turn: state.current_turn,
            turn_number: room.turn_number + 1,
        });
        room.turn_number += 1;
        room.current_turn = Some(state.current_turn);

        return (events, true, false);
    }

    // Game continues - emit turn changed
    events.push(GameEvent::TurnChanged {
        room_id: room.room_id.clone(),
        current_turn: state.current_turn,
        turn_number: room.turn_number + 1,
    });
    room.turn_number += 1;
    room.current_turn = Some(state.current_turn);

    (events, false, false)
}

/// Process turn timeout for a player
/// Returns (events, match_ended)
pub fn process_turn_timeout(
    room: &mut GameRoom,
    state: &mut TicTacToeMatchState,
    timed_out_player_id: i64,
) -> (Vec<GameEvent>, bool) {
    let mut events = Vec::new();

    // Get player info
    let timed_out_username = room
        .get_player(timed_out_player_id)
        .map(|p| p.username.clone())
        .unwrap_or_default();

    let winner_id = state.get_opponent(timed_out_player_id);
    let winner_username = room
        .get_player(winner_id)
        .map(|p| p.username.clone())
        .unwrap_or_default();

    // Award point to opponent
    state.award_point(winner_id);

    events.push(GameEvent::TicTacToeTurnTimeout {
        room_id: room.room_id.clone(),
        player_id: timed_out_player_id,
        player_username: timed_out_username,
        winner_id,
        winner_username: winner_username.clone(),
        scores: state.scores_as_vec(),
        game_number: state.game_number,
    });

    info!(
        room_id = %room.room_id,
        timed_out_player = %timed_out_player_id,
        winner = %winner_id,
        "Tic Tac Toe: Turn timeout, game forfeited"
    );

    // Check for match end
    if let Some(match_winner) = state.has_match_winner() {
        let match_winner_username = room
            .get_player(match_winner)
            .map(|p| p.username.clone())
            .unwrap_or_default();

        let final_scores: Vec<(i64, String, i32)> = room
            .players
            .iter()
            .map(|p| (p.user_id, p.username.clone(), *state.scores.get(&p.user_id).unwrap_or(&0)))
            .collect();

        let total_pool = ENTRY_FEE_CENTS * 2;
        let prize = (total_pool * WINNING_PERCENTAGE) / 100;

        room.status = RoomStatus::Finished;
        room.winner_id = Some(match_winner);
        room.finished_at = Some(Utc::now());

        events.push(GameEvent::TicTacToeMatchEnded {
            room_id: room.room_id.clone(),
            winner_id: match_winner,
            winner_username: match_winner_username,
            final_scores,
            prize_amount: prize,
        });

        return (events, true);
    }

    // Match continues - start new game
    state.start_new_game();

    events.push(GameEvent::TurnChanged {
        room_id: room.room_id.clone(),
        current_turn: state.current_turn,
        turn_number: room.turn_number + 1,
    });
    room.turn_number += 1;
    room.current_turn = Some(state.current_turn);

    (events, false)
}

/// Start a new Tic Tac Toe game
/// Returns (events, state)
pub fn start_game(room: &mut GameRoom) -> (Vec<GameEvent>, TicTacToeMatchState) {
    let mut events = Vec::new();

    // Require exactly 2 players
    if room.players.len() != 2 {
        return (events, TicTacToeMatchState::default());
    }

    let player1 = room.players[0].user_id;
    let player2 = room.players[1].user_id;

    // Initialize match state
    let state = TicTacToeMatchState::initialize(player1, player2);

    // Reset room scores
    for player in &mut room.players {
        player.score = 0;
    }

    room.status = RoomStatus::InProgress;
    room.started_at = Some(Utc::now());
    room.turn_number = 1;
    room.current_turn = Some(state.current_turn);

    events.push(GameEvent::GameStarted {
        room_id: room.room_id.clone(),
        players: room.players.clone(),
        first_turn: state.current_turn,
    });

    events.push(GameEvent::TurnChanged {
        room_id: room.room_id.clone(),
        current_turn: state.current_turn,
        turn_number: 1,
    });

    // Send initial state
    events.push(GameEvent::TicTacToeState {
        room_id: room.room_id.clone(),
        board: state.board_as_vec(),
        player_x_id: state.player_x_id,
        player_o_id: state.player_o_id,
        current_turn: state.current_turn,
        scores: state.scores_as_vec(),
        game_number: state.game_number,
        move_deadline: state.move_deadline.map(|d| d.to_rfc3339()),
        is_paused: state.is_paused,
        disconnected_player: state.disconnected_at.keys().next().copied(),
    });

    info!(
        room_id = %room.room_id,
        player_x = %state.player_x_id,
        player_o = %state.player_o_id,
        first_turn = %state.current_turn,
        "Tic Tac Toe: Game started"
    );

    (events, state)
}

/// Create a game turn record for history
pub fn create_turn_record(
    turn_number: i32,
    player_id: i64,
    position: u8,
    mark: char,
) -> GameTurn {
    GameTurn {
        turn_number,
        player_id,
        action: serde_json::json!({
            "type": "move",
            "position": position,
            "mark": mark.to_string(),
        }),
        timestamp: Utc::now(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_winning_lines() {
        // Test horizontal wins
        let mut state = TicTacToeMatchState::initialize(1, 2);
        state.board = [
            Some('X'), Some('X'), Some('X'),
            None, None, None,
            None, None, None,
        ];
        let result = state.check_winner();
        assert!(result.is_some());
        let (winner, line) = result.unwrap();
        assert_eq!(winner, state.player_x_id);
        assert_eq!(line, vec![0, 1, 2]);

        // Test diagonal win
        state.board = [
            Some('O'), None, Some('X'),
            None, Some('X'), None,
            Some('X'), None, Some('O'),
        ];
        let (winner, line) = state.check_winner().unwrap();
        assert_eq!(winner, state.player_x_id);
        assert_eq!(line, vec![2, 4, 6]);
    }

    #[test]
    fn test_board_full() {
        let mut state = TicTacToeMatchState::initialize(1, 2);
        assert!(!state.is_board_full());

        state.board = [
            Some('X'), Some('O'), Some('X'),
            Some('X'), Some('O'), Some('O'),
            Some('O'), Some('X'), Some('X'),
        ];
        assert!(state.is_board_full());
    }

    #[test]
    fn test_turn_reversal() {
        let mut state = TicTacToeMatchState::initialize(1, 2);
        let original_x = state.player_x_id;
        let original_o = state.player_o_id;

        state.start_new_game();

        // After new game, X and O should be swapped
        assert_eq!(state.player_x_id, original_o);
        assert_eq!(state.player_o_id, original_x);
    }

    #[test]
    fn test_match_winner() {
        let mut state = TicTacToeMatchState::initialize(1, 2);

        // Award 4 points to player 1
        for _ in 0..4 {
            state.award_point(1);
        }
        assert!(state.has_match_winner().is_none());

        // Award 5th point
        state.award_point(1);
        assert_eq!(state.has_match_winner(), Some(1));
    }
}
