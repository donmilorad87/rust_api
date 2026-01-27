//! Game types shared across modules

use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// Custom deserializer for i64 that accepts both string and integer formats
/// This handles WebSocket gateway sending user_id as "4" instead of 4
pub fn deserialize_i64_from_string<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::{self, Visitor};

    struct I64OrString;

    impl<'de> Visitor<'de> for I64OrString {
        type Value = i64;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("an integer or a string containing an integer")
        }

        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            Ok(v)
        }

        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            Ok(v as i64)
        }

        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            v.parse::<i64>().map_err(de::Error::custom)
        }
    }

    deserializer.deserialize_any(I64OrString)
}

/// Custom serializer for i64 that outputs as a string
/// This ensures ws_gateway receives user_id as "4" instead of 4
pub fn serialize_i64_as_string<S>(value: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

/// Game types available in the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GameType {
    BiggerDice,
    TicTacToe,
}

impl Default for GameType {
    fn default() -> Self {
        GameType::BiggerDice
    }
}

impl GameType {
    pub fn as_str(&self) -> &'static str {
        match self {
            GameType::BiggerDice => "bigger_dice",
            GameType::TicTacToe => "tic_tac_toe",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "bigger_dice" => Some(GameType::BiggerDice),
            "tic_tac_toe" => Some(GameType::TicTacToe),
            _ => None,
        }
    }

    /// Get the win score for this game type
    /// For BiggerDice: first to 10 points wins
    /// For TicTacToe: first to 5 game wins in match
    pub fn win_score(&self) -> i32 {
        match self {
            GameType::BiggerDice => 10,
            GameType::TicTacToe => 5,
        }
    }

    /// Get max players for this game type
    pub fn max_players(&self) -> usize {
        match self {
            GameType::BiggerDice => 10,
            GameType::TicTacToe => 2,
        }
    }

    /// Get min players to start
    pub fn min_players(&self) -> usize {
        match self {
            GameType::BiggerDice => 2,
            GameType::TicTacToe => 2,
        }
    }
}

/// Game room status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RoomStatus {
    Waiting,     // Waiting for players
    InProgress,  // Game is active
    Finished,    // Game has ended
    Abandoned,   // All players left
}

impl Default for RoomStatus {
    fn default() -> Self {
        RoomStatus::Waiting
    }
}

/// Player in a game room
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamePlayer {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub score: i32,
    pub is_ready: bool,
    pub joined_at: DateTime<Utc>,
}

/// Banned player info (user_id + username for display)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BannedPlayer {
    pub user_id: i64,
    pub username: String,
}

/// Spectator in a game room (with full data)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSpectator {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub joined_at: DateTime<Utc>,
}

/// Chat channel types for game rooms
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ChatChannel {
    /// Lobby chat (pre-game, everyone can see)
    Lobby,
    /// Players-only chat (in-game)
    Players,
    /// Spectators-only chat (in-game)
    Spectators,
}

impl Default for ChatChannel {
    fn default() -> Self {
        ChatChannel::Lobby
    }
}

impl std::fmt::Display for ChatChannel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChatChannel::Lobby => write!(f, "lobby"),
            ChatChannel::Players => write!(f, "players"),
            ChatChannel::Spectators => write!(f, "spectators"),
        }
    }
}

impl std::str::FromStr for ChatChannel {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "lobby" => Ok(ChatChannel::Lobby),
            "players" => Ok(ChatChannel::Players),
            "spectators" => Ok(ChatChannel::Spectators),
            _ => Err(format!("Unknown chat channel: {}", s)),
        }
    }
}

/// Game room structure (stored in Redis via ws_gateway)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRoom {
    pub room_id: String,
    pub room_name: String,
    pub game_type: GameType,
    pub status: RoomStatus,
    pub host_id: i64,
    /// Active players in the game (moved from selected_players when game starts)
    pub players: Vec<GamePlayer>,
    /// Players waiting in the lobby to be selected by admin
    pub lobby: Vec<GamePlayer>,
    /// Banned players - cannot rejoin the room
    pub banned_users: Vec<BannedPlayer>,
    /// Legacy spectator list (user IDs only) - for backwards compatibility
    pub spectators: Vec<i64>,
    pub current_turn: Option<i64>,
    pub turn_number: i32,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub winner_id: Option<i64>,
    /// bcrypt hash of the room password (None = public room)
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,
    /// Quick flag for UI to show lock icon
    pub is_password_protected: bool,

    // ========== Enhanced Game Room Fields ==========

    /// Number of players for the game (2-10, set at creation, immutable after)
    #[serde(default = "default_player_count")]
    pub player_count: i32,
    /// Whether spectators are allowed in this room
    #[serde(default = "default_allow_spectators")]
    pub allow_spectators: bool,
    /// Maximum number of spectators allowed
    #[serde(default = "default_max_spectators")]
    pub max_spectators: i32,
    /// The user designated as admin spectator (when host plays)
    pub admin_spectator_id: Option<i64>,
    /// Whether lobby chat is enabled (disabled during game)
    #[serde(default = "default_lobby_chat_enabled")]
    pub lobby_chat_enabled: bool,
    /// Full spectator data (username, avatar, joined_at)
    #[serde(default)]
    pub spectators_data: Vec<GameSpectator>,
    /// Players recorded at game start (for rejoin support)
    #[serde(default)]
    pub recorded_players: Vec<i64>,
    /// Spectators recorded at game start (for rejoin support)
    #[serde(default)]
    pub recorded_spectators: Vec<i64>,
    /// Players selected by admin from lobby to play
    #[serde(default)]
    pub selected_players: Vec<i64>,
    /// Players that are currently auto-controlled (disconnected + kicked)
    #[serde(default)]
    pub auto_players: Vec<i64>,
}

fn default_player_count() -> i32 {
    2
}

fn default_allow_spectators() -> bool {
    true
}

fn default_max_spectators() -> i32 {
    10
}

fn default_lobby_chat_enabled() -> bool {
    true
}

impl GameRoom {
    pub fn new(room_id: &str, room_name: &str, game_type: GameType, host_id: i64) -> Self {
        Self {
            room_id: room_id.to_string(),
            room_name: room_name.to_string(),
            game_type,
            status: RoomStatus::Waiting,
            host_id,
            players: Vec::new(),
            lobby: Vec::new(),
            banned_users: Vec::new(),
            spectators: Vec::new(),
            current_turn: None,
            turn_number: 0,
            created_at: Utc::now(),
            started_at: None,
            finished_at: None,
            winner_id: None,
            password_hash: None,
            is_password_protected: false,
            // Enhanced fields
            player_count: 2,
            allow_spectators: true,
            max_spectators: 10,
            admin_spectator_id: None,
            lobby_chat_enabled: true,
            spectators_data: Vec::new(),
            recorded_players: Vec::new(),
            recorded_spectators: Vec::new(),
            selected_players: Vec::new(),
            auto_players: Vec::new(),
        }
    }

    /// Create a new room with optional password protection and room settings
    pub fn new_with_password(
        room_id: &str,
        room_name: &str,
        game_type: GameType,
        host_id: i64,
        password: Option<&str>,
    ) -> Self {
        let password_hash = password.and_then(|p| {
            if p.is_empty() {
                None
            } else {
                bcrypt::hash(p, bcrypt::DEFAULT_COST).ok()
            }
        });
        let is_password_protected = password_hash.is_some();

        Self {
            room_id: room_id.to_string(),
            room_name: room_name.to_string(),
            game_type,
            status: RoomStatus::Waiting,
            host_id,
            players: Vec::new(),
            lobby: Vec::new(),
            banned_users: Vec::new(),
            spectators: Vec::new(),
            current_turn: None,
            turn_number: 0,
            created_at: Utc::now(),
            started_at: None,
            finished_at: None,
            winner_id: None,
            password_hash,
            is_password_protected,
            // Enhanced fields
            player_count: 2,
            allow_spectators: true,
            max_spectators: 10,
            admin_spectator_id: None,
            lobby_chat_enabled: true,
            spectators_data: Vec::new(),
            recorded_players: Vec::new(),
            recorded_spectators: Vec::new(),
            selected_players: Vec::new(),
            auto_players: Vec::new(),
        }
    }

    /// Create a new room with full settings
    pub fn new_with_settings(
        room_id: &str,
        room_name: &str,
        game_type: GameType,
        host_id: i64,
        password: Option<&str>,
        player_count: i32,
        allow_spectators: bool,
    ) -> Self {
        let password_hash = password.and_then(|p| {
            if p.is_empty() {
                None
            } else {
                bcrypt::hash(p, bcrypt::DEFAULT_COST).ok()
            }
        });
        let is_password_protected = password_hash.is_some();
        // Clamp player_count to valid range
        let player_count = player_count.clamp(2, 10);

        Self {
            room_id: room_id.to_string(),
            room_name: room_name.to_string(),
            game_type,
            status: RoomStatus::Waiting,
            host_id,
            players: Vec::new(),
            lobby: Vec::new(),
            banned_users: Vec::new(),
            spectators: Vec::new(),
            current_turn: None,
            turn_number: 0,
            created_at: Utc::now(),
            started_at: None,
            finished_at: None,
            winner_id: None,
            password_hash,
            is_password_protected,
            // Enhanced fields
            player_count,
            allow_spectators,
            max_spectators: 10,
            admin_spectator_id: None,
            lobby_chat_enabled: true,
            spectators_data: Vec::new(),
            recorded_players: Vec::new(),
            recorded_spectators: Vec::new(),
            selected_players: Vec::new(),
            auto_players: Vec::new(),
        }
    }

    /// Verify a password against the stored hash
    /// Returns true if room is public (no password) or password matches
    pub fn verify_password(&self, password: &str) -> bool {
        match &self.password_hash {
            Some(hash) => bcrypt::verify(password, hash).unwrap_or(false),
            None => true, // Public room, no password needed
        }
    }

    pub fn is_full(&self) -> bool {
        // Use player_count setting if available, otherwise fall back to game type
        self.players.len() >= self.player_count as usize
    }

    pub fn can_start(&self) -> bool {
        // All selected players must be ready and we need exactly player_count players
        self.selected_players.len() == self.player_count as usize
            && self.players.iter().all(|p| p.is_ready)
            && self.status == RoomStatus::Waiting
    }

    /// Check if all selected players are ready (for new ready system)
    pub fn all_selected_ready(&self) -> bool {
        if self.selected_players.is_empty() {
            return false;
        }
        // All selected players must exist in lobby and be ready
        self.selected_players.iter().all(|&uid| {
            self.lobby.iter().find(|p| p.user_id == uid).map(|p| p.is_ready).unwrap_or(false)
        })
    }

    pub fn is_player(&self, user_id: i64) -> bool {
        self.players.iter().any(|p| p.user_id == user_id)
    }

    /// Check if player is auto-controlled
    pub fn is_auto_player(&self, user_id: i64) -> bool {
        self.auto_players.contains(&user_id)
    }

    /// Enable auto-control for a player
    pub fn enable_auto_player(&mut self, user_id: i64) {
        if !self.auto_players.contains(&user_id) {
            self.auto_players.push(user_id);
        }
    }

    /// Disable auto-control for a player
    pub fn disable_auto_player(&mut self, user_id: i64) {
        self.auto_players.retain(|&id| id != user_id);
    }

    pub fn is_spectator(&self, user_id: i64) -> bool {
        // Check both legacy and new spectator lists
        self.spectators.contains(&user_id) || self.spectators_data.iter().any(|s| s.user_id == user_id)
    }

    /// Check if user is a selected player (in selected_players list)
    pub fn is_selected_player(&self, user_id: i64) -> bool {
        self.selected_players.contains(&user_id)
    }

    /// Check if user is the admin spectator
    pub fn is_admin_spectator(&self, user_id: i64) -> bool {
        self.admin_spectator_id == Some(user_id)
    }

    /// Check if room can accept more spectators
    pub fn can_join_as_spectator(&self) -> bool {
        self.allow_spectators && (self.spectators_data.len() as i32) < self.max_spectators
    }

    pub fn get_player(&self, user_id: i64) -> Option<&GamePlayer> {
        self.players.iter().find(|p| p.user_id == user_id)
    }

    pub fn get_player_mut(&mut self, user_id: i64) -> Option<&mut GamePlayer> {
        self.players.iter_mut().find(|p| p.user_id == user_id)
    }

    /// Check if user is in the lobby
    pub fn is_in_lobby(&self, user_id: i64) -> bool {
        self.lobby.iter().any(|p| p.user_id == user_id)
    }

    /// Check if user is banned from this room
    pub fn is_banned(&self, user_id: i64) -> bool {
        self.banned_users.iter().any(|b| b.user_id == user_id)
    }

    /// Check if user is the room admin (host)
    pub fn is_admin(&self, user_id: i64) -> bool {
        self.host_id == user_id
    }

    /// Get lobby player by ID
    pub fn get_lobby_player(&self, user_id: i64) -> Option<&GamePlayer> {
        self.lobby.iter().find(|p| p.user_id == user_id)
    }

    /// Remove player from lobby and return them
    pub fn remove_from_lobby(&mut self, user_id: i64) -> Option<GamePlayer> {
        if let Some(idx) = self.lobby.iter().position(|p| p.user_id == user_id) {
            Some(self.lobby.remove(idx))
        } else {
            None
        }
    }

    /// Add user to banned list
    pub fn ban_user(&mut self, user_id: i64, username: &str) {
        if !self.is_banned(user_id) {
            self.banned_users.push(BannedPlayer {
                user_id,
                username: username.to_string(),
            });
        }
    }

    /// Remove user from banned list
    pub fn unban_user(&mut self, user_id: i64) -> Option<BannedPlayer> {
        if let Some(pos) = self.banned_users.iter().position(|b| b.user_id == user_id) {
            Some(self.banned_users.remove(pos))
        } else {
            None
        }
    }

    // ========== Enhanced Game Room Methods ==========

    /// Add a spectator with full data
    pub fn add_spectator(&mut self, user_id: i64, username: &str, avatar_id: Option<i64>) {
        if !self.is_spectator(user_id) {
            self.spectators_data.push(GameSpectator {
                user_id,
                username: username.to_string(),
                avatar_id,
                joined_at: Utc::now(),
            });
            // Also add to legacy list for backwards compatibility
            if !self.spectators.contains(&user_id) {
                self.spectators.push(user_id);
            }
        }
    }

    /// Remove a spectator
    pub fn remove_spectator(&mut self, user_id: i64) -> Option<GameSpectator> {
        // Remove from legacy list
        if let Some(pos) = self.spectators.iter().position(|&id| id == user_id) {
            self.spectators.remove(pos);
        }
        // Remove from spectators_data
        if let Some(pos) = self.spectators_data.iter().position(|s| s.user_id == user_id) {
            Some(self.spectators_data.remove(pos))
        } else {
            None
        }
    }

    /// Get spectator by ID
    pub fn get_spectator(&self, user_id: i64) -> Option<&GameSpectator> {
        self.spectators_data.iter().find(|s| s.user_id == user_id)
    }

    /// Select a player from lobby (add to selected_players)
    pub fn select_player(&mut self, user_id: i64) -> bool {
        if self.is_in_lobby(user_id) && !self.is_selected_player(user_id) {
            if (self.selected_players.len() as i32) < self.player_count {
                self.selected_players.push(user_id);
                return true;
            }
        }
        false
    }

    /// Deselect a player (remove from selected_players)
    pub fn deselect_player(&mut self, user_id: i64) -> bool {
        if let Some(pos) = self.selected_players.iter().position(|&id| id == user_id) {
            self.selected_players.remove(pos);
            true
        } else {
            false
        }
    }

    /// Designate an admin spectator (must be a current spectator)
    pub fn designate_admin_spectator(&mut self, user_id: i64) -> bool {
        if self.is_spectator(user_id) {
            self.admin_spectator_id = Some(user_id);
            true
        } else {
            false
        }
    }

    /// Clear admin spectator designation
    pub fn clear_admin_spectator(&mut self) {
        self.admin_spectator_id = None;
    }

    /// Record membership at game start (for rejoin support)
    pub fn record_membership(&mut self) {
        self.recorded_players = self.players.iter().map(|p| p.user_id).collect();
        self.recorded_spectators = self.spectators_data.iter().map(|s| s.user_id).collect();
    }

    /// Get rejoin role for a user (None if not recorded)
    pub fn get_rejoin_role(&self, user_id: i64) -> Option<&'static str> {
        if self.recorded_players.contains(&user_id) {
            Some("player")
        } else if self.recorded_spectators.contains(&user_id) {
            Some("spectator")
        } else {
            None
        }
    }

    /// Move selected players to players list (when game starts)
    pub fn move_selected_to_players(&mut self) {
        for user_id in &self.selected_players {
            if let Some(idx) = self.lobby.iter().position(|p| p.user_id == *user_id) {
                let mut player = self.lobby.remove(idx);
                player.score = 0; // Reset score
                self.players.push(player);
            }
        }
        // Clear selected_players as they are now in players
        self.selected_players.clear();
    }

    /// Disable lobby chat (when game starts)
    pub fn disable_lobby_chat(&mut self) {
        self.lobby_chat_enabled = false;
    }

    /// Enable lobby chat (when game ends or in waiting)
    pub fn enable_lobby_chat(&mut self) {
        self.lobby_chat_enabled = true;
    }

    /// Check if user can send chat to a specific channel
    pub fn can_chat_in_channel(&self, user_id: i64, channel: &ChatChannel) -> bool {
        match channel {
            ChatChannel::Lobby => {
                // Lobby chat available to everyone in the room during waiting phase
                // This includes players, lobby members, and spectators
                self.lobby_chat_enabled && self.status == RoomStatus::Waiting
                    && (self.is_player(user_id) || self.is_in_lobby(user_id) || self.is_spectator(user_id))
            }
            ChatChannel::Players => {
                // Players chat only during game
                self.status == RoomStatus::InProgress && self.is_player(user_id)
            }
            ChatChannel::Spectators => {
                // Spectators chat only during game
                self.status == RoomStatus::InProgress && self.is_spectator(user_id)
            }
        }
    }
}

/// Game command from WebSocket gateway (received via Kafka)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameCommand {
    #[serde(rename = "create_room")]
    CreateRoom {
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        game_type: String,
        room_name: String,
        socket_id: String,
        /// Optional password for room protection
        password: Option<String>,
        /// Number of players for the game (2-10)
        #[serde(default)]
        player_count: Option<i32>,
        /// Whether spectators are allowed
        #[serde(default)]
        allow_spectators: Option<bool>,
    },
    #[serde(rename = "join_room")]
    JoinRoom {
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        room_name: String,
        socket_id: String,
        /// Password required for protected rooms
        password: Option<String>,
    },
    #[serde(rename = "leave_room")]
    LeaveRoom {
        user_id: i64,
        room_id: String,
        socket_id: String,
    },
    #[serde(rename = "rejoin_room")]
    RejoinRoom {
        user_id: i64,
        room_id: String,
        socket_id: String,
    },
    #[serde(rename = "ready")]
    Ready {
        user_id: i64,
        room_id: String,
        socket_id: String,
    },
    #[serde(rename = "spectate")]
    Spectate {
        user_id: i64,
        room_id: String,
        socket_id: String,
    },
    #[serde(rename = "leave_spectate")]
    LeaveSpectate {
        user_id: i64,
        room_id: String,
        socket_id: String,
    },
    /// Admin selects a player from lobby to play against
    #[serde(rename = "select_player")]
    SelectPlayer {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },
    /// Admin kicks a player from lobby
    #[serde(rename = "kick_player")]
    KickPlayer {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },
    /// Admin bans a player from room (cannot rejoin)
    #[serde(rename = "ban_player")]
    BanPlayer {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },
    /// Admin unbans a player from room
    #[serde(rename = "unban_player")]
    UnbanPlayer {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },
    // Bigger Dice specific commands
    #[serde(rename = "bigger_dice.roll")]
    BiggerDiceRoll {
        user_id: i64,
        room_id: String,
        socket_id: String,
    },

    // ========== Enhanced Game Room Commands ==========

    /// Send a chat message to a channel
    #[serde(rename = "send_chat")]
    SendChat {
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        room_id: String,
        channel: String, // "lobby", "players", or "spectators"
        content: String,
        socket_id: String,
    },
    /// Mute a user in your local chat view
    #[serde(rename = "mute_user")]
    MuteUser {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },
    /// Unmute a previously muted user
    #[serde(rename = "unmute_user")]
    UnmuteUser {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },
    /// Admin deselects a player (move back from selected to lobby)
    #[serde(rename = "deselect_player")]
    DeselectPlayer {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },
    /// Host designates an admin spectator (when host wants to play)
    #[serde(rename = "designate_admin_spectator")]
    DesignateAdminSpectator {
        user_id: i64,
        room_id: String,
        target_user_id: i64,
        socket_id: String,
    },
    /// Join room as a spectator (with full user data)
    #[serde(rename = "join_as_spectator")]
    JoinAsSpectator {
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        room_name: String,
        socket_id: String,
        /// Password required for protected rooms
        password: Option<String>,
    },
    /// Set ready status (true/false toggle)
    #[serde(rename = "set_ready")]
    SetReady {
        user_id: i64,
        room_id: String,
        is_ready: bool,
        socket_id: String,
    },
    /// Host starts the game (when all selected players are ready)
    #[serde(rename = "start_game")]
    StartGame {
        user_id: i64,
        room_id: String,
        socket_id: String,
    },
    /// Get chat history for a channel
    #[serde(rename = "get_chat_history")]
    GetChatHistory {
        user_id: i64,
        room_id: String,
        channel: String,
        limit: Option<i64>,
        socket_id: String,
    },
}

/// Game event to send back to WebSocket gateway (published via Kafka)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameEvent {
    #[serde(rename = "room_created")]
    RoomCreated {
        room_id: String,
        room_name: String,
        game_type: String,
        host_id: i64,
        host_username: String,
        /// Flag for UI to show lock icon
        is_password_protected: bool,
        /// Number of players for the game
        player_count: i32,
        /// Whether spectators are allowed
        allow_spectators: bool,
    },
    #[serde(rename = "room_joined")]
    RoomJoined {
        room_id: String,
        room_name: String,
        player: GamePlayer,
    },
    #[serde(rename = "player_left")]
    PlayerLeft {
        room_id: String,
        user_id: i64,
        username: String,
    },
    #[serde(rename = "player_rejoined")]
    PlayerRejoined {
        room_id: String,
        user_id: i64,
        username: String,
    },
    /// Player disconnected (timeout countdown started)
    #[serde(rename = "player_disconnected")]
    PlayerDisconnected {
        room_id: String,
        user_id: i64,
        username: String,
        timeout_at: DateTime<Utc>,
    },
    /// Player switched to auto-control
    #[serde(rename = "player_auto_enabled")]
    PlayerAutoEnabled {
        room_id: String,
        user_id: i64,
        username: String,
    },
    /// Player regained manual control
    #[serde(rename = "player_auto_disabled")]
    PlayerAutoDisabled {
        room_id: String,
        user_id: i64,
        username: String,
    },
    #[serde(rename = "player_ready")]
    PlayerReady {
        room_id: String,
        user_id: i64,
        username: String,
    },
    #[serde(rename = "game_started")]
    GameStarted {
        room_id: String,
        players: Vec<GamePlayer>,
        first_turn: i64,
    },
    #[serde(rename = "turn_changed")]
    TurnChanged {
        room_id: String,
        current_turn: i64,
        turn_number: i32,
    },
    #[serde(rename = "game_ended")]
    GameEnded {
        room_id: String,
        winner_id: i64,
        winner_username: String,
        final_scores: Vec<(i64, String, i32)>, // (user_id, username, score)
    },
    #[serde(rename = "spectator_joined")]
    SpectatorJoined {
        room_id: String,
        user_id: i64,
        username: String,
    },
    #[serde(rename = "spectator_left")]
    SpectatorLeft {
        room_id: String,
        user_id: i64,
        username: String,
    },
    /// Sent to a spectator when they are kicked by admin
    #[serde(rename = "spectator_kicked")]
    SpectatorKicked {
        room_id: String,
        user_id: i64,
        username: String,
    },
    #[serde(rename = "room_state")]
    RoomState {
        room: GameRoom,
    },
    #[serde(rename = "error")]
    Error {
        code: String,
        message: String,
        socket_id: String,
    },
    /// Sent when user tries to rejoin a room they're not in
    /// Includes room info so frontend can show "Enter Room" button
    #[serde(rename = "not_in_room")]
    NotInRoom {
        room_id: String,
        room_name: String,
        is_password_protected: bool,
        status: RoomStatus,
        allow_spectators: bool,
        socket_id: String,
    },
    /// Player joined the room lobby (waiting to be selected)
    #[serde(rename = "lobby_joined")]
    LobbyJoined {
        room_id: String,
        room_name: String,
        player: GamePlayer,
    },
    /// Player was selected by admin to play
    #[serde(rename = "player_selected")]
    PlayerSelected {
        room_id: String,
        player: GamePlayer,
    },
    /// Player was kicked from lobby
    #[serde(rename = "player_kicked")]
    PlayerKicked {
        room_id: String,
        user_id: i64,
        username: String,
    },
    /// Player was banned from room
    #[serde(rename = "player_banned")]
    PlayerBanned {
        room_id: String,
        user_id: i64,
        username: String,
    },
    /// Player was unbanned from room
    #[serde(rename = "player_unbanned")]
    PlayerUnbanned {
        room_id: String,
        user_id: i64,
        username: String,
    },
    /// Sent when user tries to rejoin/join a room they are banned from
    #[serde(rename = "user_banned")]
    UserBanned {
        room_id: String,
        room_name: String,
        socket_id: String,
    },
    /// Lobby list updated (for full sync)
    #[serde(rename = "lobby_updated")]
    LobbyUpdated {
        room_id: String,
        lobby: Vec<GamePlayer>,
    },
    // Bigger Dice specific events
    #[serde(rename = "bigger_dice.rolled")]
    BiggerDiceRolled {
        room_id: String,
        player_id: i64,
        player_username: String,
        roll: i32,
        new_score: i32,
    },
    /// Round result for N-player Bigger Dice
    #[serde(rename = "bigger_dice.round_result")]
    BiggerDiceRoundResult {
        room_id: String,
        /// All rolls for this round: (player_id, roll)
        rolls: Vec<(i64, i32)>,
        /// Winner if exactly one player had highest roll, None if tie
        winner_id: Option<i64>,
        /// True if multiple players tied for highest
        is_tie: bool,
        /// True if this was a tiebreaker round
        is_tiebreaker: bool,
        /// Players going to tiebreaker (only set when is_tie=true)
        tiebreaker_players: Vec<i64>,
        /// Authoritative scores for all players after this round: (player_id, score)
        /// This ensures spectators and players see synchronized scores
        scores: Vec<(i64, i32)>,
    },
    /// Tiebreaker started for N-player Bigger Dice
    #[serde(rename = "bigger_dice.tiebreaker_started")]
    BiggerDiceTiebreakerStarted {
        room_id: String,
        /// Players participating in the tiebreaker
        tied_players: Vec<i64>,
        /// The roll value they all tied on
        tied_roll: i32,
    },
    /// Current round state for N-player Bigger Dice (for rejoin/sync)
    #[serde(rename = "bigger_dice.state")]
    BiggerDiceState {
        room_id: String,
        /// Current round number
        round_number: i32,
        /// Rolls so far this round: (player_id, roll)
        current_rolls: Vec<(i64, i32)>,
        /// Players who still need to roll
        pending_rollers: Vec<i64>,
        /// Whether we are in a tiebreaker
        is_tiebreaker: bool,
        /// Complete round history for rejoining players (from MongoDB)
        /// Each entry: { round, rolls: [{id, roll, username}], winnerId, winnerName, isTiebreaker }
        #[serde(default)]
        round_history: Vec<serde_json::Value>,
    },
    /// Game over for Bigger Dice (first to 10 points)
    #[serde(rename = "bigger_dice.game_over")]
    BiggerDiceGameOver {
        room_id: String,
        winner_id: i64,
        winner_username: String,
        final_scores: Vec<(i64, String, i32)>, // (user_id, username, score)
    },

    // ========== Tic Tac Toe Events ==========

    /// Move made on the board
    #[serde(rename = "tic_tac_toe.moved")]
    TicTacToeMoved {
        room_id: String,
        player_id: i64,
        player_username: String,
        position: u8,
        mark: char,
        board: Vec<Option<char>>,
    },
    /// Single game ended within match (winner or draw)
    #[serde(rename = "tic_tac_toe.game_result")]
    TicTacToeGameResult {
        room_id: String,
        /// Winner of this game (None if draw)
        winner_id: Option<i64>,
        winner_username: Option<String>,
        /// Winning line positions (None if draw)
        winning_line: Option<Vec<u8>>,
        /// True if game was a draw
        is_draw: bool,
        /// Current match scores after this game
        scores: Vec<(i64, i32)>,
        /// Current game number in match
        game_number: i32,
        /// Next player to start (X in next game)
        next_first_player: i64,
    },
    /// Match ended (first to 5 wins)
    #[serde(rename = "tic_tac_toe.match_ended")]
    TicTacToeMatchEnded {
        room_id: String,
        winner_id: i64,
        winner_username: String,
        final_scores: Vec<(i64, String, i32)>,
        prize_amount: i64,
    },
    /// Full state sync (for rejoin/spectators)
    #[serde(rename = "tic_tac_toe.state")]
    TicTacToeState {
        room_id: String,
        board: Vec<Option<char>>,
        player_x_id: i64,
        player_o_id: i64,
        current_turn: i64,
        scores: Vec<(i64, i32)>,
        game_number: i32,
        move_deadline: Option<String>,
        is_paused: bool,
        disconnected_player: Option<i64>,
    },
    /// Player forfeited game due to turn timeout
    #[serde(rename = "tic_tac_toe.turn_timeout")]
    TicTacToeTurnTimeout {
        room_id: String,
        player_id: i64,
        player_username: String,
        /// Opponent who wins this game
        winner_id: i64,
        winner_username: String,
        scores: Vec<(i64, i32)>,
        game_number: i32,
    },
    /// Match cancelled (both players disconnected > 10 min)
    #[serde(rename = "tic_tac_toe.match_cancelled")]
    TicTacToeMatchCancelled {
        room_id: String,
        reason: String,
        refund_amount: i64,
    },
    /// Game paused due to player disconnect
    #[serde(rename = "tic_tac_toe.game_paused")]
    TicTacToeGamePaused {
        room_id: String,
        disconnected_player_id: i64,
        disconnected_player_username: String,
        timeout_at: String,
    },
    /// Game resumed after player reconnect
    #[serde(rename = "tic_tac_toe.game_resumed")]
    TicTacToeGameResumed {
        room_id: String,
        reconnected_player_id: i64,
        reconnected_player_username: String,
    },

    /// List of available rooms (sent in response to list_rooms command)
    #[serde(rename = "room_list")]
    RoomList {
        rooms: Vec<serde_json::Value>,
        socket_id: String,
    },
    /// Room was removed/deactivated (host left or game finished)
    #[serde(rename = "room_removed")]
    RoomRemoved {
        room_id: String,
        room_name: String,
        reason: String, // "host_left", "game_finished", "abandoned"
    },

    // ========== Enhanced Game Room Events ==========

    /// Chat message sent (generic - deprecated, use game-specific variants)
    #[serde(rename = "chat_message")]
    ChatMessage {
        room_id: String,
        channel: String,
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        content: String,
        is_system: bool,
        timestamp: String,
    },
    /// Chat history response (generic - deprecated, use game-specific variants)
    #[serde(rename = "chat_history")]
    ChatHistory {
        room_id: String,
        channel: String,
        messages: Vec<serde_json::Value>,
        socket_id: String,
    },

    // ========== Bigger Dice Game-Specific Chat Events ==========

    /// Bigger Dice lobby chat message
    #[serde(rename = "bigger_dice.lobby_chat")]
    BiggerDiceLobbyChat {
        room_id: String,
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        content: String,
        is_system: bool,
        timestamp: String,
    },
    /// Bigger Dice player chat message
    #[serde(rename = "bigger_dice.player_chat")]
    BiggerDicePlayerChat {
        room_id: String,
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        content: String,
        is_system: bool,
        timestamp: String,
    },
    /// Bigger Dice spectator chat message
    #[serde(rename = "bigger_dice.spectator_chat")]
    BiggerDiceSpectatorChat {
        room_id: String,
        user_id: i64,
        username: String,
        avatar_id: Option<i64>,
        content: String,
        is_system: bool,
        timestamp: String,
    },
    /// Bigger Dice lobby chat history
    #[serde(rename = "bigger_dice.lobby_chat_history")]
    BiggerDiceLobbyChatHistory {
        room_id: String,
        messages: Vec<serde_json::Value>,
        socket_id: String,
    },
    /// Bigger Dice player chat history
    #[serde(rename = "bigger_dice.player_chat_history")]
    BiggerDicePlayerChatHistory {
        room_id: String,
        messages: Vec<serde_json::Value>,
        socket_id: String,
    },
    /// Bigger Dice spectator chat history
    #[serde(rename = "bigger_dice.spectator_chat_history")]
    BiggerDiceSpectatorChatHistory {
        room_id: String,
        messages: Vec<serde_json::Value>,
        socket_id: String,
    },
    /// User was muted (sent to the user who muted)
    #[serde(rename = "user_muted")]
    UserMuted {
        room_id: String,
        target_user_id: i64,
        target_username: String,
        socket_id: String,
    },
    /// User was unmuted (sent to the user who unmuted)
    #[serde(rename = "user_unmuted")]
    UserUnmuted {
        room_id: String,
        target_user_id: i64,
        target_username: String,
        socket_id: String,
    },
    /// Player was deselected by admin (moved back to lobby)
    #[serde(rename = "player_deselected")]
    PlayerDeselected {
        room_id: String,
        user_id: i64,
        username: String,
    },
    /// Admin spectator was designated
    #[serde(rename = "admin_spectator_designated")]
    AdminSpectatorDesignated {
        room_id: String,
        user_id: i64,
        username: String,
    },
    /// Spectator joined with full data
    #[serde(rename = "spectator_data_joined")]
    SpectatorDataJoined {
        room_id: String,
        spectator: GameSpectator,
    },
    /// Player's ready status changed
    #[serde(rename = "player_ready_changed")]
    PlayerReadyChanged {
        room_id: String,
        user_id: i64,
        username: String,
        is_ready: bool,
    },
    /// Selected players list updated
    #[serde(rename = "selected_players_updated")]
    SelectedPlayersUpdated {
        room_id: String,
        selected_players: Vec<i64>,
    },
    /// Spectators list updated (full sync)
    #[serde(rename = "spectators_updated")]
    SpectatorsUpdated {
        room_id: String,
        spectators: Vec<GameSpectator>,
    },
    /// Rejoin role information (player, spectator, or none)
    #[serde(rename = "rejoin_role")]
    RejoinRole {
        room_id: String,
        role: Option<String>, // "player", "spectator", or null
        socket_id: String,
    },
    /// Player was removed from game (not selected)
    #[serde(rename = "removed_from_game")]
    RemovedFromGame {
        room_id: String,
        reason: String,    // "not_selected", etc.
        message: String,   // Human-readable message
    },
    /// Game is starting - ready phase begins
    #[serde(rename = "game_starting")]
    GameStarting {
        room_id: String,
        players: Vec<GamePlayer>,
    },
}

impl GameEvent {
    /// Get the event type name (matches serde rename values)
    /// Used to construct the full event_type like "games.event.room_created"
    pub fn event_type_name(&self) -> &'static str {
        match self {
            GameEvent::RoomCreated { .. } => "room_created",
            GameEvent::RoomJoined { .. } => "room_joined",
            GameEvent::PlayerLeft { .. } => "player_left",
            GameEvent::PlayerRejoined { .. } => "player_rejoined",
            GameEvent::PlayerDisconnected { .. } => "player_disconnected",
            GameEvent::PlayerAutoEnabled { .. } => "player_auto_enabled",
            GameEvent::PlayerAutoDisabled { .. } => "player_auto_disabled",
            GameEvent::PlayerReady { .. } => "player_ready",
            GameEvent::GameStarted { .. } => "game_started",
            GameEvent::TurnChanged { .. } => "turn_changed",
            GameEvent::GameEnded { .. } => "game_ended",
            GameEvent::SpectatorJoined { .. } => "spectator_joined",
            GameEvent::SpectatorLeft { .. } => "spectator_left",
            GameEvent::SpectatorKicked { .. } => "spectator_kicked",
            GameEvent::RoomState { .. } => "room_state",
            GameEvent::Error { .. } => "error",
            GameEvent::NotInRoom { .. } => "not_in_room",
            GameEvent::LobbyJoined { .. } => "lobby_joined",
            GameEvent::PlayerSelected { .. } => "player_selected",
            GameEvent::PlayerKicked { .. } => "player_kicked",
            GameEvent::PlayerBanned { .. } => "player_banned",
            GameEvent::PlayerUnbanned { .. } => "player_unbanned",
            GameEvent::UserBanned { .. } => "user_banned",
            GameEvent::LobbyUpdated { .. } => "lobby_updated",
            GameEvent::BiggerDiceRolled { .. } => "bigger_dice.rolled",
            GameEvent::BiggerDiceRoundResult { .. } => "bigger_dice.round_result",
            GameEvent::BiggerDiceTiebreakerStarted { .. } => "bigger_dice.tiebreaker_started",
            GameEvent::BiggerDiceState { .. } => "bigger_dice.state",
            GameEvent::BiggerDiceGameOver { .. } => "bigger_dice.game_over",
            // Tic Tac Toe events
            GameEvent::TicTacToeMoved { .. } => "tic_tac_toe.moved",
            GameEvent::TicTacToeGameResult { .. } => "tic_tac_toe.game_result",
            GameEvent::TicTacToeMatchEnded { .. } => "tic_tac_toe.match_ended",
            GameEvent::TicTacToeState { .. } => "tic_tac_toe.state",
            GameEvent::TicTacToeTurnTimeout { .. } => "tic_tac_toe.turn_timeout",
            GameEvent::TicTacToeMatchCancelled { .. } => "tic_tac_toe.match_cancelled",
            GameEvent::TicTacToeGamePaused { .. } => "tic_tac_toe.game_paused",
            GameEvent::TicTacToeGameResumed { .. } => "tic_tac_toe.game_resumed",
            GameEvent::RoomList { .. } => "room_list",
            GameEvent::RoomRemoved { .. } => "room_removed",
            // Enhanced game room events (generic - deprecated)
            GameEvent::ChatMessage { .. } => "chat_message",
            GameEvent::ChatHistory { .. } => "chat_history",
            // Bigger Dice game-specific chat events
            GameEvent::BiggerDiceLobbyChat { .. } => "bigger_dice.lobby_chat",
            GameEvent::BiggerDicePlayerChat { .. } => "bigger_dice.player_chat",
            GameEvent::BiggerDiceSpectatorChat { .. } => "bigger_dice.spectator_chat",
            GameEvent::BiggerDiceLobbyChatHistory { .. } => "bigger_dice.lobby_chat_history",
            GameEvent::BiggerDicePlayerChatHistory { .. } => "bigger_dice.player_chat_history",
            GameEvent::BiggerDiceSpectatorChatHistory { .. } => "bigger_dice.spectator_chat_history",
            GameEvent::UserMuted { .. } => "user_muted",
            GameEvent::UserUnmuted { .. } => "user_unmuted",
            GameEvent::PlayerDeselected { .. } => "player_deselected",
            GameEvent::AdminSpectatorDesignated { .. } => "admin_spectator_designated",
            GameEvent::SpectatorDataJoined { .. } => "spectator_data_joined",
            GameEvent::PlayerReadyChanged { .. } => "player_ready_changed",
            GameEvent::SelectedPlayersUpdated { .. } => "selected_players_updated",
            GameEvent::SpectatorsUpdated { .. } => "spectators_updated",
            GameEvent::RejoinRole { .. } => "rejoin_role",
            GameEvent::RemovedFromGame { .. } => "removed_from_game",
            GameEvent::GameStarting { .. } => "game_starting",
        }
    }
}

/// Game history record (stored in MongoDB)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameHistory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<mongodb::bson::oid::ObjectId>,
    pub room_id: String,
    pub room_name: String,
    pub game_type: GameType,
    pub players: Vec<GameHistoryPlayer>,
    pub winner_id: Option<i64>,
    pub duration_seconds: i64,
    pub turns: Vec<GameTurn>,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
}

/// Player record in game history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameHistoryPlayer {
    pub user_id: i64,
    pub username: String,
    pub final_score: i32,
    pub is_winner: bool,
}

/// Single turn in game history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameTurn {
    pub turn_number: i32,
    pub player_id: i64,
    pub action: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

/// Roll data for a single player in a round
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiggerDicePlayerRoll {
    pub user_id: i64,
    pub username: String,
    pub roll: i32,
}

/// Individual round result for BiggerDice (stored in MongoDB during gameplay)
/// This allows rejoining players to see the full round history on the game over screen
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BiggerDiceRoundResult {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<mongodb::bson::oid::ObjectId>,
    /// Room ID this round belongs to
    pub room_id: String,
    /// Sequential round number (1, 2, 3, ...)
    pub round_number: i32,
    /// Roll results for each player in this round
    pub rolls: Vec<BiggerDicePlayerRoll>,
    /// ID of the player who won this round (None if tie went to tiebreaker)
    pub winner_id: Option<i64>,
    /// Username of the winner
    pub winner_username: Option<String>,
    /// Whether this was a tiebreaker round
    pub is_tiebreaker: bool,
    /// When this round completed
    pub completed_at: DateTime<Utc>,
}

/// Event envelope for Kafka messages (matches ws_gateway protocol)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub event_id: String,
    pub event_type: String,
    pub timestamp: String,
    #[serde(default)]
    pub correlation_id: Option<String>,
    #[serde(default = "default_producer")]
    pub producer: String,
    pub actor: Actor,
    pub audience: Audience,
    pub payload: serde_json::Value,
}

fn default_producer() -> String {
    "blazing_sun".to_string()
}

/// Actor who triggered the event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Actor {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string"
    )]
    pub user_id: i64,
    pub username: String,
    #[serde(default)]
    pub socket_id: String,
    #[serde(default)]
    pub roles: Vec<String>,
}

/// Audience type for routing events
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AudienceType {
    User,
    Users,
    Room,
    Broadcast,
    Spectators,
    Players,
}

/// Target audience for the event (matches ws_gateway format)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Audience {
    #[serde(rename = "type")]
    pub audience_type: AudienceType,
    #[serde(default)]
    pub user_ids: Vec<String>,
    #[serde(default)]
    pub room_id: Option<String>,
    #[serde(default)]
    pub game_id: Option<String>,
}

impl Audience {
    /// Create an audience for a single user
    pub fn user(user_id: i64) -> Self {
        Self {
            audience_type: AudienceType::User,
            user_ids: vec![user_id.to_string()],
            room_id: None,
            game_id: None,
        }
    }

    /// Create an audience for multiple users
    pub fn users(user_ids: Vec<i64>) -> Self {
        Self {
            audience_type: AudienceType::Users,
            user_ids: user_ids.into_iter().map(|id| id.to_string()).collect(),
            room_id: None,
            game_id: None,
        }
    }

    /// Create an audience for a room
    pub fn room(room_id: impl Into<String>) -> Self {
        Self {
            audience_type: AudienceType::Room,
            user_ids: vec![],
            room_id: Some(room_id.into()),
            game_id: None,
        }
    }

    /// Create an audience for broadcast
    pub fn broadcast() -> Self {
        Self {
            audience_type: AudienceType::Broadcast,
            user_ids: vec![],
            room_id: None,
            game_id: None,
        }
    }

    /// Create an audience for spectators
    pub fn spectators(game_id: impl Into<String>) -> Self {
        Self {
            audience_type: AudienceType::Spectators,
            user_ids: vec![],
            room_id: None,
            game_id: Some(game_id.into()),
        }
    }

    /// Create an audience for players only
    pub fn players(room_id: impl Into<String>) -> Self {
        Self {
            audience_type: AudienceType::Players,
            user_ids: vec![],
            room_id: Some(room_id.into()),
            game_id: None,
        }
    }
}
