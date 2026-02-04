-- Create blog_taxonomies table for named rule collections
-- Taxonomies define complex rules for grouping posts

CREATE TABLE IF NOT EXISTS blog_taxonomies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    -- Display settings
    display_title VARCHAR(255),
    featured_image_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL,

    -- Rule logic: 'all' = posts must match ALL rules, 'any' = posts can match ANY rule
    rule_logic VARCHAR(10) NOT NULL DEFAULT 'all',

    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_rule_logic CHECK (rule_logic IN ('all', 'any'))
);

-- Indexes
CREATE INDEX idx_blog_taxonomies_slug ON blog_taxonomies(slug);
CREATE INDEX idx_blog_taxonomies_active ON blog_taxonomies(is_active);
CREATE INDEX idx_blog_taxonomies_sort ON blog_taxonomies(sort_order);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_blog_taxonomy_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_taxonomy_timestamp
    BEFORE UPDATE ON blog_taxonomies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_blog_taxonomy_timestamp();
