pub mod mutations;
pub mod read;

use crate::config::{DatabaseConfig, JwtConfig};
use actix_web::web;
use sqlx::{Pool, Postgres};
use std::any::Any;
use std::sync::Arc;
use tokio::sync::Mutex;

// Use a trait object to avoid circular dependency with mq module
pub type DynMq = Arc<Mutex<dyn Any + Send + Sync>>;

pub struct AppState {
    pub db: Mutex<sqlx::Pool<sqlx::Postgres>>,
    pub jwt_secret: &'static str,
    pub mq: Option<DynMq>,
}

pub async fn create_pool() -> Pool<Postgres> {
    sqlx::postgres::PgPoolOptions::new()
        .max_connections(DatabaseConfig::max_connections())
        .connect(DatabaseConfig::url())
        .await
        .unwrap()
}

pub async fn state() -> web::Data<AppState> {
    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: JwtConfig::secret(),
        mq: None,
    })
}

pub async fn state_with_mq(mq: DynMq) -> web::Data<AppState> {
    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: JwtConfig::secret(),
        mq: Some(mq),
    })
}
