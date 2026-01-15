CREATE TABLE IF NOT EXISTS schema_types (
    name TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    is_data_type BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_type_parents (
    type_name TEXT NOT NULL,
    parent_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (type_name, parent_name),
    FOREIGN KEY (type_name) REFERENCES schema_types (name) ON DELETE CASCADE,
    FOREIGN KEY (parent_name) REFERENCES schema_types (name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schema_type_parents_parent
    ON schema_type_parents (parent_name);

CREATE TABLE IF NOT EXISTS schema_properties (
    name TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_type_properties (
    type_name TEXT NOT NULL,
    property_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (type_name, property_name),
    FOREIGN KEY (type_name) REFERENCES schema_types (name) ON DELETE CASCADE,
    FOREIGN KEY (property_name) REFERENCES schema_properties (name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schema_type_properties_property
    ON schema_type_properties (property_name);

CREATE TABLE IF NOT EXISTS schema_property_expected_types (
    property_name TEXT NOT NULL,
    expected_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (property_name, expected_type),
    FOREIGN KEY (property_name) REFERENCES schema_properties (name) ON DELETE CASCADE,
    FOREIGN KEY (expected_type) REFERENCES schema_types (name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schema_property_expected_types_property
    ON schema_property_expected_types (property_name);
