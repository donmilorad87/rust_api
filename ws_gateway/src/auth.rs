//! JWT Authentication module
//!
//! Validates JWT tokens from blazing_sun application.

use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Arc;
use tracing::{debug, error};

use crate::error::{GatewayError, GatewayResult};

/// JWT Claims structure matching blazing_sun's token format
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: String,
    /// Username
    #[serde(default)]
    pub username: Option<String>,
    /// Email
    #[serde(default)]
    pub email: Option<String>,
    /// User roles
    #[serde(default)]
    pub roles: Vec<String>,
    /// Permission level (1=basic, 10=admin, 50=affiliate, 100=super admin)
    #[serde(default)]
    pub permission_level: Option<i32>,
    /// Expiration time (Unix timestamp)
    pub exp: usize,
    /// Issued at time (Unix timestamp)
    #[serde(default)]
    pub iat: Option<usize>,
    /// Issuer
    #[serde(default)]
    pub iss: Option<String>,
}

/// Authenticated user information
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: String,
    pub username: String,
    pub email: Option<String>,
    pub roles: Vec<String>,
    pub permission_level: i32,
}

impl From<Claims> for AuthenticatedUser {
    fn from(claims: Claims) -> Self {
        Self {
            user_id: claims.sub,
            username: claims.username.unwrap_or_else(|| "unknown".to_string()),
            email: claims.email,
            roles: claims.roles,
            permission_level: claims.permission_level.unwrap_or(1),
        }
    }
}

/// JWT Validator
pub struct JwtValidator {
    decoding_key: DecodingKey,
    validation: Validation,
}

impl JwtValidator {
    /// Create a new JWT validator from a PEM file
    pub fn from_pem_file(path: &str) -> GatewayResult<Self> {
        let pem = fs::read_to_string(path)
            .map_err(|e| GatewayError::Internal(format!("Failed to read JWT public key: {}", e)))?;

        Self::from_pem(&pem)
    }

    /// Create a new JWT validator from PEM string
    pub fn from_pem(pem: &str) -> GatewayResult<Self> {
        let decoding_key = DecodingKey::from_rsa_pem(pem.as_bytes())
            .map_err(|e| GatewayError::Internal(format!("Invalid RSA public key: {}", e)))?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.validate_exp = true;
        // Don't validate issuer for now, can be enabled if needed
        validation.validate_aud = false;

        Ok(Self {
            decoding_key,
            validation,
        })
    }

    /// Create a validator from HMAC secret (alternative method)
    pub fn from_secret(secret: &str) -> GatewayResult<Self> {
        let decoding_key = DecodingKey::from_secret(secret.as_bytes());

        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;
        validation.validate_aud = false;

        Ok(Self {
            decoding_key,
            validation,
        })
    }

    /// Validate a JWT token and extract claims
    pub fn validate(&self, token: &str) -> GatewayResult<AuthenticatedUser> {
        debug!("Validating JWT token");

        let token_data = decode::<Claims>(token, &self.decoding_key, &self.validation)
            .map_err(|e| {
                error!("JWT validation failed: {}", e);
                GatewayError::AuthFailed(format!("Invalid token: {}", e))
            })?;

        let user = AuthenticatedUser::from(token_data.claims);
        debug!("JWT validated for user: {}", user.user_id);

        Ok(user)
    }
}

/// Shared JWT validator wrapped in Arc
pub type SharedJwtValidator = Arc<JwtValidator>;

/// Create a JWT validator from configuration
pub fn create_validator(key_path: &str) -> GatewayResult<SharedJwtValidator> {
    // Try RSA PEM first
    if let Ok(validator) = JwtValidator::from_pem_file(key_path) {
        return Ok(Arc::new(validator));
    }

    // Fall back to HMAC secret from environment
    if let Ok(secret) = std::env::var("JWT_SECRET") {
        let validator = JwtValidator::from_secret(&secret)?;
        return Ok(Arc::new(validator));
    }

    Err(GatewayError::Internal(
        "No JWT validation method available. Set JWT_PUBLIC_KEY_PATH or JWT_SECRET".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claims_deserialization() {
        let json = r#"{
            "sub": "123",
            "username": "testuser",
            "email": "test@example.com",
            "roles": ["user"],
            "permission_level": 1,
            "exp": 9999999999,
            "iat": 1234567890
        }"#;

        let claims: Claims = serde_json::from_str(json).unwrap();
        assert_eq!(claims.sub, "123");
        assert_eq!(claims.username, Some("testuser".to_string()));
        assert_eq!(claims.roles, vec!["user"]);
    }
}
