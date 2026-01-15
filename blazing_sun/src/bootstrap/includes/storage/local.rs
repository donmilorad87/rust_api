//! Local Filesystem Storage Driver
//!
//! Stores files on the local filesystem in storage/app/{public,private}

use super::{StorageDriver, StorageDriverType, StorageError, StoredFile, Visibility};
use async_trait::async_trait;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tracing::info;
use uuid::Uuid;

use crate::config::UploadConfig;

/// Local filesystem storage driver
pub struct LocalStorageDriver {
    /// Base storage path (e.g., storage/app)
    base_path: PathBuf,
    /// Public files path
    public_path: PathBuf,
    /// Private files path
    private_path: PathBuf,
    /// Base URL for public files (e.g., /storage)
    public_url_base: String,
    /// API URL base for private files (e.g., /api/v1/upload/private)
    private_url_base: String,
}

impl LocalStorageDriver {
    /// Create a new local storage driver
    pub fn new(
        base_path: impl Into<PathBuf>,
        public_url_base: impl Into<String>,
        private_url_base: impl Into<String>,
    ) -> Self {
        let base = base_path.into();
        Self {
            public_path: base.join("public"),
            private_path: base.join("private"),
            base_path: base,
            public_url_base: public_url_base.into(),
            private_url_base: private_url_base.into(),
        }
    }

    /// Create from config
    pub fn from_config() -> Self {
        Self::new(
            UploadConfig::storage_path(),
            UploadConfig::public_url_base(),
            UploadConfig::private_url_base(),
        )
    }

    /// Get storage path for visibility
    fn visibility_path(&self, visibility: Visibility) -> &Path {
        match visibility {
            Visibility::Public => &self.public_path,
            Visibility::Private => &self.private_path,
        }
    }

    /// Generate a unique filename
    fn generate_filename(extension: &str) -> String {
        let uuid = Uuid::new_v4();
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        format!("{}_{}.{}", timestamp, uuid, extension)
    }

    /// Extract file extension
    fn get_extension(filename: &str) -> Option<String> {
        Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| ext.to_lowercase())
    }

    /// Calculate SHA256 checksum
    fn checksum(data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        hex::encode(hasher.finalize())
    }

    /// Validate file extension
    fn validate_extension(extension: &str) -> Result<(), StorageError> {
        if !UploadConfig::is_type_allowed(extension) {
            return Err(StorageError::InvalidExtension {
                extension: extension.to_string(),
                allowed: UploadConfig::allowed_types().clone(),
            });
        }
        Ok(())
    }

    /// Validate file size
    fn validate_size(size: u64) -> Result<(), StorageError> {
        let max = UploadConfig::max_file_size();
        if size > max {
            return Err(StorageError::FileTooLarge {
                max_size: max,
                actual_size: size,
            });
        }
        Ok(())
    }

    /// Build URL with optional subfolder support
    fn url_with_subfolder(&self, path: &str, visibility: Visibility, subfolder: &str) -> String {
        // Extract just the filename from the path
        let filename = Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(path);

        match visibility {
            // Public files served by nginx at /storage/{subfolder?}/{filename}
            Visibility::Public => {
                if subfolder.is_empty() {
                    format!("{}/{}", self.public_url_base, filename)
                } else {
                    format!("{}/{}/{}", self.public_url_base, subfolder, filename)
                }
            }
            // Private files served by API - subfolder is part of the storage path
            // but the URL uses the UUID from the database
            Visibility::Private => format!("{}/{}", self.private_url_base, filename),
        }
    }
}

#[async_trait]
impl StorageDriver for LocalStorageDriver {
    fn driver_type(&self) -> StorageDriverType {
        StorageDriverType::Local
    }

    async fn put(
        &self,
        data: &[u8],
        filename: &str,
        visibility: Visibility,
    ) -> Result<StoredFile, StorageError> {
        // Delegate to put_with_subfolder with empty subfolder
        self.put_with_subfolder(data, filename, visibility, "")
            .await
    }

    async fn put_with_subfolder(
        &self,
        data: &[u8],
        filename: &str,
        visibility: Visibility,
        subfolder: &str,
    ) -> Result<StoredFile, StorageError> {
        // Validate size
        Self::validate_size(data.len() as u64)?;

        // Get and validate extension
        let extension = Self::get_extension(filename).ok_or(StorageError::InvalidFileName)?;
        Self::validate_extension(&extension)?;

        // Generate unique filename
        let stored_name = Self::generate_filename(&extension);

        // Get storage path - include subfolder if provided
        let base_dir = self.visibility_path(visibility);
        let dir_path = if subfolder.is_empty() {
            base_dir.to_path_buf()
        } else {
            base_dir.join(subfolder)
        };
        let file_path = dir_path.join(&stored_name);

        // Ensure directory exists (including subfolder)
        fs::create_dir_all(&dir_path).await?;

        // Write file
        let mut file = fs::File::create(&file_path).await?;
        file.write_all(data).await?;
        file.flush().await?;

        // Calculate checksum
        let checksum = Self::checksum(data);

        // Guess MIME type
        let mime_type = mime_guess::from_path(filename)
            .first_or_octet_stream()
            .to_string();

        // Build storage path (relative) - include subfolder in path
        let storage_path = if subfolder.is_empty() {
            format!("{}/{}", visibility.as_str(), stored_name)
        } else {
            format!("{}/{}/{}", visibility.as_str(), subfolder, stored_name)
        };

        // Build URL - for subfolder files, include subfolder in URL
        let url = self.url_with_subfolder(&storage_path, visibility, subfolder);

        let uuid = Uuid::new_v4();

        info!(
            "File stored (local): {} -> {} ({} bytes, {})",
            filename,
            storage_path,
            data.len(),
            mime_type
        );

        Ok(StoredFile {
            id: uuid.to_string(),
            original_name: filename.to_string(),
            stored_name,
            extension,
            mime_type,
            size_bytes: data.len() as u64,
            visibility,
            storage_path,
            checksum,
            url,
        })
    }

    async fn get(&self, path: &str) -> Result<Vec<u8>, StorageError> {
        let full_path = self.path(path);
        if !full_path.exists() {
            return Err(StorageError::NotFound);
        }
        let data = fs::read(&full_path).await?;
        Ok(data)
    }

    async fn delete(&self, path: &str) -> Result<bool, StorageError> {
        let full_path = self.path(path);
        if full_path.exists() {
            fs::remove_file(&full_path).await?;
            info!("File deleted (local): {}", path);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn exists(&self, path: &str) -> Result<bool, StorageError> {
        let full_path = self.path(path);
        Ok(full_path.exists())
    }

    async fn size(&self, path: &str) -> Result<u64, StorageError> {
        let full_path = self.path(path);
        if !full_path.exists() {
            return Err(StorageError::NotFound);
        }
        let metadata = fs::metadata(&full_path).await?;
        Ok(metadata.len())
    }

    fn url(&self, path: &str, visibility: Visibility) -> String {
        // Extract just the filename from the path (e.g., "public/file.jpg" -> "file.jpg")
        let filename = Path::new(path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(path);

        match visibility {
            // Public files served by nginx at /storage/{filename}
            Visibility::Public => format!("{}/{}", self.public_url_base, filename),
            // Private files served by API at /api/v1/upload/private/{uuid}
            // For private files, we use the UUID from the database
            Visibility::Private => format!("{}/{}", self.private_url_base, filename),
        }
    }

    fn path(&self, path: &str) -> PathBuf {
        self.base_path.join(path)
    }

    async fn init(&self) -> Result<(), StorageError> {
        // Create directories
        fs::create_dir_all(&self.base_path).await?;
        fs::create_dir_all(&self.public_path).await?;
        fs::create_dir_all(&self.private_path).await?;

        info!(
            "Local storage initialized: public={}, private={}",
            self.public_path.display(),
            self.private_path.display()
        );

        Ok(())
    }
}
