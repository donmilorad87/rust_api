# Checkout System Documentation

This documentation covers the Stripe payment integration using Kafka-driven event architecture.

## Overview

The checkout system enables users to add funds (coins) to their balance using Stripe payments. It uses a microservice architecture with Kafka for event-driven communication between services.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │     │   Blazing Sun    │     │    Checkout     │
│   (Browser)     │     │   (Rust App)     │     │    Service      │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         │  POST /checkout/sessions                       │
         │──────────────────────>│                        │
         │                       │                        │
         │                       │  (creates Stripe session directly)
         │                       │───────────────────────>│
         │                       │                        │
         │                       │  {session_id, url}     │
         │<──────────────────────│<───────────────────────│
         │                       │                        │
         │  Redirect to Stripe   │                        │
         │═══════════════════════════════════════════════>│ (Stripe)
         │                       │                        │
         │  User completes payment                        │
         │                       │                        │
         │                       │    Stripe Webhook      │
         │                       │<═══════════════════════│ (Stripe)
         │                       │                        │
         │                       │  1. Store in DB        │
         │                       │  2. Publish to Kafka   │
         │                       │        │               │
         │                       │        ▼               │
         │                       │  ┌──────────────┐      │
         │                       │  │    Kafka     │      │
         │                       │  │ checkout.    │      │
         │                       │  │ finished     │      │
         │                       │  └──────┬───────┘      │
         │                       │         │              │
         │                       │         ▼              │
         │                       │  CheckoutFinished      │
         │                       │  Handler               │
         │                       │         │              │
         │                       │         ▼              │
         │                       │  UPDATE users          │
         │                       │  SET balance +=        │
         │                       │  amount_cents          │
         │                       │                        │
```

## Documentation Files

| File | Description |
|------|-------------|
| [README.md](README.md) | This overview document |
| [FLOW.md](FLOW.md) | Step-by-step payment flow with code references |
| [KAFKA_TOPICS.md](KAFKA_TOPICS.md) | Kafka topic definitions and event schemas |
| [DATABASE.md](DATABASE.md) | Database schema for checkout transactions |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and debugging tips |

## Quick Reference

### Services

| Service | Port | Purpose |
|---------|------|---------|
| blazing_sun (rust) | 9999 | Main application |
| checkout | 9996 | Stripe payment service |
| checkout-postgres | 5433 | Checkout database |
| kafka | 9092 | Event streaming |

### Kafka Topics

| Topic | Producer | Consumer | Purpose |
|-------|----------|----------|---------|
| `checkout.requests` | blazing_sun | checkout | Checkout session requests |
| `checkout.finished` | checkout | blazing_sun | Payment completion events |

### Key Files

**Frontend:**
- `blazing_sun/src/frontend/pages/BALANCE/src/BalancePage.js` - Balance page with "Continue to Stripe" button

**Blazing Sun (Main App):**
- `blazing_sun/src/app/http/api/controllers/balance.rs` - Balance controller endpoints
- `blazing_sun/src/app/checkout/mod.rs` - Checkout types and utilities
- `blazing_sun/src/bootstrap/events/handlers/checkout_finished.rs` - Handler for balance updates
- `blazing_sun/src/bootstrap/events/topics.rs` - Kafka topic definitions

**Checkout Service:**
- `checkout/src/main.rs` - Main checkout service with webhook handler
- `checkout/src/types.rs` - Event type definitions
- `checkout/src/db.rs` - Database operations
- `checkout/src/stripe.rs` - Stripe webhook signature verification

## Environment Variables

### Checkout Service (.env)

```env
# Stripe Configuration
STRIPE_KEY=pk_test_...          # Stripe publishable key
STRIPE_SECRET=sk_test_...       # Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook signing secret (from Stripe CLI)

# Authentication
JWT_SECRET=your_jwt_secret      # Must match blazing_sun JWT secret
CHECKOUT_SERVICE_TOKEN=...      # Service-to-service auth token

# Database
CHECKOUT_DATABASE_URL=postgres://checkout:password@checkout-postgres:5433/checkout
```

## Testing with Stripe CLI

For local development, use the Stripe CLI to forward webhooks:

```bash
# Start Stripe CLI listener
stripe listen --forward-to http://192.168.0.108:9996/webhooks/stripe

# The CLI will output a webhook secret like:
# whsec_xxxxxxxxxxxxxxxxxxxxx
# Update checkout/.env with this secret
```

## Payment Flow Summary

1. User enters amount on `/balance` page
2. User clicks "Continue to Stripe"
3. Frontend calls `POST /checkout/sessions`
4. Checkout service creates Stripe session
5. Frontend redirects to Stripe checkout page
6. User completes payment on Stripe
7. Stripe sends webhook to checkout service
8. Checkout service:
   - Stores transaction in `checkout_transactions` table
   - Publishes `CheckoutFinishedEvent` to `checkout.finished` topic
9. Blazing Sun's `CheckoutFinishedHandler`:
   - Consumes event from Kafka
   - Updates user balance: `UPDATE users SET balance = balance + amount_cents`

## Important Notes

1. **Idempotency**: The checkout service uses `request_id` as unique key to prevent duplicate processing
2. **Balance is in cents**: All amounts are stored and processed in cents (e.g., 500 = €5.00)
3. **Webhook security**: All webhooks are verified using Stripe's HMAC signature
4. **Single handler for balance**: The `checkout_finished.rs` handler is responsible for updating user balance
