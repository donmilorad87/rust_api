-- Create geo place images table for place galleries

CREATE TABLE geo_place_images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Relationships
    place_id BIGINT NOT NULL REFERENCES geo_places(id) ON DELETE CASCADE,
    upload_id BIGINT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,

    -- Image metadata
    title VARCHAR(255),
    description TEXT,
    tag VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    -- Audit
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_geo_place_images_place_upload UNIQUE (place_id, upload_id)
);

CREATE INDEX idx_geo_place_images_place_id ON geo_place_images(place_id);
CREATE INDEX idx_geo_place_images_created_at ON geo_place_images(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_geo_place_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_geo_place_images_updated_at
    BEFORE UPDATE ON geo_place_images
    FOR EACH ROW
    EXECUTE FUNCTION update_geo_place_images_updated_at();

COMMENT ON TABLE geo_place_images IS 'Images attached to geo places for map galleries';
COMMENT ON COLUMN geo_place_images.place_id IS 'Geo place that owns the image';
COMMENT ON COLUMN geo_place_images.upload_id IS 'Upload record for the image';
COMMENT ON COLUMN geo_place_images.tag IS 'Single tag describing the image';
