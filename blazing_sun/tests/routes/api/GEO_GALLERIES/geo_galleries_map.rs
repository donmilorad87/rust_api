//! Geo Galleries Map API Tests
//!
//! # Route
//! - **Path**: `/api/v1/geo-galleries`
//! - **Method**: GET
//!
//! # Test Coverage
//! - [x] Returns only public galleries with geo coordinates

use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, database, mq};
use serde_json::Value;
use uuid::Uuid;

use crate::routes::api::helpers::ensure_test_user;

#[actix_rt::test]
async fn test_geo_galleries_map_lists_public_geo_galleries() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let email = format!("geo_gallery_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &email, "TempPass123!").await;

    let db = app_state.db.lock().await;

    let cover_uuid = Uuid::new_v4();
    let cover_id = blazing_sun::app::db_query::mutations::upload::create(
        &db,
        &blazing_sun::app::db_query::mutations::upload::CreateUploadParams {
            uuid: cover_uuid,
            original_name: "cover.jpg".to_string(),
            stored_name: "cover.jpg".to_string(),
            extension: "jpg".to_string(),
            mime_type: "image/jpeg".to_string(),
            size_bytes: 1024,
            storage_type: "public".to_string(),
            storage_path: "geo/cover.jpg".to_string(),
            user_id: Some(user_id),
            title: None,
            description: None,
        },
    )
    .await
    .expect("Failed to create cover upload");

    let geo_gallery_id = blazing_sun::app::db_query::mutations::gallery::create(
        &db,
        &blazing_sun::app::db_query::mutations::gallery::CreateGalleryParams {
            user_id,
            name: format!("Geo Gallery {}", Uuid::new_v4()),
            description: Some("Geo gallery".to_string()),
            is_public: true,
            display_order: 0,
            latitude: Some(45.2671),
            longitude: Some(19.8335),
            tags: Some(vec!["mountain".to_string(), "lake".to_string()]),
            cover_image_id: Some(cover_id),
            cover_image_uuid: Some(cover_uuid),
        },
    )
    .await
    .expect("Failed to create geo gallery");

    let _private_geo_id = blazing_sun::app::db_query::mutations::gallery::create(
        &db,
        &blazing_sun::app::db_query::mutations::gallery::CreateGalleryParams {
            user_id,
            name: format!("Private Geo {}", Uuid::new_v4()),
            description: None,
            is_public: false,
            display_order: 1,
            latitude: Some(44.0),
            longitude: Some(20.0),
            tags: None,
            cover_image_id: None,
            cover_image_uuid: None,
        },
    )
    .await
    .expect("Failed to create private geo gallery");

    let _no_geo_id = blazing_sun::app::db_query::mutations::gallery::create(
        &db,
        &blazing_sun::app::db_query::mutations::gallery::CreateGalleryParams {
            user_id,
            name: format!("No Geo {}", Uuid::new_v4()),
            description: None,
            is_public: true,
            display_order: 2,
            latitude: None,
            longitude: None,
            tags: None,
            cover_image_id: None,
            cover_image_uuid: None,
        },
    )
    .await
    .expect("Failed to create non-geo gallery");

    drop(db);

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/api/v1/geo-galleries")
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let json: Value = serde_json::from_slice(&body).expect("Invalid JSON response");
    let galleries = json
        .get("galleries")
        .and_then(|value| value.as_array())
        .expect("Expected galleries array");

    assert!(galleries.iter().any(|gallery| {
        gallery
            .get("id")
            .and_then(|value| value.as_i64())
            == Some(geo_gallery_id)
    }));

    assert!(galleries.iter().all(|gallery| {
        gallery.get("latitude").and_then(|v| v.as_f64()).is_some()
            && gallery.get("longitude").and_then(|v| v.as_f64()).is_some()
    }));
}
