# Blazing Sun - Infrastructure

Docker-based infrastructure for the Blazing Sun application with event-driven architecture.

> **Application code is located in the `blazing_sun/` folder.** See [blazing_sun/README.md](blazing_sun/README.md) for application documentation.

---

## Architecture Overview

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

### Dual Messaging Strategy

| System    | Purpose                                        | Use Case                              |
|-----------|------------------------------------------------|---------------------------------------|
| RabbitMQ  | Task/Command processing (work queue)           | Emails, user creation, background jobs|
| Kafka     | Event streaming (pub/sub, immutable log)       | Audit logs, analytics, notifications  |

---

## Quick Start

```bash
# Clone and setup
cp .env.example .env
# Edit .env with your values

# Start all services
docker compose up -d

# View logs
docker compose logs -f rust

# Enter the rust container
docker compose exec rust bash
```

---

## Services

| Service    | Container IP  | Port(s)       | Healthcheck                          | Description                        |
|------------|---------------|---------------|--------------------------------------|------------------------------------|
| rust       | 172.28.0.10   | 9999          | -                                    | Actix-web application              |
| postgres   | 172.28.0.11   | 5432          | `pg_isready`                         | PostgreSQL database                |
| nginx      | 172.28.0.12   | 80, 443       | -                                    | Reverse proxy with SSL + static    |
| redis      | 172.28.0.13   | 6379          | `redis-cli ping`                     | Cache and session store            |
| rabbitmq   | 172.28.0.14   | 5672, 15672   | `rabbitmq-diagnostics ping`          | Message queue (async tasks)        |
| prometheus | 172.28.0.15   | 9090          | -                                    | Metrics collection                 |
| grafana    | 172.28.0.16   | 3000          | -                                    | Monitoring dashboards              |
| kafka      | 172.28.0.17   | 9092, 9093    | Broker API + topics exist            | Event streaming (KRaft mode)       |
| kafka-ui   | 172.28.0.18   | 8080          | -                                    | Kafka management UI                |
| pgadmin    | 172.28.0.19   | 5050          | -                                    | PostgreSQL admin panel             |

### Network

All services run on a custom bridge network `devnet` with subnet `172.28.0.0/16`.

---

## Startup Sequence

Services start in dependency order with healthchecks ensuring readiness:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           STARTUP SEQUENCE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: Infrastructure Services (start in parallel)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  PostgreSQL  │  │    Redis     │  │  RabbitMQ    │  │    Kafka     │    │
│  │              │  │              │  │              │  │              │    │
│  │ Healthcheck: │  │ Healthcheck: │  │ Healthcheck: │  │ Healthcheck: │    │
│  │ pg_isready   │  │ redis-cli    │  │ rabbitmq-    │  │ broker API + │    │
│  │              │  │   ping       │  │ diagnostics  │  │ topics exist │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│         └─────────────────┴─────────────────┴─────────────────┘             │
│                                     │                                        │
│                                     ▼                                        │
│  Phase 2: Application (waits for all Phase 1 services to be healthy)        │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                          Rust App                                 │       │
│  │   depends_on: postgres, redis, rabbitmq, kafka (all healthy)      │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                     │                                        │
│                                     ▼                                        │
│  Phase 3: Proxy & UI Services (start after rust)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    Nginx     │  │   Kafka UI   │  │   pgAdmin    │  │   Grafana    │    │
│  │  (depends    │  │  (depends    │  │  (depends    │  │  (depends    │    │
│  │   on rust)   │  │   on kafka)  │  │ on postgres) │  │on prometheus)│    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Healthcheck Configuration

```yaml
# PostgreSQL - ready to accept connections
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
  interval: 5s
  timeout: 5s
  retries: 5
  start_period: 10s

# Redis - responds to PING
healthcheck:
  test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
  interval: 5s
  timeout: 5s
  retries: 5
  start_period: 5s

# RabbitMQ - broker is running
healthcheck:
  test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s

# Kafka - broker ready AND topics created
healthcheck:
  test: ["CMD-SHELL", "kafka-broker-api-versions.sh && kafka-topics.sh --list | grep 'user.events'"]
  interval: 10s
  timeout: 10s
  retries: 10
  start_period: 40s
```

---

## Project Structure

```
.
├── docker-compose.yml          # Orchestrates all services
├── .env                        # Environment variables for Docker
├── .env.example                # Example environment file
├── firewall-setup.sh           # UFW firewall configuration
├── CLAUDE.md                   # AI assistant guidance (infrastructure)
├── README.md                   # This file
│
├── rust/                       # Rust container configuration
│   ├── Dockerfile              # Multi-stage build (dev/prod)
│   ├── entrypoint.sh           # Startup script, syncs env vars
│   ├── cargo.config.toml       # Cargo configuration
│   ├── install.dev.sh          # Dev dependencies (sqlx-cli, cargo-watch)
│   └── install.prod.sh         # Production build script
│
├── postgres/                   # PostgreSQL container
│   ├── Dockerfile
│   ├── entrypoint.sh           # Database initialization
│   ├── pg_hba.conf             # Authentication config
│   └── postgresql.conf.template # PostgreSQL settings
│
├── redis/                      # Redis container (cache)
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── redis.conf              # Redis configuration with ACL
│
├── rabbitmq/                   # RabbitMQ container (async tasks)
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── rabbitmq.conf           # RabbitMQ configuration
│   └── definitions.json        # Pre-configured queues/exchanges
│
├── kafka/                      # Kafka container (event streaming)
│   ├── Dockerfile              # Apache Kafka (KRaft mode)
│   └── entrypoint.sh           # Creates topics on startup
│
├── kafka-ui/                   # Kafka management UI
│   ├── Dockerfile
│   └── entrypoint.sh
│
├── nginx/                      # Nginx reverse proxy
│   ├── Dockerfile
│   └── default.conf.template   # SSL/HTTPS proxy + static file serving
│
├── pgadmin/                    # PostgreSQL admin panel
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── servers.json            # Pre-configured server connection
│
├── prometheus/                 # Prometheus monitoring
│   ├── Dockerfile
│   └── prometheus.yml          # Scrape configuration
│
├── grafana/                    # Grafana dashboards
│   ├── Dockerfile
│   ├── dashboards/             # Pre-built dashboards
│   └── provisioning/           # Datasources and dashboard config
│
└── blazing_sun/                 # APPLICATION SOURCE CODE
    ├── src/                    # Rust source code
    ├── migrations/             # Database migrations
    ├── storage/                # File storage (public/private)
    ├── Cargo.toml              # Rust dependencies
    ├── README.md               # Application documentation
    └── CLAUDE.md               # AI assistant guidance (app)
```

---

## Docker Commands

### Basic Operations

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart rust

# View service status
docker compose ps

# View logs (follow mode)
docker compose logs -f rust
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f rabbitmq
docker compose logs -f kafka
```

### Container Access

```bash
# Enter Rust container (for cargo commands)
docker compose exec rust bash

# PostgreSQL CLI
docker compose exec postgres psql -U app -d blazing_sun

# Redis CLI
docker compose exec redis redis-cli -a redis_secret_password

# RabbitMQ status
docker compose exec rabbitmq rabbitmqctl status

# Kafka topics
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092
```

### Build & Rebuild

```bash
# Rebuild all containers
docker compose build --no-cache

# Rebuild specific container
docker compose build --no-cache rust

# Rebuild and restart
docker compose up -d --build

# Full reset (WARNING: deletes all data)
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

---

## Environment Variables

### Root `.env` (Docker Configuration)

```env
# Build mode
BUILD_ENV=dev                           # dev or prod

# App
APP_PORT=9999

# PostgreSQL
POSTGRES_IP=172.28.0.11
POSTGRES_USER=app
POSTGRES_PASSWORD=app
POSTGRES_DB=blazing_sun
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# pgAdmin (PostgreSQL admin panel)
PGADMIN_IP=172.28.0.19
PGADMIN_PORT=5050
PGADMIN_DEFAULT_EMAIL=admin@blazingsun.app
PGADMIN_DEFAULT_PASSWORD=pgadmin_secret_password

# Redis
REDIS_IP=172.28.0.13
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_USER=app
REDIS_PASSWORD=redis_secret_password
REDIS_DB=0

# RabbitMQ (async tasks: emails, user creation)
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=app
RABBITMQ_PASSWORD=rabbitmq_secret_password
RABBITMQ_VHOST=/

# Kafka (event streaming: audit, analytics)
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

# Email (SMTP/Mailtrap)
MAIL_MAILER=smtp
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your_mailtrap_username
MAIL_PASSWORD=your_mailtrap_password
MAIL_FROM_ADDRESS=noreply@blazingsun.app
MAIL_FROM_NAME=BlazingSun

# Grafana
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
```

### Environment Sync

The `rust/entrypoint.sh` automatically syncs environment variables from Docker to `blazing_sun/.env` on container startup:
- PORT, POSTGRES_*, REDIS_*, RABBITMQ_*, KAFKA_*, MAIL_*

---

## Build Modes

Set `BUILD_ENV` in `.env`:

### Development (`dev`)
- Hot reload with cargo-watch
- Auto-runs `cargo sqlx prepare` on file changes
- Debug logging enabled (`RUST_LOG=debug`)
- Source maps included

### Production (`prod`)
- Release build with optimizations
- Runs compiled binary directly
- Minimal logging (`RUST_LOG=info`)
- No development tools

---

## Container Details

### Rust Container
- **Base**: `debian:bookworm-slim` + rustup stable
- **Working dir**: `/home/rust/blazing_sun`
- **Volumes**:
  - `./blazing_sun` → `/home/rust/blazing_sun` (source code)
  - `cargo-cache` → `/usr/local/cargo/registry` (dependencies)
  - `target-cache` → `/home/rust/blazing_sun/target` (build cache)
- **Dev tools**: sqlx-cli, cargo-watch

### PostgreSQL Container
- **Base**: `postgres:latest`
- **Data volume**: `pgdata`
- **Config**: Custom `pg_hba.conf` and `postgresql.conf`
- **Healthcheck**: `pg_isready -U app -d blazing_sun`

### Redis Container
- **Base**: `redis:alpine`
- **Data volume**: `redisdata`
- **Config**: Custom `redis.conf` with ACL authentication
- **Healthcheck**: `redis-cli -a password ping`

### RabbitMQ Container
- **Base**: `rabbitmq:management-alpine`
- **Data volume**: `rabbitmqdata`
- **Management UI**: http://localhost:15672
- **Healthcheck**: `rabbitmq-diagnostics -q ping`
- **Purpose**: Async task queue (emails, user creation)

### Kafka Container
- **Base**: `apache/kafka:latest`
- **Data volume**: `kafkadata`
- **Mode**: KRaft (no Zookeeper required)
- **Healthcheck**: Broker API ready + `user.events` topic exists
- **Topics created on startup**: user.events, auth.events, transaction.events, category.events, system.events, events.dead_letter

### Kafka UI Container
- **Base**: `provectuslabs/kafka-ui:latest`
- **Port**: 8080
- **Authentication**: LOGIN_FORM (username/password)
- **Purpose**: Kafka topic/message management

### Nginx Container
- **Base**: `nginx:alpine`
- **Ports**: 80 (HTTP→HTTPS redirect), 443 (HTTPS)
- **SSL**: Self-signed certificates (replace for production)
- **Proxy**: Routes to rust container on port 9999
- **Static files**: Serves `/storage/` from `blazing_sun/storage/app/public/`

### pgAdmin Container
- **Base**: `dpage/pgadmin4:latest`
- **Port**: 5050
- **Purpose**: PostgreSQL database administration
- **Pre-configured**: Server connection to postgres container

### Prometheus Container
- **Base**: `prom/prometheus:latest`
- **Data volume**: `prometheusdata`
- **Port**: 9090
- **Purpose**: Metrics collection from RabbitMQ and other services

### Grafana Container
- **Base**: `grafana/grafana:latest`
- **Data volume**: `grafanadata`
- **Port**: 3000
- **Sub-path**: `/grafana/` (accessible via nginx)
- **Purpose**: Monitoring dashboards

---

## Volumes

| Volume         | Purpose                          |
|----------------|----------------------------------|
| pgdata         | PostgreSQL data persistence      |
| redisdata      | Redis data persistence           |
| rabbitmqdata   | RabbitMQ data persistence        |
| kafkadata      | Kafka logs and data              |
| cargo-cache    | Cargo registry cache             |
| target-cache   | Rust build artifacts cache       |
| prometheusdata | Prometheus metrics storage       |
| grafanadata    | Grafana dashboards and config    |
| pgadmindata    | pgAdmin configuration            |

---

## Event-Driven Architecture

### Kafka Topics

| Topic                | Events                                          | Retention |
|----------------------|-------------------------------------------------|-----------|
| `user.events`        | created, updated, deleted, activated            | 7 days    |
| `auth.events`        | sign_in, sign_in_failed, sign_out               | 7 days    |
| `transaction.events` | created, updated, deleted                       | 7 days    |
| `category.events`    | created, updated, deleted                       | 7 days    |
| `system.events`      | health_check, error, warning                    | 7 days    |
| `events.dead_letter` | Failed events (for reprocessing)                | 7 days    |

### RabbitMQ Jobs

| Job           | Description                  | Priority |
|---------------|------------------------------|----------|
| `send_email`  | Send email via SMTP          | 1-5      |
| `create_user` | Create user in database      | 1-5      |

See [blazing_sun/README.md](blazing_sun/README.md) for implementation details.

---

## Web UIs

| Service     | URL                                  | Credentials                          |
|-------------|--------------------------------------|--------------------------------------|
| Application | https://localhost/                   | -                                    |
| RabbitMQ    | http://localhost:15672               | app / rabbitmq_secret_password       |
| Kafka UI    | http://localhost:8080/kafka          | admin / kafka_ui_secret_password     |
| pgAdmin     | http://localhost:5050/pgadmin        | admin@blazingsun.app / pgadmin_secret_password |
| Grafana     | https://localhost/grafana/           | admin / admin                        |
| Prometheus  | http://localhost:9090                | -                                    |

---

## SSL Certificates

### Development
Uses self-signed certificates generated in the nginx container.

### Production
Replace certificates in nginx:

```bash
# Copy your certificates
docker cp your-cert.pem rust-nginx-1:/etc/nginx/ssl/cert.pem
docker cp your-key.pem rust-nginx-1:/etc/nginx/ssl/key.pem

# Restart nginx
docker compose restart nginx
```

Or mount certificates via docker-compose.yml volumes.

---

## Firewall Setup

For production servers, run the firewall setup script:

```bash
sudo ./firewall-setup.sh
```

This configures UFW to:
- Allow SSH (22)
- Allow HTTP (80)
- Allow HTTPS (443)
- Block direct access to internal ports (5432, 6379, 9999, 5672, 9092, etc.)

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs rust

# Check healthcheck status
docker compose ps

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database connection issues

```bash
# Check postgres is healthy
docker compose ps postgres

# Test connection
docker compose exec postgres pg_isready -U app -d blazing_sun

# View logs
docker compose logs postgres
```

### Redis connection issues

```bash
# Test connection
docker compose exec redis redis-cli -a redis_secret_password ping

# View logs
docker compose logs redis
```

### RabbitMQ connection issues

```bash
# Check status
docker compose exec rabbitmq rabbitmqctl status

# View logs
docker compose logs rabbitmq
```

### Kafka connection issues

```bash
# Check broker status
docker compose exec kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# List topics (should show user.events, auth.events, etc.)
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092

# Consume messages (for debugging)
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic user.events \
    --from-beginning

# View logs
docker compose logs kafka
```

### Rust app not starting

```bash
# Check if waiting for dependencies
docker compose logs rust | grep -i "waiting\|healthy\|error"

# Check all dependencies are healthy
docker compose ps | grep -E "postgres|redis|rabbitmq|kafka"
```

### Stale files in container

```bash
# Restart to refresh volume mounts
docker compose restart rust
```

### Full reset

```bash
# Remove all containers and volumes
docker compose down -v

# Remove all images
docker compose down --rmi all

# Rebuild everything
docker compose build --no-cache
docker compose up -d
```

---

## Technology Versions

| Service    | Base Image                         |
|------------|------------------------------------|
| Rust       | debian:bookworm-slim + rustup stable |
| PostgreSQL | postgres:latest                    |
| Redis      | redis:alpine                       |
| RabbitMQ   | rabbitmq:management-alpine         |
| Kafka      | apache/kafka:latest (KRaft)        |
| Kafka UI   | provectuslabs/kafka-ui:latest      |
| Nginx      | nginx:alpine                       |
| pgAdmin    | dpage/pgadmin4:latest              |
| Grafana    | grafana/grafana:latest             |
| Prometheus | prom/prometheus:latest             |
