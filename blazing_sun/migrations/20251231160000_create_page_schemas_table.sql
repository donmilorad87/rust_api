-- Page Schemas Table
-- Stores structured data schemas (JSON-LD) for each page
-- Each page can have multiple schemas (e.g., Organization + WebSite + BreadcrumbList)

CREATE TABLE IF NOT EXISTS page_schemas (
    id BIGSERIAL PRIMARY KEY,

    -- Reference to page_seo
    page_seo_id BIGINT NOT NULL REFERENCES page_seo(id) ON DELETE CASCADE,

    -- Schema type (Schema.org @type)
    schema_type VARCHAR(100) NOT NULL,           -- e.g., 'Organization', 'WebSite', 'Article'

    -- Schema data (JSON-LD content without @context)
    schema_data JSONB NOT NULL,                  -- The actual schema properties

    -- Ordering for multiple schemas
    position INT DEFAULT 0,                      -- Display/render order

    -- Status
    is_active BOOLEAN DEFAULT true,              -- Enable/disable this schema

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups by page
CREATE INDEX idx_page_schemas_page_seo_id ON page_schemas(page_seo_id);

-- Index for schema type lookups
CREATE INDEX idx_page_schemas_type ON page_schemas(schema_type);

-- Composite index for active schemas by page
CREATE INDEX idx_page_schemas_page_active ON page_schemas(page_seo_id, is_active) WHERE is_active = true;

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_page_schemas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_page_schemas_updated_at ON page_schemas;
CREATE TRIGGER trigger_page_schemas_updated_at
    BEFORE UPDATE ON page_schemas
    FOR EACH ROW
    EXECUTE FUNCTION update_page_schemas_updated_at();

-- Comment on table
COMMENT ON TABLE page_schemas IS 'Stores multiple Schema.org structured data schemas per page for rich search results';
COMMENT ON COLUMN page_schemas.schema_type IS 'Schema.org @type (e.g., Organization, WebSite, Article, Product)';
COMMENT ON COLUMN page_schemas.schema_data IS 'JSON-LD schema properties - @context and @type added at render time';
COMMENT ON COLUMN page_schemas.position IS 'Ordering when multiple schemas exist for same page';
