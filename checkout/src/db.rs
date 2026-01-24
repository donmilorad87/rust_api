use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use sqlx::types::Json;
use sqlx::Row;
use sqlx::PgPool;

#[derive(Debug, Serialize)]
pub struct CheckoutTransaction {
    pub request_id: String,
    pub user_id: i64,
    pub amount_cents: i64,
    pub currency: String,
    pub purpose: String,
    pub status: String,
    pub checkout_id: Option<String>,
    pub payment_intent_id: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

pub async fn connect(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}

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
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO checkout_transactions (
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            stripe_session_id,
            stripe_session_url,
            status,
            metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'session_created', $8)
        ON CONFLICT (request_id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            amount_cents = EXCLUDED.amount_cents,
            currency = EXCLUDED.currency,
            purpose = EXCLUDED.purpose,
            stripe_session_id = EXCLUDED.stripe_session_id,
            stripe_session_url = EXCLUDED.stripe_session_url,
            status = 'session_created',
            metadata = EXCLUDED.metadata,
            error_message = NULL,
            updated_at = NOW()
        "#,
    )
    .bind(request_id)
    .bind(user_id)
    .bind(amount_cents)
    .bind(currency)
    .bind(purpose)
    .bind(session_id)
    .bind(session_url)
    .bind(Json(metadata.clone()))
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn upsert_session_failed(
    pool: &PgPool,
    request_id: &str,
    user_id: i64,
    amount_cents: i64,
    currency: &str,
    purpose: &str,
    error_message: &str,
    metadata: &Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO checkout_transactions (
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            status,
            error_message,
            metadata
        )
        VALUES ($1, $2, $3, $4, $5, 'session_failed', $6, $7)
        ON CONFLICT (request_id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            amount_cents = EXCLUDED.amount_cents,
            currency = EXCLUDED.currency,
            purpose = EXCLUDED.purpose,
            status = 'session_failed',
            error_message = EXCLUDED.error_message,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        "#,
    )
    .bind(request_id)
    .bind(user_id)
    .bind(amount_cents)
    .bind(currency)
    .bind(purpose)
    .bind(error_message)
    .bind(Json(metadata.clone()))
    .execute(pool)
    .await?;

    Ok(())
}

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
) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO checkout_transactions (
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            stripe_session_id,
            payment_intent_id,
            status,
            metadata,
            completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'payment_succeeded', $8, NOW())
        ON CONFLICT (request_id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            amount_cents = EXCLUDED.amount_cents,
            currency = EXCLUDED.currency,
            purpose = EXCLUDED.purpose,
            stripe_session_id = EXCLUDED.stripe_session_id,
            payment_intent_id = EXCLUDED.payment_intent_id,
            status = 'payment_succeeded',
            metadata = EXCLUDED.metadata,
            error_message = NULL,
            updated_at = NOW(),
            completed_at = NOW()
        WHERE checkout_transactions.status NOT IN ('payment_succeeded', 'payment_failed')
        RETURNING id
        "#,
    )
    .bind(request_id)
    .bind(user_id)
    .bind(amount_cents)
    .bind(currency)
    .bind(purpose)
    .bind(session_id)
    .bind(payment_intent_id)
    .bind(Json(metadata.clone()))
    .fetch_optional(pool)
    .await?;

    Ok(row.is_some())
}

pub async fn mark_payment_failed(
    pool: &PgPool,
    request_id: &str,
    user_id: i64,
    amount_cents: i64,
    currency: &str,
    purpose: &str,
    session_id: Option<&str>,
    error_message: &str,
    metadata: &Value,
) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO checkout_transactions (
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            stripe_session_id,
            status,
            error_message,
            metadata,
            completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'payment_failed', $7, $8, NOW())
        ON CONFLICT (request_id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            amount_cents = EXCLUDED.amount_cents,
            currency = EXCLUDED.currency,
            purpose = EXCLUDED.purpose,
            stripe_session_id = EXCLUDED.stripe_session_id,
            status = 'payment_failed',
            error_message = EXCLUDED.error_message,
            metadata = EXCLUDED.metadata,
            updated_at = NOW(),
            completed_at = NOW()
        WHERE checkout_transactions.status <> 'payment_succeeded'
        RETURNING id
        "#,
    )
    .bind(request_id)
    .bind(user_id)
    .bind(amount_cents)
    .bind(currency)
    .bind(purpose)
    .bind(session_id)
    .bind(error_message)
    .bind(Json(metadata.clone()))
    .fetch_optional(pool)
    .await?;

    Ok(row.is_some())
}

pub async fn fetch_transactions_by_user(
    pool: &PgPool,
    user_id: i64,
    limit: i64,
    offset: i64,
) -> Result<Vec<CheckoutTransaction>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            status,
            stripe_session_id,
            payment_intent_id,
            error_message,
            created_at,
            updated_at,
            completed_at
        FROM checkout_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    let mut transactions = Vec::with_capacity(rows.len());
    for row in rows {
        transactions.push(CheckoutTransaction {
            request_id: row.try_get("request_id")?,
            user_id: row.try_get("user_id")?,
            amount_cents: row.try_get("amount_cents")?,
            currency: row.try_get("currency")?,
            purpose: row.try_get("purpose")?,
            status: row.try_get("status")?,
            checkout_id: row.try_get("stripe_session_id")?,
            payment_intent_id: row.try_get("payment_intent_id")?,
            error_message: row.try_get("error_message")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            completed_at: row.try_get("completed_at")?,
        });
    }

    Ok(transactions)
}

/// Create a Bigger Dice participation transaction (deduction from balance for playing)
/// Amount is negative (expense), completed immediately with status 'game_participation'
pub async fn create_bigger_dice_participation(
    pool: &PgPool,
    request_id: &str,
    user_id: i64,
    amount_cents: i64,
    room_id: &str,
    room_name: &str,
    metadata: &Value,
) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO checkout_transactions (
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            status,
            metadata,
            completed_at
        )
        VALUES ($1, $2, $3, 'eur', 'PAY BIGGER DICE GAME', 'game_participation', $4, NOW())
        ON CONFLICT (request_id) DO NOTHING
        RETURNING id
        "#,
    )
    .bind(request_id)
    .bind(user_id)
    .bind(amount_cents)
    .bind(Json(serde_json::json!({
        "game_type": "bigger_dice",
        "room_id": room_id,
        "room_name": room_name,
        "original_metadata": metadata,
    })))
    .fetch_optional(pool)
    .await?;

    Ok(row.is_some())
}

/// Create a Bigger Dice prize win transaction (credit to winner's balance)
/// Amount is positive (income), completed immediately with status 'game_prize_won'
pub async fn create_bigger_dice_prize_win(
    pool: &PgPool,
    request_id: &str,
    user_id: i64,
    amount_cents: i64,
    room_id: &str,
    room_name: &str,
    metadata: &Value,
) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO checkout_transactions (
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            status,
            metadata,
            completed_at
        )
        VALUES ($1, $2, $3, 'eur', 'BIGGER DICE GAME PRIZE WIN', 'game_prize_won', $4, NOW())
        ON CONFLICT (request_id) DO NOTHING
        RETURNING id
        "#,
    )
    .bind(request_id)
    .bind(user_id)
    .bind(amount_cents)
    .bind(Json(serde_json::json!({
        "game_type": "bigger_dice",
        "room_id": room_id,
        "room_name": room_name,
        "original_metadata": metadata,
    })))
    .fetch_optional(pool)
    .await?;

    Ok(row.is_some())
}

/// Create a Tic Tac Toe participation transaction (deduction from balance for playing)
/// Amount is negative (expense), completed immediately with status 'game_participation'
pub async fn create_tic_tac_toe_participation(
    pool: &PgPool,
    request_id: &str,
    user_id: i64,
    amount_cents: i64,
    room_id: &str,
    room_name: &str,
    metadata: &Value,
) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO checkout_transactions (
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            status,
            metadata,
            completed_at
        )
        VALUES ($1, $2, $3, 'eur', 'PAY TIC TAC TOE GAME', 'game_participation', $4, NOW())
        ON CONFLICT (request_id) DO NOTHING
        RETURNING id
        "#,
    )
    .bind(request_id)
    .bind(user_id)
    .bind(amount_cents)
    .bind(Json(serde_json::json!({
        "game_type": "tic_tac_toe",
        "room_id": room_id,
        "room_name": room_name,
        "original_metadata": metadata,
    })))
    .fetch_optional(pool)
    .await?;

    Ok(row.is_some())
}

/// Create a Tic Tac Toe prize win transaction (credit to winner's balance)
/// Amount is positive (income), completed immediately with status 'game_prize_won'
pub async fn create_tic_tac_toe_prize_win(
    pool: &PgPool,
    request_id: &str,
    user_id: i64,
    amount_cents: i64,
    room_id: &str,
    room_name: &str,
    metadata: &Value,
) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(
        r#"
        INSERT INTO checkout_transactions (
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            status,
            metadata,
            completed_at
        )
        VALUES ($1, $2, $3, 'eur', 'TIC TAC TOE GAME PRIZE WIN', 'game_prize_won', $4, NOW())
        ON CONFLICT (request_id) DO NOTHING
        RETURNING id
        "#,
    )
    .bind(request_id)
    .bind(user_id)
    .bind(amount_cents)
    .bind(Json(serde_json::json!({
        "game_type": "tic_tac_toe",
        "room_id": room_id,
        "room_name": room_name,
        "original_metadata": metadata,
    })))
    .fetch_optional(pool)
    .await?;

    Ok(row.is_some())
}
