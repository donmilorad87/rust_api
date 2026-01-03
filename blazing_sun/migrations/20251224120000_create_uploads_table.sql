-- Uploads table for file storage management
CREATE TABLE IF NOT EXISTS uploads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- File identity
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,

    -- File metadata
    extension VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),

    -- Storage info
    storage_type VARCHAR(20) NOT NULL CHECK (storage_type IN ('public', 'private')),
    storage_path VARCHAR(500) NOT NULL,

    -- Upload tracking (for resumable uploads)
    upload_status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed')),
    chunks_received INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 1,

    -- Ownership
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

    -- Optional metadata
    description TEXT,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_uploads_uuid ON uploads(uuid);
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_storage_type ON uploads(storage_type);
CREATE INDEX idx_uploads_upload_status ON uploads(upload_status);
CREATE INDEX idx_uploads_created_at ON uploads(created_at DESC);
