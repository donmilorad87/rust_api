//! Store Purchase Mutation Queries
//!
//! Write operations for the store_purchases table.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};

/// Parameters for creating a new purchase
pub struct CreatePurchaseParams {
    pub user_id: i64,
    pub product_id: i64,
    pub amount_cents: i64,
    pub stripe_session_id: Option<String>,
    pub license_type: String,
}

/// Create a new purchase (pending status)
pub async fn create(db: &Pool<Postgres>, params: &CreatePurchaseParams) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO store_purchases (user_id, product_id, amount_cents, stripe_session_id, license_type, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING id
        "#,
        params.user_id,
        params.product_id,
        params.amount_cents,
        params.stripe_session_id,
        params.license_type
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Update purchase status
pub async fn update_status(
    db: &Pool<Postgres>,
    purchase_id: i64,
    status: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_purchases SET status = $1 WHERE id = $2"#,
        status,
        purchase_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Mark purchase as completed
pub async fn mark_completed(
    db: &Pool<Postgres>,
    purchase_id: i64,
    purchased_at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_purchases SET status = 'completed', purchased_at = $1 WHERE id = $2"#,
        purchased_at,
        purchase_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Mark purchase as completed with current timestamp
pub async fn mark_completed_now(db: &Pool<Postgres>, purchase_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_purchases SET status = 'completed', purchased_at = NOW() WHERE id = $1"#,
        purchase_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Mark purchase as failed
pub async fn mark_failed(db: &Pool<Postgres>, purchase_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_purchases SET status = 'failed' WHERE id = $1"#,
        purchase_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Mark purchase as refunded
pub async fn mark_refunded(db: &Pool<Postgres>, purchase_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_purchases SET status = 'refunded' WHERE id = $1"#,
        purchase_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update Stripe session ID
pub async fn update_stripe_session_id(
    db: &Pool<Postgres>,
    purchase_id: i64,
    stripe_session_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_purchases SET stripe_session_id = $1 WHERE id = $2"#,
        stripe_session_id,
        purchase_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update Stripe payment intent ID
pub async fn update_stripe_payment_intent_id(
    db: &Pool<Postgres>,
    purchase_id: i64,
    stripe_payment_intent_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE store_purchases SET stripe_payment_intent_id = $1 WHERE id = $2"#,
        stripe_payment_intent_id,
        purchase_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Complete a purchase (update status, set purchased_at, set payment intent)
pub async fn complete_purchase(
    db: &Pool<Postgres>,
    purchase_id: i64,
    stripe_payment_intent_id: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE store_purchases
        SET status = 'completed',
            purchased_at = NOW(),
            stripe_payment_intent_id = COALESCE($1, stripe_payment_intent_id)
        WHERE id = $2
        "#,
        stripe_payment_intent_id,
        purchase_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete a purchase (only for admin/cleanup purposes)
pub async fn delete(db: &Pool<Postgres>, purchase_id: i64) -> Result<u64, sqlx::Error> {
    let result = sqlx::query!(r#"DELETE FROM store_purchases WHERE id = $1"#, purchase_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}

/// Delete pending purchases older than specified time (cleanup job)
pub async fn delete_old_pending(
    db: &Pool<Postgres>,
    older_than_hours: i64,
) -> Result<u64, sqlx::Error> {
    let older_than_hours_f64 = older_than_hours as f64;
    let result = sqlx::query!(
        r#"
        DELETE FROM store_purchases
        WHERE status = 'pending'
            AND created_at < NOW() - INTERVAL '1 hour' * $1
        "#,
        older_than_hours_f64
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}
