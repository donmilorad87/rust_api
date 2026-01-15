//! Super Admin Bulk User Actions Tests
//!
//! # Route
//! - **Path**: `/api/v1/admin/users/bulk`
//! - **Method**: POST
//!
//! # Test Coverage
//! - [x] Bulk delete removes selected users
//! - [x] Bulk permission update sets permissions on selected users

use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, database, mq};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::routes::api::helpers::ensure_test_user;

#[derive(Serialize)]
struct BulkActionRequest {
    action: String,
    user_ids: Vec<i64>,
    permissions: Option<i16>,
}

#[derive(Deserialize)]
struct BaseResponse {
    status: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Claims {
    sub: i64,
    role: String,
    permissions: i16,
    exp: i64,
}

fn create_superadmin_token(user_id: i64) -> String {
    let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let claims = Claims {
        sub: user_id,
        role: "user".to_string(),
        permissions: 100,
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
async fn test_bulk_delete_users() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let super_email = format!("superadmin_bulk_delete_{}@example.com", Uuid::new_v4());
    let super_id = ensure_test_user(&app_state, &super_email, "TempPass123!").await;
    {
        let db = app_state.db.lock().await;
        blazing_sun::app::db_query::mutations::user::update_permissions(&db, super_id, 100)
            .await
            .expect("Failed to set super admin permissions");
    }

    let user_a = ensure_test_user(
        &app_state,
        &format!("bulk_delete_a_{}@example.com", Uuid::new_v4()),
        "TempPass123!",
    )
    .await;
    let user_b = ensure_test_user(
        &app_state,
        &format!("bulk_delete_b_{}@example.com", Uuid::new_v4()),
        "TempPass123!",
    )
    .await;

    let token = create_superadmin_token(super_id);

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/api/v1/admin/users/bulk")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(BulkActionRequest {
            action: "delete".to_string(),
            user_ids: vec![user_a, user_b],
            permissions: None,
        })
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let payload: BaseResponse = serde_json::from_slice(&body).expect("Failed to parse response");
    assert_eq!(payload.status, "success");

    let db = app_state.db.lock().await;
    assert!(
        blazing_sun::app::db_query::read::user::get_by_id(&db, user_a)
            .await
            .is_err()
    );
    assert!(
        blazing_sun::app::db_query::read::user::get_by_id(&db, user_b)
            .await
            .is_err()
    );
}

#[actix_rt::test]
async fn test_bulk_update_permissions() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let super_email = format!("superadmin_bulk_perm_{}@example.com", Uuid::new_v4());
    let super_id = ensure_test_user(&app_state, &super_email, "TempPass123!").await;
    {
        let db = app_state.db.lock().await;
        blazing_sun::app::db_query::mutations::user::update_permissions(&db, super_id, 100)
            .await
            .expect("Failed to set super admin permissions");
    }

    let user_a = ensure_test_user(
        &app_state,
        &format!("bulk_perm_a_{}@example.com", Uuid::new_v4()),
        "TempPass123!",
    )
    .await;
    let user_b = ensure_test_user(
        &app_state,
        &format!("bulk_perm_b_{}@example.com", Uuid::new_v4()),
        "TempPass123!",
    )
    .await;

    let token = create_superadmin_token(super_id);

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/api/v1/admin/users/bulk")
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .set_json(BulkActionRequest {
            action: "set_permissions".to_string(),
            user_ids: vec![user_a, user_b],
            permissions: Some(10),
        })
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let payload: BaseResponse = serde_json::from_slice(&body).expect("Failed to parse response");
    assert_eq!(payload.status, "success");

    let db = app_state.db.lock().await;
    let user_a_row = blazing_sun::app::db_query::read::user::get_by_id(&db, user_a)
        .await
        .expect("Failed to fetch user A");
    let user_b_row = blazing_sun::app::db_query::read::user::get_by_id(&db, user_b)
        .await
        .expect("Failed to fetch user B");

    assert_eq!(user_a_row.permissions, 10);
    assert_eq!(user_b_row.permissions, 10);
}
