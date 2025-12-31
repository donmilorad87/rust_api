//! Database Connection and Application State
//!
//! This module provides database connection pooling and application state management.

use crate::config::{DatabaseConfig, JwtConfig, MongoDbConfig};
use crate::events::SharedEventBus;
use actix_web::web;
use mongodb::{Client as MongoClient, Database as MongoDatabase};
use sqlx::{Pool, Postgres};
use std::any::Any;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

/// Type alias for message queue to avoid circular dependency
pub type DynMq = Arc<Mutex<dyn Any + Send + Sync>>;

/// Type alias for shared MongoDB client
pub type SharedMongoDb = Arc<MongoDatabase>;

/// Application state shared across all request handlers
pub struct AppState {
    pub db: Mutex<sqlx::Pool<sqlx::Postgres>>,
    pub jwt_secret: &'static str,
    pub mq: Option<DynMq>,
    pub events: Option<SharedEventBus>,
    pub mongodb: Option<SharedMongoDb>,
}

impl AppState {
    /// Get the event bus for publishing events
    pub fn event_bus(&self) -> Option<&SharedEventBus> {
        self.events.as_ref()
    }

    /// Get the MongoDB database reference
    pub fn mongo(&self) -> Option<&SharedMongoDb> {
        self.mongodb.as_ref()
    }
}

/// Create a new PostgreSQL connection pool
pub async fn create_pool() -> Pool<Postgres> {
    sqlx::postgres::PgPoolOptions::new()
        .max_connections(DatabaseConfig::max_connections())
        .connect(DatabaseConfig::url())
        .await
        .unwrap()
}

/// Create a new MongoDB client and return the database
pub async fn create_mongodb() -> Result<SharedMongoDb, mongodb::error::Error> {
    let mut client_options = mongodb::options::ClientOptions::parse(MongoDbConfig::url()).await?;

    // Configure connection pool
    client_options.max_pool_size = Some(MongoDbConfig::max_pool_size());
    client_options.min_pool_size = Some(MongoDbConfig::min_pool_size());
    client_options.connect_timeout = Some(Duration::from_millis(MongoDbConfig::connect_timeout_ms()));

    // Set app name for monitoring
    client_options.app_name = Some("blazing_sun".to_string());

    let client = MongoClient::with_options(client_options)?;
    let database = client.database(MongoDbConfig::database());

    // Ping to verify connection
    database
        .run_command(mongodb::bson::doc! { "ping": 1 })
        .await?;

    Ok(Arc::new(database))
}

/// Create application state without MQ or events
pub async fn state() -> web::Data<AppState> {
    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: JwtConfig::secret(),
        mq: None,
        events: None,
        mongodb: None,
    })
}

/// Create application state with message queue
pub async fn state_with_mq(mq: DynMq) -> web::Data<AppState> {
    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: JwtConfig::secret(),
        mq: Some(mq),
        events: None,
        mongodb: None,
    })
}

/// Create application state with message queue and event bus
pub async fn state_with_mq_and_events(mq: DynMq, events: SharedEventBus) -> web::Data<AppState> {
    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: JwtConfig::secret(),
        mq: Some(mq),
        events: Some(events),
        mongodb: None,
    })
}

/// Create application state with all services (MQ, Events, MongoDB)
pub async fn state_full(
    mq: DynMq,
    events: Option<SharedEventBus>,
    mongodb: Option<SharedMongoDb>,
) -> web::Data<AppState> {
    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: JwtConfig::secret(),
        mq: Some(mq),
        events,
        mongodb,
    })
}
