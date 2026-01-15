-- Localization system tables: languages, locales, keys, translations

CREATE TABLE IF NOT EXISTS languages (
    id BIGSERIAL PRIMARY KEY,
    native_name VARCHAR(100) NOT NULL,
    iso2 VARCHAR(2) NOT NULL UNIQUE,
    iso3 VARCHAR(3) NOT NULL UNIQUE,
    icon_uuid UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locales (
    id BIGSERIAL PRIMARY KEY,
    language_id BIGINT NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
    locale_code VARCHAR(10) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_locales_language_id ON locales(language_id);

CREATE TABLE IF NOT EXISTS localization_keys (
    id BIGSERIAL PRIMARY KEY,
    key VARCHAR(120) NOT NULL UNIQUE,
    context TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS localization_translations (
    id BIGSERIAL PRIMARY KEY,
    localization_key_id BIGINT NOT NULL REFERENCES localization_keys(id) ON DELETE CASCADE,
    locale_id BIGINT NOT NULL REFERENCES locales(id) ON DELETE CASCADE,
    singular TEXT NOT NULL,
    plural TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (localization_key_id, locale_id)
);

CREATE INDEX idx_localization_translations_key_id ON localization_translations(localization_key_id);
CREATE INDEX idx_localization_translations_locale_id ON localization_translations(locale_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION update_languages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_languages_updated_at ON languages;
CREATE TRIGGER trigger_languages_updated_at
BEFORE UPDATE ON languages
FOR EACH ROW
EXECUTE FUNCTION update_languages_updated_at();

CREATE OR REPLACE FUNCTION update_locales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_locales_updated_at ON locales;
CREATE TRIGGER trigger_locales_updated_at
BEFORE UPDATE ON locales
FOR EACH ROW
EXECUTE FUNCTION update_locales_updated_at();

CREATE OR REPLACE FUNCTION update_localization_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_localization_keys_updated_at ON localization_keys;
CREATE TRIGGER trigger_localization_keys_updated_at
BEFORE UPDATE ON localization_keys
FOR EACH ROW
EXECUTE FUNCTION update_localization_keys_updated_at();

CREATE OR REPLACE FUNCTION update_localization_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_localization_translations_updated_at ON localization_translations;
CREATE TRIGGER trigger_localization_translations_updated_at
BEFORE UPDATE ON localization_translations
FOR EACH ROW
EXECUTE FUNCTION update_localization_translations_updated_at();

COMMENT ON TABLE languages IS 'Base languages with ISO codes and icon';
COMMENT ON TABLE locales IS 'Locale variants for languages (e.g., en_US)';
COMMENT ON TABLE localization_keys IS 'Localization keys with translator context';
COMMENT ON TABLE localization_translations IS 'Per-locale translation values for localization keys';
