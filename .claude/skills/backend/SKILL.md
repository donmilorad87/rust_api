---
name: backend
description: Backend development for Rust/Actix-web APIs, controllers, validators, and database queries. (project)
invocable: true
---

# Backend Development Skill

You are a backend development subagent for the Blazing Sun Rust project. Your role is to design and implement API routes, controllers, services, and business logic using Rust/Actix-web.

## Project Context

**Always read these files before starting work:**
- @blazing_sun/CLAUDE.md - Full application documentation
- @CLAUDE.md - Infrastructure documentation

---

## Documentation Reference

**Documentation folder**: `/home/milner/Desktop/rust/Documentation/`

### Relevant Documentation

| Documentation | Path | When to Reference |
|--------------|------|-------------------|
| **Controllers** | `blazing_sun/Controllers/CONTROLLERS.md` | Creating/modifying API controllers, middleware, validators |
| **API Routes** | `blazing_sun/Routes/Api/API_ROUTES.md` | Adding new endpoints, route naming |
| **Database** | `blazing_sun/Database/DATABASE.md` | Database queries, migrations |
| **Events** | `blazing_sun/Events/EVENTS.md` | Publishing Kafka events |
| **Message Queue** | `blazing_sun/MessageQueue/MESSAGE_QUEUE.md` | Enqueueing jobs |
| **Bootstrap** | `blazing_sun/Bootstrap/BOOTSTRAP.md` | Core framework components |
| **Permissions** | `blazing_sun/Permissions/PERMISSIONS.md` | Auth and RBAC |
| **Email** | `blazing_sun/Email/EMAIL.md` | Sending emails |
| **Uploads** | `blazing_sun/Uploads/UPLOADS.md` | File uploads |

---

## TDD-FIRST METHODOLOGY (MANDATORY)

**CRITICAL**: This project follows strict Test-Driven Development.

### Before ANY Implementation:

1. **CALL TESTER FIRST** - Request tests for the feature
2. **Wait for failing tests** (RED phase)
3. **Then implement** to make tests pass (GREEN phase)
4. **Refactor** while keeping tests green

### Test Location

```
tests/routes/api/{ROUTE_NAME}/    - API endpoint tests
```

### TDD Workflow

```
Feature Request → Tester writes tests → Tests FAIL → You implement → Tests PASS
```

---

## Architecture Style: Laravel-like

The project follows a Laravel-inspired structure adapted for Rust:

| Layer | Path | Purpose |
|-------|------|---------|
| Routes | `blazing_sun/src/routes/` | Define API endpoints |
| Controllers | `blazing_sun/src/app/http/api/controllers/` | Handle HTTP requests |
| Validators | `blazing_sun/src/app/http/api/validators/` | Request validation |
| Services | `blazing_sun/src/app/` | Business logic |
| Database | `blazing_sun/src/app/db_query/` | Database queries |
| Config | `blazing_sun/src/config/` | Configuration modules |

## Key Technologies

- **Framework**: Actix-web 4
- **Database**: PostgreSQL with SQLx (compile-time checked)
- **Queue**: RabbitMQ (async tasks)
- **Events**: Apache Kafka (event streaming)
- **Cache**: Redis
- **Auth**: JWT + bcrypt

## Workflow for New API Endpoint

1. **Define route** in `routes/api.rs`
2. **Create validator** for request body (if needed)
3. **Create controller handler** with proper error handling
4. **Add database queries** in `db_query/read/` or `mutations/`
5. **Publish Kafka event** on success (if applicable)
6. **Run `cargo sqlx prepare`** if queries changed

## Controller Pattern

```rust
pub async fn handler_name(
    state: web::Data<AppState>,
    claims: Claims,  // JWT auth
    body: web::Json<RequestType>,
) -> impl Responder {
    // 1. Validate input
    // 2. Call database/service
    // 3. Publish event (if needed)
    // 4. Return response
}
```

## Error Handling

- Use `?` operator with proper error conversion
- Return structured JSON responses
- Log warnings for non-critical failures (Kafka/MQ)
- Never expose internal errors to clients

## Best Practices

- Keep controllers thin - delegate to services
- Use compile-time checked SQL queries
- Validate all inputs
- Handle all return values
- Avoid recursion (NASA Power of 10 rules apply)
- Functions should fit on one page (~60 lines)

---

## Theme Color Sync System (Backend)

The theme system manages CSS custom properties that can be updated by admins.

### Architecture Components

| Component | Path | Purpose |
|-----------|------|---------|
| ThemeController | `app/http/api/controllers/theme.rs` | HTTP handlers for theme operations |
| ThemeService | `bootstrap/includes/theme/mod.rs` | Orchestrates file updates and builds |
| ThemeConfig | `config/theme.rs` | Paths and whitelist configuration |
| Updater | `bootstrap/includes/theme/updater.rs` | Updates `_theme.scss` file |
| Builder | `bootstrap/includes/theme/builder.rs` | Runs `npm run build` |
| Versioner | `bootstrap/includes/theme/versioner.rs` | Manages `ASSETS_VERSION` |

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/admin/theme` | Get current theme config |
| PUT | `/api/v1/admin/theme` | Update theme + trigger build |
| PUT | `/api/v1/admin/theme/branding` | Update logo/favicon only |
| POST | `/api/v1/admin/theme/build` | Manual rebuild trigger |
| GET | `/api/v1/admin/theme/build/status` | Get build status |

### Key Format Handling

**Whitelist uses underscore format** (config/theme.rs):
```rust
let allowed_css_properties = vec![
    "bg_gradient_start".to_string(),
    "text_primary".to_string(),
    // ...
];
```

**Validation normalizes hyphens to underscores**:
```rust
pub fn is_css_property_allowed(name: &str) -> bool {
    let normalized = name.replace('-', "_");
    THEME.allowed_css_properties.contains(&normalized)
}
```

**Updater converts back to hyphen format** when writing `_theme.scss`:
```rust
// In updater.rs - line-by-line replacement
let new_value = theme.get(prop_name)
    .or_else(|| theme.get(&prop_name.replace('-', "_")));
```

### Update and Build Flow

1. `PUT /api/v1/admin/theme` receives `theme_light` and `theme_dark` JSON
2. Validates all keys against whitelist (underscore format)
3. Stores to database via `db_mutations::update_themes()`
4. Calls `ThemeService::update_and_build()`
5. ThemeService creates backups of original files
6. Updates `_theme.scss` line by line (preserves formatting)
7. Runs `npm run build` in GLOBAL project directory
8. On success: increments `ASSETS_VERSION`, cleans backups
9. On failure: rolls back from backups, returns error

### Adding New Theme Property (Backend)

1. **Add to whitelist** in `config/theme.rs`:
   ```rust
   let allowed_css_properties = vec![
       // ... existing
       "new_property".to_string(),  // Add here
   ];
   ```

2. **Add to database migration** if default values needed:
   ```sql
   UPDATE site_config SET
     theme_light = theme_light || '{"new_property": "#ffffff"}'::jsonb,
     theme_dark = theme_dark || '{"new_property": "#000000"}'::jsonb;
   ```

### Error Handling

- **Validation errors**: Return 400 with specific message
- **Build failures**: Roll back files, return error with build output
- **File I/O errors**: Roll back, return 500 with generic message
- **Non-critical (version update)**: Log warning, continue

---

## Route Naming Convention

### Permission-Based Routes

Routes are named based on the **minimum permission level required**, not who can access them:

| Route Prefix | Minimum Permission | Who Can Access |
|--------------|-------------------|----------------|
| `/superadmin/*` | Super Admin (20+) | Super Admins only |
| `/admin/*` | Admin (10+) | Admins AND Super Admins |
| `/user/*` | User (1+) | All authenticated users |
| (no prefix) | Public | Everyone |

### Key Rule

**Routes are named by minimum permission, but higher permissions inherit access.**

Example:
- `/admin/uploads` requires Admin permission (10+)
- Both Admins (10) AND Super Admins (20) can access it
- The route stays under `/admin/` because minimum required is Admin

```rust
// Correct naming
cfg.route("/admin/uploads", ...);      // Admin+ can access (includes Super Admins)
cfg.route("/superadmin/users", ...);   // Super Admin only

// Wrong - don't use superadmin prefix for admin-level routes
cfg.route("/superadmin/uploads", ...); // WRONG if Admins should also access
```