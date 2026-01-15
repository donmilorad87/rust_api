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

#[path = "OAUTH_AUTHORIZED_APPS/mod.rs"]
pub mod oauth_authorized_apps;

#[path = "OAUTH_AUTHORIZE/mod.rs"]
pub mod oauth_authorize;

#[path = "OAUTH_CALLBACK/mod.rs"]
pub mod oauth_callback;

#[path = "OAUTH_GALLERIES/mod.rs"]
pub mod oauth_galleries;

#[path = "OAUTH_API_PRODUCT/mod.rs"]
pub mod oauth_api_product;

#[path = "OAUTH_PICTURES/mod.rs"]
pub mod oauth_pictures;

#[path = "SUPERADMIN_USERS/mod.rs"]
pub mod superadmin_users;

#[path = "GALLERIES/mod.rs"]
pub mod galleries;
#[path = "UPLOADS/mod.rs"]
pub mod uploads;

#[path = "SCHEMAS/mod.rs"]
pub mod schemas;

#[path = "GEO_GALLERIES/mod.rs"]
pub mod geo_galleries;

#[path = "COMPETITIONS/mod.rs"]
pub mod competitions;

#[path = "helpers/mod.rs"]
pub mod helpers;
