# API Routes Overview

## Summary

Blazing Sun has **65+ API endpoints** organized into 9 scopes, providing RESTful interfaces for authentication, user management, file uploads, galleries, theme configuration, and admin operations.

---

## API Scopes

| Scope | Base Path | Endpoints | Middleware | Purpose |
|-------|-----------|-----------|------------|---------|
| **Auth** | `/api/v1/auth` | 2 | None | Registration and login |
| **Account** | `/api/v1/account` | 6 | None (public) | Account activation and password reset |
| **Password** | `/api/v1/password` | 2 | JWT | Password management |
| **Email** | `/api/v1/email` | 3 | JWT | Email change verification |
| **User** | `/api/v1/user` | 7 | JWT | User profile management |
| **Upload** | `/api/v1/upload` | 13 | JWT (mixed) | File upload/download |
| **Galleries** | `/api/v1/galleries` | 11 | JWT | Gallery and picture management |
| **Admin** | `/api/v1/admin` | 18+ | JWT + Permission | Admin operations |
| **Avatar** | `/api/v1/avatar` | 1 | JWT | Avatar retrieval |

---

## Authentication & Authorization

### Middleware Layers

1. **Public Routes** - No authentication required
   - Auth endpoints (`/api/v1/auth/*`)
   - Account activation (`/api/v1/account/*`)
   - Public downloads (`/api/v1/upload/download/public/*`)

2. **JWT Protected** - Valid JWT token required
   - User operations (`/api/v1/user/*`)
   - Upload operations (`/api/v1/upload/*`)
   - Gallery operations (`/api/v1/galleries/*`)

3. **Admin Protected** - JWT + Admin permission (level 10+)
   - Theme configuration (`/api/v1/admin/theme/*`)
   - SEO management (`/api/v1/admin/seo/*`)
   - Upload management (`/api/v1/admin/upload/*`)

4. **Super Admin Protected** - JWT + Super Admin permission (level 100)
   - User management (`/api/v1/admin/users/*`)
   - Permission updates

### JWT Token Flow

```
1. User signs in → POST /api/v1/auth/sign-in
   ↓
2. Server returns JWT token → Stored in HttpOnly cookie
   ↓
3. Client makes authenticated request → Cookie sent automatically
   ↓
4. Middleware validates token → Extracts user ID and permissions
   ↓
5. Controller processes request with user context
```

---

## Response Format

### Success Response
```json
{
  "status": "success",
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Optional additional details
  }
}
```

### Pagination Response
```json
{
  "status": "success",
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "per_page": 20,
    "total_pages": 5
  }
}
```

---

## Key Endpoints by Feature

### Authentication
- `POST /api/v1/auth/sign-up` - User registration
- `POST /api/v1/auth/sign-in` - User login

### User Profile
- `GET /api/v1/user` - Get current user
- `PATCH /api/v1/user` - Update profile (partial)
- `PUT /api/v1/user` - Update profile (full)
- `PATCH /api/v1/user/avatar` - Update avatar

### File Uploads
- `POST /api/v1/upload/public` - Upload public file
- `POST /api/v1/upload/private` - Upload private file
- `POST /api/v1/upload/multiple` - Upload multiple files
- `GET /api/v1/upload/download/public/{uuid}` - Download public file
- `GET /api/v1/upload/private/{uuid}` - Download private file (auth required)

### Galleries
- `GET /api/v1/galleries` - List user galleries
- `POST /api/v1/galleries` - Create gallery
- `GET /api/v1/galleries/{id}` - Get gallery details
- `PUT /api/v1/galleries/{id}` - Update gallery
- `DELETE /api/v1/galleries/{id}` - Delete gallery
- `POST /api/v1/galleries/{id}/pictures` - Add pictures to gallery
- `DELETE /api/v1/galleries/{gallery_id}/pictures/{picture_id}` - Remove picture

### Theme Configuration
- `GET /api/v1/admin/theme` - Get theme config
- `PUT /api/v1/admin/theme` - Update theme config
- `POST /api/v1/admin/theme/build` - Trigger SCSS build
- `GET /api/v1/admin/theme/build/status` - Check build status

### SEO Management
- `GET /api/v1/admin/seo` - List all page SEO configs
- `GET /api/v1/admin/seo/{route_name}` - Get SEO for specific page
- `PUT /api/v1/admin/seo/{route_name}` - Update SEO
- `PATCH /api/v1/admin/seo/{route_name}/toggle` - Toggle active status

---

## Request/Response Examples

### User Registration
```http
POST /api/v1/auth/sign-up
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "password_confirmation": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe"
}

Response:
{
  "status": "success",
  "data": {
    "user_id": 42,
    "email": "user@example.com",
    "activation_required": true
  }
}
```

### File Upload
```http
POST /api/v1/upload/public
Content-Type: multipart/form-data
Authorization: Bearer {JWT_TOKEN}

file: (binary data)

Response:
{
  "status": "success",
  "data": {
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "original_name": "photo.jpg",
    "mime_type": "image/jpeg",
    "size_bytes": 1048576,
    "storage_type": "public",
    "upload_status": "completed",
    "variants": [
      {"name": "thumb", "width": 160, "height": 160},
      {"name": "small", "width": 320, "height": 240},
      ...
    ]
  }
}
```

### Update Theme
```http
PUT /api/v1/admin/theme
Content-Type: application/json
Authorization: Bearer {JWT_TOKEN}

{
  "scss_variables": {
    "primary-color": "#667eea",
    "secondary-color": "#764ba2"
  },
  "theme_light": {
    "--color-primary": "#667eea",
    "--color-secondary": "#764ba2"
  }
}

Response:
{
  "status": "success",
  "message": "Theme configuration updated successfully"
}
```

---

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `AUTH_REQUIRED` | Authentication required | 401 |
| `INVALID_TOKEN` | Invalid or expired JWT token | 401 |
| `PERMISSION_DENIED` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `VALIDATION_ERROR` | Input validation failed | 422 |
| `SERVER_ERROR` | Internal server error | 500 |
| `EMAIL_IN_USE` | Email already registered | 409 |
| `INVALID_CREDENTIALS` | Invalid email or password | 401 |
| `FILE_TOO_LARGE` | File exceeds size limit | 413 |
| `UNSUPPORTED_FILE_TYPE` | File type not allowed | 415 |

---

## Rate Limiting

Currently **not implemented**, but planned for:
- Authentication endpoints (5 requests per minute)
- Upload endpoints (10 uploads per minute)
- Admin endpoints (30 requests per minute)

---

## CORS Configuration

CORS is enabled for all API routes with the following settings:
- **Allowed Origins**: Configurable via `CORS_ALLOWED_ORIGINS` environment variable
- **Allowed Methods**: GET, POST, PUT, PATCH, DELETE, OPTIONS
- **Allowed Headers**: Content-Type, Authorization
- **Credentials**: Allowed (for cookie-based JWT)
- **Max Age**: 3600 seconds

---

## API Versioning

Current API version: **v1**

Future versions will be introduced at new base paths:
- `/api/v2/...`
- `/api/v3/...`

Version 1 will be maintained for backward compatibility.

---

## Testing

### Manual Testing with cURL

```bash
# Sign up
curl -X POST http://localhost:9999/api/v1/auth/sign-up \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!","password_confirmation":"SecurePass123!","first_name":"Test","last_name":"User"}'

# Sign in
curl -X POST http://localhost:9999/api/v1/auth/sign-in \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"SecurePass123!"}'

# Get current user (with cookie)
curl -X GET http://localhost:9999/api/v1/user \
  -b cookies.txt
```

### Automated Tests

**Location**: `/blazing_sun/tests/routes/api/`

```bash
# Run all API tests
cargo test --test integration

# Run specific test file
cargo test --test integration -- routes::api::SIGN_IN
```

---

## Performance Metrics

| Endpoint Type | Target Response Time | Current |
|---------------|---------------------|---------|
| Read operations | < 100ms | TBD |
| Write operations | < 500ms | TBD |
| File uploads | < 5s | TBD |
| Theme build | < 10s | TBD |

---

## Related Documentation

- [Authentication System](../../Backend/Middleware/auth.md)
- [Permission System](../../Backend/Middleware/permission.md)
- [Upload System](../../AdminUploads/)
- [Theme System](../../Backend/Theme/)
- Individual API endpoint documentation in this directory

---

**Location**: `/home/milner/Desktop/rust/blazing_sun/src/routes/api.rs`
**Controllers**: `/home/milner/Desktop/rust/blazing_sun/src/app/http/api/controllers/`

**Last Updated**: 2026-01-02
