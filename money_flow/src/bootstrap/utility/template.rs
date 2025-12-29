//! Template Utility Functions
//!
//! Helper functions for use in templates (Tera).
//!
//! ## Asset Versioning
//!
//! All assets include a version query parameter (`?v=X.Y.Z`) to bust browser cache:
//! - **CSS/JS assets**: Use `AppConfig::assets_version()` - update when code changes
//! - **Image assets**: Use `AppConfig::images_assets_version()` - update when images change
//!
//! This prevents users from seeing stale cached files after deployments.
//!
//! ## Named Routes (Laravel-like)
//!
//! Use `route()` function in Tera templates to generate URLs from route names:
//!
//! ```html
//! <!-- Simple route -->
//! <a href="{{ route(name='web.sign_up') }}">Sign Up</a>
//!
//! <!-- Route with parameters -->
//! <a href="{{ route(name='user.show', id='123') }}">View User</a>
//!
//! <!-- Route with multiple parameters -->
//! <a href="{{ route(name='upload.chunked.chunk', uuid='abc', index='1') }}">Upload Chunk</a>
//! ```

use crate::config::{AppConfig, UploadConfig};
use crate::bootstrap::routes::controller::api::{route_with_lang, DEFAULT_LANG};
use serde::{Deserialize, Serialize};
use crate::database::read::upload as db_upload_read;
use sqlx::{Pool, Postgres};
use std::collections::HashMap;
use tera::{Function, Result as TeraResult, Value};
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

/// Asset type for determining which version to use
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AssetType {
    /// CSS, JavaScript files - uses assets_version
    Code,
    /// Images, media files - uses images_assets_version
    Image,
}

/// Generate URL for an asset by its stored filename
///
/// Automatically appends the appropriate version query parameter based on asset type.
/// For images (public visibility), uses `images_assets_version`.
/// For private assets, no version is appended (they go through API).
///
/// # Arguments
/// * `name` - The stored filename (e.g., "20251224_123456_uuid.jpg")
/// * `visibility` - "public" or "private"
///
/// # Returns
/// The full URL to access the asset with version parameter
///
/// # Example
/// ```rust
/// use money_flow::bootstrap::utility::template::assets;
///
/// // Public file - served by nginx at /storage/ with version
/// let url = assets("20251224_123456_uuid.jpg", "public");
/// // Returns: "/storage/20251224_123456_uuid.jpg?v=1.0.0"
///
/// // Private file - served by API (no version needed)
/// let url = assets("abc123-def456", "private");
/// // Returns: "/api/v1/upload/private/abc123-def456"
/// ```
pub fn assets(name: &str, visibility: &str) -> String {
    let vis = AssetVisibility::from_str(visibility).unwrap_or(AssetVisibility::Public);

    match vis {
        AssetVisibility::Public => {
            let version = AppConfig::images_assets_version();
            format!("{}/{}?v={}", UploadConfig::public_url_base(), name, version)
        }
        AssetVisibility::Private => {
            // Private assets go through API, no version needed
            format!("{}/{}", UploadConfig::private_url_base(), name)
        }
    }
}

/// Generate URL for an asset without version parameter
///
/// Use this when you need the raw URL without cache busting.
///
/// # Arguments
/// * `name` - The stored filename
/// * `visibility` - "public" or "private"
pub fn assets_raw(name: &str, visibility: &str) -> String {
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
/// The full URL to access the asset with version parameter, or None if not found
///
/// # Example
/// ```rust
/// use money_flow::bootstrap::utility::template::assets_by_uuid;
///
/// let url = assets_by_uuid(&db, "550e8400-e29b-41d4-a716-446655440000", "public").await;
/// // Returns: Some("/storage/filename.jpg?v=1.0.0")
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
            // Just return the API URL with the UUID (no version needed for API)
            return Some(format!("{}/{}", UploadConfig::private_url_base(), uuid_str));
        }
    };

    upload.map(|u| {
        // Extract just the filename from storage_path
        let filename = std::path::Path::new(&u.storage_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&u.stored_name);

        let version = AppConfig::images_assets_version();
        format!("{}/{}?v={}", UploadConfig::public_url_base(), filename, version)
    })
}

/// Generate URL for a public asset by its stored filename (with version)
/// Convenience wrapper for `assets(name, "public")`
pub fn asset(name: &str) -> String {
    assets(name, "public")
}

/// Generate URL for a private asset by UUID
/// Convenience wrapper for private asset access (no version needed for API)
/// Note: For avatars/profile pictures, use `avatar_asset()` instead
pub fn private_asset(uuid: &str) -> String {
    assets(uuid, "private")
}

/// Generate URL for an avatar/profile picture by UUID
/// Avatars have a dedicated endpoint: /api/v1/avatar/{uuid}
pub fn avatar_asset(uuid: &str) -> String {
    format!("/api/v1/avatar/{}", uuid)
}

/// Generate a versioned image URL
///
/// # Arguments
/// * `path` - The image path (e.g., "/storage/image.jpg" or "image.jpg")
///
/// # Returns
/// The URL with version query parameter
///
/// # Example
/// ```rust
/// use money_flow::bootstrap::utility::template::image_url;
///
/// let url = image_url("/storage/photo.jpg");
/// // Returns: "/storage/photo.jpg?v=1.0.0"
/// ```
pub fn image_url(path: &str) -> String {
    let version = AppConfig::images_assets_version();
    if path.contains('?') {
        format!("{}&v={}", path, version)
    } else {
        format!("{}?v={}", path, version)
    }
}

/// Generate a versioned code asset URL (CSS/JS)
///
/// # Arguments
/// * `path` - The asset path (e.g., "/assets/css/style.css")
///
/// # Returns
/// The URL with version query parameter
///
/// # Example
/// ```rust
/// use money_flow::bootstrap::utility::template::code_asset_url;
///
/// let url = code_asset_url("/assets/js/app.js");
/// // Returns: "/assets/js/app.js?v=1.0.43"
/// ```
pub fn code_asset_url(path: &str) -> String {
    let version = AppConfig::assets_version();
    if path.contains('?') {
        format!("{}&v={}", path, version)
    } else {
        format!("{}?v={}", path, version)
    }
}

/// Storage URL configuration helper
pub struct StorageUrls;

/// Page assets configuration
///
/// Contains paths to CSS and JavaScript files for a specific page.
/// Each page has its own Vite project in `src/frontend/pages/{PAGE_NAME}/`.
/// All paths include version query parameters for cache busting.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PageAssets {
    /// Path to the page's CSS file with version (e.g., "/assets/css/SIGN_UP/style.css?v=1.0.43")
    pub css_path: String,
    /// Path to the page's JavaScript file with version (e.g., "/assets/js/SIGN_UP/app.js?v=1.0.43")
    pub js_path: String,
    /// Current assets version string (e.g., "1.0.43")
    pub version: String,
}

impl PageAssets {
    /// Create a new PageAssets instance with versioned paths
    ///
    /// # Arguments
    /// * `css_path` - The URL path to the CSS file (version will be appended)
    /// * `js_path` - The URL path to the JavaScript file (version will be appended)
    pub fn new(css_path: String, js_path: String) -> Self {
        let version = AppConfig::assets_version().to_string();
        Self {
            css_path: format!("{}?v={}", css_path, version),
            js_path: format!("{}?v={}", js_path, version),
            version,
        }
    }

    /// Create a PageAssets instance without version parameters
    ///
    /// Use this for development or when you need raw paths.
    pub fn new_raw(css_path: String, js_path: String) -> Self {
        Self {
            css_path,
            js_path,
            version: AppConfig::assets_version().to_string(),
        }
    }

    /// Get the raw CSS path without version parameter
    pub fn css_path_raw(&self) -> String {
        self.css_path
            .split('?')
            .next()
            .unwrap_or(&self.css_path)
            .to_string()
    }

    /// Get the raw JS path without version parameter
    pub fn js_path_raw(&self) -> String {
        self.js_path
            .split('?')
            .next()
            .unwrap_or(&self.js_path)
            .to_string()
    }
}

/// Determine which CSS and JS files to load based on page name
///
/// Each page has its own Vite project in `money_flow/src/frontend/pages/{PAGE_NAME}/`.
/// This function generates the correct asset paths for the given page with version parameters.
///
/// # Arguments
/// * `page_name` - The name of the page (e.g., "SIGN_UP", "LOGIN", "DASHBOARD")
///
/// # Returns
/// A `PageAssets` struct containing the versioned CSS and JS paths for the page
///
/// # Example
/// ```rust
/// use money_flow::bootstrap::utility::template::determine_assets;
///
/// let assets = determine_assets("SIGN_UP");
/// // css_path: "/assets/css/SIGN_UP/style.css?v=1.0.43"
/// // js_path: "/assets/js/SIGN_UP/app.js?v=1.0.43"
/// ```
pub fn determine_assets(page_name: &str) -> PageAssets {
    assert!(!page_name.is_empty(), "page_name must not be empty");
    assert!(
        page_name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'),
        "page_name must contain only alphanumeric characters, underscores, or hyphens"
    );

    let css_path = format!("/assets/css/{}/style.css", page_name);
    let js_path = format!("/assets/js/{}/app.js", page_name);

    PageAssets::new(css_path, js_path)
}

/// Get the current assets version string (CSS/JS)
///
/// Useful for templates that need to construct URLs manually.
///
/// # Example
/// In Tera template:
/// ```html
/// <link rel="stylesheet" href="/assets/css/custom.css?v={{ assets_version }}">
/// ```
pub fn get_assets_version() -> &'static str {
    AppConfig::assets_version()
}

/// Get the current images assets version string
///
/// Useful for templates that need to construct image URLs manually.
///
/// # Example
/// In Tera template:
/// ```html
/// <img src="/storage/logo.png?v={{ images_version }}" alt="Logo">
/// ```
pub fn get_images_version() -> &'static str {
    AppConfig::images_assets_version()
}

impl StorageUrls {
    /// Get the base URL for public storage
    pub fn public_base() -> &'static str {
        UploadConfig::public_url_base()
    }

    /// Get the base URL for private storage API
    pub fn private_base() -> &'static str {
        UploadConfig::private_url_base()
    }

    /// Build a public file URL with version parameter
    pub fn public(filename: &str) -> String {
        let version = AppConfig::images_assets_version();
        format!("{}/{}?v={}", Self::public_base(), filename, version)
    }

    /// Build a public file URL without version parameter
    pub fn public_raw(filename: &str) -> String {
        format!("{}/{}", Self::public_base(), filename)
    }

    /// Build a private file URL (by UUID) - no version needed for API
    pub fn private(uuid: &str) -> String {
        format!("{}/{}", Self::private_base(), uuid)
    }
}

// ============================================
// Named Route Functions for Tera Templates
// ============================================

/// Tera function for generating URLs from named routes with language support
///
/// This function is registered with Tera and can be called from templates.
///
/// ## Usage in Templates
///
/// ```html
/// <!-- Simple route (no parameters, default language) -->
/// <a href="{{ route(name='web.sign_up') }}">Sign Up</a>
/// <a href="{{ route(name='auth.sign_in') }}">Sign In</a>
///
/// <!-- Route with language parameter -->
/// <a href="{{ route(name='web.sign_up', lang='it') }}">Registrati</a>
/// <a href="{{ route(name='web.sign_up', lang='fr') }}">S'inscrire</a>
///
/// <!-- Route with language from context variable -->
/// <a href="{{ route(name='web.sign_up', lang=current_lang) }}">Sign Up</a>
///
/// <!-- Route with a single parameter -->
/// <a href="{{ route(name='user.show', id='123') }}">View User 123</a>
///
/// <!-- Route with multiple parameters and language -->
/// <a href="{{ route(name='upload.chunked.chunk', uuid='abc-def', index='0', lang='it') }}">
///     Carica Chunk
/// </a>
///
/// <!-- Dynamic parameter from context -->
/// <a href="{{ route(name='user.show', id=user.id, lang=user.preferred_lang) }}">View Profile</a>
/// ```
///
/// ## Language Fallback
///
/// If a route is not registered for the requested language, it falls back to the
/// default language (English). This allows you to:
/// 1. Register only the default language routes
/// 2. Add localized routes only where needed
///
/// ## Available Routes
///
/// ### Web Routes
/// - `web.home` - Homepage (/)
/// - `web.sign_up` - Sign up page (/sign-up)
/// - `web.sign_in` - Sign in page (/sign-in)
/// - `web.forgot_password` - Forgot password page (/forgot-password)
/// - `web.profile` - Profile page (/profile)
/// - `web.logout` - Logout (/logout)
///
/// ### API Routes
/// - `auth.sign_up` - POST /api/v1/auth/sign-up
/// - `auth.sign_in` - POST /api/v1/auth/sign-in
/// - `user.current` - GET /api/v1/user
/// - `user.show` - GET /api/v1/user/{id}
/// - `upload.public` - POST /api/v1/upload/public
/// - (see routes/api.rs for complete list)
pub struct RouteFunction;

impl Function for RouteFunction {
    fn call(&self, args: &HashMap<String, Value>) -> TeraResult<Value> {
        // Get the route name (required)
        let name = match args.get("name") {
            Some(Value::String(s)) => s.clone(),
            Some(_) => return Err(tera::Error::msg("route() 'name' argument must be a string")),
            None => return Err(tera::Error::msg("route() requires a 'name' argument")),
        };

        // Get the language (optional, defaults to "en")
        let lang = match args.get("lang") {
            Some(Value::String(s)) => s.clone(),
            Some(Value::Null) | None => DEFAULT_LANG.to_string(),
            Some(_) => return Err(tera::Error::msg("route() 'lang' argument must be a string")),
        };

        // Collect all other arguments as route parameters (excluding name and lang)
        let mut params: HashMap<String, String> = HashMap::new();
        for (key, value) in args {
            if key == "name" || key == "lang" {
                continue;
            }
            let string_value = match value {
                Value::String(s) => s.clone(),
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                _ => continue, // Skip complex types
            };
            params.insert(key.clone(), string_value);
        }

        // Get the route URL with language support
        let params_ref = if params.is_empty() {
            None
        } else {
            Some(&params)
        };

        match route_with_lang(&name, &lang, params_ref) {
            Some(url) => Ok(Value::String(url)),
            None => Err(tera::Error::msg(format!(
                "route() unknown route name: '{}'. Check routes/api.rs or routes/web.rs",
                name
            ))),
        }
    }

    fn is_safe(&self) -> bool {
        true // The output is safe HTML (URL)
    }
}

/// Get a Tera Function for route URL generation
///
/// Use this to register the route function with your Tera instance:
///
/// ```rust,ignore
/// use money_flow::bootstrap::utility::template::make_route_function;
///
/// let mut tera = Tera::new("templates/**/*.html").unwrap();
/// tera.register_function("route", make_route_function());
/// ```
pub fn make_route_function() -> impl Function {
    RouteFunction
}

/// Convenience function to get a route URL by name (for use in Rust code)
///
/// Uses the default language (English).
///
/// # Arguments
/// * `name` - The route name (e.g., "web.sign_up", "user.show")
///
/// # Returns
/// The URL path for the route, or None if not found
///
/// # Example
/// ```rust,ignore
/// use money_flow::bootstrap::utility::template::route_by_name;
///
/// let url = route_by_name("web.sign_up");
/// // Returns: Some("/sign-up")
/// ```
pub fn route_by_name(name: &str) -> Option<String> {
    route_with_lang(name, DEFAULT_LANG, None)
}

/// Get a route URL by name with a specific language (for use in Rust code)
///
/// # Arguments
/// * `name` - The route name (e.g., "web.sign_up")
/// * `lang` - Language code (e.g., "en", "it", "fr")
///
/// # Returns
/// The URL path for the route in the specified language, or None if not found
///
/// # Example
/// ```rust,ignore
/// use money_flow::bootstrap::utility::template::route_by_name_lang;
///
/// let url = route_by_name_lang("web.sign_up", "it");
/// // Returns: Some("/registrazione")
/// ```
pub fn route_by_name_lang(name: &str, lang: &str) -> Option<String> {
    route_with_lang(name, lang, None)
}

/// Get a route URL with parameters (for use in Rust code)
///
/// Uses the default language (English).
///
/// # Arguments
/// * `name` - The route name (e.g., "user.show")
/// * `params` - HashMap of parameter name -> value
///
/// # Returns
/// The URL path with parameters substituted, or None if route not found
///
/// # Example
/// ```rust,ignore
/// use money_flow::bootstrap::utility::template::route_with_params;
/// use std::collections::HashMap;
///
/// let mut params = HashMap::new();
/// params.insert("id".to_string(), "123".to_string());
/// let url = route_with_params("user.show", &params);
/// // Returns: Some("/api/v1/user/123")
/// ```
pub fn route_with_params(name: &str, params: &HashMap<String, String>) -> Option<String> {
    route_with_lang(name, DEFAULT_LANG, Some(params))
}

/// Get a route URL with parameters and language (for use in Rust code)
///
/// # Arguments
/// * `name` - The route name (e.g., "user.show")
/// * `lang` - Language code (e.g., "en", "it", "fr")
/// * `params` - HashMap of parameter name -> value
///
/// # Returns
/// The URL path with parameters substituted, or None if route not found
///
/// # Example
/// ```rust,ignore
/// use money_flow::bootstrap::utility::template::route_with_params_lang;
/// use std::collections::HashMap;
///
/// let mut params = HashMap::new();
/// params.insert("id".to_string(), "123".to_string());
/// let url = route_with_params_lang("user.show", "it", &params);
/// // Returns: Some("/api/v1/utente/123")
/// ```
pub fn route_with_params_lang(name: &str, lang: &str, params: &HashMap<String, String>) -> Option<String> {
    route_with_lang(name, lang, Some(params))
}

/// Register all template functions with a Tera instance
///
/// Call this function during Tera initialization to register all
/// template helper functions including the route() function.
///
/// # Arguments
/// * `tera` - Mutable reference to the Tera instance
///
/// # Example
/// ```rust,ignore
/// use money_flow::bootstrap::utility::template::register_template_functions;
///
/// let mut tera = Tera::new("templates/**/*.html").unwrap();
/// register_template_functions(&mut tera);
/// ```
pub fn register_template_functions(tera: &mut tera::Tera) {
    // Register the route() function for URL generation
    tera.register_function("route", make_route_function());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_assets_public_has_version() {
        let url = assets("test.jpg", "public");
        assert!(url.contains("?v="));
        assert!(url.contains("test.jpg"));
    }

    #[test]
    fn test_assets_private_no_version() {
        let url = assets("abc123", "private");
        assert!(url.contains("/api/v1/upload/private/"));
        assert!(url.contains("abc123"));
        // Private assets go through API, shouldn't have version
        assert!(!url.contains("?v="));
    }

    #[test]
    fn test_assets_raw_no_version() {
        let url = assets_raw("test.jpg", "public");
        assert!(!url.contains("?v="));
        assert!(url.contains("test.jpg"));
    }

    #[test]
    fn test_asset_visibility_from_str() {
        assert_eq!(AssetVisibility::from_str("public"), Some(AssetVisibility::Public));
        assert_eq!(AssetVisibility::from_str("PRIVATE"), Some(AssetVisibility::Private));
        assert_eq!(AssetVisibility::from_str("invalid"), None);
    }

    #[test]
    fn test_determine_assets_has_version() {
        let assets = determine_assets("SIGN_UP");
        assert!(assets.css_path.contains("?v="));
        assert!(assets.js_path.contains("?v="));
        assert!(assets.css_path.starts_with("/assets/css/SIGN_UP/style.css"));
        assert!(assets.js_path.starts_with("/assets/js/SIGN_UP/app.js"));
    }

    #[test]
    fn test_determine_assets_login() {
        let assets = determine_assets("LOGIN");
        assert!(assets.css_path.starts_with("/assets/css/LOGIN/style.css"));
        assert!(assets.js_path.starts_with("/assets/js/LOGIN/app.js"));
    }

    #[test]
    fn test_determine_assets_dashboard() {
        let assets = determine_assets("DASHBOARD");
        assert!(assets.css_path.starts_with("/assets/css/DASHBOARD/style.css"));
        assert!(assets.js_path.starts_with("/assets/js/DASHBOARD/app.js"));
    }

    #[test]
    fn test_page_assets_raw_paths() {
        let assets = determine_assets("SIGN_UP");
        assert_eq!(assets.css_path_raw(), "/assets/css/SIGN_UP/style.css");
        assert_eq!(assets.js_path_raw(), "/assets/js/SIGN_UP/app.js");
    }

    #[test]
    fn test_image_url_adds_version() {
        let url = image_url("/storage/photo.jpg");
        assert!(url.contains("?v="));
        assert!(url.starts_with("/storage/photo.jpg"));
    }

    #[test]
    fn test_image_url_with_existing_query() {
        let url = image_url("/storage/photo.jpg?size=large");
        assert!(url.contains("&v="));
        assert!(url.starts_with("/storage/photo.jpg?size=large"));
    }

    #[test]
    fn test_code_asset_url_adds_version() {
        let url = code_asset_url("/assets/js/app.js");
        assert!(url.contains("?v="));
        assert!(url.starts_with("/assets/js/app.js"));
    }

    #[test]
    fn test_storage_urls_public_has_version() {
        let url = StorageUrls::public("image.jpg");
        assert!(url.contains("?v="));
    }

    #[test]
    fn test_storage_urls_public_raw_no_version() {
        let url = StorageUrls::public_raw("image.jpg");
        assert!(!url.contains("?v="));
    }

    #[test]
    fn test_storage_urls_private_no_version() {
        let url = StorageUrls::private("uuid-123");
        assert!(!url.contains("?v="));
    }

    #[test]
    fn test_page_assets_new_raw() {
        let assets = PageAssets::new_raw(
            "/assets/css/test/style.css".to_string(),
            "/assets/js/test/app.js".to_string(),
        );
        assert_eq!(assets.css_path, "/assets/css/test/style.css");
        assert_eq!(assets.js_path, "/assets/js/test/app.js");
        // Version field should still be populated
        assert!(!assets.version.is_empty());
    }

    #[test]
    fn test_get_versions() {
        let assets_v = get_assets_version();
        let images_v = get_images_version();
        // Both should return non-empty strings
        assert!(!assets_v.is_empty());
        assert!(!images_v.is_empty());
    }

    #[test]
    #[should_panic(expected = "page_name must not be empty")]
    fn test_determine_assets_empty_panics() {
        determine_assets("");
    }

    #[test]
    #[should_panic(expected = "page_name must contain only alphanumeric characters")]
    fn test_determine_assets_invalid_chars_panics() {
        determine_assets("page/name");
    }

    #[test]
    #[should_panic(expected = "page_name must contain only alphanumeric characters")]
    fn test_determine_assets_spaces_panics() {
        determine_assets("page name");
    }
}
