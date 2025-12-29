# Controllers Documentation

This document provides comprehensive documentation for the controller layer in the Money Flow application.

---

## Overview

Controllers are the HTTP layer of the application. They are built from **three key components**:

1. **Middlewares** - Process requests BEFORE they reach controllers (authentication, permissions, CORS, security headers)
2. **Validators** - Define and validate request data structures
3. **Controllers** - Handle business logic and return responses

This three-layer approach ensures clean separation of concerns:
- Middlewares handle cross-cutting concerns (auth, logging, security)
- Validators ensure data integrity
- Controllers focus on business logic

---

## Request Flow Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       COMPLETE REQUEST FLOW                                 │
└────────────────────────────────────────────────────────────────────────────┘

                              HTTP Request
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BOOTSTRAP MIDDLEWARE LAYER                                │
│  Location: bootstrap/middleware/controllers/                                 │
│                                                                              │
│  1. CORS (cors.rs)              - Cross-Origin Resource Sharing             │
│  2. Security Headers            - X-Content-Type-Options, etc.              │
│  3. Tracing Logger              - Request/response logging                  │
│  4. JSON Error Handler          - Parse JSON error responses                │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROUTE-LEVEL MIDDLEWARE LAYER                              │
│  Applied via: .wrap(from_fn(middleware))                                     │
│                                                                              │
│  5. JWT Auth (auth.rs)          - Validates token, extracts user_id         │
│  6. Permission (permission.rs)  - Checks user permission level              │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTROLLER LAYER                                     │
│  Location: app/http/api/controllers/ or app/http/web/controllers/           │
│                                                                              │
│  1. Parse request body using VALIDATORS (auth.rs, user.rs)                  │
│  2. Validate data (field presence, format, business rules)                  │
│  3. Execute business logic (database, events, queue)                        │
│  4. Return response                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌─────────────────┐         ┌─────────────────┐
          │  JSON Response  │         │  HTML Response  │
          │   (REST API)    │         │ (Tera Template) │
          └─────────────────┘         └─────────────────┘
```

---

## The Three Components

### 1. Middlewares

Middlewares process requests before they reach controllers. They can:
- Block requests (auth failure, permission denied)
- Add data to request extensions (user_id, permissions)
- Log request/response
- Add security headers

**Location:** `bootstrap/middleware/controllers/`

| Middleware | File | Purpose |
|------------|------|---------|
| CORS | `cors.rs` | Cross-origin resource sharing |
| Security Headers | `security_headers.rs` | Add security HTTP headers |
| Tracing Logger | `tracing_logger.rs` | Log requests/responses |
| JSON Error Handler | `json_error.rs` | Format JSON parse errors |
| JWT Auth | `auth.rs` | Validate JWT token, extract user |
| Permission | `permission.rs` | Check permission levels |

### 2. Validators

Validators define request data structures and validation rules. They use the `validator` crate with derive macros.

**Location:** `app/http/api/validators/`

| Validator | File | Purpose |
|-----------|------|---------|
| SignupRequest | `auth.rs` | Sign-up form validation |
| SigninRequest | `auth.rs` | Sign-in form validation |
| validate_password() | `auth.rs` | Password strength rules |
| PatchUserRequest | `user.rs` | Full user update validation |
| PutUserRequest | `user.rs` | Partial user update validation |

### 3. Controllers

Controllers contain the business logic. They receive validated data and return responses.

**Location:** `app/http/api/controllers/` and `app/http/web/controllers/`

| Controller | File | Purpose |
|------------|------|---------|
| AuthController | `auth.rs` | Sign-up, sign-in |
| UserController | `user.rs` | User CRUD |
| UploadController | `upload.rs` | File operations |
| AdminController | `admin.rs` | Admin operations |
| ActivationController | `activation.rs` | Account activation, password reset |
| PagesController | `pages.rs` | Web page rendering |

---

## Middlewares In Detail

### JWT Authentication Middleware (`auth.rs`)

Validates JWT tokens and stores user data in request extensions.

**File:** `bootstrap/middleware/controllers/auth.rs`

```rust
pub async fn verify_jwt(
    request: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error>
```

**Flow:**
1. Extract token from `Authorization: Bearer <token>` header OR `auth_token` cookie
2. Decode and validate JWT using secret
3. Store `user_id` (i64) in request extensions
4. Store `permissions` (i16) in request extensions
5. Continue to next middleware/handler

**Token Sources:**
- API calls: `Authorization: Bearer <token>` header
- Browser: `auth_token` cookie (for `<img>` tags loading private files)

**Usage in Routes:**
```rust
use actix_web::middleware::from_fn;
use crate::bootstrap::middleware::controllers::auth::verify_jwt;

cfg.service(
    web::scope("/api/v1/user")
        .wrap(from_fn(verify_jwt))  // Require authentication
        .route("", web::get().to(UserController::get_current))
);
```

**Accessing User in Controller:**
```rust
pub async fn get_current(req: HttpRequest) -> HttpResponse {
    // Get user_id from request extensions (set by middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"))
    };

    // user_id is now available for use
}
```

---

### Permission Middleware (`permission.rs`)

Checks user permission levels for protected routes.

**File:** `bootstrap/middleware/controllers/permission.rs`

**Permission Levels:**
```rust
pub mod levels {
    pub const BASIC: i16 = 1;       // Default user
    pub const ADMIN: i16 = 10;      // Can manage uploads, assets
    pub const AFFILIATE: i16 = 50;  // Future affiliate features
    pub const SUPER_ADMIN: i16 = 100; // Full access
}
```

**Usage in Routes:**
```rust
use crate::bootstrap::middleware::controllers::permission::require_permission;
use crate::bootstrap::middleware::controllers::levels;

cfg.service(
    web::scope("/api/v1/admin")
        .wrap(from_fn(verify_jwt))  // First: authenticate
        .wrap(from_fn(require_permission(levels::ADMIN)))  // Then: check permission
        .route("/uploads", web::get().to(AdminController::list_uploads))
);

cfg.service(
    web::scope("/api/v1/super-admin")
        .wrap(from_fn(verify_jwt))
        .wrap(from_fn(require_permission(levels::SUPER_ADMIN)))
        .route("/users", web::get().to(AdminController::list_users))
);
```

**Access Rules:**
- `ADMIN` (10): Allows Admin (10) or Super Admin (100)
- `SUPER_ADMIN` (100): Allows only Super Admin (100)
- `AFFILIATE` (50): Allows Affiliate (50) or Super Admin (100)

**Helper Functions:**
```rust
use crate::bootstrap::middleware::controllers::{is_admin, is_super_admin, levels};

// Check in controller
if is_admin(permissions) {
    // User is Admin or Super Admin
}

if is_super_admin(permissions) {
    // User is Super Admin only
}

// Get permission name
let name = permission_name(10); // Returns "Admin"
```

---

## Validators In Detail

### Authentication Validators (`auth.rs`)

**File:** `app/http/api/validators/auth.rs`

#### Password Validation

```rust
/// Password must contain:
/// - Minimum 8 characters
/// - At least one uppercase letter
/// - At least one lowercase letter
/// - At least one number
/// - At least one special character
pub fn validate_password(password: &str) -> Vec<String> {
    let mut errors = Vec::new();

    if password.len() < 8 {
        errors.push("minimum 8 characters".to_string());
    }
    if !password.chars().any(|c| c.is_uppercase()) {
        errors.push("at least one uppercase letter".to_string());
    }
    if !password.chars().any(|c| c.is_lowercase()) {
        errors.push("at least one lowercase letter".to_string());
    }
    if !password.chars().any(|c| c.is_numeric()) {
        errors.push("at least one number".to_string());
    }
    if !password.chars().any(|c| !c.is_alphanumeric()) {
        errors.push("at least one special character".to_string());
    }

    errors
}
```

#### Sign-Up Request (Two-Phase Validation)

```rust
// Phase 1: Raw request (allows Optional fields for better error messages)
#[derive(Deserialize, Debug)]
pub struct SignupRequestRaw {
    pub email: Option<String>,
    pub password: Option<String>,
    pub confirm_password: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

// Phase 2: Validated request (all fields required)
#[derive(Debug, Validate)]
pub struct SignupRequest {
    #[validate(email(message = "invalid email format"))]
    pub email: String,
    pub password: String,
    pub confirm_password: String,
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub first_name: String,
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub last_name: String,
}

// Helper: Check password match
pub fn validate_passwords_match(password: &str, confirm_password: &str) -> Option<String> {
    if password != confirm_password {
        Some("passwords do not match".to_string())
    } else {
        None
    }
}
```

**Usage in Controller:**
```rust
pub async fn sign_up(body: web::Json<SignupRequestRaw>) -> HttpResponse {
    let data = body.into_inner();

    // Phase 1: Check required fields
    let mut missing = Vec::new();
    if data.email.is_none() { missing.push("email"); }
    if data.password.is_none() { missing.push("password"); }
    // ... more checks

    if !missing.is_empty() {
        return HttpResponse::BadRequest().json(MissingFieldsResponse {
            status: "error".to_string(),
            message: "Missing required fields".to_string(),
            missing_fields: missing.iter().map(|s| s.to_string()).collect(),
        });
    }

    // Phase 2: Create validated request
    let request = SignupRequest {
        email: data.email.unwrap(),
        password: data.password.unwrap(),
        // ... more fields
    };

    // Phase 3: Validate with validator crate
    if let Err(errors) = request.validate() {
        return HttpResponse::BadRequest().json(ValidationErrorResponse { ... });
    }

    // Phase 4: Custom validation (password strength, passwords match)
    let password_errors = validate_password(&request.password);
    if !password_errors.is_empty() { ... }

    if let Some(err) = validate_passwords_match(&request.password, &request.confirm_password) { ... }

    // All validation passed, proceed with business logic
}
```

---

### User Validators (`user.rs`)

**File:** `app/http/api/validators/user.rs`

#### PATCH Request (Full Update)

```rust
// Raw request
#[derive(Deserialize, Debug)]
pub struct PatchUserRequestRaw {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub balance: Option<i64>,
    pub password: Option<String>,
}

// Validated request (first_name and last_name required)
#[derive(Debug, Validate)]
pub struct PatchUserRequest {
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub first_name: String,
    #[validate(length(min = 2, message = "minimum 2 characters"))]
    pub last_name: String,
    pub balance: Option<i64>,
    pub password: Option<String>,
}

impl PatchUserRequest {
    /// Validate password if provided
    pub fn validate_password_if_present(&self) -> Vec<String> {
        if let Some(ref password) = self.password {
            validate_password(password)
        } else {
            Vec::new()
        }
    }
}
```

#### PUT Request (Partial Update)

```rust
#[derive(Deserialize, Debug, Default)]
pub struct PutUserRequest {
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub balance: Option<i64>,
    #[serde(default)]
    pub password: Option<String>,
}

impl PutUserRequest {
    /// Check if at least one field is provided
    pub fn has_any_field(&self) -> bool {
        self.first_name.is_some()
            || self.last_name.is_some()
            || self.balance.is_some()
            || self.password.is_some()
    }

    /// Validate the fields that are provided
    pub fn validate_fields(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if let Some(ref first_name) = self.first_name {
            if first_name.len() < 2 {
                errors.push("first_name: minimum 2 characters".to_string());
            }
        }

        if let Some(ref last_name) = self.last_name {
            if last_name.len() < 2 {
                errors.push("last_name: minimum 2 characters".to_string());
            }
        }

        if let Some(ref balance) = self.balance {
            if *balance < 0 {
                errors.push("balance: must be non-negative".to_string());
            }
        }

        if let Some(ref password) = self.password {
            let password_errors = validate_password(password);
            for err in password_errors {
                errors.push(format!("password: {}", err));
            }
        }

        errors
    }
}
```

---

## Controller Architecture

---

## File Structure

```
app/http/
├── mod.rs                      # Re-exports api and web modules
├── api/                        # REST API
│   ├── mod.rs                  # Re-exports controllers, validators, middlewares
│   ├── controllers/
│   │   ├── mod.rs              # Re-exports all controllers
│   │   ├── auth.rs             # AuthController: sign_up(), sign_in()
│   │   ├── user.rs             # UserController: CRUD operations
│   │   ├── upload.rs           # UploadController: file operations
│   │   ├── admin.rs            # AdminController: admin operations
│   │   ├── activation.rs       # ActivationController: activation/reset
│   │   └── responses.rs        # Response structures (BaseResponse, etc.)
│   ├── validators/
│   │   ├── mod.rs              # Re-exports validators
│   │   ├── auth.rs             # SignupRequest, SigninRequest, validate_password()
│   │   └── user.rs             # UpdateUserRequest, user field validators
│   └── middlewares/
│       └── mod.rs              # API-specific middlewares
│
└── web/                        # Web Pages
    ├── mod.rs                  # Re-exports web modules
    ├── controllers/
    │   ├── mod.rs
    │   └── pages.rs            # PagesController: page handlers
    ├── validators/
    │   └── mod.rs
    └── middlewares/
        └── mod.rs
```

---

## API Controllers

### AuthController (`auth.rs`)

Handles user authentication (sign-up and sign-in).

**File:** `app/http/api/controllers/auth.rs`

#### Endpoints

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| POST | `/api/v1/auth/sign-up` | `sign_up` | No | Register new user |
| POST | `/api/v1/auth/sign-in` | `sign_in` | No | Login and get JWT |

#### sign_up

Registers a new user with email validation and password requirements.

```rust
pub async fn sign_up(
    state: web::Data<AppState>,
    body: web::Json<SignupRequest>,
) -> HttpResponse
```

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "first_name": "John",
    "last_name": "Doe"
}
```

**Responses:**
- `201 Created`: User created, activation email sent
- `400 Bad Request`: Validation errors (missing fields, invalid format, weak password)
- `409 Conflict`: Email already exists

**Flow:**
1. Validate required fields
2. Validate email format
3. Validate password strength
4. Check if email exists
5. Hash password with bcrypt
6. Create user in database (activated=0)
7. Generate activation hash
8. Queue activation email via RabbitMQ
9. Publish `user.created` Kafka event
10. Return success response

#### sign_in

Authenticates user and returns JWT token.

```rust
pub async fn sign_in(
    state: web::Data<AppState>,
    body: web::Json<SigninRequest>,
) -> HttpResponse
```

**Request Body:**
```json
{
    "email": "user@example.com",
    "password": "SecurePass123!"
}
```

**Responses:**
- `200 OK`: JWT token in response body and `auth_token` cookie
- `400 Bad Request`: Missing fields
- `401 Unauthorized`: Invalid credentials
- `403 Forbidden`: Account not activated

**Flow:**
1. Validate required fields
2. Find user by email
3. Verify password with bcrypt
4. Check if account is activated
5. Generate JWT token with claims (sub=user_id, role="user")
6. Set `auth_token` cookie (HttpOnly, Secure in production)
7. Publish `auth.sign_in` Kafka event
8. Return token and user data

---

### UserController (`user.rs`)

Handles user profile operations.

**File:** `app/http/api/controllers/user.rs`

#### Endpoints

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| GET | `/api/v1/user` | `get_current` | Yes | Get current user profile |
| GET | `/api/v1/user/{id}` | `get_by_id` | Yes | Get user by ID |
| PATCH | `/api/v1/user` | `update_full` | Yes | Full update (first_name, last_name required) |
| PUT | `/api/v1/user` | `update_partial` | Yes | Partial update (any field) |
| POST | `/api/v1/user` | `admin_create` | Yes | Admin creates user |
| DELETE | `/api/v1/user/{id}` | `delete` | Yes | Delete user |
| PATCH | `/api/v1/user/avatar` | `update_avatar` | Yes | Update avatar UUID |

#### get_current

Gets the authenticated user's profile from JWT.

```rust
pub async fn get_current(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> HttpResponse
```

**Response:**
```json
{
    "status": "success",
    "message": "User retrieved successfully",
    "user": {
        "id": 1,
        "email": "user@example.com",
        "first_name": "John",
        "last_name": "Doe",
        "balance": 1000,
        "permissions": 1,
        "avatar_uuid": "550e8400-e29b-41d4-a716-446655440000",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
    }
}
```

#### update_full (PATCH)

Full update requiring first_name and last_name.

```rust
pub async fn update_full(
    state: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<PatchUserRequestRaw>,
) -> HttpResponse
```

**Request Body:**
```json
{
    "first_name": "John",
    "last_name": "Doe",
    "balance": 1000,
    "password": "NewPassword123!"
}
```

**Notes:**
- `first_name` and `last_name` are required
- `balance` and `password` are optional
- Email is NOT updatable

#### update_partial (PUT)

Partial update requiring at least one field.

```rust
pub async fn update_partial(
    state: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<PutUserRequest>,
) -> HttpResponse
```

**Request Body:**
```json
{
    "first_name": "John"
}
```

**Notes:**
- At least one field required
- Only provided fields are updated

#### admin_create

Admin creates a user with `user_must_set_password=1` and `activated=0`.

```rust
pub async fn admin_create(
    state: web::Data<AppState>,
    req: HttpRequest,
    body: web::Json<AdminCreateUserRequestRaw>,
) -> HttpResponse
```

**Request Body:**
```json
{
    "email": "newuser@example.com",
    "password": "TempPassword123!",
    "first_name": "Jane",
    "last_name": "Smith"
}
```

**Flow:**
1. Validate admin is authenticated
2. Validate all required fields
3. Check if user exists
4. Create user with `user_must_set_password=1`, `activated=0`
5. Generate activation hash
6. Queue password setup email

---

### UploadController (`upload.rs`)

Handles file upload and download operations.

**File:** `app/http/api/controllers/upload.rs`

#### Endpoints

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| POST | `/api/v1/upload/public` | `upload_public` | Yes | Upload public file |
| POST | `/api/v1/upload/private` | `upload_private` | Yes | Upload private file |
| POST | `/api/v1/upload/multiple` | `upload_multiple` | Yes | Upload multiple files |
| GET | `/api/v1/upload/download/public/{uuid}` | `download_public` | No | Download public file |
| GET | `/api/v1/upload/private/{uuid}` | `download_private` | Yes | Download private file |
| DELETE | `/api/v1/upload/{uuid}` | `delete` | Yes | Delete upload |
| POST | `/api/v1/upload/chunked/start` | `start_chunked_upload` | Yes | Start chunked upload |
| POST | `/api/v1/upload/chunked/{uuid}/chunk/{index}` | `upload_chunk` | Yes | Upload chunk |
| POST | `/api/v1/upload/chunked/{uuid}/complete` | `complete_chunked_upload` | Yes | Complete chunked |
| DELETE | `/api/v1/upload/chunked/{uuid}` | `cancel_chunked_upload` | Yes | Cancel chunked |
| GET | `/api/v1/upload/user` | `get_user_uploads` | Yes | Get user's uploads |
| POST | `/api/v1/upload/avatar` | `upload_avatar` | Yes | Upload profile picture |
| DELETE | `/api/v1/upload/avatar` | `delete_avatar` | Yes | Delete profile picture |
| GET | `/api/v1/avatar/{uuid}` | `get_avatar` | Yes | Get profile picture |

#### upload_public / upload_private

Upload a single file with public or private visibility.

```rust
pub async fn upload_public(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: Multipart,
) -> HttpResponse
```

**Request:** Multipart form data with `file` field

**Response:**
```json
{
    "status": "success",
    "message": "File uploaded successfully",
    "upload": {
        "uuid": "550e8400-e29b-41d4-a716-446655440000",
        "original_name": "photo.jpg",
        "extension": "jpg",
        "mime_type": "image/jpeg",
        "size_bytes": 102400,
        "storage_type": "public",
        "url": "/api/v1/upload/download/public/550e8400...",
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

#### download_private

Downloads a private file with authentication via header OR cookie.

```rust
pub async fn download_private(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
) -> HttpResponse
```

**Notes:**
- Supports `Authorization: Bearer <token>` header (API calls)
- Supports `auth_token` cookie (browser `<img>` tags)
- Verifies user ownership

#### start_chunked_upload

Start a chunked upload session for large files.

```rust
pub async fn start_chunked_upload(
    req: HttpRequest,
    body: web::Json<StartChunkedUploadRequest>,
) -> HttpResponse
```

**Request Body:**
```json
{
    "filename": "large-video.mp4",
    "total_chunks": 100,
    "total_size": 104857600,
    "storage_type": "private"
}
```

**Response:**
```json
{
    "status": "success",
    "message": "Chunked upload session started",
    "session_uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### ActivationController (`activation.rs`)

Handles account activation and password reset.

**File:** `app/http/api/controllers/activation.rs`

#### Endpoints

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| POST | `/api/v1/account/activate-account` | `activate_account` | No | Activate with code |
| POST | `/api/v1/account/forgot-password` | `forgot_password` | No | Request reset code |
| POST | `/api/v1/account/verify-hash` | `verify_hash` | No | Verify hash code |
| POST | `/api/v1/account/reset-password` | `reset_password` | No | Reset password |
| GET | `/api/v1/account/set-password-when-needed` | `verify_set_password_link` | No | Verify admin link |
| POST | `/api/v1/account/set-password-when-needed` | `set_password_when_needed` | No | Set password |
| POST | `/api/v1/password/change-password` | `request_change_password` | Yes | Request change |
| POST | `/api/v1/password/verify-password-change` | `verify_and_change_password` | Yes | Complete change |

#### activate_account

Activates user account with 20-character activation code.

```rust
pub async fn activate_account(
    state: web::Data<AppState>,
    body: web::Json<ActivateAccountRequest>,
) -> HttpResponse
```

**Request Body:**
```json
{
    "code": "ABCD1234567890EFGHIJ"
}
```

**Flow:**
1. Validate code format (20 characters)
2. Find activation hash
3. Verify hash is valid (not expired, not used)
4. Set user `activated=1`
5. Mark hash as used
6. Send activation success email

#### forgot_password

Request password reset (always returns success for security).

```rust
pub async fn forgot_password(
    state: web::Data<AppState>,
    body: web::Json<ForgotPasswordRequest>,
) -> HttpResponse
```

**Request Body:**
```json
{
    "email": "user@example.com"
}
```

**Notes:**
- Always returns success (prevents email enumeration)
- If email exists, sends reset code
- For testing: `return_code_for_testing: true` returns code in response

#### reset_password

Reset password using verified hash code.

```rust
pub async fn reset_password(
    state: web::Data<AppState>,
    body: web::Json<ResetPasswordRequestRaw>,
) -> HttpResponse
```

**Request Body:**
```json
{
    "code": "ABCD1234567890EFGHIJ",
    "password": "NewPassword123!",
    "confirm_password": "NewPassword123!"
}
```

**Validation:**
- Code must be valid and not expired
- Password must meet strength requirements
- Passwords must match

---

### AdminController (`admin.rs`)

Protected admin operations requiring elevated permissions.

**File:** `app/http/api/controllers/admin.rs`

#### Endpoints

| Method | Endpoint | Handler | Permission | Description |
|--------|----------|---------|------------|-------------|
| GET | `/api/v1/admin/uploads` | `list_uploads` | Admin (10+) | List all uploads |
| GET | `/api/v1/admin/assets` | `list_assets` | Admin (10+) | List all assets |
| GET | `/api/v1/admin/users` | `list_users` | Super Admin (100) | List all users |
| DELETE | `/api/v1/admin/users/{id}/avatar` | `delete_user_avatar` | Admin (10+) | Delete user avatar |
| PATCH | `/api/v1/admin/users/{id}/permissions` | `update_user_permissions` | Super Admin (100) | Update permissions |

#### list_uploads

List all uploads with pagination and filtering.

```rust
pub async fn list_uploads(
    state: web::Data<AppState>,
    query: web::Query<UploadListQuery>,
) -> HttpResponse
```

**Query Parameters:**
- `limit`: Max results (default 50, max 100)
- `offset`: Skip count (default 0)
- `storage_type`: Filter by "public" or "private"
- `search`: Search by filename

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

#### update_user_permissions

Update user's permission level (Super Admin only).

```rust
pub async fn update_user_permissions(
    state: web::Data<AppState>,
    path: web::Path<i64>,
    body: web::Json<UpdatePermissionsRequest>,
) -> HttpResponse
```

**Request Body:**
```json
{
    "permissions": 10
}
```

**Valid Levels:** 1 (Basic), 10 (Admin), 50 (Affiliate), 100 (Super Admin)

---

## Web Controllers

### PagesController (`pages.rs`)

Handles web page rendering with Tera templates.

**File:** `app/http/web/controllers/pages.rs`

#### Endpoints

| Method | Endpoint | Handler | Auth | Description |
|--------|----------|---------|------|-------------|
| GET | `/` | `homepage` | No | Homepage |
| GET | `/sign-up` | `sign_up` | No | Sign up page |
| GET | `/sign-in` | `sign_in` | No | Sign in page |
| GET | `/forgot-password` | `forgot_password` | No | Forgot password page |
| GET | `/profile` | `profile` | Yes | User profile page |
| GET | `/logout` | `logout` | Yes | Logout (clears cookie) |
| GET | `/uploads` | `uploads` | Admin | Uploads admin page |
| GET | `/registered-users` | `registered_users` | Super Admin | Users admin page |

#### Key Methods

##### base_context

Creates base template context with common variables.

```rust
fn base_context(req: &HttpRequest) -> Context {
    let auth = is_logged(req);
    let mut context = Context::new();
    context.insert("base_url", &Self::get_base_url(req));
    context.insert("year", &chrono::Utc::now().format("%Y").to_string());
    context.insert("app_name", "MoneyFlow");
    context.insert("is_logged", &auth.is_logged);
    context.insert("is_admin", &auth.is_admin());
    context.insert("is_super_admin", &auth.is_super_admin());
    context.insert("theme", &Self::get_theme(req));
    context.insert("assets_version", get_assets_version());
    context.insert("images_version", get_images_version());
    context
}
```

##### render

Renders a Tera template with error handling.

```rust
fn render(template: &str, context: &Context) -> HttpResponse {
    match WEB_TEMPLATES.render(template, context) {
        Ok(html) => HttpResponse::Ok().content_type("text/html").body(html),
        Err(e) => HttpResponse::InternalServerError()
            .body(format!("<h1>500 Error</h1><p>{}</p>", e))
    }
}
```

##### profile

Profile page with user data from database.

```rust
pub async fn profile(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> Result<HttpResponse> {
    let auth = is_logged(&req);
    if !auth.is_logged {
        return Ok(Self::redirect("/sign-in"));
    }

    let mut context = Self::base_context(&req);

    if let Some(user_id) = auth.user_id {
        let db = state.db.lock().await;
        if let Ok(user) = db_user::get_by_id(&db, user_id).await {
            let template_user = TemplateUser {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                avatar_url: user.avatar_uuid.map(|u| format!("/api/v1/avatar/{}", u)),
            };
            context.insert("user", &template_user);
        }
    }

    Ok(Self::render("profile.html", &context))
}
```

---

## Response Structures

### BaseResponse

Standard API response structure.

```rust
#[derive(Serialize)]
pub struct BaseResponse {
    pub status: String,
    pub message: String,
}

impl BaseResponse {
    pub fn success(message: &str) -> Self {
        Self { status: "success".to_string(), message: message.to_string() }
    }

    pub fn error(message: &str) -> Self {
        Self { status: "error".to_string(), message: message.to_string() }
    }
}
```

### ValidationErrorResponse

Response for validation errors.

```rust
#[derive(Serialize)]
pub struct ValidationErrorResponse {
    pub status: String,
    pub message: String,
    pub errors: HashMap<String, Vec<String>>,
}
```

### MissingFieldsResponse

Response for missing required fields.

```rust
#[derive(Serialize)]
pub struct MissingFieldsResponse {
    pub status: String,
    pub message: String,
    pub missing_fields: Vec<String>,
}
```

### UserDto

Data transfer object for user data.

```rust
#[derive(Serialize)]
pub struct UserDto {
    pub id: i64,
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub balance: i64,
    pub permissions: i16,
    pub avatar_uuid: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
```

---

## Creating New Components

This section explains how to create new middlewares, validators, and controllers.

### Creating a New Validator

**Step 1:** Create validator file `app/http/api/validators/my_feature.rs`:

```rust
//! My Feature Validators
//!
//! Validation rules for my feature requests.

use serde::Deserialize;
use validator::Validate;

/// Raw request (allows Optional fields for better error messages)
#[derive(Deserialize, Debug)]
pub struct CreateMyFeatureRequestRaw {
    pub name: Option<String>,
    pub value: Option<i64>,
    pub optional_field: Option<String>,
}

/// Validated request (required fields are non-Option)
#[derive(Debug, Validate)]
pub struct CreateMyFeatureRequest {
    #[validate(length(min = 2, max = 100, message = "name must be 2-100 characters"))]
    pub name: String,
    pub value: i64,
    pub optional_field: Option<String>,
}

impl CreateMyFeatureRequest {
    /// Custom validation logic
    pub fn validate_value(&self) -> Option<String> {
        if self.value < 0 {
            Some("value must be non-negative".to_string())
        } else {
            None
        }
    }
}
```

**Step 2:** Export in `app/http/api/validators/mod.rs`:

```rust
pub mod auth;
pub mod user;
pub mod my_feature;  // Add this

pub use my_feature::{CreateMyFeatureRequestRaw, CreateMyFeatureRequest};
```

---

### Creating a New Middleware

**Step 1:** Create middleware file `bootstrap/middleware/controllers/my_middleware.rs`:

```rust
//! My Middleware
//!
//! Custom middleware for specific functionality.

use actix_web::{
    body::BoxBody,
    dev::{ServiceRequest, ServiceResponse},
    middleware::Next,
    HttpMessage, HttpResponse,
};

use crate::app::http::api::controllers::responses::BaseResponse;

/// Helper to create error response
fn error_response(request: ServiceRequest, message: &'static str) -> ServiceResponse<BoxBody> {
    let response = HttpResponse::Forbidden().json(BaseResponse::error(message));
    request.into_response(response).map_into_boxed_body()
}

/// Middleware that checks a custom condition
pub async fn my_custom_check(
    request: ServiceRequest,
    next: Next<BoxBody>,
) -> Result<ServiceResponse<BoxBody>, actix_web::Error> {
    // Example: Check a custom header
    let has_required_header = request.headers().contains_key("X-Custom-Header");

    if !has_required_header {
        return Ok(error_response(request, "Missing required header"));
    }

    // Add data to request extensions if needed
    request.extensions_mut().insert("custom_data".to_string());

    // Continue to next middleware/handler
    next.call(request).await
}

/// Factory function for configurable middleware
pub fn require_feature_flag(
    flag_name: &'static str,
) -> impl Fn(
    ServiceRequest,
    Next<BoxBody>,
) -> std::pin::Pin<
    Box<dyn std::future::Future<Output = Result<ServiceResponse<BoxBody>, actix_web::Error>>>,
> + Clone {
    move |request: ServiceRequest, next: Next<BoxBody>| {
        let flag = flag_name;
        Box::pin(async move {
            // Check if feature flag is enabled (example logic)
            let is_enabled = check_feature_flag(flag);

            if !is_enabled {
                return Ok(error_response(request, "Feature not enabled"));
            }

            next.call(request).await
        })
    }
}
```

**Step 2:** Export in `bootstrap/middleware/controllers/mod.rs`:

```rust
pub mod auth;
pub mod cors;
pub mod json_error;
pub mod permission;
pub mod security_headers;
pub mod tracing_logger;
pub mod my_middleware;  // Add this

pub use my_middleware::{my_custom_check, require_feature_flag};
```

---

### Creating a New Controller

**Step 1:** Create Controller File

Create `app/http/api/controllers/my_controller.rs`:

```rust
//! My Controller
//!
//! Handles my feature operations.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::app::http::api::controllers::responses::BaseResponse;
use crate::database::AppState;

pub struct MyController;

#[derive(Deserialize)]
pub struct MyRequest {
    pub field: String,
}

impl MyController {
    /// GET /api/v1/my-feature - Get something
    pub async fn get_something(
        state: web::Data<AppState>,
        req: HttpRequest,
    ) -> HttpResponse {
        // Get user ID from JWT (set by auth middleware)
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized()
                    .json(BaseResponse::error("Unauthorized"));
            }
        };

        // Your logic here
        let db = state.db.lock().await;

        HttpResponse::Ok().json(BaseResponse::success("Success"))
    }

    /// POST /api/v1/my-feature - Create something
    pub async fn create_something(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<MyRequest>,
    ) -> HttpResponse {
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized()
                    .json(BaseResponse::error("Unauthorized"));
            }
        };

        let data = body.into_inner();

        // Validation
        if data.field.is_empty() {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("field is required"));
        }

        // Business logic
        let db = state.db.lock().await;

        HttpResponse::Created().json(BaseResponse::success("Created"))
    }
}
```

### Step 2: Export Controller

In `app/http/api/controllers/mod.rs`:

```rust
pub mod auth;
pub mod user;
pub mod upload;
pub mod admin;
pub mod activation;
pub mod responses;
pub mod my_controller;  // Add this

pub use auth::AuthController;
pub use user::UserController;
pub use upload::UploadController;
pub use admin::AdminController;
pub use activation::ActivationController;
pub use my_controller::MyController;  // Add this
```

### Step 3: Register Routes

In `bootstrap/routes/controller/api.rs`:

```rust
use crate::app::http::api::controllers::MyController;

// In register() function
cfg.service(
    web::scope("/api/v1/my-feature")
        .wrap(from_fn(middleware::auth::verify_jwt))
        .route("", web::get().to(MyController::get_something))
        .route("", web::post().to(MyController::create_something))
);
```

---

## Best Practices

1. **Always validate input** - Use the validator crate and custom validation
2. **Check authentication** - Get user_id from `req.extensions()`
3. **Use consistent responses** - Use `BaseResponse`, `ValidationErrorResponse`
4. **Log errors** - Use `tracing::error!` for server errors
5. **Don't expose internal errors** - Return generic messages to users
6. **Publish events** - Use Kafka for important actions
7. **Queue side effects** - Use RabbitMQ for emails, external calls

---

## Related Documentation

- [API Routes](../Routes/Api/API_ROUTES.md) - Route definitions
- [Permissions](../Permissions/PERMISSIONS.md) - Permission middleware
- [Templates](../Templates/TEMPLATES.md) - Tera templates
- [Database](../Database/DATABASE.md) - Database queries
