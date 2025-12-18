use actix_web::{http::StatusCode, test, App};
use money_flow::{configure, state};

#[actix_rt::test]
async fn test_get_profile() {
    let app_state = state().await;
    let app = test::init_service(
        App::new()
            .app_data(app_state)
            .configure(configure)
    ).await;

    let req = test::TestRequest::get().uri("/me").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    assert_eq!(body, "Me Endpoint");
}

#[actix_rt::test]
async fn test_update_profile() {
    let app_state = state().await;
    let app = test::init_service(
        App::new()
            .app_data(app_state)
            .configure(configure)
    ).await;

    let req = test::TestRequest::post().uri("/me").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    assert_eq!(body, "Update Me Endpoint");
}

#[actix_rt::test]
async fn test_sign_in() {
    let app_state = state().await;
    let app = test::init_service(
        App::new()
            .app_data(app_state)
            .configure(configure)
    ).await;

    let req = test::TestRequest::post().uri("/auth/sign-in").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    assert_eq!(body, "Sign In Endpoint");
}

#[actix_rt::test]
async fn test_sign_up_missing_body() {
    let app_state = state().await;
    let app = test::init_service(
        App::new()
            .app_data(app_state)
            .configure(configure)
    ).await;

    let req = test::TestRequest::post()
        .uri("/auth/sign-up")
        .to_request();
    let resp = test::call_service(&app, req).await;

    // Should fail without JSON body
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[actix_rt::test]
async fn test_sign_up_success() {
    let app_state = state().await;
    let app = test::init_service(
        App::new()
            .app_data(app_state)
            .configure(configure)
    ).await;

    // Use unique email to avoid conflicts
    let unique_email = format!("test_{}@example.com", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos());

    let req = test::TestRequest::post()
        .uri("/auth/sign-up")
        .set_json(serde_json::json!({
            "email": unique_email,
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "User"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::CREATED);
}
