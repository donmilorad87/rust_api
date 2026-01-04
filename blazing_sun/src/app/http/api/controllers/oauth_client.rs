//! OAuth Client API Controller
//!
//! REST API endpoints for OAuth client management (Developer Console).

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use rand::{distributions::Alphanumeric, Rng};

use crate::app::db_query::{mutations as db_mutations, read as db_read};
use crate::bootstrap::database::database::AppState;

/// Request body for creating an OAuth client
#[derive(Debug, Deserialize)]
pub struct CreateOAuthClientRequest {
    pub client_name: String,
    pub client_type: String, // 'public' or 'confidential'
    pub description: Option<String>,
    pub homepage_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub terms_of_service_url: Option<String>,
}

/// Request body for updating an OAuth client
#[derive(Debug, Deserialize)]
pub struct UpdateOAuthClientRequest {
    pub client_name: Option<String>,
    pub description: Option<String>,
    pub homepage_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub terms_of_service_url: Option<String>,
}

/// Request body for creating a redirect URI
#[derive(Debug, Deserialize)]
pub struct CreateRedirectUriRequest {
    pub redirect_uri: String,
    pub description: Option<String>,
}

/// Request body for creating an authorized domain
#[derive(Debug, Deserialize)]
pub struct CreateAuthorizedDomainRequest {
    pub domain: String,
    pub description: Option<String>,
}

/// Response for OAuth client with metadata
#[derive(Debug, Serialize)]
pub struct OAuthClientResponse {
    pub id: i64,
    pub client_id: String,
    pub client_name: String,
    pub client_type: String,
    pub description: Option<String>,
    pub homepage_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub terms_of_service_url: Option<String>,
    pub is_active: bool,
    pub redirect_uri_count: i64,
    pub authorized_domain_count: i64,
    pub secret_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// Response for redirect URI
#[derive(Debug, Serialize)]
pub struct RedirectUriResponse {
    pub id: i64,
    pub redirect_uri: String,
    pub description: Option<String>,
    pub created_at: String,
}

/// Response for authorized domain
#[derive(Debug, Serialize)]
pub struct AuthorizedDomainResponse {
    pub id: i64,
    pub domain: String,
    pub description: Option<String>,
    pub created_at: String,
}

/// Response for client secret creation
#[derive(Debug, Serialize)]
pub struct ClientSecretResponse {
    pub secret_id: i64,
    pub secret: String, // Only returned once upon creation
    pub secret_hint: String,
}

/// Generate a secure random client ID
fn generate_client_id() -> String {
    let random_string: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    format!("client_{}", random_string.to_lowercase())
}

/// Generate a secure random client secret
fn generate_client_secret() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect()
}

// ============================================================================
// OAuth Client Endpoints
// ============================================================================

/// Get all OAuth clients for the authenticated user
pub async fn get_user_clients(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> HttpResponse {
    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Fetch OAuth clients with counts
    match db_read::oauth_client::get_by_user_with_counts(&db, user_id).await {
        Ok(clients) => {
            let response: Vec<OAuthClientResponse> = clients
                .into_iter()
                .map(|c| OAuthClientResponse {
                    id: c.id,
                    client_id: c.client_id,
                    client_name: c.client_name,
                    client_type: c.client_type,
                    description: c.description,
                    homepage_url: c.homepage_url,
                    privacy_policy_url: c.privacy_policy_url,
                    terms_of_service_url: c.terms_of_service_url,
                    is_active: c.is_active,
                    redirect_uri_count: c.redirect_uri_count,
                    authorized_domain_count: c.authorized_domain_count,
                    secret_count: c.secret_count,
                    created_at: c.created_at.to_rfc3339(),
                    updated_at: c.updated_at.to_rfc3339(),
                })
                .collect();

            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "clients": response
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch user OAuth clients: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch OAuth clients"
            }))
        }
    }
}

/// Get a specific OAuth client by client_id
pub async fn get_client(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let client_id = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Fetch OAuth client by client_id and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "OAuth client not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch OAuth client: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch OAuth client"
            }));
        }
    };

    // Verify ownership
    if client.user_id != user_id {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "You don't own this OAuth client"
        }));
    }

    drop(db);
    HttpResponse::Ok().json(serde_json::json!({
        "id": client.id,
        "client_id": client.client_id,
        "client_name": client.client_name,
        "client_type": client.client_type,
        "description": client.description,
        "homepage_url": client.homepage_url,
        "privacy_policy_url": client.privacy_policy_url,
        "terms_of_service_url": client.terms_of_service_url,
        "is_active": client.is_active,
        "created_at": client.created_at.to_rfc3339(),
        "updated_at": client.updated_at.to_rfc3339()
    }))
}

/// Create a new OAuth client
pub async fn create_client(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<CreateOAuthClientRequest>,
) -> HttpResponse {
    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    // Validate client_type
    if body.client_type != "public" && body.client_type != "confidential" {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid client_type. Must be 'public' or 'confidential'"
        }));
    }

    // Validate client_name
    if body.client_name.trim().is_empty() || body.client_name.len() > 255 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Client name must be between 1 and 255 characters"
        }));
    }

    let db = state.db.lock().await;

    // Generate unique client_id
    let client_id = generate_client_id();

    // Create OAuth client
    let params = db_mutations::oauth_client::CreateOAuthClientParams {
        user_id,
        client_id: client_id.clone(),
        client_name: body.client_name.clone(),
        client_type: body.client_type.clone(),
        description: body.description.clone(),
        logo_url: None,
        homepage_url: body.homepage_url.clone(),
        privacy_policy_url: body.privacy_policy_url.clone(),
        terms_of_service_url: body.terms_of_service_url.clone(),
    };

    let client_db_id = match db_mutations::oauth_client::create(&db, &params).await {
        Ok(id) => id,
        Err(e) => {
            drop(db);
            eprintln!("Failed to create OAuth client: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create OAuth client"
            }));
        }
    };

    // Generate client secret for confidential clients
    let client_secret = if body.client_type == "confidential" {
        let secret = generate_client_secret();

        // Hash the secret with bcrypt
        let secret_hash = match bcrypt::hash(&secret, bcrypt::DEFAULT_COST) {
            Ok(hash) => hash,
            Err(e) => {
                drop(db);
                eprintln!("Failed to hash client secret: {:?}", e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to generate client secret"
                }));
            }
        };

        // Create secret hint (last 4 characters)
        let secret_hint = if secret.len() >= 4 {
            format!("****{}", &secret[secret.len() - 4..])
        } else {
            "****".to_string()
        };

        // Store hashed secret in database
        let secret_params = db_mutations::oauth_client::CreateClientSecretParams {
            client_id: client_db_id,
            secret_hash,
            secret_hint: secret_hint.clone(),
            description: Some("Initial client secret".to_string()),
        };

        match db_mutations::oauth_client::create_secret(&db, &secret_params).await {
            Ok(_secret_id) => Some(secret),
            Err(e) => {
                drop(db);
                eprintln!("Failed to create client secret: {:?}", e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to store client secret"
                }));
            }
        }
    } else {
        None
    };

    drop(db);

    // Build response
    let mut response = serde_json::json!({
        "id": client_db_id,
        "client_id": client_id,
        "client_type": body.client_type,
        "message": "OAuth client created successfully"
    });

    // Include client secret in response (only shown once)
    if let Some(secret) = client_secret {
        response["client_secret"] = serde_json::json!(secret);
        response["warning"] = serde_json::json!("Store this secret securely. It will not be shown again.");
    }

    HttpResponse::Created().json(response)
}

/// Update an OAuth client
pub async fn update_client(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<UpdateOAuthClientRequest>,
) -> HttpResponse {
    let client_id = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get client by client_id and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "OAuth client not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch OAuth client: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch OAuth client"
            }));
        }
    };

    if client.user_id != user_id {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Validate client_name if provided
    if let Some(ref name) = body.client_name {
        if name.trim().is_empty() || name.len() > 255 {
            drop(db);
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Client name must be between 1 and 255 characters"
            }));
        }
    }

    // Update OAuth client
    let params = db_mutations::oauth_client::UpdateOAuthClientParams {
        client_name: body.client_name.clone(),
        description: body.description.clone(),
        logo_url: None,
        homepage_url: body.homepage_url.clone(),
        privacy_policy_url: body.privacy_policy_url.clone(),
        terms_of_service_url: body.terms_of_service_url.clone(),
    };

    match db_mutations::oauth_client::update(&db, client.id, &params).await {
        Ok(_) => {
            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "message": "OAuth client updated successfully"
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to update OAuth client: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update OAuth client"
            }))
        }
    }
}

/// Delete an OAuth client
pub async fn delete_client(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let client_id = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get client by client_id and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "OAuth client not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch OAuth client: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch OAuth client"
            }));
        }
    };

    if client.user_id != user_id {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Delete OAuth client (CASCADE will delete related data)
    match db_mutations::oauth_client::delete(&db, client.id).await {
        Ok(_) => {
            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "message": "OAuth client deleted successfully"
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to delete OAuth client: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete OAuth client"
            }))
        }
    }
}

// ============================================================================
// Redirect URI Endpoints
// ============================================================================

/// Get all redirect URIs for a client
pub async fn get_redirect_uris(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let client_id = path.into_inner();

    // Get authenticated user ID from JWT
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get client by client_id and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "OAuth client not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch OAuth client: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch OAuth client"
            }));
        }
    };

    if client.user_id != user_id {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Fetch redirect URIs
    match db_read::oauth_client::get_redirect_uris_by_client(&db, client.id).await {
        Ok(uris) => {
            let response: Vec<RedirectUriResponse> = uris
                .into_iter()
                .map(|u| RedirectUriResponse {
                    id: u.id,
                    redirect_uri: u.redirect_uri,
                    description: u.description,
                    created_at: u.created_at.to_rfc3339(),
                })
                .collect();

            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "redirect_uris": response
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch redirect URIs: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch redirect URIs"
            }))
        }
    }
}

/// Add a redirect URI to a client
pub async fn add_redirect_uri(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<CreateRedirectUriRequest>,
) -> HttpResponse {
    let client_id = path.into_inner();

    // Get authenticated user ID
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get client by client_id and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "OAuth client not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch OAuth client: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch OAuth client"
            }));
        }
    };

    if client.user_id != user_id {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Check if URI already exists
    if db_read::oauth_client::redirect_uri_exists(&db, client.id, &body.redirect_uri).await {
        drop(db);
        return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Redirect URI already exists for this client"
        }));
    }

    // Create redirect URI
    let params = db_mutations::oauth_client::CreateRedirectUriParams {
        client_id: client.id,
        redirect_uri: body.redirect_uri.clone(),
        description: body.description.clone(),
    };

    match db_mutations::oauth_client::create_redirect_uri(&db, &params).await {
        Ok(uri_id) => {
            drop(db);
            HttpResponse::Created().json(serde_json::json!({
                "id": uri_id,
                "message": "Redirect URI added successfully"
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to create redirect URI: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to add redirect URI"
            }))
        }
    }
}

/// Delete a redirect URI
pub async fn delete_redirect_uri(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, i64)>,
) -> HttpResponse {
    let (client_id, uri_id) = path.into_inner();

    // Get authenticated user ID
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get client by client_id and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "OAuth client not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch OAuth client: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch OAuth client"
            }));
        }
    };

    if client.user_id != user_id {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Delete redirect URI
    match db_mutations::oauth_client::delete_redirect_uri(&db, uri_id).await {
        Ok(_) => {
            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "message": "Redirect URI deleted successfully"
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to delete redirect URI: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete redirect URI"
            }))
        }
    }
}

// ============================================================================
// Authorized Domain Endpoints
// ============================================================================

/// Get all authorized domains for a client
pub async fn get_authorized_domains(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> HttpResponse {
    let client_id = path.into_inner();

    // Get authenticated user ID
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get client by client_id and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "OAuth client not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch OAuth client: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch OAuth client"
            }));
        }
    };

    if client.user_id != user_id {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Fetch authorized domains
    match db_read::oauth_client::get_authorized_domains_by_client(&db, client.id).await {
        Ok(domains) => {
            let response: Vec<AuthorizedDomainResponse> = domains
                .into_iter()
                .map(|d| AuthorizedDomainResponse {
                    id: d.id,
                    domain: d.domain,
                    description: d.description,
                    created_at: d.created_at.to_rfc3339(),
                })
                .collect();

            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "authorized_domains": response
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch authorized domains: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch authorized domains"
            }))
        }
    }
}

/// Add an authorized domain to a client
pub async fn add_authorized_domain(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<CreateAuthorizedDomainRequest>,
) -> HttpResponse {
    let client_id = path.into_inner();

    // Get authenticated user ID
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get client by client_id and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "OAuth client not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch OAuth client: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch OAuth client"
            }));
        }
    };

    if client.user_id != user_id {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Check if domain already exists
    if db_read::oauth_client::authorized_domain_exists(&db, client.id, &body.domain).await {
        drop(db);
        return HttpResponse::Conflict().json(serde_json::json!({
            "error": "Authorized domain already exists for this client"
        }));
    }

    // Create authorized domain
    let params = db_mutations::oauth_client::CreateAuthorizedDomainParams {
        client_id: client.id,
        domain: body.domain.clone(),
        description: body.description.clone(),
    };

    match db_mutations::oauth_client::create_authorized_domain(&db, &params).await {
        Ok(domain_id) => {
            drop(db);
            HttpResponse::Created().json(serde_json::json!({
                "id": domain_id,
                "message": "Authorized domain added successfully"
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to create authorized domain: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to add authorized domain"
            }))
        }
    }
}

/// Delete an authorized domain
pub async fn delete_authorized_domain(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, i64)>,
) -> HttpResponse {
    let (client_id, domain_id) = path.into_inner();

    // Get authenticated user ID
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get client by client_id and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(sqlx::Error::RowNotFound) => {
            drop(db);
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "OAuth client not found"
            }));
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to fetch OAuth client: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch OAuth client"
            }));
        }
    };

    if client.user_id != user_id {
        drop(db);
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "Access denied"
        }));
    }

    // Delete authorized domain
    match db_mutations::oauth_client::delete_authorized_domain(&db, domain_id).await {
        Ok(_) => {
            drop(db);
            HttpResponse::Ok().json(serde_json::json!({
                "message": "Authorized domain deleted successfully"
            }))
        }
        Err(e) => {
            drop(db);
            eprintln!("Failed to delete authorized domain: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete authorized domain"
            }))
        }
    }
}
