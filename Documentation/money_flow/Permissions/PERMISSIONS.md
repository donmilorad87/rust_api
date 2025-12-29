# Permissions System Documentation

This document provides comprehensive documentation for the permission-based access control system in the Money Flow application.

---

## Overview

The permission system provides role-based access control (RBAC) for protecting routes and features. It uses a numeric permission level stored in the user's JWT token and database record.

**File Location:** `money_flow/src/bootstrap/middleware/controllers/permission.rs`

---

## Permission Levels

| Level | Constant | Name | Description |
|-------|----------|------|-------------|
| 1 | `BASIC` | Basic User | Default for all registered users |
| 10 | `ADMIN` | Admin | Can manage uploads, view assets |
| 50 | `AFFILIATE` | Affiliate | Future affiliate features |
| 100 | `SUPER_ADMIN` | Super Admin | Full access to all features |

### Level Hierarchy

```
Super Admin (100)
    │
    ├── Can access ALL protected routes
    ├── Can manage users
    ├── Can update user permissions
    └── Has all lower-level permissions

Affiliate (50)
    │
    ├── Future affiliate features
    └── Super Admin can access affiliate routes

Admin (10)
    │
    ├── Can view all uploads
    ├── Can view all assets
    ├── Can delete user avatars
    └── Super Admin can access admin routes

Basic (1)
    │
    └── Standard user functionality
```

---

## Implementation Details

### Permission Level Constants

```rust
// bootstrap/middleware/controllers/permission.rs

pub mod levels {
    /// Basic user (default)
    pub const BASIC: i16 = 1;

    /// Admin - can manage uploads, assets
    pub const ADMIN: i16 = 10;

    /// Affiliate - future affiliate features
    pub const AFFILIATE: i16 = 50;

    /// Super Admin - full access
    pub const SUPER_ADMIN: i16 = 100;
}
```

### Permission Middleware Factory

The `require_permission` function creates a middleware that checks user permissions:

```rust
pub fn require_permission(
    required_level: i16,
) -> impl Fn(ServiceRequest, Next<BoxBody>) -> Pin<Box<dyn Future<...>>> + Clone
```

### Access Rules

```rust
let has_access = match required {
    levels::SUPER_ADMIN => permissions == levels::SUPER_ADMIN,
    levels::ADMIN => permissions == levels::ADMIN || permissions == levels::SUPER_ADMIN,
    levels::AFFILIATE => permissions == levels::AFFILIATE || permissions == levels::SUPER_ADMIN,
    levels::BASIC => true, // All authenticated users
    _ => permissions == required || permissions == levels::SUPER_ADMIN,
};
```

**Key Rules:**
- **SUPER_ADMIN (100)**: Only exact match (100)
- **ADMIN (10)**: Admin (10) OR Super Admin (100)
- **AFFILIATE (50)**: Affiliate (50) OR Super Admin (100)
- **BASIC (1)**: Any authenticated user

---

## Usage in Routes

### Middleware Application Order

**Important:** Actix middleware order is REVERSED - the last `.wrap()` runs FIRST!

```rust
// CORRECT ORDER
cfg.service(
    web::scope("/api/v1/admin")
        .wrap(from_fn(require_permission(levels::ADMIN)))  // Runs SECOND
        .wrap(from_fn(middleware::auth::verify_jwt))       // Runs FIRST
        .route("/uploads", web::get().to(list_uploads))
);
```

The middleware executes in this order:
1. `verify_jwt` - Validates JWT and extracts permissions into request extensions
2. `require_permission` - Reads permissions from extensions and validates

### Example Route Configurations

#### Admin Routes (Permission >= 10)

```rust
use crate::middleware::permission::{levels, require_permission};

cfg.service(
    web::scope("/api/v1/admin")
        .wrap(from_fn(require_permission(levels::ADMIN)))
        .wrap(from_fn(middleware::auth::verify_jwt))
        .route("/uploads", web::get().to(AdminController::list_uploads))
        .route("/assets", web::get().to(AdminController::list_assets))
);
```

#### Super Admin Routes (Permission = 100)

```rust
cfg.service(
    web::scope("/api/v1/admin/users")
        .wrap(from_fn(require_permission(levels::SUPER_ADMIN)))
        .wrap(from_fn(middleware::auth::verify_jwt))
        .route("", web::get().to(AdminController::list_users))
        .route("/{id}/permissions", web::patch().to(AdminController::update_user_permissions))
);
```

---

## Helper Functions

### Check if User is Admin

```rust
pub fn is_admin(permissions: i16) -> bool {
    permissions == levels::ADMIN || permissions == levels::SUPER_ADMIN
}

// Usage
if is_admin(user.permissions) {
    // User is Admin or Super Admin
}
```

### Check if User is Super Admin

```rust
pub fn is_super_admin(permissions: i16) -> bool {
    permissions == levels::SUPER_ADMIN
}

// Usage
if is_super_admin(user.permissions) {
    // User is Super Admin
}
```

### Check if User is Affiliate

```rust
pub fn is_affiliate(permissions: i16) -> bool {
    permissions == levels::AFFILIATE || permissions == levels::SUPER_ADMIN
}

// Usage
if is_affiliate(user.permissions) {
    // User is Affiliate or Super Admin
}
```

### Get Permission Level Name

```rust
pub fn permission_name(level: i16) -> &'static str {
    match level {
        levels::SUPER_ADMIN => "Super Admin",
        levels::AFFILIATE => "Affiliate",
        levels::ADMIN => "Admin",
        levels::BASIC => "Basic",
        _ => "Unknown",
    }
}

// Usage
let name = permission_name(user.permissions); // "Admin"
```

---

## Permission Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      HTTP Request                                │
│                  (with Authorization header)                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    JWT Middleware                                │
│  1. Extract token from header/cookie                            │
│  2. Validate token signature and expiration                     │
│  3. Extract claims (user_id, permissions)                       │
│  4. Store permissions in request.extensions()                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                        Token Invalid?
                        ┌───────┴───────┐
                        │ Yes           │ No
                        ▼               ▼
            ┌───────────────┐  ┌────────────────────────────────┐
            │ 401 Response  │  │  Permission Middleware         │
            │ Unauthorized  │  │  1. Get permissions from ext   │
            └───────────────┘  │  2. Compare with required      │
                               │  3. Check Super Admin override │
                               └────────────────────────────────┘
                                                │
                                    Insufficient Permission?
                                    ┌───────────┴───────────┐
                                    │ Yes                   │ No
                                    ▼                       ▼
                        ┌───────────────────┐  ┌──────────────────┐
                        │ 403 Response      │  │ Route Handler    │
                        │ Forbidden         │  │ (Controller)     │
                        │ "Insufficient     │  └──────────────────┘
                        │  permissions"     │
                        └───────────────────┘
```

---

## Web Page Permission Checks

For web pages, permission checks happen in the controller using the `is_logged` utility:

### File: `bootstrap/utility/auth.rs`

```rust
pub struct AuthInfo {
    pub is_logged: bool,
    pub user_id: Option<i64>,
    pub permissions: i16,
}

impl AuthInfo {
    pub fn is_admin(&self) -> bool {
        self.permissions >= 10
    }

    pub fn is_super_admin(&self) -> bool {
        self.permissions >= 100
    }
}

pub fn is_logged(req: &HttpRequest) -> AuthInfo {
    // Extract from JWT cookie
}
```

### Controller Usage

```rust
// In pages.rs

pub async fn uploads(req: HttpRequest) -> Result<HttpResponse> {
    let auth = is_logged(&req);

    // Must be logged in
    if !auth.is_logged {
        return Ok(Self::redirect("/sign-in"));
    }

    // Must have admin permissions (>= 10)
    if !auth.is_admin() {
        return Ok(Self::redirect("/"));
    }

    let context = Self::base_context(&req);
    Ok(Self::render("uploads.html", &context))
}

pub async fn registered_users(req: HttpRequest, state: web::Data<AppState>) -> Result<HttpResponse> {
    let auth = is_logged(&req);

    // Must be logged in
    if !auth.is_logged {
        return Ok(Self::redirect("/sign-in"));
    }

    // Must have super admin permissions (>= 100)
    if !auth.is_super_admin() {
        return Ok(Self::redirect("/"));
    }

    // ... render page
}
```

---

## Template Context

Permission flags are passed to templates via `base_context`:

```rust
fn base_context(req: &HttpRequest) -> Context {
    let auth = is_logged(req);
    let mut context = Context::new();

    context.insert("is_logged", &auth.is_logged);
    context.insert("is_admin", &auth.is_admin());
    context.insert("is_super_admin", &auth.is_super_admin());

    context
}
```

### Template Usage

```html
<!-- Navigation based on permissions -->
<nav>
    {% if is_logged %}
        <a href="{{ route(name='web.profile') }}">Profile</a>

        {% if is_admin %}
            <a href="{{ route(name='admin.uploads') }}">Manage Uploads</a>
        {% endif %}

        {% if is_super_admin %}
            <a href="{{ route(name='admin.users') }}">Manage Users</a>
        {% endif %}

        <a href="{{ route(name='web.logout') }}">Logout</a>
    {% else %}
        <a href="{{ route(name='web.sign_in') }}">Login</a>
    {% endif %}
</nav>
```

---

## Database Schema

Permissions are stored in the `users` table:

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    balance BIGINT DEFAULT 0,
    permissions SMALLINT DEFAULT 1,  -- Permission level
    activated SMALLINT DEFAULT 0,
    verified SMALLINT DEFAULT 0,
    avatar_uuid UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Default Value

New users are created with `permissions = 1` (BASIC).

### Updating Permissions

Only Super Admins can update user permissions:

```rust
// Admin controller
pub async fn update_user_permissions(
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<UpdatePermissionsRequest>,
) -> HttpResponse {
    let user_id = path.into_inner();
    let new_permissions = body.permissions;

    // Validate permission value
    if ![1, 10, 50, 100].contains(&new_permissions) {
        return HttpResponse::BadRequest()
            .json(BaseResponse::error("Invalid permission level. Must be 1, 10, 50, or 100"));
    }

    let db = state.db.lock().await;

    // Update permissions
    match db_user_mutations::update_permissions(&db, user_id, new_permissions).await {
        Ok(_) => HttpResponse::Ok().json(BaseResponse::success("User permissions updated")),
        Err(e) => HttpResponse::InternalServerError()
            .json(BaseResponse::error("Failed to update permissions"))
    }
}
```

---

## JWT Token Structure

Permissions are included in the JWT claims:

```rust
pub struct Claims {
    pub sub: i64,           // User ID
    pub role: String,       // "user"
    pub exp: i64,           // Expiration timestamp
    pub permissions: i16,   // Permission level
}
```

The JWT middleware extracts permissions and stores them in request extensions:

```rust
// In auth.rs middleware
let claims: Claims = decode_token(&token)?;
req.extensions_mut().insert(claims.sub);        // User ID
req.extensions_mut().insert(claims.permissions); // Permissions as i16
```

---

## API Error Responses

### 401 Unauthorized
```json
{
    "status": "error",
    "message": "Authentication required"
}
```

Returned when:
- No JWT token provided
- JWT token is invalid or expired
- Permissions not found in request extensions

### 403 Forbidden
```json
{
    "status": "error",
    "message": "Insufficient permissions"
}
```

Returned when:
- User's permission level is lower than required
- User doesn't have access to the resource

---

## Unit Tests

```rust
#[test]
fn test_is_admin() {
    assert!(!is_admin(1));   // Basic - NOT admin
    assert!(!is_admin(9));   // Below admin threshold
    assert!(is_admin(10));   // Admin
    assert!(!is_admin(50));  // Affiliate is NOT admin
    assert!(is_admin(100));  // Super Admin
}

#[test]
fn test_is_super_admin() {
    assert!(!is_super_admin(1));
    assert!(!is_super_admin(10));
    assert!(!is_super_admin(50));
    assert!(!is_super_admin(99));
    assert!(is_super_admin(100));  // Only exactly 100
    assert!(!is_super_admin(200)); // Only exactly 100
}

#[test]
fn test_is_affiliate() {
    assert!(!is_affiliate(1));
    assert!(!is_affiliate(10));  // Admin is NOT affiliate
    assert!(is_affiliate(50));   // Affiliate
    assert!(is_affiliate(100));  // Super Admin
}

#[test]
fn test_permission_name() {
    assert_eq!(permission_name(1), "Basic");
    assert_eq!(permission_name(10), "Admin");
    assert_eq!(permission_name(50), "Affiliate");
    assert_eq!(permission_name(100), "Super Admin");
    assert_eq!(permission_name(200), "Unknown");
}
```

---

## Adding New Permission Levels

1. Add constant to `levels` module:
```rust
pub mod levels {
    pub const BASIC: i16 = 1;
    pub const ADMIN: i16 = 10;
    pub const NEW_ROLE: i16 = 25;  // New level
    pub const AFFILIATE: i16 = 50;
    pub const SUPER_ADMIN: i16 = 100;
}
```

2. Add helper function:
```rust
pub fn is_new_role(permissions: i16) -> bool {
    permissions == levels::NEW_ROLE || permissions == levels::SUPER_ADMIN
}
```

3. Update `permission_name`:
```rust
pub fn permission_name(level: i16) -> &'static str {
    match level {
        levels::SUPER_ADMIN => "Super Admin",
        levels::AFFILIATE => "Affiliate",
        levels::NEW_ROLE => "New Role",  // Add this
        levels::ADMIN => "Admin",
        levels::BASIC => "Basic",
        _ => "Unknown",
    }
}
```

4. Update access rules in `require_permission`:
```rust
let has_access = match required {
    levels::SUPER_ADMIN => permissions == levels::SUPER_ADMIN,
    levels::AFFILIATE => permissions == levels::AFFILIATE || permissions == levels::SUPER_ADMIN,
    levels::NEW_ROLE => permissions == levels::NEW_ROLE || permissions == levels::SUPER_ADMIN,
    levels::ADMIN => permissions == levels::ADMIN || permissions == levels::SUPER_ADMIN,
    levels::BASIC => true,
    _ => permissions == required || permissions == levels::SUPER_ADMIN,
};
```

5. Update API validation:
```rust
if ![1, 10, 25, 50, 100].contains(&new_permissions) {  // Add 25
    return HttpResponse::BadRequest()
        .json(BaseResponse::error("Invalid permission level"));
}
```

---

## Related Documentation

- [API Routes](../Routes/Api/API_ROUTES.md) - Protected API endpoints
- [Web Routes](../Routes/Web/WEB_ROUTES.md) - Protected web pages
- [Controllers](../Controllers/CONTROLLERS.md) - Permission checks in controllers
