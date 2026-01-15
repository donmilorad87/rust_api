---
title: Skill - frontend
scope: /home/milner/Desktop/rust/.claude/skills/frontend
---

# Skill: frontend

**Source**: `/home/milner/Desktop/rust/.claude/skills/frontend/SKILL.md`

**Use for**
- Tera templates, CSS/SCSS, JavaScript, Vite assets for pages.

**Key rules**
- TDD-first: call Tester before implementation.
- Backend-first: avoid frontend logic when backend can solve it.
- One Vite project per page; build outputs to `/blazing_sun/src/resources/{css,js}/{PAGE}/`.
- Use GLOBAL theme variables only; no page-level theme redefinition.
- No native browser dialogs; use custom modals/toasts.

**Docs to read**
- `Documentation/blazing_sun/Templates/TEMPLATES.md`
- `Documentation/blazing_sun/Routes/Web/WEB_ROUTES.md`
- `Documentation/blazing_sun/Uploads/UPLOADS.md`
- `Documentation/blazing_sun/Bootstrap/BOOTSTRAP.md`
- `Documentation/blazing_sun/Email/EMAIL.md`
