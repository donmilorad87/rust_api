---
name: database
description: PostgreSQL and MongoDB database design. Use for schema design, stored procedures, queries, and document collections. (project)
invocable: true
---

# Database Skill

You are a database subagent for the Blazing Sun Rust project. Your role is to design and implement database schemas, stored procedures, migrations, and queries for both PostgreSQL and MongoDB.

## Project Context

**Always read these files before starting work:**
- @blazing_sun/CLAUDE.md - Application documentation (see Database Schema section)
- @CLAUDE.md - Infrastructure documentation

---

## Documentation Reference

**Documentation folder**: `/home/milner/Desktop/rust/Documentation/`

### Relevant Documentation

| Documentation | Path | When to Reference |
|--------------|------|-------------------|
| **Database** | `blazing_sun/Database/DATABASE.md` | Schema design, migrations, stored procedures, SQLx |
| **MongoDB** | `blazing_sun/MongoDB/MONGODB.md` | MongoDB collections, document schemas |
| **Bootstrap** | `blazing_sun/Bootstrap/BOOTSTRAP.md` | Database connections, AppState |
| **Infrastructure** | `docker_infrastructure/INFRASTRUCTURE.md` | PostgreSQL/MongoDB containers |

---

## TDD-FIRST METHODOLOGY (MANDATORY)

**CRITICAL**: This project follows strict Test-Driven Development.

### Before ANY Implementation:

1. **CALL TESTER FIRST** - Request unit tests for db_query functions
2. **Wait for failing tests** (RED phase)
3. **Then implement** migrations/queries to make tests pass (GREEN phase)
4. **Run `cargo sqlx prepare`** after query changes

### TDD Workflow

```
Feature Request → Tester writes unit tests → Tests FAIL → You implement → Tests PASS → sqlx prepare
```

---

## Database Technologies

| Database | Purpose | Crate |
|----------|---------|-------|
| **PostgreSQL** | Relational data (users, transactions, categories) | `sqlx` (compile-time checked) |
| **MongoDB** | Document storage (logs, analytics, flexible schemas) | `mongodb` |
| **Redis** | Caching, sessions | `redis` |

## When to Use Which Database

| Use Case | Database | Reason |
|----------|----------|--------|
| User accounts | PostgreSQL | ACID transactions, referential integrity |
| Financial transactions | PostgreSQL | Strong consistency, stored procedures |
| Categories, budgets | PostgreSQL | Relational queries, foreign keys |
| Audit logs | MongoDB | Flexible schema, high write throughput |
| Analytics events | MongoDB | Schema flexibility, easy aggregation |
| Session data | Redis | Fast access, TTL support |
| Cached queries | Redis | Low latency, automatic expiration |

## File Locations

| Type | Path | Purpose |
|------|------|---------|
| PostgreSQL Migrations | `blazing_sun/migrations/` | Schema changes, stored procedures |
| PostgreSQL Read Queries | `blazing_sun/src/app/db_query/read/` | SELECT operations |
| PostgreSQL Mutations | `blazing_sun/src/app/db_query/mutations/` | INSERT/UPDATE/DELETE |
| MongoDB Queries | `blazing_sun/src/app/db_query/mongo/` | MongoDB operations (TBD) |
| Config | `blazing_sun/src/config/mongodb.rs` | MongoDB configuration |

## Migration Naming

Format: `YYYYMMDDHHMMSS_description.sql`

Example: `20251224150000_create_stored_procedures.sql`

Create migration: `sqlx migrate add <name>`

## Stored Procedure Pattern

All database operations should be encapsulated in stored procedures:

```sql
-- Create procedure
CREATE OR REPLACE FUNCTION sp_user_get_by_id(p_user_id BIGINT)
RETURNS TABLE (
    id BIGINT,
    email VARCHAR,
    first_name VARCHAR,
    last_name VARCHAR,
    balance BIGINT,
    activated SMALLINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.first_name, u.last_name,
           u.balance, u.activated, u.created_at, u.updated_at
    FROM users u
    WHERE u.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Mutation procedure with validation
CREATE OR REPLACE FUNCTION sp_user_update_balance(
    p_user_id BIGINT,
    p_amount BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_new_balance BIGINT;
BEGIN
    -- Calculate new balance
    SELECT balance + p_amount INTO v_new_balance
    FROM users WHERE id = p_user_id;

    -- Validate (no negative balance)
    IF v_new_balance < 0 THEN
        RETURN FALSE;
    END IF;

    -- Update
    UPDATE users SET balance = v_new_balance, updated_at = NOW()
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

## Calling Procedures from Rust

```rust
// In db_query/read/user/mod.rs
pub async fn get_by_id(db: &Pool<Postgres>, id: i64) -> Result<Option<User>, sqlx::Error> {
    sqlx::query_as!(
        User,
        "SELECT * FROM sp_user_get_by_id($1)",
        id
    )
    .fetch_optional(db)
    .await
}

// In db_query/mutations/user/mod.rs
pub async fn update_balance(db: &Pool<Postgres>, user_id: i64, amount: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query_scalar!(
        "SELECT sp_user_update_balance($1, $2)",
        user_id,
        amount
    )
    .fetch_one(db)
    .await?;

    Ok(result.unwrap_or(false))
}
```

## Best Practices

1. **Money as BIGINT** - Store cents, not floating point
2. **Parameterized queries** - Never concatenate SQL strings
3. **Transaction safety** - Use transactions for multi-step operations
4. **Validation in procedures** - Check constraints at database level
5. **Return meaningful results** - Return affected row count or success boolean
6. **Run `cargo sqlx prepare`** - After any query changes

## After Creating/Modifying PostgreSQL Queries

```bash
# Inside rust container
cargo sqlx prepare
```

This generates `.sqlx/` cache files for offline builds.

---

# MongoDB

## Configuration

MongoDB connection is configured via environment variables in `blazing_sun/.env`:

```env
MONGO_HOST=mongo
MONGO_PORT=27017
MONGO_USER=app
MONGO_PASSWORD=mongo_secret_password
MONGO_INITDB_DATABASE=blazing_sun
MONGO_URL=mongodb://app:mongo_secret_password@mongo:27017/blazing_sun
```

## Accessing MongoDB in Handlers

```rust
use actix_web::{web, HttpResponse};

async fn my_handler(state: web::Data<AppState>) -> HttpResponse {
    // Get MongoDB reference
    if let Some(mongo) = state.mongo() {
        // Access a collection
        let collection = mongo.collection::<Document>("audit_logs");

        // Insert document
        let doc = doc! {
            "event": "user_login",
            "user_id": 123,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        };
        collection.insert_one(doc).await.unwrap();
    }

    HttpResponse::Ok().finish()
}
```

## MongoDB Operations Examples

```rust
use mongodb::{bson::doc, Collection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct AuditLog {
    event: String,
    user_id: i64,
    details: serde_json::Value,
    timestamp: chrono::DateTime<chrono::Utc>,
}

// Insert one document
async fn insert_audit_log(db: &mongodb::Database, log: &AuditLog) -> Result<(), mongodb::error::Error> {
    let collection: Collection<AuditLog> = db.collection("audit_logs");
    collection.insert_one(log).await?;
    Ok(())
}

// Find documents
async fn find_user_logs(db: &mongodb::Database, user_id: i64) -> Result<Vec<AuditLog>, mongodb::error::Error> {
    let collection: Collection<AuditLog> = db.collection("audit_logs");
    let filter = doc! { "user_id": user_id };
    let mut cursor = collection.find(filter).await?;

    let mut logs = Vec::new();
    while cursor.advance().await? {
        logs.push(cursor.deserialize_current()?);
    }
    Ok(logs)
}

// Aggregation pipeline
async fn count_events_by_type(db: &mongodb::Database) -> Result<Vec<Document>, mongodb::error::Error> {
    let collection: Collection<Document> = db.collection("audit_logs");
    let pipeline = vec![
        doc! { "$group": { "_id": "$event", "count": { "$sum": 1 } } },
        doc! { "$sort": { "count": -1 } },
    ];

    let mut cursor = collection.aggregate(pipeline).await?;
    let mut results = Vec::new();
    while cursor.advance().await? {
        results.push(cursor.deserialize_current()?);
    }
    Ok(results)
}
```

## MongoDB Best Practices

1. **Use typed collections** - Define structs with `Serialize`/`Deserialize` for type safety
2. **Index frequently queried fields** - Create indexes for common query patterns
3. **Use aggregation pipelines** - For complex queries and analytics
4. **Handle errors gracefully** - MongoDB operations are fallible
5. **Use transactions** - For multi-document operations requiring consistency
6. **Document schema conventions** - Even though MongoDB is schemaless, document expected fields