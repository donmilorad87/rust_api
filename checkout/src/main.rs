use actix_web::{web, App, HttpRequest, HttpResponse, HttpServer};
use chrono::Utc;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{CommitMode, Consumer, StreamConsumer};
use rdkafka::message::BorrowedMessage;
use rdkafka::Message;
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::util::Timeout;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::time::Duration;
use std::{env, sync::Arc};
use tracing::{error, info, warn};
use uuid::Uuid;

mod db;
mod auth;
mod stripe;
mod types;

use auth::{decode_token, extract_token};
use types::{CheckoutCommand, CheckoutEvent, CheckoutFinishedEvent, CheckoutRequestEvent};

// Existing topics (checkout.commands/checkout.events flow)
const CHECKOUT_COMMANDS_TOPIC: &str = "checkout.commands";
const CHECKOUT_EVENTS_TOPIC: &str = "checkout.events";

// New topics (checkout/checkout_finished flow)
const CHECKOUT_TOPIC: &str = "checkout";
const CHECKOUT_FINISHED_TOPIC: &str = "checkout_finished";

#[derive(Clone)]
struct AppConfig {
    host: String,
    port: u16,
    kafka_bootstrap: String,
    kafka_group_id: String,
    stripe_secret: String,
    stripe_webhook_secret: String,
    jwt_secret: String,
    service_token: String,
    database_url: String,
}

impl AppConfig {
    fn from_env() -> Self {
        let host = env::var("CHECKOUT_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("CHECKOUT_PORT")
            .unwrap_or_else(|_| "9996".to_string())
            .parse()
            .unwrap_or(9996);

        let kafka_host = env::var("KAFKA_HOST").unwrap_or_else(|_| "kafka".to_string());
        let kafka_port = env::var("KAFKA_PORT").unwrap_or_else(|_| "9092".to_string());
        let kafka_bootstrap = format!("{}:{}", kafka_host, kafka_port);

        let kafka_group_id =
            env::var("CHECKOUT_KAFKA_GROUP").unwrap_or_else(|_| "checkout-service".to_string());

        let stripe_secret = env::var("STRIPE_SECRET").unwrap_or_default();
        let stripe_webhook_secret = env::var("STRIPE_WEBHOOK_SECRET").unwrap_or_default();
        let jwt_secret = env::var("JWT_SECRET").unwrap_or_default();
        let service_token = env::var("CHECKOUT_SERVICE_TOKEN").unwrap_or_default();

        let database_url = env::var("CHECKOUT_DATABASE_URL").unwrap_or_else(|_| {
            let db_host =
                env::var("CHECKOUT_DB_HOST").unwrap_or_else(|_| "checkout-postgres".to_string());
            let db_port = env::var("CHECKOUT_DB_PORT").unwrap_or_else(|_| "5433".to_string());
            let db_user = env::var("CHECKOUT_DB_USER").unwrap_or_else(|_| "checkout".to_string());
            let db_password = env::var("CHECKOUT_DB_PASSWORD").unwrap_or_default();
            let db_name = env::var("CHECKOUT_DB_NAME").unwrap_or_else(|_| "checkout".to_string());

            if db_password.is_empty() {
                format!("postgres://{}@{}:{}/{}", db_user, db_host, db_port, db_name)
            } else {
                format!(
                    "postgres://{}:{}@{}:{}/{}",
                    db_user, db_password, db_host, db_port, db_name
                )
            }
        });

        Self {
            host,
            port,
            kafka_bootstrap,
            kafka_group_id,
            stripe_secret,
            stripe_webhook_secret,
            jwt_secret,
            service_token,
            database_url,
        }
    }
}

#[derive(Clone)]
struct KafkaProducer {
    producer: FutureProducer,
}

impl KafkaProducer {
    fn new(bootstrap: &str) -> Result<Self, rdkafka::error::KafkaError> {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", bootstrap)
            .set("message.timeout.ms", "5000")
            .set("acks", "all")
            .set("retries", "3")
            .set("enable.idempotence", "true")
            .set("compression.type", "lz4")
            .set("linger.ms", "5")
            .create()?;

        Ok(Self { producer })
    }

    async fn send_event(
        &self,
        event: &CheckoutEvent,
        key: Option<&str>,
    ) -> Result<(), String> {
        let payload = serde_json::to_vec(event).map_err(|e| e.to_string())?;
        let mut record = FutureRecord::to(CHECKOUT_EVENTS_TOPIC).payload(&payload);

        if let Some(k) = key {
            record = record.key(k);
        }

        self.producer
            .send(record, Timeout::After(Duration::from_secs(5)))
            .await
            .map(|_| ())
            .map_err(|(err, _)| err.to_string())
    }

    /// Send a CheckoutFinishedEvent to the checkout_finished topic
    async fn send_finished_event(
        &self,
        event: &CheckoutFinishedEvent,
        key: Option<&str>,
    ) -> Result<(), String> {
        let payload = serde_json::to_vec(event).map_err(|e| e.to_string())?;
        let mut record = FutureRecord::to(CHECKOUT_FINISHED_TOPIC).payload(&payload);

        if let Some(k) = key {
            record = record.key(k);
        }

        self.producer
            .send(record, Timeout::After(Duration::from_secs(5)))
            .await
            .map(|_| ())
            .map_err(|(err, _)| err.to_string())
    }
}

#[derive(Clone)]
struct ServiceState {
    producer: KafkaProducer,
    stripe_secret: String,
    stripe_webhook_secret: String,
    http_client: reqwest::Client,
    jwt_secret: String,
    service_token: String,
    db: PgPool,
}

#[derive(Serialize)]
struct BaseResponse {
    status: String,
    message: String,
}

impl BaseResponse {
    fn success(message: &str) -> Self {
        Self {
            status: "success".to_string(),
            message: message.to_string(),
        }
    }

    fn error(message: &str) -> Self {
        Self {
            status: "error".to_string(),
            message: message.to_string(),
        }
    }
}

#[derive(Debug, Serialize, serde::Deserialize)]
struct StripeCheckoutSession {
    id: String,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CheckoutSessionRequest {
    amount: i64,
}

#[derive(Debug, Deserialize)]
struct TransactionsQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Serialize)]
struct CheckoutSessionResponse {
    #[serde(flatten)]
    base: BaseResponse,
    session_id: String,
    url: String,
}

#[derive(Serialize)]
struct TransactionsResponse {
    #[serde(flatten)]
    base: BaseResponse,
    transactions: Vec<db::CheckoutTransaction>,
}

fn command_service_token(command: &CheckoutCommand) -> &str {
    match command {
        CheckoutCommand::CreateSession { service_token, .. } => service_token,
    }
}

fn validate_service_token_value(expected: &str, actual: &str) -> Result<(), String> {
    if expected.is_empty() {
        return Err("Checkout service token not configured".to_string());
    }

    if actual != expected {
        return Err("Invalid service token".to_string());
    }

    Ok(())
}

fn validate_service_token(state: &ServiceState, command: &CheckoutCommand) -> Result<(), String> {
    validate_service_token_value(&state.service_token, command_service_token(command))
}

fn request_base_url(req: &HttpRequest) -> String {
    let info = req.connection_info();
    format!("{}://{}", info.scheme(), info.host())
}

fn build_balance_urls(base_url: &str) -> (String, String) {
    let base = base_url.trim_end_matches('/');
    let success_url = format!(
        "{}/balance?status=success&session_id={{CHECKOUT_SESSION_ID}}",
        base
    );
    let cancel_url = format!("{}/balance?status=cancel", base);
    (success_url, cancel_url)
}

fn parse_i64_value(value: &Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_str().and_then(|val| val.parse::<i64>().ok()))
}

fn metadata_value<'a>(session: &'a Value, key: &str) -> Option<&'a Value> {
    session
        .get("metadata")
        .and_then(|meta| meta.as_object())
        .and_then(|meta| meta.get(key))
}

fn metadata_string(session: &Value, key: &str) -> Option<String> {
    metadata_value(session, key).and_then(|value| {
        value
            .as_str()
            .map(|val| val.to_string())
            .or_else(|| value.as_i64().map(|val| val.to_string()))
    })
}

fn metadata_i64(session: &Value, key: &str) -> Option<i64> {
    metadata_value(session, key).and_then(parse_i64_value)
}

fn parse_user_id(session: &Value) -> Option<i64> {
    metadata_i64(session, "user_id")
        .or_else(|| session.get("client_reference_id").and_then(parse_i64_value))
}

fn parse_request_id(session: &Value) -> Option<String> {
    metadata_string(session, "request_id")
}

fn parse_amount_cents(session: &Value) -> Option<i64> {
    metadata_i64(session, "amount_cents")
        .or_else(|| session.get("amount_total").and_then(parse_i64_value))
}

fn parse_currency(session: &Value) -> Option<String> {
    session
        .get("currency")
        .and_then(|value| value.as_str())
        .map(|val| val.to_string())
        .or_else(|| metadata_string(session, "currency"))
}

fn parse_purpose(session: &Value) -> Option<String> {
    metadata_string(session, "purpose")
}

fn metadata_to_params(metadata: &Value, params: &mut Vec<(String, String)>) {
    let Some(meta_obj) = metadata.as_object() else {
        return;
    };

    for (key, value) in meta_obj {
        let string_value = value
            .as_str()
            .map(|val| val.to_string())
            .or_else(|| value.as_i64().map(|val| val.to_string()))
            .or_else(|| value.as_f64().map(|val| val.to_string()));

        if let Some(string_value) = string_value {
            params.push((format!("metadata[{}]", key), string_value));
        }
    }
}

fn metadata_product_label(metadata: &Value, key: &str) -> Option<String> {
    metadata
        .get(key)
        .and_then(|value| value.as_str())
        .map(|val| val.to_string())
}

async fn create_checkout_session(
    state: &ServiceState,
    command: &CheckoutCommand,
) -> Result<StripeCheckoutSession, String> {
    let CheckoutCommand::CreateSession {
        request_id,
        user_id,
        amount_cents,
        currency,
        success_url,
        cancel_url,
        purpose,
        metadata,
        customer_email,
        ..
    } = command;

    if state.stripe_secret.is_empty() {
        return Err("Stripe secret key is not configured".to_string());
    }

    if *amount_cents <= 0 {
        return Err("Amount must be positive".to_string());
    }

    let product_name = metadata_product_label(metadata, "product_name")
        .unwrap_or_else(|| "Checkout".to_string());
    let description = metadata_product_label(metadata, "description")
        .unwrap_or_else(|| format!("Payment for {}", purpose));

    let mut params: Vec<(String, String)> = vec![
        ("mode".to_string(), "payment".to_string()),
        ("success_url".to_string(), success_url.clone()),
        ("cancel_url".to_string(), cancel_url.clone()),
        ("payment_method_types[0]".to_string(), "card".to_string()),
        (
            "line_items[0][price_data][currency]".to_string(),
            currency.clone(),
        ),
        (
            "line_items[0][price_data][product_data][name]".to_string(),
            product_name,
        ),
        (
            "line_items[0][price_data][product_data][description]".to_string(),
            description,
        ),
        (
            "line_items[0][price_data][unit_amount]".to_string(),
            amount_cents.to_string(),
        ),
        ("line_items[0][quantity]".to_string(), "1".to_string()),
        ("client_reference_id".to_string(), user_id.to_string()),
        ("metadata[user_id]".to_string(), user_id.to_string()),
        (
            "metadata[amount_cents]".to_string(),
            amount_cents.to_string(),
        ),
        ("metadata[request_id]".to_string(), request_id.to_string()),
        ("metadata[purpose]".to_string(), purpose.to_string()),
        ("metadata[currency]".to_string(), currency.to_string()),
    ];

    metadata_to_params(metadata, &mut params);

    if let Some(email) = customer_email.as_ref().filter(|val| !val.is_empty()) {
        params.push(("customer_email".to_string(), email.to_string()));
    }

    let response = state
        .http_client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .bearer_auth(&state.stripe_secret)
        .form(&params)
        .send()
        .await
        .map_err(|err| format!("Stripe request failed: {}", err))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Stripe session creation failed: {} {}", status, body));
    }

    let session: StripeCheckoutSession = response
        .json()
        .await
        .map_err(|err| format!("Stripe response invalid: {}", err))?;

    Ok(session)
}

async fn handle_command(state: &ServiceState, command: CheckoutCommand) {
    let request_id = match &command {
        CheckoutCommand::CreateSession { request_id, .. } => request_id.clone(),
    };
    let metadata = match &command {
        CheckoutCommand::CreateSession { metadata, .. } => metadata.clone(),
    };
    let (user_id, amount_cents, currency, purpose) = match &command {
        CheckoutCommand::CreateSession {
            user_id,
            amount_cents,
            currency,
            purpose,
            ..
        } => (*user_id, *amount_cents, currency.clone(), purpose.clone()),
    };

    let event = match create_checkout_session(state, &command).await {
        Ok(session) => {
            if let Err(err) = db::upsert_session_created(
                &state.db,
                &request_id,
                user_id,
                amount_cents,
                &currency,
                &purpose,
                &session.id,
                session.url.as_deref(),
                &metadata,
            )
            .await
            {
                warn!("Failed to record checkout session: {}", err);
            }

            CheckoutEvent::SessionCreated {
                request_id: request_id.clone(),
                user_id,
                amount_cents,
                currency,
                session_id: session.id,
                session_url: session.url.unwrap_or_default(),
                purpose,
                metadata,
                created_at: Utc::now().to_rfc3339(),
            }
        }
        Err(error_message) => {
            if let Err(err) = db::upsert_session_failed(
                &state.db,
                &request_id,
                user_id,
                amount_cents,
                &currency,
                &purpose,
                &error_message,
                &metadata,
            )
            .await
            {
                warn!("Failed to record checkout failure: {}", err);
            }

            CheckoutEvent::SessionFailed {
                request_id: request_id.clone(),
                user_id,
                amount_cents,
                currency,
                error: error_message,
                purpose,
                failed_at: Utc::now().to_rfc3339(),
            }
        }
    };

    if let Err(err) = state.producer.send_event(&event, Some(&request_id)).await {
        warn!("Failed to publish checkout event: {}", err);
    }
}

/// Handle a checkout request from the new "checkout" topic
/// Creates a Stripe session and publishes result to "checkout_finished" topic
async fn handle_checkout_request(state: &ServiceState, request: CheckoutRequestEvent) {
    let request_id = request.request_id.clone();
    let user_id = request.user_id;
    let amount_cents = request.amount_cents;
    let currency = request.currency.clone();
    let purpose = request.purpose.clone();

    // Convert CheckoutRequestEvent to CheckoutCommand for reuse of create_checkout_session
    let metadata = json!({
        "coins": amount_cents / 100,
        "balance_cents": amount_cents,
        "product_name": "Coins",
        "description": "Account top-up",
        "source": "balance_kafka",
    });

    let command = CheckoutCommand::CreateSession {
        request_id: request_id.clone(),
        service_token: state.service_token.clone(), // We validate internally
        user_id,
        amount_cents,
        currency: currency.clone(),
        success_url: request.success_url.clone(),
        cancel_url: request.cancel_url.clone(),
        purpose: purpose.clone(),
        metadata: metadata.clone(),
        requested_at: request.timestamp.clone(),
        customer_email: None,
    };

    // Create Stripe session - don't store in DB yet, wait for webhook
    match create_checkout_session(state, &command).await {
        Ok(session) => {
            let session_url = session.url.clone().unwrap_or_default();

            // Don't create DB row or publish checkout_finished here
            // DB row and checkout_finished event are created when webhook fires
            info!(
                request_id = %request_id,
                user_id = %user_id,
                session_id = %session.id,
                "Stripe session created via Kafka flow, awaiting webhook for payment completion"
            );

            // Note: If using this Kafka flow, the caller needs another way to get the URL
            // The recommended approach is to use the HTTP endpoint directly which returns the URL
            let _ = session_url; // URL is created but not published - use HTTP flow instead
        }
        Err(error_message) => {
            // Log failure but don't create DB row
            warn!(
                request_id = %request_id,
                user_id = %user_id,
                error = %error_message,
                "Failed to create Stripe session via Kafka flow"
            );
        }
    }
}

/// Process a message from the "checkout" topic (new flow)
async fn process_checkout_request(
    state: &ServiceState,
    msg: &BorrowedMessage<'_>,
) -> Result<(), String> {
    let payload = msg.payload().ok_or_else(|| "Empty payload".to_string())?;
    let request: CheckoutRequestEvent =
        serde_json::from_slice(payload).map_err(|err| err.to_string())?;

    info!(
        request_id = %request.request_id,
        user_id = %request.user_id,
        amount_cents = %request.amount_cents,
        "Processing checkout request from checkout topic"
    );

    handle_checkout_request(state, request).await;
    Ok(())
}

async fn process_message(
    state: &ServiceState,
    msg: &BorrowedMessage<'_>,
) -> Result<(), String> {
    let payload = msg.payload().ok_or_else(|| "Empty payload".to_string())?;
    let command: CheckoutCommand =
        serde_json::from_slice(payload).map_err(|err| err.to_string())?;

    if let Err(error_message) = validate_service_token(state, &command) {
        warn!("Rejected checkout command: {}", error_message);

        if let CheckoutCommand::CreateSession {
            request_id,
            user_id,
            amount_cents,
            currency,
            purpose,
            ..
        } = &command
        {
            let event = CheckoutEvent::SessionFailed {
                request_id: request_id.clone(),
                user_id: *user_id,
                amount_cents: *amount_cents,
                currency: currency.clone(),
                error: error_message.clone(),
                purpose: purpose.clone(),
                failed_at: Utc::now().to_rfc3339(),
            };

            if let Err(err) = state.producer.send_event(&event, Some(request_id)).await {
                warn!("Failed to publish checkout auth failure: {}", err);
            }
        }

        return Ok(());
    }

    match command {
        CheckoutCommand::CreateSession { .. } => {
            handle_command(state, command).await;
        }
    }

    Ok(())
}

async fn run_consumer(state: Arc<ServiceState>, config: &AppConfig) -> Result<(), String> {
    let consumer: StreamConsumer = ClientConfig::new()
        .set("bootstrap.servers", &config.kafka_bootstrap)
        .set("group.id", &config.kafka_group_id)
        .set("auto.offset.reset", "earliest")
        .set("enable.auto.commit", "true")
        .set("session.timeout.ms", "30000")
        .create()
        .map_err(|err| err.to_string())?;

    // Subscribe to both old and new checkout topics
    consumer
        .subscribe(&[CHECKOUT_COMMANDS_TOPIC, CHECKOUT_TOPIC])
        .map_err(|err| err.to_string())?;

    info!(
        "Checkout consumer subscribed to {} and {}",
        CHECKOUT_COMMANDS_TOPIC, CHECKOUT_TOPIC
    );

    loop {
        match consumer.recv().await {
            Ok(msg) => {
                let topic = msg.topic();

                let result = if topic == CHECKOUT_TOPIC {
                    // New flow: checkout -> checkout_finished
                    process_checkout_request(&state, &msg).await
                } else {
                    // Existing flow: checkout.commands -> checkout.events
                    process_message(&state, &msg).await
                };

                if let Err(err) = result {
                    error!("Failed to process message from {}: {}", topic, err);
                }

                let _ = consumer.commit_message(&msg, CommitMode::Async);
            }
            Err(err) => {
                warn!("Kafka consumer error: {}", err);
                tokio::time::sleep(Duration::from_millis(200)).await;
            }
        }
    }
}

async fn health() -> HttpResponse {
    HttpResponse::Ok().json(BaseResponse::success("ok"))
}

async fn transactions(
    state: web::Data<Arc<ServiceState>>,
    req: HttpRequest,
    query: web::Query<TransactionsQuery>,
) -> HttpResponse {
    let token = match extract_token(&req) {
        Some(token) => token,
        None => {
            return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
        }
    };

    if state.jwt_secret.is_empty() {
        return HttpResponse::InternalServerError()
            .json(BaseResponse::error("JWT secret not configured"));
    }

    let claims = match decode_token(&token, &state.jwt_secret) {
        Ok(claims) => claims,
        Err(_) => {
            return HttpResponse::Unauthorized().json(BaseResponse::error("Invalid token"));
        }
    };

    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let offset = query.offset.unwrap_or(0).max(0);

    let transactions = match db::fetch_transactions_by_user(&state.db, claims.sub, limit, offset)
        .await
    {
        Ok(transactions) => transactions,
        Err(err) => {
            error!("Failed to fetch transactions: {}", err);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to load transactions"));
        }
    };

    HttpResponse::Ok().json(TransactionsResponse {
        base: BaseResponse::success("Transactions retrieved"),
        transactions,
    })
}

async fn create_session(
    state: web::Data<Arc<ServiceState>>,
    req: HttpRequest,
    body: web::Json<CheckoutSessionRequest>,
) -> HttpResponse {
    let token = match extract_token(&req) {
        Some(token) => token,
        None => {
            return HttpResponse::Unauthorized().json(BaseResponse::error("Unauthorized"));
        }
    };

    if state.jwt_secret.is_empty() {
        return HttpResponse::InternalServerError()
            .json(BaseResponse::error("JWT secret not configured"));
    }

    let claims = match decode_token(&token, &state.jwt_secret) {
        Ok(claims) => claims,
        Err(_) => {
            return HttpResponse::Unauthorized().json(BaseResponse::error("Invalid token"));
        }
    };

    if body.amount < 1 {
        return HttpResponse::BadRequest()
            .json(BaseResponse::error("Amount must be at least 1"));
    }

    let amount_cents = match body.amount.checked_mul(100) {
        Some(value) => value,
        None => {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Amount is too large"));
        }
    };

    let request_id = Uuid::new_v4().to_string();
    let (success_url, cancel_url) = build_balance_urls(&request_base_url(&req));
    let metadata = json!({
        "coins": body.amount,
        "balance_cents": amount_cents,
        "product_name": "Coins",
        "description": "Account top-up",
        "source": "balance",
    });

    let command = CheckoutCommand::CreateSession {
        request_id: request_id.clone(),
        service_token: state.service_token.clone(),
        user_id: claims.sub,
        amount_cents,
        currency: "eur".to_string(),
        success_url,
        cancel_url,
        purpose: "balance_topup".to_string(),
        metadata: metadata.clone(),
        requested_at: Utc::now().to_rfc3339(),
        customer_email: None,
    };

    let session = match create_checkout_session(&state, &command).await {
        Ok(session) => session,
        Err(error_message) => {
            // Don't create DB row for failed session creation - only log
            warn!(
                request_id = %request_id,
                user_id = %claims.sub,
                error = %error_message,
                "Failed to create Stripe session"
            );
            return HttpResponse::BadGateway()
                .json(BaseResponse::error("Checkout failed"));
        }
    };

    let session_url = match session.url {
        Some(url) if !url.is_empty() => url,
        _ => {
            // Log the failure but don't create DB row yet - wait for webhook
            warn!(
                request_id = %request_id,
                user_id = %claims.sub,
                "Stripe session URL missing"
            );
            return HttpResponse::BadGateway()
                .json(BaseResponse::error("Checkout failed"));
        }
    };

    // Don't create DB row here - wait for webhook to create it when payment completes
    // This ensures checkout_transactions only contains completed payments
    info!(
        request_id = %request_id,
        user_id = %claims.sub,
        session_id = %session.id,
        "Stripe session created, returning URL to frontend"
    );

    HttpResponse::Ok().json(CheckoutSessionResponse {
        base: BaseResponse::success("Checkout session created"),
        session_id: session.id,
        url: session_url,
    })
}

async fn stripe_webhook(
    state: web::Data<Arc<ServiceState>>,
    req: HttpRequest,
    payload: web::Bytes,
) -> HttpResponse {
    // DEBUG: Log that webhook endpoint was hit
    info!(
        "=== WEBHOOK RECEIVED === payload_len={} headers={:?}",
        payload.len(),
        req.headers()
    );

    let signature = match req.headers().get("Stripe-Signature") {
        Some(header) => match header.to_str() {
            Ok(value) => value,
            Err(_) => {
                return HttpResponse::BadRequest()
                    .json(BaseResponse::error("Invalid Stripe signature header"));
            }
        },
        None => {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Missing Stripe signature header"));
        }
    };

    info!("=== VERIFYING SIGNATURE ===");
    if !stripe::verify_signature(&payload, signature, &state.stripe_webhook_secret) {
        warn!("Stripe webhook signature verification failed");
        return HttpResponse::BadRequest()
            .json(BaseResponse::error("Stripe signature verification failed"));
    }
    info!("=== SIGNATURE VERIFIED ===");

    let event: Value = match serde_json::from_slice(&payload) {
        Ok(event) => event,
        Err(err) => {
            error!("Stripe webhook payload invalid: {}", err);
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Invalid Stripe payload"));
        }
    };

    let event_type = event
        .get("type")
        .and_then(|value| value.as_str())
        .unwrap_or("");

    info!("=== WEBHOOK EVENT TYPE: {} ===", event_type);

    if event_type != "checkout.session.completed" {
        info!("=== IGNORING EVENT (not checkout.session.completed) ===");
        return HttpResponse::Ok().json(BaseResponse::success("Event ignored"));
    }

    info!("=== PROCESSING checkout.session.completed ===");

    let session = match event.get("data").and_then(|data| data.get("object")) {
        Some(session) => session,
        None => {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Stripe session missing"));
        }
    };

    let user_id = match parse_user_id(session) {
        Some(user_id) => user_id,
        None => {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Stripe metadata missing user_id"));
        }
    };

    let amount_cents = match parse_amount_cents(session) {
        Some(amount) if amount > 0 => amount,
        _ => {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Stripe metadata missing amount"));
        }
    };

    let request_id = match parse_request_id(session) {
        Some(request_id) => request_id,
        None => {
            return HttpResponse::BadRequest()
                .json(BaseResponse::error("Stripe metadata missing request_id"));
        }
    };

    let payment_status = session
        .get("payment_status")
        .and_then(|value| value.as_str())
        .unwrap_or("");

    if payment_status != "paid" {
        let failure_reason = if payment_status.is_empty() {
            "payment_not_completed".to_string()
        } else {
            format!("payment_status: {}", payment_status)
        };

        let currency = parse_currency(session).unwrap_or_else(|| "eur".to_string());
        let purpose = parse_purpose(session).unwrap_or_else(|| "unknown".to_string());
        let session_id = session
            .get("id")
            .and_then(|value| value.as_str())
            .map(|val| val.to_string());

        let metadata = session.get("metadata").cloned().unwrap_or(Value::Null);

        match db::mark_payment_failed(
            &state.db,
            &request_id,
            user_id,
            amount_cents,
            &currency,
            &purpose,
            session_id.as_deref(),
            &failure_reason,
            &metadata,
        )
        .await
        {
            Ok(should_emit) => {
                if should_emit {
                    // Publish to existing checkout.events topic
                    let event = CheckoutEvent::PaymentFailed {
                        request_id: request_id.clone(),
                        user_id,
                        amount_cents,
                        currency: currency.clone(),
                        session_id: session_id.clone(),
                        error: failure_reason.clone(),
                        purpose: purpose.clone(),
                        failed_at: Utc::now().to_rfc3339(),
                    };

                    if let Err(err) = state.producer.send_event(&event, Some(&request_id)).await {
                        warn!("Failed to publish checkout failure event: {}", err);
                    }

                    // Also publish to new checkout_finished topic
                    let finished_event = CheckoutFinishedEvent::failed(
                        request_id.clone(),
                        user_id,
                        amount_cents,
                        currency,
                        purpose,
                        session_id,
                        failure_reason,
                    );

                    if let Err(err) = state
                        .producer
                        .send_finished_event(&finished_event, Some(&request_id))
                        .await
                    {
                        warn!("Failed to publish checkout_finished failure event: {}", err);
                    }
                }
            }
            Err(err) => {
                warn!("Failed to record checkout failure: {}", err);
                return HttpResponse::InternalServerError()
                    .json(BaseResponse::error("Failed to record payment failure"));
            }
        }

        return HttpResponse::Ok().json(BaseResponse::success("Payment not completed"));
    }

    let currency = parse_currency(session).unwrap_or_else(|| "eur".to_string());
    let purpose = parse_purpose(session).unwrap_or_else(|| "unknown".to_string());
    let session_id = session
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string();
    let payment_intent_id = session
        .get("payment_intent")
        .and_then(|value| value.as_str())
        .map(|val| val.to_string());

    let metadata = session.get("metadata").cloned().unwrap_or(Value::Null);

    let should_emit = match db::mark_payment_succeeded(
        &state.db,
        &request_id,
        user_id,
        amount_cents,
        &currency,
        &purpose,
        &session_id,
        payment_intent_id.as_deref(),
        &metadata,
    )
    .await
    {
        Ok(should_emit) => should_emit,
        Err(err) => {
            warn!("Failed to record checkout payment: {}", err);
            return HttpResponse::InternalServerError()
                .json(BaseResponse::error("Failed to record payment"));
        }
    };

    if should_emit {
        // Publish to existing checkout.events topic
        let event = CheckoutEvent::PaymentSucceeded {
            request_id: request_id.clone(),
            user_id,
            amount_cents,
            currency: currency.clone(),
            session_id: session_id.clone(),
            payment_intent_id: payment_intent_id.clone(),
            purpose: purpose.clone(),
            metadata,
            paid_at: Utc::now().to_rfc3339(),
        };

        if let Err(err) = state.producer.send_event(&event, Some(&request_id)).await {
            warn!("Failed to publish checkout payment event: {}", err);
        }

        // Also publish to new checkout_finished topic
        let finished_event = CheckoutFinishedEvent::success(
            request_id.clone(),
            user_id,
            amount_cents,
            currency,
            purpose,
            Some(session_id),
            payment_intent_id,
        );

        if let Err(err) = state
            .producer
            .send_finished_event(&finished_event, Some(&request_id))
            .await
        {
            warn!("Failed to publish checkout_finished success event: {}", err);
        }
    } else {
        return HttpResponse::Ok().json(BaseResponse::success("Payment already processed"));
    }

    HttpResponse::Ok().json(BaseResponse::success("Payment processed"))
}

#[cfg(test)]
mod tests {
    use super::{build_balance_urls, validate_service_token_value};

    #[test]
    fn validate_service_token_value_accepts_match() {
        assert!(validate_service_token_value("token", "token").is_ok());
    }

    #[test]
    fn validate_service_token_value_rejects_empty_or_mismatch() {
        assert!(validate_service_token_value("", "token").is_err());
        assert!(validate_service_token_value("token", "wrong").is_err());
    }

    #[test]
    fn build_balance_urls_trims_trailing_slash() {
        let (success, cancel) = build_balance_urls("https://local.rust.com/");
        assert_eq!(
            success,
            "https://local.rust.com/balance?status=success&session_id={CHECKOUT_SESSION_ID}"
        );
        assert_eq!(cancel, "https://local.rust.com/balance?status=cancel");
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let config = AppConfig::from_env();

    let producer = KafkaProducer::new(&config.kafka_bootstrap).map_err(|err| {
        std::io::Error::new(std::io::ErrorKind::Other, format!("Kafka error: {}", err))
    })?;

    let db_pool = db::connect(&config.database_url)
        .await
        .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err.to_string()))?;
    if let Err(err) = db::run_migrations(&db_pool).await {
        return Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Database migrations failed: {}", err),
        ));
    }

    let state = Arc::new(ServiceState {
        producer,
        stripe_secret: config.stripe_secret.clone(),
        stripe_webhook_secret: config.stripe_webhook_secret.clone(),
        http_client: reqwest::Client::new(),
        jwt_secret: config.jwt_secret.clone(),
        service_token: config.service_token.clone(),
        db: db_pool,
    });

    let consumer_state = state.clone();
    let consumer_config = config.clone();
    tokio::spawn(async move {
        if let Err(err) = run_consumer(consumer_state, &consumer_config).await {
            error!("Checkout consumer stopped: {}", err);
        }
    });

    info!("Checkout service listening on {}:{}", config.host, config.port);

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/health", web::get().to(health))
            .route("/sessions", web::post().to(create_session))
            .route("/transactions", web::get().to(transactions))
            .route("/webhooks/stripe", web::post().to(stripe_webhook))
    })
    .bind((config.host.as_str(), config.port))?
    .run()
    .await
}
