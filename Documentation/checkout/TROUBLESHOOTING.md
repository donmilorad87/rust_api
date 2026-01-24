# Checkout Troubleshooting Guide

This document covers common issues and debugging techniques for the checkout system.

## Common Issues

### 1. Webhook Signature Verification Failed

**Symptoms:**
- 400 Bad Request from webhook endpoint
- Log message: "Stripe webhook signature verification failed"

**Causes:**
1. Webhook secret mismatch between Stripe CLI and checkout service
2. Using wrong webhook secret (Dashboard vs CLI)

**Solutions:**

```bash
# 1. Check the webhook secret Stripe CLI is using
stripe listen --forward-to http://192.168.0.108:9996/webhooks/stripe
# Look for: Your webhook signing secret is whsec_xxxxx

# 2. Update checkout/.env with the correct secret
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# 3. Recreate the checkout container
docker compose up -d --force-recreate checkout

# 4. Verify the container has the correct secret
docker compose exec checkout env | grep STRIPE_WEBHOOK_SECRET
```

### 2. Balance Not Updating

**Symptoms:**
- Payment completes on Stripe
- User balance doesn't increase
- No error messages

**Causes:**
1. Kafka event not being published by checkout service
2. `checkout.finished` handler not consuming events
3. Database connection issue in handler

**Debug:**

```bash
# 1. Check if event was published
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic checkout.finished \
  --from-beginning

# 2. Check blazing_sun logs for handler errors
docker compose logs rust | grep -i "checkout\|balance"

# 3. Check consumer group lag
docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group blazing-sun-main \
  --describe
```

**Solution:**
The `checkout.finished.rs` handler at `blazing_sun/src/bootstrap/events/handlers/checkout.finished.rs` is responsible for updating user balance. Ensure it's properly registered and the Kafka consumer is running.

### 3. Checkout Service Not Starting

**Symptoms:**
- Container keeps restarting
- Health check failing

**Debug:**

```bash
# Check container logs
docker compose logs checkout

# Check if Kafka is ready
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
  --list --bootstrap-server localhost:9092

# Check if checkout-postgres is ready
docker compose exec checkout-postgres pg_isready -U checkout
```

**Common Causes:**
- Kafka not ready (wait for health check)
- Database connection string wrong
- Missing environment variables

### 4. Webhook Not Received

**Symptoms:**
- Payment completes on Stripe
- No balance update
- No Kafka messages

**Debug:**

```bash
# 1. Check if Stripe CLI is running
# Should see: Ready! Your webhook signing secret is whsec_xxxxx

# 2. Check if webhooks are being received
docker compose logs -f checkout | grep -i webhook

# 3. Verify checkout service is accessible
curl http://localhost:9996/health
# Should return: {"status":"success","message":"ok"}

# 4. Check Stripe CLI output for forwarding
# Should show: [200] POST http://192.168.0.108:9996/webhooks/stripe
```

**Solutions:**
1. Make sure Stripe CLI is running
2. Verify the forwarding URL matches checkout service
3. Check firewall settings for port 9996

### 5. Session Creation Fails

**Symptoms:**
- "Checkout failed" error in frontend
- 502 Bad Gateway response

**Debug:**

```bash
# Check checkout service logs
docker compose logs checkout | grep -i stripe

# Verify Stripe secret key
docker compose exec checkout env | grep STRIPE_SECRET
```

**Common Causes:**
- Invalid Stripe secret key
- Network issues reaching Stripe API
- Amount validation failed (must be positive)

### 6. Kafka Events Not Being Consumed

**Symptoms:**
- Events published to Kafka
- Handlers not processing them

**Debug:**

```bash
# 1. Check if topics exist
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
  --list --bootstrap-server localhost:9092 | grep checkout

# 2. Check consumer group status
docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group blazing-sun-main \
  --describe

# 3. Monitor topic for messages
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic checkout.finished \
  --from-beginning
```

## Debugging Commands

### View Checkout Service Logs

```bash
# Real-time logs
docker compose logs -f checkout

# Last 100 lines
docker compose logs --tail 100 checkout

# Filter for specific events
docker compose logs checkout | grep -i "payment\|webhook\|balance"
```

### View Blazing Sun Logs

```bash
# Real-time logs
docker compose logs -f rust

# Filter for checkout handler
docker compose logs rust | grep -i "checkout\|balance"
```

### Check Database State

```bash
# Connect to checkout database
docker compose exec checkout-postgres psql -U checkout -d checkout

# View recent transactions
SELECT request_id, user_id, amount_cents, status, created_at
FROM checkout_transactions
ORDER BY created_at DESC
LIMIT 10;

# Check specific transaction
SELECT * FROM checkout_transactions WHERE request_id = 'your-request-id';
```

### Check User Balance

```bash
# Connect to main database
docker compose exec postgres psql -U app -d blazing_sun

# Check user balance
SELECT id, email, balance FROM users WHERE id = 123;

# Reset balance for testing
UPDATE users SET balance = 0 WHERE id = 123;
```

### Monitor Kafka Topics

```bash
# List all topics
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
  --list --bootstrap-server localhost:9092

# Monitor checkout.requests topic (requests from blazing_sun)
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic checkout.requests \
  --from-beginning

# Monitor checkout.finished topic (responses from checkout service)
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic checkout.finished \
  --from-beginning
```

## Testing Workflow

### Complete Test Flow

1. **Start Stripe CLI:**
   ```bash
   stripe listen --forward-to http://192.168.0.108:9996/webhooks/stripe
   ```

2. **Update webhook secret if needed:**
   ```bash
   # Edit checkout/.env with the whsec_ from CLI output
   vim checkout/.env

   # Recreate container
   docker compose up -d --force-recreate checkout
   ```

3. **Reset test user balance:**
   ```bash
   docker compose exec postgres psql -U app -d blazing_sun \
     -c "UPDATE users SET balance = 0 WHERE id = YOUR_USER_ID"
   ```

4. **Navigate to balance page:**
   - Go to https://localhost/balance
   - Enter amount (e.g., 5)
   - Click "Continue to Stripe"

5. **Complete payment:**
   - Use test card: 4242 4242 4242 4242
   - Any future date, any CVC

6. **Verify:**
   - Check Stripe CLI shows webhook forwarded
   - Check checkout logs show "payment processed"
   - Check user balance updated
   - Check you're redirected to /balance?status=success

### Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Card declined |
| 4000 0000 0000 9995 | Insufficient funds |

## Environment Variables Checklist

### Checkout Service (.env)

```env
# Required
STRIPE_SECRET=sk_test_...      # Must be test key
STRIPE_WEBHOOK_SECRET=whsec_... # From Stripe CLI
JWT_SECRET=...                  # Must match blazing_sun
CHECKOUT_SERVICE_TOKEN=...      # Service auth token

# Database
CHECKOUT_DATABASE_URL=postgres://...

# Optional (defaults work)
CHECKOUT_HOST=0.0.0.0
CHECKOUT_PORT=9996
KAFKA_HOST=kafka
KAFKA_PORT=9092
```

### Blazing Sun (.env)

```env
# Must match checkout service
JWT_SECRET=...
CHECKOUT_SERVICE_TOKEN=...

# Kafka
KAFKA_BROKERS=kafka:9092
```

## Emergency Recovery

### Balance Out of Sync

If balance doesn't match transactions:

```bash
# 1. Get total successful payments for user
docker compose exec checkout-postgres psql -U checkout -d checkout \
  -c "SELECT SUM(amount_cents) FROM checkout_transactions
      WHERE user_id = USER_ID AND status = 'payment_succeeded'"

# 2. Update user balance to match
docker compose exec postgres psql -U app -d blazing_sun \
  -c "UPDATE users SET balance = CORRECT_AMOUNT WHERE id = USER_ID"
```

### Replay Failed Events

If events were published but not processed:

```bash
# 1. Reset consumer group offset
docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group blazing-sun-main \
  --topic checkout.finished \
  --reset-offsets \
  --to-earliest \
  --execute

# 2. Restart rust container to reprocess
docker compose restart rust
```

### Manual Balance Update

For emergency situations:

```bash
# Add balance manually (amount in cents)
docker compose exec postgres psql -U app -d blazing_sun \
  -c "UPDATE users SET balance = balance + 500 WHERE id = USER_ID"
```

## Service Health Checks

### All Services Running

```bash
docker compose ps
```

### Individual Service Health

```bash
# Checkout
curl http://localhost:9996/health

# Kafka
docker compose exec kafka /opt/kafka/bin/kafka-broker-api-versions.sh \
  --bootstrap-server localhost:9092

# Postgres
docker compose exec postgres pg_isready -U app
docker compose exec checkout-postgres pg_isready -U checkout
```
