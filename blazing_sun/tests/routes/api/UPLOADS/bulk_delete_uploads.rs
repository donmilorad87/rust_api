//! Admin Bulk Delete Uploads Tests
//!
//! # Route
//! - **Path**: `/api/v1/admin/uploads/bulk-delete`
//! - **Method**: POST
//!
//! # Test Coverage
//! - [x] Admin can bulk delete uploads

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
    upload_uuids: Vec<String>,
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
async fn test_admin_bulk_delete_uploads() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let admin_email = format!("admin_bulk_uploads_{}@example.com", Uuid::new_v4());
    let admin_id = ensure_test_user(&app_state, &admin_email, "TempPass123!").await;
    {
        let db = app_state.db.lock().await;
        blazing_sun::app::db_query::mutations::user::update_permissions(&db, admin_id, 10)
            .await
            .expect("Failed to set admin permissions");
    }

    let owner_email = format!("bulk_upload_owner_{}@example.com", Uuid::new_v4());
    let owner_id = ensure_test_user(&app_state, &owner_email, "TempPass123!").await;

    let upload_uuid_1 = Uuid::new_v4();
    let upload_uuid_2 = Uuid::new_v4();

    {
        let db = app_state.db.lock().await;
        let _ = blazing_sun::app::db_query::mutations::upload::create(
            &db,
            &blazing_sun::app::db_query::mutations::upload::CreateUploadParams {
                uuid: upload_uuid_1,
                original_name: "bulk_1.jpg".to_string(),
                stored_name: "bulk_1.jpg".to_string(),
                extension: "jpg".to_string(),
                mime_type: "image/jpeg".to_string(),
                size_bytes: 1024,
                storage_type: "public".to_string(),
                storage_path: "bulk/bulk_1.jpg".to_string(),
                user_id: Some(owner_id),
                title: None,
                description: None,
            },
        )
        .await
        .expect("Failed to create upload 1");

        let _ = blazing_sun::app::db_query::mutations::upload::create(
            &db,
            &blazing_sun::app::db_query::mutations::upload::CreateUploadParams {
                uuid: upload_uuid_2,
                original_name: "bulk_2.jpg".to_string(),
                stored_name: "bulk_2.jpg".to_string(),
                extension: "jpg".to_string(),
                mime_type: "image/jpeg".to_string(),
                size_bytes: 1024,
                storage_type: "public".to_string(),
                storage_path: "bulk/bulk_2.jpg".to_string(),
                user_id: Some(owner_id),
                title: None,
                description: None,
            },
        )
        .await
        .expect("Failed to create upload 2");
    }

    let app = test::init_service(App::new().app_data(app_state.clone()).configure(configure_api))
        .await;

    let payload = BulkDeleteRequest {
        upload_uuids: vec![upload_uuid_1.to_string(), upload_uuid_2.to_string()],
    };

    let req = test::TestRequest::post()
        .uri("/api/v1/admin/uploads/bulk-delete")
        .insert_header(("Authorization", format!("Bearer {}", create_jwt(admin_id, 10))))
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let payload: BaseResponse = serde_json::from_slice(&body).expect("Failed to parse response");
    assert_eq!(payload.status, "success");

    let db = app_state.db.lock().await;
    let deleted_1 = blazing_sun::app::db_query::read::upload::get_by_uuid(&db, &upload_uuid_1).await;
    let deleted_2 = blazing_sun::app::db_query::read::upload::get_by_uuid(&db, &upload_uuid_2).await;
    assert!(deleted_1.is_err());
    assert!(deleted_2.is_err());
}
