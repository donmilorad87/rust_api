//! Upload Delete Tests
//!
//! # Route
//! - **Path**: `/api/v1/upload/{uuid}`
//! - **Method**: DELETE
//!
//! # Test Coverage
//! - [x] Admin can delete uploads they do not own
//! - [x] Delete succeeds even if file/variants are missing on disk

use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, database, mq};
use chrono::{Duration, Utc};
use serde::Deserialize;
use uuid::Uuid;

use crate::routes::api::helpers::ensure_test_user;

#[derive(serde::Serialize, serde::Deserialize)]
struct Claims {
    sub: i64,
    role: String,
    permissions: i16,
    exp: i64,
}

#[derive(Deserialize)]
struct BaseResponse {
    status: String,
    message: String,
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
async fn test_admin_can_delete_upload_missing_files() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let admin_email = format!("admin_upload_delete_{}@example.com", Uuid::new_v4());
    let admin_id = ensure_test_user(&app_state, &admin_email, "TempPass123!").await;
    {
        let db = app_state.db.lock().await;
        blazing_sun::app::db_query::mutations::user::update_permissions(&db, admin_id, 10)
            .await
            .expect("Failed to set admin permissions");
    }

    let owner_email = format!("upload_owner_{}@example.com", Uuid::new_v4());
    let owner_id = ensure_test_user(&app_state, &owner_email, "TempPass123!").await;

    let upload_uuid = Uuid::new_v4();

    {
        let db = app_state.db.lock().await;
        let upload_id = blazing_sun::app::db_query::mutations::upload::create(
            &db,
            &blazing_sun::app::db_query::mutations::upload::CreateUploadParams {
                uuid: upload_uuid,
                original_name: "missing.jpg".to_string(),
                stored_name: "missing.jpg".to_string(),
                extension: "jpg".to_string(),
                mime_type: "image/jpeg".to_string(),
                size_bytes: 1024,
                storage_type: "public".to_string(),
                storage_path: "missing/missing.jpg".to_string(),
                user_id: Some(owner_id),
                title: None,
                description: None,
            },
        )
        .await
        .expect("Failed to create upload");

        let _ = blazing_sun::app::db_query::mutations::image_variant::create(
            &db,
            &blazing_sun::app::db_query::mutations::image_variant::CreateImageVariantParams {
                upload_id,
                variant_name: "thumb".to_string(),
                stored_name: "missing_thumb.jpg".to_string(),
                width: 100,
                height: 100,
                size_bytes: 256,
                storage_path: "missing/missing_thumb.jpg".to_string(),
            },
        )
        .await;
    }

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/upload/{}", upload_uuid))
        .insert_header((
            "Authorization",
            format!("Bearer {}", create_jwt(admin_id, 10)),
        ))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let payload: BaseResponse = serde_json::from_slice(&body).expect("Failed to parse response");
    assert_eq!(payload.status, "success");

    let db = app_state.db.lock().await;
    let deleted = blazing_sun::app::db_query::read::upload::get_by_uuid(&db, &upload_uuid).await;
    assert!(deleted.is_err());
}
