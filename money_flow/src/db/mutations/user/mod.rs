use sqlx::{Pool, Postgres};

pub struct CreateUserParams {
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
}

pub async fn create(db: &Pool<Postgres>, params: &CreateUserParams) -> bool {
    let hashed_password = bcrypt::hash(&params.password, bcrypt::DEFAULT_COST).unwrap();

    sqlx::query!(
        "INSERT INTO users (email, password, first_name, last_name) VALUES ($1, $2, $3, $4)",
        &params.email,
        &hashed_password,
        &params.first_name,
        &params.last_name
    )
    .execute(db)
    .await
    .is_ok()
}
