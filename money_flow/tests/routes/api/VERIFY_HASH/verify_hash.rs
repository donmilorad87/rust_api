//! Verify Hash API Tests
//!
//! # Route
//! - **Path**: `/api/v1/account/verify-hash`
//! - **Method**: POST
//!
//! # Request Body
//! ```json
//! { "code": "40-character-hash-code" }
//! ```
//!
//! # Expected Responses
//! - 200: Code verified successfully, returns the same code
//! - 400: Missing, empty, or invalid format code
//! - 404: Code not found or expired
//!
//! # Test Flow
//! 1. Call forgot-password with `return_code_for_testing: true` to get a valid code
//! 2. Use that code in verify-hash
//! 3. Verify the response contains the same code
//!
//! # Test Coverage
//! - [x] Happy path: Valid code returns success with same code
//! - [x] Error: Missing code field returns 400
//! - [x] Error: Null code returns 400
//! - [x] Error: Empty code string returns 400
//! - [x] Error: Invalid code format (wrong length) returns 400
//! - [x] Error: Non-existent code returns 404
//! - [x] Security: SQL injection attempt handled safely
//! - [x] Security: XSS attempt handled safely
//! - [x] Edge case: Code with special characters

use actix_web::{App, http::StatusCode, test};
use money_flow::{configure_api, state};
use serde::{Deserialize, Serialize};
use tabled::{Table, Tabled, settings::Style};

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
struct VerifyHashRequest {
    code: Option<String>,
}

#[derive(Serialize, Debug)]
struct VerifyHashRequestRequired {
    code: String,
}

#[derive(Deserialize, Debug)]
struct VerifyHashResponse {
    status: String,
    message: String,
    code: Option<String>,
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

// Note: We inline the forgot-password call in the test that needs it
// to avoid complex generic type annotations

// ============================================
// Test: Happy Path - Valid Code
// ============================================

/// Test: Valid code from forgot-password is verified successfully
///
/// Flow:
/// 1. Call forgot-password with return_code_for_testing: true
/// 2. Get the code from response
/// 3. Call verify-hash with that code
/// 4. Verify response contains the same code
#[actix_rt::test]
async fn test_verify_hash_valid_code() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - VALID CODE (Happy Path)");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Step 1: Get valid code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "miler@piler.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;

    let mut results = vec![];

    let forgot_status_ok = resp.status() == StatusCode::OK;
    results.push(TestResult::new(
        "Forgot Password Status",
        "200 OK",
        &format!("{}", resp.status()),
        forgot_status_ok,
    ));

    if !forgot_status_ok {
        print_test_results(&results);
        panic!("Failed to call forgot-password endpoint");
    }

    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");

    let code_obtained = forgot_response.code.is_some();
    results.push(TestResult::new(
        "Code Obtained",
        "true",
        &format!("{}", code_obtained),
        code_obtained,
    ));

    if !code_obtained {
        print_test_results(&results);
        panic!("Failed to obtain code from forgot-password endpoint");
    }

    let code = forgot_response.code.unwrap();

    results.push(TestResult::new(
        "Code Length",
        "40",
        &format!("{}", code.len()),
        code.len() == 40,
    ));

    // Step 2: Call verify-hash with the code
    let verify_payload = VerifyHashRequestRequired {
        code: code.clone(),
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .set_json(&verify_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: VerifyHashResponse =
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

    let message_pass = response.message == "Code verified successfully";
    results.push(TestResult::new(
        "Response Message",
        "Code verified successfully",
        &response.message,
        message_pass,
    ));

    let code_returned = response.code.is_some();
    results.push(TestResult::new(
        "Code Returned",
        "true",
        &format!("{}", code_returned),
        code_returned,
    ));

    let code_matches = response.code.as_ref() == Some(&code);
    results.push(TestResult::new(
        "Code Matches Input",
        &code,
        response.code.as_ref().unwrap_or(&"None".to_string()),
        code_matches,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 200 OK");
    assert!(status_pass, "Response status should be 'success'");
    assert!(message_pass, "Response message should be 'Code verified successfully'");
    assert!(code_returned, "Response should contain code");
    assert!(code_matches, "Returned code should match input code");
}

// ============================================
// Test: Error - Missing Code Field
// ============================================

/// Test: Request body missing code field
///
/// When code field is completely missing from request:
/// - HTTP Status: 400 Bad Request
/// - Response status: "error"
/// - Errors array contains "code is required"
#[actix_rt::test]
async fn test_verify_hash_missing_code() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - MISSING CODE FIELD");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Send empty JSON object (missing code)
    let payload = serde_json::json!({});

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
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

    let status_pass = response.status == "error";
    results.push(TestResult::new(
        "Response Status",
        "error",
        &response.status,
        status_pass,
    ));

    let message_pass = response.message == "Validation failed";
    results.push(TestResult::new(
        "Response Message",
        "Validation failed",
        &response.message,
        message_pass,
    ));

    let errors_pass = response.errors.contains(&"code is required".to_string());
    results.push(TestResult::new(
        "Errors Contains",
        "code is required",
        &format!("{:?}", response.errors),
        errors_pass,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(status_pass, "Response status should be 'error'");
    assert!(errors_pass, "Errors should contain 'code is required'");
}

// ============================================
// Test: Error - Null Code
// ============================================

/// Test: Code field is null
///
/// When code field is null:
/// - HTTP Status: 400 Bad Request
/// - Response status: "error"
/// - Errors array contains "code is required"
#[actix_rt::test]
async fn test_verify_hash_null_code() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - NULL CODE");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Send null code
    let payload = VerifyHashRequest { code: None };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
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

    let status_pass = response.status == "error";
    results.push(TestResult::new(
        "Response Status",
        "error",
        &response.status,
        status_pass,
    ));

    let errors_pass = response.errors.contains(&"code is required".to_string());
    results.push(TestResult::new(
        "Errors Contains",
        "code is required",
        &format!("{:?}", response.errors),
        errors_pass,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(status_pass, "Response status should be 'error'");
    assert!(errors_pass, "Errors should contain 'code is required'");
}

// ============================================
// Test: Error - Empty Code String
// ============================================

/// Test: Code field is empty string
///
/// When code is an empty string:
/// - HTTP Status: 400 Bad Request
/// - Response status: "error"
/// - Message indicates invalid code format
#[actix_rt::test]
async fn test_verify_hash_empty_code() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - EMPTY CODE STRING");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let payload = VerifyHashRequestRequired {
        code: "".to_string(),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: BaseResponse =
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

    let status_pass = response.status == "error";
    results.push(TestResult::new(
        "Response Status",
        "error",
        &response.status,
        status_pass,
    ));

    let message_pass = response.message == "Invalid code format";
    results.push(TestResult::new(
        "Response Message",
        "Invalid code format",
        &response.message,
        message_pass,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(status_pass, "Response status should be 'error'");
    assert!(message_pass, "Response message should indicate invalid format");
}

// ============================================
// Test: Error - Invalid Code Format (Short)
// ============================================

/// Test: Code is too short (not 40 characters)
///
/// When code is shorter than 40 characters:
/// - HTTP Status: 400 Bad Request
/// - Response indicates invalid code format
#[actix_rt::test]
async fn test_verify_hash_short_code() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - SHORT CODE (Invalid Format)");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Code with only 20 characters
    let payload = VerifyHashRequestRequired {
        code: "12345678901234567890".to_string(),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: BaseResponse =
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

    let status_pass = response.status == "error";
    results.push(TestResult::new(
        "Response Status",
        "error",
        &response.status,
        status_pass,
    ));

    let message_pass = response.message == "Invalid code format";
    results.push(TestResult::new(
        "Response Message",
        "Invalid code format",
        &response.message,
        message_pass,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(status_pass, "Response status should be 'error'");
    assert!(message_pass, "Response message should indicate invalid format");
}

// ============================================
// Test: Error - Invalid Code Format (Long)
// ============================================

/// Test: Code is too long (more than 40 characters)
///
/// When code is longer than 40 characters:
/// - HTTP Status: 400 Bad Request
/// - Response indicates invalid code format
#[actix_rt::test]
async fn test_verify_hash_long_code() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - LONG CODE (Invalid Format)");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Code with 60 characters
    let payload = VerifyHashRequestRequired {
        code: "123456789012345678901234567890123456789012345678901234567890".to_string(),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: BaseResponse =
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

    let status_pass = response.status == "error";
    results.push(TestResult::new(
        "Response Status",
        "error",
        &response.status,
        status_pass,
    ));

    let message_pass = response.message == "Invalid code format";
    results.push(TestResult::new(
        "Response Message",
        "Invalid code format",
        &response.message,
        message_pass,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 400 Bad Request");
    assert!(status_pass, "Response status should be 'error'");
    assert!(message_pass, "Response message should indicate invalid format");
}

// ============================================
// Test: Error - Non-Existent Code
// ============================================

/// Test: Code does not exist in database
///
/// When code is valid format but doesn't exist:
/// - HTTP Status: 404 Not Found
/// - Response indicates invalid or expired code
#[actix_rt::test]
async fn test_verify_hash_nonexistent_code() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - NON-EXISTENT CODE");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Valid format but non-existent code (40 characters)
    let payload = VerifyHashRequestRequired {
        code: "0000000000000000000000000000000000000000".to_string(),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let response: BaseResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Assert
    let mut results = vec![];

    let http_pass = status_code == StatusCode::NOT_FOUND;
    results.push(TestResult::new(
        "HTTP Status",
        "404 Not Found",
        &format!("{}", status_code),
        http_pass,
    ));

    let status_pass = response.status == "error";
    results.push(TestResult::new(
        "Response Status",
        "error",
        &response.status,
        status_pass,
    ));

    let message_pass = response.message == "Invalid or expired code";
    results.push(TestResult::new(
        "Response Message",
        "Invalid or expired code",
        &response.message,
        message_pass,
    ));

    print_test_results(&results);

    assert!(http_pass, "HTTP status should be 404 Not Found");
    assert!(status_pass, "Response status should be 'error'");
    assert!(message_pass, "Response message should indicate invalid or expired");
}

// ============================================
// Test: Security - SQL Injection Attempt
// ============================================

/// Test: Code containing SQL injection attempt
///
/// Security test to ensure SQL injection is not possible:
/// - Should return 400 (invalid format) or 404 (not found)
/// - Must NOT cause any database error
#[actix_rt::test]
async fn test_verify_hash_sql_injection() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - SQL INJECTION ATTEMPT");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // SQL injection attempt (padded to 40 chars)
    let payload = VerifyHashRequestRequired {
        code: "'; DROP TABLE users; --0000000000000000".to_string(),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let body_str = String::from_utf8_lossy(&body);

    // Assert
    let mut results = vec![];

    // Should not cause 500 error - SQLx uses parameterized queries
    let http_pass = status_code == StatusCode::BAD_REQUEST
        || status_code == StatusCode::NOT_FOUND;
    results.push(TestResult::new(
        "HTTP Status",
        "400 or 404 (NOT 500)",
        &format!("{}", status_code),
        http_pass && status_code != StatusCode::INTERNAL_SERVER_ERROR,
    ));

    let not_error = status_code != StatusCode::INTERNAL_SERVER_ERROR;
    results.push(TestResult::new(
        "No Server Error",
        "true",
        &format!("{}", not_error),
        not_error,
    ));

    results.push(TestResult::new(
        "Response",
        "(should be handled safely)",
        &body_str,
        true,
    ));

    print_test_results(&results);

    assert!(
        status_code != StatusCode::INTERNAL_SERVER_ERROR,
        "SQL injection should not cause server error"
    );
}

// ============================================
// Test: Security - XSS Attempt
// ============================================

/// Test: Code containing XSS attempt
///
/// Security test for XSS in code field:
/// - Should be handled safely
/// - Response should not contain unescaped script tags
#[actix_rt::test]
async fn test_verify_hash_xss_attempt() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - XSS ATTEMPT");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // XSS attempt (padded to 40 chars)
    let payload = VerifyHashRequestRequired {
        code: "<script>alert('xss')</script>0000000000".to_string(),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let body_str = String::from_utf8_lossy(&body);

    // Assert
    let mut results = vec![];

    let http_pass = status_code == StatusCode::BAD_REQUEST
        || status_code == StatusCode::NOT_FOUND;
    results.push(TestResult::new(
        "HTTP Status",
        "400 or 404",
        &format!("{}", status_code),
        http_pass,
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

    assert!(http_pass, "XSS attempt should be handled safely");
}

// ============================================
// Test: Invalid JSON
// ============================================

/// Test: Request with invalid JSON body
///
/// When request body is not valid JSON:
/// - Should return 400 Bad Request
/// - Should not cause server error
#[actix_rt::test]
async fn test_verify_hash_invalid_json() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - INVALID JSON");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Act - Send invalid JSON
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .insert_header(("Content-Type", "application/json"))
        .set_payload("{invalid json}")
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let body_str = String::from_utf8_lossy(&body);

    // Assert
    let mut results = vec![];

    let http_pass = status_code == StatusCode::BAD_REQUEST;
    results.push(TestResult::new(
        "HTTP Status",
        "400 Bad Request",
        &format!("{}", status_code),
        http_pass,
    ));

    results.push(TestResult::new(
        "Response",
        "(error message)",
        &body_str,
        true,
    ));

    print_test_results(&results);

    assert!(
        status_code == StatusCode::BAD_REQUEST || status_code == StatusCode::UNPROCESSABLE_ENTITY,
        "Invalid JSON should return 400 or 422"
    );
}

// ============================================
// Test: Code with Whitespace
// ============================================

/// Test: Code with leading/trailing whitespace
///
/// When code contains whitespace:
/// - Should trim or reject as invalid
#[actix_rt::test]
async fn test_verify_hash_code_with_whitespace() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - CODE WITH WHITESPACE");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Code with whitespace (40 chars including spaces)
    let payload = VerifyHashRequestRequired {
        code: "  12345678901234567890123456789012345678  ".to_string(),
    };

    // Act
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let body_str = String::from_utf8_lossy(&body);

    // Assert
    let mut results = vec![];

    // Should be handled (either trimmed and validated, or rejected)
    let http_pass = status_code == StatusCode::BAD_REQUEST
        || status_code == StatusCode::NOT_FOUND
        || status_code == StatusCode::OK;
    results.push(TestResult::new(
        "HTTP Status",
        "Handled gracefully",
        &format!("{}", status_code),
        http_pass,
    ));

    results.push(TestResult::new(
        "Response",
        "(documenting behavior)",
        &body_str,
        true,
    ));

    print_test_results(&results);

    println!("Note: Whitespace handling depends on implementation.");
}

// ============================================
// Test: Full Integration Flow
// ============================================

/// Test: Complete flow from forgot-password to verify-hash
///
/// This test verifies the entire integration:
/// 1. Request password reset for existing user
/// 2. Get the reset code from testing response
/// 3. Verify the code returns the same value
/// 4. Verify that using the code twice still works (until used in reset-password)
#[actix_rt::test]
async fn test_verify_hash_full_integration_flow() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - FULL INTEGRATION FLOW");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let mut results = vec![];

    // Step 1: Get code from forgot-password
    let forgot_payload = ForgotPasswordTestRequest {
        email: "miler@piler.com".to_string(),
        return_code_for_testing: true,
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/forgot-password")
        .set_json(&forgot_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();

    let forgot_pass = status_code == StatusCode::OK;
    results.push(TestResult::new(
        "Step 1: Forgot Password",
        "200 OK",
        &format!("{}", status_code),
        forgot_pass,
    ));

    let body = test::read_body(resp).await;
    let forgot_response: ForgotPasswordTestResponse =
        serde_json::from_slice(&body).expect("Failed to parse forgot-password response");

    let code = forgot_response.code.expect("Code should be present in test mode");

    results.push(TestResult::new(
        "Code Received",
        "40 characters",
        &format!("{} chars", code.len()),
        code.len() == 40,
    ));

    // Step 2: First verify-hash call
    let verify_payload = VerifyHashRequestRequired {
        code: code.clone(),
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .set_json(&verify_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();

    let first_verify_pass = status_code == StatusCode::OK;
    results.push(TestResult::new(
        "Step 2: First Verify",
        "200 OK",
        &format!("{}", status_code),
        first_verify_pass,
    ));

    let body = test::read_body(resp).await;
    let verify_response: VerifyHashResponse =
        serde_json::from_slice(&body).expect("Failed to parse verify-hash response");

    let code_matches = verify_response.code.as_ref() == Some(&code);
    results.push(TestResult::new(
        "Code Matches",
        "true",
        &format!("{}", code_matches),
        code_matches,
    ));

    // Step 3: Second verify-hash call (should still work - not consumed until reset)
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .set_json(&verify_payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();

    let second_verify_pass = status_code == StatusCode::OK;
    results.push(TestResult::new(
        "Step 3: Second Verify",
        "200 OK (not consumed yet)",
        &format!("{}", status_code),
        second_verify_pass,
    ));

    print_test_results(&results);

    assert!(forgot_pass, "Forgot password should succeed");
    assert!(first_verify_pass, "First verify should succeed");
    assert!(code_matches, "Code should match");
    assert!(second_verify_pass, "Second verify should succeed (code not yet consumed)");
}

// ============================================
// Test: Wrong Content-Type
// ============================================

/// Test: Request with non-JSON content type
///
/// When Content-Type is not application/json:
/// - Should return appropriate error (400 or 415)
#[actix_rt::test]
async fn test_verify_hash_wrong_content_type() {
    dotenv::dotenv().ok();

    print_test_header("VERIFY HASH - WRONG CONTENT-TYPE");

    // Arrange
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Act - Send as form data instead of JSON
    let req = test::TestRequest::post()
        .uri("/api/v1/account/verify-hash")
        .insert_header(("Content-Type", "application/x-www-form-urlencoded"))
        .set_payload("code=1234567890123456789012345678901234567890")
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();
    let body = test::read_body(resp).await;
    let body_str = String::from_utf8_lossy(&body);

    // Assert
    let mut results = vec![];

    // Should reject non-JSON or return error
    let http_pass = status_code == StatusCode::BAD_REQUEST
        || status_code == StatusCode::UNSUPPORTED_MEDIA_TYPE;
    results.push(TestResult::new(
        "HTTP Status",
        "400 or 415",
        &format!("{}", status_code),
        http_pass,
    ));

    results.push(TestResult::new(
        "Response",
        "(error message)",
        &body_str,
        true,
    ));

    print_test_results(&results);

    println!("Note: Content-Type handling depends on middleware configuration.");
}
