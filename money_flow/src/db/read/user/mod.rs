use crate::modules::routes::validators::auth::SigninRequest;
use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};

pub struct User {
    pub id: i64,
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
    pub balance: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub async fn has_with_email(db: &Pool<Postgres>, email: &str) -> bool {
    sqlx::query!("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email)
        .fetch_one(db)
        .await
        .unwrap()
        .exists
        .unwrap_or(false)
}

pub async fn sign_in(db: &Pool<Postgres>, user: &SigninRequest) -> Result<User, sqlx::Error> {
    let record = sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", &user.email)
        .fetch_one(db)
        .await?;

    Ok(record)
}
