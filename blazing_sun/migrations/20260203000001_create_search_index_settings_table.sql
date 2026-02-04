-- Search Index Settings Table
-- Stores configuration for what content types to include in search reindexing

CREATE TABLE IF NOT EXISTS search_index_settings (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(50) NOT NULL UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    display_name VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO search_index_settings (content_type, is_enabled, display_name, display_order) VALUES
    ('blogs', true, 'Blog Posts', 1),
    ('pages', false, 'Pages', 2),
    ('products', false, 'Products', 3)
ON CONFLICT (content_type) DO NOTHING;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_search_index_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_search_index_settings_updated_at ON search_index_settings;
CREATE TRIGGER trigger_update_search_index_settings_updated_at
    BEFORE UPDATE ON search_index_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_search_index_settings_updated_at();
