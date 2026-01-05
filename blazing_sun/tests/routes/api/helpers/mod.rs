use actix_web::web;

use blazing_sun::app::db_query::{mutations as db_mutations, read as db_read};
use blazing_sun::database::AppState;

pub async fn ensure_test_user(
    app_state: &web::Data<AppState>,
    email: &str,
    password: &str,
) -> i64 {
    let db = app_state.db.lock().await;

    match db_read::user::get_by_email(&db, email).await {
        Ok(user) => {
            let _ = db_mutations::user::update_full(
                &db,
                user.id,
                &db_mutations::user::UpdateUserFullParams {
                    first_name: user.first_name.clone(),
                    last_name: user.last_name.clone(),
                    balance: None,
                    password: Some(password.to_string()),
                },
            )
            .await;

            let _ = sqlx::query!(
                "UPDATE users SET activated = 1, user_must_set_password = 0 WHERE id = $1",
                user.id
            )
            .execute(&*db)
            .await;

            user.id
        }
        Err(sqlx::Error::RowNotFound) => db_mutations::user::create_admin(
            &db,
            &db_mutations::user::CreateUserAdminParams {
                email: email.to_string(),
                password: password.to_string(),
                first_name: "Test".to_string(),
                last_name: "User".to_string(),
                user_must_set_password: 0,
                activated: 1,
            },
        )
        .await
        .expect("Failed to create test user"),
        Err(e) => panic!("Failed to query test user: {}", e),
    }
}

pub async fn ensure_oauth_client(
    app_state: &web::Data<AppState>,
    owner_id: i64,
    client_id: &str,
    redirect_uri: &str,
    scopes: &[&str],
) -> i64 {
    let db = app_state.db.lock().await;

    let client_db_id = match db_read::oauth_client::get_by_client_id(&db, client_id).await {
        Ok(client) => client.id,
        Err(sqlx::Error::RowNotFound) => db_mutations::oauth_client::create(
            &db,
            &db_mutations::oauth_client::CreateOAuthClientParams {
                user_id: owner_id,
                client_id: client_id.to_string(),
                client_name: "Test OAuth Client".to_string(),
                client_type: "public".to_string(),
                description: Some("Test OAuth client for integration tests".to_string()),
                logo_url: None,
                homepage_url: None,
                privacy_policy_url: None,
                terms_of_service_url: None,
            },
        )
        .await
        .expect("Failed to create OAuth client"),
        Err(e) => panic!("Failed to query OAuth client: {}", e),
    };

    if !db_read::oauth_client::redirect_uri_exists(&db, client_db_id, redirect_uri).await {
        let _ = db_mutations::oauth_client::create_redirect_uri(
            &db,
            &db_mutations::oauth_client::CreateRedirectUriParams {
                client_id: client_db_id,
                redirect_uri: redirect_uri.to_string(),
                description: Some("Test redirect".to_string()),
            },
        )
        .await;
    }

    for scope_name in scopes {
        if let Some(scope) = db_read::oauth_scope::get_scope_by_name(&db, scope_name)
            .await
            .expect("Failed to query scope")
        {
            let _ = db_mutations::oauth_scope::add_client_scope(&db, client_db_id, scope.id).await;
        }
    }

    client_db_id
}
