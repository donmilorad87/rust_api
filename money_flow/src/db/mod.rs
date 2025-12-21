pub mod mutations;
pub mod read;

use actix_web::web;
use dotenv::dotenv;
use sqlx::{Pool, Postgres};
use std::any::Any;
use std::sync::Arc;
use tokio::sync::Mutex;

// Use a trait object to avoid circular dependency with mq module
pub type DynMq = Arc<Mutex<dyn Any + Send + Sync>>;

pub struct AppState {
    pub db: Mutex<sqlx::Pool<sqlx::Postgres>>,
    pub jwt_secret: String,
    pub mq: Option<DynMq>,
}

pub async fn create_pool() -> Pool<Postgres> {
    dotenv().ok();

    sqlx::postgres::PgPoolOptions::new()
        .max_connections(10000)
        .connect(&std::env::var("DATABASE_URL").unwrap())
        .await
        .unwrap()
}

pub async fn state() -> web::Data<AppState> {
    dotenv().ok();

    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: std::env::var("JWT_SECRET").unwrap(),
        mq: None,
    })
}

pub async fn state_with_mq(mq: DynMq) -> web::Data<AppState> {
    dotenv().ok();

    web::Data::new(AppState {
        db: Mutex::new(create_pool().await),
        jwt_secret: std::env::var("JWT_SECRET").unwrap(),
        mq: Some(mq),
    })
}
