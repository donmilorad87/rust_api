-- Add gallery_type to galleries for regular vs geo galleries

ALTER TABLE galleries
    ADD COLUMN gallery_type VARCHAR(32) NOT NULL DEFAULT 'regular_galleries';

ALTER TABLE galleries
    ADD CONSTRAINT chk_galleries_gallery_type
    CHECK (gallery_type IN ('regular_galleries', 'geo_galleries'));

CREATE INDEX idx_galleries_gallery_type ON galleries(gallery_type);

COMMENT ON COLUMN galleries.gallery_type IS 'Gallery category: regular_galleries or geo_galleries';
