-- Create blog_posts table for blog content
-- Stores posts with title, slug, content, status, and metadata

CREATE TABLE IF NOT EXISTS blog_posts (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,

    -- Featured image (references uploads table)
    featured_image_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL,

    -- Author
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Status: draft, published, scheduled, archived
    status VARCHAR(20) NOT NULL DEFAULT 'draft',

    -- SEO fields
    meta_title VARCHAR(70),
    meta_description VARCHAR(160),

    -- Publishing
    published_at TIMESTAMPTZ,

    -- View tracking
    view_count INTEGER NOT NULL DEFAULT 0,

    -- Flags
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_post_status CHECK (status IN ('draft', 'published', 'scheduled', 'archived'))
);

-- Indexes for common queries
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at);
CREATE INDEX idx_blog_posts_featured ON blog_posts(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_blog_posts_active ON blog_posts(is_active);
CREATE INDEX idx_blog_posts_view_count ON blog_posts(view_count DESC);
CREATE INDEX idx_blog_posts_created_at ON blog_posts(created_at DESC);

-- Composite index for common listing queries
CREATE INDEX idx_blog_posts_public_listing ON blog_posts(status, published_at DESC, is_active)
    WHERE status = 'published' AND is_active = TRUE;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_update_blog_post_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_blog_post_timestamp
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_blog_post_timestamp();
