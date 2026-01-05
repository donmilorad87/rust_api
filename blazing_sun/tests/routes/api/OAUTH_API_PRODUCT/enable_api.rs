//! OAuth API Product Enable Tests
//!
//! # Route
//! - **Path**: `/api/v1/oauth/clients/{client_id}/enable-api`
//! - **Method**: POST
//!
//! # Test Coverage
//! - [x] Enable API product auto-grants scopes

use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, state};
use serde::Deserialize;

use blazing_sun::app::db_query::read::oauth_scope as db_read_oauth_scope;
use crate::routes::api::helpers::ensure_test_user;
use uuid::Uuid;

#[derive(Deserialize)]
struct SignInResponse {
    token: String,
}

#[derive(Deserialize)]
struct CreateClientResponse {
    client_id: String,
}

#[actix_rt::test]
async fn test_enable_api_auto_grants_scopes() {
    dotenv::dotenv().ok();

    let app_state = state().await;
    let test_email = format!("oauth_api_enable_{}@example.com", Uuid::new_v4());
    ensure_test_user(&app_state, &test_email, "asdqwE123~~").await;
    let db = app_state.db.lock().await;
    let api_product = db_read_oauth_scope::get_api_product_by_key(&db, "galleries_api")
        .await
        .expect("Failed to query API products")
        .expect("Missing galleries_api product");
    drop(db);

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

    let create_client_req = test::TestRequest::post()
        .uri("/api/v1/oauth/clients")
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .set_json(serde_json::json!({
            "client_name": "Enable API Test Client",
            "client_type": "public",
            "description": "Test client for enable API scopes"
        }))
        .to_request();

    let create_client_resp = test::call_service(&app, create_client_req).await;
    assert_eq!(create_client_resp.status(), StatusCode::CREATED);

    let create_client_body = test::read_body(create_client_resp).await;
    let create_client_json: CreateClientResponse =
        serde_json::from_slice(&create_client_body).expect("Failed to parse create client JSON");

    let enable_req = test::TestRequest::post()
        .uri(&format!(
            "/api/v1/oauth/clients/{}/enable-api",
            create_client_json.client_id
        ))
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .set_json(serde_json::json!({
            "api_product_id": api_product.id
        }))
        .to_request();

    let enable_resp = test::call_service(&app, enable_req).await;
    assert_eq!(enable_resp.status(), StatusCode::OK);

    let enabled_req = test::TestRequest::get()
        .uri(&format!(
            "/api/v1/oauth/clients/{}/enabled-apis",
            create_client_json.client_id
        ))
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .to_request();

    let enabled_resp = test::call_service(&app, enabled_req).await;
    assert_eq!(enabled_resp.status(), StatusCode::OK);

    let enabled_body = test::read_body(enabled_resp).await;
    let enabled_json: serde_json::Value =
        serde_json::from_slice(&enabled_body).expect("Failed to parse enabled APIs JSON");

    let enabled_apis = enabled_json
        .get("enabled_apis")
        .and_then(|v| v.as_array())
        .expect("Missing enabled_apis array");

    let scopes: Vec<String> = enabled_apis
        .iter()
        .flat_map(|api| {
            api.get("scopes")
                .and_then(|s| s.as_array())
                .into_iter()
                .flatten()
                .filter_map(|scope| scope.get("scope_name").and_then(|n| n.as_str()).map(|s| s.to_string()))
        })
        .collect();

    assert!(scopes.contains(&"galleries.read".to_string()));
}
