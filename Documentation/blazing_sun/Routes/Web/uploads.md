# Admin Uploads Page Route

## Overview

The admin uploads page provides comprehensive asset management with image preview, metadata editing, filtering, and grid/table view modes. Requires admin permissions.

---

## Route Details

| Property | Value |
|----------|-------|
| **Path** | `/admin/uploads` |
| **Method** | GET |
| **Named Route** | `admin.uploads` |
| **Auth Required** | Yes (manual check) |
| **Permission Level** | Admin (10) or Super Admin (100) |
| **Controller** | `PagesController::uploads` |
| **Template** | `web/uploads.html` |

---

## Features

### 1. Asset Management
- Grid view (default) and table view modes
- Pagination (20 items per page)
- Filter by storage type (public/private/all)
- Search by filename or title
- Lazy loading for images

### 2. Image Preview
- Thumbnail display using small variant (320px)
- Click to open lightbox with full-size image
- Navigate between images in lightbox
- Display image metadata (dimensions, file size, format)

### 3. Metadata Editing
- Edit title (VARCHAR 255) - used for `title` attribute
- Edit description (TEXT) - used for `alt` attribute
- Save changes via API
- Real-time updates without page reload

### 4. Upload Management
- Upload new files (single or multiple)
- Drag & drop support
- Progress tracking
- Storage type selection (public/private)
- Automatic image variant generation via RabbitMQ

### 5. Deletion
- Delete individual uploads
- Confirmation dialog before deletion
- Cascade delete image variants
- Remove from filesystem

---

## Frontend Architecture

### Page Location
```
blazing_sun/src/frontend/pages/UPLOADS/
```

### Components (5 Classes)

1. **UploadsPage.js** (Main Controller - ~450 lines)
   - Grid/table view toggle
   - Pagination management
   - Filter and search
   - Coordinates all modals

2. **AssetPreview.js** (Asset card component - 7.4KB source)
   - Display thumbnail with lazy loading
   - Public/private badge
   - Action buttons (view, info, delete)
   - Responsive grid layout

3. **AssetInfoModal.js** (Metadata editor - 9.1KB source)
   - Edit title and description
   - Save changes via API
   - Form validation

4. **ImageLightbox.js** (Full-size viewer - 3.3KB source)
   - Full-screen image display
   - Keyboard navigation (ESC, arrows)
   - Download original
   - Close on backdrop click

5. **UploadModal.js** (Upload dialog - 12.6KB source)
   - File selection
   - Drag & drop zone
   - Multi-file upload
   - Progress tracking
   - Storage type selector

### Build Output

- **JavaScript**: `/src/resources/js/UPLOADS/app.js` (33KB)
- **CSS**: `/src/resources/css/UPLOADS/style.css` (20KB)

---

## Backend Implementation

### Controller Method

```rust
pub async fn uploads(
    req: HttpRequest,
    tmpl: web::Data<Tera>,
    state: web::Data<AppState>
) -> Result<HttpResponse, ApiError> {
    // Extract user ID and permissions
    let (user_id, permissions) = match extract_user_with_permissions(&req) {
        Some(data) => data,
        None => {
            return Ok(HttpResponse::Found()
                .insert_header(("Location", "/sign-in"))
                .finish());
        }
    };

    // Check admin permission (10 or 100)
    if permissions < 10 {
        return Ok(HttpResponse::Found()
            .insert_header(("Location", "/"))
            .finish());
    }

    // Prepare template context
    let mut context = Context::new();
    context.insert("page_title", "Admin - Uploads");
    context.insert("user_permissions", &permissions);

    // Render template
    let rendered = tmpl.render("web/uploads.html", &context)?;

    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(rendered))
}
```

---

## API Endpoints Used

### List Uploads
- `GET /api/v1/admin/upload/list?page=1&per_page=20&filter=public`
- Returns paginated list of uploads with metadata

### Upload File
- `POST /api/v1/upload/public` - Upload public file
- `POST /api/v1/upload/private` - Upload private file
- `POST /api/v1/upload/multiple` - Upload multiple files

### Update Metadata
- `PATCH /api/v1/admin/upload/{uuid}/metadata`
- Body: `{ "title": "...", "description": "..." }`

### Delete Upload
- `DELETE /api/v1/admin/upload/{uuid}`
- Cascades to image variants and filesystem

### Download
- `GET /api/v1/upload/download/public/{uuid}` - Public download (no auth)
- `GET /api/v1/upload/private/{uuid}` - Private download (auth required)

---

## Image Variant System

### Automatic Processing

When an image is uploaded:

1. **File saved** to `storage/app/public/` or `storage/app/private/`
2. **Database record** created in `uploads` table
3. **RabbitMQ job** enqueued: `resize_image`
4. **Worker processes** job and creates 5 variants:

| Variant | Width (px) | Use Case |
|---------|-----------|----------|
| `thumb` | 160 | List thumbnails |
| `small` | 320 | Mobile devices, cards |
| `medium` | 640 | Tablet views, previews |
| `large` | 1024 | Desktop views, modals |
| `full` | 1920 | Full-screen, downloads |

5. **Variants saved** to filesystem with suffixes:
   ```
   20260102_150000_uuid.jpg        (original)
   20260102_150000_uuid_thumb.jpg
   20260102_150000_uuid_small.jpg
   20260102_150000_uuid_medium.jpg
   20260102_150000_uuid_large.jpg
   20260102_150000_uuid_full.jpg
   ```

6. **Database records** created in `image_variants` table

### Priority Levels

| Upload Type | Priority | Reasoning |
|-------------|----------|-----------|
| Avatar | 1 (High) | Immediate user feedback |
| Public/Private | 5 (Standard) | Background processing acceptable |
| Multiple Files | 5 (Standard) | Batch processing |

### Fault Tolerance

- **3 automatic retries** on failure
- **Dead-letter queue** for persistent failures
- **Graceful degradation**: Upload succeeds even if resizing fails

---

## Template Structure

```html
<!-- web/uploads.html -->
{% extends "web/base.html" %}

{% block title %}Admin - Uploads{% endblock %}

{% block content %}
<div class="uploads-container">
    <!-- Toolbar -->
    <div class="uploads-toolbar">
        <button id="uploadBtn">Upload Files</button>
        <button id="toggleViewBtn">Grid/Table</button>
        <select id="filterSelect">
            <option value="all">All</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
        </select>
        <input type="search" id="searchInput" placeholder="Search..." />
    </div>

    <!-- Grid View -->
    <div id="gridView" class="uploads-grid active">
        <!-- Asset cards populated by JavaScript -->
    </div>

    <!-- Table View -->
    <div id="tableView" class="uploads-table">
        <!-- Table rows populated by JavaScript -->
    </div>

    <!-- Pagination -->
    <div class="pagination">
        <button id="prevPageBtn">Previous</button>
        <span id="pageInfo">Page 1 of 10</span>
        <button id="nextPageBtn">Next</button>
    </div>
</div>

<!-- Modals (hidden by default) -->
<div id="uploadModal" class="modal">...</div>
<div id="assetInfoModal" class="modal">...</div>
<div id="imageLightbox" class="modal">...</div>
{% endblock %}

{% block scripts %}
<script src="{{ assets('/js/GLOBAL/app.js', version=env.ASSETS_VERSION) }}"></script>
<script src="{{ assets('/js/UPLOADS/app.js', version=env.ASSETS_VERSION) }}"></script>
{% endblock %}
```

---

## Security Considerations

1. **Permission Check**: Admin (10) or Super Admin (100) required
2. **File Type Validation**: MIME type + extension checks
3. **File Size Limits**: Configurable max size (default 10MB)
4. **Path Traversal Prevention**: UUID-based filenames
5. **Private Storage Protection**: Download requires authentication
6. **Metadata Sanitization**: XSS prevention in title/description

---

## User Experience

### Loading States
- Skeleton loaders for image thumbnails
- Progress overlays during uploads
- Disabled buttons during API calls

### Validation Feedback
- File type rejection toast
- File size limit warnings
- Upload progress percentage

### Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation (Tab, Enter, ESC)
- Screen reader announcements for actions

---

## Performance Optimizations

1. **Lazy Loading**: Images loaded as user scrolls
2. **Image Variants**: Serve appropriate size for context
3. **Pagination**: Limit to 20 items per page
4. **Debounced Search**: 300ms delay before API call
5. **Optimistic UI**: Immediate feedback before server response

---

## Common Issues

### Upload Fails with 413 Error
**Cause**: File size exceeds configured limit
**Solution**: Increase `UPLOAD_MAX_FILE_SIZE` in `.env` or compress file

### Variants Not Generated
**Cause**: RabbitMQ worker not running or image processing library missing
**Solution**: Check `docker compose logs -f rust` for worker errors

### Private Images Not Accessible
**Cause**: Missing or invalid JWT token
**Solution**: Ensure user is authenticated and has proper permissions

---

## Related Documentation

- [Admin Uploads Feature](../../AdminUploads/README.md)
- [RabbitMQ Integration](../../AdminUploads/UPLOAD_RABBITMQ_VERIFICATION.md)
- [Upload API Endpoints](../API/upload.md)
- [Admin API Endpoints](../API/admin.md)
- [Image Variant System](../../Backend/Workers/resize_image.md)

---

**Last Updated**: 2026-01-02
**Controller Location**: `/home/milner/Desktop/rust/blazing_sun/src/app/http/web/controllers/pages.rs:uploads`
**Template Location**: `/home/milner/Desktop/rust/blazing_sun/src/resources/views/web/uploads.html`
**Frontend Source**: `/home/milner/Desktop/rust/blazing_sun/src/frontend/pages/UPLOADS/`
