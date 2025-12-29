// API Route Tests
//
// Each route has its own folder:
// - SIGN_IN/         - Authentication sign-in tests
// - SIGN_UP/         - Authentication sign-up tests
// - FORGOT_PASSWORD/ - Forgot password tests
// - VERIFY_HASH/     - Verify hash tests
// - RESET_PASSWORD/  - Reset password tests
// - USER/            - User management tests
// - etc.
//
// Naming convention: {ROUTE_NAME}/{route_name}.rs

#[path = "SIGN_IN/mod.rs"]
pub mod sign_in;

#[path = "FORGOT_PASSWORD/mod.rs"]
pub mod forgot_password;

#[path = "VERIFY_HASH/mod.rs"]
pub mod verify_hash;

#[path = "RESET_PASSWORD/mod.rs"]
pub mod reset_password;
