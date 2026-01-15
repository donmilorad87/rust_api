//! OAuth Callback Exchange Invalid Client Tests
//!
//! # Route
//! - **Path**: `/oauth/callback/exchange`
//! - **Method**: POST
//!
//! # Test Coverage
//! - [x] Invalid client_id returns invalid_client

use crate::routes::api::helpers::{ensure_oauth_client, ensure_test_user};
use actix_web::{http::StatusCode, test, App};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use blazing_sun::{configure_api, state};
use serde::Deserialize;
use sha2::{Digest, Sha256};
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

fn extract_query_param(url: &str, key: &str) -> Option<String> {
    let query = url.splitn(2, '?').nth(1)?;
    for pair in query.split('&') {
        let mut parts = pair.splitn(2, '=');
        let name = parts.next()?;
        if name == key {
            return parts.next().map(|value| value.to_string());
        }
    }
    None
}

#[actix_rt::test]
async fn test_callback_exchange_invalid_client_returns_error() {
    dotenv::dotenv().ok();

    let app_state = state().await;
    let test_email = format!("oauth_callback_invalid_{}@example.com", Uuid::new_v4());
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

    let code_verifier = "callback_exchange_invalid_client_verifier";
    let authorize_req = test::TestRequest::post()
        .uri("/oauth/authorize")
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .set_json(serde_json::json!({
            "approved": true,
            "client_id": "client_pvekxfrefvitckm4py3fqfmkovohgflg",
            "redirect_uri": "https://blazingsun.space/callback",
            "scope": "galleries.delete galleries.edit galleries.write",
            "state": "YOUR_STATE_TOKEN_HERE",
            "code_challenge": build_pkce_challenge(code_verifier),
            "code_challenge_method": "S256"
        }))
        .to_request();

    let authorize_resp = test::call_service(&app, authorize_req).await;
    assert_eq!(authorize_resp.status(), StatusCode::OK);

    let authorize_body = test::read_body(authorize_resp).await;
    let authorize_json: AuthorizeResponse =
        serde_json::from_slice(&authorize_body).expect("Failed to parse authorize JSON");

    let code = extract_query_param(&authorize_json.redirect_uri, "code")
        .expect("Expected authorization code in redirect URI");

    let exchange_req = test::TestRequest::post()
        .uri("/oauth/callback/exchange")
        .set_form(&[
            ("code", code.as_str()),
            ("redirect_uri", "https://blazingsun.space/callback"),
            ("client_id", "client_missing"),
            ("code_verifier", code_verifier),
        ])
        .to_request();

    let exchange_resp = test::call_service(&app, exchange_req).await;
    assert_eq!(exchange_resp.status(), StatusCode::BAD_REQUEST);

    let body = test::read_body(exchange_resp).await;
    let error: serde_json::Value =
        serde_json::from_slice(&body).expect("Failed to parse error JSON");

    assert_eq!(
        error.get("error").and_then(|v| v.as_str()),
        Some("invalid_client")
    );
}
