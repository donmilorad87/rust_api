-- OAuth Client Secrets (hashed for confidential clients)
CREATE TABLE IF NOT EXISTS oauth_client_secrets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_id BIGINT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    secret_hash VARCHAR(255) NOT NULL,
    secret_hint VARCHAR(10) NOT NULL,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_client_secrets_client_id ON oauth_client_secrets(client_id);
CREATE INDEX idx_oauth_client_secrets_is_active ON oauth_client_secrets(is_active);
