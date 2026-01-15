use crate::database::mutations::user::{self, CreateUserParams as DbCreateUserParams};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use tracing::info;

/// Parameters for create_user job (serializable for queue)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUserParams {
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
}

impl From<&CreateUserParams> for DbCreateUserParams {
    fn from(params: &CreateUserParams) -> Self {
        DbCreateUserParams {
            email: params.email.clone(),
            password: params.password.clone(),
            first_name: params.first_name.clone(),
            last_name: params.last_name.clone(),
        }
    }
}

/// Execute the create_user job
pub async fn execute(db: &Pool<Postgres>, params: &CreateUserParams) -> Result<bool, String> {
    info!("Executing create_user job for email: {}", params.email);

    let db_params: DbCreateUserParams = params.into();

    if user::create(db, &db_params).await {
        info!("User {} created successfully", params.email);
        Ok(true)
    } else {
        Err("Failed to create user".to_string())
    }
}
