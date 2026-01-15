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

use crate::bootstrap::routes::controller::api::{route_with_lang, DEFAULT_LANG};
use crate::config::{AppConfig, UploadConfig};
use crate::database::read::upload as db_upload_read;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Map as JsonMap;
use sqlx::{Pool, Postgres};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tera::{Function, Result as TeraResult, Value};
use uuid::Uuid;

const DEFAULT_LOCALE: &str = "en_US";

static LOCALIZATION_CACHE: Lazy<Mutex<HashMap<String, Value>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

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
/// * `variant` - Optional image variant ("thumb", "small", "medium", "large", "full")
///
/// # Returns
/// The full URL to access the asset with version parameter
///
/// # Example
/// ```rust
/// use blazing_sun::bootstrap::utility::template::assets_with_variant;
///
/// // Public file - served by nginx at /storage/ with version
/// let url = assets_with_variant("20251224_123456_uuid.jpg", "public", None);
/// // Returns: "/storage/20251224_123456_uuid.jpg?v=1.0.0"
///
/// // Public file with variant
/// let url = assets_with_variant("20251224_123456_uuid.jpg", "public", Some("thumb"));
/// // Returns: "/storage/20251224_123456_uuid_thumb.jpg?v=1.0.0"
///
/// // Private file - served by API (no version needed)
/// let url = assets_with_variant("abc123-def456", "private", None);
/// // Returns: "/api/v1/upload/private/abc123-def456"
/// ```
pub fn assets_with_variant(name: &str, visibility: &str, variant: Option<&str>) -> String {
    let vis = AssetVisibility::from_str(visibility).unwrap_or(AssetVisibility::Public);

    match vis {
        AssetVisibility::Public => {
            let filename = if let Some(variant_name) = variant {
                // For variants, insert variant name before extension
                // e.g., "image.jpg" -> "image_thumb.jpg"
                if let Some(dot_index) = name.rfind('.') {
                    let base = &name[..dot_index];
                    let ext = &name[dot_index..];
                    format!("{}_{}{}", base, variant_name, ext)
                } else {
                    // No extension found, just append variant
                    format!("{}_{}", name, variant_name)
                }
            } else {
                name.to_string()
            };

            let version = AppConfig::images_assets_version();
            format!(
                "{}/{}?v={}",
                UploadConfig::public_url_base(),
                filename,
                version
            )
        }
        AssetVisibility::Private => {
            // Private assets go through API, no version needed
            // Variants are not supported for private assets (they're served by API)
            format!("{}/{}", UploadConfig::private_url_base(), name)
        }
    }
}

/// Generate URL for an asset by its stored filename (legacy function, no variant support)
///
/// This is the old signature for backward compatibility.
/// For new code with variant support, use `assets_with_variant()`.
pub fn assets(name: &str, visibility: &str) -> String {
    assets_with_variant(name, visibility, None)
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
/// use blazing_sun::bootstrap::utility::template::assets_by_uuid;
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
        format!(
            "{}/{}?v={}",
            UploadConfig::public_url_base(),
            filename,
            version
        )
    })
}

/// Generate URL for an asset by its database ID (NEW UNIFIED APPROACH)
///
/// This is the new unified asset rendering function that replaces the need to know
/// storage_type in advance. It automatically:
/// 1. Fetches the upload record from database by ID
/// 2. Determines if it's public or private from storage_type field
/// 3. Generates the appropriate URL with variant support
///
/// # Arguments
/// * `db` - Database connection pool
/// * `upload_id` - The database ID of the upload record
/// * `variant` - Optional image variant ("thumb", "small", "medium", "large", "full")
///
/// # Returns
/// The full URL to access the asset with variant and version parameters, or None if not found
///
/// # Usage Pattern (Controllers → Templates)
///
/// Since this function is async (requires database access), it cannot be called directly
/// from Tera templates. Instead:
///
/// 1. **Controllers** call this function to generate URLs
/// 2. **Templates** receive pre-generated URLs in context variables
///
/// ## Example in Controller
/// ```rust
/// use blazing_sun::bootstrap::utility::template::asset_by_id;
///
/// // Generate logo URL from ID
/// if let Some(logo_id) = site_config.logo_id {
///     if let Some(logo_url) = asset_by_id(&db, logo_id, Some("medium")).await {
///         context.insert("logo_url", &logo_url);
///     }
/// }
///
/// // Generate avatar URL from ID
/// if let Some(avatar_id) = user.avatar_id {
///     if let Some(avatar_url) = asset_by_id(&db, avatar_id, Some("small")).await {
///         context.insert("avatar_url", &avatar_url);
///     }
/// }
/// ```
///
/// ## Example in Template
/// ```html
/// <!-- Template just uses the pre-generated URL -->
/// {% if logo_url %}
/// <img src="{{ logo_url }}" alt="Logo">
/// {% endif %}
///
/// {% if avatar_url %}
/// <img src="{{ avatar_url }}" alt="Avatar">
/// {% endif %}
/// ```
///
/// # URL Format
/// The generated URL uses the UUID-based API endpoint format:
/// - `/api/v1/upload/{storage_type}/{uuid}?variant={variant}`
///
/// This format:
/// - Works for both public and private images
/// - Automatically handles authentication for private images
/// - Supports variant parameter for responsive images
/// - The API endpoint handles serving the correct variant file
///
/// # Why This Approach?
/// 1. **Single source of truth**: storage_type lives in the database
/// 2. **Automatic routing**: public/private determined dynamically
/// 3. **Variant support**: built-in responsive image support
/// 4. **Consistent URLs**: same format for all images regardless of visibility
/// 5. **Future-proof**: easy to add new storage types (S3, CDN, etc.)
/// 6. **No template complexity**: Templates receive simple URL strings
pub async fn asset_by_id(
    db: &Pool<Postgres>,
    upload_id: i64,
    variant: Option<&str>,
) -> Option<String> {
    // Fetch upload record from database
    let upload = db_upload_read::get_by_id(db, upload_id).await.ok()?;

    // Build URL with storage_type, UUID, and optional variant
    let variant_param = variant
        .map(|v| format!("?variant={}", v))
        .unwrap_or_default();

    // Generate correct URL format based on storage type
    // Public: /api/v1/upload/download/public/{uuid}
    // Private: /api/v1/upload/private/{uuid}
    let url = match upload.storage_type.as_str() {
        "public" => format!(
            "/api/v1/upload/download/public/{}{}",
            upload.uuid, variant_param
        ),
        "private" => format!("/api/v1/upload/private/{}{}", upload.uuid, variant_param),
        _ => return None, // Unknown storage type
    };

    Some(url)
}

/// Generate URL for an asset by its database ID with fallback
///
/// Similar to `asset_by_id()` but returns a default URL if the asset is not found.
/// Useful in templates where you always want to display something.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `upload_id` - The database ID of the upload record
/// * `variant` - Optional image variant ("thumb", "small", "medium", "large", "full")
/// * `fallback` - Default URL to return if asset not found
///
/// # Returns
/// The asset URL, or the fallback URL if asset not found
///
/// # Example
/// ```rust
/// use blazing_sun::bootstrap::utility::template::asset_by_id_or;
///
/// // With fallback to placeholder
/// let url = asset_by_id_or(&db, 123, Some("small"), "/images/placeholder.png").await;
/// ```
pub async fn asset_by_id_or(
    db: &Pool<Postgres>,
    upload_id: i64,
    variant: Option<&str>,
    fallback: &str,
) -> String {
    asset_by_id(db, upload_id, variant)
        .await
        .unwrap_or_else(|| fallback.to_string())
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

/// Generate URL for an avatar/profile picture by upload ID
///
/// Avatars use a dedicated endpoint `/api/v1/avatar/{uuid}` that handles both
/// public and private storage transparently. This ensures avatars work regardless
/// of their storage_type in the database.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `upload_id` - The database ID of the upload record
/// * `variant` - Optional image variant ("thumb", "small", "medium", "large", "full")
///
/// # Returns
/// The avatar URL, or None if upload not found
///
/// # Example
/// ```rust
/// use blazing_sun::bootstrap::utility::template::avatar_by_id;
///
/// // Get avatar URL with variant
/// let url = avatar_by_id(&db, 123, Some("small")).await;
/// // Returns: Some("/api/v1/avatar/550e8400-e29b-41d4-a716-446655440000?variant=small")
/// ```
pub async fn avatar_by_id(
    db: &Pool<Postgres>,
    upload_id: i64,
    variant: Option<&str>,
) -> Option<String> {
    // Fetch upload record from database
    let upload = db_upload_read::get_by_id(db, upload_id).await.ok()?;

    // Build avatar URL with UUID and optional variant
    let variant_param = variant
        .map(|v| format!("?variant={}", v))
        .unwrap_or_default();

    Some(format!(
        "/api/v1/avatar/{}{}",
        upload.uuid,   // UUID for avatar endpoint
        variant_param  // "?variant=thumb" or empty
    ))
}

/// Generate URL for an avatar/profile picture by upload ID with fallback
///
/// Similar to `avatar_by_id()` but returns a default URL if the avatar is not found.
///
/// # Arguments
/// * `db` - Database connection pool
/// * `upload_id` - The database ID of the upload record
/// * `variant` - Optional image variant ("thumb", "small", "medium", "large", "full")
/// * `fallback` - Default URL to return if avatar not found
///
/// # Returns
/// The avatar URL, or the fallback URL if avatar not found
pub async fn avatar_by_id_or(
    db: &Pool<Postgres>,
    upload_id: i64,
    variant: Option<&str>,
    fallback: &str,
) -> String {
    avatar_by_id(db, upload_id, variant)
        .await
        .unwrap_or_else(|| fallback.to_string())
}

/// Generate URL for a public upload by stored filename (with version for cache busting)
///
/// Public uploads are served directly by nginx from /storage/.
/// This is used for branding images (logo, favicon) and other public uploads.
///
/// # Arguments
/// * `stored_name` - The stored filename (e.g., "20251230_234337_9eaca06b-8ed7-4453-8eb3-d818d5401383.png")
///
/// # Returns
/// The full URL to access the public file with version parameter
///
/// # Example
/// ```rust
/// use blazing_sun::bootstrap::utility::template::public_upload_url;
///
/// let url = public_upload_url("20251230_234337_9eaca06b-8ed7-4453-8eb3-d818d5401383.png");
/// // Returns: "/storage/20251230_234337_9eaca06b-8ed7-4453-8eb3-d818d5401383.png?v=1.0.0"
/// ```
pub fn public_upload_url(stored_name: &str) -> String {
    let version = AppConfig::images_assets_version();
    format!(
        "{}/{}?v={}",
        UploadConfig::public_url_base(),
        stored_name,
        version
    )
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
/// use blazing_sun::bootstrap::utility::template::image_url;
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
/// use blazing_sun::bootstrap::utility::template::code_asset_url;
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
/// Each page has its own Vite project in `blazing_sun/src/frontend/pages/{PAGE_NAME}/`.
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
/// use blazing_sun::bootstrap::utility::template::determine_assets;
///
/// let assets = determine_assets("SIGN_UP");
/// // css_path: "/assets/css/SIGN_UP/style.css?v=1.0.43"
/// // js_path: "/assets/js/SIGN_UP/app.js?v=1.0.43"
/// ```
pub fn determine_assets(page_name: &str) -> PageAssets {
    assert!(!page_name.is_empty(), "page_name must not be empty");
    assert!(
        page_name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'),
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
/// use blazing_sun::bootstrap::utility::template::make_route_function;
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
/// use blazing_sun::bootstrap::utility::template::route_by_name;
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
/// use blazing_sun::bootstrap::utility::template::route_by_name_lang;
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
/// use blazing_sun::bootstrap::utility::template::route_with_params;
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
/// use blazing_sun::bootstrap::utility::template::route_with_params_lang;
/// use std::collections::HashMap;
///
/// let mut params = HashMap::new();
/// params.insert("id".to_string(), "123".to_string());
/// let url = route_with_params_lang("user.show", "it", &params);
/// // Returns: Some("/api/v1/utente/123")
/// ```
pub fn route_with_params_lang(
    name: &str,
    lang: &str,
    params: &HashMap<String, String>,
) -> Option<String> {
    route_with_lang(name, lang, Some(params))
}

/// Tera function for generating asset URLs
///
/// This function is registered with Tera and can be called from templates.
///
/// ## Usage in Templates
///
/// ```html
/// <!-- Public asset (served by nginx from /storage/) -->
/// <img src="{{ assets(name='image.png', visibility='public') }}" alt="Image">
///
/// <!-- Public asset with responsive variant -->
/// <img src="{{ assets(name='image.png', visibility='public', variant='thumb') }}" alt="Thumbnail">
/// <img src="{{ assets(name='image.png', visibility='public', variant='small') }}" alt="Small">
/// <img src="{{ assets(name='image.png', visibility='public', variant='medium') }}" alt="Medium">
/// <img src="{{ assets(name='image.png', visibility='public', variant='large') }}" alt="Large">
/// <img src="{{ assets(name='image.png', visibility='public', variant='full') }}" alt="Full">
///
/// <!-- With variable -->
/// <img src="{{ assets(name=logo_stored_name, visibility='public') }}" alt="Logo">
/// ```
pub struct AssetsFunction;

impl Function for AssetsFunction {
    fn call(&self, args: &HashMap<String, Value>) -> TeraResult<Value> {
        // Get the asset name (required)
        let name = match args.get("name") {
            Some(Value::String(s)) => s.clone(),
            Some(Value::Null) | None => return Ok(Value::String(String::new())),
            Some(_) => {
                return Err(tera::Error::msg(
                    "assets() 'name' argument must be a string",
                ))
            }
        };

        // Get visibility (optional, defaults to "public")
        let visibility = match args.get("visibility") {
            Some(Value::String(s)) => s.clone(),
            Some(Value::Null) | None => "public".to_string(),
            Some(_) => {
                return Err(tera::Error::msg(
                    "assets() 'visibility' argument must be a string",
                ))
            }
        };

        // Get variant (optional, for responsive images)
        let variant = match args.get("variant") {
            Some(Value::String(s)) => Some(s.as_str()),
            Some(Value::Null) | None => None,
            Some(_) => {
                return Err(tera::Error::msg(
                    "assets() 'variant' argument must be a string",
                ))
            }
        };

        // Generate the URL
        let url = assets_with_variant(&name, &visibility, variant);
        Ok(Value::String(url))
    }

    fn is_safe(&self) -> bool {
        true // The output is safe HTML (URL)
    }
}

/// Get a Tera Function for asset URL generation
pub fn make_assets_function() -> impl Function {
    AssetsFunction
}

/// Tera function for translating localization keys using JSON files.
struct TranslateFunction;

impl Function for TranslateFunction {
    fn call(&self, args: &HashMap<String, Value>) -> TeraResult<Value> {
        let key = match args.get("key") {
            Some(Value::String(value)) => value.to_string(),
            _ => {
                return Err(tera::Error::msg(
                    "translate() requires a string 'key' argument",
                ));
            }
        };

        let locale = match args.get("locale") {
            Some(Value::String(value)) => value.to_string(),
            _ => DEFAULT_LOCALE.to_string(),
        };

        let form = match args.get("form") {
            Some(Value::String(value)) => value.as_str(),
            _ => "singular",
        };

        let args_map = match args.get("args") {
            Some(Value::Object(map)) => map.clone(),
            _ => JsonMap::new(),
        };

        let entry = get_localized_entry(&locale, &key)
            .or_else(|| get_localized_entry(DEFAULT_LOCALE, &key));

        let template = match entry {
            Some(value) => {
                let chosen = if form == "plural" {
                    "plural"
                } else {
                    "singular"
                };
                value
                    .get(chosen)
                    .and_then(|v| v.as_str())
                    .map(|text| text.to_string())
                    .unwrap_or_else(|| key.clone())
            }
            None => key.clone(),
        };

        let translated = replace_template_args(&template, &args_map);
        Ok(Value::String(translated))
    }

    fn is_safe(&self) -> bool {
        true
    }
}

/// Get a Tera Function for translate() usage.
pub fn make_translate_function() -> impl Function {
    TranslateFunction
}

fn get_localized_entry(locale: &str, key: &str) -> Option<Value> {
    let data = load_locale_file(locale)?;
    data.get(key).cloned()
}

fn load_locale_file(locale: &str) -> Option<Value> {
    let mut cache = LOCALIZATION_CACHE.lock().ok()?;
    if let Some(value) = cache.get(locale) {
        return Some(value.clone());
    }

    // Try exact match first (e.g., "sr_RS.json")
    let path = localization_path(locale);
    if let Ok(contents) = fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<Value>(&contents) {
            cache.insert(locale.to_string(), json.clone());
            return Some(json);
        }
    }

    // If locale is a short code (2 chars), try to find matching locale file
    // e.g., "sr" should match "sr_RS.json"
    if locale.len() == 2 {
        if let Some(full_locale) = find_locale_for_language(locale) {
            let path = localization_path(&full_locale);
            if let Ok(contents) = fs::read_to_string(&path) {
                if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                    // Cache under both short code and full locale
                    cache.insert(locale.to_string(), json.clone());
                    cache.insert(full_locale, json.clone());
                    return Some(json);
                }
            }
        }
    }

    None
}

/// Find a full locale code for a short language code
/// e.g., "sr" -> "sr_RS", "en" -> "en_US"
fn find_locale_for_language(lang: &str) -> Option<String> {
    let localization_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("resources")
        .join("localization");

    if let Ok(entries) = fs::read_dir(&localization_dir) {
        for entry in entries.flatten() {
            let file_name = entry.file_name();
            let name = file_name.to_string_lossy();
            // Match files like "sr_RS.json" for language "sr"
            if name.starts_with(lang) && name.ends_with(".json") {
                let locale = name.trim_end_matches(".json");
                return Some(locale.to_string());
            }
        }
    }

    None
}

fn localization_path(locale: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("src")
        .join("resources")
        .join("localization")
        .join(format!("{}.json", locale))
}

fn replace_template_args(template: &str, args: &JsonMap<String, Value>) -> String {
    let mut result = template.to_string();
    for (key, value) in args {
        let replacement = match value {
            Value::String(text) => text.clone(),
            Value::Number(number) => number.to_string(),
            Value::Bool(flag) => flag.to_string(),
            _ => value.to_string(),
        };
        let placeholder = format!("##{}##", key);
        result = result.replace(&placeholder, &replacement);
    }
    result
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
/// use blazing_sun::bootstrap::utility::template::register_template_functions;
///
/// let mut tera = Tera::new("templates/**/*.html").unwrap();
/// register_template_functions(&mut tera);
/// ```
pub fn register_template_functions(tera: &mut tera::Tera) {
    // Register the route() function for URL generation
    tera.register_function("route", make_route_function());
    // Register the assets() function for asset URL generation
    tera.register_function("assets", make_assets_function());
    // Register the translate() function for localization strings
    tera.register_function("translate", make_translate_function());
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
        assert_eq!(
            AssetVisibility::from_str("public"),
            Some(AssetVisibility::Public)
        );
        assert_eq!(
            AssetVisibility::from_str("PRIVATE"),
            Some(AssetVisibility::Private)
        );
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
        assert!(assets
            .css_path
            .starts_with("/assets/css/DASHBOARD/style.css"));
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

    // Note: Tests for asset_by_id() and asset_by_id_or() require database access
    // and are implemented as integration tests in tests/routes/api/UPLOAD/
    // These functions are tested as part of the full upload flow:
    // 1. Upload image with public or private storage_type
    // 2. Store ID in user.avatar_id or site_config.logo_id
    // 3. Call asset_by_id(db, id, variant) to generate URL
    // 4. Verify URL format matches /api/v1/upload/{storage_type}/{uuid}?variant={variant}
    // 5. Verify URL works and serves correct variant
}
