CREATE TABLE IF NOT EXISTS schema_entities (
    id BIGSERIAL PRIMARY KEY,
    schema_id TEXT NOT NULL,
    lang_code VARCHAR(10) NOT NULL DEFAULT 'en',
    schema_type TEXT NOT NULL,
    schema_data JSONB NOT NULL,
    schema_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS schema_entities_lang_schema_id_unique
    ON schema_entities (lang_code, schema_id);

CREATE UNIQUE INDEX IF NOT EXISTS schema_entities_lang_type_hash_unique
    ON schema_entities (lang_code, schema_type, schema_hash);

CREATE TABLE IF NOT EXISTS entity_relations (
    id BIGSERIAL PRIMARY KEY,
    lang_code VARCHAR(10) NOT NULL DEFAULT 'en',
    from_schema_id TEXT NOT NULL,
    property TEXT NOT NULL,
    to_schema_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS entity_relations_lang_unique
    ON entity_relations (lang_code, from_schema_id, property, to_schema_id);

ALTER TABLE entity_relations
    ADD CONSTRAINT entity_relations_from_fk
    FOREIGN KEY (lang_code, from_schema_id)
    REFERENCES schema_entities (lang_code, schema_id)
    ON DELETE CASCADE;

ALTER TABLE entity_relations
    ADD CONSTRAINT entity_relations_to_fk
    FOREIGN KEY (lang_code, to_schema_id)
    REFERENCES schema_entities (lang_code, schema_id)
    ON DELETE CASCADE;
