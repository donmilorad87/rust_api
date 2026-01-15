-- Add is_active column for soft delete of game rooms
-- is_active = true: Room is active and should appear in room lists
-- is_active = false: Room is deactivated (host left, game finished, etc.)

ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Add index for filtering active rooms
CREATE INDEX IF NOT EXISTS idx_game_rooms_is_active ON game_rooms(is_active);

-- Drop existing functions first to allow changing return types
DROP FUNCTION IF EXISTS sp_list_game_rooms(VARCHAR(50), VARCHAR(20));
DROP FUNCTION IF EXISTS sp_get_game_room(VARCHAR(64));
DROP FUNCTION IF EXISTS sp_deactivate_game_room(VARCHAR(64));
DROP FUNCTION IF EXISTS sp_start_game(VARCHAR(64), BIGINT);
DROP FUNCTION IF EXISTS sp_finish_game(VARCHAR(64), BIGINT);

-- Update stored procedure to filter by is_active
CREATE OR REPLACE FUNCTION sp_list_game_rooms(
    p_game_type VARCHAR(50) DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT NULL
)
RETURNS TABLE (
    room_id VARCHAR(64),
    room_name VARCHAR(100),
    game_type VARCHAR(50),
    status VARCHAR(20),
    host_id BIGINT,
    players JSONB,
    lobby JSONB,
    player_count INTEGER,
    is_password_protected BOOLEAN,
    created_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        gr.room_id, gr.room_name, gr.game_type, gr.status, gr.host_id,
        gr.players, gr.lobby, jsonb_array_length(gr.players)::INTEGER,
        gr.is_password_protected, gr.created_at, gr.started_at
    FROM game_rooms gr
    WHERE (p_game_type IS NULL OR gr.game_type = p_game_type)
    AND (p_status IS NULL OR gr.status = p_status)
    AND gr.is_active = TRUE
    AND gr.status IN ('waiting', 'in_progress')
    ORDER BY gr.created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Stored procedure to deactivate a room (soft delete)
CREATE OR REPLACE FUNCTION sp_deactivate_game_room(
    p_room_id VARCHAR(64)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE game_rooms
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE room_id = p_room_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Stored procedure to start a game (sets started_at)
CREATE OR REPLACE FUNCTION sp_start_game(
    p_room_id VARCHAR(64),
    p_first_turn_user_id BIGINT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE game_rooms
    SET status = 'in_progress',
        started_at = NOW(),
        current_turn = p_first_turn_user_id,
        turn_number = 1,
        updated_at = NOW()
    WHERE room_id = p_room_id
    AND status = 'waiting';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Stored procedure to finish a game
CREATE OR REPLACE FUNCTION sp_finish_game(
    p_room_id VARCHAR(64),
    p_winner_id BIGINT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE game_rooms
    SET status = 'finished',
        is_active = FALSE,
        winner_id = p_winner_id,
        finished_at = NOW(),
        updated_at = NOW()
    WHERE room_id = p_room_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Update sp_get_game_room to include is_active
CREATE OR REPLACE FUNCTION sp_get_game_room(
    p_room_id VARCHAR(64)
)
RETURNS TABLE (
    id BIGINT,
    room_id VARCHAR(64),
    room_name VARCHAR(100),
    game_type VARCHAR(50),
    status VARCHAR(20),
    host_id BIGINT,
    players JSONB,
    lobby JSONB,
    banned_users BIGINT[],
    spectators BIGINT[],
    current_turn BIGINT,
    turn_number INTEGER,
    winner_id BIGINT,
    is_password_protected BOOLEAN,
    password_hash VARCHAR(255),
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        gr.id, gr.room_id, gr.room_name, gr.game_type, gr.status,
        gr.host_id, gr.players, gr.lobby, gr.banned_users, gr.spectators,
        gr.current_turn, gr.turn_number, gr.winner_id, gr.is_password_protected,
        gr.password_hash, gr.is_active, gr.created_at, gr.started_at, gr.finished_at
    FROM game_rooms gr
    WHERE gr.room_id = p_room_id;
END;
$$ LANGUAGE plpgsql;
