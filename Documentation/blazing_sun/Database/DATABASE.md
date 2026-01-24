# Database Documentation

This document provides comprehensive documentation for the database layer in the Blazing Sun application, including SQLx migrations, the read/mutations pattern, and compile-time checked queries.

---

## Overview

Blazing Sun uses **PostgreSQL** as the primary database with **SQLx** for:
- **Compile-time checked queries** - SQL errors are caught at build time
- **Type-safe mappings** - Rust types automatically derived from schema
- **Migration management** - Version-controlled schema changes
- **Offline mode** - Build without database connection using cached query data

---

## SQLx Migration System

### What Are Migrations?

Migrations are SQL files that define incremental changes to the database schema. They are:
- **Version controlled** - Each migration has a timestamp prefix
- **Ordered** - Applied in chronological order
- **Reversible** - Can be reverted (though not commonly used)
- **Idempotent** - Safe to run multiple times

### Migration File Structure

```
blazing_sun/migrations/
├── 20251217202253_create_users_table.sql
├── 20251217203606_create_categories_table.sql
├── 20251217204134_create_transactions_table.sql
├── 20251222231150_add_user_fields_and_activation_hashes.sql
├── 20251224120000_create_uploads_table.sql
├── 20251228220214_add_avatar_uuid_to_users.sql
├── 20251228225212_add_permissions_to_users.sql
├── 20251228225245_create_assets_table.sql
├── 20251228225316_update_avatar_to_assets.sql
└── 20251229010959_update_avatar_fk_to_uploads.sql
```

**Naming Convention:** `{YYYYMMDDHHMMSS}_{description}.sql`

### Creating a New Migration

```bash
# Inside the rust container
docker compose exec rust bash

# Create a new migration
sqlx migrate add create_new_table

# This creates: migrations/20251229123456_create_new_table.sql
```

### Migration Commands

```bash
# Run all pending migrations
sqlx migrate run

# Revert the last migration
sqlx migrate revert

# Check migration status
sqlx migrate info
```

### Example Migration: Create Users Table

**File:** `migrations/20251217202253_create_users_table.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Example Migration: Create Uploads Table

**File:** `migrations/20251224120000_create_uploads_table.sql`

```sql
-- Uploads table for file storage management
CREATE TABLE IF NOT EXISTS uploads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- File identity
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,

    -- File metadata
    extension VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),

    -- Storage info
    storage_type VARCHAR(20) NOT NULL CHECK (storage_type IN ('public', 'private')),
    storage_path VARCHAR(500) NOT NULL,

    -- Upload tracking (for resumable uploads)
    upload_status VARCHAR(20) NOT NULL DEFAULT 'completed'
        CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed')),
    chunks_received INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 1,

    -- Ownership
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

    -- Optional metadata
    description TEXT,
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_uploads_uuid ON uploads(uuid);
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_storage_type ON uploads(storage_type);
CREATE INDEX idx_uploads_upload_status ON uploads(upload_status);
CREATE INDEX idx_uploads_created_at ON uploads(created_at DESC);
```

### Migration Best Practices

1. **Always use IF NOT EXISTS** - Makes migrations idempotent
2. **Add CHECK constraints** - Enforce data integrity at database level
3. **Create indexes** - For frequently queried columns
4. **Use proper types** - `BIGINT` for IDs, `TIMESTAMPTZ` for timestamps
5. **Set defaults** - Reduce required fields in application code
6. **Add foreign keys** - Enforce referential integrity

---

## SQLx Query Cache (.sqlx Directory)

### What Is The Query Cache?

SQLx performs compile-time verification of SQL queries against the database schema. The `.sqlx/` directory contains cached query metadata that allows building without a database connection.

```
blazing_sun/.sqlx/
├── query-026b786fa16ad5865f00358492d3234e90308fb731537a2bf6a39b6da9dddc49.json
├── query-18c109576a93def0989003569c7b7d6d81a596284347aad550aa9287d6edd609.json
├── query-20e6bd15c1ffbdd6f2ed56a5ffea31376400c564c1e2dc8c0b5e5be9292573f2.json
└── ... (one file per unique query)
```

### Generating the Query Cache

```bash
# Generate/update the query cache
cargo sqlx prepare

# This analyzes all sqlx::query! macros and caches the metadata
```

### When to Regenerate

Regenerate the cache after:
- Adding new `sqlx::query!` or `sqlx::query_as!` calls
- Modifying existing queries
- Running new migrations
- Changing database schema

### Offline Mode

Enable offline mode for builds without database:

```bash
# Set environment variable
export SQLX_OFFLINE=true

# Build will use cached metadata
cargo build
```

### Important: Commit the .sqlx Directory

The `.sqlx/` directory **MUST be committed to Git**. This allows:
- CI/CD builds without database access
- Other developers to build without running migrations
- Docker builds in offline mode

---

## Read/Mutations Pattern

Blazing Sun uses a clean separation between read operations (SELECT) and mutations (INSERT/UPDATE/DELETE).

### Directory Structure

```
blazing_sun/src/app/db_query/
├── mod.rs              # Re-exports read and mutations
├── read/               # SELECT queries (read-only)
│   ├── mod.rs
│   ├── user/
│   │   └── mod.rs      # User read operations
│   ├── upload/
│   │   └── mod.rs      # Upload read operations
│   └── asset/
│       └── mod.rs      # Asset read operations
└── mutations/          # INSERT/UPDATE/DELETE queries
    ├── mod.rs
    ├── user/
    │   └── mod.rs      # User mutations
    ├── upload/
    │   └── mod.rs      # Upload mutations
    ├── asset/
    │   └── mod.rs      # Asset mutations
    └── activation_hash/
        └── mod.rs      # Activation hash mutations
```

### Why This Pattern?

1. **Clear separation** - Read vs write operations are distinct
2. **Easier testing** - Mock reads/writes independently
3. **Better organization** - Related queries grouped by entity
4. **Command Query Separation** - Follows CQS principle

---

## Read Operations

Read operations are SELECT queries that don't modify data.

### File: `app/db_query/read/user/mod.rs`

```rust
use crate::app::http::api::validators::auth::SigninRequest;
use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

/// User struct matching database schema
pub struct User {
    pub id: i64,
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
    pub balance: i64,
    pub activated: i16,
    pub verified: i16,
    pub two_factor: i16,
    pub user_must_set_password: i16,
    pub permissions: i16,
    pub avatar_uuid: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Read Query Examples

#### Check if User Exists

```rust
pub async fn has_with_email(db: &Pool<Postgres>, email: &str) -> bool {
    sqlx::query!("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email)
        .fetch_one(db)
        .await
        .unwrap()
        .exists
        .unwrap_or(false)
}
```

#### Get User by ID

```rust
pub async fn get_by_id(db: &Pool<Postgres>, id: i64) -> Result<User, sqlx::Error> {
    sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
        .fetch_one(db)
        .await
}
```

#### Get User by Email

```rust
pub async fn get_by_email(db: &Pool<Postgres>, email: &str) -> Result<User, sqlx::Error> {
    sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", email)
        .fetch_one(db)
        .await
}
```

#### Count Users

```rust
pub async fn count(db: &Pool<Postgres>) -> i64 {
    sqlx::query_scalar!("SELECT COUNT(*) FROM users")
        .fetch_one(db)
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0)
}
```

#### Get All Users with Pagination

```rust
pub async fn get_all(db: &Pool<Postgres>, limit: i64, offset: i64) -> Vec<User> {
    sqlx::query_as!(
        User,
        "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        limit,
        offset
    )
    .fetch_all(db)
    .await
    .unwrap_or_default()
}
```

#### Get All User Emails

```rust
pub async fn get_all_emails(db: &Pool<Postgres>) -> Vec<String> {
    sqlx::query!("SELECT email FROM users ORDER BY created_at DESC")
        .fetch_all(db)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|row| row.email)
        .collect()
}
```

---

## Mutation Operations

Mutations are queries that modify data: INSERT, UPDATE, DELETE.

### File: `app/db_query/mutations/user/mod.rs`

### Create User

```rust
pub struct CreateUserParams {
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
}

pub async fn create(db: &Pool<Postgres>, params: &CreateUserParams) -> bool {
    // Password is hashed before storage
    let hashed_password = bcrypt::hash(&params.password, bcrypt::DEFAULT_COST).unwrap();

    sqlx::query!(
        "INSERT INTO users (email, password, first_name, last_name) VALUES ($1, $2, $3, $4)",
        &params.email,
        &hashed_password,
        &params.first_name,
        &params.last_name
    )
    .execute(db)
    .await
    .is_ok()
}
```

### Create User (Admin - with additional flags)

```rust
pub struct CreateUserAdminParams {
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
    pub user_must_set_password: i16,
    pub activated: i16,
}

pub async fn create_admin(db: &Pool<Postgres>, params: &CreateUserAdminParams) -> Result<i64, sqlx::Error> {
    let hashed_password = bcrypt::hash(&params.password, bcrypt::DEFAULT_COST).unwrap();

    let result = sqlx::query!(
        r#"INSERT INTO users (email, password, first_name, last_name, user_must_set_password, activated)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id"#,
        &params.email,
        &hashed_password,
        &params.first_name,
        &params.last_name,
        params.user_must_set_password,
        params.activated
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}
```

### Partial Update (PATCH)

For updates where only some fields are provided:

```rust
pub struct UpdateUserPartialParams {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub balance: Option<i64>,
    pub password: Option<String>,
}

pub async fn update_partial(
    db: &Pool<Postgres>,
    user_id: i64,
    params: &UpdateUserPartialParams
) -> Result<(), sqlx::Error> {
    // Update each field individually if present
    // SQLx requires compile-time checked queries, so we can't build dynamic SQL

    if let Some(ref first_name) = params.first_name {
        sqlx::query!(
            "UPDATE users SET first_name = $1, updated_at = NOW() WHERE id = $2",
            first_name,
            user_id
        )
        .execute(db)
        .await?;
    }

    if let Some(ref last_name) = params.last_name {
        sqlx::query!(
            "UPDATE users SET last_name = $1, updated_at = NOW() WHERE id = $2",
            last_name,
            user_id
        )
        .execute(db)
        .await?;
    }

    if let Some(balance) = params.balance {
        sqlx::query!(
            "UPDATE users SET balance = $1, updated_at = NOW() WHERE id = $2",
            balance,
            user_id
        )
        .execute(db)
        .await?;
    }

    if let Some(ref password) = params.password {
        let hashed_password = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
        sqlx::query!(
            "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
            &hashed_password,
            user_id
        )
        .execute(db)
        .await?;
    }

    Ok(())
}
```

### Full Update (PUT)

For updates where all fields must be provided:

```rust
pub struct UpdateUserFullParams {
    pub first_name: String,
    pub last_name: String,
    pub balance: Option<i64>,
    pub password: Option<String>,
}

pub async fn update_full(
    db: &Pool<Postgres>,
    user_id: i64,
    params: &UpdateUserFullParams
) -> Result<(), sqlx::Error> {
    // Update first_name and last_name (required)
    sqlx::query!(
        "UPDATE users SET first_name = $1, last_name = $2, updated_at = NOW() WHERE id = $3",
        &params.first_name,
        &params.last_name,
        user_id
    )
    .execute(db)
    .await?;

    // Update balance if provided
    if let Some(balance) = params.balance {
        sqlx::query!(
            "UPDATE users SET balance = $1, updated_at = NOW() WHERE id = $2",
            balance,
            user_id
        )
        .execute(db)
        .await?;
    }

    // Update password if provided (hash it first)
    if let Some(ref password) = params.password {
        let hashed_password = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
        sqlx::query!(
            "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
            &hashed_password,
            user_id
        )
        .execute(db)
        .await?;
    }

    Ok(())
}
```

### Delete User

```rust
pub async fn delete(db: &Pool<Postgres>, user_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
        .execute(db)
        .await?;

    Ok(result.rows_affected() > 0)
}
```

### Update Specific Fields

```rust
/// Update user's avatar
pub async fn update_avatar(
    db: &Pool<Postgres>,
    user_id: i64,
    avatar_uuid: Option<Uuid>
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE users SET avatar_uuid = $1, updated_at = NOW() WHERE id = $2",
        avatar_uuid,
        user_id
    )
    .execute(db)
    .await?;
    Ok(())
}

/// Update user's permissions (admin only)
pub async fn update_permissions(
    db: &Pool<Postgres>,
    user_id: i64,
    permissions: i16
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE users SET permissions = $1, updated_at = NOW() WHERE id = $2",
        permissions,
        user_id
    )
    .execute(db)
    .await?;
    Ok(())
}

/// Update password (for password reset)
pub async fn update_password(
    db: &Pool<Postgres>,
    user_id: i64,
    password: &str
) -> Result<(), sqlx::Error> {
    let hashed_password = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
    sqlx::query!(
        "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
        &hashed_password,
        user_id
    )
    .execute(db)
    .await?;
    Ok(())
}
```

---

## SQLx Query Macros

### `sqlx::query!`

For queries that don't return structured data or return simple types:

```rust
// INSERT (no return)
sqlx::query!(
    "INSERT INTO users (email, password) VALUES ($1, $2)",
    email,
    password
)
.execute(db)
.await?;

// SELECT EXISTS (returns anonymous struct)
let result = sqlx::query!("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", id)
    .fetch_one(db)
    .await?;
let exists = result.exists.unwrap_or(false);
```

### `sqlx::query_as!`

For queries that return rows mapped to a struct:

```rust
pub struct User {
    pub id: i64,
    pub email: String,
    // ... all fields must match
}

let user = sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
    .fetch_one(db)
    .await?;
```

### `sqlx::query_scalar!`

For queries that return a single value:

```rust
let count = sqlx::query_scalar!("SELECT COUNT(*) FROM users")
    .fetch_one(db)
    .await?
    .unwrap_or(0);
```

### Fetch Methods

| Method | Returns | Use Case |
|--------|---------|----------|
| `.fetch_one(db)` | Single row | When exactly one row expected |
| `.fetch_optional(db)` | `Option<Row>` | When row may not exist |
| `.fetch_all(db)` | `Vec<Row>` | For multiple rows |
| `.execute(db)` | `PgQueryResult` | For INSERT/UPDATE/DELETE |

---

## Usage in Controllers

### Example: Controller Using Read/Mutations

```rust
use crate::database::read::user as db_user_read;
use crate::database::mutations::user as db_user_mutations;
use crate::database::AppState;

pub async fn get_user(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let user_id = path.into_inner();
    let db = state.db.lock().await;

    // Use read operation
    match db_user_read::get_by_id(&db, user_id).await {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(_) => HttpResponse::NotFound().json(BaseResponse::error("User not found")),
    }
}

pub async fn update_user(
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<UpdateUserRequest>,
) -> HttpResponse {
    let user_id = path.into_inner();
    let db = state.db.lock().await;

    // Use mutation operation
    let params = db_user_mutations::UpdateUserPartialParams {
        first_name: body.first_name.clone(),
        last_name: body.last_name.clone(),
        balance: None,
        password: None,
    };

    match db_user_mutations::update_partial(&db, user_id, &params).await {
        Ok(_) => HttpResponse::Ok().json(BaseResponse::success("User updated")),
        Err(e) => HttpResponse::InternalServerError().json(BaseResponse::error("Update failed")),
    }
}
```

---

## Database Connection

### AppState

```rust
// bootstrap/database/database.rs

pub struct AppState {
    pub db: Mutex<Pool<Postgres>>,      // Database connection pool
    pub jwt_secret: &'static str,
    pub mq: Option<DynMq>,              // RabbitMQ
    pub events: Option<SharedEventBus>, // Kafka
}

/// Create database connection pool
pub async fn create_pool() -> Pool<Postgres> {
    let database_url = DatabaseConfig::url();

    PgPoolOptions::new()
        .max_connections(DatabaseConfig::max_connections())
        .connect(&database_url)
        .await
        .expect("Failed to create pool")
}
```

### Configuration

```rust
// config/database.rs

pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
}

pub static DATABASE: Lazy<DatabaseConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();
    DatabaseConfig {
        url: std::env::var("DATABASE_URL").expect("DATABASE_URL must be set"),
        max_connections: std::env::var("DATABASE_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "10".to_string())
            .parse()
            .unwrap(),
    }
});
```

---

## Current Database Schema

### Users Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| email | VARCHAR(100) | UNIQUE NOT NULL | User email |
| password | VARCHAR(255) | NOT NULL | Bcrypt hash |
| first_name | VARCHAR(50) | NOT NULL | First name |
| last_name | VARCHAR(50) | NOT NULL | Last name |
| balance | BIGINT | DEFAULT 0, CHECK >= 0 | Balance in cents |
| activated | SMALLINT | DEFAULT 0 | Account activated |
| verified | SMALLINT | DEFAULT 0 | Email verified |
| two_factor | SMALLINT | DEFAULT 0 | 2FA enabled |
| user_must_set_password | SMALLINT | DEFAULT 0 | Password reset required |
| permissions | SMALLINT | DEFAULT 1 | Permission level |
| avatar_uuid | UUID | FK to uploads | Profile picture |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### Uploads Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| uuid | UUID | UNIQUE, DEFAULT gen_random_uuid() | Public identifier |
| original_name | VARCHAR(255) | NOT NULL | Original filename |
| stored_name | VARCHAR(255) | NOT NULL | Stored filename |
| extension | VARCHAR(50) | NOT NULL | File extension |
| mime_type | VARCHAR(100) | NOT NULL | MIME type |
| size_bytes | BIGINT | CHECK >= 0 | File size |
| storage_type | VARCHAR(20) | CHECK IN ('public', 'private') | Visibility |
| storage_path | VARCHAR(500) | NOT NULL | Full storage path |
| upload_status | VARCHAR(20) | DEFAULT 'completed' | Upload state |
| chunks_received | INTEGER | DEFAULT 0 | For chunked uploads |
| total_chunks | INTEGER | DEFAULT 1 | Total chunks expected |
| user_id | BIGINT | FK to users, ON DELETE SET NULL | Owner |
| description | TEXT | | Optional description |
| metadata | JSONB | DEFAULT '{}' | Custom metadata |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### Galleries Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| user_id | BIGINT | FK to users | Gallery owner |
| name | VARCHAR(255) | NOT NULL | Gallery name |
| description | TEXT | | Optional description |
| is_public | BOOLEAN | DEFAULT false | Public visibility |
| gallery_type | VARCHAR(32) | NOT NULL, CHECK | `regular_galleries` or `geo_galleries` |
| gallery_uuid | UUID | NOT NULL, UNIQUE | Public identifier for URLs |
| display_order | INTEGER | DEFAULT 0 | Sort order |
| latitude | DOUBLE PRECISION | CHECK -90 to 90 | Gallery location |
| longitude | DOUBLE PRECISION | CHECK -180 to 180 | Gallery location |
| tags | TEXT[] | | Array of tags |
| cover_image_id | BIGINT | FK to uploads | Cover image |
| cover_image_uuid | UUID | | Cover image UUID |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### Gallery Likes Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| gallery_id | BIGINT | FK to galleries, CASCADE | Liked gallery |
| user_id | BIGINT | FK to users, CASCADE | User who liked |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Like timestamp |

### Geo Places Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| name | VARCHAR(255) | NOT NULL | Place name |
| place_type | VARCHAR(20) | CHECK: restaurant/cafe/lodging | Place type |
| description | TEXT | | Optional description |
| latitude | DOUBLE PRECISION | NOT NULL, CHECK | Location |
| longitude | DOUBLE PRECISION | NOT NULL, CHECK | Location |
| created_by | BIGINT | FK to users | Admin who created |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### Competitions Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| title | VARCHAR(255) | NOT NULL | Competition title |
| description | TEXT | NOT NULL | Description |
| start_date | TIMESTAMPTZ | NOT NULL | Start date |
| end_date | TIMESTAMPTZ | NOT NULL | End date |
| prize_cents | BIGINT | DEFAULT 10000, CHECK >= 0 | Prize in cents |
| rules | TEXT | NOT NULL | Competition rules |
| created_by | BIGINT | FK to users | Admin who created |
| winner_gallery_id | BIGINT | FK to galleries | Winning gallery |
| winner_user_id | BIGINT | FK to users | Winner |
| awarded_at | TIMESTAMPTZ | | Award timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update |

### Competition Entries Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| competition_id | BIGINT | FK to competitions, CASCADE | Competition |
| gallery_id | BIGINT | FK to galleries, CASCADE | Submitted gallery |
| user_id | BIGINT | FK to users, CASCADE | User |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Submission time |

### Competition Admin Votes Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | Auto-increment ID |
| competition_id | BIGINT | FK to competitions, CASCADE | Competition |
| gallery_id | BIGINT | FK to galleries, CASCADE | Voted gallery |
| admin_id | BIGINT | FK to users, CASCADE | Admin who voted |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Vote timestamp |

---

## Development Workflow

### Adding a New Table

1. **Create migration:**
```bash
sqlx migrate add create_orders_table
```

2. **Write SQL:**
```sql
-- migrations/20251229123456_create_orders_table.sql
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
```

3. **Run migration:**
```bash
sqlx migrate run
```

4. **Create read module:**
```rust
// app/db_query/read/order/mod.rs
pub struct Order { ... }
pub async fn get_by_id(db: &Pool<Postgres>, id: i64) -> Result<Order, sqlx::Error> { ... }
pub async fn get_by_user(db: &Pool<Postgres>, user_id: i64) -> Vec<Order> { ... }
```

5. **Create mutations module:**
```rust
// app/db_query/mutations/order/mod.rs
pub struct CreateOrderParams { ... }
pub async fn create(db: &Pool<Postgres>, params: &CreateOrderParams) -> Result<i64, sqlx::Error> { ... }
pub async fn update_status(db: &Pool<Postgres>, id: i64, status: &str) -> Result<(), sqlx::Error> { ... }
```

6. **Update query cache:**
```bash
cargo sqlx prepare
```

7. **Commit changes** (including `.sqlx/` directory)

---

## Related Documentation

- [Uploads](../Uploads/UPLOADS.md) - File storage and upload system
- [Controllers](../Controllers/CONTROLLERS.md) - Using database in controllers
- [API Routes](../Routes/Api/API_ROUTES.md) - API endpoints that use database
- [Geo Galleries](../GeoGalleries/GEO_GALLERIES.md) - Geo galleries, places, and competitions
