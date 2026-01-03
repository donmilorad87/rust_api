-- Assets table for managed files with metadata
-- Separate from uploads table to handle profile pictures, documents with titles, etc.

CREATE TABLE IF NOT EXISTS assets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Unique identifier
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

    -- Metadata
    title VARCHAR(255),
    description TEXT,
    category VARCHAR(100),

    -- File info
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    extension VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),

    -- Storage
    storage_type VARCHAR(20) NOT NULL CHECK (storage_type IN ('public', 'private')),
    storage_path VARCHAR(500) NOT NULL,
    subfolder VARCHAR(100),

    -- Ownership
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_assets_uuid ON assets(uuid);
CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_storage_type ON assets(storage_type);
CREATE INDEX idx_assets_subfolder ON assets(subfolder);
CREATE INDEX idx_assets_created_at ON assets(created_at DESC);
