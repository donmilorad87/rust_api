# Blazing Sun - Full-Stack Web Application

A production-ready Rust web application featuring authentication, user management, file uploads with image processing, theme configuration, galleries, and SEO management. Built with Actix-web, PostgreSQL, RabbitMQ, and Apache Kafka.

> **Infrastructure docs are in root folder.** See [../README.md](../README.md) for Docker, Nginx, Kafka, RabbitMQ, and infrastructure documentation.

---

## 🚀 Key Features

### ✅ Authentication & Authorization
- JWT-based authentication with HttpOnly cookies
- Bcrypt password hashing with salt
- Account activation via email verification
- Password reset with secure hash codes
- 4-step email change verification flow
- Permission-based access control (Basic, Admin, Super Admin)

### 👤 User Management
- Full CRUD operations for users
- Profile editing (first name, last name)
- Avatar upload with automatic image variants
- Password change with strength indicator
- Email change with dual verification
- Admin user management interface
- Permission level updates (Super Admin only)

### 📁 File Upload System
- Single and multiple file uploads
- Chunked upload support (resumable uploads)
- Image variant generation (thumb, small, medium, large, full)
- RabbitMQ-based async image processing
- Public/private storage separation
- Metadata management (title, description, alt attributes)
- Admin uploads management interface
- Lazy loading and responsive images
- CDN-ready architecture

### 🎨 Theme Configuration System
- Dynamic SCSS compilation from database
- Light/Dark theme support with CSS custom properties
- Color management with HSL color picker
- Typography configuration (fonts, sizes, weights, line-height)
- Spacing system (margins, padding, gaps)
- Branding (logo, favicon, site name)
- Real-time preview before build
- Versioned asset management
- Automatic theme backup on changes

### 🖼️ Gallery System
- Create and manage image galleries
- Add multiple pictures to galleries
- Drag-and-drop reordering
- Per-image metadata (title, description)
- Image lightbox with navigation
- Gallery visibility (public/private)

### 🔍 SEO & Structured Data
- Per-page SEO configuration (title, description, keywords)
- Open Graph tags for social sharing
- Canonical URLs and robots directives
- Schema.org structured data builder
- 30+ schema types (Organization, Article, Product, Person, Event, FAQ, etc.)
- JSON-LD format with validation

### 📧 Email System
- SMTP via Lettre
- Tera template engine for emails
- 7 email templates (activation, welcome, password reset, etc.)
- Async sending via RabbitMQ
- Email queue with retries and fault tolerance

### 📊 Event-Driven Architecture
- Apache Kafka event streaming
- 5 event domains (User, Auth, Transaction, Category, System)
- Event handlers for audit logging, notifications, analytics
- Dead-letter queue for failed events
- Idempotent event processing

### ⚙️ Task Queue (RabbitMQ)
- Background job processing
- Email sending jobs
- User creation jobs
- Image resizing jobs (5 variants per upload)
- Priority queues (1-5 levels)
- Fault tolerance with automatic retries
- Dead-letter queue for permanent failures

### ⏰ Cron Jobs
- Scheduled background tasks
- User counter job
- Email list generation
- Easy extensibility via tokio-cron-scheduler

---

## 🛠️ Tech Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Language** | Rust | 1.83+ | Systems programming language |
| **Framework** | Actix-web | 4.x | High-performance async web framework |
| **Database** | PostgreSQL | 17 | Primary data store |
| **Query Builder** | SQLx | 0.8+ | Compile-time checked SQL queries |
| **Queue (Tasks)** | RabbitMQ | 4.x | Background job processing |
| **Event Streaming** | Apache Kafka | 3.9+ | Event-driven architecture |
| **Cache** | Redis | 7.x | Session storage, caching |
| **Templates** | Tera | 1.x | Server-side rendering |
| **Email** | Lettre | 0.11+ | SMTP email sending |
| **Auth** | jsonwebtoken | 9.x | JWT tokens |
| **Password** | bcrypt | 0.15+ | Password hashing |
| **Validation** | validator | 0.18+ | Input validation |
| **Logging** | tracing | 0.1+ | Structured logging |
| **Cron** | tokio-cron-scheduler | 0.13+ | Scheduled tasks |
| **Async Runtime** | Tokio | 1.x | Async/await runtime |
| **Image Processing** | image | 0.25+ | Image resizing and optimization |
| **SCSS Compiler** | grass | 0.13+ | SCSS → CSS compilation |
| **Frontend Build** | Vite | 5.4+ | JavaScript/CSS bundler |
| **CSS Preprocessor** | Sass/SCSS | 1.77+ | CSS with variables |
| **Frontend JS** | Vanilla ES6 | - | No framework, plain JavaScript classes |

---

## 📂 Project Structure

```
blazing_sun/
├── Cargo.toml                          # Rust dependencies
├── .env                                # Environment variables
├── CLAUDE.md                           # AI assistant guidance
├── README.md                           # This file
│
├── migrations/                         # Database migrations (SQLx)
│   ├── 20251217202253_create_users_table.sql
│   ├── 20251224120000_create_uploads_table.sql
│   ├── 20260101220000_create_image_variants_table.sql
│   ├── 20260102030100_create_galleries_and_pictures.sql
│   ├── 20251230181208_create_site_config_table.sql
│   ├── 20251231011123_create_page_seo_table.sql
│   └── ...
│
├── storage/                            # File storage
│   └── app/
│       ├── public/                     # Public files (CDN/nginx at /storage/)
│       └── private/                    # Private files (auth required)
│           ├── profile-pictures/
│           └── theme_backups/
│
├── tests/                              # Integration and E2E tests
│   ├── routes/
│   │   ├── api/                        # API integration tests
│   │   └── web/                        # Playwright E2E tests
│   ├── scripts/                        # Test helper scripts
│   └── debug/                          # Debug utilities
│
└── src/
    ├── main.rs                         # Application entry point
    │
    ├── config/                         # Configuration (env vars)
    │   ├── app.rs                      # HOST, PORT, RUST_LOG, ASSETS_VERSION
    │   ├── database.rs                 # DATABASE_URL, pool settings
    │   ├── jwt.rs                      # JWT_SECRET, expiration
    │   ├── rabbitmq.rs                 # RabbitMQ connection
    │   ├── kafka.rs                    # Kafka bootstrap servers
    │   ├── redis.rs                    # Redis connection
    │   ├── mongodb.rs                  # MongoDB connection
    │   ├── email.rs                    # SMTP settings
    │   ├── upload.rs                   # Upload limits and storage
    │   ├── theme.rs                    # Theme build settings
    │   ├── activation.rs               # Token expiry times
    │   └── cron.rs                     # Cron schedules
    │
    ├── bootstrap/                      # Core framework layer
    │   ├── database/                   # PostgreSQL connection pool
    │   ├── events/                     # Kafka event system
    │   │   ├── types.rs                # DomainEvent, EventType, Metadata
    │   │   ├── topics.rs               # Topic constants
    │   │   ├── producer.rs             # Kafka producer
    │   │   ├── consumer.rs             # Kafka consumer
    │   │   └── handlers/               # Event handlers
    │   ├── includes/                   # Shared utilities
    │   │   ├── controllers/
    │   │   │   ├── email.rs            # Email sending controller
    │   │   │   └── uploads.rs          # Upload handling controller
    │   │   ├── storage/                # Storage driver abstraction
    │   │   │   ├── local.rs            # Local filesystem driver
    │   │   │   └── s3.rs               # S3 driver (future)
    │   │   ├── theme/                  # Theme build system
    │   │   │   ├── parser.rs           # Parse SCSS/CSS from DB
    │   │   │   ├── builder.rs          # Build SCSS files
    │   │   │   ├── versioner.rs        # Asset versioning
    │   │   │   └── updater.rs          # Update theme in DB/filesystem
    │   │   └── image/                  # Image processing
    │   │       └── processor.rs        # Resize, optimize, variants
    │   ├── middleware/                 # HTTP middleware
    │   │   └── controllers/
    │   │       ├── auth.rs             # JWT authentication
    │   │       ├── permission.rs       # Permission-based authorization
    │   │       ├── cors.rs             # CORS headers
    │   │       ├── security_headers.rs # Security headers
    │   │       └── tracing_logger.rs   # Request logging
    │   ├── mq/                         # RabbitMQ core
    │   │   └── controller/
    │   │       └── mq.rs               # MessageQueue, enqueue functions
    │   ├── routes/                     # Route registration
    │   │   └── controller/
    │   │       ├── api.rs              # API route registration
    │   │       └── crons.rs            # Cron job registration
    │   └── utility/                    # Utility functions
    │       ├── auth.rs                 # JWT, password hashing
    │       ├── template.rs             # Template helpers
    │       └── assets.rs               # Asset URL generation
    │
    ├── app/                            # Application layer
    │   ├── cron/                       # Cron job implementations
    │   │   ├── user_counter.rs
    │   │   └── list_user_emails.rs
    │   │
    │   ├── db_query/                   # Database queries
    │   │   ├── read/                   # SELECT queries
    │   │   │   ├── user/
    │   │   │   ├── upload/
    │   │   │   ├── gallery/
    │   │   │   ├── picture/
    │   │   │   ├── image_variant/
    │   │   │   ├── site_config/
    │   │   │   ├── page_seo/
    │   │   │   ├── page_schema/
    │   │   │   └── activation_hash/
    │   │   └── mutations/              # INSERT/UPDATE/DELETE
    │   │       ├── user/
    │   │       ├── upload/
    │   │       ├── gallery/
    │   │       ├── picture/
    │   │       ├── image_variant/
    │   │       ├── site_config/
    │   │       ├── page_seo/
    │   │       ├── page_schema/
    │   │       └── activation_hash/
    │   │
    │   ├── http/                       # HTTP layer
    │   │   ├── api/                    # API endpoints
    │   │   │   ├── controllers/
    │   │   │   │   ├── auth.rs         # Sign up, sign in
    │   │   │   │   ├── user.rs         # User CRUD
    │   │   │   │   ├── email.rs        # Email change
    │   │   │   │   ├── activation.rs   # Account activation
    │   │   │   │   ├── upload.rs       # File uploads
    │   │   │   │   ├── gallery.rs      # Gallery management
    │   │   │   │   ├── picture.rs      # Picture management
    │   │   │   │   ├── theme.rs        # Theme configuration
    │   │   │   │   └── admin.rs        # Admin operations
    │   │   │   └── validators/
    │   │   │       ├── auth.rs
    │   │   │       └── user.rs
    │   │   └── web/                    # Web pages (SSR)
    │   │       └── controllers/
    │   │           └── pages.rs        # All page handlers
    │   │
    │   └── mq/                         # Message queue jobs
    │       ├── jobs/                   # Job definitions
    │       │   ├── create_user/
    │       │   ├── email/
    │       │   └── resize_image/       # Image variant generation
    │       └── workers/                # Job processors
    │           ├── create_user/
    │           ├── email/
    │           └── resize_image/       # Worker implementation
    │
    ├── routes/                         # Route definitions
    │   ├── mod.rs                      # Named routes registry
    │   ├── api.rs                      # 65+ API endpoints
    │   ├── web.rs                      # 11 web page routes
    │   └── crons.rs                    # Cron job schedules
    │
    ├── frontend/                       # Frontend source code
    │   └── pages/                      # Page-specific builds
    │       ├── GLOBAL/                 # Loaded on all pages
    │       │   └── src/
    │       │       ├── js/
    │       │       │   ├── Navbar.js
    │       │       │   └── ThemeManager.js
    │       │       └── styles/
    │       ├── PROFILE/                # Profile page (27KB JS, 8.5KB CSS)
    │       │   └── src/
    │       │       ├── ProfilePage.js
    │       │       ├── AvatarUpload.js
    │       │       ├── PasswordChange.js
    │       │       ├── EmailChange.js
    │       │       └── main.js
    │       ├── UPLOADS/                # Admin uploads (33KB JS, 20KB CSS)
    │       │   └── src/
    │       │       ├── UploadsPage.js
    │       │       ├── AssetPreview.js
    │       │       ├── AssetInfoModal.js
    │       │       ├── ImageLightbox.js
    │       │       └── UploadModal.js
    │       ├── THEME/                  # Theme config (97KB JS, 30KB CSS)
    │       │   └── src/
    │       │       ├── ThemeConfig.js
    │       │       ├── ColorPicker.js
    │       │       ├── SizePicker.js
    │       │       ├── SchemaDefinitions.js
    │       │       └── main.js
    │       ├── GALLERIES/              # Galleries (31KB JS, 16KB CSS)
    │       ├── REGISTERED_USERS/       # User management (13KB JS, 6.4KB CSS)
    │       ├── SIGN_IN/                # Sign in page (3.2KB JS, 3.5KB CSS)
    │       ├── SIGN_UP/                # Sign up page (5.4KB JS, 7.2KB CSS)
    │       └── FORGOT_PASSWORD/        # Password reset (15KB JS, 14KB CSS)
    │
    └── resources/                      # Build output and static assets
        ├── css/                        # Compiled CSS
        │   ├── GLOBAL/style.css
        │   ├── PROFILE/style.css
        │   ├── UPLOADS/style.css
        │   └── ...
        ├── js/                         # Compiled JavaScript
        │   ├── GLOBAL/app.js
        │   ├── PROFILE/app.js
        │   ├── UPLOADS/app.js
        │   └── ...
        └── views/
            ├── emails/                 # Email templates (Tera)
            │   ├── base.html
            │   ├── welcome.html
            │   ├── account_activation.html
            │   ├── forgot_password.html
            │   ├── password_change.html
            │   ├── activation_success.html
            │   └── password_reset_success.html
            └── web/                    # Web page templates (Tera)
                ├── base.html
                ├── homepage.html
                ├── sign_in.html
                ├── sign_up.html
                ├── forgot_password.html
                ├── profile.html
                ├── galleries.html
                ├── uploads.html
                ├── admin_theme.html
                ├── registered_users.html
                ├── 404.html
                └── partials/
                    └── _navbar.html
```

---

## 🌐 Web Routes

### Public Pages (No Authentication)
- `GET /` - Homepage (different content for logged/guest users)
- `GET /sign-in` - Sign in page
- `GET /sign-up` - Registration page
- `GET /forgot-password` - Password reset request

### Authenticated Pages (Login Required)
- `GET /profile` - User profile management
- `GET /galleries` - User galleries
- `GET /logout` - Logout (clears JWT cookie)

### Admin Pages (Admin Permission = Level 10+)
- `GET /admin/uploads` - File upload management
- `GET /admin/theme` - Theme configuration

### Super Admin Pages (Super Admin = Level 100)
- `GET /superadmin/users` - User management

### Static Assets
- `GET /assets/js/*` - JavaScript files
- `GET /assets/css/*` - CSS files

---

## 📡 API Endpoints (65+)

### Authentication (Public)
- `POST /api/v1/auth/sign-up` - Register new user
- `POST /api/v1/auth/sign-in` - Login and get JWT token

### Account Activation & Password Reset (Public)
- `POST /api/v1/account/activate-account` - Activate account with code
- `POST /api/v1/account/forgot-password` - Request password reset
- `POST /api/v1/account/verify-hash` - Verify reset hash
- `POST /api/v1/account/reset-password` - Reset password with hash

### Password Change (JWT Required)
- `POST /api/v1/password/change-password` - Change password (requires current password)
- `POST /api/v1/password/verify-password-change` - Verify and change password

### Email Change (JWT Required - 4-Step Flow)
- `POST /api/v1/email/request-change` - Step 1: Request email change
- `POST /api/v1/email/verify-old-email` - Step 2: Verify old email code
- `POST /api/v1/email/verify-new-email` - Step 3: Verify new email code

### User Management (JWT Required)
- `GET /api/v1/user` - Get current user profile
- `GET /api/v1/user/{id}` - Get user by ID
- `PATCH /api/v1/user` - Update profile (partial)
- `PUT /api/v1/user` - Update profile (full)
- `PATCH /api/v1/user/avatar` - Update avatar
- `DELETE /api/v1/user/{id}` - Delete user

### File Uploads
**Public:**
- `GET /api/v1/upload/download/public/{uuid}` - Download public file

**JWT Required:**
- `POST /api/v1/upload/public` - Upload public file
- `POST /api/v1/upload/private` - Upload private file
- `POST /api/v1/upload/multiple` - Upload multiple files
- `POST /api/v1/upload/avatar` - Upload avatar (auto-links to user)
- `GET /api/v1/upload/private/{uuid}` - Download private file
- `DELETE /api/v1/upload/{uuid}` - Delete upload
- `GET /api/v1/upload/user` - Get user's uploads

**Chunked Upload (JWT Required):**
- `POST /api/v1/upload/chunked/start` - Start chunked upload
- `POST /api/v1/upload/chunked/{uuid}/chunk/{index}` - Upload chunk
- `POST /api/v1/upload/chunked/{uuid}/complete` - Complete upload
- `DELETE /api/v1/upload/chunked/{uuid}` - Cancel upload

### Galleries (JWT Required)
- `GET /api/v1/galleries` - List user galleries
- `POST /api/v1/galleries` - Create gallery
- `GET /api/v1/galleries/{id}` - Get gallery details
- `PUT /api/v1/galleries/{id}` - Update gallery
- `DELETE /api/v1/galleries/{id}` - Delete gallery
- `POST /api/v1/galleries/reorder` - Reorder galleries

**Pictures:**
- `GET /api/v1/galleries/{id}/pictures` - Get gallery pictures
- `POST /api/v1/galleries/{id}/pictures` - Add picture to gallery
- `PUT /api/v1/galleries/{gallery_id}/pictures/{picture_id}` - Update picture metadata
- `DELETE /api/v1/galleries/{gallery_id}/pictures/{picture_id}` - Remove picture
- `POST /api/v1/galleries/{id}/pictures/reorder` - Reorder pictures

### Theme Configuration (JWT + Admin Permission)
- `GET /api/v1/admin/theme` - Get theme config
- `PUT /api/v1/admin/theme` - Update theme config
- `PUT /api/v1/admin/theme/branding` - Update branding (logo, favicon)
- `POST /api/v1/admin/theme/build` - Trigger SCSS build
- `GET /api/v1/admin/theme/build/status` - Check build status

### SEO Management (JWT + Admin Permission)
- `GET /api/v1/admin/seo` - List all page SEO configs
- `GET /api/v1/admin/seo/{route_name}` - Get SEO for specific page
- `PUT /api/v1/admin/seo/{route_name}` - Update SEO
- `PATCH /api/v1/admin/seo/{route_name}/toggle` - Toggle active status

### Schema.org Management (JWT + Admin Permission)
- `GET /api/v1/admin/seo/page/{id}/schemas` - List page schemas
- `POST /api/v1/admin/seo/page/{id}/schemas` - Create schema
- `GET /api/v1/admin/seo/schema/{id}` - Get schema by ID
- `PUT /api/v1/admin/seo/schema/{id}` - Update schema
- `DELETE /api/v1/admin/seo/schema/{id}` - Delete schema

### Admin Operations
**Admin (JWT + Admin Permission):**
- `GET /api/v1/admin/uploads` - List all uploads
- `PATCH /api/v1/admin/uploads/{uuid}/metadata` - Update upload metadata
- `DELETE /api/v1/admin/users/{id}/avatar` - Delete user avatar

**Super Admin (JWT + Super Admin Permission):**
- `GET /api/v1/admin/users` - List all users
- `PATCH /api/v1/admin/users/{id}/permissions` - Update user permissions

---

## 🗄️ Database Schema

### Core Tables

**users** - User accounts
- `id` (BIGSERIAL) - Primary key
- `email` (VARCHAR, UNIQUE) - Email address
- `password` (VARCHAR) - Bcrypt hashed password
- `first_name`, `last_name` (VARCHAR) - User name
- `activated` (SMALLINT) - 0=inactive, 1=active
- `permissions` (SMALLINT) - 1=basic, 10=admin, 50=affiliate, 100=super_admin
- `avatar_uuid` (UUID) - FK to uploads
- `avatar_id` (BIGINT) - FK to uploads (ID-based reference)
- `created_at`, `updated_at` (TIMESTAMP)

**uploads** - File upload records
- `id` (BIGSERIAL) - Primary key
- `uuid` (UUID, UNIQUE) - Public identifier
- `user_id` (BIGINT) - FK to users
- `original_name`, `stored_name` (VARCHAR) - Filenames
- `extension`, `mime_type` (VARCHAR) - File info
- `size_bytes` (BIGINT) - File size
- `storage_type` (VARCHAR) - 'public' or 'private'
- `storage_path` (TEXT) - Full path
- `upload_status` (VARCHAR) - 'pending', 'completed', 'failed'
- `title` (VARCHAR 255) - For title attribute
- `description` (TEXT) - For alt attribute
- `metadata` (JSONB) - Additional metadata
- `created_at`, `updated_at` (TIMESTAMP)

**image_variants** - Generated image sizes
- `id` (BIGSERIAL) - Primary key
- `upload_id` (BIGINT) - FK to uploads (CASCADE DELETE)
- `variant_name` (VARCHAR) - 'thumb', 'small', 'medium', 'large', 'full'
- `width`, `height` (INT) - Dimensions
- `file_path` (TEXT) - Storage path
- `file_size` (BIGINT) - Size in bytes
- `created_at` (TIMESTAMP)

**galleries** - Image gallery collections
- `id` (BIGSERIAL) - Primary key
- `user_id` (BIGINT) - FK to users
- `name` (VARCHAR) - Gallery name
- `description` (TEXT) - Gallery description
- `visibility` (VARCHAR) - 'public' or 'private'
- `cover_image_id` (BIGINT) - FK to uploads
- `display_order` (INT) - Sort order
- `created_at`, `updated_at` (TIMESTAMP)

**pictures** - Gallery-Upload join table
- `id` (BIGSERIAL) - Primary key
- `gallery_id` (BIGINT) - FK to galleries (CASCADE DELETE)
- `upload_id` (BIGINT) - FK to uploads (CASCADE DELETE)
- `title` (VARCHAR) - Picture title
- `description` (TEXT) - Picture description
- `display_order` (INT) - Sort order within gallery
- `created_at` (TIMESTAMP)

**site_config** - Theme and site configuration
- `id` (BIGSERIAL) - Primary key
- `logo_uuid` (UUID) - FK to uploads
- `favicon_uuid` (UUID) - FK to uploads
- `site_name` (VARCHAR 50) - Site display name
- `show_site_name` (BOOLEAN) - Show name alongside logo
- `scss_variables` (JSONB) - SCSS variable definitions
- `theme_light` (JSONB) - Light theme CSS custom properties
- `theme_dark` (JSONB) - Dark theme CSS custom properties
- `last_build_at` (TIMESTAMP) - Last successful build
- `build_status` (VARCHAR) - 'idle', 'building', 'success', 'failed'
- `created_at`, `updated_at` (TIMESTAMP)

**page_seo** - Per-page SEO configuration
- `id` (BIGSERIAL) - Primary key
- `route_name` (VARCHAR 100, UNIQUE) - Named route
- `title` (VARCHAR 100) - Page title
- `description` (TEXT) - Meta description
- `keywords` (TEXT) - SEO keywords
- `og_image_uuid` (UUID) - Open Graph image
- `canonical_url` (TEXT) - Canonical URL
- `robots` (VARCHAR 50) - Robot directives
- `is_active` (BOOLEAN) - Enable/disable
- `created_at`, `updated_at` (TIMESTAMP)

**page_schemas** - Schema.org structured data
- `id` (BIGSERIAL) - Primary key
- `page_seo_id` (BIGINT) - FK to page_seo (CASCADE DELETE)
- `schema_type` (VARCHAR 100) - 'Organization', 'Article', 'Product', etc.
- `schema_data` (JSONB) - Complete schema JSON
- `is_active` (BOOLEAN) - Enable/disable
- `display_order` (INT) - Order on page
- `created_at`, `updated_at` (TIMESTAMP)

**activation_hashes** - Email verification tokens
- `id` (BIGSERIAL) - Primary key
- `user_id` (BIGINT) - FK to users
- `hash_value` (VARCHAR, UNIQUE) - Verification code
- `hash_type` (VARCHAR) - 'account_activation', 'password_reset', 'email_change'
- `metadata` (JSONB) - Additional data (e.g., new_email)
- `expires_at` (TIMESTAMP) - Expiration time
- `created_at` (TIMESTAMP)

---

## 🔐 Permission System

| Level | Constant | Value | Access |
|-------|----------|-------|--------|
| **Basic** | `BASIC` | 1 | All authenticated users |
| **Admin** | `ADMIN` | 10 | Theme, uploads, SEO management |
| **Affiliate** | `AFFILIATE` | 50 | Same as admin (future features) |
| **Super Admin** | `SUPER_ADMIN` | 100 | User management, permission updates |

---

## 🖼️ Image Variant System

### Automatic Processing

When an image is uploaded:
1. File saved to storage (public/private)
2. Database record created in `uploads` table
3. RabbitMQ job enqueued: `resize_image`
4. Worker generates 5 variants:

| Variant | Width (px) | Use Case |
|---------|-----------|----------|
| `thumb` | 160 | List thumbnails |
| `small` | 320 | Mobile devices, cards |
| `medium` | 640 | Tablet views, previews |
| `large` | 1024 | Desktop views, modals |
| `full` | 1920 | Full-screen display, downloads |

5. Records created in `image_variants` table
6. Files named: `{timestamp}_{uuid}_{variant}.{ext}`

### Priority Queues

| Upload Type | Priority | Reason |
|-------------|----------|--------|
| Avatar | 1 (High) | Immediate user feedback |
| Public/Private | 5 (Standard) | Background processing |

---

## 🎨 Theme System

### SCSS Build Process

1. Admin updates theme config via UI
2. Backend saves to `site_config` table (JSONB)
3. Admin clicks "Build Theme"
4. Backend:
   - Parses SCSS variables from database
   - Generates `_variables.scss` file
   - Parses CSS custom properties
   - Generates `theme.css` file
   - Compiles SCSS → CSS using grass compiler
   - Creates versioned backup
   - Updates `ASSETS_VERSION` in `.env`
5. Frontend reloads with new assets

### Theme Versioning

- **Format**: Millisecond timestamp (e.g., `1704133807456`)
- **Location**: `.env` file: `ASSETS_VERSION=1704133807456`
- **Usage**: `{{ assets('/css/GLOBAL/style.css', version=env.ASSETS_VERSION) }}`
- **Purpose**: Cache busting on theme updates

---

## 📧 Email Templates

| Template | File | Use Case |
|----------|------|----------|
| **Account Activation** | `account_activation.html` | User registration verification |
| **Activation Success** | `activation_success.html` | Account activated confirmation |
| **Welcome** | `welcome.html` | Welcome after activation |
| **Forgot Password** | `forgot_password.html` | Password reset request |
| **Password Reset Success** | `password_reset_success.html` | Password reset confirmation |
| **Password Change** | `password_change.html` | Password changed notification |
| **User Must Set Password** | `user_must_set_password.html` | Admin-created account setup |

---

## 🚀 Development Commands

```bash
# Inside Rust container: docker compose exec rust bash

# Build
cargo build
cargo check                    # Fast type check
cargo build --release          # Production build

# Run
cargo run

# Test
cargo test                     # All tests
cargo test --test integration  # Integration tests only
cargo test -- --nocapture      # Show println! output

# Lint
cargo clippy                   # Linting
cargo fmt                      # Format code
cargo fmt -- --check           # Check formatting

# Database Migrations
sqlx migrate run               # Apply migrations
sqlx migrate add <name>        # Create new migration
sqlx migrate revert            # Revert last migration

# SQLx Offline Mode (REQUIRED after query changes)
cargo sqlx prepare             # Generate query metadata
cargo sqlx prepare --check     # Verify queries

# Frontend Build
cd src/frontend/pages/GLOBAL && npm run build
cd ../PROFILE && npm run build
cd ../UPLOADS && npm run build
# Or use helper script:
./src/frontend/build-frontend.sh all        # Build all pages
./src/frontend/build-frontend.sh PROFILE    # Build specific page
```

---

## 🧪 Testing

### Integration Tests (Rust)
```bash
# Run all API tests
cargo test --test integration

# Run specific test module
cargo test --test integration -- routes::api::SIGN_IN

# Run with output
cargo test -- --nocapture
```

### E2E Tests (Playwright)
```bash
cd tests
npm test                       # Run all E2E tests
npm test -- profile.spec.ts    # Run specific test
```

### Manual Testing Scripts
```bash
# Test avatar upload
./tests/scripts/test_avatar_endpoint.sh

# Test authentication
./tests/scripts/test_cookie_signin.sh

# Debug galleries
node tests/debug/debug_galleries.js
```

---

## 📦 Adding New Features

### New API Endpoint
1. Create handler in `app/http/api/controllers/<name>.rs`
2. Add validator in `app/http/api/validators/<name>.rs`
3. Register route in `routes/api.rs`
4. Add database queries in `app/db_query/read/` or `mutations/`
5. Publish Kafka event on success (optional)
6. Run `cargo sqlx prepare` if queries changed

### New Web Page
1. Create controller method in `app/http/web/controllers/pages.rs`
2. Register route in `routes/web.rs`
3. Create template in `resources/views/web/<page>.html`
4. Create frontend module in `frontend/pages/<PAGE>/`
5. Build frontend: `./src/frontend/build-frontend.sh <PAGE>`

### New Database Table
1. Create migration: `sqlx migrate add <name>`
2. Write SQL in `migrations/<timestamp>_<name>.sql`
3. Apply migration: `sqlx migrate run`
4. Add read queries in `app/db_query/read/<entity>/mod.rs`
5. Add mutations in `app/db_query/mutations/<entity>/mod.rs`
6. Run `cargo sqlx prepare`

### New RabbitMQ Job
1. Create job params in `app/mq/jobs/<job_name>/mod.rs`
2. Create worker in `app/mq/workers/<job_name>/mod.rs`
3. Add to worker router in `app/mq/workers/mod.rs`
4. Enqueue job using `mq::enqueue_job_dyn()`

### New Kafka Event
1. Add event variant to `bootstrap/events/types.rs::EventType`
2. Add payload struct to `bootstrap/events/types.rs`
3. Add helper function in `bootstrap/events/mod.rs::publish`
4. Create handler in `bootstrap/events/handlers/` (optional)

### New Cron Job
1. Create job in `app/cron/<job_name>.rs`
2. Register in `routes/crons.rs`
3. Configure schedule in `.env`: `CRON_<JOB>_SCHEDULE=...`

---

## 🔧 Environment Variables

```env
# Application
HOST=0.0.0.0
PORT=9999
RUST_LOG=debug
ASSETS_VERSION=1704133807456        # Auto-updated on theme build
IMAGES_ASSETS_VERSION=1704133807456 # Image asset version

# Database
DATABASE_URL=postgres://user:pass@host:5432/db
DATABASE_MAX_CONNECTIONS=10
SQLX_OFFLINE=true                   # Enable offline mode

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRATION=60                   # Minutes

# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=admin
RABBITMQ_QUEUE=blazing_sun_jobs

# Kafka
KAFKA_BOOTSTRAP_SERVERS=kafka:9092
KAFKA_CLIENT_ID=blazing_sun
KAFKA_GROUP_ID=blazing_sun_group

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# MongoDB
MONGODB_URI=mongodb://admin:admin@mongodb:27017
MONGODB_DATABASE=blazing_sun

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_ADDRESS=noreply@example.com
SMTP_FROM_NAME=Blazing Sun

# Upload Configuration
UPLOAD_MAX_FILE_SIZE=104857600      # 100MB
UPLOAD_MAX_FILES=10
UPLOAD_ALLOWED_TYPES=jpg,jpeg,png,gif,webp,pdf
UPLOAD_STORAGE_PATH=storage/app

# Storage Driver
STORAGE_DRIVER=local                # "local" or "s3"
STORAGE_PUBLIC_URL=/storage
STORAGE_PRIVATE_URL=/api/v1/upload/private

# Theme Configuration
THEME_SCSS_PATH=src/resources/scss
THEME_CSS_OUTPUT_PATH=src/resources/css

# Activation & Password Reset
ACTIVATION_EXPIRATION_HOURS=24
PASSWORD_RESET_EXPIRATION_HOURS=1
EMAIL_CHANGE_EXPIRATION_HOURS=1

# Cron Jobs
CRON_ENABLED=true
CRON_USER_COUNTER_SCHEDULE=0 */5 * * * *  # Every 5 minutes
CRON_LIST_EMAILS_SCHEDULE=0 */10 * * * *  # Every 10 minutes
```

---

## 📚 Documentation

### Full Documentation
- **Web Routes**: `Documentation/blazing_sun/Routes/Web/`
- **API Endpoints**: `Documentation/blazing_sun/Routes/API/`
- **Frontend Components**: `Documentation/blazing_sun/Frontend/`
- **Backend Modules**: `Documentation/blazing_sun/Backend/`
- **Feature Guides**: `Documentation/blazing_sun/`

### Quick References
- [CLAUDE.md](CLAUDE.md) - AI assistant guidance
- [Web Routes Quick Reference](../Documentation/blazing_sun/Routes/Web/quick-reference.md)
- [API Routes Overview](../Documentation/blazing_sun/Routes/API/README.md)

---

## 🐛 Common Issues

### SQLx Compile Errors
**Problem**: `query data <hash> doesn't exist`
**Solution**: Run `cargo sqlx prepare` after changing queries

### Frontend Build Fails
**Problem**: Sandbox permission errors
**Solution**: Build inside Docker container: `./src/frontend/build-frontend.sh <PAGE>`

### RabbitMQ Worker Not Processing
**Problem**: Jobs enqueued but not processed
**Solution**: Ensure worker is running in `main.rs`, check `docker compose logs -f rust`

### Theme Build Fails
**Problem**: SCSS compilation error
**Solution**: Check SCSS syntax in database, review error in logs

---

## 📄 License

[Specify your license here]

---

## 👥 Contributors

[List contributors here]

---

**Last Updated**: 2026-01-02
**Rust Version**: 1.83+
**Actix-web Version**: 4.x
**PostgreSQL Version**: 17
