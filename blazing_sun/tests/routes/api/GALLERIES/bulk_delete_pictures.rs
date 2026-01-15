//! Bulk Delete Pictures Tests
//!
//! # Route
//! - **Path**: `/api/v1/galleries/{id}/pictures/bulk-delete`
//! - **Method**: POST
//!
//! # Test Coverage
//! - [x] Bulk delete removes selected pictures from a gallery
//! - [x] Rejects picture IDs that do not belong to the gallery

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
struct BulkDeleteRequest {
    picture_ids: Vec<i64>,
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

async fn seed_gallery_with_pictures(
    app_state: &actix_web::web::Data<database::AppState>,
    owner_id: i64,
    picture_count: usize,
) -> (i64, Vec<i64>) {
    let db = app_state.db.lock().await;

    let gallery_id = blazing_sun::app::db_query::mutations::gallery::create(
        &db,
        &blazing_sun::app::db_query::mutations::gallery::CreateGalleryParams {
            user_id: owner_id,
            name: format!("Bulk Delete Gallery {}", Uuid::new_v4()),
            description: None,
            is_public: false,
            display_order: 0,
            latitude: None,
            longitude: None,
            tags: None,
            cover_image_id: None,
            cover_image_uuid: None,
        },
    )
    .await
    .expect("Failed to create gallery");

    let mut picture_ids = Vec::new();

    for index in 0..picture_count {
        let upload_uuid = Uuid::new_v4();
        let upload_id = blazing_sun::app::db_query::mutations::upload::create(
            &db,
            &blazing_sun::app::db_query::mutations::upload::CreateUploadParams {
                uuid: upload_uuid,
                original_name: format!("bulk_{}.jpg", index),
                stored_name: format!("bulk_{}.jpg", index),
                extension: "jpg".to_string(),
                mime_type: "image/jpeg".to_string(),
                size_bytes: 2048,
                storage_type: "public".to_string(),
                storage_path: format!("bulk/bulk_{}.jpg", index),
                user_id: Some(owner_id),
                title: None,
                description: None,
            },
        )
        .await
        .expect("Failed to create upload");

        let picture_id = blazing_sun::app::db_query::mutations::picture::add_to_gallery(
            &db,
            &blazing_sun::app::db_query::mutations::picture::AddPictureParams {
                gallery_id,
                upload_id,
                title: None,
                description: None,
                latitude: None,
                longitude: None,
                display_order: index as i32,
            },
        )
        .await
        .expect("Failed to add picture to gallery");

        picture_ids.push(picture_id);
    }

    (gallery_id, picture_ids)
}

#[actix_rt::test]
async fn test_bulk_delete_pictures_success() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let email = format!("bulk_delete_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &email, "TempPass123!").await;

    let (gallery_id, picture_ids) = seed_gallery_with_pictures(&app_state, user_id, 3).await;

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let payload = BulkDeleteRequest {
        picture_ids: vec![picture_ids[0], picture_ids[1]],
    };

    let req = test::TestRequest::post()
        .uri(&format!(
            "/api/v1/galleries/{}/pictures/bulk-delete",
            gallery_id
        ))
        .insert_header((
            "Authorization",
            format!("Bearer {}", create_jwt(user_id, 1)),
        ))
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let _ = test::read_body(resp).await;

    let db = app_state.db.lock().await;
    let remaining = blazing_sun::app::db_query::read::picture::count_by_gallery(&db, gallery_id)
        .await
        .expect("Failed to count pictures");
    assert_eq!(remaining, 1);
}

#[actix_rt::test]
async fn test_bulk_delete_rejects_invalid_picture_ids() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let email = format!("bulk_delete_invalid_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &email, "TempPass123!").await;

    let (gallery_id, picture_ids) = seed_gallery_with_pictures(&app_state, user_id, 1).await;
    let (_other_gallery_id, other_picture_ids) =
        seed_gallery_with_pictures(&app_state, user_id, 1).await;

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let payload = BulkDeleteRequest {
        picture_ids: vec![picture_ids[0], other_picture_ids[0]],
    };

    let req = test::TestRequest::post()
        .uri(&format!(
            "/api/v1/galleries/{}/pictures/bulk-delete",
            gallery_id
        ))
        .insert_header((
            "Authorization",
            format!("Bearer {}", create_jwt(user_id, 1)),
        ))
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::BadRequest);

    let db = app_state.db.lock().await;
    let remaining = blazing_sun::app::db_query::read::picture::count_by_gallery(&db, gallery_id)
        .await
        .expect("Failed to count pictures");
    assert_eq!(remaining, 1);
}
