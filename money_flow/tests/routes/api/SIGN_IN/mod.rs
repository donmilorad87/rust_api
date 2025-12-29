// Sign-In API Tests
// Path: /api/v1/auth/sign-in
// Method: POST
//
// Test coverage:
// - Happy path: Valid credentials return JWT token
// - Error: Invalid email format
// - Error: Wrong password
// - Error: Non-existent user
// - Security: Rate limiting
// - Security: Token expiration

mod sign_in;
