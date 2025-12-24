use actix_web::web::{Data, JsonConfig};
use actix_web::{App, HttpServer};
use money_flow::config::AppConfig;
use money_flow::database::{create_pool, state_with_mq_and_events, AppState};
use money_flow::events;
use money_flow::init_crons;
use money_flow::middleware::{cors, security_headers, tracing_logger};
use money_flow::mq;
use money_flow::{configure_api, configure_web, json_error_handler};
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

    // Cast SharedQueue to DynMq for AppState (avoids circular dependency)
    let dyn_mq: money_flow::database::DynMq = mq_queue;

    // Create state with both MQ and Events
    let state: Data<AppState> = if let Some(bus) = event_bus {
        state_with_mq_and_events(dyn_mq, bus).await
    } else {
        money_flow::database::state_with_mq(dyn_mq).await
    };

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
