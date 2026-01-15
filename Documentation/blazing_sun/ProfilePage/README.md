# Profile Page & Email Change Feature - Complete Documentation

## Overview

The Profile Page provides comprehensive user account management with:
- **Personal Information** editing (first name, last name)
- **Avatar Upload** with preview and cropping
- **Password Change** with strength indicator
- **Email Change** - Secure 4-step verification flow
- **Real-time validation** and feedback

---

## Table of Contents

1. [Personal Information](#personal-information)
2. [Avatar Upload](#avatar-upload)
3. [Password Change](#password-change)
4. [Email Change (4-Step Flow)](#email-change-4-step-flow)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend API](#backend-api)
7. [Security](#security)
8. [Testing](#testing)

---

## Personal Information

### Features
- Edit first name and last name
- Real-time validation
- Auto-save disabled until changes made
- Updates display name in navbar

### API Endpoint

```
PATCH /api/v1/user/profile
Auth: Required (JWT or HttpOnly cookie)

Body:
{
  "first_name": "John",
  "last_name": "Doe"
}

Response: 200 OK
{
  "status": "success",
  "message": "Profile updated successfully"
}
```

### Frontend Component

**ProfilePage.js**:
```javascript
class ProfilePage {
  constructor(config) {
    this.form = config.profileForm;
    this.firstNameInput = config.firstNameInput;
    this.lastNameInput = config.lastNameInput;
    this.saveBtn = config.saveBtn;
  }

  async handleSubmit(event) {
    // Validate inputs
    // Send PATCH request
    // Update display name
    // Show success toast
  }
}
```

---

## Avatar Upload

### Features
- Drag & drop or click to upload
- Image preview modal before save
- Cropping support (future)
- Automatic profile picture update
- Private storage (`storage/app/private/profile-pictures/`)

### API Endpoint

```
POST /api/v1/upload/avatar
Auth: Required
Content-Type: multipart/form-data

Body:
- file: (image binary)

Response: 200 OK
{
  "status": "success",
  "data": {
    "upload": {
      "uuid": "...",
      "url": "/api/v1/upload/private/{uuid}"
    }
  }
}
```

### RabbitMQ Processing

**Priority**: 1 (High) - Immediate user feedback

**Process**:
1. Upload saved to `private/profile-pictures/`
2. Database record created
3. User's `avatar_uuid` and `avatar_id` updated
4. **RabbitMQ job enqueued** for variant generation
5. Worker creates 5 variants (thumb, small, medium, large, full)

### Frontend Component

**AvatarUpload.js**:
```javascript
class AvatarUpload {
  constructor(config) {
    this.fileInput = config.fileInput;
    this.previewModal = config.previewModal;
    this.previewImage = config.previewImage;
  }

  async handleFileSelect(event) {
    // Validate file type and size
    // Show preview modal
    // Wait for user confirmation
  }

  async uploadAvatar(file) {
    // Create FormData
    // POST to /api/v1/upload/avatar
    // Update avatar display
    // Show success toast
  }
}
```

---

## Password Change

### Features
- Current password verification
- New password strength indicator
- Confirm password matching
- Real-time strength feedback
- Auto-logout after successful change

### Password Strength Rules

| Strength | Requirements |
|----------|--------------|
| **Weak** | < 8 characters |
| **Fair** | ≥ 8 chars, letters only |
| **Good** | ≥ 8 chars, letters + numbers |
| **Strong** | ≥ 8 chars, letters + numbers + symbols |

### API Endpoint

```
POST /api/v1/user/change-password
Auth: Required

Body:
{
  "current_password": "OldPass123!",
  "new_password": "NewSecurePass456!",
  "confirm_password": "NewSecurePass456!"
}

Response: 200 OK
{
  "status": "success",
  "message": "Password changed successfully"
}
```

### Security Flow

1. Verify current password against database hash
2. Validate new password strength (min 8 chars)
3. Verify new password != current password
4. Hash new password with bcrypt
5. Update database
6. **Clear HttpOnly auth cookie** (auto-logout)
7. Send confirmation email

### Frontend Component

**PasswordChange.js**:
```javascript
class PasswordChange {
  constructor(config) {
    this.form = config.form;
    this.currentPasswordInput = config.currentPasswordInput;
    this.newPasswordInput = config.newPasswordInput;
    this.confirmPasswordInput = config.confirmPasswordInput;
    this.strengthBar = config.strengthBar;
    this.strengthText = config.strengthText;
  }

  calculateStrength(password) {
    // Check length, complexity
    // Return 'weak' | 'fair' | 'good' | 'strong'
  }

  async handleSubmit(event) {
    // Validate passwords match
    // POST to API
    // Redirect to /sign-in on success
  }
}
```

---

## Email Change (4-Step Flow)

### Overview

Secure email change requiring verification of **both** old and new email addresses.

```
┌─────────────┐
│  Step 1     │  User enters new email
│  New Email  │  → Code sent to OLD email
└──────┬──────┘
       │
       v
┌─────────────┐
│  Step 2     │  User enters code from OLD email
│  Verify Old │  → Code sent to NEW email
└──────┬──────┘
       │
       v
┌─────────────┐
│  Step 3     │  User enters code from NEW email
│  Verify New │  → Email updated, auto-logout
└──────┬──────┘
       │
       v
┌─────────────┐
│  Step 4     │  Success message
│  Done       │  → Redirect to /sign-in (5 sec)
└─────────────┘
```

### Step 1: Enter New Email

**UI**:
- Input field for new email address
- Validation: Email format, not same as current, not already in use
- Button: "Request Email Change"

**Backend Process**:
1. Validate email format
2. Check email not already in use
3. Delete any existing unused `email_change` hashes for user
4. Generate UUID-based verification code (32 chars)
5. Create `activation_hashes` record:
   - `hash_type`: `email_change_old`
   - `metadata`: `{"old_email": "current@example.com", "new_email": "new@example.com", "step": "verify_old_email"}`
   - `expiry_time`: NOW() + EXPIRY_EMAIL_CHANGE (60 minutes)
6. **Send email to OLD address** with code
7. Return success response

**API**:
```
POST /api/v1/email/request-change
Auth: Required

Body:
{
  "new_email": "newemail@example.com"
}

Response: 200 OK
{
  "status": "success",
  "message": "Verification code sent to your current email address"
}
```

**Email Template**: `email_change_verify_old.html`
- Subject: "Verify Your Email Change Request"
- Content: 32-character verification code
- Expiry: 60 minutes
- Shows new email address being changed to

---

### Step 2: Verify Old Email

**UI**:
- Display current email address
- Input field for 32-character code
- Button: "Verify Old Email"
- Cancel button (returns to Step 1)

**Backend Process**:
1. Find `activation_hashes` record:
   - `hash` = submitted code
   - `hash_type` = `email_change_old`
   - `user_id` = current user
   - `used` = 0
   - `expiry_time` > NOW()
2. Extract `new_email` from metadata
3. Mark old hash as used (`used` = 1)
4. Generate new UUID code (32 chars)
5. Create new `activation_hashes` record:
   - `hash_type`: `email_change_new`
   - `metadata`: `{"old_email": "current@example.com", "new_email": "new@example.com", "step": "verify_new_email"}`
   - `expiry_time`: NOW() + EXPIRY_EMAIL_CHANGE
6. **Send email to NEW address** with new code
7. Return success response with new_email

**API**:
```
POST /api/v1/email/verify-old-email
Auth: Required

Body:
{
  "code": "abcdef123456..."
}

Response: 200 OK
{
  "status": "success",
  "message": "Verification code sent to your new email address"
}
```

**Email Template**: `email_change_verify_new.html`
- Subject: "Confirm Your New Email Address"
- Content: 32-character verification code
- Expiry: 60 minutes
- Shows old email address for context

---

### Step 3: Verify New Email

**UI**:
- Display new email address
- Input field for 32-character code
- Button: "Complete Email Change"
- Cancel button (returns to Step 1)

**Backend Process**:
1. Find `activation_hashes` record:
   - `hash` = submitted code
   - `hash_type` = `email_change_new`
   - `user_id` = current user
   - `used` = 0
   - `expiry_time` > NOW()
2. Extract `new_email` from metadata
3. **Race condition check**: Verify new email still available
4. Update user's email in database
5. Mark hash as used (`used` = 1)
6. **Clear HttpOnly auth cookie** (auto-logout)
7. Send success email to **new email address**
8. Return success response

**API**:
```
POST /api/v1/email/verify-new-email
Auth: Required

Body:
{
  "code": "xyz789012345..."
}

Response: 200 OK
{
  "status": "success",
  "message": "Email changed successfully! Please sign in with your new email."
}
Set-Cookie: auth_token=; Max-Age=-1; HttpOnly; Path=/
```

**Email Template**: `email_change_success.html`
- Subject: "Email Address Changed Successfully"
- Content: Confirmation of change
- Shows old and new email addresses
- Security warning: Contact support if unauthorized

---

### Step 4: Success

**UI**:
- Success icon and message
- "Email Changed Successfully!"
- "You've been signed out for security. Please sign in with your new email address."
- Countdown: "Redirecting to sign in page in 5 seconds..."
- Auto-redirect to `/sign-in`

**Frontend**:
```javascript
startRedirectCountdown() {
  let countdown = 5;
  const interval = setInterval(() => {
    countdown--;
    document.getElementById('redirectCountdown').textContent = countdown;
    if (countdown <= 0) {
      clearInterval(interval);
      window.location.href = '/sign-in';
    }
  }, 1000);
}
```

---

### Database Schema

#### activation_hashes Table

```sql
CREATE TABLE activation_hashes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    hash VARCHAR(255) UNIQUE NOT NULL,
    hash_type VARCHAR(50) NOT NULL,  -- 'email_change_old' | 'email_change_new'
    used SMALLINT DEFAULT 0,         -- 0 = unused, 1 = used
    expiry_time TIMESTAMP NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activation_hashes_hash_type ON activation_hashes(hash_type);
CREATE INDEX idx_activation_hashes_user_id ON activation_hashes(user_id);
CREATE INDEX idx_activation_hashes_metadata ON activation_hashes USING GIN (metadata);
```

#### Metadata Structure

**Step 1 hash** (`email_change_old`):
```json
{
  "old_email": "current@example.com",
  "new_email": "new@example.com",
  "step": "verify_old_email"
}
```

**Step 2 hash** (`email_change_new`):
```json
{
  "old_email": "current@example.com",
  "new_email": "new@example.com",
  "step": "verify_new_email"
}
```

---

## Frontend Architecture

### Page Structure

**Location**: `src/frontend/pages/PROFILE/`

```
PROFILE/
├── src/
│   ├── main.js              # Entry point, initializes all components
│   ├── ProfilePage.js       # Personal info form controller
│   ├── AvatarUpload.js      # Avatar upload component
│   ├── PasswordChange.js    # Password change form
│   ├── EmailChange.js       # 4-step email change flow
│   └── styles/
│       ├── main.scss
│       └── _profile.scss
├── package.json
└── vite.config.js
```

### EmailChange.js Component

```javascript
export class EmailChange {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.step1Card = config.step1Card;
    this.step2Card = config.step2Card;
    this.step3Card = config.step3Card;
    this.step4Card = config.step4Card;
    this.newEmailForm = config.newEmailForm;
    this.verifyOldEmailForm = config.verifyOldEmailForm;
    this.verifyNewEmailForm = config.verifyNewEmailForm;
    this.showToast = config.showToast;
    this.getAuthToken = config.getAuthToken;
    this.currentEmail = config.currentEmail;
    this.currentStep = 1;
    this.newEmail = '';
  }

  async handleNewEmailSubmit(event) {
    // POST /api/v1/email/request-change
    // Move to step 2
  }

  async handleVerifyOldEmailSubmit(event) {
    // POST /api/v1/email/verify-old-email
    // Move to step 3
  }

  async handleVerifyNewEmailSubmit(event) {
    // POST /api/v1/email/verify-new-email
    // Move to step 4
    // Start redirect countdown
  }

  goToStep(step) {
    // Hide all cards
    // Show target card
    // Update step indicators
    // Focus first input
  }

  startRedirectCountdown() {
    // 5-second countdown
    // Redirect to /sign-in
  }
}
```

### Build Process

```bash
# Development build
cd src/frontend/pages/PROFILE && npm run dev

# Production build
./build-frontend.sh PROFILE
```

**Output**:
```
src/resources/
├── css/PROFILE/style.css
└── js/PROFILE/app.js
```

---

## Backend API

### Controllers

**Location**: `src/app/http/api/controllers/`

- `user.rs` - Profile and password endpoints
- `email.rs` - Email change 3-endpoint flow
- `upload.rs` - Avatar upload endpoint

### Database Queries

**Location**: `src/app/db_query/`

**Read Operations** (`read/user/mod.rs`):
- `get_by_id(db, user_id)` - Get user by ID
- `get_by_email(db, email)` - Get user by email
- `email_exists(db, email)` - Check email availability

**Mutation Operations** (`mutations/user/mod.rs`):
- `update_profile(db, user_id, first_name, last_name)` - Update name
- `update_password(db, user_id, new_hash)` - Update password hash
- `update_email(db, user_id, new_email)` - Update email address

**Activation Hash Operations**:
- `create_with_metadata(db, user_id, hash, hash_type, expiry, metadata)` - Create hash
- `get_by_hash_and_type(db, hash, hash_type, user_id)` - Verify hash
- `mark_as_used(db, hash_id)` - Mark hash as consumed

---

## Security

### Password Security

1. **Bcrypt Hashing** - All passwords hashed with bcrypt (cost factor 12)
2. **Minimum Length** - 8 characters required
3. **Current Password Verification** - Required before change
4. **Auto-Logout** - Session cleared after password change
5. **Confirmation Email** - Sent to user's email address

### Email Change Security

1. **Dual Verification** - Both old and new email must be verified
2. **Time-Limited Codes** - 60-minute expiry (configurable)
3. **One-Time Use** - Codes marked as used after redemption
4. **Race Condition Protection** - Email availability checked at final step
5. **Auto-Logout** - Session cleared after email change
6. **Audit Trail** - All attempts logged in `activation_hashes`

### Avatar Upload Security

1. **File Type Validation** - Only images allowed (JPEG, PNG, WebP, GIF)
2. **File Size Limit** - Configurable max size (default 5MB)
3. **Private Storage** - Avatars stored in private directory
4. **Authentication Required** - All avatar endpoints require auth
5. **UUID-Based URLs** - Prevent enumeration

---

## Configuration

### Environment Variables

**File**: `.env`

```env
# Email Change Configuration
EXPIRY_EMAIL_CHANGE=60  # Minutes

# Upload Configuration
MAX_UPLOAD_SIZE=5242880  # 5MB in bytes
ALLOWED_IMAGE_EXTENSIONS=jpg,jpeg,png,webp,gif

# Security
BCRYPT_COST=12
SESSION_TIMEOUT=3600  # 1 hour
```

---

## Testing

### Test Scripts

**Location**: `blazing_sun/tests/scripts/`

- `test_avatar_endpoint.sh` - Test avatar upload
- `test_avatar_jwt.sh` - Test JWT authentication
- `test_cookie_signin.sh` - Test cookie-based auth

### Manual Testing

**Profile Update**:
- [ ] Update first name only
- [ ] Update last name only
- [ ] Update both names
- [ ] Empty field validation
- [ ] Special characters in names

**Avatar Upload**:
- [ ] Upload JPG image
- [ ] Upload PNG image
- [ ] Upload WebP image
- [ ] Upload invalid file type
- [ ] Upload file exceeding size limit
- [ ] Preview modal displays correctly
- [ ] Variants created via RabbitMQ

**Password Change**:
- [ ] Change with valid current password
- [ ] Wrong current password (should fail)
- [ ] New password too short (< 8 chars)
- [ ] New password same as current
- [ ] Passwords don't match (new vs confirm)
- [ ] Strength indicator updates correctly
- [ ] Auto-logout after successful change
- [ ] Confirmation email received

**Email Change (Complete Flow)**:
- [ ] **Step 1**: Enter new email, code sent to old email
- [ ] **Step 2**: Enter code from old email, code sent to new email
- [ ] **Step 3**: Enter code from new email, email updated
- [ ] **Step 4**: Success message, auto-redirect to /sign-in
- [ ] Sign in with new email successfully

**Email Change (Error Cases)**:
- [ ] New email already in use (Step 1)
- [ ] New email same as current (Step 1)
- [ ] Invalid code (Step 2)
- [ ] Expired code (Step 2)
- [ ] Used code (Step 2)
- [ ] Invalid code (Step 3)
- [ ] Race condition: email taken between steps

---

## Troubleshooting

**Email not received**:
- Check SMTP configuration in `.env`
- Check RabbitMQ email worker logs
- Verify email address valid
- Check spam folder

**Code expired too quickly**:
- Adjust `EXPIRY_EMAIL_CHANGE` in `.env`
- Default is 60 minutes

**Auto-logout not working**:
- Check cookie settings (HttpOnly, SameSite)
- Verify `Set-Cookie` header in response
- Check browser cookie storage

**Avatar variants not created**:
- Check RabbitMQ worker running
- Check dead-letter queue for failures
- Verify `image` crate dependencies installed

---

## Related Documentation

- [Email Change Implementation Plan](./IMPLEMENTATION_PLAN_EMAIL_CHANGE.md)
- [Admin Uploads](../AdminUploads/README.md)
- [Frontend Build Guide](../Frontend/README.md)

---

**Last Updated**: 2026-01-02
**Maintainer**: Blazing Sun Development Team
