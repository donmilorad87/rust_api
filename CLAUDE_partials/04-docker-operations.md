# Docker Commands Reference

## Start/Stop Services

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart a specific service
docker compose restart rust
```

## Viewing Logs

```bash
# Follow logs for a service
docker compose logs -f rust
docker compose logs -f postgres
docker compose logs -f kafka
docker compose logs -f rabbitmq

# View last 100 lines
docker compose logs --tail=100 rust
```

## Entering Containers

```bash
# Enter Rust container
docker compose exec rust bash

# Enter PostgreSQL
docker compose exec postgres psql -U app -d blazing_sun

# Enter Redis
docker compose exec redis redis-cli -a redis_secret_password

# Enter Kafka
docker compose exec kafka bash
```

## Rebuilding Services

```bash
# Rebuild and restart all services
docker compose up -d --build

# Rebuild specific service without cache
docker compose build --no-cache rust

# Rebuild all services without cache
docker compose build --no-cache
```

## Full Reset (Deletes Data)

```bash
# Stop all services and delete volumes
docker compose down -v

# Rebuild everything from scratch
docker compose build --no-cache

# Start services
docker compose up -d
```

## Useful Service-Specific Commands

### Kafka Commands

```bash
# List topics
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092

# Consume messages from a topic
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic user.events \
    --from-beginning

# Check Kafka broker status
docker compose exec kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092
```

### PostgreSQL Commands

```bash
# Check database connectivity
docker compose exec postgres pg_isready -U app -d blazing_sun

# Run SQL query
docker compose exec postgres psql -U app -d blazing_sun -c "SELECT * FROM users;"

# Backup database
docker compose exec postgres pg_dump -U app blazing_sun > backup.sql

# Restore database
docker compose exec -T postgres psql -U app -d blazing_sun < backup.sql
```

### Redis Commands

```bash
# Check Redis connectivity
docker compose exec redis redis-cli -a redis_secret_password ping

# Monitor Redis commands
docker compose exec redis redis-cli -a redis_secret_password monitor

# Get all keys
docker compose exec redis redis-cli -a redis_secret_password KEYS "*"
```

### RabbitMQ Commands

```bash
# Check RabbitMQ status
docker compose exec rabbitmq rabbitmq-diagnostics -q ping

# List queues
docker compose exec rabbitmq rabbitmqctl list_queues

# List connections
docker compose exec rabbitmq rabbitmqctl list_connections
```
