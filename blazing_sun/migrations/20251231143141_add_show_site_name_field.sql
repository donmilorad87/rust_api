-- Add show_site_name field to site_config
-- When false, only logo is shown (site name text is hidden)
ALTER TABLE site_config
ADD COLUMN IF NOT EXISTS show_site_name BOOLEAN NOT NULL DEFAULT true;
