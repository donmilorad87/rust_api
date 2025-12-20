use actix_web::{App, http::StatusCode, test};
use money_flow::{configure, state};
use serde::Serialize;

#[actix_rt::test]
async fn test_get_profile() {
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure)).await;

    let req = test::TestRequest::get().uri("/me").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    assert_eq!(body, "Me Endpoint");
}

#[actix_rt::test]
async fn test_update_profile() {
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure)).await;

    let req = test::TestRequest::post().uri("/me").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    assert_eq!(body, "Update Me Endpoint");
}

#[actix_rt::test]
async fn test_sign_in() {
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure)).await;

    let req = test::TestRequest::post().uri("/auth/sign-in").to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::OK);

    let body = test::read_body(resp).await;
    assert_eq!(body, "Sign In Endpoint");
}

#[actix_rt::test]
async fn test_sign_up_missing_body() {
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure)).await;

    let req = test::TestRequest::post().uri("/auth/sign-up").to_request();
    let resp = test::call_service(&app, req).await;

    // Should fail without JSON body
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[actix_rt::test]
async fn test_sign_up_success() {
    let app_state = state().await;
    let app = test::init_service(App::new().app_data(app_state).configure(configure)).await;

    // Use unique email to avoid conflicts
    let unique_email = format!(
        "test_{}@example.com",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );
    #[derive(Serialize)]
    struct SignUpRequest {
        email: String,
        password: String,
        first_name: String,
        last_name: String,
    }

    let req = test::TestRequest::post()
        .uri("/auth/sign-up")
        .set_json(SignUpRequest {
            email: unique_email,
            password: "testpass123".to_string(),
            first_name: "Test".to_string(),
            last_name: "User".to_string(),
        })
        .to_request();
    let resp = test::call_service(&app, req).await;

    assert_eq!(resp.status(), StatusCode::CREATED);
}
