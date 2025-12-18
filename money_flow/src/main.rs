use actix_cors::Cors;
use actix_web::http::header;
use actix_web::middleware::DefaultHeaders;
use actix_web::web::Data;
use actix_web::{App, HttpServer};
use dotenv::dotenv;
use money_flow::modules::db::AppState;
use money_flow::{configure, state};
use tracing::info;
use tracing_actix_web::TracingLogger;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    // Initialize tracing with pretty colored output
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().pretty())
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let host: String = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8888".to_string())
        .parse()
        .expect("PORT must be a valid number");

    let state: Data<AppState> = state().await;

    info!("Server running on {}:{}", host, port);

    HttpServer::new(move || {
        // CORS - allow all for development
        let cors = Cors::permissive();

        // Security headers
        let security_headers = DefaultHeaders::new()
            .add((header::X_CONTENT_TYPE_OPTIONS, "nosniff"))
            .add((header::X_FRAME_OPTIONS, "DENY"))
            .add((
                header::STRICT_TRANSPORT_SECURITY,
                "max-age=31536000; includeSubDomains",
            ))
            .add((header::X_XSS_PROTECTION, "1; mode=block"))
            .add((
                header::CONTENT_SECURITY_POLICY,
                "default-src 'self'; frame-ancestors 'none'",
            ))
            .add((header::REFERRER_POLICY, "strict-origin-when-cross-origin"));

        App::new()
            .wrap(TracingLogger::default())
            .wrap(cors)
            .wrap(security_headers)
            .app_data(state.clone())
            .configure(configure)
    })
    .bind((host, port))?
    .run()
    .await
}
