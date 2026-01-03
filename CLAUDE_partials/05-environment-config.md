# Environment Configuration

## Root .env File

```env
BUILD_ENV=dev                    # dev or prod

# App
APP_PORT=9999

# PostgreSQL
POSTGRES_IP=172.28.0.11
POSTGRES_USER=app
POSTGRES_PASSWORD=app
POSTGRES_DB=blazing_sun
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# pgAdmin
PGADMIN_IP=172.28.0.19
PGADMIN_PORT=5050
PGADMIN_DEFAULT_EMAIL=admin@blazingsun.app
PGADMIN_DEFAULT_PASSWORD=pgadmin_secret_password

# RabbitMQ (async tasks: notifications, emails)
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=app
RABBITMQ_PASSWORD=rabbitmq_secret_password
RABBITMQ_VHOST=/

# Kafka (event-driven: database mutations, user actions)
KAFKA_IP=172.28.0.17
KAFKA_HOST=kafka
KAFKA_PORT=9092
KAFKA_CONTROLLER_PORT=9093
KAFKA_BROKER_ID=1
KAFKA_CLUSTER_ID=MkU3OEVBNTcwNTJENDM2Qk
KAFKA_NUM_PARTITIONS=3
KAFKA_LOG_RETENTION_HOURS=168

# Kafka UI
KAFKA_UI_IP=172.28.0.18
KAFKA_UI_PORT=8080
KAFKA_UI_CLUSTER_NAME=blazing-sun
KAFKA_UI_USER=admin
KAFKA_UI_PASSWORD=kafka_ui_secret_password

# Redis
REDIS_IP=172.28.0.13
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_USER=app
REDIS_PASSWORD=redis_secret_password
REDIS_DB=0

# Email (SMTP)
MAIL_MAILER=smtp
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=<mailtrap_user>
MAIL_PASSWORD=<mailtrap_pass>
MAIL_FROM_ADDRESS=noreply@blazingsun.app
MAIL_FROM_NAME=BlazingSun

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
```

## Environment Sync

`rust/entrypoint.sh` syncs these env vars from Docker to `blazing_sun/.env` on startup:
- PORT, POSTGRES_*, REDIS_*, RABBITMQ_*, KAFKA_*, MAIL_*

This ensures the Rust application always has up-to-date configuration from the Docker environment.

## Build Modes

### Development Mode (`BUILD_ENV=dev`)
- Hot reload enabled (cargo-watch)
- Auto `sqlx prepare` on changes
- Debug logging enabled
- Source code mounted as volume
- Fast iteration cycle

### Production Mode (`BUILD_ENV=prod`)
- Release build (optimized binary)
- Compiled binary execution
- Minimal logs (info/warn/error)
- No hot reload
- Optimized for performance

## Docker Volumes

| Volume         | Purpose                    | Persistence |
|----------------|----------------------------|-------------|
| pgdata         | PostgreSQL data            | Persistent  |
| redisdata      | Redis data                 | Persistent  |
| rabbitmqdata   | RabbitMQ data              | Persistent  |
| kafkadata      | Kafka data                 | Persistent  |
| cargo-cache    | Cargo registry cache       | Cache       |
| target-cache   | Rust build cache           | Cache       |
| prometheusdata | Prometheus metrics         | Persistent  |
| grafanadata    | Grafana dashboards         | Persistent  |
| pgadmindata    | pgAdmin configuration      | Persistent  |

**Note**: Use `docker compose down -v` to delete all volumes (full reset).

## File Locations

| Configuration File | Purpose |
|-------------------|---------|
| `.env` (root) | Docker environment variables |
| `blazing_sun/.env` | Application environment (synced from Docker) |
| `nginx/default.conf.template` | Nginx configuration |
| `postgres/postgresql.conf.template` | PostgreSQL tuning |
| `redis/redis.conf` | Redis configuration |
| `rabbitmq/rabbitmq.conf` | RabbitMQ configuration |
| `kafka/entrypoint.sh` | Kafka topic creation |
| `prometheus/prometheus.yml` | Prometheus scrape config |
| `grafana/provisioning/` | Grafana datasources/dashboards |
