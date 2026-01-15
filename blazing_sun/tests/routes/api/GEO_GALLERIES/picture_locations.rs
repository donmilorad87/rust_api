//! Picture Location API Tests
//!
//! # Route
//! - **Path**: `/api/v1/galleries/{id}/pictures`
//! - **Method**: POST
//!
//! # Test Coverage
//! - [x] Stores latitude and longitude for pictures

use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, database, mq};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::routes::api::helpers::ensure_test_user;

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: i64,
    role: String,
    permissions: i16,
    exp: i64,
}

#[derive(Serialize)]
struct AddPictureRequest {
    upload_id: i64,
    title: Option<String>,
    description: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
}

fn create_jwt(user_id: i64, permissions: i16) -> String {
    let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let claims = Claims {
        sub: user_id,
        role: "user".to_string(),
        permissions,
        exp: (Utc::now() + Duration::minutes(10)).timestamp(),
    };

    jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &claims,
        &jsonwebtoken::EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
    .expect("Failed to encode JWT")
}

#[actix_rt::test]
async fn test_add_picture_stores_location() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let email = format!("geo_picture_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &email, "TempPass123!").await;

    let db = app_state.db.lock().await;

    let gallery_id = blazing_sun::app::db_query::mutations::gallery::create(
        &db,
        &blazing_sun::app::db_query::mutations::gallery::CreateGalleryParams {
            user_id,
            name: format!("Geo Pictures {}", Uuid::new_v4()),
            description: None,
            is_public: false,
            display_order: 0,
            latitude: Some(45.0),
            longitude: Some(19.0),
            tags: None,
            cover_image_id: None,
            cover_image_uuid: None,
        },
    )
    .await
    .expect("Failed to create gallery");

    let upload_id = blazing_sun::app::db_query::mutations::upload::create(
        &db,
        &blazing_sun::app::db_query::mutations::upload::CreateUploadParams {
            uuid: Uuid::new_v4(),
            original_name: "photo.jpg".to_string(),
            stored_name: "photo.jpg".to_string(),
            extension: "jpg".to_string(),
            mime_type: "image/jpeg".to_string(),
            size_bytes: 2048,
            storage_type: "public".to_string(),
            storage_path: "geo/photo.jpg".to_string(),
            user_id: Some(user_id),
            title: None,
            description: None,
        },
    )
    .await
    .expect("Failed to create upload");

    drop(db);

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let payload = AddPictureRequest {
        upload_id,
        title: Some("Geo Shot".to_string()),
        description: None,
        latitude: Some(45.2512),
        longitude: Some(19.8456),
    };

    let req = test::TestRequest::post()
        .uri(&format!("/api/v1/galleries/{}/pictures", gallery_id))
        .insert_header((
            "Authorization",
            format!("Bearer {}", create_jwt(user_id, 1)),
        ))
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::CREATED);

    let body = test::read_body(resp).await;
    let response: serde_json::Value =
        serde_json::from_slice(&body).expect("Invalid JSON response");
    let picture_id = response
        .get("id")
        .and_then(|value| value.as_i64())
        .expect("Expected picture id");

    let db = app_state.db.lock().await;
    let picture = blazing_sun::app::db_query::read::picture::get_by_id(&db, picture_id)
        .await
        .expect("Failed to fetch picture");

    assert_eq!(picture.latitude, Some(45.2512));
    assert_eq!(picture.longitude, Some(19.8456));
}
