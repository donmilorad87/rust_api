-- OAuth API Products (bundles of APIs and scopes)
CREATE TABLE IF NOT EXISTS oauth_api_products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_key VARCHAR(50) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    product_description TEXT NOT NULL,
    icon_url VARCHAR(500),
    documentation_url VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_api_products_product_key ON oauth_api_products(product_key);
CREATE INDEX idx_oauth_api_products_is_active ON oauth_api_products(is_active);

-- Insert Galleries API product
INSERT INTO oauth_api_products (product_key, product_name, product_description, is_active) VALUES
    ('galleries_api', 'Galleries API', 'Access to create, read, update, and delete user galleries and pictures', TRUE);
