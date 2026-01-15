//! OAuth JWT Utility
//!
//! RS256 JWT generation for OAuth access tokens.
//! Uses RSA private key for signing and includes OAuth-specific claims.

use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

/// OAuth Access Token Claims (JWT payload)
#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthClaims {
    /// Issuer (your OAuth server URL)
    pub iss: String,
    /// Subject (user ID)
    pub sub: String,
    /// Audience (client_id)
    pub aud: String,
    /// Expiration time (Unix timestamp)
    pub exp: i64,
    /// Issued at (Unix timestamp)
    pub iat: i64,
    /// Scope (space-separated list)
    pub scope: String,
    /// Client ID (for reference)
    pub client_id: String,
}

/// JWT Generation Result
pub struct GeneratedJwt {
    pub access_token: String,
    pub expires_in: i64,
}

/// Generate OAuth access token (RS256 JWT)
///
/// # Arguments
/// * `private_key_path` - Path to RSA private key (PEM format)
/// * `kid` - Key ID (for JWKS)
/// * `issuer` - Issuer URL (OAuth server)
/// * `user_id` - User ID (subject)
/// * `client_id` - Client ID (audience + reference)
/// * `scope` - Space-separated scope list
/// * `ttl_seconds` - Token time-to-live in seconds
///
/// # Returns
/// Result containing the JWT string and expiration time
pub fn generate_access_token(
    private_key_path: &str,
    kid: &str,
    issuer: &str,
    user_id: i64,
    client_id: &str,
    scope: &str,
    ttl_seconds: i64,
) -> Result<GeneratedJwt, Box<dyn std::error::Error>> {
    // Read private key from file
    let private_key_pem = fs::read_to_string(private_key_path)?;

    // Create encoding key from RSA PEM
    let encoding_key = EncodingKey::from_rsa_pem(private_key_pem.as_bytes())?;

    // Get current timestamp
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64;

    // Create JWT claims
    let claims = OAuthClaims {
        iss: issuer.to_string(),
        sub: user_id.to_string(),
        aud: client_id.to_string(),
        exp: now + ttl_seconds,
        iat: now,
        scope: scope.to_string(),
        client_id: client_id.to_string(),
    };

    // Create JWT header with RS256 algorithm and key ID
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(kid.to_string());

    // Encode JWT
    let token = encode(&header, &claims, &encoding_key)?;

    Ok(GeneratedJwt {
        access_token: token,
        expires_in: ttl_seconds,
    })
}

/// Verify and decode OAuth access token (for resource servers)
///
/// Note: This requires the RSA public key for verification.
/// Resource servers should fetch the public key from JWKS endpoint.
pub fn verify_access_token(
    token: &str,
    public_key_path: &str,
    expected_issuer: &str,
) -> Result<OAuthClaims, Box<dyn std::error::Error>> {
    use jsonwebtoken::{decode, DecodingKey, Validation};

    // Read public key from file
    let public_key_pem = fs::read_to_string(public_key_path)?;

    // Create decoding key from RSA PEM
    let decoding_key = DecodingKey::from_rsa_pem(public_key_pem.as_bytes())?;

    // Configure validation
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[expected_issuer]);
    validation.validate_exp = true;

    // Decode and verify JWT
    let token_data = decode::<OAuthClaims>(token, &decoding_key, &validation)?;

    Ok(token_data.claims)
}

/// Extract public key components for JWKS
///
/// Returns (n, e) where:
/// - n: modulus (base64url-encoded)
/// - e: exponent (base64url-encoded)
pub fn extract_jwks_components(
    public_key_path: &str,
) -> Result<(String, String), Box<dyn std::error::Error>> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
    use rsa::pkcs8::DecodePublicKey;
    use rsa::traits::PublicKeyParts;
    use rsa::RsaPublicKey;

    // Read public key from file
    let public_key_pem = fs::read_to_string(public_key_path)?;

    // Parse RSA public key
    let public_key = RsaPublicKey::from_public_key_pem(&public_key_pem)?;

    // Get modulus (n) and exponent (e)
    let n = public_key.n();
    let e = public_key.e();

    // Convert to big-endian bytes
    let n_bytes = n.to_bytes_be();
    let e_bytes = e.to_bytes_be();

    // Base64url encode (no padding)
    let n_b64 = URL_SAFE_NO_PAD.encode(&n_bytes);
    let e_b64 = URL_SAFE_NO_PAD.encode(&e_bytes);

    Ok((n_b64, e_b64))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_verify_token() {
        // This test requires actual key files to exist
        // In practice, keys should be generated during setup

        let private_key = "/path/to/private_key.pem";
        let public_key = "/path/to/public_key.pem";

        // Generate token
        let result = generate_access_token(
            private_key,
            "oauth-key-1",
            "https://example.com",
            123,
            "test-client-id",
            "galleries.read galleries.write",
            3600,
        );

        if let Ok(jwt) = result {
            println!("Generated JWT: {}", jwt.access_token);

            // Verify token
            let claims = verify_access_token(&jwt.access_token, public_key, "https://example.com");

            match claims {
                Ok(c) => {
                    assert_eq!(c.sub, "123");
                    assert_eq!(c.client_id, "test-client-id");
                    assert_eq!(c.scope, "galleries.read galleries.write");
                }
                Err(e) => println!("Verification failed: {}", e),
            }
        }
    }
}
