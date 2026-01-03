# Web Routes Quick Reference

## Authentication Pages

### Sign In (`/sign-in`)
- **Route**: `web.sign_in`
- **Auth**: No (redirects to `/profile` if logged in)
- **Frontend**: `/src/frontend/pages/SIGN_IN/` (3.2KB JS, 3.5KB CSS)
- **Features**: Email/password form, JWT storage, redirect on success
- **API**: `POST /api/v1/auth/sign-in`

### Sign Up (`/sign-up`)
- **Route**: `web.sign_up`
- **Auth**: No (redirects to `/profile` if logged in)
- **Frontend**: `/src/frontend/pages/SIGN_UP/` (5.4KB JS, 7.2KB CSS)
- **Features**: 2-step registration (form → email activation)
- **APIs**: `POST /api/v1/auth/sign-up`, `POST /api/v1/account/activate-account`

### Forgot Password (`/forgot-password`)
- **Route**: `web.forgot_password`
- **Auth**: No (redirects to `/profile` if logged in)
- **Frontend**: `/src/frontend/pages/FORGOT_PASSWORD/` (15KB JS, 14KB CSS)
- **Features**: 3-step reset (request code → verify → set new password)
- **APIs**: `POST /api/v1/password/forgot-password`, `POST /api/v1/password/verify-reset-code`, `POST /api/v1/password/reset-password`

---

## User Pages

### Homepage (`/`)
- **Route**: `web.home`
- **Auth**: No (shows different content for logged/guest users)
- **Frontend**: `/src/frontend/pages/GLOBAL/` only
- **Features**: Landing page, conditional navigation based on auth status

### Galleries (`/galleries`)
- **Route**: `web.galleries`
- **Auth**: Yes (manual check, redirects to `/sign-in`)
- **Frontend**: `/src/frontend/pages/GALLERIES/` (31KB JS, 16KB CSS)
- **Features**: Gallery CRUD, picture management, drag-and-drop, lightbox
- **APIs**: Gallery API endpoints (`/api/v1/galleries`)

### Logout (`/logout`)
- **Route**: `web.logout`
- **Auth**: No (clears auth cookie)
- **Features**: Clears JWT cookie, redirects to homepage
- **Implementation**: Server-side only, no frontend page

---

## Super Admin Pages

### Registered Users (`/superadmin/users`)
- **Route**: `superadmin.users`
- **Auth**: Yes (Super Admin = 100 required)
- **Frontend**: `/src/frontend/pages/REGISTERED_USERS/` (13KB JS, 6.4KB CSS)
- **Features**: User management, permission updates, avatar deletion, search, pagination
- **APIs**: `GET /api/v1/admin/users`, `PATCH /api/v1/admin/user/{id}/permission`, `DELETE /api/v1/admin/user/{id}/avatar`

---

## Static Assets

### JavaScript Assets (`/assets/js/*`)
- **Auth**: No
- **Location**: `/blazing_sun/src/resources/js/`
- **Pattern**: `/{PAGE_NAME}/app.js`
- **Versioning**: `?v={ASSETS_VERSION}` for cache busting

### CSS Assets (`/assets/css/*`)
- **Auth**: No
- **Location**: `/blazing_sun/src/resources/css/`
- **Pattern**: `/{PAGE_NAME}/style.css`
- **Versioning**: `?v={ASSETS_VERSION}` for cache busting

---

## Error Pages

### 404 Not Found (`/*`)
- **Route**: Fallback (any unmatched route)
- **Auth**: No
- **Template**: `web/404.html`
- **Features**: Custom 404 page with navigation back to home

---

## Permission Matrix

| Route | Basic (1) | Admin (10) | Affiliate (50) | Super Admin (100) |
|-------|-----------|------------|----------------|-------------------|
| `/` | ✓ | ✓ | ✓ | ✓ |
| `/sign-in` | ✓ (guest) | ✓ (guest) | ✓ (guest) | ✓ (guest) |
| `/sign-up` | ✓ (guest) | ✓ (guest) | ✓ (guest) | ✓ (guest) |
| `/forgot-password` | ✓ (guest) | ✓ (guest) | ✓ (guest) | ✓ (guest) |
| `/profile` | ✓ | ✓ | ✓ | ✓ |
| `/galleries` | ✓ | ✓ | ✓ | ✓ |
| `/admin/uploads` | ✗ | ✓ | ✓ | ✓ |
| `/admin/theme` | ✗ | ✓ | ✓ | ✓ |
| `/superadmin/users` | ✗ | ✗ | ✗ | ✓ |

---

## Frontend Bundle Sizes

| Page | JS Size | CSS Size | Total |
|------|---------|----------|-------|
| GLOBAL | 1.8KB | 29KB | 30.8KB |
| SIGN_IN | 3.2KB | 3.5KB | 6.7KB |
| SIGN_UP | 5.4KB | 7.2KB | 12.6KB |
| FORGOT_PASSWORD | 15KB | 14KB | 29KB |
| PROFILE | 27KB | 8.5KB | 35.5KB |
| GALLERIES | 31KB | 16KB | 47KB |
| UPLOADS | 33KB | 20KB | 53KB |
| REGISTERED_USERS | 13KB | 6.4KB | 19.4KB |
| THEME | 97KB | 30KB | 127KB |

---

For detailed documentation, see individual route files in this directory.
