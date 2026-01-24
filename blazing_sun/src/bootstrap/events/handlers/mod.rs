pub mod auth;
pub mod chat;
pub mod checkout_finished;
pub mod games;
pub mod user;

pub use auth::{AuthEventHandler, SecurityMonitorHandler};
pub use chat::ChatCommandHandler;
pub use checkout_finished::CheckoutFinishedHandler;
pub use games::GameCommandHandler;
pub use user::{UserAuditHandler, UserEventHandler};

use crate::events::consumer::EventConsumer;
use crate::events::producer::EventProducer;
use mongodb::Database;
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;

/// Register all default event handlers with a consumer
pub fn register_default_handlers(
    consumer: &mut EventConsumer,
    db: Arc<Mutex<Pool<Postgres>>>,
    producer: Option<Arc<EventProducer>>,
) {
    info!("Registering default event handlers");

    // User domain handlers
    let user_handler = UserEventHandler::new(db.clone());
    consumer.register_handler(Arc::new(user_handler));

    // User audit handler (logs all user and auth events)
    let audit_handler = UserAuditHandler::new(db.clone());
    consumer.register_handler(Arc::new(audit_handler));

    // Auth domain handlers
    let auth_handler = AuthEventHandler::new();
    consumer.register_handler(Arc::new(auth_handler));

    // Security monitoring handler
    let security_handler = SecurityMonitorHandler::new();
    consumer.register_handler(Arc::new(security_handler));

    // Checkout finished handler (checkout/checkout_finished flow)
    let checkout_finished_handler = CheckoutFinishedHandler::new(db, producer);
    consumer.register_handler(Arc::new(checkout_finished_handler));

    info!("Default event handlers registered");
}

/// Register all event handlers including WebSocket gateway handlers
pub fn register_all_handlers(
    consumer: &mut EventConsumer,
    db: Arc<Mutex<Pool<Postgres>>>,
    mongodb: Option<Arc<Database>>,
    producer: Option<Arc<EventProducer>>,
) {
    // Register default handlers first
    register_default_handlers(consumer, db.clone(), producer.clone());

    // Register chat command handler for WebSocket gateway
    let chat_handler = ChatCommandHandler::new(db.clone(), mongodb.clone(), producer.clone());
    consumer.register_handler(Arc::new(chat_handler));

    // Register game command handler for WebSocket gateway
    let game_handler = GameCommandHandler::new(db.clone(), mongodb, producer);
    consumer.register_handler(Arc::new(game_handler));

    info!("WebSocket gateway handlers registered (chat + games)");
}
