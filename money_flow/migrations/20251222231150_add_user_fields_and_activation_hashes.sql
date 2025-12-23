-- Add new fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS activated SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_must_set_password SMALLINT NOT NULL DEFAULT 0;

-- Create activation_hashes table for account activation, forgot password, forced password setup
CREATE TABLE IF NOT EXISTS activation_hashes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hash VARCHAR(40) UNIQUE NOT NULL,
    hash_type VARCHAR(50) NOT NULL, -- 'activation', 'forgot_password', 'user_must_set_password', 'password_change'
    expiry_time TIMESTAMPTZ NOT NULL,
    used SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_activation_hashes_hash ON activation_hashes(hash);
CREATE INDEX IF NOT EXISTS idx_activation_hashes_user_id ON activation_hashes(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_hashes_expiry ON activation_hashes(expiry_time);
