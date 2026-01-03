-- Populate ID-based asset references from existing UUID references
-- This is Phase 3 of the migration to ID-based asset system
-- Phase 4 will remove the UUID columns after verification

-- ============================================
-- Users Table: Populate avatar_id from avatar_uuid
-- ============================================

-- Update avatar_id for all users who have an avatar_uuid
UPDATE users u
SET avatar_id = (
    SELECT up.id
    FROM uploads up
    WHERE up.uuid = u.avatar_uuid
    LIMIT 1
)
WHERE u.avatar_uuid IS NOT NULL;

-- Verify: Log how many users had their avatar_id populated
DO $$
DECLARE
    updated_count INT;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM users
    WHERE avatar_id IS NOT NULL;

    RAISE NOTICE 'Populated avatar_id for % users', updated_count;
END $$;

-- ============================================
-- Site Config Table: Populate logo_id and favicon_id
-- ============================================

-- Update logo_id
UPDATE site_config sc
SET logo_id = (
    SELECT up.id
    FROM uploads up
    WHERE up.uuid = sc.logo_uuid
    LIMIT 1
)
WHERE sc.logo_uuid IS NOT NULL;

-- Update favicon_id
UPDATE site_config sc
SET favicon_id = (
    SELECT up.id
    FROM uploads up
    WHERE up.uuid = sc.favicon_uuid
    LIMIT 1
)
WHERE sc.favicon_uuid IS NOT NULL;

-- Verify: Log the branding asset IDs
DO $$
DECLARE
    logo_id_val BIGINT;
    favicon_id_val BIGINT;
BEGIN
    SELECT logo_id, favicon_id INTO logo_id_val, favicon_id_val
    FROM site_config
    LIMIT 1;

    IF logo_id_val IS NOT NULL THEN
        RAISE NOTICE 'Populated logo_id: %', logo_id_val;
    ELSE
        RAISE NOTICE 'No logo_id to populate (logo_uuid was NULL)';
    END IF;

    IF favicon_id_val IS NOT NULL THEN
        RAISE NOTICE 'Populated favicon_id: %', favicon_id_val;
    ELSE
        RAISE NOTICE 'No favicon_id to populate (favicon_uuid was NULL)';
    END IF;
END $$;

-- ============================================
-- Data Integrity Verification
-- ============================================

-- Check for any UUIDs that couldn't be matched to upload IDs
DO $$
DECLARE
    orphaned_avatars INT;
BEGIN
    SELECT COUNT(*) INTO orphaned_avatars
    FROM users
    WHERE avatar_uuid IS NOT NULL AND avatar_id IS NULL;

    IF orphaned_avatars > 0 THEN
        RAISE WARNING '% users have avatar_uuid but no matching upload record (avatar_id is NULL)', orphaned_avatars;
    ELSE
        RAISE NOTICE 'All avatar UUIDs successfully matched to upload IDs';
    END IF;
END $$;

-- Note: UUID columns (avatar_uuid, logo_uuid, favicon_uuid) remain for now
-- They will be removed in a future migration after verification
-- This allows for easy rollback if needed

-- Comments for documentation
COMMENT ON COLUMN users.avatar_id IS 'FK to uploads.id for user avatar (populated from avatar_uuid, will replace it)';
COMMENT ON COLUMN site_config.logo_id IS 'FK to uploads.id for site logo (populated from logo_uuid, will replace it)';
COMMENT ON COLUMN site_config.favicon_id IS 'FK to uploads.id for site favicon (populated from favicon_uuid, will replace it)';
