# CLAUDE.md - Application Guide

This file provides guidance to Claude Code when working with the Blazing Sun application.

> **Infrastructure docs are in root `CLAUDE.md`.** This file covers application code only.

---

## Quick Reference

### Tech Stack
- **Framework**: Actix-web 4 (Rust)
- **Databases**: PostgreSQL (sqlx), MongoDB
- **Queue**: RabbitMQ (lapin)
- **Events**: Apache Kafka (rdkafka)
- **Cache**: Redis
- **Email**: SMTP (lettre)
- **Templates**: Tera
- **Auth**: JWT
- **Frontend**: Vanilla JS (ES6), Vite, SCSS

### Key Directories
```
blazing_sun/
├── src/
│   ├── bootstrap/        # Core framework layer
│   ├── app/              # Application layer
│   │   ├── http/         # Controllers (web + API)
│   │   ├── db_query/     # Database queries (read + mutations)
│   │   ├── mq/           # RabbitMQ jobs and workers
│   │   └── events/       # Kafka event publishers
│   ├── config/           # Configuration modules
│   └── routes/           # Route definitions (api.rs, web.rs)
├── migrations/           # Database migrations
├── storage/              # File storage (uploads, backups)
├── src/frontend/pages/   # Frontend components (Vite)
└── src/resources/        # Compiled assets (CSS, JS)
```

---

## 📚 Complete Documentation

### Routes & Endpoints
- **[Web Routes Overview](../Documentation/blazing_sun/Routes/Web/README.md)** - All web pages (11 routes)
- **[Web Routes Quick Reference](../Documentation/blazing_sun/Routes/Web/quick-reference.md)** - Permission matrix, bundle sizes
- **[API Routes Overview](../Documentation/blazing_sun/Routes/API/README.md)** - All API endpoints (65+)

#### Individual Web Pages
- [Sign In Page](../Documentation/blazing_sun/Routes/Web/sign-in.md) - `/sign-in`
- [Sign Up Page](../Documentation/blazing_sun/Routes/Web/sign-up.md) - `/sign-up`
- [Forgot Password Page](../Documentation/blazing_sun/Routes/Web/forgot-password.md) - `/forgot-password`
- [Profile Page](../Documentation/blazing_sun/Routes/Web/profile.md) - `/profile` (avatar, password, email)
- [Galleries Page](../Documentation/blazing_sun/Routes/Web/galleries.md) - `/galleries` (CRUD, pictures, lightbox)
- [Admin Theme Page](../Documentation/blazing_sun/Routes/Web/theme.md) - `/admin/theme` (colors, typography, SEO, schema)
- [Admin Uploads Page](../Documentation/blazing_sun/Routes/Web/uploads.md) - `/admin/uploads` (asset management, variants)
- [Super Admin Users Page](../Documentation/blazing_sun/Routes/Web/registered-users.md) - `/superadmin/users`

### Frontend Architecture
- **[Frontend Overview](../Documentation/blazing_sun/Frontend/README.md)** - ES6 classes, Vite, SCSS structure
- **[Profile Page Components](../Documentation/blazing_sun/ProfilePage/README.md)** - Avatar, password, email change
- **[Admin Uploads System](../Documentation/blazing_sun/AdminUploads/README.md)** - Image variants, RabbitMQ integration

### Backend Systems

#### Core Framework
- **[Bootstrap Layer](../Documentation/blazing_sun/Bootstrap/BOOTSTRAP.md)** - Initialization sequence, middleware, utilities
- **[Controllers](../Documentation/blazing_sun/Controllers/CONTROLLERS.md)** - API + web controllers
- **[Database Layer](../Documentation/blazing_sun/Database/DATABASE.md)** - Query organization, stored procedures
- **[Permissions System](../Documentation/blazing_sun/Permissions/PERMISSIONS.md)** - User levels (1, 10, 50, 100)

#### Event-Driven Architecture
- **[Events (Kafka)](../Documentation/blazing_sun/Events/EVENTS.md)** - Event publishers, topics, patterns
- **[Message Queue (RabbitMQ)](../Documentation/blazing_sun/MessageQueue/MESSAGE_QUEUE.md)** - Job enqueuing, workers, priorities
- **[Cron Jobs](../Documentation/blazing_sun/CronJobs/CRON_JOBS.md)** - Scheduled tasks

#### Data & Storage
- **[MongoDB Integration](../Documentation/blazing_sun/MongoDB/MONGODB.md)** - Document store usage
- **[Uploads System](../Documentation/blazing_sun/Uploads/UPLOADS.md)** - File storage, S3-ready architecture
- **[Email System](../Documentation/blazing_sun/Email/EMAIL.md)** - Templates, SMTP configuration

#### Theme Configuration
- **[Theme System Overview](../Documentation/blazing_sun/theme_configurations/OVERVIEW.md)**
- **[Colors Configuration](../Documentation/blazing_sun/theme_configurations/COLORS.md)** - Light/dark themes
- **[Typography Configuration](../Documentation/blazing_sun/theme_configurations/TYPOGRAPHY.md)** - Fonts, sizes, weights
- **[Spacing Configuration](../Documentation/blazing_sun/theme_configurations/SPACING.md)** - Scale system
- **[Branding Configuration](../Documentation/blazing_sun/theme_configurations/BRANDING.md)** - Logo, favicon
- **[SEO Configuration](../Documentation/blazing_sun/theme_configurations/SEO.md)** - Meta tags, Schema.org

#### Templates
- **[Template System](../Documentation/blazing_sun/Templates/TEMPLATES.md)** - Tera templates, partials, helpers

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
See [Database Layer](../Documentation/blazing_sun/Database/DATABASE.md) for all query patterns.

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
See [Events](../Documentation/blazing_sun/Events/EVENTS.md) for all event types.

### Enqueueing Jobs (RabbitMQ)
```rust
use crate::bootstrap::mq::{self, JobOptions};

let options = JobOptions::new().priority(1).fault_tolerance(3);
mq::enqueue_job_dyn(&mq, "send_email", &params, options).await?;
```
See [Message Queue](../Documentation/blazing_sun/MessageQueue/MESSAGE_QUEUE.md) for all job types.

### Named Routes (Laravel-like)
```html
<!-- In Tera templates -->
<a href="{{ route(name='web.sign_up') }}">Sign Up</a>
<a href="{{ route(name='web.profile') }}">Profile</a>
<a href="{{ route(name='admin.uploads') }}">Uploads</a>
```
See [Bootstrap Layer](../Documentation/blazing_sun/Bootstrap/BOOTSTRAP.md) for named routes.

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
See [Uploads System](../Documentation/blazing_sun/Uploads/UPLOADS.md) for file handling.

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
# Enter PROFILE page directory
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

See [Frontend Overview](../Documentation/blazing_sun/Frontend/README.md) for all frontend build commands.

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

---

## Project Statistics

- **Web Routes**: 11 (includes 404 fallback)
- **API Endpoints**: 65+ (9 scopes)
- **Frontend Pages**: 8 (GLOBAL + 7 feature pages)
- **Database Tables**: 15+ (PostgreSQL)
- **Kafka Topics**: 3 (user_events, transaction_events, system_events)
- **RabbitMQ Jobs**: 5 types (email, SMS, image resize, user creation, notifications)
- **Image Variants**: 5 per upload (thumb, small, medium, large, full)
- **Permission Levels**: 4 (1=basic, 10=admin, 50=affiliate, 100=super admin)

---

## Adding New Features

When adding new features, follow this order:

1. **Database Schema** - Create migration in `migrations/`
2. **Database Queries** - Add to `src/app/db_query/read/` or `mutations/`
3. **API Endpoint** - Add controller in `src/app/http/api/controllers/`
4. **Route Definition** - Add to `src/routes/api.rs` or `web.rs`
5. **Frontend Component** - Add page in `src/frontend/pages/`
6. **Build Frontend** - Run `npm run build` in page directory
7. **Tests** - Add integration tests in `tests/`

See individual documentation files for detailed step-by-step guides.

---

For complete documentation on any specific feature, system, or component, refer to the files in the [Documentation/blazing_sun/](../Documentation/blazing_sun/) directory.
