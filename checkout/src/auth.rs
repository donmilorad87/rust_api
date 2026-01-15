use actix_web::HttpRequest;
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct JwtClaims {
    pub sub: i64,
    pub role: String,
    pub permissions: i16,
    pub exp: i64,
}

pub fn extract_token(req: &HttpRequest) -> Option<String> {
    if let Some(auth_header) = req.headers().get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(token) = auth_str.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }

    req.cookie("auth_token").map(|cookie| cookie.value().to_string())
}

pub fn decode_token(
    token: &str,
    secret: &str,
) -> Result<JwtClaims, jsonwebtoken::errors::Error> {
    let decoding_key = DecodingKey::from_secret(secret.as_bytes());
    let data = decode::<JwtClaims>(token, &decoding_key, &Validation::default())?;
    Ok(data.claims)
}

#[cfg(test)]
mod tests {
    use super::{decode_token, extract_token, JwtClaims};
    use actix_web::cookie::Cookie;
    use actix_web::test::TestRequest;
    use jsonwebtoken::{encode, EncodingKey, Header};

    #[test]
    fn extract_token_prefers_authorization_header() {
        let req = TestRequest::default()
            .insert_header(("Authorization", "Bearer header_token"))
            .cookie(Cookie::new("auth_token", "cookie_token"))
            .to_http_request();

        assert_eq!(extract_token(&req), Some("header_token".to_string()));
    }

    #[test]
    fn extract_token_falls_back_to_cookie() {
        let req = TestRequest::default()
            .cookie(Cookie::new("auth_token", "cookie_token"))
            .to_http_request();

        assert_eq!(extract_token(&req), Some("cookie_token".to_string()));
    }

    #[test]
    fn decode_token_reads_claims() {
        let secret = "test_secret";
        let claims = JwtClaims {
            sub: 42,
            role: "user".to_string(),
            permissions: 1,
            exp: 9999999999,
        };

        let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_bytes()))
            .expect("encode token");
        let decoded = decode_token(&token, secret).expect("decode token");

        assert_eq!(decoded.sub, 42);
        assert_eq!(decoded.permissions, 1);
    }
}
