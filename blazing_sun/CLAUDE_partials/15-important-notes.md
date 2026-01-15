# Important Notes

## SQLx Offline Mode

- Queries are compile-time checked against database schema
- `.sqlx/` directory contains query cache - **COMMIT TO GIT**
- Run `cargo sqlx prepare` after changing any `sqlx::query!` macro
- Set `SQLX_OFFLINE=true` for builds without database connection

## Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

## JWT Claims

```rust
pub struct Claims {
    pub sub: i64,       // User ID
    pub role: String,   // "user"
    pub exp: i64,       // Expiration timestamp
}
```

## Error Handling Pattern

```rust
// In handlers, use ? operator with proper error conversion
let user = db_user::get_by_id(&db, id)
    .await
    .map_err(|_| HttpResponse::NotFound().json(BaseResponse::error("User not found")))?;

// For Kafka/MQ failures, log warning and continue (non-critical)
if let Some(event_bus) = state.event_bus() {
    if let Err(e) = events::publish::user_created(event_bus, ...).await {
        tracing::warn!("Failed to publish event: {}", e);
        // Don't fail the request
    }
}
```
