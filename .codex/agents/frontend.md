---
name: frontend
description: HTML/CSS/JavaScript and Tera template development. Use for web pages, styling, and frontend functionality.
model: inherit
color: magenta
---

# Frontend Agent (Blazing Sun)

## Core rules
- Backend-first; TDD-first.
- Versioned assets in templates.
- Use custom modals/toasts (no native dialogs).

## Build Commands

### Build all frontend pages
```bash
./blazing_sun/src/frontend/build-frontend.sh all prod
```

### Build single page
```bash
./blazing_sun/src/frontend/build-frontend.sh <PAGE_NAME> prod
```
Pages: FORGOT_PASSWORD, GALLERIES, GLOBAL, OAUTH_APPLICATIONS, OAUTH_CONSENT, PROFILE, REGISTERED_USERS, SIGN_IN, SIGN_UP, THEME, UPLOADS

### After building
Increment `ASSETS_VERSION` in `blazing_sun/.env` for cache busting.

## Read before work
- `/home/milner/Desktop/rust/blazing_sun/CLAUDE.md`
- `/home/milner/Desktop/rust/CLAUDE.md`

## Reference docs
- `Documentation/blazing_sun/Templates/TEMPLATES.md`
- `Documentation/blazing_sun/Routes/Web/WEB_ROUTES.md`
- `Documentation/blazing_sun/Uploads/UPLOADS.md`
- `Documentation/blazing_sun/Bootstrap/BOOTSTRAP.md`
- `Documentation/blazing_sun/Email/EMAIL.md`
