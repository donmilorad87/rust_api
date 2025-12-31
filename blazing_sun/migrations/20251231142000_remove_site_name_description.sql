-- Remove site_name and site_description columns from site_config
-- These fields are no longer needed in the branding configuration

ALTER TABLE site_config DROP COLUMN IF EXISTS site_name;
ALTER TABLE site_config DROP COLUMN IF EXISTS site_description;
