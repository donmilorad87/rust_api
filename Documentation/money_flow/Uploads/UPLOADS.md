# Uploads System Documentation

This document provides comprehensive documentation for the file upload system in the Money Flow application, including storage drivers, visibility levels, and upload operations.

---

## Overview

The upload system provides:
- **Public and private file storage** - Different visibility levels
- **Multiple upload methods** - Single, multiple, and chunked uploads
- **Storage driver abstraction** - Local filesystem with S3-ready interface
- **Profile picture management** - Avatar upload/download with user association
- **Admin management** - View and manage all uploads

---

## Storage Architecture

### Storage Locations

```
money_flow/storage/app/
├── public/                     # Public files (nginx serves at /storage/)
│   └── {timestamp}_{uuid}.{ext}
└── private/                    # Private files (API serves with auth)
    ├── {timestamp}_{uuid}.{ext}
    └── profile-pictures/       # Subfolder for avatars
        └── {timestamp}_{uuid}.{ext}
```

### Visibility Types

| Visibility | Storage Path | Access | Served By |
|------------|--------------|--------|-----------|
| **Public** | `storage/app/public/` | Anyone | Nginx at `/storage/` |
| **Private** | `storage/app/private/` | Authenticated owner | API endpoint |

---

## Storage Driver Abstraction

### File: `bootstrap/includes/storage/mod.rs`

The storage system uses a driver abstraction that allows switching between storage backends:

```rust
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

    /// Get full path for a file
    fn path(&self, path: &str) -> PathBuf;

    /// Initialize the storage
    async fn init(&self) -> Result<(), StorageError>;
}
```

### Available Drivers

| Driver | Type | Description | Status |
|--------|------|-------------|--------|
| `LocalStorageDriver` | `Local` | Filesystem storage | **Active (default)** |
| `S3StorageDriver` | `S3` | Amazon S3 / S3-compatible (MinIO, DigitalOcean Spaces) | **Prepared (placeholder)** |

### Configuration

```env
# .env - Local Storage (Default)
STORAGE_DRIVER=local              # "local" or "s3"
STORAGE_PATH=storage/app          # Base storage path
UPLOAD_MAX_FILE_SIZE=104857600    # 100MB default
UPLOAD_MAX_FILES_PER_UPLOAD=10    # Max files in single request
UPLOAD_ALLOWED_TYPES=jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx

# Public URL base (served by nginx)
UPLOAD_PUBLIC_URL_BASE=/storage

# Private URL base (API endpoint)
UPLOAD_PRIVATE_URL_BASE=/api/v1/upload/private
```

---

## S3 Storage Driver (CDN-Ready)

**File:** `bootstrap/includes/storage/s3.rs`

The S3 driver is prepared for Amazon S3 and S3-compatible services (MinIO, DigitalOcean Spaces, Cloudflare R2, etc.).

### S3 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Money Flow Application                       │
│                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                 │
│  │  Storage Manager │────>│  S3StorageDriver │                 │
│  │  (from_config()) │     │                  │                 │
│  └──────────────────┘     └────────┬─────────┘                 │
│                                    │                            │
└────────────────────────────────────┼────────────────────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      │                             │
                      ▼                             ▼
         ┌───────────────────────┐    ┌───────────────────────┐
         │       AWS S3          │    │   S3-Compatible       │
         │   s3.amazonaws.com    │    │   MinIO / DO Spaces   │
         │                       │    │   custom endpoint     │
         └───────────┬───────────┘    └───────────┬───────────┘
                     │                            │
                     └──────────────┬─────────────┘
                                    │
                                    ▼
                     ┌───────────────────────────┐
                     │        CDN Layer          │
                     │   CloudFront / Cloudflare │
                     │   https://cdn.example.com │
                     └───────────────────────────┘
                                    │
                                    ▼
                          ┌─────────────────┐
                          │     Client      │
                          └─────────────────┘
```

### S3 Configuration

```env
# .env - S3 Storage Configuration
STORAGE_DRIVER=s3

# AWS S3 / S3-compatible Credentials
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1

# S3 Bucket
S3_BUCKET=money-flow-uploads

# S3 Endpoint (optional - for S3-compatible services)
# Leave empty for AWS S3
S3_ENDPOINT=https://minio.example.com        # MinIO
# S3_ENDPOINT=https://nyc3.digitaloceanspaces.com  # DigitalOcean Spaces
# S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com  # Cloudflare R2

# CDN URL (optional - for public file access)
# If set, public files will be served from this URL instead of S3 directly
S3_PUBLIC_URL=https://cdn.example.com
```

### S3Config Structure

```rust
// File: bootstrap/includes/storage/s3.rs

pub struct S3Config {
    /// S3 bucket name
    pub bucket: String,

    /// AWS region (e.g., "us-east-1")
    pub region: String,

    /// Custom S3 endpoint (for MinIO, DigitalOcean Spaces, etc.)
    /// None = use AWS S3 default endpoint
    pub endpoint: Option<String>,

    /// AWS access key ID
    pub access_key_id: String,

    /// AWS secret access key
    pub secret_access_key: String,

    /// Public URL base for CDN (optional)
    /// If set, public files use this URL instead of S3 URL
    pub public_url_base: Option<String>,
}

impl S3Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, StorageError> {
        Ok(Self {
            bucket: std::env::var("S3_BUCKET")
                .map_err(|_| StorageError::DriverNotConfigured("S3_BUCKET not set".to_string()))?,
            region: std::env::var("AWS_REGION")
                .unwrap_or_else(|_| "us-east-1".to_string()),
            endpoint: std::env::var("S3_ENDPOINT").ok(),
            access_key_id: std::env::var("AWS_ACCESS_KEY_ID")
                .map_err(|_| StorageError::DriverNotConfigured("AWS_ACCESS_KEY_ID not set".to_string()))?,
            secret_access_key: std::env::var("AWS_SECRET_ACCESS_KEY")
                .map_err(|_| StorageError::DriverNotConfigured("AWS_SECRET_ACCESS_KEY not set".to_string()))?,
            public_url_base: std::env::var("S3_PUBLIC_URL").ok(),
        })
    }
}
```

### S3 URL Generation

```rust
impl S3StorageDriver {
    /// Get the S3 key (path) for a file
    fn s3_key(&self, filename: &str, visibility: Visibility) -> String {
        format!("{}/{}", visibility.as_str(), filename)
        // Result: "public/20240115_123456_uuid.jpg" or "private/20240115_123456_uuid.jpg"
    }

    /// Get the public URL for a file
    fn public_url(&self, key: &str) -> String {
        // If CDN URL is configured, use it
        if let Some(base) = &self.config.public_url_base {
            format!("{}/{}", base, key)
            // Result: "https://cdn.example.com/public/20240115_123456_uuid.jpg"
        }
        // If custom endpoint (MinIO, DO Spaces), use endpoint URL
        else if let Some(endpoint) = &self.config.endpoint {
            format!("{}/{}/{}", endpoint, self.config.bucket, key)
            // Result: "https://minio.example.com/money-flow-uploads/public/20240115_123456_uuid.jpg"
        }
        // Default: AWS S3 URL
        else {
            format!(
                "https://{}.s3.{}.amazonaws.com/{}",
                self.config.bucket, self.config.region, key
            )
            // Result: "https://money-flow-uploads.s3.us-east-1.amazonaws.com/public/20240115_123456_uuid.jpg"
        }
    }
}
```

### Implementing S3 Driver

To enable S3 support, follow these steps:

#### Step 1: Add Dependencies

```toml
# Cargo.toml
[dependencies]
aws-sdk-s3 = "1.0"
aws-config = "1.0"
```

#### Step 2: Implement put() Operation

```rust
// In s3.rs - put_with_subfolder() implementation

async fn put_with_subfolder(
    &self,
    data: &[u8],
    filename: &str,
    visibility: Visibility,
    subfolder: &str,
) -> Result<StoredFile, StorageError> {
    // 1. Validate file size and extension
    Self::validate_size(data.len() as u64)?;
    let extension = Self::get_extension(filename)?;
    Self::validate_extension(&extension)?;

    // 2. Generate unique filename
    let stored_name = Self::generate_filename(&extension);
    let uuid = Uuid::new_v4();

    // 3. Build S3 key (path)
    let key = if subfolder.is_empty() {
        format!("{}/{}", visibility.as_str(), stored_name)
    } else {
        format!("{}/{}/{}", visibility.as_str(), subfolder, stored_name)
    };

    // 4. Get MIME type
    let mime_type = mime_guess::from_path(filename)
        .first_or_octet_stream()
        .to_string();

    // 5. Calculate checksum
    let checksum = Self::checksum(data);

    // 6. Upload to S3
    let aws_config = aws_config::from_env()
        .region(aws_sdk_s3::config::Region::new(self.config.region.clone()))
        .load()
        .await;

    let mut client_builder = aws_sdk_s3::Client::from_conf(
        aws_sdk_s3::Config::builder()
            .region(aws_sdk_s3::config::Region::new(self.config.region.clone()))
            .credentials_provider(
                aws_sdk_s3::config::Credentials::new(
                    &self.config.access_key_id,
                    &self.config.secret_access_key,
                    None, None, "s3"
                )
            )
            .build()
    );

    // Use custom endpoint if configured (MinIO, DO Spaces, etc.)
    if let Some(endpoint) = &self.config.endpoint {
        client_builder = client_builder.endpoint_url(endpoint);
    }

    let client = client_builder.build();

    // 7. Set ACL based on visibility
    let acl = match visibility {
        Visibility::Public => aws_sdk_s3::types::ObjectCannedAcl::PublicRead,
        Visibility::Private => aws_sdk_s3::types::ObjectCannedAcl::Private,
    };

    // 8. Upload
    client.put_object()
        .bucket(&self.config.bucket)
        .key(&key)
        .body(aws_sdk_s3::primitives::ByteStream::from(data.to_vec()))
        .content_type(&mime_type)
        .acl(acl)
        .send()
        .await
        .map_err(|e| StorageError::S3Error(e.to_string()))?;

    // 9. Build result
    let url = match visibility {
        Visibility::Public => self.public_url(&key),
        Visibility::Private => format!("{}/{}", UploadConfig::private_url_base(), uuid),
    };

    Ok(StoredFile {
        id: uuid.to_string(),
        original_name: filename.to_string(),
        stored_name,
        extension,
        mime_type,
        size_bytes: data.len() as u64,
        visibility,
        storage_path: key,
        checksum,
        url,
    })
}
```

#### Step 3: Implement get() Operation

```rust
async fn get(&self, path: &str) -> Result<Vec<u8>, StorageError> {
    let client = self.create_client().await;

    let response = client.get_object()
        .bucket(&self.config.bucket)
        .key(path)
        .send()
        .await
        .map_err(|e| {
            if e.to_string().contains("NoSuchKey") {
                StorageError::NotFound
            } else {
                StorageError::S3Error(e.to_string())
            }
        })?;

    let data = response.body
        .collect()
        .await
        .map_err(|e| StorageError::S3Error(e.to_string()))?
        .into_bytes()
        .to_vec();

    Ok(data)
}
```

#### Step 4: Implement delete() Operation

```rust
async fn delete(&self, path: &str) -> Result<bool, StorageError> {
    let client = self.create_client().await;

    client.delete_object()
        .bucket(&self.config.bucket)
        .key(path)
        .send()
        .await
        .map_err(|e| StorageError::S3Error(e.to_string()))?;

    tracing::info!("File deleted from S3: {}", path);
    Ok(true)
}
```

#### Step 5: Implement exists() and size()

```rust
async fn exists(&self, path: &str) -> Result<bool, StorageError> {
    let client = self.create_client().await;

    match client.head_object()
        .bucket(&self.config.bucket)
        .key(path)
        .send()
        .await
    {
        Ok(_) => Ok(true),
        Err(e) if e.to_string().contains("NotFound") => Ok(false),
        Err(e) => Err(StorageError::S3Error(e.to_string())),
    }
}

async fn size(&self, path: &str) -> Result<u64, StorageError> {
    let client = self.create_client().await;

    let response = client.head_object()
        .bucket(&self.config.bucket)
        .key(path)
        .send()
        .await
        .map_err(|e| {
            if e.to_string().contains("NotFound") {
                StorageError::NotFound
            } else {
                StorageError::S3Error(e.to_string())
            }
        })?;

    Ok(response.content_length().unwrap_or(0) as u64)
}
```

### CDN Integration

For production, configure a CDN in front of S3:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────>│     CDN     │────>│     S3      │
│             │     │ CloudFront  │     │   Bucket    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │                   │
       ▼                   ▼
  Cache HIT           Cache MISS
  (fast, cheap)    (origin fetch)
```

**Benefits:**
- **Performance** - Files served from edge locations near users
- **Cost** - Reduced S3 bandwidth costs
- **Availability** - CDN provides redundancy
- **Security** - Can add signed URLs, WAF rules

**Set CDN URL in .env:**
```env
S3_PUBLIC_URL=https://d111111abcdef8.cloudfront.net
# or
S3_PUBLIC_URL=https://cdn.yourapp.com
```

### S3-Compatible Services

The driver supports any S3-compatible service:

| Service | Endpoint Example | Notes |
|---------|------------------|-------|
| AWS S3 | (none - use default) | Standard S3 |
| MinIO | `https://minio.example.com` | Self-hosted |
| DigitalOcean Spaces | `https://nyc3.digitaloceanspaces.com` | Managed |
| Cloudflare R2 | `https://account.r2.cloudflarestorage.com` | No egress fees |
| Backblaze B2 | `https://s3.us-west-001.backblazeb2.com` | Low cost |
| Wasabi | `https://s3.wasabisys.com` | Low cost |

### Private Files with S3

Private files are NOT served directly from S3. Instead:

1. Client requests file from API: `GET /api/v1/upload/private/{uuid}`
2. API validates JWT authentication
3. API verifies user ownership
4. API fetches file from S3
5. API returns file to client

This ensures private files are always protected by authentication.

For performance, consider using **presigned URLs** for large private files:

```rust
// Generate a presigned URL valid for 1 hour
let presigned_url = client.get_object()
    .bucket(&self.config.bucket)
    .key(path)
    .presigned(aws_sdk_s3::presigning::PresigningConfig::expires_in(
        std::time::Duration::from_secs(3600)
    )?)
    .await?;
```

---

## Visibility Enum

```rust
pub enum Visibility {
    Public,   // Anyone can access
    Private,  // Only owner can access
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
```

---

## Stored File Result

When a file is stored, this struct is returned:

```rust
pub struct StoredFile {
    pub id: String,           // UUID
    pub original_name: String,
    pub stored_name: String,  // {timestamp}_{uuid}.{ext}
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub visibility: Visibility,
    pub storage_path: String, // Full path to file
    pub checksum: String,     // SHA256 hash
    pub url: String,          // Download URL
}
```

---

## Storage Errors

```rust
pub enum StorageError {
    FileTooLarge { max_size: u64, actual_size: u64 },
    InvalidExtension { extension: String, allowed: Vec<String> },
    TooManyFiles { max_files: usize, actual_files: usize },
    IoError(std::io::Error),
    InvalidFileName,
    NotFound,
    PermissionDenied,
    DriverNotConfigured(String),
    S3Error(String),
}
```

---

## Upload Controller

### File: `app/http/api/controllers/upload.rs`

The upload controller provides endpoints for all file operations.

### Available Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/upload/public` | Yes | Upload public file |
| POST | `/api/v1/upload/private` | Yes | Upload private file |
| POST | `/api/v1/upload/multiple` | Yes | Upload multiple files |
| GET | `/api/v1/upload/download/public/{uuid}` | No | Download public file |
| GET | `/api/v1/upload/private/{uuid}` | Yes | Download private file |
| DELETE | `/api/v1/upload/{uuid}` | Yes | Delete upload |
| GET | `/api/v1/upload/user` | Yes | Get user's uploads |
| POST | `/api/v1/upload/avatar` | Yes | Upload profile picture |
| DELETE | `/api/v1/upload/avatar` | Yes | Delete profile picture |
| GET | `/api/v1/avatar/{uuid}` | Yes | Get avatar file |
| POST | `/api/v1/upload/chunked/start` | Yes | Start chunked upload |
| POST | `/api/v1/upload/chunked/{uuid}/chunk/{index}` | Yes | Upload chunk |
| POST | `/api/v1/upload/chunked/{uuid}/complete` | Yes | Complete chunked upload |
| DELETE | `/api/v1/upload/chunked/{uuid}` | Yes | Cancel chunked upload |

---

## Single File Upload

### Upload Public File

**Endpoint:** `POST /api/v1/upload/public`

**Request:** `multipart/form-data`
- `file` - File to upload

**Response (201 Created):**
```json
{
    "status": "success",
    "message": "File uploaded successfully",
    "upload": {
        "uuid": "abc123-def456-...",
        "original_name": "document.pdf",
        "extension": "pdf",
        "mime_type": "application/pdf",
        "size_bytes": 102400,
        "storage_type": "public",
        "url": "/api/v1/upload/download/public/abc123-def456-...",
        "created_at": "2024-01-15T10:30:00Z"
    }
}
```

### Upload Private File

**Endpoint:** `POST /api/v1/upload/private`

Same request format, but stores in private location.

**Response URL:** `/api/v1/upload/private/{uuid}`

---

## Multiple File Upload

**Endpoint:** `POST /api/v1/upload/multiple`

**Request:** `multipart/form-data`
- `files[]` - Multiple files
- `visibility` - "public" or "private" (optional)

**Response (200 OK):**
```json
{
    "status": "success",
    "message": "Uploaded 3 files, 1 failed",
    "uploads": [
        { "uuid": "...", "original_name": "file1.jpg", ... },
        { "uuid": "...", "original_name": "file2.pdf", ... },
        { "uuid": "...", "original_name": "file3.png", ... }
    ],
    "failed": [
        { "filename": "file4.exe", "error": "Invalid file extension" }
    ]
}
```

---

## Profile Picture (Avatar)

### Upload Avatar

**Endpoint:** `POST /api/v1/upload/avatar`

**Request:** `multipart/form-data`
- `file` - Image file (jpg, png, gif, webp)

**Features:**
- Validates image MIME type
- Stores in `profile-pictures/` subfolder
- Max 10MB file size
- Updates user's `avatar_uuid` in database
- Replaces existing avatar if one exists
- Stored with `description: "profile-picture"` marker

**Response (201 Created):**
```json
{
    "status": "success",
    "message": "Profile picture uploaded successfully",
    "upload": {
        "uuid": "abc123-def456-...",
        "original_name": "profile.jpg",
        "url": "/api/v1/avatar/abc123-def456-...",
        ...
    }
}
```

### Get Avatar

**Endpoint:** `GET /api/v1/avatar/{uuid}`

**Features:**
- Requires authentication
- User can only access their own avatar
- Returns image with `inline` Content-Disposition
- Caches for 24 hours (`Cache-Control: private, max-age=86400`)

### Delete Avatar

**Endpoint:** `DELETE /api/v1/upload/avatar`

**Features:**
- Deletes file from storage
- Removes database record
- Clears user's `avatar_uuid`

---

## Chunked Upload

For large files that need to be uploaded in parts.

### 1. Start Upload Session

**Endpoint:** `POST /api/v1/upload/chunked/start`

**Request Body:**
```json
{
    "filename": "large-video.mp4",
    "total_chunks": 100,
    "total_size": 1073741824,
    "storage_type": "private"
}
```

**Response (201 Created):**
```json
{
    "status": "success",
    "message": "Chunked upload session started",
    "session_uuid": "abc123-def456-..."
}
```

### 2. Upload Chunks

**Endpoint:** `POST /api/v1/upload/chunked/{uuid}/chunk/{index}`

**Request Body:** Raw binary chunk data

**Response:**
```json
{
    "status": "success",
    "message": "Chunk received",
    "received_chunks": 5,
    "total_chunks": 100,
    "complete": false
}
```

### 3. Complete Upload

**Endpoint:** `POST /api/v1/upload/chunked/{uuid}/complete`

**Response (201 Created):**
```json
{
    "status": "success",
    "message": "Chunked upload completed",
    "upload": {
        "uuid": "abc123-def456-...",
        "original_name": "large-video.mp4",
        ...
    }
}
```

### 4. Cancel Upload (Optional)

**Endpoint:** `DELETE /api/v1/upload/chunked/{uuid}`

Cleans up partial upload data.

---

## Download Files

### Download Public File (No Auth)

**Endpoint:** `GET /api/v1/upload/download/public/{uuid}`

- No authentication required
- Returns file with `Content-Disposition: inline; filename="..."`
- Correct MIME type in `Content-Type` header

### Download Private File (Auth Required)

**Endpoint:** `GET /api/v1/upload/private/{uuid}`

**Authentication:**
- JWT header: `Authorization: Bearer <token>`
- OR Cookie: `auth_token=<token>` (for browser `<img>` tags)

**Features:**
- Checks user ownership
- Images: `Content-Disposition: inline` (displays in browser)
- Other files: `Content-Disposition: attachment` (downloads)
- Private cache: `Cache-Control: private, max-age=3600`

---

## Database Schema

### Uploads Table

```sql
CREATE TABLE uploads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    extension VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
    storage_type VARCHAR(20) NOT NULL CHECK (storage_type IN ('public', 'private')),
    storage_path VARCHAR(500) NOT NULL,
    upload_status VARCHAR(20) NOT NULL DEFAULT 'completed',
    chunks_received INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 1,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Key Fields

| Field | Description |
|-------|-------------|
| `uuid` | Public identifier for download URLs |
| `storage_type` | "public" or "private" |
| `storage_path` | Full path to file on disk |
| `upload_status` | "pending", "uploading", "completed", "failed" |
| `description` | Special marker (e.g., "profile-picture" for avatars) |
| `user_id` | Owner (NULL for anonymous uploads) |

---

## Admin Features

### List All Uploads

**Endpoint:** `GET /api/v1/admin/uploads`
**Permission:** Admin (>= 10)

**Query Parameters:**
- `limit` - Max results (default: 50, max: 100)
- `offset` - Skip count
- `storage_type` - Filter: "public" or "private"
- `search` - Search by filename

**Response:**
```json
{
    "status": "success",
    "uploads": [...],
    "total": 150,
    "limit": 50,
    "offset": 0
}
```

### Delete User's Avatar

**Endpoint:** `DELETE /api/v1/admin/users/{id}/avatar`
**Permission:** Admin (>= 10)

Allows admins to remove any user's profile picture.

---

## File Name Generation

Files are stored with generated names to prevent conflicts:

```rust
// Format: {YYYYMMDD}_{HHMMSS}_{uuid}.{extension}
// Example: 20240115_103045_abc123-def456.jpg

let stored_name = format!(
    "{}_{}.{}",
    chrono::Utc::now().format("%Y%m%d_%H%M%S"),
    uuid::Uuid::new_v4(),
    extension
);
```

---

## URL Generation

### Public Files

```rust
fn build_url(uuid: &Uuid, storage_type: StorageType) -> String {
    match storage_type {
        StorageType::Public => format!("/api/v1/upload/download/public/{}", uuid),
        StorageType::Private => format!("/api/v1/upload/private/{}", uuid),
    }
}
```

### Static File Access (Nginx)

Public files can also be accessed directly via Nginx:
```
/storage/{filename}
```

Example: `/storage/20240115_103045_abc123-def456.jpg`

---

## Template Helper Functions

### In Rust Code

```rust
use crate::bootstrap::utility::template::{assets, asset, private_asset};

// Public file URL
let url = assets("filename.jpg", "public");  // /storage/filename.jpg
let url = asset("filename.jpg");             // shorthand

// Private file URL (API endpoint)
let url = assets("uuid", "private");         // /api/v1/upload/private/uuid
let url = private_asset("uuid");             // shorthand
```

### In Tera Templates

```html
<!-- Public file -->
<img src="/storage/{{ upload.stored_name }}">

<!-- Private file (avatar) -->
<img src="/api/v1/avatar/{{ user.avatar_uuid }}">

<!-- Or using the asset helper -->
<img src="{{ assets(path=upload.stored_name, type='public') }}">
```

---

## Upload Flow Diagrams

### Single File Upload

```
┌─────────────────────────────────────────────────────────────────┐
│                       Client Request                             │
│                POST /api/v1/upload/public                        │
│                  multipart/form-data                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     JWT Middleware                               │
│                   Validate authentication                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Upload Controller                              │
│   1. Parse multipart form                                        │
│   2. Validate file (size, extension)                             │
│   3. Generate stored filename                                    │
│   4. Save to filesystem                                          │
│   5. Create database record                                      │
│   6. Return upload details                                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Response                                     │
│                  201 Created + JSON                              │
└─────────────────────────────────────────────────────────────────┘
```

### Private File Download

```
┌─────────────────────────────────────────────────────────────────┐
│                       Client Request                             │
│              GET /api/v1/upload/private/{uuid}                   │
│          Authorization: Bearer <token> OR Cookie                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Upload Controller                              │
│   1. Validate auth (header OR cookie)                            │
│   2. Parse UUID                                                  │
│   3. Get upload from database                                    │
│   4. Verify ownership (user_id matches)                          │
│   5. Read file from storage                                      │
│   6. Return file with headers                                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Response                                     │
│              200 OK + File binary                                │
│         Content-Type: {mime_type}                                │
│         Content-Disposition: inline/attachment                   │
│         Cache-Control: private, max-age=3600                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Common Errors

| Error | HTTP Code | Message |
|-------|-----------|---------|
| No auth | 401 | "Authentication required" |
| Not owner | 403 | "You don't have permission to delete this file" |
| Not found | 404 | "File not found" |
| Invalid UUID | 400 | "Invalid UUID format" |
| No file | 400 | "No file data received" |
| File too large | 400 | "File too large: X MB (max: Y MB)" |
| Invalid extension | 400 | "Invalid file extension: '{ext}'. Allowed: ..." |
| Too many files | 400 | "Maximum X files per upload exceeded" |

---

## Configuration Reference

```env
# Upload Configuration
UPLOAD_MAX_FILE_SIZE=104857600    # 100MB in bytes
UPLOAD_MAX_FILES_PER_UPLOAD=10
UPLOAD_ALLOWED_TYPES=jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx

# Storage Configuration
STORAGE_DRIVER=local              # "local" or "s3"
STORAGE_PATH=storage/app

# S3 Configuration (if using S3 driver)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_BUCKET=money-flow-uploads
```

---

## Related Documentation

- [API Routes](../Routes/Api/API_ROUTES.md) - Upload API endpoints
- [Database](../Database/DATABASE.md) - Upload table schema
- [Permissions](../Permissions/PERMISSIONS.md) - Admin upload access
