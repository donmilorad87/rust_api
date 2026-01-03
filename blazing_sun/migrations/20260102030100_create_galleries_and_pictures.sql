-- Create Galleries and Pictures tables for user image collections
-- A user can have multiple galleries
-- A gallery can have multiple pictures (linked to uploads)

-- ============================================
-- Galleries Table
-- ============================================

CREATE TABLE galleries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Ownership
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Gallery metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Visibility control
    is_public BOOLEAN NOT NULL DEFAULT false,

    -- Display order (for sorting user's galleries)
    display_order INT NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure gallery names are unique per user
    CONSTRAINT uq_user_gallery_name UNIQUE (user_id, name)
);

-- Indexes for performance
CREATE INDEX idx_galleries_user_id ON galleries(user_id);
CREATE INDEX idx_galleries_created_at ON galleries(created_at DESC);
CREATE INDEX idx_galleries_display_order ON galleries(user_id, display_order);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_galleries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_galleries_updated_at
    BEFORE UPDATE ON galleries
    FOR EACH ROW
    EXECUTE FUNCTION update_galleries_updated_at();

-- Comments for documentation
COMMENT ON TABLE galleries IS 'User image galleries - collections of pictures organized by users';
COMMENT ON COLUMN galleries.user_id IS 'Owner of the gallery (FK to users.id)';
COMMENT ON COLUMN galleries.is_public IS 'Whether gallery is visible to other users (false = private)';
COMMENT ON COLUMN galleries.display_order IS 'Sort order for displaying user galleries (lower = first)';

-- ============================================
-- Pictures Table (Gallery <-> Upload link)
-- ============================================

CREATE TABLE pictures (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Relationships
    gallery_id BIGINT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    upload_id BIGINT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,

    -- Picture metadata (override upload defaults)
    title VARCHAR(255),
    description TEXT,

    -- Display order within gallery
    display_order INT NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate images in same gallery
    CONSTRAINT uq_gallery_upload UNIQUE (gallery_id, upload_id)
);

-- Indexes for performance
CREATE INDEX idx_pictures_gallery_id ON pictures(gallery_id);
CREATE INDEX idx_pictures_upload_id ON pictures(upload_id);
CREATE INDEX idx_pictures_display_order ON pictures(gallery_id, display_order);
CREATE INDEX idx_pictures_created_at ON pictures(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pictures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pictures_updated_at
    BEFORE UPDATE ON pictures
    FOR EACH ROW
    EXECUTE FUNCTION update_pictures_updated_at();

-- Comments for documentation
COMMENT ON TABLE pictures IS 'Pictures in galleries - links galleries to uploads with ordering and metadata';
COMMENT ON COLUMN pictures.gallery_id IS 'Gallery this picture belongs to (FK to galleries.id)';
COMMENT ON COLUMN pictures.upload_id IS 'Upload record for the image (FK to uploads.id)';
COMMENT ON COLUMN pictures.title IS 'Picture title (overrides upload.title if set)';
COMMENT ON COLUMN pictures.description IS 'Picture description (overrides upload.description if set)';
COMMENT ON COLUMN pictures.display_order IS 'Sort order within gallery (lower = first)';
COMMENT ON CONSTRAINT uq_gallery_upload ON pictures IS 'Prevents same image from being added to a gallery multiple times';
