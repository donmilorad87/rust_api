//! Site Configuration Read Queries
//!
//! Read operations for the site_config singleton table.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Site configuration record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteConfig {
    pub id: i64,
    // Identity/Branding
    pub site_name: String,
    pub show_site_name: bool,
    pub identity_color_start: String,
    pub identity_color_end: String,
    pub identity_size: String,
    pub logo_uuid: Option<Uuid>,
    pub favicon_uuid: Option<Uuid>,
    // Theme variables
    pub scss_variables: serde_json::Value,
    pub theme_light: serde_json::Value,
    pub theme_dark: serde_json::Value,
    // Build tracking
    pub last_build_at: Option<DateTime<Utc>>,
    pub last_build_status: Option<String>,
    pub last_build_error: Option<String>,
    pub assets_version: String,
    // Timestamps
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Build status enum for type safety
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BuildStatus {
    Pending,
    Building,
    Success,
    Failed,
}

impl BuildStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            BuildStatus::Pending => "pending",
            BuildStatus::Building => "building",
            BuildStatus::Success => "success",
            BuildStatus::Failed => "failed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "building" => BuildStatus::Building,
            "success" => BuildStatus::Success,
            "failed" => BuildStatus::Failed,
            _ => BuildStatus::Pending,
        }
    }
}

/// Get the singleton site configuration
/// Since there's only ever one row, we just fetch it directly
pub async fn get(db: &Pool<Postgres>) -> Result<SiteConfig, sqlx::Error> {
    sqlx::query_as!(
        SiteConfig,
        r#"
        SELECT
            id,
            site_name,
            show_site_name,
            identity_color_start,
            identity_color_end,
            identity_size,
            logo_uuid,
            favicon_uuid,
            scss_variables,
            theme_light,
            theme_dark,
            last_build_at,
            last_build_status,
            last_build_error,
            assets_version,
            created_at,
            updated_at
        FROM site_config
        LIMIT 1
        "#
    )
    .fetch_one(db)
    .await
}

/// Get only the build status (lightweight query for polling)
pub async fn get_build_status(db: &Pool<Postgres>) -> Result<(Option<String>, Option<String>), sqlx::Error> {
    let record = sqlx::query!(
        r#"
        SELECT last_build_status, last_build_error
        FROM site_config
        LIMIT 1
        "#
    )
    .fetch_one(db)
    .await?;

    Ok((record.last_build_status, record.last_build_error))
}

/// Get only branding info (logo, favicon, identity) with stored filenames for public URL generation
pub async fn get_branding(db: &Pool<Postgres>) -> Result<BrandingInfo, sqlx::Error> {
    sqlx::query_as!(
        BrandingInfo,
        r#"
        SELECT
            sc.site_name,
            sc.show_site_name,
            sc.identity_color_start,
            sc.identity_color_end,
            sc.identity_size,
            sc.logo_uuid,
            sc.favicon_uuid,
            logo_upload.stored_name as logo_stored_name,
            favicon_upload.stored_name as favicon_stored_name
        FROM site_config sc
        LEFT JOIN uploads logo_upload ON sc.logo_uuid = logo_upload.uuid
        LEFT JOIN uploads favicon_upload ON sc.favicon_uuid = favicon_upload.uuid
        LIMIT 1
        "#
    )
    .fetch_one(db)
    .await
}

/// Branding info subset with stored filenames for public URL generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrandingInfo {
    pub site_name: String,
    pub show_site_name: bool,
    pub identity_color_start: String,
    pub identity_color_end: String,
    pub identity_size: String,
    pub logo_uuid: Option<Uuid>,
    pub favicon_uuid: Option<Uuid>,
    pub logo_stored_name: Option<String>,
    pub favicon_stored_name: Option<String>,
}

/// Get current assets version
pub async fn get_assets_version(db: &Pool<Postgres>) -> Result<String, sqlx::Error> {
    let record = sqlx::query!(
        r#"SELECT assets_version FROM site_config LIMIT 1"#
    )
    .fetch_one(db)
    .await?;

    Ok(record.assets_version)
}

/// Get theme variables (SCSS and CSS custom properties)
pub async fn get_theme_variables(db: &Pool<Postgres>) -> Result<ThemeVariables, sqlx::Error> {
    sqlx::query_as!(
        ThemeVariables,
        r#"
        SELECT
            scss_variables,
            theme_light,
            theme_dark
        FROM site_config
        LIMIT 1
        "#
    )
    .fetch_one(db)
    .await
}

/// Theme variables subset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeVariables {
    pub scss_variables: serde_json::Value,
    pub theme_light: serde_json::Value,
    pub theme_dark: serde_json::Value,
}

/// Check if site config exists (should always return true after migration)
pub async fn exists(db: &Pool<Postgres>) -> bool {
    sqlx::query!("SELECT EXISTS(SELECT 1 FROM site_config LIMIT 1)")
        .fetch_one(db)
        .await
        .map(|r| r.exists.unwrap_or(false))
        .unwrap_or(false)
}
