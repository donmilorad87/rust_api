use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Pool, Postgres};

use crate::app::db_query::{mutations as db_mutations, read as db_read};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteGalleryParams {
    pub gallery_id: i64,
    pub user_id: i64,
    pub client_id: String,
}

pub async fn execute(
    db: &Pool<Postgres>,
    params: &DeleteGalleryParams,
) -> Result<serde_json::Value, String> {
    let client = match db_read::oauth_client::get_by_client_id(db, &params.client_id).await {
        Ok(record) => record,
        Err(sqlx::Error::RowNotFound) => {
            return Ok(json!({
                "status_code": 400,
                "body": {
                    "error": "invalid_client",
                    "error_description": "OAuth client not found"
                }
            }));
        }
        Err(e) => return Err(format!("Failed to fetch OAuth client: {}", e)),
    };

    let has_scope =
        db_read::oauth_scope::client_has_scope_by_name(db, client.id, "galleries.delete")
            .await
            .map_err(|e| format!("Failed to check client scopes: {}", e))?;

    if !has_scope {
        return Ok(json!({
            "status_code": 403,
            "body": {
                "error": "insufficient_scope",
                "error_description": "You do not have scope access for deletion",
                "scope": "galleries.delete"
            }
        }));
    }

    if !db_read::gallery::user_owns_gallery(db, params.gallery_id, params.user_id).await {
        return Ok(json!({
            "status_code": 403,
            "body": {
                "error": "insufficient_permissions",
                "error_description": "You can only delete galleries you own"
            }
        }));
    }

    let rows = db_mutations::gallery::delete(db, params.gallery_id)
        .await
        .map_err(|e| format!("Failed to delete gallery: {}", e))?;

    if rows > 0 {
        Ok(json!({
            "status_code": 200,
            "body": { "message": "Gallery deleted successfully" }
        }))
    } else {
        Ok(json!({
            "status_code": 404,
            "body": {
                "error": "not_found",
                "error_description": "Gallery not found"
            }
        }))
    }
}
