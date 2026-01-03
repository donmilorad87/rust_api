-- Add ID-based asset references alongside existing UUID columns
-- This is Phase 2 of the migration to ID-based asset system
-- Phase 3 will populate these IDs from UUIDs
-- Phase 4 will remove the UUID columns after verification

-- ============================================
-- Users Table: Add avatar_id
-- ============================================

ALTER TABLE users
ADD COLUMN avatar_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_users_avatar_id ON users(avatar_id);

-- Comment for documentation
COMMENT ON COLUMN users.avatar_id IS 'FK to uploads.id for user avatar (new ID-based reference, replaces avatar_uuid)';

-- ============================================
-- Site Config Table: Add logo_id and favicon_id
-- ============================================

ALTER TABLE site_config
ADD COLUMN logo_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL,
ADD COLUMN favicon_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_site_config_logo_id ON site_config(logo_id);
CREATE INDEX idx_site_config_favicon_id ON site_config(favicon_id);

-- Comments for documentation
COMMENT ON COLUMN site_config.logo_id IS 'FK to uploads.id for site logo (new ID-based reference, replaces logo_uuid)';
COMMENT ON COLUMN site_config.favicon_id IS 'FK to uploads.id for site favicon (new ID-based reference, replaces favicon_uuid)';

-- Note: UUID columns (avatar_uuid, logo_uuid, favicon_uuid) remain for now
-- They will be removed in a future migration after data migration and testing
