-- Update users.avatar_uuid to reference assets table instead of uploads
-- Note: This will clear any existing avatar_uuid values since they reference uploads

-- Drop old FK constraint to uploads table
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_avatar_uuid;

-- Clear existing avatar_uuid values (they reference old uploads table)
UPDATE users SET avatar_uuid = NULL WHERE avatar_uuid IS NOT NULL;

-- Add new FK constraint to assets table
ALTER TABLE users
ADD CONSTRAINT fk_users_avatar_uuid
FOREIGN KEY (avatar_uuid) REFERENCES assets(uuid)
ON DELETE SET NULL;
