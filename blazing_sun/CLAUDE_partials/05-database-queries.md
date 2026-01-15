# Database Queries

## Read Operations (`app/db_query/read/`)

```rust
use crate::app::db_query::read::user;

// Check if user exists
let exists: bool = user::has_with_email(&db, "test@example.com").await;

// Get user by ID
let user: Option<User> = user::get_by_id(&db, 123).await?;

// Get user by email
let user: User = user::get_by_email(&db, "test@example.com").await?;

// Sign in (returns user if credentials valid)
let user: User = user::sign_in(&db, &signin_request).await?;

// Count all users
let count: i64 = user::count(&db).await;

// Upload reads
use crate::app::db_query::read::upload;
let upload = upload::get_by_uuid(&db, &uuid).await?;
let uploads = upload::get_by_user_id(&db, user_id).await?;
```

## Mutation Operations (`app/db_query/mutations/`)

```rust
use crate::app::db_query::mutations::user;
use crate::app::db_query::mutations::activation_hash;
use crate::app::db_query::mutations::upload;

// Create user
user::create(&db, &CreateUserParams { email, password, first_name, last_name }).await;

// Update user (partial - only provided fields)
user::update_partial(&db, user_id, &UpdateParams { first_name: Some("New"), .. }).await?;

// Delete user
user::delete(&db, user_id).await?;

// Activation hashes
let hash: String = activation_hash::generate_hash(); // Random 6-char code
activation_hash::create(&db, user_id, &hash, "activation", expiry_minutes).await?;
let valid: bool = activation_hash::verify(&db, user_id, &hash, "activation").await?;

// Upload mutations
upload::create(&db, &CreateUploadParams { ... }).await?;
upload::delete(&db, &uuid).await?;
```
