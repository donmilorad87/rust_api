# Web Routes Documentation

This document provides comprehensive documentation for all web routes in the Blazing Sun application.

---

## Overview

Web routes serve HTML pages rendered using Tera templates. They are defined in `blazing_sun/src/routes/web.rs` and handled by the `PagesController` in `blazing_sun/src/app/http/web/controllers/pages.rs`.

---

## Route Registration Architecture

### File: `routes/web.rs`

```rust
use actix_web::{web, Route};
use actix_files::Files;
use crate::app::http::web::controllers::pages::PagesController;
use crate::route;

pub fn register(cfg: &mut web::ServiceConfig) {
    // Register named routes for URL generation
    register_route_names();

    // Static assets, web pages, admin pages, 404 fallback
    // ...
}

fn register_route_names() {
    route!("web.home", "/");
    route!("web.sign_up", "/sign-up");
    // ... more routes
}
```

---

## Static Assets

Static JavaScript and CSS files are served from the application's resources directory.

| Route Pattern | Filesystem Path | Description |
|---------------|-----------------|-------------|
| `/assets/js/*` | `src/resources/js/` | JavaScript files |
| `/assets/css/*` | `src/resources/css/` | CSS files |

**Note:** Static files show directory listings for development convenience.

---

## Public Web Pages

These pages are accessible to all users without authentication.

### Homepage

| Property | Value |
|----------|-------|
| **Route** | `GET /` |
| **Named Route** | `web.home` |
| **Handler** | `PagesController::homepage` |
| **Template** | `homepage.html` |

**Behavior:**
- Shows different content based on authentication status
- Logged-in users see `template_type: "logged"`
- Guest users see `template_type: "guest"`

**Template Context:**
```rust
context.insert("template_type", "logged" | "guest");
context.insert("base_url", &base_url);
context.insert("year", "2024");
context.insert("app_name", "Blazing Sun");
context.insert("is_logged", &auth.is_logged);
context.insert("is_admin", &auth.is_admin());
context.insert("is_super_admin", &auth.is_super_admin());
context.insert("theme", "light" | "dark");
context.insert("assets_version", &version);
context.insert("images_version", &version);
```

---

### Sign Up Page

| Property | Value |
|----------|-------|
| **Route** | `GET /sign-up` |
| **Named Route** | `web.sign_up` |
| **Handler** | `PagesController::sign_up` |
| **Template** | `sign_up.html` |

**Behavior:**
- Redirects to `/profile` if user is already logged in
- Shows registration form for guests

**Example Usage in Template:**
```html
<a href="{{ route(name='web.sign_up') }}">Create Account</a>
```

---

### Sign In Page

| Property | Value |
|----------|-------|
| **Route** | `GET /sign-in` |
| **Named Route** | `web.sign_in` |
| **Handler** | `PagesController::sign_in` |
| **Template** | `sign_in.html` |

**Behavior:**
- Redirects to `/profile` if user is already logged in
- Shows login form for guests

**Example Usage in Template:**
```html
<a href="{{ route(name='web.sign_in') }}">Login</a>
```

---

### Forgot Password Page

| Property | Value |
|----------|-------|
| **Route** | `GET /forgot-password` |
| **Named Route** | `web.forgot_password` |
| **Handler** | `PagesController::forgot_password` |
| **Template** | `forgot_password.html` |

**Behavior:**
- Redirects to `/profile` if user is already logged in
- Shows password reset request form for guests

**Example Usage in Template:**
```html
<a href="{{ route(name='web.forgot_password') }}">Forgot Password?</a>
```

---

## Authenticated Web Pages

These pages require the user to be logged in. Non-authenticated users are redirected to `/sign-in`.

### Profile Page

| Property | Value |
|----------|-------|
| **Route** | `GET /profile` |
| **Named Route** | `web.profile` |
| **Handler** | `PagesController::profile` |
| **Template** | `profile.html` |
| **Auth Required** | Yes |

**Behavior:**
- Redirects to `/sign-in` if not logged in
- Fetches user data from database
- Generates avatar URL if user has an avatar

**Template Context (additional):**
```rust
context.insert("user", &TemplateUser {
    id: i64,
    email: String,
    first_name: String,
    last_name: String,
    avatar_url: Option<String>,  // /api/v1/avatar/{uuid}
});
```

**Example Template Usage:**
```html
<img src="{{ user.avatar_url }}" alt="{{ user.first_name }}'s avatar">
<p>Welcome, {{ user.first_name }} {{ user.last_name }}</p>
```

---

### Logout

| Property | Value |
|----------|-------|
| **Route** | `GET /logout` |
| **Named Route** | `web.logout` |
| **Handler** | `PagesController::logout` |

**Behavior:**
- Clears the `auth_token` cookie by setting it to empty with max_age=0
- Redirects to homepage (`/`)

**Example Usage in Template:**
```html
<a href="{{ route(name='web.logout') }}">Logout</a>
```

---

## Admin Web Pages

These pages require elevated permissions. Users without proper permissions are redirected to homepage.

### Uploads Admin Page

| Property | Value |
|----------|-------|
| **Route** | `GET /admin/uploads` |
| **Named Route** | `admin.uploads` |
| **Handler** | `PagesController::uploads` |
| **Template** | `uploads.html` |
| **Auth Required** | Yes |
| **Permission Required** | Admin (>= 10) |

**Behavior:**
- Redirects to `/sign-in` if not logged in
- Redirects to `/` if user doesn't have admin permissions
- Shows uploads management interface

**Permission Check:**
```rust
if !auth.is_admin() {  // permissions >= 10
    return Ok(Self::redirect("/"));
}
```

---

### Registered Users Admin Page

| Property | Value |
|----------|-------|
| **Route** | `GET /admin/users` |
| **Named Route** | `admin.users` |
| **Handler** | `PagesController::registered_users` |
| **Template** | `registered_users.html` |
| **Auth Required** | Yes |
| **Permission Required** | Super Admin (>= 100) |

**Behavior:**
- Redirects to `/sign-in` if not logged in
- Redirects to `/` if user doesn't have super admin permissions
- Shows user management interface
- User data is fetched via JavaScript API calls (not server-side)

**Permission Check:**
```rust
if !auth.is_super_admin() {  // permissions >= 100
    return Ok(Self::redirect("/"));
}
```

---

## Error Pages

### 404 Not Found

| Property | Value |
|----------|-------|
| **Route** | Any unmatched route |
| **Handler** | `PagesController::not_found` |
| **Template** | `404.html` |
| **HTTP Status** | 404 Not Found |

**Behavior:**
- Catches all routes that don't match any defined route
- Must be registered last in the routes configuration
- Returns HTTP 404 status code

**Registration:**
```rust
cfg.default_service(Route::new().to(PagesController::not_found));
```

---

## Complete Route Summary

| Route | Name | Handler | Auth | Permission |
|-------|------|---------|------|------------|
| `GET /` | `web.home` | `homepage` | No | - |
| `GET /sign-up` | `web.sign_up` | `sign_up` | No* | - |
| `GET /sign-in` | `web.sign_in` | `sign_in` | No* | - |
| `GET /forgot-password` | `web.forgot_password` | `forgot_password` | No* | - |
| `GET /profile` | `web.profile` | `profile` | Yes | - |
| `GET /logout` | `web.logout` | `logout` | No | - |
| `GET /admin/uploads` | `admin.uploads` | `uploads` | Yes | Admin (10) |
| `GET /admin/users` | `admin.users` | `registered_users` | Yes | Super Admin (100) |

*Redirects to `/profile` if already logged in

---

## Named Routes Usage

### In Tera Templates

```html
<!-- Simple routes -->
<a href="{{ route(name='web.home') }}">Home</a>
<a href="{{ route(name='web.sign_up') }}">Sign Up</a>
<a href="{{ route(name='web.sign_in') }}">Sign In</a>

<!-- Conditional navigation based on auth -->
{% if is_logged %}
    <a href="{{ route(name='web.profile') }}">My Profile</a>
    <a href="{{ route(name='web.logout') }}">Logout</a>
{% else %}
    <a href="{{ route(name='web.sign_in') }}">Login</a>
{% endif %}

<!-- Admin navigation based on permissions -->
{% if is_admin %}
    <a href="{{ route(name='admin.uploads') }}">Manage Uploads</a>
{% endif %}
{% if is_super_admin %}
    <a href="{{ route(name='admin.users') }}">Manage Users</a>
{% endif %}
```

### In Rust Code

```rust
use crate::routes::{route, route_with_lang};
use std::collections::HashMap;

// Get URL for default language
let url = route("web.sign_up", None);
// Returns: Some("/sign-up")

// Get URL for specific language (if registered)
let url = route_with_lang("web.sign_up", "it", None);
// Returns: Some("/registrazione") or fallback to "/sign-up"
```

---

## Base Template Context

Every web page receives these common variables from `PagesController::base_context()`:

| Variable | Type | Description |
|----------|------|-------------|
| `base_url` | String | Full base URL (e.g., "https://localhost") |
| `year` | String | Current year for copyright |
| `app_name` | String | Application name ("Blazing Sun") |
| `is_logged` | bool | Whether user is authenticated |
| `is_admin` | bool | Whether user has admin permissions (>= 10) |
| `is_super_admin` | bool | Whether user has super admin permissions (>= 100) |
| `theme` | String | Current theme from cookie ("light" or "dark") |
| `assets_version` | String | Version string for CSS/JS cache busting |
| `images_version` | String | Version string for image cache busting |
| `user_id` | i64 (optional) | User ID if logged in |

---

## Theme Support

The application supports light/dark theme switching via cookies:

```rust
const THEME_COOKIE_NAME: &str = "blazing_sun_theme";

fn get_theme(req: &HttpRequest) -> String {
    req.cookie(THEME_COOKIE_NAME)
        .map(|c| c.value().to_string())
        .filter(|v| v == "dark" || v == "light")
        .unwrap_or_else(|| "light".to_string())
}
```

**Template Usage:**
```html
<body class="theme-{{ theme }}">
```

---

## Adding New Web Routes

### Step 1: Add Handler in PagesController

```rust
// In pages.rs
pub async fn my_new_page(req: HttpRequest) -> Result<HttpResponse> {
    let auth = is_logged(&req);

    // Optional: Require authentication
    if !auth.is_logged {
        return Ok(Self::redirect("/sign-in"));
    }

    let mut context = Self::base_context(&req);
    context.insert("page_title", "My New Page");

    Ok(Self::render("my_new_page.html", &context))
}
```

### Step 2: Register Route in web.rs

```rust
// In routes/web.rs

pub fn register(cfg: &mut web::ServiceConfig) {
    register_route_names();

    // ... existing routes ...

    cfg.route("/my-new-page", web::get().to(PagesController::my_new_page));
}

fn register_route_names() {
    // ... existing routes ...

    route!("web.my_new_page", "/my-new-page");
}
```

### Step 3: Create Template

Create `src/resources/views/web/my_new_page.html`:

```html
{% extends "base.html" %}

{% block title %}{{ page_title }} - {{ app_name }}{% endblock %}

{% block content %}
<h1>{{ page_title }}</h1>
<!-- Your content here -->
{% endblock %}
```

---

## Permission Levels Reference

| Level | Constant | Access |
|-------|----------|--------|
| 1 | `BASIC` | Regular user |
| 10 | `ADMIN` | Admin pages (uploads) |
| 50 | `AFFILIATE` | Affiliate features |
| 100 | `SUPER_ADMIN` | All admin pages (users) |

---

## Related Documentation

- [API Routes](../Api/API_ROUTES.md) - REST API endpoint documentation
- [Permissions](../../Permissions/PERMISSIONS.md) - Permission system documentation
- [Templates](../../Templates/TEMPLATES.md) - Template architecture documentation
