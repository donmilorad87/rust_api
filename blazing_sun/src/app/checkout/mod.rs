use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use tokio::sync::{oneshot, Mutex};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CheckoutCommand {
    #[serde(rename = "checkout.command.create_session")]
    CreateSession {
        request_id: String,
        service_token: String,
        user_id: i64,
        amount_cents: i64,
        currency: String,
        success_url: String,
        cancel_url: String,
        purpose: String,
        metadata: Value,
        requested_at: String,
        customer_email: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CheckoutEvent {
    #[serde(rename = "checkout.event.session_created")]
    SessionCreated {
        request_id: String,
        user_id: i64,
        amount_cents: i64,
        currency: String,
        session_id: String,
        session_url: String,
        purpose: String,
        metadata: Value,
        created_at: String,
    },
    #[serde(rename = "checkout.event.session_failed")]
    SessionFailed {
        request_id: String,
        user_id: i64,
        amount_cents: i64,
        currency: String,
        error: String,
        purpose: String,
        failed_at: String,
    },
    #[serde(rename = "checkout.event.payment_succeeded")]
    PaymentSucceeded {
        request_id: String,
        user_id: i64,
        amount_cents: i64,
        currency: String,
        session_id: String,
        payment_intent_id: Option<String>,
        purpose: String,
        metadata: Value,
        paid_at: String,
    },
    #[serde(rename = "checkout.event.payment_failed")]
    PaymentFailed {
        request_id: String,
        user_id: i64,
        amount_cents: i64,
        currency: String,
        session_id: Option<String>,
        error: String,
        purpose: String,
        failed_at: String,
    },
}

// ============================================================================
// New Checkout Flow Types (checkout and checkout_finished topics)
// ============================================================================

/// Event published to "checkout" topic when user initiates payment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoutKafkaRequest {
    /// Unique request identifier for correlation
    pub request_id: String,
    /// User initiating the checkout
    pub user_id: i64,
    /// Amount in cents (e.g., 500 = 5.00 EUR)
    pub amount_cents: i64,
    /// Currency code (default: "eur")
    pub currency: String,
    /// Purpose of the checkout (default: "balance_topup")
    pub purpose: String,
    /// ISO 8601 timestamp when request was made
    pub timestamp: String,
    /// Success redirect URL
    pub success_url: String,
    /// Cancel redirect URL
    pub cancel_url: String,
}

impl CheckoutKafkaRequest {
    /// Create a new checkout request with defaults
    pub fn new(
        request_id: String,
        user_id: i64,
        amount_cents: i64,
        success_url: String,
        cancel_url: String,
    ) -> Self {
        Self {
            request_id,
            user_id,
            amount_cents,
            currency: "eur".to_string(),
            purpose: "balance_topup".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            success_url,
            cancel_url,
        }
    }
}

/// Event received from "checkout_finished" topic
/// Received in three scenarios:
/// - status="session_created": Stripe session created (includes session_url for redirect)
/// - status="success": Payment succeeded (update user balance)
/// - status="failed": Payment failed (log warning)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoutFinishedEvent {
    /// Unique request identifier for correlation
    pub request_id: String,
    /// User who initiated the checkout
    pub user_id: i64,
    /// Amount in cents
    pub amount_cents: i64,
    /// Currency code
    pub currency: String,
    /// Purpose of the checkout
    pub purpose: String,
    /// Payment status: "session_created", "success", or "failed"
    pub status: String,
    /// Stripe session ID (if available)
    pub session_id: Option<String>,
    /// Stripe session URL for redirect (only for status="session_created")
    pub session_url: Option<String>,
    /// Stripe payment intent ID (if available)
    pub payment_intent_id: Option<String>,
    /// Error message (if failed)
    pub error_message: Option<String>,
    /// ISO 8601 timestamp when checkout finished
    pub timestamp: String,
}

impl CheckoutFinishedEvent {
    /// Check if the checkout session was created successfully
    pub fn is_session_created(&self) -> bool {
        self.status == "session_created"
    }

    /// Check if the payment was successful
    pub fn is_success(&self) -> bool {
        self.status == "success"
    }

    /// Check if the payment failed
    pub fn is_failed(&self) -> bool {
        self.status == "failed"
    }
}

#[derive(Debug, Clone)]
pub struct CheckoutSessionResult {
    pub session_id: Option<String>,
    pub session_url: Option<String>,
    pub error: Option<String>,
}

impl CheckoutSessionResult {
    pub fn success(session_id: String, session_url: String) -> Self {
        Self {
            session_id: Some(session_id),
            session_url: Some(session_url),
            error: None,
        }
    }

    pub fn failure(error: String) -> Self {
        Self {
            session_id: None,
            session_url: None,
            error: Some(error),
        }
    }
}

static PENDING_CHECKOUTS: Lazy<Mutex<HashMap<String, oneshot::Sender<CheckoutSessionResult>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub async fn register_pending(request_id: String) -> oneshot::Receiver<CheckoutSessionResult> {
    let (tx, rx) = oneshot::channel();
    let mut pending = PENDING_CHECKOUTS.lock().await;
    pending.insert(request_id, tx);
    rx
}

pub async fn fulfill_pending(
    request_id: &str,
    result: CheckoutSessionResult,
) -> Option<CheckoutSessionResult> {
    let sender = {
        let mut pending = PENDING_CHECKOUTS.lock().await;
        pending.remove(request_id)
    };

    if let Some(sender) = sender {
        let _ = sender.send(result);
        return None;
    }

    Some(result)
}

pub async fn remove_pending(request_id: &str) -> bool {
    let mut pending = PENDING_CHECKOUTS.lock().await;
    pending.remove(request_id).is_some()
}

pub fn euros_to_cents(amount_eur: i64) -> Result<i64, &'static str> {
    if amount_eur <= 0 {
        return Err("amount must be positive");
    }

    amount_eur
        .checked_mul(100)
        .ok_or("amount is too large")
}

#[cfg(test)]
mod tests {
    use super::{CheckoutCommand, CheckoutEvent, euros_to_cents};
    use serde_json::json;

    #[test]
    fn checkout_command_serializes_type() {
        let command = CheckoutCommand::CreateSession {
            request_id: "req_123".to_string(),
            service_token: "svc_token".to_string(),
            user_id: 9,
            amount_cents: 1200,
            currency: "eur".to_string(),
            success_url: "https://example.com/success".to_string(),
            cancel_url: "https://example.com/cancel".to_string(),
            purpose: "balance_topup".to_string(),
            metadata: json!({"source": "balance"}),
            requested_at: "2024-01-01T00:00:00Z".to_string(),
            customer_email: None,
        };

        let value = serde_json::to_value(command).expect("serialize command");
        assert_eq!(
            value.get("type").and_then(|val| val.as_str()),
            Some("checkout.command.create_session")
        );
        assert_eq!(value.get("amount_cents").and_then(|val| val.as_i64()), Some(1200));
        assert_eq!(
            value.get("service_token").and_then(|val| val.as_str()),
            Some("svc_token")
        );
    }

    #[test]
    fn checkout_event_deserializes_session_created() {
        let payload = json!({
            "type": "checkout.event.session_created",
            "request_id": "req_abc",
            "user_id": 7,
            "amount_cents": 500,
            "currency": "eur",
            "session_id": "cs_test_123",
            "session_url": "https://stripe.test/checkout",
            "purpose": "balance_topup",
            "metadata": {"coins": 5},
            "created_at": "2024-01-01T00:00:00Z"
        });

        let event: CheckoutEvent =
            serde_json::from_value(payload).expect("deserialize session_created");

        match event {
            CheckoutEvent::SessionCreated { request_id, amount_cents, session_id, .. } => {
                assert_eq!(request_id, "req_abc");
                assert_eq!(amount_cents, 500);
                assert_eq!(session_id, "cs_test_123");
            }
            _ => panic!("unexpected event variant"),
        }
    }

    #[test]
    fn euros_to_cents_converts_positive_amounts() {
        assert_eq!(euros_to_cents(1).unwrap(), 100);
        assert_eq!(euros_to_cents(15).unwrap(), 1500);
    }

    #[test]
    fn euros_to_cents_rejects_non_positive_amounts() {
        assert!(euros_to_cents(0).is_err());
        assert!(euros_to_cents(-4).is_err());
    }
}
