//! Multiplayer Roulette Integration Tests
//!
//! # Test Coverage
//! - [x] GET /api/v1/roulette/multiplayer/state - Current game state
//! - [x] GET /api/v1/roulette/multiplayer/spin-history - Recent spins
//! - [x] GET /api/v1/roulette/multiplayer/my-bets/{spin_id} - User's bets for spin

use crate::routes::api::helpers::ensure_test_user;
use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, state};
use serde::{Deserialize, Serialize};
use tabled::{settings::Style, Table, Tabled};
use uuid::Uuid;

#[derive(Serialize)]
struct SignInRequest {
    email: String,
    password: String,
}

#[derive(Deserialize, Debug)]
struct SignInResponse {
    status: String,
    token: String,
}

#[derive(Deserialize, Debug)]
struct MultiplayerStateResponse {
    status: String,
    data: MultiplayerStateData,
}

#[derive(Deserialize, Debug)]
struct MultiplayerStateData {
    current_spin_id: Option<String>,
    phase: String,
    seconds_remaining: i32,
    connected_users: i32,
    recent_history: Vec<SpinHistoryEntry>,
}

#[derive(Deserialize, Debug)]
struct SpinHistoryEntry {
    spin_id: String,
    winning_number: String,
    winning_color: String,
}

#[derive(Deserialize, Debug)]
struct SpinHistoryResponse {
    status: String,
    data: Vec<SpinHistoryEntry>,
}

#[derive(Deserialize, Debug)]
struct MyBetsResponse {
    status: String,
    data: Vec<BetEntry>,
}

#[derive(Deserialize, Debug)]
struct BetEntry {
    bet_type: String,
    amount: i64,
    payout: Option<i64>,
}

#[derive(Deserialize, Debug)]
struct ErrorResponse {
    status: String,
    message: String,
}

#[derive(Tabled)]
struct TestResult {
    #[tabled(rename = "Test Case")]
    test_case: String,
    #[tabled(rename = "Expected")]
    expected: String,
    #[tabled(rename = "Actual")]
    actual: String,
    #[tabled(rename = "Status")]
    status: String,
}

impl TestResult {
    fn new(test_case: &str, expected: &str, actual: &str, passed: bool) -> Self {
        Self {
            test_case: test_case.to_string(),
            expected: expected.to_string(),
            actual: actual.to_string(),
            status: if passed { "PASS".to_string() } else { "FAIL".to_string() },
        }
    }
}

async fn get_auth_token(app: &impl actix_web::dev::Service<
    actix_http::Request,
    Response = actix_web::dev::ServiceResponse<impl actix_web::body::MessageBody>,
    Error = actix_web::Error,
>, email: &str, password: &str) -> Option<String> {
    let req = test::TestRequest::post()
        .uri("/api/v1/auth/sign-in")
        .set_json(SignInRequest {
            email: email.to_string(),
            password: password.to_string(),
        })
        .to_request();

    let resp = test::call_service(app, req).await;
    if resp.status() == StatusCode::OK {
        let body = test::read_body(resp).await;
        if let Ok(response) = serde_json::from_slice::<SignInResponse>(&body) {
            return Some(response.token);
        }
    }
    None
}

#[actix_rt::test]
async fn test_multiplayer_state_unauthenticated() {
    dotenv::dotenv().ok();

    println!("\n");
    println!("======================================================");
    println!("  MULTIPLAYER STATE - UNAUTHENTICATED ACCESS TEST     ");
    println!("======================================================");
    println!();

    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Request without auth token should fail
    let req = test::TestRequest::get()
        .uri("/api/v1/roulette/multiplayer/state")
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status = resp.status();

    let mut results = vec![];

    // Should return 401 Unauthorized
    let passed = status == StatusCode::UNAUTHORIZED;
    results.push(TestResult::new(
        "Unauthenticated access",
        "401 UNAUTHORIZED",
        &format!("{}", status),
        passed,
    ));

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);

    assert!(
        passed,
        "Unauthenticated access should return 401, got {}",
        status
    );
}

#[actix_rt::test]
async fn test_multiplayer_state_authenticated() {
    dotenv::dotenv().ok();

    println!("\n");
    println!("======================================================");
    println!("   MULTIPLAYER STATE - AUTHENTICATED ACCESS TEST      ");
    println!("======================================================");
    println!();

    let app_state = state().await;
    let test_email = format!("roulette_state_test_{}@example.com", Uuid::new_v4());
    let test_password = "asdqwE123~~";
    ensure_test_user(&app_state, &test_email, test_password).await;

    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Get auth token
    let token = get_auth_token(&app, &test_email, test_password)
        .await
        .expect("Failed to get auth token");

    // Request with auth token
    let req = test::TestRequest::get()
        .uri("/api/v1/roulette/multiplayer/state")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status = resp.status();

    let mut results = vec![];

    // Should return 200 OK
    let status_passed = status == StatusCode::OK;
    results.push(TestResult::new(
        "HTTP Status",
        "200 OK",
        &format!("{}", status),
        status_passed,
    ));

    if status_passed {
        let body = test::read_body(resp).await;
        if let Ok(response) = serde_json::from_slice::<MultiplayerStateResponse>(&body) {
            // Check response structure
            results.push(TestResult::new(
                "Response status",
                "success",
                &response.status,
                response.status == "success",
            ));

            results.push(TestResult::new(
                "Phase is valid",
                "betting|animation|spinning|payout",
                &response.data.phase,
                ["betting", "animation", "spinning", "payout"].contains(&response.data.phase.as_str()),
            ));

            let seconds_valid = response.data.seconds_remaining >= 0 && response.data.seconds_remaining <= 120;
            results.push(TestResult::new(
                "Seconds remaining (0-120)",
                "0-120",
                &response.data.seconds_remaining.to_string(),
                seconds_valid,
            ));

            let users_valid = response.data.connected_users >= 0;
            results.push(TestResult::new(
                "Connected users >= 0",
                ">=0",
                &response.data.connected_users.to_string(),
                users_valid,
            ));
        } else {
            results.push(TestResult::new(
                "Response parsing",
                "valid JSON",
                "parse error",
                false,
            ));
        }
    }

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);

    assert!(status_passed, "Authenticated access should return 200 OK");
}

#[actix_rt::test]
async fn test_spin_history_endpoint() {
    dotenv::dotenv().ok();

    println!("\n");
    println!("======================================================");
    println!("         SPIN HISTORY ENDPOINT TEST                   ");
    println!("======================================================");
    println!();

    let app_state = state().await;
    let test_email = format!("roulette_history_test_{}@example.com", Uuid::new_v4());
    let test_password = "asdqwE123~~";
    ensure_test_user(&app_state, &test_email, test_password).await;

    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Get auth token
    let token = get_auth_token(&app, &test_email, test_password)
        .await
        .expect("Failed to get auth token");

    // Request spin history
    let req = test::TestRequest::get()
        .uri("/api/v1/roulette/multiplayer/spin-history")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status = resp.status();

    let mut results = vec![];

    // Should return 200 OK
    let status_passed = status == StatusCode::OK;
    results.push(TestResult::new(
        "HTTP Status",
        "200 OK",
        &format!("{}", status),
        status_passed,
    ));

    if status_passed {
        let body = test::read_body(resp).await;
        if let Ok(response) = serde_json::from_slice::<SpinHistoryResponse>(&body) {
            results.push(TestResult::new(
                "Response status",
                "success",
                &response.status,
                response.status == "success",
            ));

            // History should be an array (can be empty if no spins yet)
            results.push(TestResult::new(
                "Data is array",
                "array",
                "array",
                true,
            ));

            // History should not exceed 20 entries
            let history_limit_ok = response.data.len() <= 20;
            results.push(TestResult::new(
                "History limit (<=20)",
                "<=20",
                &response.data.len().to_string(),
                history_limit_ok,
            ));
        }
    }

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);

    assert!(status_passed, "Spin history should return 200 OK");
}

#[actix_rt::test]
async fn test_my_bets_endpoint_no_bets() {
    dotenv::dotenv().ok();

    println!("\n");
    println!("======================================================");
    println!("         MY BETS ENDPOINT TEST (NO BETS)              ");
    println!("======================================================");
    println!();

    let app_state = state().await;
    let test_email = format!("roulette_mybets_test_{}@example.com", Uuid::new_v4());
    let test_password = "asdqwE123~~";
    ensure_test_user(&app_state, &test_email, test_password).await;

    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Get auth token
    let token = get_auth_token(&app, &test_email, test_password)
        .await
        .expect("Failed to get auth token");

    // Request bets for a non-existent spin
    let fake_spin_id = Uuid::new_v4().to_string();
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/roulette/multiplayer/my-bets/{}", fake_spin_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status = resp.status();

    let mut results = vec![];

    // Should return 200 OK with empty array
    let status_passed = status == StatusCode::OK;
    results.push(TestResult::new(
        "HTTP Status",
        "200 OK",
        &format!("{}", status),
        status_passed,
    ));

    if status_passed {
        let body = test::read_body(resp).await;
        if let Ok(response) = serde_json::from_slice::<MyBetsResponse>(&body) {
            results.push(TestResult::new(
                "Response status",
                "success",
                &response.status,
                response.status == "success",
            ));

            // Should be empty array for non-existent spin
            results.push(TestResult::new(
                "No bets for fake spin",
                "0 bets",
                &format!("{} bets", response.data.len()),
                response.data.is_empty(),
            ));
        }
    }

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);

    assert!(status_passed, "My bets endpoint should return 200 OK");
}

#[actix_rt::test]
async fn test_my_bets_unauthenticated() {
    dotenv::dotenv().ok();

    println!("\n");
    println!("======================================================");
    println!("      MY BETS ENDPOINT - UNAUTHENTICATED TEST         ");
    println!("======================================================");
    println!();

    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    // Request without auth
    let fake_spin_id = Uuid::new_v4().to_string();
    let req = test::TestRequest::get()
        .uri(&format!("/api/v1/roulette/multiplayer/my-bets/{}", fake_spin_id))
        .to_request();

    let resp = test::call_service(&app, req).await;
    let status = resp.status();

    let mut results = vec![];

    // Should return 401 Unauthorized
    let passed = status == StatusCode::UNAUTHORIZED;
    results.push(TestResult::new(
        "Unauthenticated access",
        "401 UNAUTHORIZED",
        &format!("{}", status),
        passed,
    ));

    let table = Table::new(&results).with(Style::rounded()).to_string();
    println!("{}", table);

    assert!(passed, "Unauthenticated access should return 401");
}
