-- Create game_chat_config table for global chat settings
-- This table stores configuration for all game chat functionality

CREATE TABLE IF NOT EXISTS game_chat_config (
    id SERIAL PRIMARY KEY,

    -- Rate limiting
    rate_limit_messages INTEGER NOT NULL DEFAULT 20,          -- messages per minute
    rate_limit_window_seconds INTEGER NOT NULL DEFAULT 60,    -- window duration

    -- Message constraints
    max_message_length INTEGER NOT NULL DEFAULT 512,          -- max chars per message

    -- Profanity filter
    profanity_filter_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    profanity_word_list TEXT[] NOT NULL DEFAULT '{}',         -- custom blocked words

    -- Emergency controls
    global_mute_enabled BOOLEAN NOT NULL DEFAULT FALSE,       -- kill switch for all chat

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default config row
INSERT INTO game_chat_config (
    rate_limit_messages,
    rate_limit_window_seconds,
    max_message_length,
    profanity_filter_enabled,
    global_mute_enabled
) VALUES (20, 60, 512, FALSE, FALSE);

-- Stored procedure to get chat config
CREATE OR REPLACE FUNCTION sp_get_game_chat_config()
RETURNS TABLE (
    rate_limit_messages INTEGER,
    rate_limit_window_seconds INTEGER,
    max_message_length INTEGER,
    profanity_filter_enabled BOOLEAN,
    profanity_word_list TEXT[],
    global_mute_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.rate_limit_messages,
        c.rate_limit_window_seconds,
        c.max_message_length,
        c.profanity_filter_enabled,
        c.profanity_word_list,
        c.global_mute_enabled
    FROM game_chat_config c
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Stored procedure to update chat config
CREATE OR REPLACE FUNCTION sp_update_game_chat_config(
    p_rate_limit_messages INTEGER DEFAULT NULL,
    p_rate_limit_window_seconds INTEGER DEFAULT NULL,
    p_max_message_length INTEGER DEFAULT NULL,
    p_profanity_filter_enabled BOOLEAN DEFAULT NULL,
    p_profanity_word_list TEXT[] DEFAULT NULL,
    p_global_mute_enabled BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE game_chat_config
    SET
        rate_limit_messages = COALESCE(p_rate_limit_messages, rate_limit_messages),
        rate_limit_window_seconds = COALESCE(p_rate_limit_window_seconds, rate_limit_window_seconds),
        max_message_length = COALESCE(p_max_message_length, max_message_length),
        profanity_filter_enabled = COALESCE(p_profanity_filter_enabled, profanity_filter_enabled),
        profanity_word_list = COALESCE(p_profanity_word_list, profanity_word_list),
        global_mute_enabled = COALESCE(p_global_mute_enabled, global_mute_enabled),
        updated_at = NOW()
    WHERE id = 1;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE game_chat_config IS 'Global configuration for game chat system';
