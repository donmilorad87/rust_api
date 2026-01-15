-- Create game_player_disconnects table
-- Tracks disconnected players for auto-deselection after timeout

CREATE TABLE IF NOT EXISTS game_player_disconnects (
    id BIGSERIAL PRIMARY KEY,
    room_id VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    disconnected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    deselected BOOLEAN NOT NULL DEFAULT FALSE,
    reconnected BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_disconnect_room FOREIGN KEY (room_id)
        REFERENCES game_rooms(room_id) ON DELETE CASCADE,
    CONSTRAINT fk_disconnect_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_disconnect UNIQUE (room_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_player_disconnects_room ON game_player_disconnects(room_id);
CREATE INDEX idx_player_disconnects_timeout ON game_player_disconnects(disconnected_at)
    WHERE NOT deselected AND NOT reconnected;
CREATE INDEX idx_player_disconnects_pending ON game_player_disconnects(room_id, user_id)
    WHERE NOT deselected AND NOT reconnected;

-- Function to record player disconnect
CREATE OR REPLACE FUNCTION sp_record_player_disconnect(
    p_room_id VARCHAR(64),
    p_user_id BIGINT,
    p_timeout_seconds INTEGER DEFAULT 30
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO game_player_disconnects (room_id, user_id, timeout_seconds)
    VALUES (p_room_id, p_user_id, p_timeout_seconds)
    ON CONFLICT (room_id, user_id)
    DO UPDATE SET
        disconnected_at = NOW(),
        timeout_seconds = p_timeout_seconds,
        deselected = FALSE,
        reconnected = FALSE
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark player as reconnected
CREATE OR REPLACE FUNCTION sp_player_reconnected(
    p_room_id VARCHAR(64),
    p_user_id BIGINT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE game_player_disconnects
    SET reconnected = TRUE
    WHERE room_id = p_room_id
    AND user_id = p_user_id
    AND NOT deselected;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get expired disconnects (for auto-deselection)
CREATE OR REPLACE FUNCTION sp_get_expired_disconnects()
RETURNS TABLE (
    id BIGINT,
    room_id VARCHAR(64),
    user_id BIGINT,
    disconnected_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.room_id,
        d.user_id,
        d.disconnected_at
    FROM game_player_disconnects d
    WHERE NOT d.deselected
    AND NOT d.reconnected
    AND d.disconnected_at + (d.timeout_seconds * INTERVAL '1 second') < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to mark disconnect as processed (deselected)
CREATE OR REPLACE FUNCTION sp_mark_disconnect_deselected(
    p_id BIGINT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE game_player_disconnects
    SET deselected = TRUE
    WHERE id = p_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for old disconnect records
CREATE OR REPLACE FUNCTION sp_cleanup_old_disconnects(
    p_older_than_hours INTEGER DEFAULT 24
)
RETURNS INTEGER AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM game_player_disconnects
    WHERE (deselected OR reconnected)
    AND disconnected_at < NOW() - (p_older_than_hours * INTERVAL '1 hour');

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE game_player_disconnects IS 'Tracks player disconnections for auto-deselection';
COMMENT ON COLUMN game_player_disconnects.timeout_seconds IS 'Seconds before auto-deselection (default 30)';
COMMENT ON COLUMN game_player_disconnects.deselected IS 'Whether player was auto-deselected due to timeout';
COMMENT ON COLUMN game_player_disconnects.reconnected IS 'Whether player reconnected before timeout';
