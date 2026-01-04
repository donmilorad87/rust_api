-- OAuth Client Allowed Scopes (M:N junction table)
CREATE TABLE IF NOT EXISTS oauth_client_allowed_scopes (
    client_id BIGINT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    scope_id BIGINT NOT NULL REFERENCES oauth_scope_catalog(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (client_id, scope_id)
);

CREATE INDEX idx_oauth_client_allowed_scopes_client_id ON oauth_client_allowed_scopes(client_id);
CREATE INDEX idx_oauth_client_allowed_scopes_scope_id ON oauth_client_allowed_scopes(scope_id);
