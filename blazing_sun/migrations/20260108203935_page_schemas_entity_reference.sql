-- Add entity_schema_id reference to page_schemas table
-- This creates a proper relationship between page_schemas and schema_entities
-- instead of duplicating schema_data

-- Add the entity_schema_id column to reference schema_entities
ALTER TABLE page_schemas
    ADD COLUMN IF NOT EXISTS entity_schema_id TEXT;

-- Add composite foreign key constraint with CASCADE delete
-- When a schema_entity is deleted, all page_schemas referencing it are also deleted
ALTER TABLE page_schemas
    DROP CONSTRAINT IF EXISTS page_schemas_entity_fk;

ALTER TABLE page_schemas
    ADD CONSTRAINT page_schemas_entity_fk
    FOREIGN KEY (lang_code, entity_schema_id)
    REFERENCES schema_entities (lang_code, schema_id)
    ON DELETE CASCADE;

-- Index for efficient lookups by entity_schema_id
CREATE INDEX IF NOT EXISTS idx_page_schemas_entity_schema_id
    ON page_schemas(entity_schema_id)
    WHERE entity_schema_id IS NOT NULL;

-- Migrate existing data: extract root @id from schema_data to populate entity_schema_id
UPDATE page_schemas
SET entity_schema_id = schema_data->>'@id'
WHERE schema_data->>'@id' IS NOT NULL
  AND entity_schema_id IS NULL;

-- Clear schema_data for rows that now have entity_schema_id
-- The schema_data will be fetched from schema_entities via JOIN
UPDATE page_schemas
SET schema_data = '{}'::jsonb
WHERE entity_schema_id IS NOT NULL
  AND schema_data != '{}'::jsonb;
