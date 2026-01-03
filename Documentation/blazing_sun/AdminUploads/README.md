# Admin Uploads Feature - Complete Documentation

## Overview

The Admin Uploads feature provides a comprehensive asset management system with:
- **Image preview** with lazy loading
- **Metadata management** (title, description, alt attributes)
- **Asset organization** (public/private storage)
- **RabbitMQ integration** for asynchronous image processing
- **Multi-variant generation** (thumb, small, medium, large, full)
- **Gallery integration** for organizing assets into collections

---

## Architecture

### Storage Strategy

```
storage/app/
├── public/              # Publicly accessible via CDN/Web
│   ├── profile-pictures/
│   └── assets/
└── private/             # Authentication required
    ├── profile-pictures/
    └── documents/
```

### Database Schema

#### `uploads` Table
```sql
CREATE TABLE uploads (
    id BIGSERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    extension VARCHAR(10) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_type VARCHAR(20) NOT NULL,  -- 'public' | 'private'
    storage_path TEXT NOT NULL,
    upload_status VARCHAR(20) NOT NULL, -- 'pending' | 'completed' | 'failed'
    user_id BIGINT REFERENCES users(id),
    title VARCHAR(255),                 -- For aria-title attribute
    description TEXT,                   -- For alt attribute
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `image_variants` Table
```sql
CREATE TABLE image_variants (
    id BIGSERIAL PRIMARY KEY,
    upload_id BIGINT REFERENCES uploads(id) ON DELETE CASCADE,
    variant_name VARCHAR(50) NOT NULL,  -- 'thumb' | 'small' | 'medium' | 'large' | 'full'
    width INT NOT NULL,
    height INT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Backend Implementation

### API Endpoints

#### 1. Upload Endpoints

**Public Upload**
```
POST /api/v1/upload/public
Auth: Required (JWT or HttpOnly cookie)
Content-Type: multipart/form-data

Body:
- file: (binary)

Response: 200 OK
{
  "status": "success",
  "data": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "original_name": "photo.jpg",
    "mime_type": "image/jpeg",
    "size_bytes": 1048576,
    "storage_type": "public",
    "upload_status": "completed"
  }
}
```

**Private Upload**
```
POST /api/v1/upload/private
(Same structure as public)
```

**Profile Picture Upload**
```
POST /api/v1/upload/avatar
Auth: Required
Content-Type: multipart/form-data
Special: Sets user.avatar_uuid automatically
```

**Multiple File Upload**
```
POST /api/v1/upload/multiple
Auth: Required
Content-Type: multipart/form-data

Body:
- files[]: (multiple binary files)

Response: Array of upload objects
```

#### 2. Admin Endpoints

**List Uploads**
```
GET /api/v1/admin/upload/list?page=1&per_page=20&filter=public
Auth: Required (admin permission)

Response: 200 OK
{
  "status": "success",
  "data": {
    "uploads": [...],
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}
```

**Update Metadata**
```
PATCH /api/v1/admin/upload/{uuid}/metadata
Auth: Required (admin permission)

Body:
{
  "title": "Beautiful Sunset",
  "description": "A vibrant sunset over the ocean with orange and purple hues"
}

Response: 200 OK
{
  "status": "success",
  "message": "Metadata updated successfully"
}
```

**Delete Upload**
```
DELETE /api/v1/admin/upload/{uuid}
Auth: Required (admin permission)

Response: 200 OK
{
  "status": "success",
  "message": "Upload deleted successfully"
}
```

---

### RabbitMQ Integration

#### Image Processing Flow

```
┌─────────────────┐
│  File Upload    │
│   (any type)    │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Save to Disk    │
│ Create DB Record│
└────────┬────────┘
         │
         v
    ┌────────────┐
    │ Is Image?  │
    └─┬────────┬─┘
      │ No     │ Yes
      v        v
   ┌────┐  ┌──────────────────┐
   │Done│  │ Enqueue RabbitMQ │
   └────┘  │  resize_image    │
           └────────┬─────────┘
                    │
                    v
           ┌─────────────────┐
           │ RabbitMQ Worker │
           │  Processing...  │
           └────────┬────────┘
                    │
                    v
           ┌─────────────────┐
           │ Create Variants │
           │ (5 sizes)       │
           └────────┬────────┘
                    │
                    v
           ┌─────────────────┐
           │ Save Variants   │
           │ to Database     │
           └─────────────────┘
```

#### Job Parameters

```rust
pub struct ResizeImageParams {
    pub upload_id: i64,
    pub upload_uuid: String,
    pub stored_name: String,
    pub extension: String,
    pub storage_type: String,  // "public" | "private"
    pub file_path: String,
}
```

#### Priority Levels

| Upload Type | Priority | Reasoning |
|-------------|----------|-----------|
| Avatar | 1 (High) | Immediate user feedback |
| Public/Private | 5 (Standard) | Background processing acceptable |
| Multiple Files | 5 (Standard) | Batch processing |

#### Fault Tolerance

- **3 automatic retries** on failure
- **Dead-letter queue** for persistent failures
- **Graceful degradation**: Upload succeeds even if resizing fails

---

### Image Variants

#### Supported Sizes

| Variant | Width (px) | Use Case |
|---------|-----------|----------|
| `thumb` | 160 | List views, thumbnails |
| `small` | 320 | Mobile devices, cards |
| `medium` | 640 | Tablet views, previews |
| `large` | 1024 | Desktop views, modals |
| `full` | 1920 | Full-screen display, downloads |

#### Naming Convention

```
Original:  20260102_150000_uuid.jpg
Thumb:     20260102_150000_uuid_thumb.jpg
Small:     20260102_150000_uuid_small.jpg
Medium:    20260102_150000_uuid_medium.jpg
Large:     20260102_150000_uuid_large.jpg
Full:      20260102_150000_uuid_full.jpg
```

#### Worker Implementation

**Location**: `src/app/mq/workers/resize_image/mod.rs`

**Process**:
1. Receive job from RabbitMQ queue
2. Load original image from disk
3. Create 5 variants using `image` crate
4. Maintain aspect ratio during resize
5. Save variants with suffixes
6. Insert `image_variants` records
7. Optional: Delete original (keep variants only)

---

## Frontend Implementation

### Page Structure

**Location**: `src/frontend/pages/UPLOADS/`

```
UPLOADS/
├── src/
│   ├── main.js                 # Entry point
│   ├── UploadsPage.js          # Main page controller
│   ├── AssetPreview.js         # Asset card component
│   ├── AssetInfoModal.js       # Metadata editor modal
│   ├── ImageLightbox.js        # Image viewer modal
│   ├── UploadModal.js          # Upload dialog
│   └── styles/
│       ├── main.scss
│       ├── _asset-grid.scss
│       └── _modals.scss
├── package.json
└── vite.config.js
```

### Components

#### 1. UploadsPage.js
**Purpose**: Main page controller

**Responsibilities**:
- Fetch and display uploads via API
- Pagination and filtering
- Coordinate modals
- Handle upload/delete operations

**Key Methods**:
```javascript
class UploadsPage {
  async loadUploads(page = 1)
  async uploadFile(file, storageType)
  async deleteUpload(uuid)
  async refreshUploads()
  handleFilterChange(filter)
}
```

#### 2. AssetPreview.js
**Purpose**: Individual asset card display

**Features**:
- Image lazy loading
- Public/private badge
- Action buttons (view, info, delete)
- Responsive grid layout

**Rendering**:
```javascript
class AssetPreview {
  constructor(upload, baseUrl, onInfo, onDelete)
  isImage()  // Check if asset is image
  getDownloadUrl()  // Generate download URL
  render()  // Return HTML string
}
```

#### 3. AssetInfoModal.js
**Purpose**: Edit asset metadata

**Fields**:
- **Title** (VARCHAR 255) - Used for `title` attribute
- **Description** (TEXT) - Used for `alt` attribute on images

**API Integration**:
```javascript
async saveMetadata() {
  await fetch(`/api/v1/admin/upload/${uuid}/metadata`, {
    method: 'PATCH',
    body: JSON.stringify({ title, description })
  });
}
```

#### 4. ImageLightbox.js
**Purpose**: Full-screen image viewer

**Features**:
- Display image variants
- Navigation (prev/next)
- Download original
- Keyboard shortcuts (ESC, arrows)

#### 5. UploadModal.js
**Purpose**: File upload dialog

**Features**:
- Drag & drop support
- Multiple file selection
- Progress indicator
- Storage type selection (public/private)

---

### Build Process

**Commands**:
```bash
# Development build (watch mode)
cd src/frontend/pages/UPLOADS && npm run dev

# Production build
./build-frontend.sh UPLOADS

# Build all pages
./build-frontend.sh all
```

**Output**:
```
src/resources/
├── css/UPLOADS/style.css
└── js/UPLOADS/app.js
```

---

## Integration with Other Features

### Galleries

Galleries reference existing uploads via `upload_id`:

```sql
CREATE TABLE pictures (
    id BIGSERIAL PRIMARY KEY,
    gallery_id BIGINT REFERENCES galleries(id) ON DELETE CASCADE,
    upload_id BIGINT REFERENCES uploads(id) ON DELETE CASCADE,
    display_order INT DEFAULT 0
);
```

**Workflow**:
1. Upload image via `/api/v1/upload/public`
2. Image processed by RabbitMQ (variants created)
3. Add image to gallery via `/api/v1/galleries/{id}/pictures`
4. Gallery displays variants automatically

### Theme Configuration

Logo and favicon reference uploads:

```sql
CREATE TABLE site_config (
    ...
    logo_uuid UUID REFERENCES uploads(uuid),
    favicon_uuid UUID REFERENCES uploads(uuid)
);
```

**Workflow**:
1. Upload logo via `/api/v1/upload/public`
2. Image processed by RabbitMQ
3. Update site config with logo UUID
4. Templates use logo variants automatically

### Profile Pictures

Avatar references uploads:

```sql
ALTER TABLE users
ADD COLUMN avatar_uuid UUID REFERENCES uploads(uuid),
ADD COLUMN avatar_id BIGINT REFERENCES uploads(id);
```

**Special Behavior**:
- `/api/v1/upload/avatar` automatically updates user record
- Private storage by default
- High-priority RabbitMQ processing

---

## Testing

### Test Scripts

**Location**: `blazing_sun/tests/scripts/`

- `test_avatar_endpoint.sh` - Test avatar upload API
- `test_avatar_jwt.sh` - Test JWT authentication
- `test_cookie_signin.sh` - Test cookie-based auth

**Debug Scripts**

**Location**: `blazing_sun/tests/debug/`

- `debug_galleries.js` - Debug gallery/upload integration
- `debug_picture_count.js` - Verify upload counts

### Manual Testing Checklist

**Upload Tests**:
- [ ] Upload single image (public)
- [ ] Upload single image (private)
- [ ] Upload multiple images
- [ ] Upload non-image file (PDF, video)
- [ ] Upload with invalid file type
- [ ] Upload with file size exceeding limit

**Metadata Tests**:
- [ ] Edit title and description
- [ ] Save without title (NULL allowed)
- [ ] Save without description (NULL allowed)
- [ ] Long title (255 char limit)
- [ ] Long description (TEXT field)

**RabbitMQ Tests**:
- [ ] Verify variants created for images
- [ ] Verify non-images skip processing
- [ ] Check variant sizes are correct
- [ ] Verify database records created
- [ ] Test retry mechanism on failure

**Frontend Tests**:
- [ ] Grid layout responsive
- [ ] Image lazy loading works
- [ ] Modal opens and closes
- [ ] Upload progress indicator
- [ ] Delete confirmation

---

## Performance Considerations

### Image Optimization

1. **Use WebP when possible** - Smaller file size, better compression
2. **Lazy load images** - Load images as user scrolls
3. **Serve appropriate variant** - Mobile gets small, desktop gets large
4. **CDN integration** - Serve from CDN for faster delivery

### Database Indexing

```sql
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_storage_type ON uploads(storage_type);
CREATE INDEX idx_uploads_created_at ON uploads(created_at DESC);
CREATE INDEX idx_image_variants_upload_id ON image_variants(upload_id);
CREATE INDEX idx_image_variants_variant_name ON image_variants(variant_name);
```

### RabbitMQ Scaling

- **Multiple workers** - Run multiple `resize_image` workers
- **Priority queues** - High-priority for avatars
- **Dead-letter queue** - Handle persistent failures
- **Monitoring** - Track queue depth and processing time

---

## Security Considerations

1. **File type validation** - Only allow specified MIME types
2. **File size limits** - Prevent DoS via large uploads
3. **Authentication required** - All upload endpoints need auth
4. **Private storage protection** - `/api/v1/upload/private/{uuid}` checks ownership
5. **Metadata sanitization** - Escape user input in title/description
6. **UUID-based URLs** - Prevent enumeration attacks

---

## Future Enhancements

1. **Direct S3 Upload** - Use storage driver abstraction for S3
2. **Image Transformation API** - On-demand resizing via URL parameters
3. **AVIF Support** - Next-gen image format
4. **Video Processing** - Thumbnail generation for videos
5. **Bulk Operations** - Delete/move multiple uploads
6. **Usage Analytics** - Track upload/download metrics
7. **Duplicate Detection** - Prevent duplicate uploads via hash

---

## Related Documentation

- [RabbitMQ Processing Verification](./UPLOAD_RABBITMQ_VERIFICATION.md)
- [Implementation Guide](./IMPLEMENTATION_GUIDE_ADMIN_UPLOADS.md)
- [Frontend Build Guide](../Frontend/README.md)
- [Database Schema](../../blazing_sun/CLAUDE_partials/12-database-schema.md)

---

## Troubleshooting

**Upload fails silently**:
- Check file size limits in `.env`
- Verify storage directory permissions
- Check logs: `docker compose logs -f rust`

**Variants not created**:
- Verify RabbitMQ worker is running
- Check dead-letter queue for failed jobs
- Verify `image` crate dependencies installed

**Frontend build fails**:
- Use `./build-frontend.sh UPLOADS` inside Docker
- Check for sandbox issues (run in Docker only)
- Verify Node.js and npm installed

**Images don't display**:
- Check storage path in database
- Verify file exists on disk
- Check public/private access permissions
- Verify NGINX static file serving config

---

**Last Updated**: 2026-01-02
**Maintainer**: Blazing Sun Development Team
