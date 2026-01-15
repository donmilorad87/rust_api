-- Backfill gallery_type for existing geo galleries

UPDATE galleries
SET gallery_type = 'geo_galleries'
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL;
