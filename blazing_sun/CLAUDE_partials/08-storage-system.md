# Storage System

## Storage Driver Architecture

```rust
// bootstrap/includes/storage/mod.rs
#[async_trait]
pub trait StorageDriver: Send + Sync {
    fn driver_type(&self) -> StorageDriverType;
    async fn put(&self, data: &[u8], filename: &str, visibility: Visibility) -> Result<StoredFile, StorageError>;
    async fn get(&self, path: &str) -> Result<Vec<u8>, StorageError>;
    async fn delete(&self, path: &str) -> Result<bool, StorageError>;
    async fn exists(&self, path: &str) -> Result<bool, StorageError>;
    async fn size(&self, path: &str) -> Result<u64, StorageError>;
    fn url(&self, path: &str, visibility: Visibility) -> String;
    fn path(&self, path: &str) -> PathBuf;
    async fn init(&self) -> Result<(), StorageError>;
}

pub enum Visibility {
    Public,   // Served by nginx at /storage/
    Private,  // Served by API with auth
}

pub enum StorageDriverType {
    Local,
    S3,
}
```

## Using Storage

```rust
use crate::bootstrap::includes::storage::{get_storage, Visibility};

// Get global storage instance
let storage = get_storage()?;

// Store a file
let stored = storage.put(data, "filename.jpg", Visibility::Public).await?;

// Get file contents
let contents = storage.get(&stored.storage_path).await?;

// Check existence
let exists = storage.exists(&stored.storage_path).await?;

// Delete file
storage.delete(&stored.storage_path).await?;
```

## Template Helper Functions

```rust
use crate::bootstrap::utility::template::{assets, asset, private_asset};

// Public file URL: /storage/filename.jpg
let url = assets("filename.jpg", "public");
let url = asset("filename.jpg");  // shorthand

// Private file URL: /api/v1/upload/private/uuid
let url = assets("uuid", "private");
let url = private_asset("uuid");  // shorthand
```
