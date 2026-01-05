use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use tracing::info;

use crate::app::db_query::mutations::user as db_user_mutations;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteUserParams {
    pub user_id: i64,
}

pub async fn execute(db: &Pool<Postgres>, params: &DeleteUserParams) -> Result<bool, String> {
    info!("Executing delete_user job for user_id: {}", params.user_id);

    match db_user_mutations::delete(db, params.user_id).await {
        Ok(true) => Ok(true),
        Ok(false) => Err("User not found".to_string()),
        Err(e) => Err(format!("Failed to delete user: {}", e)),
    }
}
