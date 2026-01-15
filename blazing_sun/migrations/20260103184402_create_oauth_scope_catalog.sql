-- OAuth Scope Catalog (available scopes)
CREATE TABLE IF NOT EXISTS oauth_scope_catalog (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scope_name VARCHAR(100) UNIQUE NOT NULL,
    scope_description VARCHAR(500) NOT NULL,
    sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_scope_catalog_scope_name ON oauth_scope_catalog(scope_name);
CREATE INDEX idx_oauth_scope_catalog_sensitive ON oauth_scope_catalog(sensitive);

-- Insert core scopes
INSERT INTO oauth_scope_catalog (scope_name, scope_description, sensitive) VALUES
    ('galleries.read', 'View your galleries and pictures', FALSE),
    ('galleries.write', 'Create and edit galleries and pictures', FALSE),
    ('galleries.delete', 'Delete galleries and pictures', TRUE),
    ('galleries.reorder', 'Reorder pictures in galleries', FALSE),
    ('offline_access', 'Maintain access when you''re not present', TRUE);
