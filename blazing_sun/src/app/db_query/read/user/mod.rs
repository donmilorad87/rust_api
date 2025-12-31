use crate::app::http::api::validators::auth::SigninRequest;
use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};
use uuid::Uuid;

pub struct User {
    pub id: i64,
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
    pub balance: i64,
    pub activated: i16,
    pub verified: i16,
    pub two_factor: i16,
    pub user_must_set_password: i16,
    pub permissions: i16,
    pub avatar_uuid: Option<Uuid>,
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

pub async fn count(db: &Pool<Postgres>) -> i64 {
    sqlx::query_scalar!("SELECT COUNT(*) FROM users")
        .fetch_one(db)
        .await
        .unwrap_or(Some(0))
        .unwrap_or(0)
}

pub async fn get_by_id(db: &Pool<Postgres>, id: i64) -> Result<User, sqlx::Error> {
    sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
        .fetch_one(db)
        .await
}

pub async fn get_by_email(db: &Pool<Postgres>, email: &str) -> Result<User, sqlx::Error> {
    sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", email)
        .fetch_one(db)
        .await
}

/// Get all user emails
pub async fn get_all_emails(db: &Pool<Postgres>) -> Vec<String> {
    sqlx::query!("SELECT email FROM users ORDER BY created_at DESC")
        .fetch_all(db)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|row| row.email)
        .collect()
}

/// Get all users with pagination (admin use)
pub async fn get_all(db: &Pool<Postgres>, limit: i64, offset: i64) -> Vec<User> {
    sqlx::query_as!(
        User,
        "SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        limit,
        offset
    )
    .fetch_all(db)
    .await
    .unwrap_or_default()
}
