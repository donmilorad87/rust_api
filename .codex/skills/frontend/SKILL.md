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

## Read before work
- `Documentation/blazing_sun/Templates/TEMPLATES.md`
- `Documentation/blazing_sun/Routes/Web/WEB_ROUTES.md`
- `Documentation/blazing_sun/Uploads/UPLOADS.md`
- `Documentation/blazing_sun/Bootstrap/BOOTSTRAP.md`
- `Documentation/blazing_sun/Email/EMAIL.md`
