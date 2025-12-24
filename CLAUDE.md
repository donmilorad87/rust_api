# CLAUDE.md

This file provides guidance to Claude Code when working with the infrastructure in this repository.

> **Application code is in `money_flow/` folder.** See `money_flow/CLAUDE.md` for application-specific guidance.

## Project Overview

**Money Flow** - Docker-based infrastructure for a Rust web application (Actix-web + PostgreSQL + Redis + RabbitMQ + Kafka).

## High-Level Architecture

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

## Complete Infrastructure Structure

```
.
├── docker-compose.yml          # Service orchestration (10 services)
├── .env                        # Docker environment variables
├── .env.example                # Example environment file
├── firewall-setup.sh           # UFW firewall config for production
├── CLAUDE.md                   # This file (infrastructure docs)
├── README.md                   # Project overview and quick start
│
├── rust/                       # Rust container
│   ├── Dockerfile              # Multi-stage (dev/prod)
│   ├── entrypoint.sh           # Syncs env vars, starts app
│   ├── cargo.config.toml       # Cargo network settings
│   ├── install.dev.sh          # Dev tools (sqlx-cli, cargo-watch)
│   └── install.prod.sh         # Production build
│
├── postgres/                   # PostgreSQL container
│   ├── Dockerfile
│   ├── entrypoint.sh           # Creates database if not exists
│   ├── pg_hba.conf             # Authentication rules
│   └── postgresql.conf.template # Performance tuning
│
├── redis/                      # Redis container
│   ├── Dockerfile
│   ├── entrypoint.sh           # Sets up ACL users
│   └── redis.conf              # Memory, persistence config
│
├── rabbitmq/                   # RabbitMQ container (async tasks)
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── rabbitmq.conf           # Cluster, memory settings
│   └── definitions.json        # Pre-configured queues/exchanges
│
├── kafka/                      # Kafka container (event streaming)
│   ├── Dockerfile              # Apache Kafka (KRaft mode, no Zookeeper)
│   └── entrypoint.sh           # Creates topics on startup
│
├── kafka-ui/                   # Kafka management UI
│   ├── Dockerfile
│   └── entrypoint.sh
│
├── nginx/                      # Nginx reverse proxy
│   ├── Dockerfile
│   └── default.conf.template   # SSL, proxy, static file serving
│
├── pgadmin/                    # PostgreSQL admin panel
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── servers.json            # Pre-configured postgres connection
│
├── prometheus/                 # Prometheus monitoring
│   ├── Dockerfile
│   └── prometheus.yml          # Scrape targets configuration
│
├── grafana/                    # Grafana dashboards
│   ├── Dockerfile
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── datasources.yml # Prometheus datasource
│   │   └── dashboards/
│   │       └── dashboards.yml  # Dashboard provisioning
│   └── dashboards/             # JSON dashboard definitions
│
└── money_flow/                 # APPLICATION CODE (see money_flow/CLAUDE.md)
    ├── src/                    # Rust source code
    ├── migrations/             # SQLx database migrations
    ├── storage/                # File storage
    │   └── app/
    │       ├── public/         # Publicly accessible files (nginx serves)
    │       └── private/        # Private files (API serves)
    ├── Cargo.toml
    └── CLAUDE.md               # App-specific guidance
```

---

## Services Reference

| Service    | IP           | Port(s)       | Healthcheck                          | Purpose                              |
|------------|--------------|---------------|--------------------------------------|--------------------------------------|
| rust       | 172.28.0.10  | 9999          | -                                    | Actix-web application                |
| postgres   | 172.28.0.11  | 5432          | `pg_isready -U app -d money_flow`    | PostgreSQL database                  |
| nginx      | 172.28.0.12  | 80/443        | -                                    | SSL reverse proxy + static files     |
| redis      | 172.28.0.13  | 6379          | `redis-cli -a password ping`         | Cache/session store                  |
| rabbitmq   | 172.28.0.14  | 5672/15672    | `rabbitmq-diagnostics -q ping`       | Message queue (async tasks)          |
| prometheus | 172.28.0.15  | 9090          | -                                    | Metrics collection                   |
| grafana    | 172.28.0.16  | 3000          | -                                    | Monitoring dashboards                |
| kafka      | 172.28.0.17  | 9092/9093     | Broker API + topics exist            | Event streaming (KRaft mode)         |
| kafka-ui   | 172.28.0.18  | 8080          | -                                    | Kafka management UI                  |
| pgadmin    | 172.28.0.19  | 5050          | -                                    | PostgreSQL admin panel               |

**Network**: `devnet` (172.28.0.0/16)

---

## Startup Sequence & Dependencies

Services start with proper healthcheck-based dependencies:

```
Phase 1: Infrastructure (parallel start)
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis     │ │  RabbitMQ    │ │    Kafka     │
│ Healthcheck: │ │ Healthcheck: │ │ Healthcheck: │ │ Healthcheck: │
│ pg_isready   │ │ redis-cli    │ │ rabbitmq-    │ │ broker API + │
│              │ │   ping       │ │ diagnostics  │ │ topics exist │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                │
       └────────────────┴────────────────┴────────────────┘
                                │
                                ▼
Phase 2: Application (waits for Phase 1 healthy)
┌─────────────────────────────────────────────────────────────────┐
│                           Rust App                               │
│   depends_on: postgres(healthy), redis(healthy),                 │
│               rabbitmq(healthy), kafka(healthy)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
Phase 3: UI Services
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  Nginx   │ │ Kafka UI │ │ pgAdmin  │ │ Grafana  │
│(on rust) │ │(on kafka)│ │(on pg)   │ │(on prom) │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## Docker Commands Reference

```bash
# Start/stop
docker compose up -d
docker compose down
docker compose restart rust

# Logs
docker compose logs -f rust
docker compose logs -f postgres
docker compose logs -f kafka
docker compose logs -f rabbitmq

# Enter containers
docker compose exec rust bash
docker compose exec postgres psql -U app -d money_flow
docker compose exec redis redis-cli -a redis_secret_password
docker compose exec kafka bash

# Rebuild
docker compose up -d --build
docker compose build --no-cache rust
docker compose build --no-cache    # Rebuild all

# Full reset (deletes data)
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

---

## Environment Variables (Root .env)

```env
BUILD_ENV=dev                    # dev or prod

# App
APP_PORT=9999

# PostgreSQL
POSTGRES_IP=172.28.0.11
POSTGRES_USER=app
POSTGRES_PASSWORD=app
POSTGRES_DB=money_flow
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# pgAdmin
PGADMIN_IP=172.28.0.19
PGADMIN_PORT=5050
PGADMIN_DEFAULT_EMAIL=admin@moneyflow.app
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
KAFKA_UI_CLUSTER_NAME=money-flow
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
MAIL_FROM_ADDRESS=noreply@moneyflow.app
MAIL_FROM_NAME=MoneyFlow

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
```

---

## Environment Sync

`rust/entrypoint.sh` syncs these env vars from Docker to `money_flow/.env` on startup:
- PORT, POSTGRES_*, REDIS_*, RABBITMQ_*, KAFKA_*, MAIL_*

---

## Build Modes

- **dev**: Hot reload (cargo-watch), auto `sqlx prepare`, debug logs
- **prod**: Release build, compiled binary, minimal logs

---

## Volumes

| Volume         | Purpose                    |
|----------------|----------------------------|
| pgdata         | PostgreSQL data            |
| redisdata      | Redis data                 |
| rabbitmqdata   | RabbitMQ data              |
| kafkadata      | Kafka data                 |
| cargo-cache    | Cargo registry cache       |
| target-cache   | Rust build cache           |
| prometheusdata | Prometheus metrics         |
| grafanadata    | Grafana dashboards         |
| pgadmindata    | pgAdmin configuration      |

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

## Web UIs

| Service     | URL                           | Credentials                          |
|-------------|-------------------------------|--------------------------------------|
| Application | https://localhost/            | -                                    |
| RabbitMQ    | http://localhost:15672        | app / rabbitmq_secret_password       |
| Kafka UI    | http://localhost:8080/kafka   | admin / kafka_ui_secret_password     |
| pgAdmin     | http://localhost:5050/pgadmin | admin@moneyflow.app / pgadmin_secret_password |
| Grafana     | https://localhost/grafana/    | admin / admin                        |
| Prometheus  | http://localhost:9090         | -                                    |

---

## Nginx Configuration

Nginx serves multiple purposes:

1. **SSL Termination**: HTTPS on port 443, redirects HTTP 80 to HTTPS
2. **Reverse Proxy**: Routes requests to Rust app on port 9999
3. **Static File Serving**: `/storage/` serves public files from `money_flow/storage/app/public/`
4. **Sub-path Routing**: `/grafana/` proxies to Grafana dashboard

---

## Common Issues

### Stale files in container
```bash
docker compose restart rust
```

### Database connection failed
```bash
docker compose logs postgres
docker compose exec postgres pg_isready -U app -d money_flow
```

### Redis connection failed
```bash
docker compose exec redis redis-cli -a redis_secret_password ping
```

### RabbitMQ connection failed
```bash
docker compose logs rabbitmq
docker compose exec rabbitmq rabbitmq-diagnostics -q ping
```

### Kafka connection failed
```bash
docker compose logs kafka
docker compose exec kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092
```

### List Kafka topics
```bash
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092
```

### Consume Kafka messages (for debugging)
```bash
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic user.events \
    --from-beginning
```

### Rebuild from scratch
```bash
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

---

## File Locations

- Docker env: `.env` (root)
- App env: `money_flow/.env`
- Nginx config: `nginx/default.conf.template`
- PostgreSQL config: `postgres/postgresql.conf.template`
- Redis config: `redis/redis.conf`
- RabbitMQ config: `rabbitmq/rabbitmq.conf`
- Kafka entrypoint: `kafka/entrypoint.sh` (creates topics)
- Prometheus config: `prometheus/prometheus.yml`
- Grafana provisioning: `grafana/provisioning/`

---

## Technology Versions

All services use `:latest` or `:alpine` tags with system updates during build:

| Service | Base Image |
|---------|-----------|
| Rust | debian:bookworm-slim + rustup stable |
| PostgreSQL | postgres:latest |
| Redis | redis:alpine |
| RabbitMQ | rabbitmq:management-alpine |
| Kafka | apache/kafka:latest (KRaft mode) |
| Kafka UI | provectuslabs/kafka-ui:latest |
| Nginx | nginx:alpine |
| pgAdmin | dpage/pgadmin4:latest |
| Grafana | grafana/grafana:latest |
| Prometheus | prom/prometheus:latest |

---

## Adding New Infrastructure

### New Docker Service
1. Create folder: `<service>/Dockerfile`, `<service>/entrypoint.sh`
2. Add service to `docker-compose.yml` with:
   - Static IP in 172.28.0.x range
   - Healthcheck if other services depend on it
   - Volume for data persistence
3. Add environment variables to `.env` and `.env.example`
4. Update this documentation

### New Kafka Topic
1. Edit `kafka/entrypoint.sh` - add topic to `TOPICS` variable
2. Restart Kafka: `docker compose restart kafka`

### New Volume
1. Add to `docker-compose.yml` volumes section
2. Reference in service's volumes

### SSL Certificates (Production)
```bash
docker cp your-cert.pem rust-nginx-1:/etc/nginx/ssl/cert.pem
docker cp your-key.pem rust-nginx-1:/etc/nginx/ssl/key.pem
docker compose restart nginx
```
