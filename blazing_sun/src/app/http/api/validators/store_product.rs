//! Store Product Validators
//!
//! Validation rules for store product API requests.

use chrono::NaiveDate;
use regex::Regex;
use serde::Deserialize;
use std::sync::LazyLock;

/// Regex for valid slug characters (lowercase letters, numbers, hyphens)
static SLUG_REGEX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-z0-9]+(?:-[a-z0-9]+)*$").unwrap());

/// Valid product types
pub const VALID_PRODUCT_TYPES: &[&str] = &["single_image", "gallery", "bundle"];

/// Valid seasons
pub const VALID_SEASONS: &[&str] = &["spring", "summer", "autumn", "winter"];

/// Valid sort options for product listing
pub const VALID_SORT_OPTIONS: &[&str] =
    &["newest", "oldest", "price_asc", "price_desc", "title"];

/// Valid product status filters for admin
pub const VALID_STATUS_FILTERS: &[&str] = &["all", "active", "inactive", "sold"];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/// Validate product title
///
/// Title must:
/// - Be at least 2 characters
/// - Be at most 255 characters
pub fn validate_title(title: &str) -> Vec<String> {
    let mut errors = Vec::new();

    if title.is_empty() {
        errors.push("title is required".to_string());
        return errors;
    }

    if title.len() < 2 {
        errors.push("title must be at least 2 characters".to_string());
    }

    if title.len() > 255 {
        errors.push("title must be at most 255 characters".to_string());
    }

    errors
}

/// Validate product slug
///
/// Slug must:
/// - Be at least 2 characters
/// - Be at most 255 characters
/// - Contain only lowercase letters, numbers, and hyphens
/// - Not start or end with a hyphen
pub fn validate_slug(slug: &str) -> Vec<String> {
    let mut errors = Vec::new();

    if slug.is_empty() {
        errors.push("slug is required".to_string());
        return errors;
    }

    if slug.len() < 2 {
        errors.push("slug must be at least 2 characters".to_string());
    }

    if slug.len() > 255 {
        errors.push("slug must be at most 255 characters".to_string());
    }

    if !SLUG_REGEX.is_match(slug) {
        errors.push(
            "slug must contain only lowercase letters, numbers, and hyphens".to_string(),
        );
    }

    errors
}

/// Generate a slug from a title
///
/// Converts title to lowercase, replaces spaces with hyphens,
/// removes non-alphanumeric characters (except hyphens),
/// and collapses multiple hyphens into one.
pub fn slugify(name: &str) -> String {
    let slug: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();

    // Collapse multiple hyphens and trim leading/trailing hyphens
    let mut result = String::new();
    let mut prev_was_hyphen = true; // Start as true to skip leading hyphens

    for c in slug.chars() {
        if c == '-' {
            if !prev_was_hyphen {
                result.push(c);
                prev_was_hyphen = true;
            }
        } else {
            result.push(c);
            prev_was_hyphen = false;
        }
    }

    // Remove trailing hyphen
    if result.ends_with('-') {
        result.pop();
    }

    result
}

/// Validate product type
pub fn validate_product_type(product_type: &str) -> Vec<String> {
    let mut errors = Vec::new();

    if !VALID_PRODUCT_TYPES.contains(&product_type) {
        errors.push(format!(
            "product_type must be one of: {}",
            VALID_PRODUCT_TYPES.join(", ")
        ));
    }

    errors
}

/// Validate price (must be non-negative)
pub fn validate_price(price_cents: i64) -> Vec<String> {
    let mut errors = Vec::new();

    if price_cents < 0 {
        errors.push("price_cents must be non-negative".to_string());
    }

    errors
}

/// Validate season if provided
pub fn validate_season(season: &str) -> Vec<String> {
    let mut errors = Vec::new();

    if !season.is_empty() && !VALID_SEASONS.contains(&season) {
        errors.push(format!(
            "season must be one of: {}",
            VALID_SEASONS.join(", ")
        ));
    }

    errors
}

/// Validate latitude
pub fn validate_latitude(latitude: f64) -> Vec<String> {
    let mut errors = Vec::new();

    if !(-90.0..=90.0).contains(&latitude) {
        errors.push("latitude must be between -90 and 90".to_string());
    }

    errors
}

/// Validate longitude
pub fn validate_longitude(longitude: f64) -> Vec<String> {
    let mut errors = Vec::new();

    if !(-180.0..=180.0).contains(&longitude) {
        errors.push("longitude must be between -180 and 180".to_string());
    }

    errors
}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

/// Query parameters for listing products (public)
#[derive(Debug, Deserialize, Default)]
pub struct ListProductsQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: i64,
    pub category_id: Option<i64>,
    pub search: Option<String>,
    pub tags: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub city: Option<String>,
    pub min_price: Option<i64>,
    pub max_price: Option<i64>,
    pub season: Option<String>,
    #[serde(default)]
    pub featured_only: bool,
    #[serde(default = "default_sort")]
    pub sort: String,
}

fn default_page() -> u64 {
    1
}

fn default_per_page() -> i64 {
    20
}

fn default_sort() -> String {
    "newest".to_string()
}

impl ListProductsQuery {
    /// Validate query parameters
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if self.per_page < 1 || self.per_page > 100 {
            errors.push("per_page must be between 1 and 100".to_string());
        }

        if self.page < 1 {
            errors.push("page must be at least 1".to_string());
        }

        if !VALID_SORT_OPTIONS.contains(&self.sort.as_str()) {
            errors.push(format!(
                "sort must be one of: {}",
                VALID_SORT_OPTIONS.join(", ")
            ));
        }

        if let Some(ref season) = self.season {
            if !VALID_SEASONS.contains(&season.as_str()) {
                errors.push(format!(
                    "season must be one of: {}",
                    VALID_SEASONS.join(", ")
                ));
            }
        }

        if let (Some(min), Some(max)) = (self.min_price, self.max_price) {
            if min > max {
                errors.push("min_price cannot be greater than max_price".to_string());
            }
        }

        errors
    }

    /// Parse comma-separated tags into a vector
    pub fn get_tags(&self) -> Option<Vec<String>> {
        self.tags.as_ref().map(|t| {
            t.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
    }

    /// Get normalized per_page value (clamped to valid range)
    pub fn get_per_page(&self) -> i64 {
        self.per_page.clamp(1, 100)
    }

    /// Get normalized page value
    pub fn get_page(&self) -> u64 {
        self.page.max(1)
    }

    /// Calculate offset from page and per_page
    pub fn get_offset(&self) -> i64 {
        ((self.get_page() - 1) * (self.get_per_page() as u64)) as i64
    }
}

/// Query parameters for admin product listing
#[derive(Debug, Deserialize, Default)]
pub struct AdminListProductsQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: i64,
    pub category_id: Option<i64>,
    pub search: Option<String>,
    #[serde(default = "default_admin_status")]
    pub status: String,
    #[serde(default = "default_sort")]
    pub sort: String,
}

fn default_admin_status() -> String {
    "all".to_string()
}

impl AdminListProductsQuery {
    /// Validate query parameters
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if self.per_page < 1 || self.per_page > 100 {
            errors.push("per_page must be between 1 and 100".to_string());
        }

        if self.page < 1 {
            errors.push("page must be at least 1".to_string());
        }

        if !VALID_STATUS_FILTERS.contains(&self.status.as_str()) {
            errors.push(format!(
                "status must be one of: {}",
                VALID_STATUS_FILTERS.join(", ")
            ));
        }

        if !VALID_SORT_OPTIONS.contains(&self.sort.as_str()) {
            errors.push(format!(
                "sort must be one of: {}",
                VALID_SORT_OPTIONS.join(", ")
            ));
        }

        errors
    }

    /// Get normalized per_page value
    pub fn get_per_page(&self) -> i64 {
        self.per_page.clamp(1, 100)
    }

    /// Get normalized page value
    pub fn get_page(&self) -> u64 {
        self.page.max(1)
    }

    /// Calculate offset from page and per_page
    pub fn get_offset(&self) -> i64 {
        ((self.get_page() - 1) * (self.get_per_page() as u64)) as i64
    }
}

/// Query parameters for featured products
#[derive(Debug, Deserialize)]
pub struct FeaturedProductsQuery {
    #[serde(default = "default_featured_limit")]
    pub limit: i64,
}

fn default_featured_limit() -> i64 {
    8
}

impl FeaturedProductsQuery {
    /// Get normalized limit value (clamped to valid range)
    pub fn get_limit(&self) -> i64 {
        self.limit.clamp(1, 50)
    }
}

/// Query parameters for tags listing
#[derive(Debug, Deserialize)]
pub struct TagsQuery {
    #[serde(default = "default_tags_limit")]
    pub limit: Option<i64>,
}

fn default_tags_limit() -> Option<i64> {
    None
}

// ============================================================================
// REQUEST BODIES
// ============================================================================

/// Create store product request
#[derive(Debug, Deserialize)]
pub struct CreateStoreProductRequest {
    pub title: String,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub price_cents: i64,
    pub product_type: String,
    pub category_id: Option<i64>,
    pub cover_image_id: Option<i64>,

    // Rich metadata
    pub author_name: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub nearest_mountain: Option<String>,
    pub nearest_river: Option<String>,
    pub natural_park: Option<String>,
    pub altitude_meters: Option<i32>,
    pub season: Option<String>,
    pub weather_conditions: Option<String>,
    pub camera_info: Option<String>,
    pub date_taken: Option<NaiveDate>,

    // Location
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,

    // Status
    #[serde(default)]
    pub is_featured: bool,

    // Product items - one of these based on product_type
    pub picture_ids: Option<Vec<i64>>,
    pub gallery_id: Option<i64>,
}

impl CreateStoreProductRequest {
    /// Validate the request and return errors if any
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        errors.extend(validate_title(&self.title));
        errors.extend(validate_product_type(&self.product_type));
        errors.extend(validate_price(self.price_cents));

        if let Some(ref slug) = self.slug {
            errors.extend(validate_slug(slug));
        }

        if let Some(ref description) = self.description {
            if description.len() > 5000 {
                errors.push("description must be at most 5000 characters".to_string());
            }
        }

        if let Some(ref season) = self.season {
            errors.extend(validate_season(season));
        }

        if let Some(latitude) = self.latitude {
            errors.extend(validate_latitude(latitude));
        }

        if let Some(longitude) = self.longitude {
            errors.extend(validate_longitude(longitude));
        }

        // Validate product items based on type
        match self.product_type.as_str() {
            "single_image" => {
                if self.gallery_id.is_some() {
                    errors.push(
                        "gallery_id should not be provided for single_image product"
                            .to_string(),
                    );
                }
                if self.picture_ids.as_ref().map_or(true, |ids| ids.is_empty()) {
                    errors.push(
                        "picture_ids is required for single_image product".to_string(),
                    );
                }
            }
            "gallery" => {
                if self.picture_ids.is_some() {
                    errors.push(
                        "picture_ids should not be provided for gallery product".to_string(),
                    );
                }
                if self.gallery_id.is_none() {
                    errors.push("gallery_id is required for gallery product".to_string());
                }
            }
            "bundle" => {
                if self.gallery_id.is_some() {
                    errors.push(
                        "gallery_id should not be provided for bundle product".to_string(),
                    );
                }
                if self.picture_ids.as_ref().map_or(true, |ids| ids.len() < 2) {
                    errors.push(
                        "picture_ids must contain at least 2 pictures for bundle product"
                            .to_string(),
                    );
                }
            }
            _ => {}
        }

        // Validate author_name length if provided
        if let Some(ref author_name) = self.author_name {
            if author_name.len() > 255 {
                errors.push("author_name must be at most 255 characters".to_string());
            }
        }

        errors
    }

    /// Get the slug, generating from title if not provided
    pub fn get_slug(&self) -> String {
        self.slug.clone().unwrap_or_else(|| slugify(&self.title))
    }
}

/// Update store product request
#[derive(Debug, Deserialize)]
pub struct UpdateStoreProductRequest {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub price_cents: Option<i64>,
    pub product_type: Option<String>,
    pub category_id: Option<i64>,
    pub cover_image_id: Option<i64>,

    // Rich metadata
    pub author_name: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub region: Option<String>,
    pub nearest_mountain: Option<String>,
    pub nearest_river: Option<String>,
    pub natural_park: Option<String>,
    pub altitude_meters: Option<i32>,
    pub season: Option<String>,
    pub weather_conditions: Option<String>,
    pub camera_info: Option<String>,
    pub date_taken: Option<NaiveDate>,

    // Location
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub tags: Option<Vec<String>>,

    // Status
    pub is_active: Option<bool>,
    pub is_featured: Option<bool>,

    // Product items update
    pub picture_ids: Option<Vec<i64>>,
    pub gallery_id: Option<i64>,
}

impl UpdateStoreProductRequest {
    /// Validate the request and return errors if any
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if let Some(ref title) = self.title {
            errors.extend(validate_title(title));
        }

        if let Some(ref slug) = self.slug {
            errors.extend(validate_slug(slug));
        }

        if let Some(ref product_type) = self.product_type {
            errors.extend(validate_product_type(product_type));
        }

        if let Some(price_cents) = self.price_cents {
            errors.extend(validate_price(price_cents));
        }

        if let Some(ref description) = self.description {
            if description.len() > 5000 {
                errors.push("description must be at most 5000 characters".to_string());
            }
        }

        if let Some(ref season) = self.season {
            errors.extend(validate_season(season));
        }

        if let Some(latitude) = self.latitude {
            errors.extend(validate_latitude(latitude));
        }

        if let Some(longitude) = self.longitude {
            errors.extend(validate_longitude(longitude));
        }

        if let Some(ref author_name) = self.author_name {
            if author_name.len() > 255 {
                errors.push("author_name must be at most 255 characters".to_string());
            }
        }

        errors
    }
}

/// Query for admin gallery listing (helper endpoint)
#[derive(Debug, Deserialize)]
pub struct AdminGalleriesQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: i64,
    pub search: Option<String>,
    #[serde(default = "default_gallery_type")]
    pub gallery_type: String,
}

fn default_gallery_type() -> String {
    "geo_galleries".to_string()
}

impl AdminGalleriesQuery {
    /// Get normalized per_page value
    pub fn get_per_page(&self) -> i64 {
        self.per_page.clamp(1, 100)
    }

    /// Get normalized page value
    pub fn get_page(&self) -> u64 {
        self.page.max(1)
    }

    /// Calculate offset from page and per_page
    pub fn get_offset(&self) -> i64 {
        ((self.get_page() - 1) * (self.get_per_page() as u64)) as i64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Hello World"), "hello-world");
        assert_eq!(slugify("Test  Product"), "test-product");
        assert_eq!(slugify("  Leading Spaces"), "leading-spaces");
        assert_eq!(slugify("Trailing Spaces  "), "trailing-spaces");
        assert_eq!(slugify("Special!@#Characters"), "special-characters");
        assert_eq!(slugify("Already-valid-slug"), "already-valid-slug");
    }

    #[test]
    fn test_validate_title() {
        assert!(validate_title("Valid Title").is_empty());
        assert!(!validate_title("").is_empty());
        assert!(!validate_title("A").is_empty());
    }

    #[test]
    fn test_validate_slug() {
        assert!(validate_slug("valid-slug").is_empty());
        assert!(validate_slug("valid123").is_empty());
        assert!(!validate_slug("Invalid Slug").is_empty());
        assert!(!validate_slug("").is_empty());
        assert!(!validate_slug("a").is_empty());
    }

    #[test]
    fn test_validate_product_type() {
        assert!(validate_product_type("single_image").is_empty());
        assert!(validate_product_type("gallery").is_empty());
        assert!(validate_product_type("bundle").is_empty());
        assert!(!validate_product_type("invalid").is_empty());
    }

    #[test]
    fn test_validate_price() {
        assert!(validate_price(0).is_empty());
        assert!(validate_price(100).is_empty());
        assert!(!validate_price(-1).is_empty());
    }

    #[test]
    fn test_validate_season() {
        assert!(validate_season("spring").is_empty());
        assert!(validate_season("summer").is_empty());
        assert!(validate_season("autumn").is_empty());
        assert!(validate_season("winter").is_empty());
        assert!(validate_season("").is_empty()); // Empty is allowed (optional)
        assert!(!validate_season("invalid").is_empty());
    }

    #[test]
    fn test_list_products_query_pagination() {
        let query = ListProductsQuery {
            page: 2,
            per_page: 20,
            ..Default::default()
        };

        assert_eq!(query.get_page(), 2);
        assert_eq!(query.get_per_page(), 20);
        assert_eq!(query.get_offset(), 20);
    }

    #[test]
    fn test_list_products_query_tags() {
        let query = ListProductsQuery {
            tags: Some("nature, landscape, mountains".to_string()),
            ..Default::default()
        };

        let tags = query.get_tags().unwrap();
        assert_eq!(tags.len(), 3);
        assert_eq!(tags[0], "nature");
        assert_eq!(tags[1], "landscape");
        assert_eq!(tags[2], "mountains");
    }
}
