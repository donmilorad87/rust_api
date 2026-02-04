-- Create blog_tags table for post tagging
-- Simple flat structure for flexible content organization

CREATE TABLE IF NOT EXISTS blog_tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_blog_tags_slug ON blog_tags(slug);
CREATE INDEX idx_blog_tags_active ON blog_tags(is_active);
CREATE INDEX idx_blog_tags_name ON blog_tags(name);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_blog_tag_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_tag_timestamp
    BEFORE UPDATE ON blog_tags
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_blog_tag_timestamp();
