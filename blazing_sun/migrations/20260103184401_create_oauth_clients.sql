-- OAuth Clients (Applications)
CREATE TABLE IF NOT EXISTS oauth_clients (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(64) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_type VARCHAR(20) NOT NULL CHECK (client_type IN ('public', 'confidential')),
    description TEXT,
    logo_url VARCHAR(500),
    homepage_url VARCHAR(500),
    privacy_policy_url VARCHAR(500),
    terms_of_service_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_clients_user_id ON oauth_clients(user_id);
CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);
