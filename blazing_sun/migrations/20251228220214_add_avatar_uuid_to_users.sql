-- Add avatar_uuid column to users table
-- References the UUID of the uploaded file in the uploads table

ALTER TABLE users
ADD COLUMN avatar_uuid UUID NULL;

-- Add index for faster lookups
CREATE INDEX idx_users_avatar_uuid ON users(avatar_uuid);

-- Add foreign key constraint to uploads table
ALTER TABLE users
ADD CONSTRAINT fk_users_avatar_uuid
FOREIGN KEY (avatar_uuid) REFERENCES uploads(uuid)
ON DELETE SET NULL;
