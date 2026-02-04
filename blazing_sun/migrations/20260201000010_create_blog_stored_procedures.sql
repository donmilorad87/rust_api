-- Stored procedures for blog module operations

-- ============================================================================
-- CATEGORY PROCEDURES
-- ============================================================================

-- Create a new category
CREATE OR REPLACE FUNCTION sp_create_blog_category(
    p_name VARCHAR(100),
    p_slug VARCHAR(100) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_parent_category_id BIGINT DEFAULT NULL,
    p_sort_order INTEGER DEFAULT 0
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO blog_categories (name, slug, description, parent_category_id, sort_order)
    VALUES (p_name, p_slug, p_description, p_parent_category_id, p_sort_order)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Update category
CREATE OR REPLACE FUNCTION sp_update_blog_category(
    p_id BIGINT,
    p_name VARCHAR(100) DEFAULT NULL,
    p_slug VARCHAR(100) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_parent_category_id BIGINT DEFAULT NULL,
    p_sort_order INTEGER DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE blog_categories
    SET name = COALESCE(p_name, name),
        slug = COALESCE(p_slug, slug),
        description = COALESCE(p_description, description),
        parent_category_id = p_parent_category_id,
        sort_order = COALESCE(p_sort_order, sort_order),
        is_active = COALESCE(p_is_active, is_active)
    WHERE id = p_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Delete category (soft delete)
CREATE OR REPLACE FUNCTION sp_delete_blog_category(p_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE blog_categories SET is_active = FALSE WHERE id = p_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get category tree (hierarchical)
CREATE OR REPLACE FUNCTION sp_get_blog_category_tree()
RETURNS TABLE (
    id BIGINT,
    name VARCHAR(100),
    slug VARCHAR(100),
    description TEXT,
    parent_category_id BIGINT,
    sort_order INTEGER,
    depth INTEGER,
    post_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE category_tree AS (
        SELECT c.id, c.name, c.slug, c.description, c.parent_category_id, c.sort_order, 0 AS depth
        FROM blog_categories c
        WHERE c.parent_category_id IS NULL AND c.is_active = TRUE

        UNION ALL

        SELECT c.id, c.name, c.slug, c.description, c.parent_category_id, c.sort_order, ct.depth + 1
        FROM blog_categories c
        INNER JOIN category_tree ct ON c.parent_category_id = ct.id
        WHERE c.is_active = TRUE
    )
    SELECT ct.id, ct.name, ct.slug, ct.description, ct.parent_category_id, ct.sort_order, ct.depth,
           COALESCE(pc.post_count, 0) AS post_count
    FROM category_tree ct
    LEFT JOIN (
        SELECT category_id, COUNT(*) AS post_count
        FROM blog_post_categories bpc
        INNER JOIN blog_posts bp ON bpc.post_id = bp.id
        WHERE bp.status = 'published' AND bp.is_active = TRUE
        GROUP BY category_id
    ) pc ON ct.id = pc.category_id
    ORDER BY ct.depth, ct.sort_order, ct.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TAG PROCEDURES
-- ============================================================================

-- Create a new tag
CREATE OR REPLACE FUNCTION sp_create_blog_tag(
    p_name VARCHAR(50),
    p_slug VARCHAR(50) DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO blog_tags (name, slug, description)
    VALUES (p_name, p_slug, p_description)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Update tag
CREATE OR REPLACE FUNCTION sp_update_blog_tag(
    p_id BIGINT,
    p_name VARCHAR(50) DEFAULT NULL,
    p_slug VARCHAR(50) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE blog_tags
    SET name = COALESCE(p_name, name),
        slug = COALESCE(p_slug, slug),
        description = COALESCE(p_description, description),
        is_active = COALESCE(p_is_active, is_active)
    WHERE id = p_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Delete tag (soft delete)
CREATE OR REPLACE FUNCTION sp_delete_blog_tag(p_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE blog_tags SET is_active = FALSE WHERE id = p_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get tag cloud data (tags with post counts)
CREATE OR REPLACE FUNCTION sp_get_blog_tag_cloud(
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id BIGINT,
    name VARCHAR(50),
    slug VARCHAR(50),
    post_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.slug, COUNT(bpt.post_id) AS post_count
    FROM blog_tags t
    LEFT JOIN blog_post_tags bpt ON t.id = bpt.tag_id
    LEFT JOIN blog_posts bp ON bpt.post_id = bp.id AND bp.status = 'published' AND bp.is_active = TRUE
    WHERE t.is_active = TRUE
    GROUP BY t.id, t.name, t.slug
    HAVING COUNT(bpt.post_id) > 0
    ORDER BY post_count DESC, t.name ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- POST PROCEDURES
-- ============================================================================

-- Create a new post
CREATE OR REPLACE FUNCTION sp_create_blog_post(
    p_title VARCHAR(255),
    p_slug VARCHAR(255) DEFAULT NULL,
    p_excerpt TEXT DEFAULT NULL,
    p_content TEXT DEFAULT '',
    p_author_id BIGINT DEFAULT NULL,
    p_featured_image_id BIGINT DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT 'draft',
    p_meta_title VARCHAR(70) DEFAULT NULL,
    p_meta_description VARCHAR(160) DEFAULT NULL,
    p_published_at TIMESTAMPTZ DEFAULT NULL,
    p_is_featured BOOLEAN DEFAULT FALSE,
    p_allow_comments BOOLEAN DEFAULT TRUE
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO blog_posts (
        title, slug, excerpt, content, author_id, featured_image_id,
        status, meta_title, meta_description, published_at, is_featured, allow_comments
    )
    VALUES (
        p_title, p_slug, p_excerpt, p_content, p_author_id, p_featured_image_id,
        p_status, p_meta_title, p_meta_description, p_published_at, p_is_featured, p_allow_comments
    )
    RETURNING id INTO v_id;

    -- Auto-set published_at when status is published and no date set
    IF p_status = 'published' AND p_published_at IS NULL THEN
        UPDATE blog_posts SET published_at = NOW() WHERE id = v_id;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Update post
CREATE OR REPLACE FUNCTION sp_update_blog_post(
    p_id BIGINT,
    p_title VARCHAR(255) DEFAULT NULL,
    p_slug VARCHAR(255) DEFAULT NULL,
    p_excerpt TEXT DEFAULT NULL,
    p_content TEXT DEFAULT NULL,
    p_featured_image_id BIGINT DEFAULT NULL,
    p_status VARCHAR(20) DEFAULT NULL,
    p_meta_title VARCHAR(70) DEFAULT NULL,
    p_meta_description VARCHAR(160) DEFAULT NULL,
    p_published_at TIMESTAMPTZ DEFAULT NULL,
    p_is_featured BOOLEAN DEFAULT NULL,
    p_allow_comments BOOLEAN DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_old_status VARCHAR(20);
BEGIN
    SELECT status INTO v_old_status FROM blog_posts WHERE id = p_id;

    UPDATE blog_posts
    SET title = COALESCE(p_title, title),
        slug = COALESCE(p_slug, slug),
        excerpt = COALESCE(p_excerpt, excerpt),
        content = COALESCE(p_content, content),
        featured_image_id = p_featured_image_id,
        status = COALESCE(p_status, status),
        meta_title = COALESCE(p_meta_title, meta_title),
        meta_description = COALESCE(p_meta_description, meta_description),
        published_at = COALESCE(p_published_at, published_at),
        is_featured = COALESCE(p_is_featured, is_featured),
        allow_comments = COALESCE(p_allow_comments, allow_comments),
        is_active = COALESCE(p_is_active, is_active)
    WHERE id = p_id;

    -- Auto-set published_at when transitioning to published
    IF p_status = 'published' AND v_old_status != 'published' THEN
        UPDATE blog_posts SET published_at = COALESCE(published_at, NOW()) WHERE id = p_id;
    END IF;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Delete post (soft delete)
CREATE OR REPLACE FUNCTION sp_delete_blog_post(p_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE blog_posts SET is_active = FALSE WHERE id = p_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Set post categories (replaces existing)
CREATE OR REPLACE FUNCTION sp_set_blog_post_categories(
    p_post_id BIGINT,
    p_category_ids BIGINT[]
)
RETURNS VOID AS $$
BEGIN
    -- Remove existing categories
    DELETE FROM blog_post_categories WHERE post_id = p_post_id;

    -- Add new categories
    INSERT INTO blog_post_categories (post_id, category_id)
    SELECT p_post_id, unnest(p_category_ids)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Set post tags (replaces existing)
CREATE OR REPLACE FUNCTION sp_set_blog_post_tags(
    p_post_id BIGINT,
    p_tag_ids BIGINT[]
)
RETURNS VOID AS $$
BEGIN
    -- Remove existing tags
    DELETE FROM blog_post_tags WHERE post_id = p_post_id;

    -- Add new tags
    INSERT INTO blog_post_tags (post_id, tag_id)
    SELECT p_post_id, unnest(p_tag_ids)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Get posts by category
CREATE OR REPLACE FUNCTION sp_get_posts_by_category(
    p_category_slug VARCHAR(100),
    p_page INTEGER DEFAULT 1,
    p_per_page INTEGER DEFAULT 10
)
RETURNS TABLE (
    id BIGINT,
    title VARCHAR(255),
    slug VARCHAR(255),
    excerpt TEXT,
    featured_image_id BIGINT,
    author_id BIGINT,
    author_name TEXT,
    published_at TIMESTAMPTZ,
    view_count INTEGER,
    total_count BIGINT
) AS $$
DECLARE
    v_offset INTEGER := (p_page - 1) * p_per_page;
BEGIN
    RETURN QUERY
    WITH post_data AS (
        SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image_id,
               bp.author_id, u.first_name || ' ' || u.last_name AS author_name,
               bp.published_at, bp.view_count,
               COUNT(*) OVER() AS total_count
        FROM blog_posts bp
        INNER JOIN blog_post_categories bpc ON bp.id = bpc.post_id
        INNER JOIN blog_categories bc ON bpc.category_id = bc.id
        INNER JOIN users u ON bp.author_id = u.id
        WHERE bc.slug = p_category_slug
        AND bp.status = 'published'
        AND bp.is_active = TRUE
        AND bc.is_active = TRUE
        ORDER BY bp.published_at DESC
        LIMIT p_per_page OFFSET v_offset
    )
    SELECT * FROM post_data;
END;
$$ LANGUAGE plpgsql;

-- Get posts by tag
CREATE OR REPLACE FUNCTION sp_get_posts_by_tag(
    p_tag_slug VARCHAR(50),
    p_page INTEGER DEFAULT 1,
    p_per_page INTEGER DEFAULT 10
)
RETURNS TABLE (
    id BIGINT,
    title VARCHAR(255),
    slug VARCHAR(255),
    excerpt TEXT,
    featured_image_id BIGINT,
    author_id BIGINT,
    author_name TEXT,
    published_at TIMESTAMPTZ,
    view_count INTEGER,
    total_count BIGINT
) AS $$
DECLARE
    v_offset INTEGER := (p_page - 1) * p_per_page;
BEGIN
    RETURN QUERY
    WITH post_data AS (
        SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image_id,
               bp.author_id, u.first_name || ' ' || u.last_name AS author_name,
               bp.published_at, bp.view_count,
               COUNT(*) OVER() AS total_count
        FROM blog_posts bp
        INNER JOIN blog_post_tags bpt ON bp.id = bpt.post_id
        INNER JOIN blog_tags bt ON bpt.tag_id = bt.id
        INNER JOIN users u ON bp.author_id = u.id
        WHERE bt.slug = p_tag_slug
        AND bp.status = 'published'
        AND bp.is_active = TRUE
        AND bt.is_active = TRUE
        ORDER BY bp.published_at DESC
        LIMIT p_per_page OFFSET v_offset
    )
    SELECT * FROM post_data;
END;
$$ LANGUAGE plpgsql;

-- Get archive data (years and months with post counts)
CREATE OR REPLACE FUNCTION sp_get_blog_archive_data()
RETURNS TABLE (
    year INTEGER,
    month INTEGER,
    post_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        EXTRACT(YEAR FROM bp.published_at)::INTEGER AS year,
        EXTRACT(MONTH FROM bp.published_at)::INTEGER AS month,
        COUNT(*) AS post_count
    FROM blog_posts bp
    WHERE bp.status = 'published'
    AND bp.is_active = TRUE
    AND bp.published_at IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM bp.published_at), EXTRACT(MONTH FROM bp.published_at)
    ORDER BY year DESC, month DESC;
END;
$$ LANGUAGE plpgsql;

-- Get posts by archive period
CREATE OR REPLACE FUNCTION sp_get_posts_by_archive(
    p_year INTEGER,
    p_month INTEGER,
    p_page INTEGER DEFAULT 1,
    p_per_page INTEGER DEFAULT 10
)
RETURNS TABLE (
    id BIGINT,
    title VARCHAR(255),
    slug VARCHAR(255),
    excerpt TEXT,
    featured_image_id BIGINT,
    author_id BIGINT,
    author_name TEXT,
    published_at TIMESTAMPTZ,
    view_count INTEGER,
    total_count BIGINT
) AS $$
DECLARE
    v_offset INTEGER := (p_page - 1) * p_per_page;
BEGIN
    RETURN QUERY
    WITH post_data AS (
        SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image_id,
               bp.author_id, u.first_name || ' ' || u.last_name AS author_name,
               bp.published_at, bp.view_count,
               COUNT(*) OVER() AS total_count
        FROM blog_posts bp
        INNER JOIN users u ON bp.author_id = u.id
        WHERE EXTRACT(YEAR FROM bp.published_at) = p_year
        AND EXTRACT(MONTH FROM bp.published_at) = p_month
        AND bp.status = 'published'
        AND bp.is_active = TRUE
        ORDER BY bp.published_at DESC
        LIMIT p_per_page OFFSET v_offset
    )
    SELECT * FROM post_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TAXONOMY PROCEDURES
-- ============================================================================

-- Create a new taxonomy
CREATE OR REPLACE FUNCTION sp_create_blog_taxonomy(
    p_name VARCHAR(100),
    p_slug VARCHAR(100) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_display_title VARCHAR(255) DEFAULT NULL,
    p_featured_image_id BIGINT DEFAULT NULL,
    p_rule_logic VARCHAR(10) DEFAULT 'all',
    p_sort_order INTEGER DEFAULT 0
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    INSERT INTO blog_taxonomies (name, slug, description, display_title, featured_image_id, rule_logic, sort_order)
    VALUES (p_name, p_slug, p_description, p_display_title, p_featured_image_id, p_rule_logic, p_sort_order)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Update taxonomy
CREATE OR REPLACE FUNCTION sp_update_blog_taxonomy(
    p_id BIGINT,
    p_name VARCHAR(100) DEFAULT NULL,
    p_slug VARCHAR(100) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_display_title VARCHAR(255) DEFAULT NULL,
    p_featured_image_id BIGINT DEFAULT NULL,
    p_rule_logic VARCHAR(10) DEFAULT NULL,
    p_sort_order INTEGER DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE blog_taxonomies
    SET name = COALESCE(p_name, name),
        slug = COALESCE(p_slug, slug),
        description = COALESCE(p_description, description),
        display_title = COALESCE(p_display_title, display_title),
        featured_image_id = p_featured_image_id,
        rule_logic = COALESCE(p_rule_logic, rule_logic),
        sort_order = COALESCE(p_sort_order, sort_order),
        is_active = COALESCE(p_is_active, is_active)
    WHERE id = p_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Delete taxonomy (soft delete)
CREATE OR REPLACE FUNCTION sp_delete_blog_taxonomy(p_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE blog_taxonomies SET is_active = FALSE WHERE id = p_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Set taxonomy rules
CREATE OR REPLACE FUNCTION sp_set_taxonomy_rules(
    p_taxonomy_id BIGINT,
    p_required_tag_ids BIGINT[] DEFAULT NULL,
    p_required_category_ids BIGINT[] DEFAULT NULL,
    p_explicit_post_ids BIGINT[] DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Clear existing rules
    IF p_required_tag_ids IS NOT NULL THEN
        DELETE FROM blog_taxonomy_required_tags WHERE taxonomy_id = p_taxonomy_id;
        INSERT INTO blog_taxonomy_required_tags (taxonomy_id, tag_id)
        SELECT p_taxonomy_id, unnest(p_required_tag_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    IF p_required_category_ids IS NOT NULL THEN
        DELETE FROM blog_taxonomy_required_categories WHERE taxonomy_id = p_taxonomy_id;
        INSERT INTO blog_taxonomy_required_categories (taxonomy_id, category_id)
        SELECT p_taxonomy_id, unnest(p_required_category_ids)
        ON CONFLICT DO NOTHING;
    END IF;

    IF p_explicit_post_ids IS NOT NULL THEN
        DELETE FROM blog_taxonomy_explicit_posts WHERE taxonomy_id = p_taxonomy_id;
        INSERT INTO blog_taxonomy_explicit_posts (taxonomy_id, post_id)
        SELECT p_taxonomy_id, unnest(p_explicit_post_ids)
        ON CONFLICT DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Get posts by taxonomy (complex rule matching)
CREATE OR REPLACE FUNCTION sp_get_taxonomy_posts(
    p_taxonomy_slug VARCHAR(100),
    p_page INTEGER DEFAULT 1,
    p_per_page INTEGER DEFAULT 10
)
RETURNS TABLE (
    id BIGINT,
    title VARCHAR(255),
    slug VARCHAR(255),
    excerpt TEXT,
    featured_image_id BIGINT,
    author_id BIGINT,
    author_name TEXT,
    published_at TIMESTAMPTZ,
    view_count INTEGER,
    total_count BIGINT
) AS $$
DECLARE
    v_taxonomy_id BIGINT;
    v_rule_logic VARCHAR(10);
    v_required_tag_count INTEGER;
    v_required_category_count INTEGER;
    v_offset INTEGER := (p_page - 1) * p_per_page;
BEGIN
    -- Get taxonomy info
    SELECT bt.id, bt.rule_logic INTO v_taxonomy_id, v_rule_logic
    FROM blog_taxonomies bt
    WHERE bt.slug = p_taxonomy_slug AND bt.is_active = TRUE;

    IF v_taxonomy_id IS NULL THEN
        RETURN;
    END IF;

    -- Count required tags and categories
    SELECT COUNT(*) INTO v_required_tag_count
    FROM blog_taxonomy_required_tags WHERE taxonomy_id = v_taxonomy_id;

    SELECT COUNT(*) INTO v_required_category_count
    FROM blog_taxonomy_required_categories WHERE taxonomy_id = v_taxonomy_id;

    RETURN QUERY
    WITH matching_posts AS (
        -- Posts matching tag rules
        SELECT bp.id AS post_id
        FROM blog_posts bp
        WHERE bp.status = 'published' AND bp.is_active = TRUE
        AND (
            v_required_tag_count = 0
            OR (
                SELECT COUNT(DISTINCT bpt.tag_id)
                FROM blog_post_tags bpt
                INNER JOIN blog_taxonomy_required_tags trt ON bpt.tag_id = trt.tag_id
                WHERE bpt.post_id = bp.id AND trt.taxonomy_id = v_taxonomy_id
            ) = v_required_tag_count
        )
        AND (
            v_required_category_count = 0
            OR (
                SELECT COUNT(DISTINCT bpc.category_id)
                FROM blog_post_categories bpc
                INNER JOIN blog_taxonomy_required_categories trc ON bpc.category_id = trc.category_id
                WHERE bpc.post_id = bp.id AND trc.taxonomy_id = v_taxonomy_id
            ) = v_required_category_count
        )

        UNION

        -- Explicitly included posts
        SELECT tep.post_id
        FROM blog_taxonomy_explicit_posts tep
        INNER JOIN blog_posts bp ON tep.post_id = bp.id
        WHERE tep.taxonomy_id = v_taxonomy_id
        AND bp.status = 'published' AND bp.is_active = TRUE
    ),
    post_data AS (
        SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image_id,
               bp.author_id, u.first_name || ' ' || u.last_name AS author_name,
               bp.published_at, bp.view_count,
               COUNT(*) OVER() AS total_count
        FROM blog_posts bp
        INNER JOIN matching_posts mp ON bp.id = mp.post_id
        INNER JOIN users u ON bp.author_id = u.id
        ORDER BY bp.published_at DESC
        LIMIT p_per_page OFFSET v_offset
    )
    SELECT * FROM post_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEARCH ANALYTICS PROCEDURES
-- ============================================================================

-- Log a search query
CREATE OR REPLACE FUNCTION sp_log_blog_search(
    p_query TEXT,
    p_results_count INTEGER,
    p_search_scope VARCHAR(20) DEFAULT 'posts',
    p_user_id BIGINT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
    v_normalized VARCHAR(255);
BEGIN
    -- Normalize query for analytics (lowercase, trimmed, limited length)
    v_normalized := lower(trim(left(p_query, 255)));

    INSERT INTO blog_search_analytics (
        query, query_normalized, results_count, search_scope,
        user_id, ip_address, user_agent
    )
    VALUES (
        p_query, v_normalized, p_results_count, p_search_scope,
        p_user_id, p_ip_address, p_user_agent
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Log search click
CREATE OR REPLACE FUNCTION sp_log_blog_search_click(
    p_search_id BIGINT,
    p_post_id BIGINT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE blog_search_analytics
    SET clicked_post_id = p_post_id,
        clicked_at = NOW()
    WHERE id = p_search_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get search analytics summary
CREATE OR REPLACE FUNCTION sp_get_blog_search_analytics_summary(
    p_days INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    query_normalized VARCHAR(255),
    search_count BIGINT,
    avg_results NUMERIC,
    zero_results_count BIGINT,
    click_count BIGINT,
    click_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bsa.query_normalized,
        COUNT(*) AS search_count,
        ROUND(AVG(bsa.results_count), 2) AS avg_results,
        COUNT(*) FILTER (WHERE bsa.results_count = 0) AS zero_results_count,
        COUNT(*) FILTER (WHERE bsa.clicked_post_id IS NOT NULL) AS click_count,
        ROUND(
            COUNT(*) FILTER (WHERE bsa.clicked_post_id IS NOT NULL)::NUMERIC /
            NULLIF(COUNT(*), 0) * 100, 2
        ) AS click_rate
    FROM blog_search_analytics bsa
    WHERE bsa.created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY bsa.query_normalized
    ORDER BY search_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get zero-result searches (content gap analysis)
CREATE OR REPLACE FUNCTION sp_get_blog_zero_result_searches(
    p_days INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    query_normalized VARCHAR(255),
    search_count BIGINT,
    last_searched TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bsa.query_normalized,
        COUNT(*) AS search_count,
        MAX(bsa.created_at) AS last_searched
    FROM blog_search_analytics bsa
    WHERE bsa.created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND bsa.results_count = 0
    GROUP BY bsa.query_normalized
    ORDER BY search_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- LISTING PROCEDURES
-- ============================================================================

-- Get published posts with pagination
CREATE OR REPLACE FUNCTION sp_get_published_posts(
    p_page INTEGER DEFAULT 1,
    p_per_page INTEGER DEFAULT 10,
    p_featured_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id BIGINT,
    title VARCHAR(255),
    slug VARCHAR(255),
    excerpt TEXT,
    featured_image_id BIGINT,
    author_id BIGINT,
    author_name TEXT,
    published_at TIMESTAMPTZ,
    view_count INTEGER,
    is_featured BOOLEAN,
    total_count BIGINT
) AS $$
DECLARE
    v_offset INTEGER := (p_page - 1) * p_per_page;
BEGIN
    RETURN QUERY
    WITH post_data AS (
        SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image_id,
               bp.author_id, u.first_name || ' ' || u.last_name AS author_name,
               bp.published_at, bp.view_count, bp.is_featured,
               COUNT(*) OVER() AS total_count
        FROM blog_posts bp
        INNER JOIN users u ON bp.author_id = u.id
        WHERE bp.status = 'published'
        AND bp.is_active = TRUE
        AND (NOT p_featured_only OR bp.is_featured = TRUE)
        ORDER BY bp.published_at DESC
        LIMIT p_per_page OFFSET v_offset
    )
    SELECT * FROM post_data;
END;
$$ LANGUAGE plpgsql;

-- Get single post by slug
CREATE OR REPLACE FUNCTION sp_get_blog_post_by_slug(
    p_slug VARCHAR(255)
)
RETURNS TABLE (
    id BIGINT,
    title VARCHAR(255),
    slug VARCHAR(255),
    excerpt TEXT,
    content TEXT,
    featured_image_id BIGINT,
    author_id BIGINT,
    author_name TEXT,
    status VARCHAR(20),
    meta_title VARCHAR(70),
    meta_description VARCHAR(160),
    published_at TIMESTAMPTZ,
    view_count INTEGER,
    is_featured BOOLEAN,
    allow_comments BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    categories JSONB,
    tags JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bp.id, bp.title, bp.slug, bp.excerpt, bp.content, bp.featured_image_id,
        bp.author_id, u.first_name || ' ' || u.last_name AS author_name,
        bp.status, bp.meta_title, bp.meta_description, bp.published_at,
        bp.view_count, bp.is_featured, bp.allow_comments, bp.created_at, bp.updated_at,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('id', bc.id, 'name', bc.name, 'slug', bc.slug))
             FROM blog_post_categories bpc
             INNER JOIN blog_categories bc ON bpc.category_id = bc.id
             WHERE bpc.post_id = bp.id AND bc.is_active = TRUE),
            '[]'::jsonb
        ) AS categories,
        COALESCE(
            (SELECT jsonb_agg(jsonb_build_object('id', bt.id, 'name', bt.name, 'slug', bt.slug))
             FROM blog_post_tags bpt
             INNER JOIN blog_tags bt ON bpt.tag_id = bt.id
             WHERE bpt.post_id = bp.id AND bt.is_active = TRUE),
            '[]'::jsonb
        ) AS tags
    FROM blog_posts bp
    INNER JOIN users u ON bp.author_id = u.id
    WHERE bp.slug = p_slug
    AND bp.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Admin: Get all posts with filters
CREATE OR REPLACE FUNCTION sp_admin_get_blog_posts(
    p_page INTEGER DEFAULT 1,
    p_per_page INTEGER DEFAULT 20,
    p_status VARCHAR(20) DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS TABLE (
    id BIGINT,
    title VARCHAR(255),
    slug VARCHAR(255),
    status VARCHAR(20),
    author_id BIGINT,
    author_name TEXT,
    published_at TIMESTAMPTZ,
    view_count INTEGER,
    is_featured BOOLEAN,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    total_count BIGINT
) AS $$
DECLARE
    v_offset INTEGER := (p_page - 1) * p_per_page;
BEGIN
    RETURN QUERY
    WITH post_data AS (
        SELECT bp.id, bp.title, bp.slug, bp.status,
               bp.author_id, u.first_name || ' ' || u.last_name AS author_name,
               bp.published_at, bp.view_count, bp.is_featured, bp.is_active,
               bp.created_at, bp.updated_at,
               COUNT(*) OVER() AS total_count
        FROM blog_posts bp
        INNER JOIN users u ON bp.author_id = u.id
        WHERE (p_status IS NULL OR bp.status = p_status)
        AND (p_search IS NULL OR bp.title ILIKE '%' || p_search || '%')
        ORDER BY bp.created_at DESC
        LIMIT p_per_page OFFSET v_offset
    )
    SELECT * FROM post_data;
END;
$$ LANGUAGE plpgsql;
