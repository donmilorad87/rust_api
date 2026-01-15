//! Game Room Read Queries
//!
//! Read operations for the game_rooms table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

/// Player in a game room (from JSONB)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamePlayerDb {
    pub user_id: i64,
    pub username: String,
    pub avatar_id: Option<i64>,
    pub score: i32,
    pub is_ready: bool,
    pub joined_at: DateTime<Utc>,
}

/// Game room record from database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRoomRecord {
    pub id: i64,
    pub room_id: String,
    pub room_name: String,
    pub game_type: String,
    pub status: String,
    pub host_id: i64,
    pub players: serde_json::Value,
    pub lobby: serde_json::Value,
    pub banned_users: Vec<i64>,
    pub spectators: Vec<i64>,
    pub current_turn: Option<i64>,
    pub turn_number: i32,
    pub winner_id: Option<i64>,
    pub is_password_protected: bool,
    pub password_hash: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
    // New fields for enhanced game rooms
    pub player_count: i32,
    pub allow_spectators: bool,
    pub max_spectators: i32,
    pub admin_spectator_id: Option<i64>,
    pub lobby_chat_enabled: bool,
    pub spectators_data: serde_json::Value,
    pub recorded_players: Vec<i64>,
    pub recorded_spectators: Vec<i64>,
    pub selected_players: Vec<i64>,
}

/// Game room list item (lighter for list display)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRoomListItem {
    pub room_id: String,
    pub room_name: String,
    pub game_type: String,
    pub status: String,
    pub host_id: i64,
    pub players: serde_json::Value,
    pub player_count: i32,
    pub is_password_protected: bool,
    pub created_at: DateTime<Utc>,
}

/// Get game room by room_id
pub async fn get_by_room_id(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<Option<GameRoomRecord>, sqlx::Error> {
    sqlx::query_as!(
        GameRoomRecord,
        r#"
        SELECT
            id,
            room_id,
            room_name,
            game_type,
            status,
            host_id,
            players,
            lobby,
            banned_users,
            spectators,
            current_turn,
            turn_number,
            winner_id,
            is_password_protected,
            password_hash,
            is_active,
            created_at,
            started_at,
            finished_at,
            updated_at,
            player_count,
            allow_spectators,
            max_spectators,
            admin_spectator_id,
            lobby_chat_enabled,
            spectators_data,
            recorded_players,
            recorded_spectators,
            selected_players
        FROM game_rooms
        WHERE room_id = $1
        "#,
        room_id
    )
    .fetch_optional(db)
    .await
}

/// Get game room by room_name (for joining by name)
pub async fn get_by_room_name(
    db: &Pool<Postgres>,
    room_name: &str,
) -> Result<Option<GameRoomRecord>, sqlx::Error> {
    sqlx::query_as!(
        GameRoomRecord,
        r#"
        SELECT
            id,
            room_id,
            room_name,
            game_type,
            status,
            host_id,
            players,
            lobby,
            banned_users,
            spectators,
            current_turn,
            turn_number,
            winner_id,
            is_password_protected,
            password_hash,
            is_active,
            created_at,
            started_at,
            finished_at,
            updated_at,
            player_count,
            allow_spectators,
            max_spectators,
            admin_spectator_id,
            lobby_chat_enabled,
            spectators_data,
            recorded_players,
            recorded_spectators,
            selected_players
        FROM game_rooms
        WHERE room_name = $1
        AND status IN ('waiting', 'in_progress')
        AND is_active = TRUE
        "#,
        room_name
    )
    .fetch_optional(db)
    .await
}

/// List active game rooms
pub async fn list_active_rooms(
    db: &Pool<Postgres>,
    game_type: Option<&str>,
) -> Result<Vec<GameRoomListItem>, sqlx::Error> {
    if let Some(gt) = game_type {
        sqlx::query_as!(
            GameRoomListItem,
            r#"
            SELECT
                room_id,
                room_name,
                game_type,
                status,
                host_id,
                players,
                jsonb_array_length(players) as "player_count!: i32",
                is_password_protected,
                created_at
            FROM game_rooms
            WHERE status IN ('waiting', 'in_progress')
            AND game_type = $1
            AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 50
            "#,
            gt
        )
        .fetch_all(db)
        .await
    } else {
        sqlx::query_as!(
            GameRoomListItem,
            r#"
            SELECT
                room_id,
                room_name,
                game_type,
                status,
                host_id,
                players,
                jsonb_array_length(players) as "player_count!: i32",
                is_password_protected,
                created_at
            FROM game_rooms
            WHERE status IN ('waiting', 'in_progress')
            AND is_active = TRUE
            ORDER BY created_at DESC
            LIMIT 50
            "#
        )
        .fetch_all(db)
        .await
    }
}

/// Check if room exists
pub async fn exists(db: &Pool<Postgres>, room_id: &str) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM game_rooms WHERE room_id = $1) as "exists!""#,
        room_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if room name exists (for validation)
pub async fn name_exists(db: &Pool<Postgres>, room_name: &str) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM game_rooms WHERE room_name = $1 AND status IN ('waiting', 'in_progress') AND is_active = TRUE) as "exists!""#,
        room_name
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if user is host of a room
pub async fn is_host(db: &Pool<Postgres>, room_id: &str, user_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM game_rooms WHERE room_id = $1 AND host_id = $2) as "exists!""#,
        room_id,
        user_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if user is banned from a room
pub async fn is_user_banned(db: &Pool<Postgres>, room_id: &str, user_id: i64) -> bool {
    sqlx::query!(
        r#"SELECT EXISTS(SELECT 1 FROM game_rooms WHERE room_id = $1 AND $2 = ANY(banned_users)) as "exists!""#,
        room_id,
        user_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Get rooms by host (for cleanup or admin)
pub async fn get_by_host(
    db: &Pool<Postgres>,
    host_id: i64,
) -> Result<Vec<GameRoomListItem>, sqlx::Error> {
    sqlx::query_as!(
        GameRoomListItem,
        r#"
        SELECT
            room_id,
            room_name,
            game_type,
            status,
            host_id,
            players,
            jsonb_array_length(players) as "player_count!: i32",
            is_password_protected,
            created_at
        FROM game_rooms
        WHERE host_id = $1
        ORDER BY created_at DESC
        "#,
        host_id
    )
    .fetch_all(db)
    .await
}

/// Count active rooms
pub async fn count_active(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM game_rooms WHERE status IN ('waiting', 'in_progress')"#
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Get waiting rooms only (for room list in lobby)
pub async fn get_waiting_rooms(
    db: &Pool<Postgres>,
    game_type: &str,
) -> Result<Vec<GameRoomRecord>, sqlx::Error> {
    sqlx::query_as!(
        GameRoomRecord,
        r#"
        SELECT
            id,
            room_id,
            room_name,
            game_type,
            status,
            host_id,
            players,
            lobby,
            banned_users,
            spectators,
            current_turn,
            turn_number,
            winner_id,
            is_password_protected,
            password_hash,
            is_active,
            created_at,
            started_at,
            finished_at,
            updated_at,
            player_count,
            allow_spectators,
            max_spectators,
            admin_spectator_id,
            lobby_chat_enabled,
            spectators_data,
            recorded_players,
            recorded_spectators,
            selected_players
        FROM game_rooms
        WHERE status = 'waiting'
        AND game_type = $1
        AND is_active = TRUE
        ORDER BY created_at DESC
        LIMIT 50
        "#,
        game_type
    )
    .fetch_all(db)
    .await
}

/// Get active rooms (waiting + in-progress) for a game type
pub async fn get_active_rooms(
    db: &Pool<Postgres>,
    game_type: &str,
) -> Result<Vec<GameRoomRecord>, sqlx::Error> {
    sqlx::query_as!(
        GameRoomRecord,
        r#"
        SELECT
            id,
            room_id,
            room_name,
            game_type,
            status,
            host_id,
            players,
            lobby,
            banned_users,
            spectators,
            current_turn,
            turn_number,
            winner_id,
            is_password_protected,
            password_hash,
            is_active,
            created_at,
            started_at,
            finished_at,
            updated_at,
            player_count,
            allow_spectators,
            max_spectators,
            admin_spectator_id,
            lobby_chat_enabled,
            spectators_data,
            recorded_players,
            recorded_spectators,
            selected_players
        FROM game_rooms
        WHERE status IN ('waiting', 'in_progress')
        AND game_type = $1
        AND is_active = TRUE
        ORDER BY created_at DESC
        LIMIT 50
        "#,
        game_type
    )
    .fetch_all(db)
    .await
}

// =============================================================================
// Enhanced Game Room Read Functions
// =============================================================================

/// Check if user is a selected player
pub async fn is_selected_player(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> bool {
    sqlx::query_scalar!(
        r#"SELECT EXISTS(
            SELECT 1 FROM game_rooms
            WHERE room_id = $1
            AND $2 = ANY(selected_players)
        ) as "exists!""#,
        room_id,
        user_id
    )
    .fetch_one(db)
    .await
    .map(|r| r)
    .unwrap_or(false)
}

/// Check if user is a spectator
pub async fn is_spectator(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> bool {
    sqlx::query_scalar!(
        r#"SELECT EXISTS(
            SELECT 1 FROM game_rooms
            WHERE room_id = $1
            AND $2 = ANY(spectators)
        ) as "exists!""#,
        room_id,
        user_id
    )
    .fetch_one(db)
    .await
    .map(|r| r)
    .unwrap_or(false)
}

/// Check if user is the admin spectator
pub async fn is_admin_spectator(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> bool {
    sqlx::query_scalar!(
        r#"SELECT EXISTS(
            SELECT 1 FROM game_rooms
            WHERE room_id = $1
            AND admin_spectator_id = $2
        ) as "exists!""#,
        room_id,
        user_id
    )
    .fetch_one(db)
    .await
    .map(|r| r)
    .unwrap_or(false)
}

/// Get the count of selected players
pub async fn get_selected_player_count(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COALESCE(array_length(selected_players, 1), 0) as "count!"
        FROM game_rooms WHERE room_id = $1"#,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.into())
}

/// Get the count of spectators
pub async fn get_spectator_count(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COALESCE(array_length(spectators, 1), 0) as "count!"
        FROM game_rooms WHERE room_id = $1"#,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.into())
}

/// Check if room allows spectators and has capacity
pub async fn can_join_as_spectator(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT
            allow_spectators
            AND COALESCE(array_length(spectators, 1), 0) < max_spectators
        as "can_join!"
        FROM game_rooms
        WHERE room_id = $1
        "#,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Check if lobby chat is enabled
pub async fn is_lobby_chat_enabled(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT lobby_chat_enabled FROM game_rooms WHERE room_id = $1"#,
        room_id
    )
    .fetch_optional(db)
    .await?;

    Ok(result.unwrap_or(false))
}

/// Check if user can rejoin an in-progress game
pub async fn get_rejoin_role(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<Option<String>, sqlx::Error> {
    let row = sqlx::query!(
        r#"
        SELECT
            CASE
                WHEN $2 = ANY(recorded_players) THEN 'player'
                WHEN $2 = ANY(recorded_spectators) THEN 'spectator'
                ELSE NULL
            END as "role"
        FROM game_rooms
        WHERE room_id = $1
        AND status = 'in_progress'
        "#,
        room_id,
        user_id
    )
    .fetch_optional(db)
    .await?;

    Ok(row.and_then(|r| r.role))
}

/// Get room settings for display
pub async fn get_room_settings(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<Option<(i32, bool, i32, bool)>, sqlx::Error> {
    // Returns (player_count, allow_spectators, max_spectators, lobby_chat_enabled)
    let row = sqlx::query!(
        r#"
        SELECT player_count, allow_spectators, max_spectators, lobby_chat_enabled
        FROM game_rooms
        WHERE room_id = $1
        "#,
        room_id
    )
    .fetch_optional(db)
    .await?;

    Ok(row.map(|r| (r.player_count, r.allow_spectators, r.max_spectators, r.lobby_chat_enabled)))
}
