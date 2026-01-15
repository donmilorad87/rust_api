CREATE TABLE IF NOT EXISTS checkout_transactions (
    id BIGSERIAL PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency VARCHAR(10) NOT NULL,
    purpose VARCHAR(100) NOT NULL,
    stripe_session_id VARCHAR(255),
    stripe_session_url TEXT,
    payment_intent_id VARCHAR(255),
    status VARCHAR(32) NOT NULL,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_checkout_transactions_user_id
    ON checkout_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_checkout_transactions_status
    ON checkout_transactions(status);

CREATE INDEX IF NOT EXISTS idx_checkout_transactions_session_id
    ON checkout_transactions(stripe_session_id);
