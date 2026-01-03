use actix_web::http::header;
use actix_web::middleware::DefaultHeaders;

pub fn configure() -> DefaultHeaders {
    DefaultHeaders::new()
        .add((header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
        .add((header::X_FRAME_OPTIONS, "DENY"))
        .add((
            header::STRICT_TRANSPORT_SECURITY,
            "max-age=31536000; includeSubDomains",
        ))
        .add((header::X_XSS_PROTECTION, "1; mode=block"))
        .add((
            header::CONTENT_SECURITY_POLICY,
            "default-src 'self'; \
             script-src 'self' 'unsafe-inline'; \
             style-src 'self' 'unsafe-inline'; \
             img-src 'self' data: blob:; \
             font-src 'self'; \
             connect-src 'self'; \
             frame-ancestors 'none'",
        ))
        .add((header::REFERRER_POLICY, "strict-origin-when-cross-origin"))
}
