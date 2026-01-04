-- OAuth Consent Grants (user approvals for client/scope combinations)
CREATE TABLE IF NOT EXISTS oauth_consent_grants (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id BIGINT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    granted_scopes TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_consent_grants_user_id ON oauth_consent_grants(user_id);
CREATE INDEX idx_oauth_consent_grants_client_id ON oauth_consent_grants(client_id);
CREATE UNIQUE INDEX idx_oauth_consent_grants_unique ON oauth_consent_grants(user_id, client_id) WHERE is_active = TRUE;
