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

/// Create user with additional flags (for admin-created users)
pub struct CreateUserAdminParams {
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
    pub user_must_set_password: i16,
    pub activated: i16,
}

pub async fn create_admin(db: &Pool<Postgres>, params: &CreateUserAdminParams) -> Result<i64, sqlx::Error> {
    let hashed_password = bcrypt::hash(&params.password, bcrypt::DEFAULT_COST).unwrap();

    let result = sqlx::query!(
        r#"INSERT INTO users (email, password, first_name, last_name, user_must_set_password, activated)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id"#,
        &params.email,
        &hashed_password,
        &params.first_name,
        &params.last_name,
        params.user_must_set_password,
        params.activated
    )
    .fetch_one(db)
    .await?;

    Ok(result.id)
}

/// Full update - all fields required (PATCH)
/// Email is NOT updatable
pub struct UpdateUserFullParams {
    pub first_name: String,
    pub last_name: String,
    pub balance: Option<i64>,
    pub password: Option<String>,
}

pub async fn update_full(db: &Pool<Postgres>, user_id: i64, params: &UpdateUserFullParams) -> Result<(), sqlx::Error> {
    // Update first_name and last_name
    sqlx::query!(
        "UPDATE users SET first_name = $1, last_name = $2, updated_at = NOW() WHERE id = $3",
        &params.first_name,
        &params.last_name,
        user_id
    )
    .execute(db)
    .await?;

    // Update balance if provided
    if let Some(balance) = params.balance {
        sqlx::query!(
            "UPDATE users SET balance = $1, updated_at = NOW() WHERE id = $2",
            balance,
            user_id
        )
        .execute(db)
        .await?;
    }

    // Update password if provided (hash it first)
    if let Some(ref password) = params.password {
        let hashed_password = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
        sqlx::query!(
            "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
            &hashed_password,
            user_id
        )
        .execute(db)
        .await?;
    }

    Ok(())
}

/// Partial update - at least one field required (PUT)
/// Email is NOT updatable
pub struct UpdateUserPartialParams {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub balance: Option<i64>,
    pub password: Option<String>,
}

pub async fn update_partial(db: &Pool<Postgres>, user_id: i64, params: &UpdateUserPartialParams) -> Result<(), sqlx::Error> {
    // Update each field individually if present
    // (SQLx requires compile-time checked queries, so we can't build dynamic SQL)
    if let Some(ref first_name) = params.first_name {
        sqlx::query!("UPDATE users SET first_name = $1, updated_at = NOW() WHERE id = $2", first_name, user_id)
            .execute(db)
            .await?;
    }
    if let Some(ref last_name) = params.last_name {
        sqlx::query!("UPDATE users SET last_name = $1, updated_at = NOW() WHERE id = $2", last_name, user_id)
            .execute(db)
            .await?;
    }
    if let Some(balance) = params.balance {
        sqlx::query!("UPDATE users SET balance = $1, updated_at = NOW() WHERE id = $2", balance, user_id)
            .execute(db)
            .await?;
    }
    if let Some(ref password) = params.password {
        let hashed_password = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
        sqlx::query!("UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2", &hashed_password, user_id)
            .execute(db)
            .await?;
    }

    Ok(())
}

/// Update user password (for password reset flows)
pub async fn update_password(db: &Pool<Postgres>, user_id: i64, password: &str) -> Result<(), sqlx::Error> {
    let hashed_password = bcrypt::hash(password, bcrypt::DEFAULT_COST).unwrap();
    sqlx::query!(
        "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
        &hashed_password,
        user_id
    )
    .execute(db)
    .await?;
    Ok(())
}

/// Set user activated flag
pub async fn set_activated(db: &Pool<Postgres>, user_id: i64, activated: i16) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE users SET activated = $1, updated_at = NOW() WHERE id = $2",
        activated,
        user_id
    )
    .execute(db)
    .await?;
    Ok(())
}

/// Set user_must_set_password flag
pub async fn set_user_must_set_password(db: &Pool<Postgres>, user_id: i64, value: i16) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE users SET user_must_set_password = $1, updated_at = NOW() WHERE id = $2",
        value,
        user_id
    )
    .execute(db)
    .await?;
    Ok(())
}

/// Activate user and clear user_must_set_password (for admin-created user password setup)
pub async fn activate_and_clear_must_set_password(db: &Pool<Postgres>, user_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE users SET activated = 1, user_must_set_password = 0, updated_at = NOW() WHERE id = $1",
        user_id
    )
    .execute(db)
    .await?;
    Ok(())
}

/// Delete user
pub async fn delete(db: &Pool<Postgres>, user_id: i64) -> Result<bool, sqlx::Error> {
    let result = sqlx::query!("DELETE FROM users WHERE id = $1", user_id)
        .execute(db)
        .await?;
    Ok(result.rows_affected() > 0)
}
