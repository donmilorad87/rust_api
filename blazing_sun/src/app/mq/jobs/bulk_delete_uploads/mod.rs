use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use tracing::{info, warn};

use crate::app::mq::jobs::delete_upload::{self, DeleteUploadParams};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkDeleteUploadsParams {
    pub upload_uuids: Vec<String>,
}

pub async fn execute(db: &Pool<Postgres>, params: &BulkDeleteUploadsParams) -> Result<u64, String> {
    info!(
        "Executing bulk delete for {} upload(s)",
        params.upload_uuids.len()
    );

    if params.upload_uuids.is_empty() {
        return Err("No uploads selected".to_string());
    }

    let mut deleted_count = 0u64;
    let mut missing_count = 0u64;

    for upload_uuid in &params.upload_uuids {
        let delete_params = DeleteUploadParams {
            upload_uuid: upload_uuid.to_string(),
        };

        match delete_upload::execute(db, &delete_params).await {
            Ok(true) => {
                deleted_count += 1;
            }
            Ok(false) => {
                missing_count += 1;
            }
            Err(e) => {
                if e == "File not found" {
                    missing_count += 1;
                    continue;
                }
                return Err(e);
            }
        }
    }

    if missing_count > 0 {
        warn!(
            "Bulk delete completed with {} missing upload(s)",
            missing_count
        );
    }

    Ok(deleted_count)
}
