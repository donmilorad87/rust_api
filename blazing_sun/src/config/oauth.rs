use once_cell::sync::Lazy;

pub struct OAuthConfig {
    pub jwt_issuer: String,
    pub jwt_audience: String,
    pub jwt_signing_algorithm: String,
    pub jwt_private_key_path: String,
    pub jwt_public_key_path: String,
    pub jwt_kid: String,
    pub access_token_ttl_seconds: i64,
    pub refresh_token_ttl_days: i64,
    pub auth_code_ttl_seconds: i64,
    pub require_pkce_for_public_clients: bool,
    pub allow_http_localhost_redirect: bool,
    pub refresh_token_rotation_enabled: bool,
    pub refresh_reuse_detection_enabled: bool,
}

pub static OAUTH: Lazy<OAuthConfig> = Lazy::new(|| {
    dotenv::dotenv().ok();

    OAuthConfig {
        jwt_issuer: std::env::var("OAUTH_JWT_ISSUER")
            .unwrap_or_else(|_| "https://blazingsun.com".to_string()),
        jwt_audience: std::env::var("OAUTH_JWT_AUDIENCE")
            .unwrap_or_else(|_| "blazingsun_api".to_string()),
        jwt_signing_algorithm: std::env::var("OAUTH_JWT_SIGNING_ALGORITHM")
            .unwrap_or_else(|_| "RS256".to_string()),
        jwt_private_key_path: std::env::var("OAUTH_JWT_PRIVATE_KEY_PATH")
            .unwrap_or_else(|_| "keys/jwt_private.pem".to_string()),
        jwt_public_key_path: std::env::var("OAUTH_JWT_PUBLIC_KEY_PATH")
            .unwrap_or_else(|_| "keys/jwt_public.pem".to_string()),
        jwt_kid: std::env::var("OAUTH_JWT_KID")
            .unwrap_or_else(|_| "blazing_sun_key_001".to_string()),
        access_token_ttl_seconds: std::env::var("OAUTH_ACCESS_TOKEN_TTL_SECONDS")
            .unwrap_or_else(|_| "900".to_string())
            .parse()
            .expect("OAUTH_ACCESS_TOKEN_TTL_SECONDS must be a valid number"),
        refresh_token_ttl_days: std::env::var("OAUTH_REFRESH_TOKEN_TTL_DAYS")
            .unwrap_or_else(|_| "30".to_string())
            .parse()
            .expect("OAUTH_REFRESH_TOKEN_TTL_DAYS must be a valid number"),
        auth_code_ttl_seconds: std::env::var("OAUTH_AUTH_CODE_TTL_SECONDS")
            .unwrap_or_else(|_| "300".to_string())
            .parse()
            .expect("OAUTH_AUTH_CODE_TTL_SECONDS must be a valid number"),
        require_pkce_for_public_clients: std::env::var("OAUTH_REQUIRE_PKCE_FOR_PUBLIC_CLIENTS")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true),
        allow_http_localhost_redirect: std::env::var("OAUTH_ALLOW_HTTP_LOCALHOST_REDIRECT")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true),
        refresh_token_rotation_enabled: std::env::var("OAUTH_REFRESH_TOKEN_ROTATION_ENABLED")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true),
        refresh_reuse_detection_enabled: std::env::var("OAUTH_REFRESH_REUSE_DETECTION_ENABLED")
            .unwrap_or_else(|_| "true".to_string())
            .parse()
            .unwrap_or(true),
    }
});

impl OAuthConfig {
    pub fn jwt_issuer() -> &'static str {
        &OAUTH.jwt_issuer
    }

    pub fn jwt_audience() -> &'static str {
        &OAUTH.jwt_audience
    }

    pub fn jwt_signing_algorithm() -> &'static str {
        &OAUTH.jwt_signing_algorithm
    }

    pub fn jwt_private_key_path() -> &'static str {
        &OAUTH.jwt_private_key_path
    }

    pub fn jwt_public_key_path() -> &'static str {
        &OAUTH.jwt_public_key_path
    }

    pub fn jwt_kid() -> &'static str {
        &OAUTH.jwt_kid
    }

    pub fn access_token_ttl_seconds() -> i64 {
        OAUTH.access_token_ttl_seconds
    }

    pub fn refresh_token_ttl_days() -> i64 {
        OAUTH.refresh_token_ttl_days
    }

    pub fn auth_code_ttl_seconds() -> i64 {
        OAUTH.auth_code_ttl_seconds
    }

    pub fn require_pkce_for_public_clients() -> bool {
        OAUTH.require_pkce_for_public_clients
    }

    pub fn allow_http_localhost_redirect() -> bool {
        OAUTH.allow_http_localhost_redirect
    }

    pub fn refresh_token_rotation_enabled() -> bool {
        OAUTH.refresh_token_rotation_enabled
    }

    pub fn refresh_reuse_detection_enabled() -> bool {
        OAUTH.refresh_reuse_detection_enabled
    }
}
