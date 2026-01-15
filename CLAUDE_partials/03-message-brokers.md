# Message Broker Strategy

## RabbitMQ (Task Queue)
- **Purpose**: Async job processing with per-message acknowledgment
- **Use Cases**: Email sending, user creation, background tasks
- **Queues**: `jobs` (priority 0-10), `jobs_failed` (dead letter)
- **Pattern**: Command/Task - "Do this work reliably"

## Kafka (Event Streaming)
- **Purpose**: Immutable event log with multiple consumers
- **Use Cases**: User events, auth events, transaction events, audit logs
- **Topics**: `user.events`, `auth.events`, `transaction.events`, `category.events`
- **Pattern**: Event Sourcing - "This fact happened"

## When to Use Which

| Scenario | Use |
|----------|-----|
| Send email | RabbitMQ |
| Process payment | RabbitMQ |
| User signed up (event) | Kafka |
| User logged in (event) | Kafka |
| Transaction created (event) | Kafka |
| Build audit log | Kafka consumer |
| Update analytics | Kafka consumer |
| Sync to external CRM | Kafka consumer |

## Kafka Topics

| Topic | Description | Event Types |
|-------|-------------|-------------|
| user.events | User lifecycle events | created, updated, deleted, activated, password_changed |
| auth.events | Authentication events | sign_in, sign_in_failed, sign_out, password_reset |
| transaction.events | Financial transactions | created, updated, deleted |
| category.events | Category management | created, updated, deleted |
| system.events | System-level events | health_check, error, warning |
| events.dead_letter | Failed events | All types (for reprocessing) |
