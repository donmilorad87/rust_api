//! OAuth Authorize API Tests
//!
//! # Route
//! - **Path**: `/oauth/authorize`
//! - **Method**: POST
//!
//! # Test Coverage
//! - [x] Happy path: Authorized request returns redirect URI JSON

use crate::routes::api::helpers::{ensure_oauth_client, ensure_test_user};
use actix_web::{http::StatusCode, test, App};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use blazing_sun::app::db_query::mutations as db_mutations;
use blazing_sun::{configure_api, state};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

#[derive(Deserialize)]
struct SignInResponse {
    token: String,
}

#[derive(Deserialize)]
struct AuthorizeResponse {
    redirect_uri: String,
}

fn build_pkce_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()).as_slice())
}

#[actix_rt::test]
async fn test_authorize_post_returns_redirect() {
    dotenv::dotenv().ok();

    let app_state = state().await;
    let test_email = format!("oauth_authorize_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &test_email, "asdqwE123~~").await;
    ensure_oauth_client(
        &app_state,
        user_id,
        "client_pvekxfrefvitckm4py3fqfmkovohgflg",
        "https://blazingsun.space/callback",
        &["galleries.delete", "galleries.edit", "galleries.write"],
    )
    .await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let sign_in_req = test::TestRequest::post()
        .uri("/api/v1/auth/sign-in")
        .set_json(serde_json::json!({
            "email": test_email,
            "password": "asdqwE123~~"
        }))
        .to_request();

    let sign_in_resp = test::call_service(&app, sign_in_req).await;
    assert_eq!(sign_in_resp.status(), StatusCode::OK);

    let sign_in_body = test::read_body(sign_in_resp).await;
    let sign_in_json: SignInResponse =
        serde_json::from_slice(&sign_in_body).expect("Failed to parse sign-in JSON");

    let authorize_req = test::TestRequest::post()
        .uri("/oauth/authorize")
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .set_json(serde_json::json!({
            "approved": true,
            "client_id": "client_pvekxfrefvitckm4py3fqfmkovohgflg",
            "redirect_uri": "https://blazingsun.space/callback",
            "scope": "galleries.delete galleries.edit galleries.write",
            "state": "YOUR_STATE_TOKEN_HERE",
            "code_challenge": build_pkce_challenge("test_verifier_value"),
            "code_challenge_method": "S256"
        }))
        .to_request();

    let response = timeout(
        Duration::from_secs(2),
        test::call_service(&app, authorize_req),
    )
    .await
    .expect("authorize_post timed out");

    assert_eq!(response.status(), StatusCode::OK);

    let body = test::read_body(response).await;
    let response: AuthorizeResponse =
        serde_json::from_slice(&body).expect("Failed to parse authorize JSON");

    assert!(response.redirect_uri.contains("code="));
}

#[actix_rt::test]
async fn test_authorize_post_rejects_invalid_redirect_scheme() {
    dotenv::dotenv().ok();

    let app_state = state().await;
    let test_email = format!("oauth_authorize_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &test_email, "asdqwE123~~").await;
    ensure_oauth_client(
        &app_state,
        user_id,
        "client_pvekxfrefvitckm4py3fqfmkovohgflg",
        "https://blazingsun.space/callback",
        &["galleries.delete", "galleries.edit", "galleries.write"],
    )
    .await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let sign_in_req = test::TestRequest::post()
        .uri("/api/v1/auth/sign-in")
        .set_json(serde_json::json!({
            "email": test_email,
            "password": "asdqwE123~~"
        }))
        .to_request();

    let sign_in_resp = test::call_service(&app, sign_in_req).await;
    assert_eq!(sign_in_resp.status(), StatusCode::OK);

    let sign_in_body = test::read_body(sign_in_resp).await;
    let sign_in_json: SignInResponse =
        serde_json::from_slice(&sign_in_body).expect("Failed to parse sign-in JSON");

    let authorize_req = test::TestRequest::post()
        .uri("/oauth/authorize")
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .set_json(serde_json::json!({
            "approved": true,
            "client_id": "client_pvekxfrefvitckm4py3fqfmkovohgflg",
            "redirect_uri": "fttp://blazingsun.space/callback",
            "scope": "galleries.delete galleries.edit galleries.write",
            "state": "YOUR_STATE_TOKEN_HERE",
            "code_challenge": build_pkce_challenge("test_verifier_value"),
            "code_challenge_method": "S256"
        }))
        .to_request();

    let response = test::call_service(&app, authorize_req).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = test::read_body(response).await;
    let error: serde_json::Value =
        serde_json::from_slice(&body).expect("Failed to parse error JSON");

    assert_eq!(
        error.get("error").and_then(|v| v.as_str()),
        Some("invalid_request")
    );
    assert!(error
        .get("error_description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .contains("fttp"));
}

#[actix_rt::test]
async fn test_authorize_post_requires_pkce_for_public_client() {
    dotenv::dotenv().ok();

    let app_state = state().await;
    let test_email = format!("oauth_authorize_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &test_email, "asdqwE123~~").await;
    ensure_oauth_client(
        &app_state,
        user_id,
        "client_pvekxfrefvitckm4py3fqfmkovohgflg",
        "https://blazingsun.space/callback",
        &["galleries.delete", "galleries.edit", "galleries.write"],
    )
    .await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let sign_in_req = test::TestRequest::post()
        .uri("/api/v1/auth/sign-in")
        .set_json(serde_json::json!({
            "email": test_email,
            "password": "asdqwE123~~"
        }))
        .to_request();

    let sign_in_resp = test::call_service(&app, sign_in_req).await;
    assert_eq!(sign_in_resp.status(), StatusCode::OK);

    let sign_in_body = test::read_body(sign_in_resp).await;
    let sign_in_json: SignInResponse =
        serde_json::from_slice(&sign_in_body).expect("Failed to parse sign-in JSON");

    let authorize_req = test::TestRequest::post()
        .uri("/oauth/authorize")
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .set_json(serde_json::json!({
            "approved": true,
            "client_id": "client_pvekxfrefvitckm4py3fqfmkovohgflg",
            "redirect_uri": "https://blazingsun.space/callback",
            "scope": "galleries.delete galleries.edit galleries.write",
            "state": "YOUR_STATE_TOKEN_HERE"
        }))
        .to_request();

    let response = test::call_service(&app, authorize_req).await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = test::read_body(response).await;
    let error: serde_json::Value =
        serde_json::from_slice(&body).expect("Failed to parse error JSON");

    assert_eq!(
        error.get("error").and_then(|v| v.as_str()),
        Some("invalid_request")
    );
}

#[actix_rt::test]
async fn test_authorize_get_rejects_invalid_redirect_scheme() {
    dotenv::dotenv().ok();

    let app_state = state().await;
    let test_email = format!("oauth_authorize_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &test_email, "asdqwE123~~").await;
    ensure_oauth_client(
        &app_state,
        user_id,
        "client_pvekxfrefvitckm4py3fqfmkovohgflg",
        "https://blazingsun.space/callback",
        &["galleries.delete", "galleries.edit", "galleries.write"],
    )
    .await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let request = test::TestRequest::get()
        .uri("/oauth/authorize?client_id=client_pvekxfrefvitckm4py3fqfmkovohgflg&redirect_uri=fttp%3A%2F%2Fblazingsun.space%2Fcallback&response_type=code&scope=galleries.delete+galleries.edit+galleries.write&state=YOUR_STATE_TOKEN_HERE&code_challenge=abc&code_challenge_method=S256")
        .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = test::read_body(response).await;
    let error: serde_json::Value =
        serde_json::from_slice(&body).expect("Failed to parse error JSON");

    assert_eq!(
        error.get("error").and_then(|v| v.as_str()),
        Some("invalid_request")
    );
    assert!(error
        .get("error_description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .contains("fttp"));
}

#[actix_rt::test]
async fn test_authorize_get_accepts_httos_redirect_uri_typo() {
    dotenv::dotenv().ok();

    let app_state = state().await;
    let test_email = format!("oauth_authorize_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &test_email, "asdqwE123~~").await;
    let client_db_id = ensure_oauth_client(
        &app_state,
        user_id,
        "client_pvekxfrefvitckm4py3fqfmkovohgflg",
        "https://blazingsun.space/callback",
        &["galleries.delete", "galleries.edit", "galleries.write"],
    )
    .await;
    {
        let db = app_state.db.lock().await;
        let _ = db_mutations::oauth_authorization::upsert_consent_grant(
            &db,
            &db_mutations::oauth_authorization::CreateConsentGrantParams {
                user_id,
                client_id: client_db_id,
                granted_scopes: vec![
                    "galleries.delete".to_string(),
                    "galleries.edit".to_string(),
                    "galleries.write".to_string(),
                ],
            },
        )
        .await;
    }
    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let sign_in_req = test::TestRequest::post()
        .uri("/api/v1/auth/sign-in")
        .set_json(serde_json::json!({
            "email": test_email,
            "password": "asdqwE123~~"
        }))
        .to_request();

    let sign_in_resp = test::call_service(&app, sign_in_req).await;
    assert_eq!(sign_in_resp.status(), StatusCode::OK);

    let sign_in_body = test::read_body(sign_in_resp).await;
    let sign_in_json: SignInResponse =
        serde_json::from_slice(&sign_in_body).expect("Failed to parse sign-in JSON");

    let request = test::TestRequest::get()
        .uri("/oauth/authorize?client_id=client_pvekxfrefvitckm4py3fqfmkovohgflg&redirect_uri=httos%3A%2F%2Fblazingsun.space%2Fcallback&response_type=code&scope=galleries.delete+galleries.edit+galleries.write&state=YOUR_STATE_TOKEN_HERE&code_challenge=abc&code_challenge_method=S256")
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .to_request();

    let response = test::call_service(&app, request).await;
    assert_eq!(response.status(), StatusCode::FOUND);
}
