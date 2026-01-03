-- Add permissions field to users table
-- Permission levels:
--   1 = Basic (default)
--   10 = Admin
--   50 = Affiliate
--   100 = Super Admin

ALTER TABLE users
ADD COLUMN permissions SMALLINT NOT NULL DEFAULT 1;

-- Index for permission-based queries
CREATE INDEX idx_users_permissions ON users(permissions);

-- Comment explaining permission levels
COMMENT ON COLUMN users.permissions IS 'Permission level: 1=Basic, 10=Admin, 50=Affiliate, 100=SuperAdmin';
