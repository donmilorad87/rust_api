# CLAUDE.md - Application Guide

This file provides guidance to Claude Code when working with the Blazing Sun application.

> **Infrastructure docs are in root `../CLAUDE.md`.** This file covers application code only.

---

## Quick Reference

### Tech Stack
| Component | Technology |
|-----------|------------|
| Framework | Actix-web 4 (Rust) |
| Databases | PostgreSQL (sqlx), MongoDB |
| Queue | RabbitMQ (lapin) |
| Events | Apache Kafka (rdkafka) |
| Cache | Redis |
| Email | SMTP (lettre) |
| Templates | Tera |
| Auth | JWT |
| Frontend | Vanilla JS (ES6), Vite, SCSS |

### Key Directories
```
blazing_sun/
├── src/
│   ├── bootstrap/        # Core framework layer
│   ├── app/              # Application layer
│   │   ├── http/         # Controllers (web + API)
│   │   ├── db_query/     # Database queries (read + mutations)
│   │   ├── games/        # Game logic (roulette, bigger_dice, tic_tac_toe)
│   │   ├── mq/           # RabbitMQ jobs and workers
│   │   └── events/       # Kafka event publishers
│   ├── config/           # Configuration modules
│   └── routes/           # Route definitions (api.rs, web.rs)
├── migrations/           # Database migrations
├── storage/              # File storage (uploads, backups)
├── src/frontend/         # Frontend components (Vite)
│   ├── pages/            # Page-specific bundles
│   └── games/            # Game-specific bundles
└── src/resources/        # Compiled assets (CSS, JS)
```

---

## Detailed Documentation (CLAUDE_partials/)

All detailed application documentation is organized in the `CLAUDE_partials/` folder:

| File | Description |
|------|-------------|
| [01-overview.md](CLAUDE_partials/01-overview.md) | Application purpose, complete tech stack |
| [02-project-structure.md](CLAUDE_partials/02-project-structure.md) | Complete directory tree with file purposes |
| [03-modules.md](CLAUDE_partials/03-modules.md) | main.rs initialization, module exports |
| [04-configuration.md](CLAUDE_partials/04-configuration.md) | Configuration pattern, AppState structure |
| [05-database-queries.md](CLAUDE_partials/05-database-queries.md) | Read/mutation operations, query API |
| [06-event-driven.md](CLAUDE_partials/06-event-driven.md) | Kafka topics, event publishing patterns |
| [07-rabbitmq-jobs.md](CLAUDE_partials/07-rabbitmq-jobs.md) | Job priorities, email templates |
| [08-storage-system.md](CLAUDE_partials/08-storage-system.md) | Storage driver architecture, S3-ready |
| [09-api-endpoints.md](CLAUDE_partials/09-api-endpoints.md) | Complete API endpoints reference |
| [10-admin-theme.md](CLAUDE_partials/10-admin-theme.md) | Theme system, SCSS build, JSON-LD schemas |
| [11-named-routes.md](CLAUDE_partials/11-named-routes.md) | Laravel-style routes with i18n support |
| [12-database-schema.md](CLAUDE_partials/12-database-schema.md) | Tables overview, column definitions |
| [13-adding-features.md](CLAUDE_partials/13-adding-features.md) | Checklists for adding new features |
| [14-development.md](CLAUDE_partials/14-development.md) | Development commands, common workflows |
| [15-important-notes.md](CLAUDE_partials/15-important-notes.md) | SQLx offline mode, JWT, error handling |

---

## Additional Documentation

### Routes & Endpoints
- **[../Documentation/blazing_sun/Routes/Web/README.md](../Documentation/blazing_sun/Routes/Web/README.md)** - All web pages (11 routes)
- **[../Documentation/blazing_sun/Routes/API/README.md](../Documentation/blazing_sun/Routes/API/README.md)** - All API endpoints (65+)

### Game Documentation
- **[../Documentation/Games/ROULETTE.md](../Documentation/Games/ROULETTE.md)** - Roulette game implementation

### Backend Systems
| System | Documentation |
|--------|---------------|
| Bootstrap Layer | [../Documentation/blazing_sun/Bootstrap/BOOTSTRAP.md](../Documentation/blazing_sun/Bootstrap/BOOTSTRAP.md) |
| Controllers | [../Documentation/blazing_sun/Controllers/CONTROLLERS.md](../Documentation/blazing_sun/Controllers/CONTROLLERS.md) |
| Database Layer | [../Documentation/blazing_sun/Database/DATABASE.md](../Documentation/blazing_sun/Database/DATABASE.md) |
| Permissions | [../Documentation/blazing_sun/Permissions/PERMISSIONS.md](../Documentation/blazing_sun/Permissions/PERMISSIONS.md) |
| Events (Kafka) | [../Documentation/blazing_sun/Events/EVENTS.md](../Documentation/blazing_sun/Events/EVENTS.md) |
| Message Queue | [../Documentation/blazing_sun/MessageQueue/MESSAGE_QUEUE.md](../Documentation/blazing_sun/MessageQueue/MESSAGE_QUEUE.md) |
| Cron Jobs | [../Documentation/blazing_sun/CronJobs/CRON_JOBS.md](../Documentation/blazing_sun/CronJobs/CRON_JOBS.md) |
| MongoDB | [../Documentation/blazing_sun/MongoDB/MONGODB.md](../Documentation/blazing_sun/MongoDB/MONGODB.md) |
| Uploads | [../Documentation/blazing_sun/Uploads/UPLOADS.md](../Documentation/blazing_sun/Uploads/UPLOADS.md) |
| Email | [../Documentation/blazing_sun/Email/EMAIL.md](../Documentation/blazing_sun/Email/EMAIL.md) |

### Frontend
- **[../Documentation/blazing_sun/Frontend/README.md](../Documentation/blazing_sun/Frontend/README.md)** - ES6 classes, Vite, SCSS structure

---

## Common Code Patterns

### Database Queries
```rust
use crate::app::db_query::read::user;
use crate::app::db_query::mutations::user;

// Read
let user = user::get_by_email(&db, "test@example.com").await?;

// Mutation
user::create(&db, &CreateUserParams { ... }).await?;
```

See [CLAUDE_partials/05-database-queries.md](CLAUDE_partials/05-database-queries.md) for all query patterns.

### Publishing Events (Kafka)
```rust
if let Some(event_bus) = state.event_bus() {
    events::publish::user_created(
        event_bus,
        user_id,
        &email,
        &first_name,
        &last_name,
        None
    ).await?;
}
```

See [CLAUDE_partials/06-event-driven.md](CLAUDE_partials/06-event-driven.md) for all event types.

### Enqueueing Jobs (RabbitMQ)
```rust
use crate::bootstrap::mq::{self, JobOptions};

let options = JobOptions::new().priority(1).fault_tolerance(3);
mq::enqueue_job_dyn(&mq, "send_email", &params, options).await?;
```

See [CLAUDE_partials/07-rabbitmq-jobs.md](CLAUDE_partials/07-rabbitmq-jobs.md) for all job types.

### Named Routes (Laravel-like)
```html
<!-- In Tera templates -->
<a href="{{ route(name='web.sign_up') }}">Sign Up</a>
<a href="{{ route(name='web.profile') }}">Profile</a>
<a href="{{ route(name='admin.uploads') }}">Uploads</a>
```

See [CLAUDE_partials/11-named-routes.md](CLAUDE_partials/11-named-routes.md) for named routes.

### File Uploads
```rust
use crate::bootstrap::utility::upload;

let result = upload::save_uploaded_file(
    &state.storage,
    &state.db,
    file,
    user_id,
    StorageType::Public,
    UploadContext::PublicFile,
).await?;
```

See [CLAUDE_partials/08-storage-system.md](CLAUDE_partials/08-storage-system.md) for file handling.

---

## Development Workflow

### Build & Run
```bash
# Build
cargo build

# Run
cargo run

# Test
cargo test

# Watch (hot reload)
cargo watch -x run
```

### Database Migrations
```bash
# Run migrations
sqlx migrate run

# Create new migration
sqlx migrate add <name>

# After changing queries (offline mode)
cargo sqlx prepare
```

### Frontend Development
```bash
# Enter page directory (e.g., PROFILE)
cd src/frontend/pages/PROFILE

# Install dependencies
npm install

# Build for development
npm run build

# Build for production
npm run build:prod

# Watch mode (hot reload)
npm run watch
```

See [CLAUDE_partials/14-development.md](CLAUDE_partials/14-development.md) for more commands.

---

## Important Reminders

1. **SQLx Offline Mode**: Always run `cargo sqlx prepare` after changing queries
2. **Event Publishing**: Check if event bus exists before publishing (it's optional)
3. **Error Handling**: Log Kafka/MQ failures as warnings, don't fail the request
4. **Money Storage**: Store as `BIGINT` (cents) for precision
5. **File Storage**: Use StorageDriver abstraction for S3-ready architecture
6. **Image Variants**: Uploaded images automatically generate 5 variants via RabbitMQ
7. **Named Routes**: Always use `route(name='...')` in templates, never hardcode URLs
8. **Permissions**: Check user permissions in controllers (1=basic, 10=admin, 50=affiliate, 100=super admin)
9. **Theme Build**: After theme config changes, trigger SCSS build via API
10. **Frontend Bundles**: Each page has its own JS/CSS bundle, compiled by Vite

See [CLAUDE_partials/15-important-notes.md](CLAUDE_partials/15-important-notes.md) for detailed notes.

---

## Project Statistics

| Metric | Value |
|--------|-------|
| Web Routes | 11 (includes 404 fallback) |
| API Endpoints | 65+ (9 scopes) |
| Frontend Pages | 8 (GLOBAL + 7 feature pages) |
| Game Pages | 3 (Roulette, Bigger Dice, Tic Tac Toe) |
| Database Tables | 15+ (PostgreSQL) |
| Kafka Topics | 6+ (user, transaction, system, roulette.*) |
| RabbitMQ Jobs | 5 types (email, SMS, image, user, notifications) |
| Image Variants | 5 per upload (thumb, small, medium, large, full) |
| Permission Levels | 4 (1=basic, 10=admin, 50=affiliate, 100=super) |

---

## Adding New Features

When adding new features, follow this order:

1. **Database Schema** - Create migration in `migrations/`
2. **Database Queries** - Add to `src/app/db_query/read/` or `mutations/`
3. **API Endpoint** - Add controller in `src/app/http/api/controllers/`
4. **Route Definition** - Add to `src/routes/api.rs` or `web.rs`
5. **Frontend Component** - Add page in `src/frontend/pages/` or `src/frontend/games/`
6. **Build Frontend** - Run `npm run build` in page directory
7. **Tests** - Add integration tests in `tests/`

See [CLAUDE_partials/13-adding-features.md](CLAUDE_partials/13-adding-features.md) for detailed checklists.

---

## Quick Links

| Need | Go To |
|------|-------|
| Add API endpoint | [CLAUDE_partials/13-adding-features.md](CLAUDE_partials/13-adding-features.md) |
| Add Kafka event | [CLAUDE_partials/06-event-driven.md](CLAUDE_partials/06-event-driven.md) |
| Add RabbitMQ job | [CLAUDE_partials/07-rabbitmq-jobs.md](CLAUDE_partials/07-rabbitmq-jobs.md) |
| Database queries | [CLAUDE_partials/05-database-queries.md](CLAUDE_partials/05-database-queries.md) |
| Named routes | [CLAUDE_partials/11-named-routes.md](CLAUDE_partials/11-named-routes.md) |
| File uploads | [CLAUDE_partials/08-storage-system.md](CLAUDE_partials/08-storage-system.md) |
| Theme system | [CLAUDE_partials/10-admin-theme.md](CLAUDE_partials/10-admin-theme.md) |
| Project structure | [CLAUDE_partials/02-project-structure.md](CLAUDE_partials/02-project-structure.md) |
