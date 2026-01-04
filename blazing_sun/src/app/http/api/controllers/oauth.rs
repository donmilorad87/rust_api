//! OAuth 2.0 Authorization Controller
//!
//! Handles OAuth 2.0 authorization flow endpoints:
//! - /oauth/authorize (Authorization Code Flow with PKCE)
//! - /oauth/token (Token exchange and refresh)
//! - /oauth/revoke (Token revocation)

use actix_session::Session;
use actix_web::{web, HttpRequest, HttpResponse, HttpMessage};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};

use crate::app::db_query::{mutations, read};
use crate::app::http::web::controllers::{render_oauth_consent, ConsentScopeInfo, OAuthConsentData};
use crate::database::AppState;

// ============================================================================
// Request/Response Structs
// ============================================================================

/// OAuth Authorize Request (Authorization Code Flow)
#[derive(Debug, Deserialize)]
pub struct AuthorizeRequest {
    pub client_id: String,
    pub redirect_uri: String,
    pub response_type: String, // Must be "code"
    pub scope: Option<String>,
    pub state: Option<String>,
    pub code_challenge: Option<String>,        // PKCE
    pub code_challenge_method: Option<String>, // "S256" or "plain"
}

/// OAuth Token Request
#[derive(Debug, Deserialize)]
pub struct TokenRequest {
    pub grant_type: String, // "authorization_code" or "refresh_token"
    pub code: Option<String>,
    pub redirect_uri: Option<String>,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub code_verifier: Option<String>, // PKCE
    pub refresh_token: Option<String>,
}

/// OAuth Token Response
#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String, // "Bearer"
    pub expires_in: i64,
    pub refresh_token: Option<String>,
    pub scope: String,
}

/// OAuth Error Response (RFC 6749)
#[derive(Debug, Serialize)]
pub struct OAuthError {
    pub error: String,
    pub error_description: Option<String>,
    pub error_uri: Option<String>,
}

/// Consent Decision (from user submitting consent form)
#[derive(Debug, Deserialize)]
pub struct ConsentDecision {
    pub client_id: String,
    pub redirect_uri: String,
    pub scope: String,
    pub state: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
    pub approved: bool, // true = approve, false = deny
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Generate a secure random authorization code
fn generate_authorization_code() -> String {
    use rand::Rng;
    let random_bytes: Vec<u8> = (0..32).map(|_| rand::thread_rng().gen()).collect();
    URL_SAFE_NO_PAD.encode(&random_bytes)
}

/// Generate a secure random refresh token
fn generate_refresh_token() -> String {
    use rand::Rng;
    let random_bytes: Vec<u8> = (0..32).map(|_| rand::thread_rng().gen()).collect();
    URL_SAFE_NO_PAD.encode(&random_bytes)
}

/// Generate a unique token family ID
fn generate_token_family() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Hash a string using SHA-256
fn hash_sha256(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Verify client secret against stored hash
///
/// Returns true if the provided secret matches any active secret for the client.
async fn verify_client_secret(
    db: &sqlx::Pool<sqlx::Postgres>,
    client_db_id: i64,
    provided_secret: &str,
) -> Result<bool, sqlx::Error> {
    // Get all active secrets for this client
    let secrets = read::oauth_client::get_secrets_by_client(db, client_db_id).await?;

    // Check if any secret matches
    for secret in secrets {
        if bcrypt::verify(provided_secret, &secret.secret_hash).unwrap_or(false) {
            return Ok(true);
        }
    }

    Ok(false)
}

/// Verify PKCE code challenge
fn verify_pkce_challenge(
    code_verifier: &str,
    code_challenge: &str,
    code_challenge_method: &str,
) -> bool {
    match code_challenge_method {
        "S256" => {
            let computed_challenge = URL_SAFE_NO_PAD.encode(
                Sha256::digest(code_verifier.as_bytes()).as_slice()
            );
            computed_challenge == code_challenge
        }
        "plain" => code_verifier == code_challenge,
        _ => false,
    }
}

/// Build OAuth error response
fn oauth_error(
    error: &str,
    description: Option<&str>,
    redirect_uri: Option<&str>,
    state: Option<&str>,
) -> HttpResponse {
    // If redirect_uri is provided, return JSON with redirect_uri for frontend navigation
    // (fetch() can't follow cross-origin redirects properly)
    if let Some(uri) = redirect_uri {
        let mut params = vec![format!("error={}", error)];

        if let Some(desc) = description {
            params.push(format!("error_description={}", urlencoding::encode(desc)));
        }

        if let Some(s) = state {
            params.push(format!("state={}", urlencoding::encode(s)));
        }

        let separator = if uri.contains('?') { "&" } else { "?" };
        let redirect_url = format!("{}{}{}", uri, separator, params.join("&"));

        return HttpResponse::Ok().json(serde_json::json!({
            "redirect_uri": redirect_url,
            "error": error,
            "error_description": description
        }));
    }

    // Otherwise, return JSON error
    let error_response = OAuthError {
        error: error.to_string(),
        error_description: description.map(|s| s.to_string()),
        error_uri: None,
    };

    HttpResponse::BadRequest().json(error_response)
}

// ============================================================================
// /oauth/authorize - Authorization Endpoint
// ============================================================================

/// GET /oauth/authorize - Show consent screen
/// This endpoint validates the OAuth request and either:
/// 1. Automatically approves if user has already consented
/// 2. Shows the consent screen for user approval
/// 3. Shows consent screen with login modal if user is not authenticated
pub async fn authorize_get(
    req: HttpRequest,
    session: Session,
    query: web::Query<AuthorizeRequest>,
    state: web::Data<AppState>,
) -> HttpResponse {
    // Extract user ID if authenticated (optional - we'll show login modal if not)
    let user_id = req.extensions().get::<i64>().copied();

    // Validate request
    if query.response_type != "code" {
        return oauth_error(
            "unsupported_response_type",
            Some("Only 'code' response type is supported"),
            Some(&query.redirect_uri),
            query.state.as_deref(),
        );
    }

    // Lock database
    let db = state.db.lock().await;

    // Get client by client_id
    let client = match read::oauth_client::get_by_client_id(&db, &query.client_id).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Database error fetching OAuth client: {}", e);
            return oauth_error(
                "server_error",
                Some("Internal server error"),
                None,
                query.state.as_deref(),
            );
        }
    };

    // Check if client is active
    if !client.is_active {
        return oauth_error(
            "unauthorized_client",
            Some("Client is not active"),
            Some(&query.redirect_uri),
            query.state.as_deref(),
        );
    }

    // Validate redirect_uri
    let redirect_uris = match read::oauth_client::get_redirect_uris_by_client(&db, client.id).await {
        Ok(uris) => uris,
        Err(e) => {
            tracing::error!("Database error fetching redirect URIs: {}", e);
            return oauth_error(
                "server_error",
                Some("Internal server error"),
                None,
                query.state.as_deref(),
            );
        }
    };

    if !redirect_uris.iter().any(|uri| uri.redirect_uri == query.redirect_uri) {
        return oauth_error(
            "invalid_request",
            Some("Invalid redirect_uri"),
            None,
            query.state.as_deref(),
        );
    }

    // Parse and validate scopes
    let requested_scopes = query.scope.as_deref().unwrap_or("").to_string();
    let scope_list: Vec<String> = requested_scopes
        .split_whitespace()
        .map(|s| s.to_string())
        .collect();

    if scope_list.is_empty() {
        return oauth_error(
            "invalid_scope",
            Some("At least one scope must be requested"),
            Some(&query.redirect_uri),
            query.state.as_deref(),
        );
    }

    // Validate that client is allowed to request these scopes
    for scope_name in &scope_list {
        let has_scope = match read::oauth_scope::client_has_scope_by_name(
            &db,
            client.id,
            scope_name,
        )
        .await
        {
            Ok(has) => has,
            Err(e) => {
                tracing::error!("Database error checking client scopes: {}", e);
                return oauth_error(
                    "server_error",
                    Some("Internal server error"),
                    Some(&query.redirect_uri),
                    query.state.as_deref(),
                );
            }
        };

        if !has_scope {
            return oauth_error(
                "invalid_scope",
                Some(&format!("Client is not allowed to request scope: {}", scope_name)),
                Some(&query.redirect_uri),
                query.state.as_deref(),
            );
        }
    }

    // If user is authenticated, check for existing consent
    if let Some(uid) = user_id {
        // Check if user has already consented to these scopes
        let has_consent = match read::oauth_authorization::has_consent_for_scopes(
            &db,
            uid,
            client.id,
            &scope_list,
        )
        .await
        {
            Ok(has) => has,
            Err(e) => {
                tracing::error!("Database error checking consent: {}", e);
                return oauth_error(
                    "server_error",
                    Some("Internal server error"),
                    Some(&query.redirect_uri),
                    query.state.as_deref(),
                );
            }
        };

        // If already consented, automatically approve
        if has_consent {
            // Drop db lock before calling approve_authorization (it acquires its own lock)
            let client_db_id = client.id;
            drop(db);

            return approve_authorization(
                &state,
                client_db_id,
                uid,
                &query.redirect_uri,
                &requested_scopes,
                query.state.as_deref(),
                query.code_challenge.as_deref(),
                query.code_challenge_method.as_deref(),
                false, // HTTP redirect for browser navigation
            )
            .await;
        }
    }

    // Show consent screen (with login modal if not authenticated)
    // Fetch scope details for display
    let scope_details = match read::oauth_scope::get_scopes_by_names(&db, &scope_list).await {
        Ok(scopes) => scopes,
        Err(e) => {
            tracing::error!("Database error fetching scope details: {}", e);
            return oauth_error(
                "server_error",
                Some("Internal server error"),
                Some(&query.redirect_uri),
                query.state.as_deref(),
            );
        }
    };

    // Build consent data
    let consent_scopes: Vec<ConsentScopeInfo> = scope_details
        .into_iter()
        .map(|s| ConsentScopeInfo {
            scope_name: s.scope_name,
            scope_description: s.scope_description,
            sensitive: s.sensitive,
        })
        .collect();

    let consent_data = OAuthConsentData {
        client_name: client.client_name,
        client_id: client.client_id,
        client_type: client.client_type,
        logo_url: client.logo_url,
        homepage_url: client.homepage_url,
        privacy_policy_url: client.privacy_policy_url,
        terms_of_service_url: client.terms_of_service_url,
        scopes: consent_scopes,
        redirect_uri: query.redirect_uri.clone(),
        scope_string: requested_scopes,
        state: query.state.clone(),
        code_challenge: query.code_challenge.clone(),
        code_challenge_method: query.code_challenge_method.clone(),
    };

    // Drop db lock before rendering (render_oauth_consent will re-acquire)
    drop(db);

    render_oauth_consent(&req, &session, &state, consent_data).await
}

/// POST /oauth/authorize - Handle consent decision
pub async fn authorize_post(
    req: HttpRequest,
    decision: web::Json<ConsentDecision>,
    state: web::Data<AppState>,
) -> HttpResponse {
    // Extract user from JWT middleware
    let user_id = match req.extensions().get::<i64>() {
        Some(id) => *id,
        None => {
            return oauth_error(
                "access_denied",
                Some("User must be authenticated"),
                None,
                decision.state.as_deref(),
            );
        }
    };

    // If user denied consent
    if !decision.approved {
        return oauth_error(
            "access_denied",
            Some("User denied authorization"),
            Some(&decision.redirect_uri),
            decision.state.as_deref(),
        );
    }

    // Lock database
    let db = state.db.lock().await;

    // Get client
    let client = match read::oauth_client::get_by_client_id(&db, &decision.client_id).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Database error fetching OAuth client: {}", e);
            return oauth_error(
                "server_error",
                Some("Internal server error"),
                None,
                decision.state.as_deref(),
            );
        }
    };

    // Save consent grant
    let consent_params = mutations::oauth_authorization::CreateConsentGrantParams {
        user_id,
        client_id: client.id,
        granted_scopes: decision.scope.split_whitespace().map(|s| s.to_string()).collect(),
    };

    if let Err(e) = mutations::oauth_authorization::upsert_consent_grant(&db, &consent_params).await {
        tracing::error!("Database error saving consent grant: {}", e);
        return oauth_error(
            "server_error",
            Some("Internal server error"),
            Some(&decision.redirect_uri),
            decision.state.as_deref(),
        );
    }

    // Approve and generate authorization code
    approve_authorization(
        &state,
        client.id,
        user_id,
        &decision.redirect_uri,
        &decision.scope,
        decision.state.as_deref(),
        decision.code_challenge.as_deref(),
        decision.code_challenge_method.as_deref(),
        true, // JSON response for AJAX consent form
    )
    .await
}

/// Helper: Approve authorization and generate code
/// `return_json` - if true, return JSON with redirect_uri (for AJAX); if false, do HTTP redirect (for browser)
async fn approve_authorization(
    state: &AppState,
    client_db_id: i64,
    user_id: i64,
    redirect_uri: &str,
    scope: &str,
    state_param: Option<&str>,
    code_challenge: Option<&str>,
    code_challenge_method: Option<&str>,
    return_json: bool,
) -> HttpResponse {
    // Lock database
    let db = state.db.lock().await;

    // Generate authorization code
    let code = generate_authorization_code();

    // Calculate expiration (10 minutes from now)
    let expires_at = chrono::Utc::now() + chrono::Duration::minutes(10);

    // Save authorization code to database
    let auth_code_params = mutations::oauth_authorization::CreateAuthorizationCodeParams {
        code: code.clone(),
        client_id: client_db_id,
        user_id,
        redirect_uri: redirect_uri.to_string(),
        scopes: scope.split_whitespace().map(|s| s.to_string()).collect(),
        code_challenge: code_challenge.map(|s| s.to_string()),
        code_challenge_method: code_challenge_method.map(|s| s.to_string()),
        expires_at,
    };

    if let Err(e) = mutations::oauth_authorization::create_authorization_code(&db, &auth_code_params).await {
        tracing::error!("Database error creating authorization code: {}", e);
        return oauth_error(
            "server_error",
            Some("Internal server error"),
            Some(redirect_uri),
            state_param,
        );
    }

    // Build redirect URL with authorization code
    let mut params = vec![format!("code={}", urlencoding::encode(&code))];

    if let Some(s) = state_param {
        params.push(format!("state={}", urlencoding::encode(s)));
    }

    let separator = if redirect_uri.contains('?') { "&" } else { "?" };
    let redirect_url = format!("{}{}{}", redirect_uri, separator, params.join("&"));

    if return_json {
        // Return JSON with redirect_uri for frontend to handle navigation
        // (fetch() can't follow cross-origin redirects properly)
        HttpResponse::Ok().json(serde_json::json!({
            "redirect_uri": redirect_url
        }))
    } else {
        // Do actual HTTP redirect (for browser navigation)
        HttpResponse::Found()
            .append_header(("Location", redirect_url))
            .finish()
    }
}

// ============================================================================
// /oauth/token - Token Endpoint
// ============================================================================

/// POST /oauth/token - Exchange authorization code for tokens
pub async fn token_post(
    token_req: web::Form<TokenRequest>,
    state: web::Data<AppState>,
) -> HttpResponse {
    match token_req.grant_type.as_str() {
        "authorization_code" => handle_authorization_code_grant(token_req.into_inner(), &state).await,
        "refresh_token" => handle_refresh_token_grant(token_req.into_inner(), &state).await,
        _ => oauth_error(
            "unsupported_grant_type",
            Some("Only 'authorization_code' and 'refresh_token' grant types are supported"),
            None,
            None,
        ),
    }
}

/// Handle authorization_code grant
async fn handle_authorization_code_grant(
    token_req: TokenRequest,
    state: &AppState,
) -> HttpResponse {
    // Validate required parameters
    let code = match &token_req.code {
        Some(c) => c,
        None => return oauth_error("invalid_request", Some("Missing 'code' parameter"), None, None),
    };

    let redirect_uri = match &token_req.redirect_uri {
        Some(uri) => uri,
        None => return oauth_error("invalid_request", Some("Missing 'redirect_uri' parameter"), None, None),
    };

    // Lock database
    let db = state.db.lock().await;

    // Get authorization code from database
    let auth_code = match read::oauth_authorization::get_authorization_code_by_code(&db, code).await {
        Ok(Some(ac)) => ac,
        Ok(None) => return oauth_error("invalid_grant", Some("Invalid authorization code"), None, None),
        Err(e) => {
            tracing::error!("Database error fetching authorization code: {}", e);
            return oauth_error("server_error", Some("Internal server error"), None, None);
        }
    };

    // Check if code is already used
    if auth_code.is_used {
        return oauth_error("invalid_grant", Some("Authorization code already used"), None, None);
    }

    // Check if code is expired
    if auth_code.expires_at < chrono::Utc::now() {
        return oauth_error("invalid_grant", Some("Authorization code expired"), None, None);
    }

    // Verify redirect_uri matches
    if &auth_code.redirect_uri != redirect_uri {
        return oauth_error("invalid_grant", Some("redirect_uri mismatch"), None, None);
    }

    // Get client
    let client = match read::oauth_client::get_by_client_id(&db, &token_req.client_id).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Database error fetching OAuth client: {}", e);
            return oauth_error("server_error", Some("Internal server error"), None, None);
        }
    };

    // Verify client_id matches
    if client.id != auth_code.client_id {
        return oauth_error("invalid_grant", Some("client_id mismatch"), None, None);
    }

    // Verify client secret for confidential clients
    // If a client has secrets in the database, it's a confidential client and MUST authenticate
    let client_secrets = match read::oauth_client::get_secrets_by_client(&db, client.id).await {
        Ok(secrets) => secrets,
        Err(e) => {
            tracing::error!("Database error fetching client secrets: {}", e);
            return oauth_error("server_error", Some("Internal server error"), None, None);
        }
    };

    if !client_secrets.is_empty() {
        // This is a confidential client - verify secret
        let provided_secret = match &token_req.client_secret {
            Some(s) => s,
            None => return oauth_error("invalid_client", Some("Missing client_secret for confidential client"), None, None),
        };

        match verify_client_secret(&db, client.id, provided_secret).await {
            Ok(true) => {
                // Secret is valid - continue
            }
            Ok(false) => {
                return oauth_error("invalid_client", Some("Invalid client_secret"), None, None);
            }
            Err(e) => {
                tracing::error!("Error verifying client secret: {}", e);
                return oauth_error("server_error", Some("Internal server error"), None, None);
            }
        }
    }

    // Verify PKCE if code_challenge was used
    if let Some(challenge) = &auth_code.code_challenge {
        let verifier = match &token_req.code_verifier {
            Some(v) => v,
            None => return oauth_error("invalid_request", Some("Missing code_verifier"), None, None),
        };

        let challenge_method = auth_code.code_challenge_method.as_deref().unwrap_or("plain");

        if !verify_pkce_challenge(verifier, challenge, challenge_method) {
            return oauth_error("invalid_grant", Some("Invalid code_verifier"), None, None);
        }
    }

    // Mark code as used
    if let Err(e) = mutations::oauth_authorization::mark_authorization_code_used(&db, code).await {
        tracing::error!("Database error marking code as used: {}", e);
        return oauth_error("server_error", Some("Internal server error"), None, None);
    }

    // Generate tokens
    // Generate RS256 JWT access token
    use crate::bootstrap::utility::oauth_jwt;

    let jwt_result = oauth_jwt::generate_access_token(
        &state.oauth_private_key_path,
        &state.oauth_jwt_kid,
        &state.oauth_issuer,
        auth_code.user_id,
        &token_req.client_id,
        &auth_code.scopes.join(" "),
        state.oauth_access_token_ttl_seconds,
    );

    let access_token = match jwt_result {
        Ok(jwt) => jwt.access_token,
        Err(e) => {
            tracing::error!("JWT generation error: {}", e);
            return oauth_error("server_error", Some("Failed to generate access token"), None, None);
        }
    };

    let refresh_token_value = generate_refresh_token();
    let token_family = generate_token_family();
    let refresh_token_hash = hash_sha256(&refresh_token_value);
    let token_hint = &refresh_token_value[..8]; // First 8 chars as hint

    // Save refresh token to database
    let refresh_expires_at = chrono::Utc::now() + chrono::Duration::days(30);
    let refresh_params = mutations::oauth_authorization::CreateRefreshTokenParams {
        token_hash: refresh_token_hash,
        token_hint: token_hint.to_string(),
        client_id: client.id,
        user_id: auth_code.user_id,
        scopes: auth_code.scopes.clone(),
        token_family_id: token_family,
        parent_token_id: None,
        expires_at: refresh_expires_at,
    };

    if let Err(e) = mutations::oauth_authorization::create_refresh_token(&db, &refresh_params).await {
        tracing::error!("Database error creating refresh token: {}", e);
        return oauth_error("server_error", Some("Internal server error"), None, None);
    }

    // Return token response
    let token_response = TokenResponse {
        access_token,
        token_type: "Bearer".to_string(),
        expires_in: state.oauth_access_token_ttl_seconds,
        refresh_token: Some(refresh_token_value),
        scope: auth_code.scopes.join(" "),
    };

    HttpResponse::Ok().json(token_response)
}

/// Handle refresh_token grant with rotation and reuse detection
async fn handle_refresh_token_grant(
    token_req: TokenRequest,
    state: &AppState,
) -> HttpResponse {
    use crate::bootstrap::utility::oauth_jwt;

    // Validate required parameters
    let refresh_token_value = match &token_req.refresh_token {
        Some(rt) => rt,
        None => return oauth_error("invalid_request", Some("Missing 'refresh_token' parameter"), None, None),
    };

    // Hash the refresh token to look it up in database
    let refresh_token_hash = hash_sha256(refresh_token_value);

    // Lock database
    let db = state.db.lock().await;

    // Get refresh token from database
    let refresh_token = match read::oauth_authorization::get_refresh_token_by_hash(&db, &refresh_token_hash).await {
        Ok(Some(rt)) => rt,
        Ok(None) => return oauth_error("invalid_grant", Some("Invalid refresh token"), None, None),
        Err(e) => {
            tracing::error!("Database error fetching refresh token: {}", e);
            return oauth_error("server_error", Some("Internal server error"), None, None);
        }
    };

    // Check if token is revoked
    if refresh_token.is_revoked {
        return oauth_error("invalid_grant", Some("Refresh token has been revoked"), None, None);
    }

    // Check if token is expired
    if refresh_token.expires_at < chrono::Utc::now() {
        return oauth_error("invalid_grant", Some("Refresh token expired"), None, None);
    }

    // Get client
    let client = match read::oauth_client::get_by_client_id(&db, &token_req.client_id).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Database error fetching OAuth client: {}", e);
            return oauth_error("server_error", Some("Internal server error"), None, None);
        }
    };

    // Verify client_id matches
    if client.id != refresh_token.client_id {
        return oauth_error("invalid_grant", Some("client_id mismatch"), None, None);
    }

    // Verify client secret for confidential clients
    // If a client has secrets in the database, it's a confidential client and MUST authenticate
    let client_secrets = match read::oauth_client::get_secrets_by_client(&db, client.id).await {
        Ok(secrets) => secrets,
        Err(e) => {
            tracing::error!("Database error fetching client secrets: {}", e);
            return oauth_error("server_error", Some("Internal server error"), None, None);
        }
    };

    if !client_secrets.is_empty() {
        // This is a confidential client - verify secret
        let provided_secret = match &token_req.client_secret {
            Some(s) => s,
            None => return oauth_error("invalid_client", Some("Missing client_secret for confidential client"), None, None),
        };

        match verify_client_secret(&db, client.id, provided_secret).await {
            Ok(true) => {
                // Secret is valid - continue
            }
            Ok(false) => {
                return oauth_error("invalid_client", Some("Invalid client_secret"), None, None);
            }
            Err(e) => {
                tracing::error!("Error verifying client secret: {}", e);
                return oauth_error("server_error", Some("Internal server error"), None, None);
            }
        }
    }

    // === REUSE DETECTION ===
    // Check if this refresh token has already been used (has children)
    let is_reused = match read::oauth_authorization::is_token_reused(&db, refresh_token.id).await {
        Ok(reused) => reused,
        Err(e) => {
            tracing::error!("Database error checking token reuse: {}", e);
            return oauth_error("server_error", Some("Internal server error"), None, None);
        }
    };

    if is_reused {
        // SECURITY: Refresh token reuse detected - revoke entire token family
        tracing::warn!(
            "Refresh token reuse detected! Revoking token family: {}",
            refresh_token.token_family_id
        );

        if let Err(e) = mutations::oauth_authorization::revoke_token_family(&db, &refresh_token.token_family_id).await {
            tracing::error!("Database error revoking token family: {}", e);
        }

        return oauth_error(
            "invalid_grant",
            Some("Refresh token reuse detected - token family revoked"),
            None,
            None,
        );
    }

    // === TOKEN ROTATION ===
    // Generate new access token (RS256 JWT)
    let jwt_result = oauth_jwt::generate_access_token(
        &state.oauth_private_key_path,
        &state.oauth_jwt_kid,
        &state.oauth_issuer,
        refresh_token.user_id,
        &token_req.client_id,
        &refresh_token.scopes.join(" "),
        state.oauth_access_token_ttl_seconds,
    );

    let access_token = match jwt_result {
        Ok(jwt) => jwt.access_token,
        Err(e) => {
            tracing::error!("JWT generation error: {}", e);
            return oauth_error("server_error", Some("Failed to generate access token"), None, None);
        }
    };

    // Generate new refresh token (rotation)
    let new_refresh_token_value = generate_refresh_token();
    let new_refresh_token_hash = hash_sha256(&new_refresh_token_value);
    let new_token_hint = &new_refresh_token_value[..8]; // First 8 chars as hint

    // Calculate new refresh token expiration
    let refresh_expires_at = chrono::Utc::now()
        + chrono::Duration::days(state.oauth_refresh_token_ttl_days);

    // Save new refresh token to database with parent reference
    let refresh_params = mutations::oauth_authorization::CreateRefreshTokenParams {
        token_hash: new_refresh_token_hash,
        token_hint: new_token_hint.to_string(),
        client_id: client.id,
        user_id: refresh_token.user_id,
        scopes: refresh_token.scopes.clone(),
        token_family_id: refresh_token.token_family_id.clone(), // Same family
        parent_token_id: Some(refresh_token.id), // Link to parent by ID
        expires_at: refresh_expires_at,
    };

    if let Err(e) = mutations::oauth_authorization::create_refresh_token(&db, &refresh_params).await {
        tracing::error!("Database error creating new refresh token: {}", e);
        return oauth_error("server_error", Some("Internal server error"), None, None);
    }

    // Revoke old refresh token (it's now been used)
    if let Err(e) = mutations::oauth_authorization::revoke_refresh_token(&db, &refresh_token_hash).await {
        tracing::error!("Database error revoking old refresh token: {}", e);
        // Continue anyway - new token was created
    }

    // Return token response
    let token_response = TokenResponse {
        access_token,
        token_type: "Bearer".to_string(),
        expires_in: state.oauth_access_token_ttl_seconds,
        refresh_token: Some(new_refresh_token_value),
        scope: refresh_token.scopes.join(" "),
    };

    HttpResponse::Ok().json(token_response)
}

// ============================================================================
// /oauth/revoke - Token Revocation
// ============================================================================

/// Token Revocation Request (RFC 7009)
#[derive(Debug, Deserialize)]
pub struct RevokeRequest {
    /// The token to revoke (access_token or refresh_token)
    pub token: String,

    /// Optional hint about token type ("access_token" or "refresh_token")
    pub token_type_hint: Option<String>,

    /// Client ID (required for client authentication)
    pub client_id: Option<String>,

    /// Client secret (required for confidential clients)
    pub client_secret: Option<String>,
}

/// POST /oauth/revoke - Revoke a token (RFC 7009)
///
/// This endpoint revokes access tokens or refresh tokens.
/// Per RFC 7009, it MUST return 200 OK regardless of token validity.
pub async fn revoke_post(
    state: web::Data<AppState>,
    form: web::Form<RevokeRequest>,
) -> HttpResponse {
    let db = state.db.lock().await;

    // Per RFC 7009: Always return 200 OK, even if token is invalid
    // This prevents token scanning attacks

    // Determine token type based on hint or by trying both
    let token_type = form.token_type_hint.as_deref().unwrap_or("refresh_token");

    match token_type {
        "refresh_token" => {
            // Hash the token to look it up in database
            let token_hash = hash_sha256(&form.token);

            // Try to revoke the refresh token
            // Ignore errors - per RFC 7009, we always return 200 OK
            let _ = mutations::oauth_authorization::revoke_refresh_token(&db, &token_hash).await;

            // If this is part of a token family and we can find it, revoke the family
            if let Ok(Some(token)) = read::oauth_authorization::get_refresh_token_by_hash(&db, &token_hash).await {
                let _ = mutations::oauth_authorization::revoke_token_family(&db, &token.token_family_id).await;
            }
        }
        "access_token" => {
            // TODO: Implement access token blacklist using Redis
            // For now, we just return success since JWTs are stateless
            // In production, you would:
            // 1. Decode the JWT to get its jti (JWT ID)
            // 2. Add jti to Redis blacklist with TTL = token expiry
            // 3. Check blacklist in auth middleware
            tracing::warn!("Access token revocation requested, but blacklist not yet implemented");
        }
        _ => {
            // Unknown token type hint - try refresh token anyway
            let token_hash = hash_sha256(&form.token);
            let _ = mutations::oauth_authorization::revoke_refresh_token(&db, &token_hash).await;
        }
    }

    // Per RFC 7009: Always return 200 OK
    HttpResponse::Ok().json(serde_json::json!({
        "status": "success"
    }))
}

// ============================================================================
// /.well-known/jwks.json - JSON Web Key Set
// ============================================================================

/// JWKS Response
#[derive(Debug, Serialize)]
pub struct JwksResponse {
    pub keys: Vec<JwkKey>,
}

/// JSON Web Key
#[derive(Debug, Serialize)]
pub struct JwkKey {
    /// Key Type (RSA)
    pub kty: String,
    /// Key ID
    pub kid: String,
    /// Algorithm (RS256)
    pub alg: String,
    /// Public Key Use (signature)
    #[serde(rename = "use")]
    pub key_use: String,
    /// Modulus (base64url-encoded)
    pub n: String,
    /// Exponent (base64url-encoded)
    pub e: String,
}

/// GET /.well-known/jwks.json - Serve public keys for JWT verification
pub async fn jwks_json(state: web::Data<AppState>) -> HttpResponse {
    use crate::bootstrap::utility::oauth_jwt;

    // Extract JWKS components from public key
    let jwks_result = oauth_jwt::extract_jwks_components(&state.oauth_public_key_path);

    let (n, e) = match jwks_result {
        Ok((modulus, exponent)) => (modulus, exponent),
        Err(e) => {
            tracing::error!("Failed to extract JWKS components: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to load public key"
            }));
        }
    };

    // Build JWKS response
    let jwks = JwksResponse {
        keys: vec![JwkKey {
            kty: "RSA".to_string(),
            kid: state.oauth_jwt_kid.to_string(),
            alg: "RS256".to_string(),
            key_use: "sig".to_string(),
            n,
            e,
        }],
    };

    HttpResponse::Ok()
        .content_type("application/json")
        .json(jwks)
}

// ============================================================================
// Authorized Apps - User-facing endpoints
// ============================================================================

/// Response for authorized apps list
#[derive(Debug, Serialize)]
pub struct AuthorizedAppsResponse {
    pub status: String,
    pub apps: Vec<AuthorizedAppInfo>,
}

/// Authorized app info for frontend
#[derive(Debug, Serialize)]
pub struct AuthorizedAppInfo {
    pub consent_id: i64,
    pub client_db_id: i64,
    pub client_id: String,
    pub client_name: String,
    pub client_description: Option<String>,
    pub logo_url: Option<String>,
    pub homepage_url: Option<String>,
    pub privacy_policy_url: Option<String>,
    pub granted_scopes: Vec<String>,
    pub authorized_at: String,
    pub last_used_at: String,
}

/// GET /oauth/authorized-apps - Get apps the user has authorized
///
/// Returns a list of OAuth clients the user has granted consent to.
/// Requires authentication (user must be logged in).
pub async fn get_authorized_apps(
    req: HttpRequest,
    state: web::Data<AppState>,
) -> HttpResponse {
    // Get user_id from request extensions (set by auth middleware)
    let user_id = match req.extensions().get::<i64>().copied() {
        Some(id) => id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "status": "error",
                "message": "Authentication required"
            }));
        }
    };

    let db = state.db.lock().await;

    // Get user's authorized apps
    let apps = match read::oauth_authorization::get_user_authorized_apps(&db, user_id).await {
        Ok(apps) => apps,
        Err(e) => {
            tracing::error!("Database error fetching authorized apps: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "status": "error",
                "message": "Failed to fetch authorized apps"
            }));
        }
    };

    // Transform to response format
    let app_infos: Vec<AuthorizedAppInfo> = apps
        .into_iter()
        .map(|app| AuthorizedAppInfo {
            consent_id: app.consent_id,
            client_db_id: app.client_db_id,
            client_id: app.client_id,
            client_name: app.client_name,
            client_description: app.client_description,
            logo_url: app.logo_url,
            homepage_url: app.homepage_url,
            privacy_policy_url: app.privacy_policy_url,
            granted_scopes: app.granted_scopes,
            authorized_at: app.authorized_at.to_rfc3339(),
            last_used_at: app.last_used_at.to_rfc3339(),
        })
        .collect();

    HttpResponse::Ok().json(AuthorizedAppsResponse {
        status: "success".to_string(),
        apps: app_infos,
    })
}

/// Request body for revoking app authorization
#[derive(Debug, Deserialize)]
pub struct RevokeAppAuthRequest {
    pub client_db_id: i64,
}

/// POST /oauth/authorized-apps/revoke - Revoke authorization for an app
///
/// Revokes the user's consent for a specific OAuth client.
/// This will:
/// - Delete the consent grant
/// - Revoke all refresh tokens for this user+client
pub async fn revoke_app_authorization(
    req: HttpRequest,
    state: web::Data<AppState>,
    body: web::Json<RevokeAppAuthRequest>,
) -> HttpResponse {
    // Get user_id from request extensions (set by auth middleware)
    let user_id = match req.extensions().get::<i64>().copied() {
        Some(id) => id,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "status": "error",
                "message": "Authentication required"
            }));
        }
    };

    let client_db_id = body.client_db_id;
    let db = state.db.lock().await;

    // Verify the consent exists for this user
    let consent = match read::oauth_authorization::get_consent_grant(&db, user_id, client_db_id).await {
        Ok(Some(c)) => c,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "status": "error",
                "message": "Authorization not found"
            }));
        }
        Err(e) => {
            tracing::error!("Database error checking consent: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "status": "error",
                "message": "Failed to verify authorization"
            }));
        }
    };

    // Revoke all refresh tokens for this user+client
    if let Err(e) = mutations::oauth_authorization::revoke_user_client_refresh_tokens(&db, user_id, consent.client_id).await {
        tracing::error!("Failed to revoke refresh tokens: {}", e);
        // Continue anyway - we still want to revoke consent
    }

    // Delete the consent grant
    if let Err(e) = mutations::oauth_authorization::revoke_consent_grant(&db, user_id, consent.client_id).await {
        tracing::error!("Database error revoking consent: {}", e);
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "status": "error",
            "message": "Failed to revoke authorization"
        }));
    }

    tracing::info!(
        "User {} revoked OAuth authorization for client {}",
        user_id,
        client_db_id
    );

    HttpResponse::Ok().json(serde_json::json!({
        "status": "success",
        "message": "Authorization revoked successfully"
    }))
}
