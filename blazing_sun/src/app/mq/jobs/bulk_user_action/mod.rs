use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use tracing::info;

use crate::app::db_query::mutations::user as db_user_mutations;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkUserActionParams {
    pub action: String,
    pub user_ids: Vec<i64>,
    pub permissions: Option<i16>,
}

pub async fn execute(db: &Pool<Postgres>, params: &BulkUserActionParams) -> Result<bool, String> {
    info!(
        "Executing bulk user action '{}' for {} user(s)",
        params.action,
        params.user_ids.len()
    );

    if params.user_ids.is_empty() {
        return Err("No users selected".to_string());
    }

    match params.action.as_str() {
        "delete" => {
            for user_id in &params.user_ids {
                let deleted = db_user_mutations::delete(db, *user_id)
                    .await
                    .map_err(|e| format!("Failed to delete user {}: {}", user_id, e))?;
                if !deleted {
                    return Err(format!("User {} not found", user_id));
                }
            }
            Ok(true)
        }
        "set_permissions" => {
            let permissions = params
                .permissions
                .ok_or_else(|| "Missing permissions value".to_string())?;
            for user_id in &params.user_ids {
                db_user_mutations::update_permissions(db, *user_id, permissions)
                    .await
                    .map_err(|e| format!("Failed to update permissions for {}: {}", user_id, e))?;
            }
            Ok(true)
        }
        _ => Err("Invalid bulk action".to_string()),
    }
}
