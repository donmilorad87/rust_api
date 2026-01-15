-- Add API Product relationship to OAuth Scope Catalog
-- This enables the Google Cloud Console approach where enabling an API auto-grants its scopes

-- Add api_product_id column to oauth_scope_catalog
ALTER TABLE oauth_scope_catalog
ADD COLUMN api_product_id BIGINT REFERENCES oauth_api_products(id) ON DELETE CASCADE;

-- Update existing scopes to link them to the Galleries API
-- Get the Galleries API product ID and assign all galleries.* scopes to it
UPDATE oauth_scope_catalog
SET api_product_id = (SELECT id FROM oauth_api_products WHERE product_key = 'galleries_api')
WHERE scope_name LIKE 'galleries.%';

-- offline_access is a special scope that doesn't belong to any specific API product
-- It remains with api_product_id = NULL

-- Create index for efficient querying of scopes by API product
CREATE INDEX idx_oauth_scope_catalog_api_product_id ON oauth_scope_catalog(api_product_id);

-- Add comment explaining nullable api_product_id
COMMENT ON COLUMN oauth_scope_catalog.api_product_id IS 'Links scope to API product. NULL for global scopes like offline_access.';
