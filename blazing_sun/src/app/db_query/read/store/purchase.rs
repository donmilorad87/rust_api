//! Store Purchase Read Queries
//!
//! Read operations for the store_purchases table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

/// Store purchase record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorePurchase {
    pub id: i64,
    pub user_id: i64,
    pub product_id: i64,
    pub amount_cents: i64,
    pub stripe_session_id: Option<String>,
    pub stripe_payment_intent_id: Option<String>,
    pub status: String,
    pub license_type: String,
    pub purchased_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Store purchase with product details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorePurchaseWithProduct {
    pub id: i64,
    pub user_id: i64,
    pub product_id: i64,
    pub amount_cents: i64,
    pub status: String,
    pub license_type: String,
    pub purchased_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    // Product fields
    pub product_title: String,
    pub product_slug: String,
    pub product_type: String,
    pub product_cover_image_id: Option<i64>,
}

/// Get purchase by ID
pub async fn get_by_id(db: &Pool<Postgres>, purchase_id: i64) -> Result<StorePurchase, sqlx::Error> {
    sqlx::query_as!(
        StorePurchase,
        r#"
        SELECT id, user_id, product_id, amount_cents, stripe_session_id, stripe_payment_intent_id,
               status, license_type, purchased_at, created_at, updated_at
        FROM store_purchases
        WHERE id = $1
        "#,
        purchase_id
    )
    .fetch_one(db)
    .await
}

/// Get purchase by ID for a specific user (ownership check)
pub async fn get_by_id_and_user(
    db: &Pool<Postgres>,
    purchase_id: i64,
    user_id: i64,
) -> Result<StorePurchase, sqlx::Error> {
    sqlx::query_as!(
        StorePurchase,
        r#"
        SELECT id, user_id, product_id, amount_cents, stripe_session_id, stripe_payment_intent_id,
               status, license_type, purchased_at, created_at, updated_at
        FROM store_purchases
        WHERE id = $1 AND user_id = $2
        "#,
        purchase_id,
        user_id
    )
    .fetch_one(db)
    .await
}

/// Get purchase by Stripe session ID
pub async fn get_by_stripe_session_id(
    db: &Pool<Postgres>,
    session_id: &str,
) -> Result<StorePurchase, sqlx::Error> {
    sqlx::query_as!(
        StorePurchase,
        r#"
        SELECT id, user_id, product_id, amount_cents, stripe_session_id, stripe_payment_intent_id,
               status, license_type, purchased_at, created_at, updated_at
        FROM store_purchases
        WHERE stripe_session_id = $1
        "#,
        session_id
    )
    .fetch_one(db)
    .await
}

/// Get purchase by Stripe payment intent ID
pub async fn get_by_stripe_payment_intent_id(
    db: &Pool<Postgres>,
    payment_intent_id: &str,
) -> Result<StorePurchase, sqlx::Error> {
    sqlx::query_as!(
        StorePurchase,
        r#"
        SELECT id, user_id, product_id, amount_cents, stripe_session_id, stripe_payment_intent_id,
               status, license_type, purchased_at, created_at, updated_at
        FROM store_purchases
        WHERE stripe_payment_intent_id = $1
        "#,
        payment_intent_id
    )
    .fetch_one(db)
    .await
}

/// Get purchase by user and product (check if user already purchased)
pub async fn get_by_user_and_product(
    db: &Pool<Postgres>,
    user_id: i64,
    product_id: i64,
) -> Result<StorePurchase, sqlx::Error> {
    sqlx::query_as!(
        StorePurchase,
        r#"
        SELECT id, user_id, product_id, amount_cents, stripe_session_id, stripe_payment_intent_id,
               status, license_type, purchased_at, created_at, updated_at
        FROM store_purchases
        WHERE user_id = $1 AND product_id = $2
        "#,
        user_id,
        product_id
    )
    .fetch_one(db)
    .await
}

/// Get all purchases for a user with pagination
pub async fn get_by_user_paginated(
    db: &Pool<Postgres>,
    user_id: i64,
    limit: i64,
    offset: i64,
) -> Result<Vec<StorePurchaseWithProduct>, sqlx::Error> {
    sqlx::query_as!(
        StorePurchaseWithProduct,
        r#"
        SELECT
            sp.id,
            sp.user_id,
            sp.product_id,
            sp.amount_cents,
            sp.status,
            sp.license_type,
            sp.purchased_at,
            sp.created_at,
            p.title as product_title,
            p.slug as product_slug,
            p.product_type,
            p.cover_image_id as product_cover_image_id
        FROM store_purchases sp
        INNER JOIN store_products p ON sp.product_id = p.id
        WHERE sp.user_id = $1
        ORDER BY sp.created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        user_id,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Get completed purchases for a user with pagination
pub async fn get_completed_by_user_paginated(
    db: &Pool<Postgres>,
    user_id: i64,
    limit: i64,
    offset: i64,
) -> Result<Vec<StorePurchaseWithProduct>, sqlx::Error> {
    sqlx::query_as!(
        StorePurchaseWithProduct,
        r#"
        SELECT
            sp.id,
            sp.user_id,
            sp.product_id,
            sp.amount_cents,
            sp.status,
            sp.license_type,
            sp.purchased_at,
            sp.created_at,
            p.title as product_title,
            p.slug as product_slug,
            p.product_type,
            p.cover_image_id as product_cover_image_id
        FROM store_purchases sp
        INNER JOIN store_products p ON sp.product_id = p.id
        WHERE sp.user_id = $1 AND sp.status = 'completed'
        ORDER BY sp.purchased_at DESC
        LIMIT $2 OFFSET $3
        "#,
        user_id,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Get all purchases for a product (admin)
pub async fn get_by_product_id_paginated(
    db: &Pool<Postgres>,
    product_id: i64,
    limit: i64,
    offset: i64,
) -> Result<Vec<StorePurchase>, sqlx::Error> {
    sqlx::query_as!(
        StorePurchase,
        r#"
        SELECT id, user_id, product_id, amount_cents, stripe_session_id, stripe_payment_intent_id,
               status, license_type, purchased_at, created_at, updated_at
        FROM store_purchases
        WHERE product_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        product_id,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}

/// Check if user has purchased a product (completed status)
pub async fn user_has_purchased_product(
    db: &Pool<Postgres>,
    user_id: i64,
    product_id: i64,
) -> bool {
    sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM store_purchases
            WHERE user_id = $1 AND product_id = $2 AND status = 'completed'
        ) as "exists!"
        "#,
        user_id,
        product_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Check if user has any purchase record for a product (any status)
pub async fn user_has_purchase_record(
    db: &Pool<Postgres>,
    user_id: i64,
    product_id: i64,
) -> bool {
    sqlx::query!(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM store_purchases
            WHERE user_id = $1 AND product_id = $2
        ) as "exists!"
        "#,
        user_id,
        product_id
    )
    .fetch_one(db)
    .await
    .map(|r| r.exists)
    .unwrap_or(false)
}

/// Count total purchases for a user
pub async fn count_by_user(db: &Pool<Postgres>, user_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM store_purchases WHERE user_id = $1"#,
        user_id
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Count completed purchases for a user
pub async fn count_completed_by_user(db: &Pool<Postgres>, user_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM store_purchases WHERE user_id = $1 AND status = 'completed'"#,
        user_id
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Count total purchases for a product
pub async fn count_by_product(db: &Pool<Postgres>, product_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COUNT(*) as "count!" FROM store_purchases WHERE product_id = $1 AND status = 'completed'"#,
        product_id
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Get total revenue (all completed purchases)
pub async fn get_total_revenue(db: &Pool<Postgres>) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"SELECT COALESCE(SUM(amount_cents), 0)::BIGINT as "sum!" FROM store_purchases WHERE status = 'completed'"#
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Get total revenue for a product
pub async fn get_product_revenue(db: &Pool<Postgres>, product_id: i64) -> Result<i64, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)::BIGINT as "sum!"
        FROM store_purchases
        WHERE product_id = $1 AND status = 'completed'
        "#,
        product_id
    )
    .fetch_one(db)
    .await?;
    Ok(result)
}

/// Get pending purchases (for admin monitoring)
pub async fn get_pending_paginated(
    db: &Pool<Postgres>,
    limit: i64,
    offset: i64,
) -> Result<Vec<StorePurchase>, sqlx::Error> {
    sqlx::query_as!(
        StorePurchase,
        r#"
        SELECT id, user_id, product_id, amount_cents, stripe_session_id, stripe_payment_intent_id,
               status, license_type, purchased_at, created_at, updated_at
        FROM store_purchases
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT $1 OFFSET $2
        "#,
        limit,
        offset
    )
    .fetch_all(db)
    .await
}
