use once_cell::sync::Lazy;

pub struct UploadConfig {
    pub max_file_size: u64,
    pub max_files_per_upload: usize,
    pub allowed_types: Vec<String>,
    pub storage_path: String,
    pub storage_driver: String,
    pub public_url_base: String,
    pub private_url_base: String,
}

pub static UPLOAD: Lazy<UploadConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    let allowed_types_str = std::env::var("UPLOAD_ALLOWED_TYPES")
        .unwrap_or_else(|_| "jpg,jpeg,png,gif,webp,svg,ico,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip,rar,7z,tar,gz".to_string());

    let allowed_types: Vec<String> = allowed_types_str
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    UploadConfig {
        max_file_size: std::env::var("UPLOAD_MAX_FILE_SIZE")
            .unwrap_or_else(|_| "104857600".to_string()) // 100MB default
            .parse()
            .expect("UPLOAD_MAX_FILE_SIZE must be a valid number"),
        max_files_per_upload: std::env::var("UPLOAD_MAX_FILES")
            .unwrap_or_else(|_| "10".to_string())
            .parse()
            .expect("UPLOAD_MAX_FILES must be a valid number"),
        allowed_types,
        storage_path: std::env::var("UPLOAD_STORAGE_PATH")
            .unwrap_or_else(|_| "storage/app".to_string()),
        storage_driver: std::env::var("STORAGE_DRIVER")
            .unwrap_or_else(|_| "local".to_string()),
        public_url_base: std::env::var("STORAGE_PUBLIC_URL")
            .unwrap_or_else(|_| "/storage".to_string()),
        private_url_base: std::env::var("STORAGE_PRIVATE_URL")
            .unwrap_or_else(|_| "/api/v1/upload/private".to_string()),
    }
});

impl UploadConfig {
    /// Maximum file size in bytes
    pub fn max_file_size() -> u64 {
        UPLOAD.max_file_size
    }

    /// Maximum number of files per multiple upload request
    pub fn max_files_per_upload() -> usize {
        UPLOAD.max_files_per_upload
    }

    /// List of allowed file extensions
    pub fn allowed_types() -> &'static Vec<String> {
        &UPLOAD.allowed_types
    }

    /// Base storage path (local filesystem)
    pub fn storage_path() -> &'static str {
        &UPLOAD.storage_path
    }

    /// Storage driver type (local, s3)
    pub fn storage_driver() -> &'static str {
        &UPLOAD.storage_driver
    }

    /// Public URL base for accessing public files (e.g., /storage)
    pub fn public_url_base() -> &'static str {
        &UPLOAD.public_url_base
    }

    /// Private URL base for accessing private files via API
    pub fn private_url_base() -> &'static str {
        &UPLOAD.private_url_base
    }

    /// Check if a file extension is allowed
    pub fn is_type_allowed(extension: &str) -> bool {
        UPLOAD.allowed_types.iter().any(|t| t.eq_ignore_ascii_case(extension))
    }
}
