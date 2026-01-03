# Named Routes (Laravel-like) with i18n Support

The application uses Laravel-style named routes for URL generation with full language/localization support. Routes are registered with names and language variants, and can be used in both Rust code and Tera templates.

## Registering Routes

Routes are registered in `routes/api.rs` and `routes/web.rs` using the `route!` macro:

```rust
// In routes/api.rs or routes/web.rs

// Default language (English) - most common usage
route!("auth.sign_up", "/api/v1/auth/sign-up");
route!("user.show", "/api/v1/user/{id}");

// Web routes with language variants
route!("web.sign_up", "/sign-up");              // English (default)
route!("web.sign_up", "/registrazione", "it");  // Italian
route!("web.sign_up", "/inscription", "fr");    // French
route!("web.sign_up", "/anmeldung", "de");      // German

// Routes with parameters and language variants
route!("user.profile", "/user/{id}/profile");           // English
route!("user.profile", "/utente/{id}/profilo", "it");   // Italian
```

## Using Routes in Tera Templates

Use the `route()` function in templates to generate URLs:

```html
<!-- Simple route (no parameters, default language) -->
<a href="{{ route(name='web.sign_up') }}">Sign Up</a>
<a href="{{ route(name='web.sign_in') }}">Sign In</a>

<!-- Route with language parameter -->
<a href="{{ route(name='web.sign_up', lang='it') }}">Registrati</a>
<a href="{{ route(name='web.sign_up', lang='fr') }}">S'inscrire</a>

<!-- Route with language from context variable -->
<a href="{{ route(name='web.sign_up', lang=current_lang) }}">Sign Up</a>

<!-- Route with a single parameter -->
<a href="{{ route(name='user.show', id='123') }}">View User 123</a>
<a href="{{ route(name='user.show', id=user.id) }}">View Profile</a>

<!-- Route with parameters and language -->
<a href="{{ route(name='user.profile', id=user.id, lang='it') }}">Vedi Profilo</a>

<!-- Route with multiple parameters -->
<a href="{{ route(name='upload.chunked.chunk', uuid='abc-def', index='0') }}">
    Upload First Chunk
</a>
```

## Language Fallback

If a route is not registered for the requested language, it automatically falls back to the default language (English). This allows you to:
1. Register only English routes initially
2. Add localized routes gradually as needed
3. Not worry about missing translations - English will be used as fallback

## Available Web Routes

| Route Name | URL | Description |
|------------|-----|-------------|
| `web.home` | `/` | Homepage |
| `web.sign_up` | `/sign-up` | Sign up page |
| `web.sign_in` | `/sign-in` | Sign in page |
| `web.forgot_password` | `/forgot-password` | Forgot password page |
| `web.profile` | `/profile` | User profile page |
| `web.logout` | `/logout` | Logout |

## Available API Routes

| Route Name | URL | Description |
|------------|-----|-------------|
| `auth.sign_up` | `/api/v1/auth/sign-up` | Register new user |
| `auth.sign_in` | `/api/v1/auth/sign-in` | Login |
| `account.activate` | `/api/v1/account/activate-account` | Activate account |
| `account.forgot_password` | `/api/v1/account/forgot-password` | Request reset |
| `account.verify_hash` | `/api/v1/account/verify-hash` | Verify hash |
| `account.reset_password` | `/api/v1/account/reset-password` | Reset password |
| `account.set_password_when_needed` | `/api/v1/account/set-password-when-needed` | Set password |
| `password.change` | `/api/v1/password/change-password` | Request password change |
| `password.verify_change` | `/api/v1/password/verify-password-change` | Verify & change password |
| `user.current` | `/api/v1/user` | Get current user |
| `user.show` | `/api/v1/user/{id}` | Get user by ID |
| `user.update_full` | `/api/v1/user` | Update all fields (PUT) |
| `user.update_partial` | `/api/v1/user` | Update some fields (PATCH) |
| `user.admin_create` | `/api/v1/user` | Admin create user (POST) |
| `user.delete` | `/api/v1/user/{id}` | Delete user |
| `upload.public` | `/api/v1/upload/public` | Upload public file |
| `upload.private` | `/api/v1/upload/private` | Upload private file |
| `upload.multiple` | `/api/v1/upload/multiple` | Upload multiple files |
| `upload.download.public` | `/api/v1/upload/download/public/{uuid}` | Download public file |
| `upload.private.download` | `/api/v1/upload/private/{uuid}` | Download private file |
| `upload.delete` | `/api/v1/upload/{uuid}` | Delete upload |
| `upload.user` | `/api/v1/upload/user` | Get user's uploads |
| `upload.chunked.start` | `/api/v1/upload/chunked/start` | Start chunked upload |
| `upload.chunked.chunk` | `/api/v1/upload/chunked/{uuid}/chunk/{index}` | Upload chunk |
| `upload.chunked.complete` | `/api/v1/upload/chunked/{uuid}/complete` | Complete upload |
| `upload.chunked.cancel` | `/api/v1/upload/chunked/{uuid}` | Cancel upload |

## Using Routes in Rust Code

```rust
use crate::bootstrap::utility::template::{
    route_by_name, route_by_name_lang,
    route_with_params, route_with_params_lang
};
use std::collections::HashMap;

// Simple route (no parameters, default language)
let url = route_by_name("web.sign_up");
// Returns: Some("/sign-up")

// Simple route with language
let url = route_by_name_lang("web.sign_up", "it");
// Returns: Some("/registrazione")

// Route with parameters (default language)
let mut params = HashMap::new();
params.insert("id".to_string(), "123".to_string());
let url = route_with_params("user.show", &params);
// Returns: Some("/api/v1/user/123")

// Route with parameters and language
let url = route_with_params_lang("user.profile", "it", &params);
// Returns: Some("/utente/123/profilo")
```

## Adding New Named Routes

1. Add the route to `routes/api.rs` or `routes/web.rs`:
```rust
// In register_route_names() function

// Default language route
route!("my_feature.action", "/api/v1/my-feature/{id}");

// With language variants
route!("my_feature.action", "/api/v1/my-feature/{id}");           // English (default)
route!("my_feature.action", "/api/v1/mia-funzione/{id}", "it");   // Italian
route!("my_feature.action", "/api/v1/ma-fonction/{id}", "fr");    // French
```

2. Use in templates:
```html
<!-- Default language -->
<a href="{{ route(name='my_feature.action', id=item.id) }}">Action</a>

<!-- With language -->
<a href="{{ route(name='my_feature.action', id=item.id, lang='it') }}">Azione</a>
```

## Checking Route Existence

```rust
use crate::routes::{route_exists, get_route_languages};

// Check if a route exists for a specific language
if route_exists("web.sign_up", "it") {
    // Italian route is registered
}

// Get all registered languages for a route
let languages = get_route_languages("web.sign_up");
// Returns: Some({"en": "/sign-up", "it": "/registrazione", ...})
```
