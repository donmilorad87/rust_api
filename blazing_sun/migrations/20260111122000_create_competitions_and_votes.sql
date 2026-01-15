-- Competitions, entries, admin votes, and gallery likes

CREATE TABLE IF NOT EXISTS competitions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    prize_cents BIGINT NOT NULL DEFAULT 10000 CHECK (prize_cents >= 0),
    rules TEXT NOT NULL,
    created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    winner_gallery_id BIGINT REFERENCES galleries(id) ON DELETE SET NULL,
    winner_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    awarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_competitions_dates CHECK (start_date < end_date)
);

CREATE INDEX IF NOT EXISTS idx_competitions_dates ON competitions(start_date, end_date);

CREATE OR REPLACE FUNCTION update_competitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_competitions_updated_at ON competitions;
CREATE TRIGGER trigger_competitions_updated_at
    BEFORE UPDATE ON competitions
    FOR EACH ROW
    EXECUTE FUNCTION update_competitions_updated_at();

CREATE TABLE IF NOT EXISTS competition_entries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    competition_id BIGINT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    gallery_id BIGINT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_competition_gallery UNIQUE (competition_id, gallery_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_entries_competition ON competition_entries(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_entries_gallery ON competition_entries(gallery_id);

CREATE TABLE IF NOT EXISTS competition_admin_votes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    competition_id BIGINT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    gallery_id BIGINT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    admin_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_competition_admin_vote UNIQUE (competition_id, gallery_id, admin_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_admin_votes_competition ON competition_admin_votes(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_admin_votes_gallery ON competition_admin_votes(gallery_id);

CREATE TABLE IF NOT EXISTS gallery_likes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    gallery_id BIGINT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_gallery_like UNIQUE (gallery_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gallery_likes_gallery ON gallery_likes(gallery_id);
