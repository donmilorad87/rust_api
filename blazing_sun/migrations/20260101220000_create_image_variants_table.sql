-- Create image_variants table
-- Stores resized variants of uploaded images for responsive serving

CREATE TABLE IF NOT EXISTS image_variants (
    id BIGSERIAL PRIMARY KEY,
    upload_id BIGINT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    variant_name VARCHAR(50) NOT NULL, -- thumb, small, medium, large, full
    stored_name VARCHAR(255) NOT NULL, -- filename with variant suffix
    width INT NOT NULL,
    height INT NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(upload_id, variant_name)
);

-- Index for faster lookups
CREATE INDEX idx_image_variants_upload_id ON image_variants(upload_id);
CREATE INDEX idx_image_variants_variant_name ON image_variants(variant_name);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_image_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_image_variants_updated_at
    BEFORE UPDATE ON image_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_image_variants_updated_at();
