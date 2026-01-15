-- Create geo places (restaurants, cafes, lodgings)

CREATE TABLE IF NOT EXISTS geo_places (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    place_type VARCHAR(20) NOT NULL
        CHECK (place_type IN ('restaurant', 'cafe', 'lodging')),
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL
        CHECK (latitude >= -90 AND latitude <= 90),
    longitude DOUBLE PRECISION NOT NULL
        CHECK (longitude >= -180 AND longitude <= 180),
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_places_type ON geo_places(place_type);
CREATE INDEX IF NOT EXISTS idx_geo_places_location ON geo_places(latitude, longitude);

CREATE OR REPLACE FUNCTION update_geo_places_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_geo_places_updated_at ON geo_places;
CREATE TRIGGER trigger_geo_places_updated_at
    BEFORE UPDATE ON geo_places
    FOR EACH ROW
    EXECUTE FUNCTION update_geo_places_updated_at();

COMMENT ON TABLE geo_places IS 'Admin-managed restaurants, cafes, and lodgings for geo galleries map';
COMMENT ON COLUMN geo_places.place_type IS 'Type of place: restaurant, cafe, lodging';
