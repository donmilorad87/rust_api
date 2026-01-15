-- Add geo fields for galleries and pictures

ALTER TABLE galleries
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add constraints for galleries (using DO block for IF NOT EXISTS logic)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_galleries_latitude') THEN
        ALTER TABLE galleries ADD CONSTRAINT chk_galleries_latitude
            CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_galleries_longitude') THEN
        ALTER TABLE galleries ADD CONSTRAINT chk_galleries_longitude
            CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_galleries_geo ON galleries(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_galleries_tags ON galleries USING GIN(tags);

ALTER TABLE pictures
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add constraints for pictures (using DO block for IF NOT EXISTS logic)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pictures_latitude') THEN
        ALTER TABLE pictures ADD CONSTRAINT chk_pictures_latitude
            CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pictures_longitude') THEN
        ALTER TABLE pictures ADD CONSTRAINT chk_pictures_longitude
            CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pictures_geo ON pictures(latitude, longitude);

COMMENT ON COLUMN galleries.latitude IS 'Primary latitude for geo galleries';
COMMENT ON COLUMN galleries.longitude IS 'Primary longitude for geo galleries';
COMMENT ON COLUMN galleries.tags IS 'Optional tags for geo galleries';
COMMENT ON COLUMN pictures.latitude IS 'Optional latitude for picture location';
COMMENT ON COLUMN pictures.longitude IS 'Optional longitude for picture location';
