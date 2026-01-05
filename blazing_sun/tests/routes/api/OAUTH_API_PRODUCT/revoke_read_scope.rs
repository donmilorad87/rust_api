//! OAuth Scope Revocation Tests
//!
//! # Route
//! - **Path**: `/api/v1/oauth/clients/{client_id}/scopes/{scope_id}`
//! - **Method**: DELETE
//!
//! # Test Coverage
//! - [x] galleries.read cannot be revoked once granted

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
async fn test_revoke_read_scope_is_blocked() {
    dotenv::dotenv().ok();

    let app_state = state().await;
    let test_email = format!("oauth_api_revoke_{}@example.com", Uuid::new_v4());
    ensure_test_user(&app_state, &test_email, "asdqwE123~~").await;
    let db = app_state.db.lock().await;
    let api_product = db_read_oauth_scope::get_api_product_by_key(&db, "galleries_api")
        .await
        .expect("Failed to query API products")
        .expect("Missing galleries_api product");
    let read_scope = db_read_oauth_scope::get_scope_by_name(&db, "galleries.read")
        .await
        .expect("Failed to query scopes")
        .expect("Missing galleries.read scope");
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
            "client_name": "Read Scope Locked Client",
            "client_type": "public",
            "description": "Test client for read scope lock"
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

    let revoke_req = test::TestRequest::delete()
        .uri(&format!(
            "/api/v1/oauth/clients/{}/scopes/{}",
            create_client_json.client_id, read_scope.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .to_request();

    let revoke_resp = test::call_service(&app, revoke_req).await;
    assert_eq!(revoke_resp.status(), StatusCode::BAD_REQUEST);

    let body = test::read_body(revoke_resp).await;
    let error: serde_json::Value =
        serde_json::from_slice(&body).expect("Failed to parse error JSON");

    assert_eq!(error.get("error").and_then(|v| v.as_str()), Some("scope_locked"));
}
