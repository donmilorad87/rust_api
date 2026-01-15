//! Game Room Mutation Queries
//!
//! Write operations for the game_rooms table.

use sqlx::{Pool, Postgres};

/// Parameters for creating a new game room
pub struct CreateRoomParams {
    pub room_id: String,
    pub room_name: String,
    pub game_type: String,
    pub host_id: i64,
    pub password_hash: Option<String>,
    pub player_count: Option<i32>,
    pub allow_spectators: Option<bool>,
}

/// Create a new game room using stored procedure
pub async fn create(db: &Pool<Postgres>, params: &CreateRoomParams) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_create_game_room($1, $2, $3, $4, $5, $6, $7) as "id!""#,
        params.room_id,
        params.room_name,
        params.game_type,
        params.host_id,
        params.password_hash.as_deref(),
        params.player_count.unwrap_or(2),
        params.allow_spectators.unwrap_or(true)
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Add user to room lobby
pub async fn add_to_lobby(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_add_to_lobby($1, $2) as "success!""#,
        room_id,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Select player from lobby (admin action)
pub async fn select_player(
    db: &Pool<Postgres>,
    room_id: &str,
    admin_id: i64,
    target_user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_select_player_from_lobby($1, $2, $3) as "success!""#,
        room_id,
        admin_id,
        target_user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Kick player from lobby (admin action)
pub async fn kick_player(
    db: &Pool<Postgres>,
    room_id: &str,
    admin_id: i64,
    target_user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_kick_player($1, $2, $3) as "success!""#,
        room_id,
        admin_id,
        target_user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Ban player from room (admin action)
pub async fn ban_player(
    db: &Pool<Postgres>,
    room_id: &str,
    admin_id: i64,
    target_user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_ban_player($1, $2, $3) as "success!""#,
        room_id,
        admin_id,
        target_user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Ban player from room without admin check (system action)
pub async fn ban_player_system(
    db: &Pool<Postgres>,
    room_id: &str,
    target_user_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET banned_users = array_append(banned_users, $2),
            updated_at = NOW()
        WHERE room_id = $1
        AND NOT ($2 = ANY(banned_users))
        "#,
        room_id,
        target_user_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Unban player from room (admin action)
pub async fn unban_player(
    db: &Pool<Postgres>,
    room_id: &str,
    admin_id: i64,
    target_user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_unban_player($1, $2, $3) as "success!""#,
        room_id,
        admin_id,
        target_user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Update room status
pub async fn update_status(
    db: &Pool<Postgres>,
    room_id: &str,
    status: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE game_rooms SET status = $1 WHERE room_id = $2"#,
        status,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Set room to in_progress with started_at timestamp
pub async fn start_game(db: &Pool<Postgres>, room_id: &str, first_turn: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET status = 'in_progress',
            started_at = NOW(),
            current_turn = $1,
            turn_number = 1
        WHERE room_id = $2
        "#,
        first_turn,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update current turn
pub async fn update_turn(
    db: &Pool<Postgres>,
    room_id: &str,
    current_turn: i64,
    turn_number: i32,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE game_rooms SET current_turn = $1, turn_number = $2 WHERE room_id = $3"#,
        current_turn,
        turn_number,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update player score
pub async fn update_player_score(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
    score_delta: i32,
) -> Result<i32, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_update_player_score($1, $2, $3) as "new_score!""#,
        room_id,
        user_id,
        score_delta
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Set player ready status
pub async fn set_player_ready(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
    is_ready: bool,
) -> Result<(), sqlx::Error> {
    // Update player in JSONB array
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET players = (
            SELECT jsonb_agg(
                CASE
                    WHEN (elem->>'user_id')::BIGINT = $2
                    THEN jsonb_set(elem, '{is_ready}', $3::TEXT::JSONB)
                    ELSE elem
                END
            )
            FROM jsonb_array_elements(players) AS elem
        )
        WHERE room_id = $1
        "#,
        room_id,
        user_id,
        is_ready.to_string()
    )
    .execute(db)
    .await?;

    Ok(())
}

/// End game with winner (also deactivates the room)
pub async fn end_game(
    db: &Pool<Postgres>,
    room_id: &str,
    winner_id: Option<i64>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET status = 'finished',
            finished_at = NOW(),
            winner_id = $1,
            is_active = FALSE
        WHERE room_id = $2
        "#,
        winner_id,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Deactivate a room (soft delete)
/// Used when host leaves before game starts
pub async fn deactivate(db: &Pool<Postgres>, room_id: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_deactivate_game_room($1) as "success!""#,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Delete game room
pub async fn delete(db: &Pool<Postgres>, room_id: &str) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_delete_game_room($1) as "success!""#,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Remove player from room (when leaving)
pub async fn remove_player(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<(), sqlx::Error> {
    // Remove from players array
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET players = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::JSONB)
            FROM jsonb_array_elements(players) AS elem
            WHERE (elem->>'user_id')::BIGINT != $2
        )
        WHERE room_id = $1
        "#,
        room_id,
        user_id
    )
    .execute(db)
    .await?;

    // Also remove from lobby if present
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET lobby = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::JSONB)
            FROM jsonb_array_elements(lobby) AS elem
            WHERE (elem->>'user_id')::BIGINT != $2
        )
        WHERE room_id = $1
        "#,
        room_id,
        user_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Add spectator to room
pub async fn add_spectator(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET spectators = array_append(spectators, $1)
        WHERE room_id = $2
        AND NOT ($1 = ANY(spectators))
        "#,
        user_id,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Remove spectator from room
pub async fn remove_spectator(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET spectators = array_remove(spectators, $1)
        WHERE room_id = $2
        "#,
        user_id,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Cleanup abandoned rooms (for cron job)
pub async fn cleanup_abandoned(
    db: &Pool<Postgres>,
    timeout_minutes: i32,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_cleanup_abandoned_rooms($1) as "count!""#,
        timeout_minutes
    )
    .fetch_one(db)
    .await?;

    Ok(result.into())
}

// =============================================================================
// Enhanced Game Room Functions
// =============================================================================

/// Add spectator to room with full data (using stored procedure)
pub async fn add_spectator_with_data(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_add_spectator($1, $2) as "success!""#,
        room_id,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Remove spectator from room with cleanup (using stored procedure)
pub async fn remove_spectator_with_cleanup(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_remove_spectator($1, $2) as "success!""#,
        room_id,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Select player from lobby (admin selects who will play) - using new procedure
pub async fn select_player_for_game(
    db: &Pool<Postgres>,
    room_id: &str,
    admin_id: i64,
    target_user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_select_player($1, $2, $3) as "success!""#,
        room_id,
        admin_id,
        target_user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Deselect player (admin removes from selected players)
pub async fn deselect_player(
    db: &Pool<Postgres>,
    room_id: &str,
    admin_id: i64,
    target_user_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_deselect_player($1, $2, $3) as "success!""#,
        room_id,
        admin_id,
        target_user_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Designate a spectator as admin spectator (moderator)
pub async fn designate_admin_spectator(
    db: &Pool<Postgres>,
    room_id: &str,
    admin_id: i64,
    spectator_id: i64,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_designate_admin_spectator($1, $2, $3) as "success!""#,
        room_id,
        admin_id,
        spectator_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Remove admin spectator designation
pub async fn remove_admin_spectator(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET admin_spectator_id = NULL,
            updated_at = NOW()
        WHERE room_id = $1
        "#,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Record game membership at game start (for rejoin authorization)
pub async fn record_game_membership(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT sp_record_game_membership($1) as "success!""#,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Disable lobby chat (called when game starts)
pub async fn disable_lobby_chat(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET lobby_chat_enabled = FALSE,
            updated_at = NOW()
        WHERE room_id = $1
        "#,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Enable lobby chat (for testing or reset)
pub async fn enable_lobby_chat(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET lobby_chat_enabled = TRUE,
            updated_at = NOW()
        WHERE room_id = $1
        "#,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Move selected players to players array when game starts
pub async fn move_selected_to_players(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<(), sqlx::Error> {
    // Move selected players from lobby to players array
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET players = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::JSONB)
            FROM jsonb_array_elements(lobby) AS elem
            WHERE (elem->>'user_id')::BIGINT = ANY(selected_players)
        ),
        lobby = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::JSONB)
            FROM jsonb_array_elements(lobby) AS elem
            WHERE NOT ((elem->>'user_id')::BIGINT = ANY(selected_players))
        ),
        updated_at = NOW()
        WHERE room_id = $1
        "#,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Clear selected players (reset selection)
pub async fn clear_selected_players(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE game_rooms
        SET selected_players = '{}',
            updated_at = NOW()
        WHERE room_id = $1
        "#,
        room_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Check if a user can rejoin (was recorded in game membership)
pub async fn can_rejoin(
    db: &Pool<Postgres>,
    room_id: &str,
    user_id: i64,
) -> Result<Option<String>, sqlx::Error> {
    // Returns "player", "spectator", or None
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

/// Remove unselected players from lobby when game starts
pub async fn remove_unselected_from_lobby(
    db: &Pool<Postgres>,
    room_id: &str,
) -> Result<u64, sqlx::Error> {
    // Get count before and after for reporting
    let result = sqlx::query!(
        r#"
        UPDATE game_rooms
        SET lobby = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::JSONB)
            FROM jsonb_array_elements(lobby) AS elem
            WHERE (elem->>'user_id')::BIGINT = ANY(selected_players)
        ),
        updated_at = NOW()
        WHERE room_id = $1
        RETURNING jsonb_array_length(lobby) as removed_count
        "#,
        room_id
    )
    .fetch_one(db)
    .await?;

    Ok(result.removed_count.unwrap_or(0) as u64)
}

/// Update the lobby JSONB column (for ready status changes, etc.)
pub async fn update_lobby(
    db: &Pool<Postgres>,
    room_id: &str,
    lobby_json: &serde_json::Value,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE game_rooms SET lobby = $1, updated_at = NOW() WHERE room_id = $2")
        .bind(lobby_json)
        .bind(room_id)
        .execute(db)
        .await?;

    Ok(())
}

/// Start the game with full state update (status, turn, players, lobby)
pub async fn start_game_with_state(
    db: &Pool<Postgres>,
    room_id: &str,
    current_turn: Option<i64>,
    players_json: &serde_json::Value,
    lobby_json: &serde_json::Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"UPDATE game_rooms SET
            status = 'in_progress',
            started_at = NOW(),
            current_turn = $1,
            turn_number = 1,
            players = $2,
            lobby = $3,
            updated_at = NOW()
        WHERE room_id = $4"#,
    )
    .bind(current_turn)
    .bind(players_json)
    .bind(lobby_json)
    .bind(room_id)
    .execute(db)
    .await?;

    Ok(())
}
