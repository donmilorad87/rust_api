# Web Routes Overview

## Summary

Blazing Sun has **11 web routes** serving HTML pages, **2 static asset routes**, and **1 fallback 404 route**.

### Key Characteristics

- **SSR (Server-Side Rendering)**: All pages rendered with Tera templates
- **Authentication**: Manual checks in controllers (not middleware-based)
- **Named Routes**: Laravel-style route names for easy URL generation
- **Responsive Design**: All pages support mobile, tablet, and desktop
- **Theme System**: Dynamic CSS loaded from database configuration

---

## Route Categories

### Public Pages (No Authentication)
- `/` - Homepage
- `/sign-in` - Sign In
- `/sign-up` - Sign Up
- `/forgot-password` - Forgot Password

### Authenticated Pages (Login Required)
- `/profile` - User Profile
- `/galleries` - User Galleries
- `/logout` - Logout

### Admin Pages (Admin Permission = 10+)
- `/admin/uploads` - Uploads Management
- `/admin/theme` - Theme Configuration

### Super Admin Pages (Super Admin = 100)
- `/superadmin/users` - User Management

### Static Assets
- `/assets/js/*` - JavaScript files
- `/assets/css/*` - CSS files

### Fallback
- `/*` - 404 Not Found

---

## Route Structure

| Category | Count | Auth Required | Permission Level |
|----------|-------|---------------|------------------|
| Public | 4 | No | None |
| Authenticated | 3 | Yes | Basic (1) |
| Admin | 2 | Yes | Admin (10+) |
| Super Admin | 1 | Yes | Super Admin (100) |
| Static | 2 | No | None |
| Fallback | 1 | No | None |

---

## Template System

All web routes use **Tera templates** located in:
```
blazing_sun/src/resources/views/web/
├── base.html            # Base layout
├── homepage.html
├── sign_in.html
├── sign_up.html
├── forgot_password.html
├── profile.html
├── galleries.html
├── uploads.html
├── theme.html
├── registered_users.html
├── 404.html
└── partials/
    └── _navbar.html     # Shared navigation
```

---

## Frontend Architecture

Each page has a corresponding JavaScript module:

```
blazing_sun/src/frontend/pages/
├── GLOBAL/              # Loaded on all pages
├── PROFILE/
├── UPLOADS/
├── THEME/
├── GALLERIES/
├── REGISTERED_USERS/
├── SIGN_IN/
├── SIGN_UP/
└── FORGOT_PASSWORD/
```

Built assets are served from:
```
blazing_sun/src/resources/
├── js/[PAGE]/app.js
└── css/[PAGE]/style.css
```

---

## Authentication Flow

### Manual Authentication Pattern

Web routes use **manual authentication checks** in controllers rather than middleware:

```rust
pub async fn profile(req: HttpRequest, tmpl: web::Data<Tera>, state: web::Data<AppState>) -> impl Responder {
    // Manual auth check
    let user_id = match extract_user_id_from_request(&req) {
        Some(id) => id,
        None => {
            // Redirect to sign-in
            return HttpResponse::Found()
                .insert_header(("Location", "/sign-in"))
                .finish();
        }
    };

    // Fetch user data
    let user = db_query::read::user::get_by_id(&state.db, user_id).await?;

    // Render template
    let mut context = Context::new();
    context.insert("user", &user);
    let rendered = tmpl.render("web/profile.html", &context)?;

    Ok(HttpResponse::Ok().content_type("text/html").body(rendered))
}
```

### Why Manual Over Middleware?

1. **Conditional Behavior**: Homepage shows different content for logged/guest users
2. **Soft Redirects**: Some pages check auth but allow access anyway
3. **Permission Checks**: Different permission levels per route
4. **Template Context**: Need user data for rendering (not just validation)

---

## Named Routes Usage

### In Tera Templates
```html
<!-- Simple route -->
<a href="{{ route(name='web.sign_up') }}">Sign Up</a>

<!-- Route with parameter -->
<a href="{{ route(name='user.show', id=user.id) }}">Profile</a>

<!-- Named route in forms -->
<form action="{{ route(name='auth.sign_in') }}" method="POST">
```

### In Rust Code
```rust
use crate::route_url;

// Generate URL
let profile_url = route_url("web.profile");

// Redirect
HttpResponse::Found()
    .insert_header(("Location", route_url("web.sign_in")))
    .finish()
```

---

## Related Documentation

- Individual route documentation in this directory
- [Frontend Components](../../Frontend/)
- [Backend Controllers](../../Backend/Controllers/)
- [Authentication System](../../Backend/Middleware/auth.md)

---

**Location**: `/home/milner/Desktop/rust/blazing_sun/src/routes/web.rs`
**Controller**: `/home/milner/Desktop/rust/blazing_sun/src/app/http/web/controllers/pages.rs`
