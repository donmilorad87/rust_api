-- Alter game_rooms table for enhanced features
-- Adds: player_count, spectator settings, admin spectator, recorded members for rejoin

-- Player count (2-10, set at room creation)
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS player_count INTEGER NOT NULL DEFAULT 2;
ALTER TABLE game_rooms ADD CONSTRAINT valid_player_count CHECK (player_count >= 2 AND player_count <= 10);

-- Spectator settings
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS allow_spectators BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS max_spectators INTEGER NOT NULL DEFAULT 10;
ALTER TABLE game_rooms ADD CONSTRAINT valid_max_spectators CHECK (max_spectators >= 0 AND max_spectators <= 10);

-- Admin spectator (designated moderator when admin is playing)
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS admin_spectator_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- Lobby chat control (disabled after game starts)
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS lobby_chat_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Convert spectators from BIGINT[] to JSONB for full spectator info
-- First, create a new column
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS spectators_data JSONB NOT NULL DEFAULT '[]'::JSONB;

-- Migrate existing spectator IDs to JSONB format (will be populated by app code on next access)
-- For now, just track that we have a new format

-- Recorded members at game start (for rejoin authorization)
-- These are snapshots taken when game starts
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS recorded_players BIGINT[] NOT NULL DEFAULT '{}';
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS recorded_spectators BIGINT[] NOT NULL DEFAULT '{}';

-- Selected players (before game starts, admin selects from lobby)
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS selected_players BIGINT[] NOT NULL DEFAULT '{}';

-- Index for admin spectator lookups
CREATE INDEX IF NOT EXISTS idx_game_rooms_admin_spectator ON game_rooms(admin_spectator_id) WHERE admin_spectator_id IS NOT NULL;

-- Update the sp_create_game_room function to include new fields
CREATE OR REPLACE FUNCTION sp_create_game_room(
    p_room_id VARCHAR(64),
    p_room_name VARCHAR(100),
    p_game_type VARCHAR(50),
    p_host_id BIGINT,
    p_password_hash VARCHAR(255) DEFAULT NULL,
    p_player_count INTEGER DEFAULT 2,
    p_allow_spectators BOOLEAN DEFAULT TRUE
)
RETURNS BIGINT AS $$
DECLARE
    v_room_pk BIGINT;
    v_host_player JSONB;
BEGIN
    -- Validate player count
    IF p_player_count < 2 OR p_player_count > 10 THEN
        RAISE EXCEPTION 'Player count must be between 2 and 10';
    END IF;

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

    -- Insert the game room with host as first player in lobby
    -- Host starts in lobby, then gets selected/moved to players when game starts
    INSERT INTO game_rooms (
        room_id, room_name, game_type, host_id,
        players, lobby, password_hash, is_password_protected,
        player_count, allow_spectators
    )
    VALUES (
        p_room_id, p_room_name, p_game_type, p_host_id,
        '[]'::JSONB,  -- players empty initially
        jsonb_build_array(v_host_player),  -- host in lobby
        p_password_hash,
        p_password_hash IS NOT NULL,
        p_player_count,
        p_allow_spectators
    )
    RETURNING id INTO v_room_pk;

    RETURN v_room_pk;
END;
$$ LANGUAGE plpgsql;

-- Function to add user as spectator
CREATE OR REPLACE FUNCTION sp_add_spectator(
    p_room_id VARCHAR(64),
    p_user_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_spectator JSONB;
    v_room_status VARCHAR(20);
    v_allow_spectators BOOLEAN;
    v_max_spectators INTEGER;
    v_current_count INTEGER;
    v_banned BIGINT[];
BEGIN
    -- Check room settings
    SELECT status, allow_spectators, max_spectators, banned_users
    INTO v_room_status, v_allow_spectators, v_max_spectators, v_banned
    FROM game_rooms
    WHERE room_id = p_room_id;

    IF v_room_status IS NULL THEN
        RAISE EXCEPTION 'Room not found: %', p_room_id;
    END IF;

    IF NOT v_allow_spectators THEN
        RAISE EXCEPTION 'This room does not allow spectators';
    END IF;

    IF v_room_status != 'waiting' THEN
        RAISE EXCEPTION 'Cannot join as spectator after game has started';
    END IF;

    IF p_user_id = ANY(v_banned) THEN
        RAISE EXCEPTION 'User is banned from this room';
    END IF;

    -- Check spectator count
    SELECT jsonb_array_length(spectators_data) INTO v_current_count
    FROM game_rooms WHERE room_id = p_room_id;

    IF v_current_count >= v_max_spectators THEN
        RAISE EXCEPTION 'Room has reached maximum spectator capacity';
    END IF;

    -- Build spectator object
    SELECT jsonb_build_object(
        'user_id', u.id,
        'username', u.first_name,
        'avatar_id', u.avatar_id,
        'joined_at', NOW()
    )
    INTO v_spectator
    FROM users u
    WHERE u.id = p_user_id;

    IF v_spectator IS NULL THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Add to spectators
    UPDATE game_rooms
    SET spectators_data = spectators_data || v_spectator,
        spectators = array_append(spectators, p_user_id),
        updated_at = NOW()
    WHERE room_id = p_room_id
    AND NOT (p_user_id = ANY(spectators));

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to remove spectator
CREATE OR REPLACE FUNCTION sp_remove_spectator(
    p_room_id VARCHAR(64),
    p_user_id BIGINT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE game_rooms
    SET spectators_data = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::JSONB)
        FROM jsonb_array_elements(spectators_data) AS elem
        WHERE (elem->>'user_id')::BIGINT != p_user_id
    ),
    spectators = array_remove(spectators, p_user_id),
    -- Clear admin spectator if they leave
    admin_spectator_id = CASE
        WHEN admin_spectator_id = p_user_id THEN NULL
        ELSE admin_spectator_id
    END,
    updated_at = NOW()
    WHERE room_id = p_room_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to select a player from lobby (admin action)
CREATE OR REPLACE FUNCTION sp_select_player(
    p_room_id VARCHAR(64),
    p_admin_id BIGINT,
    p_target_user_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_host_id BIGINT;
    v_player_count INTEGER;
    v_selected_count INTEGER;
BEGIN
    -- Verify admin
    SELECT host_id, player_count INTO v_host_id, v_player_count
    FROM game_rooms WHERE room_id = p_room_id;

    IF v_host_id != p_admin_id THEN
        RAISE EXCEPTION 'Only the host can select players';
    END IF;

    -- Check if already at max selected
    SELECT array_length(selected_players, 1) INTO v_selected_count
    FROM game_rooms WHERE room_id = p_room_id;

    IF COALESCE(v_selected_count, 0) >= v_player_count THEN
        RAISE EXCEPTION 'Maximum number of players already selected';
    END IF;

    -- Add to selected players
    UPDATE game_rooms
    SET selected_players = array_append(selected_players, p_target_user_id),
        updated_at = NOW()
    WHERE room_id = p_room_id
    AND NOT (p_target_user_id = ANY(selected_players))
    AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(lobby) AS l
        WHERE (l->>'user_id')::BIGINT = p_target_user_id
    );

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to deselect a player (admin action)
CREATE OR REPLACE FUNCTION sp_deselect_player(
    p_room_id VARCHAR(64),
    p_admin_id BIGINT,
    p_target_user_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_host_id BIGINT;
BEGIN
    -- Verify admin
    SELECT host_id INTO v_host_id
    FROM game_rooms WHERE room_id = p_room_id;

    IF v_host_id != p_admin_id THEN
        RAISE EXCEPTION 'Only the host can deselect players';
    END IF;

    -- Remove from selected players
    UPDATE game_rooms
    SET selected_players = array_remove(selected_players, p_target_user_id),
        updated_at = NOW()
    WHERE room_id = p_room_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to designate admin spectator
CREATE OR REPLACE FUNCTION sp_designate_admin_spectator(
    p_room_id VARCHAR(64),
    p_admin_id BIGINT,
    p_spectator_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_host_id BIGINT;
BEGIN
    -- Verify admin
    SELECT host_id INTO v_host_id
    FROM game_rooms WHERE room_id = p_room_id;

    IF v_host_id != p_admin_id THEN
        RAISE EXCEPTION 'Only the host can designate admin spectator';
    END IF;

    -- Verify target is a spectator
    IF NOT EXISTS (
        SELECT 1 FROM game_rooms
        WHERE room_id = p_room_id
        AND p_spectator_id = ANY(spectators)
    ) THEN
        RAISE EXCEPTION 'Target user is not a spectator';
    END IF;

    -- Set admin spectator
    UPDATE game_rooms
    SET admin_spectator_id = p_spectator_id,
        updated_at = NOW()
    WHERE room_id = p_room_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to record membership at game start
CREATE OR REPLACE FUNCTION sp_record_game_membership(
    p_room_id VARCHAR(64)
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE game_rooms
    SET
        recorded_players = (
            SELECT array_agg((elem->>'user_id')::BIGINT)
            FROM jsonb_array_elements(players) AS elem
        ),
        recorded_spectators = spectators,
        lobby_chat_enabled = FALSE,
        updated_at = NOW()
    WHERE room_id = p_room_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN game_rooms.player_count IS 'Number of active players for this game (2-10)';
COMMENT ON COLUMN game_rooms.allow_spectators IS 'Whether spectators can join this room';
COMMENT ON COLUMN game_rooms.admin_spectator_id IS 'Spectator designated to moderate when host is playing';
COMMENT ON COLUMN game_rooms.recorded_players IS 'Player IDs recorded at game start for rejoin auth';
COMMENT ON COLUMN game_rooms.recorded_spectators IS 'Spectator IDs recorded at game start for rejoin auth';
COMMENT ON COLUMN game_rooms.selected_players IS 'Players selected by admin before game starts';
