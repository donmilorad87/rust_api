//! Competition Flow API Tests
//!
//! # Routes
//! - `POST /api/v1/competitions`
//! - `POST /api/v1/competitions/{id}/entries`
//! - `POST /api/v1/competitions/{id}/admin-votes`
//! - `POST /api/v1/competitions/{id}/finalize`
//!
//! # Test Coverage
//! - [x] Admin creates competition, user joins with geo gallery, admin votes, winner receives prize

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
struct CreateCompetitionRequest {
    title: String,
    description: String,
    start_date: String,
    end_date: String,
    rules: String,
}

#[derive(Serialize)]
struct JoinCompetitionRequest {
    gallery_id: i64,
}

#[derive(Serialize)]
struct AdminVoteRequest {
    gallery_id: i64,
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
async fn test_competition_flow_awards_winner() {
    dotenv::dotenv().ok();

    let mq_pool = database::create_pool().await;
    let mq_queue = mq::init(mq_pool).await.expect("Failed to init MQ");
    let dyn_mq: database::DynMq = mq_queue;
    let app_state = database::state_with_mq(dyn_mq).await;

    let admin_email = format!("admin_competition_{}@example.com", Uuid::new_v4());
    let admin_id = ensure_test_user(&app_state, &admin_email, "TempPass123!").await;

    let user_email = format!("user_competition_{}@example.com", Uuid::new_v4());
    let user_id = ensure_test_user(&app_state, &user_email, "TempPass123!").await;

    let db = app_state.db.lock().await;
    blazing_sun::app::db_query::mutations::user::update_permissions(&db, admin_id, 10)
        .await
        .expect("Failed to set admin permissions");

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
            storage_path: "competitions/cover.jpg".to_string(),
            user_id: Some(user_id),
            title: None,
            description: None,
        },
    )
    .await
    .expect("Failed to create cover upload");

    let gallery_id = blazing_sun::app::db_query::mutations::gallery::create(
        &db,
        &blazing_sun::app::db_query::mutations::gallery::CreateGalleryParams {
            user_id,
            name: format!("Competition Gallery {}", Uuid::new_v4()),
            description: Some("Competition entry".to_string()),
            is_public: true,
            display_order: 0,
            latitude: Some(44.0),
            longitude: Some(20.0),
            tags: Some(vec!["trail".to_string()]),
            cover_image_id: Some(cover_id),
            cover_image_uuid: Some(cover_uuid),
        },
    )
    .await
    .expect("Failed to create gallery");

    drop(db);

    let app = test::init_service(
        App::new()
            .app_data(app_state.clone())
            .configure(configure_api),
    )
    .await;

    let start_date = (Utc::now() - Duration::days(1)).to_rfc3339();
    let end_date = (Utc::now() + Duration::days(3)).to_rfc3339();

    let create_payload = CreateCompetitionRequest {
        title: "Autumn Trails".to_string(),
        description: "Best trail photos".to_string(),
        start_date,
        end_date,
        rules: "Nature only".to_string(),
    };

    let create_req = test::TestRequest::post()
        .uri("/api/v1/competitions")
        .insert_header((
            "Authorization",
            format!("Bearer {}", create_jwt(admin_id, 10)),
        ))
        .set_json(&create_payload)
        .to_request();

    let create_resp = test::call_service(&app, create_req).await;
    assert_eq!(create_resp.status(), StatusCode::CREATED);

    let create_body = test::read_body(create_resp).await;
    let create_json: serde_json::Value =
        serde_json::from_slice(&create_body).expect("Invalid JSON response");
    let competition_id = create_json
        .get("id")
        .and_then(|value| value.as_i64())
        .expect("Expected competition id");

    let join_payload = JoinCompetitionRequest { gallery_id };
    let join_req = test::TestRequest::post()
        .uri(&format!("/api/v1/competitions/{}/entries", competition_id))
        .insert_header((
            "Authorization",
            format!("Bearer {}", create_jwt(user_id, 1)),
        ))
        .set_json(&join_payload)
        .to_request();

    let join_resp = test::call_service(&app, join_req).await;
    assert_eq!(join_resp.status(), StatusCode::CREATED);

    let vote_payload = AdminVoteRequest { gallery_id };
    let vote_req = test::TestRequest::post()
        .uri(&format!("/api/v1/competitions/{}/admin-votes", competition_id))
        .insert_header((
            "Authorization",
            format!("Bearer {}", create_jwt(admin_id, 10)),
        ))
        .set_json(&vote_payload)
        .to_request();

    let vote_resp = test::call_service(&app, vote_req).await;
    assert_eq!(vote_resp.status(), StatusCode::CREATED);

    let finalize_req = test::TestRequest::post()
        .uri(&format!("/api/v1/competitions/{}/finalize", competition_id))
        .insert_header((
            "Authorization",
            format!("Bearer {}", create_jwt(admin_id, 10)),
        ))
        .to_request();

    let finalize_resp = test::call_service(&app, finalize_req).await;
    assert_eq!(finalize_resp.status(), StatusCode::OK);

    let db = app_state.db.lock().await;
    let user = blazing_sun::app::db_query::read::user::get_by_id(&db, user_id)
        .await
        .expect("Failed to fetch user");

    assert!(user.balance >= 10000);
}
