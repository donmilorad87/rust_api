use crate::app::checkout::{fulfill_pending, CheckoutEvent, CheckoutSessionResult};
use crate::events::consumer::{EventHandler, EventHandlerError};
use crate::events::topics::topic;
use async_trait::async_trait;
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, warn};

pub struct CheckoutEventHandler {
    #[allow(dead_code)]
    db: Arc<Mutex<Pool<Postgres>>>,
}

impl CheckoutEventHandler {
    pub fn new(db: Arc<Mutex<Pool<Postgres>>>, _producer: Option<Arc<crate::events::producer::EventProducer>>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl EventHandler for CheckoutEventHandler {
    fn name(&self) -> &'static str {
        "checkout_event_handler"
    }

    fn topics(&self) -> Vec<&'static str> {
        vec![topic::CHECKOUT_EVENTS]
    }

    async fn handle(&self, event: &crate::events::DomainEvent) -> Result<(), EventHandlerError> {
        let checkout_event: CheckoutEvent = serde_json::from_value(event.payload.clone())
            .map_err(|err| EventHandlerError::Fatal(format!("Invalid checkout payload: {}", err)))?;

        match checkout_event {
            CheckoutEvent::SessionCreated {
                request_id,
                session_id,
                session_url,
                ..
            } => {
                let result = CheckoutSessionResult::success(session_id, session_url);
                let _ = fulfill_pending(&request_id, result).await;
            }
            CheckoutEvent::SessionFailed { request_id, error, .. } => {
                let result = CheckoutSessionResult::failure(error);
                let _ = fulfill_pending(&request_id, result).await;
            }
            CheckoutEvent::PaymentSucceeded {
                request_id,
                user_id,
                amount_cents,
                session_id,
                ..
            } => {
                // NOTE: Balance update is handled by CheckoutFinishedHandler (checkout_finished topic)
                // This handler only logs the event from checkout.events for debugging/audit purposes
                info!(
                    request_id = %request_id,
                    user_id = %user_id,
                    amount_cents = %amount_cents,
                    session_id = %session_id,
                    "Checkout payment succeeded (balance updated by checkout_finished handler)"
                );
            }
            CheckoutEvent::PaymentFailed {
                request_id,
                user_id,
                error,
                ..
            } => {
                warn!(
                    request_id = %request_id,
                    user_id = %user_id,
                    error = %error,
                    "Checkout payment failed"
                );
            }
        }

        Ok(())
    }
}
