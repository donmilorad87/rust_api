//! Store Category Validators
//!
//! Validation rules for store category API requests.

use regex::Regex;
use serde::Deserialize;
use std::sync::LazyLock;

/// Regex for valid slug characters (lowercase letters, numbers, hyphens)
static SLUG_REGEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[a-z0-9]+(?:-[a-z0-9]+)*$").unwrap());

/// Validate category name
///
/// Name must:
/// - Be at least 2 characters
/// - Be at most 100 characters
pub fn validate_name(name: &str) -> Vec<String> {
    let mut errors = Vec::new();

    if name.is_empty() {
        errors.push("name is required".to_string());
        return errors;
    }

    if name.len() < 2 {
        errors.push("name must be at least 2 characters".to_string());
    }

    if name.len() > 100 {
        errors.push("name must be at most 100 characters".to_string());
    }

    errors
}

/// Validate category slug
///
/// Slug must:
/// - Be at least 2 characters
/// - Be at most 100 characters
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

    if slug.len() > 100 {
        errors.push("slug must be at most 100 characters".to_string());
    }

    if !SLUG_REGEX.is_match(slug) {
        errors.push("slug must contain only lowercase letters, numbers, and hyphens".to_string());
    }

    errors
}

/// Generate a slug from a name
///
/// Converts name to lowercase, replaces spaces with hyphens,
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

/// Create store category request
#[derive(Debug, Deserialize)]
pub struct CreateStoreCategoryRequest {
    pub name: String,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub cover_image_id: Option<i64>,
    #[serde(default)]
    pub display_order: i32,
}

impl CreateStoreCategoryRequest {
    /// Validate the request and return errors if any
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        errors.extend(validate_name(&self.name));

        if let Some(ref slug) = self.slug {
            errors.extend(validate_slug(slug));
        }

        if let Some(ref description) = self.description {
            if description.len() > 1000 {
                errors.push("description must be at most 1000 characters".to_string());
            }
        }

        errors
    }

    /// Get the slug, generating from name if not provided
    pub fn get_slug(&self) -> String {
        self.slug.clone().unwrap_or_else(|| slugify(&self.name))
    }
}

/// Update store category request
#[derive(Debug, Deserialize)]
pub struct UpdateStoreCategoryRequest {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub cover_image_id: Option<i64>,
    pub display_order: Option<i32>,
    pub is_active: Option<bool>,
}

impl UpdateStoreCategoryRequest {
    /// Validate the request and return errors if any
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if let Some(ref name) = self.name {
            errors.extend(validate_name(name));
        }

        if let Some(ref slug) = self.slug {
            errors.extend(validate_slug(slug));
        }

        if let Some(ref description) = self.description {
            if description.len() > 1000 {
                errors.push("description must be at most 1000 characters".to_string());
            }
        }

        errors
    }
}

/// Reorder categories request
#[derive(Debug, Deserialize)]
pub struct ReorderCategoriesRequest {
    pub category_ids: Vec<i64>,
}

impl ReorderCategoriesRequest {
    /// Validate the request and return errors if any
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if self.category_ids.is_empty() {
            errors.push("category_ids is required and cannot be empty".to_string());
        }

        // Check for duplicates
        let mut seen = std::collections::HashSet::new();
        for id in &self.category_ids {
            if !seen.insert(*id) {
                errors.push(format!("duplicate category_id: {}", id));
            }
        }

        errors
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Hello World"), "hello-world");
        assert_eq!(slugify("Test  Category"), "test-category");
        assert_eq!(slugify("  Leading Spaces"), "leading-spaces");
        assert_eq!(slugify("Trailing Spaces  "), "trailing-spaces");
        assert_eq!(slugify("Special!@#Characters"), "special-characters");
        assert_eq!(slugify("Already-valid-slug"), "already-valid-slug");
    }

    #[test]
    fn test_validate_name() {
        assert!(validate_name("Valid Name").is_empty());
        assert!(!validate_name("").is_empty());
        assert!(!validate_name("A").is_empty());
    }

    #[test]
    fn test_validate_slug() {
        assert!(validate_slug("valid-slug").is_empty());
        assert!(validate_slug("valid123").is_empty());
        assert!(!validate_slug("Invalid Slug").is_empty());
        assert!(!validate_slug("").is_empty());
        assert!(!validate_slug("a").is_empty());
    }
}
