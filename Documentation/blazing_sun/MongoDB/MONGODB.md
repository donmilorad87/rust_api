# MongoDB Documentation

This document provides comprehensive documentation for MongoDB integration in the Blazing Sun application.

---

## Overview

MongoDB is integrated into the Blazing Sun application as a secondary database for document storage, particularly useful for:
- Flexible schema documents
- Event logs and audit trails
- Session storage
- Cache for complex queries
- Analytics data

**File Locations:**
- MongoDB Config: `config/mongodb.rs`
- AppState Integration: `bootstrap/database/database.rs`

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Database Architecture                                │
└────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                            Blazing Sun App                                  │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                          AppState                                    │  │
│  │                                                                      │  │
│  │   ┌─────────────────┐         ┌─────────────────┐                   │  │
│  │   │   PostgreSQL    │         │     MongoDB     │                   │  │
│  │   │   (Primary)     │         │   (Secondary)   │                   │  │
│  │   │                 │         │                 │                   │  │
│  │   │  - Users        │         │  - Audit Logs   │                   │  │
│  │   │  - Transactions │         │  - Sessions     │                   │  │
│  │   │  - Categories   │         │  - Analytics    │                   │  │
│  │   │  - Uploads      │         │  - Flexible     │                   │  │
│  │   │                 │         │    Documents    │                   │  │
│  │   └─────────────────┘         └─────────────────┘                   │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

### PostgreSQL vs MongoDB

| Feature | PostgreSQL | MongoDB |
|---------|------------|---------|
| Schema | Fixed, relational | Flexible, document |
| Use Case | Transactional data | Flexible/analytics |
| Query Language | SQL | MongoDB Query |
| ACID | Full support | Per-document |
| Joins | Native | $lookup (limited) |

---

## Configuration

### Environment Variables

```env
# MongoDB Configuration
MONGO_HOST=mongo
MONGO_PORT=27017
MONGO_USER=app
MONGO_PASSWORD=mongo_secret_password
MONGO_INITDB_DATABASE=blazing_sun
MONGO_URL=mongodb://app:mongo_secret_password@mongo:27017/blazing_sun

# Connection Pool
MONGO_MAX_POOL_SIZE=100
MONGO_MIN_POOL_SIZE=5
MONGO_CONNECT_TIMEOUT_MS=10000
```

### MongoDbConfig (`config/mongodb.rs`)

```rust
use once_cell::sync::Lazy;

pub struct MongoDbConfig {
    pub url: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
    pub max_pool_size: u32,
    pub min_pool_size: u32,
    pub connect_timeout_ms: u64,
}

pub static MONGODB: Lazy<MongoDbConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    let host = std::env::var("MONGO_HOST").unwrap_or_else(|_| "mongo".to_string());
    let port: u16 = std::env::var("MONGO_PORT")
        .unwrap_or_else(|_| "27017".to_string())
        .parse()
        .expect("MONGO_PORT must be a valid number");
    let user = std::env::var("MONGO_USER").unwrap_or_else(|_| "app".to_string());
    let password = std::env::var("MONGO_PASSWORD").unwrap_or_else(|_| "".to_string());
    let database = std::env::var("MONGO_INITDB_DATABASE")
        .unwrap_or_else(|_| "blazing_sun".to_string());

    // Build URL from components if MONGO_URL not provided
    let url = std::env::var("MONGO_URL").unwrap_or_else(|_| {
        if password.is_empty() {
            format!("mongodb://{}:{}/{}", host, port, database)
        } else {
            format!("mongodb://{}:{}@{}:{}/{}", user, password, host, port, database)
        }
    });

    MongoDbConfig {
        url,
        host,
        port,
        user,
        password,
        database,
        max_pool_size: std::env::var("MONGO_MAX_POOL_SIZE")
            .unwrap_or_else(|_| "100".to_string())
            .parse()
            .expect("MONGO_MAX_POOL_SIZE must be a valid number"),
        min_pool_size: std::env::var("MONGO_MIN_POOL_SIZE")
            .unwrap_or_else(|_| "5".to_string())
            .parse()
            .expect("MONGO_MIN_POOL_SIZE must be a valid number"),
        connect_timeout_ms: std::env::var("MONGO_CONNECT_TIMEOUT_MS")
            .unwrap_or_else(|_| "10000".to_string())
            .parse()
            .expect("MONGO_CONNECT_TIMEOUT_MS must be a valid number"),
    }
});

impl MongoDbConfig {
    pub fn url() -> &'static str { &MONGODB.url }
    pub fn host() -> &'static str { &MONGODB.host }
    pub fn port() -> u16 { MONGODB.port }
    pub fn user() -> &'static str { &MONGODB.user }
    pub fn password() -> &'static str { &MONGODB.password }
    pub fn database() -> &'static str { &MONGODB.database }
    pub fn max_pool_size() -> u32 { MONGODB.max_pool_size }
    pub fn min_pool_size() -> u32 { MONGODB.min_pool_size }
    pub fn connect_timeout_ms() -> u64 { MONGODB.connect_timeout_ms }
}
```

---

## AppState Integration

### AppState Structure

```rust
// bootstrap/database/database.rs

use mongodb::{Client as MongoClient, Database as MongoDatabase};
use std::sync::Arc;
use tokio::sync::Mutex;

pub type SharedMongoDb = Arc<MongoDatabase>;

pub struct AppState {
    pub db: Mutex<Pool<Postgres>>,           // PostgreSQL
    pub jwt_secret: &'static str,
    pub mq: Option<DynMq>,                   // RabbitMQ
    pub events: Option<SharedEventBus>,      // Kafka
    pub mongodb: Option<SharedMongoDb>,      // MongoDB (optional)
}

impl AppState {
    /// Get MongoDB database reference
    pub fn mongodb(&self) -> Option<&SharedMongoDb> {
        self.mongodb.as_ref()
    }
}
```

### Creating MongoDB Connection

```rust
use crate::config::MongoDbConfig;
use mongodb::{
    options::{ClientOptions, ServerApi, ServerApiVersion},
    Client,
};
use std::time::Duration;

pub async fn create_mongodb_client() -> Result<SharedMongoDb, Box<dyn std::error::Error>> {
    // Build client options
    let mut client_options = ClientOptions::parse(MongoDbConfig::url()).await?;

    // Configure connection pool
    client_options.max_pool_size = Some(MongoDbConfig::max_pool_size());
    client_options.min_pool_size = Some(MongoDbConfig::min_pool_size());
    client_options.connect_timeout = Some(Duration::from_millis(
        MongoDbConfig::connect_timeout_ms()
    ));

    // Set server API version for compatibility
    let server_api = ServerApi::builder().version(ServerApiVersion::V1).build();
    client_options.server_api = Some(server_api);

    // Create client
    let client = Client::with_options(client_options)?;

    // Get database reference
    let database = client.database(MongoDbConfig::database());

    // Test connection
    database.run_command(doc! { "ping": 1 }, None).await?;
    tracing::info!("MongoDB connection established successfully");

    Ok(Arc::new(database))
}
```

### State Factory with MongoDB

```rust
pub async fn state_with_all(
    mq: DynMq,
    events: SharedEventBus,
    mongodb: SharedMongoDb,
) -> web::Data<AppState> {
    let pool = create_pool().await;

    web::Data::new(AppState {
        db: Mutex::new(pool),
        jwt_secret: JwtConfig::secret(),
        mq: Some(mq),
        events: Some(events),
        mongodb: Some(mongodb),
    })
}
```

---

## Using MongoDB in Controllers

### Basic Operations

```rust
use actix_web::{web, HttpResponse};
use mongodb::bson::{doc, Document};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct AuditLog {
    user_id: i64,
    action: String,
    details: Document,
    timestamp: chrono::DateTime<chrono::Utc>,
}

pub async fn log_action(
    state: web::Data<AppState>,
    user_id: i64,
    action: &str,
    details: Document,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(mongodb) = state.mongodb() {
        let collection = mongodb.collection::<AuditLog>("audit_logs");

        let log = AuditLog {
            user_id,
            action: action.to_string(),
            details,
            timestamp: chrono::Utc::now(),
        };

        collection.insert_one(log, None).await?;
    }

    Ok(())
}
```

### Insert Document

```rust
use mongodb::bson::{doc, Document};

pub async fn insert_document(
    state: web::Data<AppState>,
) -> Result<HttpResponse, actix_web::Error> {
    let mongodb = state.mongodb()
        .ok_or_else(|| actix_web::error::ErrorInternalServerError("MongoDB not available"))?;

    let collection = mongodb.collection::<Document>("my_collection");

    let document = doc! {
        "name": "Example",
        "value": 42,
        "tags": ["rust", "mongodb"],
        "created_at": chrono::Utc::now().to_string(),
    };

    let result = collection.insert_one(document, None).await
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    Ok(HttpResponse::Ok().json(doc! {
        "inserted_id": result.inserted_id.to_string()
    }))
}
```

### Find Documents

```rust
use futures::TryStreamExt;
use mongodb::bson::doc;

pub async fn find_documents(
    state: web::Data<AppState>,
    user_id: i64,
) -> Result<Vec<Document>, Box<dyn std::error::Error>> {
    let mongodb = state.mongodb().ok_or("MongoDB not available")?;
    let collection = mongodb.collection::<Document>("audit_logs");

    // Find with filter
    let filter = doc! { "user_id": user_id };
    let cursor = collection.find(filter, None).await?;

    // Collect results
    let documents: Vec<Document> = cursor.try_collect().await?;

    Ok(documents)
}
```

### Find One Document

```rust
pub async fn find_one_document(
    state: web::Data<AppState>,
    id: &str,
) -> Result<Option<Document>, Box<dyn std::error::Error>> {
    let mongodb = state.mongodb().ok_or("MongoDB not available")?;
    let collection = mongodb.collection::<Document>("my_collection");

    let filter = doc! { "_id": id };
    let document = collection.find_one(filter, None).await?;

    Ok(document)
}
```

### Update Document

```rust
pub async fn update_document(
    state: web::Data<AppState>,
    id: &str,
    new_value: i32,
) -> Result<bool, Box<dyn std::error::Error>> {
    let mongodb = state.mongodb().ok_or("MongoDB not available")?;
    let collection = mongodb.collection::<Document>("my_collection");

    let filter = doc! { "_id": id };
    let update = doc! {
        "$set": {
            "value": new_value,
            "updated_at": chrono::Utc::now().to_string(),
        }
    };

    let result = collection.update_one(filter, update, None).await?;

    Ok(result.modified_count > 0)
}
```

### Delete Document

```rust
pub async fn delete_document(
    state: web::Data<AppState>,
    id: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    let mongodb = state.mongodb().ok_or("MongoDB not available")?;
    let collection = mongodb.collection::<Document>("my_collection");

    let filter = doc! { "_id": id };
    let result = collection.delete_one(filter, None).await?;

    Ok(result.deleted_count > 0)
}
```

---

## Creating a MongoDB Repository

### Repository Pattern

```rust
// app/db_query/mongodb/audit_log.rs

use mongodb::{Collection, Database, bson::{doc, Document}};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct AuditLog {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<mongodb::bson::oid::ObjectId>,
    pub user_id: i64,
    pub action: String,
    pub resource_type: String,
    pub resource_id: String,
    pub details: Document,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub struct AuditLogRepository {
    collection: Collection<AuditLog>,
}

impl AuditLogRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            collection: db.collection("audit_logs"),
        }
    }

    /// Create a new audit log entry
    pub async fn create(&self, log: AuditLog) -> Result<String, mongodb::error::Error> {
        let result = self.collection.insert_one(log, None).await?;
        Ok(result.inserted_id.to_string())
    }

    /// Find logs by user ID
    pub async fn find_by_user(&self, user_id: i64) -> Result<Vec<AuditLog>, mongodb::error::Error> {
        let filter = doc! { "user_id": user_id };
        let cursor = self.collection.find(filter, None).await?;
        cursor.try_collect().await
    }

    /// Find logs by action
    pub async fn find_by_action(&self, action: &str) -> Result<Vec<AuditLog>, mongodb::error::Error> {
        let filter = doc! { "action": action };
        let cursor = self.collection.find(filter, None).await?;
        cursor.try_collect().await
    }

    /// Find logs by resource
    pub async fn find_by_resource(
        &self,
        resource_type: &str,
        resource_id: &str,
    ) -> Result<Vec<AuditLog>, mongodb::error::Error> {
        let filter = doc! {
            "resource_type": resource_type,
            "resource_id": resource_id,
        };
        let cursor = self.collection.find(filter, None).await?;
        cursor.try_collect().await
    }

    /// Find logs in date range
    pub async fn find_in_date_range(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> Result<Vec<AuditLog>, mongodb::error::Error> {
        let filter = doc! {
            "created_at": {
                "$gte": start.to_string(),
                "$lte": end.to_string(),
            }
        };
        let cursor = self.collection.find(filter, None).await?;
        cursor.try_collect().await
    }
}
```

### Using the Repository

```rust
use crate::app::db_query::mongodb::audit_log::{AuditLogRepository, AuditLog};

pub async fn log_user_action(
    state: web::Data<AppState>,
    user_id: i64,
    action: &str,
    resource_type: &str,
    resource_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(mongodb) = state.mongodb() {
        let repo = AuditLogRepository::new(mongodb);

        let log = AuditLog {
            id: None,
            user_id,
            action: action.to_string(),
            resource_type: resource_type.to_string(),
            resource_id: resource_id.to_string(),
            details: doc! {},
            ip_address: None,
            user_agent: None,
            created_at: chrono::Utc::now(),
        };

        repo.create(log).await?;
    }

    Ok(())
}
```

---

## Indexes

### Creating Indexes

```rust
use mongodb::{IndexModel, options::IndexOptions};
use mongodb::bson::doc;

pub async fn create_indexes(db: &Database) -> Result<(), mongodb::error::Error> {
    let audit_logs = db.collection::<Document>("audit_logs");

    // Index on user_id
    let user_index = IndexModel::builder()
        .keys(doc! { "user_id": 1 })
        .build();

    // Index on action
    let action_index = IndexModel::builder()
        .keys(doc! { "action": 1 })
        .build();

    // Compound index on resource
    let resource_index = IndexModel::builder()
        .keys(doc! { "resource_type": 1, "resource_id": 1 })
        .build();

    // Index on created_at with TTL (auto-delete after 90 days)
    let ttl_index = IndexModel::builder()
        .keys(doc! { "created_at": 1 })
        .options(IndexOptions::builder()
            .expire_after(std::time::Duration::from_secs(90 * 24 * 60 * 60))
            .build())
        .build();

    audit_logs.create_indexes(
        vec![user_index, action_index, resource_index, ttl_index],
        None
    ).await?;

    Ok(())
}
```

---

## Aggregation Pipelines

### Example: User Activity Summary

```rust
use mongodb::bson::{doc, Document};
use futures::TryStreamExt;

pub async fn get_user_activity_summary(
    state: web::Data<AppState>,
    user_id: i64,
) -> Result<Vec<Document>, Box<dyn std::error::Error>> {
    let mongodb = state.mongodb().ok_or("MongoDB not available")?;
    let collection = mongodb.collection::<Document>("audit_logs");

    let pipeline = vec![
        // Match user
        doc! { "$match": { "user_id": user_id } },

        // Group by action
        doc! {
            "$group": {
                "_id": "$action",
                "count": { "$sum": 1 },
                "last_occurrence": { "$max": "$created_at" },
            }
        },

        // Sort by count
        doc! { "$sort": { "count": -1 } },
    ];

    let cursor = collection.aggregate(pipeline, None).await?;
    let results: Vec<Document> = cursor.try_collect().await?;

    Ok(results)
}
```

---

## Best Practices

1. **Use MongoDB for flexible data**:
   - Audit logs
   - Session data
   - Analytics
   - Temporary/cache data

2. **Keep PostgreSQL for transactional data**:
   - Users
   - Transactions
   - Categories
   - Anything requiring ACID

3. **Create appropriate indexes**:
   - Index frequently queried fields
   - Use compound indexes for common query patterns
   - Consider TTL indexes for automatic cleanup

4. **Handle connection failures gracefully**:
   - MongoDB is optional in AppState
   - Check for availability before use
   - Don't fail requests if MongoDB is down

5. **Use typed collections**:
   - Define structs for your documents
   - Use serde for serialization
   - Leverage Rust's type system

---

## Monitoring

### MongoDB Express UI

Access at `http://localhost:8081`:
- View collections
- Browse documents
- Run queries
- Monitor performance

### Useful Commands

```bash
# Connect to MongoDB shell
docker compose exec mongo mongosh -u app -p mongo_secret_password blazing_sun

# List collections
db.getCollectionNames()

# Find documents
db.audit_logs.find({ user_id: 1 })

# Count documents
db.audit_logs.countDocuments({ action: "sign_in" })

# Create index
db.audit_logs.createIndex({ user_id: 1 })
```

---

## Related Documentation

- [Database Documentation](../Database/DATABASE.md) - PostgreSQL (primary database)
- [Bootstrap Documentation](../Bootstrap/BOOTSTRAP.md) - AppState integration
- [Kafka Events](../Events/EVENTS.md) - Event streaming
