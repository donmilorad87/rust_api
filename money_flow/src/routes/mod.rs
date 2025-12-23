//! Laravel-style routing system for Actix-web
//!
//! This module provides a declarative routing API similar to Laravel's routing.
//!
//! # Example
//! ```rust
//! // In routes/api.rs
//! pub fn register(cfg: &mut web::ServiceConfig) {
//!     cfg.service(
//!         web::scope("/api/v1")
//!             .route("/auth/sign-up", web::post().to(AuthController::sign_up))
//!             .route("/auth/sign-in", web::post().to(AuthController::sign_in))
//!             .route("/users/{id}", web::get().to(UserController::show))
//!     );
//! }
//! ```

pub mod api;

use std::collections::HashMap;
use std::sync::RwLock;

/// Global route registry for named routes
static ROUTE_REGISTRY: RwLock<Option<HashMap<String, String>>> = RwLock::new(None);

/// Initialize the route registry
pub fn init_registry() {
    let mut registry = ROUTE_REGISTRY.write().unwrap();
    if registry.is_none() {
        *registry = Some(HashMap::new());
    }
}

/// Register a named route
pub fn register_route(name: &str, path: &str) {
    init_registry();
    if let Ok(mut registry) = ROUTE_REGISTRY.write() {
        if let Some(ref mut map) = *registry {
            map.insert(name.to_string(), path.to_string());
        }
    }
}

/// Get a route URL by name, with optional parameters
///
/// # Example
/// ```rust
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
    let registry = ROUTE_REGISTRY.read().ok()?;
    let map = registry.as_ref()?;
    let path = map.get(name)?;

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

/// Macro for registering named routes
///
/// # Example
/// ```rust
/// route!("auth.sign_up", "/api/v1/auth/sign-up");
/// route!("users.show", "/api/v1/users/{id}");
/// ```
#[macro_export]
macro_rules! route {
    ($name:expr, $path:expr) => {
        $crate::routes::register_route($name, $path)
    };
}
