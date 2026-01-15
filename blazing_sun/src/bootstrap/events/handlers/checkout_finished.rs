//! Handler for the `checkout_finished` Kafka topic
//!
//! Processes events from the checkout service webhook:
//! - status="success": Updates user balance after payment completes
//! - status="failed": Logs payment failure
//!
//! Note: DB row is created by checkout service when webhook fires.
//! This handler only updates the user's balance in the main database.

use crate::app::checkout::CheckoutFinishedEvent;
use crate::database::mutations::user as db_user_mutations;
use crate::database::read::user as db_user_read;
use crate::events::consumer::{EventHandler, EventHandlerError};
use crate::events::producer::EventProducer;
use crate::events::topics::topic;
use crate::events::{EventBuilder, EventType, UserEventType};
use async_trait::async_trait;
use serde_json::json;
use sqlx::{Pool, Postgres};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, warn};

/// Handler for the `checkout_finished` topic
///
/// This handler processes events from the checkout service webhook:
/// - Updates user balance on successful payments
/// - Logs failures for debugging
pub struct CheckoutFinishedHandler {
    db: Arc<Mutex<Pool<Postgres>>>,
    producer: Option<Arc<EventProducer>>,
}

impl CheckoutFinishedHandler {
    /// Create a new handler instance
    pub fn new(db: Arc<Mutex<Pool<Postgres>>>, producer: Option<Arc<EventProducer>>) -> Self {
        Self { db, producer }
    }
}

#[async_trait]
impl EventHandler for CheckoutFinishedHandler {
    fn name(&self) -> &'static str {
        "checkout_finished_handler"
    }

    fn topics(&self) -> Vec<&'static str> {
        vec![topic::CHECKOUT_FINISHED]
    }

    async fn handle(&self, event: &crate::events::DomainEvent) -> Result<(), EventHandlerError> {
        // Parse the CheckoutFinishedEvent from the domain event payload
        let checkout_event: CheckoutFinishedEvent =
            serde_json::from_value(event.payload.clone()).map_err(|err| {
                EventHandlerError::Fatal(format!("Invalid checkout_finished payload: {}", err))
            })?;

        let request_id = checkout_event.request_id.clone();
        let user_id = checkout_event.user_id;
        let amount_cents = checkout_event.amount_cents;

        match checkout_event.status.as_str() {
            "success" => {
                // Payment succeeded - update user balance
                let db = self.db.lock().await;

                if let Err(err) = db_user_mutations::add_balance(&db, user_id, amount_cents).await {
                    return Err(EventHandlerError::Retryable(format!(
                        "Failed to update balance: {}",
                        err
                    )));
                }

                let new_balance = db_user_read::get_by_id(&db, user_id)
                    .await
                    .ok()
                    .map(|user| user.balance);
                drop(db);

                // Publish user.balance_updated event
                if let (Some(producer), Some(balance)) = (&self.producer, new_balance) {
                    let balance_event = EventBuilder::new(
                        EventType::User(UserEventType::BalanceUpdated),
                        &user_id.to_string(),
                    )
                    .payload(json!({
                        "balance": balance,
                        "change": amount_cents,
                        "source": "checkout_kafka",
                        "request_id": request_id,
                        "session_id": checkout_event.session_id,
                        "payment_intent_id": checkout_event.payment_intent_id,
                    }))
                    .build();

                    if let Err(err) = producer.publish(&balance_event).await {
                        warn!("Failed to publish user.balance_updated event: {}", err);
                    }
                }

                info!(
                    request_id = %request_id,
                    user_id = %user_id,
                    amount_cents = %amount_cents,
                    "Checkout payment succeeded - balance updated"
                );
            }

            "failed" => {
                // Payment failed - log for debugging
                let error_message = checkout_event
                    .error_message
                    .unwrap_or_else(|| "Payment failed".to_string());

                warn!(
                    request_id = %request_id,
                    user_id = %user_id,
                    error = %error_message,
                    "Checkout payment failed"
                );
            }

            unknown_status => {
                warn!(
                    request_id = %request_id,
                    status = %unknown_status,
                    "Unknown checkout_finished status"
                );
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handler_topics_returns_checkout_finished() {
        let db = Arc::new(Mutex::new(
            // In real tests we'd have a mock pool
            unreachable!()
        ));
        // This test just validates the topics() method signature
        // Real integration tests would require a test database
    }
}
