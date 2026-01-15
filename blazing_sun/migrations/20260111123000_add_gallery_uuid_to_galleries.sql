-- Add public UUID to galleries for detail page URLs
ALTER TABLE galleries
    ADD COLUMN gallery_uuid UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX idx_galleries_gallery_uuid ON galleries(gallery_uuid);

COMMENT ON COLUMN galleries.gallery_uuid IS 'Public UUID for gallery URLs';
