//! OAuth Gallery Images API Tests
//!
//! # Route
//! - **Path**: `/api/v1/oauth/galleries/{id}/images`
//! - **Method**: GET
//!
//! # Test Coverage
//! - [x] Returns empty images list and total for gallery with no pictures

use actix_web::{http::StatusCode, test, App};
use blazing_sun::configure_api;
use blazing_sun::database;
use blazing_sun::mq;
use blazing_sun::app::db_query::mutations as db_mutations;
use blazing_sun::bootstrap::utility::oauth_jwt;
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
struct ImagesResponse {
    total: i64,
    images: Vec<ImageResponse>,
}

#[derive(Deserialize)]
struct ImageResponse {
    id: i64,
}

#[actix_rt::test]
async fn test_gallery_images_empty_list() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let other_user_id = {
        let unique_email = format!("oauth_gallery_images_{}@example.com", Uuid::new_v4());
        let db = app_state.db.lock().await;
        db_mutations::user::create_admin(
            &db,
            &db_mutations::user::CreateUserAdminParams {
                email: unique_email,
                password: "TempPass123!".to_string(),
                first_name: "Images".to_string(),
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
                user_id: other_user_id,
                name: "Empty Gallery".to_string(),
                description: None,
                is_public: true,
                display_order: 0,
            },
        )
        .await
        .expect("Failed to create gallery")
    };

    let token = oauth_jwt::generate_access_token(
        app_state.oauth_private_key_path,
        app_state.oauth_jwt_kid,
        app_state.oauth_issuer,
        other_user_id,
        "client_qznw82mj8ejdfhkgv60uxp7ymomvufoa",
        "galleries.read",
        app_state.oauth_access_token_ttl_seconds,
    )
    .expect("Failed to generate OAuth JWT")
    .access_token;

    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let req = test::TestRequest::get()
        .uri(&format!(
            "/api/v1/oauth/galleries/{}/images?limit=16&offset=0",
            gallery_id
        ))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let payload: ImagesResponse =
        serde_json::from_slice(&body).expect("Failed to parse images response");

    assert_eq!(payload.total, 0);
    assert!(payload.images.is_empty());
}
