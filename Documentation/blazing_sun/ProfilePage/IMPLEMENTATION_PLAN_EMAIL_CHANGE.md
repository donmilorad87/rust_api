# Email Change Implementation Plan

## Overview
Implement a secure 4-step email change flow that verifies both the old and new email addresses before completing the change.

## Current State
- 3-step UI exists but backend endpoints are not implemented
- Frontend EmailChange.js references non-existent API endpoints
- activation_hashes table exists with support for various hash types

## New Flow

### Step 1: Enter New Email
- User inputs the new email address they want to change to
- System validates email format
- System checks if new email is already in use by another account
- If valid, system sends verification hash to **old email** (current email)
- Display message: "Verification code sent to your current email address"
- Move to Step 2

### Step 2: Verify Old Email
- User receives email at their **old/current email address**
- Email contains 20-character hash
- User inputs the verification code from old email
- System validates hash:
  - Check hash exists and matches
  - Check hash type is 'email_change_old'
  - Check hash not expired (EXPIRY_EMAIL_CHANGE minutes)
  - Check hash not already used
- If valid:
  - Mark old hash as used
  - Send new verification hash to **new email address**
  - Store new email temporarily (need to store it with the hash)
  - Display message: "Verification code sent to your new email address"
  - Move to Step 3

### Step 3: Verify New Email
- User receives email at their **new email address**
- Email contains 20-character hash
- User inputs the verification code from new email
- System validates hash:
  - Check hash exists and matches
  - Check hash type is 'email_change_new'
  - Check hash not expired
  - Check hash not already used
- If valid:
  - Update user's email in database
  - Mark hash as used
  - Clear auth_token cookie (log user out)
  - Display success message
  - Move to Step 4

### Step 4: Success
- Display congratulations message
- Show button to sign in with new email
- After 3 seconds, redirect to /sign-in

---

## Technical Implementation

### 1. Environment Variables

**File**: `blazing_sun/.env` and `blazing_sun/.env.example`

Add:
```env
EXPIRY_EMAIL_CHANGE=60  # Email change hash expiry in minutes
```

---

### 2. Database Schema

**No migration needed** - existing `activation_hashes` table supports this via `hash_type` field.

New hash types to use:
- `email_change_old` - For verifying old email address
- `email_change_new` - For verifying new email address

**Challenge**: Need to store the new email address temporarily.

**Solution**: Add JSON column to activation_hashes for metadata, OR create separate table, OR store in Redis temporarily.

**Recommended**: Add `metadata` JSONB column to activation_hashes table for flexible data storage.

**Migration**: `blazing_sun/migrations/YYYYMMDD_add_metadata_to_activation_hashes.sql`
```sql
ALTER TABLE activation_hashes
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_activation_hashes_metadata
ON activation_hashes USING GIN (metadata);
```

This allows storing:
```json
{
  "new_email": "newuser@example.com",
  "old_email": "olduser@example.com"
}
```

---

### 3. Backend API Endpoints

**Location**: `blazing_sun/src/app/http/api/controllers/email.rs` (new file)

#### Endpoint 1: Request Email Change (Step 1)
```
POST /api/v1/email/request-change
Auth: Required (JWT or HttpOnly cookie)
```

**Request Body**:
```json
{
  "new_email": "newuser@example.com"
}
```

**Process**:
1. Validate user is authenticated
2. Validate email format
3. Check new email is not already in use
4. Check new email is different from current email
5. Generate 20-character hash
6. Create activation_hashes record:
   - user_id: current user
   - hash: generated hash
   - hash_type: 'email_change_old'
   - expiry_time: NOW() + EXPIRY_EMAIL_CHANGE minutes
   - metadata: `{"new_email": "newuser@example.com", "old_email": "current@example.com"}`
7. Send email to **old/current email** with hash
8. Return success response

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Verification code sent to your current email address"
}
```

**Errors**:
- 400: Email already in use, email same as current, invalid format
- 401: Unauthorized

---

#### Endpoint 2: Verify Old Email (Step 2)
```
POST /api/v1/email/verify-old-email
Auth: Required (JWT or HttpOnly cookie)
```

**Request Body**:
```json
{
  "code": "abcd1234efgh5678ijkl"
}
```

**Process**:
1. Validate user is authenticated
2. Find activation_hashes record:
   - hash = code
   - hash_type = 'email_change_old'
   - user_id = current user
   - used = 0
   - expiry_time > NOW()
3. Extract new_email from metadata
4. Mark old hash as used (used = 1)
5. Generate new 20-character hash for new email
6. Create new activation_hashes record:
   - user_id: current user
   - hash: new generated hash
   - hash_type: 'email_change_new'
   - expiry_time: NOW() + EXPIRY_EMAIL_CHANGE minutes
   - metadata: `{"new_email": "newuser@example.com", "old_email": "current@example.com"}`
7. Send email to **new email** with new hash
8. Return success response

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Verification code sent to your new email address",
  "new_email": "newuser@example.com"
}
```

**Errors**:
- 400: Invalid or expired code
- 401: Unauthorized

---

#### Endpoint 3: Verify New Email & Complete Change (Step 3)
```
POST /api/v1/email/verify-new-email
Auth: Required (JWT or HttpOnly cookie)
```

**Request Body**:
```json
{
  "code": "wxyz9876stuv5432pqrs"
}
```

**Process**:
1. Validate user is authenticated
2. Find activation_hashes record:
   - hash = code
   - hash_type = 'email_change_new'
   - user_id = current user
   - used = 0
   - expiry_time > NOW()
3. Extract new_email from metadata
4. Update user's email in database
5. Mark hash as used (used = 1)
6. Clear auth_token cookie (log user out)
7. Send confirmation email to NEW email
8. Return success response

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "Email changed successfully! Please sign in with your new email."
}
```
**Response headers**: Set-Cookie with expired auth_token

**Errors**:
- 400: Invalid or expired code, new email already taken (race condition check)
- 401: Unauthorized

---

### 4. Email Templates

**Location**: `blazing_sun/src/resources/views/emails/`

#### Template 1: `email_change_verify_old.html`
Subject: "Verify Your Current Email Address"

Content:
- Inform user they requested to change their email
- Show new email address they're changing to (from metadata)
- Provide 20-character verification code
- Explain this verifies they own the current email
- Link to cancel if they didn't request this
- Code expires in X minutes

#### Template 2: `email_change_verify_new.html`
Subject: "Verify Your New Email Address"

Content:
- Inform user they're completing email change
- Provide 20-character verification code
- Explain after verification, they'll be logged out
- They'll need to sign in with new email
- Code expires in X minutes

#### Template 3: `email_change_success.html`
Subject: "Email Address Changed Successfully"

Content:
- Confirm email change was successful
- Old email: ...
- New email: ...
- They'll need to sign in with new email from now on
- If they didn't make this change, contact support immediately

---

### 5. Frontend Changes

#### Update HTML Template

**File**: `blazing_sun/src/resources/views/web/profile.html`

Change from 3 steps to 4 steps:

```html
<div class="email-steps">
    <div class="email-step email-step--active">
        <span class="email-step__number">1</span>
        <span class="email-step__label">New Email</span>
    </div>
    <div class="email-step__connector"></div>
    <div class="email-step">
        <span class="email-step__number">2</span>
        <span class="email-step__label">Verify Old</span>
    </div>
    <div class="email-step__connector"></div>
    <div class="email-step">
        <span class="email-step__number">3</span>
        <span class="email-step__label">Verify New</span>
    </div>
    <div class="email-step__connector"></div>
    <div class="email-step">
        <span class="email-step__number">4</span>
        <span class="email-step__label">Done</span>
    </div>
</div>

<!-- Step 1: Enter new email -->
<div id="emailStep1">
    <form id="newEmailForm">
        <input type="email" name="new_email" placeholder="New email address" required>
        <button type="submit">Continue</button>
    </form>
</div>

<!-- Step 2: Verify old email -->
<div id="emailStep2" class="hidden">
    <p>Enter the verification code sent to your current email address.</p>
    <form id="verifyOldEmailForm">
        <input type="text" name="code" placeholder="Enter 20-character code" maxlength="20" required>
        <button type="submit">Verify Old Email</button>
    </form>
</div>

<!-- Step 3: Verify new email -->
<div id="emailStep3" class="hidden">
    <p>Enter the verification code sent to your new email address: <strong id="newEmailDisplay"></strong></p>
    <form id="verifyNewEmailForm">
        <input type="text" name="code" placeholder="Enter 20-character code" maxlength="20" required>
        <button type="submit">Verify New Email</button>
    </form>
</div>

<!-- Step 4: Success -->
<div id="emailStep4" class="hidden">
    <div class="success-message">
        <h3>Email Changed Successfully!</h3>
        <p>Your email has been updated. You'll be redirected to sign in with your new email.</p>
        <a href="/sign-in" class="btn btn--primary">Sign In Now</a>
    </div>
</div>
```

#### Update EmailChange.js Component

**File**: `blazing_sun/src/frontend/pages/PROFILE/src/EmailChange.js`

Major changes:
1. Support 4 steps instead of 3
2. Update API endpoints:
   - `POST /api/v1/email/request-change` (Step 1)
   - `POST /api/v1/email/verify-old-email` (Step 2)
   - `POST /api/v1/email/verify-new-email` (Step 3)
3. Store new_email received from Step 2 response
4. Display new_email in Step 3
5. Remove onEmailChanged callback (user is logged out)
6. Auto-redirect to /sign-in after Step 4

#### Update main.js

**File**: `blazing_sun/src/frontend/pages/PROFILE/src/main.js`

Update EmailChange initialization to pass all 4 steps:
```javascript
const emailChange = new EmailChange({
  baseUrl,
  step1Card: document.getElementById('emailStep1'),
  step2Card: document.getElementById('emailStep2'),
  step3Card: document.getElementById('emailStep3'),
  step4Card: document.getElementById('emailStep4'),
  emailForm: document.getElementById('newEmailForm'),
  verifyOldForm: document.getElementById('verifyOldEmailForm'),
  verifyNewForm: document.getElementById('verifyNewEmailForm'),
  newEmailInput: document.getElementById('new_email'),
  oldCodeInput: document.getElementById('old_code'),
  newCodeInput: document.getElementById('new_code'),
  emailBtn: document.getElementById('sendEmailCodeBtn'),
  verifyOldBtn: document.getElementById('verifyOldBtn'),
  verifyNewBtn: document.getElementById('verifyNewBtn'),
  stepIndicators: Array.from(document.querySelectorAll('.email-step')),
  showToast
});
```

---

### 6. Configuration Updates

**File**: `blazing_sun/src/config/env.rs` (if exists) or equivalent

Add:
```rust
pub fn expiry_email_change() -> i64 {
    env::var("EXPIRY_EMAIL_CHANGE")
        .unwrap_or_else(|_| "60".to_string())
        .parse()
        .unwrap_or(60)
}
```

---

### 7. Database Query Functions

**Location**: `blazing_sun/src/app/db_query/`

#### Read Operations
**File**: `blazing_sun/src/app/db_query/read/activation_hash/mod.rs`

Add functions:
- `get_by_hash_and_type(db, hash, hash_type, user_id)` - Get specific hash for user
- `get_email_change_metadata(db, hash)` - Extract metadata JSON

#### Mutation Operations
**File**: `blazing_sun/src/app/db_query/mutations/activation_hash/mod.rs`

Add functions:
- `create_with_metadata(db, user_id, hash, hash_type, expiry_time, metadata)` - Create hash with metadata
- `mark_as_used(db, hash_id)` - Mark hash as used

---

## Testing Plan

### Manual Testing Steps

1. **Step 1 Test**: Request email change
   - Sign in as test user
   - Navigate to /profile
   - Enter new email address
   - Verify code sent to old email
   - Check database: activation_hashes record with type 'email_change_old'

2. **Step 2 Test**: Verify old email
   - Copy code from old email (check email logs or database)
   - Input code in Step 2
   - Verify code sent to new email
   - Check database: old hash marked as used, new hash created with type 'email_change_new'

3. **Step 3 Test**: Verify new email
   - Copy code from new email
   - Input code in Step 3
   - Verify email changed in database
   - Verify logged out (cookie cleared)
   - Verify redirected to /sign-in

4. **Step 4 Test**: Sign in with new email
   - Sign in with new email address
   - Verify can access account

### Error Cases to Test

1. **Invalid new email** (Step 1):
   - Already in use
   - Same as current email
   - Invalid format

2. **Invalid codes**:
   - Wrong code
   - Expired code
   - Already used code
   - Code for different user

3. **Race conditions**:
   - New email taken between Step 2 and Step 3
   - Multiple verification attempts

4. **Expiry**:
   - Let code expire, try to use it
   - Verify proper error message

---

## Implementation Order

1. ✅ Create implementation plan (this document)
2. Add EXPIRY_EMAIL_CHANGE to .env files
3. Create migration for metadata column
4. Create email.rs controller with 3 endpoints
5. Create database query functions
6. Create 3 email templates
7. Update profile.html for 4 steps
8. Update EmailChange.js for 4-step flow
9. Update main.js initialization
10. Rebuild frontend assets
11. Test complete flow
12. Document in CLAUDE.md

---

## Security Considerations

1. **Rate limiting**: Consider limiting email change requests per user per day
2. **Metadata validation**: Always validate metadata JSON structure
3. **Email uniqueness**: Double-check email not taken at Step 3 (race condition)
4. **Hash entropy**: Use cryptographically secure random for hashes
5. **Auto logout**: Essential after email change for security
6. **Email notifications**: Send notification to BOTH old and new email on success

---

## Future Enhancements

1. Add ability to cancel email change process
2. Add email change history/audit log
3. Add cooldown period between email changes
4. Add 2FA requirement for email change if enabled
5. Add notification to old email when change completes

---

## Notes

- This is a breaking change for any existing email change flow
- Requires rebuilding frontend assets after changes
- Requires restarting backend after code changes
- Email templates need testing with actual SMTP server
- Consider adding Kafka event: `EmailChanged` for audit/analytics
