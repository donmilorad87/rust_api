use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use tracing::info;
use uuid::Uuid;

use crate::app::db_query::mutations::image_variant as image_variant_mutations;
use crate::app::db_query::mutations::site_config as site_config_mutations;
use crate::app::db_query::mutations::upload as db_upload_mutations;
use crate::app::db_query::read::image_variant;
use crate::app::db_query::read::site_config as site_config_read;
use crate::app::db_query::read::upload as db_upload_read;
use crate::bootstrap::includes::controllers::uploads;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteUploadParams {
    pub upload_uuid: String,
}

pub async fn execute(db: &Pool<Postgres>, params: &DeleteUploadParams) -> Result<bool, String> {
    let uuid = Uuid::parse_str(&params.upload_uuid)
        .map_err(|_| "Invalid UUID format".to_string())?;

    let upload = db_upload_read::get_by_uuid(db, &uuid)
        .await
        .map_err(|_| "File not found".to_string())?;

    info!("Executing delete_upload job for uuid {}", uuid);

    if let Ok(site_config) = site_config_read::get(db).await {
        if site_config.logo_uuid == Some(uuid) {
            if let Err(e) = site_config_mutations::update_logo(db, None).await {
                tracing::warn!("Failed to clear logo reference: {}", e);
            }
        }

        if site_config.favicon_uuid == Some(uuid) {
            if let Err(e) = site_config_mutations::update_favicon(db, None).await {
                tracing::warn!("Failed to clear favicon reference: {}", e);
            }
        }
    }

    if let Err(e) = uploads::delete_file(&upload.storage_path).await {
        tracing::warn!("Failed to delete file from storage: {}", e);
    }

    if let Ok(variants) = image_variant::get_by_upload_id(db, upload.id).await {
        for variant in variants {
            if let Err(e) = uploads::delete_file(&variant.storage_path).await {
                tracing::warn!(
                    "Failed to delete variant file {} from storage: {}",
                    variant.storage_path,
                    e
                );
            }
        }

        if let Err(e) = image_variant_mutations::delete_by_upload_id(db, upload.id).await {
            tracing::warn!("Failed to delete variant records: {}", e);
        }
    }

    db_upload_mutations::delete_by_uuid(db, &uuid)
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(true)
}
