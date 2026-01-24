use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::{oneshot, Mutex};

// ============================================================================
// Checkout Flow Types (checkout and checkout_finished topics)
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
    use super::{CheckoutFinishedEvent, CheckoutKafkaRequest, euros_to_cents};

    #[test]
    fn checkout_request_serializes_correctly() {
        let request = CheckoutKafkaRequest::new(
            "req_123".to_string(),
            9,
            1200,
            "https://example.com/success".to_string(),
            "https://example.com/cancel".to_string(),
        );

        let value = serde_json::to_value(&request).expect("serialize request");
        assert_eq!(
            value.get("request_id").and_then(|val| val.as_str()),
            Some("req_123")
        );
        assert_eq!(value.get("user_id").and_then(|val| val.as_i64()), Some(9));
        assert_eq!(
            value.get("amount_cents").and_then(|val| val.as_i64()),
            Some(1200)
        );
        assert_eq!(
            value.get("currency").and_then(|val| val.as_str()),
            Some("eur")
        );
        assert_eq!(
            value.get("purpose").and_then(|val| val.as_str()),
            Some("balance_topup")
        );
    }

    #[test]
    fn checkout_finished_deserializes_session_created() {
        let payload = serde_json::json!({
            "request_id": "req_abc",
            "user_id": 7,
            "amount_cents": 500,
            "currency": "eur",
            "purpose": "balance_topup",
            "status": "session_created",
            "session_id": "cs_test_123",
            "session_url": "https://stripe.test/checkout",
            "payment_intent_id": null,
            "error_message": null,
            "timestamp": "2024-01-01T00:00:00Z"
        });

        let event: CheckoutFinishedEvent =
            serde_json::from_value(payload).expect("deserialize session_created");

        assert_eq!(event.request_id, "req_abc");
        assert_eq!(event.amount_cents, 500);
        assert_eq!(event.session_id, Some("cs_test_123".to_string()));
        assert!(event.is_session_created());
        assert!(!event.is_success());
        assert!(!event.is_failed());
    }

    #[test]
    fn checkout_finished_deserializes_success() {
        let payload = serde_json::json!({
            "request_id": "req_def",
            "user_id": 8,
            "amount_cents": 1000,
            "currency": "eur",
            "purpose": "balance_topup",
            "status": "success",
            "session_id": "cs_test_456",
            "session_url": null,
            "payment_intent_id": "pi_test_789",
            "error_message": null,
            "timestamp": "2024-01-01T00:00:00Z"
        });

        let event: CheckoutFinishedEvent =
            serde_json::from_value(payload).expect("deserialize success");

        assert!(event.is_success());
        assert!(!event.is_session_created());
        assert!(!event.is_failed());
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
