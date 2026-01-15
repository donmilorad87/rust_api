//! OAuth Gallery Delete Scope Tests
//!
//! # Route
//! - **Path**: `/api/v1/oauth/galleries/{id}`
//! - **Method**: DELETE
//!
//! # Test Coverage
//! - [x] Rejects delete when client lacks galleries.delete scope (even if token has it)

use actix_web::{http::StatusCode, test, App};
use blazing_sun::app::db_query::{mutations as db_mutations, read as db_read};
use blazing_sun::bootstrap::utility::oauth_jwt;
use blazing_sun::configure_api;
use blazing_sun::database;
use blazing_sun::mq;
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
struct ErrorResponse {
    error: String,
    error_description: String,
}

#[actix_rt::test]
async fn test_delete_gallery_denied_when_client_scope_revoked() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let user_id = {
        let unique_email = format!("oauth_gallery_scope_{}@example.com", Uuid::new_v4());
        let db = app_state.db.lock().await;
        db_mutations::user::create_admin(
            &db,
            &db_mutations::user::CreateUserAdminParams {
                email: unique_email,
                password: "TempPass123!".to_string(),
                first_name: "Scope".to_string(),
                last_name: "Owner".to_string(),
                user_must_set_password: 0,
                activated: 1,
            },
        )
        .await
        .expect("Failed to create user")
    };

    let gallery_id = {
        let db = app_state.db.lock().await;
        db_mutations::gallery::create(
            &db,
            &db_mutations::gallery::CreateGalleryParams {
                user_id,
                name: "Scoped Gallery".to_string(),
                description: None,
                is_public: true,
                display_order: 0,
                latitude: None,
                longitude: None,
                tags: None,
                cover_image_id: None,
                cover_image_uuid: None,
            },
        )
        .await
        .expect("Failed to create gallery")
    };

    let client_id = format!("client_scope_{}", Uuid::new_v4());
    let client_db_id = {
        let db = app_state.db.lock().await;
        db_mutations::oauth_client::create(
            &db,
            &db_mutations::oauth_client::CreateOAuthClientParams {
                user_id,
                client_id: client_id.clone(),
                client_name: "Scoped Client".to_string(),
                client_type: "confidential".to_string(),
                description: None,
                logo_url: None,
                homepage_url: None,
                privacy_policy_url: None,
                terms_of_service_url: None,
            },
        )
        .await
        .expect("Failed to create client")
    };

    let delete_scope_id = {
        let db = app_state.db.lock().await;
        db_read::oauth_scope::get_scope_by_name(&db, "galleries.delete")
            .await
            .expect("Failed to fetch scope")
            .expect("Missing galleries.delete scope")
            .id
    };

    {
        let db = app_state.db.lock().await;
        let _ = db_mutations::oauth_scope::remove_client_scope(&db, client_db_id, delete_scope_id)
            .await;
    }

    let token = oauth_jwt::generate_access_token(
        app_state.oauth_private_key_path,
        app_state.oauth_jwt_kid,
        app_state.oauth_issuer,
        user_id,
        &client_id,
        "galleries.delete",
        app_state.oauth_access_token_ttl_seconds,
    )
    .expect("Failed to generate OAuth JWT")
    .access_token;

    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/oauth/galleries/{}", gallery_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);

    let body = test::read_body(resp).await;
    let payload: ErrorResponse =
        serde_json::from_slice(&body).expect("Failed to parse error response");

    assert_eq!(payload.error, "insufficient_scope");
    assert_eq!(
        payload.error_description,
        "You do not have scope access for deletion"
    );
}
