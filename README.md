# Money Flow

A Rust web application for personal finance tracking built with Actix-web and PostgreSQL.

## Docker Structure

```
.
├── docker-compose.yml      # Orchestrates all services
├── rust/
│   ├── Dockerfile          # Rust container build
│   ├── entrypoint.sh       # Dev/prod startup logic
│   ├── install.dev.sh      # Dev dependencies (sqlx-cli, cargo-watch)
│   └── install.prod.sh     # Production build
├── postgres/
│   ├── Dockerfile
│   ├── pg_hba.conf         # Authentication config
│   └── postgresql.conf     # PostgreSQL settings
└── nginx/
    ├── Dockerfile
    └── default.conf        # Reverse proxy config
```

### Running the Project

```bash
# Start all services
docker compose up -d

# Enter the rust container
docker compose exec rust bash

# View logs
docker compose logs -f rust

# Stop everything
docker compose down
```

### Environment Modes

Set `BUILD_ENV` in `.env`:
- `dev` - Hot reload with cargo-watch, auto-runs `cargo sqlx prepare` on changes
- `prod` - Release build, runs compiled binary

## Rust Project Structure

```
money_flow/
├── Cargo.toml
├── migrations/                 # SQLx database migrations
├── .sqlx/                      # Cached query metadata (commit to git)
├── src/
│   ├── main.rs                 # Entry point
│   ├── lib.rs                  # Module exports
│   └── modules/
│       ├── mod.rs
│       ├── db/
│       │   ├── mod.rs          # AppState, database connection
│       │   └── controllers/
│       │       ├── mod.rs
│       │       └── user.rs     # User database operations
│       └── routes/
│           ├── mod.rs          # Route configuration
│           └── controllers/
│               ├── mod.rs
│               ├── auth.rs     # Auth endpoints
│               └── me.rs       # Profile endpoints
└── tests/
    └── routes_test.rs          # Integration tests
```

## Tests

Run tests inside the Docker container:

```bash
# Run all tests
cargo test

# Run a specific test
cargo test test_name

# Run tests with output
cargo test -- --nocapture
```

## SQLx Migrations

Migrations are SQL files in the `migrations/` directory.

```bash
# Run pending migrations
sqlx migrate run

# Create a new migration
sqlx migrate add <name>

# Revert last migration
sqlx migrate revert
```

Migration files follow the naming convention:
```
YYYYMMDDHHMMSS_description.sql
```

## SQLx Offline Mode

SQLx verifies SQL queries at compile time. To build without a database connection, it uses cached query metadata.

### How It Works

1. `SQLX_OFFLINE=true` in `.env` enables offline mode in dev mode
2. `.sqlx/` directory contains cached query metadata
3. `cargo sqlx prepare` regenerates the cache

### Workflow

When you modify SQL queries:

```bash
# Regenerate query cache (requires running database)
cargo sqlx prepare
```

The development environment auto-runs this on file changes via cargo-watch.

### Important

- **Commit `.sqlx/` to version control** - allows CI/CD and other developers to build without a database
- Run `cargo sqlx prepare` after changing any `sqlx::query!` macros

## Tech Stack

- **Framework**: Actix-web 4
- **Database**: PostgreSQL with SQLx (compile-time checked queries)
- **Runtime**: Tokio async runtime
- **Hot Reload**: cargo-watch (dev mode)