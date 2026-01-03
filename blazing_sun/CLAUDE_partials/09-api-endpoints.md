# API Endpoints

## Authentication (No Auth Required)

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| POST | `/api/v1/auth/sign-up` | `AuthController::sign_up` | Register new user |
| POST | `/api/v1/auth/sign-in` | `AuthController::sign_in` | Login, get JWT |

## Account (No Auth Required)

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| POST | `/api/v1/account/activate-account` | `ActivationController::activate_account` | Activate with code |
| POST | `/api/v1/account/forgot-password` | `ActivationController::forgot_password` | Request reset code |
| POST | `/api/v1/account/reset-password` | `ActivationController::reset_password` | Reset with code |

## User (Auth Required)

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| GET | `/api/v1/user` | `UserController::get_current` | Get current user |
| PATCH | `/api/v1/user` | `UserController::update_partial` | Update some fields |
| PUT | `/api/v1/user` | `UserController::update_full` | Update all fields |
| DELETE | `/api/v1/user/{id}` | `UserController::delete` | Delete user |

## File Upload (Auth Required)

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| POST | `/api/v1/upload/single` | `UploadController::single` | Single file |
| POST | `/api/v1/upload/multiple` | `UploadController::multiple` | Multiple files |
| POST | `/api/v1/upload/chunk/init` | `UploadController::chunk_init` | Init chunked |
| POST | `/api/v1/upload/chunk/upload` | `UploadController::chunk_upload` | Upload chunk |
| POST | `/api/v1/upload/chunk/complete` | `UploadController::chunk_complete` | Complete chunked |
| GET | `/api/v1/upload/chunk/status/{id}` | `UploadController::chunk_status` | Get status |
| GET | `/api/v1/upload/private/{uuid}` | `UploadController::download_private` | Download private |
| DELETE | `/api/v1/upload/{uuid}` | `UploadController::delete` | Delete upload |

## File Download (No Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/upload/download/public/{uuid}` | Download public file |
| GET | `/storage/{filename}` | Static file (nginx) |

## Admin Theme & SEO (Admin Required - permission >= 10)

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| GET | `/api/v1/admin/theme` | `ThemeController::get` | Get theme config |
| PUT | `/api/v1/admin/theme` | `ThemeController::update` | Update theme + rebuild |
| PUT | `/api/v1/admin/theme/branding` | `ThemeController::update_branding` | Update branding |
| POST | `/api/v1/admin/theme/build` | `ThemeController::trigger_build` | Manual rebuild |
| GET | `/api/v1/admin/theme/build/status` | `ThemeController::build_status` | Build status |
| GET | `/api/v1/admin/seo` | `ThemeController::seo_list` | List all page SEO |
| GET | `/api/v1/admin/seo/{route_name}` | `ThemeController::seo_get` | Get page SEO |
| PUT | `/api/v1/admin/seo/{route_name}` | `ThemeController::seo_update` | Update page SEO |
| PATCH | `/api/v1/admin/seo/{route_name}/toggle` | `ThemeController::seo_toggle_active` | Toggle active |
| GET | `/api/v1/admin/seo/page/{id}/schemas` | `ThemeController::schema_list` | List schemas |
| POST | `/api/v1/admin/seo/page/{id}/schemas` | `ThemeController::schema_create` | Create schema |
| GET | `/api/v1/admin/seo/schema/{id}` | `ThemeController::schema_get` | Get schema |
| PUT | `/api/v1/admin/seo/schema/{id}` | `ThemeController::schema_update` | Update schema |
| DELETE | `/api/v1/admin/seo/schema/{id}` | `ThemeController::schema_delete` | Delete schema |
