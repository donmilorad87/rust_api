-- Add title column to uploads table for asset metadata
-- This field will be used for aria-title attribute in images

ALTER TABLE uploads
ADD COLUMN title VARCHAR(255);

-- Add index for title search queries
CREATE INDEX idx_uploads_title ON uploads(title) WHERE title IS NOT NULL;

-- Update existing records with filename as default title (optional)
UPDATE uploads
SET title = original_name
WHERE title IS NULL AND upload_status = 'completed';
