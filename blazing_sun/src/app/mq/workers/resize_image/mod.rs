use crate::app::db_query::mutations::image_variant::{self, CreateImageVariantParams};
use crate::app::mq::jobs::resize_image::ResizeImageParams;
use crate::bootstrap::includes::image::{generate_variants, is_supported_image};
use crate::mq::{JobResult, MessageQueue, QueuedJob};
use crate::state;
use std::path::Path;
use tracing::{error, info, warn};

/// Process a resize_image job
pub async fn process(
    _mq: &MessageQueue,
    job: &QueuedJob,
) -> Result<JobResult<()>, Box<dyn std::error::Error + Send + Sync>> {
    info!("Processing resize_image job: {}", job.id);

    // Deserialize the payload
    let params: ResizeImageParams = match serde_json::from_str(&job.payload) {
        Ok(p) => p,
        Err(e) => {
            error!("Failed to deserialize resize_image payload: {}", e);
            return Ok(JobResult::Failed(format!("Invalid payload: {}", e)));
        }
    };

    // Validate that this is a supported image format
    if !is_supported_image(&params.extension) {
        warn!(
            "Unsupported image format for resize_image job {}: {}",
            job.id, params.extension
        );
        return Ok(JobResult::Failed(format!(
            "Unsupported image format: {}",
            params.extension
        )));
    }

    // Get database connection
    let app_state = state().await;
    let db = app_state.db.lock().await;

    // Extract directory and base filename from stored_name
    // Format: "20251224_123456_uuid.jpg"
    // Base filename without extension: "20251224_123456_uuid"
    let source_path = Path::new(&params.file_path);
    let output_dir = source_path.parent().ok_or("Invalid file path")?;

    // Remove extension from stored_name to get base filename
    let base_filename = params
        .stored_name
        .trim_end_matches(&format!(".{}", params.extension));

    // Generate all responsive variants
    info!(
        "Generating responsive variants for upload_id={}, stored_name={}, file_path={}, output_dir={:?}",
        params.upload_id, params.stored_name, params.file_path, output_dir
    );

    match generate_variants(source_path, output_dir, base_filename, &params.extension).await {
        Ok(variants) => {
            info!(
                "Generated {} variants for upload_id={}",
                variants.len(),
                params.upload_id
            );

            // Store variant metadata in database
            let mut variant_params = Vec::new();
            for variant in &variants {
                // Extract just the filename from the full path
                let stored_name = variant
                    .path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&variant.variant_name);

                // Storage path relative to storage root
                let storage_path = format!(
                    "{}/{}",
                    params.storage_type,
                    stored_name
                );

                variant_params.push(CreateImageVariantParams {
                    upload_id: params.upload_id,
                    variant_name: variant.variant_name.clone(),
                    stored_name: stored_name.to_string(),
                    width: variant.width as i32,
                    height: variant.height as i32,
                    size_bytes: variant.size_bytes as i64,
                    storage_path,
                });
            }

            // Batch create all variants in database
            match image_variant::create_batch(&db, variant_params).await {
                Ok(ids) => {
                    info!(
                        "Stored {} variant records in database for upload_id={}",
                        ids.len(),
                        params.upload_id
                    );

                    // Delete the original file since we now have all variants including _full
                    if let Err(e) = std::fs::remove_file(source_path) {
                        warn!(
                            "Failed to delete original file {} after variant generation: {}",
                            params.file_path, e
                        );
                    } else {
                        info!(
                            "Deleted original file {} after successful variant generation",
                            params.file_path
                        );
                    }

                    Ok(JobResult::Success(()))
                }
                Err(e) => {
                    error!(
                        "Failed to store variant records in database for upload_id={}: {}",
                        params.upload_id, e
                    );
                    // Database error - this is retryable
                    Ok(JobResult::Retry(format!("Database error: {}", e)))
                }
            }
        }
        Err(e) => {
            error!(
                "Failed to generate variants for upload_id={}: {}",
                params.upload_id, e
            );
            // Image processing error - usually not retryable
            Ok(JobResult::Failed(format!("Image processing error: {}", e)))
        }
    }
}
