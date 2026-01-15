# Profile Page Route

## Overview

The profile page allows authenticated users to manage their personal information, avatar, password, and email address through a comprehensive 4-tab interface.

---

## Route Details

| Property | Value |
|----------|-------|
| **Path** | `/profile` |
| **Method** | GET |
| **Named Route** | `web.profile` |
| **Auth Required** | Yes (manual check) |
| **Permission Level** | Basic (1) - All authenticated users |
| **Controller** | `PagesController::profile` |
| **Template** | `web/profile.html` |

---

## Features

### 1. Personal Information
- First Name
- Last Name
- Email (read-only, change via separate flow)
- Save changes with validation

### 2. Avatar Upload
- Upload profile picture (JPEG, PNG, GIF, WebP)
- Max file size: 5MB
- Preview before confirmation
- Automatic image variant generation (RabbitMQ processing)
- Displays small variant (320px)

### 3. Password Change
- Current password verification
- New password with strength indicator
- Real-time validation (8+ chars, uppercase, lowercase, digit, special char)
- Automatic sign-out after successful change

### 4. Email Change (4-Step Verification Flow)
- **Step 1**: Enter new email address
- **Step 2**: Verify code sent to OLD email
- **Step 3**: Verify code sent to NEW email
- **Step 4**: Success with 5-second auto-redirect

---

## Frontend Architecture

### Page Location
```
blazing_sun/src/frontend/pages/PROFILE/
```

### Components (5 Classes)

1. **ProfilePage.js** (Main Controller - 279 lines)
   - Personal information form management
   - JWT token handling
   - Change detection for save button
   - Coordinates sub-components

2. **AvatarUpload.js** (251 lines)
   - File selection and validation
   - Preview modal
   - Upload with progress
   - Image variant support

3. **PasswordChange.js** (289 lines)
   - Password validation
   - Strength indicator (Weak/Fair/Good/Strong)
   - Current password verification
   - Auto-redirect after change

4. **EmailChange.js** (434 lines)
   - 4-step verification flow
   - Step indicators with progress
   - Code validation
   - Auto-redirect after completion

5. **main.js** (Entry Point - 135 lines)
   - Component initialization
   - Toast notifications (Toastify)
   - Dependency injection

### Build Output

- **JavaScript**: `/src/resources/js/PROFILE/app.js` (27KB)
- **CSS**: `/src/resources/css/PROFILE/style.css` (8.5KB)

### Build Configuration

```javascript
// vite.config.js
{
  build: {
    outDir: '../../../resources',
    rollupOptions: {
      input: { app: 'src/main.js' },
      output: {
        format: 'iife',
        entryFileNames: 'js/PROFILE/app.js',
        assetFileNames: 'css/PROFILE/style.css'
      }
    }
  }
}
```

---

## Backend Implementation

### Controller Method

```rust
pub async fn profile(
    req: HttpRequest,
    tmpl: web::Data<Tera>,
    state: web::Data<AppState>
) -> Result<HttpResponse, ApiError> {
    // Extract user ID from JWT token
    let user_id = match extract_user_id_from_request(&req) {
        Some(id) => id,
        None => {
            return Ok(HttpResponse::Found()
                .insert_header(("Location", "/sign-in"))
                .finish());
        }
    };

    // Fetch user data
    let user = db_query::read::user::get_by_id(&state.db, user_id).await?;

    // Prepare template context
    let mut context = Context::new();
    context.insert("user", &user);
    context.insert("page_title", "Profile");

    // Render template
    let rendered = tmpl.render("web/profile.html", &context)?;

    Ok(HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(rendered))
}
```

### Database Queries Used

- `db_query::read::user::get_by_id()` - Fetch user data for rendering

---

## API Endpoints Used

### Profile Information
- `PATCH /api/v1/user` - Update profile (first name, last name)

### Avatar Upload
- `POST /api/v1/upload/avatar` - Upload avatar with automatic user linking

### Password Change
- `POST /api/v1/password/change-password` - Change password with current verification

### Email Change
- `POST /api/v1/email/request-change` - Request email change
- `POST /api/v1/email/verify-old-email` - Verify code sent to old email
- `POST /api/v1/email/verify-new-email` - Verify code sent to new email

---

## Template Structure

```html
<!-- web/profile.html -->
{% extends "web/base.html" %}

{% block title %}Profile{% endblock %}

{% block content %}
<div class="profile-container">
    <!-- Tab Navigation -->
    <div class="profile-tabs">
        <button class="tab active" data-tab="info">Personal Info</button>
        <button class="tab" data-tab="avatar">Avatar</button>
        <button class="tab" data-tab="password">Password</button>
        <button class="tab" data-tab="email">Email</button>
    </div>

    <!-- Personal Information Tab -->
    <div class="tab-content active" id="infoTab">
        <form id="profileForm">
            <input type="text" id="first_name" value="{{ user.first_name }}" />
            <input type="text" id="last_name" value="{{ user.last_name }}" />
            <input type="email" id="email" value="{{ user.email }}" readonly />
            <button type="submit" id="saveProfileBtn">Save Changes</button>
        </form>
    </div>

    <!-- Avatar Tab -->
    <div class="tab-content" id="avatarTab">
        <div id="avatarContainer">
            {% if user.avatar_uuid %}
            <img id="avatarImage" src="{{ asset(uuid=user.avatar_uuid, variant='small') }}" alt="Avatar" />
            {% else %}
            <div id="avatarPlaceholder">No Avatar</div>
            {% endif %}
        </div>
        <input type="file" id="avatarInput" accept="image/*" />
    </div>

    <!-- Password Tab -->
    <div class="tab-content" id="passwordTab">
        <form id="passwordForm">
            <input type="password" id="current_password" placeholder="Current Password" />
            <input type="password" id="new_password" placeholder="New Password" />
            <input type="password" id="confirm_password" placeholder="Confirm Password" />
            <div class="password-strength">
                <div class="password-strength__bar"></div>
                <span class="password-strength-text"></span>
            </div>
            <button type="submit" id="changePasswordBtn">Change Password</button>
        </form>
    </div>

    <!-- Email Change Tab (4-Step Flow) -->
    <div class="tab-content" id="emailTab">
        <!-- Step 1: Enter New Email -->
        <div id="emailStep1" class="email-step active">
            <form id="newEmailForm">
                <input type="email" id="new_email" placeholder="New Email Address" />
                <button type="submit" id="sendEmailCodeBtn">Send Verification Code</button>
            </form>
        </div>

        <!-- Step 2: Verify Old Email -->
        <div id="emailStep2" class="email-step">
            <form id="verifyOldEmailForm">
                <input type="text" id="old_email_code" placeholder="Code sent to {{ user.email }}" />
                <button type="submit" id="verifyOldEmailBtn">Verify Old Email</button>
            </form>
        </div>

        <!-- Step 3: Verify New Email -->
        <div id="emailStep3" class="email-step">
            <form id="verifyNewEmailForm">
                <input type="text" id="new_email_code" placeholder="Code sent to new email" />
                <button type="submit" id="verifyNewEmailBtn">Verify New Email</button>
            </form>
        </div>

        <!-- Step 4: Success -->
        <div id="emailStep4" class="email-step">
            <p>Email successfully changed!</p>
            <p id="newEmailDisplay"></p>
            <p>Redirecting in <span id="countdown">5</span> seconds...</p>
        </div>
    </div>
</div>
{% endblock %}

{% block scripts %}
<script src="{{ assets('/js/GLOBAL/app.js', version=env.ASSETS_VERSION) }}"></script>
<script src="{{ assets('/js/PROFILE/app.js', version=env.ASSETS_VERSION) }}"></script>
{% endblock %}
```

---

## Security Considerations

1. **JWT Authentication**: Token validated before rendering page
2. **HttpOnly Cookies**: Secure token storage (not accessible to JavaScript)
3. **Password Hashing**: bcrypt with salt
4. **Email Verification**: Dual verification (old + new email) for email changes
5. **File Upload Validation**: MIME type + extension + size checks
6. **CSRF Protection**: Same-origin policy enforced
7. **Rate Limiting**: TODO - Implement rate limiting for sensitive operations

---

## User Experience

### Loading States
- Save button shows loading spinner during API calls
- Avatar upload displays progress overlay
- Email change shows step progress indicators

### Validation Feedback
- Real-time password strength indicator
- Inline error messages for validation failures
- Toast notifications for success/error states

### Accessibility
- ARIA labels on all form inputs
- Keyboard navigation support
- Screen reader compatible

---

## Testing

### Manual Testing Checklist
- [ ] Load profile page as authenticated user
- [ ] Update first and last name
- [ ] Upload avatar (various formats and sizes)
- [ ] Change password with valid current password
- [ ] Change password with invalid current password
- [ ] Complete 4-step email change flow
- [ ] Verify old email code validation
- [ ] Verify new email code validation
- [ ] Test with expired verification codes
- [ ] Test password strength indicator
- [ ] Test file upload size limits
- [ ] Test unsupported file formats

### Automated Tests

**Location**: `blazing_sun/tests/routes/web/PROFILE/`

```bash
# Run Playwright tests
npm test -- profile.spec.ts
```

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Initial Load | < 2s | TBD |
| Avatar Upload | < 5s | TBD |
| Password Change | < 1s | TBD |
| Email Verification | < 1s per step | TBD |
| Bundle Size (JS) | < 50KB | 27KB ✓ |
| Bundle Size (CSS) | < 20KB | 8.5KB ✓ |

---

## Common Issues

### Avatar Upload Fails
**Cause**: File size exceeds 5MB or unsupported format
**Solution**: Compress image or convert to JPEG/PNG/WebP

### Password Change Redirects Prematurely
**Cause**: Token invalidation on password change
**Solution**: Expected behavior - user must sign in with new password

### Email Verification Code Expired
**Cause**: Codes expire after 1 hour
**Solution**: Request new code by restarting email change flow

---

## Related Documentation

- [Profile Page Frontend](../../Frontend/PROFILE.md)
- [Avatar Upload Feature](../../AdminUploads/)
- [Email Change Implementation](../../ProfilePage/)
- [User API Endpoints](../API/user.md)
- [Upload API Endpoints](../API/upload.md)

---

**Last Updated**: 2026-01-02
**Controller Location**: `/home/milner/Desktop/rust/blazing_sun/src/app/http/web/controllers/pages.rs:profile`
**Template Location**: `/home/milner/Desktop/rust/blazing_sun/src/resources/views/web/profile.html`
**Frontend Source**: `/home/milner/Desktop/rust/blazing_sun/src/frontend/pages/PROFILE/`
