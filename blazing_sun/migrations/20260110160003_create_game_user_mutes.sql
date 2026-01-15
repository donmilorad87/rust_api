-- Create game_user_mutes table
-- Stores per-user mute preferences (local mutes, not visible to muted user)

CREATE TABLE IF NOT EXISTS game_user_mutes (
    id BIGSERIAL PRIMARY KEY,
    muter_user_id BIGINT NOT NULL,
    muted_user_id BIGINT NOT NULL,
    room_id VARCHAR(64),  -- NULL = global mute across all rooms, else room-specific
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_mute_muter FOREIGN KEY (muter_user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_mute_muted FOREIGN KEY (muted_user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_mute UNIQUE (muter_user_id, muted_user_id, room_id)
);

-- Indexes for efficient lookups
CREATE INDEX idx_user_mutes_muter ON game_user_mutes(muter_user_id);
CREATE INDEX idx_user_mutes_muted ON game_user_mutes(muted_user_id);
CREATE INDEX idx_user_mutes_room ON game_user_mutes(room_id) WHERE room_id IS NOT NULL;

-- Function to mute a user
CREATE OR REPLACE FUNCTION sp_mute_user(
    p_muter_user_id BIGINT,
    p_muted_user_id BIGINT,
    p_room_id VARCHAR(64) DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    -- Cannot mute yourself
    IF p_muter_user_id = p_muted_user_id THEN
        RAISE EXCEPTION 'Cannot mute yourself';
    END IF;

    INSERT INTO game_user_mutes (muter_user_id, muted_user_id, room_id)
    VALUES (p_muter_user_id, p_muted_user_id, p_room_id)
    ON CONFLICT (muter_user_id, muted_user_id, room_id) DO NOTHING
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to unmute a user
CREATE OR REPLACE FUNCTION sp_unmute_user(
    p_muter_user_id BIGINT,
    p_muted_user_id BIGINT,
    p_room_id VARCHAR(64) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM game_user_mutes
    WHERE muter_user_id = p_muter_user_id
    AND muted_user_id = p_muted_user_id
    AND (
        (p_room_id IS NULL AND room_id IS NULL)
        OR room_id = p_room_id
    );

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get all muted users for a user
CREATE OR REPLACE FUNCTION sp_get_muted_users(
    p_user_id BIGINT,
    p_room_id VARCHAR(64) DEFAULT NULL
)
RETURNS TABLE (
    muted_user_id BIGINT,
    room_id VARCHAR(64),
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.muted_user_id,
        m.room_id,
        m.created_at
    FROM game_user_mutes m
    WHERE m.muter_user_id = p_user_id
    AND (
        m.room_id IS NULL  -- global mutes always apply
        OR m.room_id = p_room_id  -- room-specific mutes
    )
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user is muted
CREATE OR REPLACE FUNCTION sp_is_user_muted(
    p_muter_user_id BIGINT,
    p_muted_user_id BIGINT,
    p_room_id VARCHAR(64) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM game_user_mutes
        WHERE muter_user_id = p_muter_user_id
        AND muted_user_id = p_muted_user_id
        AND (
            room_id IS NULL  -- global mute
            OR room_id = p_room_id  -- room-specific mute
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for room-specific mutes when room is deleted
CREATE OR REPLACE FUNCTION sp_cleanup_room_mutes(
    p_room_id VARCHAR(64)
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM game_user_mutes
    WHERE room_id = p_room_id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE game_user_mutes IS 'Per-user mute preferences for game chat';
COMMENT ON COLUMN game_user_mutes.room_id IS 'NULL = global mute, otherwise room-specific';
