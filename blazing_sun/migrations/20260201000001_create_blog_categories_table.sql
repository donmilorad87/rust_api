-- Create blog_categories table for hierarchical category organization
-- Supports parent-child relationships for nested categories

CREATE TABLE IF NOT EXISTS blog_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_category_id BIGINT REFERENCES blog_categories(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_blog_categories_slug ON blog_categories(slug);
CREATE INDEX idx_blog_categories_parent ON blog_categories(parent_category_id);
CREATE INDEX idx_blog_categories_active ON blog_categories(is_active);
CREATE INDEX idx_blog_categories_sort ON blog_categories(sort_order);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_blog_category_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_category_timestamp
    BEFORE UPDATE ON blog_categories
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_blog_category_timestamp();
