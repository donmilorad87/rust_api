use actix_session::config::{PersistentSession, CookieContentSecurity};
use actix_session::{SessionMiddleware, storage::RedisSessionStore};
use actix_web::cookie::{Key, SameSite, time::Duration};
use actix_web::middleware::from_fn;
use actix_web::web::{Data, JsonConfig};
use actix_web::{App, HttpServer};
use blazing_sun::config::{AppConfig, SessionConfig};
use blazing_sun::database::{create_mongodb, create_pool, state_full, AppState};
use blazing_sun::events;
use blazing_sun::init_crons;
use blazing_sun::middleware::{cors, security_headers, tracing_logger};
use blazing_sun::bootstrap::middleware::controllers::csrf;
use blazing_sun::mq;
use blazing_sun::{configure_api, configure_web, json_error_handler};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables from .env file
    dotenv::dotenv().ok();

    tracing_logger::init();

    let host = AppConfig::host();
    let port = AppConfig::port();

    // Initialize cron jobs with a separate database pool
    let cron_pool = create_pool().await;
    let _scheduler = match init_crons(cron_pool).await {
        Ok(scheduler) => scheduler,
        Err(e) => {
            error!("Failed to initialize cron jobs: {}", e);
            return Err(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()));
        }
    };

    // Initialize message queue (RabbitMQ for async tasks)
    let mq_pool = create_pool().await;
    let mq_queue = match mq::init(mq_pool).await {
        Ok(queue) => queue,
        Err(e) => {
            error!("Failed to initialize message queue: {}", e);
            return Err(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()));
        }
    };

    // Start MQ processor with 4 concurrent workers
    mq::start_processor(mq_queue.clone(), 4).await;

    // Initialize Kafka event system (for event-driven architecture)
    let events_pool = create_pool().await;
    let events_db = Arc::new(Mutex::new(events_pool));

    let (event_bus, event_consumer) = match events::init(events_db).await {
        Ok((bus, consumer)) => {
            info!("Kafka event system initialized successfully");
            (Some(bus), Some(consumer))
        }
        Err(e) => {
            warn!("Failed to initialize Kafka event system (continuing without events): {}", e);
            (None, None)
        }
    };

    // Start event consumer in background (if initialized)
    if let Some(consumer) = event_consumer {
        events::start_consumer(consumer);
        info!("Kafka event consumer started");
    }

    // Initialize MongoDB connection
    let mongodb = match create_mongodb().await {
        Ok(db) => {
            info!("MongoDB connected successfully");
            Some(db)
        }
        Err(e) => {
            warn!("Failed to connect to MongoDB (continuing without MongoDB): {}", e);
            None
        }
    };

    // Cast SharedQueue to DynMq for AppState (avoids circular dependency)
    let dyn_mq: blazing_sun::database::DynMq = mq_queue;

    // Create state with all services (MQ, Events, MongoDB)
    let state: Data<AppState> = state_full(dyn_mq, event_bus, mongodb).await;

    // Initialize session configuration
    let session_config = SessionConfig::from_env()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, format!("Session config error: {}", e)))?;

    // Initialize Redis session store
    let redis_url = session_config.redis_url.clone();
    let session_store = RedisSessionStore::new(&redis_url)
        .await
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, format!("Redis session store error: {}", e)))?;

    info!("Redis session store initialized successfully");

    // Use persistent secret key for session cookies (from env or generate once)
    let secret_key = match std::env::var("SESSION_SECRET_KEY") {
        Ok(key) if key.len() >= 64 => {
            // Use the provided key (must be at least 64 bytes for security)
            Key::from(key.as_bytes())
        }
        _ => {
            // Fallback: generate a new key (sessions will be lost on restart)
            warn!("SESSION_SECRET_KEY not set or too short (min 64 chars). Generating random key - sessions will be lost on restart!");
            Key::generate()
        }
    };

    // Configure session cookie settings
    let same_site = match session_config.same_site.to_lowercase().as_str() {
        "strict" => SameSite::Strict,
        "none" => SameSite::None,
        _ => SameSite::Lax,
    };

    let session_ttl = Duration::seconds(session_config.ttl_seconds());

    let server = HttpServer::new(move || {
        // Build session middleware with configuration
        let session_middleware = SessionMiddleware::builder(session_store.clone(), secret_key.clone())
            .cookie_name(session_config.cookie_name.clone())
            .cookie_secure(session_config.secure_cookie)
            .cookie_http_only(session_config.http_only)
            .cookie_same_site(same_site)
            .cookie_path(session_config.cookie_path.clone())
            .session_lifecycle(
                PersistentSession::default()
                    .session_ttl(session_ttl)
            )
            .cookie_content_security(CookieContentSecurity::Private)
            .build();

        App::new()
            .wrap(tracing_logger::configure())
            .wrap(cors::configure())
            .wrap(security_headers::configure())
            .wrap(from_fn(csrf::verify_csrf))
            .wrap(session_middleware)
            .app_data(state.clone())
            .app_data(JsonConfig::default().error_handler(json_error_handler))
            .configure(configure_api)
            .configure(configure_web)
    })
    .bind((host, port))?;

    info!("Server running on {}:{}", host, port);

    server.run().await
}
