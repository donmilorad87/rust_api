-- Create blog_taxonomy_required_tags table
-- Posts must have ALL these tags to be included in taxonomy

CREATE TABLE IF NOT EXISTS blog_taxonomy_required_tags (
    id BIGSERIAL PRIMARY KEY,
    taxonomy_id BIGINT NOT NULL REFERENCES blog_taxonomies(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_taxonomy_required_tag UNIQUE (taxonomy_id, tag_id)
);

CREATE INDEX idx_taxonomy_required_tags_taxonomy ON blog_taxonomy_required_tags(taxonomy_id);
CREATE INDEX idx_taxonomy_required_tags_tag ON blog_taxonomy_required_tags(tag_id);

-- Create blog_taxonomy_required_categories table
-- Posts must be in ALL these categories to be included in taxonomy

CREATE TABLE IF NOT EXISTS blog_taxonomy_required_categories (
    id BIGSERIAL PRIMARY KEY,
    taxonomy_id BIGINT NOT NULL REFERENCES blog_taxonomies(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_taxonomy_required_category UNIQUE (taxonomy_id, category_id)
);

CREATE INDEX idx_taxonomy_required_categories_taxonomy ON blog_taxonomy_required_categories(taxonomy_id);
CREATE INDEX idx_taxonomy_required_categories_category ON blog_taxonomy_required_categories(category_id);

-- Create blog_taxonomy_explicit_posts table
-- Posts explicitly included in taxonomy regardless of rules

CREATE TABLE IF NOT EXISTS blog_taxonomy_explicit_posts (
    id BIGSERIAL PRIMARY KEY,
    taxonomy_id BIGINT NOT NULL REFERENCES blog_taxonomies(id) ON DELETE CASCADE,
    post_id BIGINT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_taxonomy_explicit_post UNIQUE (taxonomy_id, post_id)
);

CREATE INDEX idx_taxonomy_explicit_posts_taxonomy ON blog_taxonomy_explicit_posts(taxonomy_id);
CREATE INDEX idx_taxonomy_explicit_posts_post ON blog_taxonomy_explicit_posts(post_id);
