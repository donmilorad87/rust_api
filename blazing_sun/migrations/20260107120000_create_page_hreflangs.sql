CREATE TABLE IF NOT EXISTS page_hreflangs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    page_seo_id BIGINT NOT NULL REFERENCES page_seo(id) ON DELETE CASCADE,
    lang_code VARCHAR(20) NOT NULL,
    href TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (page_seo_id, lang_code)
);

CREATE INDEX IF NOT EXISTS page_hreflangs_page_seo_id_idx
    ON page_hreflangs (page_seo_id);
