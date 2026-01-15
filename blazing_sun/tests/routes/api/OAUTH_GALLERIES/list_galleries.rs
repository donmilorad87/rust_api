//! OAuth Gallery API Tests
//!
//! # Route
//! - **Path**: `/api/v1/oauth/galleries`
//! - **Method**: GET
//!
//! # Test Coverage
//! - [x] Accepts OAuth JWT with client_id audience

use actix_web::{http::StatusCode, test, App};
use blazing_sun::app::db_query::{mutations as db_mutations, read as db_read};
use blazing_sun::bootstrap::utility::oauth_jwt;
use blazing_sun::configure_api;
use blazing_sun::database;
use blazing_sun::mq;
use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize)]
struct GalleryResponse {
    id: i64,
    user_id: i64,
    cover_image_url: String,
}

#[derive(Deserialize)]
struct GalleriesResponse {
    total: i64,
    limit: i64,
    offset: i64,
    galleries: Vec<GalleryResponse>,
}

#[actix_rt::test]
async fn test_list_galleries_accepts_oauth_token() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let user_id = {
        let db = app_state.db.lock().await;
        let user = db_read::user::get_by_email(&db, "djmyle@gmail.com")
            .await
            .expect("Expected seeded user");
        user.id
    };

    let token = oauth_jwt::generate_access_token(
        app_state.oauth_private_key_path,
        app_state.oauth_jwt_kid,
        app_state.oauth_issuer,
        user_id,
        "client_qznw82mj8ejdfhkgv60uxp7ymomvufoa",
        "galleries.read",
        app_state.oauth_access_token_ttl_seconds,
    )
    .expect("Failed to generate OAuth JWT")
    .access_token;

    let other_user_id = {
        let unique_email = format!("oauth_gallery_other_{}@example.com", Uuid::new_v4());
        let db = app_state.db.lock().await;
        db_mutations::user::create_admin(
            &db,
            &db_mutations::user::CreateUserAdminParams {
                email: unique_email,
                password: "TempPass123!".to_string(),
                first_name: "Other".to_string(),
                last_name: "User".to_string(),
                user_must_set_password: 0,
                activated: 1,
            },
        )
        .await
        .expect("Failed to create secondary user")
    };

    let other_gallery_id = {
        let db = app_state.db.lock().await;
        db_mutations::gallery::create(
            &db,
            &db_mutations::gallery::CreateGalleryParams {
                user_id: other_user_id,
                name: "Other User Gallery".to_string(),
                description: Some("Cross-user gallery".to_string()),
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

    let app = test::init_service(App::new().app_data(app_state).configure(configure_api)).await;

    let req = test::TestRequest::get()
        .uri("/api/v1/oauth/galleries?limit=16&offset=0")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let payload: GalleriesResponse =
        serde_json::from_slice(&body).expect("Failed to parse galleries response");

    let base_url =
        std::env::var("APP_URL").unwrap_or_else(|_| "https://local.rust.com".to_string());

    assert_eq!(payload.limit, 16);
    assert_eq!(payload.offset, 0);
    assert!(payload.total >= 1);

    let other_gallery = payload
        .galleries
        .iter()
        .find(|gallery| gallery.id == other_gallery_id)
        .expect("Expected cross-user gallery in response");

    assert_eq!(other_gallery.user_id, other_user_id);
    assert!(
        other_gallery.cover_image_url.starts_with(&base_url),
        "Expected cover_image_url to include APP_URL"
    );
}
