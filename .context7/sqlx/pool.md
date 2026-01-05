# SQLx - Connection Pools

Source: https://github.com/context7/rs_sqlx_sqlx/blob/main/struct.Pool.md

Create a pool from a database URL.

```rust
pub async fn connect(url: &str) -> Result<Pool<DB>, Error>
where
    DB: Database,
{
    // ... implementation details ...
}
```

Source: https://github.com/context7/rs_sqlx_sqlx/blob/main/pool/index.md

Use a pool as an executor.

```rust
sqlx::query("DELETE FROM articles").execute(&pool).await?;
```
