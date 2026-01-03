//! Asset URL Utilities
//!
//! Synchronous URL builders for asset references.

use uuid::Uuid;

/// Build asset URL from UUID and storage type
///
/// This is a synchronous version for use in controllers where upload data
/// is already available from database joins.
///
/// # Arguments
/// * `uuid` - Upload UUID
/// * `storage_type` - "public" or "private"
/// * `variant` - Optional size variant (e.g., "thumb", "small", "medium", "large", "full")
///
/// # Returns
/// Asset URL in format: `/api/v1/upload/download/{storage_type}/{uuid}?variant={variant}`
///
/// # Examples
/// ```
/// use uuid::Uuid;
///
/// let uuid = Uuid::new_v4();
/// let url = asset_by_id(&uuid, "public", Some("thumb"));
/// // Returns: "/api/v1/upload/download/public/{uuid}?variant=thumb"
/// ```
pub fn asset_by_id(uuid: &Uuid, storage_type: &str, variant: Option<&str>) -> String {
    let variant_param = variant
        .map(|v| format!("?variant={}", v))
        .unwrap_or_default();

    format!(
        "/api/v1/upload/download/{}/{}{}",
        storage_type,
        uuid,
        variant_param
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_asset_by_id_with_variant() {
        let uuid = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let url = asset_by_id(&uuid, "public", Some("thumb"));
        assert_eq!(url, "/api/v1/upload/download/public/550e8400-e29b-41d4-a716-446655440000?variant=thumb");
    }

    #[test]
    fn test_asset_by_id_without_variant() {
        let uuid = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        let url = asset_by_id(&uuid, "private", None);
        assert_eq!(url, "/api/v1/upload/download/private/550e8400-e29b-41d4-a716-446655440000");
    }

    #[test]
    fn test_asset_by_id_different_variants() {
        let uuid = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();

        let thumb = asset_by_id(&uuid, "public", Some("thumb"));
        let small = asset_by_id(&uuid, "public", Some("small"));
        let medium = asset_by_id(&uuid, "public", Some("medium"));
        let large = asset_by_id(&uuid, "public", Some("large"));
        let full = asset_by_id(&uuid, "public", Some("full"));

        assert!(thumb.contains("variant=thumb"));
        assert!(small.contains("variant=small"));
        assert!(medium.contains("variant=medium"));
        assert!(large.contains("variant=large"));
        assert!(full.contains("variant=full"));
    }
}
