//! WebSocket Protocol Messages
//!
//! Defines all message types exchanged between clients and the gateway.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;
use chrono::{DateTime, Utc};

// ============================================================================
// Client -> Server Messages (Commands)
// ============================================================================

/// Incoming message from client
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    // System messages
    #[serde(rename = "system.authenticate")]
    Authenticate {
        #[serde(default)]
        token: Option<String>,
        // Allow credential-based auth for development
        #[serde(default)]
        user_id: Option<String>,
        #[serde(default)]
        username: Option<String>,
        #[serde(default)]
        avatar_id: Option<String>,
    },

    // List available game rooms
    #[serde(rename = "games.command.list_rooms")]
    GameListRooms {
        #[serde(default)]
        game_type: Option<String>,
    },

    // Ready up in a waiting room
    #[serde(rename = "games.command.ready")]
    GameReady {
        room_id: String,
    },

    // Rejoin a room after reconnection
    #[serde(rename = "games.command.rejoin_room")]
    GameRejoinRoom {
        #[serde(default)]
        room_id: Option<String>,
        #[serde(default)]
        room_name: Option<String>,
    },

    #[serde(rename = "system.heartbeat")]
    Heartbeat,

    #[serde(rename = "system.sync_state")]
    SyncState,

    // Chat commands
    #[serde(rename = "chat.command.send_message")]
    ChatSendMessage {
        recipient_id: String,
        content: String,
    },

    #[serde(rename = "chat.command.send_lobby_message")]
    ChatSendLobbyMessage {
        lobby_id: String,
        content: String,
    },

    #[serde(rename = "chat.command.typing")]
    ChatTyping {
        recipient_id: String,
    },

    #[serde(rename = "chat.command.mark_read")]
    ChatMarkRead {
        message_ids: Vec<String>,
    },

    // Game commands
    #[serde(rename = "games.command.create_room")]
    GameCreateRoom {
        game_type: String,
        room_name: String,
        #[serde(default)]
        password: Option<String>,
        #[serde(default)]
        max_players: Option<i32>,
        #[serde(default)]
        allow_spectators: Option<bool>,
    },

    #[serde(rename = "games.command.join_room")]
    GameJoinRoom {
        room_name: String,
        #[serde(default)]
        password: Option<String>,
    },

    #[serde(rename = "games.command.leave_room")]
    GameLeaveRoom {
        room_id: String,
    },

    #[serde(rename = "games.command.spectate")]
    GameSpectate {
        room_id: String,
    },

    #[serde(rename = "games.command.stop_spectating")]
    GameStopSpectating {
        room_id: String,
    },

    #[serde(rename = "games.command.player_chat")]
    GamePlayerChat {
        room_id: String,
        content: String,
    },

    #[serde(rename = "games.command.spectator_chat")]
    GameSpectatorChat {
        room_id: String,
        content: String,
    },

    // Admin/host commands for player management
    #[serde(rename = "games.command.select_player")]
    GameSelectPlayer {
        room_id: String,
        target_user_id: String,
    },

    #[serde(rename = "games.command.kick_player")]
    GameKickPlayer {
        room_id: String,
        target_user_id: String,
    },

    #[serde(rename = "games.command.kick_spectator")]
    GameKickSpectator {
        room_id: String,
        target_user_id: String,
    },

    #[serde(rename = "games.command.vote_kick_disconnected")]
    GameVoteKickDisconnected {
        room_id: String,
        target_user_id: String,
    },

    #[serde(rename = "games.command.ban_player")]
    GameBanPlayer {
        room_id: String,
        target_user_id: String,
    },

    #[serde(rename = "games.command.unban_player")]
    GameUnbanPlayer {
        room_id: String,
        target_user_id: String,
    },

    // Bigger Dice specific commands
    #[serde(rename = "games.command.bigger_dice.roll")]
    BiggerDiceRoll {
        room_id: String,
    },

    // Tic Tac Toe specific commands
    #[serde(rename = "games.command.tic_tac_toe.move")]
    TicTacToeMove {
        room_id: String,
        position: u8,
    },

    /// Auto-roll for a kicked player (frontend fallback when backend auto-roll fails)
    #[serde(rename = "games.command.bigger_dice.auto_roll")]
    BiggerDiceAutoRoll {
        room_id: String,
        target_user_id: String,
    },

    /// Voluntarily enable auto-play for self
    #[serde(rename = "games.command.bigger_dice.enable_auto_play")]
    BiggerDiceEnableAutoPlay {
        room_id: String,
    },

    // ========== Enhanced Game Room Commands ==========

    /// Send a chat message to a channel (lobby, players, spectators)
    #[serde(rename = "games.command.send_chat")]
    GameSendChat {
        room_id: String,
        channel: String,
        content: String,
    },

    /// Get chat history for a channel
    #[serde(rename = "games.command.get_chat_history")]
    GameGetChatHistory {
        room_id: String,
        channel: String,
        #[serde(default)]
        limit: Option<i64>,
    },

    /// Set ready status (toggle)
    #[serde(rename = "games.command.set_ready")]
    GameSetReady {
        room_id: String,
        is_ready: bool,
    },

    /// Host starts the game
    #[serde(rename = "games.command.start_game")]
    GameStartGame {
        room_id: String,
    },

    /// Admin deselects a player (move back to lobby)
    #[serde(rename = "games.command.deselect_player")]
    GameDeselectPlayer {
        room_id: String,
        target_user_id: String,
    },

    /// Host designates an admin spectator
    #[serde(rename = "games.command.designate_admin_spectator")]
    GameDesignateAdminSpectator {
        room_id: String,
        target_user_id: String,
    },

    /// Join room as spectator
    #[serde(rename = "games.command.join_as_spectator")]
    GameJoinAsSpectator {
        room_name: String,
        #[serde(default)]
        password: Option<String>,
    },

    /// Mute a user in chat
    #[serde(rename = "games.command.mute_user")]
    GameMuteUser {
        room_id: String,
        target_user_id: String,
    },

    /// Unmute a user in chat
    #[serde(rename = "games.command.unmute_user")]
    GameUnmuteUser {
        room_id: String,
        target_user_id: String,
    },
}

// ============================================================================
// Server -> Client Messages (Events)
// ============================================================================

/// Outgoing message to client
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum ServerMessage {
    // System events
    #[serde(rename = "system.welcome")]
    Welcome {
        connection_id: String,
        timestamp: DateTime<Utc>,
    },

    #[serde(rename = "system.authenticated")]
    Authenticated {
        user_id: String,
        username: String,
        roles: Vec<String>,
        timestamp: DateTime<Utc>,
    },

    #[serde(rename = "system.heartbeat_ack")]
    HeartbeatAck {
        timestamp: DateTime<Utc>,
    },

    #[serde(rename = "system.error")]
    Error {
        code: String,
        message: String,
    },

    #[serde(rename = "system.reauth_required")]
    ReauthRequired {
        reason: String,
    },

    #[serde(rename = "system.state_snapshot")]
    StateSnapshot {
        active_rooms: Vec<String>,
        game_states: serde_json::Value,
        unread_messages: u32,
    },

    // Chat events
    #[serde(rename = "chat.event.message_received")]
    ChatMessageReceived {
        message_id: String,
        sender_id: String,
        sender_name: String,
        content: String,
        sent_at: DateTime<Utc>,
    },

    #[serde(rename = "chat.event.lobby_message")]
    ChatLobbyMessage {
        lobby_id: String,
        message_id: String,
        sender_id: String,
        sender_name: String,
        content: String,
        sent_at: DateTime<Utc>,
    },

    #[serde(rename = "chat.event.message_rejected")]
    ChatMessageRejected {
        reason: String,
        recipient_id: String,
    },

    #[serde(rename = "chat.event.typing")]
    ChatTyping {
        sender_id: String,
        sender_name: String,
    },

    #[serde(rename = "chat.event.message_read")]
    ChatMessageRead {
        message_ids: Vec<String>,
        reader_id: String,
    },

    // Game events
    #[serde(rename = "games.event.room_created")]
    GameRoomCreated {
        room_id: String,
        room_name: String,
        game_type: String,
        host_id: String,
        host_name: String,
        #[serde(default)]
        is_password_protected: bool,
        #[serde(default)]
        player_count: i32,
        #[serde(default)]
        allow_spectators: bool,
    },

    #[serde(rename = "games.event.tic_tac_toe.room_created")]
    TicTacToeRoomCreated {
        room_id: String,
        room_name: String,
        game_type: String,
        host_id: String,
        host_name: String,
        #[serde(default)]
        is_password_protected: bool,
        #[serde(default)]
        player_count: i32,
        #[serde(default)]
        allow_spectators: bool,
    },

    #[serde(rename = "games.event.bigger_dice.room_created")]
    BiggerDiceRoomCreated {
        room_id: String,
        room_name: String,
        game_type: String,
        host_id: String,
        host_name: String,
        #[serde(default)]
        is_password_protected: bool,
        #[serde(default)]
        player_count: i32,
        #[serde(default)]
        allow_spectators: bool,
    },

    #[serde(rename = "games.event.room_creation_failed")]
    GameRoomCreationFailed {
        reason: String,
        room_name: String,
    },

    #[serde(rename = "games.event.player_joined")]
    GamePlayerJoined {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    #[serde(rename = "games.event.player_left")]
    GamePlayerLeft {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    // Game-specific PlayerLeft variants
    #[serde(rename = "games.event.tic_tac_toe.player_left")]
    TicTacToePlayerLeft {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    #[serde(rename = "games.event.bigger_dice.player_left")]
    BiggerDicePlayerLeft {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    #[serde(rename = "games.event.player_disconnected")]
    GamePlayerDisconnected {
        room_id: String,
        user_id: String,
        username: String,
        timeout_at: DateTime<Utc>,
    },

    // Game-specific PlayerDisconnected variants
    #[serde(rename = "games.event.tic_tac_toe.player_disconnected")]
    TicTacToePlayerDisconnected {
        room_id: String,
        user_id: String,
        username: String,
        timeout_at: DateTime<Utc>,
    },

    #[serde(rename = "games.event.bigger_dice.player_disconnected")]
    BiggerDicePlayerDisconnected {
        room_id: String,
        user_id: String,
        username: String,
        timeout_at: DateTime<Utc>,
    },

    #[serde(rename = "games.event.player_rejoined")]
    GamePlayerRejoined {
        room_id: String,
        user_id: String,
        username: String,
    },

    // Game-specific PlayerRejoined variants
    #[serde(rename = "games.event.tic_tac_toe.player_rejoined")]
    TicTacToePlayerRejoined {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.bigger_dice.player_rejoined")]
    BiggerDicePlayerRejoined {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.player_auto_enabled")]
    GamePlayerAutoEnabled {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.player_auto_disabled")]
    GamePlayerAutoDisabled {
        room_id: String,
        user_id: String,
        username: String,
    },

    // Game-specific PlayerAutoEnabled variants
    #[serde(rename = "games.event.bigger_dice.player_auto_enabled")]
    BiggerDicePlayerAutoEnabled {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.bigger_dice.player_auto_disabled")]
    BiggerDicePlayerAutoDisabled {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.lobby_joined")]
    GameLobbyJoined {
        room_id: String,
        player: LobbyPlayer,
    },

    // Game-specific LobbyJoined variants
    #[serde(rename = "games.event.tic_tac_toe.lobby_joined")]
    TicTacToeLobbyJoined {
        room_id: String,
        player: LobbyPlayer,
    },

    #[serde(rename = "games.event.bigger_dice.lobby_joined")]
    BiggerDiceLobbyJoined {
        room_id: String,
        player: LobbyPlayer,
    },

    #[serde(rename = "games.event.game_started")]
    GameStarted {
        room_id: String,
        players: Vec<PlayerInfo>,
        first_turn: String,
        game_type: String,
    },

    #[serde(rename = "games.event.tic_tac_toe.game_started")]
    TicTacToeGameStarted {
        room_id: String,
        players: Vec<PlayerInfo>,
        first_turn: String,
        game_type: String,
    },

    #[serde(rename = "games.event.bigger_dice.game_started")]
    BiggerDiceGameStarted {
        room_id: String,
        players: Vec<PlayerInfo>,
        first_turn: String,
        game_type: String,
    },

    #[serde(rename = "games.event.rooms_updated")]
    GameRoomsUpdated {
        game_type: String,
        rooms: Vec<RoomInfo>,
    },

    #[serde(rename = "games.event.room_list")]
    GameRoomList {
        rooms: Vec<RoomInfo>,
    },

    #[serde(rename = "games.event.room_removed")]
    GameRoomRemoved {
        room_id: String,
        room_name: String,
        reason: String, // "host_left", "game_finished", "abandoned"
    },

    #[serde(rename = "games.event.tic_tac_toe.room_removed")]
    TicTacToeRoomRemoved {
        room_id: String,
        room_name: String,
        reason: String,
    },

    #[serde(rename = "games.event.bigger_dice.room_removed")]
    BiggerDiceRoomRemoved {
        room_id: String,
        room_name: String,
        reason: String,
    },

    #[serde(rename = "games.event.room_state")]
    GameRoomState {
        room: serde_json::Value,
    },

    #[serde(rename = "games.event.tic_tac_toe.room_state")]
    TicTacToeRoomState {
        room: serde_json::Value,
    },

    #[serde(rename = "games.event.bigger_dice.room_state")]
    BiggerDiceRoomState {
        room: serde_json::Value,
    },

    #[serde(rename = "games.event.not_in_room")]
    GameNotInRoom {
        room_id: String,
        room_name: String,
        is_password_protected: bool,
        status: String,
        #[serde(default)]
        allow_spectators: bool,
    },

    // Game-specific NotInRoom variants
    #[serde(rename = "games.event.tic_tac_toe.not_in_room")]
    TicTacToeNotInRoom {
        room_id: String,
        room_name: String,
        is_password_protected: bool,
        status: String,
        #[serde(default)]
        allow_spectators: bool,
    },

    #[serde(rename = "games.event.bigger_dice.not_in_room")]
    BiggerDiceNotInRoom {
        room_id: String,
        room_name: String,
        is_password_protected: bool,
        status: String,
        #[serde(default)]
        allow_spectators: bool,
    },

    #[serde(rename = "games.event.spectator_joined")]
    GameSpectatorJoined {
        room_id: String,
        spectator_id: String,
        spectator_name: String,
        spectator_count: u32,
    },

    // Game-specific SpectatorJoined variants
    #[serde(rename = "games.event.tic_tac_toe.spectator_joined")]
    TicTacToeSpectatorJoined {
        room_id: String,
        spectator_id: String,
        spectator_name: String,
        spectator_count: u32,
    },

    #[serde(rename = "games.event.bigger_dice.spectator_joined")]
    BiggerDiceSpectatorJoined {
        room_id: String,
        spectator_id: String,
        spectator_name: String,
        spectator_count: u32,
    },

    /// Spectator joined with full data (new format)
    #[serde(rename = "games.event.spectator_data_joined")]
    GameSpectatorDataJoined {
        room_id: String,
        spectator: serde_json::Value,
    },

    // Game-specific SpectatorDataJoined variants
    #[serde(rename = "games.event.bigger_dice.spectator_data_joined")]
    BiggerDiceSpectatorDataJoined {
        room_id: String,
        spectator: serde_json::Value,
    },

    #[serde(rename = "games.event.tic_tac_toe.spectator_data_joined")]
    TicTacToeSpectatorDataJoined {
        room_id: String,
        spectator: serde_json::Value,
    },

    #[serde(rename = "games.event.spectator_left")]
    GameSpectatorLeft {
        room_id: String,
        user_id: String,
        username: String,
    },

    // Game-specific SpectatorLeft variants
    #[serde(rename = "games.event.tic_tac_toe.spectator_left")]
    TicTacToeSpectatorLeft {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.bigger_dice.spectator_left")]
    BiggerDiceSpectatorLeft {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.spectator_kicked")]
    GameSpectatorKicked {
        room_id: String,
        user_id: String,
        username: String,
    },

    // Game-specific SpectatorKicked variants
    #[serde(rename = "games.event.tic_tac_toe.spectator_kicked")]
    TicTacToeSpectatorKicked {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.bigger_dice.spectator_kicked")]
    BiggerDiceSpectatorKicked {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.player_chat_message")]
    GamePlayerChatMessage {
        room_id: String,
        sender_id: String,
        sender_name: String,
        content: String,
        sent_at: DateTime<Utc>,
    },

    #[serde(rename = "games.event.spectator_chat_message")]
    GameSpectatorChatMessage {
        room_id: String,
        sender_id: String,
        sender_name: String,
        content: String,
        sent_at: DateTime<Utc>,
    },

    #[serde(rename = "games.event.player_selected")]
    GamePlayerSelected {
        room_id: String,
        player: LobbyPlayer,
    },

    // Game-specific PlayerSelected variants
    #[serde(rename = "games.event.tic_tac_toe.player_selected")]
    TicTacToePlayerSelected {
        room_id: String,
        player: LobbyPlayer,
    },

    #[serde(rename = "games.event.bigger_dice.player_selected")]
    BiggerDicePlayerSelected {
        room_id: String,
        player: LobbyPlayer,
    },

    #[serde(rename = "games.event.turn_changed")]
    GameTurnChanged {
        room_id: String,
        current_turn: String,
        turn_number: i32,
    },

    // Game-specific TurnChanged variants
    #[serde(rename = "games.event.tic_tac_toe.turn_changed")]
    TicTacToeTurnChanged {
        room_id: String,
        current_turn: String,
        turn_number: i32,
    },

    #[serde(rename = "games.event.bigger_dice.turn_changed")]
    BiggerDiceTurnChanged {
        room_id: String,
        current_turn: String,
        turn_number: i32,
    },

    #[serde(rename = "games.event.player_ready")]
    GamePlayerReady {
        room_id: String,
        user_id: String,
        username: String,
    },

    // Game-specific PlayerReady variants
    #[serde(rename = "games.event.tic_tac_toe.player_ready")]
    TicTacToePlayerReady {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.bigger_dice.player_ready")]
    BiggerDicePlayerReady {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.removed_from_game")]
    GameRemovedFromGame {
        room_id: String,
        reason: String,
        message: String,
    },

    // Game-specific RemovedFromGame variants
    #[serde(rename = "games.event.tic_tac_toe.removed_from_game")]
    TicTacToeRemovedFromGame {
        room_id: String,
        reason: String,
        message: String,
    },

    #[serde(rename = "games.event.bigger_dice.removed_from_game")]
    BiggerDiceRemovedFromGame {
        room_id: String,
        reason: String,
        message: String,
    },

    #[serde(rename = "games.event.game_starting")]
    GameGameStarting {
        room_id: String,
        players: serde_json::Value,
    },

    // Game-specific GameStarting variants
    #[serde(rename = "games.event.tic_tac_toe.game_starting")]
    TicTacToeGameStarting {
        room_id: String,
        players: serde_json::Value,
    },

    #[serde(rename = "games.event.bigger_dice.game_starting")]
    BiggerDiceGameStarting {
        room_id: String,
        players: serde_json::Value,
    },

    /// N-player round result
    #[serde(rename = "games.event.bigger_dice.round_result")]
    BiggerDiceRoundResult {
        room_id: String,
        /// All rolls for this round: (player_id, roll)
        rolls: Vec<(String, i32)>,
        /// Winner if exactly one player had highest roll
        winner_id: Option<String>,
        /// True if multiple players tied for highest
        is_tie: bool,
        /// True if this was a tiebreaker round
        is_tiebreaker: bool,
        /// Players going to tiebreaker (only set when is_tie=true)
        tiebreaker_players: Vec<String>,
        /// Authoritative scores for all players after this round: (player_id, score)
        scores: Vec<(String, i32)>,
    },

    /// Tiebreaker started event for N-player Bigger Dice
    #[serde(rename = "games.event.bigger_dice.tiebreaker_started")]
    BiggerDiceTiebreakerStarted {
        room_id: String,
        /// Players participating in the tiebreaker
        tied_players: Vec<String>,
        /// The roll value they all tied on
        tied_roll: i32,
    },

    /// Current round state for N-player Bigger Dice (for rejoin/sync)
    #[serde(rename = "games.event.bigger_dice.state")]
    BiggerDiceState {
        room_id: String,
        /// Current round number
        round_number: i32,
        /// Rolls so far this round: (player_id, roll)
        current_rolls: Vec<(String, i32)>,
        /// Players who still need to roll
        pending_rollers: Vec<String>,
        /// Whether we are in a tiebreaker
        is_tiebreaker: bool,
    },

    #[serde(rename = "games.event.player_kicked")]
    GamePlayerKicked {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    // Game-specific PlayerKicked variants
    #[serde(rename = "games.event.tic_tac_toe.player_kicked")]
    TicTacToePlayerKicked {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    #[serde(rename = "games.event.bigger_dice.player_kicked")]
    BiggerDicePlayerKicked {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    #[serde(rename = "games.event.player_banned")]
    GamePlayerBanned {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    // Game-specific PlayerBanned variants
    #[serde(rename = "games.event.tic_tac_toe.player_banned")]
    TicTacToePlayerBanned {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    #[serde(rename = "games.event.bigger_dice.player_banned")]
    BiggerDicePlayerBanned {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    #[serde(rename = "games.event.player_unbanned")]
    GamePlayerUnbanned {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    // Game-specific PlayerUnbanned variants
    #[serde(rename = "games.event.tic_tac_toe.player_unbanned")]
    TicTacToePlayerUnbanned {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    #[serde(rename = "games.event.bigger_dice.player_unbanned")]
    BiggerDicePlayerUnbanned {
        room_id: String,
        player_id: String,
        player_name: String,
    },

    // Bigger Dice specific events
    #[serde(rename = "games.event.bigger_dice.rolled")]
    BiggerDiceRolled {
        room_id: String,
        player_id: String,
        player_name: String,
        roll: u8,
        is_first_roll: bool,
    },

    #[serde(rename = "games.event.bigger_dice.round_complete")]
    BiggerDiceRoundComplete {
        room_id: String,
        round: u8,
        rolls: RollResults,
        winner: Option<String>,
        winner_name: Option<String>,
        scores: Scores,
        next_turn: String,
    },

    #[serde(rename = "games.event.bigger_dice.game_over")]
    BiggerDiceGameOver {
        room_id: String,
        winner: String,
        winner_name: String,
        final_scores: Scores,
    },

    #[serde(rename = "games.event.bigger_dice.state_sync")]
    BiggerDiceStateSync {
        room_id: String,
        state: BiggerDiceState,
    },

    #[serde(rename = "games.event.bigger_dice.your_turn")]
    BiggerDiceYourTurn {
        room_id: String,
    },

    #[serde(rename = "games.event.bigger_dice.waiting_for_opponent")]
    BiggerDiceWaitingForOpponent {
        room_id: String,
        opponent_name: String,
    },

    // ========== Tic Tac Toe Events ==========

    /// Move made on the board
    #[serde(rename = "games.event.tic_tac_toe.moved")]
    TicTacToeMoved {
        room_id: String,
        player_id: String,
        player_username: String,
        position: u8,
        mark: char,
        board: Vec<Option<char>>,
    },

    /// Single game ended within match
    #[serde(rename = "games.event.tic_tac_toe.game_result")]
    TicTacToeGameResult {
        room_id: String,
        winner_id: Option<String>,
        winner_username: Option<String>,
        winning_line: Option<Vec<u8>>,
        is_draw: bool,
        scores: Vec<(String, i32)>,
        game_number: i32,
        next_first_player: String,
    },

    /// Match ended (first to 5 wins)
    #[serde(rename = "games.event.tic_tac_toe.match_ended")]
    TicTacToeMatchEnded {
        room_id: String,
        winner_id: String,
        winner_username: String,
        final_scores: Vec<(String, String, i32)>,
        prize_amount: i64,
    },

    /// Full state sync (for rejoin/spectators)
    #[serde(rename = "games.event.tic_tac_toe.state")]
    TicTacToeState {
        room_id: String,
        board: Vec<Option<char>>,
        player_x_id: String,
        player_o_id: String,
        current_turn: String,
        scores: Vec<(String, i32)>,
        game_number: i32,
        move_deadline: Option<String>,
        is_paused: bool,
        disconnected_player: Option<String>,
    },

    /// Player forfeited game due to turn timeout
    #[serde(rename = "games.event.tic_tac_toe.turn_timeout")]
    TicTacToeTurnTimeout {
        room_id: String,
        player_id: String,
        player_username: String,
        winner_id: String,
        winner_username: String,
        scores: Vec<(String, i32)>,
        game_number: i32,
    },

    /// Match cancelled (both players disconnected > 10 min)
    #[serde(rename = "games.event.tic_tac_toe.match_cancelled")]
    TicTacToeMatchCancelled {
        room_id: String,
        reason: String,
        refund_amount: i64,
    },

    /// Game paused due to player disconnect
    #[serde(rename = "games.event.tic_tac_toe.game_paused")]
    TicTacToeGamePaused {
        room_id: String,
        disconnected_player_id: String,
        disconnected_player_username: String,
        timeout_at: String,
    },

    /// Game resumed after player reconnect
    #[serde(rename = "games.event.tic_tac_toe.game_resumed")]
    TicTacToeGameResumed {
        room_id: String,
        reconnected_player_id: String,
        reconnected_player_username: String,
    },

    // User presence events
    #[serde(rename = "presence.event.user_online")]
    UserOnline {
        user_id: String,
        username: String,
    },

    #[serde(rename = "presence.event.user_offline")]
    UserOffline {
        user_id: String,
        username: String,
    },

    // ========== Enhanced Game Room Events ==========

    /// Chat message received
    #[serde(rename = "games.event.chat_message")]
    GameChatMessage {
        room_id: String,
        channel: String,
        user_id: String,
        username: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        avatar_id: Option<String>,
        content: String,
        is_system: bool,
        timestamp: String,
    },

    // Game-specific ChatMessage variants
    #[serde(rename = "games.event.tic_tac_toe.chat_message")]
    TicTacToeChatMessage {
        room_id: String,
        channel: String,
        user_id: String,
        username: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        avatar_id: Option<String>,
        content: String,
        is_system: bool,
        timestamp: String,
    },

    #[serde(rename = "games.event.bigger_dice.chat_message")]
    BiggerDiceChatMessage {
        room_id: String,
        channel: String,
        user_id: String,
        username: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        avatar_id: Option<String>,
        content: String,
        is_system: bool,
        timestamp: String,
    },

    /// Chat history response
    #[serde(rename = "games.event.chat_history")]
    GameChatHistory {
        room_id: String,
        channel: String,
        messages: Vec<serde_json::Value>,
    },

    // Game-specific ChatHistory variants
    #[serde(rename = "games.event.tic_tac_toe.chat_history")]
    TicTacToeChatHistory {
        room_id: String,
        channel: String,
        messages: Vec<serde_json::Value>,
    },

    #[serde(rename = "games.event.bigger_dice.chat_history")]
    BiggerDiceChatHistory {
        room_id: String,
        channel: String,
        messages: Vec<serde_json::Value>,
    },

    // ========== Bigger Dice Channel-Specific Chat Events ==========

    /// Bigger Dice lobby chat message
    #[serde(rename = "games.event.bigger_dice.lobby_chat")]
    BiggerDiceLobbyChat {
        room_id: String,
        user_id: String,
        username: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        avatar_id: Option<String>,
        content: String,
        is_system: bool,
        timestamp: String,
    },

    /// Bigger Dice player chat message
    #[serde(rename = "games.event.bigger_dice.player_chat")]
    BiggerDicePlayerChat {
        room_id: String,
        user_id: String,
        username: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        avatar_id: Option<String>,
        content: String,
        is_system: bool,
        timestamp: String,
    },

    /// Bigger Dice spectator chat message
    #[serde(rename = "games.event.bigger_dice.spectator_chat")]
    BiggerDiceSpectatorChat {
        room_id: String,
        user_id: String,
        username: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        avatar_id: Option<String>,
        content: String,
        is_system: bool,
        timestamp: String,
    },

    /// Bigger Dice lobby chat history
    #[serde(rename = "games.event.bigger_dice.lobby_chat_history")]
    BiggerDiceLobbyChatHistory {
        room_id: String,
        messages: Vec<serde_json::Value>,
    },

    /// Bigger Dice player chat history
    #[serde(rename = "games.event.bigger_dice.player_chat_history")]
    BiggerDicePlayerChatHistory {
        room_id: String,
        messages: Vec<serde_json::Value>,
    },

    /// Bigger Dice spectator chat history
    #[serde(rename = "games.event.bigger_dice.spectator_chat_history")]
    BiggerDiceSpectatorChatHistory {
        room_id: String,
        messages: Vec<serde_json::Value>,
    },

    /// Player ready status changed
    #[serde(rename = "games.event.player_ready_changed")]
    GamePlayerReadyChanged {
        room_id: String,
        user_id: String,
        username: String,
        is_ready: bool,
    },

    // Game-specific PlayerReadyChanged variants
    #[serde(rename = "games.event.tic_tac_toe.player_ready_changed")]
    TicTacToePlayerReadyChanged {
        room_id: String,
        user_id: String,
        username: String,
        is_ready: bool,
    },

    #[serde(rename = "games.event.bigger_dice.player_ready_changed")]
    BiggerDicePlayerReadyChanged {
        room_id: String,
        user_id: String,
        username: String,
        is_ready: bool,
    },

    /// Player was deselected
    #[serde(rename = "games.event.player_deselected")]
    GamePlayerDeselected {
        room_id: String,
        user_id: String,
        username: String,
    },

    // Game-specific PlayerDeselected variants
    #[serde(rename = "games.event.tic_tac_toe.player_deselected")]
    TicTacToePlayerDeselected {
        room_id: String,
        user_id: String,
        username: String,
    },

    #[serde(rename = "games.event.bigger_dice.player_deselected")]
    BiggerDicePlayerDeselected {
        room_id: String,
        user_id: String,
        username: String,
    },

    /// Selected players list updated
    #[serde(rename = "games.event.selected_players_updated")]
    GameSelectedPlayersUpdated {
        room_id: String,
        selected_players: Vec<String>,
    },

    // Game-specific SelectedPlayersUpdated variants
    #[serde(rename = "games.event.tic_tac_toe.selected_players_updated")]
    TicTacToeSelectedPlayersUpdated {
        room_id: String,
        selected_players: Vec<String>,
    },

    #[serde(rename = "games.event.bigger_dice.selected_players_updated")]
    BiggerDiceSelectedPlayersUpdated {
        room_id: String,
        selected_players: Vec<String>,
    },

    /// Admin spectator designated
    #[serde(rename = "games.event.admin_spectator_designated")]
    GameAdminSpectatorDesignated {
        room_id: String,
        user_id: String,
        username: String,
    },

    /// User muted
    #[serde(rename = "games.event.user_muted")]
    GameUserMuted {
        room_id: String,
        target_user_id: String,
        target_username: String,
    },

    /// User unmuted
    #[serde(rename = "games.event.user_unmuted")]
    GameUserUnmuted {
        room_id: String,
        target_user_id: String,
        target_username: String,
    },

    /// Spectators list updated
    #[serde(rename = "games.event.spectators_updated")]
    GameSpectatorsUpdated {
        room_id: String,
        spectators: Vec<serde_json::Value>,
    },

    /// Lobby list updated
    #[serde(rename = "games.event.lobby_updated")]
    GameLobbyUpdated {
        room_id: String,
        lobby: Vec<serde_json::Value>,
    },

    // Game-specific LobbyUpdated variants
    #[serde(rename = "games.event.tic_tac_toe.lobby_updated")]
    TicTacToeLobbyUpdated {
        room_id: String,
        lobby: Vec<serde_json::Value>,
    },

    #[serde(rename = "games.event.bigger_dice.lobby_updated")]
    BiggerDiceLobbyUpdated {
        room_id: String,
        lobby: Vec<serde_json::Value>,
    },
}

// ============================================================================
// Supporting Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlayerInfo {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LobbyPlayer {
    pub user_id: String,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_id: Option<String>,
    #[serde(default)]
    pub score: u32,
    #[serde(default)]
    pub is_ready: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RoomInfo {
    pub room_id: String,
    pub room_name: String,
    pub game_type: String,
    pub host_name: String,
    pub status: String, // "waiting" | "playing" | "finished"
    pub player_count: u8,
    pub spectator_count: u32,
    #[serde(default)]
    pub is_password_protected: bool,
    #[serde(default)]
    pub players: Vec<Value>,
    #[serde(default)]
    pub lobby: Vec<Value>,
    #[serde(default)]
    pub max_players: u8,
    #[serde(default)]
    pub allow_spectators: bool,
    #[serde(default)]
    pub can_rejoin: bool,
    #[serde(default)]
    pub rejoin_role: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RollResults {
    pub player1: Option<u8>,
    pub player2: Option<u8>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Scores {
    pub player1_id: String,
    pub player1_score: u8,
    pub player2_id: String,
    pub player2_score: u8,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BiggerDiceState {
    pub players: Vec<PlayerInfo>,
    pub scores: Scores,
    pub current_turn: String,
    pub round: u8,
    pub last_rolls: RollResults,
    pub phase: String, // "waiting_for_roll" | "waiting_for_second_roll" | "round_complete"
}

// ============================================================================
// Kafka Event Envelope
// ============================================================================

/// Event envelope for Kafka messages
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EventEnvelope {
    pub event_id: Uuid,
    pub event_type: String,
    pub timestamp: DateTime<Utc>,
    pub correlation_id: Option<Uuid>,
    pub producer: String,
    pub actor: Actor,
    pub audience: Audience,
    pub payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Actor {
    pub user_id: String,
    pub username: Option<String>,
    pub roles: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Audience {
    #[serde(rename = "type")]
    pub audience_type: AudienceType,
    #[serde(default)]
    pub user_ids: Vec<String>,
    pub room_id: Option<String>,
    pub game_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AudienceType {
    User,
    Room,
    Broadcast,
    Spectators,
    Players,
}

impl EventEnvelope {
    /// Create a new event envelope
    pub fn new(
        event_type: impl Into<String>,
        actor: Actor,
        audience: Audience,
        payload: serde_json::Value,
    ) -> Self {
        Self {
            event_id: Uuid::new_v4(),
            event_type: event_type.into(),
            timestamp: Utc::now(),
            correlation_id: None,
            producer: "ws_gateway".to_string(),
            actor,
            audience,
            payload,
        }
    }

    /// Set correlation ID
    pub fn with_correlation_id(mut self, id: Uuid) -> Self {
        self.correlation_id = Some(id);
        self
    }
}
