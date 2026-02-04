-- Create blog_post_categories junction table
-- Many-to-many relationship between posts and categories

CREATE TABLE IF NOT EXISTS blog_post_categories (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint to prevent duplicates
    CONSTRAINT uq_post_category UNIQUE (post_id, category_id)
);

-- Indexes for efficient joins
CREATE INDEX idx_blog_post_categories_post ON blog_post_categories(post_id);
CREATE INDEX idx_blog_post_categories_category ON blog_post_categories(category_id);
