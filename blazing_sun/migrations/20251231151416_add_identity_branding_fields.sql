-- Add site identity/branding fields to site_config
-- These control the site name display in navbar with gradient colors

-- Re-add site_name (was previously removed)
ALTER TABLE site_config
ADD COLUMN IF NOT EXISTS site_name VARCHAR(100) NOT NULL DEFAULT 'Blazing Sun';

-- Identity gradient colors (for logo text)
ALTER TABLE site_config
ADD COLUMN IF NOT EXISTS identity_color_start VARCHAR(7) NOT NULL DEFAULT '#3498db';

ALTER TABLE site_config
ADD COLUMN IF NOT EXISTS identity_color_end VARCHAR(7) NOT NULL DEFAULT '#764ba2';

-- Identity text size (rem value)
ALTER TABLE site_config
ADD COLUMN IF NOT EXISTS identity_size VARCHAR(10) NOT NULL DEFAULT '1.375rem';

-- Comments for documentation
COMMENT ON COLUMN site_config.site_name IS 'Site name displayed in navbar and page titles';
COMMENT ON COLUMN site_config.identity_color_start IS 'Gradient start color for site name (hex)';
COMMENT ON COLUMN site_config.identity_color_end IS 'Gradient end color for site name (hex)';
COMMENT ON COLUMN site_config.identity_size IS 'Font size for site name in navbar (rem)';
