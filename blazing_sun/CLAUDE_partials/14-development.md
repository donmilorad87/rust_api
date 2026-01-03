# Development Commands

```bash
# Inside container (docker compose exec rust bash)

# Build
cargo build                    # Debug build
cargo build --release          # Release build
cargo check                    # Type check only (faster)

# Run
cargo run                      # Run debug
cargo run --release            # Run release

# Test
cargo test                     # Run all tests
cargo test -- --nocapture      # Show println output
cargo test <test_name>         # Run specific test

# Lint
cargo clippy                   # Linter
cargo fmt                      # Format code
cargo fmt -- --check           # Check formatting

# Migrations
sqlx migrate run               # Run pending migrations
sqlx migrate add <name>        # Create new migration
sqlx migrate revert            # Revert last migration

# SQLx cache (REQUIRED after changing queries)
cargo sqlx prepare             # Generate .sqlx/ cache
```
