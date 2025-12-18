mod controllers;

use actix_web::web;
use dotenv::dotenv;
use tokio::sync::Mutex;

pub use controllers::user;

pub struct AppState {
    pub db: Mutex<sqlx::Pool<sqlx::Postgres>>,
}

pub async fn state() -> web::Data<AppState> {
    dotenv().ok();

    web::Data::new(AppState {
        db: Mutex::new(
            sqlx::postgres::PgPoolOptions::new()
                .max_connections(10000)
                .connect(&std::env::var("DATABASE_URL").unwrap())
                .await
                .unwrap(),
        ),
    })
}
