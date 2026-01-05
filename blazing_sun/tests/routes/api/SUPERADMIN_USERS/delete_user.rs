//! Super Admin Delete User Tests
//!
//! # Route
//! - **Path**: `/api/v1/admin/users/{id}`
//! - **Method**: DELETE
//!
//! # Test Coverage
//! - [x] Super admin can delete a user

use actix_web::{http::StatusCode, test, App};
use blazing_sun::{configure_api, database, mq};
use chrono::{Duration, Utc};
use serde::Deserialize;
use uuid::Uuid;

use crate::routes::api::helpers::ensure_test_user;

#[derive(Deserialize)]
struct BaseResponse {
    status: String,
    message: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Claims {
    sub: i64,
    role: String,
    permissions: i16,
    exp: i64,
}

#[actix_rt::test]
async fn test_superadmin_can_delete_user() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let super_email = format!("superadmin_delete_user_{}@example.com", Uuid::new_v4());
    let super_id = ensure_test_user(&app_state, &super_email, "TempPass123!").await;

    {
        let db = app_state.db.lock().await;
        blazing_sun::app::db_query::mutations::user::update_permissions(&db, super_id, 100)
            .await
            .expect("Failed to set super admin permissions");
    }

    let target_email = format!("delete_target_{}@example.com", Uuid::new_v4());
    let target_id = ensure_test_user(&app_state, &target_email, "TempPass123!").await;

    let token = {
        let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
        let claims = Claims {
            sub: super_id,
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
    };

    let app = test::init_service(App::new().app_data(app_state.clone()).configure(configure_api))
        .await;

    let req = test::TestRequest::delete()
        .uri(&format!("/api/v1/admin/users/{}", target_id))
        .insert_header(("Authorization", format!("Bearer {}", token)))
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    let payload: BaseResponse = serde_json::from_slice(&body).expect("Failed to parse response");

    assert_eq!(payload.status, "success");

    let db = app_state.db.lock().await;
    let deleted = blazing_sun::app::db_query::read::user::get_by_id(&db, target_id).await;
    assert!(deleted.is_err());
}
