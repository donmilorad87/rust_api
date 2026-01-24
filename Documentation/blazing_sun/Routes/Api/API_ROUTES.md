# API Routes Documentation

This document provides comprehensive documentation for all REST API routes in the Blazing Sun application.

---

## Overview

API routes return JSON responses and are defined in `blazing_sun/src/routes/api.rs`. They follow RESTful conventions and use JWT authentication for protected endpoints.

---

## Route Registration Architecture

### File: `routes/api.rs`

```rust
use actix_web::{middleware::from_fn, web};
use crate::app::http::api::controllers::{
    activation::ActivationController,
    admin::AdminController,
    auth::AuthController,
    upload::UploadController,
    user::UserController,
};
use crate::middleware;
use crate::middleware::permission::{levels, require_permission};
use crate::route;

pub fn register(cfg: &mut web::ServiceConfig) {
    register_route_names();
    // Route definitions...
}
```

---

## Authentication

### JWT Token Authentication

Protected routes use JWT middleware:
```rust
.wrap(from_fn(middleware::auth::verify_jwt))
```

**Token Delivery:**
- **Header:** `Authorization: Bearer <token>`
- **Cookie:** `auth_token=<token>` (browser fallback)

**JWT Claims:**
```rust
pub struct Claims {
    pub sub: i64,       // User ID
    pub role: String,   // "user"
    pub exp: i64,       // Expiration timestamp
    pub permissions: i16, // Permission level
}
```

---

## Authentication Routes (Public)

Base path: `/api/v1/auth`

### Sign Up

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/auth/sign-up` |
| **Named Route** | `auth.sign_up` |
| **Handler** | `AuthController::sign_up` |
| **Auth Required** | No |

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "first_name": "John",
    "last_name": "Doe"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

**Success Response (201 Created):**
```json
{
    "status": "success",
    "message": "User created successfully. Please check your email for activation code.",
    "user": {
        "id": 1,
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe"
    }
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `409 Conflict` - Email already exists

---

### Sign In

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/auth/sign-in` |
| **Named Route** | `auth.sign_in` |
| **Handler** | `AuthController::sign_in` |
| **Auth Required** | No |

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "SecurePass123!"
}
```

**Success Response (200 OK):**
```json
{
    "status": "success",
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
        "id": 1,
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe"
    }
}
```

**Note:** Also sets `auth_token` cookie for browser clients.

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - Account not activated

---

## Account Routes (Public)

Base path: `/api/v1/account`

### Activate Account

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/account/activate-account` |
| **Named Route** | `account.activate` |
| **Handler** | `ActivationController::activate_account` |
| **Auth Required** | No |

**Request Body:**
```json
{
    "email": "user@example.com",
    "activation_code": "ABC123"
}
```

**Success Response (200 OK):**
```json
{
    "status": "success",
    "message": "Account activated successfully"
}
```

---

### Forgot Password

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/account/forgot-password` |
| **Named Route** | `account.forgot_password` |
| **Handler** | `ActivationController::forgot_password` |
| **Auth Required** | No |

**Request Body:**
```json
{
    "email": "user@example.com"
}
```

**Success Response (200 OK):**
```json
{
    "status": "success",
    "message": "Password reset code sent to your email"
}
```

**Note:** Returns success even if email doesn't exist (security best practice).

---

### Verify Hash

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/account/verify-hash` |
| **Named Route** | `account.verify_hash` |
| **Handler** | `ActivationController::verify_hash` |
| **Auth Required** | No |

**Request Body:**
```json
{
    "email": "user@example.com",
    "hash": "ABC123",
    "hash_type": "activation" | "password_reset"
}
```

**Success Response (200 OK):**
```json
{
    "status": "success",
    "message": "Hash is valid"
}
```

---

### Reset Password

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/account/reset-password` |
| **Named Route** | `account.reset_password` |
| **Handler** | `ActivationController::reset_password` |
| **Auth Required** | No |

**Request Body:**
```json
{
    "email": "user@example.com",
    "reset_code": "ABC123",
    "new_password": "NewSecurePass123!"
}
```

**Success Response (200 OK):**
```json
{
    "status": "success",
    "message": "Password reset successfully"
}
```

---

### Set Password When Needed

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/account/set-password-when-needed` |
| **Named Route** | `account.set_password_when_needed` |
| **Handler** | `ActivationController::verify_set_password_link` |
| **Auth Required** | No |

**Query Parameters:**
- `email` - User's email
- `code` - Set password code

**Success Response (200 OK):**
```json
{
    "status": "success",
    "message": "Link is valid"
}
```

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/account/set-password-when-needed` |
| **Handler** | `ActivationController::set_password_when_needed` |

**Request Body:**
```json
{
    "email": "user@example.com",
    "code": "ABC123",
    "new_password": "NewSecurePass123!"
}
```

---

## Password Change Routes (Protected)

Base path: `/api/v1/password`

All routes require JWT authentication.

### Request Password Change

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/password/change-password` |
| **Named Route** | `password.change` |
| **Handler** | `ActivationController::request_change_password` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
    "current_password": "CurrentPass123!"
}
```

**Success Response (200 OK):**
```json
{
    "status": "success",
    "message": "Password change verification code sent to your email"
}
```

---

### Verify and Change Password

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/password/verify-password-change` |
| **Named Route** | `password.verify_change` |
| **Handler** | `ActivationController::verify_and_change_password` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
    "verification_code": "ABC123",
    "new_password": "NewSecurePass123!"
}
```

**Success Response (200 OK):**
```json
{
    "status": "success",
    "message": "Password changed successfully"
}
```

---

## User Routes (Protected)

Base path: `/api/v1/user`

All routes require JWT authentication.

### Get Current User

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/user` |
| **Named Route** | `user.current` |
| **Handler** | `UserController::get_current` |
| **Auth Required** | Yes |

**Success Response (200 OK):**
```json
{
    "status": "success",
    "user": {
        "id": 1,
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "balance": 10000,
        "permissions": 1,
        "activated": 1,
        "avatar_uuid": "abc123-def456"
    }
}
```

---

### Get User by ID

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/user/{id}` |
| **Named Route** | `user.show` |
| **Handler** | `UserController::get_by_id` |
| **Auth Required** | Yes |

**Path Parameters:**
- `id` - User ID

**Success Response (200 OK):**
```json
{
    "status": "success",
    "user": {
        "id": 1,
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe"
    }
}
```

---

### Update User (Partial)

| Property | Value |
|----------|-------|
| **Route** | `PATCH /api/v1/user` |
| **Named Route** | `user.update_partial` |
| **Handler** | `UserController::update_partial` |
| **Auth Required** | Yes |

**Request Body (all fields optional):**
```json
{
    "first_name": "Jane",
    "last_name": "Smith"
}
```

**Success Response (200 OK):**
```json
{
    "status": "success",
    "message": "User updated successfully",
    "user": { ... }
}
```

---

### Update User (Full)

| Property | Value |
|----------|-------|
| **Route** | `PUT /api/v1/user` |
| **Named Route** | `user.update_full` |
| **Handler** | `UserController::update_full` |
| **Auth Required** | Yes |

**Request Body (all fields required):**
```json
{
    "email": "newemail@example.com",
    "first_name": "Jane",
    "last_name": "Smith"
}
```

---

### Update Avatar

| Property | Value |
|----------|-------|
| **Route** | `PATCH /api/v1/user/avatar` |
| **Named Route** | `user.avatar` |
| **Handler** | `UserController::update_avatar` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
    "avatar_uuid": "abc123-def456"
}
```

**Note:** Set to `null` to remove avatar.

---

### Admin Create User

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/user` |
| **Named Route** | `user.admin_create` |
| **Handler** | `UserController::admin_create` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
    "email": "newuser@example.com",
    "first_name": "New",
    "last_name": "User",
    "password": "optional"
}
```

**Note:** If password is omitted, user must set password via email link.

---

### Delete User

| Property | Value |
|----------|-------|
| **Route** | `DELETE /api/v1/user/{id}` |
| **Named Route** | `user.delete` |
| **Handler** | `UserController::delete` |
| **Auth Required** | Yes |

**Path Parameters:**
- `id` - User ID to delete

---

## Upload Routes

### Public Downloads (No Auth)

Base path: `/api/v1/upload/download`

#### Download Public File

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/upload/download/public/{uuid}` |
| **Named Route** | `upload.download.public` |
| **Handler** | `UploadController::download_public` |
| **Auth Required** | No |

**Path Parameters:**
- `uuid` - File UUID

**Response:** File binary stream with appropriate Content-Type header.

---

### Protected Uploads (Auth Required)

Base path: `/api/v1/upload`

All routes require JWT authentication.

#### Upload Public File

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/upload/public` |
| **Named Route** | `upload.public` |
| **Handler** | `UploadController::upload_public` |
| **Auth Required** | Yes |

**Request:** `multipart/form-data`
- `file` - File to upload

**Success Response (201 Created):**
```json
{
    "status": "success",
    "message": "File uploaded successfully",
    "upload": {
        "uuid": "abc123-def456",
        "original_name": "document.pdf",
        "mime_type": "application/pdf",
        "size_bytes": 1024000,
        "storage_type": "public",
        "download_url": "/api/v1/upload/download/public/abc123-def456"
    }
}
```

---

#### Upload Private File

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/upload/private` |
| **Named Route** | `upload.private` |
| **Handler** | `UploadController::upload_private` |
| **Auth Required** | Yes |

**Request:** `multipart/form-data`
- `file` - File to upload

**Success Response (201 Created):**
```json
{
    "status": "success",
    "message": "File uploaded successfully",
    "upload": {
        "uuid": "abc123-def456",
        "storage_type": "private",
        "download_url": "/api/v1/upload/private/abc123-def456"
    }
}
```

---

#### Upload Multiple Files

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/upload/multiple` |
| **Named Route** | `upload.multiple` |
| **Handler** | `UploadController::upload_multiple` |
| **Auth Required** | Yes |

**Request:** `multipart/form-data`
- `files[]` - Multiple files
- `visibility` - "public" or "private" (optional, default: "private")

**Success Response (201 Created):**
```json
{
    "status": "success",
    "message": "Files uploaded successfully",
    "uploads": [
        { "uuid": "...", "original_name": "file1.jpg" },
        { "uuid": "...", "original_name": "file2.pdf" }
    ]
}
```

---

#### Download Private File

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/upload/private/{uuid}` |
| **Named Route** | `upload.private.download` |
| **Handler** | `UploadController::download_private` |
| **Auth Required** | Yes |

**Path Parameters:**
- `uuid` - File UUID

**Note:** User can only download their own private files.

---

#### Delete Upload

| Property | Value |
|----------|-------|
| **Route** | `DELETE /api/v1/upload/{uuid}` |
| **Named Route** | `upload.delete` |
| **Handler** | `UploadController::delete` |
| **Auth Required** | Yes |

**Path Parameters:**
- `uuid` - File UUID

**Note:** User can only delete their own files.

---

#### Get User's Uploads

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/upload/user` |
| **Named Route** | `upload.user` |
| **Handler** | `UploadController::get_user_uploads` |
| **Auth Required** | Yes |

**Success Response (200 OK):**
```json
{
    "status": "success",
    "uploads": [
        {
            "uuid": "abc123",
            "original_name": "photo.jpg",
            "storage_type": "private",
            "created_at": "2024-01-15T10:30:00Z"
        }
    ]
}
```

---

### Avatar Routes

#### Upload Avatar

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/upload/avatar` |
| **Named Route** | `upload.avatar` |
| **Handler** | `UploadController::upload_avatar` |
| **Auth Required** | Yes |

**Request:** `multipart/form-data`
- `file` - Image file (jpg, png, gif, webp)

**Note:** Replaces existing avatar if one exists.

---

#### Delete Avatar

| Property | Value |
|----------|-------|
| **Route** | `DELETE /api/v1/upload/avatar` |
| **Named Route** | `upload.avatar.delete` |
| **Handler** | `UploadController::delete_avatar` |
| **Auth Required** | Yes |

---

#### Get Avatar

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/avatar/{uuid}` |
| **Named Route** | `avatar.get` |
| **Handler** | `UploadController::get_avatar` |
| **Auth Required** | Yes |

**Path Parameters:**
- `uuid` - Avatar asset UUID

**Note:** User can only access their own avatar.

---

### Chunked Upload Routes

For large files that need to be uploaded in parts.

#### Start Chunked Upload

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/upload/chunked/start` |
| **Named Route** | `upload.chunked.start` |
| **Handler** | `UploadController::start_chunked_upload` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
    "filename": "large-video.mp4",
    "total_size": 1073741824,
    "total_chunks": 100,
    "mime_type": "video/mp4",
    "visibility": "private"
}
```

**Success Response (201 Created):**
```json
{
    "status": "success",
    "upload_id": "abc123-def456",
    "message": "Chunked upload initialized"
}
```

---

#### Upload Chunk

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/upload/chunked/{uuid}/chunk/{index}` |
| **Named Route** | `upload.chunked.chunk` |
| **Handler** | `UploadController::upload_chunk` |
| **Auth Required** | Yes |

**Path Parameters:**
- `uuid` - Upload ID from start
- `index` - Chunk index (0-based)

**Request:** Binary chunk data

---

#### Complete Chunked Upload

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/upload/chunked/{uuid}/complete` |
| **Named Route** | `upload.chunked.complete` |
| **Handler** | `UploadController::complete_chunked_upload` |
| **Auth Required** | Yes |

**Path Parameters:**
- `uuid` - Upload ID

**Success Response (200 OK):**
```json
{
    "status": "success",
    "message": "Upload completed successfully",
    "upload": {
        "uuid": "abc123-def456",
        "original_name": "large-video.mp4"
    }
}
```

---

#### Cancel Chunked Upload

| Property | Value |
|----------|-------|
| **Route** | `DELETE /api/v1/upload/chunked/{uuid}` |
| **Named Route** | `upload.chunked.cancel` |
| **Handler** | `UploadController::cancel_chunked_upload` |
| **Auth Required** | Yes |

---

## Admin Routes (Protected + Permission Required)

Admin routes require JWT authentication AND elevated permissions.

**Middleware Stack:**
```rust
.wrap(from_fn(require_permission(levels::ADMIN)))  // Runs second
.wrap(from_fn(middleware::auth::verify_jwt))       // Runs first
```

**Note:** Actix middleware order is REVERSED - last `.wrap()` runs first!

### Admin Routes (Permission >= 10)

Base path: `/api/v1/admin`

#### List All Uploads

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/admin/uploads` |
| **Named Route** | `admin.uploads` |
| **Handler** | `AdminController::list_uploads` |
| **Auth Required** | Yes |
| **Permission Required** | Admin (>= 10) |

**Query Parameters:**
- `limit` - Max results (default: 50, max: 100)
- `offset` - Skip count (default: 0)
- `storage_type` - Filter: "public" or "private"
- `search` - Search by filename

**Success Response (200 OK):**
```json
{
    "status": "success",
    "uploads": [
        {
            "uuid": "abc123",
            "original_name": "document.pdf",
            "extension": "pdf",
            "mime_type": "application/pdf",
            "size_bytes": 102400,
            "storage_type": "public",
            "storage_path": "storage/app/public/...",
            "upload_status": "completed",
            "user_id": 1,
            "created_at": "2024-01-15T10:30:00Z"
        }
    ],
    "total": 150,
    "limit": 50,
    "offset": 0
}
```

---

#### List All Assets

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/admin/assets` |
| **Named Route** | `admin.assets` |
| **Handler** | `AdminController::list_assets` |
| **Auth Required** | Yes |
| **Permission Required** | Admin (>= 10) |

**Query Parameters:**
- `limit` - Max results (default: 50, max: 100)
- `offset` - Skip count (default: 0)

---

#### Delete User's Avatar

| Property | Value |
|----------|-------|
| **Route** | `DELETE /api/v1/admin/users/{id}/avatar` |
| **Named Route** | `admin.delete_user_avatar` |
| **Handler** | `AdminController::delete_user_avatar` |
| **Auth Required** | Yes |
| **Permission Required** | Admin (>= 10) |

**Path Parameters:**
- `id` - User ID

---

### Super Admin Routes (Permission >= 100)

Base path: `/api/v1/admin/users`

#### List All Users

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/admin/users` |
| **Named Route** | `admin.users` |
| **Handler** | `AdminController::list_users` |
| **Auth Required** | Yes |
| **Permission Required** | Super Admin (>= 100) |

**Query Parameters:**
- `limit` - Max results (default: 50, max: 100)
- `offset` - Skip count (default: 0)

**Success Response (200 OK):**
```json
{
    "status": "success",
    "users": [
        {
            "id": 1,
            "email": "user@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "balance": 10000,
            "permissions": 1,
            "activated": 1,
            "verified": 1,
            "avatar_uuid": "abc123",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-15T10:30:00Z"
        }
    ],
    "total": 100,
    "limit": 50,
    "offset": 0
}
```

---

#### Update User Permissions

| Property | Value |
|----------|-------|
| **Route** | `PATCH /api/v1/admin/users/{id}/permissions` |
| **Named Route** | `admin.update_user_permissions` |
| **Handler** | `AdminController::update_user_permissions` |
| **Auth Required** | Yes |
| **Permission Required** | Super Admin (>= 100) |

**Path Parameters:**
- `id` - User ID

**Request Body:**
```json
{
    "permissions": 10
}
```

**Valid Permission Values:**
- `1` - Basic user
- `10` - Admin
- `50` - Affiliate
- `100` - Super Admin

---

## Gallery Routes (Protected)

Base path: `/api/v1/galleries`

All routes require JWT authentication.

### List User's Galleries

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/galleries` |
| **Named Route** | `galleries.list` |
| **Handler** | `gallery::get_user_galleries` |
| **Auth Required** | Yes |

**Success Response (200 OK):**
```json
{
    "galleries": [
        {
            "id": 1,
            "user_id": 123,
            "name": "My Gallery",
            "description": "Photos from my trip",
            "is_public": true,
            "gallery_type": "geo_galleries",
            "display_order": 0,
            "picture_count": 15,
            "latitude": 40.7128,
            "longitude": -74.0060,
            "tags": ["travel", "city"],
            "cover_image_id": 456,
            "cover_image_url": "/api/v1/upload/download/public/abc123-...",
            "created_at": "2026-01-15T10:30:00Z",
            "updated_at": "2026-01-15T10:30:00Z"
        }
    ]
}
```

---

### Create Gallery

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/galleries` |
| **Named Route** | `galleries.create` |
| **Handler** | `gallery::create_gallery` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
    "name": "My Geo Gallery",
    "description": "Photos from my trip",
    "is_public": true,
    "gallery_type": "geo_galleries",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "tags": ["travel", "city"],
    "cover_image_id": 456
}
```

**Gallery Type Values:**
- `regular_galleries` - Standard gallery (default)
- `geo_galleries` - Location-based gallery (requires latitude, longitude, cover_image_id)

**Success Response (201 Created):**
Returns the created gallery object.

**Error Responses:**
- `400 Bad Request` - Validation errors
- `409 Conflict` - Gallery name already exists for user

---

### Get Gallery

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/galleries/{id}` |
| **Named Route** | `galleries.show` |
| **Handler** | `gallery::get_gallery` |
| **Auth Required** | Yes |

**Access Control:**
- User can access own galleries
- User can access public galleries from other users
- `403 Forbidden` for private galleries owned by others

---

### Update Gallery

| Property | Value |
|----------|-------|
| **Route** | `PUT /api/v1/galleries/{id}` |
| **Named Route** | `galleries.update` |
| **Handler** | `gallery::update_gallery` |
| **Auth Required** | Yes |

**Request Body (all fields optional):**
```json
{
    "name": "Updated Name",
    "description": "Updated description",
    "is_public": true,
    "gallery_type": "geo_galleries",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "tags": ["updated", "tags"],
    "cover_image_id": 789
}
```

---

### Delete Gallery

| Property | Value |
|----------|-------|
| **Route** | `DELETE /api/v1/galleries/{id}` |
| **Named Route** | `galleries.delete` |
| **Handler** | `gallery::delete_gallery` |
| **Auth Required** | Yes |

**Note:** Cascade deletes all pictures in the gallery.

---

### Like Gallery

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/galleries/{id}/likes` |
| **Named Route** | `galleries.likes` |
| **Handler** | `gallery_like::like_gallery` |
| **Auth Required** | Yes |

**Success Response (201 Created):**
```json
{
    "message": "Gallery liked"
}
```

---

### Unlike Gallery

| Property | Value |
|----------|-------|
| **Route** | `DELETE /api/v1/galleries/{id}/likes` |
| **Named Route** | `galleries.likes` |
| **Handler** | `gallery_like::unlike_gallery` |
| **Auth Required** | Yes |

---

### Reorder Galleries

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/galleries/reorder` |
| **Named Route** | `galleries.reorder` |
| **Handler** | `gallery::reorder_galleries` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
    "gallery_ids": [3, 1, 2]
}
```

---

## Geo Gallery Routes (Protected)

Base path: `/api/v1/geo-galleries`

### List Geo Galleries for Map

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/geo-galleries` |
| **Named Route** | `geo_galleries.list` |
| **Handler** | `gallery::get_geo_galleries` |
| **Auth Required** | Yes |

Returns all geo galleries with coordinates for map display.

**Success Response (200 OK):**
```json
{
    "galleries": [
        {
            "id": 1,
            "gallery_uuid": "550e8400-e29b-41d4-a716-446655440000",
            "title": "New York Trip",
            "description": "Photos from NYC",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "tags": ["travel", "city"],
            "cover_image_url": "/api/v1/upload/download/public/abc123-...",
            "picture_count": 15
        }
    ]
}
```

---

### Get Geo Gallery by UUID

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/geo-galleries/{gallery_uuid}` |
| **Named Route** | `geo_galleries.show` |
| **Handler** | `gallery::get_geo_gallery` |
| **Auth Required** | Yes |

**Success Response (200 OK):**
```json
{
    "id": 1,
    "gallery_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": 123,
    "name": "New York Trip",
    "is_public": true,
    "gallery_type": "geo_galleries",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "tags": ["travel"],
    "cover_image_url": "/api/v1/upload/download/public/...",
    "picture_count": 15,
    "is_owner": false
}
```

---

## Geo Places Routes (Mixed Auth)

Base path: `/api/v1/geo-places`

### List Geo Places (Public)

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/geo-places` |
| **Named Route** | `geo_places.list` |
| **Handler** | `geo_place::list_public` |
| **Auth Required** | No |

**Query Parameters:**
- `place_type` - Optional filter: `restaurant`, `cafe`, or `lodging`

**Success Response (200 OK):**
```json
{
    "places": [
        {
            "id": 1,
            "name": "Central Cafe",
            "place_type": "cafe",
            "description": "Great coffee downtown",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "created_at": "2026-01-15T10:30:00Z",
            "image_count": 5
        }
    ]
}
```

---

### List Place Images (Public)

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/geo-places/{id}/images` |
| **Handler** | `geo_place::list_place_images` |
| **Auth Required** | No |

**Success Response (200 OK):**
```json
{
    "images": [
        {
            "id": 1,
            "place_id": 1,
            "url": "/api/v1/upload/download/public/abc123-...",
            "title": "Interior",
            "description": "Main seating area",
            "tag": "interior",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "created_at": "2026-01-15T10:30:00Z"
        }
    ]
}
```

---

### Admin: List All Places

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/admin/geo-places` |
| **Named Route** | `geo_places.admin` |
| **Handler** | `geo_place::list_admin` |
| **Auth Required** | Yes |
| **Permission Required** | Admin (>= 10) |

---

### Admin: Create Place

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/admin/geo-places` |
| **Handler** | `geo_place::create_place` |
| **Auth Required** | Yes |
| **Permission Required** | Admin (>= 10) |

**Request Body:**
```json
{
    "name": "Central Cafe",
    "place_type": "cafe",
    "description": "Great coffee downtown",
    "latitude": 40.7128,
    "longitude": -74.0060
}
```

**Place Types:** `restaurant`, `cafe`, `lodging`

**Success Response (201 Created):**
```json
{
    "id": 1
}
```

---

### Admin: Add Place Image

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/admin/geo-places/{id}/images` |
| **Handler** | `geo_place::add_place_image` |
| **Auth Required** | Yes |
| **Permission Required** | Admin (>= 10) |

**Request Body:**
```json
{
    "upload_id": 456,
    "title": "Interior",
    "description": "Main seating area",
    "tag": "interior",
    "latitude": 40.7128,
    "longitude": -74.0060
}
```

---

## Competition Routes (Mixed Auth)

Base path: `/api/v1/competitions`

### List Competitions (Public)

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/competitions` |
| **Named Route** | `competitions.list` |
| **Handler** | `competitions::list_competitions` |
| **Auth Required** | No |

**Success Response (200 OK):**
```json
{
    "competitions": [
        {
            "id": 1,
            "title": "Summer Photo Contest",
            "description": "Share your best summer photos",
            "start_date": "2026-06-01T00:00:00Z",
            "end_date": "2026-08-31T23:59:59Z",
            "prize_cents": 10000,
            "rules": "All photos must be original...",
            "status": "active",
            "winner_gallery_id": null,
            "winner_user_id": null,
            "awarded_at": null
        }
    ]
}
```

**Status Values:**
- `upcoming` - Not started yet
- `active` - Currently running
- `ended` - Has ended (may not be finalized)

---

### Get Competition with Entries (Public)

| Property | Value |
|----------|-------|
| **Route** | `GET /api/v1/competitions/{id}` |
| **Named Route** | `competitions.show` |
| **Handler** | `competitions::get_competition` |
| **Auth Required** | No |

**Success Response (200 OK):**
```json
{
    "competition": { ... },
    "entries": [
        {
            "gallery_id": 10,
            "user_id": 123,
            "likes_count": 50,
            "admin_votes_count": 3,
            "score": 0.75
        }
    ]
}
```

**Scoring:** `score = (likes_score * 0.5) + (admin_score * 0.5)`

---

### Admin: Create Competition

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/competitions` |
| **Named Route** | `competitions.create` |
| **Handler** | `competitions::create_competition` |
| **Auth Required** | Yes |
| **Permission Required** | Admin (>= 10) |

**Request Body:**
```json
{
    "title": "Summer Photo Contest",
    "description": "Share your best summer photos",
    "start_date": "2026-06-01T00:00:00Z",
    "end_date": "2026-08-31T23:59:59Z",
    "rules": "All photos must be original..."
}
```

**Note:** Prize is automatically set to 10000 cents ($100).

---

### Join Competition (User)

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/competitions/{id}/entries` |
| **Named Route** | `competitions.entries.create` |
| **Handler** | `competitions::join_competition` |
| **Auth Required** | Yes |

**Request Body:**
```json
{
    "gallery_id": 10
}
```

**Validation:**
- Competition must be active
- Gallery must be owned by user, public, geo_galleries type, with coordinates

**Error Responses:**
- `400 Bad Request` - Validation errors
- `409 Conflict` - Gallery already submitted

---

### Admin: Cast Vote

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/competitions/{id}/admin-votes` |
| **Named Route** | `competitions.admin_vote` |
| **Handler** | `competitions::admin_vote` |
| **Auth Required** | Yes |
| **Permission Required** | Admin (>= 10) |

**Request Body:**
```json
{
    "gallery_id": 10
}
```

---

### Admin: Finalize Competition

| Property | Value |
|----------|-------|
| **Route** | `POST /api/v1/competitions/{id}/finalize` |
| **Named Route** | `competitions.finalize` |
| **Handler** | `competitions::finalize_competition` |
| **Auth Required** | Yes |
| **Permission Required** | Admin (>= 10) |

**Validation:**
- End date must have passed
- Must not be already finalized
- Must have at least one entry

**Success Response (200 OK):**
```json
{
    "winner_gallery_id": 10,
    "winner_user_id": 123,
    "score": 0.85,
    "likes_count": 50,
    "admin_votes_count": 5
}
```

---

## Complete Route Summary

### Public Routes (No Auth)

| Method | Route | Name | Description |
|--------|-------|------|-------------|
| POST | `/api/v1/auth/sign-up` | `auth.sign_up` | Register new user |
| POST | `/api/v1/auth/sign-in` | `auth.sign_in` | Login |
| POST | `/api/v1/account/activate-account` | `account.activate` | Activate account |
| POST | `/api/v1/account/forgot-password` | `account.forgot_password` | Request password reset |
| POST | `/api/v1/account/verify-hash` | `account.verify_hash` | Verify hash code |
| POST | `/api/v1/account/reset-password` | `account.reset_password` | Reset password |
| GET | `/api/v1/account/set-password-when-needed` | `account.set_password_when_needed` | Verify set password link |
| POST | `/api/v1/account/set-password-when-needed` | - | Set password |
| GET | `/api/v1/upload/download/public/{uuid}` | `upload.download.public` | Download public file |
| GET | `/api/v1/geo-places` | `geo_places.list` | List geo places |
| GET | `/api/v1/geo-places/{id}/images` | - | List place images |
| GET | `/api/v1/competitions` | `competitions.list` | List competitions |
| GET | `/api/v1/competitions/{id}` | `competitions.show` | Get competition with entries |

### Protected Routes (JWT Required)

| Method | Route | Name | Description |
|--------|-------|------|-------------|
| POST | `/api/v1/password/change-password` | `password.change` | Request password change |
| POST | `/api/v1/password/verify-password-change` | `password.verify_change` | Complete password change |
| GET | `/api/v1/user` | `user.current` | Get current user |
| GET | `/api/v1/user/{id}` | `user.show` | Get user by ID |
| PATCH | `/api/v1/user` | `user.update_partial` | Update user (partial) |
| PUT | `/api/v1/user` | `user.update_full` | Update user (full) |
| POST | `/api/v1/user` | `user.admin_create` | Admin create user |
| PATCH | `/api/v1/user/avatar` | `user.avatar` | Update avatar reference |
| DELETE | `/api/v1/user/{id}` | `user.delete` | Delete user |
| POST | `/api/v1/upload/public` | `upload.public` | Upload public file |
| POST | `/api/v1/upload/private` | `upload.private` | Upload private file |
| POST | `/api/v1/upload/multiple` | `upload.multiple` | Upload multiple files |
| GET | `/api/v1/upload/private/{uuid}` | `upload.private.download` | Download private file |
| DELETE | `/api/v1/upload/{uuid}` | `upload.delete` | Delete upload |
| GET | `/api/v1/upload/user` | `upload.user` | Get user's uploads |
| POST | `/api/v1/upload/avatar` | `upload.avatar` | Upload avatar |
| DELETE | `/api/v1/upload/avatar` | `upload.avatar.delete` | Delete avatar |
| GET | `/api/v1/avatar/{uuid}` | `avatar.get` | Get avatar file |
| POST | `/api/v1/upload/chunked/start` | `upload.chunked.start` | Start chunked upload |
| POST | `/api/v1/upload/chunked/{uuid}/chunk/{index}` | `upload.chunked.chunk` | Upload chunk |
| POST | `/api/v1/upload/chunked/{uuid}/complete` | `upload.chunked.complete` | Complete chunked upload |
| DELETE | `/api/v1/upload/chunked/{uuid}` | `upload.chunked.cancel` | Cancel chunked upload |
| GET | `/api/v1/galleries` | `galleries.list` | List user's galleries |
| POST | `/api/v1/galleries` | `galleries.create` | Create gallery |
| POST | `/api/v1/galleries/reorder` | `galleries.reorder` | Reorder galleries |
| GET | `/api/v1/galleries/{id}` | `galleries.show` | Get gallery |
| PUT | `/api/v1/galleries/{id}` | `galleries.update` | Update gallery |
| DELETE | `/api/v1/galleries/{id}` | `galleries.delete` | Delete gallery |
| POST | `/api/v1/galleries/{id}/likes` | `galleries.likes` | Like gallery |
| DELETE | `/api/v1/galleries/{id}/likes` | `galleries.likes` | Unlike gallery |
| GET | `/api/v1/geo-galleries` | `geo_galleries.list` | List geo galleries for map |
| GET | `/api/v1/geo-galleries/{uuid}` | `geo_galleries.show` | Get geo gallery by UUID |
| POST | `/api/v1/competitions/{id}/entries` | `competitions.entries.create` | Join competition |

### Admin Routes (JWT + Admin Permission >= 10)

| Method | Route | Name | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/admin/uploads` | `admin.uploads` | List all uploads |
| GET | `/api/v1/admin/assets` | `admin.assets` | List all assets |
| DELETE | `/api/v1/admin/users/{id}/avatar` | `admin.delete_user_avatar` | Delete user's avatar |
| GET | `/api/v1/admin/geo-places` | `geo_places.admin` | List all geo places |
| POST | `/api/v1/admin/geo-places` | - | Create geo place |
| POST | `/api/v1/admin/geo-places/{id}/images` | - | Add place image |
| POST | `/api/v1/competitions` | `competitions.create` | Create competition |
| POST | `/api/v1/competitions/{id}/admin-votes` | `competitions.admin_vote` | Cast admin vote |
| POST | `/api/v1/competitions/{id}/finalize` | `competitions.finalize` | Finalize competition |

### Super Admin Routes (JWT + Super Admin Permission >= 100)

| Method | Route | Name | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/admin/users` | `admin.users` | List all users |
| PATCH | `/api/v1/admin/users/{id}/permissions` | `admin.update_user_permissions` | Update user permissions |

---

## Error Response Format

All API errors follow this format:

```json
{
    "status": "error",
    "message": "Error description"
}
```

**Validation Errors (400 Bad Request):**
```json
{
    "status": "error",
    "message": "Validation failed",
    "errors": {
        "email": ["Invalid email format"],
        "password": ["Password must be at least 8 characters"]
    }
}
```

---

## Named Routes Usage in Rust

```rust
use crate::routes::{route, route_with_lang};
use std::collections::HashMap;

// Simple route
let url = route("auth.sign_up", None);
// Returns: Some("/api/v1/auth/sign-up")

// Route with parameter
let mut params = HashMap::new();
params.insert("id".to_string(), "123".to_string());
let url = route("user.show", Some(&params));
// Returns: Some("/api/v1/user/123")

// Route with multiple parameters
let mut params = HashMap::new();
params.insert("uuid".to_string(), "abc-123".to_string());
params.insert("index".to_string(), "5".to_string());
let url = route("upload.chunked.chunk", Some(&params));
// Returns: Some("/api/v1/upload/chunked/abc-123/chunk/5")
```

---

## Related Documentation

- [Web Routes](../Web/WEB_ROUTES.md) - Web page routes
- [Permissions](../../Permissions/PERMISSIONS.md) - Permission system
- [Uploads](../../Uploads/UPLOADS.md) - Upload system details
- [Controllers](../../Controllers/CONTROLLERS.md) - Controller implementations
- [Geo Galleries](../../GeoGalleries/GEO_GALLERIES.md) - Geo galleries, places, and competitions
