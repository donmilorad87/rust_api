# Upload RabbitMQ Processing Verification Report

**Date:** 2026-01-02
**Status:** ✅ VERIFIED - All upload types use RabbitMQ for image processing

---

## Summary

All image uploads in the system **correctly use RabbitMQ** for asynchronous image resizing via the `resize_image` job. Each upload type has its own dedicated processing flow through RabbitMQ.

---

## Upload Types and RabbitMQ Usage

### 1. ✅ Profile Picture Uploads
**Endpoint:** `POST /api/v1/upload/avatar`
**Controller:** `src/app/http/api/controllers/upload.rs:967-1136`
**RabbitMQ Job:** `resize_image` (enqueued at line 1108)
**Priority:** 1 (high priority)
**Fault Tolerance:** 3 retries

**Flow:**
1. User uploads profile picture via multipart form
2. File saved to `private/profile-pictures/` subdirectory
3. Upload record created in database
4. **RabbitMQ job enqueued** to create variants (thumb, small, medium, large, full)
5. User's `avatar_uuid` and `avatar_id` updated
6. Response returned immediately (async processing)

**Code Location:**
```rust
// upload.rs:1086-1111
if is_supported_image(&result.extension) {
    if let Some(mq) = &state.mq {
        let resize_params = ResizeImageParams {
            upload_id,
            upload_uuid: result.uuid.to_string(),
            stored_name: result.stored_name.clone(),
            extension: result.extension.clone(),
            storage_type: "private".to_string(),
            file_path: full_file_path,
        };

        let options = JobOptions::new().priority(1).fault_tolerance(3);
        if let Err(e) = mq::enqueue_job_dyn(mq, "resize_image", &resize_params, options).await {
            tracing::warn!("Failed to enqueue resize_image job for avatar: {}", e);
        }
    }
}
```

---

### 2. ✅ Admin/General Uploads (Public)
**Endpoint:** `POST /api/v1/upload/public`
**Controller:** `src/app/http/api/controllers/upload.rs:111-122`
**Delegates to:** `handle_upload()` at line 139
**RabbitMQ Job:** `resize_image` (enqueued at line 261)
**Priority:** 5 (standard priority)
**Fault Tolerance:** 3 retries

**Flow:**
1. User uploads file to public storage
2. Calls shared `handle_upload()` function
3. File saved to `public/` directory
4. Upload record created in database
5. **RabbitMQ job enqueued** if image format is supported
6. Response returned with upload metadata

**Code Location:**
```rust
// upload.rs:236-264
if is_supported_image(&result.extension) {
    if let Some(mq) = &state.mq {
        let resize_params = ResizeImageParams {
            upload_id,
            upload_uuid: result.uuid.to_string(),
            stored_name: result.stored_name.clone(),
            extension: result.extension.clone(),
            storage_type: storage_type.as_str().to_string(),
            file_path: full_file_path,
        };

        let options = JobOptions::new()
            .priority(5)
            .fault_tolerance(3);

        if let Err(e) = mq::enqueue_job_dyn(mq, "resize_image", &resize_params, options).await {
            tracing::warn!("Failed to enqueue resize_image job: {}", e);
        }
    }
}
```

---

### 3. ✅ Admin/General Uploads (Private)
**Endpoint:** `POST /api/v1/upload/private`
**Controller:** `src/app/http/api/controllers/upload.rs:125-137`
**Delegates to:** `handle_upload()` at line 139
**RabbitMQ Job:** `resize_image` (enqueued at line 261)
**Priority:** 5 (standard priority)
**Fault Tolerance:** 3 retries

**Flow:**
1. User uploads file to private storage
2. Calls shared `handle_upload()` function (same as public uploads)
3. File saved to `private/` directory
4. Upload record created in database
5. **RabbitMQ job enqueued** if image format is supported
6. Response returned with upload metadata

**Note:** Uses the exact same `handle_upload()` function as public uploads, ensuring consistent RabbitMQ processing.

---

### 4. ✅ Multiple File Uploads
**Endpoint:** `POST /api/v1/upload/multiple`
**Controller:** `src/app/http/api/controllers/upload.rs:311-520`
**RabbitMQ Job:** `resize_image` (enqueued at line 432 for EACH file)
**Priority:** 5 (standard priority)
**Fault Tolerance:** 3 retries

**Flow:**
1. User uploads multiple files in single request
2. Each file processed individually in loop
3. For each file:
   - File saved to storage
   - Upload record created
   - **RabbitMQ job enqueued** (one job per image)
4. Returns array of upload metadata

**Code Location:**
```rust
// upload.rs:407-439
if is_supported_image(&result.extension) {
    if let Some(mq) = &state.mq {
        let resize_params = ResizeImageParams {
            upload_id,
            upload_uuid: result.uuid.to_string(),
            stored_name: result.stored_name.clone(),
            extension: result.extension.clone(),
            storage_type: storage_type.as_str().to_string(),
            file_path: full_file_path,
        };

        let options = JobOptions::new()
            .priority(5)
            .fault_tolerance(3);

        if let Err(e) = mq::enqueue_job_dyn(mq, "resize_image", &resize_params, options).await {
            tracing::warn!("Failed to enqueue resize_image job (multiple): {}", e);
        }
    }
}
```

---

### 5. ✅ Gallery Picture Uploads
**Endpoint:** `POST /api/v1/galleries/{id}/pictures`
**Controller:** `src/app/http/api/controllers/picture.rs:144-231`
**Upload Method:** Links **existing** upload records to galleries
**RabbitMQ Processing:** Already completed during initial upload

**Flow:**
1. User uploads image via one of the upload endpoints above
2. Image gets processed by RabbitMQ (variants created)
3. Later, user adds existing upload to gallery using `AddPictureRequest`
4. Creates `pictures` record linking `upload_id` to `gallery_id`
5. No additional RabbitMQ processing needed (variants already exist)

**Note:** Gallery pictures don't upload files directly. They reference uploads that were already processed via RabbitMQ when initially uploaded through `/upload/public` or `/upload/private`.

---

### 6. ✅ Logo Uploads
**Endpoint:** `PUT /admin/theme/branding`
**Controller:** `src/app/http/api/controllers/theme.rs:317-335`
**Upload Method:** References **existing** upload by UUID
**RabbitMQ Processing:** Already completed during initial upload

**Flow:**
1. Admin uploads logo via `/upload/public`
2. Logo gets processed by RabbitMQ (variants created)
3. Admin updates site config with logo UUID
4. `site_config.logo_uuid` updated to reference existing upload
5. No additional RabbitMQ processing needed

**Note:** Theme controller doesn't upload files. It updates references to existing uploads that were already processed.

---

### 7. ✅ Favicon Uploads
**Endpoint:** `PUT /admin/theme/branding`
**Controller:** `src/app/http/api/controllers/theme.rs:338-356`
**Upload Method:** References **existing** upload by UUID
**RabbitMQ Processing:** Already completed during initial upload

**Flow:**
1. Admin uploads favicon via `/upload/public`
2. Favicon gets processed by RabbitMQ (variants created)
3. Admin updates site config with favicon UUID
4. `site_config.favicon_uuid` updated to reference existing upload
5. No additional RabbitMQ processing needed

**Note:** Same pattern as logo - references existing processed uploads.

---

## RabbitMQ Job Details

### Job Name: `resize_image`

**Worker:** `src/app/mq/workers/resize_image/mod.rs`
**Purpose:** Create image variants at multiple sizes
**Variants Created:**
- `thumb` - 160px
- `small` - 320px
- `medium` - 640px
- `large` - 1024px
- `full` - 1920px

**Processing:**
1. Receives `ResizeImageParams` from queue
2. Opens original image file
3. Creates 5 variants at different sizes
4. Saves variants with suffix (e.g., `_thumb.jpg`, `_small.jpg`)
5. Inserts `image_variants` records in database
6. Optionally deletes original file (keeping only variants)

**Job Parameters:**
```rust
pub struct ResizeImageParams {
    pub upload_id: i64,
    pub upload_uuid: String,
    pub stored_name: String,
    pub extension: String,
    pub storage_type: String,
    pub file_path: String,
}
```

---

## Supported Image Formats

Images are only processed if they match supported formats:

**Function:** `is_supported_image()`
**Location:** `src/app/http/api/controllers/upload.rs`

**Supported Extensions:**
- `.jpg` / `.jpeg`
- `.png`
- `.webp`
- `.gif`

**Non-image files** (PDFs, videos, documents) skip RabbitMQ processing and are stored as-is.

---

## Priority Levels

Different upload types use different RabbitMQ priorities:

| Upload Type | Priority | Reason |
|-------------|----------|--------|
| Profile Pictures (Avatar) | **1** (High) | User experience - immediate feedback needed |
| Public/Private Uploads | **5** (Standard) | General uploads - can wait slightly longer |
| Multiple File Uploads | **5** (Standard) | Batch processing - standard priority |

**Priority Scale:** Lower number = higher priority (0 = highest, 10 = lowest)

---

## Fault Tolerance

All upload jobs have **3 retries** configured via `JobOptions`:

```rust
let options = JobOptions::new()
    .priority(X)
    .fault_tolerance(3);  // Retry up to 3 times on failure
```

If a resize job fails 3 times, it enters the dead-letter queue for manual review.

---

## Architecture Pattern

### Upload Flow Diagram

```
┌─────────────────┐
│  Client Upload  │
└────────┬────────┘
         │
         v
┌─────────────────────┐
│  Upload Endpoint    │
│  (Public/Private/   │
│   Avatar/Multiple)  │
└────────┬────────────┘
         │
         v
┌─────────────────────┐
│  Save File to Disk  │
│  (original size)    │
└────────┬────────────┘
         │
         v
┌─────────────────────┐
│  Create DB Record   │
│  (uploads table)    │
└────────┬────────────┘
         │
         v
┌─────────────────────┐
│  Enqueue RabbitMQ   │
│  resize_image Job   │
└────────┬────────────┘
         │
         v
┌─────────────────────┐
│  Return Response    │
│  (async processing) │
└─────────────────────┘

    [Background Processing]
         │
         v
┌─────────────────────┐
│  RabbitMQ Worker    │
│  (resize_image)     │
└────────┬────────────┘
         │
         v
┌─────────────────────┐
│  Create 5 Variants  │
│  (thumb/small/      │
│   medium/large/full)│
└────────┬────────────┘
         │
         v
┌─────────────────────┐
│  Save to Disk       │
│  (with suffixes)    │
└────────┬────────────┘
         │
         v
┌─────────────────────┐
│  Insert Variants    │
│  (image_variants    │
│   table)            │
└────────┬────────────┘
         │
         v
┌─────────────────────┐
│  Delete Original    │
│  (optional cleanup) │
└─────────────────────┘
```

---

## Verification Checklist

✅ **Profile Picture Uploads** - Uses RabbitMQ `resize_image` job (priority 1)
✅ **Admin Public Uploads** - Uses RabbitMQ `resize_image` job (priority 5)
✅ **Admin Private Uploads** - Uses RabbitMQ `resize_image` job (priority 5)
✅ **Multiple File Uploads** - Uses RabbitMQ `resize_image` job per file (priority 5)
✅ **Gallery Pictures** - References pre-processed uploads (no additional MQ)
✅ **Logo Uploads** - References pre-processed uploads (no additional MQ)
✅ **Favicon Uploads** - References pre-processed uploads (no additional MQ)

---

## Conclusion

**All image uploads correctly use RabbitMQ for asynchronous processing.**

The system has a clean architecture where:
1. **Direct uploads** (avatar, public, private, multiple) enqueue `resize_image` jobs
2. **Reference-based operations** (gallery pictures, logo, favicon) link to existing processed uploads
3. **Each upload gets its own RabbitMQ job** with appropriate priority
4. **Fault tolerance** ensures reliability with 3 automatic retries

No missing RabbitMQ processing detected. System is properly designed. ✅

---

## Recommendations

1. ✅ **Current Implementation is Correct** - No changes needed
2. 🔍 **Monitor Job Queue** - Ensure workers keep up with upload volume
3. 📊 **Track Job Metrics** - Monitor success/failure rates via RabbitMQ Management UI
4. 🚀 **Scale Workers** - Add more workers if resize jobs queue up during peak usage
5. ⚡ **Consider CDN** - For high-traffic sites, serve variants from CDN instead of app server

---

**Report Generated:** 2026-01-02
**Verified By:** Claude Code Analysis
**System:** Blazing Sun (Rust/Actix-web)
