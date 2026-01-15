# Docker Infrastructure Documentation

This document provides comprehensive documentation of the Blazing Sun Docker infrastructure.

## Table of Contents

1. [Overview](#overview)
2. [Network Architecture](#network-architecture)
3. [Services Reference](#services-reference)
4. [Startup Sequence](#startup-sequence)
5. [Environment Variables](#environment-variables)
6. [Volumes](#volumes)
7. [Service Details](#service-details)
8. [Web UIs](#web-uis)
9. [Commands Reference](#commands-reference)
10. [Troubleshooting](#troubleshooting)

---

## Overview

Blazing Sun uses a Docker Compose orchestration with **17 services** running on a private bridge network (`devnet` - 172.28.0.0/16).
The checkout service is a dedicated Rust microservice for Stripe payments and Kafka integration backed by its own PostgreSQL database.

### Architecture Diagram

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
                                    │       │               ├──│      Kafka :9092             │  │
                                    │       │               │  │ (Events: DB Mutations, Auth) │  │
                                    │       │               │  │     KRaft Mode (no ZK)       │  │
                                    │       │               │  └──────────────────────────────┘  │
                                    │       │               │              │                      │
                                    │       │               │         ┌────┴────┐                │
                                    │       │               │         │Kafka UI │                │
                                    │       │               │         │  :8080  │                │
                                    │       │               │         └─────────┘                │
                                    │       │               │                                     │
                                    │       │               │  ┌──────────────────────────────┐  │
                                    │       │               └──│      MongoDB :27017          │  │
                                    │       │                  │    (Document Database)        │  │
                                    │       │                  └──────────────────────────────┘  │
                                    │       │                              │                      │
                                    │       │                         ┌────┴────────┐            │
                                    │       │                         │Mongo Express│            │
                                    │       │                         │    :8081    │            │
                                    │       │                         └─────────────┘            │
                                    │       │                                                     │
                                    │  ┌────┴─────┐    ┌──────────┐                              │
                                    │  │Prometheus│───▶│ Grafana  │                              │
                                    │  │  :9090   │    │  :3000   │                              │
                                    │  └──────────┘    └──────────┘                              │
                                    │                                                              │
                                    └─────────────────────────────────────────────────────────────┘
```

Note: The diagram focuses on core HTTP/data services; `ws_gateway` runs as a separate microservice and depends on Kafka + Redis.

---

## Network Architecture

### Network Configuration

| Property | Value |
|----------|-------|
| Network Name | `devnet` |
| Driver | `bridge` |
| Subnet | `172.28.0.0/16` |
| Gateway | `172.28.0.1` |

### IP Address Assignments

| Service | Static IP | Port(s) Exposed |
|---------|-----------|-----------------|
| rust | 172.28.0.10 | 9999 (internal) |
| checkout | 172.28.0.24 | 9996 |
| checkout-postgres | 172.28.0.25 | 5433 |
| postgres | 172.28.0.11 | 5432 |
| nginx | 172.28.0.12 | 80, 443 |
| redis | 172.28.0.13 | 6379 |
| rabbitmq | 172.28.0.14 | 5672, 15672, 15692 |
| prometheus | 172.28.0.15 | 9090 |
| grafana | 172.28.0.16 | 3000 |
| kafka | 172.28.0.17 | 9092, 9093 |
| kafka-ui | 172.28.0.18 | 8080 |
| pgadmin | 172.28.0.19 | 5050 |
| pgadmin-checkout | 172.28.0.26 | 5051 |
| mongo | 172.28.0.20 | 27017 |
| mongo-express | 172.28.0.21 | 8081 |
| php-oauth | 172.28.0.22 | 443 (host 8889) |
| ws_gateway | 172.28.0.23 | 9998 (WS), 9997 (health) |

---

## Services Reference

| Service | Purpose | Healthcheck | Restart Policy |
|---------|---------|-------------|----------------|
| **rust** | Main Actix-web application | None | unless-stopped |
| **checkout** | Stripe checkout microservice | `curl -f http://localhost:9996/health` | unless-stopped |
| **checkout-postgres** | PostgreSQL database for checkout transactions | `pg_isready -U checkout -d checkout -p 5433` | unless-stopped |
| **ws_gateway** | WebSocket gateway for real-time features | `curl -f http://localhost:9997/health` | unless-stopped |
| **postgres** | Primary relational database (SQLx) | `pg_isready -U app -d blazing_sun` | unless-stopped |
| **nginx** | SSL termination, reverse proxy, static files | None | unless-stopped |
| **redis** | Cache and session storage | `redis-cli -a password ping` | unless-stopped |
| **rabbitmq** | Async task queue (emails, jobs) | `rabbitmq-diagnostics -q ping` | unless-stopped |
| **kafka** | Event streaming (KRaft mode) | Broker API + required topics check | unless-stopped |
| **kafka-ui** | Kafka management web UI | None | unless-stopped |
| **prometheus** | Metrics collection | None | unless-stopped |
| **grafana** | Monitoring dashboards | None | unless-stopped |
| **pgadmin** | PostgreSQL admin panel | None | unless-stopped |
| **pgadmin-checkout** | pgAdmin for checkout database | None | unless-stopped |
| **mongo** | Document database for flexible schemas | `mongosh --eval db.adminCommand('ping')` | unless-stopped |
| **mongo-express** | MongoDB admin web UI | None | unless-stopped |
| **php-oauth** | OAuth callback test service | None | unless-stopped |

---

## Startup Sequence

Services start with health-check based dependencies:

```
Phase 1: Infrastructure (parallel start with healthchecks)
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis     │ │  RabbitMQ    │ │    Kafka     │ │   MongoDB    │
│ Healthcheck: │ │ Healthcheck: │ │ Healthcheck: │ │ Healthcheck: │ │ Healthcheck: │
│ pg_isready   │ │ redis ping   │ │ diagnostics  │ │ broker API   │ │ mongosh ping │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │                │                │
       └────────────────┴────────────────┴────────────────┴────────────────┘
                                         │
                                         ▼
Checkout PostgreSQL joins Phase 1 with the same `pg_isready` healthcheck pattern.
Phase 2: Application (waits for Phase 1 to be healthy)
┌───────────────────────────────────────────────────────────────────────────────┐
│                                    Rust App                                    │
│   depends_on: postgres(healthy), redis(healthy), rabbitmq(healthy),           │
│               kafka(healthy), mongo(healthy)                                   │
└───────────────────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────────────────────┐
│                                 Checkout                                      │
│   depends_on: checkout-postgres(healthy), kafka(healthy)                       │
└───────────────────────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────────────────────┐
│                                  ws_gateway                                    │
│   depends_on: kafka(healthy), redis(healthy)                                   │
└───────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
Phase 3: UI Services (depend on their backend services)
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ ┌──────────┐ ┌─────────────┐
│  Nginx   │ │ Kafka UI │ │ pgAdmin  │ │ pgAdmin Checkout │ │ Grafana  │ │Mongo Express│
│(on rust) │ │(on kafka)│ │  (on pg) │ │(on checkout pg)  │ │(on prom) │ │  (on mongo) │
└──────────┘ └──────────┘ └──────────┘ └──────────────────┘ └──────────┘ └─────────────┘
```

---

## Environment Variables

### Root `.env` File

```env
# Build Mode
BUILD_ENV=dev                    # dev or prod

# Application
APP_PORT=9999                    # Internal application port

# Checkout
CHECKOUT_IP=172.28.0.24
CHECKOUT_PORT=9996

# Checkout PostgreSQL
CHECKOUT_POSTGRES_IP=172.28.0.25
CHECKOUT_POSTGRES_HOST=checkout-postgres
CHECKOUT_POSTGRES_PORT=5433
CHECKOUT_POSTGRES_USER=checkout
CHECKOUT_POSTGRES_PASSWORD=checkout_secret_password
CHECKOUT_POSTGRES_DB=checkout

# php-oauth (callback test service)
OAUTH_CLIENT_ID=client_...        # OAuth client ID
OAUTH_CLIENT_SECRET=...           # OAuth client secret
OAUTH_CODE_VERIFIER=...           # PKCE code_verifier used to build code_challenge
OAUTH_TOKEN_URL=https://172.28.0.12/oauth/callback/exchange
OAUTH_REDIRECT_URI=https://local.fotobook.com:8889/callback.php

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

# pgAdmin Checkout
PGADMIN_CHECKOUT_IP=172.28.0.26
PGADMIN_CHECKOUT_PORT=5051
PGADMIN_CHECKOUT_DEFAULT_EMAIL=checkout-admin@blazingsun.app
PGADMIN_CHECKOUT_DEFAULT_PASSWORD=checkout_pgadmin_secret

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

# Mongo Express
MONGO_EXPRESS_IP=172.28.0.21
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=mongo_express_password

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

### Environment Sync

The `rust/entrypoint.sh` script syncs environment variables from Docker to `blazing_sun/.env` on startup:
- PORT, POSTGRES_*, REDIS_*, RABBITMQ_*, KAFKA_*, MONGO_*, MAIL_*

---

## Volumes

| Volume | Purpose | Persistence |
|--------|---------|-------------|
| `pgdata` | PostgreSQL database files | Persistent |
| `redisdata` | Redis RDB/AOF snapshots | Persistent |
| `rabbitmqdata` | RabbitMQ mnesia database | Persistent |
| `kafkadata` | Kafka log segments | Persistent |
| `mongodata` | MongoDB data files | Persistent |
| `cargo-cache` | Rust cargo registry cache | Persistent |
| `target-cache` | Rust compilation cache | Persistent |
| `checkout-cargo-cache` | Checkout cargo registry cache | Persistent |
| `checkout-target-cache` | Checkout compilation cache | Persistent |
| `checkout-pgdata` | Checkout PostgreSQL data files | Persistent |
| `prometheusdata` | Prometheus TSDB data | Persistent |
| `grafanadata` | Grafana dashboards/plugins | Persistent |
| `pgadmindata` | pgAdmin configuration | Persistent |
| `pgadmin-checkout-data` | pgAdmin checkout configuration | Persistent |

---

## Service Details

### 1. Rust Application (`rust`)

**Purpose**: Main Actix-web application server

**Configuration**:
- Base Image: `debian:bookworm-slim` with `rustup stable`
- Working Directory: `/home/rust/blazing_sun`
- Port: 9999 (internal only)
- Build Modes:
  - **dev**: Hot reload via `cargo-watch`, auto `sqlx prepare`
  - **prod**: Release binary with minimal runtime

**Volume Mounts**:
- `./blazing_sun:/home/rust/blazing_sun` - Application source code
- `cargo-cache:/usr/local/cargo/registry` - Cargo registry
- `target-cache:/home/rust/blazing_sun/target` - Build cache

**Dependencies**: postgres, redis, rabbitmq, kafka, mongo (all must be healthy)

---

### 2. Checkout Service (`checkout`)

**Purpose**: Stripe checkout + webhook processor (Kafka consumer/producer)

**Configuration**:
- Base Image: `debian:bookworm-slim` with `rustup stable`
- Working Directory: `/home/rust/checkout`
- Port: 9996 (health + Stripe webhooks)
- Kafka Topics: `checkout.commands`, `checkout.events`
- Auth: `JWT_SECRET` for user JWT verification (transactions)
- Service Auth: `CHECKOUT_SERVICE_TOKEN` for checkout command validation

**Volume Mounts**:
- `./checkout:/home/rust/checkout` - Checkout service source code
- `checkout-cargo-cache:/usr/local/cargo/registry` - Cargo registry
- `checkout-target-cache:/home/rust/checkout/target` - Build cache

**Dependencies**: checkout-postgres (healthy), kafka (healthy)

---

### 3. PostgreSQL (`postgres`)

**Purpose**: Primary relational database for structured data

**Configuration**:
- Base Image: `postgres:latest`
- Port: 5432
- Database: `blazing_sun`
- User: `app`

**Healthcheck**:
```bash
pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}
```

**Custom Files**:
- `postgres/pg_hba.conf` - Authentication rules
- `postgres/postgresql.conf.template` - Performance tuning
- `postgres/entrypoint.sh` - Database initialization

---

### 4. Checkout PostgreSQL (`checkout-postgres`)

**Purpose**: Dedicated PostgreSQL database for checkout transactions

**Configuration**:
- Base Image: `postgres:latest`
- Port: 5433
- Database: `checkout`
- User: `checkout`

**Healthcheck**:
```bash
pg_isready -U ${CHECKOUT_POSTGRES_USER} -d ${CHECKOUT_POSTGRES_DB} -p ${CHECKOUT_POSTGRES_PORT}
```

**Custom Files**:
- `postgres_checkout/pg_hba.conf` - Authentication rules
- `postgres_checkout/postgresql.conf.template` - Performance tuning
- `postgres_checkout/entrypoint.sh` - Database initialization

---

### 5. Nginx (`nginx`)

**Purpose**: SSL termination, reverse proxy, static file serving

**Configuration**:
- Base Image: `nginx:alpine`
- Ports: 80 (HTTP), 443 (HTTPS/TCP+UDP for HTTP/3)

**Functions**:
1. SSL termination with self-signed certificates
2. Reverse proxy to Rust app on port 9999
3. Static file serving at `/storage/` from `blazing_sun/src/storage/app/public`
4. Asset serving at `/assets/` from `blazing_sun/src/resources/`
5. Sub-path routing for `/grafana/`
6. Sub-path routing for `/checkout/` (checkout service webhooks)

**Volume Mounts**:
- `./blazing_sun/src/storage/app/public:/var/www/storage/public:ro`
- `./blazing_sun/src/resources/css:/var/www/assets/css:ro`
- `./blazing_sun/src/resources/js:/var/www/assets/js:ro`

---

### 6. Redis (`redis`)

**Purpose**: Cache, session storage, and pub/sub messaging

**Configuration**:
- Base Image: `redis:alpine`
- Port: 6379

**Healthcheck**:
```bash
redis-cli -a ${REDIS_PASSWORD} ping
```

---

### 7. RabbitMQ (`rabbitmq`)

**Purpose**: Async task queue for reliable job processing

**Configuration**:
- Base Image: `rabbitmq:management-alpine`
- Ports: 5672 (AMQP), 15672 (Management UI), 15692 (Prometheus)

**Use Cases**:
- Email sending
- User creation background jobs
- Payment processing
- Any task requiring guaranteed delivery

**Queues**:
- `jobs` - Main job queue (priority 0-10)
- `jobs_failed` - Dead letter queue

---

### 8. Kafka (`kafka`)

**Purpose**: Event streaming for audit logs and cross-service communication

**Configuration**:
- Base Image: `apache/kafka:latest`
- Mode: KRaft (no Zookeeper)
- Ports: 9092 (broker), 9093 (controller)

**Topics**:
| Topic | Description |
|-------|-------------|
| `user.events` | User lifecycle (created, updated, deleted, activated) |
| `auth.events` | Authentication (sign_in, sign_out, password_reset) |
| `transaction.events` | Financial transactions |
| `category.events` | Budget categories |
| `system.events` | Health checks, errors, warnings |
| `events.dead_letter` | Failed events for reprocessing |

---

### 9. MongoDB (`mongo`)

**Purpose**: Document database for flexible schema data

**Configuration**:
- Base Image: `mongo:latest`
- Port: 27017
- Database: `blazing_sun`

**Healthcheck**:
```bash
mongosh --eval "db.adminCommand('ping')" --quiet
```

**Use Cases**:
- Flexible document storage
- Audit logs with varying schemas
- User preferences
- Analytics data

---

### 10. Monitoring Stack

**Prometheus** (172.28.0.15:9090):
- Metrics collection from all services
- Time-series database for monitoring data

**Grafana** (172.28.0.16:3000):
- Dashboard visualization
- Accessible at `https://localhost/grafana/`

---

## Web UIs

| Service | URL | Credentials |
|---------|-----|-------------|
| Application | `https://localhost/` | - |
| RabbitMQ | `http://localhost:15672` | app / rabbitmq_secret_password |
| Kafka UI | `http://localhost:8080/kafka` | admin / kafka_ui_secret_password |
| pgAdmin | `https://localhost/pgadmin/` | admin@blazingsun.app / pgadmin_secret_password |
| pgAdmin Checkout | `https://localhost/pgadmin_checkout/` | checkout-admin@blazingsun.app / checkout_pgadmin_secret |
| Mongo Express | `http://localhost:8081/mongo/` | admin / mongo_express_password |
| PHP OAuth Test | `https://localhost:8889` | - |
| Grafana | `https://localhost/grafana/` | admin / admin |
| Prometheus | `http://localhost:9090` | - |

---

## Commands Reference

### Basic Operations

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart specific service
docker compose restart rust

# View logs (follow mode)
docker compose logs -f rust
docker compose logs -f postgres
docker compose logs -f kafka

# View all logs
docker compose logs
```

### Container Access

```bash
# Enter Rust container
docker compose exec rust bash

# PostgreSQL CLI
docker compose exec postgres psql -U app -d blazing_sun

# Redis CLI
docker compose exec redis redis-cli -a redis_secret_password

# MongoDB Shell
docker compose exec mongo mongosh -u app -p mongo_secret_password blazing_sun

# Kafka shell
docker compose exec kafka bash
```

### Build Operations

```bash
# Rebuild all containers
docker compose build --no-cache

# Rebuild specific container
docker compose build --no-cache rust

# Start with rebuild
docker compose up -d --build
```

### Reset Operations

```bash
# Full reset (deletes all data)
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Kafka Operations

```bash
# List topics
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092

# Consume messages
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic user.events \
    --from-beginning

# Create topic
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --create \
    --bootstrap-server localhost:9092 \
    --topic new.topic \
    --partitions 3 \
    --replication-factor 1
```

---

## Troubleshooting

### Database Connection Failed

```bash
docker compose logs postgres
docker compose exec postgres pg_isready -U app -d blazing_sun
```

### Redis Connection Failed

```bash
docker compose exec redis redis-cli -a redis_secret_password ping
```

### RabbitMQ Connection Failed

```bash
docker compose logs rabbitmq
docker compose exec rabbitmq rabbitmq-diagnostics -q ping
```

### Kafka Connection Failed

```bash
docker compose logs kafka
docker compose exec kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092
```

### MongoDB Connection Failed

```bash
docker compose logs mongo
docker compose exec mongo mongosh --eval "db.adminCommand('ping')"
```

### Stale Files in Container

```bash
docker compose restart rust
```

### Port Already in Use

```bash
# Find process using port
sudo lsof -i :5432
# Kill process
sudo kill -9 <PID>
```

### Reset Everything

```bash
docker compose down -v
docker system prune -a
docker compose build --no-cache
docker compose up -d
```

---

## File Locations

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service orchestration |
| `.env` | Environment variables |
| `rust/Dockerfile` | Rust application image |
| `rust/entrypoint.sh` | Application startup script |
| `postgres/Dockerfile` | PostgreSQL image |
| `postgres/postgresql.conf.template` | PostgreSQL configuration |
| `nginx/default.conf.template` | Nginx configuration |
| `redis/redis.conf` | Redis configuration |
| `rabbitmq/rabbitmq.conf` | RabbitMQ configuration |
| `kafka/entrypoint.sh` | Kafka topic creation |
| `mongo/mongod.conf.template` | MongoDB configuration |
| `prometheus/prometheus.yml` | Prometheus targets |
| `grafana/provisioning/` | Grafana datasources/dashboards |

---

## Technology Versions

| Service | Base Image |
|---------|------------|
| Rust | debian:bookworm-slim + rustup stable |
| PostgreSQL | postgres:latest |
| Redis | redis:alpine |
| RabbitMQ | rabbitmq:management-alpine |
| Kafka | apache/kafka:latest (KRaft) |
| Kafka UI | provectuslabs/kafka-ui:latest |
| Nginx | nginx:alpine |
| pgAdmin | dpage/pgadmin4:latest |
| MongoDB | mongo:latest |
| Mongo Express | mongo-express:latest |
| Grafana | grafana/grafana:latest |
| Prometheus | prom/prometheus:latest |
