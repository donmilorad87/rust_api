# Admin Upload Page Enhancement - Implementation Guide

This guide documents the changes needed to implement asset preview, metadata management, and improved upload functionality for the admin panel.

## ✅ Completed Changes

### 1. Database Migration
**File**: `migrations/20260101194945_add_title_to_uploads.sql`
- Added `title VARCHAR(255)` column to `uploads` table
- Added index for title searches
- Set default title from original_name for existing records
- **Status**: Migration applied successfully

## 📋 Required Changes

### 2. Update Upload Struct and Database Queries

**File**: `src/app/db_query/read/upload/mod.rs`

Update the `Upload` struct to include title:
```rust
#[derive(Debug, Clone, FromRow)]
pub struct Upload {
    pub id: i64,
    pub uuid: Uuid,
    pub original_name: String,
    pub stored_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub upload_status: String,
    pub chunks_received: Option<i32>,
    pub total_chunks: Option<i32>,
    pub user_id: Option<i64>,
    pub title: Option<String>,          // NEW
    pub description: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

Update ALL SELECT queries to include `title` field in the column list. Search for:
- `SELECT id, uuid, original_name...`
- Add `title,` after `user_id,`

Affected functions:
- `get_by_id()`
- `get_by_uuid()`
- `get_by_user_id()`
- `get_by_storage_type()`
- `get_public_by_uuid()`
- `get_private_by_uuid()`
- `get_pending_by_user()`
- `get_all()`
- `get_all_filtered()` (all 4 variants)

### 3. Update Upload Mutations

**File**: `src/app/db_query/mutations/upload/mod.rs`

Update `CreateUploadParams` struct:
```rust
pub struct CreateUploadParams {
    pub uuid: Uuid,
    pub original_name: String,
    pub stored_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub user_id: Option<i64>,
    pub title: Option<String>,          // NEW
    pub description: Option<String>,
    pub metadata: Option<serde_json::Value>,
}
```

Update the `create()` function INSERT query to include `title` in both columns and values lists.

Add new function for updating metadata:
```rust
/// Update upload metadata (title and description)
pub async fn update_metadata(
    db: &Pool<Postgres>,
    uuid: &Uuid,
    title: Option<String>,
    description: Option<String>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        r#"UPDATE uploads
           SET title = $1, description = $2, updated_at = NOW()
           WHERE uuid = $3"#,
        title,
        description,
        uuid
    )
    .execute(db)
    .await?;
    Ok(())
}
```

### 4. Update Admin Controller

**File**: `src/app/http/api/controllers/admin.rs`

Update `AdminUploadDto`:
```rust
#[derive(Serialize)]
pub struct AdminUploadDto {
    pub uuid: String,
    pub original_name: String,
    pub extension: String,
    pub mime_type: String,
    pub size_bytes: i64,
    pub storage_type: String,
    pub storage_path: String,
    pub upload_status: String,
    pub user_id: Option<i64>,
    pub title: Option<String>,          // NEW
    pub description: Option<String>,    // NEW
    pub created_at: String,
}
```

Update `list_uploads()` mapping to include title and description:
```rust
let upload_dtos: Vec<AdminUploadDto> = uploads
    .into_iter()
    .map(|u| AdminUploadDto {
        uuid: u.uuid.to_string(),
        original_name: u.original_name,
        extension: u.extension,
        mime_type: u.mime_type,
        size_bytes: u.size_bytes,
        storage_type: u.storage_type,
        storage_path: u.storage_path,
        user_id: u.user_id,
        upload_status: u.upload_status,
        title: u.title,              // NEW
        description: u.description,  // NEW
        created_at: u.created_at.to_rfc3339(),
    })
    .collect();
```

Add new endpoint for updating metadata:
```rust
/// PATCH /api/v1/admin/upload/{uuid}/metadata - Update asset metadata
pub async fn update_upload_metadata(
    state: web::Data<AppState>,
    uuid: web::Path<String>,
    body: web::Json<UpdateMetadataRequest>,
) -> HttpResponse {
    let uuid = match Uuid::parse_str(&uuid.into_inner()) {
        Ok(u) => u,
        Err(_) => {
            return HttpResponse::BadRequest().json(BaseResponse::error("Invalid UUID"));
        }
    };

    let db = state.db.lock().await;

    match db_upload_mutations::update_metadata(&db, &uuid, body.title.clone(), body.description.clone()).await {
        Ok(_) => HttpResponse::Ok().json(BaseResponse::success("Metadata updated successfully")),
        Err(e) => {
            tracing::error!("Failed to update metadata: {}", e);
            HttpResponse::InternalServerError().json(BaseResponse::error("Failed to update metadata"))
        }
    }
}

#[derive(Deserialize)]
pub struct UpdateMetadataRequest {
    pub title: Option<String>,
    pub description: Option<String>,
}
```

### 5. Add API Route

**File**: `src/routes/api.rs`

Add the new metadata update endpoint:
```rust
.route("/api/v1/admin/upload/{uuid}/metadata", web::patch().to(admin::AdminController::update_upload_metadata))
```

### 6. Frontend - Asset Preview Component

**File**: `src/frontend/pages/UPLOADS/src/AssetPreview.js` (NEW FILE)

```javascript
/**
 * AssetPreview Component
 *
 * Displays assets with preview thumbnails for images
 */
export class AssetPreview {
  constructor(upload, baseUrl, onInfo, onDelete) {
    this.upload = upload;
    this.baseUrl = baseUrl;
    this.onInfo = onInfo;
    this.onDelete = onDelete;
  }

  /**
   * Check if file is an image
   */
  isImage() {
    return this.upload.mime_type.startsWith('image/');
  }

  /**
   * Get download URL
   */
  getDownloadUrl() {
    const isPublic = this.upload.storage_type === 'public';
    return isPublic
      ? `${this.baseUrl}/api/v1/upload/download/public/${this.upload.uuid}`
      : `${this.baseUrl}/api/v1/upload/private/${this.upload.uuid}`;
  }

  /**
   * Format file size
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Render the asset card
   */
  render() {
    const url = this.getDownloadUrl();
    const title = this.upload.title || this.upload.original_name;
    const isPublic = this.upload.storage_type === 'public';

    return `
      <div class="asset-card" data-uuid="${this.upload.uuid}">
        <div class="asset-card__preview">
          ${this.isImage() ? `
            <img
              src="${url}"
              alt="${this.upload.description || title}"
              title="${title}"
              class="asset-card__image"
              loading="lazy"
            />
          ` : `
            <div class="asset-card__icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
              <span class="asset-card__extension">${this.upload.extension}</span>
            </div>
          `}
          <span class="asset-card__badge asset-card__badge--${isPublic ? 'public' : 'private'}">
            ${this.upload.storage_type}
          </span>
        </div>
        <div class="asset-card__info">
          <h3 class="asset-card__title" title="${title}">${this.truncate(title, 25)}</h3>
          <p class="asset-card__size">${this.formatBytes(this.upload.size_bytes)}</p>
          <p class="asset-card__date">${new Date(this.upload.created_at).toLocaleDateString()}</p>
        </div>
        <div class="asset-card__actions">
          <button class="btn btn--icon btn--view" data-action="view" title="View/Download">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button class="btn btn--icon btn--info" data-action="info" title="Asset Info">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </button>
          <button class="btn btn--icon btn--delete" data-action="delete" title="Delete">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  }
}
```

### 7. Frontend - Asset Info Modal

**File**: `src/frontend/pages/UPLOADS/src/AssetInfoModal.js` (NEW FILE)

```javascript
/**
 * AssetInfoModal Component
 *
 * Modal for editing asset metadata (title and description)
 */
export class AssetInfoModal {
  constructor(baseUrl, showToast) {
    this.baseUrl = baseUrl;
    this.showToast = showToast;
    this.currentUpload = null;
    this.onSaveCallback = null;

    this.createModal();
    this.bindEvents();
  }

  /**
   * Create modal DOM structure
   */
  createModal() {
    const modalHtml = `
      <div id="assetInfoModal" class="modal" style="display: none;">
        <div class="modal__overlay" data-action="close"></div>
        <div class="modal__content">
          <div class="modal__header">
            <h2 class="modal__title">Asset Information</h2>
            <button class="modal__close" data-action="close" aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal__body">
            <form id="assetInfoForm" class="asset-info-form">
              <div class="form-group">
                <label for="assetTitle" class="form-label">
                  Asset Title
                  <span class="form-hint">Used for aria-title attribute</span>
                </label>
                <input
                  type="text"
                  id="assetTitle"
                  name="title"
                  class="form-input"
                  placeholder="Enter asset title"
                  maxlength="255"
                />
              </div>
              <div class="form-group">
                <label for="assetDescription" class="form-label">
                  Asset Description
                  <span class="form-hint">Used for alt attribute (important for images)</span>
                </label>
                <textarea
                  id="assetDescription"
                  name="description"
                  class="form-textarea"
                  rows="4"
                  placeholder="Enter asset description"
                ></textarea>
              </div>
              <div class="form-group">
                <label class="form-label">File Information</label>
                <div class="file-info">
                  <p><strong>Filename:</strong> <span id="assetFilename">-</span></p>
                  <p><strong>Type:</strong> <span id="assetMimeType">-</span></p>
                  <p><strong>Size:</strong> <span id="assetSize">-</span></p>
                  <p><strong>UUID:</strong> <span id="assetUuid">-</span></p>
                </div>
              </div>
            </form>
          </div>
          <div class="modal__footer">
            <button type="button" class="btn btn--secondary" data-action="close">
              Cancel
            </button>
            <button type="submit" form="assetInfoForm" class="btn btn--primary">
              Save Changes
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    this.modal = document.getElementById('assetInfoModal');
    this.form = document.getElementById('assetInfoForm');
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Close modal
    this.modal.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Form submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveMetadata();
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.style.display !== 'none') {
        this.close();
      }
    });
  }

  /**
   * Open modal with upload data
   */
  open(upload, onSave) {
    this.currentUpload = upload;
    this.onSaveCallback = onSave;

    // Populate form
    document.getElementById('assetTitle').value = upload.title || '';
    document.getElementById('assetDescription').value = upload.description || '';
    document.getElementById('assetFilename').textContent = upload.original_name;
    document.getElementById('assetMimeType').textContent = upload.mime_type;
    document.getElementById('assetSize').textContent = this.formatBytes(upload.size_bytes);
    document.getElementById('assetUuid').textContent = upload.uuid;

    // Show modal
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Focus first input
    setTimeout(() => document.getElementById('assetTitle').focus(), 100);
  }

  /**
   * Close modal
   */
  close() {
    this.modal.style.display = 'none';
    document.body.style.overflow = '';
    this.currentUpload = null;
    this.onSaveCallback = null;
  }

  /**
   * Save metadata via API
   */
  async saveMetadata() {
    if (!this.currentUpload) return;

    const formData = new FormData(this.form);
    const title = formData.get('title').trim() || null;
    const description = formData.get('description').trim() || null;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/admin/upload/${this.currentUpload.uuid}/metadata`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ title, description })
      });

      if (!response.ok) {
        throw new Error('Failed to update metadata');
      }

      const data = await response.json();

      if (data.status === 'success') {
        this.showToast('Asset metadata updated successfully', 'success');

        // Update local upload object
        this.currentUpload.title = title;
        this.currentUpload.description = description;

        // Call callback if provided
        if (this.onSaveCallback) {
          this.onSaveCallback(this.currentUpload);
        }

        this.close();
      } else {
        throw new Error(data.message || 'Failed to update metadata');
      }
    } catch (error) {
      console.error('Error updating metadata:', error);
      this.showToast('Failed to update asset metadata', 'error');
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
```

## Next Steps

After completing these changes:

1. Run `cargo sqlx prepare` to update query cache
2. Update frontend UploadsPage.js to use AssetPreview component
3. Add CSS styles for asset-card grid layout
4. Add upload button to admin/theme page
5. Test all functionality

Would you like me to continue with the remaining implementation files?
