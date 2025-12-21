use actix_web::web::{Data, JsonConfig};
use actix_web::{App, HttpServer};
use dotenv::dotenv;
use money_flow::crons;
use money_flow::middleware::{cors, security_headers, tracing_logger};
use money_flow::db::{create_pool, state_with_mq, AppState};
use money_flow::mq;
use money_flow::{configure, json_error_handler};
use tracing::{error, info};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();
    tracing_logger::init();

    let host: String = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8888".to_string())
        .parse()
        .expect("PORT must be a valid number");

    // Initialize cron jobs with a separate database pool
    let cron_pool = create_pool().await;
    let _scheduler = match crons::init(cron_pool).await {
        Ok(scheduler) => scheduler,
        Err(e) => {
            error!("Failed to initialize cron jobs: {}", e);
            return Err(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()));
        }
    };

    // Initialize message queue
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

    // Cast SharedQueue to DynMq for AppState (avoids circular dependency)
    let dyn_mq: money_flow::db::DynMq = mq_queue;
    let state: Data<AppState> = state_with_mq(dyn_mq).await;

    let server = HttpServer::new(move || {
        App::new()
            .wrap(tracing_logger::configure())
            .wrap(cors::configure())
            .wrap(security_headers::configure())
            .app_data(state.clone())
            .app_data(JsonConfig::default().error_handler(json_error_handler))
            .configure(configure)
    })
    .bind((&host[..], port))?;

    info!("Server running on {}:{}", host, port);

    server.run().await
}
