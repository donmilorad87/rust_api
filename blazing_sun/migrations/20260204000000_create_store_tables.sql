-- Create e-commerce store tables for image/gallery sales
-- This migration creates 5 tables: store_categories, store_products,
-- store_product_items, store_purchases, and store_downloads

-- ============================================================================
-- TABLE 1: store_categories
-- Admin-managed categories for organizing products
-- ============================================================================

CREATE TABLE store_categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Category metadata
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,

    -- Cover image (references uploads table)
    cover_image_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL,

    -- Display settings
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for store_categories
CREATE INDEX idx_store_categories_slug ON store_categories(slug);
CREATE INDEX idx_store_categories_active ON store_categories(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_store_categories_display_order ON store_categories(display_order);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION trigger_update_store_category_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_store_category_timestamp
    BEFORE UPDATE ON store_categories
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_store_category_timestamp();

-- Comments
COMMENT ON TABLE store_categories IS 'Admin-managed categories for organizing store products';
COMMENT ON COLUMN store_categories.slug IS 'URL-friendly identifier for the category';
COMMENT ON COLUMN store_categories.display_order IS 'Sort order for displaying categories (lower = first)';

-- ============================================================================
-- TABLE 2: store_products
-- Products for sale with rich metadata for natural images
-- ============================================================================

CREATE TABLE store_products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Basic product info
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,

    -- Pricing (stored in cents for precision)
    price_cents BIGINT NOT NULL,

    -- Product type: single_image, gallery, bundle
    product_type VARCHAR(32) NOT NULL,

    -- Category reference
    category_id BIGINT REFERENCES store_categories(id) ON DELETE SET NULL,

    -- Cover image
    cover_image_id BIGINT REFERENCES uploads(id) ON DELETE SET NULL,

    -- Rich metadata for natural images
    author_name VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100),
    region VARCHAR(100),
    nearest_mountain VARCHAR(255),
    nearest_river VARCHAR(255),
    natural_park VARCHAR(255),
    altitude_meters INT,
    season VARCHAR(50),  -- spring, summer, autumn, winter
    weather_conditions VARCHAR(100),
    camera_info VARCHAR(255),
    date_taken DATE,

    -- Location coordinates
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    -- Tags (PostgreSQL array)
    tags TEXT[],

    -- Status flags
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_sold BOOLEAN NOT NULL DEFAULT FALSE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_product_type CHECK (product_type IN ('single_image', 'gallery', 'bundle')),
    CONSTRAINT valid_season CHECK (season IS NULL OR season IN ('spring', 'summer', 'autumn', 'winter')),
    CONSTRAINT positive_price CHECK (price_cents >= 0)
);

-- Indexes for store_products
CREATE INDEX idx_store_products_slug ON store_products(slug);
CREATE INDEX idx_store_products_category_id ON store_products(category_id);
CREATE INDEX idx_store_products_product_type ON store_products(product_type);
CREATE INDEX idx_store_products_active ON store_products(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_store_products_sold ON store_products(is_sold);
CREATE INDEX idx_store_products_featured ON store_products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_store_products_tags ON store_products USING GIN(tags);
CREATE INDEX idx_store_products_created_at ON store_products(created_at DESC);
CREATE INDEX idx_store_products_price ON store_products(price_cents);
CREATE INDEX idx_store_products_country ON store_products(country) WHERE country IS NOT NULL;
CREATE INDEX idx_store_products_season ON store_products(season) WHERE season IS NOT NULL;

-- Composite index for common listing queries
CREATE INDEX idx_store_products_listing ON store_products(is_active, is_sold, created_at DESC)
    WHERE is_active = TRUE AND is_sold = FALSE;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION trigger_update_store_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_store_product_timestamp
    BEFORE UPDATE ON store_products
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_store_product_timestamp();

-- Comments
COMMENT ON TABLE store_products IS 'Products for sale - single images, galleries, or bundles with rich metadata';
COMMENT ON COLUMN store_products.price_cents IS 'Product price in cents (e.g., 1999 = $19.99)';
COMMENT ON COLUMN store_products.product_type IS 'Type of product: single_image, gallery, or bundle';
COMMENT ON COLUMN store_products.is_sold IS 'Whether the product has been sold (for exclusive items)';
COMMENT ON COLUMN store_products.tags IS 'Array of tags for search and filtering';

-- ============================================================================
-- TABLE 3: store_product_items
-- Links images and galleries to products
-- ============================================================================

CREATE TABLE store_product_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Product reference
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,

    -- Item type: picture or gallery
    item_type VARCHAR(32) NOT NULL,

    -- Reference to picture or gallery (one must be set based on item_type)
    picture_id BIGINT REFERENCES pictures(id) ON DELETE CASCADE,
    gallery_id BIGINT REFERENCES galleries(id) ON DELETE CASCADE,

    -- Display order within product
    display_order INT NOT NULL DEFAULT 0,

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_item_type CHECK (item_type IN ('picture', 'gallery')),
    CONSTRAINT check_item_reference CHECK (
        (item_type = 'picture' AND picture_id IS NOT NULL AND gallery_id IS NULL) OR
        (item_type = 'gallery' AND gallery_id IS NOT NULL AND picture_id IS NULL)
    ),
    CONSTRAINT uq_product_picture UNIQUE (product_id, picture_id),
    CONSTRAINT uq_product_gallery UNIQUE (product_id, gallery_id)
);

-- Indexes for store_product_items
CREATE INDEX idx_store_product_items_product_id ON store_product_items(product_id);
CREATE INDEX idx_store_product_items_picture_id ON store_product_items(picture_id) WHERE picture_id IS NOT NULL;
CREATE INDEX idx_store_product_items_gallery_id ON store_product_items(gallery_id) WHERE gallery_id IS NOT NULL;
CREATE INDEX idx_store_product_items_display_order ON store_product_items(product_id, display_order);

-- Comments
COMMENT ON TABLE store_product_items IS 'Links pictures or galleries to products';
COMMENT ON COLUMN store_product_items.item_type IS 'Type of item: picture or gallery';
COMMENT ON COLUMN store_product_items.picture_id IS 'Reference to pictures table (when item_type = picture)';
COMMENT ON COLUMN store_product_items.gallery_id IS 'Reference to galleries table (when item_type = gallery)';

-- ============================================================================
-- TABLE 4: store_purchases
-- Records of completed purchases
-- ============================================================================

CREATE TABLE store_purchases (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- References
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,

    -- Payment details
    amount_cents BIGINT NOT NULL,
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),

    -- Status: pending, completed, failed, refunded
    status VARCHAR(32) NOT NULL DEFAULT 'pending',

    -- License type
    license_type VARCHAR(50) NOT NULL DEFAULT 'standard',

    -- Timestamps
    purchased_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_purchase_status CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    CONSTRAINT uq_user_product_purchase UNIQUE (user_id, product_id)
);

-- Indexes for store_purchases
CREATE INDEX idx_store_purchases_user_id ON store_purchases(user_id);
CREATE INDEX idx_store_purchases_product_id ON store_purchases(product_id);
CREATE INDEX idx_store_purchases_status ON store_purchases(status);
CREATE INDEX idx_store_purchases_stripe_session ON store_purchases(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX idx_store_purchases_stripe_intent ON store_purchases(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX idx_store_purchases_created_at ON store_purchases(created_at DESC);
CREATE INDEX idx_store_purchases_purchased_at ON store_purchases(purchased_at DESC) WHERE purchased_at IS NOT NULL;

-- Composite index for user purchase history
CREATE INDEX idx_store_purchases_user_completed ON store_purchases(user_id, purchased_at DESC)
    WHERE status = 'completed';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION trigger_update_store_purchase_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_store_purchase_timestamp
    BEFORE UPDATE ON store_purchases
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_store_purchase_timestamp();

-- Comments
COMMENT ON TABLE store_purchases IS 'Records of user purchases';
COMMENT ON COLUMN store_purchases.amount_cents IS 'Amount paid in cents at time of purchase';
COMMENT ON COLUMN store_purchases.status IS 'Purchase status: pending, completed, failed, refunded';
COMMENT ON COLUMN store_purchases.license_type IS 'Type of license granted: standard, extended, exclusive';
COMMENT ON CONSTRAINT uq_user_product_purchase ON store_purchases IS 'User can only purchase a product once';

-- ============================================================================
-- TABLE 5: store_downloads
-- Track download activity
-- ============================================================================

CREATE TABLE store_downloads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- References
    purchase_id BIGINT NOT NULL REFERENCES store_purchases(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    picture_id BIGINT NOT NULL REFERENCES pictures(id) ON DELETE CASCADE,

    -- Download tracking
    download_count INT NOT NULL DEFAULT 1,
    first_downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_purchase_picture_download UNIQUE (purchase_id, picture_id)
);

-- Indexes for store_downloads
CREATE INDEX idx_store_downloads_purchase_id ON store_downloads(purchase_id);
CREATE INDEX idx_store_downloads_user_id ON store_downloads(user_id);
CREATE INDEX idx_store_downloads_picture_id ON store_downloads(picture_id);
CREATE INDEX idx_store_downloads_last_downloaded ON store_downloads(last_downloaded_at DESC);

-- Comments
COMMENT ON TABLE store_downloads IS 'Tracks download activity for purchased images';
COMMENT ON COLUMN store_downloads.download_count IS 'Number of times the image has been downloaded';
COMMENT ON COLUMN store_downloads.first_downloaded_at IS 'Timestamp of first download';
COMMENT ON COLUMN store_downloads.last_downloaded_at IS 'Timestamp of most recent download';
