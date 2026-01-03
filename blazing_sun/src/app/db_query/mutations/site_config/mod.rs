//! Site Configuration Mutation Queries
//!
//! Write operations for the site_config singleton table.

use chrono::Utc;
use serde_json::Value;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Update logo UUID and logo ID
/// When a UUID is provided, automatically populates logo_id from the uploads table
/// This maintains consistency between UUID-based and ID-based references
pub async fn update_logo(db: &Pool<Postgres>, logo_uuid: Option<Uuid>) -> Result<(), sqlx::Error> {
    // Update both UUID and ID columns in a single query
    // If UUID is NULL, set ID to NULL as well
    // If UUID is provided, look up the corresponding ID from uploads table
    sqlx::query!(
        r#"
        UPDATE site_config
        SET logo_uuid = $1,
            logo_id = (
                CASE
                    WHEN $1::UUID IS NULL THEN NULL
                    ELSE (SELECT id FROM uploads WHERE uuid = $1::UUID LIMIT 1)
                END
            )
        WHERE true
        "#,
        logo_uuid as Option<Uuid>
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update favicon UUID and favicon ID
/// When a UUID is provided, automatically populates favicon_id from the uploads table
/// This maintains consistency between UUID-based and ID-based references
pub async fn update_favicon(db: &Pool<Postgres>, favicon_uuid: Option<Uuid>) -> Result<(), sqlx::Error> {
    // Update both UUID and ID columns in a single query
    // If UUID is NULL, set ID to NULL as well
    // If UUID is provided, look up the corresponding ID from uploads table
    sqlx::query!(
        r#"
        UPDATE site_config
        SET favicon_uuid = $1,
            favicon_id = (
                CASE
                    WHEN $1::UUID IS NULL THEN NULL
                    ELSE (SELECT id FROM uploads WHERE uuid = $1::UUID LIMIT 1)
                END
            )
        WHERE true
        "#,
        favicon_uuid as Option<Uuid>
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update SCSS variables
pub async fn update_scss_variables(
    db: &Pool<Postgres>,
    scss_variables: &Value,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE site_config SET scss_variables = $1 WHERE true"#,
        scss_variables
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update light theme CSS custom properties
pub async fn update_theme_light(
    db: &Pool<Postgres>,
    theme_light: &Value,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE site_config SET theme_light = $1 WHERE true"#,
        theme_light
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update dark theme CSS custom properties
pub async fn update_theme_dark(
    db: &Pool<Postgres>,
    theme_dark: &Value,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE site_config SET theme_dark = $1 WHERE true"#,
        theme_dark
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update all theme variables at once (SCSS + light + dark)
pub async fn update_themes(
    db: &Pool<Postgres>,
    scss_variables: Option<&Value>,
    theme_light: Option<&Value>,
    theme_dark: Option<&Value>,
) -> Result<(), sqlx::Error> {
    // Update each if provided
    if let Some(scss) = scss_variables {
        sqlx::query!(
            r#"UPDATE site_config SET scss_variables = $1 WHERE true"#,
            scss
        )
        .execute(db)
        .await?;
    }

    if let Some(light) = theme_light {
        sqlx::query!(
            r#"UPDATE site_config SET theme_light = $1 WHERE true"#,
            light
        )
        .execute(db)
        .await?;
    }

    if let Some(dark) = theme_dark {
        sqlx::query!(
            r#"UPDATE site_config SET theme_dark = $1 WHERE true"#,
            dark
        )
        .execute(db)
        .await?;
    }

    Ok(())
}

/// Mark build as started
pub async fn set_build_started(db: &Pool<Postgres>) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE site_config
        SET last_build_status = 'building', last_build_error = NULL
        WHERE true
        "#
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Mark build as successful
pub async fn set_build_success(
    db: &Pool<Postgres>,
    new_version: &str,
) -> Result<(), sqlx::Error> {
    let now = Utc::now();
    sqlx::query!(
        r#"
        UPDATE site_config
        SET last_build_status = 'success',
            last_build_at = $1,
            last_build_error = NULL,
            assets_version = $2
        WHERE true
        "#,
        now,
        new_version
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Mark build as failed
pub async fn set_build_failed(
    db: &Pool<Postgres>,
    error_message: &str,
) -> Result<(), sqlx::Error> {
    let now = Utc::now();
    sqlx::query!(
        r#"
        UPDATE site_config
        SET last_build_status = 'failed',
            last_build_at = $1,
            last_build_error = $2
        WHERE true
        "#,
        now,
        error_message
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Update assets version directly
pub async fn update_assets_version(
    db: &Pool<Postgres>,
    version: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE site_config SET assets_version = $1 WHERE true"#,
        version
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Reset build status to pending
pub async fn reset_build_status(db: &Pool<Postgres>) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE site_config
        SET last_build_status = 'pending', last_build_error = NULL
        WHERE true
        "#
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Identity branding update params
pub struct UpdateIdentityParams {
    pub site_name: String,
    pub show_site_name: bool,
    pub identity_color_start: String,
    pub identity_color_end: String,
    pub identity_size: String,
}

/// Update site identity/branding fields
pub async fn update_identity(
    db: &Pool<Postgres>,
    params: &UpdateIdentityParams,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"
        UPDATE site_config
        SET site_name = $1,
            show_site_name = $2,
            identity_color_start = $3,
            identity_color_end = $4,
            identity_size = $5
        WHERE true
        "#,
        params.site_name,
        params.show_site_name,
        params.identity_color_start,
        params.identity_color_end,
        params.identity_size
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Full update (all fields at once - for save operation)
pub struct UpdateSiteConfigParams {
    pub site_name: Option<String>,
    pub show_site_name: Option<bool>,
    pub identity_color_start: Option<String>,
    pub identity_color_end: Option<String>,
    pub identity_size: Option<String>,
    pub logo_uuid: Option<Uuid>,
    pub favicon_uuid: Option<Uuid>,
    pub scss_variables: Option<Value>,
    pub theme_light: Option<Value>,
    pub theme_dark: Option<Value>,
}

pub async fn update_full(
    db: &Pool<Postgres>,
    params: &UpdateSiteConfigParams,
) -> Result<(), sqlx::Error> {
    // Identity fields
    if let Some(ref site_name) = params.site_name {
        sqlx::query!(
            r#"UPDATE site_config SET site_name = $1 WHERE true"#,
            site_name
        )
        .execute(db)
        .await?;
    }

    if let Some(show_site_name) = params.show_site_name {
        sqlx::query!(
            r#"UPDATE site_config SET show_site_name = $1 WHERE true"#,
            show_site_name
        )
        .execute(db)
        .await?;
    }

    if let Some(ref color_start) = params.identity_color_start {
        sqlx::query!(
            r#"UPDATE site_config SET identity_color_start = $1 WHERE true"#,
            color_start
        )
        .execute(db)
        .await?;
    }

    if let Some(ref color_end) = params.identity_color_end {
        sqlx::query!(
            r#"UPDATE site_config SET identity_color_end = $1 WHERE true"#,
            color_end
        )
        .execute(db)
        .await?;
    }

    if let Some(ref size) = params.identity_size {
        sqlx::query!(
            r#"UPDATE site_config SET identity_size = $1 WHERE true"#,
            size
        )
        .execute(db)
        .await?;
    }

    // Logo and favicon handled separately (can be set to NULL)
    sqlx::query!(
        r#"UPDATE site_config SET logo_uuid = $1 WHERE true"#,
        params.logo_uuid
    )
    .execute(db)
    .await?;

    sqlx::query!(
        r#"UPDATE site_config SET favicon_uuid = $1 WHERE true"#,
        params.favicon_uuid
    )
    .execute(db)
    .await?;

    if let Some(ref scss) = params.scss_variables {
        sqlx::query!(
            r#"UPDATE site_config SET scss_variables = $1 WHERE true"#,
            scss
        )
        .execute(db)
        .await?;
    }

    if let Some(ref light) = params.theme_light {
        sqlx::query!(
            r#"UPDATE site_config SET theme_light = $1 WHERE true"#,
            light
        )
        .execute(db)
        .await?;
    }

    if let Some(ref dark) = params.theme_dark {
        sqlx::query!(
            r#"UPDATE site_config SET theme_dark = $1 WHERE true"#,
            dark
        )
        .execute(db)
        .await?;
    }

    Ok(())
}
