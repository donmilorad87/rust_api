//! Storage Driver Abstraction
//!
//! Provides a unified interface for file storage that can be backed by:
//! - Local filesystem (default)
//! - Amazon S3 (future)
//! - Other cloud providers (future)
//!
//! The driver is selected via STORAGE_DRIVER environment variable.

pub mod local;
pub mod s3;

use async_trait::async_trait;
use std::path::PathBuf;

pub use local::LocalStorageDriver;
pub use s3::S3StorageDriver;

/// Storage visibility type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Visibility {
    Public,
    Private,
}

impl Visibility {
    pub fn as_str(&self) -> &'static str {
        match self {
            Visibility::Public => "public",
            Visibility::Private => "private",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "public" => Some(Visibility::Public),
            "private" => Some(Visibility::Private),
            _ => None,
        }
    }
}

/// Storage driver types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StorageDriverType {
    Local,
    S3,
}

impl StorageDriverType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "local" | "filesystem" | "file" => Some(StorageDriverType::Local),
            "s3" | "aws" | "amazon" => Some(StorageDriverType::S3),
            _ => None,
        }
    }
}

/// Result of a file storage operation
#[derive(Debug, Clone)]
pub struct StoredFile {
    /// Unique identifier (UUID or S3 key)
    pub id: String,
    /// Original filename
    pub original_name: String,
    /// Stored filename (may include path)
    pub stored_name: String,
    /// File extension
    pub extension: String,
    /// MIME type
    pub mime_type: String,
    /// File size in bytes
    pub size_bytes: u64,
    /// Storage visibility
    pub visibility: Visibility,
    /// Internal storage path (filesystem path or S3 key)
    pub storage_path: String,
    /// SHA256 checksum
    pub checksum: String,
    /// Public URL (for public files) or API URL (for private files)
    pub url: String,
}

/// Storage driver error
#[derive(Debug)]
pub enum StorageError {
    FileTooLarge {
        max_size: u64,
        actual_size: u64,
    },
    InvalidExtension {
        extension: String,
        allowed: Vec<String>,
    },
    TooManyFiles {
        max_files: usize,
        actual_files: usize,
    },
    IoError(std::io::Error),
    InvalidFileName,
    NotFound,
    PermissionDenied,
    DriverNotConfigured(String),
    S3Error(String),
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageError::FileTooLarge {
                max_size,
                actual_size,
            } => {
                let max_mb = *max_size as f64 / 1024.0 / 1024.0;
                let actual_mb = *actual_size as f64 / 1024.0 / 1024.0;
                write!(
                    f,
                    "File too large: {:.2} MB (max: {:.2} MB)",
                    actual_mb, max_mb
                )
            }
            StorageError::InvalidExtension { extension, allowed } => {
                write!(
                    f,
                    "Invalid file extension: '{}'. Allowed: {}",
                    extension,
                    allowed.join(", ")
                )
            }
            StorageError::TooManyFiles {
                max_files,
                actual_files,
            } => {
                write!(f, "Too many files: {} (max: {})", actual_files, max_files)
            }
            StorageError::IoError(e) => write!(f, "IO error: {}", e),
            StorageError::InvalidFileName => write!(f, "Invalid file name"),
            StorageError::NotFound => write!(f, "File not found"),
            StorageError::PermissionDenied => write!(f, "Permission denied"),
            StorageError::DriverNotConfigured(msg) => write!(f, "Driver not configured: {}", msg),
            StorageError::S3Error(msg) => write!(f, "S3 error: {}", msg),
        }
    }
}

impl std::error::Error for StorageError {}

impl From<std::io::Error> for StorageError {
    fn from(e: std::io::Error) -> Self {
        StorageError::IoError(e)
    }
}

/// Storage driver trait - implement this for new storage backends
#[async_trait]
pub trait StorageDriver: Send + Sync {
    /// Get the driver type
    fn driver_type(&self) -> StorageDriverType;

    /// Store a file
    async fn put(
        &self,
        data: &[u8],
        filename: &str,
        visibility: Visibility,
    ) -> Result<StoredFile, StorageError>;

    /// Store a file in a subfolder
    async fn put_with_subfolder(
        &self,
        data: &[u8],
        filename: &str,
        visibility: Visibility,
        subfolder: &str,
    ) -> Result<StoredFile, StorageError>;

    /// Get file contents
    async fn get(&self, path: &str) -> Result<Vec<u8>, StorageError>;

    /// Delete a file
    async fn delete(&self, path: &str) -> Result<bool, StorageError>;

    /// Check if file exists
    async fn exists(&self, path: &str) -> Result<bool, StorageError>;

    /// Get file size
    async fn size(&self, path: &str) -> Result<u64, StorageError>;

    /// Get public URL for a file
    fn url(&self, path: &str, visibility: Visibility) -> String;

    /// Get full path for a file (filesystem path or S3 key)
    fn path(&self, path: &str) -> PathBuf;

    /// Initialize the storage (create directories, verify S3 bucket, etc.)
    async fn init(&self) -> Result<(), StorageError>;
}

/// Storage manager - wraps the active driver
pub struct Storage {
    driver: Box<dyn StorageDriver>,
}

impl Storage {
    /// Create a new storage manager with the specified driver
    pub fn new(driver: Box<dyn StorageDriver>) -> Self {
        Self { driver }
    }

    /// Create storage with the configured driver (from .env)
    pub fn from_config() -> Result<Self, StorageError> {
        use crate::config::UploadConfig;

        let driver_type = StorageDriverType::from_str(UploadConfig::storage_driver())
            .unwrap_or(StorageDriverType::Local);

        let driver: Box<dyn StorageDriver> = match driver_type {
            StorageDriverType::Local => Box::new(LocalStorageDriver::from_config()),
            StorageDriverType::S3 => {
                // S3 driver requires additional configuration
                Box::new(S3StorageDriver::from_config()?)
            }
        };

        Ok(Self { driver })
    }

    /// Get the underlying driver type
    pub fn driver_type(&self) -> StorageDriverType {
        self.driver.driver_type()
    }

    /// Store a file
    pub async fn put(
        &self,
        data: &[u8],
        filename: &str,
        visibility: Visibility,
    ) -> Result<StoredFile, StorageError> {
        self.driver.put(data, filename, visibility).await
    }

    /// Store a file in a subfolder
    pub async fn put_with_subfolder(
        &self,
        data: &[u8],
        filename: &str,
        visibility: Visibility,
        subfolder: &str,
    ) -> Result<StoredFile, StorageError> {
        self.driver
            .put_with_subfolder(data, filename, visibility, subfolder)
            .await
    }

    /// Get file contents
    pub async fn get(&self, path: &str) -> Result<Vec<u8>, StorageError> {
        self.driver.get(path).await
    }

    /// Delete a file
    pub async fn delete(&self, path: &str) -> Result<bool, StorageError> {
        self.driver.delete(path).await
    }

    /// Check if file exists
    pub async fn exists(&self, path: &str) -> Result<bool, StorageError> {
        self.driver.exists(path).await
    }

    /// Get file size
    pub async fn size(&self, path: &str) -> Result<u64, StorageError> {
        self.driver.size(path).await
    }

    /// Get public URL for a file
    pub fn url(&self, path: &str, visibility: Visibility) -> String {
        self.driver.url(path, visibility)
    }

    /// Get full path for a file
    pub fn path(&self, path: &str) -> PathBuf {
        self.driver.path(path)
    }

    /// Initialize the storage
    pub async fn init(&self) -> Result<(), StorageError> {
        self.driver.init().await
    }
}

/// Global storage instance
use once_cell::sync::OnceCell;
use std::sync::Arc;

/// Shared storage type for use across the application
pub type SharedStorage = Arc<Storage>;

static STORAGE: OnceCell<SharedStorage> = OnceCell::new();

/// Initialize the global storage instance
pub async fn init() -> Result<(), StorageError> {
    let storage = Storage::from_config()?;
    storage.init().await?;

    STORAGE.set(Arc::new(storage)).map_err(|_| {
        StorageError::DriverNotConfigured("Storage already initialized".to_string())
    })?;

    tracing::info!("Storage initialized");
    Ok(())
}

/// Get the global storage instance
pub fn get_storage() -> Result<&'static SharedStorage, StorageError> {
    STORAGE.get().ok_or_else(|| {
        StorageError::DriverNotConfigured("Storage not initialized. Call init() first.".to_string())
    })
}
