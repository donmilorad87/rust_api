-- Session Refresh Tokens (for "Keep me logged in" feature)
-- Separate from OAuth refresh tokens which are for API clients
CREATE TABLE IF NOT EXISTS session_refresh_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    token_hint VARCHAR(8) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for token lookup (most frequent operation)
CREATE INDEX idx_session_refresh_tokens_token_hash ON session_refresh_tokens(token_hash);
-- Index for listing user's active sessions
CREATE INDEX idx_session_refresh_tokens_user_id ON session_refresh_tokens(user_id);
-- Index for cleanup of expired tokens
CREATE INDEX idx_session_refresh_tokens_expires_at ON session_refresh_tokens(expires_at);
-- Index for revocation queries
CREATE INDEX idx_session_refresh_tokens_is_revoked ON session_refresh_tokens(is_revoked);

-- Comments for documentation
COMMENT ON TABLE session_refresh_tokens IS 'Long-lived refresh tokens for session persistence (Keep me logged in)';
COMMENT ON COLUMN session_refresh_tokens.token_hash IS 'SHA-256 hash of the actual token (never store raw tokens)';
COMMENT ON COLUMN session_refresh_tokens.token_hint IS 'Last 8 chars of token for display (e.g., ****abcd)';
COMMENT ON COLUMN session_refresh_tokens.device_info IS 'User agent or device identifier for session management UI';
COMMENT ON COLUMN session_refresh_tokens.ip_address IS 'IP address at token creation for security audit';
COMMENT ON COLUMN session_refresh_tokens.last_used_at IS 'Updated each time the refresh token is used to get a new access token';
