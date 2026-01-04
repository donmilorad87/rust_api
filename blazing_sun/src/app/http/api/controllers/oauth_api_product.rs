//! OAuth API Product Controller
//!
//! Google Cloud Console-style API product enablement system.
//! Users enable APIs (like "Galleries API") which automatically grants related scopes.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};

use crate::app::db_query::{read as db_read, mutations as db_mutations};
use crate::bootstrap::database::database::AppState;

// ============================================================================
// Request/Response Structures
// ============================================================================

#[derive(Debug, Serialize)]
struct ApiProductListResponse {
    api_products: Vec<ApiProductWithScopes>,
}

#[derive(Debug, Serialize)]
struct ApiProductWithScopes {
    id: i64,
    product_key: String,
    product_name: String,
    product_description: String,
    icon_url: Option<String>,
    documentation_url: Option<String>,
    is_enabled: bool,
    scopes: Vec<ScopeInfo>,
}

#[derive(Debug, Serialize)]
struct ScopeInfo {
    id: i64,
    scope_name: String,
    scope_description: String,
    sensitive: bool,
}

#[derive(Debug, Deserialize)]
pub struct EnableApiRequest {
    pub api_product_id: i64,
}

#[derive(Debug, Serialize)]
struct EnableApiResponse {
    message: String,
    api_product_id: i64,
    scopes_granted: Vec<String>,
}

#[derive(Debug, Serialize)]
struct DisableApiResponse {
    message: String,
    api_product_id: i64,
    scopes_revoked: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct GrantScopeRequest {
    pub scope_id: i64,
}

#[derive(Debug, Serialize)]
struct GrantScopeResponse {
    message: String,
    scope_id: i64,
    scope_name: String,
}

#[derive(Debug, Serialize)]
struct RevokeScopeResponse {
    message: String,
    scope_id: i64,
    scope_name: String,
}

// ============================================================================
// Endpoint Handlers
// ============================================================================

/// GET /api/v1/oauth/clients/{client_id}/api-products
///
/// List all available API products with their scopes.
/// Shows which APIs are enabled for this client.
pub async fn list_api_products(
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
                "error": "unauthorized",
                "message": "Authentication required"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get OAuth client and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "client_not_found",
                "message": "OAuth client not found"
            }));
        }
    };

    // Verify client ownership
    if client.user_id != user_id {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "forbidden",
            "message": "You do not own this OAuth client"
        }));
    }

    // Get all API products
    let api_products = match db_read::oauth_scope::get_all_api_products(&db).await {
        Ok(products) => products,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to retrieve API products"
            }));
        }
    };

    // Get client's enabled APIs
    let enabled_apis = match db_read::oauth_scope::get_client_enabled_apis(&db, client.id).await {
        Ok(apis) => apis,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to retrieve enabled APIs"
            }));
        }
    };

    let enabled_api_ids: Vec<i64> = enabled_apis.iter().map(|a| a.api_product_id).collect();

    // Build response with scopes for each API product
    let mut api_products_with_scopes = Vec::new();

    for product in api_products {
        // Get all scopes for this API product
        let scopes = match db_read::oauth_scope::get_scopes_by_api_product(&db, product.id).await {
            Ok(scopes) => scopes
                .into_iter()
                .map(|s| ScopeInfo {
                    id: s.id,
                    scope_name: s.scope_name,
                    scope_description: s.scope_description,
                    sensitive: s.sensitive,
                })
                .collect(),
            Err(_) => Vec::new(),
        };

        api_products_with_scopes.push(ApiProductWithScopes {
            id: product.id,
            product_key: product.product_key,
            product_name: product.product_name,
            product_description: product.product_description,
            icon_url: product.icon_url,
            documentation_url: product.documentation_url,
            is_enabled: enabled_api_ids.contains(&product.id),
            scopes,
        });
    }

    HttpResponse::Ok().json(ApiProductListResponse {
        api_products: api_products_with_scopes,
    })
}

/// GET /api/v1/oauth/clients/{client_id}/enabled-apis
///
/// List API products that are currently enabled for this client.
pub async fn list_enabled_apis(
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
                "error": "unauthorized",
                "message": "Authentication required"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get OAuth client and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "client_not_found",
                "message": "OAuth client not found"
            }));
        }
    };

    // Verify client ownership
    if client.user_id != user_id {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "forbidden",
            "message": "You do not own this OAuth client"
        }));
    }

    // Get client's enabled APIs with their scopes
    let enabled_apis = match db_read::oauth_scope::get_client_enabled_apis(&db, client.id).await {
        Ok(apis) => apis,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to retrieve enabled APIs"
            }));
        }
    };

    // Get client's actually granted scopes (from oauth_client_allowed_scopes)
    let granted_scopes = match db_read::oauth_scope::get_client_allowed_scopes(&db, client.id).await {
        Ok(scopes) => scopes,
        Err(_) => Vec::new(),
    };

    // Create a set of granted scope IDs for efficient lookup
    let granted_scope_ids: std::collections::HashSet<i64> = granted_scopes
        .iter()
        .map(|s| s.scope_id)
        .collect();

    // Get scopes for each enabled API, but only include actually granted scopes
    let mut result = Vec::new();
    for api in enabled_apis {
        // Get all scopes for this API product, then filter to only granted ones
        let scopes = match db_read::oauth_scope::get_scopes_by_api_product(&db, api.api_product_id).await {
            Ok(scopes) => scopes
                .into_iter()
                .filter(|s| granted_scope_ids.contains(&s.id))  // Only include granted scopes
                .map(|s| ScopeInfo {
                    id: s.id,
                    scope_name: s.scope_name,
                    scope_description: s.scope_description,
                    sensitive: s.sensitive,
                })
                .collect(),
            Err(_) => Vec::new(),
        };

        result.push(ApiProductWithScopes {
            id: api.api_product_id,
            product_key: api.product_key,
            product_name: api.product_name,
            product_description: api.product_description,
            icon_url: None,
            documentation_url: None,
            is_enabled: true,
            scopes,
        });
    }

    HttpResponse::Ok().json(serde_json::json!({
        "enabled_apis": result
    }))
}

/// POST /api/v1/oauth/clients/{client_id}/enable-api
///
/// Enable an API product for a client. This automatically grants all scopes
/// associated with the API product (Google Cloud Console approach).
pub async fn enable_api(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<EnableApiRequest>,
) -> HttpResponse {
    let client_id = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "unauthorized",
                "message": "Authentication required"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get OAuth client and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "client_not_found",
                "message": "OAuth client not found"
            }));
        }
    };

    // Verify client ownership
    if client.user_id != user_id {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "forbidden",
            "message": "You do not own this OAuth client"
        }));
    }

    // Verify API product exists
    let api_product = match db_read::oauth_scope::get_api_product_by_id(&db, body.api_product_id).await {
        Ok(Some(p)) => p,
        Ok(None) | Err(_) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "api_product_not_found",
                "message": "API product not found"
            }));
        }
    };

    // Check if API is already enabled
    let already_enabled = match db_read::oauth_scope::client_has_api_product(&db, client.id, body.api_product_id).await {
        Ok(has) => has,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to check API status"
            }));
        }
    };

    if already_enabled {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "api_already_enabled",
            "message": "This API is already enabled for this client"
        }));
    }

    // Get all scopes for this API product
    let scopes = match db_read::oauth_scope::get_scopes_by_api_product(&db, body.api_product_id).await {
        Ok(scopes) => scopes,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to retrieve API product scopes"
            }));
        }
    };

    let scope_names: Vec<String> = scopes.iter().map(|s| s.scope_name.clone()).collect();

    // Enable the API product (WITHOUT auto-granting scopes)
    // User will select individual scopes after enabling the API
    if let Err(_) = db_mutations::oauth_scope::enable_client_api_product(&db, client.id, body.api_product_id).await {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "database_error",
            "message": "Failed to enable API product"
        }));
    }

    // NOTE: Scopes are NOT automatically granted
    // User must manually select which scopes to grant after enabling the API

    HttpResponse::Ok().json(EnableApiResponse {
        message: format!("{} has been enabled successfully", api_product.product_name),
        api_product_id: body.api_product_id,
        scopes_granted: scope_names,
    })
}

/// DELETE /api/v1/oauth/clients/{client_id}/enabled-apis/{api_id}
///
/// Disable an API product for a client. This removes all scopes
/// associated with the API product.
pub async fn disable_api(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, i64)>,
) -> HttpResponse {
    let (client_id, api_product_id) = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "unauthorized",
                "message": "Authentication required"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get OAuth client and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "client_not_found",
                "message": "OAuth client not found"
            }));
        }
    };

    // Verify client ownership
    if client.user_id != user_id {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "forbidden",
            "message": "You do not own this OAuth client"
        }));
    }

    // Verify API product exists and is enabled
    let is_enabled = match db_read::oauth_scope::client_has_api_product(&db, client.id, api_product_id).await {
        Ok(has) => has,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to check API status"
            }));
        }
    };

    if !is_enabled {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "api_not_enabled",
            "message": "This API is not enabled for this client"
        }));
    }

    // Get all scopes for this API product (to report what will be revoked)
    let scopes = match db_read::oauth_scope::get_scopes_by_api_product(&db, api_product_id).await {
        Ok(scopes) => scopes,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to retrieve API product scopes"
            }));
        }
    };

    let scope_ids: Vec<i64> = scopes.iter().map(|s| s.id).collect();
    let scope_names: Vec<String> = scopes.iter().map(|s| s.scope_name.clone()).collect();

    // Disable the API product
    if let Err(_) = db_mutations::oauth_scope::disable_client_api_product(&db, client.id, api_product_id).await {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "database_error",
            "message": "Failed to disable API product"
        }));
    }

    // Revoke all scopes for this API
    for scope_id in scope_ids {
        let _ = db_mutations::oauth_scope::remove_client_scope(&db, client.id, scope_id).await;
        // Continue revoking other scopes even if one fails
    }

    HttpResponse::Ok().json(DisableApiResponse {
        message: "API has been disabled successfully".to_string(),
        api_product_id,
        scopes_revoked: scope_names,
    })
}

/// POST /api/v1/oauth/clients/{client_id}/scopes
///
/// Grant a specific scope to the OAuth client.
/// The scope's API product must already be enabled for this client.
pub async fn grant_scope(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
    body: web::Json<GrantScopeRequest>,
) -> HttpResponse {
    let client_id = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "unauthorized",
                "message": "Authentication required"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get OAuth client and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "client_not_found",
                "message": "OAuth client not found"
            }));
        }
    };

    // Verify client ownership
    if client.user_id != user_id {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "forbidden",
            "message": "You do not own this OAuth client"
        }));
    }

    // Get scope details and verify it exists
    let scope = match db_read::oauth_scope::get_scope_by_id(&db, body.scope_id).await {
        Ok(Some(s)) => s,
        Ok(None) | Err(_) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "scope_not_found",
                "message": "Scope not found"
            }));
        }
    };

    // Get the API product ID for this scope
    let api_product_id = match scope.api_product_id {
        Some(id) => id,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "invalid_scope",
                "message": "Scope is not associated with an API product"
            }));
        }
    };

    // Verify the scope's API product is enabled for this client
    let api_enabled = match db_read::oauth_scope::client_has_api_product(&db, client.id, api_product_id).await {
        Ok(has) => has,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to check API status"
            }));
        }
    };

    if !api_enabled {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "api_not_enabled",
            "message": "The API product for this scope is not enabled. Enable the API first."
        }));
    }

    // Check if scope is already granted
    let already_granted = match db_read::oauth_scope::client_has_scope(&db, client.id, body.scope_id).await {
        Ok(has) => has,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to check scope status"
            }));
        }
    };

    if already_granted {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "scope_already_granted",
            "message": "This scope is already granted to this client"
        }));
    }

    // Grant the scope
    if let Err(_) = db_mutations::oauth_scope::add_client_scope(&db, client.id, body.scope_id).await {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "database_error",
            "message": "Failed to grant scope"
        }));
    }

    HttpResponse::Ok().json(GrantScopeResponse {
        message: format!("Scope '{}' granted successfully", scope.scope_name),
        scope_id: body.scope_id,
        scope_name: scope.scope_name,
    })
}

/// DELETE /api/v1/oauth/clients/{client_id}/scopes/{scope_id}
///
/// Revoke a specific scope from the OAuth client.
pub async fn revoke_scope(
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<(String, i64)>,
) -> HttpResponse {
    let (client_id, scope_id) = path.into_inner();

    // Get authenticated user ID from JWT (set by auth middleware)
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "unauthorized",
                "message": "Authentication required"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get OAuth client and verify ownership
    let client = match db_read::oauth_client::get_by_client_id(&db, &client_id).await {
        Ok(c) => c,
        Err(_) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "client_not_found",
                "message": "OAuth client not found"
            }));
        }
    };

    // Verify client ownership
    if client.user_id != user_id {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "error": "forbidden",
            "message": "You do not own this OAuth client"
        }));
    }

    // Get scope details
    let scope = match db_read::oauth_scope::get_scope_by_id(&db, scope_id).await {
        Ok(Some(s)) => s,
        Ok(None) | Err(_) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "scope_not_found",
                "message": "Scope not found"
            }));
        }
    };

    // Check if scope is granted
    let is_granted = match db_read::oauth_scope::client_has_scope(&db, client.id, scope_id).await {
        Ok(has) => has,
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to check scope status"
            }));
        }
    };

    if !is_granted {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "scope_not_granted",
            "message": "This scope is not granted to this client"
        }));
    }

    // Revoke the scope
    if let Err(_) = db_mutations::oauth_scope::remove_client_scope(&db, client.id, scope_id).await {
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "database_error",
            "message": "Failed to revoke scope"
        }));
    }

    HttpResponse::Ok().json(RevokeScopeResponse {
        message: format!("Scope '{}' revoked successfully", scope.scope_name),
        scope_id,
        scope_name: scope.scope_name,
    })
}
