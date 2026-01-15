use serde::{Deserialize, Serialize};

/// Parameters for resize_image job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResizeImageParams {
    /// Upload ID (database primary key)
    pub upload_id: i64,
    /// UUID of the upload
    pub upload_uuid: String,
    /// Original stored filename
    pub stored_name: String,
    /// File extension (jpg, png, webp, avif)
    pub extension: String,
    /// Storage type (public/private)
    pub storage_type: String,
    /// Full path to the uploaded file
    pub file_path: String,
}

impl ResizeImageParams {
    pub fn new(
        upload_id: i64,
        upload_uuid: &str,
        stored_name: &str,
        extension: &str,
        storage_type: &str,
        file_path: &str,
    ) -> Self {
        Self {
            upload_id,
            upload_uuid: upload_uuid.to_string(),
            stored_name: stored_name.to_string(),
            extension: extension.to_string(),
            storage_type: storage_type.to_string(),
            file_path: file_path.to_string(),
        }
    }
}
