//! Reset Password API Tests
//!
//! # Route
//! - **Path**: `/api/v1/account/reset-password`
//! - **Method**: POST
//!
//! # Request Body
//! ```json
//! {
//!     "code": "40-character-hash-code",
//!     "password": "NewPassword123!",
//!     "confirm_password": "NewPassword123!"
//! }
//! ```
//!
//! # Expected Responses
//! - 200: Password reset successfully
//! - 400: Validation failed (code_errors, password_errors, confirm_password_errors)
//!
//! # Password Requirements
//! - Minimum 8 characters
//! - At least one uppercase letter
//! - At least one lowercase letter
//! - At least one number
//! - At least one special character
//!
//! # Test Flow
//! 1. Call forgot-password with `return_code_for_testing: true` to get a valid code
//! 2. Call reset-password with code + password + confirm_password
//! 3. Verify the response
//!
//! # Test Coverage
//! - [x] Happy path: Valid code + valid password resets successfully
//! - [x] Error: Missing all fields
//! - [x] Error: Missing code field
//! - [x] Error: Missing password field
//! - [x] Error: Missing confirm_password field
//! - [x] Error: Invalid code (non-existent)
//! - [x] Error: Code already used (consumed)
//! - [x] Error: Password too short (< 8 chars)
//! - [x] Error: Password missing uppercase
//! - [x] Error: Password missing lowercase
//! - [x] Error: Password missing number
//! - [x] Error: Password missing special character
//! - [x] Error: Passwords don't match
//! - [x] Error: Multiple validation errors at once
//! - [x] Security: SQL injection attempt
//! - [x] Security: XSS attempt
//! - [x] Integration: Full flow with sign-in after reset

use actix_web::{App, http::StatusCode, test};
use blazing_sun::{configure_api, state};
use serde::{Deserialize, Serialize};
use tabled::{Table, Tabled, settings::Style};
use crate::routes::api::helpers::ensure_test_user;
use uuid::Uuid;

// ============================================
// Request/Response Structures
// ============================================

#[derive(Serialize, Debug)]
struct ForgotPasswordTestRequest {
    email: String,
    return_code_for_testing: bool,
}

#[derive(Deserialize, Debug)]
struct ForgotPasswordTestResponse {
    status: String,
    message: String,
    code: Option<String>,
}

#[derive(Serialize, Debug)]
struct ResetPasswordRequest {
    code: Option<String>,
    password: Option<String>,
    confirm_password: Option<String>,
}

#[derive(Deserialize, Debug)]
struct BaseResponse {
    status: String,
    message: String,
}

#[derive(Deserialize, Debug)]
struct MissingFieldsResponse {
    status: String,
    message: String,
    errors: Vec<String>,
}

#[derive(Deserialize, Debug)]
struct ResetPasswordValidationResponse {
    status: String,
    message: String,
    #[serde(default)]
    code_errors: Vec<String>,
    #[serde(default)]
    password_errors: Vec<String>,
    #[serde(default)]
    confirm_password_errors: Vec<String>,
}

#[derive(Serialize, Debug)]
struct SignInRequest {
    email: String,
    password: String,
}

#[derive(Deserialize, Debug)]
struct SignInResponse {
    status: String,
    message: String,
    token: Option<String>,
}

// ============================================
// Test Result Formatting
// ============================================

#[derive(Tabled)]
struct TestResult {
    #[tabled(rename = "Check")]
    check: String,
    #[tabled(rename = "Expected")]
    expected: String,
    #[tabled(rename = "Actual")]
    actual: String,
    #[tabled(rename = "Status")]
    status: String,
}

impl TestResult {
    fn new(check: &str, expected: &str, actual: &str, passed: bool) -> Self {
        Self {
            check: check.to_string(),
            expected: expected.to_string(),
            actual: actual.to_string(),
            status: if passed {
                "PASS".to_string()
            } else {
                "FAIL".to_string()
            },
        }
    }
}

fn print_test_header(title: &str) {
    println!();
    println!("================================================================");
    println!("  {}", title);
    println!("================================================================");
    println!();
}

fn print_test_results(results: &[TestResult]) {
    let table = Table::new(results).with(Style::rounded()).to_string();
    println!("{}", table);

    let total = results.len();
    let passed = results.iter().filter(|r| r.status == "PASS").count();
    let failed = total - passed;

    println!();
    println!(
        "Summary: Total: {} | Passed: {} | Failed: {}",
        total, passed, failed
    );
    println!();
}

// ============================================
// Helper: Get valid code from forgot-password
// ============================================

// Note: Helper function is inlined in tests to avoid complex generic type annotations
// Each test that needs a code will call forgot-password directly

// ============================================
// Test: Happy Path - Valid Reset
// ============================================

/// Test: Valid code + valid password resets successfully
///
/// Flow:
/// 1. Get code from forgot-password
/// 2. Reset password with valid code and strong password
/// 3. Verify success response
#[actix_rt::test]
async fn test_reset_password_valid() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - VALID (Happy Path)");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state.clone()).configure(configure_api)).await;

    let mut results = vec![];

    // Step 1: Get code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "djmyle@gmail.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");
    let code = forgot_response.code;

    let code_obtained = code.is_some();
    results.push(TestResult::new(
        "Code Obtained",
        "true",
        &format!("{}", code_obtained),
        code_obtained,
    ));

    if !code_obtained {
        print_test_results(&results);
        panic!("Failed to obtain code from forgot-password");
    }

    let code = code.unwrap();

    // Step 2: Reset password
    let payload = ResetPasswordRequest {
        code: Some(code),
        password: Some("NewPassword123!".to_string()),
        confirm_password: Some("NewPassword123!".to_string()),
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: BaseResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let http_pass = status_code == StatusCode::OK;
    results.push(TestResult::new(
        "HTTP Status",
        "200 OK",
        &format!("{}", status_code),
        http_pass,
    ));

    let status_pass = response.status == "success";
    results.push(TestResult::new(
        "Response Status",
        "success",
        &response.status,
        status_pass,
    ));

    let message_pass = response.message == "Password reset successfully";
    results.push(TestResult::new(
        "Response Message",
        "Password reset successfully",
        &response.message,
        message_pass,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 200 OK");
    assert!(status_pass, "Response status should be 'success'");
    assert!(message_pass, "Response message should be 'Password reset successfully'");
}

// ============================================
// Test: Error - Missing All Fields
// ============================================

/// Test: Request with no fields
///
/// When all fields are missing:
/// - HTTP Status: 400 Bad Request
/// - Errors array contains all required field messages
#[actix_rt::test]
async fn test_reset_password_missing_all_fields() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - MISSING ALL FIELDS");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let payload = serde_json::json!({});

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: MissingFieldsResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let mut results = vec![];

    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_code_error = response.errors.contains(&"code is required".to_string());
    results.push(TestResult::new(
        "Code Required Error",
        "true",
        &format!("{}", has_code_error),
        has_code_error,
    ));

    let has_password_error = response.errors.contains(&"password is required".to_string());
    results.push(TestResult::new(
        "Password Required Error",
        "true",
        &format!("{}", has_password_error),
        has_password_error,
    ));

    let has_confirm_error = response
        .errors
        .contains(&"confirm_password is required".to_string());
    results.push(TestResult::new(
        "Confirm Password Required Error",
        "true",
        &format!("{}", has_confirm_error),
        has_confirm_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_code_error, "Should have 'code is required' error");
    assert!(has_password_error, "Should have 'password is required' error");
    assert!(has_confirm_error, "Should have 'confirm_password is required' error");
}

// ============================================
// Test: Error - Missing Code
// ============================================

/// Test: Missing code field only
#[actix_rt::test]
async fn test_reset_password_missing_code() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - MISSING CODE");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let payload = ResetPasswordRequest {
        code: None,
        password: Some("NewPassword123!".to_string()),
        confirm_password: Some("NewPassword123!".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: MissingFieldsResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let mut results = vec![];

    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_code_error = response.errors.contains(&"code is required".to_string());
    results.push(TestResult::new(
        "Has Code Error",
        "true",
        &format!("{}", has_code_error),
        has_code_error,
    ));

    // Should NOT have password errors
    let no_password_error = !response.errors.contains(&"password is required".to_string());
    results.push(TestResult::new(
        "No Password Error",
        "true",
        &format!("{}", no_password_error),
        no_password_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_code_error, "Should have 'code is required' error");
}

// ============================================
// Test: Error - Missing Password
// ============================================

/// Test: Missing password field only
#[actix_rt::test]
async fn test_reset_password_missing_password() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - MISSING PASSWORD");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state.clone()).configure(configure_api)).await;

    let payload = ResetPasswordRequest {
        code: Some("1234567890123456789012345678901234567890".to_string()),
        password: None,
        confirm_password: Some("NewPassword123!".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: MissingFieldsResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let mut results = vec![];

    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_password_error = response.errors.contains(&"password is required".to_string());
    results.push(TestResult::new(
        "Has Password Error",
        "true",
        &format!("{}", has_password_error),
        has_password_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_password_error, "Should have 'password is required' error");
}

// ============================================
// Test: Error - Missing Confirm Password
// ============================================

/// Test: Missing confirm_password field only
#[actix_rt::test]
async fn test_reset_password_missing_confirm_password() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - MISSING CONFIRM PASSWORD");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state.clone()).configure(configure_api)).await;

    let payload = ResetPasswordRequest {
        code: Some("1234567890123456789012345678901234567890".to_string()),
        password: Some("NewPassword123!".to_string()),
        confirm_password: None,
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: MissingFieldsResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let mut results = vec![];

    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_confirm_error = response
        .errors
        .contains(&"confirm_password is required".to_string());
    results.push(TestResult::new(
        "Has Confirm Password Error",
        "true",
        &format!("{}", has_confirm_error),
        has_confirm_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_confirm_error, "Should have 'confirm_password is required' error");
}

// ============================================
// Test: Error - Invalid Code (Non-existent)
// ============================================

/// Test: Code does not exist in database
#[actix_rt::test]
async fn test_reset_password_invalid_code() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - INVALID CODE");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let payload = ResetPasswordRequest {
        code: Some("0000000000000000000000000000000000000000".to_string()),
        password: Some("NewPassword123!".to_string()),
        confirm_password: Some("NewPassword123!".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: ResetPasswordValidationResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let mut results = vec![];

    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_code_error = response
        .code_errors
        .contains(&"invalid or expired code".to_string());
    results.push(TestResult::new(
        "Code Error",
        "invalid or expired code",
        &format!("{:?}", response.code_errors),
        has_code_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_code_error, "Should have 'invalid or expired code' error");
}

// ============================================
// Test: Error - Code Already Used
// ============================================

/// Test: Code has already been consumed
#[actix_rt::test]
async fn test_reset_password_code_already_used() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - CODE ALREADY USED");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let mut results = vec![];

    // Step 1: Get code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "djmyle@gmail.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");
    let code = forgot_response.code;

    if code.is_none() {
        results.push(TestResult::new("Code Obtained", "true", "false", false));
        print_test_results(&results);
        panic!("Failed to obtain code");
    }

    let code = code.unwrap();
    results.push(TestResult::new("Code Obtained", "true", "true", true));

    // Step 2: Use the code (first time - should succeed)
    let payload = ResetPasswordRequest {
        code: Some(code.clone()),
        password: Some("NewPassword123!".to_string()),
        confirm_password: Some("NewPassword123!".to_string()),
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let first_use_ok = resp.status() == StatusCode::OK;
    results.push(TestResult::new(
        "First Use",
        "200 OK",
        &format!("{}", resp.status()),
        first_use_ok,
    ));

    // Step 3: Try to use the same code again
    let payload2 = ResetPasswordRequest {
        code: Some(code),
        password: Some("AnotherPassword456!".to_string()),
        confirm_password: Some("AnotherPassword456!".to_string()),
    };

    let req2 = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload2)
        .to_request();

    let resp2 = test::call_service(&app, req2).await;
    let status_code = resp2.status();
    let body = test::read_body(resp2).await;
    let response: ResetPasswordValidationResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    let second_use_rejected = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "Second Use Rejected",
        "400 Bad Request",
        &format!("{}", status_code),
        second_use_rejected,
    ));

    let has_used_error = response
        .code_errors
        .iter()
        .any(|e| e.contains("expired") || e.contains("used"));
    results.push(TestResult::new(
        "Has Used/Expired Error",
        "true",
        &format!("{:?}", response.code_errors),
        has_used_error,
    ));

    print_test_results(&results);

    assert!(first_use_ok, "First use should succeed");
    assert!(second_use_rejected, "Second use should be rejected");
    assert!(has_used_error, "Should indicate code was used or expired");
}

// ============================================
// Test: Error - Password Too Short
// ============================================

/// Test: Password less than 8 characters
#[actix_rt::test]
async fn test_reset_password_too_short() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - PASSWORD TOO SHORT");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let mut results = vec![];

    // Get code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "djmyle@gmail.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");
    let code = forgot_response.code;

    if code.is_none() {
        panic!("Failed to obtain code");
    }
    let code = code.unwrap();

    let payload = ResetPasswordRequest {
        code: Some(code),
        password: Some("Short1!".to_string()), // Only 7 characters
        confirm_password: Some("Short1!".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: ResetPasswordValidationResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_length_error = response
        .password_errors
        .iter()
        .any(|e| e.contains("8 characters"));
    results.push(TestResult::new(
        "Has Length Error",
        "minimum 8 characters",
        &format!("{:?}", response.password_errors),
        has_length_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_length_error, "Should have minimum 8 characters error");
}

// ============================================
// Test: Error - Password Missing Uppercase
// ============================================

/// Test: Password without uppercase letter
#[actix_rt::test]
async fn test_reset_password_missing_uppercase() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - MISSING UPPERCASE");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let mut results = vec![];

    // Get code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "djmyle@gmail.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");
    let code = forgot_response.code;

    if code.is_none() {
        panic!("Failed to obtain code");
    }
    let code = code.unwrap();

    let payload = ResetPasswordRequest {
        code: Some(code),
        password: Some("password123!".to_string()), // No uppercase
        confirm_password: Some("password123!".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: ResetPasswordValidationResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_uppercase_error = response
        .password_errors
        .iter()
        .any(|e| e.contains("uppercase"));
    results.push(TestResult::new(
        "Has Uppercase Error",
        "at least one uppercase letter",
        &format!("{:?}", response.password_errors),
        has_uppercase_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_uppercase_error, "Should have uppercase letter error");
}

// ============================================
// Test: Error - Password Missing Lowercase
// ============================================

/// Test: Password without lowercase letter
#[actix_rt::test]
async fn test_reset_password_missing_lowercase() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - MISSING LOWERCASE");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let mut results = vec![];

    // Get code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "djmyle@gmail.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");
    let code = forgot_response.code;

    if code.is_none() {
        panic!("Failed to obtain code");
    }
    let code = code.unwrap();

    let payload = ResetPasswordRequest {
        code: Some(code),
        password: Some("PASSWORD123!".to_string()), // No lowercase
        confirm_password: Some("PASSWORD123!".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: ResetPasswordValidationResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_lowercase_error = response
        .password_errors
        .iter()
        .any(|e| e.contains("lowercase"));
    results.push(TestResult::new(
        "Has Lowercase Error",
        "at least one lowercase letter",
        &format!("{:?}", response.password_errors),
        has_lowercase_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_lowercase_error, "Should have lowercase letter error");
}

// ============================================
// Test: Error - Password Missing Number
// ============================================

/// Test: Password without any number
#[actix_rt::test]
async fn test_reset_password_missing_number() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - MISSING NUMBER");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let mut results = vec![];

    // Get code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "djmyle@gmail.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");
    let code = forgot_response.code;

    if code.is_none() {
        panic!("Failed to obtain code");
    }
    let code = code.unwrap();

    let payload = ResetPasswordRequest {
        code: Some(code),
        password: Some("Password!".to_string()), // No number
        confirm_password: Some("Password!".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: ResetPasswordValidationResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_number_error = response.password_errors.iter().any(|e| e.contains("number"));
    results.push(TestResult::new(
        "Has Number Error",
        "at least one number",
        &format!("{:?}", response.password_errors),
        has_number_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_number_error, "Should have number requirement error");
}

// ============================================
// Test: Error - Password Missing Special Character
// ============================================

/// Test: Password without special character
#[actix_rt::test]
async fn test_reset_password_missing_special() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - MISSING SPECIAL CHARACTER");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let mut results = vec![];

    // Get code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "djmyle@gmail.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");
    let code = forgot_response.code;

    if code.is_none() {
        panic!("Failed to obtain code");
    }
    let code = code.unwrap();

    let payload = ResetPasswordRequest {
        code: Some(code),
        password: Some("Password123".to_string()), // No special character
        confirm_password: Some("Password123".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: ResetPasswordValidationResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_special_error = response
        .password_errors
        .iter()
        .any(|e| e.contains("special"));
    results.push(TestResult::new(
        "Has Special Char Error",
        "at least one special character",
        &format!("{:?}", response.password_errors),
        has_special_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_special_error, "Should have special character error");
}

// ============================================
// Test: Error - Passwords Don't Match
// ============================================

/// Test: password and confirm_password are different
#[actix_rt::test]
async fn test_reset_password_mismatch() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - PASSWORDS DON'T MATCH");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let mut results = vec![];

    // Get code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "djmyle@gmail.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");
    let code = forgot_response.code;

    if code.is_none() {
        panic!("Failed to obtain code");
    }
    let code = code.unwrap();

    let payload = ResetPasswordRequest {
        code: Some(code),
        password: Some("NewPassword123!".to_string()),
        confirm_password: Some("DifferentPassword123!".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: ResetPasswordValidationResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_mismatch_error = response
        .confirm_password_errors
        .iter()
        .any(|e| e.contains("match"));
    results.push(TestResult::new(
        "Has Mismatch Error",
        "passwords do not match",
        &format!("{:?}", response.confirm_password_errors),
        has_mismatch_error,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_mismatch_error, "Should have passwords do not match error");
}

// ============================================
// Test: Error - Multiple Validation Errors
// ============================================

/// Test: Multiple validation errors at once
#[actix_rt::test]
async fn test_reset_password_multiple_errors() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - MULTIPLE VALIDATION ERRORS");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Use invalid code + weak password + mismatch
    let payload = ResetPasswordRequest {
        code: Some("0000000000000000000000000000000000000000".to_string()),
        password: Some("weak".to_string()), // Too short, no uppercase, no number, no special
        confirm_password: Some("different".to_string()), // Mismatch
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: ResetPasswordValidationResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let mut results = vec![];

    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    let has_code_error = !response.code_errors.is_empty();
    results.push(TestResult::new(
        "Has Code Errors",
        "true",
        &format!("{:?}", response.code_errors),
        has_code_error,
    ));

    let has_password_errors = !response.password_errors.is_empty();
    results.push(TestResult::new(
        "Has Password Errors",
        "true",
        &format!("{:?}", response.password_errors),
        has_password_errors,
    ));

    let has_confirm_errors = !response.confirm_password_errors.is_empty();
    results.push(TestResult::new(
        "Has Confirm Password Errors",
        "true",
        &format!("{:?}", response.confirm_password_errors),
        has_confirm_errors,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(has_code_error, "Should have code errors");
    assert!(has_password_errors, "Should have password errors");
    assert!(has_confirm_errors, "Should have confirm_password errors");
}

// ============================================
// Test: Security - SQL Injection
// ============================================

/// Test: SQL injection attempt in code field
#[actix_rt::test]
async fn test_reset_password_sql_injection() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - SQL INJECTION ATTEMPT");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let payload = ResetPasswordRequest {
        code: Some("'; DROP TABLE users; --000000000000".to_string()),
        password: Some("NewPassword123!".to_string()),
        confirm_password: Some("NewPassword123!".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();

    // Assert
    let mut results = vec![];

    // Should NOT cause 500 error
    let not_server_error = status_code != StatusCode::INTERNAL_SERVER_ERROR;
    results.push(TestResult::new(
        "No Server Error",
        "true",
        &format!("{} ({})", not_server_error, status_code),
        not_server_error,
    ));

    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    print_test_results(&results);

    assert!(not_server_error, "SQL injection should not cause server error");
}

// ============================================
// Test: Security - XSS Attempt
// ============================================

/// Test: XSS attempt in password field
#[actix_rt::test]
async fn test_reset_password_xss_attempt() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - XSS ATTEMPT");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let mut results = vec![];

    // Get code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "djmyle@gmail.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");
    let code = forgot_response.code;

    if code.is_none() {
        panic!("Failed to obtain code");
    }
    let code = code.unwrap();

    let payload = ResetPasswordRequest {
        code: Some(code),
        password: Some("<script>alert('XSS')</script>Password123!".to_string()),
        confirm_password: Some("<script>alert('XSS')</script>Password123!".to_string()),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let body_str = String::from_utf8_lossy(&body);

    // Should be OK (password validation passes for this input)
    let http_ok = status_code == StatusCode::OK || status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "Handled Safely",
        "200 or 400",
        &format!("{}", status_code),
        http_ok,
    ));

    // Response should not contain unescaped script tags
    let no_xss = !body_str.contains("<script>");
    results.push(TestResult::new(
        "No Unescaped XSS",
        "true",
        &format!("{}", no_xss),
        no_xss,
    ));

    print_test_results(&results);

    assert!(http_ok, "Should handle XSS attempt safely");
    assert!(no_xss, "Response should not contain unescaped script tags");
}

// ============================================
// Test: Invalid JSON
// ============================================

/// Test: Invalid JSON body
#[actix_rt::test]
async fn test_reset_password_invalid_json() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - INVALID JSON");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .insert_header(("Content-Type", "application/json"))
        .set_payload("{invalid json}")
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();

    // Assert
    let mut results = vec![];

    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    print_test_results(&results);

    assert!(
        status_code == StatusCode::BAD_REQUEST || status_code == StatusCode::UNPROCESSABLE_ENTITY,
        "Invalid JSON should return 400 or 422"
    );
}

// ============================================
// Test: Full Integration Flow with Sign-In
// ============================================

/// Test: Complete flow - forgot password → reset → sign in with new password
#[actix_rt::test]
async fn test_reset_password_full_integration() {
    dotenv::dotenv().ok();

    print_test_header("RESET PASSWORD - FULL INTEGRATION FLOW");

    // Arrange
    let app_state = state().await;
    let test_email = format!("reset_password_full_{}@example.com", Uuid::new_v4());
    ensure_test_user(&app_state, &test_email, "asdqwE123~~").await;
    let app = test::init_service(App::new().app_data(app_state.clone()).configure(configure_api)).await;

    let mut results = vec![];
    let new_password = "IntegrationTest123!";

    // Step 1: Get reset code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: test_email.to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");
    let code = forgot_response.code;

    let code_ok = code.is_some();
    results.push(TestResult::new(
        "Step 1: Get Code",
        "true",
        &format!("{}", code_ok),
        code_ok,
    ));

    if !code_ok {
        print_test_results(&results);
        panic!("Failed to get reset code");
    }
    let code = code.unwrap();

    // Step 2: Reset password
    let reset_payload = ResetPasswordRequest {
        code: Some(code),
        password: Some(new_password.to_string()),
        confirm_password: Some(new_password.to_string()),
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/reset-password")
        .set_json(&reset_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let reset_ok = resp.status() == StatusCode::OK;
    results.push(TestResult::new(
        "Step 2: Reset Password",
        "200 OK",
        &format!("{}", resp.status()),
        reset_ok,
    ));

    // Step 3: Sign in with new password
    let signin_payload = SignInRequest {
        email: test_email.to_string(),
        password: new_password.to_string(),
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/auth/sign-in")
        .set_json(&signin_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let signin_status = resp.status();
    let body = test::read_body(resp).await;
    let signin_response: SignInResponse =
        serde_json::from_slice(&body).expect("Failed to parse sign-in response");

    let signin_ok = signin_status == StatusCode::OK && signin_response.token.is_some();
    results.push(TestResult::new(
        "Step 3: Sign In",
        "200 OK with token",
        &format!("{} (token: {})", signin_status, signin_response.token.is_some()),
        signin_ok,
    ));

    print_test_results(&results);

    assert!(code_ok, "Should get reset code");
    assert!(reset_ok, "Should reset password");
    assert!(signin_ok, "Should sign in with new password");
}
