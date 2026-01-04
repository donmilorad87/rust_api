-- OAuth Authorized Domains (allowed JavaScript origins)
CREATE TABLE IF NOT EXISTS oauth_authorized_domains (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_authorized_domains_client_id ON oauth_authorized_domains(client_id);
CREATE UNIQUE INDEX idx_oauth_authorized_domains_unique ON oauth_authorized_domains(client_id, domain);
