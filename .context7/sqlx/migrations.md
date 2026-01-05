# SQLx - Migrations

Source: https://github.com/context7/rs_sqlx_sqlx/blob/main/migrate/struct.Migrator.md

Run pending migrations with `Migrator`.

```rust
pub async fn run<'a, A>(&self, migrator: A) -> Result<(), MigrateError>
where A: Acquire<'a>,
<<A as Acquire<'a>>::Connection as Deref>::Target: Migrate,
Run any pending migrations against the database; and, validate previously applied migrations against the current migration source to detect accidental changes in previously-applied migrations.

// Example using SQLite:
let m = Migrator::new(std::path::Path::new("./migrations")).await?;
let pool = SqlitePoolOptions::new().connect("sqlite::memory:").await?;
m.run(&pool).await;
```
