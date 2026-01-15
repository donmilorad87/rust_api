-- OAuth Client Enabled APIs (M:N junction table)
CREATE TABLE IF NOT EXISTS oauth_client_enabled_apis (
    client_id BIGINT NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    api_product_id BIGINT NOT NULL REFERENCES oauth_api_products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (client_id, api_product_id)
);

CREATE INDEX idx_oauth_client_enabled_apis_client_id ON oauth_client_enabled_apis(client_id);
CREATE INDEX idx_oauth_client_enabled_apis_api_product_id ON oauth_client_enabled_apis(api_product_id);
