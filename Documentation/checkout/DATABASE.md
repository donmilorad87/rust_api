# Checkout Database Schema

This document describes the database schema for the checkout service.

## Database Overview

The checkout service uses its own PostgreSQL database separate from the main application.

| Database | Host | Port | Purpose |
|----------|------|------|---------|
| `checkout` | `checkout-postgres` | 5433 | Checkout transactions |
| `blazing_sun` | `postgres` | 5432 | Main application (users table) |

## Connection Details

```env
# Checkout database
CHECKOUT_DATABASE_URL=postgres://checkout:checkout_secret_password@checkout-postgres:5433/checkout

# Main database (for reference)
DATABASE_URL=postgres://app:app@postgres:5432/blazing_sun
```

## Schema: `checkout_transactions`

**Migration:** `checkout/migrations/20260115000000_create_checkout_transactions.sql`

```sql
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkout_transactions_user_id
    ON checkout_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_checkout_transactions_status
    ON checkout_transactions(status);

CREATE INDEX IF NOT EXISTS idx_checkout_transactions_session_id
    ON checkout_transactions(stripe_session_id);
```

## Column Definitions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| `request_id` | TEXT | NOT NULL, UNIQUE | UUID for idempotency |
| `user_id` | BIGINT | NOT NULL | User who made payment |
| `amount_cents` | BIGINT | NOT NULL, CHECK > 0 | Amount in cents |
| `currency` | VARCHAR(10) | NOT NULL | Currency code (e.g., "eur") |
| `purpose` | VARCHAR(100) | NOT NULL | Payment purpose |
| `stripe_session_id` | VARCHAR(255) | - | Stripe checkout session ID |
| `stripe_session_url` | TEXT | - | Stripe checkout URL |
| `payment_intent_id` | VARCHAR(255) | - | Stripe payment intent ID |
| `status` | VARCHAR(32) | NOT NULL | Transaction status |
| `error_message` | TEXT | - | Error details if failed |
| `metadata` | JSONB | NOT NULL, DEFAULT '{}' | Additional metadata |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation time |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update time |
| `completed_at` | TIMESTAMPTZ | - | Payment completion time |

## Status Values

| Status | Description | When Set |
|--------|-------------|----------|
| `session_created` | Stripe session created, awaiting payment | After Stripe session creation |
| `session_failed` | Failed to create Stripe session | If Stripe API returns error |
| `payment_succeeded` | Payment completed successfully | After successful webhook |
| `payment_failed` | Payment failed | After failed webhook |

## Database Operations

**Location:** `checkout/src/db.rs`

### Upsert Session Created

```rust
// db.rs:37-87
pub async fn upsert_session_created(
    pool: &PgPool,
    request_id: &str,
    user_id: i64,
    amount_cents: i64,
    currency: &str,
    purpose: &str,
    session_id: &str,
    session_url: Option<&str>,
    metadata: &Value,
) -> Result<(), sqlx::Error>
```

### Mark Payment Succeeded

```rust
// db.rs:136-190
pub async fn mark_payment_succeeded(
    pool: &PgPool,
    request_id: &str,
    user_id: i64,
    amount_cents: i64,
    currency: &str,
    purpose: &str,
    session_id: &str,
    payment_intent_id: Option<&str>,
    metadata: &Value,
) -> Result<bool, sqlx::Error>
```

**Returns:** `true` if the row was updated (event should be emitted), `false` if already processed.

### Idempotency Check

The `mark_payment_succeeded` function uses a conditional upsert to prevent duplicate processing:

```sql
INSERT INTO checkout_transactions (...)
VALUES (...)
ON CONFLICT (request_id) DO UPDATE
SET status = 'payment_succeeded', ...
WHERE checkout_transactions.status NOT IN ('payment_succeeded', 'payment_failed')
RETURNING id
```

This ensures:
- First webhook creates/updates the record and returns ID
- Duplicate webhooks match the `ON CONFLICT` but fail the `WHERE` clause
- Return value indicates if event should be published

## User Balance (Main Database)

**Location:** `blazing_sun/migrations/` and `blazing_sun/src/app/db_query/mutations/user/mod.rs`

The user's balance is stored in the `users` table in the main database:

```sql
-- In blazing_sun database
ALTER TABLE users ADD COLUMN balance BIGINT NOT NULL DEFAULT 0;
```

### Balance Update Query

**Location:** `blazing_sun/src/app/db_query/mutations/user/mod.rs`

```rust
pub async fn add_balance(
    pool: &Pool<Postgres>,
    user_id: i64,
    amount_cents: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE users SET balance = balance + $1 WHERE id = $2")
        .bind(amount_cents)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}
```

## Querying Transactions

### Fetch User Transactions

**Location:** `checkout/src/db.rs:247-299`

```rust
pub async fn fetch_transactions_by_user(
    pool: &PgPool,
    user_id: i64,
    limit: i64,
    offset: i64,
) -> Result<Vec<CheckoutTransaction>, sqlx::Error>
```

### SQL Query

```sql
SELECT
    request_id, user_id, amount_cents, currency, purpose,
    status, stripe_session_id, payment_intent_id, error_message,
    created_at, updated_at, completed_at
FROM checkout_transactions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3
```

## Database Access

### pgAdmin for Checkout DB

- **URL:** http://localhost:5051/pgadmin_checkout
- **Email:** `admin@checkout.local`
- **Password:** (from `.env`)

### Direct CLI Access

```bash
# Connect to checkout database
docker compose exec checkout-postgres psql -U checkout -d checkout

# List transactions
SELECT request_id, user_id, amount_cents, status, created_at
FROM checkout_transactions
ORDER BY created_at DESC
LIMIT 10;

# Check a specific transaction
SELECT * FROM checkout_transactions
WHERE request_id = 'your-request-id';
```

### Main Database Balance Check

```bash
# Connect to main database
docker compose exec postgres psql -U app -d blazing_sun

# Check user balance
SELECT id, email, balance FROM users WHERE id = 123;
```

## Metadata Examples

The `metadata` JSONB column stores additional information:

```json
{
  "coins": 5,
  "balance_cents": 500,
  "product_name": "Coins",
  "description": "Account top-up",
  "source": "balance"
}
```

## Data Flow

```
1. Stripe Session Created
   ├── checkout_transactions.status = 'session_created'
   └── checkout_transactions.stripe_session_url = Stripe URL

2. Payment Succeeded (Webhook)
   ├── checkout_transactions.status = 'payment_succeeded'
   ├── checkout_transactions.payment_intent_id = Stripe PI
   ├── checkout_transactions.completed_at = NOW()
   └── Kafka event → users.balance += amount_cents

3. Payment Failed (Webhook)
   ├── checkout_transactions.status = 'payment_failed'
   ├── checkout_transactions.error_message = reason
   └── checkout_transactions.completed_at = NOW()
```
