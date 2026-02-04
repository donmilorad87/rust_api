-- Create blog_post_tags junction table
-- Many-to-many relationship between posts and tags

CREATE TABLE IF NOT EXISTS blog_post_tags (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint to prevent duplicates
    CONSTRAINT uq_post_tag UNIQUE (post_id, tag_id)
);

-- Indexes for efficient joins
CREATE INDEX idx_blog_post_tags_post ON blog_post_tags(post_id);
CREATE INDEX idx_blog_post_tags_tag ON blog_post_tags(tag_id);
