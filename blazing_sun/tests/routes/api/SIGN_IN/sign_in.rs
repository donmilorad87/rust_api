//! Sign-In API Tests
//!
//! # Route
//! - **Path**: `/api/v1/auth/sign-in`
//! - **Method**: POST
//!
//! # Test Coverage
//! - [x] Happy path: Valid credentials return JWT token
//! - [ ] Error: Invalid email format
//! - [ ] Error: Wrong password
//! - [ ] Error: Non-existent user
//! - [ ] Error: Empty credentials
//! - [ ] Security: Rate limiting
//! - [ ] Security: Token expiration validation

use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, state};
use serde::{Deserialize, Serialize};
use tabled::{settings::Style, Table, Tabled};

#[derive(Serialize)]
struct SignInRequest {
    email: String,
    password: String,
}

#[derive(Deserialize, Debug)]
struct SignInResponse {
    status: String,
    message: String,
    token: String,
    user: UserResponse,
}

#[derive(Deserialize, Debug)]
struct UserResponse {
    id: i64,
    email: String,
    first_name: String,
    last_name: String,
    balance: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize, Debug)]
struct Claims {
    sub: i64,
    role: String,
    exp: i64,
}

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
                "✓ PASS".to_string()
            } else {
                "✗ FAIL".to_string()
            },
        }
    }
}

#[derive(Tabled)]
struct UserInfo {
    #[tabled(rename = "Field")]
    field: String,
    #[tabled(rename = "Value")]
    value: String,
}

#[actix_rt::test]
async fn test_sign_in() {
    dotenv::dotenv().ok();

    println!("\n");
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║                    SIGN-IN TEST SUITE                        ║");
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!();

    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let req = test::TestRequest::post()
        .uri("/api/v1/auth/sign-in")
        .set_json(SignInRequest {
            email: "miler@piler.com".to_string(),
            password: "asdqwE123~~".to_string(),
        })
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status_code = resp.status();

    let body = test::read_body(resp).await;
    let response: SignInResponse =
        serde_json::from_slice(&body).expect("Failed to parse response JSON");

    // Get JWT secret and decode token
    let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let token_data = jsonwebtoken::decode::<Claims>(
        &response.token,
        &jsonwebtoken::DecodingKey::from_secret(jwt_secret.as_bytes()),
        &jsonwebtoken::Validation::default(),
    )
    .expect("Failed to decode JWT token");
    let claims = token_data.claims;

    // Build test results
    let mut results = vec![];

    // HTTP Status
    let http_pass = status_code == StatusCode::OK;
    results.push(TestResult::new(
        "HTTP Status",
        "200 OK",
        &format!("{}", status_code),
        http_pass,
    ));

    // Response Status
    let status_pass = response.status == "success";
    results.push(TestResult::new(
        "Response Status",
        "success",
        &response.status,
        status_pass,
    ));

    // Response Message
    let message_pass = response.message == "Signed in successfully";
    results.push(TestResult::new(
        "Response Message",
        "Signed in successfully",
        &response.message,
        message_pass,
    ));

    // Token Present
    let token_pass = !response.token.is_empty();
    results.push(TestResult::new(
        "Token Present",
        "non-empty",
        if token_pass { "present" } else { "empty" },
        token_pass,
    ));

    // Token Valid
    results.push(TestResult::new(
        "Token Valid (JWT)",
        "decodable",
        "decoded successfully",
        true,
    ));

    // Token Sub matches User ID
    let sub_pass = claims.sub == response.user.id;
    results.push(TestResult::new(
        "Token Sub = User ID",
        &response.user.id.to_string(),
        &claims.sub.to_string(),
        sub_pass,
    ));

    // Email matches
    let email_pass = response.user.email == "miler@piler.com";
    results.push(TestResult::new(
        "Email Match",
        "miler@piler.com",
        &response.user.email,
        email_pass,
    ));

    // Role check
    let role_pass = claims.role == "user";
    results.push(TestResult::new(
        "Token Role",
        "user",
        &claims.role,
        role_pass,
    ));

    // Print test results table
    println!("┌─────────────────────────────────────────────────────────────┐");
    println!("│                      TEST RESULTS                           │");
    println!("└─────────────────────────────────────────────────────────────┘");

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);

    // Print user info table
    println!();
    println!("┌─────────────────────────────────────────────────────────────┐");
    println!("│                      USER DETAILS                           │");
    println!("└─────────────────────────────────────────────────────────────┘");

    let user_info = vec![
        UserInfo {
            field: "ID".to_string(),
            value: response.user.id.to_string(),
        },
        UserInfo {
            field: "Email".to_string(),
            value: response.user.email.clone(),
        },
        UserInfo {
            field: "First Name".to_string(),
            value: response.user.first_name.clone(),
        },
        UserInfo {
            field: "Last Name".to_string(),
            value: response.user.last_name.clone(),
        },
        UserInfo {
            field: "Balance".to_string(),
            value: format!("{} cents", response.user.balance),
        },
        UserInfo {
            field: "Created At".to_string(),
            value: response.user.created_at.clone(),
        },
    ];

    let user_table = Table::new(&user_info).with(Style::rounded()).to_string();
    println!("{}", user_table);

    // Print token info
    println!();
    println!("┌─────────────────────────────────────────────────────────────┐");
    println!("│                      TOKEN CLAIMS                           │");
    println!("└─────────────────────────────────────────────────────────────┘");

    let token_info = vec![
        UserInfo {
            field: "Subject (sub)".to_string(),
            value: claims.sub.to_string(),
        },
        UserInfo {
            field: "Role".to_string(),
            value: claims.role.clone(),
        },
        UserInfo {
            field: "Expires (exp)".to_string(),
            value: claims.exp.to_string(),
        },
    ];

    let token_table = Table::new(&token_info).with(Style::rounded()).to_string();
    println!("{}", token_table);

    // Summary
    let total = results.len();
    let passed = results.iter().filter(|r| r.status.contains("PASS")).count();
    let failed = total - passed;

    println!();
    println!("╔══════════════════════════════════════════════════════════════╗");
    println!("║                        SUMMARY                               ║");
    println!("╠══════════════════════════════════════════════════════════════╣");
    println!(
        "║  Total: {}  |  Passed: {}  |  Failed: {}                       ║",
        total, passed, failed
    );
    println!("╚══════════════════════════════════════════════════════════════╝");
    println!();

    // Assertions
    assert!(http_pass, "HTTP status should be 200 OK");
    assert!(status_pass, "Response status should be 'success'");
    assert!(message_pass, "Response message should match");
    assert!(token_pass, "Token should be present");
    assert!(sub_pass, "Token sub should match user id");
    assert!(email_pass, "Email should match");
    assert!(role_pass, "Role should be 'user'");
}
