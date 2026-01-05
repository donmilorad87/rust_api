use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use tracing::info;

use crate::app::db_query::mutations::picture as db_picture_mutations;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkDeletePicturesParams {
    pub gallery_id: i64,
    pub picture_ids: Vec<i64>,
}

pub async fn execute(
    db: &Pool<Postgres>,
    params: &BulkDeletePicturesParams,
) -> Result<u64, String> {
    info!(
        "Executing bulk delete for gallery {} ({} picture(s))",
        params.gallery_id,
        params.picture_ids.len()
    );

    if params.picture_ids.is_empty() {
        return Err("No pictures selected".to_string());
    }

    db_picture_mutations::remove_from_gallery_bulk(db, params.gallery_id, &params.picture_ids)
        .await
        .map_err(|e| format!("Failed to delete pictures: {}", e))
}
