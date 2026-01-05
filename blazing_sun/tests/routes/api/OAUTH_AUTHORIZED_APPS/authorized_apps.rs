//! OAuth Authorized Apps API Tests
//!
//! # Route
//! - **Path**: `/oauth/authorized-apps`
//! - **Method**: GET
//!
//! # Test Coverage
//! - [x] Happy path: Authenticated user receives authorized apps list

use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, state};
use serde::Deserialize;
use crate::routes::api::helpers::ensure_test_user;
use uuid::Uuid;

#[derive(Deserialize)]
struct SignInResponse {
    token: String,
}

#[derive(Deserialize)]
struct AuthorizedAppsResponse {
    status: String,
    apps: Vec<serde_json::Value>,
}

#[actix_rt::test]
async fn test_get_authorized_apps_route() {
    dotenv::dotenv().ok();

    let app_state = state().await;
    let test_email = format!("oauth_authorized_{}@example.com", Uuid::new_v4());
    ensure_test_user(&app_state, &test_email, "asdqwE123~~").await;
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

    let req = test::TestRequest::get()
        .uri("/oauth/authorized-apps")
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let response: AuthorizedAppsResponse =
        serde_json::from_slice(&body).expect("Failed to parse authorized apps JSON");

    assert_eq!(response.status, "success");
}
