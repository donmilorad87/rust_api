-- Multi-language SEO translations

CREATE TABLE IF NOT EXISTS page_seo_translations (
    id BIGSERIAL PRIMARY KEY,
    page_seo_id BIGINT NOT NULL REFERENCES page_seo(id) ON DELETE CASCADE,
    lang_code VARCHAR(10) NOT NULL,

    title VARCHAR(70),
    description VARCHAR(160),
    keywords VARCHAR(255),

    og_title VARCHAR(95),
    og_description VARCHAR(200),
    og_image_uuid UUID REFERENCES uploads(uuid) ON DELETE SET NULL,
    og_type VARCHAR(50) DEFAULT 'website',

    twitter_card VARCHAR(50) DEFAULT 'summary',
    twitter_title VARCHAR(70),
    twitter_description VARCHAR(200),
    twitter_image_uuid UUID REFERENCES uploads(uuid) ON DELETE SET NULL,

    canonical_url VARCHAR(500),
    robots VARCHAR(100) DEFAULT 'index, follow',

    structured_data JSONB,
    custom_meta JSONB DEFAULT '[]',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(page_seo_id, lang_code)
);

CREATE INDEX IF NOT EXISTS idx_page_seo_translations_page ON page_seo_translations(page_seo_id);
CREATE INDEX IF NOT EXISTS idx_page_seo_translations_lang ON page_seo_translations(lang_code);

CREATE OR REPLACE FUNCTION update_page_seo_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_page_seo_translations_updated_at ON page_seo_translations;
CREATE TRIGGER trigger_page_seo_translations_updated_at
    BEFORE UPDATE ON page_seo_translations
    FOR EACH ROW
    EXECUTE FUNCTION update_page_seo_translations_updated_at();

-- Seed English translations from existing SEO table if missing
INSERT INTO page_seo_translations (
    page_seo_id,
    lang_code,
    title,
    description,
    keywords,
    og_title,
    og_description,
    og_image_uuid,
    og_type,
    twitter_card,
    twitter_title,
    twitter_description,
    twitter_image_uuid,
    canonical_url,
    robots,
    structured_data,
    custom_meta
)
SELECT
    id,
    'en',
    title,
    description,
    keywords,
    og_title,
    og_description,
    og_image_uuid,
    og_type,
    twitter_card,
    twitter_title,
    twitter_description,
    twitter_image_uuid,
    canonical_url,
    robots,
    structured_data,
    custom_meta
FROM page_seo
ON CONFLICT (page_seo_id, lang_code) DO NOTHING;

-- Add language column to schemas
ALTER TABLE page_schemas
    ADD COLUMN IF NOT EXISTS lang_code VARCHAR(10) NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_page_schemas_lang ON page_schemas(lang_code);
