//! JWT Authentication module
//!
//! Validates JWT tokens from blazing_sun application.

use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Arc;
use tracing::{debug, error, info};

use crate::error::{GatewayError, GatewayResult};

/// JWT Claims structure matching blazing_sun's token format
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// Subject (user ID) - blazing_sun sends as i64, we deserialize to string
    #[serde(deserialize_with = "deserialize_sub")]
    pub sub: String,
    /// Role (from blazing_sun)
    #[serde(default)]
    pub role: Option<String>,
    /// Permissions level (from blazing_sun)
    #[serde(default)]
    pub permissions: Option<i16>,
    /// Username (optional)
    #[serde(default)]
    pub username: Option<String>,
    /// Email (optional)
    #[serde(default)]
    pub email: Option<String>,
    /// User roles (optional)
    #[serde(default)]
    pub roles: Vec<String>,
    /// Permission level (optional, 1=basic, 10=admin, 50=affiliate, 100=super admin)
    #[serde(default)]
    pub permission_level: Option<i32>,
    /// Expiration time (Unix timestamp)
    pub exp: usize,
    /// Issued at time (Unix timestamp)
    #[serde(default)]
    pub iat: Option<usize>,
    /// Issuer (optional)
    #[serde(default)]
    pub iss: Option<String>,
}

/// Custom deserializer for sub field that handles both i64 and String
fn deserialize_sub<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::{self, Visitor};

    struct SubVisitor;

    impl<'de> Visitor<'de> for SubVisitor {
        type Value = String;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a string or integer")
        }

        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            Ok(v.to_string())
        }

        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            Ok(v.to_string())
        }

        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
        where
            E: de::Error,
        {
            Ok(v.to_string())
        }
    }

    deserializer.deserialize_any(SubVisitor)
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
        // Build roles from either `roles` array or single `role` field
        let roles = if !claims.roles.is_empty() {
            claims.roles
        } else if let Some(role) = claims.role {
            vec![role]
        } else {
            vec!["user".to_string()]
        };

        // Get permission level from either field
        let permission_level = claims.permission_level
            .or(claims.permissions.map(|p| p as i32))
            .unwrap_or(1);

        // Extract fields in the right order to satisfy borrow checker
        let sub_for_username = claims.sub.clone();
        let username = claims.username.unwrap_or_else(|| {
            let len = sub_for_username.len().min(8);
            format!("user_{}", &sub_for_username[..len])
        });

        Self {
            user_id: claims.sub,
            username,
            email: claims.email,
            roles,
            permission_level,
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
    // Try HMAC secret first (matches blazing_sun's HS256 tokens)
    if let Ok(secret) = std::env::var("JWT_SECRET") {
        if !secret.is_empty() {
            info!("Using HS256 JWT validation with JWT_SECRET");
            let validator = JwtValidator::from_secret(&secret)?;
            return Ok(Arc::new(validator));
        }
    }

    // Fall back to RSA PEM if JWT_SECRET not set
    if let Ok(validator) = JwtValidator::from_pem_file(key_path) {
        info!("Using RS256 JWT validation with PEM file");
        return Ok(Arc::new(validator));
    }

    Err(GatewayError::Internal(
        "No JWT validation method available. Set JWT_SECRET or JWT_PUBLIC_KEY_PATH".to_string(),
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
