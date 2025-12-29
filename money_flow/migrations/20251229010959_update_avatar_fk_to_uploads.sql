-- Update avatar_uuid foreign key from assets to uploads table
-- Profile pictures are now stored in the uploads table, not assets

-- Drop the old constraint referencing assets table
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_avatar_uuid;

-- Add new constraint referencing uploads table
ALTER TABLE users ADD CONSTRAINT fk_users_avatar_uuid
    FOREIGN KEY (avatar_uuid) REFERENCES uploads(uuid) ON DELETE SET NULL;
