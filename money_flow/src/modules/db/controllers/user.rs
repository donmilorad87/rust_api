use crate::modules::routes::controllers::auth::SignInRequest;
use crate::modules::routes::controllers::auth::SignupRequest;
use chrono::{DateTime, Utc};
use sqlx::{Pool, Postgres};

pub async fn has_with_email(db: &Pool<Postgres>, email: &str) -> bool {
    sqlx::query!("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email)
        .fetch_one(db)
        .await
        .unwrap()
        .exists
        .unwrap_or(false)
}

pub async fn create(db: &Pool<Postgres>, user: &SignupRequest) -> bool {
    let hashed_password = bcrypt::hash(&user.password, bcrypt::DEFAULT_COST).unwrap();

    sqlx::query!(
        "INSERT INTO users (email, password, first_name, last_name) VALUES ($1, $2, $3, $4)",
        &user.email,
        &hashed_password,
        &user.first_name,
        &user.last_name
    )
    .execute(db)
    .await
    .is_ok()
}

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

pub async fn sign_in(db: &Pool<Postgres>, user: &SignInRequest) -> Result<User, sqlx::Error> {
    let record = sqlx::query_as!(User, "SELECT * FROM users WHERE email = $1", &user.email)
        .fetch_one(db)
        .await?;

    Ok(record)
}
