# Repository Guidelines

## Project Structure & Module Organization
- Infrastructure lives at the repo root (Dockerfiles, `docker-compose.yml`, service configs).
- Application code is in `blazing_sun/`.
  - Rust backend: `blazing_sun/src/` (entry at `blazing_sun/src/main.rs`).
  - Database migrations: `blazing_sun/migrations/` (SQLx).
  - Frontend pages: `blazing_sun/src/frontend/pages/<PAGE>/` (Vite + JS/SCSS).
  - Tests: `blazing_sun/tests/` (Rust integration + Playwright E2E).
- Long-form docs live in `Documentation/` and `blazing_sun/README.md`.

## Build, Test, and Development Commands
Run in the Rust container unless noted.
- `docker compose up -d`: start all services.
- `docker compose exec rust bash`: open a shell in the app container.
- `cargo build` / `cargo run`: build or run the Rust app.
- `cargo sqlx prepare`: refresh SQLx offline metadata after query changes.
- `./src/frontend/build-frontend.sh all`: build all frontend pages.
- `npx playwright test` (from `blazing_sun/tests`): run E2E tests.

## Coding Style & Naming Conventions
- Rust: follow `rustfmt` defaults (`cargo fmt`) and lint with `cargo clippy`.
- Naming: `snake_case` for modules/functions/fields, `CamelCase` for types, `SCREAMING_SNAKE_CASE` for constants.
- Frontend: keep component/file names `PascalCase` (e.g., `SignUp.js`) and SCSS partials prefixed with `_`.

## Testing Guidelines
- Rust integration tests: `cargo test --test integration`.
- E2E tests live in `blazing_sun/tests` and run with `npm test` or `npx playwright test`.
- Prefer adding tests alongside the feature area (API tests in `blazing_sun/tests/routes/api/`, web specs in `blazing_sun/tests/routes/web/`).

## Commit & Pull Request Guidelines
- No strict commit convention observed; use short, imperative subjects and include a scope when helpful (e.g., `api: add oauth scope checks`).
- PRs should include a concise description, testing notes, and screenshots/GIFs for UI changes. Link related issues when applicable.

## Security & Configuration Notes
- Copy `.env.example` to `.env` and keep secrets out of Git.
- Update default passwords in `.env` before running in production.


<!-- available_skills:start -->
<!-- Skills discovered dynamically. Last sync: 1767561367 UTC. Total: 24 skills. -->
<!-- Use CLI commands for current skill inventory:
     jq -r '.skills[].path' ~/.codex/skills-cache.json
     find ~/.codex/skills -name SKILL.md -type f
     skrills analyze           - Analyze skills (tokens/deps) to spot issues
     skrills doctor            - View discovery diagnostics
-->
<!-- available_skills:end -->


<!-- available_agents:start -->
<!-- Agents discovered dynamically. Total: 7 agents. -->
<!-- Use CLI commands for current agent inventory:
     skrills sync-agents       - Sync agents from external sources
     skrills doctor            - View agent discovery diagnostics
-->
<!-- available_agents:end -->

