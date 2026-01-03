// Forgot Password API Tests
// Path: /api/v1/account/forgot-password
// Method: POST
//
// Test coverage:
// - Happy path: Valid email sends reset code
// - Error: Invalid email format
// - Error: Email not found in database
// - Error: Missing email field
// - Error: Empty email
// - Security: Rate limiting considerations
// - Edge cases: Unicode emails, very long emails

mod forgot_password;
