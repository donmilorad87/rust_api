pub mod auth;
pub mod user;

pub use auth::{AuthEventHandler, SecurityMonitorHandler};
pub use user::{UserAuditHandler, UserEventHandler};

use crate::events::consumer::EventConsumer;
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::info;

/// Register all default event handlers with a consumer
pub fn register_default_handlers(
    consumer: &mut EventConsumer,
    db: Arc<Mutex<Pool<Postgres>>>,
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

    info!("Default event handlers registered");
}
