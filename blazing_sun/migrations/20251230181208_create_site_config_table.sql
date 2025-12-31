-- Site Configuration Table (Singleton)
-- Stores branding, SCSS variables, and theme colors for admin customization

CREATE TABLE IF NOT EXISTS site_config (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Branding
    site_name VARCHAR(100) NOT NULL DEFAULT 'Blazing Sun',
    site_description TEXT,
    logo_uuid UUID REFERENCES uploads(uuid) ON DELETE SET NULL,
    favicon_uuid UUID REFERENCES uploads(uuid) ON DELETE SET NULL,

    -- SCSS Variables (compile-time constants)
    scss_variables JSONB NOT NULL DEFAULT '{
        "color_primary": "#667eea",
        "color_primary_dark": "#5a6fd6",
        "color_secondary": "#764ba2",
        "font_size_base": "1rem",
        "font_size_sm": "0.875rem",
        "font_size_lg": "1.125rem",
        "font_size_xl": "1.375rem",
        "spacing_xs": "0.25rem",
        "spacing_sm": "0.5rem",
        "spacing_md": "1rem",
        "spacing_lg": "1.5rem",
        "spacing_xl": "2rem",
        "radius_sm": "5px",
        "radius_md": "6px",
        "radius_lg": "10px"
    }'::jsonb,

    -- Light Theme CSS Custom Properties
    theme_light JSONB NOT NULL DEFAULT '{
        "bg_gradient_start": "#667eea",
        "bg_gradient_end": "#764ba2",
        "nav_bg": "rgba(255, 255, 255, 0.95)",
        "nav_shadow": "rgba(0, 0, 0, 0.1)",
        "text_primary": "#333333",
        "text_secondary": "#555555",
        "text_muted": "#666666",
        "text_on_primary": "#ffffff",
        "card_bg": "#ffffff",
        "card_shadow": "rgba(0, 0, 0, 0.2)",
        "input_border": "#e0e0e0",
        "input_bg": "#ffffff",
        "link_color": "#667eea",
        "feature_card_bg": "#ffffff",
        "feature_card_shadow": "rgba(0, 0, 0, 0.1)",
        "toggle_bg": "#f0f0f0",
        "toggle_border": "#dddddd"
    }'::jsonb,

    -- Dark Theme CSS Custom Properties
    theme_dark JSONB NOT NULL DEFAULT '{
        "bg_gradient_start": "#1a1a2e",
        "bg_gradient_end": "#16213e",
        "nav_bg": "rgba(30, 30, 50, 0.98)",
        "nav_shadow": "rgba(0, 0, 0, 0.4)",
        "text_primary": "#e8e8e8",
        "text_secondary": "#c0c0c0",
        "text_muted": "#999999",
        "text_on_primary": "#ffffff",
        "card_bg": "#252542",
        "card_shadow": "rgba(0, 0, 0, 0.5)",
        "input_border": "#404060",
        "input_bg": "#1e1e36",
        "link_color": "#8b9cff",
        "feature_card_bg": "#252542",
        "feature_card_shadow": "rgba(0, 0, 0, 0.4)",
        "toggle_bg": "#2a2a4a",
        "toggle_border": "#404060"
    }'::jsonb,

    -- Build tracking
    last_build_at TIMESTAMPTZ,
    last_build_status VARCHAR(20) DEFAULT 'pending',
    last_build_error TEXT,
    assets_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Singleton pattern: Only one row can ever exist
CREATE UNIQUE INDEX idx_site_config_singleton ON site_config ((true));

-- Insert default row (will fail silently if already exists due to unique constraint)
INSERT INTO site_config (site_name) VALUES ('Blazing Sun') ON CONFLICT DO NOTHING;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_site_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_site_config_updated_at
    BEFORE UPDATE ON site_config
    FOR EACH ROW
    EXECUTE FUNCTION update_site_config_updated_at();

-- Comments for documentation
COMMENT ON TABLE site_config IS 'Singleton table storing site branding and theme configuration';
COMMENT ON COLUMN site_config.scss_variables IS 'SCSS compile-time variables (colors, typography, spacing, radius)';
COMMENT ON COLUMN site_config.theme_light IS 'CSS custom properties for light theme';
COMMENT ON COLUMN site_config.theme_dark IS 'CSS custom properties for dark theme';
COMMENT ON COLUMN site_config.last_build_status IS 'pending, building, success, failed';
