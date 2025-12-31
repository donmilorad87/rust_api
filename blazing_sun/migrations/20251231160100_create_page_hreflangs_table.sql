-- Page Hreflangs Table
-- Stores hreflang tags for international SEO
-- Maps language/region codes to alternate page URLs

CREATE TABLE IF NOT EXISTS page_hreflangs (
    id BIGSERIAL PRIMARY KEY,

    -- Reference to page_seo
    page_seo_id BIGINT NOT NULL REFERENCES page_seo(id) ON DELETE CASCADE,

    -- Language/Region code
    lang_code VARCHAR(10) NOT NULL,              -- e.g., 'en', 'en-US', 'es-ES', 'x-default'

    -- Alternate URL for this language/region
    url VARCHAR(500) NOT NULL,                   -- Full URL or relative path

    -- Default language marker (x-default)
    is_default BOOLEAN DEFAULT false,            -- Mark as x-default for fallback

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint: one entry per lang_code per page
    UNIQUE(page_seo_id, lang_code)
);

-- Index for quick lookups by page
CREATE INDEX idx_page_hreflangs_page_seo_id ON page_hreflangs(page_seo_id);

-- Index for language code lookups
CREATE INDEX idx_page_hreflangs_lang_code ON page_hreflangs(lang_code);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_page_hreflangs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_page_hreflangs_updated_at ON page_hreflangs;
CREATE TRIGGER trigger_page_hreflangs_updated_at
    BEFORE UPDATE ON page_hreflangs
    FOR EACH ROW
    EXECUTE FUNCTION update_page_hreflangs_updated_at();

-- Comment on table
COMMENT ON TABLE page_hreflangs IS 'Stores hreflang alternate language/region URLs for international SEO';
COMMENT ON COLUMN page_hreflangs.lang_code IS 'ISO 639-1 language code with optional ISO 3166-1 region (e.g., en-US, es-ES)';
COMMENT ON COLUMN page_hreflangs.url IS 'Alternate URL for this language/region variant';
COMMENT ON COLUMN page_hreflangs.is_default IS 'When true, this URL serves as x-default fallback';
