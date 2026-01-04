use rand::Rng;
use actix_session::Session;

const CSRF_TOKEN_LENGTH: usize = 32;
const SESSION_CSRF_KEY: &str = "csrf_token";

/// Generate a cryptographically secure CSRF token
pub fn generate_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..CSRF_TOKEN_LENGTH).map(|_| rng.gen()).collect();
    base64::encode(&bytes)
}

/// Get or create CSRF token from session
pub fn get_or_create_token(session: &Session) -> Result<String, actix_web::Error> {
    if let Ok(Some(token)) = session.get::<String>(SESSION_CSRF_KEY) {
        return Ok(token);
    }

    let token = generate_token();
    session.insert(SESSION_CSRF_KEY, token.clone())
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))?;

    Ok(token)
}

/// Validate CSRF token using constant-time comparison
pub fn validate_token(session_token: &str, request_token: &str) -> bool {
    if session_token.len() != request_token.len() {
        return false;
    }

    // Constant-time comparison to prevent timing attacks
    let mut result: u8 = 0;
    for (a, b) in session_token.bytes().zip(request_token.bytes()) {
        result |= a ^ b;
    }

    result == 0
}

/// Extract CSRF token from session
pub fn get_token_from_session(session: &Session) -> Result<Option<String>, actix_web::Error> {
    session.get::<String>(SESSION_CSRF_KEY)
        .map_err(|e| actix_web::error::ErrorInternalServerError(e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_token_length() {
        let token = generate_token();
        assert!(!token.is_empty());
    }

    #[test]
    fn test_validate_token_same() {
        let token = "test_token_12345";
        assert!(validate_token(token, token));
    }

    #[test]
    fn test_validate_token_different() {
        let token1 = "test_token_12345";
        let token2 = "test_token_54321";
        assert!(!validate_token(token1, token2));
    }

    #[test]
    fn test_validate_token_different_length() {
        let token1 = "short";
        let token2 = "much_longer_token";
        assert!(!validate_token(token1, token2));
    }
}
