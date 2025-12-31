use actix_web::web::{Data, JsonConfig};
use actix_web::{App, HttpServer};
use blazing_sun::config::AppConfig;
use blazing_sun::database::{create_mongodb, create_pool, state_full, AppState};
use blazing_sun::events;
use blazing_sun::init_crons;
use blazing_sun::middleware::{cors, security_headers, tracing_logger};
use blazing_sun::mq;
use blazing_sun::{configure_api, configure_web, json_error_handler};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
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

    let server = HttpServer::new(move || {
        App::new()
            .wrap(tracing_logger::configure())
            .wrap(cors::configure())
            .wrap(security_headers::configure())
            .app_data(state.clone())
            .app_data(JsonConfig::default().error_handler(json_error_handler))
            .configure(configure_api)
            .configure(configure_web)
    })
    .bind((host, port))?;

    info!("Server running on {}:{}", host, port);

    server.run().await
}
