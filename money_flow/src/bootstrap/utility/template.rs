//! Template Utility Functions
//!
//! Helper functions for use in templates (Tera).

use crate::config::UploadConfig;
use crate::database::read::upload as db_upload_read;
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// Asset visibility type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetVisibility {
    Public,
    Private,
}

impl AssetVisibility {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "public" => Some(AssetVisibility::Public),
            "private" => Some(AssetVisibility::Private),
            _ => None,
        }
    }
}

/// Generate URL for an asset by its stored filename
///
/// # Arguments
/// * `name` - The stored filename (e.g., "20251224_123456_uuid.jpg")
/// * `visibility` - "public" or "private"
///
/// # Returns
/// The full URL to access the asset
///
/// # Example
/// ```rust
/// use money_flow::bootstrap::utility::template::assets;
///
/// // Public file - served by nginx at /storage/
/// let url = assets("20251224_123456_uuid.jpg", "public");
/// // Returns: "/storage/20251224_123456_uuid.jpg"
///
/// // Private file - served by API
/// let url = assets("abc123-def456", "private");
/// // Returns: "/api/v1/upload/private/abc123-def456"
/// ```
pub fn assets(name: &str, visibility: &str) -> String {
    let vis = AssetVisibility::from_str(visibility).unwrap_or(AssetVisibility::Public);

    match vis {
        AssetVisibility::Public => {
            format!("{}/{}", UploadConfig::public_url_base(), name)
        }
        AssetVisibility::Private => {
            format!("{}/{}", UploadConfig::private_url_base(), name)
        }
    }
}

/// Generate URL for an asset by its UUID from the database
///
/// # Arguments
/// * `db` - Database connection pool
/// * `uuid_str` - The UUID of the upload record
/// * `visibility` - "public" or "private"
///
/// # Returns
/// The full URL to access the asset, or None if not found
///
/// # Example
/// ```rust
/// use money_flow::bootstrap::utility::template::assets_by_uuid;
///
/// let url = assets_by_uuid(&db, "550e8400-e29b-41d4-a716-446655440000", "public").await;
/// ```
pub async fn assets_by_uuid(
    db: &Pool<Postgres>,
    uuid_str: &str,
    visibility: &str,
) -> Option<String> {
    let uuid = Uuid::parse_str(uuid_str).ok()?;
    let vis = AssetVisibility::from_str(visibility)?;

    // Try to get the upload from database
    let upload = match vis {
        AssetVisibility::Public => db_upload_read::get_public_by_uuid(db, &uuid).await.ok(),
        AssetVisibility::Private => {
            // For private, we can't verify ownership without user_id
            // Just return the API URL with the UUID
            return Some(format!("{}/{}", UploadConfig::private_url_base(), uuid_str));
        }
    };

    upload.map(|u| {
        // Extract just the filename from storage_path
        let filename = std::path::Path::new(&u.storage_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&u.stored_name);

        format!("{}/{}", UploadConfig::public_url_base(), filename)
    })
}

/// Generate URL for a public asset by its stored filename
/// Convenience wrapper for `assets(name, "public")`
pub fn asset(name: &str) -> String {
    assets(name, "public")
}

/// Generate URL for a private asset by UUID
/// Convenience wrapper for private asset access
pub fn private_asset(uuid: &str) -> String {
    assets(uuid, "private")
}

/// Storage URL configuration helper
pub struct StorageUrls;

impl StorageUrls {
    /// Get the base URL for public storage
    pub fn public_base() -> &'static str {
        UploadConfig::public_url_base()
    }

    /// Get the base URL for private storage API
    pub fn private_base() -> &'static str {
        UploadConfig::private_url_base()
    }

    /// Build a public file URL
    pub fn public(filename: &str) -> String {
        format!("{}/{}", Self::public_base(), filename)
    }

    /// Build a private file URL (by UUID)
    pub fn private(uuid: &str) -> String {
        format!("{}/{}", Self::private_base(), uuid)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assets_public() {
        let url = assets("test.jpg", "public");
        assert!(url.contains("/storage/") || url.contains("test.jpg"));
    }

    #[test]
    fn test_assets_private() {
        let url = assets("abc123", "private");
        assert!(url.contains("/api/v1/upload/private/"));
        assert!(url.contains("abc123"));
    }

    #[test]
    fn test_asset_visibility_from_str() {
        assert_eq!(AssetVisibility::from_str("public"), Some(AssetVisibility::Public));
        assert_eq!(AssetVisibility::from_str("PRIVATE"), Some(AssetVisibility::Private));
        assert_eq!(AssetVisibility::from_str("invalid"), None);
    }
}
