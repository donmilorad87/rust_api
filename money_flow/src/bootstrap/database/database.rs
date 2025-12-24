//! Database Connection and Application State
//!
//! This module provides database connection pooling and application state management.

use crate::config::{DatabaseConfig, JwtConfig};
use crate::events::SharedEventBus;
use actix_web::web;
use sqlx::{Pool, Postgres};
use std::any::Any;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Type alias for message queue to avoid circular dependency
pub type DynMq = Arc<Mutex<dyn Any + Send + Sync>>;

/// Application state shared across all request handlers
pub struct AppState {
    pub db: Mutex<sqlx::Pool<sqlx::Postgres>>,
    pub jwt_secret: &'static str,
    pub mq: Option<DynMq>,
    pub events: Option<SharedEventBus>,
}

impl AppState {
    /// Get the event bus for publishing events
    pub fn event_bus(&self) -> Option<&SharedEventBus> {
        self.events.as_ref()
    }
}

/// Create a new database connection pool
pub async fn create_pool() -> Pool<Postgres> {
    sqlx::postgres::PgPoolOptions::new()
        .max_connections(DatabaseConfig::max_connections())
        .connect(DatabaseConfig::url())
        .await
        .unwrap()
}

/// Create application state without MQ or events
pub async fn state() -> web::Data<AppState> {
    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: JwtConfig::secret(),
        mq: None,
        events: None,
    })
}

/// Create application state with message queue
pub async fn state_with_mq(mq: DynMq) -> web::Data<AppState> {
    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: JwtConfig::secret(),
        mq: Some(mq),
        events: None,
    })
}

/// Create application state with message queue and event bus
pub async fn state_with_mq_and_events(mq: DynMq, events: SharedEventBus) -> web::Data<AppState> {
    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: JwtConfig::secret(),
        mq: Some(mq),
        events: Some(events),
    })
}
