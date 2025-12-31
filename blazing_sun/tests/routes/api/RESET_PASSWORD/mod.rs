// Reset Password API Tests
// Path: /api/v1/account/reset-password
// Method: POST
//
// Test coverage:
// - Happy path: Valid code + valid password resets successfully
// - Error: Missing code field
// - Error: Missing password field
// - Error: Missing confirm_password field
// - Error: Invalid code (non-existent)
// - Error: Expired/used code
// - Error: Password too short
// - Error: Password missing uppercase
// - Error: Password missing lowercase
// - Error: Password missing number
// - Error: Password missing special character
// - Error: Passwords don't match
// - Error: Multiple validation errors at once
// - Security: SQL injection attempt
// - Security: XSS attempt
// - Integration: Full flow from forgot-password to reset-password

mod reset_password;
