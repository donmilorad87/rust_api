//! Balance Controller
//!
//! Handles balance top-ups via checkout service (Kafka-driven).

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{error, warn};
use uuid::Uuid;
use validator::Validate;

use crate::app::checkout::{
    euros_to_cents, register_pending, remove_pending, CheckoutKafkaRequest,
};
use crate::app::http::api::controllers::responses::{
    BaseResponse, MissingFieldsResponse, ValidationErrorResponse,
};
use crate::app::http::api::validators::{BalanceCheckoutRequest, BalanceCheckoutRequestRaw};
use crate::config::AppConfig;
use crate::database::AppState;
use crate::events::topic;

/// Balance Controller
pub struct BalanceController;

#[derive(Debug, Serialize)]
pub struct CheckoutSessionResponse {
    #[serde(flatten)]
    pub base: BaseResponse,
    pub session_id: String,
    pub url: String,
}

impl BalanceController {
    /// POST /api/v1/balance/checkout - Create checkout session via Kafka
    ///
    /// This endpoint uses the `checkout` and `checkout_finished` Kafka topics.
    /// The checkout service creates a Stripe session and returns the URL.
    pub async fn create_checkout_session(
        state: web::Data<AppState>,
        req: HttpRequest,
        body: web::Json<BalanceCheckoutRequestRaw>,
    ) -> HttpResponse {
        // 1. Authenticate user
        let user_id = match req.extensions().get::<i64>() {
            Some(id) => *id,
            None => {
                return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
            }
        };

        // 2. Check event bus availability
        let event_bus = match state.event_bus() {
            Some(bus) => bus,
            None => {
                return HttpResponse::ServiceUnavailable()
                    .json(BaseResponse::error("Checkout service unavailable"));
            }
        };

        // 3. Validate request
        let raw = body.into_inner();
        let mut missing_fields = Vec::new();

        if raw.amount.is_none() {
            missing_fields.push("amount is required".to_string());
        }

        if !missing_fields.is_empty() {
            return HttpResponse::BadRequest().json(MissingFieldsResponse::new(missing_fields));
        }

        let request = BalanceCheckoutRequest {
            amount: raw.amount.unwrap(),
        };

        if let Err(validation_errors) = request.validate() {
            let mut errors: HashMap<String, Vec<String>> = HashMap::new();
            for (field, field_errors) in validation_errors.field_errors() {
                let messages: Vec<String> = field_errors
                    .iter()
                    .map(|e| {
                        e.message
                            .as_ref()
                            .map(|m| m.to_string())
                            .unwrap_or_else(|| e.code.to_string())
                    })
                    .collect();
                errors.insert(field.to_string(), messages);
            }

            return HttpResponse::BadRequest().json(ValidationErrorResponse::new(errors));
        }

        // 4. Convert amount to cents
        let amount_cents = match euros_to_cents(request.amount) {
            Ok(amount) => amount,
            Err(message) => {
                return HttpResponse::BadRequest().json(BaseResponse::error(message));
            }
        };

        // 5. Build URLs for Stripe redirect
        let app_url = AppConfig::app_url().trim_end_matches('/');
        let success_url = format!(
            "{}/balance?status=success&session_id={{CHECKOUT_SESSION_ID}}",
            app_url
        );
        let cancel_url = format!("{}/balance?status=cancel", app_url);

        // 6. Generate request ID and register pending request
        let request_id = Uuid::new_v4().to_string();
        let receiver = register_pending(request_id.clone()).await;

        // 7. Create the checkout request event for the new topic
        let checkout_request = CheckoutKafkaRequest::new(
            request_id.clone(),
            user_id,
            amount_cents,
            success_url,
            cancel_url,
        );

        // 8. Serialize and publish to "checkout" topic
        let payload = match serde_json::to_vec(&checkout_request) {
            Ok(payload) => payload,
            Err(err) => {
                remove_pending(&request_id).await;
                error!("Failed to serialize checkout request: {}", err);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Checkout request failed"));
            }
        };

        if let Err(err) = event_bus
            .producer()
            .send_raw(topic::CHECKOUT_REQUESTS, Some(&request_id), &payload)
            .await
        {
            remove_pending(&request_id).await;
            warn!("Failed to publish checkout request to topic: {}", err);
            return HttpResponse::BadGateway()
                .json(BaseResponse::error("Checkout service unavailable"));
        }

        // 9. Wait for response from checkout service (via checkout_finished handler)
        let response = match tokio::time::timeout(Duration::from_secs(15), receiver).await {
            Ok(Ok(response)) => response,
            Ok(Err(_)) => {
                return HttpResponse::BadGateway()
                    .json(BaseResponse::error("Checkout service failed"));
            }
            Err(_) => {
                remove_pending(&request_id).await;
                return HttpResponse::GatewayTimeout()
                    .json(BaseResponse::error("Checkout timed out"));
            }
        };

        // 10. Handle response
        if let Some(error_message) = response.error {
            warn!("Checkout session failed: {}", error_message);
            return HttpResponse::BadGateway().json(BaseResponse::error("Checkout failed"));
        }

        let session_id = match response.session_id {
            Some(session_id) => session_id,
            None => {
                return HttpResponse::BadGateway()
                    .json(BaseResponse::error("Checkout session missing"));
            }
        };

        let session_url = match response.session_url {
            Some(session_url) => session_url,
            None => {
                return HttpResponse::BadGateway()
                    .json(BaseResponse::error("Checkout session URL missing"));
            }
        };

        HttpResponse::Ok().json(CheckoutSessionResponse {
            base: BaseResponse::success("Checkout session created"),
            session_id,
            url: session_url,
        })
    }
}
