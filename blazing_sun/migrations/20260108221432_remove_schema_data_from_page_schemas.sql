-- Remove schema_data column from page_schemas
-- All schema data now comes from schema_entities via entity_schema_id FK relationship

ALTER TABLE page_schemas DROP COLUMN IF EXISTS schema_data;
