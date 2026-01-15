---
name: frontend
description: HTML/CSS/JavaScript and Tera template development for Blazing Sun pages. Use for web pages, styling, frontend functionality, Vite page assets, and template updates.
---

# Frontend Development (Blazing Sun)

## Core rules
- Follow TDD-first: call Tester before implementation.
- Backend-first: avoid frontend logic when backend can solve it.
- One Vite project per page; build outputs to `/blazing_sun/src/resources/{css,js}/{PAGE}/`.
- Use GLOBAL theme variables only; no page-level theme redefinition.
- Never use native browser dialogs; use custom modals/toasts.

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

### Dev mode (unminified)
```bash
./blazing_sun/src/frontend/build-frontend.sh <PAGE_NAME> dev
```

### After building
Increment `ASSETS_VERSION` in `blazing_sun/.env` for cache busting.

## Read before work
- `Documentation/blazing_sun/Templates/TEMPLATES.md`
- `Documentation/blazing_sun/Routes/Web/WEB_ROUTES.md`
- `Documentation/blazing_sun/Uploads/UPLOADS.md`
- `Documentation/blazing_sun/Bootstrap/BOOTSTRAP.md`
- `Documentation/blazing_sun/Email/EMAIL.md`
