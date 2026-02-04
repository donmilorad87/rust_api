-- Create blog_search_analytics table for tracking search queries
-- Logs search terms, results count, and user behavior

CREATE TABLE IF NOT EXISTS blog_search_analytics (
    id BIGSERIAL PRIMARY KEY,

    -- Search details
    query TEXT NOT NULL,
    query_normalized VARCHAR(255) NOT NULL,
    results_count INTEGER NOT NULL DEFAULT 0,

    -- Search scope: posts, categories, tags, all
    search_scope VARCHAR(20) NOT NULL DEFAULT 'posts',

    -- User info (nullable for anonymous users)
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,

    -- Click tracking (did user click a result?)
    clicked_post_id BIGINT REFERENCES blog_posts(id) ON DELETE SET NULL,
    clicked_at TIMESTAMPTZ,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_search_scope CHECK (search_scope IN ('posts', 'categories', 'tags', 'all'))
);

-- Indexes for analytics queries
CREATE INDEX idx_blog_search_analytics_query ON blog_search_analytics(query_normalized);
CREATE INDEX idx_blog_search_analytics_created ON blog_search_analytics(created_at DESC);
CREATE INDEX idx_blog_search_analytics_user ON blog_search_analytics(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_blog_search_analytics_results ON blog_search_analytics(results_count);

-- Partial index for zero-result queries (important for content gap analysis)
CREATE INDEX idx_blog_search_analytics_no_results ON blog_search_analytics(query_normalized, created_at)
    WHERE results_count = 0;
