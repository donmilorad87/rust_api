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
    pub logo_id: Option<i64>, // NEW: ID-based logo reference (replaces logo_uuid)
    pub logo_storage_type: Option<String>, // Storage type from uploads table
    pub favicon_uuid: Option<Uuid>,
    pub favicon_id: Option<i64>, // NEW: ID-based favicon reference (replaces favicon_uuid)
    pub favicon_storage_type: Option<String>, // Storage type from uploads table
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

/// Get the singleton site configuration with storage types
/// JOINs with uploads table to get logo and favicon storage types
pub async fn get(db: &Pool<Postgres>) -> Result<SiteConfig, sqlx::Error> {
    sqlx::query_as!(
        SiteConfig,
        r#"
        SELECT
            sc.id,
            sc.site_name,
            sc.show_site_name,
            sc.identity_color_start,
            sc.identity_color_end,
            sc.identity_size,
            sc.logo_uuid,
            sc.logo_id,
            logo_upload.storage_type as "logo_storage_type?",
            sc.favicon_uuid,
            sc.favicon_id,
            favicon_upload.storage_type as "favicon_storage_type?",
            sc.scss_variables,
            sc.theme_light,
            sc.theme_dark,
            sc.last_build_at,
            sc.last_build_status,
            sc.last_build_error,
            sc.assets_version,
            sc.created_at,
            sc.updated_at
        FROM site_config sc
        LEFT JOIN uploads logo_upload ON sc.logo_uuid = logo_upload.uuid
        LEFT JOIN uploads favicon_upload ON sc.favicon_uuid = favicon_upload.uuid
        LIMIT 1
        "#
    )
    .fetch_one(db)
    .await
}

/// Get only the build status (lightweight query for polling)
pub async fn get_build_status(
    db: &Pool<Postgres>,
) -> Result<(Option<String>, Option<String>), sqlx::Error> {
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
            sc.logo_id,
            sc.favicon_uuid,
            sc.favicon_id,
            logo_upload.stored_name as "logo_stored_name?",
            favicon_upload.stored_name as "favicon_stored_name?",
            logo_upload.storage_type as "logo_storage_type?",
            favicon_upload.storage_type as "favicon_storage_type?"
        FROM site_config sc
        LEFT JOIN uploads logo_upload ON sc.logo_uuid = logo_upload.uuid
        LEFT JOIN uploads favicon_upload ON sc.favicon_uuid = favicon_upload.uuid
        LIMIT 1
        "#
    )
    .fetch_one(db)
    .await
}

/// Branding info subset with stored filenames and storage types for URL generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrandingInfo {
    pub site_name: String,
    pub show_site_name: bool,
    pub identity_color_start: String,
    pub identity_color_end: String,
    pub identity_size: String,
    pub logo_uuid: Option<Uuid>,
    pub logo_id: Option<i64>, // NEW: ID-based logo reference
    pub favicon_uuid: Option<Uuid>,
    pub favicon_id: Option<i64>, // NEW: ID-based favicon reference
    pub logo_stored_name: Option<String>,
    pub favicon_stored_name: Option<String>,
    pub logo_storage_type: Option<String>,
    pub favicon_storage_type: Option<String>,
}

/// Get current assets version
pub async fn get_assets_version(db: &Pool<Postgres>) -> Result<String, sqlx::Error> {
    let record = sqlx::query!(r#"SELECT assets_version FROM site_config LIMIT 1"#)
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
