-- Create triggers for blog module

-- Trigger to auto-publish scheduled posts
-- This can be called by a cron job to publish scheduled posts

CREATE OR REPLACE FUNCTION sp_publish_scheduled_posts()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH updated AS (
        UPDATE blog_posts
        SET status = 'published'
        WHERE status = 'scheduled'
        AND published_at <= NOW()
        AND is_active = TRUE
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM updated;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment view count
CREATE OR REPLACE FUNCTION sp_increment_post_view_count(
    p_post_id BIGINT
)
RETURNS INTEGER AS $$
DECLARE
    v_new_count INTEGER;
BEGIN
    UPDATE blog_posts
    SET view_count = view_count + 1
    WHERE id = p_post_id
    AND status = 'published'
    AND is_active = TRUE
    RETURNING view_count INTO v_new_count;

    RETURN COALESCE(v_new_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Trigger to generate slug from title if not provided
CREATE OR REPLACE FUNCTION trigger_generate_blog_post_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
        NEW.slug := trim(both '-' from NEW.slug);

        -- Ensure uniqueness by appending timestamp if needed
        IF EXISTS (SELECT 1 FROM blog_posts WHERE slug = NEW.slug AND id != COALESCE(NEW.id, 0)) THEN
            NEW.slug := NEW.slug || '-' || extract(epoch from now())::bigint;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_blog_post_slug
    BEFORE INSERT OR UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_blog_post_slug();

-- Trigger to generate category slug from name if not provided
CREATE OR REPLACE FUNCTION trigger_generate_blog_category_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
        NEW.slug := trim(both '-' from NEW.slug);

        IF EXISTS (SELECT 1 FROM blog_categories WHERE slug = NEW.slug AND id != COALESCE(NEW.id, 0)) THEN
            NEW.slug := NEW.slug || '-' || extract(epoch from now())::bigint;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_blog_category_slug
    BEFORE INSERT OR UPDATE ON blog_categories
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_blog_category_slug();

-- Trigger to generate tag slug from name if not provided
CREATE OR REPLACE FUNCTION trigger_generate_blog_tag_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
        NEW.slug := trim(both '-' from NEW.slug);

        IF EXISTS (SELECT 1 FROM blog_tags WHERE slug = NEW.slug AND id != COALESCE(NEW.id, 0)) THEN
            NEW.slug := NEW.slug || '-' || extract(epoch from now())::bigint;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_blog_tag_slug
    BEFORE INSERT OR UPDATE ON blog_tags
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_blog_tag_slug();

-- Trigger to generate taxonomy slug from name if not provided
CREATE OR REPLACE FUNCTION trigger_generate_blog_taxonomy_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
        NEW.slug := trim(both '-' from NEW.slug);

        IF EXISTS (SELECT 1 FROM blog_taxonomies WHERE slug = NEW.slug AND id != COALESCE(NEW.id, 0)) THEN
            NEW.slug := NEW.slug || '-' || extract(epoch from now())::bigint;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_blog_taxonomy_slug
    BEFORE INSERT OR UPDATE ON blog_taxonomies
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_blog_taxonomy_slug();
