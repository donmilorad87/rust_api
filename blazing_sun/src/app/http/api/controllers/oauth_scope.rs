//! OAuth Scope Controller
//!
//! Endpoints for querying available scopes and client-specific scopes.

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::Serialize;

use crate::app::db_query::read as db_read;
use crate::bootstrap::database::database::AppState;

// ============================================================================
// Response Structures
// ============================================================================

#[derive(Debug, Serialize)]
struct ScopeInfo {
    id: i64,
    scope_name: String,
    scope_description: String,
    sensitive: bool,
    api_product_id: Option<i64>,
}

#[derive(Debug, Serialize)]
struct ApiProductScopesResponse {
    api_product_id: i64,
    scopes: Vec<ScopeInfo>,
}

#[derive(Debug, Serialize)]
struct ClientScopesResponse {
    client_id: String,
    scopes: Vec<ScopeInfo>,
}

// ============================================================================
// Endpoint Handlers
// ============================================================================

/// GET /api/v1/oauth/api-products/{api_id}/scopes
///
/// List all scopes for a specific API product.
/// Public endpoint - no authentication required.
pub async fn list_scopes_by_api_product(
    state: web::Data<AppState>,
    path: web::Path<i64>,
) -> HttpResponse {
    let api_product_id = path.into_inner();

    let db = state.db.lock().await;

    // Verify API product exists
    let _api_product = match db_read::oauth_scope::get_api_product_by_id(&db, api_product_id).await
    {
        Ok(Some(_)) => (),
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "api_product_not_found",
                "message": "API product not found"
            }));
        }
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to retrieve API product"
            }));
        }
    };

    // Get all scopes for this API product
    let scopes = match db_read::oauth_scope::get_scopes_by_api_product(&db, api_product_id).await {
        Ok(scopes) => scopes
            .into_iter()
            .map(|s| ScopeInfo {
                id: s.id,
                scope_name: s.scope_name,
                scope_description: s.scope_description,
                sensitive: s.sensitive,
                api_product_id: s.api_product_id,
            })
            .collect(),
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to retrieve scopes"
            }));
        }
    };

    HttpResponse::Ok().json(ApiProductScopesResponse {
        api_product_id,
        scopes,
    })
}

/// GET /api/v1/oauth/clients/{client_id}/scopes
///
/// List all scopes available to a client (from enabled APIs).
/// Requires authentication - only the client owner can access.
pub async fn list_client_scopes(
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

    // Get client's allowed scopes
    let allowed_scopes = match db_read::oauth_scope::get_client_allowed_scopes(&db, client.id).await
    {
        Ok(scopes) => scopes
            .into_iter()
            .map(|s| ScopeInfo {
                id: s.scope_id,
                scope_name: s.scope_name,
                scope_description: s.scope_description,
                sensitive: s.sensitive,
                api_product_id: None, // Not included in ClientAllowedScope struct
            })
            .collect(),
        Err(_) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "database_error",
                "message": "Failed to retrieve client scopes"
            }));
        }
    };

    HttpResponse::Ok().json(ClientScopesResponse {
        client_id,
        scopes: allowed_scopes,
    })
}
