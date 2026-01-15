-- Add cover image support to galleries
-- A gallery can optionally have a cover image from its uploads

-- Add cover_image_id column (references uploads table)
ALTER TABLE galleries
ADD COLUMN cover_image_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL;

-- Add cover_image_uuid column for quick access without join
ALTER TABLE galleries
ADD COLUMN cover_image_uuid UUID;

-- Create index for performance
CREATE INDEX idx_galleries_cover_image_id ON galleries(cover_image_id);

-- Add comment
COMMENT ON COLUMN galleries.cover_image_id IS 'Optional cover image for the gallery (must be a public upload)';
COMMENT ON COLUMN galleries.cover_image_uuid IS 'Cached UUID of cover image for quick URL generation';
