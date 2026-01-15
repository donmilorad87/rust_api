-- Friends Table
-- Stores friend relationships between users with status tracking

CREATE TABLE IF NOT EXISTS friends (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Prevent duplicate friendships (in either direction)
    CONSTRAINT unique_friendship UNIQUE (user_id, friend_id),
    -- Prevent self-friendship
    CONSTRAINT no_self_friendship CHECK (user_id != friend_id)
);

-- Index for looking up a user's friends
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);
CREATE INDEX idx_friends_user_status ON friends(user_id, status);

-- =============================================================================
-- STORED PROCEDURES: Friends Management
-- =============================================================================

-- Send a friend request
CREATE OR REPLACE FUNCTION send_friend_request(
    p_user_id BIGINT,
    p_friend_id BIGINT
) RETURNS TABLE (
    id BIGINT,
    user_id BIGINT,
    friend_id BIGINT,
    status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    -- Check if reverse request exists (friend already requested us)
    IF EXISTS (
        SELECT 1 FROM friends
        WHERE friends.user_id = p_friend_id
        AND friends.friend_id = p_user_id
        AND friends.status = 'pending'
    ) THEN
        -- Auto-accept: update their request to accepted
        UPDATE friends
        SET status = 'accepted', updated_at = NOW()
        WHERE friends.user_id = p_friend_id AND friends.friend_id = p_user_id;

        -- Insert our side as accepted too
        INSERT INTO friends (user_id, friend_id, status)
        VALUES (p_user_id, p_friend_id, 'accepted')
        ON CONFLICT (user_id, friend_id)
        DO UPDATE SET status = 'accepted', updated_at = NOW();

        RETURN QUERY
        SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at
        FROM friends f
        WHERE f.user_id = p_user_id AND f.friend_id = p_friend_id;
    ELSE
        -- Normal case: insert pending request
        INSERT INTO friends (user_id, friend_id, status)
        VALUES (p_user_id, p_friend_id, 'pending')
        ON CONFLICT (user_id, friend_id) DO NOTHING
        RETURNING friends.id, friends.user_id, friends.friend_id, friends.status, friends.created_at
        INTO id, user_id, friend_id, status, created_at;

        RETURN QUERY
        SELECT f.id, f.user_id, f.friend_id, f.status, f.created_at
        FROM friends f
        WHERE f.user_id = p_user_id AND f.friend_id = p_friend_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Accept a friend request
CREATE OR REPLACE FUNCTION accept_friend_request(
    p_user_id BIGINT,
    p_friend_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
    v_updated BOOLEAN := FALSE;
BEGIN
    -- Accept the incoming request
    UPDATE friends
    SET status = 'accepted', updated_at = NOW()
    WHERE user_id = p_friend_id
    AND friend_id = p_user_id
    AND status = 'pending';

    IF FOUND THEN
        -- Create the reverse relationship
        INSERT INTO friends (user_id, friend_id, status)
        VALUES (p_user_id, p_friend_id, 'accepted')
        ON CONFLICT (user_id, friend_id)
        DO UPDATE SET status = 'accepted', updated_at = NOW();

        v_updated := TRUE;
    END IF;

    RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- Decline/remove a friend request or unfriend
CREATE OR REPLACE FUNCTION remove_friend(
    p_user_id BIGINT,
    p_friend_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
    v_deleted BOOLEAN := FALSE;
BEGIN
    -- Remove both directions
    DELETE FROM friends
    WHERE (user_id = p_user_id AND friend_id = p_friend_id)
       OR (user_id = p_friend_id AND friend_id = p_user_id);

    IF FOUND THEN
        v_deleted := TRUE;
    END IF;

    RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Block a user
CREATE OR REPLACE FUNCTION block_user(
    p_user_id BIGINT,
    p_blocked_id BIGINT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Remove any existing friendship
    DELETE FROM friends
    WHERE (user_id = p_user_id AND friend_id = p_blocked_id)
       OR (user_id = p_blocked_id AND friend_id = p_user_id);

    -- Create blocked relationship (one-way)
    INSERT INTO friends (user_id, friend_id, status)
    VALUES (p_user_id, p_blocked_id, 'blocked')
    ON CONFLICT (user_id, friend_id)
    DO UPDATE SET status = 'blocked', updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Unblock a user
CREATE OR REPLACE FUNCTION unblock_user(
    p_user_id BIGINT,
    p_blocked_id BIGINT
) RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM friends
    WHERE user_id = p_user_id
    AND friend_id = p_blocked_id
    AND status = 'blocked';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Check if two users are friends (accepted)
CREATE OR REPLACE FUNCTION are_friends(
    p_user_id_1 BIGINT,
    p_user_id_2 BIGINT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM friends
        WHERE user_id = p_user_id_1
        AND friend_id = p_user_id_2
        AND status = 'accepted'
    );
END;
$$ LANGUAGE plpgsql;

-- Check if a user is blocked by another
CREATE OR REPLACE FUNCTION is_blocked(
    p_blocker_id BIGINT,
    p_blocked_id BIGINT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM friends
        WHERE user_id = p_blocker_id
        AND friend_id = p_blocked_id
        AND status = 'blocked'
    );
END;
$$ LANGUAGE plpgsql;

-- Get user's friends list
CREATE OR REPLACE FUNCTION get_friends(
    p_user_id BIGINT,
    p_status VARCHAR DEFAULT 'accepted'
) RETURNS TABLE (
    friend_id BIGINT,
    friend_username VARCHAR,
    friend_first_name VARCHAR,
    friend_last_name VARCHAR,
    friend_avatar_id BIGINT,
    friendship_status VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id as friend_id,
        u.username as friend_username,
        u.first_name as friend_first_name,
        u.last_name as friend_last_name,
        u.avatar_id as friend_avatar_id,
        f.status as friendship_status,
        f.created_at
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = p_user_id
    AND (p_status IS NULL OR f.status = p_status)
    ORDER BY u.username ASC;
END;
$$ LANGUAGE plpgsql;

-- Get pending friend requests (incoming)
CREATE OR REPLACE FUNCTION get_incoming_friend_requests(
    p_user_id BIGINT
) RETURNS TABLE (
    requester_id BIGINT,
    requester_username VARCHAR,
    requester_first_name VARCHAR,
    requester_last_name VARCHAR,
    requester_avatar_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id as requester_id,
        u.username as requester_username,
        u.first_name as requester_first_name,
        u.last_name as requester_last_name,
        u.avatar_id as requester_avatar_id,
        f.created_at
    FROM friends f
    JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = p_user_id
    AND f.status = 'pending'
    ORDER BY f.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Get online friends (requires Redis integration - returns friend IDs only)
CREATE OR REPLACE FUNCTION get_friend_ids(
    p_user_id BIGINT
) RETURNS BIGINT[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT friend_id
        FROM friends
        WHERE user_id = p_user_id
        AND status = 'accepted'
    );
END;
$$ LANGUAGE plpgsql;

-- Can user message another user (friends or admin bypass)
CREATE OR REPLACE FUNCTION can_message_user(
    p_sender_id BIGINT,
    p_recipient_id BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
    v_sender_permissions INT;
BEGIN
    -- Check if sender is admin (permissions >= 10)
    SELECT permissions INTO v_sender_permissions FROM users WHERE id = p_sender_id;
    IF v_sender_permissions >= 10 THEN
        RETURN TRUE;
    END IF;

    -- Check if recipient blocked sender
    IF is_blocked(p_recipient_id, p_sender_id) THEN
        RETURN FALSE;
    END IF;

    -- Check if they are friends
    RETURN are_friends(p_sender_id, p_recipient_id);
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE friends IS 'Stores friend relationships between users';
COMMENT ON COLUMN friends.status IS 'pending = request sent, accepted = mutual friends, blocked = one-way block';
