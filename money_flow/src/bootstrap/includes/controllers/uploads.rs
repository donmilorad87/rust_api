//! Upload Helper
//!
//! Provides file upload utilities for handling public and private file storage.
//! Supports single file uploads, multiple file uploads, and resumable (chunked) uploads.
//! Configuration is loaded from environment variables via config/upload.rs

use crate::config::UploadConfig;
use once_cell::sync::Lazy;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tracing::info;
use uuid::Uuid;

/// Storage configuration (loaded from .env)
pub struct StorageConfig {
    pub base_path: PathBuf,
    pub public_path: PathBuf,
    pub private_path: PathBuf,
}

/// Global storage configuration
pub static STORAGE_CONFIG: Lazy<StorageConfig> = Lazy::new(|| {
    let base_path = PathBuf::from(UploadConfig::storage_path());
    StorageConfig {
        public_path: base_path.join("public"),
        private_path: base_path.join("private"),
        base_path,
    }
});

/// Storage type for uploaded files
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageType {
    Public,
    Private,
}

impl StorageType {
    pub fn as_str(&self) -> &'static str {
        match self {
            StorageType::Public => "public",
            StorageType::Private => "private",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "public" => Some(StorageType::Public),
            "private" => Some(StorageType::Private),
            _ => None,
        }
    }
}

/// Result of a successful file upload
#[derive(Debug, Clone)]
pub struct UploadResult {
    pub uuid: Uuid,
    pub original_name: String,
    pub stored_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub storage_type: StorageType,
    pub storage_path: String,
    pub checksum: String,
}

/// Upload error types
#[derive(Debug)]
pub enum UploadError {
    FileTooLarge { max_size: u64, actual_size: u64 },
    InvalidExtension { extension: String, allowed: Vec<String> },
    TooManyFiles { max_files: usize, actual_files: usize },
    IoError(std::io::Error),
    InvalidFileName,
    StoragePathError,
}

impl std::fmt::Display for UploadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UploadError::FileTooLarge { max_size, actual_size } => {
                let max_mb = *max_size as f64 / 1024.0 / 1024.0;
                let actual_mb = *actual_size as f64 / 1024.0 / 1024.0;
                write!(
                    f,
                    "File too large: {:.2} MB (max: {:.2} MB)",
                    actual_mb, max_mb
                )
            }
            UploadError::InvalidExtension { extension, allowed } => {
                write!(
                    f,
                    "Invalid file extension: '{}'. Allowed types: {}",
                    extension,
                    allowed.join(", ")
                )
            }
            UploadError::TooManyFiles { max_files, actual_files } => {
                write!(
                    f,
                    "Too many files: {} (max: {})",
                    actual_files, max_files
                )
            }
            UploadError::IoError(e) => write!(f, "IO error: {}", e),
            UploadError::InvalidFileName => write!(f, "Invalid file name"),
            UploadError::StoragePathError => write!(f, "Failed to create storage path"),
        }
    }
}

impl std::error::Error for UploadError {}

impl From<std::io::Error> for UploadError {
    fn from(e: std::io::Error) -> Self {
        UploadError::IoError(e)
    }
}

/// Get max file size from config
pub fn max_file_size() -> u64 {
    UploadConfig::max_file_size()
}

/// Get max files per upload from config
pub fn max_files_per_upload() -> usize {
    UploadConfig::max_files_per_upload()
}

/// Get allowed types from config
pub fn allowed_types() -> &'static Vec<String> {
    UploadConfig::allowed_types()
}

/// Initialize storage directories
pub async fn init_storage() -> Result<(), UploadError> {
    let config = &*STORAGE_CONFIG;

    // Create base directory
    fs::create_dir_all(&config.base_path).await?;

    // Create public and private directories
    fs::create_dir_all(&config.public_path).await?;
    fs::create_dir_all(&config.private_path).await?;

    info!(
        "Storage directories initialized: public={}, private={}",
        config.public_path.display(),
        config.private_path.display()
    );

    Ok(())
}

/// Get the storage path for a given storage type
pub fn get_storage_path(storage_type: StorageType) -> &'static Path {
    let config = &*STORAGE_CONFIG;
    match storage_type {
        StorageType::Public => config.public_path.as_path(),
        StorageType::Private => config.private_path.as_path(),
    }
}

/// Generate a unique filename for storage
pub fn generate_stored_name(extension: &str) -> String {
    let uuid = Uuid::new_v4();
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    format!("{}_{}.{}", timestamp, uuid, extension)
}

/// Extract file extension from filename
pub fn get_extension(filename: &str) -> Option<String> {
    Path::new(filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
}

/// Validate file extension against config
pub fn validate_extension(extension: &str) -> bool {
    UploadConfig::is_type_allowed(extension)
}

/// Calculate SHA256 checksum of data
pub fn calculate_checksum(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Validate file count for multiple uploads
pub fn validate_file_count(count: usize) -> Result<(), UploadError> {
    let max = max_files_per_upload();
    if count > max {
        return Err(UploadError::TooManyFiles {
            max_files: max,
            actual_files: count,
        });
    }
    Ok(())
}

/// Save file data to storage
pub async fn save_file(
    data: &[u8],
    original_name: &str,
    storage_type: StorageType,
    custom_max_size: Option<u64>,
) -> Result<UploadResult, UploadError> {
    let max_size = custom_max_size.unwrap_or_else(max_file_size);

    // Check file size
    let size_bytes = data.len() as u64;
    if size_bytes > max_size {
        return Err(UploadError::FileTooLarge {
            max_size,
            actual_size: size_bytes,
        });
    }

    // Get and validate extension
    let extension = get_extension(original_name).ok_or(UploadError::InvalidFileName)?;

    if !validate_extension(&extension) {
        return Err(UploadError::InvalidExtension {
            extension: extension.clone(),
            allowed: allowed_types().clone(),
        });
    }

    // Generate stored filename
    let uuid = Uuid::new_v4();
    let stored_name = generate_stored_name(&extension);

    // Get storage path
    let storage_path = get_storage_path(storage_type);
    let file_path = storage_path.join(&stored_name);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).await?;
    }

    // Write file
    let mut file = fs::File::create(&file_path).await?;
    file.write_all(data).await?;
    file.flush().await?;

    // Calculate checksum
    let checksum = calculate_checksum(data);

    // Guess MIME type
    let mime_type = mime_guess::from_path(original_name)
        .first_or_octet_stream()
        .to_string();

    // Build relative storage path
    let relative_path = format!("{}/{}", storage_type.as_str(), stored_name);

    info!(
        "File saved: {} -> {} ({} bytes, {})",
        original_name, relative_path, size_bytes, mime_type
    );

    Ok(UploadResult {
        uuid,
        original_name: original_name.to_string(),
        stored_name,
        extension,
        mime_type,
        size_bytes,
        storage_type,
        storage_path: relative_path,
        checksum,
    })
}

/// Delete a file from storage
pub async fn delete_file(storage_path: &str) -> Result<bool, UploadError> {
    let config = &*STORAGE_CONFIG;
    let full_path = config.base_path.join(storage_path);

    if full_path.exists() {
        fs::remove_file(&full_path).await?;
        info!("File deleted: {}", storage_path);
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Get full file path from storage path
pub fn get_full_path(storage_path: &str) -> PathBuf {
    let config = &*STORAGE_CONFIG;
    config.base_path.join(storage_path)
}

/// Read file from storage
pub async fn read_file(storage_path: &str) -> Result<Vec<u8>, UploadError> {
    let full_path = get_full_path(storage_path);
    let data = fs::read(&full_path).await?;
    Ok(data)
}

/// Check if file exists
pub async fn file_exists(storage_path: &str) -> bool {
    let full_path = get_full_path(storage_path);
    full_path.exists()
}

/// Get file size
pub async fn get_file_size(storage_path: &str) -> Result<u64, UploadError> {
    let full_path = get_full_path(storage_path);
    let metadata = fs::metadata(&full_path).await?;
    Ok(metadata.len())
}

/// Chunked upload support
pub mod chunked {
    use super::*;
    use std::collections::HashMap;
    use tokio::sync::RwLock;

    /// Chunked upload session
    #[derive(Debug)]
    pub struct ChunkedUploadSession {
        pub uuid: Uuid,
        pub original_name: String,
        pub total_chunks: u32,
        pub received_chunks: HashMap<u32, Vec<u8>>,
        pub storage_type: StorageType,
        pub total_size: u64,
    }

    /// Global storage for chunked upload sessions
    static CHUNKED_SESSIONS: Lazy<RwLock<HashMap<Uuid, ChunkedUploadSession>>> =
        Lazy::new(|| RwLock::new(HashMap::new()));

    /// Start a new chunked upload session
    pub async fn start_session(
        original_name: &str,
        total_chunks: u32,
        total_size: u64,
        storage_type: StorageType,
    ) -> Result<Uuid, UploadError> {
        // Validate total size against config
        let max_size = max_file_size();
        if total_size > max_size {
            return Err(UploadError::FileTooLarge {
                max_size,
                actual_size: total_size,
            });
        }

        // Validate extension
        let extension = get_extension(original_name).ok_or(UploadError::InvalidFileName)?;
        if !validate_extension(&extension) {
            return Err(UploadError::InvalidExtension {
                extension,
                allowed: allowed_types().clone(),
            });
        }

        let uuid = Uuid::new_v4();
        let session = ChunkedUploadSession {
            uuid,
            original_name: original_name.to_string(),
            total_chunks,
            received_chunks: HashMap::new(),
            storage_type,
            total_size,
        };

        let mut sessions = CHUNKED_SESSIONS.write().await;
        sessions.insert(uuid, session);

        info!(
            "Chunked upload session started: {} ({} chunks, {} bytes)",
            uuid, total_chunks, total_size
        );

        Ok(uuid)
    }

    /// Add a chunk to an upload session
    pub async fn add_chunk(session_uuid: &Uuid, chunk_index: u32, data: Vec<u8>) -> Result<bool, String> {
        let mut sessions = CHUNKED_SESSIONS.write().await;

        let session = sessions
            .get_mut(session_uuid)
            .ok_or_else(|| "Session not found".to_string())?;

        if chunk_index >= session.total_chunks {
            return Err("Invalid chunk index".to_string());
        }

        session.received_chunks.insert(chunk_index, data);

        info!(
            "Chunk {} of {} received for session {}",
            chunk_index + 1,
            session.total_chunks,
            session_uuid
        );

        // Check if all chunks received
        Ok(session.received_chunks.len() as u32 == session.total_chunks)
    }

    /// Finalize a chunked upload (combine all chunks)
    pub async fn finalize(session_uuid: &Uuid) -> Result<UploadResult, String> {
        let mut sessions = CHUNKED_SESSIONS.write().await;

        let session = sessions
            .remove(session_uuid)
            .ok_or_else(|| "Session not found".to_string())?;

        if session.received_chunks.len() as u32 != session.total_chunks {
            return Err(format!(
                "Missing chunks: received {} of {}",
                session.received_chunks.len(),
                session.total_chunks
            ));
        }

        // Combine chunks in order
        let mut combined_data = Vec::with_capacity(session.total_size as usize);
        for i in 0..session.total_chunks {
            let chunk = session
                .received_chunks
                .get(&i)
                .ok_or_else(|| format!("Missing chunk {}", i))?;
            combined_data.extend_from_slice(chunk);
        }

        // Save the combined file
        save_file(&combined_data, &session.original_name, session.storage_type, None)
            .await
            .map_err(|e| e.to_string())
    }

    /// Cancel a chunked upload session
    pub async fn cancel(session_uuid: &Uuid) -> bool {
        let mut sessions = CHUNKED_SESSIONS.write().await;
        sessions.remove(session_uuid).is_some()
    }

    /// Get session progress
    pub async fn get_progress(session_uuid: &Uuid) -> Option<(u32, u32)> {
        let sessions = CHUNKED_SESSIONS.read().await;
        sessions
            .get(session_uuid)
            .map(|s| (s.received_chunks.len() as u32, s.total_chunks))
    }
}
