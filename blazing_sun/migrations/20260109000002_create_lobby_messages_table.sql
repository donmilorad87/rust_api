-- Public Lobby Messages Table
-- Stores the last 1000 messages per lobby (public chat rooms)
-- Private messages are stored in MongoDB, not here

CREATE TABLE IF NOT EXISTS lobbies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    max_messages INT NOT NULL DEFAULT 1000,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lobby_messages (
    id BIGSERIAL PRIMARY KEY,
    lobby_id BIGINT NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'action')),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_lobby_messages_lobby_id ON lobby_messages(lobby_id);
CREATE INDEX idx_lobby_messages_user_id ON lobby_messages(user_id);
CREATE INDEX idx_lobby_messages_lobby_created ON lobby_messages(lobby_id, created_at DESC);
CREATE INDEX idx_lobby_messages_not_deleted ON lobby_messages(lobby_id, is_deleted) WHERE is_deleted = FALSE;

-- =============================================================================
-- DEFAULT LOBBIES
-- =============================================================================

INSERT INTO lobbies (name, description) VALUES
    ('general', 'General public chat lobby'),
    ('games', 'Game discussions and matchmaking'),
    ('help', 'Help and support');

-- =============================================================================
-- STORED PROCEDURES: Lobby Messages
-- =============================================================================

-- Send a message to a lobby (with auto-cleanup of old messages)
CREATE OR REPLACE FUNCTION send_lobby_message(
    p_lobby_id BIGINT,
    p_user_id BIGINT,
    p_content TEXT,
    p_message_type VARCHAR DEFAULT 'text'
) RETURNS TABLE (
    id BIGINT,
    lobby_id BIGINT,
    user_id BIGINT,
    username VARCHAR,
    avatar_id BIGINT,
    content TEXT,
    message_type VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_message_id BIGINT;
    v_max_messages INT;
    v_message_count INT;
    v_to_delete INT;
BEGIN
    -- Insert the message
    INSERT INTO lobby_messages (lobby_id, user_id, content, message_type)
    VALUES (p_lobby_id, p_user_id, p_content, p_message_type)
    RETURNING lobby_messages.id INTO v_message_id;

    -- Get max messages for this lobby
    SELECT l.max_messages INTO v_max_messages
    FROM lobbies l
    WHERE l.id = p_lobby_id;

    -- Count current messages (non-deleted)
    SELECT COUNT(*) INTO v_message_count
    FROM lobby_messages lm
    WHERE lm.lobby_id = p_lobby_id AND lm.is_deleted = FALSE;

    -- Delete oldest messages if over limit
    IF v_message_count > v_max_messages THEN
        v_to_delete := v_message_count - v_max_messages;

        -- Soft delete oldest messages (keep for audit)
        UPDATE lobby_messages
        SET is_deleted = TRUE, deleted_at = NOW()
        WHERE lobby_messages.id IN (
            SELECT lm.id
            FROM lobby_messages lm
            WHERE lm.lobby_id = p_lobby_id AND lm.is_deleted = FALSE
            ORDER BY lm.created_at ASC
            LIMIT v_to_delete
        );
    END IF;

    -- Return the inserted message with user info
    RETURN QUERY
    SELECT
        lm.id,
        lm.lobby_id,
        lm.user_id,
        u.username,
        u.avatar_id,
        lm.content,
        lm.message_type,
        lm.created_at
    FROM lobby_messages lm
    JOIN users u ON u.id = lm.user_id
    WHERE lm.id = v_message_id;
END;
$$ LANGUAGE plpgsql;

-- Get recent messages from a lobby
CREATE OR REPLACE FUNCTION get_lobby_messages(
    p_lobby_id BIGINT,
    p_limit INT DEFAULT 100,
    p_before_id BIGINT DEFAULT NULL
) RETURNS TABLE (
    id BIGINT,
    lobby_id BIGINT,
    user_id BIGINT,
    username VARCHAR,
    avatar_id BIGINT,
    content TEXT,
    message_type VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lm.id,
        lm.lobby_id,
        lm.user_id,
        u.username,
        u.avatar_id,
        lm.content,
        lm.message_type,
        lm.created_at
    FROM lobby_messages lm
    JOIN users u ON u.id = lm.user_id
    WHERE lm.lobby_id = p_lobby_id
    AND lm.is_deleted = FALSE
    AND (p_before_id IS NULL OR lm.id < p_before_id)
    ORDER BY lm.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Delete a message (admin or author only - soft delete)
CREATE OR REPLACE FUNCTION delete_lobby_message(
    p_message_id BIGINT,
    p_deleted_by BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
    v_message_user_id BIGINT;
    v_deleter_permissions INT;
BEGIN
    -- Get message owner
    SELECT user_id INTO v_message_user_id
    FROM lobby_messages
    WHERE id = p_message_id;

    IF v_message_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Get deleter permissions
    SELECT permissions INTO v_deleter_permissions
    FROM users
    WHERE id = p_deleted_by;

    -- Allow if author or admin
    IF v_message_user_id = p_deleted_by OR v_deleter_permissions >= 10 THEN
        UPDATE lobby_messages
        SET is_deleted = TRUE, deleted_by = p_deleted_by, deleted_at = NOW()
        WHERE id = p_message_id;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Get lobby by name
CREATE OR REPLACE FUNCTION get_lobby_by_name(
    p_name VARCHAR
) RETURNS TABLE (
    id BIGINT,
    name VARCHAR,
    description TEXT,
    is_active BOOLEAN,
    max_messages INT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT l.id, l.name, l.description, l.is_active, l.max_messages, l.created_at
    FROM lobbies l
    WHERE l.name = p_name AND l.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Get all active lobbies
CREATE OR REPLACE FUNCTION get_active_lobbies()
RETURNS TABLE (
    id BIGINT,
    name VARCHAR,
    description TEXT,
    message_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.name,
        l.description,
        COUNT(lm.id) FILTER (WHERE lm.is_deleted = FALSE) as message_count
    FROM lobbies l
    LEFT JOIN lobby_messages lm ON lm.lobby_id = l.id
    WHERE l.is_active = TRUE
    GROUP BY l.id, l.name, l.description
    ORDER BY l.name;
END;
$$ LANGUAGE plpgsql;

-- Create a new lobby (admin only - enforced in app)
CREATE OR REPLACE FUNCTION create_lobby(
    p_name VARCHAR,
    p_description TEXT DEFAULT NULL,
    p_max_messages INT DEFAULT 1000
) RETURNS TABLE (
    id BIGINT,
    name VARCHAR,
    description TEXT,
    max_messages INT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    INSERT INTO lobbies (name, description, max_messages)
    VALUES (p_name, p_description, p_max_messages)
    RETURNING lobbies.id, lobbies.name, lobbies.description, lobbies.max_messages, lobbies.created_at;
END;
$$ LANGUAGE plpgsql;

-- Cleanup: permanently delete old soft-deleted messages (run via cron)
CREATE OR REPLACE FUNCTION cleanup_deleted_lobby_messages(
    p_days_old INT DEFAULT 30
) RETURNS INT AS $$
DECLARE
    v_deleted INT;
BEGIN
    DELETE FROM lobby_messages
    WHERE is_deleted = TRUE
    AND deleted_at < NOW() - (p_days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE lobbies IS 'Public chat lobbies for group messaging';
COMMENT ON TABLE lobby_messages IS 'Messages in public lobbies (last 1000 per lobby)';
COMMENT ON COLUMN lobby_messages.is_deleted IS 'Soft delete flag - message hidden but kept for audit';
