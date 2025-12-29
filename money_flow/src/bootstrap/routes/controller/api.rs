//!
//! Route Registry Controller
//!
//! This module provides route registration and URL generation utilities
//! with support for multiple languages (i18n).
//!
//! ## Laravel-like Named Routes with Language Support
//!
//! Routes can be registered with language variants:
//!
//! ```rust,ignore
//! // Default language (en)
//! route!("web.sign_up", "/sign-up");
//!
//! // Specific language
//! route!("web.sign_up", "/registrazione", "it");
//! route!("web.sign_up", "/inscription", "fr");
//! ```
//!
//! Then retrieve URLs with language:
//!
//! ```rust,ignore
//! // Get URL for specific language
//! let url = route_with_lang("web.sign_up", "it", None);
//! // Returns: Some("/registrazione")
//!
//! // Default language (en)
//! let url = route("web.sign_up", None);
//! // Returns: Some("/sign-up")
//! ```

use std::collections::HashMap;
use std::sync::RwLock;

/// Default language code
pub const DEFAULT_LANG: &str = "en";

/// Global route registry for named routes
/// Structure: name -> (lang -> path)
static ROUTE_REGISTRY: RwLock<Option<HashMap<String, HashMap<String, String>>>> = RwLock::new(None);

/// Initialize the route registry
pub fn init_registry() {
    let mut registry = ROUTE_REGISTRY.write().unwrap();
    if registry.is_none() {
        *registry = Some(HashMap::new());
    }
}

/// Register a named route with a specific language
///
/// # Arguments
/// * `name` - Route name (e.g., "web.sign_up")
/// * `path` - URL path (e.g., "/sign-up")
/// * `lang` - Language code (e.g., "en", "it", "fr")
///
/// # Example
/// ```rust,ignore
/// register_route_with_lang("web.sign_up", "/sign-up", "en");
/// register_route_with_lang("web.sign_up", "/registrazione", "it");
/// ```
pub fn register_route_with_lang(name: &str, path: &str, lang: &str) {
    init_registry();
    if let Ok(mut registry) = ROUTE_REGISTRY.write() {
        if let Some(ref mut map) = *registry {
            let lang_map = map.entry(name.to_string()).or_insert_with(HashMap::new);
            lang_map.insert(lang.to_string(), path.to_string());
        }
    }
}

/// Register a named route with default language (en)
///
/// # Arguments
/// * `name` - Route name (e.g., "web.sign_up")
/// * `path` - URL path (e.g., "/sign-up")
///
/// # Example
/// ```rust,ignore
/// register_route("web.sign_up", "/sign-up");
/// ```
pub fn register_route(name: &str, path: &str) {
    register_route_with_lang(name, path, DEFAULT_LANG);
}

/// Get a route URL by name and language, with optional parameters
///
/// # Arguments
/// * `name` - Route name (e.g., "web.sign_up")
/// * `lang` - Language code (e.g., "en", "it")
/// * `params` - Optional parameters to substitute in the URL
///
/// # Example
/// ```rust,ignore
/// // Simple route with language
/// let url = route_with_lang("web.sign_up", "it", None);
/// // Returns: Some("/registrazione")
///
/// // Route with parameters
/// let mut params = HashMap::new();
/// params.insert("id".to_string(), "123".to_string());
/// let url = route_with_lang("user.show", "en", Some(&params));
/// // Returns: Some("/api/v1/user/123")
/// ```
pub fn route_with_lang(name: &str, lang: &str, params: Option<&HashMap<String, String>>) -> Option<String> {
    let registry = ROUTE_REGISTRY.read().ok()?;
    let map = registry.as_ref()?;
    let lang_map = map.get(name)?;

    // Try requested language first, then fall back to default
    let path = lang_map.get(lang)
        .or_else(|| lang_map.get(DEFAULT_LANG))?;

    if let Some(params) = params {
        let mut result = path.clone();
        for (key, value) in params {
            result = result.replace(&format!("{{{}}}", key), value);
        }
        Some(result)
    } else {
        Some(path.clone())
    }
}

/// Get a route URL by name with default language, with optional parameters
///
/// # Example
/// ```rust,ignore
/// use std::collections::HashMap;
///
/// // Simple route
/// let url = route("auth.sign_up", None);
/// // Returns: Some("/api/v1/auth/sign-up")
///
/// // Route with parameters
/// let mut params = HashMap::new();
/// params.insert("id".to_string(), "123".to_string());
/// let url = route("users.show", Some(&params));
/// // Returns: Some("/api/v1/users/123")
/// ```
pub fn route(name: &str, params: Option<&HashMap<String, String>>) -> Option<String> {
    route_with_lang(name, DEFAULT_LANG, params)
}

/// Get route URL by name (convenience wrapper for default language)
pub fn route_url(name: &str, params: Option<&HashMap<String, String>>) -> Option<String> {
    route(name, params)
}

/// Get route URL by name with language (convenience wrapper)
pub fn route_url_lang(name: &str, lang: &str, params: Option<&HashMap<String, String>>) -> Option<String> {
    route_with_lang(name, lang, params)
}

/// Get all registered language variants for a route
///
/// # Returns
/// HashMap of lang -> path for all registered variants
pub fn get_route_languages(name: &str) -> Option<HashMap<String, String>> {
    let registry = ROUTE_REGISTRY.read().ok()?;
    let map = registry.as_ref()?;
    map.get(name).cloned()
}

/// Check if a route exists for a given name and language
pub fn route_exists(name: &str, lang: &str) -> bool {
    if let Ok(registry) = ROUTE_REGISTRY.read() {
        if let Some(map) = registry.as_ref() {
            if let Some(lang_map) = map.get(name) {
                return lang_map.contains_key(lang);
            }
        }
    }
    false
}

/// Macro for registering named routes
///
/// # Usage
///
/// ```rust,ignore
/// // Default language (en)
/// route!("auth.sign_up", "/api/v1/auth/sign-up");
///
/// // With specific language
/// route!("web.sign_up", "/registrazione", "it");
/// route!("web.sign_up", "/inscription", "fr");
/// route!("web.sign_up", "/anmeldung", "de");
/// ```
#[macro_export]
macro_rules! route {
    // Default language variant
    ($name:expr, $path:expr) => {
        $crate::bootstrap::routes::controller::api::register_route($name, $path)
    };
    // With language variant
    ($name:expr, $path:expr, $lang:expr) => {
        $crate::bootstrap::routes::controller::api::register_route_with_lang($name, $path, $lang)
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Tests use unique route names to avoid conflicts when running in parallel.
    // The global registry is shared across all tests, so each test uses a unique prefix.

    #[test]
    fn test_register_route_default_lang() {
        let route_name = "test_default_lang.route";
        register_route(route_name, "/test-path");

        let url = route(route_name, None);
        assert_eq!(url, Some("/test-path".to_string()));
    }

    #[test]
    fn test_register_route_with_lang() {
        let route_name = "test_with_lang.sign_up";
        register_route_with_lang(route_name, "/sign-up", "en");
        register_route_with_lang(route_name, "/registrazione", "it");
        register_route_with_lang(route_name, "/inscription", "fr");

        assert_eq!(route_with_lang(route_name, "en", None), Some("/sign-up".to_string()));
        assert_eq!(route_with_lang(route_name, "it", None), Some("/registrazione".to_string()));
        assert_eq!(route_with_lang(route_name, "fr", None), Some("/inscription".to_string()));
    }

    #[test]
    fn test_lang_fallback_to_default() {
        let route_name = "test_fallback.route";
        register_route_with_lang(route_name, "/default", "en");

        // Requesting a language that doesn't exist should fall back to default (en)
        let url = route_with_lang(route_name, "jp", None);
        assert_eq!(url, Some("/default".to_string()));
    }

    #[test]
    fn test_route_with_params() {
        let route_name = "test_params.user.show";
        register_route(route_name, "/api/v1/user/{id}");

        let mut params = HashMap::new();
        params.insert("id".to_string(), "123".to_string());

        let url = route(route_name, Some(&params));
        assert_eq!(url, Some("/api/v1/user/123".to_string()));
    }

    #[test]
    fn test_route_with_multiple_params() {
        let route_name = "test_multi_params.upload.chunk";
        register_route(route_name, "/api/v1/upload/{uuid}/chunk/{index}");

        let mut params = HashMap::new();
        params.insert("uuid".to_string(), "abc-123".to_string());
        params.insert("index".to_string(), "5".to_string());

        let url = route(route_name, Some(&params));
        assert_eq!(url, Some("/api/v1/upload/abc-123/chunk/5".to_string()));
    }

    #[test]
    fn test_route_with_params_and_lang() {
        let route_name = "test_params_lang.user.profile";
        register_route_with_lang(route_name, "/user/{id}/profile", "en");
        register_route_with_lang(route_name, "/utente/{id}/profilo", "it");

        let mut params = HashMap::new();
        params.insert("id".to_string(), "42".to_string());

        assert_eq!(
            route_with_lang(route_name, "en", Some(&params)),
            Some("/user/42/profile".to_string())
        );
        assert_eq!(
            route_with_lang(route_name, "it", Some(&params)),
            Some("/utente/42/profilo".to_string())
        );
    }

    #[test]
    fn test_route_not_found() {
        // Use a route name that is guaranteed to not exist
        let url = route("test_not_found.nonexistent.route.12345", None);
        assert_eq!(url, None);
    }

    #[test]
    fn test_route_exists() {
        let route_name = "test_exists.route";
        register_route_with_lang(route_name, "/test", "en");
        register_route_with_lang(route_name, "/prova", "it");

        assert!(route_exists(route_name, "en"));
        assert!(route_exists(route_name, "it"));
        assert!(!route_exists(route_name, "fr"));
        assert!(!route_exists("test_exists.nonexistent", "en"));
    }

    #[test]
    fn test_get_route_languages() {
        let route_name = "test_get_langs.home";
        register_route_with_lang(route_name, "/", "en");
        register_route_with_lang(route_name, "/accueil", "fr");
        register_route_with_lang(route_name, "/casa", "it");

        let langs = get_route_languages(route_name).unwrap();
        assert_eq!(langs.len(), 3);
        assert_eq!(langs.get("en"), Some(&"/".to_string()));
        assert_eq!(langs.get("fr"), Some(&"/accueil".to_string()));
        assert_eq!(langs.get("it"), Some(&"/casa".to_string()));
    }
}
