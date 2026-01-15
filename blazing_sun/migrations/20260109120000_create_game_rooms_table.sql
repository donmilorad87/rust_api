-- Create game_rooms table for active game sessions
-- This table stores active game rooms that persist across server restarts
-- Finished games are archived to MongoDB for historical records

CREATE TABLE IF NOT EXISTS game_rooms (
    id BIGSERIAL PRIMARY KEY,
    room_id VARCHAR(64) NOT NULL UNIQUE,
    room_name VARCHAR(100) NOT NULL,
    game_type VARCHAR(50) NOT NULL DEFAULT 'bigger_dice',
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    host_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Players and lobby stored as JSONB for flexibility
    players JSONB NOT NULL DEFAULT '[]'::JSONB,
    lobby JSONB NOT NULL DEFAULT '[]'::JSONB,
    banned_users BIGINT[] NOT NULL DEFAULT '{}',
    spectators BIGINT[] NOT NULL DEFAULT '{}',

    -- Game state
    current_turn BIGINT,
    turn_number INTEGER NOT NULL DEFAULT 0,
    winner_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

    -- Password protection
    password_hash VARCHAR(255),
    is_password_protected BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('waiting', 'in_progress', 'finished', 'abandoned')),
    CONSTRAINT valid_game_type CHECK (game_type IN ('bigger_dice'))
);

-- Indexes for common queries
CREATE INDEX idx_game_rooms_status ON game_rooms(status);
CREATE INDEX idx_game_rooms_game_type ON game_rooms(game_type);
CREATE INDEX idx_game_rooms_host_id ON game_rooms(host_id);
CREATE INDEX idx_game_rooms_created_at ON game_rooms(created_at);
CREATE INDEX idx_game_rooms_room_name ON game_rooms(room_name);

-- GIN index for searching players in JSONB
CREATE INDEX idx_game_rooms_players ON game_rooms USING GIN (players);
CREATE INDEX idx_game_rooms_lobby ON game_rooms USING GIN (lobby);

-- Create stored procedures for game room operations

-- Function to create a new game room
CREATE OR REPLACE FUNCTION sp_create_game_room(
    p_room_id VARCHAR(64),
    p_room_name VARCHAR(100),
    p_game_type VARCHAR(50),
    p_host_id BIGINT,
    p_password_hash VARCHAR(255) DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_room_pk BIGINT;
    v_host_player JSONB;
BEGIN
    -- Get host user info for initial player entry
    SELECT jsonb_build_object(
        'user_id', u.id,
        'username', u.first_name,
        'avatar_id', u.avatar_id,
        'score', 0,
        'is_ready', FALSE,
        'joined_at', NOW()
    )
    INTO v_host_player
    FROM users u
    WHERE u.id = p_host_id;

    IF v_host_player IS NULL THEN
        RAISE EXCEPTION 'Host user not found: %', p_host_id;
    END IF;

    -- Insert the game room with host as first player
    INSERT INTO game_rooms (
        room_id, room_name, game_type, host_id,
        players, password_hash, is_password_protected
    )
    VALUES (
        p_room_id, p_room_name, p_game_type, p_host_id,
        jsonb_build_array(v_host_player),
        p_password_hash,
        p_password_hash IS NOT NULL
    )
    RETURNING id INTO v_room_pk;

    RETURN v_room_pk;
END;
$$ LANGUAGE plpgsql;

-- Function to add player to lobby
CREATE OR REPLACE FUNCTION sp_add_to_lobby(
    p_room_id VARCHAR(64),
    p_user_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_player JSONB;
    v_room_status VARCHAR(20);
    v_banned BIGINT[];
BEGIN
    -- Check room status and banned list
    SELECT status, banned_users INTO v_room_status, v_banned
    FROM game_rooms
    WHERE room_id = p_room_id;

    IF v_room_status IS NULL THEN
        RAISE EXCEPTION 'Room not found: %', p_room_id;
    END IF;

    IF v_room_status != 'waiting' THEN
        RAISE EXCEPTION 'Room is not accepting new players';
    END IF;

    IF p_user_id = ANY(v_banned) THEN
        RAISE EXCEPTION 'User is banned from this room';
    END IF;

    -- Build player object
    SELECT jsonb_build_object(
        'user_id', u.id,
        'username', u.first_name,
        'avatar_id', u.avatar_id,
        'score', 0,
        'is_ready', FALSE,
        'joined_at', NOW()
    )
    INTO v_player
    FROM users u
    WHERE u.id = p_user_id;

    IF v_player IS NULL THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Add to lobby
    UPDATE game_rooms
    SET lobby = lobby || v_player,
        updated_at = NOW()
    WHERE room_id = p_room_id
    AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(lobby) AS l
        WHERE (l->>'user_id')::BIGINT = p_user_id
    )
    AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(players) AS p
        WHERE (p->>'user_id')::BIGINT = p_user_id
    );

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to select player from lobby (admin action)
CREATE OR REPLACE FUNCTION sp_select_player_from_lobby(
    p_room_id VARCHAR(64),
    p_admin_id BIGINT,
    p_target_user_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_room RECORD;
    v_player JSONB;
    v_player_idx INTEGER;
BEGIN
    -- Get room and verify admin
    SELECT * INTO v_room
    FROM game_rooms
    WHERE room_id = p_room_id;

    IF v_room IS NULL THEN
        RAISE EXCEPTION 'Room not found: %', p_room_id;
    END IF;

    IF v_room.host_id != p_admin_id THEN
        RAISE EXCEPTION 'Only room admin can select players';
    END IF;

    IF jsonb_array_length(v_room.players) >= 2 THEN
        RAISE EXCEPTION 'Room is full';
    END IF;

    -- Find and extract player from lobby
    SELECT idx - 1, elem INTO v_player_idx, v_player
    FROM jsonb_array_elements(v_room.lobby) WITH ORDINALITY AS arr(elem, idx)
    WHERE (elem->>'user_id')::BIGINT = p_target_user_id;

    IF v_player IS NULL THEN
        RAISE EXCEPTION 'Player not in lobby: %', p_target_user_id;
    END IF;

    -- Move player from lobby to players
    UPDATE game_rooms
    SET players = players || v_player,
        lobby = lobby - v_player_idx,
        updated_at = NOW()
    WHERE room_id = p_room_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to kick player from lobby
CREATE OR REPLACE FUNCTION sp_kick_player(
    p_room_id VARCHAR(64),
    p_admin_id BIGINT,
    p_target_user_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_room RECORD;
    v_player_idx INTEGER;
BEGIN
    -- Get room and verify admin
    SELECT * INTO v_room
    FROM game_rooms
    WHERE room_id = p_room_id;

    IF v_room IS NULL THEN
        RAISE EXCEPTION 'Room not found: %', p_room_id;
    END IF;

    IF v_room.host_id != p_admin_id THEN
        RAISE EXCEPTION 'Only room admin can kick players';
    END IF;

    -- Find player index in lobby
    SELECT idx - 1 INTO v_player_idx
    FROM jsonb_array_elements(v_room.lobby) WITH ORDINALITY AS arr(elem, idx)
    WHERE (elem->>'user_id')::BIGINT = p_target_user_id;

    IF v_player_idx IS NULL THEN
        RAISE EXCEPTION 'Player not in lobby: %', p_target_user_id;
    END IF;

    -- Remove from lobby
    UPDATE game_rooms
    SET lobby = lobby - v_player_idx,
        updated_at = NOW()
    WHERE room_id = p_room_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to ban player from room
CREATE OR REPLACE FUNCTION sp_ban_player(
    p_room_id VARCHAR(64),
    p_admin_id BIGINT,
    p_target_user_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_room RECORD;
    v_player_idx INTEGER;
BEGIN
    -- Get room and verify admin
    SELECT * INTO v_room
    FROM game_rooms
    WHERE room_id = p_room_id;

    IF v_room IS NULL THEN
        RAISE EXCEPTION 'Room not found: %', p_room_id;
    END IF;

    IF v_room.host_id != p_admin_id THEN
        RAISE EXCEPTION 'Only room admin can ban players';
    END IF;

    IF p_target_user_id = p_admin_id THEN
        RAISE EXCEPTION 'Cannot ban yourself';
    END IF;

    -- Find player index in lobby
    SELECT idx - 1 INTO v_player_idx
    FROM jsonb_array_elements(v_room.lobby) WITH ORDINALITY AS arr(elem, idx)
    WHERE (elem->>'user_id')::BIGINT = p_target_user_id;

    -- Remove from lobby if present
    IF v_player_idx IS NOT NULL THEN
        UPDATE game_rooms
        SET lobby = lobby - v_player_idx
        WHERE room_id = p_room_id;
    END IF;

    -- Add to banned list
    UPDATE game_rooms
    SET banned_users = array_append(banned_users, p_target_user_id),
        updated_at = NOW()
    WHERE room_id = p_room_id
    AND NOT (p_target_user_id = ANY(banned_users));

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to get room by ID
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
        gr.password_hash, gr.created_at, gr.started_at, gr.finished_at
    FROM game_rooms gr
    WHERE gr.room_id = p_room_id;
END;
$$ LANGUAGE plpgsql;

-- Function to list active rooms
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
    player_count INTEGER,
    is_password_protected BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        gr.room_id, gr.room_name, gr.game_type, gr.status, gr.host_id,
        gr.players, jsonb_array_length(gr.players)::INTEGER,
        gr.is_password_protected, gr.created_at
    FROM game_rooms gr
    WHERE (p_game_type IS NULL OR gr.game_type = p_game_type)
    AND (p_status IS NULL OR gr.status = p_status)
    AND gr.status IN ('waiting', 'in_progress')
    ORDER BY gr.created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Function to update player score
CREATE OR REPLACE FUNCTION sp_update_player_score(
    p_room_id VARCHAR(64),
    p_user_id BIGINT,
    p_score_delta INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_new_score INTEGER;
    v_player_idx INTEGER;
BEGIN
    -- Find player index
    SELECT idx - 1 INTO v_player_idx
    FROM game_rooms gr,
         jsonb_array_elements(gr.players) WITH ORDINALITY AS arr(elem, idx)
    WHERE gr.room_id = p_room_id
    AND (elem->>'user_id')::BIGINT = p_user_id;

    IF v_player_idx IS NULL THEN
        RAISE EXCEPTION 'Player not in room: %', p_user_id;
    END IF;

    -- Update score
    UPDATE game_rooms
    SET players = jsonb_set(
        players,
        ARRAY[v_player_idx::TEXT, 'score'],
        to_jsonb(COALESCE((players->v_player_idx->>'score')::INTEGER, 0) + p_score_delta)
    ),
    updated_at = NOW()
    WHERE room_id = p_room_id
    RETURNING (players->v_player_idx->>'score')::INTEGER INTO v_new_score;

    RETURN v_new_score;
END;
$$ LANGUAGE plpgsql;

-- Function to delete room (when finished or abandoned)
CREATE OR REPLACE FUNCTION sp_delete_game_room(
    p_room_id VARCHAR(64)
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM game_rooms WHERE room_id = p_room_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_game_room_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_game_room_timestamp
    BEFORE UPDATE ON game_rooms
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_game_room_timestamp();

-- Cleanup function to remove abandoned rooms (can be called by cron)
CREATE OR REPLACE FUNCTION sp_cleanup_abandoned_rooms(
    p_timeout_minutes INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM game_rooms
        WHERE status = 'waiting'
        AND updated_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM deleted;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
