use serde::{Deserialize, Serialize};
use serde_json::Value;

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

/// Incoming event from rust-app on the "checkout" topic
/// This is published when user clicks "Continue to Stripe" on the balance page
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoutRequestEvent {
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

/// Outgoing event to rust-app on the "checkout_finished" topic
/// Published in three scenarios:
/// - status="session_created": Immediately after Stripe session is created (includes session_url)
/// - status="success": After Stripe webhook confirms payment succeeded
/// - status="failed": After Stripe webhook indicates payment failed
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

impl CheckoutRequestEvent {
    /// Create a new checkout request event with defaults
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

impl CheckoutFinishedEvent {
    /// Create a session_created event (includes session_url for redirect)
    pub fn session_created(
        request_id: String,
        user_id: i64,
        amount_cents: i64,
        currency: String,
        purpose: String,
        session_id: String,
        session_url: String,
    ) -> Self {
        Self {
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            status: "session_created".to_string(),
            session_id: Some(session_id),
            session_url: Some(session_url),
            payment_intent_id: None,
            error_message: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Create a success event (after payment webhook)
    pub fn success(
        request_id: String,
        user_id: i64,
        amount_cents: i64,
        currency: String,
        purpose: String,
        session_id: Option<String>,
        payment_intent_id: Option<String>,
    ) -> Self {
        Self {
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            status: "success".to_string(),
            session_id,
            session_url: None,
            payment_intent_id,
            error_message: None,
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }

    /// Create a failed event
    pub fn failed(
        request_id: String,
        user_id: i64,
        amount_cents: i64,
        currency: String,
        purpose: String,
        session_id: Option<String>,
        error_message: String,
    ) -> Self {
        Self {
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            status: "failed".to_string(),
            session_id,
            session_url: None,
            payment_intent_id: None,
            error_message: Some(error_message),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{CheckoutCommand, CheckoutEvent, CheckoutFinishedEvent, CheckoutRequestEvent};
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
    fn checkout_event_deserializes_payment_succeeded() {
        let payload = json!({
            "type": "checkout.event.payment_succeeded",
            "request_id": "req_abc",
            "user_id": 7,
            "amount_cents": 500,
            "currency": "eur",
            "session_id": "cs_test_123",
            "payment_intent_id": "pi_test_456",
            "purpose": "balance_topup",
            "metadata": {"coins": 5},
            "paid_at": "2024-01-01T00:00:00Z"
        });

        let event: CheckoutEvent =
            serde_json::from_value(payload).expect("deserialize payment_succeeded");

        match event {
            CheckoutEvent::PaymentSucceeded { request_id, amount_cents, session_id, .. } => {
                assert_eq!(request_id, "req_abc");
                assert_eq!(amount_cents, 500);
                assert_eq!(session_id, "cs_test_123");
            }
            _ => panic!("unexpected event variant"),
        }
    }

    #[test]
    fn checkout_request_event_serializes() {
        let event = CheckoutRequestEvent {
            request_id: "req_new_123".to_string(),
            user_id: 42,
            amount_cents: 1000,
            currency: "eur".to_string(),
            purpose: "balance_topup".to_string(),
            timestamp: "2024-01-01T12:00:00Z".to_string(),
            success_url: "https://example.com/success".to_string(),
            cancel_url: "https://example.com/cancel".to_string(),
        };

        let json_str = serde_json::to_string(&event).expect("serialize");
        let parsed: CheckoutRequestEvent = serde_json::from_str(&json_str).expect("deserialize");

        assert_eq!(parsed.request_id, "req_new_123");
        assert_eq!(parsed.user_id, 42);
        assert_eq!(parsed.amount_cents, 1000);
        assert_eq!(parsed.currency, "eur");
    }

    #[test]
    fn checkout_finished_event_success() {
        let event = CheckoutFinishedEvent::success(
            "req_456".to_string(),
            99,
            2500,
            "eur".to_string(),
            "balance_topup".to_string(),
            Some("cs_test_session".to_string()),
            Some("pi_test_intent".to_string()),
        );

        assert_eq!(event.status, "success");
        assert_eq!(event.user_id, 99);
        assert_eq!(event.amount_cents, 2500);
        assert!(event.error_message.is_none());

        let json_str = serde_json::to_string(&event).expect("serialize");
        let parsed: CheckoutFinishedEvent = serde_json::from_str(&json_str).expect("deserialize");
        assert_eq!(parsed.status, "success");
    }

    #[test]
    fn checkout_finished_event_failed() {
        let event = CheckoutFinishedEvent::failed(
            "req_789".to_string(),
            55,
            500,
            "eur".to_string(),
            "balance_topup".to_string(),
            Some("cs_test_failed".to_string()),
            "Card declined".to_string(),
        );

        assert_eq!(event.status, "failed");
        assert_eq!(event.user_id, 55);
        assert_eq!(event.error_message, Some("Card declined".to_string()));
        assert!(event.payment_intent_id.is_none());
    }
}
