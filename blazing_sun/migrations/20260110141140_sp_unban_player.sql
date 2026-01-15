-- Stored procedure to unban a player from a room (admin action)
-- Removes user from the banned_users array if admin is the host

CREATE OR REPLACE FUNCTION sp_unban_player(
    p_room_id VARCHAR(64),
    p_admin_id BIGINT,
    p_target_user_id BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_host_id BIGINT;
    v_is_banned BOOLEAN;
BEGIN
    -- Get the room's host
    SELECT host_id INTO v_host_id
    FROM game_rooms
    WHERE room_id = p_room_id;

    -- Verify room exists
    IF v_host_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Verify caller is the host
    IF v_host_id != p_admin_id THEN
        RETURN FALSE;
    END IF;

    -- Check if user is actually banned
    SELECT p_target_user_id = ANY(banned_users) INTO v_is_banned
    FROM game_rooms
    WHERE room_id = p_room_id;

    IF NOT v_is_banned THEN
        RETURN FALSE;
    END IF;

    -- Remove from banned list
    UPDATE game_rooms
    SET banned_users = array_remove(banned_users, p_target_user_id),
        updated_at = NOW()
    WHERE room_id = p_room_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
