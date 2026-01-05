//! OAuth API Disable Tests
//!
//! # Route
//! - **Path**: `/api/v1/oauth/clients/{client_id}/enabled-apis/{api_id}`
//! - **Method**: DELETE
//!
//! # Test Coverage
//! - [x] Disabling an API keeps galleries.read granted

use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, state};
use serde::Deserialize;

use blazing_sun::app::db_query::read::{oauth_scope as db_read_oauth_scope, oauth_client as db_read_oauth_client};
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
async fn test_disable_api_preserves_read_scope() {
    dotenv::dotenv().ok();

    let app_state = state().await;
    let test_email = format!("oauth_api_disable_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &test_email, "asdqwE123~~").await;
    let db = app_state.db.lock().await;
    let api_product = db_read_oauth_scope::get_api_product_by_key(&db, "galleries_api")
        .await
        .expect("Failed to query API products")
        .expect("Missing galleries_api product");
    drop(db);

    let app = test::init_service(App::new().app_data(app_state.clone()).configure(configure_api)).await;

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
            "client_name": "Disable API Preserves Read",
            "client_type": "public",
            "description": "Test client for disabling API"
        }))
        .to_request();

    let create_client_resp = test::call_service(&app, create_client_req).await;
    assert_eq!(create_client_resp.status(), StatusCode::CREATED);

    let create_client_body = test::read_body(create_client_resp).await;
    let create_client_json: CreateClientResponse =
        serde_json::from_slice(&create_client_body).expect("Failed to parse create client JSON");

    let client_id = {
        let db = app_state.db.lock().await;
        match db_read_oauth_client::get_by_client_id(&db, &create_client_json.client_id).await {
            Ok(_) => create_client_json.client_id.clone(),
            Err(sqlx::Error::RowNotFound) => {
                let clients = db_read_oauth_client::get_by_user(&db, user_id)
                    .await
                    .expect("Failed to load client by user");
                clients
                    .first()
                    .expect("Expected at least one client for user")
                    .client_id
                    .clone()
            }
            Err(e) => panic!("Failed to read OAuth client: {}", e),
        }
    };

    let enable_req = test::TestRequest::post()
        .uri(&format!(
            "/api/v1/oauth/clients/{}/enable-api",
            client_id
        ))
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .set_json(serde_json::json!({
            "api_product_id": api_product.id
        }))
        .to_request();

    let enable_resp = test::call_service(&app, enable_req).await;
    assert_eq!(enable_resp.status(), StatusCode::OK);

    let disable_req = test::TestRequest::delete()
        .uri(&format!(
            "/api/v1/oauth/clients/{}/enabled-apis/{}",
            client_id, api_product.id
        ))
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .to_request();

    let disable_resp = test::call_service(&app, disable_req).await;
    assert_eq!(disable_resp.status(), StatusCode::OK);

    let scopes_req = test::TestRequest::get()
        .uri(&format!(
            "/api/v1/oauth/clients/{}/scopes",
            client_id
        ))
        .insert_header(("Authorization", format!("Bearer {}", sign_in_json.token)))
        .to_request();

    let scopes_resp = test::call_service(&app, scopes_req).await;
    assert_eq!(scopes_resp.status(), StatusCode::OK);

    let scopes_body = test::read_body(scopes_resp).await;
    let scopes_json: serde_json::Value =
        serde_json::from_slice(&scopes_body).expect("Failed to parse scopes JSON");

    let scopes = scopes_json
        .get("scopes")
        .and_then(|v| v.as_array())
        .expect("Missing scopes array");

    let has_read = scopes.iter().any(|s| s.get("scope_name").and_then(|n| n.as_str()) == Some("galleries.read"));
    assert!(has_read);
}
