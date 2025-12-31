--
-- PostgreSQL Database Backup
-- Database: blazing_sun
-- Generated: 2025-12-30
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Sequences
--

CREATE SEQUENCE IF NOT EXISTS users_id_seq;
CREATE SEQUENCE IF NOT EXISTS categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS transactions_id_seq;
CREATE SEQUENCE IF NOT EXISTS activation_hashes_id_seq;
CREATE SEQUENCE IF NOT EXISTS uploads_id_seq;
CREATE SEQUENCE IF NOT EXISTS assets_id_seq;
CREATE SEQUENCE IF NOT EXISTS site_config_id_seq;

--
-- Table: _sqlx_migrations
--

CREATE TABLE IF NOT EXISTS _sqlx_migrations (
    version bigint NOT NULL PRIMARY KEY,
    description text NOT NULL,
    installed_on timestamp with time zone NOT NULL DEFAULT now(),
    success boolean NOT NULL,
    checksum bytea NOT NULL,
    execution_time bigint NOT NULL
);

--
-- Table: users
--

CREATE TABLE IF NOT EXISTS users (
    id bigint NOT NULL DEFAULT nextval('users_id_seq') PRIMARY KEY,
    email character varying NOT NULL UNIQUE,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    password character varying NOT NULL,
    balance bigint NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    activated smallint NOT NULL DEFAULT 0,
    verified smallint NOT NULL DEFAULT 0,
    two_factor smallint NOT NULL DEFAULT 0,
    user_must_set_password smallint NOT NULL DEFAULT 0,
    avatar_uuid uuid,
    permissions smallint NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_users_avatar_uuid ON users (avatar_uuid);
CREATE INDEX IF NOT EXISTS idx_users_permissions ON users (permissions);

--
-- Table: categories
--

CREATE TABLE IF NOT EXISTS categories (
    id bigint NOT NULL DEFAULT nextval('categories_id_seq') PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name character varying NOT NULL,
    description text,
    balance bigint NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name ON categories (name, user_id);

--
-- Table: transactions
--

CREATE TABLE IF NOT EXISTS transactions (
    id bigint NOT NULL DEFAULT nextval('transactions_id_seq') PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id bigint NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    type character varying NOT NULL,
    amount bigint NOT NULL,
    memo character varying NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at);

--
-- Table: activation_hashes
--

CREATE TABLE IF NOT EXISTS activation_hashes (
    id bigint NOT NULL DEFAULT nextval('activation_hashes_id_seq') PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hash character varying NOT NULL UNIQUE,
    hash_type character varying NOT NULL,
    expiry_time timestamp with time zone NOT NULL,
    used smallint NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activation_hashes_user_id ON activation_hashes (user_id);
CREATE INDEX IF NOT EXISTS idx_activation_hashes_hash ON activation_hashes (hash);
CREATE INDEX IF NOT EXISTS idx_activation_hashes_expiry ON activation_hashes (expiry_time);

--
-- Table: uploads
--

CREATE TABLE IF NOT EXISTS uploads (
    id bigint NOT NULL DEFAULT nextval('uploads_id_seq') PRIMARY KEY,
    uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    original_name character varying NOT NULL,
    stored_name character varying NOT NULL,
    extension character varying NOT NULL,
    mime_type character varying NOT NULL,
    size_bytes bigint NOT NULL,
    storage_type character varying NOT NULL,
    storage_path character varying NOT NULL,
    upload_status character varying NOT NULL DEFAULT 'completed',
    chunks_received integer DEFAULT 0,
    total_chunks integer DEFAULT 1,
    user_id bigint REFERENCES users(id) ON DELETE SET NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uploads_uuid ON uploads (uuid);
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads (user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_storage_type ON uploads (storage_type);
CREATE INDEX IF NOT EXISTS idx_uploads_upload_status ON uploads (upload_status);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads (created_at);

--
-- Table: assets
--

CREATE TABLE IF NOT EXISTS assets (
    id bigint NOT NULL DEFAULT nextval('assets_id_seq') PRIMARY KEY,
    uuid uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    title character varying,
    description text,
    category character varying,
    original_name character varying NOT NULL,
    stored_name character varying NOT NULL,
    extension character varying NOT NULL,
    mime_type character varying NOT NULL,
    size_bytes bigint NOT NULL,
    storage_type character varying NOT NULL,
    storage_path character varying NOT NULL,
    subfolder character varying,
    user_id bigint REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_uuid ON assets (uuid);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets (user_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets (category);
CREATE INDEX IF NOT EXISTS idx_assets_storage_type ON assets (storage_type);
CREATE INDEX IF NOT EXISTS idx_assets_subfolder ON assets (subfolder);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets (created_at);

--
-- Table: site_config
--

CREATE TABLE IF NOT EXISTS site_config (
    id bigint NOT NULL DEFAULT nextval('site_config_id_seq') PRIMARY KEY,
    site_name character varying NOT NULL DEFAULT 'Blazing Sun',
    site_description text,
    logo_uuid uuid REFERENCES uploads(uuid) ON DELETE SET NULL,
    favicon_uuid uuid REFERENCES uploads(uuid) ON DELETE SET NULL,
    scss_variables jsonb NOT NULL DEFAULT '{"radius_lg": "10px", "radius_md": "6px", "radius_sm": "5px", "spacing_lg": "1.5rem", "spacing_md": "1rem", "spacing_sm": "0.5rem", "spacing_xl": "2rem", "spacing_xs": "0.25rem", "font_size_lg": "1.125rem", "font_size_sm": "0.875rem", "font_size_xl": "1.375rem", "color_primary": "#667eea", "font_size_base": "1rem", "color_secondary": "#764ba2", "color_primary_dark": "#5a6fd6"}'::jsonb,
    theme_light jsonb NOT NULL DEFAULT '{"nav_bg": "rgba(255, 255, 255, 0.95)", "card_bg": "#ffffff", "input_bg": "#ffffff", "toggle_bg": "#f0f0f0", "link_color": "#667eea", "nav_shadow": "rgba(0, 0, 0, 0.1)", "text_muted": "#666666", "card_shadow": "rgba(0, 0, 0, 0.2)", "input_border": "#e0e0e0", "text_primary": "#333333", "toggle_border": "#dddddd", "text_secondary": "#555555", "bg_gradient_end": "#764ba2", "feature_card_bg": "#ffffff", "text_on_primary": "#ffffff", "bg_gradient_start": "#667eea", "feature_card_shadow": "rgba(0, 0, 0, 0.1)"}'::jsonb,
    theme_dark jsonb NOT NULL DEFAULT '{"nav_bg": "rgba(30, 30, 50, 0.98)", "card_bg": "#252542", "input_bg": "#1e1e36", "toggle_bg": "#2a2a4a", "link_color": "#8b9cff", "nav_shadow": "rgba(0, 0, 0, 0.4)", "text_muted": "#999999", "card_shadow": "rgba(0, 0, 0, 0.5)", "input_border": "#404060", "text_primary": "#e8e8e8", "toggle_border": "#404060", "text_secondary": "#c0c0c0", "bg_gradient_end": "#16213e", "feature_card_bg": "#252542", "text_on_primary": "#ffffff", "bg_gradient_start": "#1a1a2e", "feature_card_shadow": "rgba(0, 0, 0, 0.4)"}'::jsonb,
    last_build_at timestamp with time zone,
    last_build_status character varying DEFAULT 'pending',
    last_build_error text,
    assets_version character varying NOT NULL DEFAULT '1.0.0',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

--
-- Function: update_site_config_updated_at
--

CREATE OR REPLACE FUNCTION update_site_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

--
-- Trigger: site_config_updated_at
--

DROP TRIGGER IF EXISTS site_config_updated_at ON site_config;
CREATE TRIGGER site_config_updated_at
    BEFORE UPDATE ON site_config
    FOR EACH ROW
    EXECUTE FUNCTION update_site_config_updated_at();

--
-- Foreign key constraint: users.avatar_uuid -> uploads.uuid
--

ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_avatar_uuid;
ALTER TABLE users ADD CONSTRAINT fk_users_avatar_uuid FOREIGN KEY (avatar_uuid) REFERENCES uploads(uuid) ON DELETE SET NULL;

-- ============================================
-- DATA
-- ============================================

--
-- Data for: users
--

INSERT INTO users (id, email, first_name, last_name, password, balance, created_at, updated_at, activated, verified, two_factor, user_must_set_password, avatar_uuid, permissions)
VALUES (3, 'djmyle@gmail.com', 'Milorad', 'Đuković', '$2b$12$3c9tqdS6RZlzu1UNtuTXmuVW/5IVQW3SK92xhTy5M6BUp2ckmIk1K', 0, '2025-12-30 17:15:44.38+00', '2025-12-30 17:42:12.183+00', 1, 0, 0, 0, 'f5b4113f-1d1a-4df5-b2a0-a2528b54ea8f', 100)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    password = EXCLUDED.password,
    balance = EXCLUDED.balance,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    activated = EXCLUDED.activated,
    verified = EXCLUDED.verified,
    two_factor = EXCLUDED.two_factor,
    user_must_set_password = EXCLUDED.user_must_set_password,
    avatar_uuid = EXCLUDED.avatar_uuid,
    permissions = EXCLUDED.permissions;

--
-- Data for: uploads
--

INSERT INTO uploads (id, uuid, original_name, stored_name, extension, mime_type, size_bytes, storage_type, storage_path, upload_status, chunks_received, total_chunks, user_id, description, metadata, created_at, updated_at)
VALUES (1, 'f5b4113f-1d1a-4df5-b2a0-a2528b54ea8f', 'Nothing_silhouette.jpg', '20251230_171636_13f6241a-be42-40e9-be39-522a4e8f695b.jpg', 'jpg', 'image/jpeg', 27786, 'private', 'private/profile-pictures/20251230_171636_13f6241a-be42-40e9-be39-522a4e8f695b.jpg', 'completed', 0, 1, 3, 'profile-picture', '{}', '2025-12-30 17:16:36.285+00', '2025-12-30 17:16:36.285+00')
ON CONFLICT (id) DO UPDATE SET
    uuid = EXCLUDED.uuid,
    original_name = EXCLUDED.original_name,
    stored_name = EXCLUDED.stored_name,
    extension = EXCLUDED.extension,
    mime_type = EXCLUDED.mime_type,
    size_bytes = EXCLUDED.size_bytes,
    storage_type = EXCLUDED.storage_type,
    storage_path = EXCLUDED.storage_path,
    upload_status = EXCLUDED.upload_status,
    chunks_received = EXCLUDED.chunks_received,
    total_chunks = EXCLUDED.total_chunks,
    user_id = EXCLUDED.user_id,
    description = EXCLUDED.description,
    metadata = EXCLUDED.metadata,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

--
-- Data for: site_config
--

INSERT INTO site_config (id, site_name, site_description, logo_uuid, favicon_uuid, scss_variables, theme_light, theme_dark, last_build_at, last_build_status, last_build_error, assets_version, created_at, updated_at)
VALUES (1, 'Blazing Sun', NULL, NULL, NULL, '{"color-primary": "#ff5500"}', '{"bg-gradient-start": "#ff5500"}', '{"bg-gradient-start": "#2a2a3e"}', '2025-12-30 19:44:15.094+00', 'building', NULL, '1.0.0', '2025-12-30 18:12:47.466+00', '2025-12-30 20:23:12.933+00')
ON CONFLICT (id) DO UPDATE SET
    site_name = EXCLUDED.site_name,
    site_description = EXCLUDED.site_description,
    logo_uuid = EXCLUDED.logo_uuid,
    favicon_uuid = EXCLUDED.favicon_uuid,
    scss_variables = EXCLUDED.scss_variables,
    theme_light = EXCLUDED.theme_light,
    theme_dark = EXCLUDED.theme_dark,
    last_build_at = EXCLUDED.last_build_at,
    last_build_status = EXCLUDED.last_build_status,
    last_build_error = EXCLUDED.last_build_error,
    assets_version = EXCLUDED.assets_version,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at;

-- ============================================
-- SEQUENCE VALUES
-- ============================================

SELECT setval('users_id_seq', 3, true);
SELECT setval('activation_hashes_id_seq', 4, true);
SELECT setval('uploads_id_seq', 1, true);
SELECT setval('site_config_id_seq', 1, true);

--
-- End of backup
--
