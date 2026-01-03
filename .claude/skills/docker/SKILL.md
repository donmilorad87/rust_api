---
name: docker
description: Docker infrastructure management. Container operations, service debugging, networking, and docker-compose management. (project)
invocable: true
---

# Docker Skill

Complete Docker knowledge for the Blazing Sun infrastructure.

---

## Documentation Reference

**Documentation folder**: `/home/milner/Desktop/rust/Documentation/`

### Relevant Documentation

| Documentation | Path | When to Reference |
|--------------|------|-------------------|
| **Infrastructure** | `Documentation/docker_infrastructure/INFRASTRUCTURE.md` | Complete Docker setup, services, networking |
| **Database** | `Documentation/blazing_sun/Database/DATABASE.md` | PostgreSQL container, connections |
| **MongoDB** | `Documentation/blazing_sun/MongoDB/MONGODB.md` | MongoDB container config |
| **Events** | `Documentation/blazing_sun/Events/EVENTS.md` | Kafka container, topics |
| **Message Queue** | `Documentation/blazing_sun/MessageQueue/MESSAGE_QUEUE.md` | RabbitMQ container, queues |

### When to Update Documentation

After infrastructure changes, update:
- New service → Update `INFRASTRUCTURE.md`
- Network changes → Update `INFRASTRUCTURE.md`
- Volume changes → Update `INFRASTRUCTURE.md`
- New Kafka topic → Update `EVENTS.md`

---

## TDD Awareness

This project follows TDD-first methodology.

### Running Tests in Docker

```bash
# All tests
docker compose exec rust cargo test

# With output
docker compose exec rust cargo test -- --nocapture

# Specific test
docker compose exec rust cargo test test_sign_in

# Integration tests
docker compose exec rust cargo test --test integration
```

### Test Location
Tests are at: `blazing_sun/tests/routes/`

---

## Infrastructure Architecture

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                      DOCKER NETWORK                          │
                                    │                      devnet (172.28.0.0/16)                  │
                                    │                                                              │
    ┌──────────┐                    │  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐  │
    │  Client  │────HTTPS────────────▶│  Nginx   │───▶│   Rust   │───▶│     PostgreSQL       │  │
    │ Browser  │                    │  │  :443   │    │  :9999   │    │       :5432          │  │
    └──────────┘                    │  │ :80→443 │    │          │    │                      │  │
                                    │  └────┬─────┘    └────┬─────┘    └──────────────────────┘  │
                                    │       │               │                    │               │
                                    │       │               │               ┌────┴────┐          │
                                    │  /storage/            │               │ pgAdmin │          │
                                    │  (static files)       │               │  :5050  │          │
                                    │       │               │               └─────────┘          │
                                    │       │               │                                     │
                                    │       │               │  ┌──────────────────────────────┐  │
                                    │       │               ├──│        Redis :6379           │  │
                                    │       │               │  │    (Cache/Sessions)          │  │
                                    │       │               │  └──────────────────────────────┘  │
                                    │       │               │                                     │
                                    │       │               │  ┌──────────────────────────────┐  │
                                    │       │               ├──│    RabbitMQ :5672            │  │
                                    │       │               │  │  (Async Tasks: Email, Jobs)  │  │
                                    │       │               │  │  Management UI: :15672       │  │
                                    │       │               │  └──────────────────────────────┘  │
                                    │       │               │                                     │
                                    │       │               │  ┌──────────────────────────────┐  │
                                    │       │               └──│      Kafka :9092             │  │
                                    │       │                  │ (Events: DB Mutations, Auth) │  │
                                    │       │                  │     KRaft Mode (no ZK)       │  │
                                    │       │                  └──────────────────────────────┘  │
                                    │       │                              │                      │
                                    │       │                         ┌────┴────┐                │
                                    │       │                         │Kafka UI │                │
                                    │       │                         │  :8080  │                │
                                    │       │                         └─────────┘                │
                                    │       │                                                     │
                                    │  ┌────┴─────┐    ┌──────────┐                              │
                                    │  │Prometheus│───▶│ Grafana  │                              │
                                    │  │  :9090   │    │  :3000   │                              │
                                    │  └──────────┘    └──────────┘                              │
                                    │                                                              │
                                    └─────────────────────────────────────────────────────────────┘
```

---

## Services Reference

### Core Services

| Service  | Image Name       | IP           | Port(s)     | Healthcheck                          |
|----------|------------------|--------------|-------------|--------------------------------------|
| rust     | rust-app-${ENV}  | 172.28.0.10  | 9999        | -                                    |
| postgres | postgres-ssl     | 172.28.0.11  | 5432        | `pg_isready -U app -d blazing_sun`    |
| nginx    | nginx-ssl        | 172.28.0.12  | 80/443      | -                                    |
| redis    | redis-pubsub     | 172.28.0.13  | 6379        | `redis-cli -a password ping`         |
| rabbitmq | rabbitmq-mq      | 172.28.0.14  | 5672/15672  | `rabbitmq-diagnostics -q ping`       |

### Event & Monitoring Services

| Service    | Image Name           | IP           | Port(s)     | Depends On |
|------------|----------------------|--------------|-------------|------------|
| kafka      | kafka-events         | 172.28.0.17  | 9092/9093   | -          |
| kafka-ui   | kafka-ui-dashboard   | 172.28.0.18  | 8080        | kafka      |
| prometheus | prometheus-monitoring| 172.28.0.15  | 9090        | rabbitmq   |
| grafana    | grafana-monitoring   | 172.28.0.16  | 3000        | prometheus |
| pgadmin    | pgadmin-dashboard    | 172.28.0.19  | 5050        | postgres   |

### Document Store Services

| Service       | Image Name           | IP           | Port(s)     | Depends On |
|---------------|----------------------|--------------|-------------|------------|
| mongo         | mongo-db             | 172.28.0.20  | 27017       | -          |
| mongo-express | mongo-express-ui     | 172.28.0.21  | 8081        | mongo      |

---

## Message Broker Strategy

### RabbitMQ (Task Queue)
- **Purpose**: Async job processing with per-message acknowledgment
- **Use Cases**: Email sending, user creation, background tasks
- **Queues**: `jobs` (priority 0-10), `jobs_failed` (dead letter)
- **Pattern**: Command/Task - "Do this work reliably"

### Kafka (Event Streaming)
- **Purpose**: Immutable event log with multiple consumers
- **Use Cases**: User events, auth events, transaction events, audit logs
- **Topics**: `user.events`, `auth.events`, `transaction.events`, `category.events`
- **Pattern**: Event Sourcing - "This fact happened"

### When to Use Which

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

---

## Kafka Topics

| Topic | Description | Event Types |
|-------|-------------|-------------|
| user.events | User lifecycle events | created, updated, deleted, activated, password_changed |
| auth.events | Authentication events | sign_in, sign_in_failed, sign_out, password_reset |
| transaction.events | Financial transactions | created, updated, deleted |
| category.events | Category management | created, updated, deleted |
| system.events | System-level events | health_check, error, warning |
| events.dead_letter | Failed events | All types (for reprocessing) |

---

## Volumes

| Volume         | Mount Point                    | Purpose                |
|----------------|--------------------------------|------------------------|
| pgdata         | /var/lib/postgresql            | PostgreSQL data        |
| redisdata      | /data                          | Redis persistence      |
| rabbitmqdata   | /var/lib/rabbitmq              | RabbitMQ queues        |
| kafkadata      | /var/lib/kafka/data            | Kafka event logs       |
| cargo-cache    | /usr/local/cargo/registry      | Rust crate cache       |
| target-cache   | /home/rust/blazing_sun/target   | Rust build cache       |
| prometheusdata | /prometheus                    | Metrics data           |
| grafanadata    | /var/lib/grafana               | Dashboards/config      |
| pgadmindata    | /var/lib/pgadmin               | pgAdmin config         |
| mongodata      | /data/db                       | MongoDB data           |

---

## Nginx Volume Mounts

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `./blazing_sun/storage/app/public` | `/var/www/storage/public:ro` | Public file serving at `/storage/` |
| `./blazing_sun/src/resources/css` | `/var/www/assets/css:ro` | CSS assets at `/assets/css/` |
| `./blazing_sun/src/resources/js` | `/var/www/assets/js:ro` | JS assets at `/assets/js/` |

---

## Environment Variables

### Root `.env` (Docker level)

```env
# Build mode
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

# RabbitMQ
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=app
RABBITMQ_PASSWORD=rabbitmq_secret_password
RABBITMQ_VHOST=/

# Kafka
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

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin

# MongoDB
MONGO_IP=172.28.0.20
MONGO_HOST=mongo
MONGO_PORT=27017
MONGO_INITDB_ROOT_USERNAME=root
MONGO_INITDB_ROOT_PASSWORD=mongo_root_password
MONGO_INITDB_DATABASE=blazing_sun
MONGO_USER=app
MONGO_PASSWORD=mongo_secret_password
MONGO_URL=mongodb://app:mongo_secret_password@mongo:27017/blazing_sun

# Mongo Express (MongoDB Admin UI)
MONGO_EXPRESS_IP=172.28.0.21
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=mongo_express_password
```

### App `.env` (Rust level - synced from Docker)

These are synced by `rust/entrypoint.sh`:
- `PORT`, `POSTGRES_*`, `REDIS_*`, `RABBITMQ_*`, `KAFKA_*`, `MAIL_*`, `MONGO_*`

---

## Environment Variable Sync Pattern

**IMPORTANT**: This project uses a two-level .env architecture:

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Level (.env)                           │
│                                                                  │
│  Location: /home/milner/Desktop/rust/.env                       │
│  Purpose: Docker Compose variables for container orchestration   │
│                                                                  │
│  Contains: All service credentials, IPs, ports                   │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      │ rust/entrypoint.sh
                                      │ (syncs on container startup)
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Application Level (.env)                         │
│                                                                  │
│  Location: /home/milner/Desktop/rust/blazing_sun/.env            │
│  Purpose: Rust application configuration                         │
│                                                                  │
│  Contains: Connection strings for databases, queues, etc.        │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step: Adding New Service Variables

1. **Add variables to root `.env`** (Docker level)
   ```env
   # In /home/milner/Desktop/rust/.env
   NEW_SERVICE_HOST=newservice
   NEW_SERVICE_PORT=1234
   NEW_SERVICE_USER=app
   NEW_SERVICE_PASSWORD=secret_password
   ```

2. **Update `rust/entrypoint.sh`** to sync variables
   ```bash
   # Add to the sync section in rust/entrypoint.sh
   update_env "NEW_SERVICE_HOST" "$NEW_SERVICE_HOST"
   update_env "NEW_SERVICE_PORT" "$NEW_SERVICE_PORT"
   update_env "NEW_SERVICE_USER" "$NEW_SERVICE_USER"
   update_env "NEW_SERVICE_PASSWORD" "$NEW_SERVICE_PASSWORD"
   # Construct connection URL
   update_env "NEW_SERVICE_URL" "protocol://${NEW_SERVICE_USER}:${NEW_SERVICE_PASSWORD}@${NEW_SERVICE_HOST}:${NEW_SERVICE_PORT}"
   ```

3. **Add to `docker-compose.yml`** service environment
   ```yaml
   rust:
     environment:
       - NEW_SERVICE_HOST=${NEW_SERVICE_HOST}
       - NEW_SERVICE_PORT=${NEW_SERVICE_PORT}
       # ... etc
   ```

4. **Restart the Rust container** to trigger sync
   ```bash
   docker compose restart rust
   ```

### Why This Pattern?

| Benefit | Explanation |
|---------|-------------|
| **Single Source of Truth** | All credentials in one place (root `.env`) |
| **Docker Isolation** | Containers get variables via `docker-compose.yml` |
| **App Configuration** | Rust app reads from `blazing_sun/.env` |
| **Connection URLs** | Entrypoint constructs URLs from individual vars |
| **Security** | `.env` files are gitignored |

### Variables Synced by `rust/entrypoint.sh`

| Category | Variables |
|----------|-----------|
| App | `PORT` |
| PostgreSQL | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_IP` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_IP`, `REDIS_URL` |
| RabbitMQ | `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`, `RABBITMQ_URL` |
| Kafka | `KAFKA_HOST`, `KAFKA_PORT`, `KAFKA_BROKERS` |
| MongoDB | `MONGO_HOST`, `MONGO_PORT`, `MONGO_USER`, `MONGO_PASSWORD`, `MONGO_INITDB_DATABASE`, `MONGO_URL` |
| Email | `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` |

---

## Commands Quick Reference

### Lifecycle

```bash
docker compose up -d              # Start all
docker compose down               # Stop all
docker compose down -v            # Stop + remove volumes
docker compose restart <service>  # Restart one
docker compose up -d --build      # Rebuild and start
```

### Logs & Debug

```bash
docker compose logs -f <service>      # Follow logs
docker compose logs --tail=100 rust   # Last 100 lines
docker compose exec <service> bash    # Enter container
docker compose ps                     # Show status
docker stats                          # Resource usage
```

### Build

```bash
docker compose build                  # Build all
docker compose build --no-cache       # Clean build
docker compose build <service>        # Build one
```

### Database

```bash
# PostgreSQL
docker compose exec postgres psql -U app -d blazing_sun
docker compose exec postgres pg_dump -U app blazing_sun > backup.sql
docker compose exec -T postgres psql -U app -d blazing_sun < backup.sql

# Redis
docker compose exec redis redis-cli -a redis_secret_password
docker compose exec redis redis-cli -a redis_secret_password KEYS '*'

# MongoDB
docker compose exec mongo mongosh -u app -p mongo_secret_password --authenticationDatabase blazing_sun blazing_sun
docker compose exec mongo mongosh -u root -p mongo_root_password --authenticationDatabase admin

# MongoDB backup/restore
docker compose exec mongo mongodump -u root -p mongo_root_password --authenticationDatabase admin --out /data/backup
docker compose exec mongo mongorestore -u root -p mongo_root_password --authenticationDatabase admin /data/backup
```

### Message Queues

```bash
# RabbitMQ
docker compose exec rabbitmq rabbitmqctl list_queues
docker compose exec rabbitmq rabbitmqctl purge_queue jobs

# Kafka
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 --topic user.events --from-beginning
```

### Healthchecks

```bash
# PostgreSQL
docker compose exec postgres pg_isready -U app -d blazing_sun

# Redis
docker compose exec redis redis-cli -a redis_secret_password ping

# RabbitMQ
docker compose exec rabbitmq rabbitmq-diagnostics -q ping

# Kafka
docker compose exec kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# MongoDB
docker compose exec mongo mongosh --eval "db.adminCommand('ping')" --quiet
```

---

## File Locations

| Type | Path |
|------|------|
| docker-compose.yml | `/home/milner/Desktop/rust/docker-compose.yml` |
| Root .env | `/home/milner/Desktop/rust/.env` |
| App .env | `/home/milner/Desktop/rust/blazing_sun/.env` |
| Rust Dockerfile | `/home/milner/Desktop/rust/rust/Dockerfile` |
| Rust entrypoint | `/home/milner/Desktop/rust/rust/entrypoint.sh` |
| Nginx Dockerfile | `/home/milner/Desktop/rust/nginx/Dockerfile` |
| Nginx config | `/home/milner/Desktop/rust/nginx/default.conf.template` |
| PostgreSQL Dockerfile | `/home/milner/Desktop/rust/postgres/Dockerfile` |
| PostgreSQL config | `/home/milner/Desktop/rust/postgres/postgresql.conf.template` |
| Redis Dockerfile | `/home/milner/Desktop/rust/redis/Dockerfile` |
| Redis config | `/home/milner/Desktop/rust/redis/redis.conf` |
| RabbitMQ Dockerfile | `/home/milner/Desktop/rust/rabbitmq/Dockerfile` |
| RabbitMQ config | `/home/milner/Desktop/rust/rabbitmq/rabbitmq.conf` |
| RabbitMQ definitions | `/home/milner/Desktop/rust/rabbitmq/definitions.json` |
| Kafka Dockerfile | `/home/milner/Desktop/rust/kafka/Dockerfile` |
| Kafka entrypoint | `/home/milner/Desktop/rust/kafka/entrypoint.sh` |
| MongoDB Dockerfile | `/home/milner/Desktop/rust/mongo/Dockerfile` |
| MongoDB entrypoint | `/home/milner/Desktop/rust/mongo/entrypoint.sh` |
| Mongo Express Dockerfile | `/home/milner/Desktop/rust/mongo-express/Dockerfile` |
| Prometheus config | `/home/milner/Desktop/rust/prometheus/prometheus.yml` |
| Grafana provisioning | `/home/milner/Desktop/rust/grafana/provisioning/` |

---

## Web UIs

| Service       | URL                           | Credentials                          |
|---------------|-------------------------------|--------------------------------------|
| Application   | https://localhost/            | -                                    |
| Mongo Express | https://localhost/mongo/      | admin / mongo_express_password       |
| RabbitMQ      | http://localhost:15672        | app / rabbitmq_secret_password       |
| Kafka UI      | http://localhost:8080/kafka   | admin / kafka_ui_secret_password     |
| pgAdmin       | http://localhost:5050/pgadmin | admin@blazingsun.app / pgadmin_secret_password |
| Grafana       | https://localhost/grafana/    | admin / admin                        |
| Prometheus    | http://localhost:9090         | -                                    |

---

## Troubleshooting Guide

### Service Won't Start

1. Check logs: `docker compose logs <service>`
2. Check dependencies: `docker compose ps`
3. Verify healthcheck: Run healthcheck command manually
4. Check port conflicts: `sudo lsof -i :<port>`

### Container Unhealthy

1. Check healthcheck command: `docker inspect <container>`
2. Enter container: `docker compose exec <service> bash`
3. Run healthcheck manually inside container
4. Check service-specific logs

### Network Connectivity Issues

1. Verify network exists: `docker network ls | grep devnet`
2. Check container IP: `docker inspect <container> | grep IPAddress`
3. Test ping between containers: `docker compose exec rust ping postgres`
4. Check DNS resolution: `docker compose exec rust nslookup postgres`

### Volume Issues

1. List volumes: `docker volume ls`
2. Inspect volume: `docker volume inspect rust_pgdata`
3. Check mount: `docker compose exec <service> ls -la /mount/path`
4. Reset volume (DESTRUCTIVE): `docker volume rm rust_pgdata`

### Full Reset

```bash
# Nuclear option - removes everything
docker compose down -v
docker system prune -af
docker volume prune -f
docker compose build --no-cache
docker compose up -d
```

---

## Dockerfile Best Practices

### Multi-stage Build Example

```dockerfile
# Build stage
FROM rust:1.75 AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN cargo fetch
COPY src ./src
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/blazing_sun /usr/local/bin/
USER 1000
CMD ["blazing_sun"]
```

### Entrypoint Pattern

```bash
#!/bin/bash
set -e

# Wait for dependencies
until pg_isready -h $POSTGRES_HOST -U $POSTGRES_USER; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

# Run migrations
sqlx migrate run

# Start application
exec "$@"
```

---

## Docker Compose Patterns

### Healthcheck with Dependencies

```yaml
service-a:
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 30s

service-b:
  depends_on:
    service-a:
      condition: service_healthy
```

### Environment Variable Substitution

```yaml
environment:
  - DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}
```

### Static IP Assignment

```yaml
networks:
  devnet:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16

services:
  myservice:
    networks:
      devnet:
        ipv4_address: 172.28.0.XX
```

---

## Adding New Services

### Checklist

1. Create folder: `<service>/Dockerfile`, `<service>/entrypoint.sh`
2. Add to `docker-compose.yml`:
   - Build context and Dockerfile
   - Static IP in 172.28.0.x range
   - Healthcheck (if others depend on it)
   - Volume for data persistence
   - Environment variables from `.env`
3. Add variables to `.env` and `.env.example`
4. Update `/home/milner/Desktop/rust/CLAUDE.md` documentation
5. Update this skill file

### IP Address Allocation

| Range | Reserved For |
|-------|--------------|
| 172.28.0.10 | Rust app |
| 172.28.0.11 | PostgreSQL |
| 172.28.0.12 | Nginx |
| 172.28.0.13 | Redis |
| 172.28.0.14 | RabbitMQ |
| 172.28.0.15 | Prometheus |
| 172.28.0.16 | Grafana |
| 172.28.0.17 | Kafka |
| 172.28.0.18 | Kafka UI |
| 172.28.0.19 | pgAdmin |
| 172.28.0.20 | MongoDB |
| 172.28.0.21 | Mongo Express |
| 172.28.0.22-99 | Available for new services |

---

## Security Considerations

1. **Never commit secrets** - Use `.env` files and add to `.gitignore`
2. **Use non-root users** - Add `USER 1000` in Dockerfiles
3. **Limit resources** - Use `deploy.resources` in production
4. **Network isolation** - Use custom bridge networks
5. **Read-only mounts** - Use `:ro` suffix when containers don't need write access
6. **Health checks** - Prevent routing to unhealthy containers
