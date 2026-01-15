-- OAuth Redirect URIs (allowed callback URLs)
CREATE TABLE IF NOT EXISTS oauth_redirect_uris (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    redirect_uri VARCHAR(500) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_redirect_uris_client_id ON oauth_redirect_uris(client_id);
CREATE UNIQUE INDEX idx_oauth_redirect_uris_unique ON oauth_redirect_uris(client_id, redirect_uri);
