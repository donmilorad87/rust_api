# Templates Documentation

This document provides comprehensive documentation for the Tera template system in the Blazing Sun application.

---

## Overview

The Blazing Sun application uses **Tera** for server-side HTML rendering. Tera is a template engine inspired by Jinja2 and Django templates.

**File Locations:**
- Web Templates: `resources/views/web/`
- Email Templates: `resources/views/emails/`
- Template Engine: `app/http/web/controllers/pages.rs`
- Template Helpers: `bootstrap/utility/template.rs`

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Template System Architecture                       │
└────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PagesController                                    │
│                                                                              │
│   ┌──────────────────┐       ┌──────────────────┐       ┌───────────────┐  │
│   │   base_context() │ ────▶ │   Tera Engine    │ ────▶ │  HTML Output  │  │
│   │                  │       │                  │       │               │  │
│   │ - is_logged      │       │ - Template files │       │               │  │
│   │ - is_admin       │       │ - Custom funcs   │       │               │  │
│   │ - theme          │       │ - Filters        │       │               │  │
│   │ - app_name       │       │                  │       │               │  │
│   └──────────────────┘       └──────────────────┘       └───────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
resources/views/
├── web/                        # Web page templates
│   ├── base.html               # Base layout (all pages extend this)
│   ├── partials/               # Reusable components
│   │   └── _navbar.html        # Navigation bar
│   ├── homepage.html           # Homepage
│   ├── sign_up.html            # Sign up page
│   ├── sign_in.html            # Sign in page
│   ├── forgot_password.html    # Forgot password page
│   ├── profile.html            # User profile page
│   ├── uploads.html            # Admin uploads page
│   └── registered_users.html   # Admin users page
│
└── emails/                     # Email templates
    ├── base.html               # Base email layout
    ├── welcome.html            # Welcome email
    ├── account_activation.html # Activation code email
    ├── forgot_password.html    # Password reset email
    ├── password_change.html    # Password change request
    ├── activation_success.html # Account activated
    └── password_reset_success.html # Password changed
```

---

## Template Initialization

The Tera engine is initialized once at startup:

```rust
// app/http/web/controllers/pages.rs

use once_cell::sync::Lazy;
use tera::Tera;

static WEB_TEMPLATES: Lazy<Tera> = Lazy::new(|| {
    let template_pattern = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/src/resources/views/web/**/*.html"
    );

    let mut tera = match Tera::new(template_pattern) {
        Ok(t) => t,
        Err(e) => panic!("Failed to initialize templates: {}", e),
    };

    // Register custom functions
    register_template_functions(&mut tera);

    // Enable auto-escaping for HTML
    tera.autoescape_on(vec![".html"]);

    tera
});
```

---

## Base Template (`base.html`)

All web pages extend the base template which provides:
- HTML document structure
- Navigation bar
- Global CSS variables for theming
- Toast notifications
- Common JavaScript utilities

```html
<!DOCTYPE html>
<html lang="en"{% if theme == "dark" %} data-theme="dark"{% endif %}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}Blazing Sun{% endblock %}</title>

    {# Global Assets #}
    <link rel="stylesheet" href="/assets/css/GLOBAL/style.css?v={{ assets_version }}">
    <link rel="stylesheet" href="/assets/css/toastify.min.css?v={{ assets_version }}">

    {# Page-specific styles #}
    {% block extra_styles_links %}{% endblock %}

    <style>
        /* Base styles and CSS variables */
        {% block extra_styles %}{% endblock %}
    </style>
</head>
<body>
    {# Navigation Bar #}
    {% include "partials/_navbar.html" %}

    {# Page Content #}
    {% block content %}{% endblock %}

    {# Global JavaScript #}
    <script src="/assets/js/toastify.min.js?v={{ assets_version }}"></script>
    <script src="/assets/js/GLOBAL/app.js?v={{ assets_version }}"></script>

    <script>
        var BASE_URL = '{{ base_url }}';

        function showToast(message, type) { /* ... */ }
        function apiRequest(endpoint, method, data) { /* ... */ }
    </script>

    {# Page-specific scripts #}
    {% block scripts %}{% endblock %}
</body>
</html>
```

---

## Template Blocks

### Available Blocks

| Block | Purpose | Required |
|-------|---------|----------|
| `title` | Page title | No (default: "Blazing Sun") |
| `extra_styles_links` | Additional CSS `<link>` tags | No |
| `extra_styles` | Inline CSS within `<style>` | No |
| `content` | Main page content | Yes |
| `scripts` | Page-specific JavaScript | No |

### Example Child Template

```html
{% extends "base.html" %}

{% block title %}Sign In - Blazing Sun{% endblock %}

{% block extra_styles_links %}
<link rel="stylesheet" href="/assets/css/SIGN_IN/style.css?v={{ assets_version }}">
{% endblock %}

{% block extra_styles %}
.custom-class {
    color: var(--link-color);
}
{% endblock %}

{% block content %}
<div class="container">
    <div class="card">
        <h1>Sign In</h1>
        <form id="sign-in-form">
            <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="btn">Sign In</button>
        </form>
        <p class="text-center mt-1">
            Don't have an account?
            <a href="{{ route(name='web.sign_up') }}" class="link">Sign Up</a>
        </p>
    </div>
</div>
{% endblock %}

{% block scripts %}
<script src="/assets/js/SIGN_IN/app.js?v={{ assets_version }}"></script>
{% endblock %}
```

---

## Template Context

### Base Context Variables

The `base_context()` method provides these variables to all templates:

| Variable | Type | Description |
|----------|------|-------------|
| `base_url` | String | Base URL (e.g., "https://localhost") |
| `year` | String | Current year (e.g., "2024") |
| `app_name` | String | Application name ("Blazing Sun") |
| `is_logged` | Boolean | User is authenticated |
| `is_admin` | Boolean | User has Admin+ permissions (>=10) |
| `is_super_admin` | Boolean | User has Super Admin permissions (>=100) |
| `theme` | String | Current theme ("light" or "dark") |
| `user_id` | i64 | User ID (if logged in) |
| `assets_version` | String | CSS/JS cache buster version |
| `images_version` | String | Image cache buster version |

### Page-Specific Context

Controllers can add page-specific variables:

```rust
pub async fn profile(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
    let auth = is_logged(&req);
    let mut context = Self::base_context(&req);

    if let Some(user_id) = auth.user_id {
        let db = state.db.lock().await;
        if let Ok(user) = db_user::get_by_id(&db, user_id).await {
            let template_user = TemplateUser {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                avatar_url: user.avatar_uuid.map(|u| format!("/api/v1/avatar/{}", u)),
            };
            context.insert("user", &template_user);  // Add user data
        }
    }

    Ok(Self::render("profile.html", &context))
}
```

---

## Custom Template Functions

### route()

Generates URLs from named routes with optional parameters and language support.

```html
{# Simple route #}
<a href="{{ route(name='web.sign_up') }}">Sign Up</a>

{# Route with parameter #}
<a href="{{ route(name='user.show', id=user.id) }}">View Profile</a>

{# Route with language #}
<a href="{{ route(name='web.sign_up', lang='it') }}">Registrati</a>

{# Multiple parameters #}
<a href="{{ route(name='upload.chunked.chunk', uuid='abc', index='0') }}">Chunk</a>
```

### asset() / private_asset()

Generate asset URLs for files in storage.

```html
{# Public file #}
<img src="{{ asset('filename.jpg') }}" alt="Public image">

{# Private file (requires auth) #}
<img src="{{ private_asset(user.avatar_uuid) }}" alt="Profile picture">
```

---

## Partials

### Navigation Bar (`partials/_navbar.html`)

Reusable navigation component included in base template:

```html
{# partials/_navbar.html #}
<nav class="navbar">
    <div class="navbar-brand">
        <a href="{{ route(name='web.home') }}">{{ app_name }}</a>
    </div>

    <div class="navbar-menu">
        {% if is_logged %}
            <a href="{{ route(name='web.profile') }}">Profile</a>

            {% if is_admin %}
                <a href="{{ route(name='admin.uploads') }}">Uploads</a>
            {% endif %}

            {% if is_super_admin %}
                <a href="{{ route(name='admin.users') }}">Users</a>
            {% endif %}

            <a href="{{ route(name='web.logout') }}">Logout</a>
        {% else %}
            <a href="{{ route(name='web.sign_in') }}">Sign In</a>
            <a href="{{ route(name='web.sign_up') }}">Sign Up</a>
        {% endif %}
    </div>

    <button class="theme-toggle" onclick="ThemeManager.toggle()">
        <span class="theme-icon"></span>
    </button>
</nav>
```

### Using Partials

```html
{# Include a partial #}
{% include "partials/_navbar.html" %}

{# Include with context #}
{% include "partials/_user_card.html" %}
```

---

## Theming

### CSS Variables

The base template uses CSS variables for theming:

```css
/* Light theme (default) */
:root {
    --bg-primary: #f5f7fa;
    --bg-secondary: #ffffff;
    --text-primary: #333333;
    --text-secondary: #666666;
    --text-muted: #999999;
    --card-bg: #ffffff;
    --card-shadow: rgba(0, 0, 0, 0.1);
    --input-bg: #ffffff;
    --input-border: #e0e0e0;
    --link-color: #667eea;
}

/* Dark theme */
[data-theme="dark"] {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --text-primary: #ffffff;
    --text-secondary: #b0b0b0;
    --text-muted: #808080;
    --card-bg: #16213e;
    --card-shadow: rgba(0, 0, 0, 0.3);
    --input-bg: #0f3460;
    --input-border: #0f3460;
    --link-color: #667eea;
}
```

### Theme Toggle

Theme is stored in a cookie and detected server-side:

```rust
fn get_theme(req: &HttpRequest) -> String {
    req.cookie("blazing_sun_theme")
        .map(|c| c.value().to_string())
        .filter(|v| v == "dark" || v == "light")
        .unwrap_or_else(|| "light".to_string())
}
```

JavaScript ThemeManager handles client-side toggling:

```javascript
// In GLOBAL/app.js
class ThemeManager {
    static toggle() {
        const html = document.documentElement;
        const isDark = html.hasAttribute('data-theme');

        if (isDark) {
            html.removeAttribute('data-theme');
            this.setCookie('light');
        } else {
            html.setAttribute('data-theme', 'dark');
            this.setCookie('dark');
        }
    }

    static setCookie(theme) {
        document.cookie = `blazing_sun_theme=${theme};path=/;max-age=31536000`;
    }
}
```

---

## Asset Versioning

Cache busting with version strings:

```rust
// bootstrap/utility/template.rs

pub fn get_assets_version() -> &'static str {
    // In production: hash of build time
    // In development: timestamp
    "20240101_120000"
}

pub fn get_images_version() -> &'static str {
    "20240101_120000"
}
```

Usage in templates:

```html
<link rel="stylesheet" href="/assets/css/style.css?v={{ assets_version }}">
<script src="/assets/js/app.js?v={{ assets_version }}"></script>
<img src="/images/logo.png?v={{ images_version }}" alt="Logo">
```

---

## Tera Syntax Reference

### Variables

```html
{{ variable }}
{{ user.first_name }}
{{ items[0] }}
```

### Filters

```html
{{ name | upper }}
{{ text | truncate(length=100) }}
{{ date | date(format="%Y-%m-%d") }}
{{ content | safe }}  {# Disable auto-escaping #}
```

### Conditionals

```html
{% if is_logged %}
    <p>Welcome back!</p>
{% elif is_guest %}
    <p>Please sign in</p>
{% else %}
    <p>Unknown state</p>
{% endif %}
```

### Loops

```html
{% for item in items %}
    <li>{{ loop.index }}: {{ item.name }}</li>
{% endfor %}

{% for key, value in object %}
    <p>{{ key }}: {{ value }}</p>
{% endfor %}
```

### Loop Variables

| Variable | Description |
|----------|-------------|
| `loop.index` | Current iteration (1-indexed) |
| `loop.index0` | Current iteration (0-indexed) |
| `loop.first` | True if first iteration |
| `loop.last` | True if last iteration |

### Comments

```html
{# This is a comment #}

{#
    Multi-line
    comment
#}
```

### Raw Blocks

```html
{% raw %}
    This {{ will not }} be processed
{% endraw %}
```

---

## Email Templates

### Base Email Template

```html
<!-- resources/views/emails/base.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4A90D9; color: white; padding: 20px; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; color: #666; }
        .button { display: inline-block; padding: 12px 24px; background: #4A90D9;
                  color: white; text-decoration: none; border-radius: 4px; }
        .code { font-size: 32px; font-weight: bold; color: #4A90D9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{ app_name }}</h1>
        </div>
        <div class="content">
            {% block content %}{% endblock %}
        </div>
        <div class="footer">
            <p>&copy; {{ year }} {{ app_name }}</p>
        </div>
    </div>
</body>
</html>
```

### Activation Email Example

```html
{% extends "base.html" %}

{% block content %}
<h2>Hello {{ first_name }}!</h2>

<p>Thank you for registering. Use this code to activate your account:</p>

<p style="text-align: center;">
    <span class="code">{{ activation_code }}</span>
</p>

<p>This code expires in 24 hours.</p>

<p>Best regards,<br>The Blazing Sun Team</p>
{% endblock %}
```

---

## Creating a New Page

### Step 1: Create Template

Create `resources/views/web/my_page.html`:

```html
{% extends "base.html" %}

{% block title %}My Page - Blazing Sun{% endblock %}

{% block extra_styles_links %}
<link rel="stylesheet" href="/assets/css/MY_PAGE/style.css?v={{ assets_version }}">
{% endblock %}

{% block content %}
<div class="container">
    <h1>My Page</h1>

    {% if is_logged %}
        <p>Welcome, user {{ user_id }}!</p>
    {% else %}
        <p>Please <a href="{{ route(name='web.sign_in') }}">sign in</a>.</p>
    {% endif %}

    {% if my_data %}
        <ul>
        {% for item in my_data %}
            <li>{{ item.name }}</li>
        {% endfor %}
        </ul>
    {% endif %}
</div>
{% endblock %}

{% block scripts %}
<script src="/assets/js/MY_PAGE/app.js?v={{ assets_version }}"></script>
{% endblock %}
```

### Step 2: Add Controller Method

In `app/http/web/controllers/pages.rs`:

```rust
pub async fn my_page(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let auth = is_logged(&req);

    // Optional: require authentication
    if !auth.is_logged {
        return Ok(Self::redirect("/sign-in"));
    }

    let mut context = Self::base_context(&req);

    // Add page-specific data
    let db = state.db.lock().await;
    let my_data = get_my_data(&db).await;
    context.insert("my_data", &my_data);

    Ok(Self::render("my_page.html", &context))
}
```

### Step 3: Register Route

In `routes/web.rs`:

```rust
pub fn register_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::resource("/my-page")
            .route(web::get().to(PagesController::my_page))
    );
}

pub fn register_route_names() {
    route!("web.my_page", "/my-page");
}
```

---

## Best Practices

1. **Always extend base.html** - Ensures consistent layout
2. **Use named routes** - `{{ route(name='...') }}` instead of hardcoded URLs
3. **Use CSS variables** - For consistent theming
4. **Version assets** - Use `?v={{ assets_version }}` for cache busting
5. **Escape user data** - Tera auto-escapes by default
6. **Use partials** - For reusable components
7. **Keep templates simple** - Move logic to controllers

---

## Related Documentation

- [Controllers](../Controllers/CONTROLLERS.md) - Controller layer
- [Email System](../Email/EMAIL.md) - Email templates
- [API Routes](../Routes/Api/API_ROUTES.md) - API endpoints
- [Web Routes](../Routes/Web/WEB_ROUTES.md) - Web routes
