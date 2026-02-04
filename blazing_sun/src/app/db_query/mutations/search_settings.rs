//! Search Index Settings - Mutation Operations

use sqlx::PgPool;

/// Update a single setting's enabled status
pub async fn update_setting_enabled(
    pool: &PgPool,
    content_type: &str,
    is_enabled: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE search_index_settings
        SET is_enabled = $2
        WHERE content_type = $1
        "#,
        content_type,
        is_enabled
    )
    .execute(pool)
    .await?;

    Ok(())
}

/// Update multiple settings at once
pub async fn update_settings_batch(
    pool: &PgPool,
    settings: &[(String, bool)],
) -> Result<(), sqlx::Error> {
    for (content_type, is_enabled) in settings {
        sqlx::query!(
            r#"
            UPDATE search_index_settings
            SET is_enabled = $2
            WHERE content_type = $1
            "#,
            content_type,
            is_enabled
        )
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// Add a new content type setting
pub async fn add_content_type(
    pool: &PgPool,
    content_type: &str,
    display_name: &str,
    is_enabled: bool,
    display_order: i32,
) -> Result<i32, sqlx::Error> {
    let result = sqlx::query_scalar!(
        r#"
        INSERT INTO search_index_settings (content_type, display_name, is_enabled, display_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (content_type) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            is_enabled = EXCLUDED.is_enabled,
            display_order = EXCLUDED.display_order
        RETURNING id
        "#,
        content_type,
        display_name,
        is_enabled,
        display_order
    )
    .fetch_one(pool)
    .await?;

    Ok(result)
}
