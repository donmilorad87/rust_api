# Kafka Topics for Checkout

This document describes the Kafka topics used in the checkout system.

## Topic Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         KAFKA TOPICS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   checkout.requests             checkout.finished                        │
│   ┌─────────────────┐           ┌─────────────────┐                     │
│   │ CheckoutRequest │           │ CheckoutFinished│                     │
│   │ Event           │           │ Event           │                     │
│   └────────┬────────┘           └────────┬────────┘                     │
│            │                             │                               │
│   Producer: blazing_sun        Producer: checkout                        │
│   Consumer: checkout           Consumer: blazing_sun                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Topic Configuration

Topics are created automatically by the Kafka entrypoint script:

**Location:** `kafka/entrypoint.sh`

```bash
# Checkout topics
CHECKOUT_TOPICS="checkout.requests checkout.finished"

for TOPIC in $TOPICS; do
    kafka-topics.sh --create \
        --bootstrap-server localhost:9092 \
        --topic "$TOPIC" \
        --partitions 3 \
        --replication-factor 1 \
        --if-not-exists
done
```

## Topic: `checkout.requests`

**Purpose:** Checkout requests from blazing_sun to checkout service.

**Producer:** `blazing_sun/src/app/http/api/controllers/balance.rs`
**Consumer:** `checkout/src/main.rs`

### Event Schema: CheckoutRequestEvent

**Location:** `blazing_sun/src/app/checkout/mod.rs`

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": 123,
  "amount_cents": 500,
  "currency": "eur",
  "purpose": "balance_topup",
  "timestamp": "2024-01-15T10:30:00Z",
  "success_url": "https://example.com/balance?status=success",
  "cancel_url": "https://example.com/balance?status=cancel"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `request_id` | String | UUID for request correlation |
| `user_id` | i64 | User initiating checkout |
| `amount_cents` | i64 | Amount in cents (500 = €5.00) |
| `currency` | String | Currency code (default: "eur") |
| `purpose` | String | Checkout purpose (default: "balance_topup") |
| `timestamp` | String | ISO 8601 timestamp |
| `success_url` | String | Redirect URL on success |
| `cancel_url` | String | Redirect URL on cancel |

## Topic: `checkout.finished`

**Purpose:** Payment completion events from checkout service to blazing_sun.

**Producer:** `checkout/src/main.rs` (webhook handler)
**Consumer:** `blazing_sun/src/bootstrap/events/handlers/checkout_finished.rs`

### Event Schema: CheckoutFinishedEvent

**Location:** `blazing_sun/src/app/checkout/mod.rs`

```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": 123,
  "amount_cents": 500,
  "currency": "eur",
  "purpose": "balance_topup",
  "status": "success",
  "session_id": "cs_test_abc123",
  "session_url": null,
  "payment_intent_id": "pi_test_xyz789",
  "error_message": null,
  "timestamp": "2024-01-15T10:35:00Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `request_id` | String | UUID for request correlation |
| `user_id` | i64 | User who made payment |
| `amount_cents` | i64 | Amount paid in cents |
| `currency` | String | Currency code |
| `purpose` | String | Checkout purpose |
| `status` | String | "session_created", "success", or "failed" |
| `session_id` | Option<String> | Stripe session ID |
| `session_url` | Option<String> | Stripe checkout URL (for session_created) |
| `payment_intent_id` | Option<String> | Stripe payment intent ID (for success) |
| `error_message` | Option<String> | Error details (for failed) |
| `timestamp` | String | ISO 8601 timestamp |

### Status Values

| Status | When Published | Action in blazing_sun |
|--------|----------------|----------------------|
| `session_created` | After Stripe session created | Return URL to frontend |
| `success` | After webhook confirms payment | Update user balance |
| `failed` | After webhook indicates failure | Log warning |

## Consumer Groups

**Location:** `blazing_sun/src/bootstrap/events/topics.rs`

```rust
pub mod consumer_groups {
    /// Main application consumer group
    pub const MAIN_APP: &str = "blazing-sun-main";
}
```

**Checkout Service:** `checkout-service` (configured in docker-compose)

## Topic Definitions in Code

### Blazing Sun

**Location:** `blazing_sun/src/bootstrap/events/topics.rs`

```rust
pub mod topic {
    /// Checkout request topic
    pub const CHECKOUT_REQUESTS: &str = "checkout.requests";

    /// Checkout finished topic
    pub const CHECKOUT_FINISHED: &str = "checkout.finished";
}
```

### Checkout Service

**Location:** `checkout/src/main.rs`

```rust
const CHECKOUT_REQUESTS_TOPIC: &str = "checkout.requests";
const CHECKOUT_FINISHED_TOPIC: &str = "checkout.finished";
```

## Monitoring Topics

### List All Topics

```bash
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
  --list --bootstrap-server localhost:9092
```

### Monitor `checkout.requests` Topic

```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic checkout.requests \
  --from-beginning
```

### Monitor `checkout.finished` Topic

```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic checkout.finished \
  --from-beginning
```

### Check Consumer Group Lag

```bash
docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group blazing-sun-main \
  --describe
```
