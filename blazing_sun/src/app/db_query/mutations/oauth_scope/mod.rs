//! OAuth Scope Catalog Mutation Queries
//!
//! Write operations for managing client scopes and API product access.

use sqlx::{Pool, Postgres};

// ============================================================================
// Client Allowed Scopes Mutations
// ============================================================================

/// Add allowed scope to client
pub async fn add_client_scope(
    db: &Pool<Postgres>,
    client_db_id: i64,
    scope_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO oauth_client_allowed_scopes (client_id, scope_id)
        VALUES ($1, $2)
        ON CONFLICT (client_id, scope_id) DO NOTHING
        "#,
        client_db_id,
        scope_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Add multiple scopes to client (batch operation)
pub async fn add_client_scopes_batch(
    db: &Pool<Postgres>,
    client_db_id: i64,
    scope_ids: &[i64],
) -> Result<u64, sqlx::Error> {
    let mut affected_rows = 0u64;

    for scope_id in scope_ids {
        let result = sqlx::query!(
            r#"
            INSERT INTO oauth_client_allowed_scopes (client_id, scope_id)
            VALUES ($1, $2)
            ON CONFLICT (client_id, scope_id) DO NOTHING
            "#,
            client_db_id,
            scope_id
        )
        .execute(db)
        .await?;

        affected_rows += result.rows_affected();
    }

    Ok(affected_rows)
}

/// Remove allowed scope from client
pub async fn remove_client_scope(
    db: &Pool<Postgres>,
    client_db_id: i64,
    scope_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM oauth_client_allowed_scopes
        WHERE client_id = $1 AND scope_id = $2
        "#,
        client_db_id,
        scope_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Remove all scopes from client
pub async fn remove_all_client_scopes(
    db: &Pool<Postgres>,
    client_db_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM oauth_client_allowed_scopes
        WHERE client_id = $1
        "#,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Replace all client scopes (atomic operation)
/// Removes all existing scopes and adds the new ones
pub async fn replace_client_scopes(
    db: &Pool<Postgres>,
    client_db_id: i64,
    scope_ids: &[i64],
) -> Result<(), sqlx::Error> {
    // Use a transaction for atomicity
    let mut tx = db.begin().await?;

    // Remove all existing scopes
    sqlx::query!(
        r#"
        DELETE FROM oauth_client_allowed_scopes
        WHERE client_id = $1
        "#,
        client_db_id
    )
    .execute(&mut *tx)
    .await?;

    // Add new scopes
    for scope_id in scope_ids {
        sqlx::query!(
            r#"
            INSERT INTO oauth_client_allowed_scopes (client_id, scope_id)
            VALUES ($1, $2)
            "#,
            client_db_id,
            scope_id
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

// ============================================================================
// Client Enabled APIs Mutations
// ============================================================================

/// Enable API product for client
pub async fn enable_client_api_product(
    db: &Pool<Postgres>,
    client_db_id: i64,
    api_product_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        INSERT INTO oauth_client_enabled_apis (client_id, api_product_id)
        VALUES ($1, $2)
        ON CONFLICT (client_id, api_product_id) DO NOTHING
        "#,
        client_db_id,
        api_product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Enable multiple API products for client (batch operation)
pub async fn enable_client_api_products_batch(
    db: &Pool<Postgres>,
    client_db_id: i64,
    api_product_ids: &[i64],
) -> Result<u64, sqlx::Error> {
    let mut affected_rows = 0u64;

    for api_product_id in api_product_ids {
        let result = sqlx::query!(
            r#"
            INSERT INTO oauth_client_enabled_apis (client_id, api_product_id)
            VALUES ($1, $2)
            ON CONFLICT (client_id, api_product_id) DO NOTHING
            "#,
            client_db_id,
            api_product_id
        )
        .execute(db)
        .await?;

        affected_rows += result.rows_affected();
    }

    Ok(affected_rows)
}

/// Disable API product for client
pub async fn disable_client_api_product(
    db: &Pool<Postgres>,
    client_db_id: i64,
    api_product_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM oauth_client_enabled_apis
        WHERE client_id = $1 AND api_product_id = $2
        "#,
        client_db_id,
        api_product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Disable all API products for client
pub async fn disable_all_client_api_products(
    db: &Pool<Postgres>,
    client_db_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM oauth_client_enabled_apis
        WHERE client_id = $1
        "#,
        client_db_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Replace all client API products (atomic operation)
/// Removes all existing API products and adds the new ones
pub async fn replace_client_api_products(
    db: &Pool<Postgres>,
    client_db_id: i64,
    api_product_ids: &[i64],
) -> Result<(), sqlx::Error> {
    // Use a transaction for atomicity
    let mut tx = db.begin().await?;

    // Remove all existing API products
    sqlx::query!(
        r#"
        DELETE FROM oauth_client_enabled_apis
        WHERE client_id = $1
        "#,
        client_db_id
    )
    .execute(&mut *tx)
    .await?;

    // Add new API products
    for api_product_id in api_product_ids {
        sqlx::query!(
            r#"
            INSERT INTO oauth_client_enabled_apis (client_id, api_product_id)
            VALUES ($1, $2)
            "#,
            client_db_id,
            api_product_id
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

// ============================================================================
// Admin Scope Catalog Mutations (for adding new scopes to the catalog)
// ============================================================================

/// Add a new scope to the catalog (admin only)
pub async fn create_scope(
    db: &Pool<Postgres>,
    scope_name: &str,
    scope_description: &str,
    sensitive: bool,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO oauth_scope_catalog (scope_name, scope_description, sensitive)
        VALUES ($1, $2, $3)
        RETURNING id
        "#,
        scope_name,
        scope_description,
        sensitive
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Delete a scope from the catalog (admin only)
/// Note: This will cascade delete all client_allowed_scopes entries
pub async fn delete_scope(db: &Pool<Postgres>, scope_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM oauth_scope_catalog
        WHERE id = $1
        "#,
        scope_id
    )
    .execute(db)
    .await?;

    Ok(())
}

// ============================================================================
// Admin API Products Mutations (for managing API products)
// ============================================================================

/// Create a new API product (admin only)
pub async fn create_api_product(
    db: &Pool<Postgres>,
    product_name: &str,
    product_description: &str,
) -> Result<i64, sqlx::Error> {
    let result = sqlx::query!(
        r#"
        INSERT INTO oauth_api_products (product_name, product_description)
        VALUES ($1, $2)
        RETURNING id
        "#,
        product_name,
        product_description
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Deactivate an API product (admin only)
pub async fn deactivate_api_product(
    db: &Pool<Postgres>,
    product_id: i64,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE oauth_api_products
        SET is_active = false
        WHERE id = $1
        "#,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Activate an API product (admin only)
pub async fn activate_api_product(db: &Pool<Postgres>, product_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE oauth_api_products
        SET is_active = true
        WHERE id = $1
        "#,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Delete an API product (admin only)
/// Note: This will cascade delete all client_enabled_apis entries
pub async fn delete_api_product(db: &Pool<Postgres>, product_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        DELETE FROM oauth_api_products
        WHERE id = $1
        "#,
        product_id
    )
    .execute(db)
    .await?;

    Ok(())
}
