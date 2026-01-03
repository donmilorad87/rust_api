-- Add metadata JSONB column to activation_hashes table for storing flexible data
-- This allows storing email change metadata like new_email and old_email addresses

ALTER TABLE activation_hashes
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_activation_hashes_metadata
ON activation_hashes USING GIN (metadata);

-- Add comments for documentation
COMMENT ON COLUMN activation_hashes.metadata IS 'JSONB field for storing hash-specific metadata (e.g., email change: {new_email, old_email})';
