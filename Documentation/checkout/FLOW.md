# Checkout Payment Flow

This document describes the complete payment flow from user click to balance update.

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              PAYMENT FLOW                                     │
└──────────────────────────────────────────────────────────────────────────────┘

    USER                    FRONTEND                CHECKOUT              STRIPE
     │                         │                      SERVICE                │
     │                         │                         │                   │
     │  Enter amount           │                         │                   │
     │  Click "Continue        │                         │                   │
     │  to Stripe"             │                         │                   │
     │─────────────────────────>                         │                   │
     │                         │                         │                   │
     │                         │  POST /checkout/sessions                    │
     │                         │  {amount: 5}            │                   │
     │                         │────────────────────────>│                   │
     │                         │                         │                   │
     │                         │                         │  Create Session   │
     │                         │                         │─────────────────>│
     │                         │                         │                   │
     │                         │                         │  {id, url}        │
     │                         │                         │<─────────────────│
     │                         │                         │                   │
     │                         │  {session_id, url}      │                   │
     │                         │<────────────────────────│                   │
     │                         │                         │                   │
     │  Redirect to Stripe URL │                         │                   │
     │<─────────────────────────                         │                   │
     │                         │                         │                   │
     │  ════════════════════════════════════════════════════════════════════>│
     │                         STRIPE CHECKOUT PAGE                          │
     │  <═══════════════════════════════════════════════════════════════════│
     │                         │                         │                   │
     │  Complete Payment       │                         │                   │
     │─────────────────────────────────────────────────────────────────────>│
     │                         │                         │                   │
     │                         │                         │     WEBHOOK       │
     │                         │                         │  checkout.session │
     │                         │                         │  .completed       │
     │                         │                         │<─────────────────│
     │                         │                         │                   │
     │                         │                         │  1. Verify sig    │
     │                         │                         │  2. Parse event   │
     │                         │                         │  3. Store in DB   │
     │                         │                         │  4. Publish Kafka │
     │                         │                         │                   │
     │                         │     checkout.finished topic                 │
     │                         │         (Kafka)         │                   │
     │                         │<────────────────────────│                   │
     │                         │                         │                   │
     │                         │  UPDATE users           │                   │
     │                         │  SET balance +=         │                   │
     │                         │  amount_cents           │                   │
     │                         │                         │                   │
     │  Redirect to            │                         │                   │
     │  /balance?status=success│                         │                   │
     │<═════════════════════════════════════════════════════════════════════│
     │                         │                         │                   │
```

## Step-by-Step Flow

### Step 1: User Initiates Checkout

**Location:** `blazing_sun/src/frontend/pages/BALANCE/src/BalancePage.js`

User enters an amount (e.g., 5 coins = €5.00) and clicks "Continue to Stripe".

```javascript
// BalancePage.js:116-149
async handleSubmit(event) {
  event.preventDefault();
  const amount = this.getAmount();
  // ...
  const result = await this.createCheckoutSession(amount);
  if (result.ok && result.data?.url) {
    window.location.href = result.data.url;  // Redirect to Stripe
  }
}
```

### Step 2: Frontend Calls Checkout Service

**Location:** `blazing_sun/src/frontend/pages/BALANCE/src/BalancePage.js:151-178`

Frontend makes a direct HTTP call to the checkout service:

```javascript
// BalancePage.js:151-178
async createCheckoutSession(amount) {
  const response = await fetch(`${this.checkoutBaseUrl}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount })
  });
  return { ok: response.ok, data: await response.json() };
}
```

### Step 3: Checkout Service Creates Stripe Session

**Location:** `checkout/src/main.rs:733-837`

The checkout service receives the request and creates a Stripe checkout session:

```rust
// main.rs:733-837
async fn create_session(
    state: web::Data<Arc<ServiceState>>,
    req: HttpRequest,
    body: web::Json<CheckoutSessionRequest>,
) -> HttpResponse {
    // 1. Validate JWT token
    let claims = decode_token(&token, &state.jwt_secret)?;

    // 2. Convert amount to cents
    let amount_cents = body.amount * 100;

    // 3. Create Stripe session
    let session = create_checkout_session(&state, &command).await?;

    // 4. Return session URL to frontend
    HttpResponse::Ok().json(CheckoutSessionResponse {
        session_id: session.id,
        url: session.url,
    })
}
```

**Stripe API Call:** `checkout/src/main.rs:337-427`

```rust
// main.rs:337-427
async fn create_checkout_session(
    state: &ServiceState,
    command: &CheckoutCommand,
) -> Result<StripeCheckoutSession, String> {
    let params = vec![
        ("mode", "payment"),
        ("success_url", success_url),
        ("cancel_url", cancel_url),
        ("line_items[0][price_data][unit_amount]", amount_cents),
        ("metadata[user_id]", user_id),
        ("metadata[request_id]", request_id),
        // ...
    ];

    state.http_client
        .post("https://api.stripe.com/v1/checkout/sessions")
        .bearer_auth(&state.stripe_secret)
        .form(&params)
        .send()
        .await
}
```

### Step 4: User Completes Payment on Stripe

User is redirected to Stripe's hosted checkout page where they enter payment details and complete the transaction.

### Step 5: Stripe Sends Webhook

**Location:** `checkout/src/main.rs:839-1086`

Stripe sends a `checkout.session.completed` webhook to the checkout service:

```rust
// main.rs:839-1086
async fn stripe_webhook(
    state: web::Data<Arc<ServiceState>>,
    req: HttpRequest,
    payload: web::Bytes,
) -> HttpResponse {
    // 1. Verify webhook signature
    let signature = req.headers().get("Stripe-Signature")?;
    if !stripe::verify_signature(&payload, signature, &state.stripe_webhook_secret) {
        return HttpResponse::BadRequest().json("Signature verification failed");
    }

    // 2. Parse event
    let event: Value = serde_json::from_slice(&payload)?;
    let event_type = event.get("type").and_then(|v| v.as_str())?;

    // 3. Only process checkout.session.completed
    if event_type != "checkout.session.completed" {
        return HttpResponse::Ok().json("Event ignored");
    }

    // 4. Extract payment details
    let session = event.get("data").and_then(|d| d.get("object"))?;
    let user_id = parse_user_id(session)?;
    let amount_cents = parse_amount_cents(session)?;
    let request_id = parse_request_id(session)?;

    // ...
}
```

### Step 6: Store Transaction in Database

**Location:** `checkout/src/db.rs:136-190`

The checkout service stores the transaction (with idempotency check):

```rust
// db.rs:136-190
pub async fn mark_payment_succeeded(
    pool: &PgPool,
    request_id: &str,
    user_id: i64,
    amount_cents: i64,
    // ...
) -> Result<bool, sqlx::Error> {
    let row = sqlx::query(r#"
        INSERT INTO checkout_transactions (...)
        VALUES ($1, $2, $3, ...)
        ON CONFLICT (request_id) DO UPDATE
        SET status = 'payment_succeeded', ...
        WHERE checkout_transactions.status NOT IN ('payment_succeeded', 'payment_failed')
        RETURNING id
    "#)
    .execute(pool)
    .await?;

    // Returns true if row was inserted/updated (should emit event)
    Ok(row.is_some())
}
```

### Step 7: Publish to Kafka

**Location:** `checkout/src/main.rs:1045-1080`

After storing in database, publish to Kafka topics:

```rust
// main.rs:1045-1080
if should_emit {
    // Publish to checkout.finished topic
    let finished_event = CheckoutFinishedEvent::success(
        request_id.clone(),
        user_id,
        amount_cents,
        currency,
        purpose,
        Some(session_id),
        payment_intent_id,
    );

    state.producer
        .send_finished_event(&finished_event, Some(&request_id))
        .await?;
}
```

**Event Structure:** `checkout/src/types.rs:104-128`

```rust
// types.rs:104-128
pub struct CheckoutFinishedEvent {
    pub request_id: String,
    pub user_id: i64,
    pub amount_cents: i64,
    pub currency: String,
    pub purpose: String,
    pub status: String,        // "success" or "failed"
    pub session_id: Option<String>,
    pub payment_intent_id: Option<String>,
    pub error_message: Option<String>,
    pub timestamp: String,
}
```

### Step 8: Blazing Sun Consumes Event

**Location:** `blazing_sun/src/bootstrap/events/handlers/checkout_finished.rs`

The `CheckoutFinishedHandler` consumes the event and updates the user's balance:

```rust
// checkout_finished.rs:51-106
async fn handle(&self, event: &crate::events::DomainEvent) -> Result<(), EventHandlerError> {
    let checkout_event: CheckoutFinishedEvent =
        serde_json::from_value(event.payload.clone())?;

    match checkout_event.status.as_str() {
        "success" => {
            // Update user balance
            let db = self.db.lock().await;
            db_user_mutations::add_balance(&db, user_id, amount_cents).await?;

            info!(
                request_id = %request_id,
                user_id = %user_id,
                amount_cents = %amount_cents,
                "Checkout payment succeeded - balance updated"
            );
        }
        "failed" => {
            warn!(
                request_id = %request_id,
                user_id = %user_id,
                error = %error_message,
                "Checkout payment failed"
            );
        }
    }
    Ok(())
}
```

### Step 9: User Redirected to Success Page

Stripe redirects the user back to:
```
/balance?status=success&session_id={CHECKOUT_SESSION_ID}
```

The frontend displays a success message:

```javascript
// BalancePage.js:51-60
showStatusFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');

  if (status === 'success') {
    this.showStatus('Payment completed. Coins will appear shortly.', 'success');
  } else if (status === 'cancel') {
    this.showStatus('Payment canceled. You can try again.', 'warning');
  }
}
```

## Event Timeline

```
T+0ms    User clicks "Continue to Stripe"
T+100ms  Frontend sends POST /checkout/sessions
T+500ms  Checkout service creates Stripe session
T+600ms  Frontend receives session URL
T+700ms  Browser redirects to Stripe

... User completes payment on Stripe (~30-120 seconds) ...

T+60s    Stripe sends webhook to checkout service
T+60.1s  Checkout service verifies webhook signature
T+60.2s  Checkout service stores transaction in DB
T+60.3s  Checkout service publishes to Kafka (checkout.finished)
T+60.4s  Blazing Sun handler consumes event
T+60.5s  User balance updated in users table
T+60.6s  Stripe redirects user to /balance?status=success
```

## Error Handling

### Stripe Session Creation Fails
- Checkout service returns 502 Bad Gateway
- Frontend shows "Checkout failed" error
- No database record created

### Webhook Signature Verification Fails
- Checkout service returns 400 Bad Request
- No database record created
- No Kafka event published

### Database Insert Fails
- Checkout service returns 500 Internal Server Error
- Webhook acknowledged (Stripe won't retry)
- Manual intervention required

### Kafka Publish Fails
- Warning logged
- Database record exists (payment recorded)
- Balance update may be delayed until manual trigger
