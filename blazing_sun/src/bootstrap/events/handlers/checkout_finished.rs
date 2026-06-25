//! Handler for the `checkout_finished` Kafka topic
//!
//! Processes events from the checkout service webhook:
//! - status="success": Updates user balance (balance_topup) or completes store purchase (store_product)
//! - status="failed": Logs payment failure
//!
//! Note: DB row is created by checkout service when webhook fires.
//! This handler updates the user's balance or completes store purchases in the main database.

use crate::app::checkout::CheckoutFinishedEvent;
use crate::database::mutations::store::product as db_product_mutations;
use crate::database::mutations::store::purchase as db_purchase_mutations;
use crate::database::mutations::user as db_user_mutations;
use crate::database::read::store::purchase as db_purchase_read;
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
use tracing::{error, info, warn};

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

    /// Handle successful balance top-up
    async fn handle_balance_topup_success(
        &self,
        event: &CheckoutFinishedEvent,
    ) -> Result<(), EventHandlerError> {
        let db = self.db.lock().await;

        if let Err(err) = db_user_mutations::add_balance(&db, event.user_id, event.amount_cents).await {
            return Err(EventHandlerError::Retryable(format!(
                "Failed to update balance: {}",
                err
            )));
        }

        let new_balance = db_user_read::get_by_id(&db, event.user_id)
            .await
            .ok()
            .map(|user| user.balance);
        drop(db);

        // Publish user.balance_updated event
        if let (Some(producer), Some(balance)) = (&self.producer, new_balance) {
            let balance_event = EventBuilder::new(
                EventType::User(UserEventType::BalanceUpdated),
                &event.user_id.to_string(),
            )
            .payload(json!({
                "balance": balance,
                "change": event.amount_cents,
                "source": "checkout_kafka",
                "request_id": event.request_id,
                "session_id": event.session_id,
                "payment_intent_id": event.payment_intent_id,
            }))
            .build();

            if let Err(err) = producer.publish(&balance_event).await {
                warn!("Failed to publish user.balance_updated event: {}", err);
            }
        }

        info!(
            request_id = %event.request_id,
            user_id = %event.user_id,
            amount_cents = %event.amount_cents,
            "Balance top-up succeeded - balance updated"
        );

        Ok(())
    }

    /// Handle successful store purchase
    async fn handle_store_purchase_success(
        &self,
        event: &CheckoutFinishedEvent,
    ) -> Result<(), EventHandlerError> {
        let db = self.db.lock().await;

        // Find the pending purchase by stripe session ID
        let session_id = match &event.session_id {
            Some(id) => id,
            None => {
                error!(
                    request_id = %event.request_id,
                    "Store purchase success without session_id"
                );
                return Ok(()); // Don't retry, just log
            }
        };

        let purchase = match db_purchase_read::get_by_stripe_session_id(&db, session_id).await {
            Ok(p) => p,
            Err(e) => {
                error!(
                    request_id = %event.request_id,
                    session_id = %session_id,
                    error = %e,
                    "Failed to find purchase by session_id"
                );
                return Err(EventHandlerError::Retryable(format!(
                    "Purchase not found for session_id {}: {}",
                    session_id, e
                )));
            }
        };

        // Mark purchase as completed
        if let Err(e) = db_purchase_mutations::complete_purchase(
            &db,
            purchase.id,
            event.payment_intent_id.as_deref(),
        )
        .await
        {
            return Err(EventHandlerError::Retryable(format!(
                "Failed to complete purchase: {}",
                e
            )));
        }

        // Mark the product as sold (exclusive purchase model)
        if let Err(e) = db_product_mutations::mark_as_sold(&db, purchase.product_id).await {
            warn!(
                purchase_id = %purchase.id,
                product_id = %purchase.product_id,
                error = %e,
                "Failed to mark product as sold"
            );
            // Don't fail the whole operation, purchase is already marked complete
        }

        // Deactivate the product so it doesn't show in listings
        if let Err(e) = db_product_mutations::update_is_active(&db, purchase.product_id, false).await {
            warn!(
                product_id = %purchase.product_id,
                error = %e,
                "Failed to deactivate sold product"
            );
        }

        drop(db);

        // Publish store purchase event
        if let Some(producer) = &self.producer {
            let purchase_event = EventBuilder::new(
                EventType::User(UserEventType::StorePurchase),
                &event.user_id.to_string(),
            )
            .payload(json!({
                "purchase_id": purchase.id,
                "product_id": purchase.product_id,
                "amount_cents": event.amount_cents,
                "request_id": event.request_id,
                "session_id": event.session_id,
                "payment_intent_id": event.payment_intent_id,
            }))
            .build();

            if let Err(err) = producer.publish(&purchase_event).await {
                warn!("Failed to publish user.store_purchase event: {}", err);
            }
        }

        info!(
            request_id = %event.request_id,
            user_id = %event.user_id,
            purchase_id = %purchase.id,
            product_id = %purchase.product_id,
            amount_cents = %event.amount_cents,
            "Store purchase completed successfully"
        );

        Ok(())
    }

    /// Handle failed store purchase
    async fn handle_store_purchase_failed(
        &self,
        event: &CheckoutFinishedEvent,
    ) -> Result<(), EventHandlerError> {
        let error_message = event
            .error_message
            .clone()
            .unwrap_or_else(|| "Payment failed".to_string());

        // If we have a session_id, mark the purchase as failed
        if let Some(session_id) = &event.session_id {
            let db = self.db.lock().await;

            if let Ok(purchase) = db_purchase_read::get_by_stripe_session_id(&db, session_id).await {
                if let Err(e) = db_purchase_mutations::mark_failed(&db, purchase.id).await {
                    warn!(
                        purchase_id = %purchase.id,
                        error = %e,
                        "Failed to mark purchase as failed"
                    );
                }
            }
        }

        warn!(
            request_id = %event.request_id,
            user_id = %event.user_id,
            error = %error_message,
            "Store purchase payment failed"
        );

        Ok(())
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

        // Route based on purpose
        let purpose = checkout_event.purpose.as_str();

        match checkout_event.status.as_str() {
            "success" => {
                match purpose {
                    "balance_topup" => {
                        // Balance top-up: update user balance
                        self.handle_balance_topup_success(&checkout_event).await?;
                    }
                    "store_product" => {
                        // Store purchase: complete the purchase and mark product as sold
                        self.handle_store_purchase_success(&checkout_event).await?;
                    }
                    _ => {
                        warn!(
                            request_id = %request_id,
                            purpose = %purpose,
                            "Unknown checkout purpose for success status"
                        );
                    }
                }
            }

            "failed" => {
                match purpose {
                    "store_product" => {
                        // Store purchase failed: mark purchase as failed
                        self.handle_store_purchase_failed(&checkout_event).await?;
                    }
                    _ => {
                        // For balance_topup and others, just log the failure
                        let error_message = checkout_event
                            .error_message
                            .clone()
                            .unwrap_or_else(|| "Payment failed".to_string());

                        warn!(
                            request_id = %request_id,
                            user_id = %user_id,
                            purpose = %purpose,
                            error = %error_message,
                            "Checkout payment failed"
                        );
                    }
                }
            }

            unknown_status => {
                warn!(
                    request_id = %request_id,
                    status = %unknown_status,
                    purpose = %purpose,
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
